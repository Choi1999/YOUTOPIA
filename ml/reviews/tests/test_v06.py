import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ml.reviews.common import digest, file_hash, fingerprint, read, rows, seal, write, write_rows
from ml.reviews.contract import labels, taxonomy, validate
from ml.reviews.dataset import audit, build, check_registry, load, reference_pilot_matches
from ml.reviews.import_labels import import_labels
from ml.reviews.pilot_v06 import import_pilot
from ml.reviews.tests.fixtures import approvals, inputs, record, tiny_base
from ml.reviews.tests.test_pilot_v05 import consolidated


def current_consolidated():
    row = consolidated(); row['taxonomy_version'] = 'v0.6'
    return row


class V06Test(unittest.TestCase):
    def test_pinned_v06_resources_match_source_hashes_and_146_outputs(self):
        root = Path(__file__).parents[1]; source = read(root / 'labeling/SOURCE.json')
        self.assertEqual(source['taxonomy_version'], 'v0.6')
        self.assertEqual(file_hash(root / 'taxonomy.json'), source['taxonomy_file_sha256'])
        self.assertEqual(file_hash(root / 'labeling/GUIDELINES_v1.3.0_KO.md'), source['guidelines_file_sha256'])
        self.assertEqual(len(labels()), 146)
        self.assertIn('GAMEPLAY.EXPLORATION::긍정', labels())
        self.assertIn('CONTENT.TRACK_CATALOG::부정', labels())

    def test_metadata_assisted_polarity_is_never_text_only_gold_even_with_approvals(self):
        row = record(); row['annotations'][0]['sentiment_basis'] = 'STEAM_RECOMMENDATION_TIEBREAK'
        row['metadata'] = {'steam_recommended': False}
        row['annotation_input'] = {'text_only_sufficient': False, 'required_metadata': ['steam_recommended']}
        result = validate(row, approvals(row))
        self.assertFalse(result['eligible']); self.assertEqual(result['labels'], [])
        self.assertIn('TEXT_ONLY_SENTIMENT_REQUIRES_METADATA', result['reasons'])
        self.assertEqual(result['text_evidenced_target_ids'], ['SOUND.MUSIC_BGM'])
        self.assertEqual(result['metadata_assisted_opinions'][0]['sentiment_basis'], 'STEAM_RECOMMENDATION_TIEBREAK')
        self.assertFalse(result['task_eligibility']['metadata_supplied_to_model'])
        self.assertEqual(result['annotation_metadata'], row['metadata'])

    def test_any_explicit_assistance_signal_blocks_whole_review_without_false_negatives(self):
        mutations = [
            lambda row: row.update(annotation_input={'text_only_sufficient': False}),
            lambda row: row.update(annotation_input={'required_metadata': ['steam_recommended']},
                                   metadata={'steam_recommended': False}),
            lambda row: row['annotations'][0].update(sentiment_basis='STEAM_RECOMMENDATION_TIEBREAK'),
            lambda row: row['annotations'][0].update(sentiment_basis='unknown-source'),
        ]
        for mutation in mutations:
            row = record(); mutation(row)
            result = validate(row, approvals(row))
            self.assertFalse(result['eligible']); self.assertEqual(result['labels'], [])

    def test_missing_metadata_and_contradicting_recommendations_do_not_silently_pass(self):
        row = record(); row['annotation_input'] = {'required_metadata': ['steam_recommended']}
        result = validate(row, approvals(row))
        self.assertIn('ANNOTATION_REQUIRED_METADATA_MISSING', result['reasons'])
        row['metadata'] = {'steam_recommended': False}; row['voted_up'] = True
        with self.assertRaisesRegex(ValueError, 'STEAM_RECOMMENDATION_CONFLICT'):
            validate(row, approvals(row))

    def test_nested_metadata_and_input_requirements_are_bound_to_human_approval(self):
        for mutation in (
            lambda row: row['metadata'].update(playtime_at_review_minutes=99),
            lambda row: row.update(annotation_input={'text_only_sufficient': True}),
        ):
            row = record(); row['metadata'] = {'playtime_at_review_minutes': 50}
            ledger = approvals(row); mutation(row)
            result = validate(row, ledger)
            self.assertFalse(result['eligible']); self.assertIn('REVIEW_CONFIRMATION_UNLINKED', result['reasons'])

    def test_nested_metadata_types_and_unknown_input_declarations_fail_closed(self):
        for value in (None, [], {'text_only_sufficient': 'false'}, {'required_metadata': [{}]},
                      {'required_metadata': ['steam_recommended', 'steam_recommended']}):
            row = record(); row['annotation_input'] = value
            with self.assertRaisesRegex(ValueError, 'ANNOTATION_INPUT'):
                validate(row, approvals(row))

    def test_v06_import_preserves_user_review_provenance_without_approving_learning(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); row = current_consolidated()
            row['metadata'] = {'steam_recommended': False}
            row['annotation_input'] = {'text_only_sufficient': False, 'required_metadata': ['steam_recommended']}
            row['annotations'][0]['sentiment_basis'] = 'STEAM_RECOMMENDATION_TIEBREAK'
            row['reclassification_review'] = {'user_verified': True, 'independent_blind_annotation': False}
            source = root / 'source.json'
            write(source, {'schema': 'youtopia_pilot_consolidated_review_v2', 'taxonomy_version': 'v0.6',
                           'records': [row], 'pilot_exclusion_keys': [row['key']]})
            report = import_pilot(source, root / 'out')
            self.assertEqual(report['training_eligible_reviews'], 0)
            self.assertEqual(report['new_leaf_user_verified_records'], 1)
            self.assertEqual(report['metadata_assisted_reviews'], 1)
            self.assertFalse(report['registry_inventory_complete'])
            self.assertFalse(report['pinned_source_match'])
            output = read(root / 'out/adapted-pilot.json')['records'][0]
            self.assertEqual(output['metadata'], row['metadata'])
            self.assertEqual(output['annotation_input'], row['annotation_input'])
            self.assertEqual(output['annotations'][0]['sentiment_basis'], row['annotations'][0]['sentiment_basis'])
            self.assertEqual(file_hash(source), file_hash(root / 'out/original-pilot.json'))

    def test_main_consolidated_import_does_not_forge_approval_or_registry(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); row = current_consolidated()
            row['learning_eligible'] = True; row['batch_role'] = 'independent-main'
            row['source_review_acceptance'] = {'user_verified': True, 'event_id': 'synthetic-user-review'}
            source = root / 'source.json'
            write(source, {'schema': 'youtopia_pilot_consolidated_review_v2', 'taxonomy_version': 'v0.6', 'records': [row]})
            report = import_labels(source, root / 'out')
            self.assertEqual(report['new_human_approvals'], 0)
            self.assertEqual(report['training_eligible_reviews'], 0)
            self.assertFalse((root / 'out/pilot-registry.json').exists())
            output = read(root / 'out/adapted-labels.json')['records'][0]
            self.assertEqual(output['source_review_acceptance'], row['source_review_acceptance'])
            self.assertTrue(output['learning_eligible'])
            self.assertTrue(all(entry['decision'] == 'pending' and not entry['reviewer']
                                for entry in rows(root / 'out/pending-approval-candidates.jsonl')))

    def test_v05_only_registry_cannot_allow_v06_real_training(self):
        registry = {'schema': 'pilot-reference-registry-v2', 'complete': True, 'source_ref': 'synthetic-test',
                    'inventory': [{'id': 'guideline-pilot-v0.5', 'expected_count': 1, 'source_sha256': 'a' * 64}],
                    'batches': [{'id': 'guideline-pilot-v0.5', 'expected_count': 1, 'keys': ['synthetic:old']}]}
        with self.assertRaisesRegex(ValueError, 'PINNED_V06_PILOT_EXCLUSION_REQUIRED'):
            check_registry(registry)

    def test_real_v06_registry_checks_source_count_and_exact_keyset(self):
        from ml.reviews.pilot_v06 import PINNED_PILOT_SHA256
        keys = ['synthetic:pilot-' + str(index) for index in range(100)]
        bodies = [{'key': key, 'text': 'synthetic body ' + key, 'text_sha256': digest('synthetic body ' + key)}
                  for key in keys]
        registry = {'schema': 'pilot-reference-registry-v2', 'complete': True, 'source_ref': 'synthetic-verified-inventory',
                    'inventory': [{'id': 'guideline-pilot-v0.6', 'expected_count': 100, 'source_sha256': PINNED_PILOT_SHA256}],
                    'batches': [{'id': 'guideline-pilot-v0.6', 'expected_count': 100, 'keys': keys,
                                 'reference_bodies': bodies}]}
        bodyset = fingerprint(sorted([{'key': r['key'], 'text_sha256': r['text_sha256']} for r in bodies], key=lambda r: r['key']))
        with patch('ml.reviews.pilot_v06.PINNED_KEYSET_SHA256', fingerprint(sorted(keys))), \
                patch('ml.reviews.pilot_v06.PINNED_BODYSET_SHA256', bodyset):
            self.assertEqual(check_registry(registry), set(keys))
            changed = copy.deepcopy(registry); changed['batches'][0]['keys'][0] = 'synthetic:replacement'
            with self.assertRaisesRegex(ValueError, 'PINNED_V06_PILOT_EXCLUSION_KEYS_CHANGED'):
                check_registry(changed)
            changed = copy.deepcopy(registry); changed['batches'][0]['reference_bodies'][0]['text'] += 'edited'
            with self.assertRaisesRegex(ValueError, 'PINNED_V06_PILOT_REFERENCE_BODIES_CHANGED'):
                check_registry(changed)
            changed = copy.deepcopy(registry); changed['batches'][0].pop('reference_bodies')
            with self.assertRaisesRegex(ValueError, 'PINNED_V06_PILOT_REFERENCE_BODIES_CHANGED'):
                check_registry(changed)
        changed = copy.deepcopy(registry); changed['inventory'][0]['source_sha256'] = 'b' * 64
        with self.assertRaisesRegex(ValueError, 'PINNED_V06_PILOT_EXCLUSION_REQUIRED'):
            check_registry(changed)

    def test_reference_pilot_exact_normalized_and_near_bodies_are_excluded_across_keys(self):
        body = '합성 리뷰: 게임의 음악과 연출이 즐겁고 조작은 불편했지만 탐험이 흥미로웠다. ' * 20
        registry = {'batches': [{'reference_bodies': [{'text': body}]}]}
        candidates = [{'key': 'synthetic:new-id', 'text': body},
                      {'key': 'synthetic:spaces', 'text': '  ' + body.replace(' ', '\n')},
                      {'key': 'synthetic:near', 'text': body + '추가'},
                      {'key': 'synthetic:different', 'text': '완전히 별개의 합성 테스트 문장입니다.'}]
        result = reference_pilot_matches(candidates, registry)
        self.assertEqual(result['synthetic:new-id'], 'REFERENCE_PILOT_BODY_EXCLUDED')
        self.assertEqual(result['synthetic:spaces'], 'REFERENCE_PILOT_BODY_EXCLUDED')
        self.assertEqual(result['synthetic:near'], 'NEAR_REFERENCE_PILOT_BODY_HELD')
        self.assertNotIn('synthetic:different', result)

    def test_malformed_record_and_approval_entries_have_explicit_audit_errors(self):
        self.assertEqual(audit([None], [])[1][0]['reason'], 'RECORD_OBJECT_REQUIRED')
        self.assertEqual(audit([record()], [None])[1][0]['reason'], 'APPROVAL_OBJECT_REQUIRED')

    def test_build_excludes_edited_pilot_key_and_copied_body_before_game_split(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); records = inputs(root); base = tiny_base(root / 'base')
            reference = records[0]
            edited = record('synthetic-reference', 'excluded', text='edited source revision with distinct words')
            copied = record('synthetic-copy-game', 'synthetic-copy-id', text=reference['clean_text'])
            records.extend([edited, copied])
            write(root / 'source.json', {'records': records})
            write_rows(root / 'approvals.jsonl', [entry for row in records for entry in approvals(row)])
            registry = read(root / 'registry.json')
            registry['batches'][0]['reference_bodies'] = [{'key': 'synthetic-reference:excluded',
                                                         'text': reference['clean_text'],
                                                         'text_sha256': reference['text_sha256']}]
            write(root / 'registry.json', registry)
            build(root / 'source.json', root / 'approvals.jsonl', root / 'registry.json', base,
                  root / 'dataset', max_tokens=64)
            workbench = {row['key']: row for row in rows(root / 'dataset/workbench.jsonl')}
            self.assertIn('REFERENCE_PILOT_EXCLUDED', workbench[edited['key']]['reasons'])
            self.assertIn('REFERENCE_PILOT_BODY_EXCLUDED', workbench[copied['key']]['reasons'])
            for split in ('train', 'validation', 'test'):
                self.assertFalse({edited['key'], copied['key']} & {row['key'] for row in load(root / 'dataset', split)[0]})
            ready = read(root / 'dataset/READY.json')['metadata']
            train = rows(root / 'dataset/train.jsonl'); train[0]['task_eligibility']['text_only_sentiment_eligible'] = False
            write_rows(root / 'dataset/train.jsonl', train); seal(root / 'dataset', ready)
            with self.assertRaisesRegex(ValueError, 'TEXT_ONLY_DATASET_CONTAINS_INELIGIBLE_TASK'):
                load(root / 'dataset', 'train')


if __name__ == '__main__':
    unittest.main()
