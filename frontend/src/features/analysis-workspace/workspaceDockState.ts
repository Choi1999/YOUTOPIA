/**
 * UI-R04-AD-1 — a single, UI-only dock selection/visibility/width model.
 *
 * No metadata, YouTube relation, provider I/O or account identity enters
 * this state. A target key is accepted ONLY from currently registered URLs.
 * The existing bounded/sanitized focus width persistence contract remains.
 */
import {
  workspaceUrlTargetKey, type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import type { FocusDockLayout, FocusDockSide } from "./workspaceFocusLayout";

export type WorkspaceDockState = Readonly<{
  selectedKey: string | null;
  listOpen: boolean;
  detailOpen: boolean;
  widths: FocusDockLayout | null;
}>;

export function createWorkspaceDockState(
  widths: FocusDockLayout | null = null,
): WorkspaceDockState {
  return { selectedKey: null, listOpen: false, detailOpen: false, widths };
}

function isKnownTarget(key:string,targets:readonly WorkspaceUrlTarget[]):boolean {
  return targets.some(target=>workspaceUrlTargetKey(target)===key);
}

/** All entrypoints (graph/list/card/URL ingest) use this same transition. */
export function chooseWorkspaceDockTarget(
  state:WorkspaceDockState, key:string|null,
  targets:readonly WorkspaceUrlTarget[], narrow=false,
):WorkspaceDockState {
  if (key!==null && !isKnownTarget(key,targets)) return state;
  const next:WorkspaceDockState={
    ...state, selectedKey:key,
    detailOpen:key!==null,
    listOpen:key!==null && narrow ? false : state.listOpen,
  };
  return state.selectedKey===next.selectedKey &&
      state.detailOpen===next.detailOpen &&
      state.listOpen===next.listOpen ? state : next;
}

/** On a narrow viewport list and detail are mutually exclusive. */
export function toggleWorkspaceDockSide(
  state:WorkspaceDockState, side:FocusDockSide, narrow=false,
):WorkspaceDockState {
  const open=side==="list"?!state.listOpen:!state.detailOpen;
  const next={
    ...state,
    listOpen:side==="list"?open:narrow?false:state.listOpen,
    detailOpen:side==="detail"?open:narrow?false:state.detailOpen,
  };
  return next.listOpen===state.listOpen && next.detailOpen===state.detailOpen
    ?state:next;
}
export function closeWorkspaceDockSide(
  state:WorkspaceDockState, side:FocusDockSide,
):WorkspaceDockState {
  if (side==="list")return state.listOpen?{...state,listOpen:false}:state;
  return state.detailOpen?{...state,detailOpen:false}:state;
}
export function withWorkspaceDockWidths(
  state:WorkspaceDockState, widths:FocusDockLayout|null,
):WorkspaceDockState {
  if (state.widths===widths || (state.widths && widths &&
      state.widths.list===widths.list && state.widths.detail===widths.detail))
    return state;
  return {...state,widths};
}

/**
 * Target removal cannot leave a phantom selected target/detail panel.
 * We intentionally keep the list panel and width preferences.
 */
export function reconcileWorkspaceDockState(
  state:WorkspaceDockState, targets:readonly WorkspaceUrlTarget[],
):WorkspaceDockState {
  if (state.selectedKey===null || isKnownTarget(state.selectedKey,targets))
    return state;
  return {...state,selectedKey:null,detailOpen:false};
}
