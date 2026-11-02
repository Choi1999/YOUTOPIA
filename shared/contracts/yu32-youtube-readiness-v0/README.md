# YOUTOPIA — YouTube Source Readiness v0 (OFFLINE ONLY)

**DRAFT_CONTRACT / POLICY_HOLD / NO_LIVE_API / NO_RAW_COMMENTS / NOT_A_YOUTUBE_APPROVAL**

This package is a **pure Node/CommonJS planning helper** and a machine-readable *unverified* evidence inventory. It does not contain any API key, OAuth flow, URL request executor, database driver, live credential hook, browser trigger, or sentiment model. All outputs remain blocked regardless of input.

- `source-plan.cjs`: takes explicit canonical VIDEO IDs (1–3), checks 1–100 per proposed first page, order=time, textFormat=plainText, and refuses automatic replies/pagination/unknown policy or role override fields. Returns non-executable descriptors with `collectionAuthorized:false` and `networkRequestsPermitted:0`.
- `policy-gates.json`: 12 outstanding provider, privacy, security and first-call evidence requirements, **zero verified**. This file is **not** an operational policy engine.
- `tests/plan.test.cjs`: offline-only negative/safety tests; no YouTube, Docker, database or network calls.

The output is a **query shape candidate**, not a runnable HTTP request or an indication that a Google project has API rights. Google Cloud credentials and project permissions must be reviewed separately. Even if basic public comment reading is approved, additional NLP sentiment/derived metrics still require the 2026 amendment/appropriate application and approval evidence. Never infer commentThread sample completeness or enumerate replies silently.

Source and decision documents:
- [G4-5 live-source readiness](../../../docs/integration/YU32_G4_5_YOUTUBE_SOURCE_READINESS_V01.md)
- [G4-5 server-only collector execution/secret/egress architecture](../../../docs/integration/YU32_G4_5_SERVER_COLLECTOR_HOSTING_SECURITY_V01.md) (design only: Cloud Run Job / Secret Manager / static egress IP; no resources created)
- [G4-5 Cloud Run / Cloud NAT / fixed-IP cost scenarios](../../../docs/integration/YU32_G4_5_CLOUD_RUN_COST_ESTIMATE_V01.md) and `cloud-cost-model.v01.json` (estimate only, no spend approved).
- [G4-5 policy evidence matrix](../../../docs/integration/YU32_G4_5_PROVIDER_POLICY_EVIDENCE_MATRIX_V01.md)
- [G4-2 API authorization contract](../../../docs/integration/YU32_G4_2_API_AUTHORIZATION_CONTRACT_V01.md)

### Local offline check

~~~powershell
node --test shared/contracts/yu32-youtube-readiness-v0/tests/*.test.cjs
~~~

**Acceptance:** offline tests can only pass the proposed contract. Live YouTube calls, downloads, derived sentiment scores, and production configuration remain blocked until a separate owner approval and official policy/credential/retention evidence review.
