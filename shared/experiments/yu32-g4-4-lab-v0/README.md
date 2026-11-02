# YUTOPIA — G44 isolated PostgreSQL 16 / Worker lab v0

**State: IMPLEMENTED_SUBSET / USER_VERIFIED_PG16_SUBSET_18_OF_18 / SECURITY_NOT_RUN / OFFLINE_ONLY / POLICY_HOLD.**

The 18-probe result is tied to code HEAD `e0a06ebc8b6b844d8a9cba186cecb7d4a5da2f61` and is **not proof for any later code change**. A new local Docker endpoint guard was added after this execution, so new HEAD runtime validation is required.

This folder supplies a disposable PostgreSQL 16 schema and a guarded, opt-in, **host-local** Node 24 runner. It does **not** introduce an operating analysis API, authenticate real users, call YouTube, or enable subscriber billing. The real G4-4 40-case matrix is **not** completed by its existence or by regular GitHub CI. See [G4-4 verification plan](../../../docs/integration/YU32_G4_4_ISOLATED_DB_WORKER_VERIFICATION_PLAN_V01.md) and [G4-4 matrix](../../../docs/integration/YU32_G4_4_VERIFICATION_MATRIX_V01.md).

## Isolation and principal model

- A unique Docker Compose project is generated for each opted-in run; one **PostgreSQL 16** container on a single **internal: true** Compose network with **no host ports**, **no privileged mode**, and a named volume removed with project-scoped `down -v`.
- The executable refuses any automatic image pull (`pull_policy: never` and `docker image inspect` preflight). The operator must inspect/download the **official PostgreSQL 16 image** separately, and record its image digest. This external image retrieval is **not** performed by the lab runner.
- A random test-only DB password is created in memory for Compose. It is not logged or committed; it is not an existing database credential. Host commands connect through `docker compose exec` into the isolated container, never over a published port.
- The SQL script refuses to initialize unless the DB is `g44_lab` under the new sandbox `g44_dba`. It creates `g44_writer`/`g44_reader` **NOLOGIN** restricted roles. The runner's `SET ROLE` tests **effective database privileges only**; they do not prove a separate authenticated production role or Spring Security. Lab schema contents are synthetic.
- The runner checks the **local Windows Docker Desktop `desktop-linux` context and its named pipe** before any Compose operation, refuses Docker endpoint environment overrides, and verifies Linux Engine. It also checks DB version **16.x**, unique project networking, `Network.Internal=true`, and absence of host port bindings **before executing SQL**. All commands are restricted to project-scoped Compose resources. Unexpected resources cause a STOP.
- Database-level `POLICY_HOLD` is the default. Tests explicitly set a **sandbox-only** policy fixture and never claim rights to source data. No external API execution is implemented; Worker A/B are separate local `psql` processes against the disposable database.
- The Node 24/GitHub CI entrypoint runs only `node:test` **static checks**. It never starts Docker or PostgreSQL. The opt-in executable refuses execution in CI.

## Operator preflight (Windows PowerShell)

Use an otherwise clean **local working tree** and verify the repository/branch before attempting execution. These commands are intended for a Windows machine that has Docker Desktop with **Compose v2**, Node 24, and the image already present.

~~~powershell
cd C:\Projects\YOUTOPIA
if (git status --porcelain) { throw "Uncommitted local changes: STOP" }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Fetch failed: STOP" }
$branch = "feature/yu32-g4-4-isolated-pg-worker-lab-v01"
git switch $branch
if ($LASTEXITCODE -ne 0) { throw "Switch failed; inspect local branches" }
git pull --ff-only origin $branch
if ($LASTEXITCODE -ne 0) { throw "Pull failed" }

if ($env:DOCKER_HOST -or $env:DOCKER_CONTEXT -or $env:DOCKER_TLS_VERIFY -or $env:DOCKER_CERT_PATH) {
    throw "Docker endpoint override detected: STOP"
}
docker context show
if ($LASTEXITCODE -ne 0) { throw "Docker context lookup failed" }

docker version
docker compose version
docker image inspect postgres:16-alpine
# If image is absent, STOP. Obtain/pin the official image separately;
# the lab executable will NOT pull it.
node --check shared/experiments/yu32-g4-4-lab-v0/scripts/run-lab.mjs
node --test shared/experiments/yu32-g4-4-lab-v0/tests/static.test.cjs
node shared/experiments/yu32-g4-4-lab-v0/scripts/run-lab.mjs --check
~~~

Check the Docker image ID/digest and Docker configuration before opting in. A pre-existing local branch of the same name requires safe manual selection instead of blind branch switching. Do not supply `.env` from an existing service or any production API keys.

## Explicit opt-in run and teardown

The opt-in flag is deliberately **not set by CI**. Its presence means only that the operator approved this disposable Lab, not the external YouTube policy.

~~~powershell
$env:G44_LAB_CONFIRM = "ISOLATED_ONLY"
try {
    node shared/experiments/yu32-g4-4-lab-v0/scripts/run-lab.mjs --run
    if ($LASTEXITCODE -ne 0) { throw "G44 lab FAIL or INCONCLUSIVE" }
}
finally {
    Remove-Item Env:G44_LAB_CONFIRM -ErrorAction SilentlyContinue
}
~~~

The runner must always attempt project-scoped `docker compose down -v --remove-orphans` even after test failure. Evidence is written as redacted JSON in `evidence/<run-id>.json` (Git-ignored) and its SHA-256 is shown in stdout. Check the `cleanup` field and Docker resource inventory before considering the run complete. An interrupted/force-killed host process can prevent the `finally` cleanup; in that event, inventory **only the unique G44 project** and obtain separate approval before removing unidentified resources.

## Implemented Lab probes — no 40/40 claim

The current opt-in subset attempts: PG16/isolated network preflight; G44-T03, T04 (**private-tenant CHECK only**), T05, T06, T07 (**two PostgreSQL connections verified blocked on one advisory-lock barrier**), T08 (**DB portion**), T10, T14, T15/T16, T18 (**synthetic epoch only**), T25/T37 (**effective NOLOGIN role permissions only**), T27 (**claim-only subset, no duplicated event injection yet**), T29, T34, T35, T38 (**terminal state guard**), and T39 (**quota replay/policy withdrawal subset**). It checks CREATE/JOINED/CONFLICT with independent `psql` sessions, Scope `NULLS NOT DISTINCT`, one active Job, same-transaction budget/idempotency/outbox, lease fencing, revocation and monotonic public latest pointer.

**Not implemented or not covered end-to-end:** the other 40-case G4-4 matrix entries, robust Redis integration, HTTP 409/response-loss E2E, full failure/refund ledger, backoff/serializable retry, real server/CSRF/BOLA/restore fencing, process crash reattachment outside simulated lease expiration, and source usage compliance. Node static tests do not execute PG16; even an opt-in Lab PASS must never be labeled production authorization, external exactly-once or complete G44-P1~P5 acceptance.

## Evidence and failure handling

Record (and verify locally) the branch SHA, `postgres:16-alpine` image ID, version 16.x, run-id, two real DB connections, state/row counts, fencing epoch/version, rollback results, sanitised errors, and teardown. Current runner emits only a subset of this evidence; **a missing proof is INCONCLUSIVE, never PASS**. Results are saved outside tracked files and must be reviewed before GitHub publication.

### 2026-11-02 user-side runtime evidence (prior head)

- Run ID: `g44_ea8e8a3a579b`; tested HEAD: `e0a06ebc8b6b844d8a9cba186cecb7d4a5da2f61`.
- User executed an isolated PostgreSQL 16.15 Lab. The evidence JSON hash was verified locally against terminal-reported `ebc6e712318521523d5bc576bb4ecc1cd0c7f375a3e111bbc5f98d4583b8294c`.
- All **18 implemented probes** passed, zero failed. The evidence file reports `cleanup=PASS`; project-scoped container/network/volume inventory was empty after run. The assistant did not retrieve the raw JSON bytes, but inspected the provided local verification output.
- Noteworthy: G44-T07 measured two simultaneously lock-blocked psql connections, one CREATE and one JOIN. T05 only uses sequential replay; T14 is a smoke check, T15/T16 simulate lease expiry rather than a process crash, T27 does not actually redeliver an Outbox event, and actual Spring auth and external use policy remain untested.
- The G44 40-scenario design matrix remains a *full acceptance plan*, not a PASS matrix. **Lab proof does not authorize operational analysis.**
- **Any change to the runner/SQL/Compose after this tested HEAD requires a new opt-in run and new evidence hash before claiming runtime validation of that new HEAD.**

The assistant's isolated execution environment has no Docker/psql server and has not itself run PostgreSQL; results above are from the user's independently checked Windows terminal. Deploy, release, billing and real YouTube analysis remain out of scope.
