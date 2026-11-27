import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { ApiError, serviceApi, type Associations, type Detail, type Listing, type Publications, type RankReport } from "./api";

const stamp = "2026-11-27T02:00:00Z";
const user = { kind: "USER" as const, id: "11111111-1111-4111-8111-111111111111", emailVerified: false };
const detail: Detail = {
  game: { gameId: "steam:570", steamAppId: 570, name: "Synthetic Arena", developers: { availability: "EMPTY", value: [] },
    releaseAt: { availability: "UNAVAILABLE", value: null }, steamConnection: "CONNECTED", youtubeConnection: "CONNECTED",
    currentCcu: { availability: "AVAILABLE", value: 0, observedAt: stamp }, peak24h: { availability: "AVAILABLE", value: 100, observedAt: stamp },
    newYoutubeVideos: { availability: "UNAVAILABLE", value: null, observedAt: null }, freshness: "UNASSESSED" },
  asOf: stamp, youtubePreviewAvailability: "UNAVAILABLE",
  steamPreview: { appId: 570, days: 30, dataStatus: "EMPTY", freshnessStatus: "UNASSESSED", lastObservedAt: null, points: [] },
};
const listing: Listing = { content: [detail.game], page: { number: 0, size: 20, totalElements: 1, totalPages: 1 }, asOf: stamp, dataStatus: "AVAILABLE", freshness: "UNASSESSED" };
const associations: Associations = { relevanceVerification: "UNVERIFIED", accelerationAvailability: "UNAVAILABLE", accelerationReason: "policy pending", content: [{ appId: 570, queryAssociatedVideos: 4, comparableVideos: 2, comparableRatio: 0.5 }] };
const summary: NonNullable<Publications["summary"]> = { population: "QUERY_ASSOCIATED_DISTINCT_VIDEOS_DISCOVERED_BY_AS_OF", observedVideos: 5, publishedVideos: 3, periodVideos: 2, missingPublishedAt: 1, futurePublishedAt: 1, latestFirstObservedAt: stamp };
function publications(_id: string, params: URLSearchParams): Publications {
  const page = Number(params.get("page") || 0), scope = params.get("scope") === "period" ? "period" : "date";
  return { appId: 570, days: Number(params.get("days")), asOf: stamp, timezone: "Asia/Seoul", dataStatus: "AVAILABLE", coverage: "UNASSESSED",
    missingPublishedAt: 1, selectedDate: scope === "period" ? null : params.get("date") || "2026-11-27", videoScope: scope, summary,
    points: [{ date: "2026-11-26", observedVideos: 1, inProgress: false }, { date: "2026-11-27", observedVideos: 1, inProgress: true }],
    videos: { content: [{ videoId: "abcdefghijk", title: "<script>synthetic</script>", publishedAt: stamp, firstObservedAt: stamp }], page: { number: page, size: 20, totalElements: 60, hasNext: page < 2 } } };
}
function go(path: string, state: unknown = null) {
  window.history.replaceState({ key: crypto.randomUUID(), usr: state }, "", path);
  return render(<ServiceApp />);
}
async function browserMove(path: string) {
  await act(async () => {
    window.history.pushState({ key: crypto.randomUUID() }, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}
beforeEach(() => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "false");
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.spyOn(serviceApi, "me").mockRejectedValue(new ApiError(401, "AUTHENTICATION_REQUIRED"));
  vi.spyOn(serviceApi, "detail").mockResolvedValue(detail);
  vi.spyOn(serviceApi, "games").mockResolvedValue(listing);
  vi.spyOn(serviceApi, "search").mockResolvedValue(listing);
  vi.spyOn(serviceApi, "classifications").mockResolvedValue({ state: "AVAILABLE", options: [{ id: "WEEKLY_TOP_SELLERS|", label: "주간 판매 순위" }], meaning: "수집 분류" });
  vi.spyOn(serviceApi, "steamTags").mockResolvedValue({ state: "EMPTY", options: [], meaning: "Steam 태그" });
  vi.spyOn(serviceApi, "publications").mockImplementation(async (id, params) => publications(id, params));
  vi.spyOn(serviceApi, "associations").mockResolvedValue(associations);
  vi.spyOn(serviceApi, "settings").mockResolvedValue({ version: 1, values: { theme: "system" } });
  vi.spyOn(serviceApi, "request").mockResolvedValue(undefined);
  vi.spyOn(serviceApi, "chatStatus").mockResolvedValue({ available: false, state: "UNAVAILABLE", message: "" });
  vi.spyOn(serviceApi, "video").mockResolvedValue({ from: stamp, to: stamp, mappingBasis: "NATIVE", freshness: "UNASSESSED", comparison: { availability: "UNAVAILABLE", reason: "ONE_OBSERVATION", elapsedSeconds: null, cumulativeDifference: null, first: null, last: null }, observations: [{ id: 1, slot: stamp, receivedAt: stamp, views: 0 }] });
  vi.spyOn(serviceApi, "ccu").mockResolvedValue(detail.steamPreview);
  vi.spyOn(serviceApi, "periods").mockResolvedValue({ content: [], dataStatus: "EMPTY" });
  vi.spyOn(serviceApi, "composition").mockResolvedValue({ asOf: stamp, dataStatus: "EMPTY", composition: { total: 0, games: 0, nonGames: 0, unknown: 0, gameRatio: null, nonGameRatio: null, unknownRatio: null } });
  vi.spyOn(serviceApi, "ccuCharts").mockResolvedValue({ asOf: stamp, recent: [], exact24Hours: { requested: 0, comparable: 0, excluded: 0, up: 0, down: 0, same: 0, comparisons: [] } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("restores publication dates and pages from URLs and resets pagination on date/period changes", async () => {
  go("/games/steam:570/youtube?days=7&videoDate=2026-11-26&videoPage=2");
  await screen.findByText(/2026-11-26 게시 영상/);
  expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].toString()).toBe("days=7&page=2&date=2026-11-26");
  fireEvent.click(screen.getByRole("button", { name: "2026-11-27 관측 영상 1개 진행 중" }));
  await waitFor(() => expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].get("page")).toBe("0"));
  fireEvent.change(screen.getByLabelText("게시 영상 범위"), { target: { value: "period" } });
  await screen.findByRole("heading", { name: /선택한 7일 게시 영상/ });
  expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].get("scope")).toBe("period");
  expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].has("date")).toBe(false);
  await browserMove("/games/steam:570/youtube?days=30&videoDate=2026-11-26&videoPage=1");
  await waitFor(() => expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].toString()).toBe("days=30&page=1&date=2026-11-26"));
  expect(screen.getByLabelText("게시 영상 기간")).toHaveValue("30");
});
it("does not send malformed date/page/period values and remains compatible with a server without summary", async () => {
  vi.mocked(serviceApi.publications).mockImplementation(async (id, params) => { const value = publications(id, params); delete value.summary; return value; });
  go("/games/steam:570/youtube?days=999&videoDate=2026-02-31&videoPage=-3");
  expect((await screen.findAllByText("요약 미제공"))[0]).toBeVisible();
  expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].toString()).toBe("days=30&page=0");
});
it("drills down to stored native-video observations and returns with the same date/page and list context", async () => {
  const origin = "/games/steam:570/youtube?days=7&videoDate=2026-11-26&videoPage=1";
  go(origin, { returnTo: "/games?q=Arena&days=7&page=2" });
  fireEvent.click(await screen.findByRole("link", { name: "저장된 영상 통계 보기" }));
  await waitFor(() => expect(serviceApi.video).toHaveBeenCalledWith("abcdefghijk", 7, expect.any(AbortSignal)));
  expect(screen.getByLabelText("YouTube 영상 ID")).toHaveValue("abcdefghijk");
  fireEvent.click(screen.getByRole("link", { name: "← 게시 영상 목록" }));
  await screen.findByLabelText("게시 영상 기간");
  expect(window.location.pathname + window.location.search).toBe(origin);
  fireEvent.click(screen.getByRole("link", { name: "← 게임 상세" }));
  await screen.findByRole("heading", { name: "Synthetic Arena" });
  fireEvent.click(screen.getByRole("link", { name: "← 게임 목록" }));
  await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/games?q=Arena&days=7&page=2"));
});
it("uses safe fallback for an external native-video return link", async () => {
  go("/charts/youtube?videoId=abcdefghijk&days=7", { publicationReturnTo: "https://example.invalid" });
  expect(await screen.findByRole("link", { name: "← 게시 영상 목록" })).toHaveAttribute("href", "/games");
});
it("does not present a date-only response as a whole-period video list", async () => {
  vi.mocked(serviceApi.publications).mockImplementation(async (id, params) => ({ ...publications(id, params), videoScope: undefined, selectedDate: "2026-11-27" }));
  go("/games/steam:570/youtube?days=7&videoScope=period");
  expect(await screen.findByRole("alert")).toHaveTextContent("서버 응답을 확인할 수 없습니다");
  expect(screen.queryByRole("link", { name: "저장된 영상 통계 보기" })).toBeNull();
});
it("distinguishes an out-of-range video page from an observed empty period and returns to the first page", async () => {
  vi.mocked(serviceApi.publications).mockImplementation(async (id, params) => {
    const value = publications(id, params);
    if (params.get("page") === "10") value.videos = { content: [], page: { number: 10, size: 20, totalElements: 3, hasNext: false } };
    return value;
  });
  go("/games/steam:570/youtube?days=7&videoScope=period&videoPage=10");
  expect(await screen.findByText(/현재 페이지에 표시할 영상이 없습니다/)).toHaveTextContent("3개 영상이 관측");
  expect(screen.queryByText(/선택 기간에 관측한 게시 영상 없음/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "첫 영상 페이지로" }));
  await screen.findByRole("link", { name: "저장된 영상 통계 보기" });
  expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].get("page")).toBe("0");
  expect(new URLSearchParams(window.location.search).get("videoScope")).toBe("period");
});
it("connects G11 for a USER with the current game and selected period", async () => {
  vi.mocked(serviceApi.me).mockResolvedValue(user);
  go("/games/steam:570/youtube?days=7");
  expect(await screen.findByRole("heading", { name: "11 · 검색어 연결 영상과 비교 가능한 영상" })).toBeVisible();
  expect(serviceApi.associations).toHaveBeenCalledWith([570], 7, expect.any(AbortSignal));
  fireEvent.change(screen.getByLabelText("게시 영상 기간"), { target: { value: "30" } });
  await waitFor(() => expect(serviceApi.associations).toHaveBeenLastCalledWith([570], 30, expect.any(AbortSignal)));
});
it.each(["GUEST", "ADMIN"])("does not call USER-only G11 for %s", async realm => {
  if (realm === "ADMIN") vi.mocked(serviceApi.me).mockResolvedValue({ ...user, kind: "ADMIN" });
  go("/games/steam:570/youtube");
  await screen.findByText(/일반 회원으로 로그인한 뒤 조회/);
  expect(serviceApi.associations).not.toHaveBeenCalled();
});
it.each([404, 403, 503])("keeps G11 HTTP %s separate from observed zero", async status => {
  vi.mocked(serviceApi.me).mockResolvedValue(user);
  vi.mocked(serviceApi.associations).mockRejectedValue(new ApiError(status, "SOURCE_UNAVAILABLE"));
  go("/games/steam:570/youtube");
  if (status === 404) expect(await screen.findByText(/이 조회 기능이 현재 제공되지 않습니다/)).toBeVisible();
  else expect(await screen.findByRole("alert")).toHaveTextContent(status === 403 ? "권한" : "데이터를 불러오지 못했습니다");
  expect(screen.queryByText(/선택 기간에 조회된 검색어 연결 영상이 없습니다/)).toBeNull();
});
it("shows an observed empty G11 result separately from a disabled feature", async () => {
  vi.mocked(serviceApi.me).mockResolvedValue(user);
  vi.mocked(serviceApi.associations).mockResolvedValue({ ...associations, content: [] });
  go("/games/steam:570/youtube");
  expect(await screen.findByText(/선택 기간에 조회된 검색어 연결 영상이 없습니다/)).toBeVisible();
  expect(screen.queryByText(/이 조회 기능이 현재 제공되지 않습니다/)).toBeNull();
});
it("keeps failed session confirmation separate from a guest and permits rechecking before G11", async () => {
  vi.mocked(serviceApi.me).mockRejectedValue(new ApiError(503, "SESSION_UNAVAILABLE"));
  go("/games/steam:570/youtube");
  expect(await screen.findByRole("alert")).toHaveTextContent("데이터를 불러오지 못했습니다");
  expect(screen.queryByText(/일반 회원으로 로그인한 뒤 조회/)).toBeNull();
  expect(serviceApi.associations).not.toHaveBeenCalled();
  vi.mocked(serviceApi.me).mockResolvedValue(user);
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  await screen.findByRole("heading", { name: "11 · 검색어 연결 영상과 비교 가능한 영상" });
  expect(serviceApi.associations).toHaveBeenCalled();
});

it.each(["reactions", "keywords", "events"])("opens the existing game context for %s without fabricating analysis", async kind => {
  go("/games/steam:570/" + kind + "?days=7", { returnTo: "/games?q=Arena" });
  await screen.findByText(/선택 게임 · Synthetic Arena/);
  expect(screen.getByLabelText("관측 기간")).toHaveValue("7");
  expect(screen.queryByText(/DEMO|PERF-001|12,842/)).toBeNull();
  expect(serviceApi.publications).not.toHaveBeenCalled();
  if (kind === "events") expect(screen.getByLabelText("이벤트 유형")).toBeDisabled();
  if (kind === "reactions") expect(screen.getByRole("complementary", { name: "반응 상세" }).children).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("관측 기간"), { target: { value: "30" } });
  expect(new URLSearchParams(window.location.search).get("days")).toBe("30");
  fireEvent.click(screen.getByRole("link", { name: "← 게임 상세" }));
  await screen.findByRole("heading", { name: "Synthetic Arena" });
  fireEvent.click(screen.getByRole("link", { name: "← 게임 목록" }));
  await waitFor(() => expect(window.location.search).toBe("?q=Arena"));
});
it("can display the independent publication response when the game detail source fails", async () => {
  vi.mocked(serviceApi.detail).mockRejectedValue(new ApiError(503, "DATA_SOURCE_UNAVAILABLE"));
  go("/games/steam:570/youtube?days=7");
  expect(await screen.findByRole("alert")).toHaveTextContent("데이터를 불러오지 못했습니다");
  expect(await screen.findByRole("link", { name: "저장된 영상 통계 보기" })).toBeVisible();
  expect(vi.mocked(serviceApi.publications).mock.lastCall?.[0]).toBe("steam:570");
  expect(serviceApi.associations).not.toHaveBeenCalled();
});

it.each([400, 403, 404, 429])("does not fetch publications after the game detail request is rejected with %s", async status => {
  vi.mocked(serviceApi.detail).mockRejectedValue(new ApiError(status, "REJECTED"));
  go("/games/steam:570/youtube");
  await screen.findByRole("alert");
  expect(serviceApi.publications).not.toHaveBeenCalled();
});

it.each([404, 503])("does not show unavailability as successful game context for HTTP %s", async status => {
  vi.mocked(serviceApi.detail).mockRejectedValue(new ApiError(status, "GAME_UNAVAILABLE"));
  go("/games/steam:570/reactions");
  expect(await screen.findByRole("alert")).toHaveTextContent(status === 404 ? "데이터를 찾을 수 없습니다" : "데이터를 불러오지 못했습니다");
  expect(screen.queryByRole("complementary", { name: "반응 상세" })).toBeNull();
});
it.each([
  ["reactions", "analysis.reaction", "REACTION"], ["keywords", "analysis.keyword", "KEYWORD"], ["events", "analysis.event", "EVENT"],
])("records %s screen visits with unavailable sources without claiming an analysis run", async (kind, routeKey, analysisType) => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
  go("/games/steam:570/" + kind + "?days=7");
  await screen.findByText(/선택 게임 · Synthetic Arena/);
  const events = vi.mocked(serviceApi.request).mock.calls.filter(([path]) => path === "/api/v1/events").map(([, options]) => options?.body);
  expect(events).toEqual(expect.arrayContaining([
    expect.objectContaining({ eventType: "PAGE_VIEW", properties: { routeKey, appId: 570 } }),
    expect.objectContaining({ eventType: "ANALYSIS_VIEW", properties: { analysisType, appId: 570 } }),
  ]));
  expect(events).toHaveLength(2);
  expect(JSON.stringify(events)).not.toMatch(/PERIOD_CHANGED|KEYWORD_SELECTED|EVENT_VIEW/);
});
it("does not record an analysis screen visit when its game context fails", async () => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
  vi.mocked(serviceApi.detail).mockRejectedValue(new ApiError(404, "GAME_NOT_FOUND"));
  go("/games/steam:570/events");
  await screen.findByRole("alert");
  expect(vi.mocked(serviceApi.request).mock.calls.filter(([path]) => path === "/api/v1/events")).toHaveLength(0);
});

it.each(["resolve", "reject"])("ignores a late search %s after changing the period", async outcome => {
  let resolve!: (value: Listing) => void, reject!: (reason: unknown) => void;
  vi.mocked(serviceApi.search).mockImplementation(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  go("/games?days=30");
  fireEvent.change(await screen.findByLabelText("게임명 검색"), { target: { value: "old" } });
  fireEvent.click(screen.getByRole("button", { name: "검색" }));
  await waitFor(() => expect(serviceApi.search).toHaveBeenCalled());
  const signal = vi.mocked(serviceApi.search).mock.lastCall?.[1];
  fireEvent.change(screen.getByLabelText("데이터 판정 기간"), { target: { value: "7" } });
  await act(async () => { if (outcome === "resolve") resolve({ ...listing, content: [] }); else reject(new ApiError(503, "LATE_FAILURE")); });
  expect(signal?.aborted).toBe(true);
  expect(new URLSearchParams(window.location.search).get("days")).toBe("7");
  expect(new URLSearchParams(window.location.search).has("q")).toBe(false);
  expect(screen.queryByRole("alert")).toBeNull();
});
it("uses the server's 100-code-point limit for game searches", async () => {
  go("/games");
  const input = await screen.findByLabelText("게임명 검색");
  const term = "🎮".repeat(100);
  fireEvent.change(input, { target: { value: term + "가" } });
  expect(screen.getByRole("button", { name: "검색" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("100자");
  expect(serviceApi.search).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: term } });
  fireEvent.click(screen.getByRole("button", { name: "검색" }));
  await waitFor(() => expect(vi.mocked(serviceApi.search).mock.lastCall?.[0].q).toBe(term));
});

it("resets all game filters and ignores results of the discarded search", async () => {
  let finish!: (data: Listing) => void;
  vi.mocked(serviceApi.search).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  go("/dashboard?days=7&q=old");
  fireEvent.change(await screen.findByLabelText("게임명 검색"), { target: { value: "pending" } });
  fireEvent.click(screen.getByRole("button", { name: "검색" }));
  await waitFor(() => expect(serviceApi.search).toHaveBeenCalled());
  const signal = vi.mocked(serviceApi.search).mock.lastCall?.[1];
  fireEvent.click(screen.getByRole("button", { name: "전체 조건 초기화" }));
  await act(async () => finish(listing));
  expect(signal?.aborted).toBe(true);
  expect(window.location.pathname + window.location.search).toBe("/dashboard");
  expect(screen.getByLabelText("게임명 검색")).toHaveValue("");
  expect(screen.getByLabelText("데이터 판정 기간")).toHaveValue("30");
  expect(vi.mocked(serviceApi.games).mock.lastCall?.[0].toString()).toBe("");
});

it("ignores a late search after browser navigation and after unmount", async () => {
  let resolve!: (value: Listing) => void;
  vi.mocked(serviceApi.search).mockImplementation(() => new Promise(yes => { resolve = yes; }));
  const view = go("/games?days=30");
  fireEvent.change(await screen.findByLabelText("게임명 검색"), { target: { value: "old" } });
  fireEvent.click(screen.getByRole("button", { name: "검색" }));
  await waitFor(() => expect(serviceApi.search).toHaveBeenCalled());
  await browserMove("/games?days=7&q=current");
  view.unmount();
  await act(async () => resolve(listing));
  expect(window.location.search).toBe("?days=7&q=current");
});

it("restores native video and CCU queries, rejecting malformed IDs before requests", async () => {
  const view = go("/charts/youtube?videoId=abcdefghijk&days=30");
  await waitFor(() => expect(serviceApi.video).toHaveBeenCalledWith("abcdefghijk", 30, expect.any(AbortSignal)));
  await screen.findByText(/마지막 영상 관측/);
  const videoCalls = vi.mocked(serviceApi.video).mock.calls.length;
  await browserMove("/charts/youtube?videoId=invalid&days=999");
  expect(screen.getByLabelText("관측 기간")).toHaveValue("7");
  expect(await screen.findByRole("alert")).toHaveTextContent("URL의 영상 ID");
  expect(serviceApi.video).toHaveBeenCalledTimes(videoCalls);
  view.unmount();
  go("/charts/steam?appIds=570,730&days=30");
  await waitFor(() => expect(serviceApi.ccuCharts).toHaveBeenCalledWith([570, 730], 30, expect.any(AbortSignal)));
  await screen.findByRole("heading", { name: "13 · 정확히 24시간 전 대비 게임 수" });
  const ccuCalls = vi.mocked(serviceApi.ccuCharts).mock.calls.length;
  expect(screen.getByLabelText("비교할 Steam app ID")).toHaveValue("570,730");
  await browserMove("/charts/steam?appIds=570,570&days=7");
  expect(await screen.findByRole("alert")).toHaveTextContent("URL의 Steam app ID");
  expect(serviceApi.ccuCharts).toHaveBeenCalledTimes(ccuCalls);
});

it("restores ranking dimensions and displays both source positions for G07", async () => {
  const start = "2026-11-16T00:00:00Z";
  vi.mocked(serviceApi.periods).mockResolvedValue({ dataStatus: "AVAILABLE", content: [{ source: "WEEKLY_TOP_SELLERS", category: null, start, end: "2026-11-23T00:00:00Z" }] });
  const region = { country: "KR", availability: "AVAILABLE", comparable: 1, uncomparable: 0, up: 1, down: 0, same: 0, upRatio: 1, downRatio: 0, sameRatio: 0, deltaHistogram: { "1": 1 }, topRisers: [], topFallers: [] };
  const pair = { appId: 570, name: "Synthetic Arena", krPosition: 2, unspecifiedPosition: 8, absoluteGap: 6 };
  const report: RankReport = { source: "WEEKLY_TOP_SELLERS", category: null, asOf: stamp, freshness: "UNASSESSED", calculationVersion: "synthetic", charts: { rankOneAtTop: true, weeks: [{ periodStart: start, kr: region, unspecified: { ...region, country: "UNSPECIFIED" }, pairAvailability: "AVAILABLE", pairs: [pair], largestGaps: [pair] }], lastThreeWeekTrends: [{ appId: 570, name: "Synthetic Arena", country: "UNSPECIFIED", points: [{ periodStart: start, position: 8 }] }], top20Continuity: [] } };
  vi.spyOn(serviceApi, "rankings").mockResolvedValue(report);
  const params = new URLSearchParams({ rankScope: JSON.stringify(["WEEKLY_TOP_SELLERS", null]), rankFrom: start, rankCountry: "UNSPECIFIED", rankAppId: "570" });
  go("/charts/steam?" + params);
  const table = await screen.findByRole("region", { name: "지역별 원순위 비교" });
  expect(within(table).getByText("2위")).toBeVisible();
  expect(within(table).getByText("8위")).toBeVisible();
  expect(screen.getByLabelText("지역")).toHaveValue("UNSPECIFIED");
  expect(screen.getByLabelText("3주 관측 게임")).toHaveValue("570");
  expect(vi.mocked(serviceApi.rankings).mock.lastCall?.[0].get("from")).toBe(start);
});
it("submits only aligned start weeks within twelve weeks of the latest observed ranking", async () => {
  const latest = "2026-11-23T00:00:00Z";
  const earliest = "2026-08-31T00:00:00Z";
  const outside = "2026-06-01T00:00:00Z";
  const shifted = "2026-11-17T00:00:00Z";
  const microsecond = "2026-11-16T00:00:00.000001Z";
  const starts = [outside, earliest, shifted, microsecond, latest];
  vi.mocked(serviceApi.periods).mockResolvedValue({ dataStatus: "AVAILABLE", content: starts.map(start => ({
    source: "WEEKLY_TOP_SELLERS", category: null, start, end: new Date(Date.parse(start) + 7 * 86400000).toISOString(),
  })) });
  const rankings = vi.spyOn(serviceApi, "rankings").mockRejectedValue(new ApiError(503, "DATA_SOURCE_ERROR"));
  go("/charts/steam?rankFrom=" + outside);
  await waitFor(() => expect(rankings).toHaveBeenCalled());
  const select = screen.getByLabelText<HTMLSelectElement>("시작 주차");
  expect(Array.from(select.options, option => option.value)).toEqual([earliest, latest]);
  expect(select).toHaveValue(earliest);
  expect(rankings.mock.lastCall?.[0].get("from")).toBe(earliest);
  expect(rankings.mock.lastCall?.[0].get("to")).toBe(latest);
});

it.each([4294967295, 4294967296])("validates the Steam uint32 upper boundary for %s before requesting CCU", async id => {
  go("/charts/steam?appIds=" + id + "&days=7");
  if (id === 4294967295) await waitFor(() => expect(serviceApi.ccuCharts).toHaveBeenCalledWith([id], 7, expect.any(AbortSignal)));
  else {
    expect(await screen.findByRole("alert")).toHaveTextContent("URL의 Steam app ID");
    expect(serviceApi.ccuCharts).not.toHaveBeenCalled();
  }
});

it("supports Space on a game row and keeps the chosen period through platform navigation", async () => {
  go("/games?days=7&q=Arena");
  const row = await screen.findByRole("row", { name: "Synthetic Arena 상세 보기" });
  fireEvent.keyDown(row, { key: " " });
  await screen.findByRole("heading", { name: "Synthetic Arena" });
  fireEvent.click(screen.getByRole("link", { name: "YouTube 관측 →" }));
  await screen.findByLabelText("게시 영상 기간");
  expect(window.location.search).toBe("?days=7");
  fireEvent.click(screen.getByRole("link", { name: "← 게임 상세" }));
  await screen.findByRole("heading", { name: "Synthetic Arena" });
  fireEvent.click(screen.getByRole("link", { name: "← 게임 목록" }));
  await waitFor(() => expect(window.location.search).toBe("?days=7&q=Arena"));
});
it.each(["", "?days=invalid"])("preserves effective default periods on direct-entry platform transitions (%s)", async suffix => {
  go("/games/steam:570/steam" + suffix);
  await screen.findByRole("navigation", { name: "선택 게임 분석" });
  expect(screen.getByLabelText("관측 기간")).toHaveValue("7");
  fireEvent.click(screen.getByRole("link", { name: "YouTube 관측 →" }));
  expect(await screen.findByLabelText("게시 영상 기간")).toHaveValue("7");
  await browserMove("/games/steam:570" + suffix);
  await screen.findByRole("heading", { name: "Synthetic Arena" });
  fireEvent.click(screen.getByRole("link", { name: "Steam 분석 →" }));
  await screen.findByRole("navigation", { name: "선택 게임 분석" });
  expect(screen.getByLabelText("관측 기간")).toHaveValue("30");
});
it("makes the brand an accessible home link", async () => {
  go("/games");
  const brand = await screen.findByRole("link", { name: "YUTOPIA 홈" });
  expect(brand).toHaveAttribute("href", "/dashboard");
  fireEvent.click(brand);
  expect(await screen.findByRole("heading", { name: "게임 활동 현황" })).toBeVisible();
});
it("keeps the administrator brand in the administrator area", async () => {
  vi.mocked(serviceApi.me).mockResolvedValue({ ...user, kind: "ADMIN" });
  go("/admin/users");
  expect(await screen.findByRole("link", { name: "YUTOPIA 홈" })).toHaveAttribute("href", "/admin");
});

it("sends publication view/period telemetry only after a successful supported observation response", async () => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
  let complete!: (value: Publications) => void;
  vi.mocked(serviceApi.publications).mockImplementation((_id, _params) => new Promise(resolve => { complete = resolve; }));
  go("/games/steam:570/youtube?days=7");
  await screen.findByLabelText("게시 영상 기간");
  const events = () => vi.mocked(serviceApi.request).mock.calls.filter(([path]) => path === "/api/v1/events").map(([, options]) => options?.body as { eventType: string });
  await waitFor(() => expect(events().filter(event => event.eventType === "PAGE_VIEW")).toHaveLength(1));
  expect(events().filter(event => event.eventType === "ANALYSIS_VIEW")).toHaveLength(0);
  await act(async () => complete(publications("steam:570", new URLSearchParams({ days: "7" }))));
  await waitFor(() => expect(events().filter(event => event.eventType === "ANALYSIS_VIEW")).toHaveLength(1));
  expect(events().filter(event => event.eventType === "PAGE_VIEW")).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("게시 영상 기간"), { target: { value: "30" } });
  expect(events().filter(event => event.eventType === "PERIOD_CHANGED")).toHaveLength(0);
  await act(async () => complete(publications("steam:570", new URLSearchParams({ days: "30" }))));
  await waitFor(() => expect(events().filter(event => event.eventType === "PERIOD_CHANGED")).toHaveLength(1));
});

it.each(["PENDING_CONTRACT", "ERROR"])("records a page visit for %s, then one observation view after retry without treating failure as success", async status => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
  vi.mocked(serviceApi.publications).mockImplementation(async (id, params) => {
    if (status === "ERROR") throw new ApiError(503, "DATA_SOURCE_UNAVAILABLE");
    return { ...publications(id, params), dataStatus: status, summary: null, videos: null, points: [] };
  });
  go("/games/steam:570/youtube?days=7");
  if (status === "ERROR") await screen.findByRole("alert"); else await screen.findByText(/게시 영상 상태 미확인/);
  const events = () => vi.mocked(serviceApi.request).mock.calls.filter(([path]) => path === "/api/v1/events").map(([, options]) => options?.body as { eventType: string });
  await waitFor(() => expect(events().filter(event => event.eventType === "PAGE_VIEW")).toHaveLength(1));
  expect(events().filter(event => event.eventType === "ANALYSIS_VIEW")).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("게시 영상 기간"), { target: { value: "30" } });
  await waitFor(() => expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].get("days")).toBe("30"));
  await waitFor(() => expect(events().filter(event => event.eventType === "PAGE_VIEW")).toHaveLength(2));
  expect(events().filter(event => event.eventType === "ANALYSIS_VIEW" || event.eventType === "PERIOD_CHANGED")).toHaveLength(0);
  vi.mocked(serviceApi.publications).mockImplementation(async (id, params) => publications(id, params));
  fireEvent.click(await screen.findByRole("button", { name: status === "ERROR" ? "다시 시도" : "게시 영상 다시 확인" }));
  await waitFor(() => expect(events().filter(event => event.eventType === "ANALYSIS_VIEW")).toHaveLength(1));
  expect(events().filter(event => event.eventType === "PAGE_VIEW")).toHaveLength(2);
  expect(events().filter(event => event.eventType === "PERIOD_CHANGED")).toHaveLength(1);
});
