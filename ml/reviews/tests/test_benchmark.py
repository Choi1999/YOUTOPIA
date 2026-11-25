import copy
import io
import socket
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from ml.reviews.benchmark import Budget, CONDITIONS, initialize_budget, prepare, run
from ml.reviews.common import canonical, digest, fingerprint, read, seal, verify, write, write_rows
from ml.reviews.contract import POLICY, labels, taxonomy
from ml.reviews.providers import ProviderError, classify, http_post, _NoRedirect

LABEL = 'SOUND.MUSIC_BGM::긍정'
KEY = 'synthetic-secret-never-output'


def openai_response(values=None):
    return {'status': 'completed', 'model': 'test-openai-version', 'id': 'synthetic-response',
            'output': [{'type': 'message', 'role': 'assistant', 'status': 'completed',
                        'content': [{'type': 'output_text', 'text': canonical({'labels': [LABEL] if values is None else values})}]}],
            'usage': {'input_tokens': 100, 'output_tokens': 20, 'total_tokens': 120,
                      'input_tokens_details': {'cached_tokens': 0}, 'output_tokens_details': {'reasoning_tokens': 0}}}


def gemini_response(values=None):
    return {'modelVersion': 'test-gemini-version', 'responseId': 'synthetic-response',
            'candidates': [{'finishReason': 'STOP', 'content': {'parts': [
                {'text': canonical({'labels': [LABEL] if values is None else values})}]}}],
            'usageMetadata': {'promptTokenCount': 100, 'candidatesTokenCount': 20, 'totalTokenCount': 120}}


def config():
    return {'schema': 'review-api-benchmark-config-v1', 'models': {'openai': 'test-openai', 'gemini': 'test-gemini'},
            'conditions': list(CONDITIONS), 'max_output_tokens': 2048, 'timeout_seconds': 30}


def dataset_fixture(root):
    root.mkdir()
    tax = taxonomy(); label_list = labels(tax)
    eligibility = {'task': 'text_only', 'text_only_sentiment_eligible': True, 'metadata_supplied_to_model': False}
    records = [{'key': 'synthetic-game:' + str(i), 'text': '음악이 좋다 ' + str(i),
                'text_sha256': digest('음악이 좋다 ' + str(i)), 'labels': [LABEL], 'eligible': True,
                'task_eligibility': copy.deepcopy(eligibility)} for i in range(2)]
    write(root / 'taxonomy.json', tax)
    for split in ('train', 'validation', 'test'):
        write_rows(root / (split + '.jsonl'), records)
    seal(root, {'contract': 'review-training-v06', 'classification_unit': 'leaf_id', 'taxonomy': tax,
                'taxonomy_sha256': fingerprint(tax), 'policy_sha256': fingerprint(POLICY), 'labels': label_list,
                'label_schema_sha256': fingerprint(label_list),
                'label_to_id_sha256': fingerprint({label: i for i, label in enumerate(label_list)}),
                'input_scope': {'body': 'clean_text', 'steam_metadata_in_input': False},
                'synthetic': True, 'steam_in_model_input': False, 'comparison_task': 'text_only-v06',
                'split_counts': {'train': 2, 'validation': 2, 'test': 2}})
    return records


class ProviderTest(unittest.TestCase):
    def call(self, provider, transport):
        return classify(provider, 'test-model', KEY, 'fixed instructions', '음악 좋다',
                        [LABEL, 'SOUND.MUSIC_BGM::부정'], 2048, 30, transport)

    def test_openai_actual_request_contract_and_response(self):
        calls = []
        def mock(url, headers, body, timeout):
            calls.append(body)
            self.assertEqual(url, 'https://api.openai.com/v1/responses')
            self.assertEqual(headers['Authorization'], 'Bearer ' + KEY)
            self.assertEqual(body['max_output_tokens'], 2048)
            self.assertIs(body['store'], False)
            self.assertEqual(body['input'], [{'role': 'user', 'content': [{'type': 'input_text', 'text': '음악 좋다'}]}])
            self.assertEqual(body['text']['format']['type'], 'json_schema')
            self.assertIs(body['text']['format']['strict'], True)
            self.assertEqual(body['model'], 'test-model')
            self.assertEqual(timeout, 30)
            self.assertNotIn('tools', body)
            return openai_response()
        result = self.call('openai', mock)
        self.assertEqual(len(calls), 1); self.assertEqual(result['labels'], [LABEL])
        self.assertEqual(result['usage']['input_tokens'], 100)
        self.assertIsNone(result['actual_cost'])

    def test_gemini_actual_request_contract_and_response(self):
        def mock(url, headers, body, timeout):
            self.assertEqual(url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent')
            self.assertEqual(headers['x-goog-api-key'], KEY)
            self.assertNotIn(KEY, url)
            self.assertEqual(body['contents'], [{'role': 'user', 'parts': [{'text': '음악 좋다'}]}])
            self.assertEqual(body['generationConfig']['maxOutputTokens'], 2048)
            self.assertEqual(body['generationConfig']['responseMimeType'], 'application/json')
            self.assertEqual(body['generationConfig']['candidateCount'], 1)
            self.assertIn('responseJsonSchema', body['generationConfig'])
            return gemini_response()
        self.assertEqual(self.call('gemini', mock)['labels'], [LABEL])

    def test_valid_empty_labels_not_human_no_evaluation(self):
        result = self.call('openai', lambda *args: openai_response([]))
        self.assertEqual(result['state'], 'NO_TARGET_PREDICTED')
        self.assertNotEqual(result['state'], 'NO_CONCRETE_EVALUATION')

    def test_dual_polarity_is_preserved(self):
        values = [LABEL, 'SOUND.MUSIC_BGM::부정']
        self.assertEqual(self.call('openai', lambda *args: openai_response(values))['labels'], values)

    def test_http_errors_timeout_and_transport_are_never_retried_or_leaked(self):
        for status, expected in [(401, 'AUTHENTICATION_FAILED'), (403, 'AUTHENTICATION_FAILED'),
                                 (429, 'QUOTA_OR_RATE_LIMIT'), (500, 'PROVIDER_UNAVAILABLE'),
                                 (503, 'PROVIDER_UNAVAILABLE'), (400, 'PROVIDER_REQUEST_REJECTED'),
                                 (302, 'REDIRECT_REJECTED')]:
            for provider in ('openai', 'gemini'):
                calls = []
                def mock(*args):
                    calls.append(1)
                    raise HTTPError('https://secret.invalid/' + KEY, status, KEY, {}, io.BytesIO(KEY.encode()))
                with self.assertRaisesRegex(ProviderError, '^' + expected + '$') as ctx:
                    self.call(provider, mock)
                self.assertNotIn(KEY, str(ctx.exception)); self.assertEqual(len(calls), 1)
        for error, expected in [(socket.timeout(KEY), 'TIMEOUT_DELIVERY_UNKNOWN'),
                                (RuntimeError(KEY), 'TRANSPORT_OR_RESPONSE_FAILED')]:
            calls = []
            def mock(*args):
                calls.append(1); raise error
            with self.assertRaisesRegex(ProviderError, '^' + expected + '$'):
                self.call('openai', mock)
            self.assertEqual(len(calls), 1)

    def test_refusal_truncation_empty_and_malformed_outputs(self):
        responses = []
        response = openai_response(); response['status'] = 'incomplete'; responses.append(response)
        response = openai_response(); response['output'][0]['content'] = [{'type': 'refusal', 'refusal': KEY}]; responses.append(response)
        response = openai_response(); response['output'] = []; responses.append(response)
        for body in ('', '{"labels":[],"labels":[]}', '{"labels":[],"extra":0}',
                     '{"labels":["invented"]}', '{"labels":NaN}',
                     canonical({'labels': [LABEL, LABEL]}), '```json\n{"labels":[]}\n```'):
            response = openai_response(); response['output'][0]['content'][0]['text'] = body; responses.append(response)
        for response in responses:
            with self.assertRaises(ProviderError):
                self.call('openai', lambda *args: response)
        for finish in ('MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER'):
            response = gemini_response(); response['candidates'][0]['finishReason'] = finish
            with self.assertRaises(ProviderError):
                self.call('gemini', lambda *args: response)

    def test_secret_in_response_model_is_rejected(self):
        response = openai_response(); response['model'] = KEY
        with self.assertRaisesRegex(ProviderError, '^SECRET_IN_RESPONSE$'):
            self.call('openai', lambda *args: response)

    def test_model_url_and_header_injection_rejected_before_transport(self):
        for model in ('../bad', 'https://bad', 'models/bad', 'bad?key=secret'):
            with self.assertRaisesRegex(ProviderError, 'INVALID_PROVIDER_MODEL'):
                classify('gemini', model, KEY, 'instruction', 'text', [LABEL], transport=lambda *a: self.fail())

    def test_actual_http_serialization_with_mock_opener_and_no_redirect(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, cap): return canonical(openai_response()).encode('utf-8')
        class Opener:
            def open(inner, request, timeout):
                self.assertEqual(request.get_method(), 'POST')
                self.assertEqual(request.get_header('Authorization'), 'Bearer ' + KEY)
                self.assertEqual(timeout, 30)
                self.assertEqual(request.data, b'{"test":"body"}')
                return Response()
        with patch('ml.reviews.providers.build_opener', return_value=Opener()):
            self.assertEqual(http_post('https://api.openai.com/v1/responses',
                             {'Authorization': 'Bearer ' + KEY}, {'test': 'body'}, 30)['model'], 'test-openai-version')
        with self.assertRaisesRegex(ProviderError, 'REDIRECT_REJECTED'):
            _NoRedirect().redirect_request(None, None, None, None, None, None)


class BudgetTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name); self.path = self.root / 'budget.sqlite'
        initialize_budget(self.path, 2)

    def tearDown(self):
        self.temp.cleanup()

    def test_duplicate_result_restart_and_total_limit_preserved(self):
        first = Budget(self.path)
        self.assertIsNone(first.reserve('request1'))
        result = {'ok': True, 'labels': [LABEL]}; first.finish('request1', result)
        restarted = Budget(self.path)
        self.assertEqual(restarted.reserve('request1'), result)
        self.assertIsNone(restarted.reserve('request2'))
        restarted.finish('request2', {'ok': False, 'error': 'TIMEOUT_DELIVERY_UNKNOWN'})
        with self.assertRaisesRegex(ValueError, 'APP_CALL_LIMIT_REACHED'):
            restarted.reserve('request3')

    def test_crashed_delivery_and_other_concurrent_request_fail_closed(self):
        Budget(self.path).reserve('request1')
        with self.assertRaisesRegex(ValueError, 'PREVIOUS_DELIVERY_UNKNOWN'):
            Budget(self.path).reserve('request1')
        with self.assertRaisesRegex(ValueError, 'CONCURRENT_EXTERNAL_CALL_BLOCKED'):
            Budget(self.path).reserve('request2')

    def test_parallel_reservations_permit_only_one_active(self):
        def reserve(identity):
            try:
                return Budget(self.path).reserve(identity)
            except ValueError as exc:
                return str(exc)
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(reserve, ('first', 'second')))
        self.assertEqual(results.count(None), 1)
        self.assertIn('CONCURRENT_EXTERNAL_CALL_BLOCKED', results)

    def test_budget_or_receipt_loss_does_not_reinitialize(self):
        self.path.unlink()
        with self.assertRaisesRegex(ValueError, 'BUDGET_STATE_UNAVAILABLE'):
            Budget(self.path).reserve('new')
        self.assertFalse(self.path.exists())
        with self.assertRaisesRegex(ValueError, 'BUDGET_ALREADY_EXISTS'):
            initialize_budget(self.path, 2)

    def test_replaced_db_or_corruption_fail_closed(self):
        connection = sqlite3.connect(self.path)
        connection.execute("UPDATE metadata SET uuid='replacement'"); connection.commit(); connection.close()
        with self.assertRaisesRegex(ValueError, 'BUDGET_STATE_UNAVAILABLE'):
            Budget(self.path).reserve('new')


class RunnerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.dataset = self.root / 'dataset'; self.records = dataset_fixture(self.dataset)
        self.plan = self.root / 'plan'; self.budget = self.root / 'budget.sqlite'
        self.env = {'OPENAI_API_KEY': KEY, 'GEMINI_API_KEY': KEY}
        initialize_budget(self.budget, 8)

    def tearDown(self):
        self.temp.cleanup()

    def test_plan_freezes_four_conditions_prompt_identity_and_no_gold_examples(self):
        result = prepare(self.dataset, config(), self.plan)
        self.assertEqual(result['ready_conditions'], 4)
        self.assertEqual(result['maximum_ready_http_attempts'], 8)
        document = read(self.plan / 'plan.json')
        self.assertEqual([c['id'] for c in document['conditions']], list(CONDITIONS))
        self.assertEqual(document['conditions'][0]['instructions'], document['conditions'][2]['instructions'])
        self.assertEqual(document['conditions'][1]['instructions'], document['conditions'][3]['instructions'])
        self.assertNotEqual(document['conditions'][0]['instructions_sha256'], document['conditions'][1]['instructions_sha256'])
        self.assertIs(document['test_used_for_prompt_selection'], False)
        for row in self.records:
            self.assertNotIn(row['key'], canonical(document))
            self.assertNotIn(row['text'], canonical(document))

    def test_missing_models_and_arbitrary_extra_config_fields_are_rejected(self):
        for modification in ({'models': {'openai': '', 'gemini': ''}}, {'api_key': KEY}, {'base_url': 'https://evil'}):
            bad = config(); bad.update(modification)
            with self.assertRaises(ValueError):
                prepare(self.dataset, bad, self.plan)

    def test_keyless_and_disabled_run_no_final_claim_or_budget_use(self):
        prepare(self.dataset, config(), self.plan)
        with patch('ml.reviews.providers.http_post', side_effect=AssertionError('network forbidden')):
            result = run(self.plan, self.dataset, self.budget, self.root / 'out', environ={})
            self.assertEqual(result['status'], 'BLOCKED_LIVE_CALLS_DISABLED')
            result = run(self.plan, self.dataset, self.budget, self.root / 'out',
                         transport=lambda *a: self.fail('no key must not call'), environ={})
            self.assertEqual(result['status'], 'BLOCKED_KEYS_UNAVAILABLE')
        self.assertFalse((self.root / 'plan.API_FINAL_TEST_CLAIM.json').exists())
        connection = sqlite3.connect(self.budget)
        self.assertEqual(connection.execute('SELECT COUNT(*) FROM requests').fetchone()[0], 0); connection.close()

    def test_mocked_end_to_end_output_and_same_body_only(self):
        prepare(self.dataset, config(), self.plan); calls = []
        def mock(url, headers, body, timeout):
            calls.append(body)
            if 'openai' in url:
                text = body['input'][0]['content'][0]['text']; response = openai_response()
            else:
                text = body['contents'][0]['parts'][0]['text']; response = gemini_response()
            self.assertIn(text, [r['text'] for r in self.records])
            self.assertFalse(any(r['key'] in canonical(body) for r in self.records))
            return response
        target = self.root / 'out'
        result = run(self.plan, self.dataset, self.budget, target, transport=mock, environ=self.env)
        self.assertEqual(result['external_attempts'], 8); self.assertEqual(len(calls), 8)
        report = read(target / 'comparison.json'); verify(target)
        self.assertIs(report['mocked_provider'], True); self.assertIs(report['real_api_verified'], False)
        self.assertEqual(report['test_keyset_sha256'], fingerprint(sorted(r['key'] for r in self.records)))
        self.assertEqual(report['input_scope_sha256'], fingerprint(report['input_scope']))
        self.assertTrue(all(r['full_test_metrics']['micro_f1'] == 1.0 for r in report['reports']))
        self.assertNotIn(KEY, canonical(report))
        with self.assertRaises(FileExistsError):
            run(self.plan, self.dataset, self.budget, self.root / 'second', transport=mock, environ=self.env)
        self.assertEqual(len(calls), 8)

    def test_failure_not_success_or_empty_prediction_and_no_automatic_refund(self):
        prepare(self.dataset, config(), self.plan); calls = []
        def mock(*args):
            calls.append(1)
            if len(calls) == 1:
                raise socket.timeout(KEY)
            return openai_response() if 'openai' in args[0] else gemini_response()
        target = self.root / 'out'
        run(self.plan, self.dataset, self.budget, target, transport=mock, environ=self.env)
        report = read(target / 'comparison.json')['reports'][0]
        self.assertEqual(report['coverage'], .5); self.assertIsNone(report['full_test_metrics'])
        self.assertEqual(report['error_counts'], {'TIMEOUT_DELIVERY_UNKNOWN': 1})
        self.assertNotIn(KEY, (target / 'openai_baseline' / 'predictions.jsonl').read_text())
        with self.assertRaisesRegex(ValueError, 'APP_CALL_LIMIT_REACHED'):
            Budget(self.budget).reserve('ninth')

    def test_state_loss_and_plan_change_prevent_calls(self):
        prepare(self.dataset, config(), self.plan)
        self.budget.unlink()
        with self.assertRaisesRegex(ValueError, 'BUDGET_STATE_UNAVAILABLE'):
            run(self.plan, self.dataset, self.budget, self.root / 'out', transport=lambda *a: self.fail(), environ=self.env)
        self.assertFalse((self.root / 'plan.API_FINAL_TEST_CLAIM.json').exists())

    def test_resealed_mismatched_models_and_empty_conditions_are_rejected(self):
        prepare(self.dataset, config(), self.plan)
        original = read(self.plan / 'plan.json')
        metadata = read(self.plan / 'READY.json')['metadata']
        for change in ('model', 'empty'):
            document = copy.deepcopy(original)
            if change == 'model':
                document['conditions'][1]['model'] = 'different-model'
            else:
                document['conditions'] = []
            write(self.plan / 'plan.json', document); seal(self.plan, metadata)
            with self.assertRaisesRegex(ValueError, 'BENCHMARK_'):
                run(self.plan, self.dataset, self.budget, self.root / 'out', transport=lambda *a: self.fail(), environ=self.env)
        self.assertFalse((self.root / 'plan.API_FINAL_TEST_CLAIM.json').exists())

    def test_app_limit_is_separate_from_provider_failures(self):
        # Three reservations are consumed before the four-condition test starts.
        for index in range(3):
            identity = 'earlier-' + str(index)
            Budget(self.budget).reserve(identity); Budget(self.budget).finish(identity, {'ok': True, 'labels': []})
        prepare(self.dataset, config(), self.plan); calls = []
        def mock(url, *args):
            calls.append(1)
            return openai_response() if 'openai' in url else gemini_response()
        run(self.plan, self.dataset, self.budget, self.root / 'out', transport=mock, environ=self.env)
        report = read(self.root / 'out' / 'comparison.json')
        self.assertEqual(len(calls), 5)
        self.assertEqual(sum(r['error_counts'].get('APP_CALL_LIMIT_REACHED', 0) for r in report['reports']), 3)

    def test_metadata_assisted_row_rejected_before_http(self):
        modified = copy.deepcopy(self.records)
        modified[0]['task_eligibility']['text_only_sentiment_eligible'] = False
        write_rows(self.dataset / 'test.jsonl', modified)
        metadata = read(self.dataset / 'READY.json')['metadata']; seal(self.dataset, metadata)
        prepare(self.dataset, config(), self.plan)
        with self.assertRaisesRegex(ValueError, 'INELIGIBLE_TASK|METADATA_ASSISTED_FINAL_INPUT'):
            run(self.plan, self.dataset, self.budget, self.root / 'out', transport=lambda *a: self.fail(), environ=self.env)


if __name__ == '__main__':
    unittest.main()
