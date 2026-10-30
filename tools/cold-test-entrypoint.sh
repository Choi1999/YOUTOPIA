#!/bin/sh
# Disposable nested daemon: no host Docker socket, private paths, DB vars, or cache mounts.
set -eu
if [ -f /run/proxy-ca.pem ]; then
    cp /run/proxy-ca.pem /usr/local/share/ca-certificates/cold-proxy.crt
    update-ca-certificates >/dev/null
    keytool -importcert -noprompt -alias cold-proxy -file /run/proxy-ca.pem \
        -cacerts -storepass changeit >/dev/null 2>&1
fi
proxy_options=$(python3 -c 'import os,urllib.parse; u=urllib.parse.urlsplit(os.environ.get("HTTPS_PROXY","")); print("-Dhttps.proxyHost="+u.hostname+" -Dhttps.proxyPort="+str(u.port or 80)+" -Dhttp.proxyHost="+u.hostname+" -Dhttp.proxyPort="+str(u.port or 80)) if u.hostname else None')
export GRADLE_OPTS="${GRADLE_OPTS:-} $proxy_options"
dockerd-entrypoint.sh dockerd --host=unix:///var/run/docker.sock --storage-driver=vfs >/tmp/cold-dockerd.log 2>&1 &
daemon_pid=$!
trap 'kill "$daemon_pid" 2>/dev/null || true' EXIT
attempt=0
until docker --host=unix:///var/run/docker.sock info >/dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ "$attempt" -ge 60 ] || ! kill -0 "$daemon_pid" 2>/dev/null; then
        echo 'Cold test daemon unavailable; inspect /tmp/cold-dockerd.log' >&2
        exit 1
    fi
    sleep 1
done
test -z "$(docker --host=unix:///var/run/docker.sock ps -aq)"
test -z "$(docker --host=unix:///var/run/docker.sock images -q)"
test ! -d "$GRADLE_USER_HOME/caches"
test ! -d "$GRADLE_USER_HOME/wrapper"
echo 'COLD_START: empty Docker images/containers and empty Gradle/Wrapper caches'
python3 tools/test_services.py verify
test ! -f build/test-services.json
test -z "$(docker --host=unix:///var/run/docker.sock ps -aq)"
echo 'COLD_VERIFY_PASS: check + bootJar + packaged sessions; owned resources cleaned'
