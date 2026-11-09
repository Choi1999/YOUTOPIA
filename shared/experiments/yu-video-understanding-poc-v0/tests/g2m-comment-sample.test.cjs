"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  createLocalDiscoveryServer,
  normalizeCommentThreads,
} = require("../g2l-youtube-search-proxy.cjs");

const videoIds = ["AbCdefghI12", "BCdefghI123", "CDefghi1234", "DDefghi1234"];
const headers = {
  "content-type": "application/json",
  "x-youtopia-local-search": "1",
  origin: "http://localhost:5173",
};
function video(id) {
  return {
    id: { videoId: id },
    snippet: {
      title: "Result " + id, channelId: "UCchannel",
      channelTitle: "Channel name", publishedAt: "2026-11-09T00:00:00Z",
      thumbnails: {},
    },
  };
}
function thread(id, videoId = videoIds[0], text = "German wine is interesting", time = "2026-11-09T09:00:00Z") {
  return {
    snippet: {
      videoId, isPublic: true, totalReplyCount: 33,
      topLevelComment: {
        id,
        snippet: {
          videoId, textDisplay: text, publishedAt: time, authorDisplayName: "Do not expose",
        },
      },
    },
    replies: {
      comments: [{
        id: "secret-reply",
        snippet: { textDisplay: "Reply should never be returned" },
      }],
    },
  };
}
async function withServer(config, callback) {
  const server = createLocalDiscoveryServer(config);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try { await callback(base); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
async function post(base, path, payload, extraHeaders) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(payload),
  });
  return { code: response.status, result: await response.json() };
}
const discover = (base, query = "독일 와인") =>
  post(base, "/api/youtube/discover", { query, order: "relevance" });
const comments = (base, videoId) =>
  post(base, "/api/youtube/comments", { videoId });

describe("G2-M opt-in top-level YouTube comment sampling", () => {
  it("blocks arbitrary video IDs that did not appear in latest search without upstream call", async () => {
    let called = 0;
    await withServer({
      apiKey: "TEST_KEY",
      fetcher: async () => { called++; throw Error("should not call"); },
    }, async (base) => {
      const out = await comments(base, videoIds[0]);
      assert.deepEqual([out.code, out.result.code], [409, "VIDEO_NOT_SEARCHED"]);
    });
    assert.equal(called, 0);
  });

  it("fetches only first-page recent top-level comments after explicit search", async () => {
    const urls = [];
    await withServer({
      apiKey: "HIDDEN_KEY",
      now: () => Date.parse("2026-11-09T10:00:00Z"),
      fetcher: async (url, options) => {
        urls.push([new URL(url), options]);
        if (url.includes("/search?")) return { ok: true, json: async () => ({ items: videoIds.map(video) }) };
        return {
          ok: true,
          json: async () => ({
            nextPageToken: "DO_NOT_FOLLOW_OR_EXPOSE",
            items: [thread("Ugx123", videoIds[0], "wine <script>alert(1)</script>")],
          }),
        };
      },
    }, async (base) => {
      assert.equal((await discover(base)).code, 200);
      const out = await comments(base, videoIds[0]);
      assert.equal(out.code, 200);
      assert.equal(out.result.kind, "YOUTUBE_PUBLIC_TOP_LEVEL_COMMENTS_V1");
      assert.equal(out.result.scope, "FIRST_PAGE_TOP_LEVEL_MAX_100");
      assert.equal(out.result.sampledCount, 1);
      assert.equal(out.result.hasMore, true);
      assert.equal(out.result.query, "독일 와인");
      assert.equal(out.result.comments[0].text, "wine <script>alert(1)</script>");
      assert.equal(out.result.comments[0].videoTitle, "Result " + videoIds[0]);
      assert.equal(out.result.comments[0].publishedAt, "2026-11-09T09:00:00Z");
      assert.equal(JSON.stringify(out.result).includes("HIDDEN_KEY"), false);
      assert.equal(JSON.stringify(out.result).includes("DO_NOT_FOLLOW_OR_EXPOSE"), false);
      assert.equal(JSON.stringify(out.result).includes("Do not expose"), false);
      assert.equal(JSON.stringify(out.result).includes("Reply should never be returned"), false);
    });
    assert.equal(urls.length, 2);
    const [url, request] = urls[1];
    assert.equal(url.origin, "https://www.googleapis.com");
    assert.equal(url.pathname, "/youtube/v3/commentThreads");
    assert.equal(url.searchParams.get("videoId"), videoIds[0]);
    assert.equal(url.searchParams.get("part"), "snippet");
    assert.equal(url.searchParams.get("order"), "time");
    assert.equal(url.searchParams.get("textFormat"), "plainText");
    assert.equal(url.searchParams.get("maxResults"), "100");
    assert.equal(url.searchParams.get("pageToken"), null);
    assert.equal(request.redirect, "error");
  });

  it("skips nonpublic, wrong-video, invalid-date and duplicate entries; truncates long text", () => {
    const nonPublic = thread("hidden");
    nonPublic.snippet.isPublic = false;
    const sample = normalizeCommentThreads({
      items: [
        thread("one"),
        thread("one"),
        thread("wrong-video", videoIds[1]),
        nonPublic,
        thread("badDate", videoIds[0], "text", "not-a-date"),
        thread("longOne", videoIds[0], "x".repeat(2500)),
      ],
    }, {
      videoId: videoIds[0], title: "One", channelId: "UCchannel", channelTitle: "Channel",
    });
    assert.equal(sample.comments.length, 2);
    assert.equal(sample.skipped, 4);
    assert.equal(sample.truncated, 1);
    assert.equal(sample.comments[1].text.length, 2000);
  });

  it("limits sampling to three distinct searched videos per search session", async () => {
    await withServer({
      apiKey: "TEST_KEY",
      fetcher: async (url) => {
        if (url.includes("/search?")) return { ok: true, json: async () => ({ items: videoIds.map(video) }) };
        const id = new URL(url).searchParams.get("videoId");
        return { ok: true, json: async () => ({ items: [thread("id_" + id, id)] }) };
      },
    }, async (base) => {
      await discover(base);
      for (const id of videoIds.slice(0, 3)) assert.equal((await comments(base, id)).code, 200);
      assert.deepEqual(
        [ (await comments(base, videoIds[3])).code,
          (await comments(base, videoIds[3])).result.code ],
        [429, "VIDEO_SAMPLE_LIMIT"],
      );
    });
  });

  it("shares the existing small daily request budget with search", async () => {
    let count = 0;
    await withServer({
      apiKey: "TEST_KEY", dailyLimit: 1,
      fetcher: async (url) => {
        count++;
        return { ok: true, json: async () => ({ items: videoIds.map(video) }) };
      },
    }, async (base) => {
      assert.equal((await discover(base)).code, 200);
      const next = await comments(base, videoIds[0]);
      assert.deepEqual([next.code, next.result.code], [429, "LOCAL_DAILY_LIMIT"]);
    });
    assert.equal(count, 1);
  });

  it("blocks missing click header and foreign origin for comment endpoint", async () => {
    let count = 0;
    await withServer({
      apiKey: "TEST_KEY",
      fetcher: async (url) => {
        count++;
        return { ok: true, json: async () => ({ items: videoIds.map(video) }) };
      },
    }, async (base) => {
      assert.equal((await discover(base)).code, 200);
      const badOrigin = await comments(base, videoIds[0]); // sanity
      assert.equal(badOrigin.code, 200);
      const bad = await post(base, "/api/youtube/comments", { videoId: videoIds[0] }, {
        origin: "https://untrusted.example",
      });
      assert.equal(bad.code, 403);
      const noAction = await post(base, "/api/youtube/comments", { videoId: videoIds[0] }, {
        "x-youtopia-local-search": "0",
      });
      assert.equal(noAction.code, 403);
    });
    assert.equal(count, 2);
  });
});
