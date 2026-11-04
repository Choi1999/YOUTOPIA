import type { ChannelAggregation } from "./channelAggregate";
import { compareChannelAggregations } from "./channelComparison";

type Ready = Extract<ChannelAggregation, { kind: "READY" }>;
export type TopicExplorerResult =
  | Readonly<{
      kind: "READY";
      topicId: string;
      channels: readonly Readonly<{
        channelId: string;
        selectedVideoIds: readonly string[];
        mentionCount: number;
        sampleClassified: number;
        analyzedAt: string;
        windowStart: string;
        windowEnd: string;
        taxonomyVersion: string;
        perVideo: readonly Readonly<{ videoId: string; mentionCount: number }>[];
      }>[];
      deltaCount: number | null;
    }>
  | Readonly<{ kind: "BLOCKED"; reason:
      "INVALID_TOPIC" | "INCOMPLETE_OR_UNVERIFIED" |
      "TOPIC_NOT_REGISTERED" | "INCOMPATIBLE_CHANNELS" }>;

const validTopic = (topic: string) => /^[A-Z0-9_]{1,64}$/.test(topic);

/**
 * YU-48: drill down ONLY into the aggregate contract of explicitly selected,
 * verified synthetic VIDEO sets; do not infer comment texts, sentiment per
 * topic, opinion causality, or viewer population.
 */
export function exploreRegisteredTopic(
  topicId: string, aggregates: readonly ChannelAggregation[],
): TopicExplorerResult {
  if (!validTopic(topicId)) return {kind:"BLOCKED",reason:"INVALID_TOPIC"};
  if (aggregates.length < 1 || aggregates.length > 2 ||
      aggregates.some(a=>a.kind!=="READY")) {
    return {kind:"BLOCKED",reason:"INCOMPLETE_OR_UNVERIFIED"};
  }
  if (aggregates.length === 2 &&
      compareChannelAggregations(aggregates[0],aggregates[1]).kind !== "READY") {
    return {kind:"BLOCKED",reason:"INCOMPATIBLE_CHANNELS"};
  }
  const ready=aggregates as Ready[];
  if (!ready.some(a=>a.topics.some(t=>t.topicId===topicId))) {
    return {kind:"BLOCKED",reason:"TOPIC_NOT_REGISTERED"};
  }
  const channels=ready.map(a=>{
    const topic=a.topics.find(x=>x.topicId===topicId);
    const perVideo=a.selectedVideoIds.map(videoId=>({
      videoId, mentionCount:topic?.perVideo.find(x=>x.videoId===videoId)?.mentionCount??0,
    }));
    const mentionCount=topic?.mentionCount??0;
    if (!Number.isSafeInteger(mentionCount) || mentionCount<0 ||
        perVideo.some(v=>!Number.isSafeInteger(v.mentionCount) || v.mentionCount<0) ||
        perVideo.reduce((sum,v)=>sum+v.mentionCount,0)!==mentionCount) {
      return null;
    }
    return {
      channelId:a.channelId,selectedVideoIds:a.selectedVideoIds,
      mentionCount,sampleClassified:a.sample.classified,
      analyzedAt:a.analyzedAt,
      windowStart:a.observationWindow.start,
      windowEnd:a.observationWindow.end,
      taxonomyVersion:a.taxonomyVersion,perVideo,
    };
  });
  if (channels.some(c=>c===null))
    return {kind:"BLOCKED",reason:"INCOMPLETE_OR_UNVERIFIED"};
  const verified=channels.filter((c):c is NonNullable<typeof c>=>c!==null);
  return {
    kind:"READY", topicId, channels:verified,
    deltaCount:verified.length===2?verified[1].mentionCount-verified[0].mentionCount:null,
  };
}
