"""Pure offline per-game target counts; parent views retain all detailed results."""
from collections import Counter
import math
from pathlib import Path
from .common import fingerprint, read, rows, seal, verify, write
from .contract import POLICY, POLARITIES, labels, rollup
from .taxonomy import taxonomy, target_map


def summarize(source, destination):
    root = Path(source); metadata = verify(root)
    if metadata.get('classification_unit') != 'leaf_id':
        raise ValueError('FINE_TARGET_PREDICTIONS_REQUIRED')
    tax = taxonomy(read(root / 'taxonomy.json')); mapping = target_map(tax)
    if metadata.get('taxonomy_sha256') != fingerprint(tax) or metadata.get('policy_sha256') != fingerprint(POLICY):
        raise ValueError('PREDICTION_TAXONOMY_OR_POLICY_CHANGED')
    data = rows(root / 'predictions.jsonl')
    if len(data) != metadata['rows']:
        raise ValueError('PREDICTION_ROW_COUNT_CHANGED')
    games, seen, snapshots = {}, set(), set()
    states = Counter(); valid_labels = set(labels(tax))
    threshold = metadata.get('threshold')
    if type(threshold) not in (int, float) or not math.isfinite(threshold) or not 0 < threshold < 1:
        raise ValueError('INVALID_PREDICTION_THRESHOLD')
    for row in data:
        if any(row.get(field) != metadata[field] for field in ('taxonomy_sha256', 'policy_sha256', 'model_sha256', 'classification_unit', 'synthetic_model', 'threshold')):
            raise ValueError('MIXED_PREDICTION_LINEAGE')
        state = row.get('state'); states[state] += 1
        if state in ('REJECTED_INPUT', 'HELD_LONG_INPUT'):
            if row.get('labels') is not None or row.get('scores') is not None:
                raise ValueError('FAILED_PREDICTION_HAS_SUCCESS_VALUES')
            continue
        if state not in ('PREDICTED_TARGETS', 'NO_TARGET_PREDICTED'):
            raise ValueError('UNKNOWN_PREDICTION_STATE')
        if row['key'] in seen or not row.get('source_revision') or not row.get('snapshot_id'):
            raise ValueError('DUPLICATE_REVIEW_REVISION_OR_MISSING_LINEAGE')
        seen.add(row['key']); snapshots.add(row['snapshot_id'])
        selected = row['labels']
        if (not isinstance(selected, list) or len(set(selected)) != len(selected) or not set(selected) <= valid_labels
                or (state == 'NO_TARGET_PREDICTED') != (not selected)):
            raise ValueError('INVALID_TARGET_PREDICTION')
        if row.get('aspect_summary') != rollup(selected, tax):
            raise ValueError('TARGET_SENTIMENT_OR_PARENT_VIEW_CONFLICT')
        scores = row.get('scores')
        if (not isinstance(scores, dict) or set(scores) != valid_labels
                or any(type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1
                       for value in scores.values())):
            raise ValueError('INVALID_TARGET_SCORES')
        from .models import decode
        expected = decode([[scores[label] for label in labels(tax)]], threshold, labels(tax))[0]
        if set(selected) != {label for label, selected_flag in zip(labels(tax), expected) if selected_flag}:
            raise ValueError('SCORES_DISAGREE_WITH_TARGET_LABELS')
        game = games.setdefault(str(row['appid']), {'successful_review_predictions': 0,
                                                    'no_target_predicted_reviews': 0,
                                                    'leaf_counts': {}, 'derived_mixed_review_counts': {},
                                                    'parent_review_presence': {}})
        game['successful_review_predictions'] += 1
        game['no_target_predicted_reviews'] += int(not selected)
        parents = set()
        for label in selected:
            code, polarity = label.split('::'); parent = mapping[code]['aspect_code']; parents.add(parent)
            count = game['leaf_counts'].setdefault(code, {p: 0 for p in POLARITIES})
            count[polarity] += 1
        for parent in parents:
            game['parent_review_presence'][parent] = game['parent_review_presence'].get(parent, 0) + 1
        for leaf in {label.split('::')[0] for label in selected}:
            if {leaf + '::긍정', leaf + '::부정'} <= set(selected):
                game['derived_mixed_review_counts'][leaf] = game['derived_mixed_review_counts'].get(leaf, 0) + 1
    if len(snapshots) > 1:
        raise ValueError('MIXED_SNAPSHOTS_REQUIRE_SEPARATE_SUMMARIES')
    for game in games.values():
        game['parent_details'] = {}
        for code, count in game['leaf_counts'].items():
            game['parent_details'].setdefault(mapping[code]['aspect_code'], []).append({'leaf_id': code, 'counts': count})
    result = {'classification_unit': 'leaf_id', 'taxonomy_version': tax['version'],
              'taxonomy_status': tax['status'], 'taxonomy_sha256': fingerprint(tax),
              'model_sha256': metadata['model_sha256'], 'policy_sha256': metadata['policy_sha256'],
              'synthetic_model': metadata['synthetic_model'], 'snapshot_id': next(iter(snapshots), None),
              'input_rows': len(data), 'states': dict(states), 'games': games,
              'denominator': 'successful distinct review predictions within each game, model and snapshot',
              'limits': ['NO_TARGET_PREDICTED is not human-confirmed no evaluation',
                         'different targets in one review are not independent reviewers',
                         'no inferred evidence quotes, population market share, causal claim or RAG answer']}
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    write(target / 'summary.json', result); write(target / 'taxonomy.json', tax)
    seal(target, {'classification_unit': 'leaf_id', 'database_writes': False,
                  'synthetic_model': metadata['synthetic_model']})
    return {'input_rows': len(data), 'games': len(games), 'successful_reviews': len(seen)}
