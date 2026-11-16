import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys

from .discovery import SteamHTTP, Staging, discover, hydrate, ProviderFailure
from .limits import Budget, Blocked
from .planner import plan
from .readiness import assess


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def emit(value, destination=None):
    text=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
    if destination:
        descriptor=os.open(destination,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(descriptor,'w') as handle:handle.write(text)
    else:print(text,end='')


def main(argv=None):
    p=argparse.ArgumentParser(description='Readiness, bounded candidate discovery, and dry-run cohort plans.')
    sub=p.add_subparsers(dest='command',required=True)
    for name in ['init-state','status']:
        q=sub.add_parser(name);q.add_argument('--policy',required=True);q.add_argument('--staging',required=name=='init-state')
        if name=='init-state':q.add_argument('--inventory',required=True)
    q=sub.add_parser('resolve-unknown');q.add_argument('--policy',required=True);q.add_argument('--request-id',required=True)
    q.add_argument('--confirm-no-running-worker',action='store_true')
    for name in ['discover','hydrate']:
        q=sub.add_parser(name);q.add_argument('--policy',required=True);q.add_argument('--staging',required=True)
        q.add_argument('--inventory',required=True);q.add_argument('--limit',type=int,required=True)
        if name=='hydrate':q.add_argument('--genre-mapping',required=True)
    q=sub.add_parser('assess');q.add_argument('--inventory',required=True);q.add_argument('--policy',required=True);q.add_argument('--output')
    q=sub.add_parser('plan');q.add_argument('--staging',required=True);q.add_argument('--as-of',required=True)
    q.add_argument('--release-days',type=int,required=True);q.add_argument('--maximum-games',type=int,required=True)
    q.add_argument('--interval-minutes',type=int,required=True);q.add_argument('--existing-app-ids',required=True);q.add_argument('--output',required=True)
    q=sub.add_parser('admit');q.add_argument('--staging',required=True);q.add_argument('--plan',required=True)
    q.add_argument('--policy',required=True);q.add_argument('--inventory',required=True);q.add_argument('--config',required=True)
    q.add_argument('--overrides',required=True);q.add_argument('--project-root',required=True);q.add_argument('--execute',action='store_true')
    q=sub.add_parser('rollback');q.add_argument('--staging',required=True);q.add_argument('--plan',required=True)
    q.add_argument('--config',required=True);q.add_argument('--overrides',required=True);q.add_argument('--project-root',required=True)
    q.add_argument('--execute',action='store_true')
    args=p.parse_args(argv)
    try:
        if args.command=='plan':
            emit(plan(Staging(args.staging).metadata_rows(),as_of=args.as_of,release_days=args.release_days,
                maximum_games=args.maximum_games,interval_minutes=args.interval_minutes,existing_app_ids=read(args.existing_app_ids)),args.output)
            return 0
        if args.command=='rollback':
            from .rollback import rollback
            emit(rollback(args));return 0
        policy=read(args.policy)
        if args.command=='init-state':
            from .readiness import initial_debit
            debit=initial_debit(read(args.inventory),policy)
            if Path(args.staging).exists() or Path(args.staging).is_symlink():raise Blocked('STAGING_ALREADY_EXISTS')
            Budget.initialize(policy['state_path'],state_id=policy['state_id'],initial_day_debit=debit)
            Staging.initialize(args.staging);emit({'status':'LOCAL_STATE_INITIALIZED_NO_PROVIDER_CALLS','production_database_writes':0});return 0
        if args.command=='status':emit(Budget(policy['state_path'],policy).status());return 0
        if args.command=='resolve-unknown':
            if not args.confirm_no_running_worker:raise Blocked('RUNNING_WORKER_CHECK_REQUIRED')
            Budget(policy['state_path'],policy).finish(args.request_id,'NETWORK_UNKNOWN',cooldown_seconds=300)
            emit({'status':'UNRESOLVED_REQUEST_CLOSED_WITHOUT_REFUND','request_id':args.request_id});return 0
        verdict=assess(read(args.inventory),policy)
        if args.command=='assess':emit(verdict,args.output);return 0 if verdict['status']=='READY_FOR_OPERATOR_REVIEW' else 2
        if verdict['status']!='READY_FOR_OPERATOR_REVIEW':emit(verdict);return 2
        if args.command=='admit':
            from .admission import admit
            emit(admit(args,policy));return 0
        if os.environ.get('YOUTOPIA_STEAM_GUARD_ENABLED')!='1':raise Blocked('GLOBAL_GUARD_NOT_ENABLED')
        from .runtime_guard import load_budget
        if load_budget().policy!=policy:raise Blocked('RUNTIME_AND_DISCOVERY_BUDGET_POLICY_MISMATCH')
        from youtopia_collector.common.config import _load_steam_keys
        # Reuse the first existing ordered credential; never shard or rotate
        # credentials to expand quota. No credential value is printed.
        key=_load_steam_keys(dict(os.environ),required=True)[0][1]
        client=SteamHTTP(key=key,budget=Budget(policy['state_path'],policy))
        stage=Staging(args.staging)
        result=discover(client,stage,maximum_pages=args.limit) if args.command=='discover' else hydrate(client,stage,maximum_apps=args.limit,mapping=read(args.genre_mapping))
        emit(result);return 0
    except (Blocked,ProviderFailure) as error:
        emit({'status':'BLOCKED','reason':str(error),'production_changes_performed_by_readiness_gate':0,
              'operation_state_may_have_changed':args.command in ('admit','rollback') and args.execute,
              'review_original_plan_and_ledger_before_retry':True});return 2
    except Exception as error:
        # Exception messages can contain paths, URLs or source response text.
        emit({'status':'FAILED','error_type':type(error).__name__,'details_omitted':True,
              'operation_state_may_have_changed':args.command in ('admit','rollback') and args.execute});return 1


if __name__=='__main__':raise SystemExit(main())
