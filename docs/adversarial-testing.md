# Adversarial regression checks

Run the disposable backend checks with `python3 tools/test_services.py verify`.
For browser checks, install the locked frontend dependencies and Chromium as
described in [testing.md](testing.md), then use
`python3 tools/test_services.py verify --with-browser`.
The demo profile is separate: `cd frontend && pnpm exec playwright test
--config=playwright.config.ts`. Test services use synthetic accounts and data;
the runner removes runtime database bindings from its child processes.

The current regression suite covers these boundaries:

| Boundary | Saved evidence |
| --- | --- |
| Real password hashing, session rotation, logout, idle/absolute limits, account realm separation | `AuthenticationIntegrationTest`, `AccountPolicyTest`, packaged-JAR session runner |
| CSRF, protected user/admin routes, rejected paths, safe problem responses | `ApiSecurityTest`, `PublicObservationSecurityTest`, `ApiProblemsTest` |
| Duplicate JSON members, including nested settings, rejected before state changes | `AuthenticationIntegrationTest#duplicateJsonMembersAreRejectedBeforeSignupOrNestedSettingsChanges` |
| Native Steam IDs from 1 through 4294967295, rejected before budget/query or event persistence | `CcuServiceTest`, `ApiSecurityTest`, `EventContractTest`, `AuthenticationIntegrationTest#invalidProductEventIdsAreRejectedWithoutPersistingAnEvent` |
| Literal search quotes, SQL syntax, percent/underscore characters | `AuthenticationIntegrationTest#publicSearchTreatsInjectionSyntaxAndWildcardCharactersAsLiteralData` |
| Concurrent signups/admin logins/settings revisions/event retries; failed transactions and independent-store failures | `AuthenticationIntegrationTest` |
| Missing/duplicate slots, exact time boundaries, zero baselines, original rank positions and observed name changes | `ObservationAnalyticsTest`, `RankingAnalyticsTest`, chart integration cases |
| Video plot and comparison choose the same receipt/ID for repeated slots | `AuthenticationIntegrationTest#videoSeriesAndComparisonChooseTheSameLatestReceiptAndIdForDuplicateSlots` |
| Response-body timeout/cancellation, stale account settings responses, guest navigation and unavailable source states | `api.test.ts`, `ThemeSession.test.tsx`, `PublicAccess.test.tsx`, service browser profile |

JSON duplicate detection applies to the HTTP parser as well as nested JSON
objects. Invalid requests do not create an account or update settings. Rejected
firewall paths still return a problem response; malformed URI text and query
values are not copied into error details.

The native-video series now applies the same duplicate-slot rule as its
comparison: latest receipt, then greatest native observation ID. Period endpoints
remain inclusive. A single observed point retains its actual value and timestamp
while comparison growth remains unavailable. No missing points are synthesized.

The UI separates the source weekly end, query time and unassessed freshness.
Missing release dates stay missing. Ranking names retain their observed spelling;
they are not used as identity keys. Native video reads do not establish a
game/video relationship. No freshness threshold or acceleration policy is
inferred from successful tests.

These are isolated software checks. They do not establish production deployment,
data freshness, infrastructure readiness or legal approval. Production deployment
and destructive privacy features remain outside this verification scope.
