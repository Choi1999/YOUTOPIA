-- YUTOPIA G44 LAB ONLY. Destructive statements permitted ONLY in disposable g44_lab.
-- Never run against existing/production DB. Lab data is entirely synthetic.
\set ON_ERROR_STOP on
DO $preflight$
BEGIN
  IF current_database() <> 'g44_lab' OR current_user <> 'g44_dba' THEN
    RAISE EXCEPTION 'G44 LAB ONLY: unexpected database or role';
  END IF;
END
$preflight$;
BEGIN;
CREATE SCHEMA g44_lab;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA g44_lab FROM PUBLIC;
CREATE ROLE g44_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE g44_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
REVOKE ALL ON DATABASE g44_lab FROM PUBLIC;
GRANT CONNECT ON DATABASE g44_lab TO g44_writer, g44_reader;
GRANT USAGE ON SCHEMA g44_lab TO g44_writer, g44_reader;

CREATE TABLE g44_lab.policy_gate(
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
  approved_test BOOLEAN NOT NULL DEFAULT FALSE,
  revoked BOOLEAN NOT NULL DEFAULT TRUE,
  policy_epoch BIGINT NOT NULL DEFAULT 1 CHECK(policy_epoch > 0)
);
INSERT INTO g44_lab.policy_gate(singleton) VALUES (TRUE);

CREATE TABLE g44_lab.analysis_scope(
  scope_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source TEXT NOT NULL CHECK (source = 'YOUTUBE'),
  target_type TEXT NOT NULL CHECK (target_type = 'VIDEO'),
  target_id TEXT NOT NULL CHECK (target_id ~ '^[A-Za-z0-9_-]{11}$'),
  analysis_spec_version TEXT NOT NULL CHECK (analysis_spec_version ~ '^[A-Za-z0-9._:-]{1,80}$'),
  observation_window_id TEXT NOT NULL CHECK (observation_window_id ~ '^[A-Za-z0-9._:-]{1,80}$'),
  sampling_policy_version TEXT NOT NULL CHECK (sampling_policy_version ~ '^[A-Za-z0-9._:-]{1,80}$'),
  locale TEXT NOT NULL CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC_REUSABLE','TENANT_PRIVATE')),
  tenant_id TEXT,
  CHECK (
    (visibility = 'PUBLIC_REUSABLE' AND tenant_id IS NULL)
    OR (visibility = 'TENANT_PRIVATE' AND tenant_id IS NOT NULL
      AND tenant_id ~ '^[A-Za-z0-9_-]{1,64}$')
  ),
  CONSTRAINT g44_scope_canonical UNIQUE NULLS NOT DISTINCT (
    source,target_type,target_id,analysis_spec_version,observation_window_id,
    sampling_policy_version,locale,visibility,tenant_id
  )
);

CREATE TABLE g44_lab.budget_window(
  actor_tag TEXT PRIMARY KEY,
  remaining INTEGER NOT NULL CHECK(remaining >= 0),
  held INTEGER NOT NULL DEFAULT 0 CHECK(held >= 0)
);

CREATE TABLE g44_lab.analysis_job(
  job_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope_id BIGINT NOT NULL REFERENCES g44_lab.analysis_scope(scope_id),
  execution_partition TEXT NOT NULL,
  actor_tag TEXT NOT NULL,
  publication_generation BIGINT GENERATED ALWAYS AS IDENTITY,
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt > 0),
  retry_of_job_id BIGINT REFERENCES g44_lab.analysis_job(job_id),
  state TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK(state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
  version BIGINT NOT NULL DEFAULT 1,
  lease_epoch BIGINT NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  policy_epoch BIGINT NOT NULL,
  snapshot_id TEXT
);
-- LAB-only monotone state/version fencing, independent of Worker helper calls.
CREATE FUNCTION g44_lab.job_transition_guard() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
  IF OLD.state IN ('SUCCEEDED','FAILED') THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='G44 terminal Job immutable';
  END IF;
  IF NEW.version <= OLD.version OR NEW.lease_epoch < OLD.lease_epoch THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='G44 version or lease epoch regressed';
  END IF;
  IF (OLD.state='QUEUED' AND NEW.state NOT IN ('QUEUED','RUNNING','FAILED'))
    OR (OLD.state='RUNNING' AND NEW.state NOT IN ('RUNNING','SUCCEEDED','FAILED')) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='G44 invalid state transition';
  END IF;
  RETURN NEW;
END $guard$;
CREATE TRIGGER g44_job_transition_guard
  BEFORE UPDATE ON g44_lab.analysis_job
  FOR EACH ROW EXECUTE FUNCTION g44_lab.job_transition_guard();

CREATE UNIQUE INDEX g44_one_active_per_partition
  ON g44_lab.analysis_job(scope_id,execution_partition)
  WHERE state IN ('QUEUED','RUNNING');

CREATE TABLE g44_lab.idempotency_record(
  actor_tag TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('CREATED','JOINED')),
  job_id BIGINT NOT NULL REFERENCES g44_lab.analysis_job(job_id),
  PRIMARY KEY(actor_tag,idempotency_key)
);

CREATE TABLE g44_lab.budget_reservation(
  job_id BIGINT NOT NULL REFERENCES g44_lab.analysis_job(job_id),
  cost_class TEXT NOT NULL DEFAULT 'SYNTHETIC_TEST',
  actor_tag TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'HELD'
    CHECK(state IN ('HELD','COMMITTED','RELEASED')),
  units INTEGER NOT NULL DEFAULT 1 CHECK(units > 0),
  PRIMARY KEY(job_id,cost_class)
);

CREATE TABLE g44_lab.job_outbox(
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES g44_lab.analysis_job(job_id),
  event_type TEXT NOT NULL DEFAULT 'DISPATCH',
  UNIQUE(job_id,event_type)
);

CREATE TABLE g44_lab.analysis_snapshot(
  snapshot_id TEXT PRIMARY KEY,
  job_id BIGINT NOT NULL UNIQUE REFERENCES g44_lab.analysis_job(job_id),
  scope_id BIGINT NOT NULL REFERENCES g44_lab.analysis_scope(scope_id),
  status TEXT NOT NULL CHECK(status IN ('READY','PARTIAL','NO_DATA')),
  source_type TEXT NOT NULL DEFAULT 'STATIC_FIXTURE' CHECK(source_type = 'STATIC_FIXTURE'),
  policy_epoch BIGINT NOT NULL
);

CREATE TABLE g44_lab.scope_latest(
  scope_id BIGINT PRIMARY KEY REFERENCES g44_lab.analysis_scope(scope_id),
  snapshot_id TEXT NOT NULL REFERENCES g44_lab.analysis_snapshot(snapshot_id),
  publication_generation BIGINT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1
);

-- Function only accepts trusted synthetic identities, never client browser claims.
CREATE FUNCTION g44_lab.submit_job(
  p_scope BIGINT,p_actor TEXT,p_partition TEXT,p_key TEXT,p_digest TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $fn$
DECLARE v_old RECORD; v_active BIGINT; v_new BIGINT; v_policy BIGINT;
        v_visibility TEXT; v_tenant TEXT; v_budget INTEGER;
BEGIN
  IF p_actor NOT IN ('customer-A','customer-B') OR p_partition <> p_actor THEN
    RETURN 'DENIED';
  END IF;
  IF p_digest !~ '^[a-f0-9]{64}$' OR p_key !~ '^[a-f0-9-]{36}$' THEN
    RETURN 'INVALID_REQUEST';
  END IF;
  SELECT policy_epoch INTO v_policy FROM g44_lab.policy_gate
    WHERE approved_test = TRUE AND revoked = FALSE;
  IF v_policy IS NULL THEN RETURN 'POLICY_BLOCKED'; END IF;
  SELECT visibility, tenant_id INTO v_visibility,v_tenant
    FROM g44_lab.analysis_scope WHERE scope_id=p_scope;
  IF NOT FOUND THEN RETURN 'INVALID_SCOPE'; END IF;
  IF v_visibility='TENANT_PRIVATE'
    AND v_tenant <> replace(p_actor,'customer-','tenant-') THEN
    RETURN 'RESOURCE_UNAVAILABLE';
  END IF;
  -- Order all locks: execution partition, principal/key, then budget.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope::text||':'||p_partition,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor||':'||p_key,1));
  SELECT request_digest,decision,job_id INTO v_old
    FROM g44_lab.idempotency_record WHERE actor_tag=p_actor AND idempotency_key=p_key;
  IF FOUND THEN
    IF v_old.request_digest<>p_digest THEN RETURN 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN v_old.decision||':'||v_old.job_id::text;
  END IF;
  SELECT job_id INTO v_active FROM g44_lab.analysis_job
    WHERE scope_id=p_scope AND execution_partition=p_partition
      AND state IN ('QUEUED','RUNNING') FOR UPDATE;
  IF FOUND THEN
    INSERT INTO g44_lab.idempotency_record
      VALUES (p_actor,p_key,p_digest,'JOINED',v_active);
    RETURN 'JOINED:'||v_active::text;
  END IF;
  UPDATE g44_lab.budget_window SET remaining=remaining-1, held=held+1
    WHERE actor_tag=p_actor AND remaining>0 RETURNING remaining INTO v_budget;
  IF NOT FOUND THEN RETURN 'QUOTA_DEFERRED'; END IF;
  INSERT INTO g44_lab.analysis_job(scope_id,execution_partition,actor_tag,policy_epoch)
    VALUES (p_scope,p_partition,p_actor,v_policy) RETURNING job_id INTO v_new;
  INSERT INTO g44_lab.budget_reservation(job_id,actor_tag) VALUES(v_new,p_actor);
  INSERT INTO g44_lab.job_outbox(job_id) VALUES(v_new);
  INSERT INTO g44_lab.idempotency_record
    VALUES (p_actor,p_key,p_digest,'CREATED',v_new);
  RETURN 'CREATED:'||v_new::text;
END $fn$;

CREATE FUNCTION g44_lab.claim_one(p_owner TEXT,p_lease_ms INTEGER)
RETURNS TEXT LANGUAGE plpgsql AS $fn$
DECLARE v_id BIGINT;v_epoch BIGINT;v_version BIGINT;
BEGIN
  IF p_owner NOT IN ('worker-A','worker-B') OR p_lease_ms < 100 OR p_lease_ms > 60000
  THEN RETURN 'INVALID_REQUEST'; END IF;
  SELECT job_id INTO v_id FROM g44_lab.analysis_job
   WHERE (state='QUEUED' OR
          (state='RUNNING' AND lease_expires_at <= clock_timestamp()))
     AND policy_epoch = (SELECT policy_epoch FROM g44_lab.policy_gate
        WHERE approved_test=TRUE AND revoked=FALSE)
   ORDER BY job_id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN 'NONE'; END IF;
  UPDATE g44_lab.analysis_job SET state='RUNNING', version=version+1,
    lease_epoch=lease_epoch+1, lease_owner=p_owner,
    lease_expires_at=clock_timestamp()+(p_lease_ms::double precision/1000.0)*INTERVAL '1 second'
   WHERE job_id=v_id
   RETURNING lease_epoch,version INTO v_epoch,v_version;
  RETURN v_id::text||':'||v_epoch::text||':'||v_version::text;
END $fn$;

-- Synthetic outbox delivery: only the Job referenced by the delivered event may
-- be claimed. Two independent Workers receiving the same event contend for one
-- DB advisory lock and fenced Job lease; no broker/real source is involved.
CREATE FUNCTION g44_lab.claim_from_outbox(
  p_event BIGINT, p_owner TEXT, p_lease_ms INTEGER
) RETURNS TEXT LANGUAGE plpgsql AS $fn$
DECLARE v_id BIGINT; v_epoch BIGINT; v_version BIGINT;
BEGIN
  IF p_event IS NULL OR p_event <= 0
     OR p_owner IS NULL OR p_owner NOT IN ('worker-A','worker-B')
     OR p_lease_ms IS NULL OR p_lease_ms < 500 OR p_lease_ms > 60000
  THEN RETURN 'INVALID_REQUEST'; END IF;
  -- Same-event contention barrier and per-event transaction serialization.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('g44-outbox:'||p_event::text, 0));
  SELECT j.job_id INTO v_id
    FROM g44_lab.job_outbox AS o
    JOIN g44_lab.analysis_job AS j ON j.job_id=o.job_id
    WHERE o.event_id=p_event AND o.event_type='DISPATCH'
      AND (j.state='QUEUED'
           OR (j.state='RUNNING' AND j.lease_expires_at <= clock_timestamp()))
      AND j.policy_epoch=(SELECT policy_epoch FROM g44_lab.policy_gate
          WHERE approved_test=TRUE AND revoked=FALSE)
    FOR UPDATE OF j SKIP LOCKED;
  IF NOT FOUND THEN RETURN 'NONE'; END IF;
  UPDATE g44_lab.analysis_job
    SET state='RUNNING', version=version+1, lease_epoch=lease_epoch+1,
        lease_owner=p_owner,
        lease_expires_at=clock_timestamp()+
          (p_lease_ms::double precision/1000.0)*INTERVAL '1 second'
    WHERE job_id=v_id
    RETURNING lease_epoch,version INTO v_epoch,v_version;
  RETURN v_id::text||':'||v_epoch::text||':'||v_version::text;
END $fn$;

CREATE FUNCTION g44_lab.heartbeat(
  p_job BIGINT,p_owner TEXT,p_epoch BIGINT,p_version BIGINT,p_lease_ms INTEGER
) RETURNS TEXT LANGUAGE plpgsql AS $fn$
DECLARE v_new BIGINT;
BEGIN
  IF p_lease_ms < 100 OR p_lease_ms > 60000 THEN RETURN 'INVALID_REQUEST'; END IF;
  UPDATE g44_lab.analysis_job SET version=version+1,
    lease_expires_at=clock_timestamp()+(p_lease_ms::double precision/1000.0)*INTERVAL '1 second'
   WHERE job_id=p_job AND state='RUNNING'
     AND lease_owner=p_owner AND lease_epoch=p_epoch AND version=p_version
     AND lease_expires_at>clock_timestamp()
     AND policy_epoch=(SELECT policy_epoch FROM g44_lab.policy_gate
         WHERE approved_test=TRUE AND revoked=FALSE)
   RETURNING version INTO v_new;
  IF NOT FOUND THEN RETURN 'STALE'; END IF;
  RETURN v_new::text;
END $fn$;

CREATE FUNCTION g44_lab.complete_job(
  p_job BIGINT,p_owner TEXT,p_epoch BIGINT,p_version BIGINT,p_snapshot TEXT,
  p_status TEXT DEFAULT 'READY'
) RETURNS TEXT LANGUAGE plpgsql AS $fn$
DECLARE v_scope BIGINT;v_generation BIGINT;v_policy BIGINT;
BEGIN
  IF p_snapshot !~ '^synthetic-[A-Za-z0-9_-]{1,80}$'
     OR p_status NOT IN ('READY','PARTIAL','NO_DATA') THEN RETURN 'INVALID_REQUEST'; END IF;
  UPDATE g44_lab.analysis_job SET state='SUCCEEDED',version=version+1,snapshot_id=p_snapshot
    WHERE job_id=p_job AND state='RUNNING'
      AND lease_owner=p_owner AND lease_epoch=p_epoch AND version=p_version
      AND lease_expires_at>clock_timestamp()
      AND policy_epoch=(SELECT policy_epoch FROM g44_lab.policy_gate
          WHERE approved_test=TRUE AND revoked=FALSE)
    RETURNING scope_id,publication_generation,policy_epoch
      INTO v_scope,v_generation,v_policy;
  IF NOT FOUND THEN RETURN 'STALE'; END IF;
  INSERT INTO g44_lab.analysis_snapshot
    (snapshot_id,job_id,scope_id,status,policy_epoch)
    VALUES(p_snapshot,p_job,v_scope,p_status,v_policy);
  INSERT INTO g44_lab.scope_latest
    (scope_id,snapshot_id,publication_generation)
    VALUES(v_scope,p_snapshot,v_generation)
    ON CONFLICT(scope_id) DO UPDATE
      SET snapshot_id=EXCLUDED.snapshot_id,
          publication_generation=EXCLUDED.publication_generation,
          revision=g44_lab.scope_latest.revision+1
      WHERE g44_lab.scope_latest.publication_generation < EXCLUDED.publication_generation;
  RETURN 'SUCCEEDED';
END $fn$;

CREATE FUNCTION g44_lab.read_latest(p_scope BIGINT) RETURNS TEXT
LANGUAGE sql STABLE AS $fn$
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM g44_lab.policy_gate WHERE approved_test=TRUE AND revoked=FALSE
  ) THEN 'POLICY_BLOCKED'
  ELSE COALESCE((SELECT snap.status FROM g44_lab.scope_latest l
     JOIN g44_lab.analysis_snapshot snap ON snap.snapshot_id=l.snapshot_id
     WHERE l.scope_id=p_scope),'MISS') END;
$fn$;

-- No executable rights for PUBLIC; no worker policy/privilege mutation.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA g44_lab FROM PUBLIC;
GRANT SELECT ON g44_lab.analysis_scope, g44_lab.policy_gate,
  g44_lab.budget_window, g44_lab.analysis_job, g44_lab.idempotency_record,
  g44_lab.budget_reservation, g44_lab.job_outbox, g44_lab.analysis_snapshot,
  g44_lab.scope_latest TO g44_writer;
GRANT INSERT ON g44_lab.analysis_job, g44_lab.idempotency_record,
  g44_lab.budget_reservation, g44_lab.job_outbox,
  g44_lab.analysis_snapshot, g44_lab.scope_latest TO g44_writer;
GRANT UPDATE ON g44_lab.analysis_job, g44_lab.budget_window,
  g44_lab.budget_reservation, g44_lab.job_outbox,
  g44_lab.scope_latest TO g44_writer;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA g44_lab TO g44_writer;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA g44_lab TO g44_writer;
GRANT SELECT ON g44_lab.analysis_scope, g44_lab.scope_latest,
  g44_lab.analysis_snapshot TO g44_reader;
COMMIT;
