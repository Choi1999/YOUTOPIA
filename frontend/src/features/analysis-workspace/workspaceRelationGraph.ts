import { getDemoChannelSelection } from "../analysis/data/demoChannelSelection";
import type { WorkspaceCatalogEntry, WorkspaceCatalogStatus } from "./analysisWorkspaceCatalog";
import {
  ANALYSIS_WORKSPACE_TOPICS,
  type AnalysisWorkspaceSession,
} from "./analysisWorkspaceSession";

/**
 * UI-R04-A: an EXPLICITLY CURATED synthetic relation diagram.
 *
 * Channel -> video means only "manually included in a synthetic fixture".
 * Video -> topic means a positive mention count from a verified READY
 * synthetic projection. Neither edge establishes real channel ownership,
 * actual YouTube sentiment, distance, affinity, or statistical significance.
 */
export type RelationNodeKind = "CHANNEL" | "VIDEO" | "TOPIC";
export type RelationNode = Readonly<{
  key: string;
  kind: RelationNodeKind;
  id: string;
  label: string;
  x: number;
  y: number;
  status: WorkspaceCatalogStatus | "SELECTED";
  entry: WorkspaceCatalogEntry | null;
}>;

export type RelationEdge = Readonly<{
  key: string;
  source: string;
  target: string;
  type: "CURATED_SET" | "VERIFIED_TOPIC_MENTION";
  count: number | null;
}>;

export type WorkspaceRelationGraph = Readonly<{
  nodes: readonly RelationNode[];
  edges: readonly RelationEdge[];
  topicId: string | null;
}>;

export function relationNodeKey(kind: RelationNodeKind, id: string) {
  return kind + ":" + id;
}

function matchingEntry(
  entries: readonly WorkspaceCatalogEntry[],
  kind: "VIDEO" | "CHANNEL",
  id: string,
) {
  return entries.find(e => e.kind === kind && e.id === id) ?? null;
}

/** The coordinates are presentation positions, NOT encoded data values. */
export function buildWorkspaceRelationGraph(
  session: AnalysisWorkspaceSession,
  entries: readonly WorkspaceCatalogEntry[],
): WorkspaceRelationGraph {
  const nodes: RelationNode[] = [];
  const edges: RelationEdge[] = [];
  const seen = new Set<string>();

  session.channelIds.forEach((channelId, slot) => {
    const manifest = getDemoChannelSelection(channelId);
    if (!manifest) return;

    const channelKey = relationNodeKey("CHANNEL", channelId);
    const entry = matchingEntry(entries, "CHANNEL", channelId);
    nodes.push({
      key: channelKey,
      kind: "CHANNEL",
      id: channelId,
      label: slot === 0 ? "채널 A" : "채널 B",
      x: slot === 0 ? 165 : 535,
      y: 66,
      status: entry?.status ?? "BLOCKED",
      entry,
    });
    seen.add(channelKey);

    manifest.videoIds.forEach((id, index) => {
      const videoKey = relationNodeKey("VIDEO", id);
      if (!seen.has(videoKey)) {
        const video = matchingEntry(entries, "VIDEO", id);
        nodes.push({
          key: videoKey,
          kind: "VIDEO",
          id,
          label: "영상 " + (slot === 0 ? "A" : "B") + (index + 1),
          x: slot === 0 ? 83 + index * 165 : 452 + index * 165,
          y: 213,
          status: video?.status ?? "BLOCKED",
          entry: video,
        });
        seen.add(videoKey);
      }
      edges.push({
        key: channelKey + "::" + videoKey,
        source: channelKey,
        target: videoKey,
        type: "CURATED_SET",
        count: null,
      });
    });
  });

  const topicId = ANALYSIS_WORKSPACE_TOPICS.includes(session.topicId)
    ? session.topicId
    : null;

  if (topicId && nodes.length) {
    const topicKey = relationNodeKey("TOPIC", topicId);
    nodes.push({
      key: topicKey,
      kind: "TOPIC",
      id: topicId,
      label: "주제 " + topicId,
      x: 350,
      y: 363,
      status: "SELECTED",
      entry: null,
    });

    for (const video of nodes.filter(n => n.kind === "VIDEO")) {
      if (video.entry?.status !== "READY") continue;
      const count = video.entry.topics.find(t => t.id === topicId)?.count;
      // Missing/non-positive/invalid counts produce NO edge, not a false
      // 0-result assertion. Blocked/partial data never create topic links.
      if (!Number.isSafeInteger(count) || count === undefined || count <= 0) continue;
      edges.push({
        key: video.key + "::" + topicKey,
        source: video.key,
        target: topicKey,
        type: "VERIFIED_TOPIC_MENTION",
        count,
      });
    }
  }

  return { nodes, edges, topicId };
}
