#!/usr/bin/env python3
"""Verify an independent digest and safely unpack flat public tools into a NEW directory."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile

def unpack(archive_path,expected,sha,output):
    if not re.fullmatch('[0-9a-f]{40}',sha) or not re.fullmatch('[0-9a-f]{64}',expected):raise ValueError('Invalid identity')
    if hashlib.sha256(archive_path.read_bytes()).hexdigest()!=expected:raise ValueError('Archive hash mismatch')
    prefix='operator-tools-'+sha
    with tarfile.open(archive_path,'r:gz') as archive:
        members=archive.getmembers();files={}
        if len(members)>100 or len(members)!=len(set(m.name for m in members)):raise ValueError('Duplicate or excess members')
        for member in members:
            path=Path(member.name)
            if member.isdir() and member.name==prefix:continue
            if (not member.isfile() or len(path.parts)!=2 or path.parts[0]!=prefix or path.parts[1].startswith('.')
                    or str(path)!=member.name or member.size>2*1024*1024):raise ValueError('Unsafe member')
            files[path.name]=archive.extractfile(member).read()
    manifest=json.loads(files.pop('tools-manifest.json'))
    if manifest['source_sha']!=sha or manifest['files']!={n:hashlib.sha256(v).hexdigest() for n,v in files.items()}:raise ValueError('Tool manifest mismatch')
    output.mkdir(mode=0o700)
    for name,data in files.items():
        with (output/name).open('xb') as stream:stream.write(data)
        (output/name).chmod(0o600)
    with (output/'tools-manifest.json').open('x') as stream:json.dump(manifest,stream,indent=2)
    (output/'tools-manifest.json').chmod(0o600)

if __name__=='__main__':
    if len(sys.argv)!=5:raise SystemExit('Usage: unpack-tools.py ARCHIVE INDEPENDENT_SHA256 SOURCE_SHA NEW_DIRECTORY')
    unpack(Path(sys.argv[1]),sys.argv[2],sys.argv[3],Path(sys.argv[4]))
    print('TOOLS_VERIFIED_AND_EXTRACTED; no install, account or service action')
