"""Pure CCU + review-page call-budget review; never authorizes execution.

All CCU games, including the existing pool and delayed/cooldown targets, belong
in total_ccu_games. Review pages are a proposed future page cap, not a measured
review count. Other Steam work must include its own retry envelope and exclude
the CCU/review amounts already entered here. No network, DB or ledger is opened.

Run independently of the collector CLI:
  python3 -B -m tools.collector_readiness.combined_budget --input PLAN --output NEW_RESULT
"""
import argparse
from decimal import Decimal, ROUND_CEILING, localcontext
import json
import math
import os
from pathlib import Path
import stat
import sys


SCHEMA_VERSION = 1
MAX_INPUT_BYTES = 32768
MAX_INTEGER = 2**63 - 1
INTEGER_MINIMUMS = {
    'total_ccu_games': 0,
    'interval_minutes': 1,
    'ccu_max_attempts': 1,
    'review_pages_24h': 0,
    'review_max_attempts': 1,
    'other_steam_attempts_24h': 0,
    'safety_reserve_24h': 0,
    'prior_day_debit': 0,
    'rolling_day_limit': 1,
    'minute_limit': 1,
}
NUMBER_MINIMUMS = {
    'minimum_interval_seconds': (0, False),
    'reviewed_slot_seconds': (0, False),
    'non_ccu_slot_reserve_seconds': (0, True),
    'bounded_send_duration_seconds': (0, False),
}
BOOLEAN_FIELDS = ('other_consumers_accounted_for', 'shared_ledger_wiring_verified')
FIELDS = frozenset(INTEGER_MINIMUMS) | frozenset(NUMBER_MINIMUMS) | frozenset(BOOLEAN_FIELDS) | {'schema_version'}


def assess(document):
    """Return an auditable calculation or blockers; unknown input stays unknown.

    bounded_send_duration_seconds must bound network/DB/processing time and
    amortize every retry/backoff/Retry-After wait per transmission. If that bound
    is unknown or unbounded, enter null: a pacing-only calculation cannot pass.
    The slot window must already account for actual cron/lock/wrapper limits.
    This function cannot verify those claims or source freshness on its own.
    """
    blockers = []
    values = {}
    if not isinstance(document, dict):
        blockers.append('INPUT_OBJECT_REQUIRED')
        document = {}
    if set(document) - FIELDS:
        # Do not echo untrusted additional keys or their possible secret values.
        blockers.append('ADDITIONAL_FIELDS_NOT_ALLOWED')
    if 'schema_version' not in document or document['schema_version'] is None:
        blockers.append('MISSING_OR_UNKNOWN:schema_version')
    elif type(document['schema_version']) is not int or document['schema_version'] != SCHEMA_VERSION:
        blockers.append('UNSUPPORTED_SCHEMA_VERSION')

    for field, minimum in INTEGER_MINIMUMS.items():
        value = document.get(field)
        if value is None:
            blockers.append('MISSING_OR_UNKNOWN:' + field)
        elif type(value) is not int or not minimum <= value <= MAX_INTEGER:
            blockers.append('INVALID_VALUE:' + field)
        else:
            values[field] = value
    for field, (minimum, inclusive) in NUMBER_MINIMUMS.items():
        value = document.get(field)
        if value is None:
            blockers.append('MISSING_OR_UNKNOWN:' + field)
            continue
        valid = type(value) in (int, float)
        try:
            valid = valid and math.isfinite(value) and (value >= minimum if inclusive else value > minimum)
        except (OverflowError, TypeError):
            valid = False
        if not valid:
            blockers.append('INVALID_VALUE:' + field)
        else:
            values[field] = value
    for field in BOOLEAN_FIELDS:
        value = document.get(field)
        if value is None:
            blockers.append('MISSING_OR_UNKNOWN:' + field)
        elif type(value) is not bool:
            blockers.append('INVALID_VALUE:' + field)
        elif not value:
            blockers.append('NOT_VERIFIED:' + field)

    def have(*fields):
        return all(field in values for field in fields)

    slots = nominal_ccu = ccu = reviews = steady = initial = slot_bound = pacing = None
    if have('interval_minutes'):
        interval = values['interval_minutes']
        slots = (1440 + interval - 1) // interval
    if slots is not None and have('total_ccu_games', 'ccu_max_attempts'):
        nominal_ccu = slots * values['total_ccu_games']
        ccu = nominal_ccu * values['ccu_max_attempts']
    if have('review_pages_24h', 'review_max_attempts'):
        reviews = values['review_pages_24h'] * values['review_max_attempts']
    if ccu is not None and reviews is not None and have('other_steam_attempts_24h', 'safety_reserve_24h'):
        steady = ccu + reviews + values['other_steam_attempts_24h'] + values['safety_reserve_24h']
        if have('prior_day_debit'):
            initial = steady + values['prior_day_debit']
    if have('rolling_day_limit'):
        if steady is not None and steady > values['rolling_day_limit']:
            blockers.append('STEADY_DAY_ENVELOPE_EXCEEDS_INTERNAL_CAP')
        if initial is not None and initial > values['rolling_day_limit']:
            blockers.append('FIRST_DAY_ENVELOPE_EXCEEDS_INTERNAL_CAP')
    if have('minute_limit', 'minimum_interval_seconds'):
        pacing = max(values['minimum_interval_seconds'], 60 / values['minute_limit'])
    if pacing is not None and have('total_ccu_games', 'ccu_max_attempts',
                                  'bounded_send_duration_seconds', 'non_ccu_slot_reserve_seconds'):
        try:
            # Positive decimal arithmetic rounds upward; a float conversion must
            # not accidentally make an exactly-full slot look slightly shorter.
            with localcontext() as context:
                context.prec = 50
                context.rounding = ROUND_CEILING
                exact_pacing = max(Decimal(str(values['minimum_interval_seconds'])),
                                   Decimal(60) / Decimal(values['minute_limit']))
                bound = (Decimal(values['total_ccu_games']) * Decimal(values['ccu_max_attempts'])
                         * (exact_pacing + Decimal(str(values['bounded_send_duration_seconds'])))
                         + Decimal(str(values['non_ccu_slot_reserve_seconds'])))
                slot_bound = float(bound)
                if math.isfinite(slot_bound) and Decimal.from_float(slot_bound) < bound:
                    slot_bound = math.nextafter(slot_bound, math.inf)
            if not math.isfinite(slot_bound):
                raise OverflowError()
        except OverflowError:
            slot_bound = None
            blockers.append('UNREPRESENTABLE_RUNTIME_BOUND')
    if have('reviewed_slot_seconds', 'interval_minutes'):
        if values['reviewed_slot_seconds'] > values['interval_minutes'] * 60:
            blockers.append('REVIEWED_WINDOW_EXCEEDS_CCU_INTERVAL')
    if slot_bound is not None and have('reviewed_slot_seconds'):
        if slot_bound >= values['reviewed_slot_seconds']:
            blockers.append('CCU_AND_RESERVED_WORK_DO_NOT_FIT_REVIEWED_SLOT')

    return {
        'schema_version': SCHEMA_VERSION,
        'kind': 'COMBINED_STEAM_BUDGET_REVIEW_V1',
        'status': 'BLOCKED' if blockers else 'BUDGET_REVIEW_ONLY',
        'blockers': blockers,
        'ccu_slots_per_24h': slots,
        'ccu_nominal_attempts_24h': nominal_ccu,
        'ccu_attempt_envelope_24h': ccu,
        'review_attempt_envelope_24h': reviews,
        'other_steam_attempt_envelope_24h': values.get('other_steam_attempts_24h'),
        'safety_reserve_24h': values.get('safety_reserve_24h'),
        'steady_day_envelope': steady,
        'prior_day_debit': values.get('prior_day_debit'),
        'first_day_envelope': initial,
        'internal_rolling_day_limit': values.get('rolling_day_limit'),
        'first_day_headroom': (values['rolling_day_limit'] - initial
                               if initial is not None and have('rolling_day_limit') else None),
        'pacing_seconds_per_attempt_used': pacing,
        'ccu_slot_bound_including_reserved_work_seconds': slot_bound,
        'reviewed_slot_seconds': values.get('reviewed_slot_seconds'),
        'automatic_production_changes': 0,
        'external_requests': 0,
        'operating_readiness_established': False,
        'provider_quota_or_burst_allowance_verified': False,
        'limitations': [
            'A budget calculation is not permission to execute, provider approval, or proof of source freshness.',
            'total_ccu_games includes existing, added, cooldown and delayed-recheck targets; do not subtract existing games twice.',
            'Review pages are an explicit future cap, not observed reviews; refresh pages, retries and other consumers must all be accounted for.',
            'Other Steam work excludes the entered CCU/review envelopes and includes its own maximum transmissions.',
            'The per-transmission duration must cover network, processing and retry waits; unbounded Retry-After means the duration is unknown.',
            'The non-CCU slot reserve must cover all competing work in the reviewed window, including review-page work if scheduled there.',
            'Actual cron, lock, wrapper, shared-ledger wiring, endpoint rules and operating tests require separate verification.',
        ],
    }


class InputError(ValueError):
    """Safe fixed-code CLI error; never attach original data or exception text."""


def _check_symlinks(path):
    try:
        has_link = any(part.is_symlink() for part in (path, *path.absolute().parents))
    except (OSError, ValueError):
        raise InputError('FILE_PATH_UNAVAILABLE') from None
    if has_link:
        raise InputError('SYMLINK_PATH_REFUSED')


def _read_document(path):
    path = Path(path)
    _check_symlinks(path)
    try:
        descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0)
                             | getattr(os, 'O_NONBLOCK', 0))
        with os.fdopen(descriptor, 'rb') as source:
            info = os.fstat(source.fileno())
            if not stat.S_ISREG(info.st_mode):
                raise InputError('INPUT_REGULAR_FILE_REQUIRED')
            if info.st_size > MAX_INPUT_BYTES:
                raise InputError('INPUT_TOO_LARGE')
            data = source.read(MAX_INPUT_BYTES + 1)
    except InputError:
        raise
    except (OSError, ValueError):
        raise InputError('INPUT_FILE_UNAVAILABLE') from None
    if len(data) > MAX_INPUT_BYTES:
        raise InputError('INPUT_TOO_LARGE')

    def reject_constant(_value):
        raise InputError('NONSTANDARD_JSON_NUMBER')

    def unique_fields(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise InputError('DUPLICATE_JSON_FIELD')
            out[key] = value
        return out

    try:
        return json.loads(data.decode('utf-8-sig'), parse_constant=reject_constant,
                          object_pairs_hook=unique_fields)
    except (UnicodeError, json.JSONDecodeError, RecursionError, ValueError) as error:
        if isinstance(error, InputError):
            raise
        raise InputError('INPUT_JSON_INVALID') from None


def _write_result(path, result):
    path = Path(path)
    _check_symlinks(path)
    data = (json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
    except FileExistsError:
        raise InputError('OUTPUT_ALREADY_EXISTS') from None
    except (OSError, ValueError):
        raise InputError('OUTPUT_FILE_UNAVAILABLE') from None


class _Parser(argparse.ArgumentParser):
    def error(self, _message):
        raise InputError('INVALID_ARGUMENTS')


def main(argv=None):
    parser = _Parser(prog='combined-budget-review', description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    try:
        args = parser.parse_args(argv)
        result = assess(_read_document(args.input))
        _write_result(args.output, result)
    except InputError as error:
        print(json.dumps({'status': 'BLOCKED', 'error_code': str(error),
                          'automatic_production_changes': 0}), file=sys.stderr)
        return 2
    print(json.dumps({'status': result['status'], 'automatic_production_changes': 0,
                      'operating_readiness_established': False}))
    return 2 if result['status'] == 'BLOCKED' else 0


if __name__ == '__main__':
    raise SystemExit(main())
