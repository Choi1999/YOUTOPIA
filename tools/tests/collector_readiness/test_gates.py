from datetime import datetime,timedelta,timezone
import copy
import json
from pathlib import Path
import tempfile
import unittest

from tools.collector_readiness.limits import Budget,Blocked
from tools.collector_readiness.planner import plan
from tools.collector_readiness.readiness import assess,initial_debit
from tools.collector_readiness.patch_image import patched
from tools.collector_readiness.__main__ import read


class ReadinessTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime(2026,11,17,tzinfo=timezone.utc)
        self.policy={'expected_host':'synthetic-server','expected_database':'synthetic-db',
            'reviewed_wrapper_sha256':'a'*64,'reviewed_ccu_config_path':'/synthetic/current.json',
            'all_steam_jobs_share_guard_state':True,'other_api_consumers_accounted_for':True,
            'maximum_games':2,'interval_minutes':60,'rolling_day_limit':2000,
            'minute_limit':60,'minimum_interval_seconds':1,'failure_and_other_work_reserve':200,
            'new_rolling_day_limit':100,'reviewed_success_job_types':['steam-ccu']}
        self.inv={'kind':'COLLECTOR_READINESS_INVENTORY_V1','as_of_utc':self.now.isoformat(),'host':'synthetic-server',
            'wrapper':{'sha256':'a'*64},'image':{'status':'OK','data':{'id':'sha256:f5b8ed5bc49ffec9b07fb67ef8ea43f0c25832b95ef19a431ffa118d64d02ea4','repo_digests':[]}},
            'configs':[{'status':'OK','path':'/synthetic/current.json','settings':{'steam.ccu.slot_minutes':60,
                'steam.ccu.enabled':True,'steam.ccu.maximum_games_per_run':None,'retry.max_attempts':3}}],
            'database':{'identity':{'status':'OK','data':{'database':'synthetic-db','read_only':'on'}},
              'target_counts':{'status':'OK','data':{'active':10}},
              'recent_jobs':{'status':'OK','data':[{'status':'SUCCESS','job_type':'steam-ccu','finished_at':self.now.isoformat()}]},
              'attempts_24h':{'status':'OK','data':[{'source_type':'STEAM','actual_attempts':100,'http_status':200}]}}}
    def verdict(self):return assess(self.inv,self.policy,now=self.now)
    def test_complete_evidence_is_operator_review_not_auto_execution(self):
        result=self.verdict();self.assertEqual(result['status'],'READY_FOR_OPERATOR_REVIEW')
        self.assertEqual(result['additional_ccu_worst_case_attempts_24h'],144)
        self.assertEqual(result['automatic_production_changes'],0)
    def test_reviewed_local_image_without_repo_digests_is_supported(self):
        self.inv['image']['data']={'id':'sha256:'+'b'*64,'repo_digests':None}
        self.policy['reviewed_overlay_image_id']='sha256:'+'b'*64
        self.assertEqual(self.verdict()['status'],'READY_FOR_OPERATOR_REVIEW')
    def test_failed_query_not_zero(self):
        self.inv['database']['attempts_24h']={'status':'UNAVAILABLE'}
        result=self.verdict();self.assertIsNone(result['existing_steam_attempts_24h']);self.assertEqual(result['status'],'BLOCKED')
    def test_stale_inventory_blocks(self):
        self.inv['as_of_utc']=(self.now-timedelta(hours=7)).isoformat()
        self.assertIn('INVENTORY_NOT_FRESH',self.verdict()['blockers'])
    def test_wrong_database_blocks(self):
        self.inv['database']['identity']['data']['database']='other'
        self.assertIn('DATABASE_TARGET_NOT_CONFIRMED',self.verdict()['blockers'])
    def test_other_successful_jobs_are_not_proof_of_ccu_collection(self):
        self.inv['database']['recent_jobs']['data'][0]['job_type']='youtube-stats'
        self.assertIn('RECENT_COLLECTION_SUCCESS_NOT_CONFIRMED',self.verdict()['blockers'])
    def test_changed_interval_not_silent(self):
        self.policy['interval_minutes']=30
        self.assertIn('LEGACY_CCU_INTERVAL_WOULD_CHANGE',self.verdict()['blockers'])
    def test_bounded_existing_job_would_starve_new_or_old_targets(self):
        self.inv['configs'][0]['settings']['steam.ccu.maximum_games_per_run']=10
        self.assertIn('BOUNDED_CCU_JOB_WOULD_STARVE_TARGETS',self.verdict()['blockers'])
    def test_pacing_cannot_fit_slot_blocks(self):
        self.policy['minute_limit']=0.1
        self.assertIn('GLOBAL_GUARD_PACING_NOT_VALID',self.verdict()['blockers'])
        self.policy['minute_limit']=1
        self.inv['database']['target_counts']['data']['active']=100
        self.assertIn('CCU_WORST_CASE_RUN_DOES_NOT_FIT_SLOT',self.verdict()['blockers'])
    def test_preinstall_usage_and_future_day_both_reserved(self):
        self.policy['rolling_day_limit']=500 # 2*100 + 144 + 200 = 544
        self.assertIn('INSUFFICIENT_REVIEWED_CALL_HEADROOM',self.verdict()['blockers'])
    def test_restriction_wiring_and_other_consumers_are_real_gates(self):
        self.inv['database']['attempts_24h']['data'][0]['http_status']=429
        self.policy['all_steam_jobs_share_guard_state']=False;self.policy['other_api_consumers_accounted_for']=False
        self.assertGreaterEqual(len(self.verdict()['blockers']),3)
    def test_initialization_can_precede_wiring_but_never_missing_evidence(self):
        self.policy['all_steam_jobs_share_guard_state']=False
        self.assertEqual(initial_debit(self.inv,self.policy,now=self.now),100)
        self.inv['database']['attempts_24h']={'status':'UNAVAILABLE'}
        with self.assertRaises(Blocked):initial_debit(self.inv,self.policy,now=self.now)


class AdditionalBudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.now=1800000000
        self.policy={'state_id':'synthetic','rolling_day_limit':5,'minute_limit':2,
                     'minimum_interval_seconds':1,'new_rolling_day_limit':1}
        self.path=self.root/'state.sqlite'
    def tearDown(self):self.tmp.cleanup()
    def budget(self):return Budget(self.path,self.policy,clock=lambda:self.now)
    def test_preinstall_debit_consumes_day_not_minute_and_is_labelled(self):
        Budget.initialize(self.path,state_id='synthetic',clock=lambda:self.now,initial_day_debit=4)
        b=self.budget();b.reserve('one','LEGACY:CCU');b.finish('one','SUCCESS');self.now+=61
        with self.assertRaisesRegex(Blocked,'ROLLING_DAY'):b.reserve('two','LEGACY:CCU')
        self.assertEqual(b.status()['baseline_day_debits'],4)
    def test_new_work_subcap_preserves_remaining_legacy_budget(self):
        Budget.initialize(self.path,state_id='synthetic',clock=lambda:self.now)
        b=self.budget();b.reserve('new','NEW:APP_LIST');b.finish('new','SUCCESS');self.now+=61
        with self.assertRaisesRegex(Blocked,'NEW_WORK'):b.reserve('next','NEW:STORE_ITEMS')
        b.reserve('existing','LEGACY:CCU')
    def test_unresolved_manual_close_does_not_refund(self):
        Budget.initialize(self.path,state_id='synthetic',clock=lambda:self.now)
        b=self.budget();b.reserve('one','NEW:APP_LIST');b.finish('one','NETWORK_UNKNOWN',cooldown_seconds=300)
        self.assertEqual(b.status()['reservations_total'],1);self.assertEqual(b.status()['unresolved'],[])
    def test_parent_writable_by_others_is_refused(self):
        self.root.chmod(0o777)
        with self.assertRaisesRegex(Blocked,'DIRECTORY'):Budget.initialize(self.path,state_id='synthetic')
    def test_invalid_existing_ids_never_silently_change_deduplication(self):
        with self.assertRaisesRegex(ValueError,'EXISTING_APP_IDS'):
            plan([],as_of='2026-11-17T00:00:00Z',release_days=30,maximum_games=1,interval_minutes=60,existing_app_ids=['1'])
    def test_different_base_source_is_rejected_without_writing(self):
        folder=self.root/'common';folder.mkdir();source=folder/'http.py';source.write_text('# synthetic unverified base\n')
        before=source.read_bytes()
        with self.assertRaisesRegex(ValueError,'BASE_SOURCE_HASH_MISMATCH'):patched(self.root)
        self.assertEqual(source.read_bytes(),before)
    def test_windows_powershell_utf8_bom_json_is_supported(self):
        path=self.root/'policy.json';path.write_text(json.dumps(self.policy),encoding='utf-8-sig')
        self.assertEqual(read(path),self.policy)


if __name__=='__main__':unittest.main()
