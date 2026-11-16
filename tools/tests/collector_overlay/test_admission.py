"""Full pinned schema/RAW contract tests. Dedicated internal Docker PG only.

The SQL is loaded from the pinned image into an ephemeral fixture, never shipped
as an operational migration and never run on an existing service database.
"""
from datetime import datetime,timedelta,timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
import uuid
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import psycopg

from collector_readiness.admission import admit
from collector_readiness.discovery import Staging,metadata_row
from collector_readiness.limits import Budget,Blocked
from collector_readiness.planner import plan
from collector_readiness.rollback import rollback
from youtopia_collector import __version__
from youtopia_collector.common.config import load_settings
from youtopia_collector.jobs.context import JobContext
from youtopia_collector.jobs import steam_ccu

HOST='ytp-collector-prep-test-pg'
DATABASE='ytp_collector_full_fixture'


class AdmissionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.environ.get('YOUTOPIA_ISOLATED_TEST_PG')!=HOST:
            raise RuntimeError('EXPLICIT_ISOLATED_DATABASE_REQUIRED')
        with psycopg.connect(host=HOST,dbname='postgres',user='postgres',autocommit=True) as c:
            c.execute('DROP DATABASE IF EXISTS '+DATABASE)
            c.execute('CREATE DATABASE '+DATABASE)
        with psycopg.connect(host=HOST,dbname=DATABASE,user='postgres',autocommit=True) as c:
            base=Path('/app/database/design/v0.3.0/sql')
            for name in ['001_collector_schema.sql','002_raw_schema.sql','003_views.sql']:
                c.execute((base/name).read_text())
            for name in ['006_to_007_prepatch.sql','006_to_007_production.sql']:
                text=(Path('/app/database/migrations')/name).read_text().replace('{{collector}}','collector').replace('{{raw}}','raw')
                uncommented='\n'.join(x for x in text.splitlines() if not x.lstrip().startswith('--'))
                for statement in uncommented.split(';'):
                    if statement.strip() and statement.strip().upper() not in ['BEGIN','COMMIT']:
                        c.execute(statement)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        with psycopg.connect(host=HOST,dbname=DATABASE,user='postgres') as c:
            tables=c.execute("SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema IN ('collector','raw') AND table_type='BASE TABLE' AND table_name<>'schema_version'").fetchall()
            c.execute('TRUNCATE '+','.join(f'"{s}"."{t}"' for s,t in tables)+' RESTART IDENTITY CASCADE')
        self.env=patch.dict(os.environ,{'APP_ENV':'production','DB_HOST':HOST,'DB_PORT':'5432',
            'DB_NAME':DATABASE,'DB_USER':'postgres','DB_PASSWORD':uuid.uuid4().hex,
            'DB_COLLECTOR_SCHEMA':'collector','DB_RAW_SCHEMA':'raw',
            'YOUTOPIA_STEAM_GUARD_ENABLED':'1','YOUTOPIA_NEW_RELEASES_ENABLED':'1',
            'YOUTOPIA_STEAM_GUARD_POLICY':str(self.root/'policy.json')})
        self.env.start()
        # Read the image's non-secret config without printing it. All paths and
        # the entire DB connection environment are replaced by fixture settings.
        config=json.loads(Path('/app/config/rc5_production_current.json').read_text())
        config['paths'].update(artifact_dir=str(self.root/'artifacts'),log_dir=str(self.root/'logs'),runtime_dir=str(self.root/'runtime'),minimum_free_space_mb=1)
        (self.root/'config.json').write_text(json.dumps(config));(self.root/'overrides.json').write_text('{}')
        self.policy={'state_id':'isolated-fixture-state','state_path':str(self.root/'budget.sqlite'),
          'rolling_day_limit':10000,'minute_limit':60,'minimum_interval_seconds':0.01,'new_rolling_day_limit':100,
          'maximum_games':2,'interval_minutes':60,'initial_observation_days':14,'expected_database':DATABASE}
        (self.root/'policy.json').write_text(json.dumps(self.policy))
        Budget.initialize(self.policy['state_path'],state_id=self.policy['state_id'])
        Staging.initialize(self.root/'stage.sqlite');self.stage=Staging(self.root/'stage.sqlite')
        self.now=datetime.now(timezone.utc)
        self.reference='a'*32
        body=json.dumps({'response':{'store_items':[{'appid':501,'name':'Synthetic New Game','type':'game',
          'release':{'steam_release_date':int((self.now-timedelta(days=1)).timestamp())},
          'tags':[{'tagid':19,'name':'Action'}]}]}}).encode()
        row=metadata_row(body,501,self.reference,observed_at=self.now.timestamp(),mapping={'action':'Action'})
        self.stage.save_metadata(self.reference,501,body,row,now=self.now.timestamp())
        document=plan([row],as_of=datetime.now(timezone.utc).isoformat(),release_days=30,maximum_games=2,interval_minutes=60)
        (self.root/'plan.json').write_text(json.dumps(document))
        self.args=SimpleNamespace(plan=str(self.root/'plan.json'),staging=str(self.root/'stage.sqlite'),
          project_root=str(self.root),config=str(self.root/'config.json'),overrides=str(self.root/'overrides.json'),execute=False)
        settings=load_settings(project_root=self.root,config_path=Path(self.args.config),overrides_path=Path(self.args.overrides),collector_version=__version__,command='steam-ccu')
        self.context=JobContext.build(settings,command='steam-ccu')

    def tearDown(self):
        self.context.close();self.env.stop();self.tmp.cleanup()

    def count(self,table):
        with self.context.database.transaction() as c:return c.execute('SELECT count(*) FROM '+table).fetchone()[0]

    def execute(self):
        self.args.execute=True
        return admit(self.args,self.policy)

    def test_read_only_review_no_provider_no_raw_writes(self):
        result=admit(self.args,self.policy)
        self.assertEqual(result['status'],'ADMISSION_REVIEW_ONLY')
        self.assertEqual(self.count('raw.artifact'),0);self.assertEqual(self.count('collector.steam_ccu_target'),0)
        self.assertEqual(Budget(self.policy['state_path'],self.policy).status()['reservations_total'],0)

    def test_real_metadata_contract_admission_and_retry_preserve_expiry(self):
        result=self.execute();self.assertEqual(result['applied_app_ids'],[501])
        self.assertEqual(self.count('raw.steam_metadata_result'),1);self.assertEqual(self.count('raw.steam_player_observation'),0)
        self.assertEqual(self.count('collector.youtube_game_target'),0);self.assertEqual(self.count('collector.game_youtube_query'),0)
        with self.context.database.transaction() as c:
            self.assertEqual(c.execute('SELECT active,selection_reason FROM collector.steam_ccu_target').fetchone(),(True,'SIGNAL_NEW_RELEASE'))
            expires=c.execute('SELECT expires_at FROM collector.steam_tracking_signal').fetchone()[0]
        self.assertEqual(self.execute()['skipped_previously_registered_app_ids'],[501])
        with self.context.database.transaction() as c:self.assertEqual(c.execute('SELECT expires_at FROM collector.steam_tracking_signal').fetchone()[0],expires)
        self.assertEqual(self.count('raw.steam_metadata_result'),1)

    def test_failure_after_metadata_import_can_resume_without_extending_decision(self):
        from youtopia_collector.db.repository import CollectorRepository
        original=CollectorRepository._reconcile_targets
        calls=[]
        def interrupted(repository,*args,**kwargs):
            calls.append(1)
            if len(calls)==2:raise RuntimeError('synthetic-interruption')
            return original(repository,*args,**kwargs)
        with patch.object(CollectorRepository,'_reconcile_targets',new=interrupted):
            with self.assertRaises(RuntimeError):self.execute()
        self.assertEqual(self.count('raw.steam_metadata_result'),1);self.assertEqual(self.count('collector.steam_ccu_target'),0)
        with self.stage.connect() as c:expires=c.execute('SELECT expires_at FROM admission').fetchone()[0]
        self.assertEqual(self.execute()['applied_app_ids'],[501])
        with self.stage.connect() as c:self.assertEqual(c.execute('SELECT expires_at FROM admission').fetchone()[0],expires)
        self.assertEqual(self.count('raw.steam_metadata_result'),1)

    def test_corrupt_metadata_and_lost_budget_block_before_database_writes(self):
        with self.stage.connect() as c:c.execute("UPDATE metadata_run SET sha256='invalid'")
        with self.assertRaisesRegex(Blocked,'ARTIFACT'):self.execute()
        self.assertEqual(self.count('raw.artifact'),0)
        Path(self.policy['state_path']).unlink()
        with self.assertRaisesRegex(Blocked,'UNAVAILABLE'):self.execute()
        self.assertEqual(self.count('raw.artifact'),0)

    def test_rollback_cancels_only_new_pending_work_and_keeps_raw(self):
        self.execute()
        self.context.repository.ensure_ccu_tasks(scheduled_at=self.now,now=datetime.now(timezone.utc))
        self.args.execute=False;preview=rollback(self.args);self.assertEqual(preview['stopped_ccu_app_ids'],[501])
        with self.context.database.transaction() as c:self.assertEqual(c.execute('SELECT active FROM collector.steam_ccu_target').fetchone(),(True,))
        self.args.execute=True;result=rollback(self.args)
        self.assertEqual(len(result['cancelled_pending_task_ids']),1)
        with self.context.database.transaction() as c:
            self.assertEqual(c.execute('SELECT active FROM collector.steam_ccu_target').fetchone(),(False,))
            self.assertEqual(c.execute('SELECT status FROM collector.collection_task').fetchone(),('CANCELLED',))
        self.assertEqual(self.count('collector.collection_outcome'),1);self.assertEqual(self.count('raw.steam_metadata_result'),1)
        self.assertEqual(Budget(self.policy['state_path'],self.policy).status()['reservations_total'],0)

    def test_rollback_preserves_game_that_later_enters_legacy_top(self):
        self.execute()
        with self.context.database.transaction() as c:
            self.context.repository._upsert_tracking_signal(c,app_id=501,signal_source='CONCURRENT_PLAYERS',scope_key='GLOBAL',
                observed_at=datetime.now(timezone.utc),current_rank=1,source_reference='b'*32)
            self.context.repository._reconcile_targets(c,now=datetime.now(timezone.utc),app_ids=[501])
        result=rollback(self.args);self.assertEqual(result['preserved_ccu_app_ids'],[501])
        with self.context.database.transaction() as c:
            self.assertEqual(c.execute('SELECT active FROM collector.steam_ccu_target').fetchone(),(True,))
            self.assertEqual(c.execute('SELECT active FROM collector.youtube_game_target').fetchone(),(True,))

    def test_rollback_waits_for_claimed_work_and_transaction_keeps_signal(self):
        self.execute();now=datetime.now(timezone.utc)
        self.context.repository.ensure_ccu_tasks(scheduled_at=now,now=now)
        job=self.context.repository.start_job(job_type='steam-ccu',trigger_type='TEST',collector_version=__version__,app_env='production',started_at=now)
        self.context.repository.claim_ccu_tasks(job=job,now=now,limit=1,scheduled_at=now)
        with self.assertRaisesRegex(Blocked,'CLAIMED_OR_RUNNING'):rollback(self.args)
        with self.context.database.transaction() as c:self.assertIsNone(c.execute('SELECT deactivated_at FROM collector.steam_tracking_signal').fetchone()[0])

    def test_real_ccu_pipeline_mocked_http_keeps_observation_format_and_run_context(self):
        from requests import Response
        self.execute();now=datetime.now(timezone.utc)
        job=self.context.repository.start_job(job_type='steam-ccu',trigger_type='TEST',collector_version=__version__,app_env='production',started_at=now)
        response=Response();response.status_code=200;response._content=b'{"response":{"player_count":42,"result":1}}'
        with patch.object(self.context.transport._session,'get',return_value=response) as send:
            summary=steam_ccu.run(self.context,job)
        self.assertEqual(summary.succeeded,1);self.assertEqual(send.call_count,1)
        self.assertFalse(send.call_args.kwargs['headers']) # public CCU, no key
        with self.context.database.transaction() as c:
            self.assertEqual(c.execute('SELECT app_id,player_count FROM raw.steam_player_observation').fetchone(),(501,42))
            run_reference=str(c.execute("SELECT run_reference FROM raw.artifact WHERE contract_type='steam-ccu/v2'").fetchone()[0]).strip()
        sidecar=list((self.root/'artifacts'/'steam'/'ccu').rglob('metadata.json'))
        self.assertEqual(len(sidecar),1)
        metadata=json.loads(sidecar[0].read_text())
        self.assertEqual(metadata['run_reference'],run_reference)
        self.assertEqual(metadata['tracking_context']['signals'][0]['source'],'NEW_RELEASE')
        self.assertEqual(self.count('collector.youtube_game_target'),0)

    def test_global_cohort_cap_includes_already_active_and_cooldown_targets(self):
        self.execute();self.policy['maximum_games']=1
        (self.root/'policy.json').write_text(json.dumps(self.policy))
        received=datetime.now(timezone.utc).timestamp();reference='c'*32
        body=json.dumps({'response':{'store_items':[{'appid':502,'name':'Synthetic Second Game','type':'game',
            'release':{'steam_release_date':int(received)-86400},'tags':[{'tagid':19,'name':'Action'}]}]}}).encode()
        row=metadata_row(body,502,reference,observed_at=received,mapping={'action':'Action'})
        self.stage.save_metadata(reference,502,body,row,now=received)
        document=plan([row],as_of=datetime.now(timezone.utc).isoformat(),release_days=30,maximum_games=1,interval_minutes=60)
        Path(self.args.plan).write_text(json.dumps(document))
        with self.assertRaisesRegex(Blocked,'CAP_REACHED'):self.execute()

    def test_inventory_read_only_queries_match_pinned_schema(self):
        from collector_readiness.inventory import database_report
        def fake(argv,**kwargs):
            values=[]
            with self.context.database.transaction() as c:
                cur=c.execute(kwargs['input_text'])
                while True:
                    if cur.description:values.append(cur.fetchone()[0])
                    if not cur.nextset():break
            return {'status':'OK','stdout':json.dumps(values[0])}
        with patch('collector_readiness.inventory.run',fake):
            result=database_report('isolated-fixture',DATABASE,'postgres')
        self.assertTrue(all(x['status']=='OK' for x in result.values()))
        self.assertEqual(result['identity']['data']['read_only'],'on')

    def test_disabled_features_preserve_legacy_ccu_pipeline_without_new_sidecar_fields(self):
        from requests import Response
        self.execute();now=datetime.now(timezone.utc)
        job=self.context.repository.start_job(job_type='steam-ccu',trigger_type='TEST',collector_version=__version__,app_env='production',started_at=now)
        response=Response();response.status_code=200;response._content=b'{"response":{"player_count":42,"result":1}}'
        with patch.dict(os.environ,{'YOUTOPIA_STEAM_GUARD_ENABLED':'0','YOUTOPIA_NEW_RELEASES_ENABLED':'0'}):
            with patch.object(self.context.transport._session,'get',return_value=response) as send:
                summary=steam_ccu.run(self.context,job)
        self.assertEqual(summary.succeeded,1);self.assertEqual(send.call_count,1)
        self.assertNotIn('allow_redirects',send.call_args.kwargs)
        metadata=json.loads(next((self.root/'artifacts'/'steam'/'ccu').rglob('metadata.json')).read_text())
        self.assertNotIn('tracking_context',metadata)
        self.assertEqual(Budget(self.policy['state_path'],self.policy).status()['reservations_total'],0)

    def test_stopped_new_game_is_not_automatically_readmitted(self):
        self.execute();rollback(self.args)
        result=self.execute();self.assertEqual(result['skipped_previously_registered_app_ids'],[501])
        with self.context.database.transaction() as c:self.assertEqual(c.execute('SELECT active FROM collector.steam_ccu_target').fetchone(),(False,))

    def test_global_guard_pause_does_not_fail_or_retire_games_or_drain_pending_work(self):
        self.execute();now=datetime.now(timezone.utc)
        budget=Budget(self.policy['state_path'],self.policy);budget.reserve('synthetic-unresolved','LEGACY:synthetic')
        job=self.context.repository.start_job(job_type='steam-ccu',trigger_type='TEST',collector_version=__version__,app_env='production',started_at=now)
        with patch.object(self.context.transport._session,'get') as send:summary=steam_ccu.run(self.context,job)
        self.assertEqual(send.call_count,0);self.assertEqual(summary.failed,1)
        with self.context.database.transaction() as c:
            self.assertEqual(c.execute('SELECT active,failure_count FROM collector.steam_ccu_target').fetchone(),(True,0))
            self.assertEqual(c.execute('SELECT status FROM collector.collection_task').fetchone(),('PENDING',))
            self.assertEqual(c.execute('SELECT source_type,stage FROM collector.collection_failure').fetchone(),('LOCAL','GLOBAL_STEAM_GUARD'))
        self.assertEqual(self.count('raw.steam_player_observation'),0)

    def test_real_ccu_429_makes_one_send_and_preserves_retryable_task_and_game_state(self):
        from requests import Response
        self.execute();now=datetime.now(timezone.utc)
        response=Response();response.status_code=429;response._content=b'{}';response.headers['Retry-After']='0'
        job=self.context.repository.start_job(job_type='steam-ccu',trigger_type='TEST',collector_version=__version__,app_env='production',started_at=now)
        with patch.object(self.context.steam,'_sleep',return_value=None):
            with patch.object(self.context.transport._session,'get',return_value=response) as send:
                summary=steam_ccu.run(self.context,job)
        self.assertEqual(send.call_count,1);self.assertEqual(summary.failed,1)
        with self.context.database.transaction() as c:
            self.assertEqual(c.execute('SELECT active,failure_count FROM collector.steam_ccu_target').fetchone(),(True,0))
            self.assertEqual(c.execute('SELECT status FROM collector.collection_task').fetchone(),('PENDING',))
            self.assertEqual(c.execute('SELECT http_status FROM collector.api_call_attempt').fetchone(),(429,))
        self.assertEqual(Budget(self.policy['state_path'],self.policy).status()['reservations_total'],1)


if __name__=='__main__':unittest.main()
