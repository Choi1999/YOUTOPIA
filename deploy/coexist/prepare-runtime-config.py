#!/usr/bin/env python3
"""Offline structural validation and systemd EnvironmentFile encoding; no DB/network.
This does not establish control independence, fence state, or operator acceptance.
"""
import base64
import json
import os
from pathlib import Path
import re
import stat
import sys
from control_contract import validate_connection

ROLES = {'DATA':'ytp_app_data_ro', 'MEMBER':'ytp_app_member', 'ADMIN':'ytp_app_admin_auth',
         'AUDIT':'ytp_app_audit', 'EVENT':'ytp_app_event', 'DIRECTORY':'ytp_app_directory',
         'REPORT':'ytp_app_report'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def validate(config, expected_keys):
    require(isinstance(config, dict) and set(config) == set(expected_keys), 'Variable-name set must match reviewed source template')
    for key, value in config.items():
        require(re.fullmatch(r'YOUTOPIA_[A-Z_]+', key) and isinstance(value, str), 'Only named string values are accepted')
        require(not any(ord(c) < 32 or ord(c) == 127 for c in value), 'Control characters are not permitted in environment values')
    require(config['YOUTOPIA_ENVIRONMENT'] == 'PRODUCTION', 'PRODUCTION environment required')
    for key in ('YOUTOPIA_ACCOUNTS_ENABLED', 'YOUTOPIA_CONTROL_ENABLED'):
        require(config[key] == 'true', key + ' must be true for the reviewed member launch; missing control is a stop condition')
    for key in ('YOUTOPIA_PRIVACY_ENABLED','YOUTOPIA_ACCOUNTS_DELETION_ENABLED',
                'YOUTOPIA_ACCOUNTS_RECONCILIATION_ENABLED','YOUTOPIA_QUERY_ASSOCIATIONS_ENABLED'):
        require(config[key] == 'false', key + ' remains false pending separate review')
    for key in ('YOUTOPIA_DIRECTORY_ENABLED','YOUTOPIA_EVENTS_ENABLED','YOUTOPIA_REPORTING_ENABLED','YOUTOPIA_GAMES_ENABLED'):
        require(config[key] in ('true','false'), key + ' must be explicitly reviewed as true or false')
    for kind, role in ROLES.items():
        prefix = 'YOUTOPIA_' + kind
        require(config[prefix+'_DB_USER'] == role, prefix + ' role mismatch')
        require(bool(config[prefix+'_DB_PASSWORD']), prefix + ' password missing')
        require(config[prefix+'_JDBC_URL'] == 'jdbc:postgresql://127.0.0.1:5432/youtopia?sslmode=disable', prefix + ' must use the preserved host loopback service DB')
    for key in ('YOUTOPIA_PRIVACY_DB_PASSWORD','YOUTOPIA_PRIVACY_DB_USER','YOUTOPIA_PRIVACY_JDBC_URL',
                'YOUTOPIA_RETENTION_APPROVAL_REF','YOUTOPIA_RETENTION_PLAN'):
        require(config[key] == '', 'Unapproved privacy/retention fields must remain empty')
    require(config['YOUTOPIA_SESSION_REDIS_HOST'] == '127.0.0.1' and config['YOUTOPIA_SESSION_REDIS_PORT'] == '6379'
            and config['YOUTOPIA_SESSION_REDIS_USERNAME'] == 'youtopia'
            and config['YOUTOPIA_SESSION_REDIS_TLS'] == 'false', 'Reviewed Redis topology is authenticated host loopback')
    require(len(config['YOUTOPIA_SESSION_REDIS_PASSWORD'].encode()) >= 32, 'Redis password does not satisfy the existing ACL tool contract')
    require(config['YOUTOPIA_PASSWORD_BLOCKLIST'] == '/etc/youtopia-app/password-blocklist.sha256', 'Reviewed password blocklist path required')
    for key in ('YOUTOPIA_ACTIVE_SESSION_WINDOW_SECONDS','YOUTOPIA_ACCOUNTS_RECONCILIATION_DELAY_MS'):
        require(config[key].isdigit() and int(config[key]) > 0, key + ' must be a positive integer')
    for key in ('YOUTOPIA_ACCOUNT_HMAC_KEY','YOUTOPIA_CONTROL_HMAC_KEY'):
        try:
            decoded = base64.b64decode(config[key], validate=True)
        except (ValueError, TypeError):
            raise ValueError(key + ' must be valid base64') from None
        require(len(decoded) >= 32, key + ' does not satisfy the application key contract')
    require(config['YOUTOPIA_ACCOUNT_HMAC_KEY'] != config['YOUTOPIA_CONTROL_HMAC_KEY'], 'Account and control keys must be distinct')
    require(config['YOUTOPIA_CONTROL_DB_USER'] == 'ytp_control_app' and bool(config['YOUTOPIA_CONTROL_DB_PASSWORD']), 'Separate restricted control application login required')
    require(bool(config['YOUTOPIA_CONTROL_SERVICE_KEY']), 'Existing approved control service identity required')
    validate_connection(config['YOUTOPIA_CONTROL_JDBC_URL'],config['YOUTOPIA_CONTROL_RESTORE_SCOPE'],config['YOUTOPIA_CONTROL_CONNECTION_POLICY'])
    return config

def encode(config):
    # systemd double quotes: only backslash and double quote need escaping here.
    # Values have no control characters; $, #, spaces, and backticks remain literal.
    return ''.join(key + '="' + value.replace('\\','\\\\').replace('"','\\"') + '"\n' for key,value in config.items())

def main():
    require(len(sys.argv) == 3, 'Usage: prepare-runtime-config.py ROOT_ONLY_INPUT.json NEW_OUTPUT.env')
    input_path, output_path = map(Path, sys.argv[1:])
    fd = os.open(input_path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as file:
        info = os.fstat(file.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == os.geteuid() and stat.S_IMODE(info.st_mode) == 0o600,
                'Input must be an owner-only regular file with mode 0600')
        def unique(pairs):
            result={}
            for key,value in pairs:
                require(key not in result, 'Duplicate input variable')
                result[key]=value
            return result
        config = json.load(file, object_pairs_hook=unique)
    template = json.loads((Path(__file__).parent/'app-input.example.json').read_text())
    validate(config, template)
    fd = os.open(output_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd,'w') as file:
        file.write(encode(config))
    print('CONFIG_STRUCTURE_VALIDATED; service-only restore boundary, fence, credentials and HTTPS still require operational acceptance')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Never expose parser snippets, URI values, secret material or library exceptions.
        raise SystemExit('CONFIG_PREPARATION_FAILED: check the input contract locally; values suppressed') from None
