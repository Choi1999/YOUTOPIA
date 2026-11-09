# UI-R05-B2 — Graph-First offline observation projection v0.1

- Date: 2026-11-09
- Parent R05-B1: Draft PR #122, HEAD d36ee1f51ea315c765512de64d908bd7a330a3a6
- Feature branch: feature/ui-r05b2-graph-first-projection-ui-v01
- Scope: **React FocusMode UX + local-only CSV/synthetic GraphProjection**; not a production API/Extension integration.
- Existing R04 FocusMode, URL Canvas, manual groups, bookmark/navigation, keyboard/docking and URL registration are preserved. No existing R04 canvas file is replaced.

## 1. User-facing behavior

The default route remains /analysis/youtube/workspace, opening the R04 full-viewport FocusMode. A separate **오프라인 관측 그래프** button switches the central graph from existing URL nodes to a new READ-ONLY bounded R05 projection. This never deletes R04 targets, groups or bookmarks. Switching back to **URL 그래프로 돌아가기** restores the original URL graph.

The user may explicitly:
- apply any primary keyword (initial draft 음악 for synthetic training convenience; no provider API search);
- choose 7/30/90-day UTC observation window, anchored to most recent source comment publishing day;
- upload a local, user-authorized UTF-8 CSV with G2-K header: comment_id,video_id,channel_id,published_at,text and optional video_title,channel_name. Limit 2 MiB/5000 rows, max 3 distinct 11-character YouTube-format video IDs in B2; each imported CSV remains a **USER_CSV_UNVERIFIED** source;
- click **합성 예시 불러오기**, which displays explicitly synthetic comments, not real YouTube response;
- clear the current offline sample without editing the original file.

**No API keys, YouTube calls, cloud uploads, file-system writes or sessionStorage of CSV/comment text**. File is read only after explicit input selection, analyzed in React memory, and disappears when the FocusMode component unmounts.

The existing R04 URL registration input still accepts only supported YouTube URLs. Adding a URL automatically switches back to URL mode so its canonical node becomes visible. The B2 sample VIDEO nodes do not auto-add themselves to R04 URL registrations or saved user groups.

## 2. Node/edge integration

Pure, previously tested G2-K/N/O sources are **selectively ported unchanged** (with original Blob SHA):
- frontend/src/features/trend/userKeywordTrend.ts
- frontend/src/features/trend/relatedKeywordAnalysis.ts
- frontend/src/features/trend/observedExpressionCandidates.ts
and their offline tests. This is a limited early pure-function migration needed for the B2 offline preview; R05-D still owns full production analysis adapter and corresponding opt-in live flow.

R05-B2 workspaceOfflineProjection.ts translates the selected, parsed CSV into R05-B1 GraphProjection:
- keyword node for the user's chosen query;
- video nodes and EVIDENCE_SET nodes for each selected video, with first-party **unverified CSV labels** or explicitly synthetic labels;
- expression nodes from actual lexical cooccurrence within the current selected CSV; evidence edges carry up to two source comment IDs, not raw text;
- registered legacy VIDEO/CHANNEL/HANDLE and user groups are only projected read-only; **CSV channel_id alone never creates an official CHANNEL_PUBLISHES_VIDEO edge**;
- no search-result edges, inferred sentiment or semantic similarity; missing relations stay missing.

FocusMode renders a separate deterministic 2.5D-like DOM/SVG node canvas with pan/zoom, label/kind search filtering, page navigation for visible nodes and keyboard-selectable buttons. Selecting a graph node or corresponding list entry opens the **existing right-side responsive detail dock**. The detail shows source/status/period, typed relation descriptions and a bounded view of the explicitly selected source comment evidence. Unselected/filtered nodes are not deleted.

### Quantitative scope

- CSV max 2MiB, 5000 valid observations, up to 3 unique videos in B2. This is deliberately less than the full G2-K CSV capacity for distinct videos and is disclosed rather than silently dropping records.
- The G2-M API 3×100 first-page cap applies only to future official API sample support, not local CSV; B2 performs no official API request.
- Candidates are lexical tokens from comments explicitly containing the primary term. Candidate count max eight, direct comment evidence max two.
- Counts are limited to selected CSV/source and its UTC observation window. No-data, blocked provider requests, unavailable video metadata and true zero must stay distinct.
- User-supplied titles are **not official metadata verification**. Synthetic comment text cannot be displayed as user sentiment.

## 3. File/contract boundaries

- workspaceOfflineProjection.ts: off-line-only CSV and synthetic source adapter, creates B1 graph.
- WorkspaceProjectionCanvas.tsx: display-only searchable/pannable/zoomable graph and selected-node evidence dock content.
- WorkspaceFocusMode.tsx: source upload, keyword/window state, mode toggle and chosen node; uses existing DockState but keeps URL selection and R04 registration separate.
- workspace-projection.css: scoped visual styles. Existing Dock CSS unchanged.
- No changes to extension/*, frontend/vite.config.ts, backend, routes, login/auth, shared/contracts/.../policy-gates.json or existing URL Canvas semantics.

## 4. Offline QA requirements

1. Existing R04 URL graph remains default, and URL/FocusMode/Bookmarks/Groups/Dock tests remain green.
2. Empty offline mode shows no fabricated data, and no network requests on toggle.
3. Explicit synthetic fixture shows G2-K/O keyword/video/expression/evidence nodes with clearly labeled synthetic provenance.
4. Explicit CSV import shows period totals, video names and actual local comments in the existing detail dock. Source remains unverified, no official channel ownership edges from CSV.
5. Graph search/filter physically hides unrelated nodes; pan/zoom and center reset work; list/detail remains synchronized.
6. Switching to URL graph restores registered targets unchanged. Clearing offline source does not erase registered URLs.
7. Invalid CSV, too many video IDs, unsupported files fail closed without overwriting last valid input.
8. Narrow layout keeps existing R04 responsive splitters/overlay policy and keyboard focus trap; Windows Chrome QA separately required.

## 5. Remaining gates

- R05-B2 remains Draft/unmerged; automated CI does not mean Windows Chrome manual QA PASS.
- R05-C extends extension/web-analysis-link.js with exact explicit click handoff FOCUS/ADD, no auto-save and no new permissions.
- R05-D connects G2-O's actual analysis cards/selection and provenance from the broader app, not merely this limited CSV source.
- R05-E reviews *opt-in only* 127.0.0.1:8787 demo API routes alongside existing Spring auth proxy, without relaxing policy-gates.json POLICY_HOLD/liveCallsAuthorized=false.
- R05-F performs real Windows integrated Graph/Extension QA. G2-M third/fourth video and clear/reset manual QA remain pending independently.
- Do not merge, deploy, delete branches or authorize G3/paid AI calls based on this PR.
