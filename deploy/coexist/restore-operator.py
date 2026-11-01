#!/usr/bin/env python3
"""Trusted root TTY launcher; explicit logical service-DB-only scope, no password arguments."""
import argparse
import base64
import getpass
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import uuid
from control_contract import SCOPE,ENDPOINTS,validate_connection

TOOLS=Path(__file__).resolve().parent

def validate(config):
    template=json.loads((TOOLS/'restore-input.example.json').read_text())
    if not isinstance(config,dict) or set(config)!=set(template):raise ValueError()
    if any(not isinstance(v,str) or any(ord(c)<32 or ord(c)==127 for c in v) for v in config.values()):raise ValueError()
    for key in ('YOUTOPIA_RESTORE_JDBC_URL','YOUTOPIA_RESTORE_EXPECTED_DB','YOUTOPIA_CONTROL_MANAGER_EXPECTED_DB','YOUTOPIA_CONTROL_MANAGER_DB_USER'):
        if config[key]!=template[key]:raise ValueError()
    validate_connection(config['YOUTOPIA_CONTROL_MANAGER_JDBC_URL'],config['YOUTOPIA_CONTROL_RESTORE_SCOPE'],config['YOUTOPIA_CONTROL_CONNECTION_POLICY'])
    role=config['YOUTOPIA_RESTORE_DB_USER']
    if not re.fullmatch('[a-z_][a-z0-9_]{0,62}',role) or role.startswith('ytp_app_') or role in ('ytp_control_app','ytp_restore_manager','ytp_codex'):raise ValueError()
    if not config['YOUTOPIA_RESTORE_DB_PASSWORD'] or not config['YOUTOPIA_CONTROL_MANAGER_DB_PASSWORD']:raise ValueError()
    if not re.fullmatch('[a-z0-9][a-z0-9_-]{0,63}',config['YOUTOPIA_CONTROL_SERVICE_KEY']):raise ValueError()
    if len(base64.b64decode(config['YOUTOPIA_CONTROL_HMAC_KEY'],validate=True))<32:raise ValueError()
    return config

def jar_is_trusted(path,expected):
    if not re.fullmatch('[0-9a-f]{64}',expected):raise ValueError()
    path=path.absolute()
    for parent in (path,*path.parents):
        info=parent.lstat()
        if parent.is_symlink() or info.st_uid!=0 or info.st_mode&0o022:raise ValueError()
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise ValueError()
    return path

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--jar',type=Path);parser.add_argument('--sha256')
    parser.add_argument('--reviewed',action='store_true')
    parser.add_argument('--service-database-only',action='store_true')
    parser.add_argument('--credential-state-reviewed',action='store_true')
    parser.add_argument('--reference');parser.add_argument('--run-id')
    parser.add_argument('command',choices=('prepare-input','inspect','enroll','begin','replay','verify','open'))
    args=parser.parse_args()
    if os.geteuid()!=0 or not os.isatty(0):raise ValueError()
    if args.command=='prepare-input':
        if args.jar or args.sha256 or args.reference or args.run_id or args.credential_state_reviewed:raise ValueError()
        if os.path.lexists(args.input):raise ValueError()
        # Refuse unsafe parent paths; the input is never an application-readable file.
        for parent in (args.input.absolute().parent,*args.input.absolute().parent.parents):
            info=parent.lstat()
            if parent.is_symlink() or info.st_uid!=0 or info.st_mode&0o022:raise ValueError()
        config=json.loads((TOOLS/'restore-input.example.json').read_text())
        config['YOUTOPIA_RESTORE_DB_USER']=input('Existing approved service restore DB login: ')
        policy=input('Reviewed control transport (HOST_LOOPBACK or VERIFY_FULL): ')
        if policy not in ENDPOINTS:raise ValueError()
        config['YOUTOPIA_CONTROL_CONNECTION_POLICY']=policy
        config['YOUTOPIA_CONTROL_MANAGER_JDBC_URL']=ENDPOINTS[policy]
        config['YOUTOPIA_RESTORE_DB_PASSWORD']=getpass.getpass('Service restore DB password (hidden): ')
        config['YOUTOPIA_CONTROL_MANAGER_DB_PASSWORD']=getpass.getpass('Control manager password (hidden): ')
        config['YOUTOPIA_CONTROL_HMAC_KEY']=getpass.getpass('Same approved base64 control HMAC key as the app (hidden): ')
        validate(config)
        fd=os.open(args.input,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,'w') as stream:json.dump(config,stream,indent=2);stream.write('\n')
        print('RESTORE_INPUT_PREPARED; no database or service change')
        return
    if not args.jar or not args.sha256 or not args.service_database_only:raise ValueError()
    if args.command!='inspect' and not args.reviewed:raise ValueError()
    jar=jar_is_trusted(args.jar,args.sha256)
    spec=importlib.util.spec_from_file_location('admin_operator',TOOLS/'admin-operator.py')
    helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    config=validate(helper.private_json(args.input))
    command=['/usr/bin/java','-Xmx256m','-Dloader.main=com.youtopia.restore.RestoreCommand',
             '-cp',str(jar),'org.springframework.boot.loader.launch.PropertiesLauncher',args.command]
    if args.command=='begin':
        if not args.reference or not re.fullmatch('[A-Za-z0-9_.:-]{1,64}',args.reference):raise ValueError()
        command.append(args.reference)
    elif args.reference:raise ValueError()
    if args.command in ('replay','verify','open'):
        if not args.run_id:raise ValueError()
        uuid.UUID(args.run_id);command.append(args.run_id)
    elif args.run_id:raise ValueError()
    if args.command=='verify':
        if not args.credential_state_reviewed:raise ValueError()
        command.append('--credential-state-reviewed')
    elif args.credential_state_reviewed:raise ValueError()
    env={k:v for k,v in os.environ.items() if not(k.startswith(('DB_','PG','YOUTOPIA_','SPRING_','SERVER_','LOGGING_','LOADER_','LD_'))
        or re.search('PASSWORD|TOKEN|SECRET|PRIVATE_KEY|HMAC_KEY|CREDENTIAL|JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS',k,re.I))}
    env.update(config)
    os.execve(command[0],command,env)

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('RESTORE_OPERATOR_PRECHECK_FAILED; values suppressed; no command launched') from None
