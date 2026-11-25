"""Observation provenance and limits for review aggregates, never inferred cohorts."""
from collections import Counter
from datetime import datetime
import math
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from .common import canonical, fingerprint


SCOPE_SCHEMA = 'review-observation-scope-v1'
CONTEXT_SCHEMA = 'review-context-v1'
DIFFICULTY_NOTICE = ('난이도 평가는 해당 게임 이용자들의 체감 의견입니다. 게임마다 이용자층·숙련도·선호가 달라, '
                     '이 결과만으로 게임 간 절대 난도를 비교할 수 없습니다.')
ALLOWED_CLAIMS = ('observed_review_sentiment_counts', 'observed_review_coverage',
                  'source_attributed_review_conditions')
PROHIBITED_CLAIMS = ('absolute_difficulty_ranking', 'game_quality_ranking_from_sentiment',
                     'player_skill_from_playtime', 'player_preference_from_game_title',
                     'population_market_share', 'causal_effect', 'bias_corrected_comparison',
                     'fabricated_evidence_quote')


def _object(value, fields, error):
    if value is None:
        return {}
    if not isinstance(value, dict) or set(value) - set(fields):
        raise ValueError(error)
    return value


def _text(value, error):
    if value is not None and (not isinstance(value, str) or not value.strip() or len(value) > 500):
        raise ValueError(error)
    return value


def _timestamp(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError('INVALID_OBSERVATION_TIMESTAMP')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise ValueError('INVALID_OBSERVATION_TIMESTAMP') from None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError('OBSERVATION_TIMESTAMP_REQUIRES_TIMEZONE')
    return parsed


def observation_scope(value=None):
    """Missing metadata remains explicit unknown; only comparable fields are accepted."""
    source = _object(value, ('schema', 'language', 'window', 'as_of', 'collection',
                             'source_total_matching_reviews'), 'INVALID_OBSERVATION_SCOPE')
    if source.get('schema', SCOPE_SCHEMA) != SCOPE_SCHEMA:
        raise ValueError('INVALID_OBSERVATION_SCOPE_SCHEMA')
    language = _text(source.get('language'), 'INVALID_OBSERVATION_LANGUAGE')
    window = _object(source.get('window'), ('basis', 'start', 'end', 'timezone'), 'INVALID_OBSERVATION_WINDOW')
    basis = window.get('basis')
    if basis not in (None, 'authored_at'):
        raise ValueError('REVIEW_WINDOW_MUST_USE_AUTHOR_TIME')
    start, end = window.get('start'), window.get('end')
    begin_at, end_at = _timestamp(start), _timestamp(end)
    if (start is None) != (end is None) or (begin_at is not None and begin_at >= end_at):
        raise ValueError('INVALID_HALF_OPEN_REVIEW_WINDOW')
    if start is not None and basis != 'authored_at':
        raise ValueError('REVIEW_WINDOW_MUST_USE_AUTHOR_TIME')
    timezone = _text(window.get('timezone'), 'INVALID_OBSERVATION_TIMEZONE')
    if timezone is not None:
        try:
            ZoneInfo(timezone)
        except ZoneInfoNotFoundError:
            raise ValueError('INVALID_OBSERVATION_TIMEZONE') from None
    as_of = source.get('as_of'); observed_at = _timestamp(as_of)
    if end_at is not None and observed_at is not None and end_at > observed_at:
        raise ValueError('REVIEW_WINDOW_AFTER_AS_OF')
    collection = _object(source.get('collection'), ('policy_id', 'purchase_scope', 'recommendation_scope',
                                                    'offtopic_scope', 'completeness'), 'INVALID_COLLECTION_SCOPE')
    collected = {field: _text(collection.get(field), 'INVALID_COLLECTION_SCOPE') for field in
                 ('policy_id', 'purchase_scope', 'recommendation_scope', 'offtopic_scope')}
    completeness = collection.get('completeness', 'UNKNOWN')
    if completeness not in ('COMPLETE', 'PARTIAL', 'UNKNOWN'):
        raise ValueError('INVALID_COLLECTION_COMPLETENESS')
    collected['completeness'] = completeness
    source_total = source.get('source_total_matching_reviews')
    if source_total is not None and (type(source_total) is not int or source_total < 0):
        raise ValueError('INVALID_SOURCE_TOTAL_MATCHING_REVIEWS')
    return {'schema': SCOPE_SCHEMA, 'language': language,
            'window': {'basis': basis, 'start': start, 'end': end, 'timezone': timezone},
            'as_of': as_of, 'collection': collected,
            'source_total_matching_reviews': source_total}


def review_context(value=None, text=None):
    source = _object(value, ('schema', 'authored_at', 'collected_at', 'playtime_at_review_minutes',
                             'playtime_at_collection_minutes', 'conditions'), 'INVALID_REVIEW_CONTEXT')
    if source.get('schema', CONTEXT_SCHEMA) != CONTEXT_SCHEMA:
        raise ValueError('INVALID_REVIEW_CONTEXT_SCHEMA')
    result = {'schema': CONTEXT_SCHEMA}
    for field in ('authored_at', 'collected_at'):
        result[field] = source.get(field); _timestamp(result[field])
    for field in ('playtime_at_review_minutes', 'playtime_at_collection_minutes'):
        value = source.get(field)
        if value is not None and (type(value) not in (int, float) or not math.isfinite(value) or value < 0):
            raise ValueError('INVALID_PLAYTIME_CONTEXT')
        result[field] = value
    # Do not equate the two playtimes, nor infer progress, skill, or preference from them.
    conditions = source.get('conditions', [])
    if not isinstance(conditions, list):
        raise ValueError('INVALID_REVIEW_CONDITIONS')
    normalized = []
    for condition in conditions:
        entry = _object(condition, ('name', 'value', 'basis', 'evidence_span', 'source_field'),
                        'INVALID_REVIEW_CONDITION')
        if entry.get('name') not in ('mode', 'progression', 'difficulty_setting', 'platform', 'mods', 'other'):
            raise ValueError('INVALID_REVIEW_CONDITION_NAME')
        value = _text(entry.get('value'), 'INVALID_REVIEW_CONDITION_VALUE')
        if value is None:
            raise ValueError('INVALID_REVIEW_CONDITION_VALUE')
        basis = entry.get('basis')
        if basis == 'review_text':
            span = _object(entry.get('evidence_span'), ('start', 'end', 'text'), 'INVALID_CONDITION_EVIDENCE')
            start, end, quote = span.get('start'), span.get('end'), span.get('text')
            if (type(start) is not int or type(end) is not int or not isinstance(quote, str)
                    or not quote or start < 0 or end <= start or len(quote) != end - start
                    or entry.get('source_field') is not None):
                raise ValueError('INVALID_CONDITION_EVIDENCE')
            if text is not None and (end > len(text) or text[start:end] != quote):
                raise ValueError('CONDITION_EVIDENCE_NOT_IN_BODY')
            normalized.append({'name': entry['name'], 'value': value, 'basis': basis,
                               'evidence_span': dict(span)})
        elif basis == 'source_metadata':
            field = _text(entry.get('source_field'), 'INVALID_CONDITION_SOURCE_FIELD')
            if field is None or entry.get('evidence_span') is not None:
                raise ValueError('INVALID_CONDITION_SOURCE_FIELD')
            normalized.append({'name': entry['name'], 'value': value, 'basis': basis, 'source_field': field})
        else:
            raise ValueError('REVIEW_CONDITION_REQUIRES_SOURCE')
    if len({canonical(c) for c in normalized}) != len(normalized):
        raise ValueError('DUPLICATE_REVIEW_CONDITION')
    result['conditions'] = normalized
    return result


def metadata_from_row(row, text=None):
    scope = observation_scope(row.get('observation_scope'))
    context = review_context(row.get('review_context'), text)
    authored_at = _timestamp(context['authored_at'])
    start, end = scope['window']['start'], scope['window']['end']
    if authored_at is not None and start is not None:
        if not _timestamp(start) <= authored_at < _timestamp(end):
            raise ValueError('AUTHORED_TIME_OUTSIDE_OBSERVATION_WINDOW')
    return {'observation_scope': scope, 'scope_sha256': fingerprint(scope), 'review_context': context}


def scope_unknowns(scope):
    unknown = [field for field in ('language', 'as_of') if scope[field] is None]
    unknown += ['window.' + field for field, value in scope['window'].items() if value is None]
    unknown += ['collection.' + field for field, value in scope['collection'].items()
                if value is None or (field == 'completeness' and value == 'UNKNOWN')]
    if scope['source_total_matching_reviews'] is None:
        unknown.append('source_total_matching_reviews')
    return unknown


def context_summary(contexts):
    fields = ('authored_at', 'collected_at', 'playtime_at_review_minutes', 'playtime_at_collection_minutes')
    known = {field: sum(context[field] is not None for context in contexts) for field in fields}
    counts = Counter()
    for context in contexts:
        # One review contributes at most once to an observed condition, even if cited twice.
        counts.update({(c['name'], c['value'], c['basis']) for c in context['conditions']})
    return {'reviews': len(contexts), 'known_review_counts': known,
            'unknown_review_counts': {field: len(contexts) - known[field] for field in fields},
            'condition_review_counts': [{'name': name, 'value': value, 'basis': basis, 'reviews': count}
                                        for (name, value, basis), count in sorted(counts.items())],
            'player_skill': 'UNKNOWN', 'player_preference': 'UNKNOWN',
            'source_status': 'source-attributed conditions; not independent factual verification',
            'playtime_is_skill': False}


def assert_insight_claim_allowed(claim_kind):
    """Use before producing any downstream statement from this count-only artifact."""
    if claim_kind not in ALLOWED_CLAIMS:
        raise ValueError('UNSUPPORTED_INSIGHT_CLAIM')


def insight_contract(scope):
    return {'schema': 'review-insight-limits-v1', 'allowed_claims': list(ALLOWED_CLAIMS),
            'prohibited_claims': list(PROHIBITED_CLAIMS), 'difficulty_notice': DIFFICULTY_NOTICE,
            'scope_unknown_fields': scope_unknowns(scope),
            'comparison_status': 'observed experiences only; no absolute difficulty or quality ranking',
            'population_representative': False, 'bias_corrected': False,
            'evidence_status': 'classifier has no evidence extraction; attach verified source spans separately',
            'rag_answer_generated': False}
