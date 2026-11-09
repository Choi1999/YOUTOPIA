import { userKeyword } from "./userKeywordTrend";

export type PublicSearchVideo = Readonly<{
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  videoUrl: string;
}>;

export type PublicSearchResult =
  | Readonly<{
      kind: "READY";
      query: string;
      fetchedAt: string;
      videos: readonly PublicSearchVideo[];
    }>
  | Readonly<{
      kind: "ERROR";
      code: string;
      message: string;
    }>;

type SearchOrder = "relevance" | "date";

const MESSAGES: Record<string, string> = {
  NOT_CONFIGURED: "로컬 YouTube 검색 서버에 API 키가 설정되지 않았습니다.",
  LOCAL_DAILY_LIMIT: "로컬 검색 요청 상한에 도달했습니다.",
  REQUEST_IN_PROGRESS: "이전 검색이 진행 중입니다.",
  YOUTUBE_REQUEST_FAILED: "YouTube API에서 요청을 처리하지 못했습니다. 키·제한·할당량을 확인하세요.",
  YOUTUBE_UNAVAILABLE: "YouTube 검색 서버가 현재 응답하지 않습니다.",
  INVALID_QUERY: "키워드 형식이 올바르지 않습니다.",
};

const failed = (code: string): PublicSearchResult => ({
  kind: "ERROR",
  code,
  message: MESSAGES[code] ?? "검색 결과를 확인할 수 없습니다.",
});

function validPublicVideo(item: unknown): item is PublicSearchVideo {
  if (!item || typeof item !== "object") return false;
  const v = item as Partial<PublicSearchVideo>;
  if (typeof v.videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(v.videoId)) return false;
  return typeof v.title === "string" && typeof v.channelTitle === "string" &&
    typeof v.channelId === "string" &&
    v.videoUrl === "https://www.youtube.com/watch?v=" + v.videoId &&
    (v.thumbnailUrl === null ||
      (typeof v.thumbnailUrl === "string" &&
       /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\//.test(v.thumbnailUrl)));
}

export async function searchPublicYoutubeVideos(
  rawQuery: string,
  order: SearchOrder = "relevance",
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<PublicSearchResult> {
  const query = userKeyword(rawQuery);
  if (!query) return failed("INVALID_QUERY");
  try {
    const response = await request("/api/youtube/discover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-YOUTOPIA-LOCAL-SEARCH": "1",
      },
      body: JSON.stringify({ query, order }),
      signal,
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const code = payload && typeof payload === "object" &&
        "code" in payload && typeof payload.code === "string" ?
        payload.code : "UPSTREAM_ERROR";
      return failed(code);
    }
    if (!payload || typeof payload !== "object") return failed("INVALID_RESPONSE");
    const data = payload as Record<string, unknown>;
    if (data.kind !== "YOUTUBE_PUBLIC_VIDEO_SEARCH_V1" ||
        data.source !== "YOUTUBE_DATA_API_SEARCH" ||
        data.query !== query || !Array.isArray(data.videos) ||
        data.videos.length > 10 ||
        !data.videos.every(validPublicVideo) ||
        typeof data.fetchedAt !== "string") {
      return failed("INVALID_RESPONSE");
    }
    return {
      kind: "READY",
      query,
      fetchedAt: data.fetchedAt,
      videos: data.videos,
    };
  } catch {
    return failed("PROXY_UNAVAILABLE");
  }
}
