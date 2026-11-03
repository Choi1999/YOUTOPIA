import type { VideoComparisonResult } from "./videoComparison";

export type SentimentDifference = Readonly<{
  key: "positivePercent" | "neutralPercent" | "negativePercent";
  label: "긍정" | "중립" | "부정";
  leftPercent: number;
  rightPercent: number;
  /** B - A in percentage points, never percent growth. */
  deltaPp: number;
}>;

export type TopicDifference = Readonly<{
  topicId: string;
  leftCount: number;
  rightCount: number;
  /** B - A in mention counts, not per-comment prevalence. */
  deltaCount: number;
}>;

export type ComparisonHighlights = Readonly<{
  sentiments: ReadonlyArray<SentimentDifference>;
  largestSentiment: SentimentDifference;
  topTopicDifferences: ReadonlyArray<TopicDifference>;
}>;

const CATEGORIES = [
  { key: "positivePercent", label: "긍정" },
  { key: "neutralPercent", label: "중립" },
  { key: "negativePercent", label: "부정" },
] as const;

/**
 * YU-36: 검증된 READY 비교 결과에 대한 설명 가능한 기술적 차이.
 * 관측 기간과 표본 조건 검증은 videoComparison.ts의 기존 계약에 위임한다.
 * 비율의 차이는 퍼센트포인트(%p)이고 주제는 건수(B - A)이다.
 * 원인·통계적 유의성·실제 영상의 성능을 추측하지 않는다.
 */
export function deriveComparisonHighlights(
  result: VideoComparisonResult,
): ComparisonHighlights | null {
  if (result.kind !== "READY") return null;
  const left = result.left.sentimentPercent;
  const right = result.right.sentimentPercent;
  if (!left || !right) return null;

  const sentiments: SentimentDifference[] = CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    leftPercent: left[key],
    rightPercent: right[key],
    // Exact percentage-point subtraction. Round only in the view.
    deltaPp: right[key] - left[key],
  }));

  const largestSentiment = sentiments.reduce(
    (best, candidate) =>
      Math.abs(candidate.deltaPp) > Math.abs(best.deltaPp)
        ? candidate : best,
    sentiments[0],
  );

  const topTopicDifferences = result.topics
    .map(topic => ({
      topicId: topic.topicId,
      leftCount: topic.leftCount,
      rightCount: topic.rightCount,
      deltaCount: topic.rightCount - topic.leftCount,
    }))
    .sort((a, b) =>
      Math.abs(b.deltaCount) - Math.abs(a.deltaCount) ||
      a.topicId.localeCompare(b.topicId),
    )
    .slice(0, 3);

  return { sentiments, largestSentiment, topTopicDifferences };
}
