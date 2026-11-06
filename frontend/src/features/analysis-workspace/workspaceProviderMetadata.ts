/**
 * UI-R04-AE: offline-prepared contract for a FUTURE authorized server reader.
 *
 * IMPORTANT: A JSON field cannot authenticate a provider. The caller must
 * authenticate and authorize the SAME-ORIGIN backend and its provenance
 * BEFORE wiring a reader. No production reader is registered in this PR.
 * The user workspace, URL registration, and DEV synthetic fixture cannot
 * independently enable a real YouTube/Google request.
 */
import { isApprovedChannelThumbnailUrl } from "./workspaceChannelProfile";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";

export const PROVIDER_METADATA_REQUEST_SCHEMA =
  "YOUTOPIA_UI_R04_AE_METADATA_REQUEST_V01" as const;
export const PROVIDER_METADATA_RESPONSE_SCHEMA =
  "YOUTOPIA_UI_R04_AE_METADATA_RESPONSE_V01" as const;
export const PROVIDER_METADATA_MAX_TTL_MS = 15 * 60_000;
export const PROVIDER_METADATA_BATCH_LIMIT = 8;

export type ProviderStatus = "PENDING" | "READY" | "NOT_FOUND" | "FAILED" | "STALE";
export type ProviderReadyRecord = Readonly<{
  title: string;
  /** Display-only channel label; this does NOT verify video-channel ownership. */
  channelTitle: string | null;
  thumbnailUrl: string | null;
}>;
export type ProviderMetadataState = Readonly<{
  status: ProviderStatus;
  kind: WorkspaceUrlTarget["kind"];
  requestedId: string;
  source: "UNAVAILABLE" | "AUTHORIZED_BACKEND";
  sourceAuthenticated: boolean;
  record: ProviderReadyRecord | null;
  observedAt: number;
  expiresAt: number;
}>;

/** Injected only by a separately approved, authenticated application reader. */
export type ProviderMetadataReader = (
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
  signal: AbortSignal,
) => Promise<unknown>;

export function providerMetadataRequest(
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
): Readonly<{
  schema: typeof PROVIDER_METADATA_REQUEST_SCHEMA;
  kind: WorkspaceUrlTarget["kind"];
  requestedId: string;
}> {
  return { schema: PROVIDER_METADATA_REQUEST_SCHEMA,
    kind: target.kind, requestedId: target.id };
}

export function unavailableProviderState(
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
  status: "PENDING" | "FAILED" = "PENDING",
): ProviderMetadataState {
  return { status, kind: target.kind, requestedId: target.id,
    source: "UNAVAILABLE", sourceAuthenticated: false,
    record: null, observedAt: 0, expiresAt: 0 };
}

const CONTROL = /[\u0000-\u001f\u007f]/;
const VIDEO_THUMBNAIL = /^\/vi\/([A-Za-z0-9_-]{11})\/(?:default|mqdefault|hqdefault|sddefault|maxresdefault)\.jpg$/;
const RESPONSE_KEYS = [
  "channelTitle","expiresAt","kind","observedAt","requestedId","schema",
  "source","sourceAuthenticated","status","thumbnailUrl","title",
].sort().join("|");

function validText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= 120 && value === value.trim() && !CONTROL.test(value);
}
function validThumbnail(
  raw: unknown, target: Pick<WorkspaceUrlTarget, "kind" | "id">,
): raw is string {
  if (raw === null) return true;
  if (target.kind !== "VIDEO") return isApprovedChannelThumbnailUrl(raw);
  if (typeof raw !== "string" || raw.length > 2048 || CONTROL.test(raw))
    return false;
  try {
    const url = new URL(raw);
    const video = VIDEO_THUMBNAIL.exec(url.pathname);
    return url.protocol === "https:" &&
      url.hostname.toLowerCase() === "i.ytimg.com" &&
      !url.username && !url.password && !url.port &&
      !url.search && !url.hash && video?.[1] === target.id;
  } catch { return false; }
}

/**
 * Decode a server reply only behind an explicitly trusted backend reader.
 * allowAuthorizedBackend is a frontend integration guard, NOT authentication
 * or authorization. The backend itself must enforce both before this point.
 * The body cannot turn the guard on and no live reader is shipped here.
 */
export function decodeProviderMetadata(
  raw: unknown,
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
  allowAuthorizedBackend = false,
  now = Date.now(),
): ProviderMetadataState | null {
  if (!allowAuthorizedBackend || !Number.isSafeInteger(now) || now < 0 ||
      !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).sort().join("|") !== RESPONSE_KEYS ||
      value.schema !== PROVIDER_METADATA_RESPONSE_SCHEMA ||
      value.source !== "AUTHORIZED_BACKEND" ||
      value.sourceAuthenticated !== true ||
      value.kind !== target.kind || value.requestedId !== target.id ||
      !["READY","NOT_FOUND","FAILED","STALE"].includes(value.status as string) ||
      !Number.isSafeInteger(value.observedAt) ||
      !Number.isSafeInteger(value.expiresAt)) return null;
  const status = value.status as Exclude<ProviderStatus,"PENDING">;
  const observedAt = value.observedAt as number;
  const expiresAt = value.expiresAt as number;
  if (status !== "READY") {
    if (value.title !== null || value.channelTitle !== null ||
        value.thumbnailUrl !== null || observedAt !== 0 || expiresAt !== 0)
      return null;
    return { status, kind: target.kind, requestedId: target.id,
      source: "AUTHORIZED_BACKEND", sourceAuthenticated: true,
      record: null, observedAt: 0, expiresAt: 0 };
  }
  if (!validText(value.title) ||
      (target.kind === "VIDEO"
        ? value.channelTitle !== null && !validText(value.channelTitle)
        : value.channelTitle !== null) ||
      !validThumbnail(value.thumbnailUrl, target) ||
      observedAt <= 0 || observedAt > now + 30_000 ||
      expiresAt <= now || expiresAt <= observedAt ||
      expiresAt - observedAt > PROVIDER_METADATA_MAX_TTL_MS)
    return null;
  return {
    status: "READY", kind: target.kind, requestedId: target.id,
    source: "AUTHORIZED_BACKEND", sourceAuthenticated: true,
    record: { title: value.title,
      channelTitle: value.channelTitle as string | null,
      thumbnailUrl: value.thumbnailUrl as string | null },
    observedAt, expiresAt,
  };
}

/** Consumers must check identity and expiry again at presentation time. */
export function readyProviderMetadata(
  state: ProviderMetadataState | undefined,
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
  now = Date.now(),
): ProviderReadyRecord | null {
  if (!state || state.status !== "READY" ||
      state.source !== "AUTHORIZED_BACKEND" ||
      state.sourceAuthenticated !== true || !state.record ||
      state.kind !== target.kind || state.requestedId !== target.id ||
      !Number.isSafeInteger(now) || now < 0 ||
      state.expiresAt <= now || state.observedAt > now + 30_000)
    return null;
  return state.record;
}

export function providerMetadataStatusLabel(
  state: ProviderMetadataState | undefined,
  now = Date.now(),
): string {
  if (state?.status === "READY" && state.expiresAt <= now)
    return "메타데이터 만료 · 새로 조회 필요";
  switch (state?.status) {
    case "PENDING": return "메타데이터 조회 중";
    case "READY": return "백엔드 메타데이터 수신 · 댓글 분석과 별개";
    case "NOT_FOUND": return "백엔드 조회 결과 없음";
    case "FAILED": return "메타데이터 조회 실패 · 기존 정보를 추정하지 않음";
    case "STALE": return "메타데이터 만료 · 새로 조회 필요";
    default: return "메타데이터 미조회";
  }
}
