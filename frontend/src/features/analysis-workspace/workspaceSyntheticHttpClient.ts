/**
 * UI-R04-Y — explicit dev-only SAME-ORIGIN consumer for the Spring test-only
 * loopback synthetic fixture. NEVER Google, YouTube, or a real metadata API.
 *
 * No credentials, cookies, redirects, localStorage/sessionStorage or remote
 * image URLs. A matching JSON body is *synthetic*, not authenticated provider
 * provenance. A failure never falls back to guessed "official" metadata.
 */
import { decodeOfflineSyntheticMetadata, simulateOfflineMetadataBackend,
  type SyntheticWorkspaceMetadata } from "./workspaceSyntheticMetadata";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";

export const SYNTHETIC_HTTP_PATH = "/api/v1/youtube/metadata/synthetic";
export const SYNTHETIC_HTTP_MAX_BYTES = 4096;
const SYNTHETIC_HEADER = "test-only";

export function syntheticHttpDevEnabled(): boolean {
  return import.meta.env.DEV === true &&
    import.meta.env.VITE_R04Y_SYNTHETIC_HTTP === "enabled";
}

function endpoint(target: Pick<WorkspaceUrlTarget, "kind" | "id">): string | null {
  // The local simulator here is ONLY used as an input validator.
  if (!simulateOfflineMetadataBackend(target)) return null;
  const category = target.kind === "VIDEO" ? "videos" :
    target.kind === "CHANNEL" ? "channels" : "handles";
  return SYNTHETIC_HTTP_PATH + "/" + category + "/" +
    encodeURIComponent(target.id);
}

/** Shared bounded streaming reader: never interpret raw untrusted body as approval. */
export async function limitedJson(response: Response): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) ||
    Number(length) > SYNTHETIC_HTTP_MAX_BYTES)) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) return null;
      total += value.byteLength;
      if (total > SYNTHETIC_HTTP_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total < 2) return null;
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk,offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return null;
  } finally {
    bytes.fill(0);
  }
}

export async function fetchSyntheticHttpMetadata(
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<SyntheticWorkspaceMetadata | null> {
  // This feature flag is checked AGAIN at the actual HTTP call boundary.
  if (!syntheticHttpDevEnabled() || signal.aborted) return null;
  const path = endpoint(target);
  if (!path) return null;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 5000);
  const boundedSignal = AbortSignal.any([signal, timeout.signal]);
  try {
    const response = await fetcher(path, {
      method: "GET",
      mode: "same-origin",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: boundedSignal,
    });
    if (!response.ok || response.redirected ||
        response.headers.get("X-YOUTOPIA-Synthetic") !== SYNTHETIC_HEADER ||
        !/^application\/json(?:;|$)/i.test(
          response.headers.get("content-type") ?? "")) return null;

    const payload = await limitedJson(response);
    if (boundedSignal.aborted) return null;
    return decodeOfflineSyntheticMetadata(payload,target);
  } catch {
    // No leaking raw server errors, body, URL, request ID or credentials.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
