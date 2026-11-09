import { describe, expect, it } from "vitest";
import {
  addRelatedExpression, analyzeExpandedKeyword, expressionExamples,
  normalizeRelatedExpression, MAX_RELATED_EXPRESSIONS,
} from "./relatedKeywordAnalysis";
import { inspectKeyword, type Observation } from "./userKeywordTrend";

const rows: Observation[] = [
  { id: "c1", videoId: "v1", videoTitle: "영상 1", channelId: "ch1",
    channelName: "채널 1", publishedAt: "2026-11-07T09:00:00Z",
    text: "음악 정말 좋아요" },
  { id: "c2", videoId: "v1", videoTitle: "영상 1", channelId: "ch1",
    channelName: "채널 1", publishedAt: "2026-11-08T10:00:00Z",
    text: "노래가 너무 좋아요" },
  { id: "c3", videoId: "v2", videoTitle: "영상 2", channelId: "ch2",
    channelName: "채널 2", publishedAt: "2026-11-09T09:00:00Z",
    text: "이 음악과 노래가 좋다" },
  { id: "c4", videoId: "v2", videoTitle: "영상 2", channelId: "ch2",
    channelName: "채널 2", publishedAt: "2026-11-09T11:00:00Z",
    text: "플레이리스트 너무 좋다" },
  { id: "c5", videoId: "v2", videoTitle: "영상 2", channelId: "ch2",
    channelName: "채널 2", publishedAt: "2026-11-09T12:00:00Z",
    text: "오늘 날씨 좋아요" },
];

describe("G2-N manually selected related expressions", () => {
  it("never selects suggested examples automatically or imposes a keyword list", () => {
    expect(expressionExamples("음악")).toEqual(["노래", "플레이리스트", "음원"]);
    expect(expressionExamples("세계 유일한 질문")).toEqual([]);
    expect(normalizeRelatedExpression("  노래   목록 ")).toBe("노래 목록");
  });

  it("rejects duplicate, primary, empty, overly long and over-limit expressions", () => {
    expect(addRelatedExpression("음악", [], "음악").kind).toBe("INVALID");
    expect(addRelatedExpression("음악", [], " ").kind).toBe("INVALID");
    expect(addRelatedExpression("음악", [], "x".repeat(41)).kind).toBe("INVALID");
    expect(addRelatedExpression("음악", ["노래"], " 노래 ").kind).toBe("INVALID");
    expect(addRelatedExpression("음악", ["노래"], "노래").kind).toBe("INVALID");
    const maxTerms = ["가", "나", "다", "라", "마"];
    expect(maxTerms).toHaveLength(MAX_RELATED_EXPRESSIONS);
    expect(addRelatedExpression("음악", maxTerms, "바").kind).toBe("INVALID");
    expect(addRelatedExpression("음악", ["노래"], "플레이리스트")).toEqual({
      kind: "READY", terms: ["노래", "플레이리스트"],
    });
  });

  it("keeps primary counts unchanged and does not count overlapping comments twice", () => {
    const baseline = inspectKeyword("음악", rows, 7);
    const expanded = analyzeExpandedKeyword("음악", rows, 7, ["노래", "플레이리스트"]);
    expect(baseline.kind).toBe("READY");
    expect(expanded.kind).toBe("READY");
    if (baseline.kind !== "READY" || expanded.kind !== "READY") return;
    expect(baseline.matches).toBe(2);
    expect(expanded.primaryCount).toBe(2);
    expect(expanded.relatedOnlyCount).toBe(2);
    expect(expanded.combinedCount).toBe(4);
    expect(expanded.total).toBe(5);
    expect(expanded.terms).toEqual([
      { term: "노래", matched: 2 }, // includes one primary comment
      { term: "플레이리스트", matched: 1 },
    ]);
    expect(expanded.evidence).toHaveLength(4);
    expect(expanded.evidence.find((x) => x.record.id === "c3"))
      .toMatchObject({ matchType: "PRIMARY", matchedRelatedTerms: ["노래"] });
    expect(expanded.evidence.find((x) => x.record.id === "c4"))
      .toMatchObject({ matchType: "RELATED_ONLY", matchedRelatedTerms: ["플레이리스트"] });
    expect(expanded.videos).toEqual([
      { id: "v1", label: "영상 1", observed: 2, primary: 1, relatedOnly: 1, combined: 2 },
      { id: "v2", label: "영상 2", observed: 3, primary: 1, relatedOnly: 1, combined: 2 },
    ]);
  });

  it("keeps matching dates and sample denominators aligned with the original UTC window", () => {
    const expanded = analyzeExpandedKeyword("음악", rows, 7, ["노래"]);
    if (expanded.kind !== "READY") throw Error("Expected READY");
    expect(expanded.windowStart).toBe("2026-11-03");
    expect(expanded.windowEnd).toBe("2026-11-09");
    expect(expanded.daily.find((x) => x.day === "2026-11-09")).toEqual({
      day: "2026-11-09", observed: 3, primary: 1, relatedOnly: 0, combined: 1,
    });
    expect(expanded.daily.find((x) => x.day === "2026-11-08")).toEqual({
      day: "2026-11-08", observed: 1, primary: 0, relatedOnly: 1, combined: 1,
    });
  });

  it("supports unrestricted primary terms but refuses silently duplicated expansions", () => {
    const expanded = analyzeExpandedKeyword("독일 와인", rows, 30, []);
    expect(expanded.kind).toBe("READY");
    if (expanded.kind === "READY") {
      expect(expanded.combinedCount).toBe(0);
      expect(expanded.primaryCount).toBe(0);
      expect(expanded.selectedTerms).toEqual([]);
    }
    expect(analyzeExpandedKeyword("음악", rows, 30, ["노래", "노래"]).kind)
      .toBe("INVALID");
    expect(analyzeExpandedKeyword("음악", rows, 30, ["음악"]).kind)
      .toBe("INVALID");
    expect(analyzeExpandedKeyword("음악", [], 30, ["노래"]).kind)
      .toBe("NO_DATA");
  });

  it("never treats all-zero days as positive evidence or infers sentiment", () => {
    const expanded = analyzeExpandedKeyword("음악", rows, 7, ["관련 없는 용어"]);
    if (expanded.kind !== "READY") throw Error("Expected READY");
    expect(expanded.relatedOnlyCount).toBe(0);
    expect(expanded.combinedCount).toBe(expanded.primaryCount);
    expect(expanded.daily.find((x) => x.day === "2026-11-03"))
      .toMatchObject({ observed: 0, primary: 0, relatedOnly: 0, combined: 0 });
  });
});
