#!/usr/bin/env python3
"""Validate a manually reviewed receipt's shape. Does not invent or verify evidence."""
import json
import os
from pathlib import Path
import stat
import sys
import re

try:
    if len(sys.argv) != 5 or sys.argv[2] not in ('prestart','public-ingress'):
        raise ValueError()
    path, phase, sha, release_hash = sys.argv[1:]
    if not re.fullmatch('[0-9a-f]{40}',sha) or not re.fullmatch('[0-9a-f]{64}',release_hash):
        raise ValueError()
    template = 'acceptance.example.json' if phase == 'prestart' else 'ingress-acceptance.example.json'
    expected = json.loads((Path(__file__).parent/template).read_text())
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as file:
        info = os.fstat(file.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o600:
            raise ValueError()
        receipt = json.load(file)
    if set(receipt) != set(expected) or receipt['phase'] != phase or receipt['source_sha'] != sha or receipt['release_sha256'] != release_hash:
        raise ValueError()
    if not all(isinstance(value,str) and value.strip() and not value.startswith('__') for value in receipt.values()):
        raise ValueError()
    print('RECEIPT_SHAPE_VALID; operator remains responsible for reviewing the referenced evidence')
except Exception:
    raise SystemExit('ACCEPTANCE_RECEIPT_INCOMPLETE_OR_MISMATCHED; no approval file or service change performed') from None
