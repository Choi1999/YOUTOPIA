/**
 * UI-R04-AM: explicit, named same-browser workspace backups.
 *
 * This is a local convenience library, NOT server persistence, cloud sync,
 * authentication or provider provenance. It stores only the AL validated
 * canonical-workspace snapshot. Each action is initiated by the user.
 */
import {
  WORKSPACE_BROWSER_SNAPSHOT_KEY,
  inspectBrowserWorkspace, restoreWorkspaceFromBrowser, saveWorkspaceToBrowser,
  type WorkspaceBrowserBackupInfo,
} from "./workspaceBrowserSnapshot";

export const WORKSPACE_NAMED_SNAPSHOTS_KEY =
  "youtopia-workspace-named-backups-v1";
export const MAX_NAMED_WORKSPACES = 8;
export const MAX_WORKSPACE_NAME_LENGTH = 40;
const MAX_LIBRARY_LENGTH = 980_000;
const MAX_SINGLE_SNAPSHOT = 120_000;
const CONTROL = /[\u0000-\u001f\u007f]/;

export type NamedWorkspaceInfo = Readonly<{
  name: string;
  count: number;
  savedAt: number;
}>;

type Slot = Readonly<{ name: string; snapshot: string }>;
type Library = Readonly<{ version: 1; slots: readonly Slot[] }>;
type StorageReader = Pick<Storage,"getItem">;
type StorageWriter = Pick<Storage,"getItem"|"setItem"|"removeItem">;

/** An isolated key/value store prevents writes to the legacy single backup. */
class MemoryStorage {
  private readonly records = new Map<string,string>();
  getItem(key: string): string | null {
    return this.records.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.records.set(key,value);
  }
  removeItem(key: string): void {
    this.records.delete(key);
  }
}

function validName(name: unknown): name is string {
  return typeof name === "string" &&
    name.length >= 1 && name.length <= MAX_WORKSPACE_NAME_LENGTH &&
    name === name.trim() && name === name.normalize("NFC") &&
    !CONTROL.test(name);
}

function normalizedName(raw: string): string | null {
  const value = raw.normalize("NFC").trim();
  return validName(value) ? value : null;
}

function infoOf(snapshot: string, now: number): WorkspaceBrowserBackupInfo | null {
  if (snapshot.length < 2 || snapshot.length > MAX_SINGLE_SNAPSHOT) return null;
  return inspectBrowserWorkspace({
    getItem: key => key === WORKSPACE_BROWSER_SNAPSHOT_KEY ? snapshot : null,
  },now);
}

/** Missing library is empty; malformed/tampered library is never auto-repaired. */
function readSlots(browser: StorageReader | null, now: number): Slot[] | null {
  if (!browser || !Number.isSafeInteger(now) || now < 0) return null;
  try {
    const raw = browser.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY);
    if (raw === null) return [];
    if (raw.length > MAX_LIBRARY_LENGTH) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const data = parsed as Record<string,unknown>;
    if (Object.keys(data).sort().join("|") !== "slots|version" ||
        data.version !== 1 || !Array.isArray(data.slots) ||
        data.slots.length < 1 || data.slots.length > MAX_NAMED_WORKSPACES)
      return null;
    const names = new Set<string>();
    const slots: Slot[] = [];
    for (const item of data.slots) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const slot = item as Record<string,unknown>;
      if (Object.keys(slot).sort().join("|") !== "name|snapshot" ||
          !validName(slot.name) || typeof slot.snapshot !== "string" ||
          names.has(slot.name) || !infoOf(slot.snapshot, now)) return null;
      names.add(slot.name);
      slots.push({ name: slot.name, snapshot: slot.snapshot });
    }
    return slots;
  } catch {
    return null;
  }
}

function writeSlots(browser: StorageWriter, slots: readonly Slot[]): boolean {
  try {
    if (slots.length === 0) {
      browser.removeItem(WORKSPACE_NAMED_SNAPSHOTS_KEY);
      return browser.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY) === null;
    }
    const payload: Library = { version: 1, slots };
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_LIBRARY_LENGTH) return false;
    browser.setItem(WORKSPACE_NAMED_SNAPSHOTS_KEY,serialized);
    return browser.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY) === serialized;
  } catch {
    return false;
  }
}

export function listNamedWorkspaces(
  browser: StorageReader | null,
  now = Date.now(),
): readonly NamedWorkspaceInfo[] | null {
  const slots = readSlots(browser,now);
  if (slots === null) return null;
  return slots.map(slot => {
    const info = infoOf(slot.snapshot,now)!;
    return { name:slot.name,count:info.count,savedAt:info.savedAt };
  });
}

/**
 * Create or replace one named slot. Never overwrites another named slot
 * or the existing unnamed AL backup. Caller must confirm replacement.
 */
export function saveNamedWorkspace(
  tab: StorageReader | null,
  browser: StorageWriter | null,
  rawName: string,
  now = Date.now(),
): NamedWorkspaceInfo | null {
  const name = normalizedName(rawName);
  if (!name || !browser || !tab) return null;
  const current = readSlots(browser,now);
  if (current === null || (current.length >= MAX_NAMED_WORKSPACES &&
      !current.some(item => item.name === name))) return null;

  const temporary = new MemoryStorage();
  const saved = saveWorkspaceToBrowser(tab,temporary,now);
  if (!saved) return null;
  const snapshot = temporary.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY);
  if (!snapshot || !infoOf(snapshot,now)) return null;

  const next: Slot[] = [
    {name,snapshot},
    ...current.filter(item => item.name !== name),
  ];
  if (!writeSlots(browser,next)) return null;
  return {name,count:saved.count,savedAt:saved.savedAt};
}

/** Restore an explicitly selected slot into exactly AL's five tab keys. */
export function restoreNamedWorkspace(
  tab: StorageWriter | null,
  browser: StorageReader | null,
  name: string,
  now = Date.now(),
): NamedWorkspaceInfo | null {
  const slots = readSlots(browser,now);
  if (slots === null || !tab) return null;
  const slot = slots.find(item => item.name === name);
  if (!slot) return null;
  const temporary = new MemoryStorage();
  temporary.setItem(WORKSPACE_BROWSER_SNAPSHOT_KEY,slot.snapshot);
  const restored = restoreWorkspaceFromBrowser(tab,temporary,now);
  return restored
    ? {name:slot.name,count:restored.count,savedAt:restored.savedAt}
    : null;
}

export function renameNamedWorkspace(
  browser: StorageWriter | null,
  oldName: string,
  rawNewName: string,
  now = Date.now(),
): boolean {
  const newName = normalizedName(rawNewName);
  const slots = readSlots(browser,now);
  if (!browser || !newName || slots === null ||
      !slots.some(item => item.name === oldName)) return false;
  if (oldName === newName) return true;
  if (slots.some(item => item.name === newName)) return false;
  return writeSlots(browser,slots.map(item =>
    item.name === oldName ? {...item,name:newName} : item));
}

export function deleteNamedWorkspace(
  browser: StorageWriter | null,
  name: string,
  now = Date.now(),
): boolean {
  const slots = readSlots(browser,now);
  if (!browser || slots === null ||
      !slots.some(item => item.name === name)) return false;
  return writeSlots(browser,slots.filter(item => item.name !== name));
}
