# YOUTOPIA — G2-M searched-video top-level comment sampling

Status: CODE_IMPLEMENTED / OFFLINE_CI_PENDING / G2-L_WINDOWS_QA_PENDING / G2-M_WINDOWS_QA_PENDING / G3_NO_GO / NO_MERGE.

## 1. User story

The user types a free keyword, explicitly searches public YouTube video metadata, and chooses videos from those results. A distinct "최신 댓글 표본 가져오기" action requests top-level public comments for one selected video. At most three different video IDs can be sampled per successful video search. Each has a first-page cap of 100 top-level comments, ordered by time. Replies and additional pages are not fetched.

The user sees per-video keyword matches, per-video sample denominators, date distributions using UTC comment publication timestamps, and up to 20 matching text excerpts. Comments are compared by literal normalized keyword inclusion only. No automatic translation, synonym expansion, sentiment inference or causal assertion is made.

## 2. Explicit source separation

- Local CSV observations and YouTube API top-level comment samples are distinct data sources. UI requires an explicit source selection when both exist; it does not silently merge records.
- API comments are tied to videos returned by the proxy's most recent search. Arbitrary video IDs are rejected.
- Result metadata includes comment retrieval timestamp, first-page-only coverage, sampled/skipped/truncated counts, and whether a next page exists. There is no pagination in this slice.
- The server does not return author identity, avatars, reply threads, moderation data, or private metadata. The comment text is requested in plainText mode and rendered as text, not HTML.
- React session memory holds observations. A new keyword or fresh search clears prior API comments; refresh clears all.

## 3. Local API boundary

- Reuses Node 24 loopback-only G2-L proxy bound to 127.0.0.1:8787 with the API key in the local process environment.
- Adds same-origin POST /api/youtube/comments with selected video ID, explicit-click header, content-type, and bounded JSON.
- Server invokes the official YouTube Data API commentThreads.list endpoint with videoId, part=snippet, maxResults=100, order=time and textFormat=plainText.
- Search and comment requests share the prior in-memory 20-request-per-UTC-day cap and single in-flight request gate. Process restart resets the local counter; this is not a production rate limit.
- Disabled comments, invalid keys, quota exhaustion and upstream failures return generic messages; raw provider error bodies and API key are not exposed to the browser.
- No video downloads, background crawling, persistent storage or external model calls.

## 4. Interpretation limitations

The first page of time-ordered top-level comments is NOT all comments, all replies, a representative audience sample, or a reliable whole-video time series. Empty dates do not establish true zero interest. Comparing samples from differently sized, aged, or moderated channels does not prove growth, sentiment or diffusion. These are observed mentions only.

## 5. Windows browser QA

G2-L actual search and G2-K browser QA remain unreported. For G2-M follow the G2-L setup and connect your existing permitted Google API key locally (never paste the key into chat or commit it to GitHub).

1. Enter a freely chosen keyword, apply it, then click YouTube video search. No automatic call should occur.
2. For one to three returned videos, click latest comment sample. Verify observed count, timestamps, actual comment text, first-page scope, and next-page warning.
3. Confirm per-video fraction calculation uses each sample's own denominator, and that date distribution changes with the 7/30/90-day selector.
4. Switch to CSV, if available, and verify CSV data is not silently combined with API comments. A failed API call must not replace existing valid data.
5. Confirm a fourth distinct video is blocked, while repeating a sampled video replaces rather than duplicates its sample.
6. Confirm new keyword search clears prior API samples; missing keys or disabled comments show errors without leaking credentials.
7. Verify no background API calls, no video downloads, and no external AI calls.

Offline CI uses fake API responses only. Real Windows API and manual browser QA cannot be marked PASS until actually reported.

## 6. Reference

YouTube commentThreads.list: https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
Comment thread resource: https://developers.google.com/youtube/data/reference/rest/v3/commentThreads
Quota calculator: https://developers.google.com/youtube/data/determine_quota_cost

## 7. Unchanged gates

G2-G operator results remain 10 APPROVE / 2 HOLD, independent blind Gold 0, G2-H1 research paused, and G3 external video-model requests NO-GO. Older draft PRs #111, #113, and #114 remain unmerged. G2-M is isolated and may not be merged/deployed or delete branches without separately approved action.
