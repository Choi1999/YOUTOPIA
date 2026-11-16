"""Durable, fail-closed HTTP reservations. No keys, refunds, or automatic resets."""
from contextlib import contextmanager
import os
import math
from pathlib import Path
import sqlite3
import stat
import time


class Blocked(RuntimeError):
    """An external request must not be sent."""


class Budget:
    def __init__(self, path, policy, *, clock=time.time):
        self.path = Path(path)
        self.policy = policy
        self.clock = clock
        for key in ('rolling_day_limit', 'minute_limit', 'minimum_interval_seconds'):
            value = policy.get(key)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
                raise Blocked('INVALID_BUDGET_POLICY')
        for key in ('rolling_day_limit', 'minute_limit'):
            if not isinstance(policy[key], int):
                raise Blocked('INVALID_BUDGET_POLICY')
        if not isinstance(policy.get('state_id'), str) or not policy['state_id']:
            raise Blocked('MISSING_STATE_ID')

    @staticmethod
    def initialize(path, *, state_id, clock=time.time, initial_day_debit=0):
        """Explicit operator initialization, never called by a request path."""
        p = Path(path)
        if not state_id or p.exists() or p.is_symlink():
            raise Blocked('STATE_ALREADY_EXISTS_OR_INVALID')
        if isinstance(initial_day_debit, bool) or not isinstance(initial_day_debit, int) or not 0 <= initial_day_debit <= 1000000:
            raise Blocked('INVALID_INITIAL_DAY_DEBIT')
        if not p.parent.is_dir():
            raise Blocked('STATE_DIRECTORY_MISSING')
        if p.parent.is_symlink() or p.parent.stat().st_mode & 0o022:
            raise Blocked('STATE_DIRECTORY_WRITABLE_BY_OTHERS')
        descriptor = os.open(p, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
        connection = None
        try:
            connection = sqlite3.connect(p)
            connection.executescript('''
              PRAGMA synchronous=FULL;
              CREATE TABLE meta (id INTEGER PRIMARY KEY CHECK(id=1), state_id TEXT NOT NULL,
                schema_version INTEGER NOT NULL, last_clock REAL NOT NULL, blocked_until REAL NOT NULL,
                reservation_count INTEGER NOT NULL);
              CREATE TABLE reservations (request_id TEXT PRIMARY KEY, reserved_at REAL NOT NULL,
                operation TEXT NOT NULL, outcome TEXT NOT NULL DEFAULT 'RESERVED');
              CREATE INDEX reservations_time ON reservations(reserved_at);
            ''')
            now = clock()
            connection.execute('INSERT INTO meta VALUES(1,?,1,?,0,?)', (state_id, now, initial_day_debit))
            # Charge the observed pre-install 24h volume conservatively for a full
            # day. These are explicit accounting debits, not fabricated HTTP calls.
            connection.executemany('INSERT INTO reservations VALUES(?,?,?,?)',
                ((f'baseline-{n}',now,'BASELINE_DAY_DEBIT','SUCCESS') for n in range(initial_day_debit)))
            connection.commit()
        except Exception as error:
            raise Blocked('STATE_INITIALIZATION_FAILED_DO_NOT_REINITIALIZE') from error
        finally:
            if connection is not None:
                connection.close()

    def _connect(self):
        try:
            info = self.path.lstat()
            if self.path.is_symlink() or not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or self.path.parent.is_symlink() or self.path.parent.stat().st_mode & 0o022:
                raise Blocked('UNPROTECTED_STATE')
            connection = sqlite3.connect(self.path.resolve().as_uri() + '?mode=rw', uri=True,
                                         timeout=3, isolation_level=None)
            connection.execute('PRAGMA synchronous=FULL')
            row = connection.execute('SELECT state_id,schema_version,last_clock,blocked_until FROM meta WHERE id=1').fetchone()
            if not row or row[0] != self.policy['state_id'] or row[1] != 1:
                connection.close()
                raise Blocked('STATE_ID_OR_SCHEMA_MISMATCH')
            return connection
        except Blocked:
            raise
        except (OSError, sqlite3.Error) as error:
            raise Blocked('BUDGET_STATE_UNAVAILABLE') from error

    @contextmanager
    def _transaction(self):
        connection = self._connect()
        try:
            connection.execute('BEGIN IMMEDIATE')
            recorded = connection.execute('SELECT reservation_count FROM meta WHERE id=1').fetchone()
            actual = connection.execute('SELECT count(*) FROM reservations').fetchone()[0]
            if not recorded or recorded[0] != actual:
                raise Blocked('BUDGET_LEDGER_LOSS')
            yield connection
            connection.execute('COMMIT')
        except Blocked:
            if connection.in_transaction:
                connection.execute('ROLLBACK')
            raise
        except sqlite3.Error as error:
            if connection.in_transaction:
                connection.execute('ROLLBACK')
            raise Blocked('BUDGET_TRANSACTION_FAILED') from error
        finally:
            connection.close()

    def reserve(self, request_id, operation):
        if not isinstance(request_id, str) or not 1 <= len(request_id) <= 128:
            raise Blocked('INVALID_REQUEST_ID')
        if not isinstance(operation, str) or not operation or len(operation) > 64:
            raise Blocked('INVALID_OPERATION')
        with self._transaction() as connection:
            row = connection.execute('SELECT outcome FROM reservations WHERE request_id=?', (request_id,)).fetchone()
            if row:
                raise Blocked('DUPLICATE_REQUEST_NO_RESEND')
            if connection.execute("SELECT 1 FROM reservations WHERE outcome='RESERVED' LIMIT 1").fetchone():
                raise Blocked('IN_FLIGHT_OR_UNRESOLVED_REQUEST')
            now = float(self.clock())
            meta = connection.execute('SELECT last_clock,blocked_until FROM meta WHERE id=1').fetchone()
            if now < meta[0]:
                raise Blocked('CLOCK_MOVED_BACKWARDS')
            if now < meta[1]:
                raise Blocked('PROVIDER_COOLDOWN')
            day_count = connection.execute('SELECT count(*) FROM reservations WHERE reserved_at>?', (now - 86400,)).fetchone()[0]
            minute_count = connection.execute("SELECT count(*) FROM reservations WHERE reserved_at>? AND operation!='BASELINE_DAY_DEBIT'", (now - 60,)).fetchone()[0]
            latest = connection.execute("SELECT max(reserved_at) FROM reservations WHERE operation!='BASELINE_DAY_DEBIT'").fetchone()[0]
            if day_count >= self.policy['rolling_day_limit']:
                raise Blocked('ROLLING_DAY_LIMIT')
            if minute_count >= self.policy['minute_limit']:
                raise Blocked('MINUTE_LIMIT')
            if operation.startswith('NEW:'):
                new_limit = self.policy.get('new_rolling_day_limit', 0)
                new_count = connection.execute("SELECT count(*) FROM reservations WHERE reserved_at>? AND operation LIKE 'NEW:%'", (now-86400,)).fetchone()[0]
                if isinstance(new_limit, bool) or not isinstance(new_limit, int) or new_limit < 1 or new_count >= new_limit:
                    raise Blocked('NEW_WORK_BUDGET_LIMIT')
            if latest is not None and now - latest < self.policy['minimum_interval_seconds']:
                raise Blocked('MINIMUM_INTERVAL')
            connection.execute('INSERT INTO reservations(request_id,reserved_at,operation) VALUES(?,?,?)',
                               (request_id, now, operation))
            connection.execute('UPDATE meta SET last_clock=?,reservation_count=reservation_count+1 WHERE id=1', (now,))

    def finish(self, request_id, outcome, *, cooldown_seconds=0):
        if outcome not in {'SUCCESS', 'HTTP_ERROR', 'NETWORK_UNKNOWN', 'CONTRACT_ERROR'}:
            raise Blocked('INVALID_OUTCOME')
        if isinstance(cooldown_seconds,bool) or not isinstance(cooldown_seconds,(int,float)) or not math.isfinite(cooldown_seconds) or cooldown_seconds<0:
            raise Blocked('INVALID_COOLDOWN')
        with self._transaction() as connection:
            row = connection.execute('SELECT outcome FROM reservations WHERE request_id=?', (request_id,)).fetchone()
            if not row or row[0] != 'RESERVED':
                raise Blocked('UNKNOWN_OR_ALREADY_FINISHED_RESERVATION')
            connection.execute('UPDATE reservations SET outcome=? WHERE request_id=?', (outcome, request_id))
            now = float(self.clock())
            previous = connection.execute('SELECT last_clock FROM meta WHERE id=1').fetchone()[0]
            if now < previous:
                raise Blocked('CLOCK_MOVED_BACKWARDS')
            connection.execute('UPDATE meta SET last_clock=?,blocked_until=max(blocked_until,?) WHERE id=1',
                               (now, now + max(0, cooldown_seconds)))

    def status(self):
        with self._transaction() as connection:
            row = connection.execute('SELECT state_id,last_clock,blocked_until FROM meta WHERE id=1').fetchone()
            return {'state_id': row[0], 'last_clock': row[1], 'blocked_until': row[2],
                    'reservations_total': connection.execute('SELECT count(*) FROM reservations').fetchone()[0],
                    'baseline_day_debits': connection.execute("SELECT count(*) FROM reservations WHERE operation='BASELINE_DAY_DEBIT'").fetchone()[0],
                    'unresolved': [dict(zip(('request_id','reserved_at','operation'),x)) for x in connection.execute("SELECT request_id,reserved_at,operation FROM reservations WHERE outcome='RESERVED' LIMIT 2")]}
