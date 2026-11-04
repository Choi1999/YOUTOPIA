import { buildComparisonSharePath } from "../analysis-target/comparisonShareLink";
import { demoChannelSelections } from "../analysis/data/demoChannelSelection";

/**
 * YU-51: Explicit synthetic ID selections only. Never save comments,
 * provider payloads, tenant/account data, credentials, or analytics results.
 * sessionStorage is limited to one browser tab session, not cloud persistence.
 */
export const ANALYSIS_WORKSPACE_SESSION_KEY = "youtopia-analysis-workspace-v1";
export const ANALYSIS_WORKSPACE_TTL_MS = 2 * 60 * 60 * 1000;
export const ANALYSIS_WORKSPACE_TOPICS: readonly string[] =
  Object.freeze(["RECIPE", "PRICE", "DELIVERY", "QUALITY"]);

const registeredVideos = new Set(
  demoChannelSelections.flatMap(channel => [...channel.videoIds]),
);
const registeredChannels = new Set(
  demoChannelSelections.map(channel => channel.channelId),
);

export type WorkspaceRecentTarget = Readonly<{
  type: "VIDEO" | "CHANNEL";
  id: string;
}>;

export type AnalysisWorkspaceSession = Readonly<{
  version: 1;
  savedAt: number;
  videoIds: readonly [string, string];
  channelIds: readonly [string, string];
  topicId: string;
  recentTargets: readonly WorkspaceRecentTarget[];
}>;

export type WorkspaceTargetKind = "VIDEO" | "CHANNEL";
export type WorkspacePairKind = "videoIds" | "channelIds";

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

export function isRegisteredWorkspaceId(
  type: WorkspaceTargetKind,
  id: string,
): boolean {
  return type === "VIDEO" ? registeredVideos.has(id) : registeredChannels.has(id);
}

function validPair(input: unknown, type: WorkspaceTargetKind): input is [string, string] {
  return Array.isArray(input) && input.length === 2 &&
    input.every(id => typeof id === "string" &&
      (id === "" || isRegisteredWorkspaceId(type, id))) &&
    !(input[0] !== "" && input[0] === input[1]);
}

function validRecents(input: unknown): input is WorkspaceRecentTarget[] {
  if (!Array.isArray(input) || input.length > 6) return false;
  const seen = new Set<string>();
  return input.every(item => {
    if (!isRecord(item) || Object.keys(item).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(item, "type") ||
        !Object.prototype.hasOwnProperty.call(item, "id") ||
        (item.type !== "VIDEO" && item.type !== "CHANNEL") ||
        typeof item.id !== "string" ||
        !isRegisteredWorkspaceId(item.type, item.id)) return false;
    const key = item.type + ":" + item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isValidWorkspaceSession(
  input: unknown,
  now = Date.now(),
): input is AnalysisWorkspaceSession {
  if (!isRecord(input) ||
      Object.keys(input).sort().join("|") !==
        "channelIds|recentTargets|savedAt|topicId|version|videoIds" ||
      input.version !== 1 ||
      typeof input.savedAt !== "number" ||
      !Number.isSafeInteger(input.savedAt) ||
      input.savedAt < 0 || input.savedAt > now ||
      now - input.savedAt > ANALYSIS_WORKSPACE_TTL_MS ||
      !validPair(input.videoIds, "VIDEO") ||
      !validPair(input.channelIds, "CHANNEL") ||
      typeof input.topicId !== "string" ||
      (input.topicId !== "" && !ANALYSIS_WORKSPACE_TOPICS.includes(input.topicId)) ||
      !validRecents(input.recentTargets)) return false;
  return true;
}

export function createDefaultWorkspaceSession(now = Date.now()): AnalysisWorkspaceSession {
  return {
    version: 1,
    savedAt: now,
    videoIds: [...demoChannelSelections[0].videoIds] as [string, string],
    channelIds: [
      demoChannelSelections[0].channelId,
      demoChannelSelections[1].channelId,
    ],
    topicId: "RECIPE",
    recentTargets: [],
  };
}

function withRecent(
  recentTargets: readonly WorkspaceRecentTarget[],
  type: WorkspaceTargetKind,
  id: string,
): WorkspaceRecentTarget[] {
  return [
    { type, id },
    ...recentTargets.filter(entry => !(entry.type === type && entry.id === id)),
  ].slice(0, 6);
}

/** A partial draft stays editable but never becomes a comparison link. */
export function withWorkspacePair(
  current: AnalysisWorkspaceSession,
  field: WorkspacePairKind,
  index: 0 | 1,
  id: string,
  now = Date.now(),
): AnalysisWorkspaceSession | null {
  const type = field === "videoIds" ? "VIDEO" : "CHANNEL";
  if (id !== "" && !isRegisteredWorkspaceId(type, id)) return null;
  const pair: [string, string] = [...current[field]];
  if (id !== "" && pair[1 - index] === id) return null;
  pair[index] = id;
  return {
    ...current,
    savedAt: now,
    [field]: pair,
    recentTargets: id ? withRecent(current.recentTargets, type, id) : current.recentTargets,
  };
}

export function withWorkspaceTopic(
  current: AnalysisWorkspaceSession,
  topicId: string,
  now = Date.now(),
): AnalysisWorkspaceSession | null {
  if (topicId !== "" && !ANALYSIS_WORKSPACE_TOPICS.includes(topicId)) return null;
  return { ...current, topicId, savedAt: now };
}

/** All external navigation is generated from canonical, allowlisted IDs. */
export function buildWorkspacePaths(session: AnalysisWorkspaceSession) {
  const [videoA, videoB] = session.videoIds;
  const [channelA, channelB] = session.channelIds;
  const channelQuery = new URLSearchParams();
  if (channelA && channelB) {
    channelQuery.append("channel", channelA);
    channelQuery.append("channel", channelB);
  }
  const topicQuery = new URLSearchParams();
  if (session.topicId && channelA) {
    topicQuery.append("topic", session.topicId);
    topicQuery.append("channel", channelA);
    if (channelB) topicQuery.append("channel", channelB);
  }
  return {
    videoDetail: videoA ? "/analysis/youtube/video/" + videoA : null,
    videoCompare: videoA && videoB ? buildComparisonSharePath([videoA, videoB]) : null,
    channelDetail: channelA ? "/analysis/youtube/channel/" + channelA : null,
    channelCompare: channelA && channelB
      ? "/analysis/youtube/channels/compare?" + channelQuery.toString() : null,
    topicExplorer: session.topicId && channelA
      ? "/analysis/youtube/topics?" + topicQuery.toString() : null,
  } as const;
}

export function readWorkspaceSession(
  storage: Pick<Storage, "getItem"> | null | undefined,
  now = Date.now(),
): AnalysisWorkspaceSession | null {
  try {
    const raw = storage?.getItem(ANALYSIS_WORKSPACE_SESSION_KEY);
    if (!raw || raw.length > 4096) return null;
    const decoded: unknown = JSON.parse(raw);
    return isValidWorkspaceSession(decoded, now) ? decoded : null;
  } catch {
    return null;
  }
}

export function writeWorkspaceSession(
  storage: Pick<Storage, "setItem"> | null | undefined,
  session: AnalysisWorkspaceSession,
  now = Date.now(),
): boolean {
  if (!isValidWorkspaceSession(session, now) || !storage) return false;
  try {
    storage.setItem(ANALYSIS_WORKSPACE_SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearWorkspaceSession(
  storage: Pick<Storage, "removeItem"> | null | undefined,
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(ANALYSIS_WORKSPACE_SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}
