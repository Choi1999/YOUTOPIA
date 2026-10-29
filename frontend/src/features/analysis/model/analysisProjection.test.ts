
import { describe, expect, it } from "vitest";

import { demoReadySnapshot } from "../data/demoReadySnapshot";
import { projectDemoAnalysisSnapshot } from "./analysisProjection";

const target = demoReadySnapshot.target;

function project(input: unknown = demoReadySnapshot) {
  return projectDemoAnalysisSnapshot(input, target);
}

function unavailableSnapshot(status: "NO_DATA" | "POLICY_BLOCKED") {
  return {
    ...demoReadySnapshot,
    status,
    sample: null,
    sentiment: null,
    topics: [],
    observedAt: null,
    analyzedAt: null,
    analysisVersion: null,
    topicTaxonomyVersion: null,
  };
}

describe("Analysis Projection", () => {
  it("READY에서 Hover와 Web의 동일한 감성 비율을 생성한다", () => {
    const result = project();

    expect(result.kind).toBe("PROJECTED");
    if (result.kind !== "PROJECTED") return;

    expect(result.hover.snapshotId).toBe(
      demoReadySnapshot.snapshotId,
    );

    expect(result.hover.target).toEqual(result.web.target);
    expect(result.hover.observationScope).toEqual(
      result.web.observationScope,
    );

    expect(result.hover.sentimentPercent).toEqual(
      result.web.sentimentPercent,
    );

    expect(result.hover.sentimentPercent).toMatchObject({
      denominator: 80,
      positivePercent: 62.5,
      neutralPercent: 25,
      negativePercent: 12.5,
    });

    expect(result.web.sample?.rawCount).toBe(120);
    expect(result.web.sentimentCounts?.positive).toBe(50);

    expect(result.hover.valueSemantics).toBe(
      "SNAPSHOT_DERIVED_SYNTHETIC",
    );

    expect(result.hover.provenance.isSynthetic).toBe(true);
  });

  it("PARTIAL에서도 확인된 45건만 분모로 사용한다", () => {
    const result = project({
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
      topics: [{
        topicId: "RECIPE",
        mentionCount: 25,
        classifiedTopicCount: 21,
        negativeTopicCount: 2,
      }],
    });

    expect(result.kind).toBe("PROJECTED");
    if (result.kind !== "PROJECTED") return;

    expect(result.hover.status).toBe("PARTIAL");
    expect(result.hover.sentimentPercent?.denominator).toBe(45);
    expect(
      result.hover.sentimentPercent?.positivePercent,
    ).toBeCloseTo(44.4444, 3);
  });

  it("PARTIAL의 분모가 미확정이면 비율을 생성하지 않는다", () => {
    const result = project({
      ...demoReadySnapshot,
      status: "PARTIAL",
      sample: {
        rawCount: 120,
        eligibleCount: 100,
        excludedCount: 20,
        classifiedCount: null,
        unclassifiedCount: null,
      },
    });

    expect(result.kind).toBe("PROJECTED");
    if (result.kind !== "PROJECTED") return;

    expect(result.hover.sentimentPercent).toBeNull();
    expect(result.web.sentimentPercent).toBeNull();
    expect(result.hover.topTopics).toEqual([]);
  });

  it("NO_DATA는 감성 수치와 주제를 제공하지 않는다", () => {
    const result = project(unavailableSnapshot("NO_DATA"));

    expect(result.kind).toBe("PROJECTED");
    if (result.kind !== "PROJECTED") return;

    expect(result.hover.status).toBe("NO_DATA");
    expect(result.hover.sentimentPercent).toBeNull();
    expect(result.web.sample).toBeNull();
    expect(result.web.sentimentCounts).toBeNull();
    expect(result.web.topics).toEqual([]);
  });

  it("POLICY_BLOCKED 결과에서도 분석 수치를 숨긴다", () => {
    const result = project(unavailableSnapshot("POLICY_BLOCKED"));

    expect(result.kind).toBe("PROJECTED");
    if (result.kind !== "PROJECTED") return;

    expect(result.hover.status).toBe("POLICY_BLOCKED");
    expect(result.hover.sentimentPercent).toBeNull();
    expect(result.hover.topTopics).toEqual([]);
    expect(result.web.sentimentPercent).toBeNull();
  });

  it("STALE은 보수적으로 감성 비율을 숨긴다", () => {
    const result = project({
      ...demoReadySnapshot,
      status: "STALE",
    });

    expect(result.kind).toBe("PROJECTED");
    if (result.kind !== "PROJECTED") return;

    expect(result.hover.status).toBe("STALE");
    expect(result.hover.sentimentPercent).toBeNull();
    expect(result.web.sentimentPercent).toBeNull();
    expect(result.web.analyzedAt).toBe(
      demoReadySnapshot.analyzedAt,
    );
  });

  it("모순된 표본을 Projection 전에 거부한다", () => {
    const result = project({
      ...demoReadySnapshot,
      sample: {
        ...demoReadySnapshot.sample,
        rawCount: 121,
      },
    });

    expect(result).toEqual({
      kind: "REJECTED",
      reason: "INVALID_SNAPSHOT",
    });
  });

  it("요청 영상과 다른 영상 또는 잘못된 요청 대상을 거부한다", () => {
    const wrongTarget = {
      source: "YOUTUBE" as const,
      targetType: "VIDEO" as const,
      targetId: "Zb0_-123xyz",
    };

    expect(
      projectDemoAnalysisSnapshot(demoReadySnapshot, wrongTarget),
    ).toEqual({
      kind: "REJECTED",
      reason: "TARGET_MISMATCH",
    });

    const invalidTarget = {
      ...wrongTarget,
      targetId: "invalid",
    };

    expect(
      projectDemoAnalysisSnapshot(demoReadySnapshot, invalidTarget),
    ).toEqual({
      kind: "REJECTED",
      reason: "INVALID_TARGET",
    });
  });

  it("실제 제공자 데이터를 현 데모에서 거부한다", () => {
    const result = project({
      ...demoReadySnapshot,
      sourceType: "APPROVED_PROVIDER",
      isSynthetic: false,
    });

    expect(result).toEqual({
      kind: "REJECTED",
      reason: "DEMO_SCOPE_ONLY",
    });
  });

  it("테넌트 비공개 데이터를 현 데모에서 거부한다", () => {
    const result = project({
      ...demoReadySnapshot,
      visibility: "TENANT_PRIVATE",
      tenantId: "tenant-a",
    });

    expect(result).toEqual({
      kind: "REJECTED",
      reason: "DEMO_SCOPE_ONLY",
    });
  });

  it("ILLUSTRATIVE_ONLY Preview를 분석 스냅샷으로 취급하지 않는다", () => {
    const result = project({
      target,
      positive: 45,
      neutral: 35,
      negative: 20,
      previewContract: {
        valueSemantics: "ILLUSTRATIVE_ONLY",
      },
    });

    expect(result).toEqual({
      kind: "REJECTED",
      reason: "INVALID_SNAPSHOT",
    });
  });

  it("Projection 결과는 원본 객체 변경과 분리된다", () => {
    const input = {
      ...demoReadySnapshot,
      target: { ...demoReadySnapshot.target },
      observationScope: { ...demoReadySnapshot.scope },
      scope: { ...demoReadySnapshot.scope },
      topics: demoReadySnapshot.topics.map((topic) => ({
        ...topic,
      })),
    };

    // AnalysisSnapshot에는 없는 필드는 입력 검증에서 거부하므로 제거한다.
    const { observationScope: _unused, ...validInput } = input;
    void _unused;

    const result = project(validInput);

    expect(result.kind).toBe("PROJECTED");
    if (result.kind !== "PROJECTED") return;

    validInput.target.targetId = "Zb0_-123xyz";
    validInput.scope.locale = "en-US";

    const firstTopic = validInput.topics[0];
    if (firstTopic) firstTopic.mentionCount = 999;

    expect(result.hover.target.targetId).toBe("Ab0_-123xyz");
    expect(result.hover.observationScope.locale).toBe("ko-KR");
    expect(result.web.topics[0]?.mentionCount).toBe(38);
  });
});
