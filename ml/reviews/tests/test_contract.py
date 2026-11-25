import copy
import tempfile
import unittest
from pathlib import Path
from ml.reviews.common import canonical, digest, fingerprint, parse, read, seal, verify, write
from ml.reviews.contract import POLICY, aggregate, approval_candidates, labels, validate, taxonomy
from ml.reviews.dataset import audit, check_registry, split_games
from ml.reviews.tests.fixtures import approvals, record


class ContractTest(unittest.TestCase):
    def test_fine_targets_character_and_overall_boundaries(self):
        from ml.reviews.taxonomy import target_map
        self.assertEqual(len(labels()), len(target_map()) * 4)
        self.assertTrue(any(x.startswith('CHARACTER.APPEARANCE::') for x in labels()))
        self.assertTrue(any(x.startswith('SOUND.VOICE_ACTING::') for x in labels()))
        self.assertFalse(any(x.startswith('SOUND::') for x in labels()))
        self.assertFalse(any(x.startswith(('OTHER::', 'OVERALL::')) for x in labels()))

    def test_opposite_distinct_opinions_preserved_review_aggregate_separate(self):
        row = record(text='음악 좋다 하지만 음악 나쁘다')
        row['annotations'].append({**copy.deepcopy(row['annotations'][0]), 'id': 'o2', 'polarity': '부정'})
        row['active_opinion_ids'].append('o2')
        before = copy.deepcopy(row)
        result = validate(row, approvals(row))
        self.assertTrue(result['eligible'])
        self.assertEqual(result['labels'], ['SOUND.MUSIC::혼합'])
        self.assertEqual([o['polarity'] for o in result['opinions']], ['긍정', '부정'])
        self.assertEqual(row, before)

    def test_duplicate_opinion_id_is_conflict(self):
        row = record(); row['annotations'].append(copy.deepcopy(row['annotations'][0]))
        with self.assertRaisesRegex(ValueError, 'OPINION_ID'):
            validate(row, [])

    def test_conversation_review_can_be_linked_without_overwriting_old_flags(self):
        row = record(); result = validate(row, approvals(row))
        self.assertFalse(row['human_reviewed'])
        self.assertTrue(result['eligible'])
        self.assertEqual(result['human_review_evidence_count'], 1)

    def test_flags_alone_never_imply_or_disprove_human_approval(self):
        row = record(); row['human_reviewed'] = True
        result = validate(row, [])
        self.assertFalse(result['eligible'])
        self.assertIn('REVIEW_CONFIRMATION_UNLINKED', result['reasons'])

    def test_partial_review_kept_but_held_opinion_blocks_full_review_target(self):
        row = record(); row['annotations'].append({**copy.deepcopy(row['annotations'][0]), 'id': 'held'})
        row['held_opinion_ids'] = ['held']
        result = validate(row, approvals(row))
        self.assertFalse(result['eligible']); self.assertEqual(len(result['opinions']), 1)
        self.assertIn('HELD_OPINIONS_REMAIN', result['reasons'])

    def test_scope_fingerprint_stale_after_body_label_exclusion_or_selection_changes(self):
        for change in ('text', 'label', 'excluded', 'selection'):
            row = record(); ledger = approvals(row)
            if change == 'text':
                row['clean_text'] += ' '; row['text_sha256'] = digest(row['clean_text'])
            elif change == 'label':
                row['annotations'][0]['polarity'] = '부정'
            elif change == 'excluded':
                row['excluded_spans'] = [{'start': 0, 'end': 1, 'reason': 'synthetic-joke'}]
            else:
                row['review_status'] = '평가 없음'; row['active_opinion_ids'] = []
            self.assertFalse(validate(row, ledger)['eligible'])

    def test_no_auto_approval_candidates(self):
        row = record(); ledger = approval_candidates(row)
        self.assertTrue(all(a['decision'] == 'pending' and not a['reviewer'] for a in ledger))
        self.assertFalse(validate(row, ledger)['eligible'])

    def test_missing_reviewer_or_naive_timestamp_not_confirmed(self):
        for field, value in [('reviewer', ''), ('source_ref', ''), ('reviewed_at', '2026-11-25T19:00:00')]:
            row = record(); ledger = approvals(row)
            for entry in ledger:
                entry[field] = value
            self.assertFalse(validate(row, ledger)['eligible'])

    def test_steam_recommendation_does_not_reverse_body(self):
        for voted_up in (True, False, None):
            row = record(polarity='부정'); row['voted_up'] = voted_up; row['votes_up'] = 123
            result = validate(row, approvals(row))
            self.assertEqual(result['labels'], ['SOUND.MUSIC::부정'])
            self.assertEqual(result['text'], row['clean_text'])
            self.assertEqual(result['steam_context']['voted_up'], voted_up)

    def test_steam_boolean_and_helpful_count_not_interchangeable(self):
        row = record(); row['voted_up'] = 3
        with self.assertRaisesRegex(ValueError, 'RECOMMENDATION_TYPE'):
            validate(row, [])
        row = record(); row['votes_up'] = True
        with self.assertRaisesRegex(ValueError, 'HELPFUL_VOTES_TYPE'):
            validate(row, [])

    def test_metadata_alone_cannot_override_polarity(self):
        row = record(); row['voted_up'] = False
        row['annotations'][0]['steam_context_check'] = {'basis': 'steam_only', 'voted_up': False}
        with self.assertRaisesRegex(ValueError, 'METADATA_ONLY'):
            validate(row, approvals(row))

    def test_body_offsets_and_json_original_newline_enforced(self):
        row = record(text='음악\n좋다'); ledger = approvals(row)
        row['clean_text'] = row['clean_text'].replace('\n', '\r\n'); row['text_sha256'] = digest(row['clean_text'])
        with self.assertRaisesRegex(ValueError, 'OFFSETS'):
            validate(row, ledger)

    def test_true_no_evaluation_is_distinct_from_unresolved(self):
        row = record(); row['annotations'] = []; row['active_opinion_ids'] = []; row['review_status'] = '평가 없음'
        result = validate(row, approvals(row))
        self.assertTrue(result['eligible']); self.assertEqual(result['labels'], [])
        row['review_status'] = '판단 불가'
        self.assertFalse(validate(row, approvals(row))['eligible'])

    def test_unapplied_user_correction_blocks_training(self):
        row = record(); row['annotations'][0]['human_review'] = {'corrected_polarity': '부정'}
        self.assertIn('UNAPPLIED_CORRECTION', validate(row, approvals(row))['reasons'])

    def test_duplicate_reviews_not_silently_overwritten(self):
        row = record(); valid, errors = audit([row, copy.deepcopy(row)], approvals(row))
        self.assertEqual(len(valid), 1); self.assertEqual(len(errors), 1)

    def test_conflicting_approval_ledger_cannot_reuse_older_confirmation(self):
        row = record(); ledger = approvals(row)
        ledger.append({**ledger[0], 'decision': 'rejected'})
        valid, errors = audit([row], ledger)
        self.assertFalse(valid); self.assertEqual(errors[0]['reason'], 'CONFLICTING_APPROVAL_LEDGER_ENTRIES')

    def test_excluded_joke_kept_in_body_and_does_not_create_negative_target(self):
        row = record(); row['excluded_spans'] = [{'start': 0, 'end': 1, 'text': row['clean_text'][:1], 'reason': 'synthetic-joke'}]
        result = validate(row, approvals(row))
        self.assertEqual(result['text'], row['clean_text']); self.assertEqual(result['labels'], ['SOUND.MUSIC::긍정'])

    def test_registry_missing_new_pilot_batch_blocks_real_build(self):
        with self.assertRaisesRegex(ValueError, 'INVENTORY_INCOMPLETE'):
            check_registry({'schema': 'pilot-reference-registry-v2', 'complete': True,
                            'source_ref': 'synthetic-reference', 'inventory': [], 'batches': []})
        with self.assertRaisesRegex(ValueError, 'INCOMPLETE'):
            check_registry({'complete': False})

    def test_distinct_sound_targets_remain_positive_and_negative_without_parent_mixed(self):
        row = record(text='음악 좋다. 더빙 연기는 어색하다.')
        row['annotations'].append({**copy.deepcopy(row['annotations'][0]), 'id': 'o2',
                                   'target_code': 'SOUND.VOICE_ACTING', 'polarity': '부정'})
        row['active_opinion_ids'].append('o2')
        result = validate(row, approvals(row))
        self.assertEqual(result['labels'], ['SOUND.MUSIC::긍정', 'SOUND.VOICE_ACTING::부정'])
        self.assertEqual(len(result['aspect_summary']['SOUND']), 2)
        self.assertFalse(any('혼합' in label for label in result['labels']))

    def test_navigation_settings_controls_are_independent(self):
        row = record(text='길 찾기 쉽다. 난도 설정 좋다. 조작감 나쁘다.')
        template = row['annotations'][0]
        row['annotations'] = [{**copy.deepcopy(template), 'id': str(i), 'aspect_code': 'USABILITY',
                               'target_code': code, 'polarity': polarity}
                              for i, (code, polarity) in enumerate([
                                  ('USABILITY.NAVIGATION', '긍정'), ('USABILITY.SETTINGS', '긍정'),
                                  ('USABILITY.CONTROLS', '부정')])]
        row['active_opinion_ids'] = [a['id'] for a in row['annotations']]
        result = validate(row, approvals(row))
        self.assertEqual(len(result['labels']), 3)
        self.assertNotIn('USABILITY::혼합', result['labels'])

    def test_crash_connection_loading_are_independent(self):
        row = record(text='시작하자마자 튕긴다. 다시 접속이 안 된다. 로딩도 길다.')
        template = row['annotations'][0]
        row['annotations'] = [{**copy.deepcopy(template), 'id': str(i), 'aspect_code': 'TECHNICAL',
                               'target_code': code, 'polarity': '부정'}
                              for i, code in enumerate(('TECHNICAL.CRASH', 'TECHNICAL.CONNECTION', 'TECHNICAL.LOADING'))]
        row['active_opinion_ids'] = [a['id'] for a in row['annotations']]
        self.assertEqual(len(validate(row, approvals(row))['labels']), 3)

    def test_coarse_annotation_cannot_be_guessed_into_music(self):
        row = record(); row['annotations'][0].pop('target_code')
        result = validate(row, approvals(row))
        self.assertFalse(result['eligible']); self.assertEqual(result['labels'], [])
        self.assertIn('TARGET_RECLASSIFICATION_REQUIRED', result['reasons'])

    def test_target_parent_mismatch_rejected(self):
        row = record(); row['annotations'][0]['target_code'] = 'CHARACTER.APPEARANCE'
        with self.assertRaisesRegex(ValueError, 'TARGET_PARENT_MISMATCH'):
            validate(row, approvals(row))

    def test_changing_only_target_invalidates_old_human_scope(self):
        row = record(); ledger = approvals(row)
        row['annotations'][0]['target_code'] = 'SOUND.VOICE_ACTING'
        self.assertFalse(validate(row, ledger)['eligible'])

    def test_preview_taxonomy_never_authorizes_real_training(self):
        from ml.reviews.taxonomy import require_confirmed
        self.assertEqual(taxonomy()['status'], 'draft')
        with self.assertRaisesRegex(ValueError, 'FULL_CONFIRMED'):
            require_confirmed(taxonomy(), False)

    def test_game_split_reproducible_and_disjoint(self):
        data = [{'appid': 'g' + str(i), 'key': str(i)} for i in range(10)]
        one = split_games(data, 42); self.assertEqual(one, split_games(data, 42))
        groups = [set(r['appid'] for r in one[s]) for s in ('train', 'validation', 'test')]
        self.assertFalse(groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2])
        with self.assertRaisesRegex(ValueError, 'FIVE_GAMES'):
            split_games(data[:4], 42)

    def test_json_nonfinite_and_duplicate_fields_rejected(self):
        for value in ('{"x":NaN}', '{"x":1,"x":2}'):
            with self.assertRaises(ValueError):
                parse(value)

    def test_artifact_tampering_and_extra_files_fail(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); write(root / 'one.json', {'one': 1}); seal(root, {'synthetic': True})
            self.assertEqual(verify(root)['synthetic'], True)
            write(root / 'two.json', {})
            with self.assertRaisesRegex(ValueError, 'FILE_SET'):
                verify(root)
