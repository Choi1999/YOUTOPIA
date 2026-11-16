"""Exact-hash build-time patch for the recovered 0.3.0-rc5-p33 package.

Run on an image build root or isolated test copy, never directly in production.
"""
import argparse
import ast
import hashlib
import re
from pathlib import Path

EXPECTED = {
    'common/http.py': '76beeb7da5527ff83884e99a759496f861a297b2c98cbdc8fe1a8cf2c20339d1',
    'db/repository.py': '5c85f0afa0e56ee4ccd42a0ba39df102675b706e19e6b8532358d9351fb5adf6',
    'jobs/steam_ccu.py': '7399917381f2ef92b3b6d8caac6e5904516553343b12c7bc388a45cb5533f198',
}

EXTRA_RECONCILE = '''            # New releases are an explicit CCU-only source; legacy YouTube policy remains independent.
            from os import environ
            if active_signal is None and environ.get("YOUTOPIA_NEW_RELEASES_ENABLED") == "1":
                row = connection.execute(
                    f"SELECT s.last_source_reference FROM {self._c('steam_tracking_signal')} s "
                    f"JOIN {self._c('steam_app_candidate')} c ON c.app_id=s.app_id "
                    "WHERE s.app_id=%s AND s.signal_source='NEW_RELEASE' "
                    "AND s.deactivated_at IS NULL AND s.expires_at>%s "
                    "AND c.eligibility_status='ELIGIBLE' AND c.app_type='game' "
                    "ORDER BY s.last_seen_at DESC,s.scope_key ASC LIMIT 1",
                    (app_id, now),
                ).fetchone()
                if row is not None:
                    self._upsert_ccu_target(connection, app_id=app_id, selected_at=now,
                        source_reference=str(row[0]).strip(), reason="SIGNAL_NEW_RELEASE")
                    self._cooldown_or_retire_target(connection, table="youtube_game_target",
                        app_id=app_id, now=now, clear_next_due=False)
                    continue
'''


def patched(root):
    root = Path(root)
    originals = {}
    for relative, expected in EXPECTED.items():
        data = (root / relative).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('BASE_SOURCE_HASH_MISMATCH:' + relative)
        originals[relative] = data.decode()
    http = originals['common/http.py']
    anchor = '            response = self._session.get(\n'
    if http.count(anchor) != 1:
        raise ValueError('HTTP_PATCH_ANCHOR_MISMATCH')
    http = http.replace(anchor, '            from collector_readiness.runtime_guard import guarded_legacy_get\n'
                       '            response = guarded_legacy_get(self._session.get,\n')
    repository = originals['db/repository.py']
    anchor = '            active_signal = self._active_promotion_signal(connection, app_id=app_id, now=now)\n'
    if repository.count(anchor) != 1:
        raise ValueError('RECONCILE_PATCH_ANCHOR_MISMATCH')
    repository = repository.replace(anchor, anchor + EXTRA_RECONCILE)
    ccu=originals['jobs/steam_ccu.py']
    anchor='    context.repository.ensure_ccu_tasks(scheduled_at=scheduled_at, now=now)\n'
    if ccu.count(anchor)!=1:raise ValueError('CCU_MAINTENANCE_ANCHOR_MISMATCH')
    ccu=ccu.replace(anchor,'    from collector_readiness.provenance import reconcile_new_cohorts, capture_tracking_metadata\n'
        '    from collector_readiness.limits import Blocked as GuardBlocked\n'
        '    reconcile_new_cohorts(context, now=now)\n'+anchor)
    anchor='\n        backup = None\n'
    if ccu.count(anchor)!=1:raise ValueError('CCU_CONTEXT_INITIALIZATION_ANCHOR_MISMATCH')
    ccu=ccu.replace(anchor,anchor+'        tracking_metadata = {}\n')
    anchor='        try:\n            context.preflight.lightweight_check()\n'
    if ccu.count(anchor)!=1:raise ValueError('CCU_PROVENANCE_ANCHOR_MISMATCH')
    ccu=ccu.replace(anchor,'        try:\n            tracking_metadata = capture_tracking_metadata(context, app_id)\n'
                    '            context.preflight.lightweight_check()\n')
    ccu,count=re.subn(r'(metadata=\{\n)([ ]+)',lambda m:m[1]+m[2]+'**tracking_metadata,\n'+m[2],ccu)
    if count!=3:raise ValueError('CCU_METADATA_SIDECAR_ANCHOR_MISMATCH')
    anchor='        except ApiNotFoundError as error:\n'
    if ccu.count(anchor)!=1:raise ValueError('CCU_GUARD_FAILURE_ANCHOR_MISMATCH')
    ccu=ccu.replace(anchor,'''        except GuardBlocked as error:
            # A global/local budget pause is not a failure of this game's API.
            # Keep its task resumable, preserve availability/failure_count, and
            # stop this run instead of marking every remaining game as failed.
            context.repository.finish_failed_call(
                call=call, task_ids=[work.task.task_id],
                attempts=attempts_from_error(error) or tuple(attempts),
                finished_at=utc_now(), retryable=True, source_type="LOCAL",
                collection_type="CURRENT_PLAYERS", stage="GLOBAL_STEAM_GUARD",
                failure_type="GuardBlocked", message=str(error), job=job,
                run_reference=run_reference, entity_type="STEAM_APP", app_id=app_id,
            )
            summary.failed += 1
            logger.warning("STEAM_CCU_GLOBAL_GUARD_PAUSED reason=%s", str(error))
            break
'''+anchor)
    output = {'common/http.py':http, 'db/repository.py':repository,'jobs/steam_ccu.py':ccu}
    for relative, text in output.items():
        ast.parse(text, filename=relative)
    return output


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package-root',required=True)
    args=parser.parse_args(argv)
    output=patched(args.package_root)
    for relative,text in output.items():
        Path(args.package_root,relative).write_text(text)
    return 0


if __name__=='__main__':raise SystemExit(main())
