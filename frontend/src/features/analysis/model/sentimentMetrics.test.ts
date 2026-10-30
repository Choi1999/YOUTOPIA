
import { describe, expect, it } from "vitest";

import { demoReadySnapshot } from "../data/demoReadySnapshot";
import type { AnalysisSnapshot } from "./analysisSnapshot";
import { deriveSentimentMetrics } from "./sentimentMetrics";

function withSample(
  changes: Partial<NonNullable<AnalysisSnapshot["sample"]>>,
): AnalysisSnapshot {
  const sample = demoReadySnapshot.sample;

  if (!sample) {
    throw new Error("READY 테스트 fixture에 표본이 없습니다.");
  }

  return {
    ...demoReadySnapshot,
    sample: { ...sample, ...changes },
  };
}

describe("감성 분석 분모 검증", () => {
  it("READY의 감성 비율은 classifiedCount 80을 분모로 한다", () => {
    const result = deriveSentimentMetrics(demoReadySnapshot);

    expect(result.kind).toBe("AVAILABLE");
    if (result.kind !== "AVAILABLE") return;

    expect(result.denominator).toBe(80);
    expect(result.positivePercent).toBe(62.5);
    expect(result.neutralPercent).toBe(25);
    expect(result.negativePercent).toBe(12.5);
    expect(result.classificationCoveragePercent).toBe(80);
  });

  it("PARTIAL도 확인된 분류 표본을 분모로 한다", () => {
    const snapshot: AnalysisSnapshot = {
      ...demoReadySnapshot,
      status: "PARTIAL",
      sample: {
        rawCount: 75,
        eligibleCount: 60,
        excludedCount: 15,
        classifiedCount: 45,
        unclassifiedCount: 15,
      },
      sentiment: {
        positive: 20,
        neutral: 15,
        negative: 10,
      },
    };

    const result = deriveSentimentMetrics(snapshot);

    expect(result.kind).toBe("AVAILABLE");
    if (result.kind !== "AVAILABLE") return;

    expect(result.denominator).toBe(45);
    expect(result.positivePercent).toBeCloseTo(44.4444, 3);
  });

  it("원시 댓글과 적격·제외 건수가 불일치하면 거부한다", () => {
    const result = deriveSentimentMetrics(
      withSample({ rawCount: 121 }),
    );

    expect(result).toEqual({
      kind: "UNAVAILABLE",
      reason: "COUNT_MISMATCH",
    });
  });

  it("분류·미분류 건수의 합이 틀리면 거부한다", () => {
    const result = deriveSentimentMetrics(
      withSample({ unclassifiedCount: 21 }),
    );

    expect(result.kind).toBe("UNAVAILABLE");
  });

  it("감성 건수 합계가 분모와 다르면 거부한다", () => {
    const result = deriveSentimentMetrics({
      ...demoReadySnapshot,
      sentiment: {
        positive: 51,
        neutral: 20,
        negative: 10,
      },
    });

    expect(result).toEqual({
      kind: "UNAVAILABLE",
      reason: "COUNT_MISMATCH",
    });
  });

  it("미확정 분모는 0으로 간주하지 않는다", () => {
    const result = deriveSentimentMetrics(
      withSample({ classifiedCount: null }),
    );

    expect(result).toEqual({
      kind: "UNAVAILABLE",
      reason: "DENOMINATOR_UNKNOWN",
    });
  });

  it("분모가 0이면 감성 비율을 계산하지 않는다", () => {
    const snapshot: AnalysisSnapshot = {
      ...demoReadySnapshot,
      sample: {
        rawCount: 0,
        eligibleCount: 0,
        excludedCount: 0,
        classifiedCount: 0,
        unclassifiedCount: 0,
      },
      sentiment: {
        positive: 0,
        neutral: 0,
        negative: 0,
      },
    };

    expect(deriveSentimentMetrics(snapshot)).toEqual({
      kind: "UNAVAILABLE",
      reason: "ZERO_DENOMINATOR",
    });
  });

  it("원시 건수가 미확정이어도 확인된 분모는 사용할 수 있다", () => {
    const result = deriveSentimentMetrics(
      withSample({
        rawCount: null,
        excludedCount: null,
      }),
    );

    expect(result.kind).toBe("AVAILABLE");
  });

  it("음수 건수는 거부한다", () => {
    const result = deriveSentimentMetrics(
      withSample({ rawCount: -1 }),
    );

    expect(result).toEqual({
      kind: "UNAVAILABLE",
      reason: "INVALID_COUNT",
    });
  });

  it("정책 차단 상태에서는 감성 비율을 반환하지 않는다", () => {
    const result = deriveSentimentMetrics({
      ...demoReadySnapshot,
      status: "POLICY_BLOCKED",
      sample: null,
      sentiment: null,
      topics: [],
    });

    expect(result).toEqual({
      kind: "UNAVAILABLE",
      reason: "STATUS_UNAVAILABLE",
    });
  });
});
