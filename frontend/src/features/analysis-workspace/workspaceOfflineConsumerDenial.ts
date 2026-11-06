/**
 * UI-R04-AG: DEV-diagnostics-only transport for testing a DENIED backend
 * metadata request. Not a provider reader. This function CANNOT publish READY.
 *
 * Production and normal user routes never register this test reader.
 * Spring #96's consumer-offline controller is TEST classpath/MockMvc only;
 * a loopback Vite proxy can prove failure-safe HTTP routing but does NOT
 * turn its protected 503 result into a live authenticated service.
 */
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";
import { simulateOfflineMetadataBackend } from "./workspaceSyntheticMetadata";
import { limitedJson } from "./workspaceSyntheticHttpClient";
import type { ProviderMetadataReader } from "./workspaceProviderMetadata";

export const OFFLINE_CONSUMER_ROUTE = "/api/v1/youtube/metadata/consumer-offline";
export type OfflineDenialStatus =
  "DISABLED" | "UNAUTHORIZED" | "FORBIDDEN" | "POLICY_HOLD" | "REJECTED";

export function offlineConsumerDevEnabled(): boolean {
  return import.meta.env.DEV === true &&
    import.meta.env.VITE_R04AC_DIAGNOSTICS === "enabled" &&
    import.meta.env.VITE_R04Y_SYNTHETIC_HTTP === "enabled" &&
    import.meta.env.VITE_R04AG_CONSUMER_DENIAL === "enabled";
}

export function offlineConsumerPath(
  target: Pick<WorkspaceUrlTarget,"kind"|"id">,
): string | null {
  if (!simulateOfflineMetadataBackend(target)) return null;
  const segment=target.kind==="VIDEO"?"videos":
    target.kind==="CHANNEL"?"channels":"handles";
  return OFFLINE_CONSUMER_ROUTE+"/"+segment+"/"+encodeURIComponent(target.id);
}

/**
 * Reads ONLY whitelisted denial codes; even a forged READY or 200 reply is
 * rejected. No redirect, external URL, session cookie, auth header, retries,
 * storage, provider key or body-derived trust can be introduced by callers.
 */
export async function checkOfflineConsumerDenial(
  target: Pick<WorkspaceUrlTarget,"kind"|"id">,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<OfflineDenialStatus> {
  if (!offlineConsumerDevEnabled() || signal.aborted) return "DISABLED";
  const path=offlineConsumerPath(target);
  if (!path) return "REJECTED";
  const timeout=new AbortController();
  const timer=setTimeout(()=>timeout.abort(),5000);
  const bounded=AbortSignal.any([signal,timeout.signal]);
  try {
    const response=await fetcher(path,{
      method:"GET",mode:"same-origin",credentials:"omit",
      redirect:"error",cache:"no-store",referrerPolicy:"no-referrer",
      headers:{Accept:"application/problem+json"},signal:bounded,
    });
    if (bounded.aborted || response.redirected ||
        ![401,403,503].includes(response.status) ||
        !/^application\/problem\+json(?:;|$)/i.test(
          response.headers.get("content-type")??"") ||
        !/\bno-store\b/i.test(response.headers.get("cache-control")??""))
      return "REJECTED";
    const raw=await limitedJson(response);
    if (!raw || typeof raw!=="object" || Array.isArray(raw)) return "REJECTED";
    const item=raw as Record<string,unknown>;
    const expected=response.status===401?"AUTHENTICATION_REQUIRED":
      response.status===403?"ACCESS_DENIED":"METADATA_POLICY_HOLD";
    if (item.code!==expected || item.status!==response.status ||
        "sourceAuthenticated" in item || "title" in item ||
        "thumbnailUrl" in item || "apiKey" in item)
      return "REJECTED";
    if (response.status===503 && item.instance!==OFFLINE_CONSUMER_ROUTE)
      return "REJECTED";
    return response.status===401?"UNAUTHORIZED":
      response.status===403?"FORBIDDEN":"POLICY_HOLD";
  } catch {
    return "REJECTED";
  } finally {
    clearTimeout(timer);
  }
}

/** Adapter for AE's optional slot: never yields a payload or READY. */
export const offlineConsumerDenialReader: ProviderMetadataReader =
  async (target,signal):Promise<null> => {
    await checkOfflineConsumerDenial(target,signal);
    return null;
  };
