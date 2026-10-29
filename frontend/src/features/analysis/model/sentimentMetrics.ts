
import type { AnalysisSnapshot } from "./analysisSnapshot";

export type SentimentMetricResult =
  | Readonly<{
      kind: "AVAILABLE";
      denominator: number;
      positivePercent: number;
      neutralPercent: number;
      negativePercent: number;
      classificationCoveragePercent: number | null;
    }>
  | Readonly<{
      kind: "UNAVAILABLE";
      reason:
        | "STATUS_UNAVAILABLE"
        | "SAMPLE_MISSING"
        | "SENTIMENT_MISSING"
        | "INVALID_COUNT"
        | "DENOMINATOR_UNKNOWN"
        | "COUNT_MISMATCH"
        | "ZERO_DENOMINATOR";
    }>;

/**
 * analysis-v1 후보 계약의 표본 산술 규칙을 검사한다.
 *
 * 감성 비율의 분모는 classifiedCount이다.
 * null은 미확정이며 0으로 대체하지 않는다.
 * 전체 계약·접근 권한 검증을 대신하지 않는다.
 */
export function deriveSentimentMetrics(
  snapshot: AnalysisSnapshot,
): SentimentMetricResult {
  if (
    snapshot.status !== "READY" &&
    snapshot.status !== "PARTIAL" &&
    snapshot.status !== "STALE"
  ) {
    return { kind: "UNAVAILABLE", reason: "STATUS_UNAVAILABLE" };
  }

  const sample = snapshot.sample;
  const sentiment = snapshot.sentiment;

  if (!sample) {
    return { kind: "UNAVAILABLE", reason: "SAMPLE_MISSING" };
  }

  if (!sentiment) {
    return { kind: "UNAVAILABLE", reason: "SENTIMENT_MISSING" };
  }

  const {
    rawCount,
    eligibleCount,
    excludedCount,
    classifiedCount,
    unclassifiedCount,
  } = sample;

  const allCounts = [
    rawCount,
    eligibleCount,
    excludedCount,
    classifiedCount,
    unclassifiedCount,
    sentiment.positive,
    sentiment.neutral,
    sentiment.negative,
  ];

  if (
    allCounts.some(
      (value) =>
        value !== null &&
        (!Number.isSafeInteger(value) || value < 0),
    )
  ) {
    return { kind: "UNAVAILABLE", reason: "INVALID_COUNT" };
  }

  if (classifiedCount === null) {
    return { kind: "UNAVAILABLE", reason: "DENOMINATOR_UNKNOWN" };
  }

  const inconsistent =
    (rawCount !== null &&
      eligibleCount !== null &&
      eligibleCount > rawCount) ||
    (rawCount !== null &&
      excludedCount !== null &&
      excludedCount > rawCount) ||
    (eligibleCount !== null &&
      classifiedCount > eligibleCount) ||
    (eligibleCount !== null &&
      unclassifiedCount !== null &&
      unclassifiedCount > eligibleCount) ||
    (rawCount !== null &&
      eligibleCount !== null &&
      excludedCount !== null &&
      rawCount !== eligibleCount + excludedCount) ||
    (eligibleCount !== null &&
      unclassifiedCount !== null &&
      eligibleCount !== classifiedCount + unclassifiedCount);

  const sentimentTotal =
    sentiment.positive + sentiment.neutral + sentiment.negative;

  if (
    inconsistent ||
    !Number.isSafeInteger(sentimentTotal) ||
    sentimentTotal !== classifiedCount
  ) {
    return { kind: "UNAVAILABLE", reason: "COUNT_MISMATCH" };
  }

  if (classifiedCount === 0) {
    return { kind: "UNAVAILABLE", reason: "ZERO_DENOMINATOR" };
  }

  return {
    kind: "AVAILABLE",
    denominator: classifiedCount,
    positivePercent: sentiment.positive / classifiedCount * 100,
    neutralPercent: sentiment.neutral / classifiedCount * 100,
    negativePercent: sentiment.negative / classifiedCount * 100,
    classificationCoveragePercent:
      eligibleCount !== null && eligibleCount > 0
        ? classifiedCount / eligibleCount * 100
        : null,
  };
}
