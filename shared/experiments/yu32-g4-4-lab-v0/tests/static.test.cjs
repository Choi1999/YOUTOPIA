"use strict";
/**
 * Static guards only — never invokes Docker, PostgreSQL or any provider.
 * The 40 G4-4 scenarios remain NOT_RUN until a separate lab execution.
 */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");

const lab = path.resolve(__dirname,"..");
const repo = path.resolve(lab,"../../..");
const read = relative => fs.readFileSync(path.join(lab,relative),"utf8");
const compose=read("compose.lab.yaml");
const schema=read("sql/schema.lab.sql");
const runner=read("scripts/run-lab.mjs");
const g44=fs.readFileSync(path.join(repo,"docs/integration/YU32_G4_4_VERIFICATION_MATRIX_V01.md"),"utf8");
const g43=fs.readFileSync(path.join(repo,"docs/integration/YU32_G4_3_VERIFICATION_MATRIX_V01.md"),"utf8");

test("G44-S01: only isolated Docker service, no host port or host network",()=>{
  assert.match(compose,/postgres:16-alpine/);
  assert.match(compose,/pull_policy:\s*never/);
  assert.match(compose,/internal:\s*true/);
  assert.doesNotMatch(compose,/^\s*ports:/m);
  assert.doesNotMatch(compose,/network_mode:\s*host/);
  assert.doesNotMatch(compose,/privileged:\s*true/);
  assert.equal((compose.match(/^\s{2}db:/gm)||[]).length,1);
});
test("G44-S02: explicit run gate and no CI auto-run",()=>{
  assert.match(runner,/G44_LAB_CONFIRM/);
  assert.match(runner,/ISOLATED_ONLY/);
  assert.match(runner,/process\.env\.CI/);
  assert.match(runner,/--run/);
  assert.match(runner,/docker\(\["image","inspect",image\]\)/);
  assert.match(runner,/checkIsolation\(\)/);
  assert.match(runner,/down","-v","--remove-orphans"/);
});
test("G44-S03: schema has explicit DB identity guard and distinct lab roles",()=>{
  assert.match(schema,/current_database\(\) <> 'g44_lab'/);
  assert.match(schema,/current_user <> 'g44_dba'/);
  assert.match(schema,/CREATE ROLE g44_writer NOLOGIN/);
  assert.match(schema,/CREATE ROLE g44_reader NOLOGIN/);
  assert.match(schema,/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA g44_lab FROM PUBLIC/);
  assert.match(schema,/REVOKE ALL ON DATABASE g44_lab FROM PUBLIC/);
  assert.doesNotMatch(schema,/CREATE ROLE [A-Za-z0-9_]+ SUPERUSER\b/);
});
test("G44-S04: PG16 NULLS NOT DISTINCT and active partial UNIQUE",()=>{
  assert.match(schema,/UNIQUE NULLS NOT DISTINCT/);
  assert.match(schema,/WHERE state IN \('QUEUED','RUNNING'\)/);
  assert.match(schema,/CONSTRAINT g44_scope_canonical/);
  assert.match(schema,/FOREIGN KEY|REFERENCES g44_lab\.analysis_scope/);
});
test("G44-S05: Worker uses SKIP LOCKED, database clock and both fencing values",()=>{
  assert.match(schema,/FOR UPDATE SKIP LOCKED/);
  assert.match(schema,/lease_epoch=lease_epoch\+1/);
  assert.match(schema,/version=version\+1/);
  assert.match(schema,/lease_epoch=p_epoch AND version=p_version/);
  assert.match(schema,/lease_expires_at>clock_timestamp\(\)/);
  assert.match(schema,/WHERE g44_lab\.scope_latest\.publication_generation < EXCLUDED\.publication_generation/);
  assert.match(schema,/policy_epoch=/);
});
test("G44-S06: Job + reservation + outbox + idempotency in same function transaction",()=>{
  assert.match(schema,/CREATE FUNCTION g44_lab\.submit_job/);
  for(const name of ["analysis_job","budget_reservation","job_outbox","idempotency_record"]) {
    assert.match(schema,new RegExp("INSERT INTO g44_lab\\."+name));
  }
  assert.match(schema,/pg_advisory_xact_lock/);
  assert.match(schema,/UPDATE g44_lab\.budget_window SET remaining=remaining-1/);
});
test("G44-S07: 40 proposed cases still NOT_RUN or POLICY_HOLD, not PASS",()=>{
  const rows=g44.split("\n").filter(x=>/^\| G44-T\d{2} \|/.test(x))
    .map(x=>x.split("|").slice(1,-1).map(v=>v.trim()));
  const prior=g43.split("\n").filter(x=>/^\| G43-O\d{2} \|/.test(x))
    .map(x=>x.split("|")[1].trim());
  assert.equal(rows.length,40);
  assert.equal(new Set(rows.map(x=>x[0])).size,40);
  assert.equal(prior.length,28);
  for(let i=0;i<28;i++)assert.equal(rows[i][2],prior[i]);
  assert.ok(rows.slice(28).every(x=>x[2]==="추가"));
  assert.equal(rows.filter(x=>x[6]==="POLICY_HOLD").length,1);
  assert.equal(rows.filter(x=>x[6]==="NOT_RUN").length,39);
});
test("G44-S08: Lab contains no live YouTube/operating API route or static secret",()=>{
  const corpus=[compose,schema,runner].join("\n");
  assert.doesNotMatch(corpus,/youtube\.googleapis\.com|youtube\.com\/watch|\/api\/v1\/analysis\/jobs/);
  assert.doesNotMatch(corpus,/manifest\.json|REAL_API_KEY|YOUTOPIA_DATA_DB_PASSWORD/);
  assert.match(schema,/STATIC_FIXTURE/);
  assert.match(schema,/approved_test/);
});
test("G44-S09: runner can perform Docker-free self-check only",()=>{
  const value=execFileSync(process.execPath,[path.join(lab,"scripts/run-lab.mjs"),"--check"],{
    encoding:"utf8",timeout:10000,env:{...process.env,G44_LAB_CONFIRM:""}
  });
  assert.match(value,/STATIC_MANIFEST_VALIDATED_ONLY/);
});
test("G44-S10: execution requires explicit opt-in; no Docker work on refusal",()=>{
  let error;
  try{
    execFileSync(process.execPath,[path.join(lab,"scripts/run-lab.mjs")],{
      encoding:"utf8",timeout:10000,env:{...process.env,G44_LAB_CONFIRM:""}
    });
  }catch(e){error=e;}
  assert.ok(error);
  assert.notEqual(error.status,0);
  assert.match(String(error.stderr),/G44 STOP/);
});

test("G44-S11: SQL fixture has one canonical schema, a single COMMIT, and terminal fencing",()=>{
  assert.equal(schema.split("CREATE SCHEMA g44_lab;").length-1,1);
  assert.equal(schema.split("CREATE UNIQUE INDEX g44_one_active_per_partition").length-1,1);
  assert.equal(schema.split("COMMIT;").length-1,1);
  assert.equal(schema.split("CREATE TRIGGER g44_job_transition_guard").length-1,1);
  assert.match(schema,/tenant_id IS NOT NULL/);
  assert.match(schema,/OLD.state IN \('SUCCEEDED','FAILED'\)/);
  assert.match(schema,/NEW.version <= OLD.version/);
});

test("G44-S12: private tenant CHECK regex and SQL quote closure are complete",()=>{
  const begin=schema.indexOf("CREATE TABLE g44_lab.analysis_scope(");
  const end=schema.indexOf("CREATE TABLE g44_lab.budget_window(",begin);
  assert.ok(begin>=0 && end>begin);
  const scopeDDL=schema.slice(begin,end);
  assert.ok(scopeDDL.includes("AND tenant_id ~ '^[A-Za-z0-9_-]{1,64}$')"));
  assert.match(scopeDDL,/CONSTRAINT g44_scope_canonical UNIQUE NULLS NOT DISTINCT/);
  assert.equal((scopeDDL.match(/'/g)||[]).length%2,0,"Unterminated SQL string literal in Scope DDL");
});

test("G44-S13: Docker engine must be the local Windows Desktop Linux pipe",()=>{
  assert.match(runner,/function verifyLocalDockerContext\(\)/);
  assert.match(runner,/DOCKER_HOST/);
  assert.match(runner,/DOCKER_CONTEXT/);
  assert.match(runner,/context","show/);
  assert.match(runner,/dockerdesktoplinuxengine/);
  assert.match(runner,/context\.dockerTarget=verifyLocalDockerContext\(\)/);
  const guardIndex=runner.indexOf("context.dockerTarget=verifyLocalDockerContext()");
  const dockerStart=runner.indexOf('docker([...base,"up","-d","--wait"');
  assert.ok(guardIndex>=0 && dockerStart>guardIndex);
});

const childWorker=read("scripts/worker-process.mjs");
const recovery=read("scripts/worker-probes.mjs");

test("G44-S14: stored Outbox event ID binds the claim to one fenced Job",()=>{
  assert.equal(schema.split("CREATE FUNCTION g44_lab.claim_from_outbox(").length-1,1);
  assert.match(schema,/JOIN g44_lab\.analysis_job AS j ON j\.job_id=o\.job_id/);
  assert.match(schema,/o\.event_id=p_event AND o\.event_type='DISPATCH'/);
  assert.match(schema,/pg_advisory_xact_lock[\s\S]*hashtextextended\('g44-outbox:'\|\|p_event::text/);
  assert.match(schema,/FOR UPDATE OF j SKIP LOCKED/);
  assert.match(schema,/j\.lease_expires_at <= clock_timestamp\(\)/);
  assert.match(schema,/lease_epoch=lease_epoch\+1/);
  assert.match(schema,/j\.policy_epoch=\(SELECT policy_epoch/);
});

test("G44-S15: synthetic worker child is IPC-only, restricted and fail-closed",()=>{
  assert.match(childWorker,/G44_CHILD_PROJECT/);
  assert.match(childWorker,/G44_CHILD_OWNER/);
  assert.match(childWorker,/G44_LAB_CONFIRM/);
  assert.match(childWorker,/process\.env\.CI/);
  assert.match(childWorker,/G44 child STOP/);
  assert.match(childWorker,/process\.exit\(1\)/);
  assert.match(childWorker,/process\.send/);
  assert.match(childWorker,/SET ROLE g44_writer/);
  assert.match(childWorker,/context","show/);
  assert.match(childWorker,/claim_from_outbox/);
  assert.doesNotMatch(childWorker,/youtube\.googleapis\.com|\/api\/v1\/analysis\/jobs|https?:\/\//);
});

test("G44-S16: actual child-process crash and duplicate-event probes are opt-in only",()=>{
  for(const label of ["G44-T14-PROCESS","G44-T15/T16-PROCESS","G44-T17-PROCESS",
    "G44-T27-REDRIVE","G44-T36-NODE_CLOCK_SUBSET"])
    assert.ok(recovery.includes('ctx.verify("'+label+'"'));
  assert.match(recovery,/fork\(workerScript/);
  assert.match(recovery,/\.kill\("SIGKILL"\)/);
  assert.match(recovery,/waitDbExpiry/);
  assert.match(recovery,/pg_stat_activity/);
  assert.match(recovery,/outboxBarrier/);
  assert.match(recovery,/assert\.equal\(duplicateAfter\.value,"NONE"\)/);
  assert.match(recovery,/Date\.now\(\)/);
  assert.match(runner,/runWorkerRecoveryProbes/);
  assert.match(runner,/await tests\(\);[\s\S]*await runWorkerRecoveryProbes\(/);
  assert.doesNotMatch(recovery,/youtube\.googleapis\.com|fetch\(|https?:\/\//);
});

test("G44-S17: feature branch preflight remains gated and 18 baseline probes stay",()=>{
  assert.match(runner,/context\.gitBranch!=="feature\/yu32-g44-worker-recovery-outbox-v01"/);
  assert.match(runner,/function verifyLocalDockerContext\(\)/);
  assert.match(runner,/process\.env\.CI/);
  assert.equal((runner.match(/await verify\("G44/g)||[]).length,18);
  assert.match(runner,/docker\(\[\.\.\.base,"down","-v","--remove-orphans"\]\)/);
  assert.doesNotMatch(runner,/youtube\.googleapis\.com/);
});

test("G44-S18: standalone child invocation without parent approval is rejected",()=>{
  const res=require("node:child_process").spawnSync(process.execPath,
    [path.join(lab,"scripts/worker-process.mjs")],{
      encoding:"utf8",timeout:10000,
      env:{...process.env,CI:"true",G44_LAB_CONFIRM:"",
        G44_CHILD_PROJECT:"",G44_CHILD_OWNER:"worker-A"}
    });
  assert.notEqual(res.status,0);
  assert.match(res.stderr||"",/G44 child STOP: Synthetic parent\/lab guard failed/);
});
