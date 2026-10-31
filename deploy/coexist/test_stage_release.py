import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('stage_release',Path(__file__).with_name('stage-release.py'))
staging=importlib.util.module_from_spec(spec);spec.loader.exec_module(staging)
SHA='a'*40
class ReleaseSafety(unittest.TestCase):
    def archive(self, base, extra=None, tamper=False):
        path=base/'release.tar.gz'
        files={'app.jar':b'synthetic jar','frontend/index.html':b'synthetic html'}
        manifest={'source_sha':SHA,'files':{k:hashlib.sha256(v).hexdigest() for k,v in files.items()}}
        if tamper: files['app.jar']=b'changed'
        files['manifest.json']=json.dumps(manifest).encode()
        with tarfile.open(path,'w:gz') as archive:
            for name, data in files.items():
                member=tarfile.TarInfo(SHA+'/'+name);member.size=len(data)
                archive.addfile(member,io.BytesIO(data))
            if extra: archive.addfile(extra)
        return path,hashlib.sha256(path.read_bytes()).hexdigest()
    def invoke(self, path,digest,base):
        with patch.object(staging.os,'chown'):
            staging.stage(path,digest,SHA,base)
    def test_valid_release_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);path,digest=self.archive(base)
            self.invoke(path,digest,base)
            self.assertEqual((base/SHA/'app.jar').read_bytes(),b'synthetic jar')
            with self.assertRaises(SystemExit): self.invoke(path,digest,base)
    def test_archive_hash_and_manifest_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);path,digest=self.archive(base,tamper=True)
            with self.assertRaises(SystemExit): self.invoke(path,'0'*64,base)
            with self.assertRaises(SystemExit): self.invoke(path,digest,base)
            self.assertFalse((base/SHA).exists())
    def test_links_and_traversal_rejected_without_publishing(self):
        for name,kind in [(SHA+'/escape',tarfile.SYMTYPE),(SHA+'/escape',tarfile.LNKTYPE),(SHA+'/../escape',tarfile.REGTYPE),('/escape',tarfile.REGTYPE)]:
            with self.subTest(name=name,kind=kind), tempfile.TemporaryDirectory() as tmp:
                base=Path(tmp);extra=tarfile.TarInfo(name);extra.type=kind;extra.linkname='/etc/passwd'
                path,digest=self.archive(base,extra)
                with self.assertRaises(SystemExit): self.invoke(path,digest,base)
                self.assertFalse((base/SHA).exists())
if __name__=='__main__': unittest.main()
