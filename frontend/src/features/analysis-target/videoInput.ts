/**
 * YU-38: purely local parser for explicitly pasted YouTube VIDEO identifiers.
 * No network, no redirect following, no channel/Shorts/playlist resolution.
 * Only a verified 11-character VIDEO ID is returned to the application.
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_URL_LENGTH = 2048;
const MAX_LINES = 8;
const MAX_BATCH_LENGTH = MAX_LINES * (MAX_URL_LENGTH + 2);

export type VideoInputResult =
  | Readonly<{ kind: "VALID"; videoId: string; type: "ID" | "WATCH" | "SHORT_LINK" }>
  | Readonly<{ kind: "INVALID"; reason: "EMPTY" | "TOO_LONG" | "BAD_ID" |
      "UNSUPPORTED_URL" | "AMBIGUOUS_URL" }>;

export type VideoBatchResult =
  | Readonly<{ kind: "VALID"; videoIds: readonly string[] }>
  | Readonly<{ kind: "INVALID"; reason: "EMPTY" | "TOO_LONG" | "TOO_MANY" |
      "DUPLICATE" | "BAD_ID" | "UNSUPPORTED_URL" | "AMBIGUOUS_URL"; line: number }>;

/** Single non-redirecting, exact-host HTTPS URL or raw VIDEO ID. */
export function parseVideoInput(value: unknown): VideoInputResult {
  if (typeof value !== "string") return { kind: "INVALID", reason: "BAD_ID" };
  // WHATWG URL parsing may strip leading/trailing C0 controls. Reject before trim/parse.
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return { kind: "INVALID", reason: "UNSUPPORTED_URL" };
  }
  const input = value.trim();

  if (input.length === 0) return { kind: "INVALID", reason: "EMPTY" };
  if (input.length > MAX_URL_LENGTH) return { kind: "INVALID", reason: "TOO_LONG" };
  if (VIDEO_ID.test(input)) return { kind: "VALID", videoId: input, type: "ID" };

  // Reject controls and internal whitespace to avoid ambiguous pasted URLs.
  if (/[^\S ]|\s/.test(input)) return { kind: "INVALID", reason: "UNSUPPORTED_URL" };
  if (!input.startsWith("https://")) {
    return {
      kind: "INVALID",
      reason: input.includes("://") || input.includes("/")
        ? "UNSUPPORTED_URL" : "BAD_ID",
    };
  }

  let url: URL;
  try { url = new URL(input); }
  catch { return { kind: "INVALID", reason: "UNSUPPORTED_URL" }; }

  if (url.protocol !== "https:" || url.username || url.password ||
      url.port || url.hash) {
    return { kind: "INVALID", reason: "UNSUPPORTED_URL" };
  }

  const host = url.hostname;
  if (host === "youtube.com" || host === "www.youtube.com" ||
      host === "m.youtube.com") {
    if (url.pathname !== "/watch") {
      return { kind: "INVALID", reason: "UNSUPPORTED_URL" };
    }
    const videos = url.searchParams.getAll("v");
    if (videos.length !== 1) {
      return { kind: "INVALID", reason: "AMBIGUOUS_URL" };
    }
    if (!VIDEO_ID.test(videos[0])) return { kind: "INVALID", reason: "BAD_ID" };
    return { kind: "VALID", videoId: videos[0], type: "WATCH" };
  }

  if (host === "youtu.be" || host === "www.youtu.be") {
    if (url.searchParams.has("v")) {
      return { kind: "INVALID", reason: "AMBIGUOUS_URL" };
    }
    const id = url.pathname.slice(1);
    if (!VIDEO_ID.test(id)) return { kind: "INVALID", reason: "BAD_ID" };
    return { kind: "VALID", videoId: id, type: "SHORT_LINK" };
  }

  return { kind: "INVALID", reason: "UNSUPPORTED_URL" };
}

/**
 * Batch is ALL-OR-NOTHING: no partial additions on bad/duplicate input.
 * Empty lines are ignored and every normalized ID is unique.
 */
export function parseVideoBatch(value: unknown): VideoBatchResult {
  if (typeof value !== "string") return { kind: "INVALID", reason: "BAD_ID", line: 0 };
  if (value.length > MAX_BATCH_LENGTH) {
    return { kind: "INVALID", reason: "TOO_LONG", line: 0 };
  }
  const lines = value.split(/\r?\n/);
  const unique = new Set<string>();
  const ids: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index].trim();
    if (current.length === 0) continue;
    if (ids.length >= MAX_LINES) {
      return { kind: "INVALID", reason: "TOO_MANY", line: index + 1 };
    }
    const parsed = parseVideoInput(current);
    if (parsed.kind !== "VALID") {
      return { kind: "INVALID", reason: parsed.reason, line: index + 1 };
    }
    if (unique.has(parsed.videoId)) {
      return { kind: "INVALID", reason: "DUPLICATE", line: index + 1 };
    }
    unique.add(parsed.videoId);
    ids.push(parsed.videoId);
  }
  return ids.length === 0
    ? { kind: "INVALID", reason: "EMPTY", line: 0 }
    : { kind: "VALID", videoIds: ids };
}
