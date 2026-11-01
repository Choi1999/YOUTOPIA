import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from release_provenance import record, validate, validate_manifest_provenance

class BuildIdentity(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        for name, data in {'.gitignore':'build/\nfrontend/dist/\n', 'src/main/App.java':'synthetic source',
                'build.gradle':'synthetic build', 'frontend/src/main.ts':'synthetic frontend',
                'deploy/coexist/compose.yaml':'synthetic old image'}.items():
            self.write(name, data)
        self.commit()
        self.write('build/libs/app.jar', 'synthetic prebuilt jar')
        self.write('frontend/dist/index.html', 'synthetic prebuilt frontend')
        self.provenance = record(self.root)

    def git(self, *args):
        return subprocess.check_output(['git','-C',str(self.root),*args],stderr=subprocess.DEVNULL).decode().strip()

    def write(self, name, text):
        path=self.root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)

    def commit(self):
        self.git('add','.')
        self.git('-c','user.name=Synthetic Builder','-c','user.email=builder@example.invalid','commit','-qm','synthetic checkpoint')

    def test_deployment_commit_keeps_original_artifact_build_identity(self):
        self.write('deploy/coexist/compose.yaml','synthetic fixed image')
        self.commit()
        source=validate(self.root,self.provenance)
        self.assertNotEqual(source,self.provenance['build_source_sha'])
        self.assertEqual(self.provenance['files']['app.jar'],record(self.root)['files']['app.jar'])

    def test_backend_frontend_or_dependency_changes_invalidate_reuse(self):
        for path in ('src/main/App.java','frontend/src/main.ts','build.gradle'):
            with self.subTest(path=path):
                original=(self.root/path).read_text()
                self.write(path,'changed build input');self.commit()
                with self.assertRaisesRegex(ValueError,'Build inputs changed'):validate(self.root,self.provenance)
                self.write(path,original);self.commit()

    def test_changed_artifact_or_dirty_checkout_cannot_be_attested(self):
        self.write('build/libs/app.jar','changed artifact')
        with self.assertRaisesRegex(ValueError,'Artifact bytes'):validate(self.root,self.provenance)
        self.write('deploy/coexist/compose.yaml','uncommitted change')
        with self.assertRaisesRegex(ValueError,'clean committed'):record(self.root)

    def test_private_static_paths_and_symlinks_are_rejected(self):
        self.write('frontend/dist/.env','synthetic secret')
        with self.assertRaises(ValueError):record(self.root)
        (self.root/'frontend/dist/.env').unlink()
        (self.root/'frontend/dist/linked').symlink_to('/etc/passwd')
        with self.assertRaises(ValueError):record(self.root)

    def test_manifest_cannot_mislabel_artifact_bytes(self):
        actual=self.provenance['files']
        validate_manifest_provenance({'build_provenance':self.provenance},actual)
        wrong=dict(actual,**{'app.jar':'0'*64})
        with self.assertRaises(ValueError):validate_manifest_provenance({'build_provenance':self.provenance},wrong)

if __name__=='__main__':unittest.main()
