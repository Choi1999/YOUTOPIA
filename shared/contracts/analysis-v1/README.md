# YOUTOPIA — Analysis Contract v1 candidate

> **2026-10-21 KST · DRAFT_REQUIRES_FE_BE_REVIEW · NOT AN APPROVED API · MOCK-ONLY**

This proposal provides a versioned, self-contained schema and synthetic fixtures for the first FE/BE interface review. It is **not** deployed to a server, does not modify the Chrome extension or backend, and is not an authorization to use live YouTube comments or derived metrics.

## 1. What this package owns

- `analysis.schema.json`: JSON Schema 2020-12 with the following candidate definitions:
  - `AnalysisTarget`: YouTube VIDEO/CHANNEL and exact canonical ID; unresolved `@handle` does not silently become a channel ID.
  - `AnalysisSnapshot`: status, analysis scope, sample counts, topic/sentiment, observed/analyzed timestamps, provenance and audience.
  - `AnalysisJob`: durable-job-facing state and idempotency identifier; never requires a Chrome Service Worker to run inference.
  - `TopicTrend`: time bins, topic mentions, classified negative comments and comparability gate.
  - `ErrorEnvelope`: machine-readable error/retryability, trace ID stays internal.
  - `UserEntitlement`: server-controlled role/plan/organization authorization contract, not a client decision.
- `fixtures/*.json`: **synthetic** READY, PARTIAL, NO_DATA, POLICY_BLOCKED and two-bin topic trend only.
- `tests/semantic-smoke.test.cjs`: dependency-free Node candidate shape/invariant smoke tests.

No external API, OAuth, DB, real YouTube data, prediction model, or live user profile is used.

## 2. Source of truth and ownership

- Source repository: `Choi1999/YOUTOPIA`.
- This first candidate is proposed on a feature branch from `frontend` so existing Chrome changes are not interrupted. It is **not** automatically approved by the `backend` branch or `dev`.
- FE consumer and BE provider must separately review canonical IDs, schema versioning, error semantics, null handling, scope/tenant boundaries and API security before CT-G1 may be marked PASS.
- After approval, the same schema SHA must be available to both build/test pipelines through an agreed `shared/` synchronization strategy. Do not blindly merge diverged branches.
- Previous `docs/backend-handoff/02_API_CONTRACT.yaml` on `frontend` is an older **DRAFT / NOT IMPLEMENTED**, originally designed around game-event/demo projects. This small contract is a **proposal for the currently approved generic YouTube Hover→Side Panel product**, not a silent replacement of the old contract.

## 3. Non-negotiable semantics

| Field / condition | Rule |
|---|---|
| `targetType=VIDEO` | Canonical YouTube video ID, exactly 11 allowed characters |
| `targetType=CHANNEL` | Canonical UC-prefixed channel ID; unverified handle rejected |
| `sourceType=STATIC_FIXTURE` | `isSynthetic=true`; QA only |
| `sourceType=APPROVED_PROVIDER` | Cannot be connected until separate YouTube data/derived metric and deletion policies are approved |
| `PUBLIC_REUSABLE` | `tenantId=null`; authorization and legitimate source rights still required before access |
| `TENANT_PRIVATE` | A concrete server-verified tenant scope is mandatory |
| `rawCount` | When known: `eligibleCount + excludedCount`, **not** equal to classifiedCount by default |
| `eligibleCount` | When known: `classifiedCount + unclassifiedCount` |
| `sentiment` | Positive+neutral+negative count sums to sentiment-classified count |
| `topics[]` | Multi-label; topic mention percentages are not expected to sum to 100% |
| `NO_DATA / POLICY_BLOCKED` | No fabricated sentiment percentages or trend line; nullable counts mean unknown, not 0 |
| `status=STALE` | Never silently claim fresh data; timestamps and invalidation rules apply |
| `TopicTrend` | At least two chronological comparable periods for READY; never infer YouTube-wide popularity from a personal home feed |
| `analysisVersion`, `topicTaxonomyVersion` | Must match contract-controlled processing metadata before comparing/reusing results |

The semantic invariants above include cross-field arithmetic. JSON Schema alone **does not enforce all cross-field arithmetic**, so FE and BE must independently test these invariants on the approved Provider. The local smoke test is not a substitute for complete JSON Schema engine or server integration tests.

## 4. Proposed HTTP surface (NOT IMPLEMENTED)

These paths are candidate names only. The backend owner must decide HTTP status, auth scheme, rate limit, idempotency, pagination, and tenant scoping before adoption.

| Proposed endpoint | Purpose | Important boundary |
|---|---|---|
| `GET /v1/analysis/targets/{type}/{id}/summary` | Read usable summary or honest unavailable state | No automatic comment-collection side effect without explicit agreed policy |
| `POST /v1/analysis/jobs` | Queue authorized analysis for exact scope | Idempotency, quota/budget, rights, server authorization |
| `GET /v1/analysis/jobs/{jobId}` | Read task state | Must check job ownership/access |
| `GET /v1/analysis/targets/{type}/{id}/trends` | Read topic trend with comparable windows | Refuse unsupported dates, no fabricated trend |
| `GET /v1/entitlements/me` | Check server-authoritative capabilities | UI plan is not authorization |

Do not set a live endpoint base URL or add Chrome host permissions based on this candidate alone.

## 5. How to run candidate smoke tests

From repository root on a Node.js environment:

~~~powershell
node --test shared/contracts/analysis-v1/tests/*.test.cjs
~~~

Expected behavior: parse fixture JSON and the schema, validate arithmetic and known fail-closed cases, including invalid IDs, count mismatch, no-data falsified sentiment, tenant leak, synthetic-source disagreement, and invalid time trend.

### SC-01 standard JSON Schema validation (offline, Python)

The separate SC-01 test loads the **actual** `analysis.schema.json` from this repository and
uses a standards-conformant Draft 2020-12 validator for 11 documented golden
identity cases plus two trailing-newline regression cases.

~~~powershell
python -m pip install "jsonschema>=4.18,<5"
python -m unittest discover -s shared/contracts/analysis-v1/tests -p "test_sc01_target_schema.py" -v
~~~

VIDEO IDs require exactly 11 characters; CHANNEL IDs require exactly 24 (`UC` + 22).
In addition to the regular expressions, the subtype-specific JSON Schema
`minLength`/`maxLength` constraints prevent the `# YOUTOPIA — Analysis Contract v1 candidate

> **2026-10-21 KST · DRAFT_REQUIRES_FE_BE_REVIEW · NOT AN APPROVED API · MOCK-ONLY**

This proposal provides a versioned, self-contained schema and synthetic fixtures for the first FE/BE interface review. It is **not** deployed to a server, does not modify the Chrome extension or backend, and is not an authorization to use live YouTube comments or derived metrics.

## 1. What this package owns

- `analysis.schema.json`: JSON Schema 2020-12 with the following candidate definitions:
  - `AnalysisTarget`: YouTube VIDEO/CHANNEL and exact canonical ID; unresolved `@handle` does not silently become a channel ID.
  - `AnalysisSnapshot`: status, analysis scope, sample counts, topic/sentiment, observed/analyzed timestamps, provenance and audience.
  - `AnalysisJob`: durable-job-facing state and idempotency identifier; never requires a Chrome Service Worker to run inference.
  - `TopicTrend`: time bins, topic mentions, classified negative comments and comparability gate.
  - `ErrorEnvelope`: machine-readable error/retryability, trace ID stays internal.
  - `UserEntitlement`: server-controlled role/plan/organization authorization contract, not a client decision.
- `fixtures/*.json`: **synthetic** READY, PARTIAL, NO_DATA, POLICY_BLOCKED and two-bin topic trend only.
- `tests/semantic-smoke.test.cjs`: dependency-free Node candidate shape/invariant smoke tests.

No external API, OAuth, DB, real YouTube data, prediction model, or live user profile is used.

## 2. Source of truth and ownership

- Source repository: `Choi1999/YOUTOPIA`.
- This first candidate is proposed on a feature branch from `frontend` so existing Chrome changes are not interrupted. It is **not** automatically approved by the `backend` branch or `dev`.
- FE consumer and BE provider must separately review canonical IDs, schema versioning, error semantics, null handling, scope/tenant boundaries and API security before CT-G1 may be marked PASS.
- After approval, the same schema SHA must be available to both build/test pipelines through an agreed `shared/` synchronization strategy. Do not blindly merge diverged branches.
- Previous `docs/backend-handoff/02_API_CONTRACT.yaml` on `frontend` is an older **DRAFT / NOT IMPLEMENTED**, originally designed around game-event/demo projects. This small contract is a **proposal for the currently approved generic YouTube Hover→Side Panel product**, not a silent replacement of the old contract.

## 3. Non-negotiable semantics

| Field / condition | Rule |
|---|---|
| `targetType=VIDEO` | Canonical YouTube video ID, exactly 11 allowed characters |
| `targetType=CHANNEL` | Canonical UC-prefixed channel ID; unverified handle rejected |
| `sourceType=STATIC_FIXTURE` | `isSynthetic=true`; QA only |
| `sourceType=APPROVED_PROVIDER` | Cannot be connected until separate YouTube data/derived metric and deletion policies are approved |
| `PUBLIC_REUSABLE` | `tenantId=null`; authorization and legitimate source rights still required before access |
| `TENANT_PRIVATE` | A concrete server-verified tenant scope is mandatory |
| `rawCount` | When known: `eligibleCount + excludedCount`, **not** equal to classifiedCount by default |
| `eligibleCount` | When known: `classifiedCount + unclassifiedCount` |
| `sentiment` | Positive+neutral+negative count sums to sentiment-classified count |
| `topics[]` | Multi-label; topic mention percentages are not expected to sum to 100% |
| `NO_DATA / POLICY_BLOCKED` | No fabricated sentiment percentages or trend line; nullable counts mean unknown, not 0 |
| `status=STALE` | Never silently claim fresh data; timestamps and invalidation rules apply |
| `TopicTrend` | At least two chronological comparable periods for READY; never infer YouTube-wide popularity from a personal home feed |
| `analysisVersion`, `topicTaxonomyVersion` | Must match contract-controlled processing metadata before comparing/reusing results |

The semantic invariants above include cross-field arithmetic. JSON Schema alone **does not enforce all cross-field arithmetic**, so FE and BE must independently test these invariants on the approved Provider. The local smoke test is not a substitute for complete JSON Schema engine or server integration tests.

## 4. Proposed HTTP surface (NOT IMPLEMENTED)

These paths are candidate names only. The backend owner must decide HTTP status, auth scheme, rate limit, idempotency, pagination, and tenant scoping before adoption.

| Proposed endpoint | Purpose | Important boundary |
|---|---|---|
| `GET /v1/analysis/targets/{type}/{id}/summary` | Read usable summary or honest unavailable state | No automatic comment-collection side effect without explicit agreed policy |
| `POST /v1/analysis/jobs` | Queue authorized analysis for exact scope | Idempotency, quota/budget, rights, server authorization |
| `GET /v1/analysis/jobs/{jobId}` | Read task state | Must check job ownership/access |
| `GET /v1/analysis/targets/{type}/{id}/trends` | Read topic trend with comparable windows | Refuse unsupported dates, no fabricated trend |
| `GET /v1/entitlements/me` | Check server-authoritative capabilities | UI plan is not authorization |

Do not set a live endpoint base URL or add Chrome host permissions based on this candidate alone.

## 5. How to run candidate smoke tests

From repository root on a Node.js environment:

~~~powershell
node --test shared/contracts/analysis-v1/tests/*.test.cjs
~~~

Expected behavior: parse fixture JSON and the schema, validate arithmetic and known fail-closed cases, including invalid IDs, count mismatch, no-data falsified sentiment, tenant leak, synthetic-source disagreement, and invalid time trend.

 anchor from being interpreted
differently across validator regex engines (notably trailing LF in Python).
Shape-valid IDs are **not** evidence of an existing YouTube video/channel or
permission to collect data. This test does not execute the Chrome extension, Web,
FE/BE Provider, or authentication flow.

**Evidence boundaries:**
- These Node tests perform **semantic smoke checks**, not full JSON Schema 2020-12 engine validation.
- After FE/BE approval, run a standards-conformant schema validator and Consumer/Provider tests in both pipelines.
- Capture the exact tested commit SHA, Windows/Node runtime, command, pass/fail and logs before claiming tests PASS.
- Do not equate static readback with Windows Node execution, actual Chrome MV3 operation, or production API integration.

## 6. M1 review / decision checklist

- [ ] CT-001: FE and BE owners agree on canonical target IDs, statuses and nullable counts.
- [ ] CT-002: Approval of scope fields and time-window semantics.
- [ ] CT-003: Approval of organization + plan authorization and public/private cache segmentation.
- [ ] CT-004: API path, request/response, security and idempotency versioning approved.
- [ ] CT-005: Golden fixtures and negative cases independently executed in FE and BE.
- [ ] CT-006: Policy gate before switching sourceType from STATIC_FIXTURE to APPROVED_PROVIDER.
- [ ] CT-007: Migration plan from legacy game-only draft without breaking demo behavior.

**Current gate: M1_CONTRACT_CANDIDATE_READY_FOR_REVIEW, not M1_PASS.**

## 7. External reference provenance

Architecture/EDA evidence ledger: [External adoption ledger](../../../docs/research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md), added by PR #18. EX-004 Chrome Side Panel, EX-005 CommentPulse queue/DVC, EX-006 VibeCheckAI job worker, EX-007 BERTopic, EX-008 Pandera and EX-011 YouTube official terms influenced **design considerations**, not copied code.

YOUTOPIA implementation provenance for this candidate consists solely of original in-repository JSON schemas, fixtures, and Node semantic checks. No external code was copied into these new files.
