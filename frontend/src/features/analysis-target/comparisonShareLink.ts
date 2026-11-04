import { createAnalysisTarget } from "./analysisTarget";

const COMPARE_ROUTE = "/analysis/youtube/compare";

export type CompareLinkSelection =
  | Readonly<{ kind: "DEFAULT" | "INVALID"; videoIds: readonly string[] }>
  | Readonly<{ kind: "SINGLE" | "PAIR"; videoIds: readonly string[] }>;

/**
 * YU-39: Decode a one- or two-video URL request, preserving the A/B order.
 * Any malformed, duplicate, unexpected or excess fields fail closed.
 * An empty search means the ordinary local demo entry, not a shared pair.
 */
export function parseComparisonQuery(query: URLSearchParams): CompareLinkSelection {
  const pairs = [...query.entries()];
  if (pairs.length === 0) return { kind: "DEFAULT", videoIds: [] };
  if (pairs.length > 2 || pairs.some(([name]) => name !== "video")) {
    return { kind: "INVALID", videoIds: [] };
  }

  const ids = pairs.map(([, id]) => id);
  if (!ids.every(id => createAnalysisTarget("VIDEO", id) !== null) ||
      new Set(ids).size !== ids.length) {
    return { kind: "INVALID", videoIds: [] };
  }
  return {
    kind: ids.length === 1 ? "SINGLE" : "PAIR",
    videoIds: ids,
  };
}

/**
 * YU-39: Only target identifiers and their order enter the share URL.
 * Never serialize snapshots, source comments, credentials or the current
 * browser location's search/hash. This function does not contact any server.
 */
export function buildComparisonSharePath(ids: readonly string[]): string | null {
  if (
    ids.length !== 2 ||
    ids[0] === ids[1] ||
    !ids.every(id => createAnalysisTarget("VIDEO", id) !== null)
  ) return null;

  const query = new URLSearchParams();
  query.append("video", ids[0]);
  query.append("video", ids[1]);
  return COMPARE_ROUTE + "?" + query.toString();
}

/**
 * Produce an absolute URL only when the local app's trusted HTTP(S) origin
 * is supplied; production hosting has not been configured or approved.
 */
export function buildComparisonShareUrl(
  origin: string,
  ids: readonly string[],
): string | null {
  const path = buildComparisonSharePath(ids);
  if (!path) return null;
  let url: URL;
  try { url = new URL(origin); }
  catch { return null; }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash ||
    url.origin !== origin
  ) return null;
  return url.origin + path;
}
