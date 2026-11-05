/**
 * UI-R04-N — explicitly user-supplied labels and channel artwork references.
 *
 * This does NOT verify metadata or assert that a pasted image belongs to
 * the target channel. URLs are restricted to trusted YouTube image hosts,
 * and still require the independent in-memory image-preview consent.
 */
import { isApprovedChannelThumbnailUrl, type ApprovedChannelProfileCache } from "./workspaceChannelProfile";
import { WORKSPACE_URL_TARGETS_TTL_MS, workspaceUrlTargetKey, type WorkspaceUrlTarget } from "./workspaceUrlTargets";
import type { SyntheticWorkspaceMetadata } from "./workspaceSyntheticMetadata";
import type { MetadataState } from "./workspaceMetadataConsumerState";

export const WORKSPACE_TARGET_PRESENTATION_KEY = "youtopia-target-presentation-v1";
export const MAX_USER_LABEL = 120;
const MAX_BYTES = 64_000;
const CONTROL = /[\u0000-\u001f\u007f]/;

export type WorkspaceTargetPresentation = Readonly<{
  labels: Readonly<Record<string, string>>;
  channelImages: Readonly<Record<string, string>>;
  /** Only a transient, explicitly enabled local mock. Never serialized. */
  synthetic?: Readonly<Record<string, SyntheticWorkspaceMetadata>>;
  /** Dev-only transient status display. Never serialized or treated as provider proof. */
  metadataStates?: Readonly<Record<string, MetadataState>>;
}>;

export const EMPTY_TARGET_PRESENTATION: WorkspaceTargetPresentation = {
  labels: {}, channelImages: {},
};

function validLabel(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= MAX_USER_LABEL && value === value.trim() &&
    !CONTROL.test(value);
}

function knownTargets(targets: readonly WorkspaceUrlTarget[]) {
  return new Map(targets.map(t => [workspaceUrlTargetKey(t), t]));
}

function validFieldMap(
  input: unknown, keys: Map<string, WorkspaceUrlTarget>, artwork: boolean,
): input is Record<string,string> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const entries = Object.entries(input);
  if (entries.length > 128) return false;
  return entries.every(([key, value]) => {
    const target = keys.get(key);
    return !!target &&
      (artwork
        ? target.kind !== "VIDEO" && isApprovedChannelThumbnailUrl(value)
        : validLabel(value));
  });
}

export function readTargetPresentation(
  storage: Pick<Storage,"getItem"> | null | undefined,
  targets: readonly WorkspaceUrlTarget[], now = Date.now(),
): WorkspaceTargetPresentation {
  try {
    const raw = storage?.getItem(WORKSPACE_TARGET_PRESENTATION_KEY);
    if (!raw || raw.length > MAX_BYTES || !Number.isSafeInteger(now) || now < 0)
      return EMPTY_TARGET_PRESENTATION;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data))
      return EMPTY_TARGET_PRESENTATION;
    const record = data as Record<string,unknown>;
    if (Object.keys(record).sort().join("|") !== "channelImages|labels|savedAt|version" ||
      record.version !== 1 || typeof record.savedAt !== "number" ||
      !Number.isSafeInteger(record.savedAt) || record.savedAt < 0 ||
      record.savedAt > now || now - record.savedAt > WORKSPACE_URL_TARGETS_TTL_MS)
      return EMPTY_TARGET_PRESENTATION;
    const keys = knownTargets(targets);
    if (!validFieldMap(record.labels, keys, false) ||
      !validFieldMap(record.channelImages, keys, true))
      return EMPTY_TARGET_PRESENTATION;
    return { labels: record.labels, channelImages: record.channelImages };
  } catch {
    return EMPTY_TARGET_PRESENTATION;
  }
}

export function writeTargetPresentation(
  storage: Pick<Storage,"setItem"|"removeItem"> | null | undefined,
  presentation: WorkspaceTargetPresentation,
  targets: readonly WorkspaceUrlTarget[], now = Date.now(),
): boolean {
  if (!storage || !Number.isSafeInteger(now) || now < 0 ||
    !validFieldMap(presentation.labels, knownTargets(targets), false) ||
    !validFieldMap(presentation.channelImages, knownTargets(targets), true))
    return false;
  try {
    if (!Object.keys(presentation.labels).length &&
      !Object.keys(presentation.channelImages).length) {
      storage.removeItem(WORKSPACE_TARGET_PRESENTATION_KEY);
      return true;
    }
    const payload = JSON.stringify({
      version:1, savedAt:now, labels:presentation.labels,
      channelImages:presentation.channelImages,
    });
    if (payload.length > MAX_BYTES) return false;
    storage.setItem(WORKSPACE_TARGET_PRESENTATION_KEY,payload);
    return true;
  } catch { return false; }
}

export function reconcileTargetPresentation(
  presentation: WorkspaceTargetPresentation, targets: readonly WorkspaceUrlTarget[],
): WorkspaceTargetPresentation {
  const keys = knownTargets(targets);
  const labels = Object.fromEntries(Object.entries(presentation.labels)
    .filter(([key]) => keys.has(key)));
  const channelImages = Object.fromEntries(Object.entries(presentation.channelImages)
    .filter(([key]) => keys.get(key)?.kind !== undefined &&
      keys.get(key)?.kind !== "VIDEO"));
  if (Object.keys(labels).length === Object.keys(presentation.labels).length &&
    Object.keys(channelImages).length === Object.keys(presentation.channelImages).length)
    return presentation;
  return { labels, channelImages };
}

export function withUserLabel(
  presentation: WorkspaceTargetPresentation, targets: readonly WorkspaceUrlTarget[],
  key: string, raw: string,
): WorkspaceTargetPresentation {
  if (!knownTargets(targets).has(key)) return presentation;
  const value = raw.normalize("NFC").trim();
  if (value && !validLabel(value)) return presentation;
  const labels = { ...presentation.labels };
  if (value) labels[key] = value;
  else delete labels[key];
  return { ...presentation, labels };
}

export function withChannelArtwork(
  presentation: WorkspaceTargetPresentation, targets: readonly WorkspaceUrlTarget[],
  key: string, raw: string,
): WorkspaceTargetPresentation {
  const target = knownTargets(targets).get(key);
  if (!target || target.kind === "VIDEO") return presentation;
  const value = raw.trim();
  if (value && !isApprovedChannelThumbnailUrl(value)) return presentation;
  const channelImages = { ...presentation.channelImages };
  if (value) channelImages[key] = value;
  else delete channelImages[key];
  return { ...presentation, channelImages };
}

export function userFacingTargetName(
  target: WorkspaceUrlTarget,
  presentation: WorkspaceTargetPresentation = EMPTY_TARGET_PRESENTATION,
  channelProfiles?: ApprovedChannelProfileCache,
): string {
  const custom = presentation.labels[workspaceUrlTargetKey(target)];
  if (validLabel(custom)) return custom;
  const local = presentation.synthetic?.[workspaceUrlTargetKey(target)];
  if (local?.source === "LOCAL_SYNTHETIC_ONLY" &&
      local.kind === target.kind && local.requestedId === target.id &&
      local.sourceAuthenticated === false && local.providerRequestsMade === 0 &&
      local.consumerPublicationAuthorized === false) return local.title;
  if (target.kind !== "VIDEO") {
    const profile = channelProfiles?.get(target);
    if (profile?.status === "READY" && profile.title) return profile.title;
    return target.kind === "CHANNEL_HANDLE" ? target.id : "채널 이름 미확인";
  }
  return "영상 제목 미확인";
}
