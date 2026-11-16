"""CCU source context bound to each existing immutable run sidecar.

The observation schema and AppID/slot identity stay unchanged. No new PostgreSQL
table is required. This records sources as of the request, not a guessed reason
reconstructed from today's target flag.
"""
from datetime import datetime,timezone
import os


def reconcile_new_cohorts(context,*,now):
    if os.environ.get('YOUTOPIA_NEW_RELEASES_ENABLED')!='1':return
    from .limits import Blocked
    from .runtime_guard import load_budget
    if os.environ.get('YOUTOPIA_STEAM_GUARD_ENABLED')!='1':raise Blocked('NEW_RELEASES_REQUIRE_GLOBAL_GUARD')
    load_budget().status()
    repo=context.repository
    with context.database.transaction() as c:
        ids=[x[0] for x in c.execute(f'SELECT app_id FROM {repo._c("steam_ccu_target")} WHERE active IS TRUE AND selection_reason=%s',('SIGNAL_NEW_RELEASE',))]
        if ids:repo._reconcile_targets(c,now=now,app_ids=ids)


def capture_tracking_metadata(context,app_id,*,now=None):
    if os.environ.get('YOUTOPIA_NEW_RELEASES_ENABLED')!='1':return {}
    now=now or datetime.now(timezone.utc)
    repo=context.repository
    with context.database.transaction() as c:
        c.execute('SET TRANSACTION READ ONLY')
        rows=c.execute(f'SELECT signal_source,scope_key,last_source_reference,first_seen_at,last_seen_at,expires_at '
            f'FROM {repo._c("steam_tracking_signal")} WHERE app_id=%s AND signal_source=ANY(%s) '
            'AND deactivated_at IS NULL AND (expires_at IS NULL OR expires_at>%s) ORDER BY signal_source,scope_key',
            (app_id,['CONCURRENT_PLAYERS','MANUAL','NEW_RELEASE'],now)).fetchall()
        target=c.execute(f'SELECT lifecycle_state,selection_reason,selection_source_reference,grace_until,active '
                         f'FROM {repo._c("steam_ccu_target")} WHERE app_id=%s',(app_id,)).fetchone()
    return {'tracking_context':{'contract_version':1,'as_of_utc':now.isoformat(),
        'target_snapshot':{'lifecycle_state':target[0],'original_selection_reason':target[1],
            'original_source_reference':str(target[2]).strip(),'grace_until':target[3].isoformat() if target[3] else None,
            'active':target[4]} if target else None,
        'signals':[{'source':r[0],'scope_key':r[1],'source_reference':str(r[2]).strip(),
                    'first_seen_at':r[3].isoformat(),'last_seen_at':r[4].isoformat(),
                    'expires_at':r[5].isoformat() if r[5] else None} for r in rows],
        'meaning':'Observed active source signals before this request; not exclusive attribution or a genre ranking.'}}
