"""Guard every Steam transmission in the pinned collector overlay.

The source patch is applied at image build with exact input hashes. It is not a
runtime monkey patch. Non-Steam requests retain their original transport.
"""
import json
import os
from pathlib import Path
import time
import urllib.parse
import uuid

from .discovery import retry_after
from .limits import Budget, Blocked

STEAM_HOSTS = {'api.steampowered.com', 'store.steampowered.com', 'partner.steam-api.com'}


def load_budget():
    path = os.environ.get('YOUTOPIA_STEAM_GUARD_POLICY')
    if not path or not Path(path).is_absolute():
        raise Blocked('GLOBAL_STEAM_POLICY_MISSING')
    try:
        p = Path(path)
        if p.is_symlink() or not p.is_file() or p.stat().st_size > 32768:
            raise Blocked('GLOBAL_STEAM_POLICY_UNSAFE')
        policy = json.loads(p.read_text(encoding='utf-8-sig'))
        if not isinstance(policy.get('state_path'), str) or not Path(policy['state_path']).is_absolute():
            raise Blocked('GLOBAL_STATE_PATH_REQUIRED')
        return Budget(policy['state_path'], policy)
    except (OSError, ValueError, TypeError, KeyError):
        raise Blocked('GLOBAL_STEAM_POLICY_UNAVAILABLE') from None


def guarded_legacy_get(send, endpoint, *, params=None, headers=None, timeout=None):
    host = urllib.parse.urlsplit(endpoint).hostname
    if host in STEAM_HOSTS and os.environ.get('YOUTOPIA_NEW_RELEASES_ENABLED')=='1' and os.environ.get('YOUTOPIA_STEAM_GUARD_ENABLED')!='1':
        raise Blocked('NEW_RELEASES_REQUIRE_GLOBAL_GUARD')
    if host not in STEAM_HOSTS or os.environ.get('YOUTOPIA_STEAM_GUARD_ENABLED') != '1':
        return send(endpoint, params=params, headers=headers, timeout=timeout)
    budget = load_budget()
    status = budget.status()
    now = time.time()
    if status['blocked_until'] > now:
        raise Blocked('PROVIDER_COOLDOWN')
    delay = max(0, status['last_clock'] + budget.policy['minimum_interval_seconds'] - now)
    if delay > 10:
        raise Blocked('PACING_DELAY_EXCEEDS_JOB_BOUND')
    if delay:
        time.sleep(delay)
    request_id = uuid.uuid4().hex
    operation = 'LEGACY:' + urllib.parse.urlsplit(endpoint).path.split('/')[1]
    budget.reserve(request_id, operation)
    try:
        response = send(endpoint, params=params, headers=headers, timeout=timeout, allow_redirects=False)
    except Exception:
        budget.finish(request_id, 'NETWORK_UNKNOWN', cooldown_seconds=300)
        raise
    status = int(response.status_code)
    delay = max(60,retry_after(response.headers.get('Retry-After'), time.time())) if status == 429 else 0
    # 401 retains the baseline's bounded authentication fallback under this same
    # budget. Ambiguous 403 must not be bypassed by switching credentials.
    if status == 403 or status >= 500 or 300 <= status < 400:
        delay = max(delay,300)
    budget.finish(request_id, 'SUCCESS' if 200 <= status < 300 else 'HTTP_ERROR', cooldown_seconds=delay)
    return response
