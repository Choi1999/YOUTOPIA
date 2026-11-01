#!/usr/bin/env bash
# Future approved root operator/timer only. Never called by package/test tools.
set -euo pipefail
umask 077
[[ $EUID == 0 && $# == 1 ]] || exit 2
mode=$1
case "$mode" in staging|issue|renew|check) ;; *) exit 2;; esac
base=/etc/youtopia-acme
for path in "$base" "$base/public-ip" "$base/certbot-image.txt"; do
  [[ -e "$path" && ! -L "$path" && $(stat -c %u "$path") == 0 ]] || exit 1
  [[ $(stat -c %a "$path") == 700 || $(stat -c %a "$path") == 600 ]] || exit 1
done
read -r address < "$base/public-ip"
python3 - "$address" <<'PY'
import ipaddress,sys
ip=ipaddress.ip_address(sys.argv[1]);assert ip.version==4 and ip.is_global
PY
certificate=/etc/letsencrypt/live/youtopia-ip/cert.pem
if [[ "$mode" == check ]]; then
  openssl x509 -in "$certificate" -noout -checkip "$address"
  openssl x509 -in "$certificate" -noout -checkend 172800
  exit
fi
read -r image < "$base/certbot-image.txt"
[[ "$image" =~ ^certbot/certbot:v5\.9\.0@sha256:[0-9a-f]{64}$ ]] || exit 1
[[ $(uname -m) == x86_64 ]] || { echo 'Review and verify the selected platform before use' >&2; exit 1; }
docker --host=unix:///var/run/docker.sock image inspect "$image" >/dev/null
config=/etc/letsencrypt
work=/var/lib/youtopia-acme-client
logs=/var/log/youtopia-acme
if [[ "$mode" == staging ]]; then
  config=$base/staging/config;work=$base/staging/work;logs=$base/staging/logs
fi
for path in "$config" "$work" "$logs" /var/lib/youtopia-acme; do
  [[ -d "$path" && ! -L "$path" && $(stat -c %u "$path") == 0 ]] || exit 1
done
options=(run --rm --pull=never --read-only --cap-drop ALL --security-opt no-new-privileges:true
  --memory 512m --memory-swap 512m --cpus 0.5 --pids-limit 128 --tmpfs /tmp:rw,noexec,nosuid,size=32m
  --mount "type=bind,src=$config,dst=/etc/letsencrypt"
  --mount "type=bind,src=$work,dst=/var/lib/letsencrypt"
  --mount "type=bind,src=$logs,dst=/var/log/letsencrypt"
  --mount type=bind,src=/var/lib/youtopia-acme,dst=/webroot)
before=$(sha256sum "$certificate" 2>/dev/null | cut -d' ' -f1 || true)
if [[ "$mode" == renew ]]; then
  docker --host=unix:///var/run/docker.sock "${options[@]}" "$image" renew --cert-name youtopia-ip --non-interactive
else
  # An existing lineage is never replaced by this initial-issue path.
  [[ ! -e "$config/renewal/youtopia-ip.conf" && ! -e "$config/live/youtopia-ip" ]] || exit 1
  read -r -p 'Approved ACME contact email: ' contact
  [[ "$contact" == *@* && "$contact" != -* ]] || exit 2
  args=(certonly --non-interactive --agree-tos --email "$contact" --cert-name youtopia-ip
    --webroot --webroot-path /webroot --required-profile shortlived --ip-address "$address")
  [[ "$mode" != staging ]] || args+=(--staging)
  docker --host=unix:///var/run/docker.sock "${options[@]}" "$image" "${args[@]}"
fi
if [[ "$mode" != staging ]]; then
  openssl x509 -in "$certificate" -noout -checkip "$address"
  openssl x509 -in "$certificate" -noout -checkend 86400
  after=$(sha256sum "$certificate" | cut -d' ' -f1)
  if [[ "$mode" == renew && "$before" != "$after" ]]; then
    if systemctl is-active --quiet nginx.service; then
      nginx -t
      systemctl reload nginx.service
    else
      echo 'CERTIFICATE_RENEWED; nginx inactive, no start/unmask performed'
    fi
  fi
  # A failed timely renewal must fail the oneshot unit before expiry.
  [[ "$mode" != renew ]] || openssl x509 -in "$certificate" -noout -checkend 172800
fi
