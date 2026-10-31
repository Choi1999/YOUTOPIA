#!/usr/bin/env bash
set -euo pipefail
# This file only inspects the approved server. It never installs, restarts or modifies it.
: "${YOUTOPIA_SSH_KEY_FILE:?Register a private key file in Codex secret settings}"
: "${YOUTOPIA_SSH_KNOWN_HOSTS_FILE:?Register independently verified known_hosts file}"
: "${YOUTOPIA_SSH_HOST:?Register the approved server Tailscale IPv4}"
: "${YOUTOPIA_SOCAT:?Absolute maintained socat executable path required}"
[[ "$YOUTOPIA_SSH_HOST" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
[[ -f "$YOUTOPIA_SSH_KEY_FILE" && -f "$YOUTOPIA_SSH_KNOWN_HOSTS_FILE" ]]
[[ "$YOUTOPIA_SOCAT" =~ ^/[a-zA-Z0-9_./-]+$ && -x "$YOUTOPIA_SOCAT" ]]
exec ssh -F /dev/null -T -o BatchMode=yes -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$YOUTOPIA_SSH_KNOWN_HOSTS_FILE" \
  -o ConnectTimeout=10 -o ConnectionAttempts=1 \
  -o "ProxyCommand=$YOUTOPIA_SOCAT - PROXY:proxy:$YOUTOPIA_SSH_HOST:22,proxyport=8088,resolve=0" \
  -i "$YOUTOPIA_SSH_KEY_FILE" "youtopia-deploy@$YOUTOPIA_SSH_HOST" \
  'id; hostname; uname -r; free -h; df -h / /srv/youtopia-data; ss -ltn; stat -c "%U %G %a %n" /srv/youtopia-data/postgres; systemctl is-active docker; test -r /etc/cron.d/youtopia-collector && sha256sum /etc/cron.d/youtopia-collector'
