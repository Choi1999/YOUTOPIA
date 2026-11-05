import { describe,expect,it } from "vitest";
import {
  chooseWorkspaceDockTarget, closeWorkspaceDockSide,
  createWorkspaceDockState, reconcileWorkspaceDockState,
  toggleWorkspaceDockSide, withWorkspaceDockWidths,
} from "./workspaceDockState";
import { addWorkspaceUrlTargets } from "./workspaceUrlTargets";

const TARGETS=addWorkspaceUrlTargets([],
  "https://youtu.be/Ab0_-123xyz https://youtube.com/@somecreator").targets;
const VIDEO="VIDEO:Ab0_-123xyz";
const HANDLE="CHANNEL_HANDLE:@somecreator";

describe("UI-R04-AD-1 — shared graph/list/detail dock state",()=>{
  it("rejects unregistered selections, reuses one target key across both docks",()=>{
    const empty=createWorkspaceDockState({list:280,detail:300});
    expect(chooseWorkspaceDockTarget(empty,"VIDEO:unknown",TARGETS)).toBe(empty);
    expect(chooseWorkspaceDockTarget(empty,"VIDEO:Ab0_-123xyz.fake",TARGETS))
      .toBe(empty);
    const selected=chooseWorkspaceDockTarget(empty,VIDEO,TARGETS);
    expect(selected).toMatchObject({
      selectedKey:VIDEO,listOpen:false,detailOpen:true,
      widths:{list:280,detail:300},
    });
    const withList=toggleWorkspaceDockSide(selected,"list");
    expect(withList.listOpen).toBe(true);
    const next=chooseWorkspaceDockTarget(withList,HANDLE,TARGETS);
    expect(next.selectedKey).toBe(HANDLE);
    expect(next.listOpen).toBe(true);
    expect(next.detailOpen).toBe(true);
    expect(chooseWorkspaceDockTarget(next,HANDLE,TARGETS)).toBe(next);
  });

  it("respects narrow overlays and never drops selection on dock close",()=>{
    const selected=chooseWorkspaceDockTarget(
      createWorkspaceDockState(),VIDEO,TARGETS,true);
    expect(selected).toMatchObject({listOpen:false,detailOpen:true});
    const list=toggleWorkspaceDockSide(selected,"list",true);
    expect(list).toMatchObject({
      selectedKey:VIDEO,listOpen:true,detailOpen:false,
    });
    const detail=toggleWorkspaceDockSide(list,"detail",true);
    expect(detail).toMatchObject({
      selectedKey:VIDEO,listOpen:false,detailOpen:true,
    });
    const closed=closeWorkspaceDockSide(detail,"detail");
    expect(closed.selectedKey).toBe(VIDEO);
    expect(closed.detailOpen).toBe(false);
    expect(closeWorkspaceDockSide(closed,"detail")).toBe(closed);
  });

  it("removes orphan target references without destroying the remembered widths or list",()=>{
    const selected=toggleWorkspaceDockSide(
      chooseWorkspaceDockTarget(
        createWorkspaceDockState({list:300,detail:350}),HANDLE,TARGETS),
      "list",
    );
    expect(reconcileWorkspaceDockState(selected,TARGETS)).toBe(selected);
    const removed=reconcileWorkspaceDockState(selected,TARGETS.slice(0,1));
    expect(removed).toMatchObject({
      selectedKey:null,listOpen:true,detailOpen:false,
      widths:{list:300,detail:350},
    });
    expect(reconcileWorkspaceDockState(removed,[])).toBe(removed);
    const again=withWorkspaceDockWidths(removed,{list:300,detail:350});
    expect(again).toBe(removed);
    const reset=withWorkspaceDockWidths(removed,null);
    expect(reset.widths).toBeNull();
  });
});
