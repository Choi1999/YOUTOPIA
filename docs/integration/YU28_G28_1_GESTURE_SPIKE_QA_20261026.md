# YOUTOPIA — YU-28 G28-1 Chrome Side Panel user-gesture spike QA

> **SYNTHETIC DEMO ONLY / EXPERIMENTAL / REAL CHROME TEST REQUIRED / YU28 TARGET PIN NOT IMPLEMENTED**
>
> Base `frontend@1ff68c209448281dff4dd91ca6e82bbe203230cc`, isolated branch `feature/youtopia-28-panel-target-pin-20261026`.
> Code for G28-1 opens the **existing placeholder Side Panel** on a validated user click. It does not store or pin VIDEO/CHANNEL selection.

## 1. What changed

- `extension/hover-card.js`: enable '더보기' **only when extension messaging exists**, require an actually trusted click and a current READY VIDEO/CHANNEL ID, synchronously forward a versioned `YUTOPIA_YU28_GESTURE_OPEN_V1` message; show status on confirmed response or failure. Unresolved `@handle` never has CTA.
- `extension/background.js`: strict request and sender validation via YU-27 helpers; **synchronously** invoke `chrome.sidePanel.open({tabId: sender.tab.id})` inside the click message listener, before any await, storage read or asynchronous scheduling. Report `OPENED` only when Chrome's Promise resolves; failures are `OPEN_FAILED`, `OPEN_UNAVAILABLE`, `OPEN_UNCONFIRMED`, `UNTRUSTED_SENDER`, `INVALID_REQUEST`.
- `extension/sidepanel.html`: distinct G28-1 DEMO placeholder warning that selection is not yet pinned and three tabs are not present.
- `extension/tests/panel-gesture-spike.test.cjs`: fake MV3 API contract tests. Existing `hover-card-ui.test.cjs` gains trusted/untrusted/stale click checks. No new permissions, backend, API, authentication, or user data.

## 2. Windows official QA on the exact candidate commit

Use a **new** directory to avoid modifying prior QA folders. Find the current candidate full SHA in GitHub and record it; do not substitute the `frontend` merge SHA.

```powershell
Set-Location C:\YOUTOPIA-QA
git clone --single-branch --branch feature/youtopia-28-panel-target-pin-20261026 https://github.com/Choi1999/YOUTOPIA.git YOUTOPIA-YU28-G28-1
Set-Location .\YOUTOPIA-YU28-G28-1
git rev-parse HEAD
git rev-parse HEAD:extension
git status --porcelain
node --version
python --version
python -m playwright --version

node --test --test-reporter=tap extension/tests/*.test.cjs

python extension/tests/chromium-dom-fixture.py
python extension/tests/chromium-spa-fixture.py
python extension/tests/chromium-channel-fixture.py
python extension/tests/chromium-hover-fixture.py
python extension/tests/chromium-hover-card-fixture.py
```

Log complete TAP totals (existing 177 + new cases), five Chromium PASS markers, exact SHA, clean worktree, exit codes. Do not infer a test count until actually executed. Do not claim these offline tests prove Chrome user gesture propagation.

## 3. G28-1 real Chrome user-gesture acceptance

Use a **separate QA Chrome profile**; do not load alongside M0/M1 YOUTOPIA versions. At `chrome://extensions`, enable Developer Mode and load unpacked `YOUTOPIA-YU28-G28-1\extension` (the inner folder).

Record Chrome version from `chrome://version`, extension ID, exact Git SHA, timestamp KST, and any worker-console errors. No real comment/API collection.

1. Verify existing Hover behaviour on YouTube Home and Search, A→card→A and A→B→C, plus SPA navigation. The Shadow card should still be single/positioned.
2. Close the Side Panel first; do **not** click the extension toolbar icon. Hover a valid VIDEO A until the DEMO Hover Card shows **enabled 「더보기」**.
3. **Physically click** 「더보기」. Expect Chrome Side Panel opens with **YU-28 G28-1 DEMO** notice. The worker DevTools console (inspect from `chrome://extensions`) should record `[YUTOPIA G28-1] OPENED` and correct tab/VIDEO ID, `pinned:false`. If `sidePanel.open()` fails, record `OPEN_FAILED` and error verbatim; do not mark PASS.
4. Repeat after closing panel for a CHANNEL with a stable UC ID; unresolved `@handle` must not show the CTA.
5. Keyboard: focus 「더보기」 using Tab, activate with Enter and Space. Both should open panel on actual user action.
6. Negative: **Hover only** must never call Side Panel open; page JavaScript programmatic `button.click()` (`isTrusted=false`) must not send a valid G28-1 request.
7. Open the panel using the extension toolbar icon alone: it may open as the pre-existing behavior but must **not claim to pin whichever video was hovered**.
8. Check Console/Worker for extra live API calls. No OAuth, YouTube Data API, Steam, payment or LLM calls are authorized.

**Do NOT assess selected-target pinning (A click then B Hover) as implemented here.** That is **G28-2**, and the Side Panel intentionally remains a placeholder.

## 4. Evidence format

```text
YU28_G28_1_CHROME_RESULT
Git SHA:
Chrome version:
Extension ID:
KST timestamp:
Home click A -> panel opened: PASS/FAIL
Search click A -> panel opened: PASS/FAIL
CHANNEL UC click -> panel opened: PASS/FAIL/NOT_RUN
Unresolved handle CTA absent: PASS/FAIL
Keyboard Enter/Space: PASS/FAIL
Hover-only does not open: PASS/FAIL
Worker OPENED or OPEN_FAILED:
Any console errors:
Screenshots / sanitized logs:
```

Expected `G28-1` completion requires **actual installed Chrome trusted-click PASS** and no regression; Node/Chromium are independent code regressions. If Chrome blocks user activation crossing the message boundary, mark `FIX_REQUIRED`, preserve logs and do not add artificial automatic opens or enable real API work.

**Stage:** `G28_1_SOURCE_PREPARED / NODE_NOT_RUN / CHROMIUM_NOT_RUN / CHROME_USER_ACTIVATION_NOT_RUN / PR_MERGE_NOT_APPROVED`.

## 5. Preparation-only simulated V8 checks (not Windows CI)

Before committing, source syntax was parsed in V8 and a **custom isolated V8 model of Node's `node:test`, `vm`, `fs` and DOM mocks** exercised:
- Modified `hover-card-ui.test.cjs`: **42/42 simulated tests PASS** (old Hover controls + three new G28-1 click cases).
- New `panel-gesture-spike.test.cjs`: **10/10 simulated tests PASS** (strict schema, sender, immediate `sidePanel.open`, rejected/sync-throw/missing API, PING/preview isolation).

These are explicitly **NOT native Node CLI executions**, **NOT Python Playwright Chromium**, **NOT GitHub Actions CI**, and **NOT real Chrome user-activation evidence**. Native Windows QA must be independently run and reported with fixed Git SHA and full logs.
