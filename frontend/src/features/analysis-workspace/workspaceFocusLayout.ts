/** UI-R04-J: isolated, bounded focus-dock sizing. No URL or API state. */
export const FOCUS_DOCK_LAYOUT_KEY = "youtopia-focus-dock-layout-v1";
export const FOCUS_LIST_MIN = 225;
export const FOCUS_DETAIL_MIN = 250;
export const FOCUS_DOCK_MAX = 480;
const FOCUS_GRAPH_MIN = 360;
const FOCUS_GRID_OVERHEAD = 90; // padding, gaps, separators and safety margin

export type FocusDockSide = "list" | "detail";
export type FocusDockLayout = Readonly<{ list: number; detail: number }>;

function between(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
function dockBudget(viewportWidth: number): number {
  return Math.max(FOCUS_LIST_MIN + FOCUS_DETAIL_MIN,
    Math.floor(viewportWidth) - FOCUS_GRAPH_MIN - FOCUS_GRID_OVERHEAD);
}
export function focusDockBounds(
  side: FocusDockSide, viewportWidth: number, otherOpen: boolean, otherWidth: number,
): Readonly<{ min: number; max: number }> {
  const min = side === "list" ? FOCUS_LIST_MIN : FOCUS_DETAIL_MIN;
  const max = Math.max(min, Math.min(FOCUS_DOCK_MAX,
    dockBudget(viewportWidth) - (otherOpen ? otherWidth : 0)));
  return { min, max };
}
export function clampFocusDockLayout(
  layout: FocusDockLayout, viewportWidth: number, listOpen: boolean, detailOpen: boolean,
): FocusDockLayout {
  let list = between(layout.list, FOCUS_LIST_MIN, FOCUS_DOCK_MAX);
  let detail = between(layout.detail, FOCUS_DETAIL_MIN, FOCUS_DOCK_MAX);
  if (listOpen && detailOpen) {
    const excess = Math.max(0, list + detail - dockBudget(viewportWidth));
    const first = Math.min(list - FOCUS_LIST_MIN, Math.ceil(excess / 2));
    list -= first;
    detail = Math.max(FOCUS_DETAIL_MIN, detail - (excess - first));
    list = Math.max(FOCUS_LIST_MIN,
      Math.min(list, dockBudget(viewportWidth) - detail));
  } else if (listOpen) {
    list = Math.min(list, dockBudget(viewportWidth));
  } else if (detailOpen) {
    detail = Math.min(detail, dockBudget(viewportWidth));
  }
  return { list: Math.round(list), detail: Math.round(detail) };
}
export function resizeFocusDockLayout(
  layout: FocusDockLayout, side: FocusDockSide, requestedWidth: number,
  viewportWidth: number, listOpen: boolean, detailOpen: boolean,
): FocusDockLayout {
  const bounded = clampFocusDockLayout(layout, viewportWidth, listOpen, detailOpen);
  const other = side === "list" ? "detail" : "list";
  const otherOpen = other === "list" ? listOpen : detailOpen;
  const limits = focusDockBounds(side, viewportWidth, otherOpen, bounded[other]);
  return { ...bounded,
    [side]: Math.round(between(requestedWidth, limits.min, limits.max)) };
}
export function readFocusDockLayout(storage: Storage | null): FocusDockLayout | null {
  try {
    const raw = storage?.getItem(FOCUS_DOCK_LAYOUT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join(",") !== "detail,list,version" ||
      record.version !== 1 ||
      !Number.isInteger(record.list) || !Number.isInteger(record.detail) ||
      (record.list as number) < FOCUS_LIST_MIN ||
      (record.list as number) > FOCUS_DOCK_MAX ||
      (record.detail as number) < FOCUS_DETAIL_MIN ||
      (record.detail as number) > FOCUS_DOCK_MAX) return null;
    return { list: record.list as number, detail: record.detail as number };
  } catch {
    return null;
  }
}
export function writeFocusDockLayout(
  storage: Storage | null, value: FocusDockLayout | null,
): void {
  try {
    if (!storage) return;
    if (value === null) {
      storage.removeItem(FOCUS_DOCK_LAYOUT_KEY);
    } else {
      storage.setItem(FOCUS_DOCK_LAYOUT_KEY,
        JSON.stringify({ version: 1, list: value.list, detail: value.detail }));
    }
  } catch {
    // Disabled or quota-limited storage must not break focus mode.
  }
}
