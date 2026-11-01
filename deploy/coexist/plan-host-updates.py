#!/usr/bin/env python3
"""Read cached package candidates and simulate a narrow update. Never updates APT or installs."""
import json
from pathlib import Path
import re
import subprocess

PACKAGES=('openjdk-21-jre-headless','nginx','nginx-common')
def parse_policy(text):
    installed=re.search(r'^\s*Installed:\s*(\S+)',text,re.M)
    candidate=re.search(r'^\s*Candidate:\s*(\S+)',text,re.M)
    if not installed or not candidate or '(none)' in (installed[1],candidate[1]):raise ValueError('Existing package and candidate required')
    return {'installed':installed[1],'candidate':candidate[1]}

def transaction_changes(text):
    changed=re.findall(r'^(Inst|Remv)\s+(\S+)',text,re.M)
    protected=re.compile(r'^(docker|containerd|runc|postgresql|libpq|tailscale|youtopia|collector)',re.I)
    if any(action=='Remv' or protected.search(name) for action,name in changed):
        raise ValueError('Simulation includes removal or protected infrastructure; do not execute')
    return [name for action,name in changed]

def main():
    env={'LC_ALL':'C','PATH':'/usr/sbin:/usr/bin:/sbin:/bin'}
    def run(command):return subprocess.check_output(command,text=True,stderr=subprocess.STDOUT,env=env)
    packages={name:parse_policy(run(['apt-cache','policy',name])) for name in PACKAGES}
    targets=[name+'='+value['candidate'] for name,value in packages.items() if value['installed']!=value['candidate']]
    command=['apt-get','--simulate','--no-remove','--only-upgrade','install',*targets]
    simulation=run(command) if targets else 'No target package version change in the current cache.'
    changes=transaction_changes(simulation)
    cache=[{'file':p.name,'mtime_epoch':int(p.stat().st_mtime)} for p in Path('/var/lib/apt/lists').glob('*InRelease')]
    print(json.dumps({'packages':packages,'apt_cache_files':cache,'cache_refreshed_by_this_tool':False,
        'simulation_command':command if targets else None,'simulation':simulation,'proposed_changed_packages':changes,
        'execution_command_after_separate_review':[x for x in command if x!='--simulate'] if targets else None,
        'approval_granted':False,'operating_upgrade_performed':False},indent=2))

if __name__=='__main__':main()
