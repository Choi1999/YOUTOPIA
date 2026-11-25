"""Opinion-level human evidence and a separate review-level training target."""
from datetime import datetime
from .common import digest, fingerprint
from .taxonomy import taxonomy, target_map

POLARITIES = ('긍정', '부정')
POLICY = {
    'version': 'review-leaf-opinion-v06',
    'aggregation': 'preserve independent positive/negative labels within each leaf; mixed is derived, never a training class',
    'parent_rollup': 'preserve every target/polarity pair; never collapse different targets into parent mixed',
    'input': 'text_only; metadata-assisted sentiment is preserved but excluded from text-only targets',
    'metadata_assistance': 'no implied negative labels; hold whole review until a separate equally supplied metadata task is implemented',
    'long_input': 'hold_whole_review; never broadcast review labels to chunks',
    'task': 'review_target_polarity_presence; no opinion/evidence extraction model',
}


def aspects(tax=None):
    return [item['code'] for item in taxonomy(tax)['categories']]


def labels(tax=None):
    return [target + '::' + polarity for target in target_map(tax) for polarity in POLARITIES]


def scope_hash(record, scope):
    """Review approval covers selected/held opinions AND all original annotations."""
    if scope == 'review':
        value = {key: record.get(key) for key in (
            'key', 'appid', 'review_id', 'clean_text', 'text_sha256', 'review_status',
            'active_opinion_ids', 'held_opinion_ids', 'excluded_spans', 'annotations',
            'taxonomy_version', 'taxonomy_sha256', 'voted_up', 'votes_up', 'behaviors', 'migration',
            'learning_eligible', 'batch_role', 'source_review_acceptance', 'reclassification_review',
            'metadata', 'annotation_input', 'guideline_version', 'annotation_protocol')}
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
        grouped.setdefault(opinion['leaf_id'], set()).add(opinion['polarity'])
    return {leaf: [polarity for polarity in POLARITIES if polarity in polarities]
            for leaf, polarities in grouped.items()}


def rollup(target_labels, tax=None):
    """Parents are views of fine pairs, never a replacement sentiment label."""
    mapping = target_map(tax); result = {}
    for label in sorted(set(target_labels)):
        code, polarity = label.split('::')
        if code not in mapping or polarity not in POLARITIES:
            raise ValueError('UNKNOWN_TARGET_LABEL')
        result.setdefault(mapping[code]['aspect_code'], []).append({'leaf_id': code, 'polarity': polarity})
    return result


def annotation_input_requirements(record):
    """Preserve annotation context without silently making it classifier input.

    A known metadata-assisted polarity cannot become text-only gold, including
    when a caller supplies a fresh approval ledger. Unknown input declarations
    fail closed rather than treating the missing polarity as a negative label.
    """
    metadata = record.get('metadata', {})
    requirement = record.get('annotation_input', {})
    if not isinstance(metadata, dict) or not isinstance(requirement, dict):
        raise ValueError('ANNOTATION_INPUT_METADATA_OBJECT_REQUIRED')
    sufficient = requirement.get('text_only_sufficient', True)
    fields = requirement.get('required_metadata', [])
    if (type(sufficient) is not bool or not isinstance(fields, list)
            or any(not isinstance(field, str) or not field.strip() for field in fields)
            or len(fields) != len(set(fields))):
        raise ValueError('ANNOTATION_INPUT_REQUIREMENTS_INVALID')
    for field in ('steam_recommended', 'voted_up'):
        if field in metadata and metadata[field] is not None and type(metadata[field]) is not bool:
            raise ValueError('STEAM_RECOMMENDATION_TYPE')
    nested = metadata.get('steam_recommended', metadata.get('voted_up'))
    if nested is not None and record.get('voted_up') is not None and nested != record['voted_up']:
        raise ValueError('STEAM_RECOMMENDATION_CONFLICT')
    bases = [a.get('sentiment_basis') for a in record['annotations']
             if a['id'] in record['active_opinion_ids']]
    allowed = (None, 'REVIEW_TEXT', 'TEXT_ONLY', 'BODY_EVIDENCE', 'STEAM_RECOMMENDATION_TIEBREAK')
    unknown_basis = any(basis not in allowed for basis in bases)
    assisted = not sufficient or bool(fields) or 'STEAM_RECOMMENDATION_TIEBREAK' in bases
    if assisted and 'STEAM_RECOMMENDATION_TIEBREAK' in bases and not fields:
        fields = ['steam_recommended']
    missing = [field for field in fields if field not in metadata or metadata[field] is None]
    # Support legacy top-level voted_up only when explicitly requested as such.
    missing = [field for field in missing if field != 'voted_up' or record.get('voted_up') is None]
    return {'task': 'text_only', 'text_only_sentiment_eligible': not assisted and not unknown_basis,
            'metadata_assisted': assisted, 'unknown_sentiment_basis': unknown_basis,
            'required_metadata': fields, 'missing_required_metadata': missing,
            'metadata_supplied_to_model': False}


def validate(record, ledger, tax=None):
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
    tax = taxonomy(tax); mapping = target_map(tax)
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
    input_requirements = annotation_input_requirements(record)
    confirmed, metadata_assisted, reasons = [], [], []
    if not input_requirements['text_only_sentiment_eligible']:
        reasons.append('TEXT_ONLY_SENTIMENT_REQUIRES_METADATA' if input_requirements['metadata_assisted']
                       else 'UNKNOWN_SENTIMENT_BASIS_REQUIRES_ADJUDICATION')
    if input_requirements['missing_required_metadata']:
        reasons.append('ANNOTATION_REQUIRED_METADATA_MISSING')
    if record.get('learning_eligible') is False or str(record.get('batch_role', '')).startswith('guideline_pilot'):
        reasons.append('SOURCE_TRAINING_EXCLUDED')
    for annotation in annotations:
        if annotation['id'] not in active:
            if annotation['id'] in held:
                for span in annotation.get('evidence_spans', []):
                    start, end = span['start'], span['end']
                    if type(start) is not int or type(end) is not int or not 0 <= start < end <= len(text) or text[start:end] != span['text']:
                        raise ValueError('HELD_EVIDENCE_OFFSETS_MISMATCH')
            continue
        polarity = annotation['polarity']
        if annotation['aspect_code'] not in aspects(tax) or polarity not in POLARITIES:
            raise ValueError('UNKNOWN_OR_HELD_ASPECT')
        code = annotation.get('leaf_id')
        if code is None:
            reasons.append('TARGET_RECLASSIFICATION_REQUIRED')
        elif code not in mapping or mapping[code]['aspect_code'] != annotation['aspect_code']:
            raise ValueError('TARGET_PARENT_MISMATCH_OR_UNKNOWN_TARGET')
        human = annotation.get('human_review') or {}
        if annotation.get('learning_eligible') is False:
            reasons.append('SOURCE_OPINION_TRAINING_EXCLUDED')
        if any(human.get(k) for k in ('corrected_aspect', 'corrected_polarity', 'corrected_target', 'corrected_evidence')):
            reasons.append('UNAPPLIED_CORRECTION')
        spans = annotation.get('evidence_spans', [])
        if not spans:
            raise ValueError('MISSING_BODY_EVIDENCE')
        for span in [*spans, *annotation.get('target_spans', []), *annotation.get('supporting_context_spans', [])]:
            start, end = span['start'], span['end']
            if type(start) is not int or type(end) is not int or not 0 <= start < end <= len(text) or text[start:end] != span['text']:
                raise ValueError('EVIDENCE_OFFSETS_MISMATCH')
        if not isinstance(annotation.get('detail'), str) or not annotation['detail'].strip():
            raise ValueError('MISSING_OPINION_DETAIL')
        # A context check may request reconsideration; metadata alone cannot set polarity.
        context = annotation.get('steam_context_check')
        if context and (context.get('basis') != 'body_evidence' or context.get('voted_up') != record.get('voted_up')):
            raise ValueError('METADATA_ONLY_OR_STALE_SENTIMENT_OVERRIDE')
        if code is not None and approved(record, 'opinion:' + annotation['id'], ledger):
            if input_requirements['text_only_sentiment_eligible']:
                confirmed.append({**annotation, 'polarity': polarity})
            else:
                metadata_assisted.append({**annotation, 'polarity': polarity})
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
    target_labels = sorted(leaf + '::' + polarity for leaf, polarities in result.items() for polarity in polarities)
    return {
        'source': record, 'key': record['key'], 'appid': str(record['appid']),
        'text': text, 'text_sha256': record['text_sha256'], 'opinions': confirmed,
        'aggregate': result, 'labels': target_labels,
        'derived_mixed_leaves': sorted(leaf for leaf, directions in result.items() if len(directions) > 1),
        'aspect_summary': rollup(target_labels, tax),
        'classification_unit': 'leaf_id',
        'task_eligibility': input_requirements,
        'metadata_assisted_opinions': metadata_assisted,
        'text_evidenced_target_ids': sorted({a['leaf_id'] for a in annotations
                                           if a['id'] in active and a.get('leaf_id') in mapping}),
        'annotation_metadata': record.get('metadata', {}),
        'annotation_input': record.get('annotation_input', {}),
        'eligible': not reasons, 'reasons': sorted(set(reasons)),
        'human_review_evidence_count': sum(approved(record, 'opinion:' + a['id'], ledger) for a in annotations),
        'human_review_flags_present': record.get('human_reviewed'),
        'steam_context': {'voted_up': record.get('voted_up'), 'votes_up': votes},
        'policy_sha256': fingerprint(POLICY), 'taxonomy_sha256': fingerprint(tax),
    }
