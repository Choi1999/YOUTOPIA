#!/usr/bin/env python3
"""Build a public resume-only delivery after verification. Never uploads or deploys."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from release_provenance import clean_head, validate

ROOT=Path(__file__).resolve().parents[2]
DEPLOY=Path(__file__).resolve().parent
TOOLS=(
    'compose.yaml','redis.conf','make-redis-acl.py','app.env.example','app-input.example.json',
    'prepare-runtime-config.py','validate-acceptance.py','acceptance.example.json','ingress-acceptance.example.json',
    'inspect-host.sh','stage-release.py','release_provenance.py','activate-release.sh',
    'youtopia-app.service','journald-youtopia.conf','nginx.conf.template','nginx-resources.conf','youtopia-logrotate',
    'RESUME.md','SECURITY.md','MANUAL-TRANSFER.md','CONTROL.md',
)

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',type=Path,required=True)
    parser.add_argument('--build-provenance',type=Path,default=ROOT/'build/build-provenance.json')
    args=parser.parse_args()
    sha=clean_head(ROOT)
    provenance=json.loads(args.build_provenance.read_text())
    validate(ROOT,provenance)
    output=args.output_dir.resolve()
    output.mkdir(mode=0o700)  # Never replace an earlier delivery.
    artifacts=output/'artifacts';artifacts.mkdir(mode=0o700)
    release=artifacts/('release-'+sha+'.tar.gz')
    subprocess.run([sys.executable,str(DEPLOY/'package-release.py'),str(release),
                    '--build-provenance',str(args.build_provenance.resolve())],check=True,cwd=ROOT)
    tools=artifacts/('operator-tools-'+sha+'.tar.gz')
    with tempfile.TemporaryDirectory() as temp:
        staging=Path(temp)/('operator-tools-'+sha);staging.mkdir()
        for name in TOOLS:
            path=DEPLOY/name
            if path.is_symlink() or not path.is_file():raise ValueError('Reviewed tool source is missing')
            shutil.copyfile(path,staging/name)
        manifest={'source_sha':sha,'mode':'resume-existing-host',
                  'files':{name:digest(staging/name) for name in TOOLS}}
        (staging/'tools-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        with tarfile.open(tools,'w:gz') as archive:
            def normalized(member):
                member.uid=member.gid=0;member.uname=member.gname='root';member.mtime=0
                member.mode=0o755 if member.isdir() or member.name.endswith('.sh') else 0o644
                return member
            archive.add(staging,arcname=staging.name,filter=normalized)
    metadata={'schema_version':1,'source_sha':sha,'artifact_build_source_sha':provenance['build_source_sha'],
              'artifact_build_inputs_sha256':provenance['build_inputs_sha256'],
              'jar_sha256':provenance['files']['app.jar'],'operating_changes_performed':False,
              'artifacts':{release.name:digest(release),tools.name:digest(tools)}}
    (output/'delivery.json').write_text(json.dumps(metadata,indent=2)+'\n')
    shutil.copyfile(DEPLOY/'upload-release.ps1',output/'upload-release.ps1')
    for name in ('RESUME.md','SECURITY.md','MANUAL-TRANSFER.md'):
        shutil.copyfile(DEPLOY/name,output/name)
    (output/'README.txt').write_text(
        'Public YOUTOPIA delivery; existing-host resume only. No operating action is authorized by packaging.\n'
        +'Source commit: '+sha+'\nArtifact build commit: '+provenance['build_source_sha']+'\n'
        +'See delivery.json, MANUAL-TRANSFER.md, RESUME.md and SECURITY.md.\n'
        +'Reused binary hashes do not mean deployment code or security review came from the older commit.\n'
        +'Do not repeat completed account/layout/Java/nginx installation.\n')
    files=sorted(p for p in output.rglob('*') if p.is_file())
    (output/'SHA256SUMS.txt').write_text(''.join(digest(p)+'  '+str(p.relative_to(output))+'\n' for p in files))
    archive_path=output/('YOUTOPIA-delivery-'+sha+'.zip')
    with zipfile.ZipFile(archive_path,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for path in files+[output/'SHA256SUMS.txt']:archive.write(path,str(path.relative_to(output)))
    archive_path.with_suffix('.zip.sha256').write_text(digest(archive_path)+'  '+archive_path.name+'\n')
    print(json.dumps({'delivery_zip':str(archive_path),'sha256':digest(archive_path),**metadata},indent=2))

if __name__=='__main__':main()
