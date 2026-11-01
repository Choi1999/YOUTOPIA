#!/usr/bin/env python3
"""Exact deployment maxmemory/resource limits; synthetic loopback-only AOF rewrite probe.
The separate OOM/session verifier exercises a 4MiB override. Never use on a server.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import time
import uuid
from redis_contract import deployment_image, image_version

ROOT=Path(__file__).resolve().parent
IMAGE=deployment_image()
TOKEN=uuid.uuid4().hex
NAME='youtopia-security-memory-'+TOKEN[:12]
DOCKER=['docker','--host=unix:///var/run/docker.sock']
ENV={k:v for k,v in os.environ.items() if not (k.startswith(('DB_','PG','YOUTOPIA_','DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_CERT_PATH'))
    or re.search('PASSWORD|PASSPHRASE|TOKEN|SECRET|PRIVATE_KEY|HMAC_KEY|API_KEY|ACCESS_KEY|CREDENTIAL',k,re.I))}
password=secrets.token_hex(32)
observer_password=secrets.token_hex(32)
created=False

def run(args,timeout=45):
    result=subprocess.run(DOCKER+args,env=ENV,capture_output=True,text=True,timeout=timeout)
    if result.returncode:raise RuntimeError('Owned synthetic Redis operation failed; details suppressed')
    return result.stdout.strip()

def owned():
    info=json.loads(run(['inspect',NAME]))[0]
    assert info['Config']['Labels'].get('io.youtopia.security-memory')==TOKEN
    return info

def packet(args):
    args=[x if isinstance(x,bytes) else str(x).encode() for x in args]
    return b'*'+str(len(args)).encode()+b'\r\n'+b''.join(b'$'+str(len(x)).encode()+b'\r\n'+x+b'\r\n' for x in args)

class Redis:
    def __init__(self,port,observer=False):
        self.socket=socket.create_connection(('127.0.0.1',port),timeout=10)
        self.file=self.socket.makefile('rb')
        assert self.command('AUTH','youtopia_observer' if observer else 'youtopia',observer_password if observer else password)==b'OK'
    def read(self):
        line=self.file.readline();kind=line[:1];value=line[1:-2]
        if kind==b'-':raise RuntimeError('Synthetic Redis rejected a command; response suppressed')
        if kind==b'+':return value
        if kind==b':':return int(value)
        if kind==b'$':
            length=int(value)
            if length<0:return None
            data=self.file.read(length);assert self.file.read(2)==b'\r\n';return data
        raise RuntimeError('Unexpected synthetic RESP reply')
    def command(self,*args):self.socket.sendall(packet(args));return self.read()
    def info(self,section):
        data=self.command('INFO',section).decode()
        return dict(line.split(':',1) for line in data.splitlines() if line and not line.startswith('#') and ':' in line)
    def close(self):self.file.close();self.socket.close()

try:
    with tempfile.TemporaryDirectory(prefix='youtopia-security-memory-') as temp:
        temp=Path(temp);temp.chmod(0o755)
        conf=(ROOT/'redis.conf').read_bytes()
        assert b'maxmemory 512mb' in conf and b'auto-aof-rewrite-min-size 64mb' in conf
        (temp/'redis.conf').write_bytes(conf);(temp/'redis.conf').chmod(0o444)
        # Generate the unchanged application ACL using only a synthetic password.
        acl=subprocess.check_output(['python3',str(ROOT/'make-redis-acl.py')],input=password+'\n',text=True,env=ENV)
        (temp/'users.acl').write_text(acl)
        # Fixture-only read observer; the application's production ACL remains unchanged.
        with (temp/'users.acl').open('a') as file:
            file.write('user youtopia_observer on #'+hashlib.sha256(observer_password.encode()).hexdigest()+' -@all +info\n')
        (temp/'users.acl').chmod(0o444)
        run(['run','-d','--pull=never','--name',NAME,'--label','io.youtopia.security-memory='+TOKEN,
            '--user','999:999','--cpus','0.5','--memory','1g','--memory-swap','1g','--pids-limit','128',
            '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--publish','127.0.0.1::6379',
            '--mount',f'type=bind,src={temp}/redis.conf,dst=/usr/local/etc/redis/redis.conf,readonly',
            '--mount',f'type=bind,src={temp}/users.acl,dst=/usr/local/etc/redis/users.acl,readonly',
            '--volume','/data',IMAGE,'redis-server','/usr/local/etc/redis/redis.conf'])
        created=True
        info=owned();port=int(info['NetworkSettings']['Ports']['6379/tcp'][0]['HostPort'])
        client=None
        for attempt in range(50):
            try:client=Redis(port);break
            except OSError:time.sleep(.1)
        assert client
        observer=Redis(port,observer=True)
        assert observer.info('server')['redis_version']==image_version(IMAGE)
        before=observer.info('memory')
        assert int(before['maxmemory'])==536870912 and before['maxmemory_policy']=='noeviction'
        assert client.command('SET','youtopia:memory-sentinel','synthetic-persistent-marker')==b'OK'
        samples=[]
        payload=b'x'*131072
        # 96MiB application data triggers the unchanged automatic AOF rewrite threshold.
        for start in range(0,768,16):
            client.socket.sendall(b''.join(packet(('SET','youtopia:memory:'+str(i),payload)) for i in range(start,start+16)))
            for _ in range(16):assert client.read()==b'OK'
            memory=observer.info('memory');persistence=observer.info('persistence')
            samples.append({'used_memory':int(memory['used_memory']),'used_memory_rss':int(memory['used_memory_rss']),
                'aof_rewrites':int(persistence.get('aof_rewrites','0')),'aof_rewrite_in_progress':int(persistence['aof_rewrite_in_progress'])})
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            persistence=observer.info('persistence')
            if int(persistence.get('aof_rewrites','0'))>=1 and persistence['aof_rewrite_in_progress']=='0':break
            time.sleep(.25)
        assert int(persistence.get('aof_rewrites','0'))>=1 and persistence['aof_rewrite_in_progress']=='0'
        assert persistence['aof_last_bgrewrite_status']=='ok'
        settled=observer.info('memory')
        samples.append({'used_memory_rss':int(settled['used_memory_rss'])})
        assert observer.info('stats')['evicted_keys']=='0'
        peak=max(x['used_memory_rss'] for x in samples)
        assert peak<1073741824 and not owned()['State']['OOMKilled']
        time.sleep(1.2)
        client.close()
        observer.close()
        run(['restart',owned()['Id']])
        # Docker can reassign a randomly published test port across restart.
        port=int(owned()['NetworkSettings']['Ports']['6379/tcp'][0]['HostPort'])
        client=None
        for _ in range(50):
            candidate=None
            try:
                candidate=Redis(port)
                assert candidate.command('PING')==b'PONG'
                client=candidate
                break
            except (OSError,RuntimeError):
                if candidate:candidate.close()
                time.sleep(.1)
        assert client, 'Owned Redis did not become ready after restart'
        assert client.command('GET','youtopia:memory-sentinel')==b'synthetic-persistent-marker'
        assert client.command('GET','youtopia:memory:767')==payload
        final=owned();limits=final['HostConfig']
        assert limits['Memory']==limits['MemorySwap']==1073741824 and limits['NanoCpus']==500000000 and limits['PidsLimit']==128
        assert not final['State']['OOMKilled'] and final['NetworkSettings']['Ports']['6379/tcp'][0]['HostIp']=='127.0.0.1'
        client.close()
        print(json.dumps({'status':'PASS','image':IMAGE,'maxmemory_bytes':536870912,'container_memory_bytes':1073741824,
            'container_swap_extra_bytes':0,'cpu_limit':0.5,'pids_limit':128,'synthetic_payload_bytes':768*len(payload),
            'peak_sampled_redis_rss_bytes':peak,'aof_rewrites':int(persistence['aof_rewrites']),
            'aof_last_cow_size':int(persistence.get('aof_last_cow_size','0')),'aof_last_bgrewrite_status':'ok',
            'aof_restart_preserved_representative_data':True,'evicted_keys':0,'container_oom_killed':False,
            'production_server_accessed':False,'capacity_guarantee':False,
            'metrics_observer':'fixture-only separate +INFO user; production application ACL unchanged',
            'scope':'Synthetic96MiB and automatic AOF rewrite at exact512MiB/1GiB limits; not production concurrent-collector load'}))
finally:
    if created:
        identity=owned()['Id']
        run(['rm','-f','-v',identity])
