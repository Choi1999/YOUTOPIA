import { describe, expect, it } from "vitest";

import { createAnalysisTarget } from "../../analysis-target/analysisTarget";
import { demoReadySnapshot } from "../data/demoReadySnapshot";
import { demoComparisonSnapshot } from "../data/demoComparisonSnapshot";
import type { AnalysisSnapshot } from "./analysisSnapshot";
import {
  projectDemoAnalysisSnapshot,
  type WebDetailProjection,
} from "./analysisProjection";
import { compareVideoProjections } from "./videoComparison";

function web(snapshot: AnalysisSnapshot): WebDetailProjection {
  const target = createAnalysisTarget("VIDEO", snapshot.target.targetId);
  if (!target) throw new Error("TEST_TARGET_INVALID");
  const result = projectDemoAnalysisSnapshot(snapshot, target);
  if (result.kind !== "PROJECTED") {
    throw new Error("TEST_PROJECTION_REJECTED");
  }
  return result.web;
}

const a = web(demoReadySnapshot);
const b = web(demoComparisonSnapshot);

describe("YU-35 — 독립 검증된 합성 영상 비교 계약", () => {
  it("정확히 두 READY fixture의 감성 비율과 주제별 언급량만 비교한다", () => {
    const result = compareVideoProjections(a, b);
    expect(result.kind).toBe("READY");
    if (result.kind !== "READY") return;
    expect(result.left.target.targetId).toBe("Ab0_-123xyz");
    expect(result.right.target.targetId).toBe("Qb0_-123xyz");
    expect(result.left.sentimentPercent?.positivePercent).toBe(62.5);
    expect(result.right.sentimentPercent?.positivePercent).toBe(40);
    expect(result.topics).toEqual([
      { topicId: "RECIPE", leftCount: 38, rightCount: 25 },
      { topicId: "PRICE", leftCount: 22, rightCount: 35 },
      { topicId: "DELIVERY", leftCount: 0, rightCount: 12 },
    ]);
  });

  it("기존 실제 출처 검증 함수를 거친 두 번째 합성 fixture를 허용한다", () => {
    expect(b.provenance).toEqual({
      sourceType: "STATIC_FIXTURE",
      isSynthetic: true,
      visibility: "PUBLIC_REUSABLE",
      tenantId: null,
    });
    expect(b.sentimentPercent?.denominator).toBe(80);
  });

  it("같은 ID의 자기 비교는 거절한다", () => {
    expect(compareVideoProjections(a, a)).toEqual({
      kind: "BLOCKED", reason: "SAME_TARGET",
    });
  });

  it("합성 표시 모델의 출처가 변조되면 거절한다", () => {
    const forged = {
      ...b,
      provenance: { ...b.provenance, isSynthetic: false },
    } as unknown as WebDetailProjection;
    expect(compareVideoProjections(a, forged)).toEqual({
      kind: "BLOCKED", reason: "UNTRUSTED_SOURCE",
    });
  });

  it("PARTIAL 결과는 검증된 비율이 있어도 직접 비교하지 않는다", () => {
    const partial = web({ ...demoComparisonSnapshot, status: "PARTIAL" });
    expect(partial.sentimentPercent).not.toBeNull();
    expect(compareVideoProjections(a, partial)).toEqual({
      kind: "BLOCKED", reason: "INSUFFICIENT_DATA",
    });
  });

  it("STALE 결과는 이전 분석 수치로 비교하지 않는다", () => {
    const stale = web({ ...demoComparisonSnapshot, status: "STALE" });
    expect(stale.sentimentPercent).toBeNull();
    expect(compareVideoProjections(a, stale)).toEqual({
      kind: "BLOCKED", reason: "INSUFFICIENT_DATA",
    });
  });

  it("NO_DATA는 비교 수치를 만들지 않는다", () => {
    const noData = web({
      ...demoComparisonSnapshot, status: "NO_DATA",
      sample: null, sentiment: null, topics: [], analyzedAt: null,
    });
    expect(compareVideoProjections(a, noData)).toEqual({
      kind: "BLOCKED", reason: "INSUFFICIENT_DATA",
    });
  });

  it("관측 기간이 서로 다르면 비교를 막는다", () => {
    const shifted = web({
      ...demoComparisonSnapshot,
      scope: {
        ...demoComparisonSnapshot.scope,
        windowEnd: "2026-10-09T00:00:00+09:00",
      },
    });
    expect(compareVideoProjections(a, shifted)).toEqual({
      kind: "BLOCKED", reason: "OBSERVATION_MISMATCH",
    });
  });

  it("지역·언어가 다르면 비교를 막는다", () => {
    const changed = web({
      ...demoComparisonSnapshot,
      scope: { ...demoComparisonSnapshot.scope, locale: "en-US" },
    });
    expect(compareVideoProjections(a, changed)).toEqual({
      kind: "BLOCKED", reason: "OBSERVATION_MISMATCH",
    });
  });

  it("분석 시점이 다르면 비율 차이를 계산하지 않는다", () => {
    const updated = web({
      ...demoComparisonSnapshot,
      analyzedAt: "2026-10-08T10:20:00+09:00",
    });
    expect(compareVideoProjections(a, updated)).toEqual({
      kind: "BLOCKED", reason: "ANALYSIS_TIME_MISMATCH",
    });
  });

  it("관측 시점이 다르면 비교를 막는다", () => {
    const updated = web({
      ...demoComparisonSnapshot,
      observedAt: "2026-10-08T09:11:00+09:00",
    });
    expect(compareVideoProjections(a, updated)).toEqual({
      kind: "BLOCKED", reason: "ANALYSIS_TIME_MISMATCH",
    });
  });

  it("분석 알고리즘 또는 분류 버전 차이를 차단한다", () => {
    for (const changed of [
      { analysisVersion: "mock-1" },
      { topicTaxonomyVersion: "mock-1" },
    ]) {
      const different = web({ ...demoComparisonSnapshot, ...changed });
      expect(compareVideoProjections(a, different)).toEqual({
        kind: "BLOCKED", reason: "VERSION_MISMATCH",
      });
    }
  });

  it("분류·적격 표본 크기가 다르면 직접 언급량 비교를 막는다", () => {
    const diff = web({
      ...demoComparisonSnapshot,
      sample: {
        rawCount: 130, eligibleCount: 110, excludedCount: 20,
        classifiedCount: 80, unclassifiedCount: 30,
      },
    });
    expect(compareVideoProjections(a, diff)).toEqual({
      kind: "BLOCKED", reason: "SAMPLE_MISMATCH",
    });
  });
});
