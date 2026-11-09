import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeywordTrendExplorerPage } from "./KeywordTrendExplorerPage";

const source = [
  "comment_id,video_id,channel_id,published_at,text,video_title,channel_name",
  "music1,v1,ch1,2026-11-07T08:00:00Z,음악 노래 플레이리스트,영상 하나,채널 하나",
  "music2,v1,ch1,2026-11-08T08:00:00Z,음악 노래,영상 하나,채널 하나",
  "music3,v2,ch2,2026-11-09T09:00:00Z,노래 추천,영상 둘,채널 둘",
  "music4,v2,ch2,2026-11-09T10:00:00Z,무관한 표현,영상 둘,채널 둘",
].join("\n");

afterEach(() => vi.unstubAllGlobals());

describe("G2-O evidence-backed candidate discovery", () => {
  it("starts without invented observed candidates and requires a user-selected source", async () => {
    const user = userEvent.setup();
    render(<KeywordTrendExplorerPage />);
    await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"), "음악");
    await user.click(screen.getByRole("button", { name: "키워드 적용" }));
    const observed = screen.getByLabelText("관측 댓글 기반 표현 후보");
    expect(within(observed).getByText(/아직 선택한 출처에 관측 댓글 자료가 없습니다/))
      .toBeInTheDocument();
    expect(within(observed).queryByRole("button", { name: /관측 후보 추가/ }))
      .not.toBeInTheDocument();
  });

  it("shows co-occurrence counts and actual evidence without auto-select or API call", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<KeywordTrendExplorerPage />);
    await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"), "음악");
    await user.click(screen.getByRole("button", { name: "키워드 적용" }));
    await user.upload(screen.getByLabelText("키워드 관측 CSV"),
      new File([source], "sample.csv", { type: "text/csv" }));
    await waitFor(() => expect(screen.getByText(/관측 댓글 4개를 로컬로 읽었습니다/))
      .toBeInTheDocument());
    const panel = screen.getByLabelText("관측 댓글 기반 표현 후보");
    expect(within(panel).getByRole("button", { name: "노래 관측 후보 추가" }))
      .toBeInTheDocument();
    expect(within(panel).getByText(/같은 댓글에 등장 2건/)).toBeInTheDocument();
    expect(within(panel).getByText(/현재 표본에서 해당 문구 포함 3건/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택한 관련 표현 포함" })).toBeDisabled();
    await user.click(within(panel).getByText("노래 근거 댓글 보기"));
    const comments = within(panel).getByText("노래 근거 댓글 보기").closest("details");
    expect(comments).not.toBeNull();
    expect(within(comments as HTMLElement).getByText("음악 노래 플레이리스트")).toBeInTheDocument();
    expect(within(comments as HTMLElement).getByText("음악 노래")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(within(panel).getByRole("button", { name: "노래 관측 후보 추가" }));
    expect(screen.getByRole("button", { name: "노래 선택 해제" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "원래 키워드만" }))
      .toHaveAttribute("aria-pressed", "true");
    const summary = screen.getByLabelText("선택 표현 확장 집계");
    expect(within(summary).getByText("중복 제외 합계")).toBeInTheDocument();
    expect(within(summary).getByText("3개")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "선택한 관련 표현 포함" }));
    expect(screen.getByText("선택 표현만 일치: 노래")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recomputes observed candidates for a new keyword and correct source, never reuses stale CSV data", async () => {
    const user = userEvent.setup();
    const fakeVideo = {
      videoId: "AbCdefghI12", title: "실제 영상 후보",
      channelId: "UCabc", channelTitle: "채널 A",
      publishedAt: "2026-11-09T09:00:00Z", thumbnailUrl: null,
      videoUrl: "https://www.youtube.com/watch?v=AbCdefghI12",
    };
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => url === "/api/youtube/discover" ? {
        kind: "YOUTUBE_PUBLIC_VIDEO_SEARCH_V1", source: "YOUTUBE_DATA_API_SEARCH",
        query: "음악", fetchedAt: "2026-11-09T09:00:00Z", videos: [fakeVideo],
      } : {
        kind: "YOUTUBE_PUBLIC_TOP_LEVEL_COMMENTS_V1",
        source: "YOUTUBE_DATA_API_COMMENT_THREADS", scope: "FIRST_PAGE_TOP_LEVEL_MAX_100",
        order: "time", query: "음악", videoId: fakeVideo.videoId,
        videoTitle: fakeVideo.title, channelId: fakeVideo.channelId,
        channelTitle: fakeVideo.channelTitle,
        fetchedAt: "2026-11-09T09:00:00Z",
        sampledCount: 1, skipped: 0, truncated: 0, hasMore: false,
        comments: [{
          id: "Ug.m1", videoId: fakeVideo.videoId, videoTitle: fakeVideo.title,
          channelId: fakeVideo.channelId, channelName: fakeVideo.channelTitle,
          publishedAt: "2026-11-09T09:00:00Z", text: "음악 콘서트 공연",
        }],
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<KeywordTrendExplorerPage />);
    await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"), "음악");
    await user.click(screen.getByRole("button", { name: "키워드 적용" }));
    await user.upload(screen.getByLabelText("키워드 관측 CSV"),
      new File([source], "sample.csv", { type: "text/csv" }));
    await waitFor(() => expect(screen.getByText(/관측 댓글 4개를 로컬로 읽었습니다/))
      .toBeInTheDocument());
    let panel = screen.getByLabelText("관측 댓글 기반 표현 후보");
    expect(within(panel).getByRole("button", { name: "노래 관측 후보 추가" }))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "YouTube 영상 검색" }));
    await screen.findByText("실제 영상 후보");
    await user.click(screen.getByRole("button", { name: "실제 영상 후보 댓글 표본 가져오기" }));
    await waitFor(() => expect(screen.getByLabelText("댓글 분석 출처")).toHaveValue("YOUTUBE"));
    panel = screen.getByLabelText("관측 댓글 기반 표현 후보");
    expect(within(panel).getByRole("button", { name: "콘서트 관측 후보 추가" }))
      .toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "노래 관측 후보 추가" }))
      .not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.click(within(panel).getByRole("button", { name: "콘서트 관측 후보 추가" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.selectOptions(screen.getByLabelText("댓글 분석 출처"), "CSV");
    panel = screen.getByLabelText("관측 댓글 기반 표현 후보");
    expect(within(panel).getByRole("button", { name: "노래 관측 후보 추가" }))
      .toBeInTheDocument();
    await user.clear(screen.getByLabelText("어떤 키워드가 궁금한가요?"));
    await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"), "무관한");
    await user.click(screen.getByRole("button", { name: "키워드 적용" }));
    expect(screen.queryByRole("button", { name: "콘서트 선택 해제" })).not.toBeInTheDocument();
    panel = screen.getByLabelText("관측 댓글 기반 표현 후보");
    expect(within(panel).queryByRole("button", { name: "노래 관측 후보 추가" }))
      .not.toBeInTheDocument();
  });
});
