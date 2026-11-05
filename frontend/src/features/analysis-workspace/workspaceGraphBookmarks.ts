/**
 * UI-R04-M: consumer-only saved graph bookmarks and search-result filters.
 *
 * Only canonical registered target keys and user-created group IDs are stored.
 * This never verifies a YouTube relationship, enables network traffic,
 * modifies URL registration, or records browsing/visit history.
 */
import {
  WORKSPACE_URL_TARGETS_TTL_MS, workspaceUrlTargetKey,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import type { WorkspaceNodeGroup } from "./workspaceNodeGroups";
import {
  graphVisitExists, searchWorkspaceGraph,
  type GraphSearchHit, type GraphVisit,
} from "./workspaceGraphNavigation";

export const WORKSPACE_GRAPH_BOOKMARKS_KEY = "youtopia-workspace-graph-bookmarks-v1";
export const MAX_GRAPH_BOOKMARKS = 32;
const MAX_BOOKMARK_PAYLOAD = 8_192;
export type GraphExplorerScope =
  "all" | "video" | "channel" | "group" | "bookmarked";

function validVisit(
  value: unknown, targets: readonly WorkspaceUrlTarget[],
  groups: readonly WorkspaceNodeGroup[],
): value is GraphVisit {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).sort().join("|") === "key|kind" &&
    (candidate.kind === "target" || candidate.kind === "group") &&
    typeof candidate.key === "string" && candidate.key.length <= 128 &&
    graphVisitExists(candidate as GraphVisit, targets, groups);
}

function validBookmarks(
  values: unknown, targets: readonly WorkspaceUrlTarget[],
  groups: readonly WorkspaceNodeGroup[],
): values is readonly GraphVisit[] {
  if (!Array.isArray(values) || values.length > MAX_GRAPH_BOOKMARKS) return false;
  const seen = new Set<string>();
  for (const value of values) {
    if (!validVisit(value, targets, groups)) return false;
    const identity = value.kind + ":" + value.key;
    if (seen.has(identity)) return false;
    seen.add(identity);
  }
  return true;
}

export function readGraphBookmarks(
  storage: Pick<Storage, "getItem"> | null | undefined,
  targets: readonly WorkspaceUrlTarget[], groups: readonly WorkspaceNodeGroup[],
  now = Date.now(),
): readonly GraphVisit[] {
  try {
    if (!Number.isSafeInteger(now) || now < 0) return [];
    const raw = storage?.getItem(WORKSPACE_GRAPH_BOOKMARKS_KEY);
    if (!raw || raw.length > MAX_BOOKMARK_PAYLOAD) return [];
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return [];
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join("|") !== "bookmarks|savedAt|version" ||
      record.version !== 1 || typeof record.savedAt !== "number" ||
      !Number.isSafeInteger(record.savedAt) || record.savedAt < 0 ||
      record.savedAt > now ||
      now - record.savedAt > WORKSPACE_URL_TARGETS_TTL_MS ||
      !validBookmarks(record.bookmarks, targets, groups)) return [];
    return record.bookmarks;
  } catch { return []; }
}

export function writeGraphBookmarks(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  bookmarks: readonly GraphVisit[],
  targets: readonly WorkspaceUrlTarget[], groups: readonly WorkspaceNodeGroup[],
  now = Date.now(),
): boolean {
  if (!storage || !Number.isSafeInteger(now) || now < 0 ||
    !validBookmarks(bookmarks, targets, groups)) return false;
  try {
    if (!bookmarks.length) {
      storage.removeItem(WORKSPACE_GRAPH_BOOKMARKS_KEY);
      return true;
    }
    const value = JSON.stringify({ version: 1, savedAt: now, bookmarks });
    if (value.length > MAX_BOOKMARK_PAYLOAD) return false;
    storage.setItem(WORKSPACE_GRAPH_BOOKMARKS_KEY, value);
    return true;
  } catch { return false; }
}

/** Keep identity when still valid; release removed URL/group references. */
export function reconcileGraphBookmarks(
  bookmarks: readonly GraphVisit[],
  targets: readonly WorkspaceUrlTarget[], groups: readonly WorkspaceNodeGroup[],
): readonly GraphVisit[] {
  const remaining = bookmarks.filter(visit => graphVisitExists(visit, targets, groups));
  return remaining.length === bookmarks.length ? bookmarks : remaining;
}

export function toggleGraphBookmark(
  bookmarks: readonly GraphVisit[], visit: GraphVisit,
  targets: readonly WorkspaceUrlTarget[], groups: readonly WorkspaceNodeGroup[],
): readonly GraphVisit[] {
  if (!graphVisitExists(visit, targets, groups)) return bookmarks;
  const index = bookmarks.findIndex(entry =>
    entry.kind === visit.kind && entry.key === visit.key);
  if (index >= 0) return bookmarks.filter((_, at) => at !== index);
  if (bookmarks.length >= MAX_GRAPH_BOOKMARKS) return bookmarks;
  return [...bookmarks, { kind: visit.kind, key: visit.key }];
}

export function hasGraphBookmark(
  bookmarks: readonly GraphVisit[], visit: GraphVisit,
): boolean {
  return bookmarks.some(entry =>
    entry.kind === visit.kind && entry.key === visit.key);
}

export function getGraphBookmarkLabel(
  visit: GraphVisit, targets: readonly WorkspaceUrlTarget[],
  groups: readonly WorkspaceNodeGroup[],
): string | null {
  if (visit.kind === "group") {
    return groups.find(group => group.id === visit.key)?.name ?? null;
  }
  return targets.find(target => workspaceUrlTargetKey(target) === visit.key)?.id ?? null;
}

/**
 * An empty query with 'all' scope returns no results as before.
 * Non-default scopes browse registered objects; never hide or mutate the canvas.
 */
export function filterGraphExplorerHits(
  targets: readonly WorkspaceUrlTarget[], groups: readonly WorkspaceNodeGroup[],
  bookmarks: readonly GraphVisit[], query: string, scope: GraphExplorerScope,
): readonly GraphSearchHit[] {
  const text = query.trim().slice(0, 80);
  if (scope === "all" && !text) return [];
  const source = text
    ? searchWorkspaceGraph(targets, groups, text)
    : [
        ...groups.map(group => ({
          kind: "group" as const, key: group.id, label: group.name,
          detail: "사용자 그룹 · " + group.memberKeys.length + "개",
        })),
        ...[...targets].reverse().map(target => ({
          kind: "target" as const,
          key: workspaceUrlTargetKey(target),
          label: target.id,
          detail: target.kind === "VIDEO" ? "등록 영상 · 미확인" : "등록 채널 · 미확인",
        })),
      ];
  if (scope === "all") return source;
  if (scope === "group") return source.filter(hit => hit.kind === "group");
  if (scope === "bookmarked") return source.filter(hit => hasGraphBookmark(bookmarks, hit));
  return source.filter(hit => {
    if (hit.kind !== "target") return false;
    const target = targets.find(item => workspaceUrlTargetKey(item) === hit.key);
    return target && (scope === "video"
      ? target.kind === "VIDEO" : target.kind !== "VIDEO");
  });
}
