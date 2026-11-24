from contextlib import redirect_stderr, redirect_stdout
import copy
import io
import json
import os
from pathlib import Path
import tempfile
import unittest

from tools.collector_readiness.combined_budget import MAX_INPUT_BYTES, assess, main


def complete_plan():
    return {
        'schema_version': 1,
        'total_ccu_games': 500,
        'interval_minutes': 60,
        'ccu_max_attempts': 3,
        'review_pages_24h': 200,
        'review_max_attempts': 3,
        'other_steam_attempts_24h': 120,
        'safety_reserve_24h': 10000,
        'prior_day_debit': 3077,
        'rolling_day_limit': 50000,
        'minute_limit': 60,
        'minimum_interval_seconds': 1,
        'reviewed_slot_seconds': 3600,
        'non_ccu_slot_reserve_seconds': 300,
        'bounded_send_duration_seconds': 0.2,
        'other_consumers_accounted_for': True,
        'shared_ledger_wiring_verified': True,
    }


class CombinedBudgetTests(unittest.TestCase):
    def test_500_total_games_review_pages_and_prior_usage_all_counted(self):
        result = assess(complete_plan())
        self.assertEqual(result['status'], 'BUDGET_REVIEW_ONLY')
        self.assertEqual(result['ccu_nominal_attempts_24h'], 12000)
        self.assertEqual(result['ccu_attempt_envelope_24h'], 36000)
        self.assertEqual(result['review_attempt_envelope_24h'], 600)
        self.assertEqual(result['steady_day_envelope'], 46720)
        self.assertEqual(result['first_day_envelope'], 49797)
        self.assertEqual(result['first_day_headroom'], 203)
        self.assertEqual(result['ccu_slot_bound_including_reserved_work_seconds'], 2100)
        self.assertFalse(result['operating_readiness_established'])
        self.assertFalse(result['provider_quota_or_burst_allowance_verified'])
        self.assertEqual(result['automatic_production_changes'], 0)
        self.assertEqual(result['external_requests'], 0)

    def test_internal_cap_exact_boundary_and_one_call_less(self):
        plan = complete_plan(); plan['rolling_day_limit'] = 49797
        self.assertEqual(assess(plan)['status'], 'BUDGET_REVIEW_ONLY')
        plan['rolling_day_limit'] -= 1
        result = assess(plan)
        self.assertIn('FIRST_DAY_ENVELOPE_EXCEEDS_INTERNAL_CAP', result['blockers'])
        self.assertNotIn('STEADY_DAY_ENVELOPE_EXCEEDS_INTERNAL_CAP', result['blockers'])

    def test_steady_day_over_cap_and_review_budget_are_not_ignored(self):
        plan = complete_plan(); plan['review_pages_24h'] = 2000
        result = assess(plan)
        self.assertIn('STEADY_DAY_ENVELOPE_EXCEEDS_INTERNAL_CAP', result['blockers'])
        self.assertIn('FIRST_DAY_ENVELOPE_EXCEEDS_INTERNAL_CAP', result['blockers'])
        self.assertEqual(result['review_attempt_envelope_24h'], 6000)

    def test_unknown_review_cap_and_prior_debit_do_not_become_zero(self):
        for field in ['review_pages_24h', 'prior_day_debit', 'other_steam_attempts_24h']:
            with self.subTest(field=field):
                plan = complete_plan(); plan[field] = None
                result = assess(plan)
                self.assertEqual(result['status'], 'BLOCKED')
                self.assertIn('MISSING_OR_UNKNOWN:' + field, result['blockers'])
                self.assertIsNone(result['first_day_envelope'])

    def test_unknown_timeout_is_blocked_even_with_small_pacing_budget(self):
        plan = complete_plan(); plan['bounded_send_duration_seconds'] = None
        result = assess(plan)
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertIsNone(result['ccu_slot_bound_including_reserved_work_seconds'])
        self.assertEqual(result['steady_day_envelope'], 46720)

    def test_minute_pacing_and_non_ccu_time_reserve_change_slot_fit(self):
        plan = complete_plan(); plan['minute_limit'] = 30
        result = assess(plan)
        self.assertEqual(result['ccu_slot_bound_including_reserved_work_seconds'], 3600)
        self.assertIn('CCU_AND_RESERVED_WORK_DO_NOT_FIT_REVIEWED_SLOT', result['blockers'])
        plan['minute_limit'] = 60; plan['non_ccu_slot_reserve_seconds'] = 1800
        self.assertIn('CCU_AND_RESERVED_WORK_DO_NOT_FIT_REVIEWED_SLOT', assess(plan)['blockers'])

    def test_reviewed_window_cannot_exceed_observation_interval(self):
        plan = complete_plan(); plan['reviewed_slot_seconds'] = 3601
        self.assertIn('REVIEWED_WINDOW_EXCEEDS_CCU_INTERVAL', assess(plan)['blockers'])

    def test_failed_wiring_and_other_consumer_claims_block_execution_review(self):
        for field in ['other_consumers_accounted_for', 'shared_ledger_wiring_verified']:
            with self.subTest(field=field):
                plan = complete_plan(); plan[field] = False
                self.assertIn('NOT_VERIFIED:' + field, assess(plan)['blockers'])

    def test_bad_numbers_booleans_and_nonfinite_values_fail_closed(self):
        for field, values in {
            'total_ccu_games': [True, -1, 1.5, 2**63],
            'interval_minutes': [False, 0, -60],
            'review_pages_24h': [False, -1, float('nan')],
            'minimum_interval_seconds': [True, 0, -1, float('nan'), float('inf')],
            'bounded_send_duration_seconds': [False, 0, -1, float('-inf')],
            'non_ccu_slot_reserve_seconds': [-1, True],
        }.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    plan = complete_plan(); plan[field] = value
                    result = assess(plan)
                    self.assertEqual(result['status'], 'BLOCKED')
                    self.assertIn('INVALID_VALUE:' + field, result['blockers'])
                    json.dumps(result, allow_nan=False)

    def test_derived_duration_overflow_is_blocked_and_json_serializable(self):
        plan = complete_plan(); plan['bounded_send_duration_seconds'] = 1e308
        result = assess(plan)
        self.assertIn('UNREPRESENTABLE_RUNTIME_BOUND', result['blockers'])
        self.assertIsNone(result['ccu_slot_bound_including_reserved_work_seconds'])
        json.dumps(result, allow_nan=False)

    def test_closed_request_and_schema_do_not_echo_extra_secrets(self):
        plan = complete_plan(); plan['api_key'] = 'synthetic-private-value'
        result = assess(plan)
        self.assertIn('ADDITIONAL_FIELDS_NOT_ALLOWED', result['blockers'])
        self.assertNotIn('synthetic-private-value', json.dumps(result))
        plan = complete_plan(); plan['schema_version'] = True
        self.assertIn('UNSUPPORTED_SCHEMA_VERSION', assess(plan)['blockers'])

    def test_missing_fields_and_nonobject_are_not_defaulted(self):
        result = assess({})
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertIsNone(result['steady_day_envelope'])
        self.assertIsNone(result['ccu_slots_per_24h'])
        self.assertIn('INPUT_OBJECT_REQUIRED', assess([])['blockers'])

    def test_nondivisible_slot_cadence_uses_ceiling(self):
        plan = complete_plan(); plan.update(total_ccu_games=1, interval_minutes=61)
        result = assess(plan)
        self.assertEqual(result['ccu_slots_per_24h'], 24)
        self.assertEqual(result['ccu_nominal_attempts_24h'], 24)

    def test_zero_review_cap_is_explicit_and_input_is_not_mutated(self):
        plan = complete_plan(); plan['review_pages_24h'] = 0
        before = copy.deepcopy(plan)
        result = assess(plan)
        self.assertEqual(result['review_attempt_envelope_24h'], 0)
        self.assertEqual(result['status'], 'BUDGET_REVIEW_ONLY')
        self.assertEqual(plan, before)


class CombinedBudgetCliTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.input = self.root / 'plan.json'; self.output = self.root / 'result.json'

    def run_cli(self):
        out = io.StringIO(); error = io.StringIO()
        with redirect_stdout(out), redirect_stderr(error):
            code = main(['--input', str(self.input), '--output', str(self.output)])
        return code, out.getvalue(), error.getvalue()

    def test_bom_input_unknown_state_saved_as_blocked_without_overwriting_result(self):
        plan = complete_plan(); plan['prior_day_debit'] = None
        self.input.write_text(json.dumps(plan), encoding='utf-8-sig')
        code, out, error = self.run_cli()
        self.assertEqual(code, 2); self.assertEqual(error, '')
        result = json.loads(self.output.read_text())
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertIsNone(result['first_day_envelope'])
        original = self.output.read_bytes()
        self.input.write_text(json.dumps(complete_plan()))
        code, out, error = self.run_cli()
        self.assertEqual(code, 2); self.assertEqual(out, '')
        self.assertEqual(json.loads(error)['error_code'], 'OUTPUT_ALREADY_EXISTS')
        self.assertEqual(self.output.read_bytes(), original)

    def test_cli_success_is_review_only_and_result_is_private(self):
        self.input.write_text(json.dumps(complete_plan()))
        code, out, error = self.run_cli()
        self.assertEqual((code, error), (0, ''))
        self.assertEqual(json.loads(out)['status'], 'BUDGET_REVIEW_ONLY')
        self.assertEqual(self.output.stat().st_mode & 0o077, 0)

    def test_symlink_input_or_output_is_refused_and_target_is_preserved(self):
        target = self.root / 'target.json'; target.write_text(json.dumps(complete_plan()))
        original = target.read_bytes(); self.input.symlink_to(target)
        code, _, error = self.run_cli()
        self.assertEqual(code, 2); self.assertEqual(json.loads(error)['error_code'], 'SYMLINK_PATH_REFUSED')
        self.assertFalse(self.output.exists())
        self.input.unlink(); self.input.write_text(json.dumps(complete_plan()))
        self.output.symlink_to(target)
        code, _, error = self.run_cli()
        self.assertEqual(code, 2); self.assertEqual(json.loads(error)['error_code'], 'SYMLINK_PATH_REFUSED')
        self.assertEqual(target.read_bytes(), original)

    def test_fifo_input_is_refused_without_waiting_for_a_writer(self):
        os.mkfifo(self.input)
        code, out, error = self.run_cli()
        self.assertEqual((code, out), (2, ''))
        self.assertEqual(json.loads(error)['error_code'], 'INPUT_REGULAR_FILE_REQUIRED')
        self.assertFalse(self.output.exists())

    def test_malformed_duplicate_nonstandard_and_oversized_input_never_echoed(self):
        for body, expected in [
            ('synthetic-private-value', 'INPUT_JSON_INVALID'),
            ('{"api_key":"synthetic-private-value","api_key":"synthetic-second-value"}', 'DUPLICATE_JSON_FIELD'),
            ('{"schema_version":NaN}', 'NONSTANDARD_JSON_NUMBER'),
            (' ' * (MAX_INPUT_BYTES + 1), 'INPUT_TOO_LARGE'),
        ]:
            with self.subTest(expected=expected):
                self.input.write_text(body)
                code, out, error = self.run_cli()
                self.assertEqual(code, 2); self.assertEqual(out, '')
                self.assertEqual(json.loads(error)['error_code'], expected)
                self.assertNotIn('synthetic-private-value', error)
                self.assertFalse(self.output.exists())

    def test_unknown_arguments_never_echo_their_values(self):
        error = io.StringIO()
        with redirect_stderr(error):
            code = main(['--input', 'unused', '--output', 'unused', '--api-key', 'synthetic-private-value'])
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(error.getvalue())['error_code'], 'INVALID_ARGUMENTS')
        self.assertNotIn('synthetic-private-value', error.getvalue())


if __name__ == '__main__':
    unittest.main()
