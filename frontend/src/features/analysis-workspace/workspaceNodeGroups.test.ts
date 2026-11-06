import { afterEach, describe, expect, it } from "vitest";
import {
  WORKSPACE_NODE_GROUPS_KEY, WORKSPACE_MAX_GROUP_MEMBERS,
  collapseWorkspaceNodeGroup, colorWorkspaceNodeGroup,
  createWorkspaceNodeGroup, dissolveWorkspaceNodeGroup,
  moveWorkspaceNodeGroup, readWorkspaceNodeGroups,
  reconcileWorkspaceNodeGroups, renameWorkspaceNodeGroup,
  writeWorkspaceNodeGroups,
} from "./workspaceNodeGroups";
import {
  WORKSPACE_URL_TARGETS_TTL_MS, addWorkspaceUrlTargets, workspaceUrlTargetKey,
} from "./workspaceUrlTargets";

const urls = Array.from({ length: 15 },
  (_, index) => "https://youtu.be/A" + String(index).padStart(10, "0"));
const targets = addWorkspaceUrlTargets([], urls.slice(0, 15).join("\n"), 1000).targets;
const keys = targets.map(workspaceUrlTargetKey);
function group(members = keys.slice(0, 2)) {
  return createWorkspaceNodeGroup([], targets, members, "내가 만든 그룹", "teal");
}

afterEach(() => sessionStorage.clear());

describe("UI-R04-K — bounded user-authored graph grouping, no inferred relationships", () => {
  it("creates groups only from 2–12 distinct registered, ungrouped URL keys", () => {
    expect(group()).toHaveLength(1);
    expect(group()[0]).toEqual({
      id: "group-1", name: "내가 만든 그룹", color: "teal",
      memberKeys: keys.slice(0, 2), collapsed: false, offsetX: 0, offsetY: 0,
    });
    expect(createWorkspaceNodeGroup([], targets, [keys[0]], "a", "blue")).toEqual([]);
    expect(createWorkspaceNodeGroup([], targets, [keys[0], keys[0]], "a", "blue"))
      .toEqual([]);
    expect(createWorkspaceNodeGroup([], targets, [...keys.slice(0, 12), keys[12]],
      "too many", "blue")).toEqual([]);
    expect(createWorkspaceNodeGroup([], targets, [keys[0], "VIDEO:fake"], "bad", "blue"))
      .toEqual([]);
    expect(createWorkspaceNodeGroup(group(), targets, [keys[1], keys[2]], "duplicate", "blue"))
      .toEqual(group());
    expect(createWorkspaceNodeGroup([], targets, keys.slice(0, WORKSPACE_MAX_GROUP_MEMBERS),
      "full", "violet")).toHaveLength(1);
  });

  it("does not alter target identities, URL registration or underlying relationships", () => {
    const before = JSON.stringify(targets);
    const created = group();
    const renamed = renameWorkspaceNodeGroup(created, "group-1", "작업 그룹");
    const recolored = colorWorkspaceNodeGroup(renamed, "group-1", "violet");
    const folded = collapseWorkspaceNodeGroup(recolored, "group-1", true);
    const moved = moveWorkspaceNodeGroup(folded, "group-1", 999, -999);
    expect(moved[0]).toMatchObject({
      name: "작업 그룹", color: "violet", collapsed: true,
      offsetX: 320, offsetY: -320,
    });
    expect(JSON.stringify(targets)).toBe(before);
    expect(dissolveWorkspaceNodeGroup(moved, "group-1")).toEqual([]);
  });

  it("prunes removed URLs and dissolves groups smaller than two", () => {
    const created = group(keys.slice(0, 3));
    const oneRemoved = reconcileWorkspaceNodeGroups(created, targets.slice(1));
    expect(oneRemoved[0].memberKeys).toEqual(keys.slice(1, 3));
    expect(reconcileWorkspaceNodeGroups(oneRemoved, targets.slice(2))).toEqual([]);
    expect(reconcileWorkspaceNodeGroups(created, targets)).toBe(created);
  });

  it("persists a strict bounded schema within the URL target two-hour TTL", () => {
    const created = group();
    expect(writeWorkspaceNodeGroups(sessionStorage, created, targets, 1000)).toBe(true);
    expect(readWorkspaceNodeGroups(sessionStorage, targets, 1500)).toEqual(created);
    expect(readWorkspaceNodeGroups(
      sessionStorage, targets, 1000 + WORKSPACE_URL_TARGETS_TTL_MS + 1,
    )).toEqual([]);
    expect(readWorkspaceNodeGroups(sessionStorage, targets.slice(2), 1500)).toEqual([]);
    expect(sessionStorage.getItem(WORKSPACE_NODE_GROUPS_KEY)).not.toContain("youtu.be");
    expect(writeWorkspaceNodeGroups(sessionStorage, [], targets, 1500)).toBe(true);
    expect(sessionStorage.getItem(WORKSPACE_NODE_GROUPS_KEY)).toBeNull();
  });

  it("rejects contaminated schema, duplicate membership, and malformed offsets", () => {
    const base = group()[0];
    const write = (data: unknown) => sessionStorage.setItem(
      WORKSPACE_NODE_GROUPS_KEY,
      JSON.stringify({ version: 1, savedAt: 1000, groups: data }),
    );
    for (const invalid of [
      [{...base, color: "red"}],
      [{...base, memberKeys: [keys[0], keys[0]]}],
      [{...base, offsetX: 9999}],
      [{...base, name: "<".repeat(41)}],
      [{...base, unexpected: "network"}],
      [base, {...base, id: "group-2", memberKeys: [keys[0], keys[2]]}],
      [{...base, id: "group-100"}],
    ]) {
      write(invalid);
      expect(readWorkspaceNodeGroups(sessionStorage, targets, 1100)).toEqual([]);
    }
  });

  it("ignores invalid JSON and blocked storage without throwing", () => {
    sessionStorage.setItem(WORKSPACE_NODE_GROUPS_KEY, "{");
    expect(readWorkspaceNodeGroups(sessionStorage, targets, 2000)).toEqual([]);
    const blocked = {
      getItem() { throw new Error("denied"); },
      setItem() { throw new Error("denied"); },
      removeItem() { throw new Error("denied"); },
    } as unknown as Storage;
    expect(readWorkspaceNodeGroups(blocked, targets, 1500)).toEqual([]);
    expect(writeWorkspaceNodeGroups(blocked, group(), targets, 1500)).toBe(false);
    expect(writeWorkspaceNodeGroups(blocked, [], targets, 1500)).toBe(false);
  });
});
