/**
 * UI-R04-L: local, evidence-neutral search and navigation.
 * Search uses only canonical registered target IDs and user-authored group labels.
 * It cannot resolve YouTube titles, relations or metadata.
 */
import { workspaceUrlTargetKey, type WorkspaceUrlTarget } from "./workspaceUrlTargets";
import type { WorkspaceNodeGroup } from "./workspaceNodeGroups";

export type GraphVisit = Readonly<{ kind: "target" | "group"; key: string }>;
export type GraphHistory = Readonly<{ entries: readonly GraphVisit[]; index: number }>;
export type GraphSearchHit = GraphVisit & Readonly<{ label: string; detail: string }>;

const MAX_HISTORY = 40;
export const EMPTY_GRAPH_HISTORY: GraphHistory = { entries: [], index: -1 };

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR");
}

/** Only an explicit non-empty query searches; never fetches provider metadata. */
export function searchWorkspaceGraph(
  targets: readonly WorkspaceUrlTarget[], groups: readonly WorkspaceNodeGroup[],
  input: string,
): readonly GraphSearchHit[] {
  const query = normalized(input.trim().slice(0, 80));
  if (!query) return [];
  const matches: GraphSearchHit[] = [];
  for (const group of groups) {
    if (normalized(group.name + " " + group.id).includes(query)) {
      matches.push({
        kind: "group", key: group.id, label: group.name,
        detail: "사용자 그룹 · " + group.memberKeys.length + "개",
      });
    }
  }
  for (const target of [...targets].reverse()) {
    const id = workspaceUrlTargetKey(target);
    if (normalized(target.id + " " + id + " " + target.canonicalUrl).includes(query)) {
      matches.push({
        kind: "target", key: id, label: target.id,
        detail: target.kind === "VIDEO" ? "등록 영상 · 미확인" : "등록 채널 · 미확인",
      });
    }
  }
  return matches;
}

export function graphVisitExists(
  visit: GraphVisit, targets: readonly WorkspaceUrlTarget[],
  groups: readonly WorkspaceNodeGroup[],
): boolean {
  if (visit.kind === "group") return groups.some(group => group.id === visit.key);
  return targets.some(target => workspaceUrlTargetKey(target) === visit.key);
}

function sameVisit(a: GraphVisit, b: GraphVisit) {
  return a.kind === b.kind && a.key === b.key;
}

/** No history entries for transient search-as-you-type previews. */
export function pushGraphVisit(history: GraphHistory, visit: GraphVisit): GraphHistory {
  const current = history.entries[history.index];
  if (current && sameVisit(current, visit)) return history;
  const prefix = [...history.entries.slice(0, history.index + 1), visit];
  const bounded = prefix.slice(-MAX_HISTORY);
  return { entries: bounded, index: bounded.length - 1 };
}

export function stepGraphHistory(
  history: GraphHistory, direction: -1 | 1,
  valid: (visit: GraphVisit) => boolean,
): Readonly<{ history: GraphHistory; visit: GraphVisit }> | null {
  for (let i = history.index + direction;
    i >= 0 && i < history.entries.length; i += direction) {
    const visit = history.entries[i];
    if (valid(visit)) return {
      history: { entries: history.entries, index: i }, visit,
    };
  }
  return null;
}

/** Center the selected graph item in its current, deterministic page. */
export function centeredGraphPan(
  point: Readonly<{ x: number; y: number }>,
  width: number, height: number, zoom: number,
  offset: Readonly<{ x: number; y: number }> = { x: 0, y: 0 },
): Readonly<{ x: number; y: number }> {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1000;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 600;
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    x: Math.round(((50 - point.x) * safeWidth / 100 - offset.x) * safeZoom),
    y: Math.round(((50 - point.y) * safeHeight / 100 - offset.y) * safeZoom),
  };
}
