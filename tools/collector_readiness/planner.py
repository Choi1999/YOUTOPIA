"""Pure cohort planning. Planning never writes targets, signals, or observations."""
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
import math


def utc(value):
    if not isinstance(value, str):
        raise ValueError('TIME_MISSING')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('TIMEZONE_REQUIRED')
    return result.astimezone(timezone.utc)


def plan(rows, *, as_of, release_days, maximum_games, interval_minutes, existing_app_ids=()):
    now = utc(as_of)
    for value in (release_days, maximum_games, interval_minutes):
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ValueError('POSITIVE_INTEGER_REQUIRED')
    if not isinstance(existing_app_ids, (list,tuple,set)) or any(isinstance(x,bool) or not isinstance(x,int) or not 0<x<2**32 for x in existing_app_ids):
        raise ValueError('VERIFIED_EXISTING_APP_IDS_REQUIRED')
    existing = set(existing_app_ids)
    candidates, rejected = {}, []
    for row in rows:
        app_id = row.get('app_id')
        if isinstance(app_id, bool) or not isinstance(app_id, int) or not 0 < app_id < 2**32:
            rejected.append({'app_id': None, 'reason': 'INVALID_APP_ID'})
            continue
        if app_id in existing:
            rejected.append({'app_id': app_id, 'reason': 'ALREADY_TRACKED_NO_DUPLICATE'})
            continue
        if row.get('app_type') != 'game':
            rejected.append({'app_id': app_id, 'reason': 'PRODUCT_TYPE_NOT_CONFIRMED_GAME'})
            continue
        try:
            release_at = utc(row.get('release_at'))
            observed_at = utc(row.get('metadata_observed_at'))
        except (ValueError, TypeError):
            rejected.append({'app_id': app_id, 'reason': 'RELEASE_OR_METADATA_TIME_UNKNOWN'})
            continue
        if observed_at > now or observed_at < now - timedelta(days=2):
            rejected.append({'app_id': app_id, 'reason': 'METADATA_TIME_UNUSABLE'})
            continue
        if not now - timedelta(days=release_days) <= release_at <= now:
            rejected.append({'app_id': app_id, 'reason': 'OUTSIDE_RELEASE_WINDOW'})
            continue
        if row.get('release_date_status') != 'EXACT' or row.get('identity_status') != 'CONFIRMED':
            rejected.append({'app_id': app_id, 'reason': 'IDENTITY_OR_RELEASE_PRECISION_UNKNOWN'})
            continue
        if not isinstance(row.get('evidence_run_reference'), str) or not row['evidence_run_reference']:
            rejected.append({'app_id': app_id, 'reason': 'SOURCE_RUN_MISSING'})
            continue
        if row.get('genre_source') not in {'STEAM_GENRE', 'REVIEWED_MAPPING'}:
            rejected.append({'app_id': app_id, 'reason': 'GENRE_SOURCE_UNCONFIRMED'})
            continue
        genres = row.get('genres')
        if not isinstance(genres, list) or not genres or any(not isinstance(x, str) or not x for x in genres):
            rejected.append({'app_id': app_id, 'reason': 'GENRES_MISSING'})
            continue
        # Conflicting duplicates are quarantined rather than silently merged.
        if app_id in candidates and candidates[app_id] != row:
            candidates[app_id] = None
            rejected.append({'app_id': app_id, 'reason': 'CONFLICTING_DUPLICATE'})
        elif app_id not in candidates:
            candidates[app_id] = row
    queues = defaultdict(deque)
    for app_id, row in sorted(candidates.items()):
        if row is not None:
            for genre in sorted(set(row['genres'])):
                queues[genre].append(app_id)
    selected, selected_ids = [], set()
    while queues and len(selected) < maximum_games:
        for genre in sorted(list(queues)):
            while queues[genre] and queues[genre][0] in selected_ids:
                queues[genre].popleft()
            if not queues[genre]:
                del queues[genre]
                continue
            app_id = queues[genre].popleft()
            selected_ids.add(app_id)
            selected.append({**candidates[app_id], 'allocation_genre': genre,
                             'selection_reason': 'NEW_RELEASE_GENRE_EXPLORATION'})
            if len(selected) >= maximum_games:
                break
    eligible_ids = {key for key, row in candidates.items() if row is not None}
    return {'status': 'PLAN_ONLY_NOT_ADMITTED', 'as_of': now.isoformat(), 'release_days': release_days,
            'interval_minutes': interval_minutes, 'selected': selected,
            'waiting_app_ids': sorted(eligible_ids - selected_ids), 'rejected': rejected,
            'nominal_additional_calls_per_24h': len(selected) * math.ceil(1440 / interval_minutes),
            'cost_excludes': ['discovery', 'metadata', 'reviews', 'retries', 'other_consumers'],
            'genre_policy': 'Deterministic round-robin proposal; not a representative market sample.',
            'production_writes': 0}
