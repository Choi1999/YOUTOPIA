#!/usr/bin/env bash
# Operator review only. Not executed by Codex. No package-list refresh or service change.
set -u
umask 077
if [[ $# != 2 || $(id -u) != 0 || $(hostname -s) != "$1" || ! "$2" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
  echo 'Usage (existing root terminal): inspect-host.sh EXPECTED_SHORT_HOST EXISTING_POSTGRES_CONTAINER' >&2
  exit 2
fi
postgres_container=$2
printf '=== OBSERVATION TIME / OS / ARCH ===\n'
TZ=Asia/Seoul date --iso-8601=seconds
uname -m
awk -F= '$1=="PRETTY_NAME" || $1=="VERSION_ID" {print}' /etc/os-release

printf '\n=== JAVA: actual binary and full package versions ===\n'
if command -v java >/dev/null; then
  java_binary=$(readlink -f "$(command -v java)")
  printf 'java_binary=%s\n' "$java_binary"
  env -u JAVA_TOOL_OPTIONS -u JDK_JAVA_OPTIONS -u _JAVA_OPTIONS "$java_binary" -version
  dpkg-query -S "$java_binary" 2>/dev/null || printf 'JAVA_BINARY_PACKAGE_OWNER_UNVERIFIED\n'
else
  printf 'JAVA_BINARY_NOT_FOUND\n'
fi
dpkg-query -W -f='${binary:Package}\t${Version}\t${source:Package}\t${source:Version}\t${db:Status-Status}\n' 'openjdk-21*' 2>/dev/null || true

printf '\n=== NGINX: full package/build versions and modules ===\n'
dpkg-query -W -f='${binary:Package}\t${Version}\t${source:Package}\t${source:Version}\t${db:Status-Status}\n' 'nginx*' 'libnginx-mod-*' 2>/dev/null || true
if command -v nginx >/dev/null; then
  nginx -V 2>&1
  dpkg-query -S "$(readlink -f "$(command -v nginx)")" 2>/dev/null || true
fi
# Report directive NAMES only. Never dump settings, private keys, URLs or secrets.
# This static inventory does not fully resolve the effective include graph.
python3 - <<'PY'
from pathlib import Path
import re
root=Path('/etc/nginx')
wanted={'include','load_module','listen','alias','rewrite','set','return','map','aio','ssi','slice','mp4','dav_methods',
        'fastcgi_pass','scgi_pass','uwsgi_pass','grpc_pass','proxy_pass','ssl_verify_client','ssl_ocsp',
        'ssl_session_cache','ssl_session_tickets','ssl_session_ticket_key','ssl_protocols'}
for path in sorted(root.rglob('*')) if root.exists() else []:
    if not path.is_file():continue
    try:text=path.read_text()
    except (OSError,UnicodeError):continue
    for number,line in enumerate(text.splitlines(),1):
        match=re.match(r'\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+',line)
        if match and match[1] in wanted:
            print(str(path)+':'+str(number)+': '+match[1]+' [value withheld; inspect privately]')
PY

printf '\n=== APT: cached candidates and cache age, no refresh ===\n'
apt-cache policy openjdk-21-jre-headless nginx nginx-common
find /var/lib/apt/lists -maxdepth 1 -type f -name '*InRelease' -printf '%TY-%Tm-%TdT%TH:%TM:%TS %f\n'
printf '\n=== INSTALLED CHANGELOG SECURITY/BACKPORT ENTRIES ===\n'
for path in /usr/share/doc/nginx/changelog.Debian.gz /usr/share/doc/nginx-common/changelog.Debian.gz /usr/share/doc/openjdk-21-jre-headless/changelog.Debian.gz; do
  if [[ -r "$path" ]]; then
    printf 'CHANGELOG %s\n' "$path"
    zcat "$path" | sed -n '1,160p'
  fi
done

printf '\n=== PHP: package presence, CLI version without ini, process/service names ===\n'
dpkg-query -W -f='${binary:Package}\t${Version}\t${db:Status-Status}\n' 'php*' 'libapache2-mod-php*' 2>/dev/null || true
if command -v php >/dev/null; then php -n -v; else printf 'PHP_CLI_NOT_FOUND\n'; fi
ps -eo comm= | awk '$0 ~ /^(php|php-fpm|apache2|node|nginx|java)/ {print}'
systemctl list-units --all --type=service --no-pager 'php*-fpm.service' 'apache2.service' 'nginx.service' 'youtopia-app.service' || true
printf '\n=== LISTENERS ===\n'
ss -ltnp

printf '\n=== EXISTING POSTGRESQL: image identity, not a tag pull ===\n'
docker --host=unix:///var/run/docker.sock inspect --format 'name={{.Name}} image_id={{.Image}} configured_image={{.Config.Image}} state={{.State.Status}} memory={{.HostConfig.Memory}} ports={{json .HostConfig.PortBindings}} mounts={{json .Mounts}}' "$postgres_container"
pg_image_id=$(docker --host=unix:///var/run/docker.sock inspect --format '{{.Image}}' "$postgres_container") || exit 2
docker --host=unix:///var/run/docker.sock image inspect --format 'id={{.Id}} digests={{json .RepoDigests}} architecture={{.Architecture}}' "$pg_image_id"
docker --host=unix:///var/run/docker.sock exec "$postgres_container" postgres --version
# No password prompt, no role/provisioning/permission changes. A denied query stays unverified.
docker --host=unix:///var/run/docker.sock exec --user postgres "$postgres_container" \
  psql -X -w -U postgres -d youtopia -A -t -c \
  'BEGIN READ ONLY; SELECT version(); SHOW server_version_num; SELECT extname,extversion FROM pg_extension ORDER BY extname; COMMIT;' \
  || printf 'POSTGRES_RUNTIME_VERSION_OR_EXTENSION_QUERY_UNVERIFIED; do not change authentication\n'
docker --host=unix:///var/run/docker.sock exec "$postgres_container" sh -c \
  'cat /etc/os-release; if command -v dpkg-query >/dev/null; then dpkg-query -W; elif command -v apk >/dev/null; then apk info -v; else echo OS_PACKAGE_INVENTORY_UNAVAILABLE; fi' \
  || printf 'POSTGRES_CONTAINER_OS_INVENTORY_UNVERIFIED\n'

printf '\n=== EXISTING APP/REDIS PREPARATION: inspect only, do not create/start ===\n'
id youtopia-deploy
getent passwd youtopia-app || true
for path in /opt/youtopia-app /opt/youtopia-app/releases /etc/youtopia-app /srv/youtopia-data/redis /etc/systemd/system/youtopia-app.service; do
  stat -c '%U:%G %a %n' "$path" 2>/dev/null || printf 'PATH_UNVERIFIED %s\n' "$path"
done
readlink /etc/systemd/system/nginx.service || true
if [[ -d /opt/youtopia-app/releases ]]; then
  find /opt/youtopia-app/releases -mindepth 1 -maxdepth 1 -type d -printf 'RELEASE_OWNER %u:%g %m %p\n'
fi
sha256sum /etc/cron.d/youtopia-collector
docker --host=unix:///var/run/docker.sock ps --filter label=com.docker.compose.project=youtopia-app-cache --format '{{.Names}} {{.Status}}'
printf '\nREAD_ONLY_OBSERVATIONS_FINISHED; missing/failed observations remain unverified\n'
