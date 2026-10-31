#!/usr/bin/env python3
"""Root operator: stage a verified archive only. No symlink switch/service/DB changes."""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tarfile
import tempfile
def stage(archive_path, expected, sha, base):
    if not re.fullmatch('[0-9a-f]{64}', expected) or not re.fullmatch('[0-9a-f]{40}', sha):
        raise SystemExit('Invalid digest or source SHA')
    archive_path = Path(archive_path)
    if hashlib.sha256(archive_path.read_bytes()).hexdigest() != expected: raise SystemExit('Archive hash mismatch')
    if not base.is_dir() or base.is_symlink(): raise SystemExit('Approved release directory required')
    if (base/sha).exists(): raise SystemExit('Release already exists; never overwrite')
    with tempfile.TemporaryDirectory(dir=base, prefix='.stage-') as temp:
        with tarfile.open(archive_path, 'r:gz') as archive:
            for member in archive.getmembers():
                p = Path(member.name)
                if not p.parts or p.is_absolute() or '..' in p.parts or p.parts[0] != sha or not (member.isfile() or member.isdir()):
                    raise SystemExit('Unsafe archive member')
            archive.extractall(temp, filter='data')
        release = Path(temp)/sha
        manifest = json.loads((release/'manifest.json').read_text())
        actual = {str(p.relative_to(release)): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in release.rglob('*') if p.is_file() and p.name != 'manifest.json'}
        if manifest['source_sha'] != sha or manifest['files'] != actual or 'app.jar' not in actual or 'frontend/index.html' not in actual:
            raise SystemExit('Release manifest mismatch')
        for p in release.rglob('*'):
            p.chmod(0o755 if p.is_dir() else 0o644); os.chown(p, 0, 0)
        release.chmod(0o755); release.rename(base/sha)

if __name__ == '__main__':
    if len(sys.argv) != 4: raise SystemExit('Usage: stage-release.py ARCHIVE SHA256 SOURCE_SHA')
    if os.geteuid() != 0: raise SystemExit('Server root operator required after review')
    stage(*sys.argv[1:], Path('/opt/youtopia-app/releases'))
    print('STAGED_ONLY '+sys.argv[3])
