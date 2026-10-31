#!/usr/bin/env python3
"""Package prebuilt artifacts; run check/build gates first, never on the production VM."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tarfile
import tempfile
root = Path(__file__).resolve().parents[2]
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
if subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip():
    raise SystemExit('Commit reviewed public changes before packaging')
jars = list((root/'build/libs').glob('*.jar'))
jars = [p for p in jars if not p.name.endswith('-plain.jar')]
if len(jars) != 1 or not (root/'frontend/dist/index.html').is_file():
    raise SystemExit('Exactly one bootJar and frontend/dist are required')
report = root/'build/reports/packaged-sessions/result.json'
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
output = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else root/'build'/('release-'+sha+'.tar.gz')
if output.exists(): raise SystemExit('Refusing to overwrite release')
with tempfile.TemporaryDirectory() as temp:
    staging = Path(temp)/sha; staging.mkdir()
    import shutil
    shutil.copyfile(jars[0], staging/'app.jar')
    shutil.copytree(root/'frontend/dist', staging/'frontend')
    manifest = {'source_sha': sha, 'files': {str(p.relative_to(staging)): hashlib.sha256(p.read_bytes()).hexdigest()
                 for p in sorted(staging.rglob('*')) if p.is_file()}}
    (staging/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    with tarfile.open(output, 'w:gz') as archive: archive.add(staging, arcname=sha)
print(str(output))
print('sha256 '+hashlib.sha256(output.read_bytes()).hexdigest())
