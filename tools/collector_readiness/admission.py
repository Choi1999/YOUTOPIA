"""Explicit, scoped admission using existing metadata and tracking contracts.

No schema creation, grants, service restart, historical CCU replay, or YouTube
query creation. Run under the existing operator collector lock after review.
"""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path

from .discovery import Staging,cohort_lock
from .limits import Blocked
from .planner import plan as validate_plan, utc
from .runtime_guard import load_budget


def admit(args, policy):
    with cohort_lock(args.staging):
        return _admit(args,policy)


def _admit(args, policy):
    if os.environ.get('YOUTOPIA_STEAM_GUARD_ENABLED')!='1' or os.environ.get('YOUTOPIA_NEW_RELEASES_ENABLED')!='1':
        raise Blocked('NEW_RELEASE_RUNTIME_NOT_ENABLED')
    runtime_budget=load_budget()
    if runtime_budget.policy!=policy:raise Blocked('RUNTIME_AND_ADMISSION_BUDGET_POLICY_MISMATCH')
    runtime_budget.status()
    raw_plan=Path(args.plan).read_bytes();document=json.loads(raw_plan)
    now=datetime.now(timezone.utc)
    as_of=utc(document.get('as_of'))
    if not 0<=(now-as_of).total_seconds()<=21600:raise Blocked('COHORT_PLAN_NOT_FRESH')
    selected=document.get('selected')
    if document.get('status')!='PLAN_ONLY_NOT_ADMITTED' or not isinstance(selected,list) or not selected:
        raise Blocked('VALID_COHORT_PLAN_REQUIRED')
    if len(selected)>policy['maximum_games'] or document.get('interval_minutes')!=policy['interval_minutes']:
        raise Blocked('COHORT_POLICY_MISMATCH')
    protect=policy.get('initial_observation_days')
    if isinstance(protect,bool) or not isinstance(protect,int) or not 1<=protect<=90:
        raise Blocked('PROTECTION_WINDOW_NOT_REVIEWED')
    stage=Staging(args.staging)
    checked=[]
    with stage.connect() as connection:
        for row in selected:
            reference=row.get('evidence_run_reference')
            record=connection.execute('SELECT app_id,received_at,body,sha256,projection FROM metadata_run WHERE run_reference=?',(reference,)).fetchone()
            if not record or record[0]!=row.get('app_id') or hashlib.sha256(record[2]).hexdigest()!=record[3]:
                raise Blocked('METADATA_ARTIFACT_NOT_VERIFIED')
            original=json.loads(record[4])
            expected={k:v for k,v in row.items() if k not in {'allocation_genre','selection_reason'}}
            if original!=expected:raise Blocked('PLAN_METADATA_MISMATCH')
            verify=validate_plan([original],as_of=document['as_of'],release_days=document['release_days'],
                                 maximum_games=1,interval_minutes=document['interval_minutes'])
            if not verify['selected']:raise Blocked('COHORT_ELIGIBILITY_NOT_VERIFIED')
            checked.append((row,record))
    if len({x[0]['app_id'] for x in checked})!=len(checked):raise Blocked('DUPLICATE_COHORT_APP_ID')
    from youtopia_collector.common.config import load_settings
    from youtopia_collector.jobs.context import JobContext
    from youtopia_collector import __version__
    settings=load_settings(project_root=Path(args.project_root),config_path=Path(args.config),
        overrides_path=Path(args.overrides),collector_version=__version__,command='steam-ccu')
    if settings.database.name!=policy.get('expected_database'):
        raise Blocked('ADMISSION_DATABASE_TARGET_MISMATCH')
    if settings.steam_ccu.slot_minutes!=policy['interval_minutes']:
        raise Blocked('BASE_CCU_INTERVAL_MISMATCH')
    context=JobContext.build(settings,command='steam-ccu')
    try:
        context.preflight.run(expected_version=settings.database.expected_schema_version,
            warning_clock_skew=settings.database.warning_clock_skew_seconds,
            maximum_clock_skew=settings.database.maximum_clock_skew_seconds)
        repository=context.repository
        ids=[x[0]['app_id'] for x in checked]
        # Historical targets are excluded too: this operation does not reactivate
        # old inactive targets or give an existing YouTube target a new source.
        with context.database.transaction() as connection:
            connection.execute('SET TRANSACTION READ ONLY')
            current_new=connection.execute(f'SELECT count(*) FROM {repository._c("steam_ccu_target")} WHERE active IS TRUE AND selection_reason=%s',('SIGNAL_NEW_RELEASE',)).fetchone()[0]
            registered={x[0] for x in connection.execute(
                f'SELECT app_id FROM {repository._c("steam_ccu_target")} WHERE app_id=ANY(%s) UNION '
                f'SELECT app_id FROM {repository._c("youtube_game_target")} WHERE app_id=ANY(%s)',(ids,ids))}
        applicable=[x for x in checked if x[0]['app_id'] not in registered]
        if current_new+len(applicable)>policy['maximum_games']:
            raise Blocked('GLOBAL_NEW_COHORT_CAP_REACHED_INCLUDING_COOLDOWN')
        result={'status':'ADMISSION_REVIEW_ONLY','selected_app_ids':ids,
                'applicable_app_ids':[x[0]['app_id'] for x in applicable],
                'skipped_previously_registered_app_ids':sorted(registered),'executed':False,
                'currently_active_new_origin_targets':current_new,
                'youtube_targets_created':0}
        if not args.execute:return result
        from youtopia_collector.sources.steam.parsers import parse_store_item_items
        from youtopia_collector.jobs.projections import metadata_projection
        from youtopia_collector.common.errors import DuplicateCollection
        plan_hash=hashlib.sha256(raw_plan).hexdigest()
        applied=[]
        for row,record in applicable:
            app_id=row['app_id'];reference=row['evidence_run_reference']
            decision=hashlib.sha256((plan_hash+':'+str(app_id)).encode()).hexdigest()
            with stage.connect() as connection:
                prior=connection.execute('SELECT expires_at FROM admission WHERE decision_id=?',(decision,)).fetchone()
                expires=utc(prior[0]) if prior else now+timedelta(days=protect)
                if expires<=now:raise Blocked('PREPARED_PROTECTION_WINDOW_EXPIRED_NO_AUTOMATIC_RENEWAL')
                connection.execute('INSERT OR IGNORE INTO admission VALUES(?,?,?,?,?,?)',
                    (decision,app_id,plan_hash,reference,now.isoformat(),expires.isoformat()))
                connection.execute('INSERT INTO admission_event(decision_id,event_type,at) VALUES(?,?,?)',
                    (decision,'PREPARED',datetime.now(timezone.utc).isoformat()))
            parsed=parse_store_item_items(record[2])
            if len(parsed.items)!=1 or parsed.items[0].app_id!=app_id:raise Blocked('RAW_METADATA_IDENTITY_CONFLICT')
            received=datetime.fromtimestamp(record[1],timezone.utc)
            projection=metadata_projection(requested_count=1,response_item_count=parsed.response_item_count,
                parsed_item_count=parsed.parsed_item_count,items=parsed.items)
            # This is a metadata import of the staged exact response, not another
            # provider request and never a CCU replay. HTTP receipts stay in staging.
            metadata_path=context.settings.paths.artifact_dir/'steam'/'metadata-store-items'/('dt='+received.date().isoformat())/('run='+reference)/'metadata.json'
            if metadata_path.exists():
                from youtopia_collector.replay import _artifact_files
                prior_metadata,prior_body,backup=_artifact_files(context,metadata_path)
                if prior_body!=record[2] or prior_metadata.get('run_reference')!=reference:
                    raise Blocked('EXISTING_METADATA_BACKUP_MISMATCH')
            else:
                backup=context.backup.save(source='steam',collection_type='metadata-store-items',
                run_reference=reference,partition_date=received.date().isoformat(),response_bytes=record[2],
                metadata={'contract_version':'steam-metadata/v1','run_reference':reference,
                    'requested_app_ids':[app_id],'requested_count':1,'response_item_count':parsed.response_item_count,
                    'parsed_item_count':parsed.parsed_item_count,'accepted_item_count':len(parsed.items),
                    'projection_sha256':projection,'collector_version':__version__,'attempts':[],
                    'requested_at':received.isoformat(),'received_at':received.isoformat(),
                    'transmission_receipt_location':'new-release-staging-ledger'})
            try:
                repository.ingest_metadata(job=None,tasks=(),call=None,attempts=(),backup=backup,
                    run_reference=reference,requested_count=1,response_item_count=parsed.response_item_count,
                    parsed_item_count=parsed.parsed_item_count,items=parsed.items,projection_sha256=projection,
                    requested_at=received,received_at=received,collector_version=__version__,resolutions=(),
                    requested_app_ids=[app_id],source_language='english')
            except DuplicateCollection:
                # Exact metadata artifact duplication is handled by the base contract.
                pass
            with context.database.transaction() as connection:
                found=connection.execute(f'SELECT eligibility_status,app_type FROM {repository._c("steam_app_candidate")} WHERE app_id=%s FOR UPDATE',(app_id,)).fetchone()
                if not found or found!=('ELIGIBLE','game'):raise Blocked('DATABASE_ELIGIBILITY_NOT_CONFIRMED')
                profile=connection.execute(f'SELECT release_at FROM {repository._c("steam_app_profile")} WHERE app_id=%s',(app_id,)).fetchone()
                if not profile or not profile[0] or not now-timedelta(days=document['release_days'])<=profile[0]<=now:
                    raise Blocked('DATABASE_RELEASE_WINDOW_NOT_CONFIRMED')
                # Recheck the race with ordinary ranking/metadata work. Preserve
                # any target that another collector legitimately registered.
                found=connection.execute(f'SELECT 1 FROM {repository._c("steam_ccu_target")} WHERE app_id=%s UNION SELECT 1 FROM {repository._c("youtube_game_target")} WHERE app_id=%s',(app_id,app_id)).fetchone()
                if found:continue
                repository._upsert_tracking_signal(connection,app_id=app_id,signal_source='NEW_RELEASE',
                    scope_key='NEW_RELEASE:'+decision,observed_at=now,current_rank=None,source_reference=reference)
                connection.execute(f'UPDATE {repository._c("steam_tracking_signal")} SET expires_at=%s WHERE app_id=%s AND signal_source=%s AND scope_key=%s',
                                   (expires,app_id,'NEW_RELEASE','NEW_RELEASE:'+decision))
                repository._reconcile_targets(connection,now=now,app_ids=[app_id])
                target=connection.execute(f'SELECT active FROM {repository._c("steam_ccu_target")} WHERE app_id=%s',(app_id,)).fetchone()
                if target!=(True,):raise Blocked('CCU_TARGET_NOT_ACTIVATED_TRANSACTION_ROLLED_BACK')
            with stage.connect() as connection:
                connection.execute('INSERT INTO admission_event(decision_id,event_type,at) VALUES(?,?,?)',
                    (decision,'APPLIED',datetime.now(timezone.utc).isoformat()))
            applied.append(app_id)
        result.update(status='CCU_COHORT_ADMITTED',executed=True,applied_app_ids=applied)
        return result
    finally:context.close()
