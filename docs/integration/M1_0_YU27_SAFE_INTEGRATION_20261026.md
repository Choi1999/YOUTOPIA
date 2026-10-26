# YOUTOPIA M1-0 — YU-27 Safe Integration Candidate (2026-10-26 KST)

> **INTEGRATION_CODE_AUDITED / CANDIDATE_NODE_177_PASS / CANDIDATE_CHROMIUM_5_PASS / MV3_USER_REPORTED_NO_ISSUES / DETAILED_MV3_EVIDENCE_PENDING / PR15_UNMERGED / MERGE_NOT_APPROVED / LIVE_DATA_BLOCKED**
>
> This is an isolated integration candidate, not a merge approval, release, Product HQ update, or implementation of YU-28 More→Side Panel handoff.

## 1. Immutable source references

| Role | Commit | State |
| --- | --- | --- |
| Source baseline | `frontend@9a50ad7ac9ed0bbf78d2512449c1a0daed5e0a3e` | Current target, untouched |
| Old merge base | `d7f271b5afa1fc6b0bf31c000da6aa73611a6dc0` | Common ancestor |
| YU-27 source | `feature/yutopia-27-worker-messaging@8ff1d9c6851d2627b7b3828ccaf2dc1f2a21c74d` | PR #15 DRAFT / OPEN / unmerged |
| Integration candidate | `feature/youtopia-m1-0-yu27-integration-20261026@7d8265e4f76785b1b4d863954cf7830a47c613d6` | Exact commit used for Windows Node and Chromium QA; subsequent documentation-only commits must keep extension tree unchanged |

Compare at creation: PR #15 **16 ahead / 13 behind** latest `frontend`. Both changed `docs/product-v0.2/04_EXECUTION_00_99.md`, but **no changed paths under `extension/` on the frontend side** since the common ancestor. That is a file-path conflict analysis, not a runtime QA result.

## 2. Exact source integration scope

Seven `extension/` paths are copied by original Git blob SHA from the pinned PR #15 HEAD, without code rewriting, API wiring or new permissions:

| Git path | YU-27 original Git blob SHA |
| --- | --- |
| `extension/background.js` | `4f27b3679564902f95c5c4a9c818dac24f5f56bb` |
| `extension/manifest.json` | `c53acab72cfca3ec1639ed32626b00839c3552cc` |
| `extension/preview-client.js` | `b7c043eba3632fd2babeccabedd9fee02eba0ad8` |
| `extension/shared.js` | `9f1a370b0b74b2f9bb67ddbd9ddee0f2b1c540d1` |
| `extension/tests/QA_27_EVIDENCE.md` | `f7551c46199f542547a8a6deb52cc7cc0ead7e67` |
| `extension/tests/hover-card-ui.test.cjs` | `95a49df0fad994c5f3fc381e9fa9297771f68f2a` |
| `extension/tests/worker-message-cache.test.cjs` | `f300ca5855db0314ab68cd3f9a6a032aeddc52ea` |

The `frontend` changes since the merge base were largely Product / Figma / data contract documentation, including changes to the 00–99 ledger. The candidate **preserves the latest frontend ledger**, changes only its YU-27 row and appends a dated integration-candidate event, instead of overwriting those 13 frontend commits' other changes. This audit file is newly added.

Manifest stays MV3 with permissions `sidePanel` and `storage`, and YouTube-only host permission `https://www.youtube.com/*`. Script loading order:
`shared.js → target-resolver.js → channel-target-resolver.js → content.js → hover-controller.js → preview-client.js → hover-card-model.js → hover-card.js`.

YU-27 remains a **STATIC_FIXTURE-only** Worker message boundary, validating VIDEO/CHANNEL, requestId, tab/document/sender scope, stale request, and `chrome.storage.session` cache. The Hover 'More' CTA remains disabled, Side Panel remains a placeholder, no real YouTube/Steam API, authentication, billing, server persistence or user comments are processed.

## 3. Confirmed M1-0 Windows QA and evidence limits

Windows test run at **2026-10-26 16:24:23 KST** targeted the exact **integration candidate code commit** `7d8265e4f76785b1b4d863954cf7830a47c613d6`. Uploaded `M1_0_RESULTS_ONLY.zip` was independently examined in ChatGPT: original Node TAP and each Chromium fixture exit code/PASS marker, JSON summary, archive CRC, and **11/11 SHA-256 manifest checks** were consistent. SHA-256 of submitted evidence ZIP: `a2c7627ebebaab7ab9b87352d66ff26f1909117dcd4fc437f26e6b0094d5edaa`.

| Gate | Evidence | M1-0 verdict |
| --- | --- | --- |
| Source / source equivalence | GitHub readback: original PR #15 and integration candidate share **whole `extension/` Git tree `07cbc21faddb296c9a2313430a3866adf74aa3d7`**; exact tested HEAD; source clean reported | **PASS** |
| M0 baseline `frontend` | Prior native Node `160/160 PASS` on `9a50ad7...`; five offline Chromium fixtures PASS | **M0 HISTORICAL PASS**, separate SHA |
| M1-0 official Node | Native Node 24.18.0, `node --test --test-reporter=tap`, **177/177 PASS, fail=0 skip=0 cancel=0, exit=0** on `7d8265e...` | **PASS / RAW_LOG_VERIFIED** |
| M1-0 offline Chromium | Official Python DOM / SPA / Channel / Hover / Hover Card fixture scripts, **5/5 PASS markers with exit=0** on `7d8265e...` | **PASS / RAW_LOG_VERIFIED** |
| Installed Chrome MV3 | User stated **"이상없음"** for this integration candidate; no individual CH-14/15 Worker message/cache/tab/document/restart logs or screenshots submitted | **USER_REPORTED_NO_ISSUES / SCOPED_EVIDENCE_PENDING** |
| GitHub Actions / checks | No CI runs or combined statuses on candidate commit in checked queries | **NOT_OBSERVED**, not CI PASS |
| PR #15 merge/rebase | PR #15 remains draft/open at `8ff1d9c...` | **NOT_PERFORMED** |
| YU-28 / Side Panel target pinning | Not in candidate | **NOT_IMPLEMENTED** |
| Live data / release | G2-P0 rights, sampling quality, economics, retention and security gates not fulfilled | **BLOCKED** |

**Commit-level distinction:** source code and official Windows tests were executed against `7d8265e...`. If a subsequent commit changes only these Markdown audit files, its *commit SHA* changes but `extension/` must remain byte-identical (same Git tree SHA). No separate Node/Chromium rerun is claimed for a documentation-only commit. The user's Chrome report is preserved as a user report, not promoted to independently observed case-by-case MV3 test PASS.

## 4. Isolated Windows QA instructions for the candidate

Use a new folder; do not modify any existing working tree, PR #15, or `frontend`.

```powershell
git clone --single-branch --branch feature/youtopia-m1-0-yu27-integration-20261026 https://github.com/Choi1999/YOUTOPIA.git YOUTOPIA-M1-0-QA
Set-Location YOUTOPIA-M1-0-QA
git rev-parse HEAD
git status --short
node --version
python --version
python -m playwright --version

# Native full YU-27 regression
node --test --test-reporter=tap extension/tests/*.test.cjs

# Original offline Chromium fixtures
python extension/tests/chromium-dom-fixture.py
python extension/tests/chromium-spa-fixture.py
python extension/tests/chromium-channel-fixture.py
python extension/tests/chromium-hover-fixture.py
python extension/tests/chromium-hover-card-fixture.py
```

After the offline tests, load the new `extension/` under a **new dedicated Chrome QA profile**, record tested SHA, extension ID, Chromium/Chrome version, test timestamp, Home/Search/SPA Hover behavior and **Worker↔Content messages, sender validation, stale response, cache HIT/MISS/TTL/restart and tab/document scope**. Do not classify those specific CH-14/CH-15 cases PASS without scoped logs or reproducible evidence. Product HQ Site and original Figma/MagicPath are not updated by this PR.

## 5. Review/merge decision gates

- [x] Confirm integration candidate **whole `extension/` Git tree SHA** matches original YU-27 source subtree
- [x] Confirm candidate PR diff contains exactly seven YU-27 extension paths + frontend-preserving ledger reconciliation + this audit document (nine total)
- [x] Official native Node `177/177` tests on **`7d8265e...`**, with zero failure/skipped, original uploaded TAP verified
- [x] Five official offline Chromium fixtures on **`7d8265e...`**, all pass markers and exit=0
- [x] User reports no problems during installed Chrome MV3 manual check of **new candidate**
- [ ] Obtain **scoped, reproducible** Chrome MV3 evidence for Worker↔Content message echo, cache HIT/MISS/60s TTL and restart, tab/document scope, stale response handling (per-case logs/screenshots not yet submitted)
- [ ] Request/complete human code review and decide if PR #35 supersedes original PR #15; keep original PR unchanged until an explicit lifecycle decision
- [ ] Separate explicit merge authorization before integrating PR #35 into `frontend`
- [ ] Keep external YouTube/Steam data operations blocked until G2-P0 external rights/quality/retention/economics gates pass

**Gate now:** `M1_0_SOURCE_PASS / NODE_PASS / OFFLINE_CHROMIUM_PASS / CHROME_USER_REPORTED_NO_ISSUES / MV3_SCOPED_EVIDENCE_PENDING / MERGE_NOT_APPROVED`.
