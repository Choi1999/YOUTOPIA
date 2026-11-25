import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from ml.reviews.common import digest, fingerprint, read, seal, verify, write, write_rows
from ml.reviews.comparison import API_CONDITIONS, LINEAGE, LOCAL_KINDS, combine
from ml.reviews.models import metrics


LABELS = ['SOUND.MUSIC_BGM::긍정', 'SOUND.MUSIC_BGM::부정']


def fixture(root, local_change=None, api_change=None, synthetic=True, mocked=True):
    scope = {'body': 'clean_text', 'metadata': [], 'max_tokens': 64}
    lineage = {name: digest(name) for name in LINEAGE if name.endswith('_sha256')}
    lineage.update(input_scope=scope, input_scope_sha256=fingerprint(scope), split='test', test_reviews=2,
                   label_schema_sha256=fingerprint(LABELS))
    score = metrics(np.array([[1, 0], [0, 0]]), np.array([[1, 0], [0, 0]]), LABELS)
    local_reports = [{**copy.deepcopy(score), 'kind': kind, 'seed': 42, 'model': kind + '-42',
                      'split': 'test', 'coverage': 1., 'selected_before_test': kind == 'frozen',
                      'inference_seconds': .1, 'timing_scope': 'synthetic-test-only'} for kind in LOCAL_KINDS]
    local_doc = {**lineage, 'reports': local_reports, 'synthetic': synthetic,
                 'selected_path': 'frozen-42', 'selection_changed_after_test': False, 'release_approved': False}
    api_reports = []
    for condition in API_CONDITIONS:
        provider = condition.split('_')[0]
        api_reports.append({'condition': condition, 'provider': provider, 'requested_model': 'synthetic-' + provider,
                            'response_models': ['synthetic-' + provider], 'split': 'test',
                            'test_keyset_sha256': lineage['test_keyset_sha256'],
                            'test_truth_sha256': lineage['test_truth_sha256'],
                            'reviews': 2, 'successes': 2, 'failures': 0, 'coverage': 1., 'status': 'COMPLETE',
                            'full_test_metrics': copy.deepcopy(score), 'metrics_successful_subset': copy.deepcopy(score),
                            'actual_cost': None, 'usage_totals': {'input_tokens': 20, 'output_tokens': 10},
                            'usage_coverage': 'synthetic successful responses only'})
    api_doc = {**copy.deepcopy(lineage), 'schema': 'review-api-benchmark-report-v1',
               'reports': api_reports, 'synthetic': synthetic, 'mocked_provider': mocked,
               'real_api_verified': not mocked, 'test_used_for_prompt_selection': False,
               'automatic_model_reselection': False, 'release_approved': False}
    if local_change:
        local_change(local_doc)
    if api_change:
        api_change(api_doc)
    local = root / 'local'; local.mkdir(); write(local / 'final.json', local_doc)
    seal(local, {'split': 'test', 'synthetic': synthetic})
    api = root / 'api'; api.mkdir(); write(api / 'comparison.json', api_doc)
    for condition in API_CONDITIONS:
        folder = api / condition; folder.mkdir()
        write_rows(folder / 'predictions.jsonl', [{'ok': True, 'latency_seconds': .01}, {'ok': True, 'latency_seconds': .02}])
    seal(api, {'schema': api_doc['schema'], 'synthetic': synthetic, 'mocked_provider': mocked})
    return local, api


class ComparisonTest(unittest.TestCase):
    def test_eight_conditions_reports_csv_png_markdown_and_no_fake_cost_or_seed_error(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); local, api = fixture(root)
            result = combine(local, root / 'combined', api)
            self.assertEqual(result['conditions'], 8); self.assertEqual(result['complete_conditions'], 8)
            report = read(root / 'combined/comparison.json'); verify(root / 'combined')
            self.assertEqual(report['condition_order'], list(LOCAL_KINDS) + list(API_CONDITIONS))
            self.assertEqual(report['selected_local_model_before_test'], 'frozen-42')
            self.assertFalse(report['selection_changed_after_test']); self.assertFalse(report['real_api_verified'])
            self.assertFalse(report['eight_condition_performance_comparison_ready'])
            self.assertIsNone(report['actual_api_cost'])
            for row in report['conditions']:
                self.assertEqual(row['run_count'], 1)
                self.assertIsNone(row['macro_f1_seed_sample_std']); self.assertIsNone(row['actual_cost'])
                self.assertEqual(row['metrics']['macro_f1_all_labels_zero_division_0'], .5)
                self.assertEqual(row['metrics']['macro_f1_supported'], 1.)
            self.assertEqual(report['conditions'][4]['inference_timed_successes'], 2)
            for name in ('comparison.json', 'comparison.csv', 'comparison.png', 'REPORT.md', 'READY.json'):
                self.assertGreater((root / 'combined' / name).stat().st_size, 0)
            self.assertIn('SYNTHETIC', (root / 'combined/REPORT.md').read_text())

    def test_missing_api_conditions_remain_na_not_zero(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); local, _ = fixture(root)
            with patch('ml.reviews.comparison._render'):
                combine(local, root / 'combined')
            report = read(root / 'combined/comparison.json')
            self.assertEqual(len(report['conditions']), 8)
            for row in report['conditions'][4:]:
                self.assertEqual(row['status'], 'NOT_RUN'); self.assertIsNone(row['coverage'])
                self.assertTrue(all(value is None for value in row['metrics'].values()))

    def test_partial_api_full_test_f1_is_na_and_subset_score_does_not_replace_it(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def partial(document):
                document['reports'][0].update(successes=1, failures=1, coverage=.5,
                                               status='PARTIAL_FAILURE', full_test_metrics=None)
            local, api = fixture(root, api_change=partial)
            with patch('ml.reviews.comparison._render'):
                combine(local, root / 'combined', api)
            row = read(root / 'combined/comparison.json')['conditions'][4]
            self.assertEqual(row['coverage'], .5); self.assertEqual(row['status'], 'PARTIAL_FAILURE')
            self.assertIsNone(row['metrics']['micro_f1'])
            self.assertEqual(row['runs'][0]['metrics_successful_subset']['micro_f1'], 1.)

    def test_partial_coverage_cannot_claim_complete_score_or_real_verification(self):
        for bad_field in ('full_test_metrics', 'real_api_verified'):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                def bad(document):
                    report = document['reports'][0]
                    report.update(successes=1, failures=1, coverage=.5, status='PARTIAL_FAILURE')
                    if bad_field == 'real_api_verified':
                        report['full_test_metrics'] = None; document['real_api_verified'] = True
                local, api = fixture(root, api_change=bad, synthetic=False, mocked=False)
                with self.assertRaisesRegex(ValueError, 'PARTIAL_API'):
                    combine(local, root / 'combined', api)
                self.assertFalse((root / 'combined').exists())

    def test_each_common_lineage_dimension_must_match(self):
        for field in LINEAGE:
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                def bad(document):
                    if field == 'input_scope':
                        document[field] = {'different': 'metadata-assisted'}
                        document['input_scope_sha256'] = fingerprint(document[field])
                    elif field == 'split':
                        document[field] = 'validation'
                    elif field == 'test_reviews':
                        document[field] += 1
                    else:
                        document[field] = digest('different-' + field)
                local, api = fixture(root, api_change=bad)
                with self.assertRaises(ValueError):
                    combine(local, root / 'combined', api)
                self.assertFalse((root / 'combined').exists())

    def test_tampering_and_synthetic_or_mock_mislabel_are_rejected(self):
        for mutation in ('tamper', 'synthetic', 'mock'):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary); local, api = fixture(root)
                document = read(api / 'comparison.json')
                if mutation == 'synthetic':
                    document['synthetic'] = False
                elif mutation == 'mock':
                    document['mocked_provider'] = False
                else:
                    document['test_reviews'] = 100
                write(api / 'comparison.json', document)
                if mutation != 'tamper':
                    seal(api, {'synthetic': True, 'mocked_provider': True})
                with self.assertRaises(ValueError):
                    combine(local, root / 'combined', api)

    def test_model_version_drift_is_visible_and_not_ranked_as_prompt_improvement(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            local, api = fixture(root, api_change=lambda document: document['reports'][1].update(response_models=['synthetic-openai-new']))
            with patch('ml.reviews.comparison._render'):
                combine(local, root / 'combined', api)
            report = read(root / 'combined/comparison.json')
            for row in report['conditions'][4:6]:
                self.assertEqual(row['status'], 'INCOMPARABLE_MODEL_CONDITIONS')
                self.assertTrue(row['incomparability_reasons']); self.assertIsNone(row['metrics']['micro_f1'])
                self.assertIsNotNone(row['runs'][0]['full_test_metrics'])

    def test_mock_on_real_data_cannot_be_presented_as_provider_performance(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); local, api = fixture(root, synthetic=False, mocked=True)
            with patch('ml.reviews.comparison._render'):
                combine(local, root / 'combined', api)
            report = read(root / 'combined/comparison.json')
            self.assertFalse(report['real_api_verified'])
            for row in report['conditions'][4:]:
                self.assertIsNone(row['metrics']['micro_f1'])
                self.assertTrue(any('mock responses' in text for text in row['incomparability_reasons']))

    def test_seed_counts_have_sample_std_and_missing_local_kind_stays_na(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def change(document):
                duplicate = copy.deepcopy(document['reports'][2]); duplicate.update(seed=73, model='frozen-73', selected_before_test=False)
                document['reports'].append(duplicate); document['reports'] = [row for row in document['reports'] if row['kind'] != 'textcnn']
            local, _ = fixture(root, local_change=change)
            with patch('ml.reviews.comparison._render'):
                combine(local, root / 'combined')
            conditions = read(root / 'combined/comparison.json')['conditions']
            self.assertEqual(conditions[2]['seeds'], [42, 73]); self.assertEqual(conditions[2]['macro_f1_seed_sample_std'], 0.)
            self.assertEqual(conditions[1]['status'], 'NOT_RUN'); self.assertIsNone(conditions[1]['metrics']['micro_f1'])

    def test_final_selection_or_prompt_selection_may_not_change(self):
        for side, field, value in [('local', 'selection_changed_after_test', True),
                                    ('local', 'selected_path', 'full-42'),
                                    ('api', 'test_used_for_prompt_selection', True),
                                    ('api', 'automatic_model_reselection', True)]:
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary); mutation = lambda document: document.update({field: value})
                local, api = fixture(root, local_change=mutation if side == 'local' else None,
                                     api_change=mutation if side == 'api' else None)
                with self.assertRaisesRegex(ValueError, 'SELECTION|RESELECTION'):
                    combine(local, root / 'combined', api)

    def test_invalid_label_mapping_and_metric_counts_are_rejected(self):
        for change in ('label', 'count', 'score'):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                def bad(document):
                    report = document['reports'][0]
                    if change == 'label':
                        report['per_label'][0]['label'] = 'SOUND.SFX::긍정'
                    elif change == 'count':
                        report['per_label'][0]['support'] = 2
                    else:
                        report['macro_f1_all_labels_zero_division_0'] = 1.
                local, api = fixture(root, local_change=bad)
                with self.assertRaises(ValueError):
                    combine(local, root / 'combined', api)

    def test_claimed_cost_without_invoice_is_not_accepted_as_actual(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            local, api = fixture(root, api_change=lambda document: document['reports'][0].update(actual_cost=0))
            with self.assertRaisesRegex(ValueError, 'UNVERIFIED_ACTUAL_API_COST'):
                combine(local, root / 'combined', api)
