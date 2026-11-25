import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from ml.reviews.common import digest, fingerprint, read, rows, seal, write, write_rows
from ml.reviews.contract import POLICY, labels, rollup
from ml.reviews.scope import (DIFFICULTY_NOTICE, assert_insight_claim_allowed, context_summary,
                              metadata_from_row, observation_scope)
from ml.reviews.summarize import summarize
from ml.reviews.taxonomy import taxonomy


def specified_scope():
    return {'language': 'korean',
            'window': {'basis': 'authored_at', 'start': '2026-11-01T00:00:00+09:00',
                       'end': '2026-11-26T00:00:00+09:00', 'timezone': 'Asia/Seoul'},
            'as_of': '2026-11-26T00:00:00+09:00',
            'collection': {'policy_id': 'synthetic-policy-v1', 'purchase_scope': 'all',
                           'recommendation_scope': 'all', 'offtopic_scope': 'include', 'completeness': 'PARTIAL'}}


def context():
    return {'authored_at': '2026-11-25T12:00:00+09:00', 'collected_at': '2026-11-25T13:00:00+09:00',
            'playtime_at_review_minutes': 100, 'playtime_at_collection_minutes': 200,
            'conditions': [{'name': 'mode', 'value': '협동', 'basis': 'review_text',
                            'evidence_span': {'start': 0, 'end': 2, 'text': '협동'}}]}


def prediction_artifact(root, mutate=None):
    target = root / 'predictions'; target.mkdir(); tax = taxonomy()
    selected = ['BALANCE.DIFFICULTY::긍정', 'BALANCE.DIFFICULTY::부정']
    common = {'classification_unit': 'leaf_id', 'taxonomy_sha256': fingerprint(tax),
              'policy_sha256': fingerprint(POLICY), 'model_sha256': digest('synthetic-model'),
              'synthetic_model': True, 'threshold': .5}
    data = [{**common, 'key': 'synthetic-g:synthetic-r', 'appid': 'synthetic-g',
             'source_revision': 'synthetic-r1', 'snapshot_id': 'synthetic-s1',
             'state': 'PREDICTED_TARGETS', 'labels': selected,
             'scores': {label: float(label in selected) for label in labels(tax)},
             'aspect_summary': rollup(selected), **metadata_from_row({'observation_scope': specified_scope(),
                                                                    'review_context': context()}, '협동은 어렵지만 재밌다')}]
    if mutate:
        mutate(data)
    write(target / 'taxonomy.json', tax); write_rows(target / 'predictions.jsonl', data)
    seal(target, {**common, 'rows': len(data)})
    return target


class ScopeContractTest(unittest.TestCase):
    def test_unknown_is_explicit_and_never_inferred_from_playtime(self):
        metadata = metadata_from_row({'review_context': {'playtime_at_collection_minutes': 10000}})
        self.assertIsNone(metadata['observation_scope']['language'])
        self.assertEqual(metadata['observation_scope']['collection']['completeness'], 'UNKNOWN')
        summary = context_summary([metadata['review_context']])
        self.assertEqual(summary['player_skill'], 'UNKNOWN')
        self.assertEqual(summary['player_preference'], 'UNKNOWN')
        self.assertEqual(summary['unknown_review_counts']['playtime_at_review_minutes'], 1)
        self.assertEqual(summary['known_review_counts']['playtime_at_collection_minutes'], 1)
        self.assertFalse(summary['playtime_is_skill'])

    def test_author_time_is_distinct_from_collection_time_and_half_open(self):
        row = {'observation_scope': specified_scope(), 'review_context': context()}
        metadata = metadata_from_row(row, '협동은 어렵지만 재밌다')
        self.assertEqual(metadata['review_context']['playtime_at_review_minutes'], 100)
        self.assertEqual(metadata['review_context']['playtime_at_collection_minutes'], 200)
        row['review_context']['authored_at'] = row['observation_scope']['window']['end']
        with self.assertRaisesRegex(ValueError, 'AUTHORED_TIME_OUTSIDE'):
            metadata_from_row(row, '협동은 어렵지만 재밌다')
        row['review_context']['authored_at'] = row['observation_scope']['window']['start']
        metadata_from_row(row, '협동은 어렵지만 재밌다')

    def test_bad_window_timezone_and_collection_basis_fail_closed(self):
        for field, value, expected in [('basis', 'collected_at', 'AUTHOR_TIME'),
                                        ('start', '2026-11-01T00:00:00', 'REQUIRES_TIMEZONE'),
                                        ('timezone', 'invalid/timezone', 'INVALID_OBSERVATION_TIMEZONE')]:
            scope = specified_scope(); scope['window'][field] = value
            with self.assertRaisesRegex(ValueError, expected):
                observation_scope(scope)
        scope = specified_scope(); scope['source_total_matching_reviews'] = True
        with self.assertRaisesRegex(ValueError, 'INVALID_SOURCE_TOTAL'):
            observation_scope(scope)

    def test_condition_requires_exact_evidence_or_attributed_source(self):
        metadata_from_row({'review_context': context()}, '협동은 어렵지만 재밌다')
        with self.assertRaisesRegex(ValueError, 'CONDITION_EVIDENCE_NOT_IN_BODY'):
            metadata_from_row({'review_context': context()}, '전혀 다른 텍스트')
        ungrounded = context(); ungrounded['conditions'][0]['basis'] = 'game_title_guess'
        with self.assertRaisesRegex(ValueError, 'REQUIRES_SOURCE'):
            metadata_from_row({'review_context': ungrounded})
        attributed = {'conditions': [{'name': 'platform', 'value': 'Linux', 'basis': 'source_metadata',
                                      'source_field': 'steam.author.os'}]}
        result = metadata_from_row({'review_context': attributed})['review_context']
        self.assertEqual(result['conditions'][0]['source_field'], 'steam.author.os')
        self.assertIn('not independent', context_summary([result])['source_status'])

    def test_duplicate_condition_mentions_count_one_review(self):
        observed = metadata_from_row({'review_context': context()})['review_context']
        other_span = copy.deepcopy(observed['conditions'][0]); other_span['evidence_span']['start'] = 10
        other_span['evidence_span']['end'] = 12; observed['conditions'].append(other_span)
        self.assertEqual(context_summary([observed])['condition_review_counts'][0]['reviews'], 1)

    def test_insight_guard_rejects_absolute_and_unsupported_claims(self):
        assert_insight_claim_allowed('observed_review_sentiment_counts')
        for claim in ('absolute_difficulty_ranking', 'player_skill_from_playtime', 'causal_effect',
                      'invented-new-claim'):
            with self.assertRaisesRegex(ValueError, 'UNSUPPORTED_INSIGHT_CLAIM'):
                assert_insight_claim_allowed(claim)


class ScopedSummaryTest(unittest.TestCase):
    def test_difficulty_counts_keep_both_and_unknown_unresolved(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); source = prediction_artifact(root); summarize(source, root / 'summary')
            game = read(root / 'summary/summary.json')['games']['synthetic-g']
            difficulty = game['difficulty_observations']
            self.assertEqual(difficulty['positive_review_count'], 1)
            self.assertEqual(difficulty['negative_review_count'], 1)
            self.assertEqual(difficulty['both_review_count'], 1)
            self.assertEqual(difficulty['mentioned_review_count'], 1)
            self.assertIsNone(difficulty['unresolved_review_count'])
            self.assertFalse(difficulty['cross_game_rank_allowed'])
            self.assertIsNone(game['denominators']['raw_collected_unique_reviews'])
            self.assertEqual(game['denominators']['leaf_polarity'], 1)
            self.assertTrue(game['denominators']['positive_negative_may_overlap'])
            self.assertEqual(game['insight_contract']['difficulty_notice'], DIFFICULTY_NOTICE)
            self.assertFalse(game['insight_contract']['rag_answer_generated'])
            self.assertFalse(game['insight_contract']['population_representative'])

    def test_different_language_window_or_selection_cannot_mix_in_same_game_snapshot(self):
        for change in ('language', 'window', 'collection'):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                def mutate(data):
                    second = copy.deepcopy(data[0]); second['key'] = 'synthetic-g:synthetic-other'
                    if change == 'language':
                        second['observation_scope']['language'] = 'english'
                    elif change == 'window':
                        second['observation_scope']['window']['start'] = '2026-11-02T00:00:00+09:00'
                    else:
                        second['observation_scope']['collection']['recommendation_scope'] = 'positive'
                    second['scope_sha256'] = fingerprint(second['observation_scope']); data.append(second)
                source = prediction_artifact(root, mutate)
                with self.assertRaisesRegex(ValueError, 'MIXED_OBSERVATION_SCOPES'):
                    summarize(source, root / 'summary')
                self.assertFalse((root / 'summary').exists())

    def test_known_and_unknown_scope_cannot_silently_merge(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def mutate(data):
                second = copy.deepcopy(data[0]); second['key'] = 'synthetic-g:synthetic-other'
                second.update(metadata_from_row({})); data.append(second)
            source = prediction_artifact(root, mutate)
            with self.assertRaisesRegex(ValueError, 'MIXED_OBSERVATION_SCOPES'):
                summarize(source, root / 'summary')

    def test_legacy_scope_explicit_unknown_but_counts_still_available(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def mutate(data):
                for field in ('observation_scope', 'scope_sha256', 'review_context'):
                    data[0].pop(field)
            source = prediction_artifact(root, mutate); summarize(source, root / 'summary')
            game = read(root / 'summary/summary.json')['games']['synthetic-g']
            self.assertEqual(game['scope_status'], 'PARTIAL_OR_UNKNOWN')
            self.assertIn('language', game['insight_contract']['scope_unknown_fields'])
            self.assertEqual(game['successful_review_predictions'], 1)
            self.assertEqual(game['observed_context']['unknown_review_counts']['authored_at'], 1)

    def test_scope_hash_tampering_is_rejected_before_summary(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = prediction_artifact(root, lambda data: data[0]['observation_scope'].update(language='english'))
            with self.assertRaisesRegex(ValueError, 'OBSERVATION_SCOPE_HASH_CHANGED'):
                summarize(source, root / 'summary')

    def test_held_counts_are_separate_and_context_is_preserved(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def mutate(data):
                second = copy.deepcopy(data[0]); second.update(key='synthetic-g:synthetic-held',
                                                              state='HELD_LONG_INPUT', labels=None,
                                                              scores=None, aspect_summary=None)
                data.append(second)
            source = prediction_artifact(root, mutate); summarize(source, root / 'summary')
            game = read(root / 'summary/summary.json')['games']['synthetic-g']
            self.assertEqual(game['state_counts']['HELD_LONG_INPUT'], 1)
            self.assertEqual(game['successful_review_predictions'], 1)
            self.assertEqual(game['observed_context']['reviews'], 2)

    def test_held_and_successful_revisions_cannot_count_the_same_review_twice(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def mutate(data):
                second = copy.deepcopy(data[0]); second.update(state='HELD_LONG_INPUT', labels=None,
                                                              scores=None, aspect_summary=None)
                data.insert(0, second)
            source = prediction_artifact(root, mutate)
            with self.assertRaisesRegex(ValueError, 'DUPLICATE_REVIEW_REVISION'):
                summarize(source, root / 'summary')


class BatchScopeTest(unittest.TestCase):
    def test_batch_exports_metadata_and_rejects_ungrounded_context_without_model_call(self):
        from ml.reviews.experiment import batch_predict
        import numpy as np
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); model = root / 'model'; model.mkdir(); write(model / 'READY.json', {'synthetic': True})
            tax = taxonomy(); valid_labels = labels(tax)
            good = {'appid': 'synthetic-g', 'review_id': 'synthetic-r', 'key': 'synthetic-g:synthetic-r',
                    'text': '협동은 어렵지만 재밌다', 'text_sha256': digest('협동은 어렵지만 재밌다'),
                    'source_revision': 'synthetic-revision', 'snapshot_id': 'synthetic-snapshot',
                    'observation_scope': specified_scope(), 'review_context': context()}
            bad = copy.deepcopy(good); bad.update(review_id='synthetic-bad', key='synthetic-g:synthetic-bad')
            bad['review_context']['conditions'][0]['evidence_span']['text'] = '혼자'
            source = root / 'source.jsonl'; write_rows(source, [good, bad])
            with patch('ml.reviews.experiment.Predictor') as predictor_type:
                predictor = predictor_type.return_value
                predictor.report = {'synthetic': True, 'threshold': .5,
                                    'dataset': {'taxonomy': tax, 'taxonomy_sha256': fingerprint(tax),
                                                'policy_sha256': fingerprint(POLICY), 'labels': valid_labels}}
                predictor.score.return_value = np.zeros((1, len(valid_labels)))
                batch_predict(source, model, root / 'output')
                self.assertEqual(predictor.score.call_count, 1)
            output = rows(root / 'output/predictions.jsonl')
            self.assertEqual(output[0]['review_context']['playtime_at_review_minutes'], 100)
            self.assertEqual(output[0]['review_context']['playtime_at_collection_minutes'], 200)
            self.assertEqual(output[0]['observation_scope']['language'], 'korean')
            self.assertEqual(output[1]['state'], 'REJECTED_INPUT')
            self.assertEqual(output[1]['scope_metadata_status'], 'REJECTED')
            self.assertIsNone(output[1]['scores'])
            self.assertTrue(all(row['evidence_spans'] is None for row in output))
