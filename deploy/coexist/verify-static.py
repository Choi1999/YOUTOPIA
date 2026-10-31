#!/usr/bin/env python3
"""Validate deployment contracts without production credentials or mutations."""
from pathlib import Path
import re
import subprocess
import sys
root=Path(__file__).resolve().parents[2]
d=root/'deploy/coexist'
keys=set(re.findall(r'\$\{(YOUTOPIA_[A-Z_]+)',(root/'src/main/resources/application.yml').read_text()))
example=(d/'app.env.example').read_text()
provided=set(re.findall(r'^(YOUTOPIA_[A-Z_]+)=',example,re.M))
assert keys<=provided, 'Missing runtime variable names'
assert 'YOUTOPIA_PRIVACY_ENABLED=false' in example
assert 'YOUTOPIA_ACCOUNTS_DELETION_ENABLED=false' in example
assert '127.0.0.1:6379:6379' in (d/'compose.yaml').read_text()
assert 'maxmemory 512mb' in (d/'redis.conf').read_text()
assert 'maxmemory-policy noeviction' in (d/'redis.conf').read_text()
assert '/srv/youtopia-data/postgres' not in (d/'compose.yaml').read_text()
for p in d.glob('*.sh'): subprocess.run(['bash','-n',str(p)],check=True)
# Catch accidental credentials in public examples, without printing their values.
for line in example.splitlines():
    if '=' in line:
        name,value=line.split('=',1)
        if re.search('(?:_PASSWORD|_HMAC_KEY)$',name): assert not value, 'Secret placeholder must be empty'
subprocess.run([sys.executable,'-m','unittest','discover','-s',str(d),'-p','test_*.py'],check=True)
print('PASS: variable coverage, policy gates, loopback, memory headroom, no DB mount, shell syntax, empty secret placeholders')
