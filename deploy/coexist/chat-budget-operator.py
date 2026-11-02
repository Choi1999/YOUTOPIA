#!/usr/bin/env python3
"""Enroll a NEW demo budget offline. Never resets or deletes an existing epoch."""
import argparse
import hashlib
import importlib.util
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar',type=Path,required=True)
    parser.add_argument('--sha256',required=True)
    parser.add_argument('--runtime-input',type=Path,required=True)
    parser.add_argument('--reviewed-new-budget',action='store_true',required=True)
    args=parser.parse_args()
    if os.geteuid()!=0 or not os.isatty(0):raise ValueError()
    # A stopped app prevents manual budget rotation while an old provider request can still be running.
    for field,expected in (('LoadState','loaded'),('ActiveState','inactive'),('MainPID','0')):
        result=subprocess.run(['systemctl','show','--property='+field,'--value','youtopia-app.service'],capture_output=True,text=True)
        if result.returncode or result.stdout.strip()!=expected:raise ValueError()
    spec=importlib.util.spec_from_file_location('admin_operator',Path(__file__).with_name('admin-operator.py'))
    admin=importlib.util.module_from_spec(spec);spec.loader.exec_module(admin)
    config=admin.private_json(args.runtime_input)
    spec=importlib.util.spec_from_file_location('runtime_config',Path(__file__).with_name('prepare-runtime-config.py'))
    runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
    import json
    runtime.validate(config,json.loads(Path(__file__).with_name('app-input.example.json').read_text()))
    if config['YOUTOPIA_CHAT_ENABLED']!='false' or not config['YOUTOPIA_CHAT_BUDGET_EPOCH']:raise ValueError()
    jar=args.jar.absolute()
    for path in (jar,*jar.parents):
        info=path.lstat()
        if path.is_symlink() or info.st_uid!=0 or info.st_mode&0o022:raise ValueError()
    if not re.fullmatch('[0-9a-f]{64}',args.sha256) or hashlib.sha256(jar.read_bytes()).hexdigest()!=args.sha256:raise ValueError()
    account=pwd.getpwnam('youtopia-app')
    folder=Path(config['YOUTOPIA_CHAT_BUDGET_FILE']).parent
    info=folder.lstat()
    if folder.is_symlink() or not stat.S_ISDIR(info.st_mode) or info.st_uid!=account.pw_uid or stat.S_IMODE(info.st_mode)!=0o700:raise ValueError()
    allowed=('YOUTOPIA_ENVIRONMENT','YOUTOPIA_CHAT_ENABLED','YOUTOPIA_CHAT_BUDGET_EPOCH','YOUTOPIA_CHAT_BUDGET_FILE',
             'YOUTOPIA_SESSION_REDIS_HOST','YOUTOPIA_SESSION_REDIS_PORT','YOUTOPIA_SESSION_REDIS_USERNAME','YOUTOPIA_SESSION_REDIS_PASSWORD','YOUTOPIA_SESSION_REDIS_TLS')
    env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8',**{k:config[k] for k in allowed}}
    command=['/usr/bin/java','-Xmx128m','-Dloader.main=com.youtopia.chat.ChatBudgetOperatorCommand','-cp',str(jar),
             'org.springframework.boot.loader.launch.PropertiesLauncher','initialize','--reviewed-new-budget']
    result=subprocess.run(command,env=env,user=account.pw_uid,group=account.pw_gid,extra_groups=[],cwd=folder)
    if result.returncode:raise ValueError()

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('CHAT_BUDGET_OPERATOR_FAILED; values suppressed; preserve existing budget state') from None
