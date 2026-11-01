#!/usr/bin/env python3
"""Offline public IPv4 ingress proposal. Does not install, issue or reload anything."""
import argparse
import ipaddress
from pathlib import Path

def render(address,output):
    ip=ipaddress.ip_address(address)
    if ip.version!=4 or not ip.is_global:raise ValueError('Reviewed public IPv4 required')
    output.mkdir(mode=0o700)  # A new review directory only.
    source=Path(__file__).resolve().parent
    for template,name in [('nginx-acme.conf.template','01-challenge-only.conf'),('nginx.conf.template','02-https-after-acceptance.conf')]:
        text=(source/template).read_text().replace('__DOMAIN__',str(ip))
        text=text.replace('__CERTIFICATE_PATH__','/etc/letsencrypt/live/youtopia-ip/fullchain.pem')
        text=text.replace('__PRIVATE_KEY_PATH__','/etc/letsencrypt/live/youtopia-ip/privkey.pem')
        # Browsers may omit TLS SNI for IP literals. Review existing default hosts first.
        text=text.replace('listen 443 ssl;','listen 443 ssl default_server;')
        (output/name).write_text(text)
    (output/'public-ip').write_text(str(ip)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('address');parser.add_argument('output',type=Path)
    args=parser.parse_args();render(args.address,args.output)
    print('REVIEW_FILES_ONLY; nginx/default-host, public port reachability and renewal acceptance still required')
