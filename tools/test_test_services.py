import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import test_services as services

class OwnershipTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state_path = Path(self.directory.name)/'state.json'
        self.patch = patch.object(services, 'STATE', self.state_path)
        self.patch.start(); self.addCleanup(self.patch.stop)
        self.state = dict(version=1, project=services.PROJECT, token='123456abcdef', phase='ready',
            fixture_sha256=services.fixture_fingerprint(),
            postgres='youtopia-test-pg-123456abcdef', redis='youtopia-test-redis-123456abcdef',
            postgres_port=31001, redis_port=31002)
        services.save(self.state)

    def inspect(self, kind, **changes):
        internal='5432/tcp' if kind=='postgres' else '6379/tcp'
        data={'Config':{'Labels':{'io.youtopia.synthetic':self.state['token'],'io.youtopia.test-project':services.PROJECT}},
            'State':{'Running':True},'NetworkSettings':{'Ports':{internal:[{'HostIp':'127.0.0.1','HostPort':str(self.state[kind+'_port'])}]}}}
        data.update(changes);return data

    def test_production_credentials_and_docker_selectors_do_not_reach_children(self):
        with patch.dict(os.environ, {'DB_PASSWORD':'owner-secret','YOUTOPIA_DATA_DB_PASSWORD':'app-secret',
            'PGHOST':'production','DOCKER_HOST':'tcp://remote','HTTPS_PROXY':'http://approved-proxy','RUNTIME_GUARD':'preserve'}):
            child=services.child_env()
        for name in ['DB_PASSWORD','YOUTOPIA_DATA_DB_PASSWORD','PGHOST','DOCKER_HOST']:self.assertNotIn(name,child)
        self.assertEqual(child['HTTPS_PROXY'],'http://approved-proxy');self.assertEqual(child['RUNTIME_GUARD'],'preserve')

    def test_state_cannot_select_other_containers_or_ports(self):
        for change in [{'postgres':'production'},{'project':'other'},{'token':'../other'},
                       {'postgres_port':True},{'redis_port':1023},{'phase':'creating'}]:
            with self.subTest(change=change),self.assertRaises(ValueError):services.validate_shape(dict(self.state,**change))

    def test_missing_setup_fails_instead_of_using_old_fixed_endpoints(self):
        self.state_path.unlink()
        with self.assertRaisesRegex(ValueError,'start before integration'):services.load_state()

    def test_valid_loopback_bindings_are_checked_against_resource_identity(self):
        with patch.object(services,'inspect_owned',side_effect=lambda state,kind:self.inspect(kind)):
            self.assertEqual(services.load_state(),self.state)

    def test_public_interface_or_changed_port_is_rejected(self):
        for ip,port in [('0.0.0.0','31001'),('127.0.0.1','31003')]:
            info=self.inspect('postgres');info['NetworkSettings']['Ports']['5432/tcp'][0].update(HostIp=ip,HostPort=port)
            with patch.object(services,'inspect_owned',return_value=info),self.assertRaises(ValueError):services.load_state()

    def test_cleanup_checks_all_labels_before_deleting_anything(self):
        good=self.inspect('postgres');bad=self.inspect('redis');bad['Config']['Labels']['io.youtopia.synthetic']='another-task'
        def response(args,**kwargs):
            self.assertIn('inspect',args,'No deletion is authorized if either label mismatches')
            info=good if self.state['postgres']in args else bad
            return subprocess.CompletedProcess(args,0,json.dumps([info]),'')
        with patch.object(services,'run',side_effect=response),self.assertRaises(ValueError):services.stop()
        self.assertTrue(self.state_path.exists())

    def test_cleanup_removes_only_both_owned_resources_and_is_idempotent(self):
        with patch.object(services,'inspect_owned',return_value={'owned':True}),patch.object(services,'run')as run:
            services.stop();services.stop()
        self.assertEqual(run.call_count,2)
        for call,kind in zip(run.call_args_list,['postgres','redis']):
            self.assertEqual(call.args[0],services.DOCKER+['rm','--force','--volumes',self.state[kind]])
        self.assertFalse(self.state_path.exists())

    def test_existing_ready_environment_is_not_reseeded_or_replaced(self):
        with patch.object(services,'load_state',return_value=self.state),patch.object(services,'run')as run:
            self.assertEqual(services.start(),self.state);run.assert_not_called()

    def test_changed_fixture_fingerprint_cannot_reuse_stale_database(self):
        with self.assertRaisesRegex(ValueError,'fixtures changed'):
            services.validate_shape(dict(self.state,fixture_sha256='old-fixture'))

    def test_partial_setup_can_remove_only_its_proven_owned_container(self):
        services.save(dict(self.state,phase='creating'))
        with patch.object(services,'inspect_owned',side_effect=[{'owned':True},None]),patch.object(services,'run')as run:
            services.stop()
        run.assert_called_once_with(services.DOCKER+['rm','--force','--volumes',self.state['postgres']])

if __name__=='__main__':unittest.main()
