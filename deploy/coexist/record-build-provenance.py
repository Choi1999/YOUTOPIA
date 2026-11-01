#!/usr/bin/env python3
"""Attest an existing clean build checkout; does not claim to run a build or tests."""
import argparse
import json
import os
from pathlib import Path
from release_provenance import record

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    data = record(args.root.resolve())
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as file:
        file.write(json.dumps(data, indent=2)+'\n')
    print('BUILD_ARTIFACTS_ATTESTED '+data['build_source_sha'])

if __name__ == '__main__':
    main()
