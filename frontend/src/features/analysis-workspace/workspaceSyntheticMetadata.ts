/**
 * UI-R04-W — explicit, in-memory, OFFLINE synthetic metadata integration.
 *
 * This is a local simulation of a future Spring metadata response contract.
 * It does NOT call the Spring server, Google, YouTube, image CDNs or storage.
 * The target's URL cannot prove existence, source identity or channel linkage.
 *
 * An untrusted JSON body is never promoted to authenticated metadata: the
 * contract requires sourceAuthenticated=false and providerRequestsMade=0.
 */
import {
  workspaceUrlTargetKey, type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";

export const SYNTHETIC_METADATA_SCHEMA =
  "YOUTOPIA_R04W_SYNTHETIC_METADATA_INTEGRATION_V01" as const;

export type SyntheticWorkspaceMetadata = Readonly<{
  source: "LOCAL_SYNTHETIC_ONLY";
  kind: WorkspaceUrlTarget["kind"];
  requestedId: string;
  title: string;
  channelName: string | null;
  artwork: "VIDEO_PLACEHOLDER" | "CHANNEL_PLACEHOLDER";
  sourceAuthenticated: false;
  providerRequestsMade: 0;
  consumerPublicationAuthorized: false;
}>;

type SyntheticEnvelope = Readonly<{
  schema: typeof SYNTHETIC_METADATA_SCHEMA;
  status: "SYNTHETIC_NOT_PROVIDER_DATA";
  record: SyntheticWorkspaceMetadata;
}>;

const VIDEO = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE = /^@[\p{L}\p{N}._-]{3,30}$/u;
const CONTROL = /[\u0000-\u001f\u007f]/;
const RECORD_KEYS = [
  "artwork", "channelName", "consumerPublicationAuthorized", "kind",
  "providerRequestsMade", "requestedId", "source", "sourceAuthenticated", "title",
].sort().join("|");

function validTarget(target: Pick<WorkspaceUrlTarget, "kind" | "id">): boolean {
  if (target.kind === "VIDEO") return VIDEO.test(target.id);
  if (target.kind === "CHANNEL") return CHANNEL.test(target.id);
  return target.kind === "CHANNEL_HANDLE" && HANDLE.test(target.id);
}

/**
 * Local mock of the proposed server response. Its title and channel label
 * are deliberately synthetic, not guesses about the real video.
 * No image URLs or fake engagement metrics exist in this response.
 */
export function simulateOfflineMetadataBackend(
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
): SyntheticEnvelope | null {
  if (!validTarget(target)) return null;
  const isVideo = target.kind === "VIDEO";
  return {
    schema: SYNTHETIC_METADATA_SCHEMA,
    status: "SYNTHETIC_NOT_PROVIDER_DATA",
    record: {
      source: "LOCAL_SYNTHETIC_ONLY",
      kind: target.kind,
      requestedId: target.id,
      title: (isVideo ? "합성 영상 제목 · " : "합성 채널 이름 · ") + target.id,
      channelName: isVideo ? "합성 채널 안내 · 실제 소속 미확인" : null,
      artwork: isVideo ? "VIDEO_PLACEHOLDER" : "CHANNEL_PLACEHOLDER",
      sourceAuthenticated: false,
      providerRequestsMade: 0,
      consumerPublicationAuthorized: false,
    },
  };
}

/** Strictly validate the mocked backend-to-UI boundary against THIS target. */
export function decodeOfflineSyntheticMetadata(
  raw: unknown,
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
): SyntheticWorkspaceMetadata | null {
  if (!validTarget(target) || typeof raw !== "object" || raw === null ||
      Array.isArray(raw)) return null;
  const response = raw as Record<string, unknown>;
  if (Object.keys(response).sort().join("|") !== "record|schema|status" ||
      response.schema !== SYNTHETIC_METADATA_SCHEMA ||
      response.status !== "SYNTHETIC_NOT_PROVIDER_DATA" ||
      typeof response.record !== "object" || response.record === null ||
      Array.isArray(response.record)) return null;
  const item = response.record as Record<string, unknown>;
  const isVideo = target.kind === "VIDEO";
  if (Object.keys(item).sort().join("|") !== RECORD_KEYS ||
      item.source !== "LOCAL_SYNTHETIC_ONLY" ||
      item.kind !== target.kind || item.requestedId !== target.id ||
      typeof item.title !== "string" || !item.title.trim() ||
      item.title !== item.title.trim() ||
      item.title.length > 120 || CONTROL.test(item.title) ||
      (isVideo
        ? typeof item.channelName !== "string" ||
          !(item.channelName as string).trim() ||
          (item.channelName as string).length > 120 ||
          CONTROL.test(item.channelName as string)
        : item.channelName !== null) ||
      item.artwork !== (isVideo ? "VIDEO_PLACEHOLDER" : "CHANNEL_PLACEHOLDER") ||
      item.sourceAuthenticated !== false ||
      item.providerRequestsMade !== 0 ||
      item.consumerPublicationAuthorized !== false)
    return null;
  return item as SyntheticWorkspaceMetadata;
}

/**
 * Ephemeral synthetic preview. Called only after explicit UI opt-in.
 * Never serialized to sessionStorage, never used to set user-authored aliases,
 * and never merged with the approved-channel-profile cache.
 */
export function createOfflineWorkspacePreview(
  targets: readonly WorkspaceUrlTarget[],
): Readonly<Record<string, SyntheticWorkspaceMetadata>> {
  const output: Record<string, SyntheticWorkspaceMetadata> = {};
  for (const target of targets.slice(0, 128)) {
    const simulated = simulateOfflineMetadataBackend(target);
    const decoded = decodeOfflineSyntheticMetadata(simulated, target);
    if (decoded) output[workspaceUrlTargetKey(target)] = decoded;
  }
  return output;
}
