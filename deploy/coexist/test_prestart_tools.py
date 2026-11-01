import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parent
def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/(name+'.py'))
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

class PrestartTools(unittest.TestCase):
    def test_admin_launcher_never_passes_inherited_credentials_or_boot_options(self):
        launcher=module('admin-operator')
        with tempfile.TemporaryDirectory() as tmp:
            jar=Path(tmp)/'synthetic.jar';jar.write_bytes(b'synthetic executable bytes')
            argv=['admin-operator.py','--jar',str(jar),'--sha256',hashlib.sha256(jar.read_bytes()).hexdigest(),'create','--reviewed']
            synthetic={'PGPASSWORD':'synthetic-parent-password','YOUTOPIA_INITIAL_ADMIN_PASSWORD':'synthetic-parent-password',
                       'JAVA_TOOL_OPTIONS':'synthetic-parent-options','LOADER_PATH':'synthetic-parent-loader',
                       'HTTPS_PROXY':'http://approved-proxy'}
            with patch('sys.argv',argv),patch.object(launcher.os,'geteuid',return_value=0),patch.object(launcher.os,'isatty',return_value=True),\
                    patch.object(Path,'lstat',return_value=SimpleNamespace(st_mode=0o100644,st_uid=0)),\
                    patch.dict(launcher.os.environ,synthetic,clear=True),patch.object(launcher.os,'execve') as execute:
                launcher.main()
            command,environment=execute.call_args.args[1:]
            self.assertFalse(any('synthetic-parent' in part for part in command))
            self.assertEqual(environment,{'HTTPS_PROXY':'http://approved-proxy'})
            self.assertEqual(command[-2:],['create','--reviewed'])

    def test_ip_render_is_offline_no_overwrite_and_acme_is_not_redirected(self):
        renderer=module('render-ip-https')
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'new';renderer.render('8.8.8.8',output)
            challenge=(output/'01-challenge-only.conf').read_text()
            self.assertIn('return 404',challenge);self.assertNotIn('proxy_pass',challenge)
            https=(output/'02-https-after-acceptance.conf').read_text()
            self.assertIn('location / { return 308 https://8.8.8.8',https)
            self.assertIn('listen 443 ssl default_server',https)
            self.assertIn('location ^~ /.well-known/acme-challenge/',https)
            with self.assertRaises(FileExistsError):renderer.render('8.8.8.8',output)
            for address in ('100.64.0.1','127.0.0.1','192.168.1.1','example.invalid','8.8.8.8;exit'):
                with self.assertRaises(ValueError):renderer.render(address,Path(tmp)/'unused')

    def test_package_plan_uses_full_candidates_and_rejects_protected_changes(self):
        plan=module('plan-host-updates')
        self.assertEqual(plan.parse_policy(' Installed: 1.24.0-2ubuntu7.13\n Candidate: 1.24.0-2ubuntu7.19\n')['candidate'],'1.24.0-2ubuntu7.19')
        self.assertEqual(plan.transaction_changes('Inst nginx [old] (new Ubuntu)\n'),['nginx'])
        for text in ('Remv nginx\n','Inst docker.io (new)\n','Inst postgresql-16 (new)\n','Inst tailscale (new)\n'):
            with self.assertRaises(ValueError):plan.transaction_changes(text)
        with self.assertRaises(ValueError):plan.parse_policy('Installed: (none)\n Candidate: 1\n')

    def test_tools_unpack_checks_manifest_links_duplicates_and_existing_output(self):
        unpack=module('unpack-tools').unpack;sha='a'*40
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);archive=root/'tools.tar.gz'
            data=b'synthetic public tool';name='public.py'
            manifest={'source_sha':sha,'files':{name:hashlib.sha256(data).hexdigest()}}
            def write(extra=None):
                with tarfile.open(archive,'w:gz') as stream:
                    for filename,value in [(name,data),('tools-manifest.json',json.dumps(manifest).encode())]:
                        entry=tarfile.TarInfo('operator-tools-'+sha+'/'+filename);entry.size=len(value);stream.addfile(entry,io.BytesIO(value))
                    if extra:stream.addfile(extra)
                return hashlib.sha256(archive.read_bytes()).hexdigest()
            digest=write();output=root/'new';unpack(archive,digest,sha,output)
            with self.assertRaises(FileExistsError):unpack(archive,digest,sha,output)
            for name,kind in [('escape',tarfile.SYMTYPE),('public.py',tarfile.REGTYPE),('../escape',tarfile.REGTYPE)]:
                entry=tarfile.TarInfo('operator-tools-'+sha+'/'+name);entry.type=kind;entry.linkname='/etc/passwd'
                with self.assertRaises(ValueError):unpack(archive,write(entry),sha,root/'bad')
            self.assertFalse((root/'bad').exists())

    def test_renewal_only_reloads_active_nginx_after_valid_changed_certificate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);binary=root/'bin';binary.mkdir()
            paths={'/etc/youtopia-acme':str(root/'base'),'/etc/letsencrypt':str(root/'certs'),
                   '/var/lib/youtopia-acme-client':str(root/'work'),'/var/log/youtopia-acme':str(root/'logs'),
                   '/var/lib/youtopia-acme':str(root/'webroot')}
            script=(ROOT/'certbot-ip.sh').read_text().replace('$EUID == 0','1 == 1')
            for old,new in paths.items():script=script.replace(old,new)
            for path in paths.values():Path(path).mkdir()
            (root/'base/public-ip').write_text('8.8.8.8\n')
            (root/'base/certbot-image.txt').write_bytes((ROOT/'certbot-image.txt').read_bytes())
            certificate=root/'certs/live/youtopia-ip/cert.pem';certificate.parent.mkdir(parents=True)
            launcher=root/'script.sh';launcher.write_text(script)
            events=root/'events'
            commands={
                'stat':'case "$*" in *%u*) echo 0;; *) echo 600;; esac',
                'uname':'echo x86_64',
                'openssl':'test "${INVALID_CERT:-0}" != 1',
                'nginx':'echo nginx-test >> "$EVENTS"; test "${BAD_NGINX:-0}" != 1',
                'systemctl':'echo "systemctl $*" >> "$EVENTS"; if [ "$1" = is-active ]; then test "${INACTIVE:-0}" != 1; fi',
                'docker':'case "$*" in *" run "*) if [ "${CHANGE:-0}" = 1 ]; then printf new > "$CERT"; fi;; esac',
            }
            for name,body in commands.items():
                path=binary/name;path.write_text('#!/bin/sh\n'+body+'\n');path.chmod(0o755)
            for options,reload_expected,success in [({},False,True),({'CHANGE':'1'},True,True),
                ({'CHANGE':'1','BAD_NGINX':'1'},False,False),({'CHANGE':'1','INVALID_CERT':'1'},False,False),
                ({'CHANGE':'1','INACTIVE':'1'},False,True)]:
                certificate.write_text('old');events.write_text('')
                env={'PATH':str(binary)+':/usr/local/bin:/usr/bin:/bin','EVENTS':str(events),'CERT':str(certificate),**options}
                result=subprocess.run(['bash',str(launcher),'renew'],env=env,capture_output=True)
                self.assertEqual(result.returncode==0,success)
                self.assertEqual('systemctl reload nginx.service' in events.read_text(),reload_expected)
                self.assertNotIn('start ',events.read_text());self.assertNotIn('unmask',events.read_text())

if __name__=='__main__':unittest.main()
