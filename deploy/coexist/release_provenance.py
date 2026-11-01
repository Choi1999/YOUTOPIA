"""Bind prebuilt public artifacts to their build inputs, independently of deploy changes."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

INPUTS = {
    'backend': ['src/main', 'build.gradle', 'settings.gradle', 'gradle.lockfile', 'gradlew', 'gradle'],
    # Conservative: tests/config/package-manager inputs also invalidate frontend reuse.
    'frontend': ['frontend'],
}

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])

def clean_head(root):
    if git(root, 'status', '--porcelain').strip():
        raise ValueError('A clean committed source checkout is required')
    return git(root, 'rev-parse', 'HEAD').decode().strip()

def input_fingerprints(root, commit):
    if not re.fullmatch('[0-9a-f]{40}', commit):
        raise ValueError('Invalid build source commit')
    result = {}
    for kind, paths in INPUTS.items():
        tree = git(root, 'ls-tree', '-r', '-z', commit, '--', *paths)
        if not tree:
            raise ValueError('Build input tree is missing')
        result[kind] = hashlib.sha256(tree).hexdigest()
    return result

def artifacts(root):
    jars = [p for p in (root/'build/libs').glob('*.jar') if not p.name.endswith('-plain.jar')]
    if len(jars) != 1 or jars[0].is_symlink() or not (root/'frontend/dist/index.html').is_file():
        raise ValueError('One bootJar and frontend/dist/index.html are required')
    files = {'app.jar': jars[0]}
    for path in sorted((root/'frontend/dist').rglob('*')):
        if path.is_symlink():
            raise ValueError('Static artifact symlinks are not permitted')
        if path.is_file():
            relative = path.relative_to(root/'frontend/dist')
            if any(part.startswith('.') or part in ('private', 'backups') for part in relative.parts) or path.suffix.lower() in ('.sql', '.pem', '.key'):
                raise ValueError('Non-public static artifact path')
            files['frontend/'+str(relative)] = path
    return files

def file_hashes(files):
    return {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in sorted(files.items())}

def record(root):
    sha = clean_head(root)
    return {
        'schema_version': 1,
        'record_kind': 'existing-artifact-attestation',
        'recorded_utc': datetime.now(timezone.utc).isoformat(),
        'build_source_sha': sha,
        'build_source_tree_sha': git(root, 'rev-parse', sha+'^{tree}').decode().strip(),
        'build_inputs_sha256': input_fingerprints(root, sha),
        'files': file_hashes(artifacts(root)),
    }

def validate(root, provenance):
    head = clean_head(root)
    if provenance.get('schema_version') != 1 or provenance.get('record_kind') != 'existing-artifact-attestation':
        raise ValueError('Unsupported build provenance')
    built = provenance.get('build_source_sha', '')
    recorded = provenance.get('build_inputs_sha256')
    if recorded != input_fingerprints(root, built) or recorded != input_fingerprints(root, head):
        raise ValueError('Build inputs changed; rebuild and attest the new artifacts')
    if provenance.get('build_source_tree_sha') != git(root, 'rev-parse', built+'^{tree}').decode().strip():
        raise ValueError('Build source tree mismatch')
    if provenance.get('files') != file_hashes(artifacts(root)):
        raise ValueError('Artifact bytes differ from the build record')
    return head

def validate_manifest_provenance(manifest, actual):
    provenance = manifest.get('build_provenance')
    if provenance is None:
        return  # Existing v1 releases remain stageable; do not rewrite them.
    if (provenance.get('schema_version') != 1 or not re.fullmatch('[0-9a-f]{40}', provenance.get('build_source_sha', ''))
            or not re.fullmatch('[0-9a-f]{40}', provenance.get('build_source_tree_sha', ''))
            or provenance.get('files') != actual):
        raise ValueError('Build provenance does not match release bytes')
    if set(provenance.get('build_inputs_sha256', {})) != set(INPUTS) or not all(
            re.fullmatch('[0-9a-f]{64}', value) for value in provenance['build_inputs_sha256'].values()):
        raise ValueError('Build input fingerprints required')
