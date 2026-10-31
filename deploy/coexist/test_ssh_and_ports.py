import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ssh_connect_probe',ROOT/'probe-ssh-connect.py')
probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)
class FakeConnection:
    def __init__(self,response): self.response=response;self.sent=b''
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def sendall(self,data): self.sent=data
    def settimeout(self,value): pass
    def recv(self,size): data=self.response[:size];self.response=self.response[size:];return data

class TransportDiagnosis(unittest.TestCase):
    def test_http200_is_transport_not_authentication(self):
        connection=FakeConnection(b'HTTP/1.1 200 OK\r\n\r\nSSH-2.0-synthetic\r\n')
        result=probe.probe('100.64.0.1',lambda *a,**k:connection)
        self.assertEqual(result['http_status'],200)
        self.assertFalse(result['ssh_authenticated'])
        self.assertIn(b'CONNECT 100.64.0.1:22 HTTP/1.1',connection.sent)
    def test_403_and_503_do_not_infer_cause(self):
        for code in [403,503]:
            with self.subTest(code=code):
                result=probe.probe('100.64.0.1',lambda *a,**k:FakeConnection(f'HTTP/1.1 {code} error\r\n\r\n'.encode()))
                self.assertEqual(result['http_status'],code)
                self.assertEqual(result['result'],'proxy_http_failure_cause_unconfirmed')
                self.assertFalse(result['ssh_authenticated'])
    def test_local_permission_failure_is_separate_stage(self):
        def fail(*a,**k): raise PermissionError('synthetic sensitive details')
        result=probe.probe('100.64.0.1',fail)
        self.assertEqual(result['stage'],'proxy_transport')
        self.assertEqual(result['error_type'],'PermissionError')
        self.assertNotIn('sensitive',str(result))
    def test_truncated_or_invalid_response_and_timeout(self):
        for data in [b'HTTP/1.1 503',b'invalid\r\n\r\n']:
            self.assertEqual(probe.probe('100.64.0.1',lambda *a,**k:FakeConnection(data))['stage'],'proxy_response')
        def fail(*a,**k): raise TimeoutError()
        self.assertEqual(probe.probe('100.64.0.1',fail)['error_type'],'TimeoutError')
    def test_reject_unapproved_address_shape_before_transport(self):
        for host in ['127.0.0.1','not-an-address','100.64.0.1:22','100.64.0.1\n']:
            with self.assertRaises(ValueError): probe.probe(host)

class ListenerPreflight(unittest.TestCase):
    def run_check(self,listener,exit_code=0):
        with tempfile.TemporaryDirectory() as tmp:
            script=Path(tmp)/'ss'
            script.write_text('#!/bin/sh\nprintf "%s\\n" '+repr(listener)+'\nexit '+str(exit_code)+'\n')
            script.chmod(0o755)
            import os
            env=dict(os.environ,PATH=tmp+':'+os.environ['PATH'])
            return subprocess.run(['bash',str(ROOT/'check-ports.sh')],env=env,capture_output=True,text=True)
    def test_reserved_ports_stop_and_other_services_are_preserved(self):
        for address in ['0.0.0.0:80','[::]:443','127.0.0.1:8080','127.0.0.1:6379']:
            self.assertNotEqual(self.run_check('LISTEN 0 511 '+address+' 0.0.0.0:*').returncode,0)
        self.assertEqual(self.run_check('LISTEN 0 511 127.0.0.1:5432 0.0.0.0:*').returncode,0)
        self.assertEqual(self.run_check('').returncode,0)
    def test_ss_failure_does_not_look_like_empty_ports(self):
        result=self.run_check('',exit_code=1)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Cannot inspect',result.stderr)
if __name__=='__main__': unittest.main()
