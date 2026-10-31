#!/usr/bin/env bash
# REVIEWED SERVER ROOT ACTION ONLY. Not executed by Codex preparation.
# Stops on collisions; never changes DB/collector paths, Docker storage or firewall.
set -euo pipefail
[[ "${1:-}" == --approved && $# == 1 && $EUID == 0 ]] || { echo 'Root + --approved required' >&2; exit 2; }
[[ $(hostname -s) == youtopia-main ]] || { echo 'Wrong host' >&2; exit 1; }
# Layout preparation precedes runtime/package installation (especially nginx).
# The separately prepared youtopia-deploy account is deliberately left untouched.
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
for command in getent useradd install ss awk grep; do command -v "$command" >/dev/null; done
for source in youtopia-app.service journald-youtopia.conf redis.conf; do
  [[ -f "$script_dir/$source" ]] || { echo "Missing reviewed source: $source" >&2; exit 1; }
done
for account in youtopia-app; do
  ! getent passwd "$account" >/dev/null || { echo "Account collision: $account" >&2; exit 1; }
  ! getent group "$account" >/dev/null || { echo "Group collision: $account" >&2; exit 1; }
done
for path in /opt/youtopia-app /etc/youtopia-app /srv/youtopia-data/redis /etc/systemd/system/youtopia-app.service /etc/systemd/journald@youtopia.conf; do
  [[ ! -e "$path" && ! -L "$path" ]] || { echo "Path collision: $path" >&2; exit 1; }
done
[[ -d /srv/youtopia-data/postgres && ! -L /srv/youtopia-data ]] || exit 1
bash "$script_dir/check-ports.sh"
useradd --system --user-group --no-create-home --shell /usr/sbin/nologin youtopia-app
install -d -m 0755 -o root -g root /opt/youtopia-app /opt/youtopia-app/releases
install -d -m 0750 -o root -g youtopia-app /etc/youtopia-app
# Image redis UID/GID verified in isolated test; only NEW Redis directory is owned by 999.
install -d -m 0700 -o 999 -g 999 /srv/youtopia-data/redis
install -m 0644 "$script_dir/youtopia-app.service" /etc/systemd/system/youtopia-app.service
install -m 0644 "$script_dir/journald-youtopia.conf" /etc/systemd/journald@youtopia.conf
install -m 0444 "$script_dir/redis.conf" /etc/youtopia-app/redis.conf
# Redis container UID needs traversal through only its config directory. Keep secrets separate:
# bind file mounts are resolved by root Docker daemon, not by the container through this path.
echo 'Prepared only. Register key/config files separately; do not enable/start services until acceptance.'
