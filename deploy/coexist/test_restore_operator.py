import base64
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('restore_operator',ROOT/'restore-operator.py')
operator=importlib.util.module_from_spec(spec);spec.loader.exec_module(operator)

class RestoreOperatorBoundary(unittest.TestCase):
    def setUp(self):
        self.config=json.loads((ROOT/'restore-input.example.json').read_text())
        self.config.update(YOUTOPIA_RESTORE_DB_USER='synthetic_existing_restore_owner',
            YOUTOPIA_RESTORE_DB_PASSWORD='synthetic-service-password',
            YOUTOPIA_CONTROL_MANAGER_DB_PASSWORD='synthetic-manager-password',
            YOUTOPIA_CONTROL_HMAC_KEY=base64.b64encode(b'S'*32).decode())
    def test_only_the_explicit_service_only_targets_and_manager_role_are_accepted(self):
        operator.validate(self.config)
        for key,value in [('YOUTOPIA_CONTROL_RESTORE_SCOPE','WHOLE_INSTANCE'),
                ('YOUTOPIA_RESTORE_EXPECTED_DB','staging'),('YOUTOPIA_CONTROL_MANAGER_EXPECTED_DB','youtopia'),
                ('YOUTOPIA_CONTROL_MANAGER_DB_USER','ytp_control_app'),('YOUTOPIA_RESTORE_DB_USER','ytp_app_member'),
                ('YOUTOPIA_CONTROL_CONNECTION_POLICY','UNREVIEWED')]:
            with self.subTest(key=key),self.assertRaises(ValueError):operator.validate(dict(self.config,**{key:value}))
    def test_existing_input_is_refused_before_prompting_for_secrets(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'existing.json';path.write_text('existing approved input')
            with patch('sys.argv',['restore-operator.py','--input',str(path),'prepare-input']),\
                    patch.object(operator.os,'geteuid',return_value=0),patch.object(operator.os,'isatty',return_value=True),\
                    patch.object(operator.getpass,'getpass') as prompt:
                with self.assertRaises(ValueError):operator.main()
            prompt.assert_not_called();self.assertEqual(path.read_text(),'existing approved input')
    def test_secrets_only_reach_the_child_environment_and_verify_needs_attestation(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'input.json';path.write_text(json.dumps(self.config));path.chmod(0o600)
            jar=Path(tmp)/'app.jar';jar.write_text('synthetic jar bytes')
            args=['restore-operator.py','--input',str(path),'--jar',str(jar),'--sha256','a'*64,
                '--service-database-only','--reviewed','--run-id','11111111-1111-4111-8111-111111111111','verify']
            stat_original=os.fstat
            def root_stat(fd):
                info=stat_original(fd);return SimpleNamespace(st_mode=info.st_mode,st_uid=0)
            with patch('sys.argv',args),patch.object(operator.os,'geteuid',return_value=0),\
                    patch.object(operator.os,'isatty',return_value=True),patch.object(operator.os,'fstat',side_effect=root_stat),\
                    patch.object(operator,'jar_is_trusted',return_value=jar),patch.object(operator.os,'execve') as execute,\
                    patch.dict(operator.os.environ,{'PGPASSWORD':'synthetic-parent-password','LOADER_PATH':'synthetic-injection'},clear=True):
                with self.assertRaises(ValueError):operator.main()
                execute.assert_not_called()
                args.append('--credential-state-reviewed');operator.main()
                command,environment=execute.call_args.args[1:]
            self.assertFalse(any(self.config[k] in str(command) for k in self.config if k.endswith(('_PASSWORD','_HMAC_KEY'))))
            self.assertNotIn('PGPASSWORD',environment);self.assertNotIn('LOADER_PATH',environment)
            self.assertEqual(environment,self.config)
            self.assertEqual(command[-1],'--credential-state-reviewed')

if __name__=='__main__':unittest.main()
