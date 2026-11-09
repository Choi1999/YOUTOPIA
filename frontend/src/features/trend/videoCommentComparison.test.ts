import { describe, expect, it } from "vitest";
import { compareVideoCommentSamples } from "./videoCommentComparison";
import type { CollectedCommentSample } from "./youtubeCommentClient";

const data: CollectedCommentSample[] = [
  {
    videoId: "AbCdefghI12", videoTitle: "영상 A", channelId: "chA",
    channelTitle: "채널 A", query: "와인", fetchedAt: "2026-11-09T12:00:00Z",
    sampledCount: 3, skipped: 0, truncated: 0, hasMore: true,
    comments: [
      { id: "x1", videoId: "AbCdefghI12", videoTitle: "영상 A",
        channelId: "chA", channelName: "채널 A", publishedAt: "2026-11-08T00:00:00Z", text: "와인 가격" },
      { id: "x2", videoId: "AbCdefghI12", videoTitle: "영상 A",
        channelId: "chA", channelName: "채널 A", publishedAt: "2026-11-08T12:00:00Z", text: "와인 향" },
      { id: "x3", videoId: "AbCdefghI12", videoTitle: "영상 A",
        channelId: "chA", channelName: "채널 A", publishedAt: "2026-10-01T00:00:00Z", text: "와인 산지" },
    ],
  },
  {
    videoId: "BCdefghI123", videoTitle: "영상 B", channelId: "chB",
    channelTitle: "채널 B", query: "와인", fetchedAt: "2026-11-09T12:00:00Z",
    sampledCount: 2, skipped: 0, truncated: 0, hasMore: false,
    comments: [
      { id: "y1", videoId: "BCdefghI123", videoTitle: "영상 B",
        channelId: "chB", channelName: "채널 B", publishedAt: "2026-11-08T00:00:00Z", text: "와인 이야기" },
      { id: "y2", videoId: "BCdefghI123", videoTitle: "영상 B",
        channelId: "chB", channelName: "채널 B", publishedAt: "2026-11-08T12:00:00Z", text: "다른 이야기" },
    ],
  },
];

describe("G2-M selected-video comment sample comparison", () => {
  it("compares matching shares with per-video sample denominators", () => {
    const result = compareVideoCommentSamples("와인", data, "2026-11-01", "2026-11-09");
    expect(result.map(({ keywordMatches, periodTotal, matchPercent }) =>
      [keywordMatches, periodTotal, matchPercent])).toEqual([[2, 2, 100], [1, 2, 50]]);
    expect(result[0].sampledTotal).toBe(3);
    expect(result[0].hasMore).toBe(true);
  });
  it("never turns an unobserved date into a fabricated ratio", () => {
    const result = compareVideoCommentSamples("와인", data, "2026-10-15", "2026-10-20");
    expect(result[0].matchPercent).toBeNull();
    expect(result[1].matchPercent).toBeNull();
    expect(result[0].keywordMatches).toBe(0);
  });
  it("preserves the user's literal query and refuses invalid date bounds", () => {
    expect(compareVideoCommentSamples("", data, "2026-11-01", "2026-11-09")).toEqual([]);
    expect(compareVideoCommentSamples("와인", data, "2026-11-09", "2026-11-01")).toEqual([]);
  });
});
