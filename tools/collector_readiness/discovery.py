"""Real, bounded Steam candidate discovery into an isolated durable staging DB.

This module never changes the service/collector PostgreSQL database. Discovery
does not mean CCU admission; its output must pass the separate readiness gates.
"""
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from .limits import Blocked, Budget

APP_LIST = 'https://api.steampowered.com/IStoreService/GetAppList/v1/'
STORE_ITEMS = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/'
ALLOWED_ENDPOINTS = {APP_LIST, STORE_ITEMS}


class ProviderFailure(RuntimeError):
    pass


def retry_after(value, now):
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        try:
            date = parsedate_to_datetime(value)
            if date.tzinfo is None:
                return 300.0
            return max(0.0, date.timestamp() - now)
        except (TypeError, ValueError, OverflowError):
            return 300.0


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class SteamHTTP:
    def __init__(self, *, key, budget, opener=None, clock=time.time):
        if not isinstance(key, str) or not key.strip() or any(x in key for x in ('\r', '\n')):
            raise Blocked('STEAM_KEY_MISSING_OR_INVALID')
        self._key = key.strip()
        self.budget = budget
        self.clock = clock
        self.opener = opener or urllib.request.build_opener(NoRedirect(),
                            urllib.request.HTTPSHandler(context=ssl.create_default_context()))

    def get(self, endpoint, document, *, operation):
        if endpoint not in ALLOWED_ENDPOINTS:
            raise Blocked('ENDPOINT_NOT_ALLOWLISTED')
        request_id = uuid.uuid4().hex
        self.budget.reserve(request_id, 'NEW:' + operation)
        request = urllib.request.Request(endpoint + '?' + urllib.parse.urlencode({
            'input_json': json.dumps(document, separators=(',', ':'))}),
            headers={'x-webapi-key': self._key, 'User-Agent': 'YoutopiaCollectorReadiness/1'})
        try:
            with self.opener.open(request, timeout=20) as response:
                body = response.read(8 * 1024 * 1024 + 1)
                status = response.status
                if not 200 <= status < 300:
                    self.budget.finish(request_id, 'HTTP_ERROR', cooldown_seconds=300)
                    raise ProviderFailure('HTTP_FAILURE')
                if len(body) > 8 * 1024 * 1024:
                    self.budget.finish(request_id, 'CONTRACT_ERROR')
                    raise ProviderFailure('OVERSIZED_RESPONSE')
        except urllib.error.HTTPError as error:
            delay = max(60, retry_after((error.headers or {}).get('Retry-After'), self.clock())) if error.code == 429 else 300
            self.budget.finish(request_id, 'HTTP_ERROR', cooldown_seconds=delay)
            # Never follow redirects, rotate credentials, echo URLs/bodies, or retry.
            if error.code == 429:
                raise ProviderFailure('PROVIDER_RATE_LIMIT') from None
            if error.code in (401, 403):
                raise ProviderFailure('PROVIDER_AUTHORIZATION') from None
            if 300 <= error.code < 400:
                raise ProviderFailure('PROVIDER_REDIRECT_REFUSED') from None
            raise ProviderFailure('PROVIDER_HTTP_ERROR') from None
        except (urllib.error.URLError, TimeoutError, OSError):
            self.budget.finish(request_id, 'NETWORK_UNKNOWN', cooldown_seconds=300)
            raise ProviderFailure('NETWORK_SEND_STATUS_UNKNOWN') from None
        try:
            result = json.loads(body)
            if not isinstance(result, dict):
                raise ValueError()
        except (ValueError, UnicodeDecodeError):
            self.budget.finish(request_id, 'CONTRACT_ERROR')
            raise ProviderFailure('INVALID_PROVIDER_JSON') from None
        self.budget.finish(request_id, 'SUCCESS')
        return request_id, body, result


def parse_app_page(document, *, after_app_id):
    response = document.get('response')
    if not isinstance(response, dict) or not isinstance(response.get('apps'), list):
        raise ProviderFailure('APP_LIST_CONTRACT')
    more = response.get('have_more_results')
    if not isinstance(more, bool):
        raise ProviderFailure('APP_LIST_PAGINATION_UNKNOWN')
    rows, seen = [], set()
    for item in response['apps']:
        if not isinstance(item, dict):
            raise ProviderFailure('APP_LIST_ROW_CONTRACT')
        app_id, modified = item.get('appid'), item.get('last_modified')
        if isinstance(app_id, bool) or not isinstance(app_id, int) or not after_app_id < app_id < 2**32:
            raise ProviderFailure('APP_LIST_ID_NOT_MONOTONIC')
        if app_id in seen or (rows and app_id <= rows[-1]['app_id']):
            raise ProviderFailure('APP_LIST_DUPLICATE_OR_UNORDERED')
        if isinstance(modified, bool) or not isinstance(modified, int) or modified < 0:
            raise ProviderFailure('APP_LIST_MODIFIED_TIME_UNKNOWN')
        seen.add(app_id)
        rows.append({'app_id': app_id, 'name': item.get('name') if isinstance(item.get('name'), str) else None,
                     'last_modified': modified})
    cursor = response.get('last_appid', rows[-1]['app_id'] if rows else after_app_id)
    if isinstance(cursor, bool) or not isinstance(cursor, int) or (rows and cursor != rows[-1]['app_id']):
        raise ProviderFailure('APP_LIST_CURSOR_CONTRACT')
    if more and (not rows or cursor <= after_app_id):
        raise ProviderFailure('APP_LIST_CURSOR_NOT_ADVANCING')
    return rows, more, cursor


class Staging:
    def __init__(self, path):
        self.path = Path(path)
        if self.path.is_symlink() or not self.path.is_file() or self.path.stat().st_mode & 0o077:
            raise Blocked('STAGING_MISSING_OR_UNPROTECTED')

    @staticmethod
    def initialize(path):
        p = Path(path)
        descriptor = os.open(p, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(descriptor)
        with closing(sqlite3.connect(p)) as connection:
            connection.executescript('''
                PRAGMA synchronous=FULL;
                CREATE TABLE checkpoint(id INTEGER PRIMARY KEY CHECK(id=1), watermark INTEGER NOT NULL,
                  scan_started INTEGER, cursor INTEGER NOT NULL);
                INSERT INTO checkpoint VALUES(1,0,NULL,0);
                CREATE TABLE discovery_page(run_reference TEXT PRIMARY KEY, received_at REAL NOT NULL,
                  after_app_id INTEGER NOT NULL, body BLOB NOT NULL, sha256 TEXT NOT NULL);
                CREATE TABLE candidate(app_id INTEGER PRIMARY KEY, name TEXT, last_modified INTEGER NOT NULL,
                  first_seen REAL NOT NULL, last_seen REAL NOT NULL, source_run TEXT NOT NULL,
                  FOREIGN KEY(source_run) REFERENCES discovery_page(run_reference));
                CREATE TABLE metadata_run(run_reference TEXT PRIMARY KEY,app_id INTEGER NOT NULL,
                  received_at REAL NOT NULL,body BLOB NOT NULL,sha256 TEXT NOT NULL,projection TEXT NOT NULL);
                CREATE TABLE metadata_current(app_id INTEGER PRIMARY KEY,run_reference TEXT NOT NULL,
                  FOREIGN KEY(run_reference) REFERENCES metadata_run(run_reference));
                CREATE TABLE admission(decision_id TEXT PRIMARY KEY,app_id INTEGER NOT NULL,
                  plan_sha256 TEXT NOT NULL,metadata_run_reference TEXT NOT NULL,
                  admitted_at TEXT NOT NULL,expires_at TEXT NOT NULL);
                CREATE TABLE admission_event(event_id INTEGER PRIMARY KEY,decision_id TEXT NOT NULL,
                  event_type TEXT NOT NULL,at TEXT NOT NULL,FOREIGN KEY(decision_id) REFERENCES admission(decision_id));
            ''')
            connection.commit()

    @contextmanager
    def connect(self):
        connection = None
        try:
            if self.path.is_symlink() or not self.path.is_file() or self.path.stat().st_mode & 0o077 or self.path.parent.is_symlink() or self.path.parent.stat().st_mode & 0o022:
                raise Blocked('STAGING_MISSING_OR_UNPROTECTED')
            connection = sqlite3.connect(self.path.resolve().as_uri() + '?mode=rw', uri=True, timeout=3)
            connection.execute('PRAGMA foreign_keys=ON')
            connection.execute('PRAGMA synchronous=FULL')
            if not connection.execute('SELECT 1 FROM checkpoint WHERE id=1').fetchone():
                raise Blocked('STAGING_CHECKPOINT_LOST')
            with connection:
                yield connection
        except sqlite3.Error:
            raise Blocked('STAGING_STATE_UNAVAILABLE') from None
        finally:
            if connection is not None:
                connection.close()

    def checkpoint(self, *, now):
        with self.connect() as connection:
            row = connection.execute('SELECT watermark,scan_started,cursor FROM checkpoint WHERE id=1').fetchone()
            if row[1] is None:
                connection.execute('UPDATE checkpoint SET scan_started=? WHERE id=1', (int(now),))
                return row[0], int(now), row[2]
            return row

    def commit_page(self, *, run_reference, body, rows, after, more, cursor, started, now):
        with self.connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            stored = connection.execute('SELECT scan_started,cursor FROM checkpoint WHERE id=1').fetchone()
            if stored != (started, after):
                raise Blocked('CONCURRENT_OR_STALE_DISCOVERY_CHECKPOINT')
            connection.execute('INSERT INTO discovery_page VALUES(?,?,?,?,?)',
                               (run_reference, now, after, body, hashlib.sha256(body).hexdigest()))
            for row in rows:
                connection.execute('''INSERT INTO candidate VALUES(?,?,?,?,?,?)
                  ON CONFLICT(app_id) DO UPDATE SET name=coalesce(excluded.name,candidate.name),
                  last_modified=max(candidate.last_modified,excluded.last_modified),
                  last_seen=excluded.last_seen,source_run=excluded.source_run''',
                  (row['app_id'], row['name'], row['last_modified'], now, now, run_reference))
            if more:
                connection.execute('UPDATE checkpoint SET cursor=? WHERE id=1', (cursor,))
            else:
                # Commit scan-start watermark only after all pages; overlap catches changes.
                connection.execute('UPDATE checkpoint SET watermark=max(watermark,?),scan_started=NULL,cursor=0 WHERE id=1',
                                   (max(0, started - 300),))

    def metadata_candidates(self, *, maximum, now):
        with self.connect() as connection:
            return [row[0] for row in connection.execute('''SELECT c.app_id FROM candidate c
              LEFT JOIN metadata_current m ON m.app_id=c.app_id
              LEFT JOIN metadata_run r ON r.run_reference=m.run_reference
              WHERE r.run_reference IS NULL OR r.received_at<?
              ORDER BY c.last_modified DESC,c.app_id DESC LIMIT ?''',(now-86400,maximum))]

    def save_metadata(self, run_reference, app_id, body, row, *, now):
        with self.connect() as connection:
            connection.execute('INSERT INTO metadata_run VALUES(?,?,?,?,?,?)',
                (run_reference,app_id,now,body,hashlib.sha256(body).hexdigest(),json.dumps(row,sort_keys=True)))
            connection.execute('INSERT INTO metadata_current VALUES(?,?) ON CONFLICT(app_id) DO UPDATE SET run_reference=excluded.run_reference',
                               (app_id,run_reference))

    def metadata_rows(self):
        with self.connect() as connection:
            return [json.loads(x[0]) for x in connection.execute('''SELECT r.projection FROM metadata_current c
              JOIN metadata_run r ON r.run_reference=c.run_reference ORDER BY c.app_id''')]


@contextmanager
def cohort_lock(staging_path):
    """Serialize cohort tools sharing the reviewed persistent staging directory.

    This supplements, and does not replace, the existing collector wrapper lock.
    """
    import fcntl
    Staging(staging_path)
    descriptor=os.open(str(staging_path)+'.cohort.lock',os.O_CREAT|os.O_WRONLY|os.O_NOFOLLOW,0o600)
    try:
        try:fcntl.flock(descriptor,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise Blocked('ANOTHER_COHORT_TOOL_IS_RUNNING') from None
        yield
    finally:os.close(descriptor)


def metadata_row(body, app_id, run_reference, *, observed_at, mapping, parser=None):
    if parser is None:
        from youtopia_collector.sources.steam.parsers import parse_store_item_items
        parser = parse_store_item_items
    parsed = parser(body)
    matches = [x for x in parsed.items if x.app_id == app_id]
    if len(matches) != 1 or len(parsed.items) != 1:
        return {'app_id':app_id,'identity_status':'CONFLICT','evidence_run_reference':run_reference}
    item=matches[0]
    raw=item.source_item or {}
    release=raw.get('release') if isinstance(raw.get('release'),dict) else {}
    stamp=release.get('steam_release_date')
    exact=isinstance(stamp,int) and not isinstance(stamp,bool) and stamp>0
    mapping_keys=[x.casefold() for x in item.tag_names]+['tag:'+str(x) for x in item.tag_ids]
    genres=sorted({mapping[key] for key in mapping_keys if key in mapping})
    return {'app_id':app_id,'name':item.game_name,'app_type':item.app_type,
            'release_at':item.release_at.isoformat() if item.release_at and exact else None,
            'release_date_status':'EXACT' if exact and release.get('is_coming_soon') is not True else 'UNKNOWN',
            'metadata_observed_at':datetime.fromtimestamp(observed_at,timezone.utc).isoformat(),
            'identity_status':'CONFIRMED','genres':genres,'genre_source':'REVIEWED_MAPPING',
            'genre_mapping_sha256':hashlib.sha256(json.dumps(mapping,sort_keys=True).encode()).hexdigest(),
            'steam_tag_names':list(item.tag_names),'steam_tag_ids':list(item.tag_ids),'early_access_state':'UNKNOWN',
            'evidence_run_reference':run_reference}


def hydrate(client, staging, *, maximum_apps, mapping, clock=time.time, sleeper=time.sleep):
    if isinstance(maximum_apps,bool) or not isinstance(maximum_apps,int) or not 1<=maximum_apps<=1000:
        raise Blocked('INVALID_METADATA_CAP')
    if not isinstance(mapping,dict) or not mapping or any(not isinstance(k,str) or not isinstance(v,str) or not k or not v for k,v in mapping.items()):
        raise Blocked('REVIEWED_GENRE_MAPPING_REQUIRED')
    mapping={k.casefold():v for k,v in mapping.items()}
    completed=0
    for app_id in staging.metadata_candidates(maximum=maximum_apps,now=clock()):
        if completed:sleeper(client.budget.policy['minimum_interval_seconds'])
        reference,body,_=client.get(STORE_ITEMS,{'ids':[{'appid':app_id}],
            'context':{'language':'english','country_code':'KR'},
            'data_request':{'include_basic_info':True,'include_tag_count':20,'include_release':True}},operation='STORE_ITEMS')
        row=metadata_row(body,app_id,reference,observed_at=clock(),mapping=mapping)
        staging.save_metadata(reference,app_id,body,row,now=clock());completed+=1
    return {'status':'METADATA_STAGED_NOT_ADMITTED','metadata_apps':completed,'ccu_targets_admitted':0,'production_database_writes':0}


def discover(client, staging, *, maximum_pages, clock=time.time, sleeper=time.sleep):
    if isinstance(maximum_pages, bool) or not isinstance(maximum_pages, int) or not 1 <= maximum_pages <= 100:
        raise Blocked('INVALID_PAGE_LIMIT')
    count = 0
    for page_index in range(maximum_pages):
        if page_index:
            sleeper(client.budget.policy['minimum_interval_seconds'])
        watermark, started, cursor = staging.checkpoint(now=clock())
        request_id, body, document = client.get(APP_LIST, {'include_games': True, 'include_dlc': False,
            'include_software': False, 'include_videos': False, 'include_hardware': False,
            'if_modified_since': watermark, 'last_appid': cursor, 'max_results': 10000}, operation='APP_LIST')
        rows, more, next_cursor = parse_app_page(document, after_app_id=cursor)
        staging.commit_page(run_reference=request_id, body=body, rows=rows, after=cursor,
                            more=more, cursor=next_cursor, started=started, now=clock())
        count += len(rows)
        if not more:
            return {'status': 'DISCOVERY_SCAN_COMPLETE', 'candidates_seen_this_run': count,
                    'ccu_targets_admitted': 0, 'production_database_writes': 0}
    return {'status': 'DISCOVERY_PARTIAL_CHECKPOINT_PRESERVED', 'candidates_seen_this_run': count,
            'ccu_targets_admitted': 0, 'production_database_writes': 0}
