import { describe, expect, it, vi } from "vitest";
import { collectPublicVideoComments } from "./youtubeCommentClient";

const videoId = "AbCdefghI12";
const comment = {
  id: "Ug.x1", videoId, videoTitle: "예시 영상", channelId: "UCabc",
  channelName: "예시 채널", publishedAt: "2026-11-09T09:00:00Z",
  text: "영상 속 와인 이야기를 봤어요",
};
const valid = {
  kind: "YOUTUBE_PUBLIC_TOP_LEVEL_COMMENTS_V1",
  source: "YOUTUBE_DATA_API_COMMENT_THREADS",
  scope: "FIRST_PAGE_TOP_LEVEL_MAX_100",
  order: "time",
  query: "와인",
  videoId, videoTitle: "예시 영상", channelId: "UCabc", channelTitle: "예시 채널",
  fetchedAt: "2026-11-09T10:00:00Z",
  sampledCount: 1, skipped: 0, truncated: 0, hasMore: true,
  comments: [comment],
};

describe("G2-M public comment client", () => {
  it("collects only on explicit call, without a browser-side API key", async () => {
    const mock = vi.fn(async () => ({ ok: true, json: async () => valid }));
    const r = await collectPublicVideoComments(videoId, " 와인 ", undefined,
      mock as unknown as typeof fetch);
    expect(r.kind).toBe("READY");
    if (r.kind === "READY") expect(r.sample.comments).toEqual([comment]);
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/youtube/comments");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ videoId }));
    expect(JSON.stringify(init)).not.toContain("API_KEY");
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("does not expose upstream error content or credentials", async () => {
    const mock = vi.fn(async () => ({
      ok: false, json: async () => ({ code: "VIDEO_SAMPLE_LIMIT", sensitive: "secret-key" }),
    }));
    const r = await collectPublicVideoComments(videoId, "와인", undefined,
      mock as unknown as typeof fetch);
    expect(r.kind).toBe("ERROR");
    expect(JSON.stringify(r)).not.toContain("secret-key");
    if (r.kind === "ERROR") expect(r.message).toContain("최대 3개 영상");
  });
  it("rejects corrupt or mismatched response metadata and duplicate comments", async () => {
    for (const payload of [
      { ...valid, query: "다른 검색어" },
      { ...valid, videoId: "BCdefghI123" },
      { ...valid, sampledCount: 2 },
      { ...valid, comments: [comment, comment], sampledCount: 2 },
    ]) {
      const request = vi.fn(async () => ({ ok: true, json: async () => payload }));
      const r = await collectPublicVideoComments(videoId, "와인", undefined,
        request as unknown as typeof fetch);
      expect(r.kind).toBe("ERROR");
    }
  });
  it("rejects invalid user inputs without network calls", async () => {
    const mock = vi.fn();
    expect((await collectPublicVideoComments(videoId, "", undefined,
      mock as unknown as typeof fetch)).kind).toBe("ERROR");
    expect((await collectPublicVideoComments("bad", "와인", undefined,
      mock as unknown as typeof fetch)).kind).toBe("ERROR");
    expect(mock).not.toHaveBeenCalled();
  });
});
