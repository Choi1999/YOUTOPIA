import { describe, expect, it } from "vitest";
import {
  EMPTY_GRAPH_HISTORY, centeredGraphPan, graphVisitExists,
  pushGraphVisit, searchWorkspaceGraph, stepGraphHistory,
} from "./workspaceGraphNavigation";
import { createWorkspaceNodeGroup } from "./workspaceNodeGroups";
import { addWorkspaceUrlTargets, workspaceUrlTargetKey } from "./workspaceUrlTargets";

const targets = addWorkspaceUrlTargets([], [
  "https://youtu.be/A0000000000",
  "https://youtu.be/A0000000001",
  "https://www.youtube.com/@SampleCreator",
].join("\n")).targets;
const keys = targets.map(workspaceUrlTargetKey);
const groups = createWorkspaceNodeGroup(
  [], targets, keys.slice(0, 2), "영상 검토 묶음", "teal",
);

describe("UI-R04-L — evidence-neutral graph search", () => {
  it("searches group names and registered video/channel identifiers only", () => {
    expect(searchWorkspaceGraph(targets, groups, "")).toEqual([]);
    expect(searchWorkspaceGraph(targets, groups, "   ")).toEqual([]);
    const groupHits = searchWorkspaceGraph(targets, groups, "검토");
    expect(groupHits).toEqual([{
      kind: "group", key: "group-1", label: "영상 검토 묶음",
      detail: "사용자 그룹 · 2개",
    }]);
    const targetHits = searchWorkspaceGraph(targets, groups, "A0000000000");
    expect(targetHits.some(hit => hit.kind === "target" && hit.key === keys[0]))
      .toBe(true);
    expect(searchWorkspaceGraph(targets, groups, "@SAMPLECREATOR"))
      .toMatchObject([{ kind: "target", key: keys[2] }]);
    expect(searchWorkspaceGraph(targets, groups, "not-a-video-title")).toEqual([]);
  });
  it("preserves exact source data without adding unverified edges or metadata", () => {
    const before = JSON.stringify({ targets, groups });
    const hits = searchWorkspaceGraph(targets, groups, "youtube.com/watch?v=A0000000000");
    expect(hits).toMatchObject([{ kind: "target", key: keys[0] }]);
    expect(JSON.stringify({ targets, groups })).toBe(before);
    expect(hits.every(hit => Object.keys(hit).sort().join("|") ===
      "detail|key|kind|label")).toBe(true);
  });
});
describe("UI-R04-L — local navigation history", () => {
  const a = { kind: "target" as const, key: keys[0] };
  const b = { kind: "target" as const, key: keys[1] };
  const g = { kind: "group" as const, key: "group-1" };

  it("supports back/forward without recording duplicate revisits", () => {
    let history = pushGraphVisit(EMPTY_GRAPH_HISTORY, a);
    expect(pushGraphVisit(history, a)).toBe(history);
    history = pushGraphVisit(history, b);
    history = pushGraphVisit(history, g);
    const back = stepGraphHistory(history, -1, () => true);
    expect(back?.visit).toEqual(b);
    const backAgain = stepGraphHistory(back!.history, -1, () => true);
    expect(backAgain?.visit).toEqual(a);
    const forward = stepGraphHistory(backAgain!.history, 1, () => true);
    expect(forward?.visit).toEqual(b);
    const alternate = pushGraphVisit(back!.history, a);
    expect(alternate.entries).toEqual([a, b, a]);
    expect(stepGraphHistory(alternate, 1, () => true)).toBeNull();
  });
  it("skips deleted target/group entries without resurrecting them", () => {
    const history = pushGraphVisit(pushGraphVisit(
      pushGraphVisit(EMPTY_GRAPH_HISTORY, a), g), b);
    expect(graphVisitExists(g, targets, groups)).toBe(true);
    expect(graphVisitExists(g, targets, [])).toBe(false);
    expect(graphVisitExists(b, targets.slice(0, 1), groups)).toBe(false);
    const back = stepGraphHistory(history, -1, visit =>
      graphVisitExists(visit, targets, []));
    expect(back?.visit).toEqual(a);
  });
  it("caps history to 40 entries and branches after back", () => {
    let history = EMPTY_GRAPH_HISTORY;
    for (let i = 0; i < 50; i++) {
      history = pushGraphVisit(history, {
        kind: "target", key: "VIDEO:" + String(i),
      });
    }
    expect(history.entries).toHaveLength(40);
    expect(history.index).toBe(39);
    expect(history.entries[0].key).toBe("VIDEO:10");
    const back = stepGraphHistory(history, -1, () => true)!;
    const next = pushGraphVisit(back.history, a);
    expect(next.entries.at(-1)).toEqual(a);
    expect(next.entries.some(entry => entry.key === "VIDEO:49")).toBe(false);
  });
});
describe("UI-R04-L — deterministic center alignment", () => {
  it("centers the selected 2.5D position with group-child offsets", () => {
    expect(centeredGraphPan({ x: 60, y: 25 }, 1000, 600, 1))
      .toEqual({ x: -100, y: 150 });
    expect(centeredGraphPan({ x: 50, y: 50 }, 800, 400, 2, {
      x: 45, y: -25,
    })).toEqual({ x: -90, y: 50 });
    expect(centeredGraphPan({ x: 50, y: 50 }, 0, 0, 1))
      .toEqual({ x: 0, y: 0 });
  });
});
