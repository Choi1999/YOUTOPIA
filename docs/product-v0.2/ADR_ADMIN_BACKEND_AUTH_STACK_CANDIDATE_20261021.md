# ADR-CANDIDATE — YOUTOPIA Backend/Platform Admin Authentication Architecture

> 2026-10-21 KST · **PROPOSED / UNAPPROVED TECHNICAL STACK / NO CODE IMPLEMENTED / FE_BE_SECURITY_SIGNOFF_PENDING**
>
> This is a technical decision proposal after the user approved the **two-view Admin web product structure** and merged [PR #30](https://github.com/Choi1999/YOUTOPIA/pull/30). Approval of a **product UI structure or a draft contract is NOT independent security approval** of an Identity Provider, server sessions, storage stack, deployment environment, or YouTube data rights.
>
> Existing baseline: [Admin v1 Contract Candidate](../../shared/contracts/admin-v1/README.md), [Figma Admin FE/BE Method](../product-v0.2/ADMIN_M9_TWO_VIEW_FE_BE_METHOD_20261021.md), [Security Policy Contract](../backend-handoff/05_SECURITY_POLICY_CONTRACT.md), [Analysis Contract v1](../../shared/contracts/analysis-v1/README.md). Remote `backend` branch was only Initial README at last verified audit; no deployed service or operational database was confirmed.

## 1. Decision scope

Decide what is technically **sufficient for M9 PRODUCT_INTEGRATED**: read-only Admin Operations + Policy/Audit, reliable Job state/quality provenance, server-enforced role and source-rights gates, test evidence, and the existing customer Chrome extension. **Do not** implicitly add real payment/refund operations, Chrome Web Store release, full-featured internal QA console, customer support ticketing, or a production YouTube data collection right.

## 2. Backend stack comparison (candidate, not locked)

| Option | What it buys | Risks / conditions | Current evaluation |
|---|---|---|---|
| **A. Python FastAPI + PostgreSQL + separate durable Job worker (recommended exploration)** | HTTP schema validation, useful proximity to Python EDA/NLP; transactions, audit/event retention and tenant-aware data handling; worker can be independently restarted | Must own schema migration, job leases/retries/idempotency, server RBAC, data-rights checks; avoid treating in-process FastAPI BackgroundTasks as durable long-running worker | **RECOMMEND_FOR_FE_BE_PROTOTYPE_ONLY**, pending load measurements and staffing |
| B. TypeScript NestJS + PostgreSQL + job worker | TypeScript sharing affinity with existing React frontend and common web tooling; typed server consumers | Python analysis/EDA still requires an isolated runtime/API or language bridge, increasing workflow contract surface | Viable alternative if BE team maintains Node more effectively |
| C. Temporal/Prefect from day one | Durable orchestration UI and retries/task histories (subject to edition and deployment) | Adds operations/service security, cost, versioning, retention complexity before actual Job volume known | **DEFER_ENGINE_SELECTION** until Job latency, crash/retry and concurrency thresholds measured |
| D. Serverless functions only, no durable worker | Small deployment surface for fast request/response APIs | Nontrivial Python classification, quotas and long-running analysis/job audit are awkward without durable state | Not a complete M9 backend on their own |

**Proposed initial minimum:** PostgreSQL or equivalent durable transactional persistence for Run/Event/Policy/Audit + separately restartable worker process. A DB-backed Job table and lease/idempotency strategy can be evaluated before adding Redis/Celery/Temporal/Prefect. No architecture choice eliminates the need for authoritative server scopes, policy decisions and observability.

**Official documentation support:** [FastAPI Background Tasks caveat](https://fastapi.tiangolo.com/tutorial/background-tasks/) explicitly distinguishes small in-process background work from heavier tasks needing tools such as Celery. [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) can enforce row-level checks, subject to owner/BYPASSRLS and configuration caveats; it is defense-in-depth, not a substitute for API authorization.

## 3. Authentication and session architecture (candidate; provider not chosen)

| Decision element | Recommended gate | Not yet chosen |
|---|---|---|
| Identity protocol | **OIDC-conformant** provider or standard implementation; secure server-side code/token validation, issuer/audience/nonce/state handling | Actual IdP/vendor, self-hosted vs SaaS, MFA mechanisms, regional/data-processing terms |
| Customer Web vs Admin Web | Customer/organization use shared **customer** authentication; Platform Admin enters a segregated WEB app, DEV/QA fixture env separate | Exact hostnames, session storage technology, cross-service SSO/step-up |
| Server session | Prefer server-managed, short-lived, revocable session in **Secure + HttpOnly + explicitly scoped SameSite** cookie for web application; consider BFF if browser tokens otherwise exposed | Strict/Lax choice depends on legitimate login redirects, CSRF and cross-origin topology; never handwave |
| Authorization | Every privileged API request performs server-side principal + scoped resource + role checks. Deny by default | Permission registry, organization membership source, Admin recovery procedure |
| Admin risk level | Enforce stronger admin MFA/step-up/re-auth for high-risk actions, provide audit trail | Required factor and session lifetime require Security ADR |
| CSRF / session fixation | Explicit CSRF/origin protections, session rotation after sign-in/elevation, logout revocation and no sensitive tokens in localStorage | Implementation library and cookie / API design |
| QA surface | Isolated fixture execution identity; test-run artifacts carry tested SHA, environment and provenance | Whether a read-only QA evidence viewer is needed by actual reviewers |

A single IdP may serve more than one product surface **if sessions and server permissions are properly isolated**; different screens alone are not authorization. The Admin login must not appear in the customer Chrome extension. The Chrome customer login↔web auth return must be threat-modeled separately (ReturnIntent revision, anti-replay, safe origin/redirect and target pinning).

**Primary sources:** [OpenID Connect overview](https://openid.net/developers/how-connect-works/), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## 4. Required decision records (must be approved independently)

| Decision ID | What to decide | Evidence required | Current state |
|---|---|---|---|
| BE-ADR-01 | Python FastAPI vs TypeScript server, with worker separation | Team support, Linux/Windows deployment, EDA data pipeline prototype, load/restart POC | **CANDIDATE** |
| BE-ADR-02 | PostgreSQL / transactional DB and tenant/policy model | Schema/migrations, tenant BOLA/owner bypass threat model, backup/restore, deleted-data tests | **CANDIDATE** |
| BE-ADR-03 | Job scheduling and retries: DB lease vs queue orchestrator | Idempotency, crash-restart, duplicate claim, quota, recovery metrics | **CANDIDATE** |
| SEC-ADR-01 | OIDC IdP and account lifecycle | Provider options, cost, password/MFA/recovery, privacy and regions | **DECISION_REQUIRED** |
| SEC-ADR-02 | Admin session/cookie/CSRF/step-up | Same-site topology, revocation, response cache, cookie boundaries, intrusion tests | **DECISION_REQUIRED** |
| SEC-ADR-03 | Internal policy engine and auditing | Approval evidence integrity, actor/resource/action scope, log minimization, retention | **DECISION_REQUIRED** |
| DATA-ADR-01 | YouTube data and derived-metric use rights | Current official terms, application/consent/approval proof, storage/deletion/refresh scope | **POLICY_HOLD** |

No role, authorization scheme, queue product or cloud vendor is implicitly approved merely because it appears in this ADR.

## 5. Tracer-bullet implementation plan after the above reviews

1. **Contract gate:** Run actual Native Node + standards-conformant Draft 2020-12 validation over the already merged `shared/contracts/admin-v1` SHA; obtain FE consumer and BE provider independent review before selecting final API paths. Candidate source means **not a deployed implementation**.
2. **BE isolated synthetic prototype:** In a new, separately approved backend branch, run one synthetic Job through QUEUED → RUNNING → FAILED, persist events, re-open after process restart, and prove same runId/idempotency and sample arithmetic.
3. **Read-only two-view FE:** Customer/Admin origin separation. OpsStatus empty/null state; Job list/detail & PolicyOverview/AuditEvent only from scoped provider; never show fabricated values.
4. **Security tests:** customer, Org Admin, Platform Admin, QA and expired sessions; 401/403/404 safe behavior; multi-tenant ID swaps, token replay, CSRF and cache invalidation; no secrets/raw comments in artifacts.
5. **Observability & QA:** tested source SHAs/fixture hashes, source timestamps, Trace viewer/logs, run replay. These should be visible in existing test tools before building a new QA web.
6. **M9 evidence:** same approved FE/BE/shared contract revision, actual authorized provider behavior and independent E2E proof. Publication/payment activation separate.

## 6. What's verified versus proposed

**VERIFIED:** the frontend branch contained only synthetic Admin schema/tests after PR #30 merged; PR #29 Figma Admin Light/Dark 4 views exist with static navigation and token checks. The remote backend was Initial README at prior audit. Independent V8 assertions and partial schema validation **do not constitute real Native Node, FE/BE or server auth PASS**.

**PROPOSED:** FastAPI/PostgreSQL, session cookie/BFF, OIDC provider, separate worker and job storage. They are recommendations pending FE/BE/SEC signoff, not installed services.  Actual Figma Present mouse/keyboard/zoom and server/Chrome runtime integration remain **NOT_RUN**.

**Next approval gate:** BE-ADR-01/02/03 and SEC-ADR-01/02 require separate technical decision and threat model, including objective comparison of at least one alternative. This ADR is intentionally non-operative.
