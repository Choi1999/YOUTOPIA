import { createAnalysisTarget } from "../../analysis-target/analysisTarget";
import { projectDemoAnalysisSnapshot, type WebDetailProjection } from "../model/analysisProjection";
import { aggregateSyntheticChannelSelection, type ChannelAggregation } from "../model/channelAggregate";
import type { AnalysisRepository } from "./AnalysisRepository";
import { getDemoChannelSelection } from "./demoChannelSelection";

/**
 * YU-47/48: explicitly registered synthetic channel selected VIDEO snapshots
 * must pass the existing repository+projection+aggregation gates.
 * Missing/invalid/error data yields BLOCKED, never a fake zero or invented
 * membership. No external network calls, session writes or data collection.
 */
export async function readDemoChannelAggregate(
  repo: AnalysisRepository,
  channelId: string,
): Promise<ChannelAggregation> {
  const manifest = getDemoChannelSelection(channelId);
  if (!manifest) return {kind: "BLOCKED", reason: "UNREGISTERED_CHANNEL"};
  try {
    const projected = await Promise.all(manifest.videoIds.map(async id => {
      const target = createAnalysisTarget("VIDEO", id);
      if (!target) return null;
      const read = await repo.getSnapshot(target);
      if (read.kind !== "FOUND") return null;
      const value = projectDemoAnalysisSnapshot(read.snapshot, target);
      return value.kind === "PROJECTED" ? value.web : null;
    }));
    if (projected.some(value => value === null)) {
      return {kind: "BLOCKED", reason: "INCOMPLETE_OR_UNVERIFIED"};
    }
    return aggregateSyntheticChannelSelection(manifest,
      projected as WebDetailProjection[]);
  } catch {
    return {kind: "BLOCKED", reason: "INCOMPLETE_OR_UNVERIFIED"};
  }
}
