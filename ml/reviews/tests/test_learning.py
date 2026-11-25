import copy
import os
import socket
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
from ml.reviews.common import digest, file_hash, read, rows, write, write_rows
from ml.reviews.contract import labels
from ml.reviews.dataset import build, check_leakage, load
from ml.reviews.experiment import batch_predict, final_test, train
from ml.reviews.models import checked, decode, fit, metrics, network, predict, select_threshold
from ml.reviews.tests.fixtures import approvals, inputs, record, tiny_base


class LearningTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Downloaded libraries, random locally created encoder. No model/API network.
        cls.net_guard = patch.object(socket.socket, 'connect', side_effect=AssertionError('TEST_NETWORK_FORBIDDEN'))
        cls.net_guard.start()
        import torch
        torch.set_num_threads(1)
        cls.tmp = tempfile.TemporaryDirectory(); cls.root = Path(cls.tmp.name)
        cls.base = tiny_base(cls.root / 'base'); cls.records = inputs(cls.root)
        cls.dataset = cls.root / 'dataset'
        build(cls.root / 'source.json', cls.root / 'approvals.jsonl', cls.root / 'registry.json',
              cls.base, cls.dataset, max_tokens=64)
        cls.experiment = cls.root / 'experiment'
        cls.selection = train(cls.dataset, cls.base, cls.experiment, seeds=(13, 42), epochs=2, batch_size=8)
        cls.model = cls.experiment / cls.selection['selected_path']

    @classmethod
    def tearDownClass(cls):
        cls.net_guard.stop(); cls.tmp.cleanup()

    def test_all_four_real_trainers_two_seeds_save_reload_and_finite_scores(self):
        self.assertEqual(len(self.selection['experiments']), 8)
        for item in self.selection['experiments']:
            scores, report = predict(self.experiment / item['path'], ['음악 좋다'])
            self.assertEqual(scores.shape, (1, len(labels()))); self.assertTrue(np.isfinite(scores).all())
            self.assertTrue(report['synthetic']); self.assertFalse(report['test_used_for_selection'])
            self.assertIn('unlearnable_labels', report)

    def test_final_test_keeps_validation_selection_and_blocks_repeat(self):
        before = file_hash(self.experiment / 'selection.json')
        result = final_test(self.dataset, self.experiment, self.root / 'final')
        self.assertEqual(result['models_evaluated'], 8); self.assertFalse(result['release_approved'])
        self.assertEqual(file_hash(self.experiment / 'selection.json'), before)
        with self.assertRaises(FileExistsError):
            final_test(self.dataset, self.experiment, self.root / 'second-final')

    def test_metrics_unsupported_not_accuracy_claim_and_threshold_uses_validation(self):
        truth = np.zeros((2, len(labels())), dtype=int); truth[:, 0] = [1, 0]
        scores = np.zeros((2, len(labels()))); scores[:, 0] = [.8, .1]
        chosen, _ = select_threshold(truth, scores, labels())
        self.assertEqual(chosen['threshold'], .5)
        report = chosen['metrics']
        self.assertAlmostEqual(report['macro_f1_all_labels_zero_division_0'], 1 / len(labels()))
        self.assertEqual(report['macro_f1_supported'], 1)
        self.assertIsNone(report['per_label'][1]['f1'])

    def test_same_leaf_preserves_both_polarity_outputs(self):
        scores = np.zeros((1, len(labels()))); scores[0, :2] = [.8, .9]
        self.assertEqual(int(decode(scores, .5, labels())[0, :2].sum()), 2)

    def test_nonfinite_out_of_range_and_bad_shape_scores_fail(self):
        for scores in (np.full((1, len(labels())), np.nan), np.full((1, len(labels())), np.inf),
                       np.full((1, len(labels())), -1), np.zeros((1, len(labels()) + 1))):
            with self.assertRaisesRegex(ValueError, 'INVALID_MODEL_SCORES'):
                checked(scores, 1, labels())

    def test_frozen_encoder_has_no_grad_but_trained_head_has_grad(self):
        import torch
        from ml.reviews.models import token_batch
        from transformers import AutoTokenizer
        model = network('frozen', self.base, len(labels()), True); model.train()
        tokenizer = AutoTokenizer.from_pretrained(self.base, local_files_only=True)
        output = model(token_batch(tokenizer, ['음악 좋다'], 64, 'cpu')).sum(); output.backward()
        self.assertFalse(model.encoder.training)
        self.assertTrue(all(p.grad is None for p in model.encoder.parameters()))
        self.assertTrue(any(p.grad is not None for p in model.head.parameters()))

    def test_long_input_never_truncated_for_any_model(self):
        for item in self.selection['experiments']:
            with self.assertRaisesRegex(ValueError, 'LONG_BODY_HELD'):
                predict(self.experiment / item['path'], ['음악 ' * 100])

    def test_safe_batch_states_and_lineage(self):
        good = {'appid': 'synthetic-a', 'review_id': 'synthetic-b', 'key': 'synthetic-a:synthetic-b',
                'text': '음악 좋다', 'text_sha256': digest('음악 좋다'), 'source_revision': 'synthetic-rev1',
                'snapshot_id': 'synthetic-snapshot'}
        long = {**good, 'key': 'synthetic-a:synthetic-long', 'review_id': 'synthetic-long',
                'text': '음악 ' * 100, 'text_sha256': digest('음악 ' * 100)}
        invalid = {**good, 'source_revision': None}
        source = self.root / 'inference.jsonl'; write_rows(source, [good, long, invalid])
        batch_predict(source, self.model, self.root / 'inference')
        result = rows(self.root / 'inference/predictions.jsonl')
        self.assertIn(result[0]['state'], ('PREDICTED_TARGETS', 'NO_TARGET_PREDICTED'))
        self.assertEqual(result[1]['state'], 'HELD_LONG_INPUT'); self.assertIsNone(result[1]['labels'])
        self.assertEqual(result[2]['state'], 'REJECTED_INPUT'); self.assertIsNone(result[2]['scores'])
        self.assertTrue(all(r['evidence_spans'] is None for r in result))
        self.assertEqual(result[0]['snapshot_id'], good['snapshot_id'])
        from ml.reviews.summarize import summarize
        summary = summarize(self.root / 'inference', self.root / 'inference-summary')
        self.assertEqual(summary['successful_reviews'], 1)
        self.assertEqual(summary['input_rows'], 3)

    def test_model_failure_does_not_write_success_artifact(self):
        source = self.root / 'fail-input.jsonl'
        write_rows(source, [{'appid': 's', 'review_id': 'r', 'key': 's:r', 'text': '음악 좋다',
                            'text_sha256': digest('음악 좋다'), 'source_revision': 'r1', 'snapshot_id': 's1'}])
        with patch('ml.reviews.models.Predictor.score', side_effect=ValueError('INVALID_MODEL_SCORES')):
            with self.assertRaisesRegex(ValueError, 'INVALID_MODEL_SCORES'):
                batch_predict(source, self.model, self.root / 'failed-output')
        self.assertFalse((self.root / 'failed-output').exists())

    def test_dataset_hash_tampering_rejected(self):
        import shutil
        altered = self.root / 'tampered'; shutil.copytree(self.dataset, altered)
        with (altered / 'train.jsonl').open('a') as stream:
            stream.write('\n')
        with self.assertRaisesRegex(ValueError, 'HASH_MISMATCH'):
            load(altered, 'train')

    def test_cross_split_duplicate_body_rejected(self):
        row = {'text': '음악 좋다', 'key': 'synthetic:one'}
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_BODY'):
            check_leakage({'train': [row], 'test': [{**row, 'key': 'synthetic:two'}]})

    def test_build_holds_long_review_and_excludes_registered_pilot_preserving_body(self):
        source = read(self.root / 'source.json'); ledger = rows(self.root / 'approvals.jsonl')
        long = record('synthetic-long', 'synthetic-long', '음악 ' * 100)
        source['records'].append(long); ledger.extend(approvals(long))
        source_path = self.root / 'long-source.json'; approval_path = self.root / 'long-approvals.jsonl'
        registry = read(self.root / 'registry.json'); registry['batches'][0]['keys'] = [source['records'][0]['key']]
        registry_path = self.root / 'long-registry.json'
        write(source_path, source); write_rows(approval_path, ledger); write(registry_path, registry)
        out = self.root / 'long-dataset'
        summary = build(source_path, approval_path, registry_path, self.base, out, max_tokens=64)
        held = next(r for r in rows(out / 'workbench.jsonl') if r['key'] == long['key'])
        self.assertEqual(held['text'], long['clean_text']); self.assertFalse(held['eligible'])
        self.assertIn('LONG_BODY_HELD_NO_TRUNCATION', held['reasons'])
        self.assertEqual(summary['eligible_reviews'], 59)

    def test_training_rejects_dataset_from_different_base(self):
        from ml.reviews.common import seal
        altered = self.root / 'other-base'; altered.mkdir(); write(altered / 'config.json', {})
        seal(altered, {'synthetic': True})
        with self.assertRaisesRegex(ValueError, 'BASE_IDENTITY_CHANGED'):
            fit(self.dataset, altered, self.root / 'wrong-model', 'tfidf')

    def test_legacy_base_import_rejects_unpinned_config_before_model_loading(self):
        from ml.reviews.assets import import_base
        bogus = self.root / 'bogus-base'; bogus.mkdir(); write(bogus / 'config.json', {})
        with self.assertRaisesRegex(ValueError, 'CONFIG_OR_TOKENIZER_HASH'):
            import_base(bogus, self.root / 'bogus-import')

    def test_cli_help_and_contract_audit_need_no_api_or_gpu(self):
        import subprocess
        result = subprocess.run([os.sys.executable, '-m', 'ml.reviews', '--help'],
                                text=True, capture_output=True, check=True)
        self.assertIn('approval-candidates', result.stdout)

    def test_custom_taxonomy_shapes_survive_training_and_reload(self):
        from ml.reviews.contract import taxonomy
        tax = copy.deepcopy(taxonomy()); tax['version'] = 'synthetic-custom-v2'
        tax['categories'] = [category for category in tax['categories'] if category['code'] in ('SOUND', 'TECHNICAL')]
        for category in tax['categories']:
            category['subaspects'] = [t for t in category['subaspects'] if t['leaf_id'] in ('SOUND.MUSIC_BGM', 'TECHNICAL.CRASH_FREEZE')]
        tax_path = self.root / 'custom-taxonomy.json'; write(tax_path, tax)
        source = read(self.root / 'source.json'); ledger = []
        from ml.reviews.common import fingerprint
        for row in source['records']:
            row['taxonomy_version'] = tax['version']; row['taxonomy_sha256'] = fingerprint(tax)
            ledger.extend(approvals(row))
        write(self.root / 'custom-source.json', source); write_rows(self.root / 'custom-ledger.jsonl', ledger)
        out = self.root / 'custom-dataset'
        build(self.root / 'custom-source.json', self.root / 'custom-ledger.jsonl', self.root / 'registry.json',
              self.base, out, max_tokens=64, taxonomy_path=tax_path)
        for kind in ('tfidf', 'textcnn', 'frozen', 'full'):
            model = self.root / ('custom-' + kind)
            fit(out, self.base, model, kind, epochs=1, batch_size=8)
            scores, report = predict(model, ['음악 좋다'])
            self.assertEqual(scores.shape, (1, 4)); self.assertEqual(report['dataset']['taxonomy']['version'], tax['version'])

    def test_old_coarse_model_and_dataset_cannot_be_reinterpreted_as_fine_targets(self):
        from ml.reviews.common import seal
        coarse = self.root / 'old-model'; coarse.mkdir()
        write(coarse / 'report.json', {'dataset': {'contract': 'review-training-v1'}})
        seal(coarse, {'synthetic': True})
        with self.assertRaisesRegex(ValueError, 'LEGACY_COARSE_MODEL'):
            predict(coarse, ['음악 좋다'])
        data = self.root / 'old-dataset'; data.mkdir(); write(data / 'old.json', {})
        seal(data, {'contract': 'review-training-v1'})
        with self.assertRaisesRegex(ValueError, 'LEGACY_COARSE_DATASET'):
            load(data, 'train')

    def test_real_build_without_actual_pilot_exclusions_fails_before_loading_base(self):
        registry = read(self.root / 'registry.json'); registry['synthetic'] = False
        path = self.root / 'real-registry.json'; write(path, registry)
        with patch('transformers.AutoTokenizer.from_pretrained') as loader:
            with self.assertRaisesRegex(ValueError, 'PINNED_V05_PILOT_EXCLUSION_REQUIRED'):
                build(self.root / 'source.json', self.root / 'approvals.jsonl', path,
                      self.root / 'base-not-accessed', self.root / 'real-build-not-created')
            loader.assert_not_called()
        self.assertFalse((self.root / 'real-build-not-created').exists())

    def test_baseline_weights_load_once_per_worker(self):
        from ml.reviews.models import Predictor
        with patch('ml.reviews.models.np.load', wraps=np.load) as loader:
            predictor = Predictor(self.experiment / 'tfidf-13')
            one = predictor.score(['음악 좋다']); two = predictor.score(['음악 좋다'])
            self.assertTrue(np.array_equal(one, two)); self.assertEqual(loader.call_count, 1)


if __name__ == '__main__':
    unittest.main()
