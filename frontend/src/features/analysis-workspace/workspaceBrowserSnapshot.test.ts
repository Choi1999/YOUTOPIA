import { beforeEach, describe, expect, it } from "vitest";
import {
  WORKSPACE_BROWSER_SNAPSHOT_KEY, deleteBrowserWorkspace,
  inspectBrowserWorkspace, restoreWorkspaceFromBrowser,
  saveWorkspaceToBrowser,
} from "./workspaceBrowserSnapshot";
import {
  addWorkspaceUrlTargets, readWorkspaceUrlTargets,
  writeWorkspaceUrlTargets, workspaceUrlTargetKey,
} from "./workspaceUrlTargets";
import {
  readTargetPresentation, writeTargetPresentation,
} from "./workspaceTargetPresentation";
import {
  createWorkspaceNodeGroup, readWorkspaceNodeGroups,
  writeWorkspaceNodeGroups,
} from "./workspaceNodeGroups";
import {
  readGraphBookmarks, toggleGraphBookmark, writeGraphBookmarks,
} from "./workspaceGraphBookmarks";
import {
  readFocusDockLayout, writeFocusDockLayout,
} from "./workspaceFocusLayout";

const T = 1_800_000_000_000;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

function populate() {
  const targets = addWorkspaceUrlTargets(
    [], "https://youtu.be/Ab0_-123xyz\nhttps://youtube.com/@SomeCreator", T,
  ).targets;
  expect(writeWorkspaceUrlTargets(sessionStorage, targets, T)).toBe(true);
  const key = workspaceUrlTargetKey(targets[0]);
  expect(writeTargetPresentation(sessionStorage, {
    labels: { [key]: "내 영상" }, channelImages: {},
  }, targets, T)).toBe(true);
  const groups = createWorkspaceNodeGroup(
    [], targets, targets.map(workspaceUrlTargetKey), "내 그룹", "teal",
  );
  expect(groups).toHaveLength(1);
  expect(writeWorkspaceNodeGroups(sessionStorage, groups, targets, T)).toBe(true);
  const bookmarks = toggleGraphBookmark(
    [], { kind: "group", key: groups[0].id }, targets, groups,
  );
  expect(writeGraphBookmarks(sessionStorage, bookmarks, targets, groups, T))
    .toBe(true);
  writeFocusDockLayout(sessionStorage, { list: 300, detail: 340 });
  return { targets, key };
}

describe("UI-R04-AL explicit same-browser local workspace snapshot", () => {
  it("preserves canonical targets, labels, groups, bookmarks and widths across tab expiry", () => {
    const { key } = populate();
    const saved = saveWorkspaceToBrowser(sessionStorage, localStorage, T + 1);
    expect(saved).toEqual({ count: 2, savedAt: T + 1 });
    const raw = localStorage.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY)!;
    expect(raw).toContain("내 그룹");
    expect(raw).not.toContain("providerStates");
    expect(raw).not.toContain("sourceAuthenticated");
    expect(inspectBrowserWorkspace(localStorage, T + 10)).toEqual(saved);
    sessionStorage.clear();
    const later = T + 3 * 60 * 60 * 1000;
    expect(readWorkspaceUrlTargets(sessionStorage, later)).toHaveLength(0);
    expect(restoreWorkspaceFromBrowser(sessionStorage, localStorage, later))
      .toEqual(saved);
    const targets = readWorkspaceUrlTargets(sessionStorage, later);
    expect(targets.map(t => t.kind)).toEqual(["VIDEO", "CHANNEL_HANDLE"]);
    expect(targets.every(t => t.addedAt === later)).toBe(true);
    expect(readTargetPresentation(sessionStorage, targets, later).labels[key])
      .toBe("내 영상");
    const groups = readWorkspaceNodeGroups(sessionStorage, targets, later);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("내 그룹");
    expect(readGraphBookmarks(sessionStorage, targets, groups, later))
      .toEqual([{ kind: "group", key: groups[0].id }]);
    expect(readFocusDockLayout(sessionStorage)).toEqual({
      list: 300, detail: 340,
    });
  });

  it("never automatically restores and does not save unrelated tab data", () => {
    populate();
    sessionStorage.setItem("youtopia-token", "NEVER_COPY_THIS");
    expect(saveWorkspaceToBrowser(sessionStorage, localStorage, T + 2))
      .not.toBeNull();
    expect(localStorage.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY))
      .not.toContain("NEVER_COPY_THIS");
    sessionStorage.clear();
    expect(readWorkspaceUrlTargets(sessionStorage, T + 3)).toHaveLength(0);
    expect(inspectBrowserWorkspace(localStorage, T + 3)?.count).toBe(2);
  });

  it("rejects modified or noncanonical backups without changing the tab", () => {
    populate();
    expect(saveWorkspaceToBrowser(sessionStorage, localStorage, T + 1))
      .not.toBeNull();
    const original = sessionStorage.getItem("youtopia-workspace-url-targets-v1");
    const parsed = JSON.parse(localStorage.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY)!);
    parsed.urls[0] = "https://evil.example/watch?v=Ab0_-123xyz";
    localStorage.setItem(WORKSPACE_BROWSER_SNAPSHOT_KEY, JSON.stringify(parsed));
    expect(inspectBrowserWorkspace(localStorage, T + 2)).toBeNull();
    expect(restoreWorkspaceFromBrowser(sessionStorage, localStorage, T + 2))
      .toBeNull();
    expect(sessionStorage.getItem("youtopia-workspace-url-targets-v1"))
      .toBe(original);
    parsed.urls[0] = "https://www.youtube.com/watch?v=Ab0_-123xyz";
    parsed.providerStates = { fake: { sourceAuthenticated: true } };
    localStorage.setItem(WORKSPACE_BROWSER_SNAPSHOT_KEY, JSON.stringify(parsed));
    expect(restoreWorkspaceFromBrowser(sessionStorage, localStorage, T + 2))
      .toBeNull();
  });

  it("does not create empty backups; deleting a backup preserves the current tab", () => {
    expect(saveWorkspaceToBrowser(sessionStorage, localStorage, T)).toBeNull();
    populate();
    expect(saveWorkspaceToBrowser(sessionStorage, localStorage, T + 1))
      .not.toBeNull();
    const before = sessionStorage.getItem("youtopia-workspace-url-targets-v1");
    expect(deleteBrowserWorkspace(localStorage)).toBe(true);
    expect(inspectBrowserWorkspace(localStorage, T + 2)).toBeNull();
    expect(sessionStorage.getItem("youtopia-workspace-url-targets-v1"))
      .toBe(before);
  });
});
