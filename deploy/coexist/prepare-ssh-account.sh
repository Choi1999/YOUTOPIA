#!/usr/bin/env bash
# Future approved SERVER root action. Independent of Java/Docker/nginx/app paths.
set -euo pipefail
[[ "${1:-}" == --approved && $# == 1 && $EUID == 0 ]] || { echo 'Root + --approved required' >&2; exit 2; }
[[ $(hostname -s) == youtopia-main ]] || { echo 'Wrong host' >&2; exit 1; }
for command in getent useradd passwd install; do command -v "$command" >/dev/null; done
if getent passwd youtopia-deploy >/dev/null || getent group youtopia-deploy >/dev/null \
    || [[ -e /home/youtopia-deploy || -L /home/youtopia-deploy ]]; then
  echo 'SSH account/group/home collision; inspect rather than overwrite' >&2; exit 1
fi
useradd --create-home --user-group --shell /bin/bash youtopia-deploy
passwd -l youtopia-deploy >/dev/null
chmod 0750 /home/youtopia-deploy
install -d -m 0700 -o youtopia-deploy -g youtopia-deploy /home/youtopia-deploy/.ssh /home/youtopia-deploy/incoming
echo 'SSH account only prepared; no sudo/docker membership, no key registered, no service changes'
