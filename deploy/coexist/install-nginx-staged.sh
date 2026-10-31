#!/usr/bin/env bash
# Future approved SERVER root action. Install exact reviewed package versions,
# leaving the NEW nginx service masked and never listening on port 80/443.
set -euo pipefail
[[ "${1:-}" == --approved && $# == 2 && $EUID == 0 ]] || { echo 'Usage (root): install-nginx-staged.sh --approved REVIEWED_PACKAGE_VERSION' >&2; exit 2; }
[[ $(hostname -s) == youtopia-main ]] || { echo 'Wrong host' >&2; exit 1; }
version=$2
[[ "$version" =~ ^[0-9][a-zA-Z0-9.+:~_-]*$ ]] || { echo 'Invalid package version' >&2; exit 1; }
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
for command in dpkg-query apt-get install stat ln readlink ss; do command -v "$command" >/dev/null; done
for package in nginx nginx-common; do
  status=$(dpkg-query -W -f='${db:Status-Status}' "$package" 2>/dev/null || true)
  [[ -z "$status" || "$status" == not-installed ]] || { echo 'Existing nginx package/state; separate upgrade review required' >&2; exit 1; }
done
for path in /usr/sbin/policy-rc.d /etc/systemd/system/nginx.service /etc/nginx; do
  [[ ! -e "$path" && ! -L "$path" ]] || { echo "Existing path: $path; preserve and review manually" >&2; exit 1; }
done
bash "$script_dir/check-ports.sh"
# Existing policy-rc.d is never replaced. --approved means these exact versions
# and their dependency transaction were already reviewed before running this tool.
apt-get --simulate --no-install-recommends install "nginx=$version" "nginx-common=$version"
echo 'Applying the previously reviewed exact-version transaction with service starts blocked.'
# Keep mask across reboot and also block maintainer-script starts/restarts during apt.
# No systemctl start/stop/restart or firewall operation is used here.
ln -s /dev/null /etc/systemd/system/nginx.service
umask 077
policy=$(mktemp /usr/sbin/youtopia-policy.XXXXXXXX)
cleanup() {
  if [[ -e /usr/sbin/policy-rc.d ]] && [[ /usr/sbin/policy-rc.d -ef "$policy" ]]; then
    rm -f /usr/sbin/policy-rc.d
  elif [[ -e /usr/sbin/policy-rc.d || -L /usr/sbin/policy-rc.d ]]; then
    echo 'policy-rc.d changed concurrently; preserve it and inspect manually' >&2
  fi
  rm -f -- "$policy"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf '#!/bin/sh\nexit 101\n' > "$policy"
chmod 0755 "$policy"
ln "$policy" /usr/sbin/policy-rc.d
apt-get --assume-yes --no-install-recommends install "nginx=$version" "nginx-common=$version"
[[ $(readlink /etc/systemd/system/nginx.service) == /dev/null ]] || { echo 'nginx mask changed; stop' >&2; exit 1; }
bash "$script_dir/check-ports.sh"
echo 'nginx installed, persistent mask retained, no listeners on reserved ports; do not unmask/start until separate approval'
