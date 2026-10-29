
import { describe, expect, it } from "vitest";

import { createAnalysisTarget } from "../../analysis-target/analysisTarget";
import { demoAnalysisRepository } from "./DemoAnalysisRepository";
import { demoReadySnapshot } from "./demoReadySnapshot";

import {
  createDemoHoverSummaryProvider,
} from "./DemoHoverSummaryProvider";

const VIDEO_A = demoReadySnapshot.target;

const VIDEO_B = createAnalysisTarget(
  "VIDEO",
  "Zb0_-123xyz"
);

if (!VIDEO_B) {
  throw new Error("Invalid test target");
}

function withResponse(response: unknown) {
  return createDemoHoverSummaryProvider({
    async getSnapshot() {
      return response;
    },
  });
}

function found(snapshot: unknown) {
  return { kind: "FOUND", snapshot };
}

describe("DemoHoverSummaryProvider", () => {
  it("READY 스냅샷을 검증된 Hover 요약으로 공급한다", async () => {
    const provider = createDemoHoverSummaryProvider(
      demoAnalysisRepository
    );

    const result = await provider.getSummary(VIDEO_A);

    expect(result.kind).toBe("SNAPSHOT");
    if (result.kind !== "SNAPSHOT") return;

    expect(result.summary.valueSemantics).toBe(
      "SNAPSHOT_DERIVED_SYNTHETIC"
    );

    expect(result.summary.snapshotId).toBe(
      "synthetic-one-video-001"
    );

    expect(result.summary.target).toEqual(VIDEO_A);
    expect(result.summary.status).toBe("READY");

    expect(result.summary.sentimentPercent).toMatchObject({
      denominator: 80,
      positivePercent: 62.5,
      neutralPercent: 25,
      negativePercent: 12.5,
    });

    expect(result.summary.topTopics).toEqual([
      { topicId: "RECIPE", mentionCount: 38 },
      { topicId: "PRICE", mentionCount: 22 },
    ]);

    expect(result.summary.provenance).toEqual({
      sourceType: "STATIC_FIXTURE",
      isSynthetic: true,
      visibility: "PUBLIC_REUSABLE",
      tenantId: null,
    });
  });

  it("등록되지 않은 영상은 NOT_FOUND를 유지한다", async () => {
    const provider = createDemoHoverSummaryProvider(
      demoAnalysisRepository
    );

    expect(
      await provider.getSummary(VIDEO_B)
    ).toEqual({ kind: "NOT_FOUND" });
  });

  it("NO_DATA는 NOT_FOUND가 아닌 수치 없는 스냅샷이다", async () => {
    const snapshot = {
      ...demoReadySnapshot,
      status: "NO_DATA",
      sample: null,
      sentiment: null,
      topics: [],
      observedAt: null,
      analyzedAt: null,
      analysisVersion: null,
      topicTaxonomyVersion: null,
    };

    const result = await withResponse(
      found(snapshot)
    ).getSummary(VIDEO_A);

    expect(result.kind).toBe("SNAPSHOT");
    if (result.kind !== "SNAPSHOT") return;

    expect(result.summary.status).toBe("NO_DATA");
    expect(result.summary.sentimentPercent).toBeNull();
    expect(result.summary.topTopics).toEqual([]);
  });

  it("STALE과 분모 미확정 PARTIAL에서는 수치를 만들지 않는다", async () => {
    const stale = await withResponse(
      found({
        ...demoReadySnapshot,
        status: "STALE",
      })
    ).getSummary(VIDEO_A);

    expect(stale.kind).toBe("SNAPSHOT");
    if (stale.kind !== "SNAPSHOT") return;

    expect(stale.summary.status).toBe("STALE");
    expect(stale.summary.sentimentPercent).toBeNull();

    const partial = await withResponse(
      found({
        ...demoReadySnapshot,
        status: "PARTIAL",
        sample: {
          ...demoReadySnapshot.sample,
          classifiedCount: null,
          unclassifiedCount: null,
        },
      })
    ).getSummary(VIDEO_A);

    expect(partial.kind).toBe("SNAPSHOT");
    if (partial.kind !== "SNAPSHOT") return;

    expect(partial.summary.status).toBe("PARTIAL");
    expect(partial.summary.sentimentPercent).toBeNull();
    expect(partial.summary.topTopics).toEqual([]);
  });

  it("잘못된 대상은 Repository를 호출하지 않는다", async () => {
    let calls = 0;

    const provider = createDemoHoverSummaryProvider({
      async getSnapshot() {
        calls += 1;
        return found(demoReadySnapshot);
      },
    });

    for (const target of [
      null,
      { source: "YOUTUBE", targetType: "VIDEO", targetId: "bad" },
      { source: "YOUTUBE", targetType: "CHANNEL", targetId: "@handle" },
      { ...VIDEO_A, extra: true },
      { ...VIDEO_A, source: "OTHER" },
    ]) {
      expect(
        await provider.getSummary(target)
      ).toEqual({
        kind: "REJECTED",
        reason: "INVALID_TARGET",
      });
    }

    expect(calls).toBe(0);
  });

  it("잘못된 조회 응답 구조를 거부한다", async () => {
    for (const response of [
      null,
      [],
      { kind: "UNKNOWN" },
      { kind: "FOUND" },
      { kind: "NOT_FOUND", snapshot: demoReadySnapshot },
      {
        kind: "FOUND",
        snapshot: demoReadySnapshot,
        unexpected: true,
      },
    ]) {
      const result = await withResponse(
        response
      ).getSummary(VIDEO_A);

      expect(result).toEqual({
        kind: "REJECTED",
        reason: "INVALID_RESPONSE",
      });
    }
  });

  it("요청 영상과 다른 스냅샷을 거부한다", async () => {
    const result = await withResponse(
      found(demoReadySnapshot)
    ).getSummary(VIDEO_B);

    expect(result).toEqual({
      kind: "REJECTED",
      reason: "TARGET_MISMATCH",
    });
  });

  it("모순된 표본과 Preview 객체를 거부한다", async () => {
    const invalidCount = {
      ...demoReadySnapshot,
      sample: {
        ...demoReadySnapshot.sample,
        rawCount: 121,
      },
    };

    for (const snapshot of [
      invalidCount,
      {
        target: VIDEO_A,
        positive: 45,
        neutral: 35,
        negative: 20,
        previewContract: {
          valueSemantics: "ILLUSTRATIVE_ONLY",
        },
      },
    ]) {
      expect(
        await withResponse(found(snapshot)).getSummary(VIDEO_A)
      ).toEqual({
        kind: "REJECTED",
        reason: "INVALID_SNAPSHOT",
      });
    }
  });

  it("실제 제공자와 테넌트 비공개 데이터를 거부한다", async () => {
    const disallowed = [
      {
        ...demoReadySnapshot,
        sourceType: "APPROVED_PROVIDER",
        isSynthetic: false,
      },
      {
        ...demoReadySnapshot,
        visibility: "TENANT_PRIVATE",
        tenantId: "tenant-a",
      },
    ];

    for (const snapshot of disallowed) {
      expect(
        await withResponse(found(snapshot)).getSummary(VIDEO_A)
      ).toEqual({
        kind: "REJECTED",
        reason: "DEMO_SCOPE_ONLY",
      });
    }
  });

  it("Repository 오류를 외부로 전파하지 않고 거부한다", async () => {
    const provider = createDemoHoverSummaryProvider({
      async getSnapshot() {
        throw new Error("TEST_SOURCE_FAILURE");
      },
    });

    expect(
      await provider.getSummary(VIDEO_A)
    ).toEqual({
      kind: "REJECTED",
      reason: "SOURCE_ERROR",
    });
  });

  it("늦게 도착하는 다른 영상 응답과 결과가 섞이지 않는다", async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;

    const provider = createDemoHoverSummaryProvider({
      getSnapshot(target) {
        return new Promise<unknown>((resolve) => {
          if (target.targetId === VIDEO_A.targetId) {
            resolveA = resolve;
          } else {
            resolveB = resolve;
          }
        });
      },
    });

    const pendingA = provider.getSummary(VIDEO_A);
    const pendingB = provider.getSummary(VIDEO_B);

    resolveB(found({
      ...demoReadySnapshot,
      target: VIDEO_B,
    }));

    const resultB = await pendingB;

    resolveA(found(demoReadySnapshot));

    const resultA = await pendingA;

    expect(resultA.kind).toBe("SNAPSHOT");
    expect(resultB.kind).toBe("SNAPSHOT");

    if (
      resultA.kind !== "SNAPSHOT" ||
      resultB.kind !== "SNAPSHOT"
    ) return;

    expect(resultA.summary.target.targetId).toBe(
      VIDEO_A.targetId
    );

    expect(resultB.summary.target.targetId).toBe(
      VIDEO_B.targetId
    );

    expect(resultA.summary.snapshotId).toBe(
      demoReadySnapshot.snapshotId
    );
  });

  it("공급된 요약과 중첩 메타데이터는 변경할 수 없다", async () => {
    const result = await withResponse(
      found(demoReadySnapshot)
    ).getSummary(VIDEO_A);

    expect(result.kind).toBe("SNAPSHOT");
    if (result.kind !== "SNAPSHOT") return;

    const summary = result.summary;

    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.target)).toBe(true);
    expect(Object.isFrozen(summary.provenance)).toBe(true);
    expect(Object.isFrozen(summary.observationScope)).toBe(true);
    expect(Object.isFrozen(summary.sentimentPercent)).toBe(true);
    expect(Object.isFrozen(summary.topTopics)).toBe(true);
    expect(Object.isFrozen(summary.topTopics[0])).toBe(true);
  });
});
