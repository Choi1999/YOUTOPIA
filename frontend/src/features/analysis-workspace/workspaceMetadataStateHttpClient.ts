/**
 * UI-R04-AA — same-origin DEV-only consumer for R04-Z Spring test fixture.
 * Never requests YouTube or a production metadata endpoint. No cookies,
 * credentials, redirects, raw errors, remote artwork or auto retries.
 */
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";
import { simulateOfflineMetadataBackend } from "./workspaceSyntheticMetadata";
import { decodeMetadataState, type MetadataState, type StateScenario } from "./workspaceMetadataConsumerState";
import { limitedJson, syntheticHttpDevEnabled } from "./workspaceSyntheticHttpClient";

export const STATE_ROUTE = "/api/v1/youtube/metadata/synthetic-state";

export function metadataStateDevEnabled():boolean {
  return syntheticHttpDevEnabled() &&
    import.meta.env.VITE_R04AA_METADATA_STATES==="enabled";
}

function buildPath(target:Pick<WorkspaceUrlTarget,"kind"|"id">,
                   scenario:StateScenario):string|null {
  if (!simulateOfflineMetadataBackend(target) ||
      !["READY","NOT_FOUND","FAILED","STALE"].includes(scenario)) return null;
  const route=target.kind==="VIDEO"?"videos":
    target.kind==="CHANNEL"?"channels":"handles";
  return STATE_ROUTE+"/"+route+"/"+encodeURIComponent(target.id)+
    (scenario==="READY"?"":"?scenario="+scenario);
}

export async function fetchMetadataStateHttp(
  target:Pick<WorkspaceUrlTarget,"kind"|"id">,
  scenario:StateScenario,
  signal:AbortSignal,
  fetcher:typeof fetch=fetch,
):Promise<MetadataState|null> {
  if (!metadataStateDevEnabled() || signal.aborted) return null;
  const path=buildPath(target,scenario);
  if (!path) return null;
  const timeout=new AbortController();
  const timer=setTimeout(()=>timeout.abort(),5000);
  const bounded=AbortSignal.any([signal,timeout.signal]);
  try {
    const response=await fetcher(path,{
      method:"GET",mode:"same-origin",credentials:"omit",
      redirect:"error",cache:"no-store",referrerPolicy:"no-referrer",
      headers:{Accept:"application/json"},signal:bounded,
    });
    const wanted=scenario==="READY"||scenario==="STALE" ? 200:
      scenario==="NOT_FOUND" ? 404 : 503;
    if (response.status!==wanted || response.redirected ||
        response.headers.get("X-YOUTOPIA-Synthetic")!=="test-only" ||
        !/^application\/json(?:;|$)/i.test(
          response.headers.get("content-type")??"") ||
        !/\bno-store\b/i.test(response.headers.get("cache-control")??""))
      return null;
    const data=await limitedJson(response);
    if (bounded.aborted) return null;
    const state=decodeMetadataState(data,target);
    if (!state || state.status!==scenario) return null;
    return state;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
