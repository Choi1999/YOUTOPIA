"""Opinion-level human evidence and a separate review-level training target."""
from datetime import datetime
from pathlib import Path
from .common import digest, fingerprint, read

POLARITIES = ('긍정', '부정', '혼합', '중립')
POLICY = {
    'version': 'review-opinion-v1',
    'aggregation': 'positive+negative or explicit mixed -> mixed; neutral alone -> neutral',
    'input': 'body_only; steam voted_up is auxiliary annotation context',
    'long_input': 'hold_whole_review; never broadcast review labels to chunks',
    'task': 'review_aspect_polarity_presence; no opinion/evidence extraction model',
}


def taxonomy():
    return read(Path(__file__).parent / 'taxonomy.json')


def aspects():
    return [item['code'] for item in taxonomy()['categories'] if item['code'] != 'OTHER']


def labels():
    return [aspect + '::' + polarity for aspect in aspects() for polarity in POLARITIES]


def scope_hash(record, scope):
    """Review approval covers selected/held opinions AND all original annotations."""
    if scope == 'review':
        value = {key: record.get(key) for key in (
            'key', 'appid', 'review_id', 'clean_text', 'text_sha256', 'review_status',
            'active_opinion_ids', 'held_opinion_ids', 'excluded_spans', 'annotations',
            'taxonomy_version', 'taxonomy_sha256', 'voted_up', 'votes_up', 'behaviors')}
    else:
        matches = [item for item in record['annotations'] if item['id'] == scope.removeprefix('opinion:')]
        if not scope.startswith('opinion:') or len(matches) != 1:
            raise ValueError('UNKNOWN_APPROVAL_SCOPE')
        value = matches[0]
    return fingerprint(value)


def confirmation(item):
    if not all(isinstance(item.get(key), str) and item[key].strip()
               for key in ('reviewer', 'reviewed_at', 'source_ref')):
        return False
    try:
        stamp = datetime.fromisoformat(item['reviewed_at'].replace('Z', '+00:00'))
        return stamp.tzinfo is not None and item.get('decision') == 'confirmed'
    except ValueError:
        return False


def approved(record, scope, ledger):
    expected = scope_hash(record, scope)
    return any(entry.get('key') == record['key'] and entry.get('scope') == scope
               and entry.get('text_sha256') == record['text_sha256']
               and entry.get('scope_sha256') == expected and confirmation(entry) for entry in ledger)


def approval_candidates(record):
    """Unsigned candidates are NOT approvals. Never manufactures reviewer/time."""
    return [{'key': record['key'], 'scope': scope, 'text_sha256': record['text_sha256'],
             'scope_sha256': scope_hash(record, scope), 'decision': 'pending',
             'reviewer': '', 'reviewed_at': '', 'source_ref': ''}
            for scope in ['review', *('opinion:' + a['id'] for a in record['annotations'])]]


def aggregate(opinions):
    grouped = {}
    for opinion in opinions:
        grouped.setdefault(opinion['aspect_code'], set()).add(opinion['polarity'])
    result = {}
    for aspect, polarities in grouped.items():
        if '혼합' in polarities or {'긍정', '부정'} <= polarities:
            result[aspect] = '혼합'
        elif '긍정' in polarities:
            result[aspect] = '긍정'
        elif '부정' in polarities:
            result[aspect] = '부정'
        else:
            result[aspect] = '중립'
    return result


def validate(record, ledger):
    """Return workbench data even when incomplete; invalid evidence fails explicitly."""
    if str(record['appid']) + ':' + str(record['review_id']) != record['key']:
        raise ValueError('REVIEW_KEY_MISMATCH')
    text = record['clean_text']
    if not isinstance(text, str) or not text.strip() or digest(text) != record['text_sha256']:
        raise ValueError('BODY_HASH_MISMATCH')
    for span in record.get('excluded_spans', []):
        start, end = span['start'], span['end']
        if (type(start) is not int or type(end) is not int or not 0 <= start < end <= len(text)
                or not isinstance(span.get('reason'), str) or not span['reason'].strip()
                or ('text' in span and span['text'] != text[start:end])):
            raise ValueError('EXCLUDED_SPAN_INVALID')
    tax = taxonomy()
    if record.get('taxonomy_version') != tax['version'] or record.get('taxonomy_sha256') != fingerprint(tax):
        raise ValueError('TAXONOMY_MISMATCH')
    for field in ('voted_up',):
        if record.get(field) is not None and type(record[field]) is not bool:
            raise ValueError('STEAM_RECOMMENDATION_TYPE')
    votes = record.get('votes_up')
    if votes is not None and (type(votes) is not int or votes < 0):
        raise ValueError('HELPFUL_VOTES_TYPE')
    annotations = record['annotations']
    ids = [a['id'] for a in annotations]
    if any(not isinstance(i, str) or not i.strip() for i in ids) or len(set(ids)) != len(ids):
        raise ValueError('DUPLICATE_OR_EMPTY_OPINION_ID')
    active_list, held_list = record['active_opinion_ids'], record.get('held_opinion_ids', [])
    active, held = set(active_list), set(held_list)
    if len(active) != len(active_list) or len(held) != len(held_list) or active & held or not (active | held) <= set(ids):
        raise ValueError('OPINION_SELECTION_CONFLICT')
    confirmed, reasons = [], []
    for annotation in annotations:
        if annotation['id'] not in active:
            continue
        polarity = {'복합': '혼합'}.get(annotation['polarity'], annotation['polarity'])
        if annotation['aspect_code'] not in aspects() or polarity not in POLARITIES:
            raise ValueError('UNKNOWN_OR_HELD_ASPECT')
        human = annotation.get('human_review') or {}
        if any(human.get(k) for k in ('corrected_aspect', 'corrected_polarity', 'corrected_target', 'corrected_evidence')):
            reasons.append('UNAPPLIED_CORRECTION')
        spans = annotation.get('evidence_spans', [])
        if not spans:
            raise ValueError('MISSING_BODY_EVIDENCE')
        for span in spans:
            start, end = span['start'], span['end']
            if type(start) is not int or type(end) is not int or not 0 <= start < end <= len(text) or text[start:end] != span['text']:
                raise ValueError('EVIDENCE_OFFSETS_MISMATCH')
        if not isinstance(annotation.get('detail'), str) or not annotation['detail'].strip():
            raise ValueError('MISSING_OPINION_DETAIL')
        # A context check may request reconsideration; metadata alone cannot set polarity.
        context = annotation.get('steam_context_check')
        if context and (context.get('basis') != 'body_evidence' or context.get('voted_up') != record.get('voted_up')):
            raise ValueError('METADATA_ONLY_OR_STALE_SENTIMENT_OVERRIDE')
        if approved(record, 'opinion:' + annotation['id'], ledger):
            confirmed.append({**annotation, 'polarity': polarity})
        else:
            reasons.append('OPINION_CONFIRMATION_UNLINKED')
    if held:
        reasons.append('HELD_OPINIONS_REMAIN')
    if not approved(record, 'review', ledger):
        reasons.append('REVIEW_CONFIRMATION_UNLINKED')
    status = record.get('review_status')
    if status not in ('완료', '평가 있음', '내용 없음', '평가 없음'):
        reasons.append('REVIEW_UNRESOLVED')
    elif (status in ('내용 없음', '평가 없음')) != (not active):
        raise ValueError('STATUS_OPINION_CONFLICT')
    result = aggregate(confirmed)
    return {
        'source': record, 'key': record['key'], 'appid': str(record['appid']),
        'text': text, 'text_sha256': record['text_sha256'], 'opinions': confirmed,
        'aggregate': result, 'labels': sorted(a + '::' + p for a, p in result.items()),
        'eligible': not reasons, 'reasons': sorted(set(reasons)),
        'human_review_evidence_count': sum(approved(record, 'opinion:' + a['id'], ledger) for a in annotations),
        'human_review_flags_present': record.get('human_reviewed'),
        'steam_context': {'voted_up': record.get('voted_up'), 'votes_up': votes},
        'policy_sha256': fingerprint(POLICY), 'taxonomy_sha256': fingerprint(tax),
    }
