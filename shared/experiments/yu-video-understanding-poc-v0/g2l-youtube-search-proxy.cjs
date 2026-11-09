"use strict";
/**
 * G2-L: loopback-only, opt-in YouTube Data API search boundary.
 * No API calls occur at startup. Browser never sees the API key.
 * G2-M: optional, user-clicked commentThreads.list first-page of top-level
 * comments for at most 3 previously discovered videos. No replies, downloads,
 * AI inference, persistent logging, or production auth.
 * Node >= 24.
 */
const http = require("node:http");

const SEARCH_API = "https://www.googleapis.com/youtube/v3/search";
const COMMENTS_API = "https://www.googleapis.com/youtube/v3/commentThreads";
const MAX_COMMENT_RESULTS = 100;
const MAX_COMMENT_VIDEOS = 3;
const MAX_BODY = 2048;
const MAX_RESULTS = 10;
const PORT = 8787;
const SAFE_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

function normalizeSearchQuery(value) {
  if (typeof value !== "string") return null;
  const query = value.trim().normalize("NFKC").replace(/\s+/g, " ");
  if (!query || [...query].length > 100 || /[\u0000-\u001f\u007f]/.test(query)) return null;
  return query;
}

function safeText(value, maximum) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function validVideoId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{11}$/.test(value);
}

function normalizeSearchItems(payload) {
  if (!payload || !Array.isArray(payload.items)) return null;
  const items = [];
  const seen = new Set();
  for (const item of payload.items.slice(0, 50)) {
    const id = item && item.id && item.id.videoId;
    const snippet = item && item.snippet;
    if (!validVideoId(id) || !snippet || typeof snippet !== "object" || seen.has(id)) continue;
    const publishedAt = snippet.publishedAt;
    const thumbnailUrl = snippet.thumbnails && (
      (snippet.thumbnails.medium && snippet.thumbnails.medium.url) ||
      (snippet.thumbnails.default && snippet.thumbnails.default.url)
    );
    let approvedThumb = null;
    try {
      const url = new URL(thumbnailUrl);
      if (url.protocol === "https:" && url.hostname === "i.ytimg.com" &&
          /^\/vi\/[a-zA-Z0-9_-]{11}\//.test(url.pathname)) approvedThumb = url.href;
    } catch { /* no thumbnail */ }
    items.push({
      videoId: id,
      title: safeText(snippet.title, 250),
      channelId: safeText(snippet.channelId, 100),
      channelTitle: safeText(snippet.channelTitle, 150),
      publishedAt: typeof publishedAt === "string" &&
        Number.isFinite(Date.parse(publishedAt)) ? publishedAt : null,
      thumbnailUrl: approvedThumb,
      videoUrl: "https://www.youtube.com/watch?v=" + id,
    });
    seen.add(id);
    if (items.length === MAX_RESULTS) break;
  }
  return items;
}

/**
 * Normalize only public, top-level comments from the officially returned
 * first page. Do not treat the response as a full history or all replies.
 * Author details, replies, and moderation metadata never leave this server.
 */
function normalizeCommentThreads(payload, video) {
  if (!payload || !Array.isArray(payload.items) || !video ||
      !validVideoId(video.videoId)) return null;
  const comments = [];
  const seen = new Set();
  let skipped = 0;
  let truncated = 0;
  for (const item of payload.items.slice(0, MAX_COMMENT_RESULTS)) {
    const thread = item && item.snippet;
    const comment = thread && thread.topLevelComment;
    const snippet = comment && comment.snippet;
    const id = comment && comment.id;
    const body = snippet && snippet.textDisplay;
    const publishedAt = snippet && snippet.publishedAt;
    if (!thread || thread.videoId !== video.videoId ||
        thread.isPublic === false ||
        !snippet || typeof body !== "string" ||
        !body.trim() || typeof id !== "string" ||
        !/^[A-Za-z0-9_.-]{1,160}$/.test(id) ||
        seen.has(id) || typeof publishedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(publishedAt) ||
        !Number.isFinite(Date.parse(publishedAt))) {
      skipped++;
      continue;
    }
    if (body.length > 2000) truncated++;
    seen.add(id);
    comments.push({
      id,
      videoId: video.videoId,
      videoTitle: video.title,
      channelId: video.channelId,
      channelName: video.channelTitle,
      publishedAt,
      text: body.slice(0, 2000),
    });
  }
  return { comments, skipped, truncated };
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
    "Referrer-Policy": "no-referrer",
  });
  res.end(body);
}

async function readJson(req) {
  const contentType = String(req.headers["content-type"] || "").split(";")[0].trim();
  if (contentType !== "application/json") throw new Error("BAD_CONTENT_TYPE");
  let size = 0;
  const chunks = [];
  for await (const part of req) {
    size += part.length;
    if (size > MAX_BODY) throw new Error("TOO_LARGE");
    chunks.push(part);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("BAD_JSON"); }
}

function createLocalDiscoveryServer(options = {}) {
  const apiKey = typeof options.apiKey === "string" ? options.apiKey : "";
  const fetcher = options.fetcher || globalThis.fetch;
  const now = options.now || (() => Date.now());
  const maxPerDay = Number.isInteger(options.dailyLimit) &&
    options.dailyLimit > 0 && options.dailyLimit <= 100 ? options.dailyLimit : 20;
  let count = 0;
  let day = "";
  let busy = false;
  let discovered = new Map(); // Only IDs returned by the latest successful search
  let sampled = new Set();    // Maximum three distinct videos per search
  let discoveredQuery = "";
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const port = req.socket.localPort;
    if (!["localhost:" + port, "127.0.0.1:" + port].includes(String(req.headers.host))) {
      return send(res, 403, { kind: "ERROR", code: "INVALID_HOST" });
    }
    const origin = req.headers.origin;
    if (origin && !SAFE_ORIGINS.has(origin)) {
      return send(res, 403, { kind: "ERROR", code: "INVALID_ORIGIN" });
    }
    if (url.pathname === "/api/youtube/discover/health" && req.method === "GET") {
      return send(res, 200, { kind: "HEALTH", configured: Boolean(apiKey) });
    }
    const commentRequest = url.pathname === "/api/youtube/comments";
    const searchRequest = url.pathname === "/api/youtube/discover";
    if (!(commentRequest || searchRequest) || req.method !== "POST") {
      return send(res, 404, { kind: "ERROR", code: "NOT_FOUND" });
    }
    if (req.headers["x-youtopia-local-search"] !== "1") {
      return send(res, 403, { kind: "ERROR", code: "ACTION_REQUIRED" });
    }
    let input;
    try { input = await readJson(req); }
    catch {
      return send(res, 400, { kind: "ERROR", code: "INVALID_REQUEST" });
    }
    const query = searchRequest ? normalizeSearchQuery(input && input.query) : null;
    const order = searchRequest && input && input.order === "date" ? "date" :
      searchRequest && input && input.order === "relevance" ? "relevance" : null;
    if (searchRequest && (!query || !order)) {
      return send(res, 422, { kind: "ERROR", code: "INVALID_QUERY" });
    }
    const videoId = commentRequest && input && input.videoId;
    if (commentRequest && !validVideoId(videoId)) {
      return send(res, 422, { kind: "ERROR", code: "INVALID_VIDEO" });
    }
    const video = commentRequest ? discovered.get(videoId) : null;
    if (commentRequest && !video) {
      return send(res, 409, { kind: "ERROR", code: "VIDEO_NOT_SEARCHED" });
    }
    if (commentRequest && !sampled.has(videoId) && sampled.size >= MAX_COMMENT_VIDEOS) {
      return send(res, 429, { kind: "ERROR", code: "VIDEO_SAMPLE_LIMIT" });
    }
    if (!apiKey) return send(res, 503, { kind: "ERROR", code: "NOT_CONFIGURED" });
    const currentDay = new Date(now()).toISOString().slice(0, 10);
    if (day !== currentDay) { day = currentDay; count = 0; }
    if (count >= maxPerDay) return send(res, 429, { kind: "ERROR", code: "LOCAL_DAILY_LIMIT" });
    if (busy) return send(res, 429, { kind: "ERROR", code: "REQUEST_IN_PROGRESS" });
    count++;
    busy = true;
    try {
      const upstream = new URL(commentRequest ? COMMENTS_API : SEARCH_API);
      upstream.searchParams.set("part", "snippet");
      if (commentRequest) {
        upstream.searchParams.set("videoId", videoId);
        upstream.searchParams.set("order", "time");
        upstream.searchParams.set("textFormat", "plainText");
        upstream.searchParams.set("maxResults", String(MAX_COMMENT_RESULTS));
      } else {
        upstream.searchParams.set("type", "video");
        upstream.searchParams.set("q", query);
        upstream.searchParams.set("order", order);
        upstream.searchParams.set("maxResults", String(MAX_RESULTS));
        upstream.searchParams.set("safeSearch", "moderate");
      }
      upstream.searchParams.set("key", apiKey);
      const response = await fetcher(upstream.href, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response || !response.ok) {
        return send(res, 502, { kind: "ERROR", code: "YOUTUBE_REQUEST_FAILED" });
      }
      const data = await response.json();
      if (commentRequest) {
        const normalized = normalizeCommentThreads(data, video);
        if (!normalized) {
          return send(res, 502, { kind: "ERROR", code: "INVALID_UPSTREAM" });
        }
        sampled.add(videoId);
        return send(res, 200, {
          kind: "YOUTUBE_PUBLIC_TOP_LEVEL_COMMENTS_V1",
          source: "YOUTUBE_DATA_API_COMMENT_THREADS",
          query: discoveredQuery,
          videoId,
          videoTitle: video.title,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          fetchedAt: new Date(now()).toISOString(),
          scope: "FIRST_PAGE_TOP_LEVEL_MAX_100",
          order: "time",
          sampledCount: normalized.comments.length,
          skipped: normalized.skipped,
          truncated: normalized.truncated,
          hasMore: Boolean(data.nextPageToken),
          comments: normalized.comments,
        });
      }
      const videos = normalizeSearchItems(data);
      if (!videos) return send(res, 502, { kind: "ERROR", code: "INVALID_UPSTREAM" });
      discovered = new Map(videos.map((candidate) => [candidate.videoId, candidate]));
      sampled = new Set();
      discoveredQuery = query;
      return send(res, 200, {
        kind: "YOUTUBE_PUBLIC_VIDEO_SEARCH_V1",
        source: "YOUTUBE_DATA_API_SEARCH",
        query,
        order,
        fetchedAt: new Date(now()).toISOString(),
        scope: "FIRST_PAGE_MAX_10",
        videos,
      });
    } catch {
      return send(res, 502, { kind: "ERROR", code: "YOUTUBE_UNAVAILABLE" });
    } finally {
      busy = false;
    }
  });
}

if (require.main === module) {
  const server = createLocalDiscoveryServer({
    apiKey: process.env.YOUTOPIA_YOUTUBE_API_KEY || "",
  });
  server.listen(PORT, "127.0.0.1", () => {
    console.log("G2L_LOOPBACK_SEARCH_READY http://127.0.0.1:" + PORT);
    console.log("G2L_API_KEY_CONFIGURED " +
      (Boolean(process.env.YOUTOPIA_YOUTUBE_API_KEY) ? "YES" : "NO"));
    console.log("Manual clicks only. No startup API calls. Ctrl+C to stop.");
  });
}

module.exports = {
  createLocalDiscoveryServer,
  normalizeSearchQuery,
  normalizeSearchItems,
  normalizeCommentThreads,
};
