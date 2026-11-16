"""Run inside the pinned overlay against an explicitly named isolated PG fixture."""
from contextlib import contextmanager
from datetime import datetime,timedelta,timezone
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import psycopg
from collector_readiness.limits import Budget,Blocked
from collector_readiness.discovery import metadata_row
from youtopia_collector.common.http import RequestsTransport
from youtopia_collector.db.repository import CollectorRepository


class FixtureDB:
    config=SimpleNamespace(collector_schema='collector',raw_schema='raw')
    @contextmanager
    def transaction(self):
        if os.environ.get('YOUTOPIA_ISOLATED_TEST_PG')!='ytp-collector-prep-test-pg':
            raise RuntimeError('EXPLICIT_ISOLATED_DATABASE_REQUIRED')
        with psycopg.connect(host='ytp-collector-prep-test-pg',dbname='postgres',user='postgres',connect_timeout=3) as connection:
            yield connection


class ReconcileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db=FixtureDB();cls.repo=CollectorRepository(cls.db)
        with cls.db.transaction() as c:
            c.execute('CREATE SCHEMA IF NOT EXISTS collector')
            c.execute('''CREATE TABLE IF NOT EXISTS collector.steam_app_candidate(app_id bigint PRIMARY KEY,
              eligibility_status text,app_type text)''')
            c.execute('''CREATE TABLE IF NOT EXISTS collector.steam_tracking_signal(app_id bigint,signal_source text,
              scope_key text,last_seen_at timestamptz,last_source_reference text,deactivated_at timestamptz,
              expires_at timestamptz)''')
            for table in ['steam_ccu_target','youtube_game_target']:
                c.execute(f'''CREATE TABLE IF NOT EXISTS collector.{table}(app_id bigint PRIMARY KEY,active bool,
                  lifecycle_state text,selected_at timestamptz,selection_reason text,selection_source_reference text,
                  state_changed_at timestamptz,cooldown_started_at timestamptz,grace_until timestamptz,
                  next_due_at timestamptz,retired_at timestamptz,updated_at timestamptz)''')
    def setUp(self):
        self.now=datetime.now(timezone.utc)
        with self.db.transaction() as c:
            c.execute('TRUNCATE collector.steam_app_candidate,collector.steam_tracking_signal,collector.steam_ccu_target,collector.youtube_game_target')
            c.execute("INSERT INTO collector.steam_app_candidate VALUES(1,'ELIGIBLE','game')")
    def signal(self,source='NEW_RELEASE',expires=1):
        with self.db.transaction() as c:c.execute('INSERT INTO collector.steam_tracking_signal VALUES(1,%s,%s,%s,%s,NULL,%s)',
            (source,source,self.now,'a'*32,self.now+timedelta(hours=expires)))
    def reconcile(self,enabled=True,now=None):
        with patch.dict(os.environ,{'YOUTOPIA_NEW_RELEASES_ENABLED':'1' if enabled else '0'}):
            with self.db.transaction() as c:self.repo._reconcile_targets(c,now=now or self.now,app_ids=[1])
    def targets(self):
        with self.db.transaction() as c:
            return (c.execute('SELECT active,lifecycle_state,selected_at FROM collector.steam_ccu_target').fetchall(),
                    c.execute('SELECT active,lifecycle_state FROM collector.youtube_game_target').fetchall())
    def test_new_source_only_ccu_no_youtube(self):
        self.signal();self.reconcile();ccu,youtube=self.targets();self.assertEqual(ccu[0][:2],(True,'ACTIVE'));self.assertEqual(youtube,[])
    def test_feature_disabled_preserves_old_no_promotion(self):
        self.signal();self.reconcile(False);self.assertEqual(self.targets(),([],[]))
    def test_legacy_source_still_promotes_both(self):
        self.signal('CONCURRENT_PLAYERS');self.reconcile();ccu,youtube=self.targets();self.assertTrue(ccu[0][0]);self.assertEqual(youtube,[(True,'ACTIVE')])
    def test_pending_or_non_game_not_promoted(self):
        self.signal()
        for status,kind in [('PENDING',None),('INELIGIBLE','demo'),('ELIGIBLE',None)]:
            with self.db.transaction() as c:c.execute('UPDATE collector.steam_app_candidate SET eligibility_status=%s,app_type=%s',(status,kind))
            self.reconcile();self.assertEqual(self.targets(),([],[]))
    def test_expiry_enters_legacy_cooldown_then_stops(self):
        self.signal();self.reconcile();self.reconcile(now=self.now+timedelta(hours=2))
        self.assertEqual(self.targets()[0][0][:2],(True,'COOLDOWN'))
        self.reconcile(now=self.now+timedelta(hours=75));self.assertEqual(self.targets()[0][0][:2],(False,'INACTIVE'))
    def test_reentry_preserves_first_selected_time(self):
        self.signal();self.reconcile();selected=self.targets()[0][0][2]
        self.reconcile(now=self.now+timedelta(hours=2))
        with self.db.transaction() as c:c.execute("UPDATE collector.steam_tracking_signal SET expires_at=%s",(self.now+timedelta(days=20),))
        self.reconcile(now=self.now+timedelta(hours=3));self.assertEqual(self.targets()[0][0][2],selected)
    def test_legacy_youtube_cools_independently(self):
        self.signal('CONCURRENT_PLAYERS');self.reconcile()
        with self.db.transaction() as c:c.execute('UPDATE collector.steam_tracking_signal SET deactivated_at=%s',(self.now,))
        self.signal();self.reconcile();ccu,youtube=self.targets();self.assertEqual(ccu[0][1],'ACTIVE');self.assertEqual(youtube,[(True,'COOLDOWN')])


class RuntimeGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);p=Path(self.tmp.name)
        self.policy={'state_id':'synthetic','state_path':str(p/'budget.sqlite'),'rolling_day_limit':100,
          'minute_limit':20,'minimum_interval_seconds':0.001,'new_rolling_day_limit':10}
        Budget.initialize(self.policy['state_path'],state_id='synthetic')
        self.file=p/'policy.json';self.file.write_text(json.dumps(self.policy))
    def transport(self,status):
        t=RequestsTransport(connect_timeout=1,read_timeout=1)
        response=SimpleNamespace(status_code=status,content=b'{}',headers={'Retry-After':'300'})
        fake=unittest.mock.Mock(return_value=response);t._session.get=fake;return t,fake
    def test_disabled_guard_leaves_legacy_transport_unchanged(self):
        t,fake=self.transport(200)
        with patch.dict(os.environ,{'YOUTOPIA_STEAM_GUARD_ENABLED':'0'}):t.get(endpoint='https://api.steampowered.com/example')
        self.assertNotIn('allow_redirects',fake.call_args.kwargs)
    def test_steam_request_reserved_and_redirects_disabled(self):
        t,fake=self.transport(200)
        with patch.dict(os.environ,{'YOUTOPIA_STEAM_GUARD_ENABLED':'1','YOUTOPIA_STEAM_GUARD_POLICY':str(self.file)}):t.get(endpoint='https://api.steampowered.com/example')
        self.assertFalse(fake.call_args.kwargs['allow_redirects']);self.assertEqual(Budget(self.policy['state_path'],self.policy).status()['reservations_total'],1)
    def test_other_provider_not_changed(self):
        t,fake=self.transport(200)
        with patch.dict(os.environ,{'YOUTOPIA_STEAM_GUARD_ENABLED':'1'}):t.get(endpoint='https://www.googleapis.com/example')
        self.assertEqual(Budget(self.policy['state_path'],self.policy).status()['reservations_total'],0)
    def test_429_blocks_next_attempt_without_another_send(self):
        t,fake=self.transport(429)
        with patch.dict(os.environ,{'YOUTOPIA_STEAM_GUARD_ENABLED':'1','YOUTOPIA_STEAM_GUARD_POLICY':str(self.file)}):
            t.get(endpoint='https://api.steampowered.com/example')
            with self.assertRaises(Blocked):t.get(endpoint='https://api.steampowered.com/example')
        self.assertEqual(fake.call_count,1)


class MetadataTests(unittest.TestCase):
    def test_tag_ids_without_names_use_only_reviewed_id_mapping(self):
        raw={'response':{'store_items':[{'appid':123,'name':'Synthetic','type':'game',
          'release':{'steam_release_date':1800000000},'tags':[{'tagid':19,'weight':100}]}]}}
        row=metadata_row(json.dumps(raw).encode(),123,'b'*32,observed_at=1800000001,mapping={'tag:19':'Action'})
        self.assertEqual(row['genres'],['Action']);self.assertEqual(row['steam_tag_ids'],[19]);self.assertEqual(row['steam_tag_names'],[])
    def test_real_base_parser_release_type_and_mapping(self):
        raw={'response':{'store_items':[{'appid':123,'name':'Synthetic','type':'game',
          'release':{'steam_release_date':1800000000},'tags':[{'tagid':19,'name':'Action'}]}]}}
        row=metadata_row(json.dumps(raw).encode(),123,'b'*32,observed_at=1800000001,mapping={'action':'Action'})
        self.assertEqual(row['app_type'],'game');self.assertEqual(row['identity_status'],'CONFIRMED')
        self.assertIsNotNone(row['release_at']);self.assertEqual(row['genres'],['Action'])
    def test_mismatched_id_is_not_relabelled(self):
        raw={'response':{'store_items':[{'appid':2,'name':'Other','type':'game'}]}}
        row=metadata_row(json.dumps(raw).encode(),1,'c'*32,observed_at=1800000001,mapping={'action':'Action'})
        self.assertEqual(row['identity_status'],'CONFLICT')


if __name__=='__main__':unittest.main()
