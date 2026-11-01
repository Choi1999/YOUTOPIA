#!/usr/bin/env python3
"""Package prebuilt artifacts; run check/build gates first, never on the production VM."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tarfile
import tempfile
import argparse
from release_provenance import validate
root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', nargs='?', type=Path)
parser.add_argument('--build-provenance', type=Path, default=root/'build/build-provenance.json')
args = parser.parse_args()
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
if subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip():
    raise SystemExit('Commit reviewed public changes before packaging')
if not args.build_provenance.is_file():
    raise SystemExit('Record the real build checkout with record-build-provenance.py first')
provenance = json.loads(args.build_provenance.read_text())
try:
    validate(root, provenance)
except ValueError as error:
    raise SystemExit(str(error))
jars = list((root/'build/libs').glob('*.jar'))
jars = [p for p in jars if not p.name.endswith('-plain.jar')]
if len(jars) != 1 or not (root/'frontend/dist/index.html').is_file():
    raise SystemExit('Exactly one bootJar and frontend/dist are required')
report = root/'build/reports/packaged-sessions/result-browser.json'
if not report.is_file(): report = root/'build/reports/packaged-sessions/result.json'
if not report.is_file(): raise SystemExit('Packaged JAR/browser verification report required')
verification = json.loads(report.read_text())
if (verification.get('status') != 'PASS' or not verification.get('browser_ui_verified')
        or verification.get('jar_sha256') != hashlib.sha256(jars[0].read_bytes()).hexdigest()):
    raise SystemExit('Current JAR must match passing packaged browser verification')
import xml.etree.ElementTree as ET
for suite in ['test','integrationTest']:
    results = list((root/'build/test-results'/suite).glob('TEST-*.xml'))
    if not results: raise SystemExit('Required Java test results missing')
    for result in results:
        summary = ET.parse(result).getroot()
        if any(int(summary.get(key,0)) for key in ['failures','errors','skipped']):
            raise SystemExit('Java test results must pass without skips')
output = args.output.resolve() if args.output else root/'build'/('release-'+sha+'.tar.gz')
if output.exists(): raise SystemExit('Refusing to overwrite release')
with tempfile.TemporaryDirectory() as temp:
    staging = Path(temp)/sha; staging.mkdir()
    import shutil
    shutil.copyfile(jars[0], staging/'app.jar')
    shutil.copytree(root/'frontend/dist', staging/'frontend')
    manifest = {'source_sha': sha, 'build_provenance': provenance, 'files': {str(p.relative_to(staging)): hashlib.sha256(p.read_bytes()).hexdigest()
                 for p in sorted(staging.rglob('*')) if p.is_file()}}
    (staging/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    with tarfile.open(output, 'w:gz') as archive:
        def normalized(member):
            member.uid = member.gid = 0
            member.uname = member.gname = 'root'
            member.mtime = 0
            member.mode = 0o755 if member.isdir() else 0o644
            return member
        archive.add(staging, arcname=sha, filter=normalized)
print(str(output))
print('sha256 '+hashlib.sha256(output.read_bytes()).hexdigest())
