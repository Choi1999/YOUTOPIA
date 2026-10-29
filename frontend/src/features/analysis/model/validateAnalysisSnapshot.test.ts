
import { describe, expect, it } from "vitest";

import { demoReadySnapshot } from "../data/demoReadySnapshot";
import { validateAnalysisSnapshot } from "./validateAnalysisSnapshot";

describe("AnalysisSnapshot 런타임 검증", () => {
  it("정상 READY 합성 데이터를 허용한다", () => {
    const result = validateAnalysisSnapshot(demoReadySnapshot);

    expect(result.kind).toBe("VALID");
  });

  it("정상 PARTIAL 데이터를 허용한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      status: "PARTIAL",
    });

    expect(result.kind).toBe("VALID");
  });

  it("정상 NO_DATA를 허용한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      status: "NO_DATA",
      sample: null,
      sentiment: null,
      topics: [],
      observedAt: null,
      analyzedAt: null,
      analysisVersion: null,
      topicTaxonomyVersion: null,
    });

    expect(result.kind).toBe("VALID");
  });

  it("알 수 없는 추가 필드를 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      unexpectedField: true,
    });

    expect(result).toEqual({
      kind: "INVALID",
      reason: "STRUCTURE",
    });
  });

  it("잘못된 영상 ID를 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      target: {
        ...demoReadySnapshot.target,
        targetId: "@unresolved",
      },
    });

    expect(result.kind).toBe("INVALID");
  });

  it("표본 건수가 모순되면 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      sample: {
        ...demoReadySnapshot.sample,
        rawCount: 121,
      },
    });

    expect(result).toEqual({
      kind: "INVALID",
      reason: "COUNTS",
    });
  });

  it("주제의 부정 건수가 분류 건수보다 크면 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      topics: [
        {
          topicId: "RECIPE",
          mentionCount: 30,
          classifiedTopicCount: 20,
          negativeTopicCount: 21,
        },
      ],
    });

    expect(result.kind).toBe("INVALID");
  });

  it("관측 종료일이 시작일 이전이면 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      scope: {
        ...demoReadySnapshot.scope,
        windowStart: "2026-10-09T00:00:00+09:00",
      },
    });

    expect(result).toEqual({
      kind: "INVALID",
      reason: "SCOPE",
    });
  });

  it("실제 제공자 표기와 합성 플래그가 모순되면 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      sourceType: "APPROVED_PROVIDER",
      isSynthetic: true,
    });

    expect(result).toEqual({
      kind: "INVALID",
      reason: "PROVENANCE",
    });
  });

  it("테넌트 정보가 없는 비공개 데이터는 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      visibility: "TENANT_PRIVATE",
      tenantId: null,
    });

    expect(result.kind).toBe("INVALID");
  });

  it("정책 차단 상태에 분석 표본이 포함되면 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      status: "POLICY_BLOCKED",
    });

    expect(result).toEqual({
      kind: "INVALID",
      reason: "STATE",
    });
  });

  it("잘못된 달력 날짜를 거부한다", () => {
    const result = validateAnalysisSnapshot({
      ...demoReadySnapshot,
      observedAt: "2026-02-30T09:10:00+09:00",
    });

    expect(result.kind).toBe("INVALID");
  });
});
