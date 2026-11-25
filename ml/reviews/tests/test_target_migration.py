import copy
import tempfile
import unittest
from pathlib import Path
from ml.reviews.common import digest, file_hash, fingerprint, read, rows, seal, write, write_rows
from ml.reviews.contract import POLICY, labels, rollup, taxonomy, validate
from ml.reviews.dataset import check_registry
from ml.reviews.migrate import migrate
from ml.reviews.summarize import summarize
from ml.reviews.tests.fixtures import approvals, record


class MigrationTest(unittest.TestCase):
    def test_migrate_preserves_exact_originals_and_human_history_without_new_approval(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); source = root / 'old.json'; ledger = root / 'old-approvals.jsonl'
            row = record(); row['taxonomy_version'] = 'v0.3'; row['taxonomy_sha256'] = 'synthetic-old-taxonomy'
            row['annotations'][0].pop('target_code'); row['human_reviewed'] = True
            write(source, {'records': [row]}); write_rows(ledger, approvals(row))
            source_before = file_hash(source); ledger_before = file_hash(ledger)
            out = root / 'migration'; summary = migrate(source, ledger, out)
            self.assertEqual(file_hash(out / 'original-source.json'), source_before)
            self.assertEqual(file_hash(out / 'original-approvals.jsonl'), ledger_before)
            self.assertEqual(file_hash(source), source_before); self.assertEqual(file_hash(ledger), ledger_before)
            revised = read(out / 'reclassification.json')['records'][0]
            self.assertTrue(revised['human_reviewed']); self.assertEqual(revised['clean_text'], row['clean_text'])
            self.assertEqual(revised['annotations'][0]['polarity'], row['annotations'][0]['polarity'])
            self.assertIsNone(revised['annotations'][0]['target_code'])
            self.assertEqual(revised['active_opinion_ids'], []); self.assertEqual(revised['held_opinion_ids'], ['o1'])
            self.assertFalse(validate(revised, rows(ledger))['eligible'])
            self.assertTrue(all(a['decision'] == 'pending' for a in rows(out / 'pending-approval-candidates.jsonl')))
            self.assertEqual(summary['auto_reclassified_opinions'], 0); self.assertEqual(summary['new_human_approvals'], 0)

    def test_migration_cannot_reset_already_current_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); write(root / 'source.json', {'records': [record()]})
            write_rows(root / 'ledger.jsonl', [])
            with self.assertRaisesRegex(ValueError, 'ALREADY_CURRENT'):
                migrate(root / 'source.json', root / 'ledger.jsonl', root / 'out')
            self.assertFalse((root / 'out').exists())

    def test_root_confirmation_cannot_hide_missing_operations_or_proposal_children(self):
        from ml.reviews.taxonomy import require_confirmed
        tax = copy.deepcopy(taxonomy()); tax['status'] = 'confirmed'
        with self.assertRaisesRegex(ValueError, 'FULL_CONFIRMED'):
            require_confirmed(tax, False)

    def test_duplicate_targets_and_wrong_parent_schema_rejected(self):
        for change in ('duplicate', 'parent'):
            tax = copy.deepcopy(taxonomy())
            if change == 'duplicate':
                tax['categories'][0]['targets'].append(copy.deepcopy(tax['categories'][0]['targets'][0]))
            else:
                tax['categories'][0]['targets'][0]['code'] = 'SOUND.MUSIC'
            with self.assertRaisesRegex(ValueError, 'TARGET'):
                taxonomy(tax)

    def test_registry_inventory_accepts_actual_new_batches_without_fixed_50_10_assumption(self):
        registry = {'schema': 'pilot-reference-registry-v2', 'complete': True, 'source_ref': 'synthetic-verification',
                    'inventory': [{'id': 'synthetic-new-batch', 'expected_count': 2, 'source_sha256': digest('synthetic-file')}],
                    'batches': [{'id': 'synthetic-new-batch', 'expected_count': 2, 'keys': ['synthetic:a', 'synthetic:b']}]}
        self.assertEqual(len(check_registry(registry)), 2)
        registry['batches'][0]['keys'].pop()
        with self.assertRaisesRegex(ValueError, 'COUNT_MISMATCH'):
            check_registry(registry)


class SummaryTest(unittest.TestCase):
    def fixture(self, root, mutation=None):
        target = root / 'predictions'; target.mkdir(); tax = taxonomy()
        selected = ['SOUND.MUSIC::긍정', 'SOUND.VOICE_ACTING::부정']
        common = {'classification_unit': 'evaluation_target', 'taxonomy_sha256': fingerprint(tax),
                  'policy_sha256': fingerprint(POLICY), 'model_sha256': digest('synthetic-model'),
                  'synthetic_model': True, 'threshold': .5}
        data = [{**common, 'key': 'synthetic-g:synthetic-r', 'appid': 'synthetic-g',
                 'source_revision': 'synthetic-r1', 'snapshot_id': 'synthetic-s1',
                 'state': 'PREDICTED_TARGETS', 'labels': selected,
                 'scores': {label: float(label in selected) for label in labels(tax)}, 'aspect_summary': rollup(selected)}]
        if mutation:
            mutation(data)
        write(target / 'taxonomy.json', tax); write_rows(target / 'predictions.jsonl', data)
        seal(target, {**common, 'rows': len(data)})
        return target

    def test_parent_keeps_two_polarities_but_counts_one_review(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); source = self.fixture(root)
            result = summarize(source, root / 'summary')
            self.assertEqual(result['successful_reviews'], 1)
            game = read(root / 'summary/summary.json')['games']['synthetic-g']
            self.assertEqual(game['parent_review_presence']['SOUND'], 1)
            self.assertEqual(game['target_counts']['SOUND.MUSIC']['긍정'], 1)
            self.assertEqual(game['target_counts']['SOUND.VOICE_ACTING']['부정'], 1)
            self.assertEqual(len(game['parent_details']['SOUND']), 2)
            self.assertNotIn('혼합', game['parent_review_presence'])

    def test_same_review_different_revision_is_not_double_counted(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.fixture(root, lambda data: data.append({**data[0], 'source_revision': 'synthetic-r2'}))
            with self.assertRaisesRegex(ValueError, 'DUPLICATE_REVIEW_REVISION'):
                summarize(source, root / 'summary')
            self.assertFalse((root / 'summary').exists())

    def test_version_mixing_and_cross_snapshot_comparison_blocked(self):
        for field, value, error in [('model_sha256', 'different', 'MIXED_PREDICTION_LINEAGE'),
                                    ('taxonomy_sha256', 'different', 'MIXED_PREDICTION_LINEAGE'),
                                    ('snapshot_id', 'synthetic-s2', 'MIXED_SNAPSHOTS')]:
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                def mutate(data):
                    data.append({**data[0], 'key': 'synthetic-g:synthetic-other', field: value})
                source = self.fixture(root, mutate)
                with self.assertRaisesRegex(ValueError, error):
                    summarize(source, root / 'summary')

    def test_invalid_state_and_parent_flattening_rejected(self):
        for change, error in [('legacy-state', 'UNKNOWN_PREDICTION_STATE'), ('flatten-parent', 'PARENT_VIEW_CONFLICT')]:
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                def mutate(data):
                    if change == 'legacy-state':
                        data[0]['state'] = 'PREDICTED_ASPECTS'
                    else:
                        data[0]['aspect_summary'] = {'SOUND': '혼합'}
                source = self.fixture(root, mutate)
                with self.assertRaisesRegex(ValueError, error):
                    summarize(source, root / 'summary')

    def test_missing_bad_or_contradicting_scores_rejected_before_aggregation(self):
        for change, error in [('missing', 'INVALID_TARGET_SCORES'), ('range', 'INVALID_TARGET_SCORES'),
                              ('contradiction', 'SCORES_DISAGREE')]:
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                def mutate(data):
                    if change == 'missing':
                        data[0]['scores'] = {}
                    elif change == 'range':
                        data[0]['scores']['SOUND.MUSIC::긍정'] = 5
                    else:
                        data[0]['scores']['SOUND.MUSIC::긍정'] = 0
                source = self.fixture(root, mutate)
                with self.assertRaisesRegex(ValueError, error):
                    summarize(source, root / 'summary')

    def test_no_target_prediction_is_successful_inference_not_human_no_evaluation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def mutate(data):
                data[0].update(state='NO_TARGET_PREDICTED', labels=[], aspect_summary={},
                               scores={label: 0. for label in labels()})
            source = self.fixture(root, mutate); summarize(source, root / 'summary')
            result = read(root / 'summary/summary.json'); game = result['games']['synthetic-g']
            self.assertEqual(game['successful_review_predictions'], 1)
            self.assertEqual(game['no_target_predicted_reviews'], 1)
            self.assertFalse(game['target_counts'])
            self.assertTrue(any('not human-confirmed' in message for message in result['limits']))

    def test_held_prediction_not_added_as_zero_observation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def mutate(data):
                data.append({**data[0], 'key': 'synthetic-g:synthetic-held', 'state': 'HELD_LONG_INPUT',
                             'labels': None, 'scores': None, 'aspect_summary': None})
            source = self.fixture(root, mutate); summarize(source, root / 'summary')
            result = read(root / 'summary/summary.json')
            self.assertEqual(result['input_rows'], 2); self.assertEqual(result['states']['HELD_LONG_INPUT'], 1)
            self.assertEqual(result['games']['synthetic-g']['successful_review_predictions'], 1)
