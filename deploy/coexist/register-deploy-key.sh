#!/usr/bin/env bash
# Future approved SERVER root action. Accept ONLY a single validated public key.
set -euo pipefail
[[ "${1:-}" == --approved && $# == 2 && $EUID == 0 ]] || { echo 'Usage (root): register-deploy-key.sh --approved PUBLIC_KEY_FILE' >&2; exit 2; }
[[ $(hostname -s) == youtopia-main ]] || { echo 'Wrong host' >&2; exit 1; }
for command in python3 ssh-keygen getent stat install; do command -v "$command" >/dev/null; done
getent passwd youtopia-deploy >/dev/null || { echo 'Prepare dedicated SSH account first' >&2; exit 1; }
ssh_dir=/home/youtopia-deploy/.ssh
[[ -d "$ssh_dir" && ! -L "$ssh_dir" && $(stat -c '%U:%G:%a' "$ssh_dir") == youtopia-deploy:youtopia-deploy:700 ]] || { echo 'Unexpected SSH directory owner/mode' >&2; exit 1; }
[[ ! -e "$ssh_dir/authorized_keys" && ! -L "$ssh_dir/authorized_keys" ]] || { echo 'authorized_keys exists; do not overwrite' >&2; exit 1; }
[[ -f "$2" && ! -L "$2" ]] || { echo 'Public key file required' >&2; exit 1; }
umask 077
staging=$(mktemp /root/youtopia-public-key.XXXXXXXX)
trap 'rm -f -- "$staging"' EXIT
python3 - "$2" > "$staging" <<'PY'
import base64, pathlib, struct, sys
raw=pathlib.Path(sys.argv[1]).read_bytes()
if len(raw)>4096: raise SystemExit('Public key input too large')
parts=raw.strip().split()
if not (2<=len(parts) and parts[0]==b'ssh-ed25519') or raw.strip().count(b'\n') or b'\r' in raw.strip():
    raise SystemExit('Exactly one ed25519 public key required; private keys are never accepted')
try:
    blob=base64.b64decode(parts[1],validate=True)
    expected=struct.pack('>I',11)+b'ssh-ed25519'+struct.pack('>I',32)
    if len(blob)!=len(expected)+32 or not blob.startswith(expected): raise ValueError()
except ValueError: raise SystemExit('Invalid ed25519 public key')
# Omit the free-form comment from authorized_keys.
print('restrict ssh-ed25519 '+parts[1].decode('ascii'))
PY
ssh-keygen -lf "$staging" >/dev/null
# O_EXCL/NOFOLLOW prevents root from following or overwriting a concurrently
# created authorized_keys path in this user's directory.
python3 - "$staging" "$ssh_dir" <<'PYKEY'
import os, pathlib, pwd, sys
account=pwd.getpwnam('youtopia-deploy')
directory=os.open(sys.argv[2],os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
try:
    fd=os.open('authorized_keys',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=directory)
    with os.fdopen(fd,'wb') as output:
        output.write(pathlib.Path(sys.argv[1]).read_bytes())
        output.flush()
        os.fchown(output.fileno(),account.pw_uid,account.pw_gid)
finally:
    os.close(directory)
PYKEY
echo 'Validated public key registered only; SSH policy/hostkey/login still need verification'
