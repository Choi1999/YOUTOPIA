"""Bounded operator-run metadata and SELECT-only collector diagnostics.

Never source shell files, execute collector code, read environment files, print
raw logs, or change services. Docker/psql is used only with explicit arguments.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import socket
import subprocess
import uuid

SAFE_PATH = re.compile(r'/[A-Za-z0-9_./+\-]+\Z')
SAFE_IMAGE = re.compile(r'[a-z0-9][a-z0-9._:/@\-]{1,200}\Z')
ASSIGNMENT_NAMES = {'IMAGE', 'CODE', 'CONFIG', 'OVERRIDES', 'DATA_DIR', 'LOG_DIR',
                    'CONTAINER', 'NETWORK', 'ENV_FILE','LOCK','LOCK_FILE','LOCK_PATH','LOCK_DIR'}
JOBS = {'current', 'daily', 'weekly', 'hourly', 'ccu', 'review', 'reviews',
        'steam-candidates', 'steam-ccu', 'steam-review-recent', 'steam-hub-sync',
        'youtube-search', 'youtube-stats', 'all', 'test-all'}
CONFIG_FIELDS = {
    'app_env', 'collector_version', 'time.slot_timezone', 'time.display_timezone',
    'retry.max_attempts', 'retry.base_delay_seconds', 'retry.max_delay_seconds',
    'steam.candidate.enabled', 'steam.candidate.sources', 'steam.candidate.top_n_each',
    'steam.candidate.source_limits', 'steam.candidate.slot_minutes',
    'steam.candidate.metadata_batch_size', 'steam.candidate.weekly_history_weeks',
    'steam.candidate.category_rankings.enabled', 'steam.candidate.category_rankings.limit',
    'steam.candidate.category_rankings.ranking_scope',
    'steam.ccu.enabled', 'steam.ccu.slot_minutes', 'steam.ccu.maximum_games_per_run',
    'steam.review_recent.enabled', 'steam.review_recent.maximum_games_per_run',
    'steam.review_recent.slot_minutes', 'youtube.search.enabled',
    'youtube.search.maximum_games_per_run', 'youtube.search.max_pages_per_run',
    'youtube.stats.enabled', 'youtube.stats.maximum_videos_per_run',
}


def run(argv, timeout=5, input_text=None):
    try:
        result = subprocess.run(argv, input=input_text, capture_output=True, text=True,
                                timeout=timeout, stdin=None if input_text is not None else subprocess.DEVNULL)
        if result.returncode:
            stderr = result.stderr.lower()
            reason = 'PERMISSION_DENIED' if 'permission denied' in stderr else 'TIMEOUT' if 'statement timeout' in stderr else 'COMMAND_FAILED'
            return {'status': 'UNAVAILABLE', 'reason': reason, 'exit_code': result.returncode}
        return {'status': 'OK', 'stdout': result.stdout[:300000]}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {'status': 'UNAVAILABLE', 'reason': type(error).__name__}


def literal_assignments(text):
    """Extract allowlisted literals; shell evaluation and command substitution forbidden."""
    values = {}
    for line in text.splitlines():
        match = re.fullmatch(r'\s*(?:export\s+)?([A-Z_]+)=(.*?)\s*', line)
        if not match or match[1] not in ASSIGNMENT_NAMES:
            continue
        try:
            tokens = shlex.split(match[2], comments=True)
        except ValueError:
            continue
        if len(tokens) != 1:
            continue
        value = tokens[0]
        if any(x in value for x in ('$(', '`', '\n', '\r', '://')):
            continue
        # Only simple path-variable concatenation, never shell operators/defaults.
        for key, known in values.items():
            value = value.replace('${' + key + '}', known)
            value = re.sub(r'\$' + re.escape(key) + r'(?=/|$)', lambda _: known, value)
        if '$' in value or '..' in Path(value).parts:
            continue
        if match[1] == 'IMAGE':
            if SAFE_IMAGE.fullmatch(value):
                values[match[1]] = value
        elif SAFE_PATH.fullmatch(value) or re.fullmatch(r'[A-Za-z0-9_.-]{1,120}', value):
            values[match[1]] = value
    return values


def config_projection(path):
    p = Path(path)
    if p.is_symlink() or not p.is_file() or p.stat().st_size > 512000:
        return {'path': str(p), 'status': 'UNAVAILABLE'}


    if p.name.startswith('.env') or p.suffix.lower() != '.json':
        return {'path': str(p), 'status': 'REFUSED_NON_JSON_CONFIG'}
    try:
        doc = json.loads(p.read_text(encoding='utf-8-sig'))
        output = {}
        for field in sorted(CONFIG_FIELDS):
            value = doc
            for key in field.split('.'):
                if not isinstance(value, dict) or key not in value:
                    value = None
                    break
                value = value[key]
            if value is None or isinstance(value, (bool, int, float)):
                output[field] = value
            elif isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_./+\-]{1,70}', value):
                output[field] = value
            elif isinstance(value, list) and all(isinstance(x, str) and re.fullmatch(r'[A-Z_]{1,50}', x) for x in value):
                output[field] = value
            elif isinstance(value, dict) and all(re.fullmatch(r'[A-Z_]{1,50}', str(k)) and isinstance(v, int) and not isinstance(v, bool) for k, v in value.items()):
                output[field] = value
            else:
                output[field] = 'UNSUPPORTED_VALUE_OMITTED'
        return {'path': str(p), 'status': 'OK', 'settings': output}
    except (OSError, ValueError, TypeError):
        return {'path': str(p), 'status': 'UNAVAILABLE'}


def execution_projection(text,assignments):
    """Allowlisted static options only. Never return a complete command or env value."""
    out={'docker_runs':[],'lock_paths':[],'flow':'STATIC_ONLY_NOT_EVALUATED'}
    for line in text.replace('\\\n',' ').splitlines():
        try:parts=shlex.split(line,comments=True)
        except ValueError:continue
        def resolve(value):
            for key,known in assignments.items():
                value=value.replace('${'+key+'}',known)
                value=re.sub(r'\$'+re.escape(key)+r'(?=/|:|$)',lambda _:known,value)
            return value
        if 'flock' in parts:
            out['lock_paths'].extend(resolve(x) for x in parts if SAFE_PATH.fullmatch(resolve(x)) and resolve(x).endswith('.lock'))
        if not any(parts[i:i+2]==['docker','run'] for i in range(len(parts)-1)):continue
        run={'binds':[],'env_names':[],'unresolved_mounts':0}
        for i,item in enumerate(parts[:-1]):
            value=resolve(parts[i+1])
            if item in ['-v','--volume']:
                bits=value.split(':')
                if len(bits) in [2,3] and all(SAFE_PATH.fullmatch(x) and '..' not in Path(x).parts for x in bits[:2]) and (len(bits)==2 or bits[2] in ['ro','rw']):
                    run['binds'].append({'host':bits[0],'container':bits[1],'mode':bits[2] if len(bits)==3 else 'rw'})
                else:run['unresolved_mounts']+=1
            elif item=='--mount':
                fields={};valid=True
                for part in value.split(','):
                    key,sep,entry=part.partition('=')
                    if key in fields or key not in {'type','src','source','dst','target','destination','readonly'}:valid=False
                    fields[key]=entry if sep else True
                source=fields.get('src',fields.get('source'))
                target=fields.get('dst',fields.get('target',fields.get('destination')))
                if valid and fields.get('type')=='bind' and isinstance(source,str) and isinstance(target,str) and all(SAFE_PATH.fullmatch(x) and '..' not in Path(x).parts for x in [source,target]):
                    run['binds'].append({'host':source,'container':target,'mode':'ro' if fields.get('readonly') in [True,'true','1'] else 'rw'})
                else:run['unresolved_mounts']+=1
            elif item in ['-e','--env']:
                name=parts[i+1].split('=',1)[0]
                if re.fullmatch(r'[A-Z][A-Z0-9_]{0,79}',name):run['env_names'].append(name)
            elif item=='--env-file' and SAFE_PATH.fullmatch(value):run['env_file_path']=value
            elif item=='--network' and re.fullmatch(r'[A-Za-z0-9_.-]{1,120}',value):run['network']=value
            elif item=='--user' and re.fullmatch(r'[0-9]+(?::[0-9]+)?',value):run['numeric_user']=value
        out['docker_runs'].append(run)
    out['lock_paths']=sorted(set(out['lock_paths']))
    return out


_SHELL_WORDS=set('if then else elif fi case in esac do done for while function local export readonly set echo printf exit exec shift return test docker flock timeout date mkdir basename dirname cat rm sleep hostname id whoami env true false youtopia-collector python python3'.split())
_SHELL_OPERATORS={'[',']','[[',']]',';',';;',';&','&&','||','|','(',')','{','}','!',':','>','>>','2>','2>>','&','\\'}
_ASSIGNMENTS=ASSIGNMENT_NAMES|{'JOB','LIMIT','RUN_CMD','LOG_FILE','LOCK_FD','RC','EXIT_CODE','TZ','CRON_TZ','SHELL'}


def safe_shell_tokens(text,*,maximum_lines=180):
    """Static structure for review. Unknown literals and secret assignments omitted.

    Never evaluates a shell, reads referenced files, or exports a complete script.
    Compound strings are tokenized only, not interpreted as shell commands.
    """
    def token(value,depth=0):
        if depth>3:return {'omitted':'NESTED_VALUE'}
        assignment=re.fullmatch(r'([A-Z_][A-Z0-9_]*)=(.*)',value,re.S)
        if assignment:
            name,rhs=assignment.groups()
            if name not in _ASSIGNMENTS:return {'assignment':name,'value':'OMITTED'}
            if name in {'TZ','CRON_TZ'}:
                from zoneinfo import ZoneInfo,ZoneInfoNotFoundError
                try:
                    ZoneInfo(rhs)
                    return {'assignment':name,'value_tokens':[rhs]}
                except (ValueError,ZoneInfoNotFoundError):return {'assignment':name,'value':'OMITTED'}
            try:parts=shlex.split(rhs,comments=False)
            except ValueError:return {'assignment':name,'value':'OMITTED'}
            return {'assignment':name,'value_tokens':[token(x,depth+1) for x in parts]}
        if value in _SHELL_WORDS|_SHELL_OPERATORS:return value
        if re.fullmatch(r'--[A-Za-z][A-Za-z0-9-]{0,60}|-[A-Za-z]{1,8}',value):return value
        if re.fullmatch(r'[0-9]{1,6}(?:[smh])?',value):return value
        if re.fullmatch(r'[a-z0-9_-]{1,32}',value) and re.search(r'(hour|daily|day|week|steam|youtube|review|current|stats|ccu)',value):return value
        if re.fullmatch(r'(?:youtopia-collector|qwe1asd/youtopia-collector)(?::[a-zA-Z0-9_.-]+|@sha256:[0-9a-f]{64})?',value):return value
        if SAFE_PATH.fullmatch(value) and '..' not in Path(value).parts:return value
        if re.fullmatch(r'[a-zA-Z0-9_.-]{1,80}\.json',value):return value
        # References remain literal. Do not expand secrets or execute $().
        if '$(' not in value and '`' not in value:
            remainder=re.sub(r'\$(?:\{[A-Z_][A-Z0-9_]*(?:\[@\])?\}|[A-Z_][A-Z0-9_]*|[0-9@#?$])','VAR',value)
            if remainder!=value and re.fullmatch(r'[A-Za-z0-9_./:+,{}\[\]@-]+',remainder):return value
            if re.fullmatch(r'\$\{[A-Z_0-9][A-Z0-9_]*:?-?[0-9]{1,6}\}',value):return value
        return {'omitted':'UNREVIEWED_LITERAL','variable_names':sorted(set(re.findall(r'\$(?:\{)?([A-Z_][A-Z0-9_]*)',value)))}
    result=[]
    for number,line in enumerate(text.splitlines(),1):
        if not line.strip() or line.lstrip().startswith('#'):continue
        continuation=line.rstrip().endswith('\\')
        parse_line=line.rstrip()[:-1] if continuation else line
        try:
            lexer=shlex.shlex(parse_line,posix=True,punctuation_chars=';&|()')
            lexer.whitespace_split=True;parts=list(lexer)
        except ValueError:parts=[]
        result.append({'line':number,'tokens':[token(x) for x in parts],'parse_complete':bool(parts),'continuation':continuation})
        if len(result)>=maximum_lines:break
    return {'rows':result,'truncated':len([x for x in text.splitlines() if x.strip() and not x.lstrip().startswith('#')])>len(result),
            'semantics':'STATIC_TOKENS_NOT_EXECUTED; omitted literals must not be guessed'}


IMAGE_CONFIG_READER=r'''
import json,re,sys
from pathlib import Path
fields=json.loads(sys.argv[1]);rows=[]
for p in sorted(Path('/app/config').glob('*.json'))[:30]:
    if not ('production' in p.name or 'config' in p.name):continue
    if p.is_symlink() or not p.is_file() or p.stat().st_size>512000:
        rows.append({'path':str(p),'status':'UNAVAILABLE'});continue
    try:
        body=p.read_bytes();d=json.loads(body.decode('utf-8-sig'));settings={}
        for field in fields:
            v=d
            for key in field.split('.'):
                v=v.get(key) if isinstance(v,dict) else None
            if v is None or isinstance(v,(bool,int,float)):settings[field]=v
            elif isinstance(v,str) and re.fullmatch(r'[A-Za-z0-9_./+\-]{1,70}',v):settings[field]=v
            elif isinstance(v,list) and all(isinstance(x,str) and re.fullmatch(r'[A-Z_]{1,50}',x) for x in v):settings[field]=v
            elif isinstance(v,dict) and all(re.fullmatch(r'[A-Z_]{1,50}',str(k)) and isinstance(x,int) and not isinstance(x,bool) for k,x in v.items()):settings[field]=v
            else:settings[field]='UNSUPPORTED_VALUE_OMITTED'
        # Deliberately no full config, environment, credential, or config-derived
        # hash exported. Unknown configuration fields are never copied.
        rows.append({'path':str(p),'status':'OK','settings':settings,'source':'PINNED_IMAGE_DEFAULT'})
    except (OSError,ValueError,TypeError):rows.append({'path':str(p),'status':'UNAVAILABLE'})
print(json.dumps({'kind':'IMAGE_CONFIG_FIELDS_V1','profiles':rows}))
'''


def image_config_report(image_id,*,expected_host=None):
    """Explicit opt-in: short-lived isolated Python, never collector entrypoint.

    No env-file, host mounts, DB network, host ports, or API call. Cleanup is
    limited to the randomly named container with our exact purpose label.
    """
    if not re.fullmatch(r'sha256:[0-9a-f]{64}',image_id):return {'status':'UNAVAILABLE','reason':'IMAGE_ID_UNKNOWN'}
    daemon=run(['docker','info','--format','{{.Name}}'])
    if daemon['status']!='OK' or (expected_host and daemon['stdout'].strip().split('.')[0]!=expected_host):
        return {'status':'UNAVAILABLE','reason':'DOCKER_DAEMON_IDENTITY_UNCONFIRMED'}
    name='youtopia-readonly-config-'+uuid.uuid4().hex
    label='com.youtopia.audit-purpose=readonly-config'
    try:
        result=run(['docker','run','--rm','--pull=never','--name',name,'--label',label,
            '--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
            '--pids-limit','64','--memory','96m','--cpus','0.5','--user','10001:10001',
            '--entrypoint','python','-i',image_id,'-I','-B','-',json.dumps(sorted(CONFIG_FIELDS))],
            timeout=20,input_text=IMAGE_CONFIG_READER)
        if result['status']!='OK':return result
        doc=json.loads(result['stdout'])
        if doc.get('kind')!='IMAGE_CONFIG_FIELDS_V1' or not isinstance(doc.get('profiles'),list):raise ValueError()
        return {'status':'OK','image_id':image_id,'profiles':doc['profiles'],
            'scope':'IMAGE_DEFAULTS_NOT_PROVEN_EFFECTIVE_UNTIL_WRAPPER_AND_MOUNTS_REVIEWED',
            'diagnostic_containers_requested':1,'collector_executions':0,'env_files_passed':False,'host_mounts_passed':False,'network':'none'}
    except (ValueError,TypeError):return {'status':'UNAVAILABLE','reason':'IMAGE_CONFIG_RESULT_INVALID'}
    finally:
        owned=run(['docker','inspect',name,'--format','{{index .Config.Labels "com.youtopia.audit-purpose"}}'])
        if owned['status']=='OK' and owned['stdout'].strip()=='readonly-config':
            run(['docker','rm','--force','--volumes',name])

# Explicit opt-in. These are bounded diagnostics, not migrations. Source presence
# alone does not prove promotion: eligibility, feature flags and effective config
# must be reviewed too. No credential aliases, messages or response bodies leave
# the database. Counts are recorded attempts, not proof of every network send.
DEEP_CCU_QUERIES = {
    'ccu_target_states': """SELECT coalesce(json_agg(r),'[]'::json) FROM (
        SELECT t.active,t.lifecycle_state,t.availability_status,t.selection_reason,
               c.eligibility_status,count(*) AS games,
               count(*) FILTER(WHERE t.next_due_at IS NULL OR t.next_due_at<=CURRENT_TIMESTAMP) AS due_now,
               min(t.next_due_at) AS earliest_due,max(t.last_success_at) AS last_success_at
        FROM collector.steam_ccu_target t
        LEFT JOIN collector.steam_app_candidate c ON c.app_id=t.app_id
        GROUP BY t.active,t.lifecycle_state,t.availability_status,t.selection_reason,c.eligibility_status
        ORDER BY t.active DESC,t.lifecycle_state,t.availability_status,t.selection_reason,c.eligibility_status
    ) r""",
    'ccu_current_sources': """SELECT coalesce(json_agg(r),'[]'::json) FROM (
        SELECT t.active,t.lifecycle_state,c.eligibility_status,
               coalesce(s.concurrent_players,FALSE) AS concurrent_players,
               coalesce(s.manual,FALSE) AS manual,coalesce(s.new_release,FALSE) AS new_release,
               count(*) AS games
        FROM collector.steam_ccu_target t
        LEFT JOIN collector.steam_app_candidate c ON c.app_id=t.app_id
        LEFT JOIN (
            SELECT app_id,bool_or(signal_source='CONCURRENT_PLAYERS') AS concurrent_players,
                   bool_or(signal_source='MANUAL') AS manual,bool_or(signal_source='NEW_RELEASE') AS new_release
            FROM collector.steam_tracking_signal
            WHERE deactivated_at IS NULL AND (
                (signal_source IN ('CONCURRENT_PLAYERS','MANUAL') AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))
                OR (signal_source='NEW_RELEASE' AND expires_at>CURRENT_TIMESTAMP))
            GROUP BY app_id
        ) s ON s.app_id=t.app_id
        GROUP BY t.active,t.lifecycle_state,c.eligibility_status,s.concurrent_players,s.manual,s.new_release
    ) r""",
    'ccu_attempts_by_app_24h': """SELECT coalesce(json_agg(r),'[]'::json) FROM (
        SELECT t.app_id,count(DISTINCT a.attempt_id) AS recorded_attempts,
               count(DISTINCT a.attempt_id) FILTER(WHERE a.http_status=200) AS http_200,
               count(DISTINCT a.attempt_id) FILTER(WHERE a.http_status=404) AS http_404,
               count(DISTINCT a.attempt_id) FILTER(WHERE a.http_status=429) AS http_429,
               count(DISTINCT a.attempt_id) FILTER(WHERE a.http_status IS NULL) AS no_http_status,
               bool_or(a.credential_alias IS NOT NULL) AS credential_alias_present,
               min(a.started_at) AS first_recorded_at,max(a.started_at) AS last_recorded_at
        FROM collector.api_call_attempt a
        JOIN collector.api_call c ON c.api_call_id=a.api_call_id
        JOIN collector.api_call_task ct ON ct.api_call_id=c.api_call_id
        JOIN collector.collection_task t ON t.task_id=ct.task_id
        WHERE a.started_at>=CURRENT_TIMESTAMP-INTERVAL '24 hours'
          AND c.source_type='STEAM' AND c.operation='CURRENT_PLAYERS' AND t.task_type='STEAM_CCU'
        GROUP BY t.app_id ORDER BY http_404 DESC,http_429 DESC,recorded_attempts DESC,t.app_id LIMIT 30
    ) r""",
    'ccu_jobs_24h': """SELECT coalesce(json_agg(r),'[]'::json) FROM (
        SELECT status,count(*) AS runs,sum(target_count) AS target_count,sum(success_count) AS success_count,
               sum(failure_count) AS failure_count,sum(skipped_count) AS skipped_count,
               max(extract(epoch FROM finished_at-started_at)) AS longest_finished_seconds,
               max(started_at) AS latest_started_at,max(finished_at) AS latest_finished_at
        FROM collector.job_run
        WHERE started_at>=CURRENT_TIMESTAMP-INTERVAL '24 hours'
          AND upper(replace(job_type,'-','_'))='STEAM_CCU'
        GROUP BY status
    ) r""",
    'ccu_queued_target_states': """SELECT coalesce(json_agg(r),'[]'::json) FROM (
        SELECT q.status,count(*) AS tasks,
               count(*) FILTER(WHERE t.app_id IS NULL) AS target_missing,
               count(*) FILTER(WHERE t.app_id IS NOT NULL AND t.active IS NOT TRUE) AS target_inactive,
               count(*) FILTER(WHERE t.next_due_at>CURRENT_TIMESTAMP) AS target_not_due,
               min(q.scheduled_at) AS oldest_slot,max(q.scheduled_at) AS newest_slot
        FROM collector.collection_task q LEFT JOIN collector.steam_ccu_target t ON t.app_id=q.app_id
        WHERE q.task_type='STEAM_CCU' AND q.status IN ('PENDING','CLAIMED','RUNNING') GROUP BY q.status
    ) r""",
    'steam_recorded_peaks_24h': """WITH attempts AS (
        SELECT a.started_at,c.operation FROM collector.api_call_attempt a
        JOIN collector.api_call c ON c.api_call_id=a.api_call_id
        WHERE a.started_at>=CURRENT_TIMESTAMP-INTERVAL '24 hours' AND c.source_type='STEAM'
    ) SELECT json_build_object(
        'recorded_attempts',(SELECT count(*) FROM attempts),
        'review_histogram_store_attempts',(SELECT count(*) FROM attempts WHERE operation='REVIEW_HISTOGRAM'),
        'highest_calendar_minute',(SELECT coalesce(max(n),0) FROM (SELECT count(*) n FROM attempts GROUP BY date_trunc('minute',started_at)) r),
        'highest_calendar_hour',(SELECT coalesce(max(n),0) FROM (SELECT count(*) n FROM attempts GROUP BY date_trunc('hour',started_at)) r))""",
}


def database_report(container, database, user, *, deep_ccu_audit=False):
    for value in (container, database, user):
        if not re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', value):
            raise ValueError('INVALID_DATABASE_TARGET')
    queries = {
        'identity': "SELECT json_build_object('database',current_database(),'session_user',session_user,'effective_user',current_user,'read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),'as_of',CURRENT_TIMESTAMP)",
        'target_counts': "SELECT json_build_object('total',count(*),'active',count(*) FILTER(WHERE active IS TRUE),'inactive',count(*) FILTER(WHERE active IS FALSE),'null_active',count(*) FILTER(WHERE active IS NULL),'last_success_at',max(last_success_at)) FROM collector.steam_ccu_target",
        'recent_jobs': "SELECT coalesce(json_agg(r),'[]'::json) FROM (SELECT job_type,status,collector_version,started_at,finished_at FROM collector.job_run ORDER BY started_at DESC LIMIT 30) r",
        'attempts_24h': "SELECT coalesce(json_agg(r),'[]'::json) FROM (SELECT c.source_type,c.operation,a.http_status,count(*) AS actual_attempts FROM collector.api_call_attempt a JOIN collector.api_call c ON c.api_call_id=a.api_call_id WHERE a.started_at>=CURRENT_TIMESTAMP-INTERVAL '24 hours' GROUP BY c.source_type,c.operation,a.http_status) r",
        'new_release_signals': "SELECT json_build_object('total',count(*),'unexpired',count(*) FILTER(WHERE deactivated_at IS NULL AND expires_at>CURRENT_TIMESTAMP)) FROM collector.steam_tracking_signal WHERE signal_source='NEW_RELEASE'",
        'registered_app_ids': "SELECT coalesce(json_agg(app_id),'[]'::json) FROM (SELECT app_id FROM collector.steam_ccu_target UNION SELECT app_id FROM collector.youtube_game_target ORDER BY app_id LIMIT 100001) r",
        'genre_tag_catalog': "SELECT coalesce(json_agg(r),'[]'::json) FROM (SELECT tag_id,display_name,source_language,is_active FROM collector.steam_tag WHERE tag_id IN (19,21,122,492,493,597,599,699,701,9) ORDER BY tag_id LIMIT 20) r",
    }
    if deep_ccu_audit:
        queries.update(DEEP_CCU_QUERIES)
    output = {}
    for name, query in queries.items():
        sql = "BEGIN READ ONLY; SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='500ms'; " + query + '; ROLLBACK;'
        result = run(['docker', 'exec', '-i', '--user', 'postgres', container, 'psql', '-X', '-q', '-A', '-t',
                      '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database], timeout=6, input_text=sql)
        if result['status'] == 'OK':
            try:
                output[name] = {'status': 'OK', 'data': json.loads(result['stdout'].strip())}
            except ValueError:
                output[name] = {'status': 'UNAVAILABLE', 'reason': 'UNPARSEABLE_RESULT'}
        else:
            output[name] = result
    return output


def collect(args):
    result = {'kind': 'COLLECTOR_READINESS_INVENTORY_V1', 'as_of_utc': datetime.now(timezone.utc).isoformat(),
              'host': socket.gethostname(), 'production_changes': 0, 'collector_executions': 0,
              'credential_values_exported': False, 'raw_logs_exported': False}
    if args.expected_host and socket.gethostname().split('.')[0] != args.expected_host:
        raise ValueError('WRONG_HOST')
    path = Path(args.wrapper)
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 65536:
        raise ValueError('WRAPPER_MISSING_OR_UNSAFE')
    text = path.read_text()
    assignments = literal_assignments(text)
    result['wrapper'] = {'path': str(path), 'sha256': hashlib.sha256(text.encode()).hexdigest(),
                         'literal_assignments': assignments, 'raw_script_exported': False,
                         'execution_flow': 'STATIC_ONLY_NOT_EVALUATED'}
    result['execution_metadata']=execution_projection(text,assignments)
    result['wrapper']['structure']=safe_shell_tokens(text)
    cron = Path(args.cron)
    schedules = []
    if cron.is_file() and not cron.is_symlink() and cron.stat().st_size < 65536:
        for line in cron.read_text().splitlines():
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            try:
                parts = shlex.split(line, comments=True)
            except ValueError:
                continue
            if len(parts) >= 7 and str(path) in parts:
                schedules.append({'schedule': parts[:5], 'os_user': parts[5],
                                  'recognized_job_tokens': [x for x in parts[6:] if x in JOBS],
                                  'structure':safe_shell_tokens(' '.join(shlex.quote(x) for x in parts[6:])),
                                  'full_command_exported': False})
    timezone=None
    tzfile=Path('/etc/timezone')
    if tzfile.is_file() and not tzfile.is_symlink() and tzfile.stat().st_size<200:
        candidate=tzfile.read_text().strip()
        if re.fullmatch(r'[A-Za-z0-9_+/\-]{1,80}',candidate):timezone=candidate
    directives=[]
    if cron.is_file() and not cron.is_symlink() and cron.stat().st_size<65536:
        directives=[{'line':i,'tokens':safe_shell_tokens(line)['rows']} for i,line in enumerate(cron.read_text().splitlines(),1)
                    if re.match(r'\s*(?:CRON_TZ|TZ|SHELL)\s*=',line)]
    result['cron'] = {'path': str(cron), 'jobs': schedules,'host_timezone_file':timezone,'environment_directives':directives}
    image = args.image or assignments.get('IMAGE')
    if image and SAFE_IMAGE.fullmatch(image):
        inspected = run(['docker', 'image', 'inspect', image, '--format',
                         '{"id":{{json .Id}},"repo_digests":{{json .RepoDigests}}}'])
        try:
            result['image'] = {'requested': image, 'status': inspected['status'],
                               'data': json.loads(inspected['stdout'])} if inspected['status'] == 'OK' else inspected
        except ValueError:
            result['image'] = {'status': 'UNAVAILABLE', 'reason': 'UNPARSEABLE_IMAGE_METADATA'}
    else:
        result['image'] = {'status': 'UNAVAILABLE', 'reason': 'IMAGE_NOT_RESOLVED'}
    configs = set(args.config_path or [])
    if assignments.get('CONFIG', '').startswith('/'):
        configs.add(assignments['CONFIG'])
    roots=set(args.config_root or [])
    if assignments.get('CODE'):roots.add(assignments['CODE'])
    for code in sorted(roots)[:5]:
        if not SAFE_PATH.fullmatch(code) or not Path(code).is_dir():continue
        for base in (Path(code), Path(code) / 'config',Path(code)/'configs',Path(code)/'current'/'config'):
            if base.is_dir() and not base.is_symlink():
                for p in list(base.glob('*.json'))[:20]:
                    if 'production' in p.name or 'config' in p.name:
                        configs.add(str(p))
    result['configs'] = [config_projection(x) for x in sorted(configs)[:30]]
    result['image_config_inspection']={'status':'NOT_REQUESTED'}
    if args.inspect_image_configs:
        report=image_config_report(result.get('image',{}).get('data',{}).get('id',''),expected_host=args.expected_host)
        result['image_config_inspection']=report
        if report.get('status')=='OK':
            for profile in report['profiles']:
                profile['source_image_id']=report['image_id']
                result['configs'].append(profile)
    result['database'] = database_report(args.postgres_container, args.database, args.db_user,
        deep_ccu_audit=args.deep_ccu_audit) if args.include_db else {'status': 'NOT_REQUESTED'}
    result['not_verified'] = ['Shell branch/variable execution semantics', 'Other API consumers and provider-approved limits',
                              'Original source Git commit and Docker build reproducibility']
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-host')
    parser.add_argument('--wrapper', required=True)
    parser.add_argument('--cron', required=True)
    parser.add_argument('--image')
    parser.add_argument('--config-path', action='append')
    parser.add_argument('--config-root', action='append')
    parser.add_argument('--inspect-image-configs',action='store_true',help='Opt-in isolated Python container: image config fields only, no collector or env-file.')
    parser.add_argument('--include-db', action='store_true')
    parser.add_argument('--deep-ccu-audit', action='store_true', help='Opt-in target/source, per-app attempts, queue, job and recorded burst counts. Read-only with per-query timeouts.')
    parser.add_argument('--postgres-container')
    parser.add_argument('--database')
    parser.add_argument('--db-user')
    args = parser.parse_args(argv)
    if args.include_db and not all((args.postgres_container, args.database, args.db_user)):
        parser.error('Database diagnostic requires explicit container/database/user.')
    if args.deep_ccu_audit and not args.include_db:
        parser.error('--deep-ccu-audit requires --include-db.')
    try:
        result = collect(args)
    except (OSError, ValueError) as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error) if isinstance(error, ValueError) else type(error).__name__}))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
