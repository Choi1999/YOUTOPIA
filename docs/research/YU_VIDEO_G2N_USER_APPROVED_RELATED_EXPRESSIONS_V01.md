# YOUTOPIA — G2-N User-approved related-expression exploration v0.1

> Date: 2026-11-09
> Status: **FEATURE_IMPLEMENTED_IN_ISOLATED_BRANCH / CI_PENDING / WINDOWS_MANUAL_QA_PENDING / NO_G3 / NO_MERGE**.
> Baseline: G2-M HEAD ed593ccd963bca8340cf644331054c809b14036c.
> Branch: feature/yu-video-g2n-user-expression-expansion-v01.

## 1. Product purpose and user instruction

YOUTOPIA must accept **any keyword the user is curious about**, not require selection from a proprietary or fixed keyword catalog. The user previously found that the "음악" keyword matched only comments containing the exact word "음악" while comments about "노래" or "플레이리스트" went unmatched.

G2-N therefore offers **optional, manual, user-approved related expressions** while preserving the primary keyword as the default source of truth. The user's original free-text keyword is never silently broadened in YouTube video search or existing comment collection.

## 2. Implemented behavior

- After the user explicitly applies a primary keyword, a separate **관련 표현 탐색** section appears.
- Users can add up to 5 arbitrary 1–40 character phrases manually. Each term must differ from the main term and any already-selected term. Duplicate prevention uses Unicode NFKC + case-insensitive comparison.
- For the primary keyword **음악**, optional editorial *examples* ["노래", "플레이리스트", "음원"] are shown as individually selectable buttons. The examples are not automatically selected, and are not a dictionary, AI semantic analysis, or verified synonyms. For other primary terms, manual entry remains available without a predetermined list.
- Each selected term can be removed independently. Re-applying/changing the primary keyword resets all selections and the view mode.
- Display mode starts in **원래 키워드만**. The user must explicitly press **선택한 관련 표현 포함** to change the displayed date chart, video/channel counts and evidence list.
- The original exact-match figures remain displayed, with a separate summary of **원래 문구**, **관련 표현만**, and **중복 제외 합계**. A comment containing both the original and a selected term counts once in the combined total.
- Individual term counts can overlap; the UI warns that they cannot be summed to compute the union. Each evidence item in expanded mode displays whether it matched the original query or *only* an added phrase, naming the phrase(s).
- Date bounds, sample denominators and source selection stay anchored to current G2-K/G2-M CSV or YouTube top-level comment samples; the two datasets never silently merge.

## 3. What this is NOT

- No automatic synonyms, embeddings, LLM classification, sentiment inference or semantic equivalence verification.
- Related expressions are **plain literal substring searches of the already collected comments**, with Unicode normalization. The actual upstream YouTube search query and collection scope do not expand.
- No new API requests occur when terms are selected, removed or displayed.
- No new video downloads, automatic comment harvesting, persistence or G3 model call.
- User-selected phrases reset with the browser session; no service-side history.

## 4. Windows manual QA

1. In the clean Worktree, checkout the G2-N feature branch and restart the Vite dev server. Keep the existing loopback API server on port 8787 running if you want to test live YouTube comments; offline CSV QA requires no key or API calls.
2. Apply keyword "음악". Confirm candidate buttons appear but **선택한 관련 표현 포함** is initially disabled, and exactly matched results still use only "음악".
3. Load a user-authorized local test CSV including comments with only "음악", only "노래", both, and neither; select the "노래" example. Confirm original count stays unchanged and the expanded combined total deduplicates overlap.
4. Explicitly switch to **선택한 관련 표현 포함**. Confirm chart, video/channel breakdown and evidence reflect the union. Related-only evidence must show an appropriate label. Switch back to original-only and confirm no contamination.
5. Add a different phrase by typing. Verify duplicate/primary expressions are refused; remove an added phrase and confirm it is excluded.
6. Apply a new arbitrary keyword (e.g. "독일 와인"): selection resets, no fixed list required, and additional phrases can still be typed.
7. With live YouTube top-level comment samples, verify the same mode behavior without additional API requests upon adding/removing phrases. Video sampling caps and CSV/API source separation remain unchanged.

## 5. QA and merge boundaries

- Offline tests cover primary/expression overlap, duplicate and length limits, metadata, dates, ratio preservation, user-driven UI state, resetting, and no-network candidate actions.
- G2-M's previous live video comment comparison was user reported. The remaining third/fourth video caps and reset are not assumed to have passed Windows manual QA solely because automated tests pass.
- G2-J PR #111, G2-K PR #113, G2-L PR #114, and G2-M PR #116 remain separate Draft/unmerged, with G2-N stacked as another Draft PR.
- G2-G 10 APPROVE/2 HOLD source files unchanged; G2-H1 source research PAUSED; independent blind Gold 0; G3 real AI video inference NO-GO; production merge/deployment/branch deletion not authorized.
