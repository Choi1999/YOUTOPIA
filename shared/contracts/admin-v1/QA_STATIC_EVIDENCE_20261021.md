# YOUTOPIA Admin v1 candidate — static review evidence

> 2026-10-21 KST · **CANDIDATE_SHAPES_RETRIEVED / PARTIAL_JSON_SCHEMA_STATIC_CHECK / NODE_TEST_NOT_RUN**
>
> This is source inspection, not a deployed API, backend authorization check, complete JSON Schema validator, or Node execution log.

## Baseline

- Repository: Choi1999/YOUTOPIA
- Branch: feature/admin-v1-contract-candidate-20261021, based on frontend merge SHA daa893aae536bf31ea40abbce446d15be28e5745 (PR #29).
- Design source: Figma Admin minimum 2-view (82-03~06) and QA decision 83-03.
- Reviewed document: [Admin 2-view FE/BE method](../../../docs/product-v0.2/ADMIN_M9_TWO_VIEW_FE_BE_METHOD_20261021.md).
- Candidate package directory: shared/contracts/admin-v1.

## Actual source blob references

| File | Git blob SHA |
|---|---|
| admin.schema.json | 74f25db44821b4083eb65d83deeff26e03608abc |
| fixtures/ops-unconnected.json | 088bd55938cd75f8686df9e113e2bf25a3830db9 |
| fixtures/policy-unknown.json | 838754e71a4dc96158fe2164d63ad987c0f1e71a |
| fixtures/job-failed.synthetic.json | 51696dc84a1133fdaae1c0cf0ca47f5db7923eb5 |
| fixtures/policy-denied.synthetic.json | 8499c6e0a6225460effbd1775865b6df7d3f029c |
| fixtures/audit-denied.synthetic.json | 0af213861fbe011cbb13e0c28b0b4039c72802e5 |
| fixtures/error-forbidden.synthetic.json | bf5ba899ca17ee80f199434e9805c2ece30f1a19 |
| tests/semantic-smoke.test.cjs | dd58a57a083fd6def086b9e6c43b613221de3584 |
| README.md | 176e0a27370f1f8de8b9e619d8170fa2198d4a23 |

## Independent current-turn static checks

The candidate schema and all fixtures were fetched back from GitHub and JSON-parsed. A separate minimal V8 rule evaluator was used to check supported Draft 2020-12 features: type, const, enum, required, additionalProperties, string length, date-time parse, numeric lower bound, $ref, allOf, if/then, anyOf, and oneOf. This is a **subset validator**, not a standards-compliant complete implementation.

| Check | Count | Result |
|---|---:|---|
| Schema definitions and internal references resolve | 11 definitions / 11 unique references | PARTIAL STATIC PASS |
| Positive synthetic fixture payloads | 6 | 6/6 accepted |
| Negative mutation: disconnected metrics falsified as 0 | 1 | Rejected |
| Negative mutation: unknown policy marked APPROVED without evidence | 1 | Rejected |
| Negative mutation: tenant-private Job tenantId null | 1 | Rejected |
| Negative mutation: unexpected secret property on Job | 1 | Rejected |
| Negative mutation: sourceType STATIC_FIXTURE vs isSynthetic=false | 1 | Rejected |
| Negative mutation: ErrorEnvelope HTTP status 200 | 1 | Rejected |
| Failure fixture data coverage arithmetic | raw=eligible+excluded, eligible=classified+unclassified | 2/2 equations true |
| Node built-in semantic smoke tests | 7 declared tests | **NOT_RUN** |
| Full Draft 2020-12 validator and negative fixtures | pending | **NOT_RUN** |
| FE consumer / BE provider / installed Chrome / real auth | absent | **NOT_IMPLEMENTED / NOT_RUN** |

The V8 partial validator does not establish full JSON Schema engine conformance. The source files were created without installing additional packages or contacting YouTube or any other live data provider.

## Unresolved security and implementation decisions

- Admin session/identity/step-up/MFA, cookie or bearer token, CSRF and origin rules; platform role vs tenant principal access.
- BE framework, Job persistence/Worker/DB, audit event retention/redaction and tracing.
- API endpoint path/version, pagination, time limits, anonymization and data lifecycle.
- YouTube usage rights and derived metric approval. An UNKNOWN policy remains denied for the live source; a synthetic record does not create rights.
- Runtime must independently reject Email/OAuth tokens in audit fields, cross-tenant Job access, false positive authorizations, and forged request-side roles. Source JSON Schema does not replace server policy enforcement.
- After FE/BE approval use the same schema commit SHA and standard validator in FE/BE pipelines, separately record Node test and real integration evidence.

**Current gate:** ADMIN_CONTRACT_CANDIDATE_PREPARED / INDEPENDENT_STATIC_CHECK_COMPLETED / FE_BE_SIGNOFF_PENDING / BACKEND_NOT_IMPLEMENTED / NODE_TEST_NOT_RUN.
