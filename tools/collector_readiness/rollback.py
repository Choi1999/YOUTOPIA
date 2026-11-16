"""Scoped source rollback; observations and the global budget are never reset.

Operator must hold the existing collector lock and wait for running work first.
Default is a read-only preview. No provider request is made by this module.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from .discovery import Staging,cohort_lock
from .limits import Blocked


def rollback_in_transaction(repository, connection, decisions, *, now, execute):
    result={'status':'ROLLBACK_APPLIED' if execute else 'ROLLBACK_REVIEW_ONLY',
            'executed':execute,'deactivated_signal_scopes':[], 'stopped_ccu_app_ids':[],
            'preserved_ccu_app_ids':[], 'cancelled_pending_task_ids':[],
            'observations_deleted':0,'youtube_changes':0,'budget_changes':0}
    for decision,app_id,reference in sorted(decisions,key=lambda row:row[1]):
        scope='NEW_RELEASE:'+decision
        own=connection.execute(f'SELECT 1 FROM {repository._c("steam_tracking_signal")} WHERE app_id=%s AND signal_source=%s AND scope_key=%s AND last_source_reference=%s',
                               (app_id,'NEW_RELEASE',scope,reference)).fetchone()
        if not own:
            continue
        legacy=repository._active_promotion_signal(connection,app_id=app_id,now=now)
        other_new=connection.execute(f'SELECT 1 FROM {repository._c("steam_tracking_signal")} WHERE app_id=%s AND signal_source=%s AND scope_key<>%s AND deactivated_at IS NULL AND expires_at>%s',
                                    (app_id,'NEW_RELEASE',scope,now)).fetchone()
        target=connection.execute(f'SELECT selection_reason,selection_source_reference FROM {repository._c("steam_ccu_target")} WHERE app_id=%s',(app_id,)).fetchone()
        stop=not legacy and not other_new and target is not None and target[0]=='SIGNAL_NEW_RELEASE' and str(target[1]).strip()==reference
        if stop and connection.execute(f'SELECT 1 FROM {repository._c("collection_task")} WHERE task_type=%s AND app_id=%s AND status IN (%s,%s) LIMIT 1',
                                       ('STEAM_CCU',app_id,'CLAIMED','RUNNING')).fetchone():
            raise Blocked('COHORT_HAS_CLAIMED_OR_RUNNING_TASK_WAIT_FOR_EXISTING_LOCK')
        result['deactivated_signal_scopes'].append(scope)
        result['stopped_ccu_app_ids' if stop else 'preserved_ccu_app_ids'].append(app_id)
        if not execute:
            continue
        connection.execute(f'UPDATE {repository._c("steam_tracking_signal")} SET deactivated_at=coalesce(deactivated_at,%s),updated_at=CURRENT_TIMESTAMP WHERE app_id=%s AND signal_source=%s AND scope_key=%s',
                           (now,app_id,'NEW_RELEASE',scope))
        if stop:
            repository._retire_target_immediately(connection,table='steam_ccu_target',app_id=app_id,now=now,clear_next_due=True)
            tasks=connection.execute(f'UPDATE {repository._c("collection_task")} SET status=%s,completed_at=%s WHERE task_type=%s AND app_id=%s AND status=%s RETURNING task_id',
                                     ('CANCELLED',now,'STEAM_CCU',app_id,'PENDING')).fetchall()
            for (task_id,) in tasks:
                repository._insert_outcome(connection,job_run_id=None,task_id=task_id,api_call_id=None,
                    final_attempt_id=None,entity_type='STEAM_APP',app_id=app_id,query_id=None,video_id=None,
                    source_type='LOCAL',collection_type='ccu',stage='NEW_RELEASE_ROLLBACK',
                    outcome_code='NEW_RELEASE_COHORT_STOPPED',message='Explicit operator rollback of this new-release cohort only.',
                    run_reference=reference)
                result['cancelled_pending_task_ids'].append(task_id)
    return result


def rollback(args):
    with cohort_lock(args.staging):
        return _rollback(args)


def _rollback(args):
    raw_plan=Path(args.plan).read_bytes()
    document=json.loads(raw_plan)
    if document.get('status')!='PLAN_ONLY_NOT_ADMITTED':
        raise Blocked('ORIGINAL_COHORT_PLAN_REQUIRED')
    plan_hash=hashlib.sha256(raw_plan).hexdigest()
    stage=Staging(args.staging)
    with stage.connect() as c:
        decisions=c.execute('SELECT decision_id,app_id,metadata_run_reference FROM admission WHERE plan_sha256=?',(plan_hash,)).fetchall()
    if not decisions:
        raise Blocked('NO_ADMISSION_DECISIONS_FOR_EXACT_PLAN')
    from youtopia_collector.common.config import load_settings
    from youtopia_collector.jobs.context import JobContext
    from youtopia_collector import __version__
    settings=load_settings(project_root=Path(args.project_root),config_path=Path(args.config),
        overrides_path=Path(args.overrides),collector_version=__version__,command='steam-ccu')
    context=JobContext.build(settings,command='steam-ccu')
    try:
        context.preflight.run(expected_version=settings.database.expected_schema_version,
            warning_clock_skew=settings.database.warning_clock_skew_seconds,
            maximum_clock_skew=settings.database.maximum_clock_skew_seconds)
        now=datetime.now(timezone.utc)
        with context.database.transaction() as connection:
            if not args.execute:connection.execute('SET TRANSACTION READ ONLY')
            result=rollback_in_transaction(context.repository,connection,decisions,now=now,execute=args.execute)
        if args.execute:
            with stage.connect() as c:
                for decision,_,_ in decisions:
                    c.execute('INSERT INTO admission_event(decision_id,event_type,at) VALUES(?,?,?)',
                              (decision,'ROLLBACK',now.isoformat()))
        return result
    finally:context.close()
