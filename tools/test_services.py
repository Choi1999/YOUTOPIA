#!/usr/bin/env python3
"""Own disposable loopback-only synthetic services. Never uses production DB variables."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / 'build/test-services.json'
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
PROJECT = hashlib.sha256(str(ROOT).encode()).hexdigest()
IMAGES = {
    'postgres': 'postgres:16-alpine@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab',
    'redis': 'public.ecr.aws/docker/library/redis:7@sha256:b6b6e3dc0c0952737748e55d5d885272840c7e42ba41ab1d5489f693419882f5',
}
FIXTURES = [('postgres', '00-cluster.sql'), ('youtopia_auth_test', '10-accounts.sql'),
    ('youtopia_auth_test', '11-reporting.sql'), ('youtopia_control_test', '20-control.sql'),
    ('youtopia_test', '30-observations.sql'), ('youtopia_source_test', '40-source-contract.sql')]

def fixture_fingerprint():
    digest = hashlib.sha256()
    for database, name in FIXTURES:
        digest.update((database+'/'+name+'\0').encode())
        digest.update((ROOT/'src/test/fixtures'/name).read_bytes())
    return digest.hexdigest()

def child_env():
    return {k: v for k, v in os.environ.items() if not k.startswith(
        ('DB_', 'PG', 'YOUTOPIA_', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_CERT_PATH'))}

def run(args, *, input=None, timeout=45, check=True):
    result = subprocess.run(args, input=input, env=child_env(), capture_output=True,
                            text=True, timeout=timeout)
    if check and result.returncode:
        message = result.stderr[:1600]
        for key, value in os.environ.items():
            if value and re.search('PASSWORD|TOKEN|SECRET|PRIVATE_KEY', key, re.I):
                message = message.replace(value, '[REDACTED]')
        raise RuntimeError('Test tool failed (exit '+str(result.returncode)+'): '+message)
    return result

def validate_shape(state, ready=True):
    token = state.get('token', '')
    if (state.get('version') != 1 or not re.fullmatch('[0-9a-f]{12}', token)
            or state.get('project') != PROJECT):
        raise ValueError('Unrecognized test-service state; refusing access/cleanup')
    for kind, short in [('postgres', 'pg'), ('redis', 'redis')]:
        if state.get(kind) != 'youtopia-test-'+short+'-'+token:
            raise ValueError('Unrecognized test container name')
    if ready:
        if state.get('fixture_sha256') != fixture_fingerprint():
            raise ValueError('Synthetic fixtures changed; stop and start this checkout\'s services again')
        if state.get('phase') != 'ready':
            raise ValueError('Incomplete setup; run stop before preparing again')
        for key in ['postgres_port', 'redis_port']:
            if type(state.get(key)) is not int or not 1024 <= state[key] <= 65535:
                raise ValueError('Unrecognized loopback test port')
    return state

def inspect_owned(state, kind, missing_ok=False):
    result = run(DOCKER+['inspect', state[kind]], check=False)
    if result.returncode:
        if missing_ok and 'No such object' in result.stderr:
            return None
        raise RuntimeError('Cannot inspect owned test container '+state[kind])
    info = json.loads(result.stdout)[0]
    labels = info.get('Config', {}).get('Labels') or {}
    if (labels.get('io.youtopia.synthetic') != state['token']
            or labels.get('io.youtopia.test-project') != PROJECT):
        raise ValueError('Container ownership mismatch; refusing access/cleanup')
    return info

def load_state():
    if not STATE.is_file():
        raise ValueError('Run python3 tools/test_services.py start before integration tests')
    state = validate_shape(json.loads(STATE.read_text()))
    for kind, internal in [('postgres', '5432/tcp'), ('redis', '6379/tcp')]:
        info = inspect_owned(state, kind)
        bindings = info['NetworkSettings']['Ports'].get(internal)
        if (not info['State']['Running'] or not bindings or len(bindings) != 1
                or bindings[0]['HostIp'] != '127.0.0.1'
                or int(bindings[0]['HostPort']) != state[kind+'_port']):
            raise ValueError('Test container/loopback port identity mismatch')
    return state

def save(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, indent=2)+'\n')
    temporary.chmod(0o600)
    temporary.replace(STATE)

def stop():
    if not STATE.exists():
        return
    state = validate_shape(json.loads(STATE.read_text()), ready=False)
    # Validate ALL ownership before deleting ANY resource. No name-only deletion.
    owned = [kind for kind in ['postgres', 'redis'] if inspect_owned(state, kind, True)]
    for kind in owned:
        run(DOCKER+['rm', '--force', '--volumes', state[kind]])
    STATE.unlink()

def start():
    if STATE.exists():
        return load_state()  # Never reseed or replace an existing environment.
    run(DOCKER+['info', '--format', '{{.ServerVersion}}'])
    token = uuid.uuid4().hex[:12]
    state = dict(version=1, project=PROJECT, token=token, phase='creating',
                 postgres='youtopia-test-pg-'+token, redis='youtopia-test-redis-'+token,
                 fixture_sha256=fixture_fingerprint())
    save(state)
    try:
        for kind, port in [('postgres', 5432), ('redis', 6379)]:
            # Always resolve/fetch the pinned image; a populated local image cache is optional.
            run(DOCKER+['pull', IMAGES[kind]], timeout=240)
            extra = ['-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
                     '-e', 'POSTGRES_INITDB_ARGS=--auth-host=trust --auth-local=trust'] if kind == 'postgres' else []
            run(DOCKER+['run', '--detach', '--pull=never', '--name', state[kind],
                '--label', 'io.youtopia.synthetic='+token, '--label', 'io.youtopia.test-project='+PROJECT,
                '--publish', '127.0.0.1::'+str(port)]+extra+[IMAGES[kind]])
            info = inspect_owned(state, kind)
            state[kind+'_port'] = int(info['NetworkSettings']['Ports'][str(port)+'/tcp'][0]['HostPort'])
            save(state)
        for _ in range(100):
            if run(DOCKER+['exec', state['postgres'], 'pg_isready', '-q', '-U', 'postgres'], check=False).returncode == 0:
                break
            time.sleep(.2)
        else:
            raise RuntimeError('Synthetic PostgreSQL startup timed out')
        for database, name in FIXTURES:
            inspect_owned(state, 'postgres')
            sql = "SET youtopia.synthetic_test='fixture-v1';\n"+(ROOT/'src/test/fixtures'/name).read_text()
            run(DOCKER+['exec', '-i', state['postgres'], 'psql', '-X', '-q', '-v',
                'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], input=sql)
        run(DOCKER+['exec', state['redis'], 'redis-cli', 'PING'])
        state['phase'] = 'ready'
        save(state)
        return load_state()
    except BaseException:
        stop()
        raise

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['start', 'status', 'stop', 'verify'])
    parser.add_argument('--quiet', action='store_true')
    parser.add_argument('--with-browser', action='store_true')
    args = parser.parse_args()
    if args.command == 'stop':
        stop()
    elif args.command == 'verify':
        if STATE.exists():
            raise ValueError('verify requires a new environment; stop this checkout\'s services first')
        try:
            start()
            subprocess.run([str(ROOT/'gradlew'), '--no-daemon', '--max-workers=2', 'check', 'bootJar'],
                           cwd=ROOT, env=child_env(), check=True)
            subprocess.run([sys.executable, str(ROOT/'tools/verify_packaged_sessions.py')]
                           +(['--with-browser'] if args.with_browser else []), cwd=ROOT, env=child_env(), check=True)
        finally:
            stop()
    else:
        state = start() if args.command == 'start' else load_state()
        if not args.quiet:
            print(json.dumps(state))  # Non-secret resource identity only.

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, subprocess.SubprocessError, OSError) as error:
        raise SystemExit(str(error))
