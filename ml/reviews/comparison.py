"""Combine sealed local/API final reports without selecting models on final-test scores."""
import csv
import math
from pathlib import Path
import re
import statistics
from .common import file_hash, fingerprint, read, rows, seal, verify, write


LOCAL_KINDS = ('tfidf', 'textcnn', 'frozen', 'full')
API_CONDITIONS = ('openai_baseline', 'openai_prompt', 'gemini_baseline', 'gemini_prompt')
LINEAGE = ('dataset_sha256', 'taxonomy_sha256', 'policy_sha256', 'label_schema_sha256',
           'input_scope', 'input_scope_sha256', 'split', 'test_reviews',
           'test_keyset_sha256', 'test_truth_sha256')
METRICS = ('macro_f1_all_labels_zero_division_0', 'macro_f1_supported', 'micro_f1', 'exact_match')
HASH = re.compile(r'[0-9a-f]{64}')
MODEL = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}')


def _number(value, error, low=0, high=None, nullable=False):
    if value is None and nullable:
        return None
    if (type(value) not in (int, float) or not math.isfinite(value) or value < low
            or (high is not None and value > high)):
        raise ValueError(error)
    return float(value)


def _lineage(document, metadata):
    if not isinstance(document, dict) or any(name not in document for name in LINEAGE):
        raise ValueError('FINAL_COMPARISON_LINEAGE_REQUIRED')
    for name in LINEAGE:
        if name.endswith('_sha256') and not HASH.fullmatch(str(document[name])):
            raise ValueError('INVALID_FINAL_COMPARISON_HASH')
    if (document['split'] != 'test' or type(document['test_reviews']) is not int
            or document['test_reviews'] <= 0
            or not isinstance(document['input_scope'], dict)
            or fingerprint(document['input_scope']) != document['input_scope_sha256']):
        raise ValueError('INVALID_FINAL_COMPARISON_INPUT_SCOPE')
    if (type(document.get('synthetic')) is not bool or metadata.get('synthetic') is not document['synthetic']
            or metadata.get('split', 'test') != 'test'):
        raise ValueError('FINAL_COMPARISON_SYNTHETIC_OR_SPLIT_MISMATCH')


def _metrics(report, test_reviews, label_hash):
    """Check complete-test counts; partial API coverage must not masquerade as full F1."""
    if (not isinstance(report, dict) or type(report.get('reviews')) is not int or report.get('reviews') != test_reviews
            or report.get('classification_unit') != 'leaf_id'
            or type(report.get('label_count')) is not int or report['label_count'] <= 0):
        raise ValueError('INVALID_COMPLETE_TEST_METRICS')
    detail = report.get('per_label')
    if (not isinstance(detail, list) or len(detail) != report['label_count']
            or any(not isinstance(item, dict) or not isinstance(item.get('label'), str) for item in detail)):
        raise ValueError('INVALID_COMPLETE_TEST_PER_LABEL_METRICS')
    names = [item['label'] for item in detail]
    if len(set(names)) != len(names) or fingerprint(names) != label_hash:
        raise ValueError('FINAL_COMPARISON_LABEL_MAPPING_MISMATCH')
    totals = {'tp': 0, 'fp': 0, 'fn': 0}; all_f1, supported_f1 = [], []
    for item in detail:
        if not re.fullmatch(r'[A-Z_]+\.[A-Z_]+::(긍정|부정)', item['label']):
            raise ValueError('INVALID_COMPLETE_TEST_LEAF_LABEL')
        for name in ('support', 'predicted', 'tp', 'fp', 'fn'):
            if type(item.get(name)) is not int or not 0 <= item[name] <= test_reviews:
                raise ValueError('INVALID_COMPLETE_TEST_LABEL_COUNTS')
        if (item['support'] != item['tp'] + item['fn'] or item['predicted'] != item['tp'] + item['fp']
                or item['tp'] + item['fp'] + item['fn'] > test_reviews):
            raise ValueError('INCONSISTENT_COMPLETE_TEST_LABEL_COUNTS')
        expected = {'precision': item['tp'] / item['predicted'] if item['predicted'] else None,
                    'recall': item['tp'] / item['support'] if item['support'] else None,
                    'f1': 2 * item['tp'] / (2 * item['tp'] + item['fp'] + item['fn']) if item['support'] else None}
        for name, value in expected.items():
            actual = _number(item.get(name), 'INVALID_COMPLETE_TEST_LABEL_SCORE', high=1, nullable=True)
            if (actual is None) != (value is None) or (actual is not None and not math.isclose(actual, value, abs_tol=1e-8)):
                raise ValueError('INCONSISTENT_COMPLETE_TEST_LABEL_SCORE')
        all_f1.append(expected['f1'] or 0.0)
        if item['support']:
            supported_f1.append(expected['f1'])
        for name in totals:
            totals[name] += item[name]
    divisor = 2 * totals['tp'] + totals['fp'] + totals['fn']
    expected = {'macro_f1_all_labels_zero_division_0': statistics.mean(all_f1),
                'macro_f1_supported': statistics.mean(supported_f1) if supported_f1 else None,
                'micro_f1': 2 * totals['tp'] / divisor if divisor else 0.0}
    for name in METRICS:
        value = _number(report.get(name), 'INVALID_COMPLETE_TEST_SCORE', high=1,
                        nullable=name == 'macro_f1_supported')
        if name in expected and ((value is None) != (expected[name] is None)
                                or (value is not None and not math.isclose(value, expected[name], abs_tol=1e-8))):
            raise ValueError('INCONSISTENT_COMPLETE_TEST_SCORE')
    return report


def _row(identity, family):
    return {'condition': identity, 'family': family, 'status': 'NOT_RUN', 'run_count': 0,
            'seeds': [], 'coverage': None, 'metrics': {name: None for name in METRICS},
            'macro_f1_seed_sample_std': None, 'metric_use': 'N/A: condition not executed',
            'inference_seconds_mean': None, 'inference_timing_scope': None,
            'requested_model': None, 'response_models': [], 'usage_totals': None,
            'actual_cost': None, 'cost_status': 'not invoice-verified',
            'incomparability_reasons': [], 'selected_before_test': False, 'runs': []}


def _local_rows(document):
    if document.get('selection_changed_after_test') is not False:
        raise ValueError('FINAL_TEST_RESELECTION_NOT_ALLOWED')
    reports = document.get('reports')
    if not isinstance(reports, list):
        raise ValueError('INVALID_LOCAL_FINAL_REPORTS')
    grouped = {kind: [] for kind in LOCAL_KINDS}; seen = set(); selected = []
    for report in reports:
        if not isinstance(report, dict):
            raise ValueError('INVALID_LOCAL_FINAL_REPORT')
        kind, seed, model = report.get('kind'), report.get('seed'), report.get('model')
        if (kind not in LOCAL_KINDS or type(seed) is not int or (kind, seed) in seen
                or model != kind + '-' + str(seed) or report.get('split') != 'test'
                or type(report.get('coverage')) not in (int, float) or report.get('coverage') != 1
                or type(report.get('selected_before_test')) is not bool):
            raise ValueError('INVALID_OR_DUPLICATE_LOCAL_FINAL_CONDITION')
        _metrics(report, document['test_reviews'], document['label_schema_sha256'])
        _number(report.get('inference_seconds'), 'INVALID_LOCAL_INFERENCE_TIME', nullable=True)
        seen.add((kind, seed)); grouped[kind].append(report)
        if report['selected_before_test']:
            selected.append(model)
    if ((reports and selected != [document.get('selected_path')])
            or (not reports and document.get('selected_path') is not None)):
        raise ValueError('PRETEST_LOCAL_MODEL_SELECTION_CHANGED')
    result = []
    for kind in LOCAL_KINDS:
        row = _row(kind, 'local'); runs = grouped[kind]
        if runs:
            row.update(status='COMPLETE', run_count=len(runs), seeds=sorted(r['seed'] for r in runs), coverage=1.0,
                       metrics={name: statistics.mean(values) if len(values := [r[name] for r in runs if r[name] is not None]) == len(runs) else None
                                for name in METRICS},
                       macro_f1_seed_sample_std=statistics.stdev([r[METRICS[0]] for r in runs]) if len(runs) > 1 else None,
                       metric_use='synthetic regression only' if document['synthetic'] else 'same fixed final-test set',
                       inference_seconds_mean=statistics.mean(values) if len(values := [r.get('inference_seconds') for r in runs
                                                                                      if r.get('inference_seconds') is not None]) == len(runs) else None,
                       inference_timing_scope='mean of reported single batches; includes model load; not comparable to per-request API latency',
                       selected_before_test=any(r['selected_before_test'] for r in runs), runs=runs)
        result.append(row)
    return result


def _api_rows(document, source):
    reports = document.get('reports')
    if (document.get('schema') != 'review-api-benchmark-report-v1' or not isinstance(reports, list)
            or document.get('test_used_for_prompt_selection') is not False
            or document.get('automatic_model_reselection') is not False
            or type(document.get('mocked_provider')) is not bool
            or type(document.get('real_api_verified')) is not bool
            or (document['mocked_provider'] and document['real_api_verified'])):
        raise ValueError('INVALID_API_COMPARISON_OR_RESELECTION')
    indexed = {}
    for report in reports:
        if not isinstance(report, dict):
            raise ValueError('INVALID_API_FINAL_REPORT')
        identity = report.get('condition'); provider = identity.split('_')[0] if isinstance(identity, str) else None
        if (identity not in API_CONDITIONS or identity in indexed or report.get('provider') != provider
                or report.get('split') != 'test' or report.get('reviews') != document['test_reviews']
                or report.get('test_keyset_sha256') != document['test_keyset_sha256']
                or report.get('test_truth_sha256') != document['test_truth_sha256']
                or not MODEL.fullmatch(str(report.get('requested_model')))):
            raise ValueError('API_FINAL_CONDITION_LINEAGE_MISMATCH')
        coverage = _number(report.get('coverage'), 'INVALID_API_COVERAGE', high=1)
        if (type(report.get('successes')) is not int or type(report.get('failures')) is not int
                or report['successes'] < 0 or report['failures'] < 0
                or report['successes'] + report['failures'] != document['test_reviews']
                or not math.isclose(coverage, report['successes'] / document['test_reviews'])
                or report.get('status') != ('COMPLETE' if coverage == 1 else 'PARTIAL_FAILURE')):
            raise ValueError('INCONSISTENT_API_COVERAGE')
        response_models = report.get('response_models')
        if (not isinstance(response_models, list) or len(set(response_models)) != len(response_models)
                or any(not MODEL.fullmatch(str(value)) for value in response_models)
                or (coverage > 0 and not response_models)):
            raise ValueError('INVALID_API_RESPONSE_MODEL_IDENTITIES')
        full_metrics = report.get('full_test_metrics')
        if coverage == 1:
            _metrics(full_metrics, document['test_reviews'], document['label_schema_sha256'])
        elif full_metrics is not None:
            raise ValueError('PARTIAL_API_COVERAGE_CANNOT_HAVE_FULL_TEST_METRICS')
        if report.get('actual_cost') is not None:
            raise ValueError('UNVERIFIED_ACTUAL_API_COST')
        indexed[identity] = report
    if document['real_api_verified'] and (not reports or any(r['coverage'] != 1 for r in reports)):
        raise ValueError('PARTIAL_API_REPORT_MISLABELED_VERIFIED')
    result = []
    for identity in API_CONDITIONS:
        row = _row(identity, 'external_api'); report = indexed.get(identity)
        if report is not None:
            issues = []
            if len(report['response_models']) > 1:
                issues.append('response model changed within this condition')
            counterpart = indexed.get(identity.replace('_baseline', '_prompt') if identity.endswith('_baseline')
                                      else identity.replace('_prompt', '_baseline'))
            if counterpart is not None:
                if report['requested_model'] != counterpart['requested_model']:
                    issues.append('baseline and prompted condition requested different models')
                if report['response_models'] and counterpart['response_models'] and set(report['response_models']) != set(counterpart['response_models']):
                    issues.append('baseline and prompted condition returned different model versions')
            if document['mocked_provider'] and not document['synthetic']:
                issues.append('mock responses cannot establish real-data provider performance')
            usable = report['coverage'] == 1 and not issues
            usage = report.get('usage_totals')
            if not isinstance(usage, dict) or any(not isinstance(k, str) or _number(v, 'INVALID_API_USAGE_TOTAL') is None
                                                 for k, v in usage.items()):
                raise ValueError('INVALID_API_USAGE_TOTAL')
            latency = []
            prediction_path = Path(source) / identity / 'predictions.jsonl'
            if prediction_path.is_file():
                for prediction in rows(prediction_path):
                    if prediction.get('ok') is True and prediction.get('latency_seconds') is not None:
                        latency.append(_number(prediction['latency_seconds'], 'INVALID_API_INFERENCE_TIME'))
            row.update(status='INCOMPARABLE_MODEL_CONDITIONS' if issues else report['status'], run_count=1,
                       coverage=report['coverage'], metrics={name: report['full_test_metrics'][name] if usable else None for name in METRICS},
                       metric_use=('N/A: ' + '; '.join(issues)) if issues else
                                  ('synthetic mock regression only' if document['synthetic'] and document['mocked_provider'] else
                                   'synthetic regression only' if document['synthetic'] else
                                   'same fixed final-test set' if usable else 'N/A: incomplete final-test coverage'),
                       requested_model=report['requested_model'], response_models=report['response_models'],
                       usage_totals=usage or None, usage_coverage=report.get('usage_coverage'),
                       inference_seconds_mean=statistics.mean(latency) if latency else None,
                       inference_timing_scope='mean latency of successful parsed API responses only; failures and cached reuse not separately timed',
                       inference_timed_successes=len(latency),
                       incomparability_reasons=issues, runs=[report])
        result.append(row)
    return result


def _render(destination, document):
    columns = ('condition', 'family', 'status', 'run_count', 'coverage', *METRICS,
               'macro_f1_seed_sample_std', 'inference_seconds_mean', 'requested_model', 'response_models',
               'usage_totals', 'actual_cost', 'metric_use')
    with (destination / 'comparison.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=columns); writer.writeheader()
        for row in document['conditions']:
            data = {**row, **row['metrics']}
            writer.writerow({key: 'N/A' if data.get(key) is None else data[key] for key in columns})
    def shown(value):
        return 'N/A' if value is None else f'{value:.4f}'
    lines = ['# Fixed final-test model comparison', '',
             'Evidence: ' + ('SYNTHETIC; not Korean gold accuracy.' if document['synthetic'] else 'real-data reports; see provider verification and coverage below.'), '',
             '| Condition | Family | Runs | Coverage | All-label macro F1 | Supported macro F1 | Micro F1 | Status |',
             '|---|---|---:|---:|---:|---:|---:|---|']
    for row in document['conditions']:
        lines.append('| ' + ' | '.join((row['condition'], row['family'], str(row['run_count']), shown(row['coverage']),
                                        shown(row['metrics'][METRICS[0]]), shown(row['metrics'][METRICS[1]]),
                                        shown(row['metrics']['micro_f1']), row['status'])) + ' |')
    lines += ['', 'Models remain in predefined order. Final-test scores do not change the pre-test selected local model.',
              'All-label macro includes absent labels as zero; supported macro uses only labels present in final truth.',
              'A single run has no seed-variation estimate. Multiple local seeds use sample standard deviation, not a confidence interval.',
              'Missing/partial/confounded API metrics are N/A. Successful-subset API metrics remain in JSON and are not substituted for full-test F1.',
              'API versions that drift between baseline/prompt conditions are identified as incomparable.',
              'Actual API cost remains unknown: no invoice or pricing estimate has been supplied.',
              'Local batch timings include model load; API timings describe successful requests. These are different timing populations.',
              'Binary API decisions do not supply probability scores for PR/ROC curves.',
              'Real API verified: ' + str(document['real_api_verified']), '',
              'No deployment, accuracy threshold, automatic model reselection or release approval is implied.']
    (destination / 'REPORT.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    conditions = document['conditions']; x = list(range(len(conditions)))
    fig, ax = plt.subplots(figsize=(12, 5), layout='constrained')
    for offset, metric, color in ((-.18, METRICS[0], '#337ab7'), (.18, METRICS[1], '#eb9b34')):
        positions = [index + offset for index in x]
        values = [row['metrics'][metric] for row in conditions]
        ax.bar([p for p, value in zip(positions, values) if value is not None],
               [value for value in values if value is not None], width=.34,
               label='All-label Macro F1' if metric == METRICS[0] else 'Supported-label Macro F1', color=color)
    for index, row in enumerate(conditions):
        if row['metrics'][METRICS[0]] is None:
            ax.text(index, .03, 'N/A', ha='center', va='bottom', rotation=90)
        elif row['macro_f1_seed_sample_std'] is not None:
            ax.errorbar(index - .18, row['metrics'][METRICS[0]], yerr=row['macro_f1_seed_sample_std'],
                        fmt='none', ecolor='#222222', capsize=3)
    ax.axvline(3.5, color='#aaaaaa', linewidth=1)
    ax.set_xticks(x, [row['condition'] for row in conditions], rotation=25, ha='right')
    ax.set_ylim(0, 1); ax.set_ylabel('Fixed final-test F1')
    ax.set_title(('SYNTHETIC regression only — ' if document['synthetic'] else '') +
                 'Local models / External API conditions; N/A means unavailable or incomparable')
    ax.legend(); fig.savefig(destination / 'comparison.png', dpi=150); plt.close(fig)


def combine(local, destination, external=None):
    """Write eight fixed rows, retaining unavailable conditions and sealed provenance."""
    local_root = Path(local); local_meta = verify(local_root); local_doc = read(local_root / 'final.json')
    _lineage(local_doc, local_meta)
    conditions = _local_rows(local_doc)
    external_doc = None
    if external is not None:
        api_root = Path(external); api_meta = verify(api_root); external_doc = read(api_root / 'comparison.json')
        _lineage(external_doc, api_meta)
        if any(local_doc[field] != external_doc[field] for field in LINEAGE):
            raise ValueError('LOCAL_API_FINAL_TEST_LINEAGE_MISMATCH')
        if local_doc['synthetic'] is not external_doc['synthetic']:
            raise ValueError('LOCAL_API_SYNTHETIC_STATUS_MISMATCH')
        if api_meta.get('mocked_provider') is not external_doc.get('mocked_provider'):
            raise ValueError('API_MOCK_STATUS_MISMATCH')
        conditions += _api_rows(external_doc, api_root)
    else:
        conditions += [_row(identity, 'external_api') for identity in API_CONDITIONS]
    api_rows = [row for row in conditions if row['family'] == 'external_api']
    real_verified = bool(external_doc is not None and external_doc['real_api_verified']
                         and not external_doc['mocked_provider'] and all(row['status'] == 'COMPLETE' for row in api_rows))
    document = {**{field: local_doc[field] for field in LINEAGE},
                'schema': 'review-combined-comparison-v1', 'synthetic': local_doc['synthetic'],
                'conditions': conditions, 'condition_order': list(LOCAL_KINDS) + list(API_CONDITIONS),
                'local_final_artifact_sha256': file_hash(local_root / 'READY.json'),
                'external_final_artifact_sha256': file_hash(Path(external) / 'READY.json') if external is not None else None,
                'selected_local_model_before_test': local_doc.get('selected_path'),
                'selection_changed_after_test': False, 'test_used_for_prompt_selection': False,
                'mocked_provider': external_doc['mocked_provider'] if external_doc is not None else None,
                'real_api_verified': real_verified,
                'eight_condition_performance_comparison_ready': (not local_doc['synthetic'] and real_verified
                                                                 and all(row['status'] == 'COMPLETE' for row in conditions)),
                'actual_api_cost': None, 'release_approved': False,
                'uncertainty': 'single runs do not estimate seed variation; supported and all-label macro have different denominators',
                'limits': ['sealed report contracts are validated; hash equality does not prove annotation quality',
                           'no final-test selection, automatic ranking winner, cost estimate or probability curves for API binary decisions']}
    target = Path(destination); target.mkdir(parents=True, exist_ok=False)
    write(target / 'comparison.json', document); _render(target, document)
    seal(target, {'schema': document['schema'], 'synthetic': document['synthetic'],
                  'mocked_provider': document['mocked_provider'], 'real_api_verified': real_verified,
                  'database_writes': False, 'external_calls': 0})
    return {'conditions': len(conditions), 'complete_conditions': sum(row['status'] == 'COMPLETE' for row in conditions),
            'real_api_verified': real_verified, 'synthetic': document['synthetic'], 'release_approved': False}
