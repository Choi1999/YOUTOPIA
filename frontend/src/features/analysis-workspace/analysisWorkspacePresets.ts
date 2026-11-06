import { demoChannelSelections } from "../analysis/data/demoChannelSelection";
import {
  isValidWorkspaceSession,
  type AnalysisWorkspaceSession,
} from "./analysisWorkspaceSession";

/**
 * YU-55: immutable, code-defined synthetic-demo selection presets.
 * A preset does not save snapshots, arbitrary URLs, tenant data or tokens.
 * This intentionally does not add a persistence schema or user-upload import.
 */
export type WorkspacePresetId = "CHANNEL_A" | "CHANNEL_B" | "PRICE_FOCUS";
export const WORKSPACE_PRESETS: readonly Readonly<{
  id: WorkspacePresetId;
  label: string;
  description: string;
}>[] = Object.freeze([
  {id:"CHANNEL_A",label:"합성 채널 A 탐색",description:"A의 선정 영상과 RECIPE 주제"},
  {id:"CHANNEL_B",label:"합성 채널 B 탐색",description:"B의 선정 영상과 QUALITY 주제"},
  {id:"PRICE_FOCUS",label:"PRICE 교차 탐색",description:"각 채널에서 영상 한 개씩과 PRICE 주제"},
]);

export function applyWorkspacePreset(
  current: AnalysisWorkspaceSession,
  id: WorkspacePresetId,
  now = Date.now(),
): AnalysisWorkspaceSession | null {
  const [a, b] = demoChannelSelections;
  const configs: Record<WorkspacePresetId, {
    videoIds: readonly [string, string];
    channelIds: readonly [string, string];
    topicId: string;
  }> = {
    CHANNEL_A: {
      videoIds: [a.videoIds[0], a.videoIds[1]],
      channelIds: [a.channelId, b.channelId],
      topicId: "RECIPE",
    },
    CHANNEL_B: {
      videoIds: [b.videoIds[0], b.videoIds[1]],
      channelIds: [b.channelId, a.channelId],
      topicId: "QUALITY",
    },
    PRICE_FOCUS: {
      videoIds: [a.videoIds[1], b.videoIds[1]],
      channelIds: [a.channelId, b.channelId],
      topicId: "PRICE",
    },
  };
  if (!Object.prototype.hasOwnProperty.call(configs, id)) return null;
  const next: AnalysisWorkspaceSession = {
    ...current,
    ...configs[id],
    version: 1,
    savedAt: now,
  };
  return isValidWorkspaceSession(next, now) ? next : null;
}
