import type { WebDetailProjection } from "./analysisProjection";

export type VideoComparisonResult =
  | Readonly<{
      kind: "READY";
      left: WebDetailProjection;
      right: WebDetailProjection;
      topics: ReadonlyArray<Readonly<{
        topicId: string;
        leftCount: number;
        rightCount: number;
      }>>;
    }>
  | Readonly<{
      kind: "BLOCKED";
      reason:
        | "SAME_TARGET"
        | "UNTRUSTED_SOURCE"
        | "INSUFFICIENT_DATA"
        | "OBSERVATION_MISMATCH"
        | "ANALYSIS_TIME_MISMATCH"
        | "VERSION_MISMATCH"
        | "SAMPLE_MISMATCH";
    }>;

const blocked = (
  reason: Extract<VideoComparisonResult, { kind: "BLOCKED" }>["reason"],
): VideoComparisonResult => ({ kind: "BLOCKED", reason });

/**
 * YU-35: 검증된 합성 Web Projection 두 개만 비교한다.
 *
 * 현행 데모는 임의의 데이터와 시계열을 생성하지 않는다.
 * 서로 다른 관측 범위·분석 시각·알고리즘 버전·표본 크기를
 * 곧바로 비교하는 오해를 막기 위해 엄격하게 불허한다.
 * 이 정책은 추후 실제 데이터 비교 계약을 대체하지 않는다.
 */
export function compareVideoProjections(
  left: WebDetailProjection,
  right: WebDetailProjection,
): VideoComparisonResult {
  if (
    left.target.targetType !== "VIDEO" ||
    right.target.targetType !== "VIDEO" ||
    left.target.targetId === right.target.targetId
  ) {
    return blocked("SAME_TARGET");
  }

  if (
    left.valueSemantics !== "SNAPSHOT_DERIVED_SYNTHETIC" ||
    right.valueSemantics !== "SNAPSHOT_DERIVED_SYNTHETIC" ||
    left.provenance.sourceType !== "STATIC_FIXTURE" ||
    right.provenance.sourceType !== "STATIC_FIXTURE" ||
    left.provenance.isSynthetic !== true ||
    right.provenance.isSynthetic !== true ||
    left.provenance.visibility !== "PUBLIC_REUSABLE" ||
    right.provenance.visibility !== "PUBLIC_REUSABLE" ||
    left.provenance.tenantId !== null ||
    right.provenance.tenantId !== null
  ) {
    return blocked("UNTRUSTED_SOURCE");
  }

  if (
    left.status !== "READY" ||
    right.status !== "READY" ||
    !left.sentimentPercent ||
    !right.sentimentPercent ||
    !left.sample ||
    !right.sample
  ) {
    return blocked("INSUFFICIENT_DATA");
  }

  const a = left.observationScope;
  const b = right.observationScope;
  if (
    a.mode !== "ONE_VIDEO" ||
    b.mode !== "ONE_VIDEO" ||
    a.windowStart !== b.windowStart ||
    a.windowEnd !== b.windowEnd ||
    a.locale !== b.locale
  ) {
    return blocked("OBSERVATION_MISMATCH");
  }

  if (
    !left.observedAt || !right.observedAt ||
    !left.analyzedAt || !right.analyzedAt ||
    left.observedAt !== right.observedAt ||
    left.analyzedAt !== right.analyzedAt
  ) {
    return blocked("ANALYSIS_TIME_MISMATCH");
  }

  if (
    !left.analysisVersion || !right.analysisVersion ||
    !left.topicTaxonomyVersion || !right.topicTaxonomyVersion ||
    left.analysisVersion !== right.analysisVersion ||
    left.topicTaxonomyVersion !== right.topicTaxonomyVersion
  ) {
    return blocked("VERSION_MISMATCH");
  }

  if (
    left.sample.eligibleCount === null ||
    right.sample.eligibleCount === null ||
    left.sample.eligibleCount < 1 ||
    left.sample.eligibleCount !== right.sample.eligibleCount ||
    left.sentimentPercent.denominator < 1 ||
    left.sentimentPercent.denominator !== right.sentimentPercent.denominator
  ) {
    return blocked("SAMPLE_MISMATCH");
  }

  const byTopic = new Map<string, { leftCount: number; rightCount: number }>();

  for (const topic of left.topics) {
    byTopic.set(topic.topicId, {
      leftCount: topic.mentionCount,
      rightCount: 0,
    });
  }

  for (const topic of right.topics) {
    const prior = byTopic.get(topic.topicId);
    byTopic.set(topic.topicId, {
      leftCount: prior?.leftCount ?? 0,
      rightCount: topic.mentionCount,
    });
  }

  const topics = [...byTopic]
    .map(([topicId, counts]) => ({ topicId, ...counts }))
    .sort((a, b) =>
      Math.max(b.leftCount, b.rightCount) -
        Math.max(a.leftCount, a.rightCount) ||
      a.topicId.localeCompare(b.topicId),
    );

  return { kind: "READY", left, right, topics };
}
