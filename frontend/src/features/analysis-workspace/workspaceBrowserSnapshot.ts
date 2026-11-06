/**
 * UI-R04-AL: explicit same-browser workspace backup, NEVER cloud sync.
 * Stores only canonical URL targets, user-written labels/artwork, group choices,
 * graph bookmarks and dock widths. No provider response, cookies, sessions,
 * OAuth tokens, comments, telemetry or external API access.
 */
import {
  parseWorkspaceYouTubeUrl, readWorkspaceUrlTargets, writeWorkspaceUrlTargets,
  workspaceUrlTargetKey, WORKSPACE_MAX_URL_TARGETS, WORKSPACE_URL_TARGETS_KEY,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import {
  readTargetPresentation, writeTargetPresentation,
  WORKSPACE_TARGET_PRESENTATION_KEY,
  type WorkspaceTargetPresentation,
} from "./workspaceTargetPresentation";
import {
  readWorkspaceNodeGroups, writeWorkspaceNodeGroups,
  WORKSPACE_NODE_GROUPS_KEY, type WorkspaceNodeGroup,
} from "./workspaceNodeGroups";
import {
  readGraphBookmarks, writeGraphBookmarks,
  WORKSPACE_GRAPH_BOOKMARKS_KEY,
} from "./workspaceGraphBookmarks";
import type { GraphVisit } from "./workspaceGraphNavigation";
import {
  FOCUS_DOCK_LAYOUT_KEY, readFocusDockLayout, writeFocusDockLayout,
  type FocusDockLayout,
} from "./workspaceFocusLayout";

export const WORKSPACE_BROWSER_SNAPSHOT_KEY = "youtopia-workspace-browser-backup-v1";
const MAX_SNAPSHOT_LENGTH = 120_000;
const SESSION_KEYS = [
  WORKSPACE_URL_TARGETS_KEY,
  WORKSPACE_TARGET_PRESENTATION_KEY,
  WORKSPACE_NODE_GROUPS_KEY,
  WORKSPACE_GRAPH_BOOKMARKS_KEY,
  FOCUS_DOCK_LAYOUT_KEY,
] as const;

type Backup = Readonly<{
  version: 1;
  savedAt: number;
  urls: readonly string[];
  labels: Readonly<Record<string, string>>;
  channelImages: Readonly<Record<string, string>>;
  groups: readonly WorkspaceNodeGroup[];
  bookmarks: readonly GraphVisit[];
  dock: FocusDockLayout | null;
}>;

export type WorkspaceBrowserBackupInfo = Readonly<{
  count: number;
  savedAt: number;
}>;

type StorageRW = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Staging storage is used for full validation before touching the live tab. */
class MemoryStorage implements Storage {
  private readonly records = new Map<string, string>();
  get length(): number { return this.records.size; }
  clear(): void { this.records.clear(); }
  key(index: number): string | null {
    return [...this.records.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.records.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.records.set(key, value);
  }
  removeItem(key: string): void {
    this.records.delete(key);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stageBackup(raw: unknown, now: number): {
  snapshot: Backup;
  stage: MemoryStorage;
} | null {
  if (!Number.isSafeInteger(now) || now < 0 || !record(raw) ||
      Object.keys(raw).sort().join("|") !==
        "bookmarks|channelImages|dock|groups|labels|savedAt|urls|version" ||
      raw.version !== 1 || !Number.isSafeInteger(raw.savedAt) ||
      (raw.savedAt as number) < 0 || (raw.savedAt as number) > now ||
      !Array.isArray(raw.urls) || raw.urls.length < 1 ||
      raw.urls.length > WORKSPACE_MAX_URL_TARGETS) return null;
  try {
    const targets: WorkspaceUrlTarget[] = [];
    const seen = new Set<string>();
    for (const url of raw.urls) {
      if (typeof url !== "string" || url.length > 2048) return null;
      const parsed = parseWorkspaceYouTubeUrl(url);
      if (!parsed || parsed.canonicalUrl !== url) return null;
      const key = workspaceUrlTargetKey(parsed);
      if (seen.has(key)) return null;
      seen.add(key);
      targets.push({ ...parsed, addedAt: now });
    }

    const stage = new MemoryStorage();
    if (!writeWorkspaceUrlTargets(stage, targets, now)) return null;
    const presentation: WorkspaceTargetPresentation = {
      labels: raw.labels as Record<string, string>,
      channelImages: raw.channelImages as Record<string, string>,
    };
    if (!writeTargetPresentation(stage, presentation, targets, now)) return null;
    const groups = raw.groups as WorkspaceNodeGroup[];
    if (!writeWorkspaceNodeGroups(stage, groups, targets, now)) return null;
    const bookmarks = raw.bookmarks as GraphVisit[];
    if (!writeGraphBookmarks(stage, bookmarks, targets, groups, now)) return null;

    if (raw.dock !== null) {
      if (!record(raw.dock) ||
          Object.keys(raw.dock).sort().join("|") !== "detail|list" ||
          !Number.isInteger(raw.dock.list) ||
          !Number.isInteger(raw.dock.detail)) return null;
      const dock: FocusDockLayout = {
        list: raw.dock.list as number, detail: raw.dock.detail as number,
      };
      writeFocusDockLayout(stage, dock);
      const reread = readFocusDockLayout(stage);
      if (!reread || reread.list !== dock.list || reread.detail !== dock.detail)
        return null;
    }

    const snapshot: Backup = {
      version: 1, savedAt: raw.savedAt as number,
      urls: [...raw.urls] as string[],
      labels: presentation.labels, channelImages: presentation.channelImages,
      groups, bookmarks, dock: raw.dock as FocusDockLayout | null,
    };
    return { snapshot, stage };
  } catch {
    return null;
  }
}

function readBackup(
  browser: Pick<Storage, "getItem"> | null,
  now: number,
): ReturnType<typeof stageBackup> {
  try {
    const text = browser?.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY);
    if (!text || text.length > MAX_SNAPSHOT_LENGTH) return null;
    return stageBackup(JSON.parse(text) as unknown, now);
  } catch {
    return null;
  }
}

export function inspectBrowserWorkspace(
  browser: Pick<Storage, "getItem"> | null,
  now = Date.now(),
): WorkspaceBrowserBackupInfo | null {
  const valid = readBackup(browser, now);
  return valid
    ? { count: valid.snapshot.urls.length, savedAt: valid.snapshot.savedAt }
    : null;
}

export function saveWorkspaceToBrowser(
  tab: Pick<Storage, "getItem"> | null,
  browser: StorageRW | null,
  now = Date.now(),
): WorkspaceBrowserBackupInfo | null {
  if (!tab || !browser) return null;
  try {
    const targets = readWorkspaceUrlTargets(tab, now);
    if (!targets.length) return null;
    const presentation = readTargetPresentation(tab, targets, now);
    const groups = readWorkspaceNodeGroups(tab, targets, now);
    const bookmarks = readGraphBookmarks(tab, targets, groups, now);
    const snapshot: Backup = {
      version: 1, savedAt: now, urls: targets.map(t => t.canonicalUrl),
      labels: presentation.labels, channelImages: presentation.channelImages,
      groups, bookmarks,
      dock: readFocusDockLayout(tab as Storage),
    };
    if (!stageBackup(snapshot, now)) return null;
    const text = JSON.stringify(snapshot);
    if (text.length > MAX_SNAPSHOT_LENGTH) return null;
    browser.setItem(WORKSPACE_BROWSER_SNAPSHOT_KEY, text);
    return { count: targets.length, savedAt: now };
  } catch {
    return null;
  }
}

/**
 * Restore is replace-only, never automatic. All fields are validated in
 * memory first, then committed to tab storage with best-effort rollback
 * on quota or permission errors. Callers reload the page after success so
 * React state is reconstructed through the existing vetted readers.
 */
export function restoreWorkspaceFromBrowser(
  tab: StorageRW | null,
  browser: Pick<Storage, "getItem"> | null,
  now = Date.now(),
): WorkspaceBrowserBackupInfo | null {
  if (!tab) return null;
  const validated = readBackup(browser, now);
  if (!validated) return null;
  const previous = new Map<string, string | null>();
  const attempted: string[] = [];
  try {
    for (const key of SESSION_KEYS) {
      previous.set(key, tab.getItem(key));
    }
    for (const key of SESSION_KEYS) {
      attempted.push(key);
      const newValue = validated.stage.getItem(key);
      if (newValue === null) tab.removeItem(key);
      else tab.setItem(key, newValue);
    }
  } catch {
    for (const key of attempted.reverse()) {
      try {
        const value = previous.get(key);
        if (value === undefined || value === null) tab.removeItem(key);
        else tab.setItem(key, value);
      } catch { /* Storage may remain blocked; do not claim success. */ }
    }
    return null;
  }
  return {
    count: validated.snapshot.urls.length,
    savedAt: validated.snapshot.savedAt,
  };
}

export function deleteBrowserWorkspace(browser: StorageRW | null): boolean {
  try {
    if (!browser) return false;
    browser.removeItem(WORKSPACE_BROWSER_SNAPSHOT_KEY);
    return browser.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY) === null;
  } catch {
    return false;
  }
}
