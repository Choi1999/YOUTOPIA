import copy
import tempfile
import unittest
from pathlib import Path
from ml.reviews.common import digest, read, write
from ml.reviews.contract import labels, taxonomy, validate
from ml.reviews.pilot_v05 import LEGACY_TAXONOMY, convert_record, import_pilot
from ml.reviews.tests.fixtures import approvals, record


def consolidated():
    text = '음악 좋다. 말하는 대상은 잘 모르겠다.'
    annotation = {'id': 'synthetic-opinion', 'source_opinion_id': 'synthetic-source-opinion',
                  'state': 'ACTIVE', 'aspect_code': 'SOUND', 'subaspect_code': 'MUSIC_BGM',
                  'leaf_id': 'SOUND.MUSIC_BGM', 'polarity': '긍정', 'polarity_strength': 'weak',
                  'detail': '합성 음악 평가', 'evidence': '음악 좋다', 'start': 0, 'end': 5,
                  'supporting_context_spans': [],
                  'target': {'description': '음악', 'state': 'explicit', 'mentions': [{'start': 0, 'end': 2, 'text': '음악'}]},
                  'scope': {'holder': 'author', 'game': 'synthetic-game', 'claim_kind': 'evaluation',
                            'time': None, 'condition': 'synthetic-condition'},
                  'classification_review': {'user_verified': False}, 'learning_eligible': False}
    held = {'id': 'synthetic-held', 'state': 'HOLD', 'aspect_code': 'SOUND', 'leaf_id': None,
            'polarity': None, 'detail': '합성 판단 보류', 'evidence': text, 'start': 0, 'end': len(text),
            'learning_eligible': False}
    return {'schema_version': 'youtopia_pilot_review_v2', 'taxonomy_version': 'v0.5',
            'key': 'synthetic-game:synthetic-review', 'appid': 'synthetic-game', 'review_id': 'synthetic-review',
            'clean_text': text, 'text_sha256': digest(text), 'analysis_status': 'EVALUATION_WITH_HOLD',
            'learning_eligible': False, 'batch_role': 'guideline_pilot_not_train_or_final_test',
            'source_review_acceptance': {'status': 'accepted', 'reviewer': 'synthetic-human'},
            'reclassification_review': {'user_verified': False},
            'annotations': [annotation], 'held_annotations': [held],
            'active_opinion_ids': [annotation['id']], 'held_opinion_ids': [held['id']], 'excluded_spans': []}


class PilotV05Test(unittest.TestCase):
    def test_actual_v05_schema_preserves_target_condition_strength_and_source_link(self):
        source = consolidated(); before = copy.deepcopy(source)
        adapted = convert_record(source, taxonomy(LEGACY_TAXONOMY))
        original = source['annotations'][0]; annotation = adapted['annotations'][0]
        for field in ('leaf_id', 'source_opinion_id', 'scope', 'target', 'polarity_strength', 'classification_review'):
            self.assertEqual(annotation[field], original[field])
        self.assertEqual(source, before)
        self.assertEqual(adapted['held_opinion_ids'], source['held_opinion_ids'])
        self.assertFalse(validate(adapted, approvals(adapted), taxonomy(LEGACY_TAXONOMY))['eligible'])

    def test_import_separates_old_acceptance_from_new_leaf_verification(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); row = consolidated()
            source = root / 'source.json'
            write(source, {'schema': 'youtopia_pilot_consolidated_review_v2', 'taxonomy_version': 'v0.5',
                           'records': [row], 'pilot_exclusion_keys': [row['key']]})
            result = import_pilot(source, root / 'out')
            self.assertEqual(result['source_acceptance_records'], 1)
            self.assertEqual(result['new_leaf_user_verified_records'], 0)
            self.assertEqual(result['training_eligible_reviews'], 0)
            self.assertFalse(read(root / 'out/pilot-registry.json')['complete'])

    def test_wrong_schema_and_exclusion_policy_not_guessed(self):
        row = consolidated(); row['schema_version'] = 'unknown'
        with self.assertRaisesRegex(ValueError, 'SCHEMA_MISMATCH'):
            convert_record(row, taxonomy(LEGACY_TAXONOMY))
        row = consolidated(); row['excluded_spans'] = [{'retain_in_model_input': False}]
        with self.assertRaisesRegex(ValueError, 'RETENTION_POLICY'):
            convert_record(row, taxonomy(LEGACY_TAXONOMY))

    def test_story_unspecified_weak_positive_and_pacing_negative_are_distinct(self):
        row = record(text='이야기 자체는 괜찮다. 전개는 느리다.')
        a = row['annotations'][0]; a.update(aspect_code='STORY', leaf_id='STORY.UNSPECIFIED', polarity_strength='weak')
        row['annotations'].append({**copy.deepcopy(a), 'id': 'o2', 'leaf_id': 'STORY.NARRATIVE_PACING',
                                   'polarity': '부정', 'polarity_strength': None})
        row['active_opinion_ids'].append('o2')
        result = validate(row, approvals(row))
        self.assertEqual(set(result['labels']), {'STORY.UNSPECIFIED::긍정', 'STORY.NARRATIVE_PACING::부정'})
        self.assertEqual(result['opinions'][0]['polarity_strength'], 'weak')
        self.assertFalse(result['derived_mixed_leaves'])

    def test_unspecified_is_a_real_evaluation_not_absence_or_hold(self):
        row = record(text='사운드가 좋다'); row['annotations'][0]['leaf_id'] = 'SOUND.UNSPECIFIED'
        result = validate(row, approvals(row))
        self.assertTrue(result['eligible']); self.assertEqual(result['labels'], ['SOUND.UNSPECIFIED::긍정'])

    def test_unicode_codepoint_target_spans_not_utf16_offsets(self):
        row = record(text='🎮 음악 좋다'); row['annotations'][0]['target_spans'] = [{'start': 2, 'end': 4, 'text': '음악'}]
        self.assertTrue(validate(row, approvals(row))['eligible'])
        row['annotations'][0]['target_spans'][0].update(start=3, end=5)
        with self.assertRaisesRegex(ValueError, 'OFFSETS_MISMATCH'):
            validate(row, approvals(row))

    def test_archived_v05_preserves_71_leaf_schema_without_mixed_or_neutral_head(self):
        self.assertEqual(len(labels(taxonomy(LEGACY_TAXONOMY))), 142)
        self.assertEqual(len(labels()), 146)
        self.assertFalse(any(label.endswith(('::혼합', '::복합', '::중립')) for label in labels()))
