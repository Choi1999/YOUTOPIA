#!/usr/bin/env bash
# REVIEWED SERVER ROOT ACTION ONLY. Not executed by Codex preparation.
# Stops on collisions; never changes DB/collector paths, Docker storage or firewall.
set -euo pipefail
[[ "${1:-}" == --approved && $# == 1 && $EUID == 0 ]] || { echo 'Root + --approved required' >&2; exit 2; }
[[ $(hostname -s) == youtopia-main ]] || { echo 'Wrong host' >&2; exit 1; }
command -v java docker nginx >/dev/null
java -version 2>&1 | head -1 | grep -Eq '"21[.]' || { echo 'Install reviewed Java 21 separately first' >&2; exit 1; }
for account in youtopia-app youtopia-deploy; do
  ! getent passwd "$account" >/dev/null || { echo "Account collision: $account" >&2; exit 1; }
  ! getent group "$account" >/dev/null || { echo "Group collision: $account" >&2; exit 1; }
done
for path in /opt/youtopia-app /etc/youtopia-app /srv/youtopia-data/redis /etc/systemd/system/youtopia-app.service /etc/systemd/journald@youtopia.conf; do
  [[ ! -e "$path" && ! -L "$path" ]] || { echo "Path collision: $path" >&2; exit 1; }
done
[[ -d /srv/youtopia-data/postgres && ! -L /srv/youtopia-data ]] || exit 1
if ss -H -ltn | awk '{print $4}' | grep -Eq ':(6379|8080|80|443)$'; then
  echo 'Port collision; inspect owner before continuing' >&2; exit 1
fi
useradd --system --user-group --no-create-home --shell /usr/sbin/nologin youtopia-app
useradd --create-home --user-group --shell /bin/bash youtopia-deploy
passwd -l youtopia-deploy >/dev/null
install -d -m 0755 -o root -g root /opt/youtopia-app /opt/youtopia-app/releases
install -d -m 0700 -o youtopia-deploy -g youtopia-deploy /home/youtopia-deploy/.ssh /home/youtopia-deploy/incoming
install -d -m 0750 -o root -g youtopia-app /etc/youtopia-app
# Image redis UID/GID verified in isolated test; only NEW Redis directory is owned by 999.
install -d -m 0700 -o 999 -g 999 /srv/youtopia-data/redis
install -m 0644 youtopia-app.service /etc/systemd/system/youtopia-app.service
install -m 0644 journald-youtopia.conf /etc/systemd/journald@youtopia.conf
install -m 0444 redis.conf /etc/youtopia-app/redis.conf
# Redis container UID needs traversal through only its config directory. Keep secrets separate:
# bind file mounts are resolved by root Docker daemon, not by the container through this path.
echo 'Prepared only. Register key/config files separately; do not enable/start services until acceptance.'
