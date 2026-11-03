import {
  getDemoChannelSelection,
  type DemoChannelSelection,
} from "../data/demoChannelSelection";
import type { WebDetailProjection } from "./analysisProjection";
import { compareVideoProjections } from "./videoComparison";

export type ChannelAggregation =
  | Readonly<{
      kind: "READY";
      channelId: string;
      selectedVideoIds: readonly string[];
      sourceType: "STATIC_FIXTURE";
      isSynthetic: true;
      observationWindow: Readonly<{
        start: string;
        end: string;
        locale: string;
      }>;
      observedAt: string;
      analyzedAt: string;
      analysisVersion: string;
      taxonomyVersion: string;
      sample: Readonly<{
        raw: number;
        eligible: number;
        excluded: number;
        classified: number;
        unclassified: number;
      }>;
      sentiment: Readonly<{
        positive: number;
        neutral: number;
        negative: number;
        positivePercent: number;
        neutralPercent: number;
        negativePercent: number;
      }>;
      topics: readonly Readonly<{
        topicId: string;
        mentionCount: number;
        perVideo: readonly Readonly<{ videoId: string; mentionCount: number }>[];
      }>[];
      videos: readonly Readonly<{
        videoId: string;
        rawCount: number;
        eligibleCount: number;
        classifiedCount: number;
        classifiedSharePercent: number;
      }>[];
    }>
  | Readonly<{
      kind: "BLOCKED";
      reason:
        | "UNREGISTERED_CHANNEL"
        | "SELECTED_SET_MISMATCH"
        | "INCOMPLETE_OR_UNVERIFIED"
        | "OBSERVATION_OR_VERSION_MISMATCH"
        | "INVALID_COUNTS";
    }>;

const block = (
  reason: Extract<ChannelAggregation, { kind: "BLOCKED" }>["reason"],
): ChannelAggregation => ({ kind: "BLOCKED", reason });

const safeInteger = (v: number | null): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

const safeSum = (values: number[]): number | null => {
  const total = values.reduce((sum, n) => sum + n, 0);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
};

function validCounts(p: WebDetailProjection): boolean {
  const sample = p.sample;
  const counts = p.sentimentCounts;
  const metrics = p.sentimentPercent;
  if (!sample || !counts || !metrics ||
      !safeInteger(sample.rawCount) ||
      !safeInteger(sample.eligibleCount) ||
      !safeInteger(sample.excludedCount) ||
      !safeInteger(sample.classifiedCount) ||
      !safeInteger(sample.unclassifiedCount) ||
      !safeInteger(counts.positive) ||
      !safeInteger(counts.neutral) ||
      !safeInteger(counts.negative)) return false;

  const sentimentTotal = safeSum([
    counts.positive, counts.neutral, counts.negative,
  ]);
  return sample.rawCount === sample.eligibleCount + sample.excludedCount &&
    sample.eligibleCount === sample.classifiedCount + sample.unclassifiedCount &&
    sentimentTotal === sample.classifiedCount &&
    sample.classifiedCount > 0 &&
    metrics.denominator === sample.classifiedCount &&
    Math.abs(metrics.positivePercent - counts.positive / sample.classifiedCount * 100) < 0.001 &&
    Math.abs(metrics.neutralPercent - counts.neutral / sample.classifiedCount * 100) < 0.001 &&
    Math.abs(metrics.negativePercent - counts.negative / sample.classifiedCount * 100) < 0.001;
}

/**
 * YU-45 — aggregate *only* a specifically registered pair of synthetic VIDEO
 * snapshots. This is NOT an aggregation of all videos actually belonging
 * to a YouTube channel, nor a claim about overall audiences/viewers.
 *
 * Before calling, the page must retrieve each video through the existing
 * AnalysisRepository and projectDemoAnalysisSnapshot validation boundary.
 * Comparison eligibility is additionally enforced by the existing
 * compareVideoProjections contract.
 */
export function aggregateSyntheticChannelSelection(
  selection: DemoChannelSelection,
  input: readonly WebDetailProjection[],
): ChannelAggregation {
  const registered = getDemoChannelSelection(selection.channelId);
  if (!registered ||
      selection.source !== "STATIC_FIXTURE" ||
      selection.isSynthetic !== true ||
      selection.selectionRule !== "EXPLICIT_SYNTHETIC_VIDEO_SET" ||
      selection.videoIds.length !== registered.videoIds.length ||
      selection.videoIds.some((id, i) => id !== registered.videoIds[i])) {
    return block("UNREGISTERED_CHANNEL");
  }

  if (
    input.length !== selection.videoIds.length ||
    input.some((p, i) =>
      p.target.source !== "YOUTUBE" ||
      p.target.targetType !== "VIDEO" ||
      p.target.targetId !== selection.videoIds[i])
  ) return block("SELECTED_SET_MISMATCH");

  if (input.some(p =>
    p.status !== "READY" ||
    !p.sample || !p.sentimentCounts || !p.sentimentPercent
  )) return block("INCOMPLETE_OR_UNVERIFIED");

  const [left, right] = input;
  const comparison = compareVideoProjections(left, right);
  if (comparison.kind !== "READY")
    return block("OBSERVATION_OR_VERSION_MISMATCH");

  if (!input.every(validCounts))
    return block("INVALID_COUNTS");

  const a = left.sample!;
  const b = right.sample!;
  const countsA = left.sentimentCounts!;
  const countsB = right.sentimentCounts!;

  const totals = {
    raw: safeSum([a.rawCount!, b.rawCount!]),
    eligible: safeSum([a.eligibleCount!, b.eligibleCount!]),
    excluded: safeSum([a.excludedCount!, b.excludedCount!]),
    classified: safeSum([a.classifiedCount!, b.classifiedCount!]),
    unclassified: safeSum([a.unclassifiedCount!, b.unclassifiedCount!]),
    positive: safeSum([countsA.positive, countsB.positive]),
    neutral: safeSum([countsA.neutral, countsB.neutral]),
    negative: safeSum([countsA.negative, countsB.negative]),
  };
  if (Object.values(totals).some(v => v === null) ||
      totals.classified === 0) return block("INVALID_COUNTS");

  const classified = totals.classified!;
  const sumTopics = comparison.topics.map(topic => {
    const count = safeSum([topic.leftCount, topic.rightCount]);
    if (count === null) return null;
    return {
      topicId: topic.topicId,
      mentionCount: count,
      perVideo: [
        { videoId: left.target.targetId, mentionCount: topic.leftCount },
        { videoId: right.target.targetId, mentionCount: topic.rightCount },
      ],
    };
  });
  if (sumTopics.some(topic => topic === null)) return block("INVALID_COUNTS");
  const topics = sumTopics.filter((t): t is NonNullable<typeof t> => t !== null)
    .sort((a, b) =>
      b.mentionCount - a.mentionCount ||
      a.topicId.localeCompare(b.topicId)
    );

  return {
    kind: "READY",
    channelId: registered.channelId,
    selectedVideoIds: [...selection.videoIds],
    sourceType: "STATIC_FIXTURE",
    isSynthetic: true,
    observationWindow: {
      start: left.observationScope.windowStart,
      end: left.observationScope.windowEnd,
      locale: left.observationScope.locale,
    },
    observedAt: left.observedAt!,
    analyzedAt: left.analyzedAt!,
    analysisVersion: left.analysisVersion!,
    taxonomyVersion: left.topicTaxonomyVersion!,
    sample: {
      raw: totals.raw!,
      eligible: totals.eligible!,
      excluded: totals.excluded!,
      classified,
      unclassified: totals.unclassified!,
    },
    sentiment: {
      positive: totals.positive!,
      neutral: totals.neutral!,
      negative: totals.negative!,
      positivePercent: totals.positive! / classified * 100,
      neutralPercent: totals.neutral! / classified * 100,
      negativePercent: totals.negative! / classified * 100,
    },
    topics,
    videos: input.map(p => ({
      videoId: p.target.targetId,
      rawCount: p.sample!.rawCount!,
      eligibleCount: p.sample!.eligibleCount!,
      classifiedCount: p.sample!.classifiedCount!,
      classifiedSharePercent: p.sample!.classifiedCount! / classified * 100,
    })),
  };
}
