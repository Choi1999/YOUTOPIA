# Youtopia backend

Java 21, Spring Boot 4.0.9, Gradle Wrapper 8.14.3, PostgreSQL 16 and Redis sessions.
Jackson 2 uses Spring Boot's compatibility module to preserve the JSON contract.

Spring Boot and Gradle functional tests do not require Python. The two scripts under tools/ are optional dependency and external-process checks; no Python or operational migration SQL is packaged in the JAR.

The React frontend uses same-origin service APIs. Its preserved historical prototype has an explicit /demo entry. Production requires same-origin HTTPS and configured external services. Browser E2E uses disposable local data; run the opt-in tools/verify_packaged_sessions.py --with-browser after preparing isolated fixtures.

```sh
./gradlew test bootJar
./gradlew integrationTest
python3 tools/check_dependencies.py
python3 tools/verify_packaged_sessions.py
```

`test` runs domain and MVC security tests. `integrationTest` requires disposable
PostgreSQL 16 at loopback port 25432 and Redis at loopback port 26379, with prepared
synthetic fixtures, databases (`youtopia_test`, `youtopia_auth_test`,
`youtopia_control_test`, `youtopia_operator_audit_20261030`) and restricted test logins. Restore tests also require
Docker access to the isolated `youtopia-bootstrap-pg` container. They execute an
actual backup and restore of fake data. Tests never read production DB variables;
missing dependencies fail the integration task. The separate dependency check
queries OSV using public Maven coordinates and reports unavailable checks explicitly.
It does not scan a deployment image or the JDK.

The application never initializes or migrates database objects at startup. Supply
credentials separately from JDBC URLs. Every runtime pool must use a restricted
login with no schema ownership, object ownership or schema CREATE privileges. Operational
SQL and provisioning are managed outside this repository.

With `YOUTOPIA_ENVIRONMENT=PRODUCTION`, startup also verifies each pool's actual
login and database against its assigned role. Swapping two restricted credentials
fails startup. Service pools use `youtopia`; the control pool requires a separately
provisioned, explicitly configured database and rejects service/system/template
databases. `SET ROLE` cannot substitute for the actual login.

Core environment variables:

| Variables | Purpose |
|---|---|
| `YOUTOPIA_DATA_JDBC_URL`, `YOUTOPIA_DATA_DB_USER`, `YOUTOPIA_DATA_DB_PASSWORD` | Dedicated source reader |
| `YOUTOPIA_SESSION_REDIS_HOST`, `YOUTOPIA_SESSION_REDIS_PORT` | External session store |
| `YOUTOPIA_SESSION_REDIS_USERNAME`, `YOUTOPIA_SESSION_REDIS_PASSWORD`, `YOUTOPIA_SESSION_REDIS_TLS` | Redis authentication; TLS defaults to true |
| `YOUTOPIA_ENVIRONMENT` | Explicit LOCAL/STAGING/PRODUCTION provenance for events and reports |
| `YOUTOPIA_ACCOUNTS_ENABLED` | Enable account APIs after provisioning and control setup; defaults to false |
| `YOUTOPIA_ACCOUNT_HMAC_KEY`, `YOUTOPIA_PASSWORD_BLOCKLIST` | Secret key and local SHA-256 compromised-password list |
| `YOUTOPIA_{MEMBER,ADMIN,AUDIT}_JDBC_URL`, corresponding `_DB_USER`, `_DB_PASSWORD` | Separate member, administrator authentication and append-only audit pools |
| `YOUTOPIA_{DIRECTORY,EVENT,REPORT}_JDBC_URL`, corresponding `_DB_USER`, `_DB_PASSWORD` | Separate masked directory, event writer and aggregate reader pools |
| `YOUTOPIA_DIRECTORY_ENABLED`, `YOUTOPIA_EVENTS_ENABLED`, `YOUTOPIA_REPORTING_ENABLED` | Optional account-dependent modules, all disabled by default |
| `YOUTOPIA_ACTIVE_SESSION_WINDOW_SECONDS` | Server-only activity window, default 300 seconds |
| `YOUTOPIA_CONTROL_ENABLED`, `YOUTOPIA_CONTROL_SERVICE_KEY`, `YOUTOPIA_CONTROL_HMAC_KEY` | Mandatory restoration fence and deletion journal when accounts are enabled |
| `YOUTOPIA_CONTROL_JDBC_URL`, `YOUTOPIA_CONTROL_DB_USER`, `YOUTOPIA_CONTROL_DB_PASSWORD` | Append-only control login; must not reopen service fences |
| `YOUTOPIA_GAMES_ENABLED` | Enable game and observation chart APIs after approved source projections and privileges exist; default false |
| `YOUTOPIA_QUERY_ASSOCIATIONS_ENABLED` | Optional query-based game/video association counts; default false, requires separate mapping review |

Production cookies require HTTPS and use HttpOnly, Secure and SameSite=Lax.
State-changing APIs require a session-bound CSRF token, including signup and login.
`GET /api/v1/auth/csrf` returns the token and header name; responses are not cached.
Password hashes use versioned, randomly salted PBKDF2-HMAC-SHA256 with 600,000 iterations;
unknown formats have no plaintext fallback. User and administrator sessions are separate. User idle/absolute limits are
60 minutes/24 hours; administrator limits are 15 minutes/8 hours. Passive polling
does not extend the application idle clock. Explicit user interaction uses the
activity endpoint. Redis stores the authenticated session across instances.

Implemented API groups (account modules require their configuration):

- `/api/v1/auth`: signup, login, me, activity, logout, password change, recovery codes,
  password reset and account recovery.
- `/api/v1/admin/auth`: separate administrator login, me and password change.
  Both realms use the authenticated `/api/v1/auth/activity` and `/api/v1/auth/logout` endpoints.
- `GET /api/v1/me/account`: authenticated member profile.
- `GET/PATCH /api/v1/me/settings`: own effective settings; only `theme` is supported.
- `POST /api/v1/me/deletion`: explicit account deletion request, disabled until
  retention approval and independent deletion control are configured.
- `GET /api/v1/admin/members`, `/api/v1/admin/members/{id}`: masked, read-only directory.
- `POST /api/v1/events`: validated, pseudonymous product events with idempotent client IDs.
- `GET /api/v1/admin/usage`: aggregate reports, including recent activity sessions.
- `GET /api/v1/steam/apps/{appId}/ccu?days=7`: canonical Steam observations for 7 or 30 days.
- `GET /api/v1/games`: public, paged game catalog with literal name search and allowlisted filters/sorts.
- `GET /api/v1/games/steam:{appId}`: native Steam identity, observed summary and a 30-day CCU preview.
- `POST /api/v1/games/search`: explicit search; optional analytics proof follows a successful query. It does not automatically record an event.
- `GET /api/v1/charts/steam/rankings`: explicit source/category and weekly offset timestamps; eight rank comparisons preserve original positions.
- `GET /api/v1/charts/steam/ranking-periods`: bounded source/category and completed periods observed in the approved projection; the UI does not invent a weekly calendar.
- `GET /api/v1/charts/steam/ccu?appIds=570,730&days=7`: latest two observations and exact 24-hour comparisons for explicit native IDs.
- `GET /api/v1/charts/steam/app-types`: distinct active CCU targets, separating unknown types.
- `GET /api/v1/youtube/videos/{videoId}/observations?days=7`: native-video cumulative observations without inferred game relevance.
- `GET /api/v1/charts/youtube/query-associations?appIds=570&days=7`: optional query provenance and comparable-video counts; relevance is unassessed and acceleration remains unavailable.

Approved game list/search/detail, Steam charts and native video observation reads
are public. Search POST still requires a session-bound CSRF token; a visitor can
obtain one without logging in. Public queries retain the shared Redis request
budget and bounded inputs. Personal settings/account APIs require a USER session,
and administrator APIs require an ADMIN session. Optional query-based video/game
associations remain disabled pending their separate review and are not added to
the public allowlist. Unknown writes remain denied.
Pagination responses use `content` and `page`. The catalog includes eligible named
Steam game candidates. Unsupported metrics remain unavailable rather than zero.
Rank comparisons use the latest complete whole run per source/category/country/period;
missing prior periods are excluded. A null country is labelled `UNSPECIFIED`.
Chart responses expose a calculation version, observation scope and comparison basis.
Collector canonical views choose their own representatives; defensive duplicate handling
inside this application does not override their raw-data selection policy.
These contracts have isolated synthetic-data and real-browser coverage. Production
source quality, permissions, freshness thresholds and deployed acceptance require
separate validation.

Settings return `{ "version": 0, "values": { "theme": "system" } }` when no row
exists. PATCH uses `{ "expectedVersion": 0, "changes": { "theme": "dark" } }`.
Allowed values are `system`, `light`, `dark`; omitted keys retain their value.
Unknown keys, nulls, nonstrings and unsupported values reject the entire request.
A stale revision returns 409. Settings cannot modify security or account fields.

Recent activity sessions are distinct analytics sessions whose last recorded
activity is greater than server time minus the configured window and no later
than server time. The default label is “최근 5분 활동 세션”. These are neither a
connected-person count nor a logged-in-user count. Administrator polling emits no
visitor activity. Reports label retained-event history and signup coverage explicitly.

The CCU API uses Steam app IDs rather than an unverified service game mapping.
Times are UTC. If an input canonical view unexpectedly repeats scheduled slots,
the adapter chooses the latest observed time, then observation ID; future observations are excluded. The 24-hour peak uses actual
observations without interpolation. Real zero remains zero; an empty series does
not prove a game is absent. Freshness remains `UNASSESSED` until a source-specific
threshold is configured; review data is `UNAVAILABLE`. Source errors return 503.
Queries are bounded and an oversized series fails rather than being truncated.

Errors use `application/problem+json` with `code`, server-generated `traceId` and
`fieldErrors`. Unknown or repeated query parameters return 400. Pagination uses
zero-based pages, size 20 by default, maximum 100. Public CCU reads use a Redis
request budget, default 120/minute, configurable with
`YOUTOPIA_CCU_REQUESTS_PER_MINUTE`. Limits return 429 with Retry-After; budget-store
failure returns 503. Other account and event operations have bounded budgets.

Destructive privacy maintenance is an explicit operator process, disabled by
default. An independent journal records deletion intent and outcome; unresolved
operations, unavailable control storage or an unverified restore keep service
access blocked. Restore operator credentials must remain separate from web pools.
A restore requires replay, verification and an explicit reopen operation. Tests
of this mechanism do not establish production recovery or retention approval.
