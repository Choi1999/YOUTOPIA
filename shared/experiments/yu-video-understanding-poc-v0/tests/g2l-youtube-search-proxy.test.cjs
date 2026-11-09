"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  createLocalDiscoveryServer,
  normalizeSearchQuery,
  normalizeSearchItems,
} = require("../g2l-youtube-search-proxy.cjs");

function mockVideo(id = "AbCdefghI12") {
  return {
    id: { videoId: id },
    snippet: {
      title: "Original video title",
      channelId: "ChannelABC",
      channelTitle: "Example channel",
      publishedAt: "2026-11-09T00:00:00Z",
      thumbnails: { medium: { url: "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg" } },
    },
  };
}
async function withServer(options, run) {
  const server = createLocalDiscoveryServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    await run("http://127.0.0.1:" + port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
const goodHeaders = {
  "content-type": "application/json",
  "x-youtopia-local-search": "1",
  "origin": "http://localhost:5173",
};
async function search(url, query, moreHeaders = {}) {
  const result = await fetch(url + "/api/youtube/discover", {
    method: "POST",
    headers: { ...goodHeaders, ...moreHeaders },
    body: JSON.stringify({ query, order: "relevance" }),
  });
  return { status: result.status, body: await result.json() };
}

describe("G2-L guarded local YouTube search proxy", () => {
  it("normalizes arbitrary Unicode free-text queries with no fixed topic list", () => {
    assert.equal(normalizeSearchQuery("  독일   와인  "), "독일 와인");
    assert.equal(normalizeSearchQuery(" ".repeat(20)), null);
    assert.equal(normalizeSearchQuery("a".repeat(101)), null);
  });
  it("starts without credentials and never reaches upstream", async () => {
    let calls = 0;
    await withServer({
      apiKey: "",
      fetcher: async () => { calls++; throw new Error("should not call"); },
    }, async (url) => {
      const res = await search(url, "독일 와인");
      assert.equal(res.status, 503);
      assert.equal(res.body.code, "NOT_CONFIGURED");
      assert.equal(calls, 0);
    });
  });
  it("requires an explicit UI action and rejects foreign origins", async () => {
    let count = 0;
    await withServer({
      apiKey: "TEST_ONLY_KEY",
      fetcher: async () => { count++; return { ok: true, json: async () => ({ items: [] }) }; },
    }, async (url) => {
      assert.equal((await search(url, "a", { origin: "https://untrusted.example" })).status, 403);
      const withoutHeader = await fetch(url + "/api/youtube/discover", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "a", order: "relevance" }),
      });
      assert.equal(withoutHeader.status, 403);
      assert.equal(count, 0);
    });
  });
  it("sends only bounded official video search upstream and does not expose key", async () => {
    const calls = [];
    await withServer({
      apiKey: "SECRET_LOCAL_TEST",
      fetcher: async (url, init) => {
        calls.push({ url, init });
        return { ok: true, json: async () => ({ items: [mockVideo(), mockVideo()] }) };
      },
      now: () => Date.parse("2026-11-09T12:00:00Z"),
    }, async (url) => {
      const { status, body } = await search(url, "  독일 와인  ");
      assert.equal(status, 200);
      assert.equal(body.query, "독일 와인");
      assert.equal(body.videos.length, 1);
      assert.equal(body.videos[0].videoUrl, "https://www.youtube.com/watch?v=AbCdefghI12");
      assert.equal(body.videos[0].thumbnailUrl, "https://i.ytimg.com/vi/AbCdefghI12/mqdefault.jpg");
      assert.equal(JSON.stringify(body).includes("SECRET_LOCAL_TEST"), false);
    });
    assert.equal(calls.length, 1);
    const upstream = new URL(calls[0].url);
    assert.equal(upstream.hostname, "www.googleapis.com");
    assert.equal(upstream.pathname, "/youtube/v3/search");
    assert.equal(upstream.searchParams.get("q"), "독일 와인");
    assert.equal(upstream.searchParams.get("maxResults"), "10");
    assert.equal(upstream.searchParams.get("type"), "video");
    assert.equal(calls[0].init.redirect, "error");
  });
  it("caps local requests per day and does not leak upstream failures", async () => {
    let calls = 0;
    await withServer({
      apiKey: "TEST_ONLY_KEY",
      dailyLimit: 1,
      fetcher: async () => {
        calls++;
        return { ok: false, status: 403 };
      },
    }, async (url) => {
      const a = await search(url, "test");
      const b = await search(url, "again");
      assert.deepEqual([a.status, a.body.code], [502, "YOUTUBE_REQUEST_FAILED"]);
      assert.deepEqual([b.status, b.body.code], [429, "LOCAL_DAILY_LIMIT"]);
      assert.equal(calls, 1);
    });
  });
  it("refuses external thumbnail host and invalid video IDs", () => {
    const good = mockVideo();
    good.snippet.thumbnails.medium.url = "https://attacker.example/track";
    const result = normalizeSearchItems({
      items: [good, mockVideo("not-valid-id-value")],
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].thumbnailUrl, null);
  });
});
