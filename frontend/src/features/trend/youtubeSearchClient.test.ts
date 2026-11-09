import { describe, expect, it, vi } from "vitest";
import { searchPublicYoutubeVideos } from "./youtubeSearchClient";

const video = {
  videoId: "AbCdefghI12",
  title: "An actual candidate",
  channelId: "Channel123",
  channelTitle: "Video channel",
  publishedAt: "2026-11-09T00:00:00Z",
  thumbnailUrl: "https://i.ytimg.com/vi/AbCdefghI12/mqdefault.jpg",
  videoUrl: "https://www.youtube.com/watch?v=AbCdefghI12",
};

describe("G2-L explicit public video search client", () => {
  it("passes the user's literal free keyword to a same-origin bounded endpoint", async () => {
    const mock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        kind: "YOUTUBE_PUBLIC_VIDEO_SEARCH_V1",
        source: "YOUTUBE_DATA_API_SEARCH",
        query: "독일 와인",
        fetchedAt: "2026-11-09T00:00:00Z",
        videos: [video],
      }),
    }));
    const result = await searchPublicYoutubeVideos(
      "  독일 와인 ", "relevance", undefined, mock as unknown as typeof fetch);
    expect(result.kind).toBe("READY");
    const [url, options] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/youtube/discover");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ query: "독일 와인", order: "relevance" }));
    expect(JSON.stringify(options)).not.toContain("API_KEY");
  });

  it("shows safe connection errors without echoing backend error bodies", async () => {
    const mock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ kind: "ERROR", code: "NOT_CONFIGURED", detail: "SECRET" }),
    }));
    const result = await searchPublicYoutubeVideos(
      "test", "relevance", undefined, mock as unknown as typeof fetch);
    expect(result.kind).toBe("ERROR");
    expect(JSON.stringify(result)).not.toContain("SECRET");
    if (result.kind === "ERROR") expect(result.message).toContain("API 키");
  });

  it("rejects forged video links and too many results", async () => {
    const mock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        kind: "YOUTUBE_PUBLIC_VIDEO_SEARCH_V1", source: "YOUTUBE_DATA_API_SEARCH",
        query: "test", fetchedAt: "2026-11-09T00:00:00Z",
        videos: [{ ...video, videoUrl: "https://other.example" }],
      }),
    }));
    const result = await searchPublicYoutubeVideos(
      "test", "date", undefined, mock as unknown as typeof fetch);
    expect(result.kind).toBe("ERROR");
  });

  it("does not call transport for invalid user keywords", async () => {
    const mock = vi.fn();
    expect((await searchPublicYoutubeVideos(" ", "relevance", undefined,
      mock as unknown as typeof fetch)).kind).toBe("ERROR");
    expect(mock).not.toHaveBeenCalled();
  });
});
