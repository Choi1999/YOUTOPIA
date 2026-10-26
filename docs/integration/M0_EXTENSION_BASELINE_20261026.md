# YOUTOPIA — M0 Extension Baseline & QA Evidence (2026-10-26 KST)

> **M0_SOURCE_BASELINE_PINNED / STATIC_PARSE_PASS / NATIVE_TEST_NOT_RUN / CHROMIUM_NOT_RUN / CHROME_MV3_E2E_NOT_RUN**
>
> Documentation-only evidence packet for Product HQ. It does not authorize live YouTube data collection, real sentiment analysis, authentication, billing, backend deployment or Chrome Web Store release.

## 1. Canonical audit references

| Surface | Exact reference | Meaning |
| --- | --- | --- |
| Repository | Choi1999/YOUTOPIA | Existing source repository |
| Chrome / React / shared baseline | frontend @ 9a50ad7ac9ed0bbf78d2512449c1a0daed5e0a3e | Pinned source for this M0 review |
| Git tree of frontend | 9a50ad7ac9ed0bbf78d2512449c1a0daed5e0a3e | 191 source files (excluding directories) |
| Default branch | dev @ 99e7b3857ae6e31460b2c8e2af48592d5bfbb90a | README-only; NOT the extension baseline |
| Remote backend branch | backend at README-only initial tree | No deployed backend inferred |
| YU-27 candidate | PR #15, feature/yutopia-27-worker-messaging @ 8ff1d9c6851d2627b7b3828ccaf2dc1f2a21c74d | Draft, open, unmerged |
| M0 prior audit | docs/integration/M0_FE_BE_BASELINE_AUDIT_20261021.md | Older timestamp; preserve original claims as historical evidence |

GitHub compare frontend...feature/yutopia-27-worker-messaging on 2026-10-26: DIVERGED, 16 commits ahead / 13 behind. Do not merge without reconciliation and QA.

## 2. Existing extension implementation at pinned frontend SHA

| Domain | Relevant sources | Audited status |
| --- | --- | --- |
| Chrome MV3 skeleton | extension/manifest.json, extension/background.js | IMPLEMENTED, synthetic demo |
| Home/search/SPA discovery | extension/content.js | IMPLEMENTED, live browser current-SHA retest required |
| VIDEO identity | extension/target-resolver.js | IMPLEMENTED; syntactic ID validation is not proof of existence |
| CHANNEL and unresolved @handle | extension/channel-target-resolver.js | IMPLEMENTED with safe unknown identity |
| Single active Hover and pointer lifecycle | extension/hover-controller.js | IMPLEMENTED; synthetic QA only at this point |
| Shadow hover UI | extension/hover-card.js, extension/hover-card-model.js | IMPLEMENTED using STATIC_FIXTURE, not real comments |
| Hover 'More' CTA | extension/hover-card.js | DISABLED in pinned frontend code |
| Selected-target Side Panel | extension/sidepanel.html, extension/sidepanel.js | PLACEHOLDER; no click-to-target handoff |
| Basic Side Panel Summary/Topics/Trends | extension/sidepanel.js | NOT_IMPLEMENTED |
| Server Auth and persistent saved videos | extension + backend | NOT_IMPLEMENTED |
| Game deep opt-in | Product HQ / design | NOT_IMPLEMENTED in extension |
| Live data, policy-cleared sentiment, payment | — | NOT_CONNECTED / NOT_AUTHORIZED |

The React frontend in frontend/ is an independent legacy synthetic NEXUS Season 2 demo, NOT the current Chrome runtime. shared/contracts/analysis-v1 contains a versioned draft consumer/provider schema with synthetic fixtures, NOT an implemented API.

## 3. YU-27 candidate scope and merge constraints

PR #15 adds a Service Worker synthetic request/response boundary, Content Script preview-client, runtime target/request validation and chrome.storage.session session cache; it expressly does NOT wire the Hover 'More' click or Side Panel target pinning.

Existing prior evidence:
- PR #15 Windows native Node: 177/177 PASS on previously tested SHA 73573b3f01b1e0f9376a29ecfa93e2aa70abb877.
- PR #15 offline Chromium Hover and Hover Card fixtures: 2/2 PASS on previously tested SHA 668d45ec160c8b8aab40f4dab8bf10e2d964dbb2.
- GitHub compare from those test SHAs to current PR #15 HEAD shows **documentation-only changes** in docs/product-v0.2/04_EXECUTION_00_99.md and extension/tests/QA_27_EVIDENCE.md.
- Current PR #15 HEAD remains DRAFT/OPEN. Installed Chrome MV3 Content ↔ Worker ↔ session cache end-to-end verification remains NOT_RUN.

Prior test logs are evidence of those executions and file comparisons; they are not a native Node/Chromium/Chrome run made during this 2026-10-26 M0 audit.

## 4. Fresh source checks executed on 2026-10-26

Connected GitHub fetched the original JavaScript and Manifest content at pinned references.

- frontend: 17/17 V8 parse/JSON assertions PASS across core source, unit test scripts and Manifest. Manifest was parsed twice in separate batches (16 unique files).
- YU-27 candidate: 5/5 V8 parse/JSON assertions PASS across its changed runtime/test sources and Manifest.
- Manifest version 3 and explicitly declared permissions [sidePanel, storage] confirmed. Host permission: https://www.youtube.com/*.
- Source checked without network API invocation and without modifying the repository.

**Scope disclaimer:** JavaScript was compiled for syntax (not executed as Node tests). No node:test assertions, browser DOM fixtures, service-worker lifecycle, or installed Chrome E2E ran. No GitHub CI checks were observed on either checked commit. Full M0 QA remains OPEN.

## 5. Recommended isolated Windows rerun instructions

Preserve the existing development workspace and any uncommitted work. Use a NEW temporary folder; do not reset or force checkout the user's current working tree.

### A. frontend pinned SHA (6 Node test files)

    git clone --branch frontend --single-branch https://github.com/Choi1999/YOUTOPIA.git YOUTOPIA-M0-FRONTEND
    Set-Location YOUTOPIA-M0-FRONTEND
    git checkout --detach 9a50ad7ac9ed0bbf78d2512449c1a0daed5e0a3e
    git rev-parse HEAD
    git status --short
    node --version
    node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs extension/tests/hover-controller.test.cjs extension/tests/hover-card-ui.test.cjs

Optional browser fixtures (Python Playwright/Chromium installed):

    python extension/tests/chromium-dom-fixture.py
    python extension/tests/chromium-spa-fixture.py
    python extension/tests/chromium-channel-fixture.py
    python extension/tests/chromium-hover-fixture.py
    python extension/tests/chromium-hover-card-fixture.py

Actual YouTube DOM checks are a separate network/browser/consent gate; offline fixture PASS is insufficient.

### B. PR #15 pinned SHA (adds YU-27 Node test)

Run in another NEW directory, not on a shared worktree:

    git clone --branch feature/yutopia-27-worker-messaging --single-branch https://github.com/Choi1999/YOUTOPIA.git YOUTOPIA-M0-YU27
    Set-Location YOUTOPIA-M0-YU27
    git checkout --detach 8ff1d9c6851d2627b7b3828ccaf2dc1f2a21c74d
    git rev-parse HEAD
    git status --short
    node --version
    node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs extension/tests/hover-controller.test.cjs extension/tests/hover-card-ui.test.cjs extension/tests/worker-message-cache.test.cjs
    python extension/tests/chromium-hover-fixture.py
    python extension/tests/chromium-hover-card-fixture.py

Use the same test environment or separately record Python and Chromium versions.

### C. Installed Chrome MV3 gate (not yet run)

Use a separate Chrome QA profile to load the unpacked extension/ directory. Log Chrome version, exact source SHA, clean worktree, extension ID, Worker errors and captured QA results.

- Home/search: repeat A Hover, A→B→C, A→Card→A, background B blocking, and safe dismissal.
- SPA DOM replace and duplicate-video-anchor guard.
- VIDEO/CHANNEL and @handle unresolved behavior; no invented target.
- YU-27 draft: Content→Service Worker message validation, requestId races, tab/document scope, chrome.storage.session HIT/MISS/expiry and restart.
- Keyboard access, Escape, Light/Dark, narrow viewport and YouTube native interactions.
- Confirm there is no live YouTube API, OAuth, billing, LLM, or real comment access during tests.

Record logs and tested SHA. A red test, missing log, or mismatched SHA is NOT_RUN / FIX_REQUIRED, not PASS.

## 6. M0 approval gates

| Gate | Evidence needed | Result at document creation |
| --- | --- | --- |
| M0-SRC | immutable frontend + PR #15 source reference | PASS |
| M0-SYN | static JS syntax / Manifest parse | PASS WITH LIMIT |
| M0-UNIT-FE | Native Node 6-suite results on pinned frontend commit | NOT_RUN |
| M0-UNIT-YU27 | Native Node 7-suite results on pinned YU-27 commit | NOT_RUN |
| M0-CHROMIUM | Offline Chromium fixtures at each target SHA | NOT_RUN |
| M0-MV3 | Installed Chrome content/worker test with logs | NOT_RUN |
| M0-REBASE | PR #15 reconcile with current frontend without regressions | NOT_RUN |
| M0-INTEGRATION | Product HQ requirement IDs ↔ code/QA/PR trace | PARTIAL |

**Final M0 status: SOURCE_BASELINE_PINNED / STATIC_EVIDENCE_PASS / EXECUTION_QA_PENDING.**

Do not mark M0 fully PASS. Do not merge PR #15 or proceed to real API integration solely on static or historical test evidence.

## 7. Product HQ integration handoff

Map Product HQ requirements to:
- EXT-21/22: content discovery, SPA; Chrome QA evidence per pinned SHA.
- EXT-23/24: target resolvers, unknown handle guard.
- EXT-25/26: Hover controller and Shadow card; synthetic, click pathway disabled.
- EXT-27: PR #15 draft message/session cache, not yet merged.
- EXT-28: More→target-pinned Side Panel, NOT_IMPLEMENTED.
- MVP-PC01: Summary/Topics/Trends tabs, NOT_IMPLEMENTED in extension.
- MVP-PC04: Guest→Auth→explicit save reconfirm, NOT_IMPLEMENTED in extension.
- G2-P0-01/02/04: external policy, sentiment quality and retention evidence unresolved.

Product HQ site, existing Figma/MagicPath source, production deployment, and live data remain unchanged by this audit.

## 8. References

- Repository: https://github.com/Choi1999/YOUTOPIA
- PR #13 merged Hover: https://github.com/Choi1999/YOUTOPIA/pull/13
- PR #15 unmerged YU-27: https://github.com/Choi1999/YOUTOPIA/pull/15
- PR #33 unmerged UX docs: https://github.com/Choi1999/YOUTOPIA/pull/33
- Existing M0 FE/BE audit: docs/integration/M0_FE_BE_BASELINE_AUDIT_20261021.md
- Shared analysis contract candidate: shared/contracts/analysis-v1/README.md
