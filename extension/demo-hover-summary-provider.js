
/**
 * YOUTOPIA 17단계 — MV3 로컬 합성 요약 공급자.
 *
 * shared/contracts/analysis-v1/fixtures/ready.snapshot.json과
 * 동일한 테스트 집계를 사용한다.
 *
 * TypeScript Repository를 Worker에서 실행하지 않는다.
 * 실제 YouTube 댓글, HTTP API, 계정, 저장소는 사용하지 않는다.
 */
(function registerDemoHoverSummaryProvider(scope) {
  "use strict";

  if (scope.YOUTOPIA_DEMO_HOVER_SUMMARY_PROVIDER) return;

  const RAW = Object.freeze({
    snapshotId: "synthetic-one-video-001",

    target: Object.freeze({
      source: "YOUTUBE",
      targetType: "VIDEO",
      targetId: "Ab0_-123xyz",
    }),

    observationScope: Object.freeze({
      mode: "ONE_VIDEO",
      windowStart: "2026-10-01T00:00:00+09:00",
      windowEnd: "2026-10-08T00:00:00+09:00",
      locale: "ko-KR",
    }),

    observedAt: "2026-10-08T09:10:00+09:00",
    analyzedAt: "2026-10-08T09:20:00+09:00",

    sample: Object.freeze({
      rawCount: 120,
      eligibleCount: 100,
      excludedCount: 20,
      classifiedCount: 80,
      unclassifiedCount: 20,
    }),

    sentiment: Object.freeze({
      positive: 50,
      neutral: 20,
      negative: 10,
    }),

    topics: Object.freeze([
      Object.freeze({ topicId: "RECIPE", mentionCount: 38 }),
      Object.freeze({ topicId: "PRICE", mentionCount: 22 }),
    ]),
  });

  const sample = RAW.sample;
  const sentiment = RAW.sentiment;
  const denominator = sample.classifiedCount;

  /*
   * 번들에 포함된 합성 fixture의 기본 산술 관계를 확인한다.
   * 잘못된 fixture로 Worker를 시작하지 않는다.
   */
  if (
    sample.rawCount !==
      sample.eligibleCount + sample.excludedCount ||
    sample.eligibleCount !==
      sample.classifiedCount + sample.unclassifiedCount ||
    sentiment.positive +
      sentiment.neutral +
      sentiment.negative !== denominator ||
    denominator <= 0
  ) {
    throw new Error("INVALID_DEMO_HOVER_FIXTURE");
  }

  const percent = count => count / denominator * 100;

  const READY_SUMMARY = Object.freeze({
    snapshotId: RAW.snapshotId,
    target: RAW.target,
    status: "READY",

    provenance: Object.freeze({
      sourceType: "STATIC_FIXTURE",
      isSynthetic: true,
      visibility: "PUBLIC_REUSABLE",
      tenantId: null,
    }),

    observationScope: RAW.observationScope,
    observedAt: RAW.observedAt,
    analyzedAt: RAW.analyzedAt,

    valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC",

    sentimentPercent: Object.freeze({
      denominator,
      positivePercent: percent(sentiment.positive),
      neutralPercent: percent(sentiment.neutral),
      negativePercent: percent(sentiment.negative),
      classificationCoveragePercent:
        denominator / sample.eligibleCount * 100,
    }),

    topTopics: RAW.topics,
  });

  function validTarget(target) {
    if (
      !target ||
      typeof target !== "object" ||
      Array.isArray(target)
    ) return false;

    const fields = ["source", "targetType", "targetId"];

    if (
      Object.keys(target).length !== fields.length ||
      !fields.every(key =>
        Object.prototype.hasOwnProperty.call(target, key)
      ) ||
      target.source !== "YOUTUBE" ||
      typeof target.targetId !== "string"
    ) return false;

    return (
      (target.targetType === "VIDEO" &&
        /^[A-Za-z0-9_-]{11}$/.test(target.targetId)) ||
      (target.targetType === "CHANNEL" &&
        /^UC[A-Za-z0-9_-]{22}$/.test(target.targetId))
    );
  }

  async function getSummary(target) {
    if (!validTarget(target)) {
      return {
        kind: "REJECTED",
        reason: "INVALID_TARGET",
      };
    }

    if (
      target.targetType !== "VIDEO" ||
      target.targetId !== RAW.target.targetId
    ) {
      return { kind: "NOT_FOUND" };
    }

    return {
      kind: "SNAPSHOT",
      summary: READY_SUMMARY,
    };
  }

  scope.YOUTOPIA_DEMO_HOVER_SUMMARY_PROVIDER =
    Object.freeze({ getSummary });
})(globalThis);
