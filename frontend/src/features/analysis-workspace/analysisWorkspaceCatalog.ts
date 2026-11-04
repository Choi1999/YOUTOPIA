import { createAnalysisTarget } from "../analysis-target/analysisTarget";
import type { AnalysisRepository } from "../analysis/data/AnalysisRepository";
import { demoChannelSelections } from "../analysis/data/demoChannelSelection";
import { readDemoChannelAggregate } from "../analysis/data/readDemoChannelAggregate";
import { projectDemoAnalysisSnapshot } from "../analysis/model/analysisProjection";
import { ANALYSIS_WORKSPACE_TOPICS } from "./analysisWorkspaceSession";

/**
 * YU-53/54: a small, explicit synthetic-only catalogue.
 * Every status and count is checked through the original Repository and
 * validation/aggregation boundaries. Registration alone never means READY.
 */
export type WorkspaceCatalogStatus = "READY" | "PARTIAL" | "STALE" | "BLOCKED";
export type WorkspaceCatalogKind = "VIDEO" | "CHANNEL";

export type WorkspaceCatalogEntry = Readonly<{
  kind: WorkspaceCatalogKind;
  id: string;
  label: string;
  status: WorkspaceCatalogStatus;
  reason: string | null;
  classified: number | null;
  eligible: number | null;
  positivePercent: number | null;
  observedWindow: string | null;
  topics: readonly Readonly<{ id: string; count: number }>[];
  href: string;
}>;

export type WorkspaceCatalogFilters = Readonly<{
  search: string;
  kind: "ALL" | WorkspaceCatalogKind;
  status: "ALL" | WorkspaceCatalogStatus;
  topic: string;
}>;

const videoIds = [...new Set(demoChannelSelections.flatMap(channel => channel.videoIds))];

function blocked(
  kind: WorkspaceCatalogKind,
  id: string,
  label: string,
  reason: string,
): WorkspaceCatalogEntry {
  return {
    kind, id, label,
    status: "BLOCKED", reason,
    classified: null, eligible: null, positivePercent: null,
    observedWindow: null, topics: [],
    href: kind === "VIDEO"
      ? "/analysis/youtube/video/" + id
      : "/analysis/youtube/channel/" + id,
  };
}

async function readVideo(
  repository: AnalysisRepository,
  id: string,
): Promise<WorkspaceCatalogEntry> {
  const target = createAnalysisTarget("VIDEO", id);
  if (!target) return blocked("VIDEO", id, "등록 합성 영상 " + id, "INVALID_TARGET");
  try {
    const fetched = await repository.getSnapshot(target);
    if (fetched.kind !== "FOUND") {
      return blocked("VIDEO", id, "등록 합성 영상 " + id, "NOT_FOUND");
    }
    const result = projectDemoAnalysisSnapshot(fetched.snapshot, target);
    if (result.kind !== "PROJECTED") {
      return blocked("VIDEO", id, "등록 합성 영상 " + id, result.reason);
    }
    const web = result.web;
    if (web.status === "STALE") {
      return {
        ...blocked("VIDEO", id, "등록 합성 영상 " + id, "STALE"),
        status: "STALE",
      };
    }
    if ((web.status !== "READY" && web.status !== "PARTIAL") ||
        !web.sentimentPercent || !web.sample ||
        web.sample.classifiedCount !== web.sentimentPercent.denominator) {
      return blocked("VIDEO", id, "등록 합성 영상 " + id,
        web.status === "READY" || web.status === "PARTIAL"
          ? "DENOMINATOR_UNAVAILABLE" : web.status);
    }
    return {
      kind: "VIDEO",
      id,
      label: "등록 합성 영상 " + id,
      status: web.status,
      reason: null,
      classified: web.sentimentPercent.denominator,
      eligible: web.sample.eligibleCount,
      positivePercent: web.sentimentPercent.positivePercent,
      observedWindow: web.observationScope.windowStart + " ~ " +
        web.observationScope.windowEnd,
      topics: web.topics.map(t => ({id: t.topicId, count: t.mentionCount})),
      href: "/analysis/youtube/video/" + id,
    };
  } catch {
    return blocked("VIDEO", id, "등록 합성 영상 " + id, "READ_ERROR");
  }
}

async function readChannel(
  repository: AnalysisRepository,
  id: string,
  label: string,
): Promise<WorkspaceCatalogEntry> {
  const result = await readDemoChannelAggregate(repository, id);
  if (result.kind !== "READY") {
    return blocked("CHANNEL", id, label, result.reason);
  }
  return {
    kind: "CHANNEL",
    id,
    label,
    status: "READY",
    reason: null,
    classified: result.sample.classified,
    eligible: result.sample.eligible,
    positivePercent: result.sentiment.positivePercent,
    observedWindow: result.observationWindow.start + " ~ " +
      result.observationWindow.end,
    topics: result.topics.map(topic => ({id: topic.topicId, count: topic.mentionCount})),
    href: "/analysis/youtube/channel/" + id,
  };
}

/** No network source or inferred membership; only declared fixture IDs. */
export async function readWorkspaceCatalog(
  repository: AnalysisRepository,
): Promise<readonly WorkspaceCatalogEntry[]> {
  return Promise.all([
    ...videoIds.map(id => readVideo(repository, id)),
    ...demoChannelSelections.map(c => readChannel(repository, c.channelId, c.label)),
  ]);
}

export function filterWorkspaceCatalog(
  entries: readonly WorkspaceCatalogEntry[],
  filters: WorkspaceCatalogFilters,
): readonly WorkspaceCatalogEntry[] {
  if (filters.search.length > 80 ||
      !["ALL", "VIDEO", "CHANNEL"].includes(filters.kind) ||
      !["ALL", "READY", "PARTIAL", "STALE", "BLOCKED"].includes(filters.status) ||
      (filters.topic !== "" && !ANALYSIS_WORKSPACE_TOPICS.includes(filters.topic))) {
    return [];
  }
  const q = filters.search.trim().toLocaleLowerCase("ko-KR");
  return entries.filter(entry =>
    (filters.kind === "ALL" || entry.kind === filters.kind) &&
    (filters.status === "ALL" || entry.status === filters.status) &&
    (filters.topic === "" ||
      entry.topics.some(t => t.id === filters.topic && t.count > 0)) &&
    (q === "" || (entry.id + " " + entry.label).toLocaleLowerCase("ko-KR").includes(q)),
  );
}
