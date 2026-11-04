/**
 * UI-R04-K: user-authored graph layout groups only.
 * A group is an organizational choice, NEVER evidence of a YouTube
 * relationship, channel ownership, metadata, sentiment or analysis.
 * No provider requests, credentials, raw URLs or external storage.
 */
import {
  WORKSPACE_URL_TARGETS_TTL_MS, workspaceUrlTargetKey,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";

export const WORKSPACE_NODE_GROUPS_KEY = "youtopia-workspace-node-groups-v1";
export const WORKSPACE_MAX_NODE_GROUPS = 32;
export const WORKSPACE_MAX_GROUP_MEMBERS = 12;
const MAX_STORAGE_BYTES = 24_000;
const MAX_OFFSET = 320;
const ID_RE = /^group-([1-9]|[12]\d|3[0-2])$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

export const NODE_GROUP_COLORS = ["blue", "teal", "amber", "violet"] as const;
export type WorkspaceNodeGroupColor = typeof NODE_GROUP_COLORS[number];
export type WorkspaceNodeGroup = Readonly<{
  id: string;
  name: string;
  color: WorkspaceNodeGroupColor;
  memberKeys: readonly string[];
  collapsed: boolean;
  offsetX: number;
  offsetY: number;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validName(name: unknown): name is string {
  return typeof name === "string" &&
    name.length > 0 && name.length <= 40 &&
    name.trim() === name && !CONTROL.test(name);
}
function validColor(color: unknown): color is WorkspaceNodeGroupColor {
  return NODE_GROUP_COLORS.some(value => value === color);
}
function validOffset(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) &&
    Math.abs(value) <= MAX_OFFSET;
}
function validGroups(
  groups: unknown, targets: readonly WorkspaceUrlTarget[],
): groups is readonly WorkspaceNodeGroup[] {
  if (!Array.isArray(groups) || groups.length > WORKSPACE_MAX_NODE_GROUPS) return false;
  const targetKeys = new Set(targets.map(workspaceUrlTargetKey));
  const seenMembers = new Set<string>();
  const seenIds = new Set<string>();
  for (const group of groups) {
    if (!isRecord(group) ||
      Object.keys(group).sort().join("|") !==
        "collapsed|color|id|memberKeys|name|offsetX|offsetY" ||
      typeof group.id !== "string" || !ID_RE.test(group.id) ||
      seenIds.has(group.id) || !validName(group.name) ||
      !validColor(group.color) || typeof group.collapsed !== "boolean" ||
      !validOffset(group.offsetX) || !validOffset(group.offsetY) ||
      !Array.isArray(group.memberKeys) ||
      group.memberKeys.length < 2 ||
      group.memberKeys.length > WORKSPACE_MAX_GROUP_MEMBERS) return false;
    seenIds.add(group.id);
    for (const key of group.memberKeys) {
      if (typeof key !== "string" || !targetKeys.has(key) || seenMembers.has(key))
        return false;
      seenMembers.add(key);
    }
  }
  return true;
}

export function readWorkspaceNodeGroups(
  storage: Pick<Storage, "getItem"> | null | undefined,
  targets: readonly WorkspaceUrlTarget[], now = Date.now(),
): readonly WorkspaceNodeGroup[] {
  try {
    if (!Number.isSafeInteger(now) || now < 0) return [];
    const raw = storage?.getItem(WORKSPACE_NODE_GROUPS_KEY);
    if (!raw || raw.length > MAX_STORAGE_BYTES) return [];
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || Object.keys(data).sort().join("|") !==
      "groups|savedAt|version" || data.version !== 1 ||
      typeof data.savedAt !== "number" || !Number.isSafeInteger(data.savedAt) ||
      data.savedAt < 0 || data.savedAt > now ||
      now - data.savedAt > WORKSPACE_URL_TARGETS_TTL_MS ||
      !validGroups(data.groups, targets)) return [];
    return data.groups;
  } catch { return []; }
}

export function writeWorkspaceNodeGroups(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  groups: readonly WorkspaceNodeGroup[],
  targets: readonly WorkspaceUrlTarget[], now = Date.now(),
): boolean {
  if (!storage || !Number.isSafeInteger(now) || now < 0 ||
      !validGroups(groups, targets)) return false;
  try {
    if (!groups.length) {
      storage.removeItem(WORKSPACE_NODE_GROUPS_KEY);
      return true;
    }
    const payload = JSON.stringify({ version: 1, savedAt: now, groups });
    if (payload.length > MAX_STORAGE_BYTES) return false;
    storage.setItem(WORKSPACE_NODE_GROUPS_KEY, payload);
    return true;
  } catch { return false; }
}

/** Deleted/expired URL targets cannot retain stale group membership. */
export function reconcileWorkspaceNodeGroups(
  groups: readonly WorkspaceNodeGroup[], targets: readonly WorkspaceUrlTarget[],
): readonly WorkspaceNodeGroup[] {
  const keys = new Set(targets.map(workspaceUrlTargetKey));
  let changed = false;
  const next: WorkspaceNodeGroup[] = [];
  for (const group of groups) {
    const members = group.memberKeys.filter(key => keys.has(key));
    if (members.length < 2) { changed = true; continue; }
    if (members.length !== group.memberKeys.length) changed = true;
    next.push(members.length === group.memberKeys.length ? group : {
      ...group, memberKeys: members,
    });
  }
  return changed ? next : groups;
}

export function createWorkspaceNodeGroup(
  groups: readonly WorkspaceNodeGroup[], targets: readonly WorkspaceUrlTarget[],
  members: readonly string[], name: string, color: WorkspaceNodeGroupColor,
): readonly WorkspaceNodeGroup[] {
  const trimmed = name.normalize("NFC").trim();
  if (!validName(trimmed) || !validColor(color) ||
    groups.length >= WORKSPACE_MAX_NODE_GROUPS ||
    members.length < 2 || members.length > WORKSPACE_MAX_GROUP_MEMBERS ||
    new Set(members).size !== members.length) return groups;
  const available = new Set(targets.map(workspaceUrlTargetKey));
  const occupied = new Set(groups.flatMap(group => group.memberKeys));
  if (members.some(key => !available.has(key) || occupied.has(key))) return groups;
  const ids = new Set(groups.map(group => group.id));
  const sequence = Array.from({ length: WORKSPACE_MAX_NODE_GROUPS },
    (_, index) => "group-" + (index + 1));
  const id = sequence.find(candidate => !ids.has(candidate));
  if (!id) return groups;
  return [...groups, {
    id, name: trimmed, color, memberKeys: [...members], collapsed: false,
    offsetX: 0, offsetY: 0,
  }];
}

export function renameWorkspaceNodeGroup(
  groups: readonly WorkspaceNodeGroup[], id: string, name: string,
): readonly WorkspaceNodeGroup[] {
  const trimmed = name.normalize("NFC").trim();
  if (!validName(trimmed) || !groups.some(group => group.id === id)) return groups;
  return groups.map(group => group.id === id ? {...group, name: trimmed} : group);
}

export function colorWorkspaceNodeGroup(
  groups: readonly WorkspaceNodeGroup[], id: string, color: WorkspaceNodeGroupColor,
): readonly WorkspaceNodeGroup[] {
  if (!validColor(color) || !groups.some(group => group.id === id)) return groups;
  return groups.map(group => group.id === id ? {...group, color} : group);
}

export function collapseWorkspaceNodeGroup(
  groups: readonly WorkspaceNodeGroup[], id: string, collapsed: boolean,
): readonly WorkspaceNodeGroup[] {
  if (!groups.some(group => group.id === id)) return groups;
  return groups.map(group => group.id === id ? {...group, collapsed} : group);
}

export function moveWorkspaceNodeGroup(
  groups: readonly WorkspaceNodeGroup[], id: string, offsetX: number, offsetY: number,
): readonly WorkspaceNodeGroup[] {
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY) ||
    !groups.some(group => group.id === id)) return groups;
  const x = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, Math.round(offsetX)));
  const y = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, Math.round(offsetY)));
  return groups.map(group => group.id === id
    ? {...group, offsetX: x, offsetY: y} : group);
}

export function dissolveWorkspaceNodeGroup(
  groups: readonly WorkspaceNodeGroup[], id: string,
): readonly WorkspaceNodeGroup[] {
  return groups.filter(group => group.id !== id);
}
