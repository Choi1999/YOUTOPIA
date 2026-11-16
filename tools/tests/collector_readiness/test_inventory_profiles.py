import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from tools.collector_readiness.inventory import (
    CONFIG_FIELDS,IMAGE_CONFIG_READER,config_projection,execution_projection,
    image_config_report,literal_assignments,safe_shell_tokens,
)
from tools.collector_readiness.readiness import assess
import test_gates as gates


class ProfileReaderTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def read(self):
        program=IMAGE_CONFIG_READER.replace("Path('/app/config')",'Path('+repr(str(self.root))+')')
        result=subprocess.run([sys.executable,'-I','-B','-',json.dumps(sorted(CONFIG_FIELDS))],input=program,
                              capture_output=True,text=True,check=True,timeout=5)
        return json.loads(result.stdout)
    def test_actual_reader_program_matches_host_projection_and_omits_unknown_fields(self):
        path=self.root/'production.json'
        path.write_text(json.dumps({'app_env':'production','password':'synthetic-private-value',
          'steam':{'ccu':{'slot_minutes':60,'enabled':True},'api_key':'synthetic-token'},
          'retry':{'max_attempts':3},'youtube':{'search':{'enabled':True}}}),encoding='utf-8-sig')
        profile=self.read()['profiles'][0]
        self.assertEqual(profile['settings'],config_projection(path)['settings'])
        self.assertNotIn('synthetic-private-value',json.dumps(profile));self.assertNotIn('synthetic-token',json.dumps(profile))
        self.assertEqual(profile['source'],'PINNED_IMAGE_DEFAULT')
        self.assertNotIn('sha256',profile)
    def test_oversized_symlink_and_nonconfig_files_not_exported(self):
        (self.root/'production-large.json').write_bytes(b' '*512001)
        (self.root/'private.env').write_text('synthetic-private-value')
        (self.root/'production-link.json').symlink_to(self.root/'private.env')
        rows=self.read()['profiles']
        self.assertEqual(len(rows),2);self.assertTrue(all(x['status']=='UNAVAILABLE' for x in rows))
        self.assertNotIn('synthetic-private-value',json.dumps(rows))


class ContainerIsolationTests(unittest.TestCase):
    def run_mock(self,*,reply=None,owned=True,daemon='synthetic-host'):
        calls=[]
        def fake(argv,**kw):
            calls.append((argv,kw))
            if argv[:2]==['docker','info']:return {'status':'OK','stdout':daemon+'\n'}
            if argv[:2]==['docker','run']:
                return reply or {'status':'OK','stdout':json.dumps({'kind':'IMAGE_CONFIG_FIELDS_V1','profiles':[]})}
            if argv[:2]==['docker','inspect']:return {'status':'OK','stdout':'readonly-config' if owned else 'someone-else'}
            if argv[:2]==['docker','rm']:return {'status':'OK','stdout':''}
            raise AssertionError('UNEXPECTED_COMMAND')
        with patch('tools.collector_readiness.inventory.run',fake):
            result=image_config_report('sha256:'+'a'*64,expected_host='synthetic-host')
        return result,calls
    def test_explicit_python_only_no_network_mount_secret_or_collector(self):
        result,calls=self.run_mock()
        argv,kw=next(x for x in calls if x[0][:2]==['docker','run'])
        self.assertEqual(argv[argv.index('--entrypoint')+1],'python')
        self.assertEqual(argv[argv.index('--network')+1],'none')
        for option in ['--read-only','--cap-drop','--pull=never','--memory','--pids-limit']:self.assertIn(option,argv)
        self.assertNotIn('--env-file',argv);self.assertNotIn('-v',argv);self.assertNotIn('--mount',argv)
        self.assertEqual(kw['input_text'],IMAGE_CONFIG_READER)
        self.assertEqual(result['collector_executions'],0)
        run_name=argv[argv.index('--name')+1]
        cleanup=next(x[0] for x in calls if x[0][:2]==['docker','rm'])
        self.assertEqual(cleanup[-1],run_name)
    def test_timeout_preserved_as_unavailable_and_owned_container_cleaned(self):
        result,calls=self.run_mock(reply={'status':'UNAVAILABLE','reason':'TimeoutExpired'})
        self.assertEqual(result['status'],'UNAVAILABLE');self.assertEqual(result['reason'],'TimeoutExpired')
        self.assertTrue(any(x[0][:2]==['docker','rm'] for x in calls))
    def test_wrong_daemon_never_starts_container(self):
        result,calls=self.run_mock(daemon='other-host')
        self.assertEqual(result['status'],'UNAVAILABLE');self.assertFalse(any(x[0][:2]==['docker','run'] for x in calls))
    def test_unowned_container_never_removed(self):
        _,calls=self.run_mock(owned=False)
        self.assertFalse(any(x[0][:2]==['docker','rm'] for x in calls))
    def test_malformed_json_is_failure_without_body_disclosure(self):
        result,_=self.run_mock(reply={'status':'OK','stdout':'synthetic-private-value'})
        self.assertEqual(result['status'],'UNAVAILABLE');self.assertNotIn('synthetic-private-value',json.dumps(result))


class ShellStructureTests(unittest.TestCase):
    def test_branches_references_and_continuation_survive_without_shell_execution(self):
        text='case "$JOB" in\nhourly-normal)\nRUN_CMD="steam-ccu --config ${CONFIG}/rc5_production_current.json"\ndocker run \\\n --env-file "$ENV_FILE" \\\n --mount "type=bind,source=${DATA_DIR},target=/data"\nesac\n'
        result=safe_shell_tokens(text)
        self.assertIn('hourly-normal',json.dumps(result));self.assertIn('rc5_production_current.json',json.dumps(result))
        self.assertTrue(any(x['continuation'] for x in result['rows']));self.assertFalse(result['truncated'])
    def test_secret_literals_and_dynamic_substitution_are_omitted(self):
        with tempfile.TemporaryDirectory() as directory:
            sentinel=Path(directory)/'must-not-exist'
            text='DB_PASSWORD=synthetic-password\nAPI_KEY=synthetic-api-key\necho "Bearer synthetic-token"\nIMAGE=$(touch '+str(sentinel)+')\n'
            result=json.dumps(safe_shell_tokens(text))
            for value in ['synthetic-password','synthetic-api-key','synthetic-token']:self.assertNotIn(value,result)
            self.assertFalse(sentinel.exists())
    def test_mount_style_used_by_modern_docker_preserves_data_mapping(self):
        text='DATA_DIR=/safe/data\ndocker run --mount "type=bind,source=${DATA_DIR},target=/data,readonly" image\n'
        result=execution_projection(text,literal_assignments(text))
        self.assertEqual(result['docker_runs'][0]['binds'],[{'host':'/safe/data','container':'/data','mode':'ro'}])
        self.assertEqual(result['docker_runs'][0]['unresolved_mounts'],0)
    def test_cron_timezone_directive_is_preserved_only_for_valid_timezone(self):
        self.assertIn('Asia/Seoul',json.dumps(safe_shell_tokens('CRON_TZ=Asia/Seoul')))
        self.assertNotIn('synthetic-password',json.dumps(safe_shell_tokens('TZ=synthetic-password')))


class ImageEvidenceGateTests(unittest.TestCase):
    def setUp(self):
        fixture=gates.ReadinessTests(methodName='runTest');fixture.setUp()
        self.now,self.policy,self.inv=fixture.now,fixture.policy,fixture.inv
        profile=self.inv['configs'][0]
        profile.update(source='PINNED_IMAGE_DEFAULT',source_image_id=self.inv['image']['data']['id'])
    def verdict(self):return assess(self.inv,self.policy,now=self.now)
    def test_image_defaults_cannot_claim_to_be_effective_configuration(self):
        self.assertIn('IMAGE_PROFILE_EFFECTIVE_WIRING_NOT_REVIEWED',self.verdict()['blockers'])
    def test_image_id_must_match_even_after_explicit_wiring_review(self):
        self.policy['image_config_wiring_reviewed']=True
        self.inv['configs'][0]['source_image_id']='sha256:'+'c'*64
        self.assertIn('IMAGE_PROFILE_IDENTITY_MISMATCH',self.verdict()['blockers'])
    def test_pinned_policy_template_accepts_real_runtime_job_code(self):
        template=json.loads(Path('tools/collector_readiness/policy.example.json').read_text())
        self.policy['reviewed_success_job_types']=template['reviewed_success_job_types']
        self.policy['image_config_wiring_reviewed']=True
        self.inv['database']['recent_jobs']['data'][0]['job_type']='STEAM_CCU'
        self.assertEqual(self.verdict()['status'],'READY_FOR_OPERATOR_REVIEW')


if __name__=='__main__':unittest.main()
