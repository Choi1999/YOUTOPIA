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
    def test_unmanifested_nested_manifest_and_duplicate_members_rejected(self):
        for name in (SHA+'/frontend/manifest.json',SHA+'/app.jar'):
            with self.subTest(name=name),tempfile.TemporaryDirectory() as tmp:
                base=Path(tmp);path,_=self.archive(base)
                with tarfile.open(path,'r:gz') as original: members=[(m,original.extractfile(m).read()) for m in original.getmembers()]
                with tarfile.open(path,'w:gz') as archive:
                    for member,data in members:archive.addfile(member,io.BytesIO(data))
                    extra=tarfile.TarInfo(name);extra.size=1;archive.addfile(extra,io.BytesIO(b'x'))
                digest=hashlib.sha256(path.read_bytes()).hexdigest()
                with self.assertRaises(SystemExit):self.invoke(path,digest,base)
                self.assertFalse((base/SHA).exists())
    def test_release_directory_itself_is_owned_by_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp);path,digest=self.archive(base)
            with patch.object(staging.os,'chown') as chown:staging.stage(path,digest,SHA,base)
            self.assertTrue(any(call.args[0].name==SHA and call.args[1:]==(0,0) for call in chown.call_args_list))
if __name__=='__main__': unittest.main()
