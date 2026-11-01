#!/usr/bin/env python3
"""Launch the reviewed JAR's interactive CLI. No default account or password argument."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat

def private_json(path):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info=os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or stat.S_IMODE(info.st_mode)!=0o600:
            raise ValueError()
        def unique(pairs):
            result={}
            for key,value in pairs:
                if key in result:raise ValueError()
                result[key]=value
            return result
        return json.load(stream,object_pairs_hook=unique)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jar',type=Path,required=True)
    parser.add_argument('--sha256',required=True)
    parser.add_argument('--runtime-input',type=Path)
    parser.add_argument('mode',choices=('status','create','reset'))
    parser.add_argument('--request-key')
    parser.add_argument('--reviewed',action='store_true')
    args=parser.parse_args()
    if os.geteuid()!=0 or not os.isatty(0):raise ValueError()
    if not re.fullmatch('[0-9a-f]{64}',args.sha256):raise ValueError()
    jar=args.jar.absolute()
    for path in (jar,*jar.parents):
        info=path.lstat()
        if path.is_symlink() or info.st_uid!=0 or info.st_mode&0o022:raise ValueError()
    if not jar.is_file() or hashlib.sha256(jar.read_bytes()).hexdigest()!=args.sha256:raise ValueError()
    if args.mode!='status' and not args.reviewed:raise ValueError()
    env={k:v for k,v in os.environ.items() if not (k.startswith(('DB_','PG','YOUTOPIA_','SPRING_','SERVER_','LOGGING_','LOADER_','LD_'))
        or re.search('PASSWORD|TOKEN|SECRET|PRIVATE_KEY|HMAC_KEY|CREDENTIAL|JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS',k,re.I))}
    command=['/usr/bin/java','-Xmx256m','-Dloader.main=com.youtopia.account.AdminOperatorCommand',
             '-cp',str(jar),'org.springframework.boot.loader.launch.PropertiesLauncher',args.mode]
    if args.mode=='reset':
        if not args.runtime_input or not args.request_key:raise ValueError()
        import uuid
        uuid.UUID(args.request_key)
        config=private_json(args.runtime_input)
        spec=importlib.util.spec_from_file_location('runtime_config',Path(__file__).with_name('prepare-runtime-config.py'))
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        module.validate(config,json.loads(Path(__file__).with_name('app-input.example.json').read_text()))
        env.update(config)
        command += [args.request_key]
    elif args.runtime_input or args.request_key:raise ValueError()
    if args.reviewed:command+=['--reviewed']
    os.execve(command[0],command,env)

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('ADMIN_OPERATOR_PRECHECK_FAILED; values suppressed; nothing launched') from None
