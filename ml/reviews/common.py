"""Strict JSON and immutable artifact helpers; data stays outside the repository."""
import hashlib
import json
import os
from pathlib import Path


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    data = value if isinstance(value, bytes) else value.encode('utf-8')
    return hashlib.sha256(data).hexdigest()


def fingerprint(value):
    return digest(canonical(value))


def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('DUPLICATE_JSON_FIELD')
        result[key] = value
    return result


def parse(text):
    def reject(_):
        raise ValueError('NONFINITE_JSON')
    return json.loads(text, object_pairs_hook=_pairs, parse_constant=reject)


def read(path):
    return parse(Path(path).read_text(encoding='utf-8-sig'))


def rows(path):
    return [parse(line) for line in Path(path).read_text(encoding='utf-8-sig').splitlines() if line.strip()]


def write(path, value):
    Path(path).write_text(canonical(value) + '\n', encoding='utf-8')


def write_rows(path, values):
    Path(path).write_text(''.join(canonical(value) + '\n' for value in values), encoding='utf-8')


def seal(root, metadata):
    root = Path(root)
    files = {str(p.relative_to(root)): file_hash(p) for p in sorted(root.rglob('*'))
             if p.is_file() and p.name != 'READY.json'}
    write(root / 'READY.json', {'metadata': metadata, 'files': files})


def verify(root):
    root = Path(root).resolve()
    ready = read(root / 'READY.json')
    if not ready['files']:
        raise ValueError('EMPTY_ARTIFACT')
    actual = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and p.name != 'READY.json'}
    if actual != set(ready['files']):
        raise ValueError('ARTIFACT_FILE_SET_CHANGED')
    for relative, expected in ready['files'].items():
        path = root / relative
        parents = path.relative_to(root).parents
        if (not path.resolve().is_relative_to(root) or path.is_symlink()
                or any((root / parent).is_symlink() for parent in parents)
                or file_hash(path) != expected):
            raise ValueError('ARTIFACT_HASH_MISMATCH')
    return ready['metadata']


def claim(path, value):
    """Exclusive claim is deliberately retained on failure; no silent test retries."""
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as stream:
        stream.write(canonical(value) + '\n')
