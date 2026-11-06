import { beforeEach, describe, expect, it } from "vitest";
import {
  WORKSPACE_NAMED_SNAPSHOTS_KEY,
  MAX_NAMED_WORKSPACES, deleteNamedWorkspace,
  listNamedWorkspaces, renameNamedWorkspace, restoreNamedWorkspace,
  saveNamedWorkspace,
} from "./workspaceNamedSnapshots";
import {
  WORKSPACE_BROWSER_SNAPSHOT_KEY, saveWorkspaceToBrowser,
} from "./workspaceBrowserSnapshot";
import {
  addWorkspaceUrlTargets, readWorkspaceUrlTargets,
  writeWorkspaceUrlTargets, workspaceUrlTargetKey,
} from "./workspaceUrlTargets";
import {
  readTargetPresentation, writeTargetPresentation,
} from "./workspaceTargetPresentation";

const T = 1_800_000_000_000;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function register(url: string, time = T) {
  const targets=addWorkspaceUrlTargets([],url,time).targets;
  expect(targets).toHaveLength(1);
  expect(writeWorkspaceUrlTargets(sessionStorage,targets,time)).toBe(true);
  return targets;
}

describe("UI-R04-AM named same-browser workspace library", () => {
  it("preserves two independent named configurations after the tab is cleared", () => {
    const first = register("https://youtu.be/Ab0_-123xyz");
    const key = workspaceUrlTargetKey(first[0]);
    expect(writeTargetPresentation(sessionStorage,{
      labels:{ [key]:"한식 레시피" },channelImages:{},
    },first,T)).toBe(true);
    expect(saveNamedWorkspace(sessionStorage,localStorage,"요리 채널",T+1))
      .toEqual({ name:"요리 채널",count:1,savedAt:T+1 });

    sessionStorage.clear();
    register("https://youtu.be/Cb0_-123xyz",T+2);
    expect(saveNamedWorkspace(sessionStorage,localStorage,"게임 채널",T+3))
      .toEqual({ name:"게임 채널",count:1,savedAt:T+3 });

    const entries=listNamedWorkspaces(localStorage,T+4);
    expect(entries?.map(item=>item.name))
      .toEqual(["게임 채널","요리 채널"]);

    sessionStorage.clear();
    const later=T+4*60*60*1000;
    expect(restoreNamedWorkspace(sessionStorage,localStorage,"요리 채널",later))
      .toMatchObject({name:"요리 채널",count:1});
    const restored=readWorkspaceUrlTargets(sessionStorage,later);
    expect(restored.map(item=>item.id)).toEqual(["Ab0_-123xyz"]);
    expect(readTargetPresentation(sessionStorage,restored,later).labels[key])
      .toBe("한식 레시피");
    expect(restoreNamedWorkspace(sessionStorage,localStorage,"게임 채널",later+1))
      .toMatchObject({name:"게임 채널",count:1});
    expect(readWorkspaceUrlTargets(sessionStorage,later+1).map(item=>item.id))
      .toEqual(["Cb0_-123xyz"]);
  });

  it("enforces eight unique names, supports replacement, rename and isolated deletion", () => {
    register("https://youtu.be/Ab0_-123xyz");
    expect(saveNamedWorkspace(sessionStorage,localStorage,"",T+1)).toBeNull();
    expect(saveNamedWorkspace(sessionStorage,localStorage,"\n",T+1)).toBeNull();
    expect(saveNamedWorkspace(sessionStorage,localStorage,"x".repeat(41),T+1))
      .toBeNull();
    for(let i=0;i<MAX_NAMED_WORKSPACES;i++) {
      expect(saveNamedWorkspace(sessionStorage,localStorage,"slot-"+i,T+i+1))
        .not.toBeNull();
    }
    expect(listNamedWorkspaces(localStorage,T+20)).toHaveLength(8);
    expect(saveNamedWorkspace(sessionStorage,localStorage,"another",T+21))
      .toBeNull();
    expect(saveNamedWorkspace(sessionStorage,localStorage,"slot-0",T+22))
      .not.toBeNull();
    expect(renameNamedWorkspace(localStorage,"slot-0","slot-1",T+23))
      .toBe(false);
    expect(renameNamedWorkspace(localStorage,"slot-0","이름 변경됨",T+23))
      .toBe(true);
    expect(listNamedWorkspaces(localStorage,T+23)?.map(item=>item.name))
      .toContain("이름 변경됨");
    expect(deleteNamedWorkspace(localStorage,"slot-1",T+23)).toBe(true);
    expect(listNamedWorkspaces(localStorage,T+23)).toHaveLength(7);
    expect(deleteNamedWorkspace(localStorage,"not-existing",T+23)).toBe(false);
  });

  it("rejects tampered entries without altering current workspaces", () => {
    register("https://youtu.be/Ab0_-123xyz");
    expect(saveNamedWorkspace(sessionStorage,localStorage,"원본",T+1))
      .not.toBeNull();
    const before=sessionStorage.getItem("youtopia-workspace-url-targets-v1");
    const parsed=JSON.parse(localStorage.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY)!);
    const backup=JSON.parse(parsed.slots[0].snapshot);
    backup.urls[0]="https://not-youtube.example.com/Ab0_-123xyz";
    parsed.slots[0].snapshot=JSON.stringify(backup);
    localStorage.setItem(WORKSPACE_NAMED_SNAPSHOTS_KEY,JSON.stringify(parsed));
    expect(listNamedWorkspaces(localStorage,T+2)).toBeNull();
    expect(restoreNamedWorkspace(sessionStorage,localStorage,"원본",T+2))
      .toBeNull();
    expect(saveNamedWorkspace(sessionStorage,localStorage,"새 보관",T+2))
      .toBeNull();
    expect(sessionStorage.getItem("youtopia-workspace-url-targets-v1"))
      .toEqual(before);
  });

  it("keeps the existing single AL backup separate from named backups", () => {
    register("https://youtu.be/Ab0_-123xyz");
    expect(saveWorkspaceToBrowser(sessionStorage,localStorage,T+1))
      .not.toBeNull();
    const original=localStorage.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY);
    expect(saveNamedWorkspace(sessionStorage,localStorage,"개별 보관",T+2))
      .not.toBeNull();
    expect(renameNamedWorkspace(localStorage,"개별 보관","이름 바꿈",T+3))
      .toBe(true);
    expect(deleteNamedWorkspace(localStorage,"이름 바꿈",T+3)).toBe(true);
    expect(listNamedWorkspaces(localStorage,T+4)).toEqual([]);
    expect(localStorage.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY)).toBeNull();
    expect(localStorage.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY))
      .toBe(original);
  });

  it("handles unavailable browser storage by rejecting writes", () => {
    register("https://youtu.be/Ab0_-123xyz");
    const denied={
      getItem: (_key:string) => null,
      setItem: (_key:string,_value:string) => {throw Error("quota");},
      removeItem: (_key:string) => {throw Error("blocked");},
    };
    expect(saveNamedWorkspace(sessionStorage,denied,"차단",T+1)).toBeNull();
    expect(listNamedWorkspaces(denied,T+1)).toEqual([]);
  });
});
