import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";

/**
 * UI-R04-F: An offline-first, fail-closed contract for trusted read-only
 * channel identity and profile metadata. NO YouTube API client is supplied.
 *
 * A syntactically valid UC... ID or @handle is NOT evidence that the channel
 * exists or that the handle belongs to the guessed channel.
 */
type ChannelTarget = Pick<WorkspaceUrlTarget, "kind" | "id">;
export const CHANNEL_PROFILE_TTL_MS = 15 * 60 * 1000;
export const CHANNEL_PROFILE_CACHE_LIMIT = 64;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE = /^@[\p{L}\p{N}._-]{3,30}$/u;
const CONTROL = /[\u0000-\u001f\u007f]/;
const IMAGE_HOSTS = new Set(["yt3.ggpht.com", "yt3.googleusercontent.com"]);

export type ApprovedChannelProfile = Readonly<{
  source: "APPROVED_CHANNEL_SNIPPET";
  channelId: string;
  handle: string | null;
  title: string;
  thumbnailUrl: string | null;
  retrievedAt: number;
}>;

export type ChannelProfileIdentity =
  | "HANDLE_UNRESOLVED"
  | "CHANNEL_ID_UNVERIFIED"
  | "HANDLE_RESOLVED"
  | "CHANNEL_ID_CONFIRMED";
export type ChannelProfileStatus =
  | "POLICY_HOLD"
  | "READY"
  | "STALE"
  | "NOT_FOUND"
  | "FAILED";

export type ChannelProfileView = Readonly<{
  status: ChannelProfileStatus;
  identity: ChannelProfileIdentity;
  inputId: string;
  channelId: string | null;
  handle: string | null;
  title: string | null;
  thumbnailUrl: string | null;
}>;

function normalizeHandle(input: string): string | null {
  const value = (input.startsWith("@") ? input : "@" + input)
    .normalize("NFC").toLocaleLowerCase("en-US");
  return HANDLE.test(value) ? value : null;
}

/**
 * Exact matching of approved channel thumbnail host, never constructing a
 * profile URL from UC... or @handle or modifying a provider-returned URL.
 * Other hosts require a separate, reviewed proxy/source allowlist contract.
 */
export function isApprovedChannelThumbnailUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length < 12 || raw.length > 2048 ||
      CONTROL.test(raw)) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" &&
      IMAGE_HOSTS.has(url.hostname.toLowerCase()) &&
      url.username === "" && url.password === "" && url.port === "" &&
      url.hash === "" && url.pathname.length > 1;
  } catch { return false; }
}

export function validateApprovedChannelProfile(
  input: unknown,
  now = Date.now(),
): ApprovedChannelProfile | null {
  if (typeof input !== "object" || input === null || Array.isArray(input) ||
      !Number.isSafeInteger(now) || now < 0) return null;
  const item = input as Record<string, unknown>;
  if (Object.keys(item).sort().join("|") !==
      "channelId|handle|retrievedAt|source|thumbnailUrl|title" ||
      item.source !== "APPROVED_CHANNEL_SNIPPET" ||
      typeof item.channelId !== "string" || !CHANNEL_ID.test(item.channelId) ||
      typeof item.title !== "string" ||
      !item.title.trim() || item.title.length > 120 ||
      CONTROL.test(item.title) ||
      typeof item.retrievedAt !== "number" ||
      !Number.isSafeInteger(item.retrievedAt) || item.retrievedAt < 0 ||
      item.retrievedAt > now ||
      (item.handle !== null && typeof item.handle !== "string") ||
      (item.thumbnailUrl !== null &&
        !isApprovedChannelThumbnailUrl(item.thumbnailUrl))) return null;
  const handle = item.handle === null ? null : normalizeHandle(item.handle as string);
  if (item.handle !== null && !handle) return null;
  return {
    source:"APPROVED_CHANNEL_SNIPPET",
    channelId:item.channelId,
    handle,
    title:item.title.trim(),
    thumbnailUrl:item.thumbnailUrl as string | null,
    retrievedAt:item.retrievedAt,
  };
}

export function channelProfileForTarget(
  target: ChannelTarget,
  approved: ApprovedChannelProfile | null = null,
  now = Date.now(),
): ChannelProfileView | null {
  if (target.kind === "VIDEO") return null;
  const isHandle = target.kind === "CHANNEL_HANDLE";
  const validId = isHandle ? normalizeHandle(target.id) :
    target.kind === "CHANNEL" && CHANNEL_ID.test(target.id)
      ? target.id : null;
  const defaultState: ChannelProfileView = {
    status:"POLICY_HOLD",
    identity:isHandle ? "HANDLE_UNRESOLVED" : "CHANNEL_ID_UNVERIFIED",
    inputId:target.id,
    channelId:isHandle ? null : validId,
    handle:isHandle ? validId : null,
    title:null,
    thumbnailUrl:null,
  };
  if (!validId || !approved) return defaultState;
  const normalized = validateApprovedChannelProfile(approved,now);
  if (!normalized) return defaultState;
  const same = isHandle
    ? normalized.handle === validId
    : normalized.channelId === validId;
  if (!same) return defaultState;
  if (now - normalized.retrievedAt > CHANNEL_PROFILE_TTL_MS) {
    return {...defaultState,status:"STALE"};
  }
  return {
    status:"READY",
    identity:isHandle ? "HANDLE_RESOLVED" : "CHANNEL_ID_CONFIRMED",
    inputId:target.id,
    channelId:normalized.channelId,
    handle:normalized.handle,
    title:normalized.title,
    thumbnailUrl:normalized.thumbnailUrl,
  };
}

export function channelIdentityText(view: ChannelProfileView): string {
  if (view.status === "STALE") return "프로필 검증 만료 · 재조회 보류";
  if (view.status === "NOT_FOUND") return "채널 식별 결과 없음";
  if (view.status === "FAILED") return "프로필 조회 실패";
  if (view.identity === "HANDLE_RESOLVED") return "핸들 → 채널 ID 확인";
  if (view.identity === "CHANNEL_ID_CONFIRMED") return "채널 ID 메타데이터 확인";
  if (view.identity === "HANDLE_UNRESOLVED") return "핸들 등록 · 채널 ID 해석 대기";
  return "채널 ID 형식 확인 · 실제 채널 미검증";
}

/**
 * In-memory, bounded cache for a FUTURE permitted metadata reader.
 * No networking, browser Storage, provider key or user data persistence.
 * Reads do not extend TTL. Invalid/mismatched records are never retained.
 */
export class ApprovedChannelProfileCache {
  private readonly records = new Map<string,ApprovedChannelProfile>();
  constructor(private readonly limit = CHANNEL_PROFILE_CACHE_LIMIT) {}

  put(raw: unknown, now = Date.now()): boolean {
    if (!Number.isSafeInteger(this.limit) || this.limit < 1 ||
        this.limit > CHANNEL_PROFILE_CACHE_LIMIT) return false;
    const record=validateApprovedChannelProfile(raw,now);
    if (!record || now - record.retrievedAt > CHANNEL_PROFILE_TTL_MS) return false;
    this.records.delete(record.channelId);
    while (this.records.size >= this.limit) {
      const oldest=this.records.keys().next().value;
      if (oldest===undefined) break;
      this.records.delete(oldest);
    }
    this.records.set(record.channelId,record);
    return true;
  }

  get(target: ChannelTarget, now = Date.now()): ChannelProfileView | null {
    if (target.kind === "VIDEO") return null;
    const approved = [...this.records.values()].find(record =>
      target.kind === "CHANNEL"
        ? record.channelId === target.id
        : record.handle === normalizeHandle(target.id),
    ) ?? null;
    return channelProfileForTarget(target,approved,now);
  }

  clear() { this.records.clear(); }
  get size() {return this.records.size;}
}
