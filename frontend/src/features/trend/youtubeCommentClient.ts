import type { Observation } from "./userKeywordTrend";
import { userKeyword } from "./userKeywordTrend";

export type CollectedCommentSample = Readonly<{
  videoId: string;
  videoTitle: string;
  channelId: string;
  channelTitle: string;
  query: string;
  fetchedAt: string;
  sampledCount: number;
  skipped: number;
  truncated: number;
  hasMore: boolean;
  comments: readonly Observation[];
}>;

export type PublicCommentsResult =
  | Readonly<{ kind: "READY"; sample: CollectedCommentSample }>
  | Readonly<{ kind: "ERROR"; code: string; message: string }>;

const MESSAGES: Record<string, string> = {
  NOT_CONFIGURED: "로컬 YouTube 검색 서버에 API 키가 설정되지 않았습니다.",
  VIDEO_NOT_SEARCHED: "이 영상은 현재 검색 결과에 없습니다. 키워드를 다시 검색하세요.",
  INVALID_VIDEO: "선택한 영상 ID가 올바르지 않습니다.",
  INVALID_REQUEST: "댓글 요청이 올바르지 않습니다.",
  VIDEO_SAMPLE_LIMIT: "검색 1회당 최대 3개 영상의 댓글 표본만 조회할 수 있습니다.",
  REQUEST_IN_PROGRESS: "이전 요청이 진행 중입니다.",
  LOCAL_DAILY_LIMIT: "로컬 API 호출 상한에 도달했습니다.",
  YOUTUBE_REQUEST_FAILED: "YouTube 댓글 조회가 거부되었습니다. 댓글 비활성화·키 제한·할당량을 확인하세요.",
  YOUTUBE_UNAVAILABLE: "YouTube 댓글 서버가 응답하지 않습니다.",
  PROXY_UNAVAILABLE: "로컬 YouTube 검색 서버에 연결하지 못했습니다.",
  INVALID_UPSTREAM: "댓글 응답 형식을 확인할 수 없습니다.",
  INVALID_RESPONSE: "댓글 결과의 무결성을 확인하지 못했습니다.",
};
const fail = (code: string): PublicCommentsResult => ({
  kind: "ERROR",
  code,
  message: MESSAGES[code] ?? "댓글을 불러오지 못했습니다.",
});

function validObservation(value: unknown, videoId: string): value is Observation {
  if (!value || typeof value !== "object") return false;
  const x = value as Partial<Observation>;
  return typeof x.id === "string" && /^[a-zA-Z0-9_.-]{1,160}$/.test(x.id) &&
    x.videoId === videoId &&
    typeof x.videoTitle === "string" && x.videoTitle.length <= 250 &&
    typeof x.channelId === "string" && x.channelId.length <= 100 &&
    typeof x.channelName === "string" && x.channelName.length <= 150 &&
    typeof x.text === "string" && x.text.length > 0 && x.text.length <= 2000 &&
    typeof x.publishedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(x.publishedAt) &&
    Number.isFinite(Date.parse(x.publishedAt));
}

/** Explicit fetch only. The API key never enters the browser request. */
export async function collectPublicVideoComments(
  videoId: string,
  rawQuery: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<PublicCommentsResult> {
  const query = userKeyword(rawQuery);
  if (!query || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return fail("INVALID_VIDEO");
  try {
    const response = await request("/api/youtube/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-YOUTOPIA-LOCAL-SEARCH": "1",
      },
      body: JSON.stringify({ videoId }),
      signal,
    });
    const raw: unknown = await response.json();
    if (!response.ok) {
      const code = raw && typeof raw === "object" && "code" in raw &&
        typeof raw.code === "string" ? raw.code : "PROXY_UNAVAILABLE";
      return fail(code);
    }
    if (!raw || typeof raw !== "object") return fail("INVALID_RESPONSE");
    const r = raw as Record<string, unknown>;
    if (r.kind !== "YOUTUBE_PUBLIC_TOP_LEVEL_COMMENTS_V1" ||
        r.source !== "YOUTUBE_DATA_API_COMMENT_THREADS" ||
        r.scope !== "FIRST_PAGE_TOP_LEVEL_MAX_100" ||
        r.order !== "time" ||
        r.videoId !== videoId ||
        r.query !== query ||
        typeof r.videoTitle !== "string" ||
        typeof r.channelTitle !== "string" ||
        typeof r.channelId !== "string" ||
        typeof r.fetchedAt !== "string" ||
        !Number.isFinite(Date.parse(r.fetchedAt)) ||
        typeof r.sampledCount !== "number" ||
        !Number.isSafeInteger(r.sampledCount) ||
        r.sampledCount < 0 || r.sampledCount > 100 ||
        typeof r.skipped !== "number" || !Number.isSafeInteger(r.skipped) ||
        r.skipped < 0 || r.skipped > 100 ||
        typeof r.truncated !== "number" || !Number.isSafeInteger(r.truncated) ||
        r.truncated < 0 || r.truncated > 100 ||
        typeof r.hasMore !== "boolean" ||
        !Array.isArray(r.comments) ||
        r.comments.length !== r.sampledCount ||
        !r.comments.every((entry) => validObservation(entry, videoId))) {
      return fail("INVALID_RESPONSE");
    }
    const ids = new Set((r.comments as Observation[]).map((comment) => comment.id));
    if (ids.size !== r.comments.length) return fail("INVALID_RESPONSE");
    return {
      kind: "READY",
      sample: {
        videoId,
        videoTitle: r.videoTitle,
        channelId: r.channelId,
        channelTitle: r.channelTitle,
        query,
        fetchedAt: r.fetchedAt,
        sampledCount: r.sampledCount,
        skipped: r.skipped,
        truncated: r.truncated,
        hasMore: r.hasMore,
        comments: r.comments,
      },
    };
  } catch {
    return fail("PROXY_UNAVAILABLE");
  }
}
