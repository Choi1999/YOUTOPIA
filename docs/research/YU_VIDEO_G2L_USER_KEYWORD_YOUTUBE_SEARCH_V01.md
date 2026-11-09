# YOUTOPIA G2-L — User-defined YouTube video discovery

> Status: LOCAL_YOUTUBE_SEARCH_IMPLEMENTED / CI_PENDING / WINDOWS_QA_PENDING / G3_NO_GO / NO_MERGE
> Branch: feature/yu-video-g2l-youtube-search-boundary-v01

## Scope

The user types ANY keyword or phrase (up to 100 characters). A separate explicit **YouTube 영상 검색** button requests the first page of up to ten public video results through Google's official YouTube Data API. No default or suggested keywords are inserted. Results show title, channel, published date, official video link, and an optional thumbnail. This video candidate list is NOT an actual trending ranking or sentiment analysis.

Existing G2-K CSV comment observations stay separate. The screen shows only CSV-based comment statistics unless a user selects an actual CSV. Search results never fabricate comment evidence.

## Development architecture

- Browser sends POST /api/youtube/discover, a same-origin Vite proxy route.
- Vite forwards to the separate Node 24 loopback server bound to 127.0.0.1:8787.
- The server reads the YOUTOPIA_YOUTUBE_API_KEY process environment variable, not the browser.
- Key missing: NOT_CONFIGURED. No external call at startup. Without a user search click, no external call.
- Strict host, origin, custom action header and content-type gates; bounded input, at most 10 results, 10-second upstream timeout, redirect forbidden.
- Local maximum 20 calls per UTC day **per process**; restarting resets the count. Actual Google Cloud quota remains authoritative.
- No comment downloads, video downloads, persistent storage or AI provider calls.
- Returned URLs only use validated YouTube video IDs; thumbnails only accepted from i.ytimg.com.
- This is a local development boundary, not a production multi-user server or credentials vault.

## Windows local verification

Run the isolated branch after confirming no uncommitted changes in the existing G2-C worktree. Stop the old Vite server before switching.

PowerShell A (repository root):

~~~powershell
$secret = Read-Host 'YouTube Data API key' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $env:YOUTOPIA_YOUTUBE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
node .\shared\experiments\yu-video-understanding-poc-v0\g2l-youtube-search-proxy.cjs
# Ctrl+C to stop, then:
Remove-Item Env:\YOUTOPIA_YOUTUBE_API_KEY -ErrorAction SilentlyContinue
~~~

PowerShell B (frontend directory):

~~~powershell
pnpm dev
~~~

Open http://localhost:5173/analysis/youtube/trend-keywords.

The secure prompt protects the key from shell history, but process environment storage is not a production secret vault. Do not send the key to chat or GitHub. Confirm that the Google Cloud IP restriction matches the PC's outbound IP.

QA: check no startup calls, free keyword input, click search once, relevant metadata, YouTube video links, visible error for missing key, independent CSV table still working. G2-K prior Windows manual QA is still pending separately. Actual YouTube successful response is NOT claimed until the user runs it locally.

## Official API references, as checked on 2026-11-09

- https://developers.google.com/youtube/data/reference/rest/v3/search/list
- https://developers.google.com/youtube/data/determine_quota_cost
- https://developers.google.com/youtube/data/guides/quota_and_compliance_audits

The current official quota docs specify search.list in the separate Search Queries quota bucket, default 100 calls/day, cost 1 unit per call. Verify actual project allocation; policies and limits may change.

## Gates

G2-G 10 APPROVE / 2 HOLD and local records preserved; independent Blind Gold 0; G2-H1 source research paused; G3 external video model inference NO-GO. No repository merges, production integration or branch deletion.
