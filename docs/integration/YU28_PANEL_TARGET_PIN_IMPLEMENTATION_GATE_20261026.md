# YOUTOPIA YU-28 — Hover 「더보기」 → Chrome Side Panel 대상 고정

> **Status (2026-10-26 KST): G28_1_SOURCE_SPIKE_CANDIDATE / CHROME_USER_GESTURE_TEST_NOT_RUN / TARGET_PIN_NOT_IMPLEMENTED / LIVE_DATA_BLOCKED**
>
> Independent working branch: `feature/youtopia-28-panel-target-pin-20261026`.
> Baseline: `frontend@1ff68c209448281dff4dd91ca6e82bbe203230cc` — merged YU-27 from PR #35.
> Not a release / pricing / authentication / YouTube analytics approval.

## 1. Explicit scope

Build only the **user-initiated selection handoff**: YouTube VIDEO/CHANNEL Hover READY → user clicks the enabled '더보기' CTA → browser Chrome Side Panel opens → panel reads and pins exactly the clicked target. Hovering B after selecting A **must never replace A**; only clicking B's CTA may select B. The panel's Summary / Topics / Trends final content belongs to **M2**. At YU-28, show a minimal, honest selected-target shell with SYNTHETIC DEMO / NOT_CONNECTED state, without presenting unsupported analytics. Preserve Guest-first design, pending auth/save reconfirm contract, and role/entitlement separation; do not implement these server features in YU-28.

Maintain working YU-21~27 Home/Search/SPA/ID resolver/interactive Shadow Hover behavior. The existing `@handle` unresolved target, advertisements, Shorts and invalid/ambiguous VIDEO IDs must not become a selected target.

## 2. Mandatory state / message contract

`CLICK(READY targetType,targetId,requestId) → VALIDATE_CURRENT_HOVER → SELECT_REQUEST → WORKER_SENDER_AND_TARGET_CHECK → SIDE_PANEL_OPEN_FROM_GESTURE → PIN_SELECTION_IN_SESSION → PANEL_RENDER`

- Use only `VIDEO` with 11-char canonical ID and `CHANNEL` with `UC` + 22-char stable ID. Do not infer channel ID from `@handle`.
- Sender must match `chrome.runtime.id`, top frame, valid `tab.id`, `documentId`, and `https://www.youtube.com` origin. Reuse YU-27 fail-closed validation; keep request type/version separate from YU-27 preview request.
- The renderer must synchronously confirm the clicked card belongs to the **currently valid Hover READY request**, not an orphaned card after A→B navigation.
- Selection state must be **tab-isolated and explicit-click-only**, carrying `tabId`, `targetType`, `targetId`, click/request generation, source document scope and `data_mode=SYNTHETIC`. No mutation from ordinary hover preview updates.
- Never persist actual comments, user identity or account state. An ephemeral `chrome.storage.session` selected-target record may survive Worker suspension; it is **not an account bookmark**. Set a bounded retention policy and fail closed on missing/corrupt state.
- On panel startup and `storage.onChanged`, read the selected target for the intended tab. Panel must not display a stale target from another tab, another document, or a previous account. Use `textContent`, no HTML interpolation.
- Race safety: A click then B click selects B only after B's explicit click; late reply/open completion from A cannot overwrite B. Preserve A if only Hover B happens. Handle double-click and repeated click idempotently.
- If `sidePanel.open` rejects or the browser cannot propagate activation, report a visible `OPEN_FAILED` state, **do not silently claim success** and do not invent another automatically opened panel.
- No new network requests, `activeTab`/tabs/host permissions or OAuth permissions without separate justification/review.

## 3. Chrome API: blocking integration risk

Chrome `sidePanel.open({tabId})` requires user activation. Chrome 116+ documentation allows a content-script user interaction, but **a content-script message to a Service Worker can lose user gesture propagation depending on dispatch timing / browser behavior**. This cannot be proven by Node fake DOM or offline Chromium fixtures.

Official reference: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

**Mandatory spike before coding full UX:**
1. On a dedicated local test extension with current permissions, make a trusted user-click CTA directly initiate the selection message and have Worker synchronously invoke `chrome.sidePanel.open` **before any `await`/storage I/O**.
2. Verify success on Windows Chrome 155+ using real injected Hover card on YouTube Home and Search; record `chrome.runtime.lastError` / rejected Promise when denied. Check keyboard Enter / Space activation.
3. If the message dispatch fails user-gesture gating, mark `FIX_REQUIRED` and propose a supported explicit extension-action/popup or context-menu fallback for user approval. Do **not** weaken the 'user click only' or selected-target-pin contract.
4. A panel opened via extension action icon alone must not accidentally pin whichever video is hovered; absent explicit CTA, show a safe empty state.

Chromium source enforcement: https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/extensions/api/side_panel/side_panel_api.cc

## 4. Acceptance / test matrix

| ID | Test and success condition |
|---|---|
| YU28-01 | Click A → panel target remains `VIDEO:A`; Hover B/C does not update selection |
| YU28-02 | Explicit click B → panel changes to exactly B, not A or unrelated card |
| YU28-03 | Wrong/unknown `@handle` or malformed target never enables CTA or pins a target |
| YU28-04 | Browser `sidePanel.open` is called **only** from an actual user CTA event; no action on Hover READY |
| YU28-05 | Stale A card click after A→B does not send a valid selection or mutate pinned target |
| YU28-06 | Worker validates sender ID, tab, frame 0, document ID, YouTube origin and exact request schema |
| YU28-07 | Two tabs have distinct pins; tab switching does not leak one tab's selected target into another |
| YU28-08 | Panel launched before session write eventually displays only correct selected target; handles storage failure and reload |
| YU28-09 | Rapid/double clicks, A/B races, Worker restart and stale response fail closed |
| YU28-10 | Keyboard focus/Enter/Space/Escape, Chrome zoom 125/150/200%, narrow panel, Light/Dark usable |
| YU28-11 | All UI/values explicitly SYNTHETIC/DEMO, no external YouTube/Steam API/LLM/payment calls |
| YU28-12 | Existing Node 177 YU-27 tests and five offline Chromium fixtures remain PASS on the **new implementation SHA** |
| YU28-13 | Content and Side Panel use no privileged browser APIs not explicitly granted; permissions unchanged unless reviewed |

Reference product acceptance: `AT-02` target identity, `AT-09` no fake real data, `AT-12` accessibility, `AT-14` synthetic labeling.

## 5. Stage gates

- **G28-0 (this step):** merge baseline validated, feature branch isolated, contract prepared.
- **G28-1:** Isolated click-to-Worker `sidePanel.open` spike code and mock tests prepared; Windows **installed-Chrome actual gesture QA** — `NOT_RUN`.
- **G28-2:** Implement target-select request/ack, sender validation, session pin, panel shell and strict click handler — `NOT_STARTED`.
- **G28-3:** Original Node tests + new selection tests + offline Chromium fixtures executed on new SHA — `NOT_RUN`.
- **G28-4:** Windows installed Chrome Home/Search/SPA and tab/document/Worker lifecycle E2E — `NOT_RUN`.
- **G28-5:** Independent review + user merge authorization. **Do not auto-merge PR or change existing PR #15.**

### Post-M1-0-merge exact regression baseline

The `frontend` merge commit `1ff68c209448281dff4dd91ca6e82bbe203230cc` has identical `extension/` Git tree SHA `07cbc21faddb296c9a2313430a3866adf74aa3d7` to the earlier Windows-tested candidate `7d8265e4f76785b1b4d863954cf7830a47c613d6`. **Byte identity PASS**, but a fresh Windows Node/Chromium run *on the merge commit* has not been performed. If run, record exact SHA, machine versions, clean worktree and logs. This is a gate separate from YU-28 code.

**Final status:** `YU28_G28_1_CLICK_SPIKE_CODE_READY / NATIVE_TEST_NOT_RUN / CHROME_GESTURE_NOT_RUN / G28_2_TARGET_PIN_NOT_IMPLEMENTED / MERGE_NOT_APPROVED / LIVE_PRODUCT_RELEASE_BLOCKED`.

G28-1 implementation and test runbook: [YU28_G28_1_GESTURE_SPIKE_QA_20261026.md](./YU28_G28_1_GESTURE_SPIKE_QA_20261026.md).
