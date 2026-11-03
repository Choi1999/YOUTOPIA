import { getDemoChannelSelection } from "../data/demoChannelSelection";
import type { ChannelAggregation } from "./channelAggregate";

export type ChannelCompareResult =
  | Readonly<{
      kind: "READY";
      left: Extract<ChannelAggregation, { kind: "READY" }>;
      right: Extract<ChannelAggregation, { kind: "READY" }>;
      sentiment: readonly Readonly<{
        label: "긍정" | "중립" | "부정";
        aPercent: number;
        bPercent: number;
        deltaPp: number;
      }>[];
      topics: readonly Readonly<{
        topicId: string;
        aMentions: number;
        bMentions: number;
        deltaCount: number;
      }>[];
    }>
  | Readonly<{
      kind: "BLOCKED";
      reason: "SAME_CHANNEL" | "NOT_READY" | "UNREGISTERED_MANIFEST" |
        "SOURCE_MISMATCH" | "OBSERVATION_MISMATCH" | "VERSION_MISMATCH" |
        "INVALID_COUNTS";
    }>;

type Ready = Extract<ChannelAggregation, { kind: "READY" }>;
type Reason = Extract<ChannelCompareResult, { kind: "BLOCKED" }>["reason"];

const block = (reason: Reason): ChannelCompareResult => ({ kind: "BLOCKED", reason });
const nonNegative = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
const matchManifest = (channel: Ready): boolean => {
  const manifest = getDemoChannelSelection(channel.channelId);
  return !!manifest &&
    manifest.videoIds.length === channel.selectedVideoIds.length &&
    manifest.videoIds.every((id, i) => channel.selectedVideoIds[i] === id);
};

function validAggregate(item: Ready): boolean {
  const s = item.sample;
  const c = item.sentiment;
  const sum = c.positive + c.neutral + c.negative;
  const values = [s.raw, s.eligible, s.excluded, s.classified,
    s.unclassified, c.positive, c.neutral, c.negative];
  if (!values.every(nonNegative) ||
      s.raw !== s.eligible + s.excluded ||
      s.eligible !== s.classified + s.unclassified ||
      s.classified < 1 || sum !== s.classified ||
      Math.abs(c.positivePercent - c.positive / sum * 100) > 0.001 ||
      Math.abs(c.neutralPercent - c.neutral / sum * 100) > 0.001 ||
      Math.abs(c.negativePercent - c.negative / sum * 100) > 0.001)
    return false;

  const videoSet = new Set(item.selectedVideoIds);
  return item.videos.length === videoSet.size &&
    item.videos.every(video =>
      videoSet.has(video.videoId) &&
      [video.rawCount, video.eligibleCount, video.classifiedCount].every(nonNegative)
    ) &&
    item.topics.every(topic =>
      typeof topic.topicId === "string" &&
      /^[A-Z0-9_]{1,64}$/.test(topic.topicId) &&
      nonNegative(topic.mentionCount) &&
      topic.perVideo.length === videoSet.size &&
      topic.perVideo.every(v => videoSet.has(v.videoId) && nonNegative(v.mentionCount)) &&
      topic.perVideo.reduce((sum, v) => sum + v.mentionCount, 0) === topic.mentionCount
    );
}

/** YU-47 — only two explicitly registered, provenance-verified synthetic
 * channel aggregates can be compared. Different classified denominators are
 * shown explicitly; all deltas are percentage points or mention counts, never
 * growth, causality or a population-level viewer preference estimate. */
export function compareChannelAggregations(
  a: ChannelAggregation, b: ChannelAggregation,
): ChannelCompareResult {
  if (a.kind !== "READY" || b.kind !== "READY") return block("NOT_READY");
  if (a.channelId === b.channelId) return block("SAME_CHANNEL");
  if (!matchManifest(a) || !matchManifest(b)) return block("UNREGISTERED_MANIFEST");
  if (a.sourceType !== "STATIC_FIXTURE" || b.sourceType !== "STATIC_FIXTURE" ||
      a.isSynthetic !== true || b.isSynthetic !== true) return block("SOURCE_MISMATCH");

  if (a.observationWindow.start !== b.observationWindow.start ||
      a.observationWindow.end !== b.observationWindow.end ||
      a.observationWindow.locale !== b.observationWindow.locale ||
      a.analyzedAt !== b.analyzedAt || a.observedAt !== b.observedAt) {
    return block("OBSERVATION_MISMATCH");
  }
  if (a.analysisVersion !== b.analysisVersion ||
      a.taxonomyVersion !== b.taxonomyVersion) return block("VERSION_MISMATCH");
  if (!validAggregate(a) || !validAggregate(b)) return block("INVALID_COUNTS");

  const sentiment = ([
    ["긍정", "positivePercent"],
    ["중립", "neutralPercent"],
    ["부정", "negativePercent"],
  ] as const).map(([label, key]) => ({
    label,
    aPercent: a.sentiment[key],
    bPercent: b.sentiment[key],
    deltaPp: b.sentiment[key] - a.sentiment[key],
  }));

  const topics = new Map<string, { aMentions: number; bMentions: number }>();
  for (const t of a.topics) topics.set(t.topicId, {aMentions: t.mentionCount, bMentions: 0});
  for (const t of b.topics) {
    const existing = topics.get(t.topicId);
    topics.set(t.topicId, {aMentions: existing?.aMentions ?? 0, bMentions: t.mentionCount});
  }

  return {
    kind: "READY", left: a, right: b, sentiment,
    topics: [...topics].map(([topicId, counts]) => ({
      topicId, ...counts, deltaCount: counts.bMentions - counts.aMentions,
    })).sort((x, y) =>
      Math.abs(y.deltaCount) - Math.abs(x.deltaCount) ||
      x.topicId.localeCompare(y.topicId)),
  };
}
