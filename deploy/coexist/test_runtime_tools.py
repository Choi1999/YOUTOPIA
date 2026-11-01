import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

TOOLS=Path(__file__).resolve().parent
SHA='a'*40

class OperatorBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.config=json.loads((TOOLS/'app-input.example.json').read_text())
        for key in self.config:
            if key.endswith('_DB_PASSWORD') and 'PRIVACY' not in key:self.config[key]='synthetic-operational-test-password'
        self.config.update(YOUTOPIA_ACCOUNTS_ENABLED='true',YOUTOPIA_CONTROL_ENABLED='true',
            YOUTOPIA_SESSION_REDIS_PASSWORD='synthetic-redis-password-at-least-32bytes',
            YOUTOPIA_ACCOUNT_HMAC_KEY=base64.b64encode(b'A'*32).decode(),
            YOUTOPIA_CONTROL_HMAC_KEY=base64.b64encode(b'B'*32).decode(),
            YOUTOPIA_CONTROL_RESTORE_SCOPE='SERVICE_DATABASE_ONLY',YOUTOPIA_CONTROL_CONNECTION_POLICY='HOST_LOOPBACK',
            YOUTOPIA_CONTROL_JDBC_URL='jdbc:postgresql://127.0.0.1:5432/youtopia_control?sslmode=disable')
        self.input=self.root/'input.json';self.output=self.root/'output.env'
    def tearDown(self):self.temp.cleanup()
    def render(self):
        self.input.write_text(json.dumps(self.config));self.input.chmod(0o600)
        return subprocess.run(['python3',str(TOOLS/'prepare-runtime-config.py'),str(self.input),str(self.output)],capture_output=True,text=True)
    def test_sensitive_metacharacters_remain_literal(self):
        self.config['YOUTOPIA_MEMBER_DB_PASSWORD']='synthetic $() `command` # 한글 "quote" \\end'
        result=self.render();self.assertEqual(result.returncode,0)
        self.assertNotIn(self.config['YOUTOPIA_MEMBER_DB_PASSWORD'],result.stdout+result.stderr)
        self.assertEqual(self.output.stat().st_mode&0o777,0o600)
        self.assertIn('$() `command` # 한글',self.output.read_text())
    def test_member_launch_cannot_disable_control(self):
        self.config['YOUTOPIA_CONTROL_ENABLED']='false'
        result=self.render();self.assertNotEqual(result.returncode,0);self.assertFalse(self.output.exists())
    def test_owner_credentials_cannot_be_added(self):
        self.config['YOUTOPIA_CONTROL_MANAGER_DB_PASSWORD']='synthetic-manager-secret'
        result=self.render();self.assertNotEqual(result.returncode,0)
        self.assertNotIn('synthetic-manager-secret',result.stdout+result.stderr)
    def test_transport_requires_explicit_policy_and_cannot_fall_back_from_verify_full(self):
        self.config['YOUTOPIA_CONTROL_CONNECTION_POLICY']='VERIFY_FULL'
        self.assertNotEqual(self.render().returncode,0)
        self.config['YOUTOPIA_CONTROL_JDBC_URL']='jdbc:postgresql://127.0.0.1:5432/youtopia_control?sslmode=verify-full&sslrootcert=/etc/youtopia-app/control-ca.crt'
        self.assertEqual(self.render().returncode,0)
    def test_scope_cannot_claim_whole_instance_protection(self):
        self.config['YOUTOPIA_CONTROL_RESTORE_SCOPE']='WHOLE_INSTANCE'
        self.assertNotEqual(self.render().returncode,0)
    def test_existing_secret_output_is_not_overwritten(self):
        self.output.write_text('existing-protected-file')
        self.assertNotEqual(self.render().returncode,0)
        self.assertEqual(self.output.read_text(),'existing-protected-file')
    def test_same_keys_are_rejected(self):
        self.config['YOUTOPIA_CONTROL_HMAC_KEY']=self.config['YOUTOPIA_ACCOUNT_HMAC_KEY']
        self.assertNotEqual(self.render().returncode,0)
    def test_other_hosts_databases_and_extra_url_options_are_rejected(self):
        original=self.config['YOUTOPIA_CONTROL_JDBC_URL']
        for value in (original.replace('127.0.0.1','127.0.0.2'),original.replace('127.0.0.1','control.example.invalid'),
                      original.replace('/youtopia_control','/youtopia'),original.replace('/youtopia_control','/staging'),original+'&password='):
            self.config['YOUTOPIA_CONTROL_JDBC_URL']=value
            self.assertNotEqual(self.render().returncode,0)
    def test_duplicate_variables_are_not_silently_overwritten(self):
        text=json.dumps(self.config)
        self.input.write_text('{"YOUTOPIA_CONTROL_ENABLED":"false",'+text[1:]);self.input.chmod(0o600)
        result=subprocess.run(['python3',str(TOOLS/'prepare-runtime-config.py'),str(self.input),str(self.output)],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(self.output.exists())
    def test_missing_receipt_evidence_is_not_approval(self):
        receipt=json.loads((TOOLS/'acceptance.example.json').read_text())
        path=self.root/'receipt.json';path.write_text(json.dumps(receipt));path.chmod(0o600)
        result=subprocess.run(['python3',str(TOOLS/'validate-acceptance.py'),str(path),'prestart',SHA,'f'*64],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertFalse((self.root/'RELEASE_APPROVED').exists())
    def test_receipt_commit_and_hash_must_match(self):
        receipt={k:('synthetic-review-reference' if v is None else v) for k,v in json.loads((TOOLS/'acceptance.example.json').read_text()).items()}
        receipt['source_sha']=SHA
        receipt['release_sha256']='f'*64
        path=self.root/'receipt.json';path.write_text(json.dumps(receipt));path.chmod(0o600)
        args=['python3',str(TOOLS/'validate-acceptance.py'),str(path),'prestart',SHA]
        self.assertEqual(subprocess.run(args+['f'*64],capture_output=True).returncode,0)
        self.assertNotEqual(subprocess.run(args+['e'*64],capture_output=True).returncode,0)

if __name__=='__main__':unittest.main()
