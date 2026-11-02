# YOUTOPIA — G4-5 offline collection→analysis pipeline v0

**IMPLEMENTED_SYNTHETIC_PIPELINE / NO_LIVE_YOUTUBE_API / NO_PROVIDER_NLP / POLICY_HOLD.**

This is a runnable **pure Node 24 offline pipeline** for testing the future public-video comment collection and analysis boundaries. It uses an **API-shaped synthetic fixture only** and does not require a key, Google Cloud project, Python, LLM, PostgreSQL, Docker, server, or network access.

## What is actually implemented

| Stage | File | Executed now |
|---|---|---|
| API-shaped single-page input | `fixtures/*.json` | Three **synthetic-only** `youtube#commentThreadListResponse` cases; no real API request |
| Source/scope/size validation | `src/ingest.cjs` | Validates canonical 11-character VIDEO ID, `kind`, first-page count <=100, public visibility, timestamps, reply exclusion, page marker |
| In-memory comment normalization | `src/ingest.cjs` | Checks date/window and strips author identity, avatars, etag, reply detail and next-page token from intermediate data |
| Toy text classification | `src/synthetic-classifier.cjs` | Tiny deterministic Korean/English demo lexicon **only for synthetic QA**, unknown and conflicting signals abstain |
| Metric aggregation | `src/pipeline.cjs` | Populates existing `analysis-v1-candidate` AnalysisSnapshot shape and separate synthetic evidence; denominators, topic counts and status checks |
| Command-line demo | `scripts/run-offline.cjs` | Only `--check` and hardcoded `--demo partial|ready|empty`. **No live input path or --run** |
| Regression tests | `tests/*.test.cjs` | Pure offline, no network, no OAuth/YouTube/DB, includes negative privacy and consistency cases |

## Run locally (Windows PowerShell, Node 24)

~~~powershell
cd C:\Projects\YOUTOPIA

$root = "shared/experiments/yu32-g45-offline-pipeline-v0"
node "$root/scripts/run-offline.cjs" --check
node "$root/scripts/run-offline.cjs" --demo partial
node "$root/scripts/run-offline.cjs" --demo ready
node "$root/scripts/run-offline.cjs" --demo empty
node --test "$root/tests/*.test.cjs"
~~~

**Windows PowerShell caveat:** Node's `--test` glob handling depends on Node version and shell. Use the following explicit directory invocation instead when the shell does not expand the wildcard:

~~~powershell
node --test shared/experiments/yu32-g45-offline-pipeline-v0/tests
~~~

Outputs contain only synthetic counts, synthetic target ID, synthetic topics and safe evidence flags — **never raw comment text, author identity, avatar, page token or API secret.** The fixed demo only accepts three bundled fixtures. Do not copy a real Google API payload into those fixture files.

## Data-quality contract and limits

- One page **at most**; `nextPageToken` is a Boolean incompleteness indicator only and **never fetched**. `commentThreads.list(part=snippet)` excludes full replies.
- Raw count is returned top-level thread count **within this synthetic page**, not YouTube video/comment population. Out-of-window rows are excluded; `eligibleCount = classifiedCount + unclassifiedCount`; `rawCount = eligibleCount + excludedCount`.
- Unknown or contradictory text becomes **unclassified**, not a fabricated sentiment score. Topic mentions are multi-label. This toy classifier has **no accuracy validation** and must not be used for actual YouTube comment sentiment or claims about creators/viewers.
- In the synthetic COMPLETE case status may be `READY`, but `sourceType=STATIC_FIXTURE` / `isSynthetic=true` **always**. Never treat QA READY as `APPROVED_PROVIDER` or as a customer-visible metric.
- Empty successful page in the defined query scope is `NO_DATA` **without sample/sentiment percentages**. Comments disabled/permission/quota errors are separate and cannot be silently converted to zero.
- The output is a **candidate** `AnalysisSnapshot` matching `shared/contracts/analysis-v1/analysis.schema.json` keys. No HTTP adapter, durable DB write, data-retention mechanism, provider-authorized classifier or public consumer is implemented.

## Administrator-controlled deletion (synthetic QA only)

**Approved direction:** Only a server-authenticated `ADMIN` may manually delete YOUTOPIA-collected VIDEO analysis data. A separate **mandatory system expiration** path and **verified user-erasure request** path must still work without an admin login; 30-day API data refresh/deletion and 7-day user erasure requirements may not be bypassed.

The working **in-memory synthetic harness**, `src/admin-purge.cjs`, tests exact `tenant+VIDEO` scope, admin preview+explicit confirmation, reason, idempotency UUID, revision conflict, dependent cache/index/report/job/outbox removal, tombstone/replay protection, metadata-only audit, automatic expiry and verified-erasure simulation. `syntheticActorForTests` is NOT production authentication, and no real storage is affected.

~~~powershell
node shared/experiments/yu32-g45-offline-pipeline-v0/scripts/run-admin-purge-demo.cjs --check
node shared/experiments/yu32-g45-offline-pipeline-v0/scripts/run-admin-purge-demo.cjs --demo-admin-delete
node shared/experiments/yu32-g45-offline-pipeline-v0/scripts/run-admin-purge-demo.cjs --demo-expiry
node shared/experiments/yu32-g45-offline-pipeline-v0/scripts/run-admin-purge-demo.cjs --demo-user-erasure
~~~

See [G4-5 Admin Deletion & Retention Contract](../../../docs/integration/YU32_G4_5_ADMIN_DELETION_RETENTION_CONTRACT_V01.md) for the **not-yet-implemented** Spring security/admin UI, retention, propagation, restoration fence and source-policy gates.

## Local YouTube source-adapter descriptors (still offline)

A new **read-only local source adapter specification** lives in `src/local-source-adapter.cjs`. It returns **non-executable GET descriptors** for exactly 1–3 canonical public VIDEO targets, `maxResults≤100`, `part=snippet`, `order=time`, `textFormat=plainText`, first page only, retries 0. The descriptor's fixed `www.googleapis.com` hostname and `/youtube/v3/commentThreads` path are not executable transport. API keys are never present in descriptors or query parameters; future secured runtime must use server-held `x-goog-api-key` headers if authorized.

The module also contains **diagnostic-only** error metadata classification (comments disabled vs quota vs authorization vs missing video) and an operator-evidence checklist. A caller can report every policy/security flag `true` and the module still returns `mayCollectRealComments=false` and `POLICY_HOLD`; these flags are **not independent provider consent or security evidence**.

These descriptors and 22 synthetic tests prepare a future separate HTTP adapter without introducing an external request path, secret reader, OS IP discovery, or persistence. A real collector would require a new review, implementation, authorization and privacy-erase audit.

## Required prior-to-live gates

This PR is deliberately **independent** of [G4-5 readiness PR #47](https://github.com/Choi1999/YOUTOPIA/pull/47) and [G44 Worker PR #46](https://github.com/Choi1999/YOUTOPIA/pull/46), each still Draft at time of authoring.

Before any *future* actual YouTube retrieval/analysis: prove project+credentials+IP restriction, YouTube data-use compliance, raw text/author privacy/deletion/expiry, API budget, approval for separate derived sentiment use case, server/tenant authorization, provenance and a **new, explicit first-call approval**. The candidate readiness package on PR #47 sets `POLICY_HOLD` and cannot be overridden by this synthetic pipeline.

The future source adapter must be **separately developed and reviewed** after authorization. Do not rename `STATIC_FIXTURE` to `APPROVED_PROVIDER` or remove the provenance guard as a workaround. No provider calls, payments, infrastructure deployment or branch merges are included here.

Official shape: https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list and https://developers.google.com/youtube/data/reference/rest/v3/commentThreads . Provider derived-data restrictions: https://developers.google.com/youtube/terms/derived-metrics-policy .
