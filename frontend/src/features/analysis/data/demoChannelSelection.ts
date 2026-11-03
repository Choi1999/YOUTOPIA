import { createAnalysisTarget } from "../../analysis-target/analysisTarget";

/**
 * YU-44: explicitly curated, entirely synthetic channel-to-video association.
 * This is NOT actual YouTube channel membership. No provider channel endpoint
 * exists in the demo, and unregistered CHANNEL IDs never receive a fixture.
 */
export const demoChannelSelection = Object.freeze({
  source: "STATIC_FIXTURE" as const,
  isSynthetic: true as const,
  channelId: "UC" + "A".repeat(22),
  label: "합성 데모 채널 — 실제 YouTube 채널이 아님",
  selectionRule: "EXPLICIT_SYNTHETIC_VIDEO_SET" as const,
  videoIds: ["Ab0_-123xyz", "Qb0_-123xyz"] as const,
});

export type DemoChannelSelection = Readonly<{
  source: "STATIC_FIXTURE";
  isSynthetic: true;
  channelId: string;
  label: string;
  selectionRule: "EXPLICIT_SYNTHETIC_VIDEO_SET";
  videoIds: readonly [string, string];
}>;

/** A separate curated synthetic channel, not a real membership assertion. */
export const demoChannelBSelection: DemoChannelSelection = Object.freeze({
  source: "STATIC_FIXTURE",
  isSynthetic: true,
  channelId: "UC" + "B".repeat(22),
  label: "합성 데모 채널 B — 실제 YouTube 채널이 아님",
  selectionRule: "EXPLICIT_SYNTHETIC_VIDEO_SET",
  videoIds: ["Cb0_-123xyz", "Db0_-123xyz"] as const,
});

export const demoChannelSelections: readonly DemoChannelSelection[] =
  Object.freeze([demoChannelSelection, demoChannelBSelection]);

export function getDemoChannelSelection(
  channelId: string,
): DemoChannelSelection | null {
  const target = createAnalysisTarget("CHANNEL", channelId);
  return target
    ? demoChannelSelections.find(s => s.channelId === target.targetId) ?? null
    : null;
}

export function belongsToDemoChannelSelection(
  channelId: string,
  videoId: string,
): boolean {
  const selection = getDemoChannelSelection(channelId);
  return Boolean(selection && selection.videoIds.some(id => id === videoId));
}

export function demoChannelPath(channelId: string): string | null {
  return createAnalysisTarget("CHANNEL", channelId)
    ? "/analysis/youtube/channel/" + channelId : null;
}
