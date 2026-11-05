import { afterEach, describe, expect, it } from "vitest";
import {
  WORKSPACE_GRAPH_BOOKMARKS_KEY, MAX_GRAPH_BOOKMARKS,
  filterGraphExplorerHits, getGraphBookmarkLabel, hasGraphBookmark,
  readGraphBookmarks, reconcileGraphBookmarks, toggleGraphBookmark, writeGraphBookmarks,
} from "./workspaceGraphBookmarks";
import { createWorkspaceNodeGroup } from "./workspaceNodeGroups";
import {
  addWorkspaceUrlTargets, WORKSPACE_URL_TARGETS_TTL_MS, workspaceUrlTargetKey,
} from "./workspaceUrlTargets";
import type { GraphVisit } from "./workspaceGraphNavigation";

const raw = [
  "https://youtu.be/A0000000000",
  "https://youtu.be/A0000000001",
  "https://www.youtube.com/@samplecreator",
];
const targets = addWorkspaceUrlTargets([], raw.join("\n"), 1000).targets;
const ids = targets.map(workspaceUrlTargetKey);
const groups = createWorkspaceNodeGroup([], targets, ids.slice(0, 2),
  "내가 만든 묶음", "teal");
const a: GraphVisit = { kind: "target", key: ids[0] };
const channel: GraphVisit = { kind: "target", key: ids[2] };
const g: GraphVisit = { kind: "group", key: "group-1" };

afterEach(() => sessionStorage.clear());

describe("UI-R04-M — safe local graph bookmarks", () => {
  it("toggles registered target and user-created group without mutating canonical data", () => {
    const original = JSON.stringify({ targets, groups });
    let bookmarks = toggleGraphBookmark([], a, targets, groups);
    expect(bookmarks).toEqual([a]);
    bookmarks = toggleGraphBookmark(bookmarks, g, targets, groups);
    expect(hasGraphBookmark(bookmarks, a)).toBe(true);
    expect(getGraphBookmarkLabel(g, targets, groups)).toBe("내가 만든 묶음");
    expect(getGraphBookmarkLabel(channel, targets, groups)).toBe("@samplecreator");
    expect(getGraphBookmarkLabel({ kind: "group", key: "group-2" },
      targets, groups)).toBeNull();
    bookmarks = toggleGraphBookmark(bookmarks, a, targets, groups);
    expect(bookmarks).toEqual([g]);
    expect(toggleGraphBookmark(bookmarks, { kind: "target", key: "fake" },
      targets, groups)).toBe(bookmarks);
    expect(JSON.stringify({ targets, groups })).toBe(original);
  });

  it("caps saved selections to 32 and prunes stale group/URL references", () => {
    const large = addWorkspaceUrlTargets([], Array.from({ length: 40 }, (_, i) =>
      "https://youtu.be/B" + String(i).padStart(10, "0")).join("\n"), 1000).targets;
    let saved: readonly GraphVisit[] = [];
    for (const target of large) {
      saved = toggleGraphBookmark(saved,
        { kind: "target", key: workspaceUrlTargetKey(target) }, large, []);
    }
    expect(saved).toHaveLength(MAX_GRAPH_BOOKMARKS);
    const set = [a, channel, g];
    expect(reconcileGraphBookmarks(set, targets.slice(1), []))
      .toEqual([channel]);
    expect(reconcileGraphBookmarks(set, targets, groups)).toBe(set);
  });

  it("stores only allowed identities with URL-session TTL and clears on last removal", () => {
    const saved = [a, channel, g];
    expect(writeGraphBookmarks(sessionStorage, saved, targets, groups, 1000)).toBe(true);
    const record = sessionStorage.getItem(WORKSPACE_GRAPH_BOOKMARKS_KEY);
    expect(record).toContain('"version":1');
    expect(record).not.toContain("https:");
    expect(readGraphBookmarks(sessionStorage, targets, groups, 1500)).toEqual(saved);
    expect(readGraphBookmarks(sessionStorage, targets, groups,
      1000 + WORKSPACE_URL_TARGETS_TTL_MS + 1)).toEqual([]);
    expect(readGraphBookmarks(sessionStorage, targets, [], 1500)).toEqual([]);
    expect(writeGraphBookmarks(sessionStorage, [], targets, groups, 1500)).toBe(true);
    expect(sessionStorage.getItem(WORKSPACE_GRAPH_BOOKMARKS_KEY)).toBeNull();
  });

  it("fails closed on untrusted records, duplicate items, and blocked storage", () => {
    const wrap = (bookmarks: unknown) =>
      sessionStorage.setItem(WORKSPACE_GRAPH_BOOKMARKS_KEY,
        JSON.stringify({ version: 1, savedAt: 1000, bookmarks }));
    for (const bad of [
      [{...a, token: "secret"}],
      [{...a, key: "VIDEO:not_registered"}],
      [{...a, kind: "bad"}],
      [a, a],
      new Array(MAX_GRAPH_BOOKMARKS + 1).fill(a),
    ]) {
      wrap(bad);
      expect(readGraphBookmarks(sessionStorage, targets, groups, 1500)).toEqual([]);
    }
    sessionStorage.setItem(WORKSPACE_GRAPH_BOOKMARKS_KEY, "{");
    expect(readGraphBookmarks(sessionStorage, targets, groups, 1500)).toEqual([]);
    const blocked = {
      getItem() { throw Error("blocked"); },
      setItem() { throw Error("blocked"); },
      removeItem() { throw Error("blocked"); },
    } as unknown as Storage;
    expect(readGraphBookmarks(blocked, targets, groups, 1500)).toEqual([]);
    expect(writeGraphBookmarks(blocked, [a], targets, groups, 1500)).toBe(false);
    expect(writeGraphBookmarks(blocked, [], targets, groups, 1500)).toBe(false);
  });
});

describe("UI-R04-M — results filter does not hide graph nodes", () => {
  it("keeps default empty search empty and lists selected target categories", () => {
    expect(filterGraphExplorerHits(targets, groups, [], "", "all")).toEqual([]);
    expect(filterGraphExplorerHits(targets, groups, [], "", "video")
      .map(hit => hit.label)).toEqual(["A0000000001", "A0000000000"]);
    expect(filterGraphExplorerHits(targets, groups, [], "", "channel")
      .map(hit => hit.label)).toEqual(["@samplecreator"]);
    expect(filterGraphExplorerHits(targets, groups, [], "", "group")
      .map(hit => hit.label)).toEqual(["내가 만든 묶음"]);
    expect(filterGraphExplorerHits(targets, groups, [a, g], "", "bookmarked")
      .map(hit => hit.key)).toEqual(["group-1", ids[0]]);
  });

  it("applies query and filter jointly, preserving local-only provenance", () => {
    expect(filterGraphExplorerHits(targets, groups, [a, g], "A0000000000", "group"))
      .toHaveLength(0);
    expect(filterGraphExplorerHits(targets, groups, [a, g], "A0000000000", "bookmarked"))
      .toMatchObject([{ kind: "target", key: ids[0] }]);
    expect(filterGraphExplorerHits(targets, groups, [a, g], "없는 영상 이름", "all"))
      .toHaveLength(0);
    expect(filterGraphExplorerHits(targets, groups, [a, g], "묶음", "video"))
      .toHaveLength(0);
  });
});
