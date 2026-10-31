#!/usr/bin/env python3
"""Read-only HTTP CONNECT transport probe. No SSH authentication/remote commands.
An empty policy array or HTTP error alone is not a diagnosis of its cause.
"""
import ipaddress
import json
import os
import re
import socket
import sys
import time

def probe(host, connector=socket.create_connection):
    address=ipaddress.IPv4Address(host)
    if address not in ipaddress.IPv4Network('100.64.0.0/10'):
        raise ValueError('Approved Tailscale IPv4 required')
    deadline=time.monotonic()+10
    try:
        with connector(('proxy',8088),timeout=10) as connection:
            connection.sendall(f'CONNECT {address}:22 HTTP/1.1\r\nHost: {address}:22\r\n\r\n'.encode('ascii'))
            response=b''
            while b'\r\n\r\n' not in response:
                remaining=deadline-time.monotonic()
                if remaining<=0: raise TimeoutError()
                connection.settimeout(remaining)
                chunk=connection.recv(min(1024,8192-len(response)))
                if not chunk or len(response)+len(chunk)>=8192:
                    return {'stage':'proxy_response','result':'incomplete_or_oversized_headers','ssh_authenticated':False}
                response+=chunk
            match=re.fullmatch(rb'HTTP/1\.[01] ([0-9]{3})(?: [^\r\n]*)?',response.split(b'\r\n',1)[0])
            if not match:
                return {'stage':'proxy_response','result':'invalid_status_line','ssh_authenticated':False}
            status=int(match[1])
            return {'stage':'connect','http_status':status,
                    'result':'tcp_tunnel_established' if status==200 else 'proxy_http_failure_cause_unconfirmed',
                    'ssh_authenticated':False}
    except (OSError,TimeoutError) as error:
        # No raw proxy bodies, environment values or credential material in output.
        return {'stage':'proxy_transport','result':'transport_error','error_type':type(error).__name__,
                'ssh_authenticated':False}

if __name__=='__main__':
    try:
        result=probe(os.environ['YOUTOPIA_SSH_HOST'])
    except (KeyError,ValueError):
        raise SystemExit('Set YOUTOPIA_SSH_HOST to the approved Tailscale IPv4; value not printed')
    print(json.dumps(result))
    raise SystemExit(0 if result.get('http_status')==200 else 1)
