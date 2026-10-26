# YOUTOPIA M1-0 — YU-27 Safe Integration Candidate (2026-10-26 KST)

> **INDEPENDENT_CANDIDATE / STATIC_DIFF_AUDITED / CANDIDATE_EXECUTION_QA_NOT_RUN / PR15_UNMERGED / LIVE_DATA_BLOCKED**
>
> This is an isolated integration candidate, not a merge approval, release, Product HQ update, or implementation of YU-28 More→Side Panel handoff.

## 1. Immutable source references

| Role | Commit | State |
| --- | --- | --- |
| Source baseline | `frontend@9a50ad7ac9ed0bbf78d2512449c1a0daed5e0a3e` | Current target, untouched |
| Old merge base | `d7f271b5afa1fc6b0bf31c000da6aa73611a6dc0` | Common ancestor |
| YU-27 source | `feature/yutopia-27-worker-messaging@8ff1d9c6851d2627b7b3828ccaf2dc1f2a21c74d` | PR #15 DRAFT / OPEN / unmerged |
| Integration candidate | `feature/youtopia-m1-0-yu27-integration-20261026` | New isolated branch, exact resulting SHA to be recorded separately |

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

## 3. Evidence and strict Gate distinction

| Gate | Existing source evidence | Candidate-commit status |
| --- | --- | --- |
| M0 baseline `frontend` Node | Windows native `160/160 PASS` on `9a50ad7ac9ed0bbf78d2512449c1a0daed5e0a3e` | Historical M0 verified; not yet rerun on candidate |
| M0 YU-27 Node | Windows native `177/177 PASS` on `8ff1d9c6851d2627b7b3828ccaf2dc1f2a21c74d` | **NOT_RUN** on new candidate SHA |
| Offline Chromium | Five original fixtures PASS on `frontend` and five on PR #15 | **NOT_RUN** on new candidate SHA |
| Installed Chrome | User reported no issues in both M0 builds | **USER_REPORTED**, scenario-specific logs / Worker cache proof not independently attached |
| Candidate source tree | Git blob and tree SHA audit required after candidate commit | **PENDING POST-COMMIT READBACK** |
| PR #15 merge/rebase | Original PR #15 remains draft and unmerged | **NOT_PERFORMED** |
| YU-28 / Side Panel target pinning | Not implemented in candidate | **NOT_IMPLEMENTED** |
| Live data / release | G2-P0 rights, sampling quality, free tier economics, retention, security still unresolved | **BLOCKED** |

A byte-identical `extension/` tree to PR #15 means the *source* is equivalent, not that the new commit itself was executed in Windows/Chrome. No transfer of PASS across SHAs without explicitly recording the equivalence and the remaining audit limits.

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

- [ ] Confirm candidate `extension/` subtree Git SHA matches pinned YU-27 source subtree
- [ ] Confirm candidate PR diff has exactly seven YU-27 extension paths + ledger reconciliation + this audit document
- [ ] Windows native Node on **new candidate SHA**: all 177 assertions PASS, zero fail/skip
- [ ] Five offline Chromium fixtures PASS on **new candidate SHA**
- [ ] Installed Chrome MV3 on **new candidate SHA**, especially Content→Worker→cache scope/restart error handling
- [ ] Review original PR #15 direction and decide on superseding/replacing vs closing PR separately (no automatic merge or closure)
- [ ] Explicit review approval before any integration into `frontend`

**Gate at preparation:** `M1_0_STATIC_SOURCE_RECONCILIATION_CANDIDATE / EXECUTION_QA_PENDING / MERGE_NOT_APPROVED`.
