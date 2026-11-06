/**
 * UI-R04-B: local-only URL registration for exploratory, UNVERIFIED targets.
 * Parsing a URL proves neither existence, metadata, channel membership,
 * permission to collect comments, nor readiness for analysis.
 *
 * Only canonical identities are saved; raw pasted links, UTM parameters,
 * credentials, video data, comment bodies and provider responses are never stored.
 */
export const WORKSPACE_URL_TARGETS_KEY = "youtopia-workspace-url-targets-v1";
export const WORKSPACE_URL_TARGETS_TTL_MS = 2 * 60 * 60 * 1000;
export const WORKSPACE_MAX_URL_TARGETS = 128;
export const WORKSPACE_MAX_URL_BATCH = 32;

const MAX_INPUT_LENGTH = 8192;
const MAX_SINGLE_URL_LENGTH = 2048;
const MAX_STORAGE_LENGTH = 48_000;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE = /^@[\p{L}\p{N}._-]{3,30}$/u;
const VIDEO_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "music.youtube.com", "www.youtube-nocookie.com",
]);
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);
const HANDLE_SUBPAGES = new Set(["videos", "shorts", "streams", "live", "about", "featured", "playlists"]);

export type WorkspaceUrlKind = "VIDEO" | "CHANNEL" | "CHANNEL_HANDLE";

export type WorkspaceUrlTarget = Readonly<{
  kind: WorkspaceUrlKind;
  id: string;
  canonicalUrl: string;
  addedAt: number;
}>;

export type WorkspaceParsedUrl = Omit<WorkspaceUrlTarget, "addedAt">;

export type WorkspaceUrlIngestResult = Readonly<{
  targets: readonly WorkspaceUrlTarget[];
  added: readonly WorkspaceUrlTarget[];
  duplicates: number;
  rejected: number;
  capacityReached: boolean;
}>;

export function workspaceUrlTargetKey(target: Pick<WorkspaceUrlTarget, "kind" | "id">): string {
  return target.kind + ":" + target.id;
}

function targetFromId(kind: "VIDEO" | "CHANNEL", id: string): WorkspaceParsedUrl | null {
  if (kind === "VIDEO" && VIDEO_ID.test(id)) {
    return {kind, id, canonicalUrl:"https://www.youtube.com/watch?v=" + id};
  }
  if (kind === "CHANNEL" && CHANNEL_ID.test(id)) {
    return {kind, id, canonicalUrl:"https://www.youtube.com/channel/" + id};
  }
  return null;
}

export function parseWorkspaceYouTubeUrl(raw: string): WorkspaceParsedUrl | null {
  if (raw.length === 0 || raw.length > MAX_SINGLE_URL_LENGTH) return null;
  let url: URL;
  try { url = new URL(raw.trim()); }
  catch { return null; }

  // No requests are issued. Require a known host/protocol and normalize away
  // all optional tracking parameters, timestamps and fragments.
  if (!["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();
  const path = url.pathname.split("/").filter(Boolean);

  if (SHORT_HOSTS.has(host)) {
    return path.length === 1 ? targetFromId("VIDEO", path[0]) : null;
  }

  if (!VIDEO_HOSTS.has(host)) return null;
  if (url.pathname === "/watch" || url.pathname === "/watch/") {
    const videos = url.searchParams.getAll("v");
    return videos.length === 1 ? targetFromId("VIDEO", videos[0]) : null;
  }
  if (path.length === 2 && ["shorts","live","embed"].includes(path[0])) {
    return targetFromId("VIDEO", path[1]);
  }
  if (path.length === 2 && path[0] === "channel") {
    return targetFromId("CHANNEL", path[1]);
  }

  if ((path.length === 1 || (path.length === 2 && HANDLE_SUBPAGES.has(path[1]))) &&
      path[0].startsWith("@")) {
    let decoded: string;
    try { decoded = decodeURIComponent(path[0]); }
    catch { return null; }
    const normalized = decoded.normalize("NFC").toLowerCase();
    if (!HANDLE.test(normalized)) return null;
    return {
      kind:"CHANNEL_HANDLE",
      id:normalized,
      canonicalUrl:"https://www.youtube.com/@" + encodeURIComponent(normalized.slice(1)),
    };
  }
  return null;
}

export function addWorkspaceUrlTargets(
  current: readonly WorkspaceUrlTarget[],
  input: string,
  now = Date.now(),
): WorkspaceUrlIngestResult {
  if (input.length > MAX_INPUT_LENGTH || !Number.isSafeInteger(now) || now < 0) {
    return {targets:current,added:[],duplicates:0,rejected:1,capacityReached:false};
  }
  const tokens = input.split(/\s+/).map(x => x.trim())
    .filter(x => x.length > 0 && !x.startsWith("#"));
  const existing = new Set(current.map(workspaceUrlTargetKey));
  const next = [...current];
  const added: WorkspaceUrlTarget[] = [];
  let duplicates = 0;
  let rejected = 0;
  let capacityReached = false;

  for (const [index, raw] of tokens.entries()) {
    if (index >= WORKSPACE_MAX_URL_BATCH) { rejected += 1; continue; }
    const parsed = parseWorkspaceYouTubeUrl(raw);
    if (!parsed) { rejected += 1; continue; }
    const key = workspaceUrlTargetKey(parsed);
    if (existing.has(key)) { duplicates += 1; continue; }
    if (next.length >= WORKSPACE_MAX_URL_TARGETS) {
      rejected += 1;
      capacityReached = true;
      continue;
    }
    const target = {...parsed,addedAt:now};
    next.push(target);
    added.push(target);
    existing.add(key);
  }
  return {targets:next,added,duplicates,rejected,capacityReached};
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function validTarget(input: unknown, savedAt: number): input is WorkspaceUrlTarget {
  if (!isRecord(input) || Object.keys(input).sort().join("|") !==
      "addedAt|canonicalUrl|id|kind" ||
      (input.kind !== "VIDEO" && input.kind !== "CHANNEL" &&
        input.kind !== "CHANNEL_HANDLE") ||
      typeof input.id !== "string" || typeof input.canonicalUrl !== "string" ||
      typeof input.addedAt !== "number" ||
      !Number.isSafeInteger(input.addedAt) || input.addedAt < 0 ||
      input.addedAt > savedAt) return false;
  const parsed = parseWorkspaceYouTubeUrl(input.canonicalUrl);
  return parsed !== null && parsed.kind === input.kind &&
    parsed.id === input.id && parsed.canonicalUrl === input.canonicalUrl;
}

export function readWorkspaceUrlTargets(
  storage: Pick<Storage,"getItem"> | null | undefined,
  now = Date.now(),
): readonly WorkspaceUrlTarget[] {
  try {
    const raw = storage?.getItem(WORKSPACE_URL_TARGETS_KEY);
    if (!raw || raw.length > MAX_STORAGE_LENGTH) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) ||
      Object.keys(parsed).sort().join("|") !== "savedAt|targets|version" ||
      parsed.version !== 1 || typeof parsed.savedAt !== "number" ||
      !Number.isSafeInteger(parsed.savedAt) || parsed.savedAt < 0 ||
      parsed.savedAt > now || now - parsed.savedAt > WORKSPACE_URL_TARGETS_TTL_MS ||
      !Array.isArray(parsed.targets) ||
      parsed.targets.length > WORKSPACE_MAX_URL_TARGETS) return [];
    const seen = new Set<string>();
    if (!parsed.targets.every(entry => {
      if (!validTarget(entry,parsed.savedAt as number)) return false;
      const key = workspaceUrlTargetKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })) return [];
    return parsed.targets;
  } catch { return []; }
}

export function writeWorkspaceUrlTargets(
  storage: Pick<Storage,"setItem"> | null | undefined,
  targets: readonly WorkspaceUrlTarget[],
  now = Date.now(),
): boolean {
  if (!storage || targets.length > WORKSPACE_MAX_URL_TARGETS ||
      !Number.isSafeInteger(now) || now < 0 ||
      targets.some(t=>!validTarget(t,now)) ||
      new Set(targets.map(workspaceUrlTargetKey)).size !== targets.length) return false;
  try {
    const value=JSON.stringify({version:1,savedAt:now,targets});
    if (value.length > MAX_STORAGE_LENGTH) return false;
    storage.setItem(WORKSPACE_URL_TARGETS_KEY,value);
    return true;
  } catch { return false; }
}

export function clearWorkspaceUrlTargets(
  storage: Pick<Storage,"removeItem"> | null | undefined,
): boolean {
  try {storage?.removeItem(WORKSPACE_URL_TARGETS_KEY); return Boolean(storage);}
  catch {return false;}
}
