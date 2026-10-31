#!/usr/bin/env python3
"""Read a strong Redis password from stdin; write only its SHA-256 ACL verifier."""
import hashlib
import sys
password = sys.stdin.buffer.read().rstrip(b'\r\n')
if len(password) < 32 or b'\n' in password or b'\r' in password:
    raise SystemExit('A single password of at least 32 bytes is required')
print('user default off')
# Session indexed repository + application Lua request budgets. No CONFIG/ACL/FLUSH/KEYS.
print('user youtopia on #' + hashlib.sha256(password).hexdigest() +
      ' ~youtopia:* &__keyevent@0__:expired &__keyevent@0__:del &youtopia:sessions:event:0:created:* +@read +@write +@connection +@transaction'
      ' +eval +evalsha +script|load +script|exists +publish +subscribe +psubscribe'
      ' +unsubscribe +punsubscribe +select -keys -flushall -flushdb -config -acl'
      ' -shutdown -replicaof -slaveof -migrate -restore -debug -module')
