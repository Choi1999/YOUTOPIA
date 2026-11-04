import { describe, expect, it } from "vitest";

import { createAnalysisTarget } from "../../analysis-target/analysisTarget";
import { demoReadySnapshot } from "../data/demoReadySnapshot";
import { demoComparisonSnapshot } from "../data/demoComparisonSnapshot";
import { projectDemoAnalysisSnapshot } from "./analysisProjection";
import { deriveComparisonHighlights } from "./comparisonHighlights";
import { compareVideoProjections } from "./videoComparison";

function project(input: typeof demoReadySnapshot) {
  const target = createAnalysisTarget("VIDEO", input.target.targetId);
  if (!target) throw new Error("BAD_TEST_VIDEO");
  const projected = projectDemoAnalysisSnapshot(input, target);
  if (projected.kind !== "PROJECTED") throw new Error("BAD_FIXTURE");
  return projected.web;
}

const a = project(demoReadySnapshot);
const b = project(demoComparisonSnapshot);

describe("YU-36 — 검증된 합성 영상 비교 결과의 기술적 차이", () => {
  it("감성은 영상 B - A의 퍼센트포인트로 표현하며 상대 증가율로 해석하지 않는다", () => {
    const summary = deriveComparisonHighlights(compareVideoProjections(a, b));
    expect(summary?.sentiments).toEqual([
      { key: "positivePercent", label: "긍정", leftPercent: 62.5, rightPercent: 40, deltaPp: -22.5 },
      { key: "neutralPercent", label: "중립", leftPercent: 25, rightPercent: 35, deltaPp: 10 },
      { key: "negativePercent", label: "부정", leftPercent: 12.5, rightPercent: 25, deltaPp: 12.5 },
    ]);
    expect(summary?.largestSentiment.label).toBe("긍정");
    expect(summary?.largestSentiment.deltaPp).toBe(-22.5);
  });

  it("주제는 다중 라벨이므로 건수(B - A) 차이만 계산한다", () => {
    const summary = deriveComparisonHighlights(compareVideoProjections(a, b));
    expect(summary?.topTopicDifferences).toEqual([
      { topicId: "PRICE", leftCount: 22, rightCount: 35, deltaCount: 13 },
      { topicId: "RECIPE", leftCount: 38, rightCount: 25, deltaCount: -13 },
      { topicId: "DELIVERY", leftCount: 0, rightCount: 12, deltaCount: 12 },
    ]);
  });

  it("영상 순서를 반대로 하면 부호도 반전된다", () => {
    const summary = deriveComparisonHighlights(compareVideoProjections(b, a));
    expect(summary?.largestSentiment.deltaPp).toBe(22.5);
    expect(summary?.topTopicDifferences.find(x => x.topicId === "PRICE")?.deltaCount).toBe(-13);
  });

  it("감성 분포가 같으면 0%p로 처리한다", () => {
    const adjusted = { ...b, sentimentPercent: a.sentimentPercent };
    const summary = deriveComparisonHighlights(compareVideoProjections(a, adjusted));
    expect(summary?.sentiments.map(x => x.deltaPp)).toEqual([0, 0, 0]);
    expect(summary?.largestSentiment.deltaPp).toBe(0);
  });

  it("두 스냅샷의 관측 범위가 다르면 차이 요약 자체를 만들지 않는다", () => {
    const incompatible = { ...b, observationScope: { ...b.observationScope, locale: "en-US" } };
    const compare = compareVideoProjections(a, incompatible);
    expect(compare.kind).toBe("BLOCKED");
    expect(deriveComparisonHighlights(compare)).toBeNull();
  });

  it("부분 분석 데이터의 비교가 차단되면 어떤 퍼센트포인트도 생성하지 않는다", () => {
    const partial = { ...b, status: "PARTIAL" as const };
    expect(deriveComparisonHighlights(compareVideoProjections(a, partial))).toBeNull();
  });
});
