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

A new **read-only local source adapter specification** lives in `src/local-source-adapter.cjs`. It returns **non-executable GET descriptors** for exactly 1–3 canonical public VIDEO targets, `maxResults≤100`, `part=snippet`, `order=time`, `textFormat=plainText`, first page only, retries 0. The descriptor's fixed `www.googleapis.com` hostname and `/youtube/v3/commentThreads` path are not executable transport. API keys are never present in descriptors or query parameters. **YouTube-specific authentication is still unresolved:** its API reference explicitly specifies the `key` query parameter or an OAuth token; the generic Google `x-goog-api-key` header is not verified here as supported by YouTube Data API v3. Do not activate either credential mode without a separate security and provider-compatibility review.

The module also contains **diagnostic-only** error metadata classification (comments disabled vs quota vs authorization vs missing video) and an operator-evidence checklist. A caller can report every policy/security flag `true` and the module still returns `mayCollectRealComments=false` and `POLICY_HOLD`; these flags are **not independent provider consent or security evidence**.

These descriptors and 22 synthetic tests prepare a future separate HTTP adapter without introducing an external request path, secret reader, OS IP discovery, or persistence. A real collector would require a new review, implementation, authorization and privacy-erase audit.

## G45-L1 locked HTTP envelope (first-call preparation)

The pure Node 24 module `src/first-call-http-boundary.cjs` constructs **fixed HTTPS GET plans** for 1–3 canonical VIDEO IDs, validates HTTP status/content-type/body-byte limits against the **three canonical, repository-bundled synthetic fixtures only** and sanitizes outputs. A caller cannot authorize arbitrary real comment text by merely setting `sourceType=STATIC_FIXTURE` or `isSynthetic=true`. No runtime HTTPS dispatcher, credential vault access, actual YouTube response, external proxy, file writes or automatic retries are present. `executeLiveFirstCall` always fails closed with `G45_L1_BLOCKED` regardless of caller-provided approval flags.

This is **NOT** a functioning live YouTube collector: `sourceType=STATIC_FIXTURE`, `providerRequestsMade=0`, `POLICY_HOLD` and an unverified authentication mode are retained. Only after an independent provider-policy/secret-store/IP/retention/first-call approval review may a separate, restricted outbound transport be implemented and tested.

See [L1 HTTPS/auth/policy review](../../../docs/integration/YU32_G45_L1_HTTP_AUTH_POLICY_GATES_V01.md). GitHub Actions runs the 24 offline HTTP boundary tests with the existing G45 suite.

## Required prior-to-live gates

Readiness PR #47, Worker PR #46, pipeline PR #48 and source-adapter PR #50 have been merged into `frontend`; the baseline policy gates remain `POLICY_HOLD`. This L1 change is an independent Draft PR until explicitly reviewed and merged.

Before any *future* actual YouTube retrieval/analysis: prove project+credentials+IP restriction, YouTube data-use compliance, raw text/author privacy/deletion/expiry, API budget, approval for separate derived sentiment use case, server/tenant authorization, provenance and a **new, explicit first-call approval**. The candidate readiness package on PR #47 sets `POLICY_HOLD` and cannot be overridden by this synthetic pipeline.

The future source adapter must be **separately developed and reviewed** after authorization. Do not rename `STATIC_FIXTURE` to `APPROVED_PROVIDER` or remove the provenance guard as a workaround. No provider calls, payments, infrastructure deployment or branch merges are included here.

Official shape: https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list and https://developers.google.com/youtube/data/reference/rest/v3/commentThreads . Provider derived-data restrictions: https://developers.google.com/youtube/terms/derived-metrics-policy .


## UI-R04-O — metadata read-only offline readiness (NO external requests)

Video/channel title and profile thumbnail auto-population requires a separate approved backend metadata reader. A new **transportless** candidate lives at src/metadata-readiness.cjs, with coverage in tests/metadata-readiness.test.cjs.

- Produces limited GET **descriptors** for videos.list(id), channels.list(id), and channels.list(forHandle) — max 3 canonical targets, 1 quota unit per planned request, 0 actual requests.
- Decodes only a bounded, caller-provided YouTube-shaped JSON response. Decoded fields are marked sourceAuthenticated=false and consumerPublicationAuthorized=false, even for valid shape.
- Filters to safe title/thumbnail fields; only Google/YouTube image CDN hostnames on an exact HTTPS allowlist. Cache is **in memory** for 15 minutes, never approved as a live source.
- Existing POLICY_HOLD, first-live-call hardlock, comment/derived sentiment rules, frontend image-consent behavior and protected server files are unchanged.
- For the user-facing auto title/channel image goal, a future separately approved server transport + provenance/credential/quota/retention contract must be completed before integrating this data into frontend. See docs/integration/UI_R04O_OFFLINE_YOUTUBE_METADATA_READINESS_V01.md.

~~~powershell
node --test shared/experiments/yu32-g45-offline-pipeline-v0/tests/metadata-readiness.test.cjs
~~~
