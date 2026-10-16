# YOUTOPIA frontend

React + TypeScript + Vite frontend for the YUTOPIA P0-1 application foundation
and preserved login demo.

The repository name remains **YOUTOPIA**. The displayed product brand is
**YUTOPIA**.

## Tested environment

- Node.js `24.18.0`
- pnpm `12.9.1` (declared in `package.json`)
- Windows 11 / PowerShell

Dependency verification:

```bash
corepack pnpm install --frozen-lockfile
```

## Run locally

From this directory:

```bash
corepack pnpm install
corepack pnpm dev
```

## Demo login

- Email: `demo@youtopia.app`
- Password: `Youtopia123!`

Demo sign-up and password reset work only in the current page session. They do
not create server accounts or verify email ownership. Google OAuth and SSO need
an authentication server.

```bash
corepack pnpm build
```

## Tests

```bash
corepack pnpm test
```

Vitest runs the login characterization, P0-1 router/theme tests, the local
YU-02/YU-03 consent state simulation, and YU-04/YU-05 form/state-model tests in
jsdom.
This is **SIMULATED** browser-DOM evidence. It does not execute a real browser,
OAuth, YouTube API, backend, inference, MCP, or LLM integration, and must not be
reported as browser E2E evidence.

Install the Playwright Chromium runtime once, then run the local browser suite:

```bash
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

The Playwright suite is **LOCAL BROWSER E2E** evidence for the frontend only. It
blocks and records requests matching real OAuth, YouTube API, MCP, and LLM
endpoints. It is not production integration evidence.

YU-02 and YU-03 store their simulated consent state only in React memory. A
refresh or direct entry cannot restore approval, and no credentials or access
tokens are created or persisted.

YU-04 creates only the fixed `nexus-season-2` demonstration project in React
memory. YU-05 advances deterministic `QUEUED`, `RUNNING`, `PARTIAL`, `FAILED`,
and `SUCCEEDED` states without external requests. Refreshing or directly
opening the collection URL clears this in-memory context and never fabricates a
successful collection. All counts, timestamps, exclusions, and retry behavior
are **DEMO / SIMULATED**, not production integration evidence.

YU-06 reads that same in-memory collection contract and shows explicit loading,
empty, partial, failed, stale, unavailable, and success states. YU-07 uses one
shared NEXUS Season 2 fixture for sentiment counts, multi-label issue candidates,
and synthetic representative comments. `PERF-001` is only an observed complaint
candidate and `PAY-002` remains `HOLD`; neither screen performs real inference or
establishes a game defect. Direct entry or refresh never recreates successful
dashboard or analysis data.

YU-08 derives its 14-day before (`2025-03-11`–`2025-03-24`), 14-day after
(`2025-03-25`–`2025-04-07`), and 11-day outside-window totals directly from the
same 39-day fixture. The fixture is `CONDITIONAL` because the selected videos
have different publication dates and comparison cohorts; observed count
changes are not a verified increase, patch effect, popularity, revenue, or
market-wide conclusion.

YU-09 reuses the YU-07 issue identifiers and the YU-08 comparability decision.
Its evidence rows are synthetic demo records with explicit source IDs,
timestamps, availability, lineage, and reason codes. `PERF-001` can describe
observed complaint language only and never confirms a game defect. `PAY-002`
stays `HOLD` and cannot become an approved increase claim. Reviewer actions are
local simulations and no evidence review is persisted to a server. YU-10
consumes these records only through the same in-memory demo contract.

YU-10 exposes deterministic `AVAILABLE`, `MISSING`, `DELETED`, `EXPIRED`,
`STALE`, and `ACCESS_DENIED` evidence-display states. Every displayed comment is
still marked synthetic, and source ID, observation/retrieval timestamps,
coverage, lineage, and policy status remain visible only within the shared demo
contract. Availability never turns synthetic evidence into real verification.

YU-11 is an in-memory Kanban simulation over the same YU-07 issue identifiers
and YU-09/YU-10 evidence IDs. Its shared transition model enforces assignment,
waiting, in-progress, completed, rejected, and permission states and records a
deterministic simulated audit timeline. `PAY-002` cannot move to completed while
its claim is `HOLD`. Reviewer actions are explicitly unauthenticated demo
actions, not human approval or server audit records. YU-12 remains
an in-memory local simulation and does not consume Kanban completion as a
verified claim.

YU-12 presents the Figma-aligned three-column AI workspace, masked evidence and
prompt preview, and report draft preview. Only the internal browser-local demo
path runs; ChatGPT, Claude, MCP, exports, downloads, and link sharing are
unavailable or policy-blocked. Its `AllowedEvidenceBundle` preserves the shared
source IDs, observation and comparison windows, denominators, coverage, and
`CONDITIONAL` decision. Synthetic comment text is excluded from the prompt,
`PERF-001` remains an observation candidate, and `PAY-002` remains `HOLD` and is
excluded from conclusions. The report is always **DEMO / SIMULATED**, never
formally approved, shareable, exportable, server-persisted, or production
integration evidence. A refresh removes the in-memory project and draft.

Cycle 9 moves the YU-11 issue workflow into a shared in-memory provider so its
task status can be disclosed in YU-12 while navigating. This does not promote a
completed task to verified evidence or formal report approval. Starting a new
project, resetting the project, refreshing the page, or opening a fresh browser
session resets the shared review state.

The current full local regression baseline is 92 Vitest tests and 40 Chromium
Playwright tests. The browser suite covers all twelve screens in Dark and Light,
checks WCAG 2.0/2.1 A/AA axe rules, captures 24 1600×900 QA screenshots, and
checks responsive layouts at 1024, 1280, 1440, and 1600 pixels. This remains
frontend simulation and local-browser evidence; no production integration has
been executed.
