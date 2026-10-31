#!/usr/bin/env python3
"""Exercise deployment Redis configuration on an owned disposable local container.
Never connects to server Redis or consumes runtime secrets. Needs local Docker.
"""
from pathlib import Path
import hashlib
import argparse
import sys
import json
import os
import secrets
import subprocess
import tempfile
import time
import uuid
ROOT = Path(__file__).resolve().parent
IMAGE = 'public.ecr.aws/docker/library/redis:7.2.13-alpine@sha256:9907ac0c435717b4d95697cb4d0ce77d100b1d21269a01a0ce66f27335184c38'
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
token = uuid.uuid4().hex
name = 'youtopia-coexist-redis-test-'+token[:12]
env = {k:v for k,v in os.environ.items() if not k.startswith(('DB_', 'PG', 'YOUTOPIA_', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_CERT_PATH'))}
password = secrets.token_hex(32)
def run(args, data=None, check=True):
    r = subprocess.run(DOCKER+args, input=data, text=True, capture_output=True, env=env, timeout=90)
    if check and r.returncode: raise RuntimeError('Disposable Redis tool failed (details suppressed)')
    return r.stdout.strip()
def cli(*args, auth=True, data=None):
    cmd = ['exec', '-i']
    if auth: cmd += ['-e', 'REDISCLI_AUTH='+password]
    return run(cmd+[name,'redis-cli','--no-auth-warning']+(['--user','youtopia'] if auth else [])+['--raw']+list(args), data)
def require(condition, message):
    if not condition: raise RuntimeError(message)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--with-app", action="store_true", help="Also run the built JAR against this ACL and isolated DB fixtures")
args = parser.parse_args()
created = False
with tempfile.TemporaryDirectory(prefix='youtopia-coexist-redis-') as temp:
    temp = Path(temp); temp.chmod(0o755)
    # Reduce only maxmemory to make deterministic OOM testing economical.
    conf = (ROOT/'redis.conf').read_text().replace('maxmemory 512mb', 'maxmemory 4mb')
    (temp/'redis.conf').write_text(conf); (temp/'redis.conf').chmod(0o444)
    acl = subprocess.check_output(['python3',str(ROOT/'make-redis-acl.py')],input=password+'\n',text=True)
    (temp/'users.acl').write_text(acl); (temp/'users.acl').chmod(0o444)
    try:
        run(['pull',IMAGE])
        run(['run','-d','--name',name,'--label','io.youtopia.coexist-test='+token,
             '--user','999:999','--memory','1g','--memory-swap','1g','--cpus','0.5',
             '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true',
             '--publish','127.0.0.1::6379',
             '--mount',f'type=bind,src={temp}/redis.conf,dst=/usr/local/etc/redis/redis.conf,readonly',
             '--mount',f'type=bind,src={temp}/users.acl,dst=/usr/local/etc/redis/users.acl,readonly',
             # Anonymous volume owned solely by this test; removed after ownership validation.
             '--volume','/data',IMAGE,'redis-server','/usr/local/etc/redis/redis.conf'])
        created=True
        for _ in range(50):
            if cli('PING') == 'PONG': break
            time.sleep(.1)
        else: raise RuntimeError('Authenticated Redis startup failed')
        require('NOAUTH' in cli('PING',auth=False),'Anonymous access not rejected')
        require('NOPERM' in cli('SET','outside:scope','x'),'Key ACL not enforced')
        require('NOPERM' in cli('CONFIG','SET','maxmemory','0'),'App can change CONFIG')
        require('NOPERM' in cli('FLUSHALL'),'App can flush database')
        require(cli('SET','youtopia:persist','survives')=='OK','Write failed')
        require(cli('EVAL',"local n=redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],60);return n",'1','youtopia:budget')=='1','Lua budget failed')
        listener = subprocess.Popen(DOCKER+['exec','-e','REDISCLI_AUTH='+password,name,'redis-cli','--no-auth-warning','--user','youtopia','--raw','PSUBSCRIBE','__keyevent@0__:expired'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=env)
        try:
            time.sleep(.3)
            require(cli('SET','youtopia:expires','x','EX','1')=='OK','Expiry setup failed')
            time.sleep(1.4)
        finally:
            listener.terminate()
            try: output,_=listener.communicate(timeout=3)
            except subprocess.TimeoutExpired: listener.kill();output,_=listener.communicate()
        require('youtopia:expires' in output,'Session expiry notification missing: '+repr(output))
        time.sleep(1.1) # allow everysec AOF fsync for the committed marker
        run(['restart',name])
        for _ in range(50):
            if cli('PING')=='PONG': break
            time.sleep(.1)
        require(cli('GET','youtopia:persist')=='survives','AOF restart lost marker')
        if args.with_app:
            sys.path.insert(0,str(ROOT.parents[1]/'tools'))
            import test_services
            require(not test_services.STATE.exists(), 'Use a fresh owned test fixture environment')
            info=json.loads(run(['inspect',name]))[0]
            descriptor=temp/'app-redis.json'
            descriptor.write_text(json.dumps(dict(token=token,container=name,password=password,
                port=int(info['NetworkSettings']['Ports']['6379/tcp'][0]['HostPort']))))
            descriptor.chmod(0o600)
            try:
                test_services.start()
                subprocess.run([sys.executable,str(ROOT.parents[1]/'tools/verify_packaged_sessions.py'),
                    '--deployment-redis-state',str(descriptor)],env=env,check=True,timeout=180)
            finally:
                test_services.stop()
        payload='x'*131072
        oom=False
        for index in range(64):
            response=cli('-x','SET','youtopia:fill:'+str(index),data=payload)
            if 'OOM' in response: oom=True;break
        require(oom,'Expected noeviction OOM was not observed')
        require(cli('GET','youtopia:persist')=='survives','Noeviction discarded existing data')
        # A rejected large SET can leave room for a small INCR. Fill that remaining
        # room with scoped synthetic budget keys before expecting Lua itself to fail.
        budget_oom = False
        for index in range(128):
            response = cli('EVAL',"return redis.call('INCR',KEYS[1])",'1',
                           'youtopia:budget:'+str(index)+('b'*4096))
            if 'OOM' in response:
                budget_oom = True
                break
        require(budget_oom,'Budget write did not report OOM after remaining memory was filled')
        info=json.loads(run(['inspect',name]))[0]
        require(info['HostConfig']['PortBindings']['6379/tcp'][0]['HostIp']=='127.0.0.1','Nonloopback publication')
        print(json.dumps({'status':'PASS','image':IMAGE,'anonymous_denied':True,'acl_scope':True,'lua_budget':True,
              'expiry_notification':True,'aof_restart':True,'noeviction_oom':True,'production_server_accessed':False,
              'maxmemory_test_override':'4mb (deployment 512mb)','persistence_loss_window':'everysec; up to roughly 1s, not zero RPO'}))
    finally:
        if created:
            info=json.loads(run(['inspect',name]))[0]
            if info['Config']['Labels'].get('io.youtopia.coexist-test') != token: raise RuntimeError('Ownership mismatch; refusing cleanup')
            run(['rm','-f','-v',name])
