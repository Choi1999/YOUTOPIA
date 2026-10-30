#!/usr/bin/env python3
"""Isolated packaged-JAR HTTP test. Uses disposable local fixtures, never production variables."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid
import argparse
import socket
from test_services import load_state

arguments = argparse.ArgumentParser(description=__doc__)
arguments.add_argument('--with-browser', action='store_true', help='Run saved React browser E2E against these isolated JAR processes')
arguments = arguments.parse_args()

root = Path(__file__).resolve().parent.parent
reports = root / 'build/reports/packaged-sessions'
reports.mkdir(parents=True, exist_ok=True)
services = load_state()
jdbc_prefix = 'jdbc:postgresql://127.0.0.1:' + str(services['postgres_port']) + '/'
with socket.socket() as first_socket, socket.socket() as second_socket, socket.socket() as web_socket:
    first_socket.bind(('127.0.0.1', 0)); second_socket.bind(('127.0.0.1', 0)); web_socket.bind(('127.0.0.1', 0))
    FIRST_PORT = first_socket.getsockname()[1]; SECOND_PORT = second_socket.getsockname()[1]
    WEB_PORT = web_socket.getsockname()[1]
cli = ['docker', '--host=unix:///var/run/docker.sock', 'exec', '-i', services['postgres'],
       'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d']

def isolated_sql(database, query):
    assert database in {'youtopia_test', 'youtopia_auth_test', 'youtopia_control_test'}
    result = subprocess.run(cli + [database], input=query, text=True, capture_output=True, timeout=15)
    if result.returncode:
        raise AssertionError('Isolated smoke fixture setup failed')

generation = str(uuid.uuid4())
fingerprint = hmac.new(bytes(32), b'journal-key-v1\0p0-smoke', hashlib.sha256).hexdigest()
isolated_sql('youtopia_auth_test', "TRUNCATE auth.service_user,auth.admin_account,auth.security_operation,security.security_audit_event,telemetry.product_event,service.signup_daily_count CASCADE; UPDATE service.restore_marker SET journal_sequence=0,generation='" + generation + "';")
isolated_sql('youtopia_control_test', "DELETE FROM restore_control.deletion_journal WHERE service_key='p0-smoke'; DELETE FROM restore_control.restore_run WHERE service_key='p0-smoke'; DELETE FROM restore_control.service_fence WHERE service_key='p0-smoke'; INSERT INTO restore_control.service_fence(service_key,state,generation,key_fingerprint) VALUES('p0-smoke','OPEN','" + generation + "',decode('" + fingerprint + "','hex')); ")
isolated_sql('youtopia_test', "TRUNCATE service.game_catalog_fixture,collector.ccu_fixture; INSERT INTO service.game_catalog_fixture(app_id,steam_name,developers,steam_tracked) VALUES(570,'Packaged Synthetic Game','[]',true); INSERT INTO collector.ccu_fixture(observation_id,app_id,scheduled_at,observed_at,player_count) VALUES(1,570,current_timestamp-interval '10 minutes',current_timestamp-interval '10 minutes',0);")
env = {k: v for k, v in os.environ.items() if not k.startswith(('DB_', 'YOUTOPIA_'))}
env.update(YOUTOPIA_DATA_JDBC_URL=jdbc_prefix + 'youtopia_test',
    YOUTOPIA_DATA_DB_USER='ytp_test_data_ro', YOUTOPIA_DATA_DB_PASSWORD='',
    YOUTOPIA_SESSION_REDIS_HOST='127.0.0.1', YOUTOPIA_SESSION_REDIS_PORT=str(services['redis_port']),
    YOUTOPIA_SESSION_REDIS_TLS='false', YOUTOPIA_ACCOUNTS_ENABLED='true',
    YOUTOPIA_GAMES_ENABLED='true',
    YOUTOPIA_ACCOUNT_HMAC_KEY=base64.b64encode(bytes(32)).decode(),
    YOUTOPIA_CONTROL_ENABLED='true', YOUTOPIA_CONTROL_SERVICE_KEY='p0-smoke',
    YOUTOPIA_CONTROL_HMAC_KEY=base64.b64encode(bytes(32)).decode(),
    YOUTOPIA_CONTROL_JDBC_URL=jdbc_prefix + 'youtopia_control_test',
    YOUTOPIA_CONTROL_DB_USER='ytp_test_control_app', YOUTOPIA_CONTROL_DB_PASSWORD='')
for kind in ['MEMBER', 'ADMIN', 'AUDIT']:
    env['YOUTOPIA_' + kind + '_JDBC_URL'] = jdbc_prefix + 'youtopia_auth_test'
    env['YOUTOPIA_' + kind + '_DB_USER'] = 'ytp_test_' + kind.lower()
    env['YOUTOPIA_' + kind + '_DB_PASSWORD'] = ''
if arguments.with_browser:
    for module, role in [('DIRECTORY', 'directory'), ('EVENT', 'event'), ('REPORT', 'report')]:
        env['YOUTOPIA_' + module + '_JDBC_URL'] = jdbc_prefix + 'youtopia_auth_test'
        env['YOUTOPIA_' + module + '_DB_USER'] = 'ytp_test_' + role
        env['YOUTOPIA_' + module + '_DB_PASSWORD'] = ''
    env.update(YOUTOPIA_DIRECTORY_ENABLED='true', YOUTOPIA_EVENTS_ENABLED='true', YOUTOPIA_REPORTING_ENABLED='true')
java = str(Path(env['JAVA_HOME']) / 'bin/java') if env.get('JAVA_HOME') else 'java'
jar = root / 'build/libs/youtopia-backend-0.1.0-SNAPSHOT.jar'
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
processes = []
logs = []

def request(port, path, method='GET', body=None, cookie=None, csrf=None):
    headers = {}
    if cookie:
        headers['Cookie'] = cookie
    if csrf:
        headers['X-CSRF-TOKEN'] = csrf
    if body is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request('http://127.0.0.1:' + str(port) + path,
        data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
    try:
        response = opener.open(req, timeout=5)
    except urllib.error.HTTPError as failure:
        response = failure
    with response:
        raw = response.read()
        return response.status, json.loads(raw) if raw else None, response.headers

def start(port):
    log = (reports / ('process-' + str(port) + '-' + str(len(logs)) + '.log')).open('w')
    logs.append(log)
    process = subprocess.Popen([java, '-jar', str(jar), '--server.address=127.0.0.1',
        '--server.port=' + str(port), '--spring.session.data.redis.namespace=youtopia:p0-smoke'],
        env=env, stdout=log, stderr=subprocess.STDOUT)
    processes.append(process)
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            status, _, _ = request(port, '/api/v1/auth/csrf')
            if status == 200:
                return process
        except OSError:
            pass
        if process.poll() is not None:
            raise AssertionError('Packaged application stopped during startup')
        time.sleep(.25)
    raise AssertionError('Packaged application startup timed out')

def stop(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)

cookie = None

def post(port, path, body, expected):
    global cookie
    status, token, headers = request(port, '/api/v1/auth/csrf', cookie=cookie)
    assert status == 200
    new_cookie = headers.get('Set-Cookie')
    if new_cookie:
        cookie = new_cookie.split(';', 1)[0]
    status, data, headers = request(port, path, 'POST', body, cookie, token['token'])
    assert status == expected, 'Unexpected isolated API status'
    if headers.get('Set-Cookie'):
        cookie = headers['Set-Cookie'].split(';', 1)[0]
    return data, headers

result = {'production_runtime_verified': False, 'browser_ui_verified': False, 'jar_sha256': hashlib.sha256(jar.read_bytes()).hexdigest()}
try:
    with tempfile.NamedTemporaryFile(mode='w', prefix='youtopia-fake-password-list-') as blocklist:
        blocklist.write(hashlib.sha256(b'passwordpassword').hexdigest() + '\n')
        blocklist.flush()
        env['YOUTOPIA_PASSWORD_BLOCKLIST'] = blocklist.name
        if arguments.with_browser:
            subprocess.run(['bash', str(root / 'gradlew'), '--offline', '--no-daemon', '--max-workers=2', 'prepareBrowserFixtures'], cwd=root, env=env, check=True, timeout=90)
        first = start(FIRST_PORT)
        start(SECOND_PORT)
        fake = {'email': 'packaged@example.invalid', 'password': 'fake packaged test password 1234'}
        post(FIRST_PORT, '/api/v1/auth/signup', fake, 201)
        identity, headers = post(FIRST_PORT, '/api/v1/auth/login', {'login': fake['email'], 'password': fake['password']}, 200)
        assert identity['kind'] == 'USER'
        set_cookie = headers.get('Set-Cookie', '')
        assert all(flag in set_cookie for flag in ['Secure', 'HttpOnly', 'SameSite=Lax'])
        assert request(SECOND_PORT, '/api/v1/auth/me', cookie=cookie)[0] == 200
        status, listing, _ = request(SECOND_PORT, '/api/v1/games', cookie=cookie)
        assert status == 200 and listing['page']['totalElements'] == (3 if arguments.with_browser else 1)
        assert listing['content'][0]['gameId'] == 'steam:570'
        status, detail, _ = request(FIRST_PORT, '/api/v1/games/steam:570', cookie=cookie)
        assert status == 200 and detail['game']['currentCcu']['value'] == 0
        assert detail['steamPreview']['days'] == 30
        search, _ = post(FIRST_PORT, '/api/v1/games/search', {'q': 'Browser Arena' if arguments.with_browser else 'Packaged Synthetic', 'clientEventId': str(uuid.uuid4())}, 200)
        assert search['page']['totalElements'] == 1
        assert search['searchTracking']['availability'] == ('AVAILABLE' if arguments.with_browser else 'UNAVAILABLE')
        assert request(FIRST_PORT, '/api/v1/games')[0] == 200
        assert request(FIRST_PORT, '/api/v1/me/settings')[0] == 401
        assert request(FIRST_PORT, '/api/v1/admin/members')[0] == 401
        assert request(FIRST_PORT, '/api/v1/games/search', 'POST', {'q': 'Packaged Synthetic', 'clientEventId': str(uuid.uuid4())}, cookie)[0] == 403
        result.update(game_list_detail_search=True, real_zero_preserved=True, optional_telemetry_absence_preserves_search=True, game_authorization_and_csrf=True)
        result["optional_telemetry_absence_preserves_search"] = "NOT_EXECUTED_THIS_PROFILE" if arguments.with_browser else "PASS"
        result.update(packaged_jar_started=True, real_password_login=True, csrf_and_secure_cookie=True, two_instances_share_session=True)
        stop(first)
        start(FIRST_PORT)
        assert request(FIRST_PORT, '/api/v1/auth/me', cookie=cookie)[0] == 200
        result['restart_preserves_session'] = True
        post(SECOND_PORT, '/api/v1/auth/logout', {}, 204)
        assert request(FIRST_PORT, '/api/v1/auth/me', cookie=cookie)[0] == 401
        assert request(FIRST_PORT, '/api/v1/games', cookie=cookie)[0] == 200
        result['logout_revokes_other_instance'] = True
        if arguments.with_browser:
            browser_env = env.copy()
            browser_env['YOUTOPIA_REAL_E2E'] = 'true'
            browser_env['YOUTOPIA_TEST_HTTP_PORT'] = str(FIRST_PORT)
            browser_env['YOUTOPIA_TEST_WEB_PORT'] = str(WEB_PORT)
            # The saved browser cases explicitly verify opted-in telemetry.
            browser_env['VITE_PRODUCT_EVENTS_ENABLED'] = 'true'
            completed = subprocess.run(['pnpm', 'exec', 'playwright', 'test', '--config=playwright.service.config.ts'],
                cwd=root / 'frontend', env=browser_env, timeout=240)
            assert completed.returncode == 0, 'Saved browser E2E failed'
            result['saved_real_browser_e2e'] = True
            result['browser_ui_verified'] = True
            result['browser_scope'] = 'ISOLATED_SYNTHETIC_DATA_REAL_CHROMIUM; fault-injection cases explicitly stubbed'
        result['status'] = 'PASS'
finally:
    for process in processes:
        stop(process)
    for log in logs:
        log.close()
    (reports / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
