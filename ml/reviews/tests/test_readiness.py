import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from ml.reviews.common import read
from ml.reviews.readiness import inspect, report


class ReadinessTest(unittest.TestCase):
    def test_missing_private_inputs_block_without_network_or_model_loading(self):
        with patch('socket.socket.connect', side_effect=AssertionError('NO_NETWORK')):
            result = inspect()
        self.assertFalse(result['ready_for_local_training'])
        self.assertEqual(result['facts']['api_requests'], 0)
        self.assertFalse(result['facts']['final_test_rows_read'])
        self.assertEqual(result['checks'][0]['detail']['binary_outputs'], 146)
        names = {c['name']: c['status'] for c in result['checks']}
        for name in ('pilot_registry', 'human_gold', 'base_model', 'frozen_dataset'):
            self.assertEqual(names[name], 'BLOCKED')

    def test_invalid_inputs_do_not_echo_private_values(self):
        result = inspect(source='/private/review', approvals='/private/password', registry='/private/key', base='/private/secret')
        self.assertNotIn('/private/', str(result))
        self.assertEqual(result['status'], 'BLOCKED')

    def test_report_does_not_overwrite_prior_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary) / 'readiness'
            report(out)
            self.assertEqual(read(out / 'readiness.json')['facts']['api_requests'], 0)
            with self.assertRaises(FileExistsError):
                report(out)

    def test_malformed_record_is_blocked_instead_of_uncaught_exception(self):
        with patch('ml.reviews.readiness.read', return_value={'records': [None]}), \
                patch('ml.reviews.readiness.rows', return_value=[]):
            result = inspect(source='source', approvals='ledger')
        self.assertEqual(next(c['status'] for c in result['checks'] if c['name'] == 'human_gold'), 'BLOCKED')

    def test_frozen_dataset_must_match_each_current_input(self):
        from ml.reviews.common import fingerprint
        from ml.reviews.assets import REPO, REVISION, BIN_SHA256, PINNED_FILES
        meta = {'synthetic': False, 'base_sha256': 'current-base', 'source_sha256': 'current-source',
                'approvals_sha256': 'current-ledger', 'pilot_registry_sha256': 'current-registry',
                'split_counts': {'train': 3, 'validation': 1, 'test': 1}, 'input_scope': {'text_only': True}}
        base_meta = {'synthetic': False, 'repo': REPO, 'revision': REVISION,
                     'source_weight_sha256': BIN_SHA256, 'source_config_tokenizer_sha256': PINNED_FILES}
        workbench = [{'key': f'g{i}:r', 'appid': f'g{i}', 'eligible': True, 'labels': [], 'reasons': [],
                      'text': f'synthetic-{i}'} for i in range(5)]
        for field in ('source_sha256', 'approvals_sha256', 'pilot_registry_sha256'):
            stale = {**meta, field: 'stale-input'}
            with self.subTest(field=field), \
                    patch('ml.reviews.readiness.read', side_effect=lambda p: {'records': [{}]} if p == 'source' else {}), \
                    patch('ml.reviews.readiness.rows', return_value=[]), \
                    patch('ml.reviews.dataset.audit', return_value=(workbench, [])), \
                    patch('ml.reviews.dataset.check_registry', return_value=set()), \
                    patch('ml.reviews.dataset.check_leakage'), \
                    patch('ml.reviews.dataset.reference_pilot_matches', return_value={}), \
                    patch('ml.reviews.dataset.load', return_value=(workbench, stale)), \
                    patch('ml.reviews.readiness.verify', return_value=base_meta), \
                    patch('ml.reviews.readiness.file_hash', side_effect=lambda p: {
                        'source': 'current-source', 'ledger': 'current-ledger', 'registry': 'current-registry',
                        'base/READY.json': 'current-base'}.get(str(p), 'dataset-hash')):
                result = inspect(source='source', approvals='ledger', registry='registry', base='base', dataset='dataset')
                self.assertFalse(result['ready_for_local_training'])
                self.assertEqual(next(c['status'] for c in result['checks'] if c['name'] == 'frozen_dataset'), 'BLOCKED')
