import copy
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error

from tools.collector_readiness.discovery import (SteamHTTP, Staging, discover, parse_app_page,
                                                 ProviderFailure, APP_LIST, retry_after)
from tools.collector_readiness.inventory import literal_assignments, config_projection, database_report,execution_projection
from tools.collector_readiness.limits import Budget, Blocked
from tools.collector_readiness.planner import plan


class Fixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.now = 1800000000.0
        self.policy = {'state_id': 'synthetic-state', 'rolling_day_limit': 20,
                       'minute_limit': 5, 'minimum_interval_seconds': 1,'new_rolling_day_limit':20}
        self.path = self.root / 'budget.sqlite'
        Budget.initialize(self.path, state_id=self.policy['state_id'], clock=lambda: self.now)
        self.budget = Budget(self.path, self.policy, clock=lambda: self.now)

    def tearDown(self):
        self.tmp.cleanup()

    def reserve_finish(self, key):
        self.budget.reserve(key, 'TEST')
        self.budget.finish(key, 'SUCCESS')


class BudgetTests(Fixture):
    def test_restart_keeps_usage_and_request_ids(self):
        self.reserve_finish('one')
        restarted = Budget(self.path, self.policy, clock=lambda: self.now + 10)
        self.assertEqual(restarted.status()['reservations_total'], 1)
        with self.assertRaisesRegex(Blocked, 'DUPLICATE'):
            restarted.reserve('one', 'TEST')

    def test_minimum_interval(self):
        self.reserve_finish('one')
        with self.assertRaisesRegex(Blocked, 'MINIMUM_INTERVAL'):
            self.budget.reserve('two', 'TEST')

    def test_minute_limit(self):
        self.policy['minute_limit'] = 1
        self.reserve_finish('one'); self.now += 2
        with self.assertRaisesRegex(Blocked, 'MINUTE_LIMIT'):
            self.budget.reserve('two', 'TEST')

    def test_rolling_day_boundary(self):
        self.policy['rolling_day_limit'] = 1
        self.reserve_finish('one'); self.now += 61
        with self.assertRaisesRegex(Blocked, 'ROLLING_DAY_LIMIT'):
            self.budget.reserve('two', 'TEST')
        self.now += 86400
        self.budget.reserve('two', 'TEST')

    def test_missing_state_never_recreated(self):
        self.path.unlink()
        with self.assertRaises(Blocked): self.budget.reserve('one', 'TEST')
        self.assertFalse(self.path.exists())

    def test_deleted_ledger_rows_block(self):
        self.reserve_finish('one')
        with sqlite3.connect(self.path) as c: c.execute('DELETE FROM reservations')
        with self.assertRaisesRegex(Blocked, 'LEDGER_LOSS'): self.budget.reserve('two', 'TEST')

    def test_wrong_state_id(self):
        self.policy['state_id'] = 'different'
        with self.assertRaisesRegex(Blocked, 'STATE_ID'): self.budget.reserve('one', 'TEST')

    def test_inflight_and_crash_fail_closed(self):
        self.budget.reserve('one', 'TEST');self.now += 100
        with self.assertRaisesRegex(Blocked, 'IN_FLIGHT'): self.budget.reserve('two', 'TEST')
        self.assertEqual(self.budget.status()['reservations_total'], 1)

    def test_concurrent_reservation_only_one_wins(self):
        results = []
        barrier = threading.Barrier(8)
        def worker(number):
            barrier.wait()
            try:
                Budget(self.path, self.policy, clock=lambda: self.now).reserve(str(number), 'TEST')
                results.append('OK')
            except Blocked: results.append('BLOCKED')
        threads = [threading.Thread(target=worker,args=(i,)) for i in range(8)]
        for t in threads: t.start()
        for t in threads: t.join()
        self.assertEqual(results.count('OK'),1)

    def test_clock_rollback(self):
        self.reserve_finish('one'); self.now -= 10
        with self.assertRaisesRegex(Blocked, 'CLOCK'): self.budget.reserve('two', 'TEST')

    def test_cooldown_and_no_refund(self):
        self.budget.reserve('one', 'TEST');self.budget.finish('one','NETWORK_UNKNOWN',cooldown_seconds=300)
        self.now += 60
        with self.assertRaisesRegex(Blocked, 'COOLDOWN'): self.budget.reserve('two','TEST')
        self.assertEqual(self.budget.status()['reservations_total'],1)

    def test_permissive_state_permissions_block(self):
        self.path.chmod(0o644)
        with self.assertRaisesRegex(Blocked, 'UNPROTECTED'): self.budget.reserve('one','TEST')


class Reply:
    def __init__(self, payload): self.body = json.dumps(payload).encode();self.status=200
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def read(self, maximum): return self.body[:maximum]


class Opener:
    def __init__(self, replies):self.replies=list(replies);self.requests=[]
    def open(self, request, timeout):
        self.requests.append(request)
        result=self.replies.pop(0)
        if isinstance(result,Exception):raise result
        return Reply(result)


def page(app_id, *, more):
    return {'response':{'apps':[{'appid':app_id,'name':'Synthetic game','last_modified':1700000000}],
                        'have_more_results':more,'last_appid':app_id}}


class DiscoveryTests(Fixture):
    def setUp(self):
        super().setUp();self.stage_path=self.root/'stage.sqlite';Staging.initialize(self.stage_path);self.stage=Staging(self.stage_path)

    def client(self, replies):
        opener=Opener(replies)
        return SteamHTTP(key='synthetic-api-key',budget=self.budget,opener=opener,clock=lambda:self.now),opener

    def pace(self,seconds):self.now+=seconds

    def test_real_client_format_header_no_key_in_url(self):
        client,opener=self.client([page(10,more=False)])
        result=discover(client,self.stage,maximum_pages=1,clock=lambda:self.now,sleeper=self.pace)
        self.assertEqual(result['status'],'DISCOVERY_SCAN_COMPLETE')
        req=opener.requests[0]
        self.assertNotIn('synthetic-api-key',req.full_url)
        self.assertEqual(req.get_header('X-webapi-key'),'synthetic-api-key')
        self.assertIn('input_json=',req.full_url)
        self.assertEqual(result['ccu_targets_admitted'],0)

    def test_partial_checkpoint_not_watermark(self):
        client,_=self.client([page(10,more=True)])
        result=discover(client,self.stage,maximum_pages=1,clock=lambda:self.now,sleeper=self.pace)
        self.assertIn('PARTIAL',result['status'])
        with self.stage.connect() as c:self.assertEqual(c.execute('SELECT watermark,cursor FROM checkpoint').fetchone(),(0,10))

    def test_resume_pages_same_watermark_and_new_run(self):
        client,opener=self.client([page(10,more=True),page(20,more=False)])
        result=discover(client,self.stage,maximum_pages=2,clock=lambda:self.now,sleeper=self.pace)
        self.assertEqual(result['status'],'DISCOVERY_SCAN_COMPLETE')
        with self.stage.connect() as c:
            self.assertEqual(c.execute('SELECT count(*) FROM candidate').fetchone()[0],2)
            self.assertEqual(c.execute('SELECT watermark,cursor FROM checkpoint').fetchone(),(1799999700,0))
            for body,digest in c.execute('SELECT body,sha256 FROM discovery_page'):
                import hashlib
                self.assertEqual(hashlib.sha256(body).hexdigest(),digest)

    def test_http_failures_no_retry_no_credentials_echo(self):
        for status in (401,403,429,500,503,302):
            with self.subTest(status=status):
                self.now+=400
                error=urllib.error.HTTPError('https://example.invalid/?private=synthetic-api-key',status,'synthetic-api-key',{'Retry-After':'10'},None)
                client,opener=self.client([error])
                with self.assertRaises(ProviderFailure) as caught:client.get(APP_LIST,{},operation='APP_LIST')
                self.assertNotIn('synthetic-api-key',str(caught.exception));self.assertEqual(len(opener.requests),1)

    def test_timeout_no_refund(self):
        client,opener=self.client([TimeoutError('synthetic-api-key')])
        with self.assertRaisesRegex(ProviderFailure,'UNKNOWN'):client.get(APP_LIST,{},operation='APP_LIST')
        self.assertEqual(len(opener.requests),1);self.assertEqual(self.budget.status()['reservations_total'],1)

    def test_failed_page_keeps_checkpoint(self):
        client,_=self.client([page(10,more=True),TimeoutError()])
        with self.assertRaises(ProviderFailure):discover(client,self.stage,maximum_pages=2,clock=lambda:self.now,sleeper=self.pace)
        with self.stage.connect() as c:self.assertEqual(c.execute('SELECT watermark,cursor FROM checkpoint').fetchone(),(0,10))

    def test_duplicate_id_and_stuck_cursor_rejected(self):
        with self.assertRaises(ProviderFailure):parse_app_page(page(10,more=True),after_app_id=10)
        doc=page(10,more=True);doc['response']['apps']*=2
        with self.assertRaises(ProviderFailure):parse_app_page(doc,after_app_id=0)

    def test_missing_pagination_not_assumed_complete(self):
        with self.assertRaises(ProviderFailure):parse_app_page({'response':{'apps':[]}},after_app_id=0)

    def test_retry_after_date_and_invalid(self):
        self.assertEqual(retry_after('12',0),12)
        self.assertEqual(retry_after('not a date',0),300)


class PlannerTests(unittest.TestCase):
    def row(self,app_id=1,genres=None):
        return {'app_id':app_id,'app_type':'game','release_at':'2026-11-01T00:00:00Z',
                'metadata_observed_at':'2026-11-17T00:00:00Z','release_date_status':'EXACT',
                'identity_status':'CONFIRMED','genre_source':'STEAM_GENRE','genres':genres or ['RPG'],
                'evidence_run_reference':'synthetic-run'}
    def make(self,rows,**kw):
        return plan(rows,as_of='2026-11-17T00:00:00Z',release_days=30,maximum_games=kw.pop('maximum_games',10),interval_minutes=60,**kw)
    def test_multigenre_one_game_one_cost(self):
        result=self.make([self.row(1,['RPG','Action']),self.row(2,['Action'])]);self.assertEqual(len(result['selected']),2);self.assertEqual(result['nominal_additional_calls_per_24h'],48)
    def test_date_boundary_and_unknowns(self):
        row=self.row();row['release_at']='2026-10-18T00:00:00Z';self.assertEqual(len(self.make([row])['selected']),1)
        for value in ['2026-10-17T23:59:59Z','2026-11-17T00:00:01Z',None,'2026-11-01']:
            row=self.row();row['release_at']=value;self.assertEqual(len(self.make([row])['selected']),0)
    def test_products_metadata_and_identity_unknown(self):
        for key,value in [('app_type','demo'),('app_type',None),('release_date_status','UNKNOWN'),('identity_status','CONFLICT'),('genre_source','STEAM_TAG'),('genres',[]),('metadata_observed_at','2026-11-10T00:00:00Z')]:
            row=self.row();row[key]=value;self.assertFalse(self.make([row])['selected'])
    def test_existing_target_not_reactivated_or_duplicated(self):
        self.assertFalse(self.make([self.row()],existing_app_ids=[1])['selected'])
    def test_conflicting_duplicate_quarantined(self):
        one=self.row();two={**one,'genres':['Action']};self.assertFalse(self.make([one,two,one])['selected'])
    def test_waiting_list_not_silently_dropped(self):
        result=self.make([self.row(1),self.row(2)],maximum_games=1);self.assertEqual(len(result['waiting_app_ids']),1)


class InventoryTests(unittest.TestCase):
    def test_execution_metadata_omits_inline_values_and_unresolved_mounts(self):
        source='CODE=/safe/code\nENV_FILE=/safe/env-file\nflock -n /safe/collector.lock docker run -v "$CODE:/app:ro" --env-file "$ENV_FILE" -e API_KEY=synthetic-value --network safe-net -v "$UNKNOWN:/unknown" image\n'
        result=execution_projection(source,literal_assignments(source))
        self.assertEqual(result['docker_runs'][0]['binds'],[{'host':'/safe/code','container':'/app','mode':'ro'}])
        self.assertEqual(result['docker_runs'][0]['unresolved_mounts'],1)
        self.assertNotIn('synthetic-value',json.dumps(result));self.assertEqual(result['lock_paths'],['/safe/collector.lock'])
    def test_no_shell_evaluation_or_secret_export(self):
        source='CODE=/safe/path\nIMAGE=public.example/collector:tag\nCONFIG="${CODE}/production.json"\nPASSWORD=synthetic-password\nENV_FILE=/safe/secrets/.env\nIMAGE=$(touch /tmp/do-not-run)\n'
        result=literal_assignments(source)
        self.assertEqual(result['CONFIG'],'/safe/path/production.json')
        self.assertNotIn('synthetic-password',json.dumps(result));self.assertNotIn('PASSWORD',result)
    def test_projection_omits_keys_passwords_sql(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'production.json';p.write_text(json.dumps({'password':'synthetic-password','steam':{'ccu':{'enabled':True,'slot_minutes':60},'api_key':'synthetic-key'}}))
            result=config_projection(p);self.assertEqual(result['settings']['steam.ccu.slot_minutes'],60)
            self.assertNotIn('synthetic-password',json.dumps(result));self.assertNotIn('synthetic-key',json.dumps(result))
    def test_db_commands_read_only_and_bounded(self):
        calls=[]
        def fake(argv,**kwargs):calls.append((argv,kwargs));return {'status':'OK','stdout':'{}'}
        with patch('tools.collector_readiness.inventory.run',fake):database_report('synthetic-pg','synthetic','synthetic-reader')
        self.assertEqual(len(calls),7)
        for argv,kwargs in calls:
            self.assertIn('BEGIN READ ONLY',kwargs['input_text']);self.assertIn("statement_timeout='3s'",kwargs['input_text']);self.assertTrue(kwargs['input_text'].endswith('ROLLBACK;'));self.assertNotIn('ALTER ',kwargs['input_text'])

    def test_deep_ccu_audit_is_opt_in_bounded_and_failure_is_not_zero(self):
        calls=[]
        def fake(argv,**kwargs):
            calls.append((argv,kwargs))
            return {'status':'UNAVAILABLE','reason':'PERMISSION_DENIED'}
        with patch('tools.collector_readiness.inventory.run',fake):
            result=database_report('synthetic-pg','synthetic','synthetic-reader',deep_ccu_audit=True)
        self.assertEqual(len(calls),13)
        self.assertTrue(all(x=={'status':'UNAVAILABLE','reason':'PERMISSION_DENIED'} for x in result.values()))
        for argv,kwargs in calls:
            self.assertIn('BEGIN READ ONLY',kwargs['input_text'])
            self.assertIn("statement_timeout='3s'",kwargs['input_text'])
            self.assertIn("lock_timeout='500ms'",kwargs['input_text'])
            self.assertTrue(kwargs['input_text'].endswith('ROLLBACK;'))
            self.assertEqual(kwargs['timeout'],6)
            for field in ['error_message','quota_scope_alias','worker_identity']:
                self.assertNotIn(field,kwargs['input_text'])


if __name__=='__main__':unittest.main()
