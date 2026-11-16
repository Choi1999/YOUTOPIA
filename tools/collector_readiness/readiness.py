"""Produce explicit blockers; missing or failed observations are never zeros."""
from datetime import datetime, timezone
import hashlib
import json
import math
import re

from .limits import Blocked

BASE_IMAGE_DIGESTS = {
    'sha256:d43c2d8e749841c1b746d5841fbde7d4d9c4bde8204ba6d35c2a1ddfc622d594',
    'sha256:f5b8ed5bc49ffec9b07fb67ef8ea43f0c25832b95ef19a431ffa118d64d02ea4',
}


def initial_debit(inventory,policy,*,now=None):
    verdict=assess(inventory,policy,now=now)
    # Initial state setup precedes wiring every cron process. This specific gate
    # may be pending here; all evidence and budget gates must already pass.
    remaining=[x for x in verdict['blockers'] if x!='SHARED_GUARD_WIRING_NOT_VERIFIED']
    if remaining or verdict['existing_steam_attempts_24h'] is None:
        raise Blocked('INITIAL_DAY_DEBIT_REQUIRES_FRESH_VERIFIED_INVENTORY')
    return verdict['existing_steam_attempts_24h']


def assess(inventory, policy, *, now=None):
    now=now or datetime.now(timezone.utc)
    blockers=[]
    try:
        observed=datetime.fromisoformat(inventory['as_of_utc'])
        if observed.tzinfo is None or not 0<=(now-observed).total_seconds()<=21600:
            blockers.append('INVENTORY_NOT_FRESH')
    except (KeyError,ValueError,TypeError):blockers.append('INVENTORY_TIME_UNKNOWN')
    if inventory.get('kind')!='COLLECTOR_READINESS_INVENTORY_V1':blockers.append('INVENTORY_FORMAT_UNKNOWN')
    if not policy.get('expected_host') or inventory.get('host')!=policy['expected_host']:blockers.append('HOST_NOT_CONFIRMED')
    wrapper=inventory.get('wrapper',{})
    if not policy.get('reviewed_wrapper_sha256') or wrapper.get('sha256')!=policy['reviewed_wrapper_sha256']:
        blockers.append('WRAPPER_EXECUTION_PATH_NOT_REVIEWED')
    image=inventory.get('image',{})
    values=[]
    if image.get('status')=='OK':
        data=image.get('data',{})
        values=[data.get('id','')]+(data.get('repo_digests') or [])
    allowed=set(BASE_IMAGE_DIGESTS)
    overlay=policy.get('reviewed_overlay_image_id')
    if isinstance(overlay,str) and re.fullmatch(r'sha256:[0-9a-f]{64}',overlay):allowed.add(overlay)
    if not any(any(value.endswith(digest) for digest in allowed) for value in values):
        blockers.append('OPERATING_BASE_IMAGE_NOT_CONFIRMED')
    db=inventory.get('database',{})
    identity=db.get('identity',{})
    if identity.get('status')!='OK' or identity.get('data',{}).get('read_only')!='on':blockers.append('READ_ONLY_DB_IDENTITY_UNCONFIRMED')
    if not policy.get('expected_database') or identity.get('data',{}).get('database')!=policy['expected_database']:
        blockers.append('DATABASE_TARGET_NOT_CONFIRMED')
    for name in ['target_counts','recent_jobs','attempts_24h']:
        if db.get(name,{}).get('status')!='OK':blockers.append('DB_QUERY_UNAVAILABLE:'+name)
    configs=[x for x in inventory.get('configs',[]) if x.get('status')=='OK' and x.get('path')==policy.get('reviewed_ccu_config_path')]
    settings=configs[0]['settings'] if len(configs)==1 else {}
    if len(configs)==1 and configs[0].get('source')=='PINNED_IMAGE_DEFAULT':
        if not policy.get('image_config_wiring_reviewed'):
            blockers.append('IMAGE_PROFILE_EFFECTIVE_WIRING_NOT_REVIEWED')
        if configs[0].get('source_image_id')!=image.get('data',{}).get('id'):
            blockers.append('IMAGE_PROFILE_IDENTITY_MISMATCH')
    actual_interval=settings.get('steam.ccu.slot_minutes')
    if isinstance(actual_interval,bool) or not isinstance(actual_interval,int) or actual_interval<1:
        blockers.append('OPERATING_CCU_INTERVAL_UNKNOWN')
    if actual_interval!=policy.get('interval_minutes'):blockers.append('LEGACY_CCU_INTERVAL_WOULD_CHANGE')
    if settings.get('steam.ccu.enabled') is not True:blockers.append('EXISTING_CCU_JOB_NOT_ENABLED')
    if not policy.get('all_steam_jobs_share_guard_state'):blockers.append('SHARED_GUARD_WIRING_NOT_VERIFIED')
    if not policy.get('other_api_consumers_accounted_for'):blockers.append('OTHER_CONSUMERS_UNKNOWN')
    jobs=db.get('recent_jobs',{}).get('data',[])
    reviewed_jobs=policy.get('reviewed_success_job_types')
    successful=False
    if isinstance(reviewed_jobs,list) and reviewed_jobs and isinstance(jobs,list):
        for job in jobs:
            if job.get('status')!='SUCCESS' or job.get('job_type') not in reviewed_jobs:continue
            try:
                finished=datetime.fromisoformat(job['finished_at'])
                interval=policy.get('interval_minutes')
                freshness=min(86400,max(1800,2*interval*60)) if isinstance(interval,int) and not isinstance(interval,bool) and interval>0 else 0
                if finished.tzinfo is not None and 0<=(now-finished).total_seconds()<=freshness:successful=True
            except (KeyError,ValueError,TypeError):pass
    if not successful:
        blockers.append('RECENT_COLLECTION_SUCCESS_NOT_CONFIRMED')
    attempts=db.get('attempts_24h',{}).get('data')
    existing_calls=None
    if isinstance(attempts,list):
        steam=[x for x in attempts if x.get('source_type')=='STEAM']
        if all(isinstance(x.get('actual_attempts'),int) and not isinstance(x['actual_attempts'],bool) for x in steam):
            existing_calls=sum(x['actual_attempts'] for x in steam)
        if any(x.get('http_status') in [403,429] for x in steam):blockers.append('RECENT_PROVIDER_RESTRICTION_REQUIRES_REVIEW')
    if existing_calls is None:blockers.append('CURRENT_CALL_VOLUME_UNKNOWN')
    maximum=policy.get('maximum_games');interval=policy.get('interval_minutes');cap=policy.get('rolling_day_limit');reserve=policy.get('failure_and_other_work_reserve')
    new_cap=policy.get('new_rolling_day_limit')
    if isinstance(new_cap,bool) or not isinstance(new_cap,int) or new_cap<1 or not isinstance(reserve,int) or reserve<new_cap:
        blockers.append('DISCOVERY_AND_METADATA_RESERVE_NOT_ACCOUNTED_FOR')
    demand=None
    if all(isinstance(x,int) and not isinstance(x,bool) and x>0 for x in [maximum,interval,cap,reserve]):
        retry_max=settings.get('retry.max_attempts')
        if not isinstance(retry_max,int) or isinstance(retry_max,bool) or retry_max<1:
            blockers.append('OPERATING_RETRY_BOUND_UNKNOWN')
        elif existing_calls is not None:
            demand=maximum*math.ceil(1440/interval)*retry_max
            # During the first day, reserve room both for the prior-day debit and
            # a full future legacy day. Deliberately overcounts, never undercounts.
            if 2*existing_calls+demand+reserve>cap:blockers.append('INSUFFICIENT_REVIEWED_CALL_HEADROOM')
            active=db.get('target_counts',{}).get('data',{}).get('active')
            per_run=settings.get('steam.ccu.maximum_games_per_run')
            if isinstance(active,bool) or not isinstance(active,int) or active<0:
                blockers.append('CURRENT_ACTIVE_TARGET_COUNT_UNKNOWN')
            elif per_run is not None and (isinstance(per_run,bool) or not isinstance(per_run,int) or per_run<active+maximum):
                blockers.append('BOUNDED_CCU_JOB_WOULD_STARVE_TARGETS')
            pacing=policy.get('minimum_interval_seconds');minute=policy.get('minute_limit')
            if isinstance(pacing,bool) or not isinstance(pacing,(float,int)) or not math.isfinite(pacing) or not 0<pacing<=10 or isinstance(minute,bool) or not isinstance(minute,int) or minute<1:
                blockers.append('GLOBAL_GUARD_PACING_NOT_VALID')
            elif isinstance(active,int) and not isinstance(active,bool) and max((active+maximum)*retry_max*pacing,(active+maximum)*retry_max/minute*60)>=interval*60:
                blockers.append('CCU_WORST_CASE_RUN_DOES_NOT_FIT_SLOT')
    else:blockers.append('CALL_BUDGET_OR_COHORT_CAP_NOT_SET')
    return {'status':'READY_FOR_OPERATOR_REVIEW' if not blockers else 'BLOCKED',
            'as_of_utc':now.isoformat(),'blockers':blockers,'existing_steam_attempts_24h':existing_calls,
            'additional_ccu_worst_case_attempts_24h':demand,
            'conservative_preinstall_day_debit':existing_calls,
            'inventory_sha256':hashlib.sha256(json.dumps(inventory,sort_keys=True).encode()).hexdigest(),
            'policy_sha256':hashlib.sha256(json.dumps(policy,sort_keys=True).encode()).hexdigest(),
            'automatic_production_changes':0,'limit':'This is an internal budget review, not proof of provider-approved quota or uninterrupted collection.'}
