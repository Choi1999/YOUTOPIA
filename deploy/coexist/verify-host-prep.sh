#!/usr/bin/env bash
# ISOLATED UBUNTU CONTAINER TEST ONLY. Never run this on the production VM.
set -euo pipefail
[[ ${YOUTOPIA_DISPOSABLE_HOST_REVIEW:-} == 1 && $EUID == 0 && -f /.dockerenv && ! -S /var/run/docker.sock ]] || { echo 'Disposable container required' >&2; exit 2; }
[[ $(hostname -s) == youtopia-main && ! -e /srv/youtopia-data && ! -e /etc/cron.d/youtopia-collector ]] || { echo 'Fresh empty synthetic host required' >&2; exit 2; }
. /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 && -f /run/review-public-ca.pem ]] || exit 2
review=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
expect_failure() { if "$@" >/tmp/review-expected-failure.log 2>&1; then echo 'Expected refusal did not occur' >&2; exit 1; fi; }
# All policy/package/account/key operations below are confined to this disposable rootfs.
# Use only the managed runtime's inherited proxy and mounted public CA bundle.
apt_options=(-o Acquire::https::CaInfo=/run/review-public-ca.pem -o Dpkg::Use-Pty=0)
[[ -z ${HTTP_PROXY:-} ]] || apt_options+=(-o "Acquire::http::Proxy=$HTTP_PROXY")
[[ -z ${HTTPS_PROXY:-} ]] || apt_options+=(-o "Acquire::https::Proxy=$HTTPS_PROXY")
export DEBIAN_FRONTEND=noninteractive
apt-get "${apt_options[@]}" update >/tmp/review-apt-update.log 2>&1
# Bootstrap test dependencies without starting any image service.
printf '#!/bin/sh\nexit 101\n' > /usr/sbin/policy-rc.d
chmod 0755 /usr/sbin/policy-rc.d
apt-get "${apt_options[@]}" --assume-yes --no-install-recommends install iproute2 openssh-server openssh-client python3 ca-certificates >/tmp/review-dependencies.log 2>&1
mkdir -p /etc/apt/apt.conf.d
# apt's child installer retains proxy/CA trust; values are session-only, not image/source artifacts.
printf 'Acquire::https::CaInfo "/run/review-public-ca.pem";\n' > /etc/apt/apt.conf.d/99-review-ca
[[ -z ${HTTP_PROXY:-} ]] || printf 'Acquire::http::Proxy "%s";\n' "$HTTP_PROXY" >> /etc/apt/apt.conf.d/99-review-ca
[[ -z ${HTTPS_PROXY:-} ]] || printf 'Acquire::https::Proxy "%s";\n' "$HTTPS_PROXY" >> /etc/apt/apt.conf.d/99-review-ca
mkdir -p /srv/youtopia-data/postgres /etc/cron.d
chmod 0700 /srv/youtopia-data/postgres
printf 'synthetic-db-marker\n' > /srv/youtopia-data/postgres/review-marker
printf '# synthetic collector schedule placeholder; never executed\n' > /etc/cron.d/youtopia-collector
before=$(sha256sum /srv/youtopia-data/postgres/review-marker /etc/cron.d/youtopia-collector; stat -c '%u:%g:%a' /srv/youtopia-data/postgres)
bash "$review/prepare-ssh-account.sh" --approved
expect_failure bash "$review/prepare-ssh-account.sh" --approved
[[ $(id -Gn youtopia-deploy) == youtopia-deploy ]]
ssh-keygen -q -t ed25519 -N '' -f /tmp/review-deploy-key
# Private key input must fail before authorized_keys can be created.
expect_failure bash "$review/register-deploy-key.sh" --approved /tmp/review-deploy-key
[[ ! -e /home/youtopia-deploy/.ssh/authorized_keys ]]
bash "$review/register-deploy-key.sh" --approved /tmp/review-deploy-key.pub
expect_failure bash "$review/register-deploy-key.sh" --approved /tmp/review-deploy-key.pub
[[ $(stat -c '%U:%G:%a' /home/youtopia-deploy/.ssh/authorized_keys) == youtopia-deploy:youtopia-deploy:600 ]]
key_before=$(sha256sum /home/youtopia-deploy/.ssh/authorized_keys)
# Actual SSH public-key authentication on container loopback, with independently known test host key.
ssh-keygen -q -t ed25519 -N '' -f /tmp/review-host-key
awk '{print "[127.0.0.1]:22222 " $1 " " $2}' /tmp/review-host-key.pub > /tmp/review-known-hosts
mkdir -p /run/sshd
cat > /tmp/review-sshd.conf <<'SSHCONFIG'
HostKey /tmp/review-host-key
ListenAddress 127.0.0.1
Port 22222
PidFile /tmp/review-sshd.pid
UsePAM yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PermitRootLogin no
AllowUsers youtopia-deploy
SSHCONFIG
/usr/sbin/sshd -f /tmp/review-sshd.conf -E /tmp/review-sshd.log
ssh_result=$(ssh -F /dev/null -T -p 22222 -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/tmp/review-known-hosts -i /tmp/review-deploy-key youtopia-deploy@127.0.0.1 'test "$(hostname -s)" = youtopia-main && id -un')
[[ $ssh_result == youtopia-deploy ]]
# Layout preparation must work with the SSH account already present and NO runtimes installed.
! command -v java >/dev/null
! command -v docker >/dev/null
! command -v nginx >/dev/null
(cd /tmp && bash "$review/prepare-host.sh" --approved)
[[ $(sha256sum /home/youtopia-deploy/.ssh/authorized_keys) == "$key_before" ]]
expect_failure bash "$review/prepare-host.sh" --approved
nginx_version=$(apt-cache policy nginx | awk '/Candidate:/{print $2}')
[[ -n $nginx_version && $nginx_version != '(none)' ]]
# Existing policy must be left byte-for-byte unchanged, not silently replaced.
policy_before=$(sha256sum /usr/sbin/policy-rc.d)
expect_failure bash "$review/install-nginx-staged.sh" --approved "$nginx_version"
[[ $(sha256sum /usr/sbin/policy-rc.d) == "$policy_before" && ! -L /etc/systemd/system/nginx.service ]]
# Remove ONLY this test container's bootstrap policy to exercise the fresh-policy branch.
rm /usr/sbin/policy-rc.d
# Inject apt failure ONLY in this disposable container. Cleanup must remove its
# temporary policy and retain the new nginx mask for a blocked partial install.
mkdir /tmp/review-failing-apt
cat > /tmp/review-failing-apt/apt-get <<'APTFAIL'
#!/bin/sh
case " $* " in
  *' --simulate '*) exit 0 ;;
  *) exit 42 ;;
esac
APTFAIL
chmod 0755 /tmp/review-failing-apt/apt-get
expect_failure env PATH="/tmp/review-failing-apt:$PATH" bash "$review/install-nginx-staged.sh" --approved "$nginx_version"
[[ ! -e /usr/sbin/policy-rc.d && $(readlink /etc/systemd/system/nginx.service) == /dev/null ]]
# Remove only this test-created mask to exercise a new successful installation next.
rm /etc/systemd/system/nginx.service
bash "$review/install-nginx-staged.sh" --approved "$nginx_version" >/tmp/review-nginx-install.log 2>&1
[[ ! -e /usr/sbin/policy-rc.d && $(readlink /etc/systemd/system/nginx.service) == /dev/null ]]
bash "$review/check-ports.sh"
nginx -t >/tmp/review-nginx-syntax.log 2>&1
# Reproduce the collision if nginx is directly started, only inside this disposable container.
nginx
expect_failure bash "$review/check-ports.sh"
kill -0 "$(cat /run/nginx.pid)"
nginx -s quit
for attempt in {1..20}; do
  if bash "$review/check-ports.sh" >/dev/null 2>&1; then break; fi
  sleep .1
done
bash "$review/check-ports.sh"
after=$(sha256sum /srv/youtopia-data/postgres/review-marker /etc/cron.d/youtopia-collector; stat -c '%u:%g:%a' /srv/youtopia-data/postgres)
[[ $before == "$after" ]]
echo "PASS: Ubuntu24.04; nginx package=$nginx_version; apt failure cleanup retains mask; staged installation has no reserved listener; actual port80 startup detected; SSH restricted-key login passed; DB/cron fixtures unchanged"
