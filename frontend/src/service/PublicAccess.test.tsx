import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { ApiError, serviceApi, type Identity, type Listing, type RankReport } from "./api";

const listing: Listing = {
  content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 },
  asOf: "2026-10-30T00:00:00Z", dataStatus: "EMPTY", freshness: "UNASSESSED",
};
beforeEach(() => {
  vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED", "true");
  vi.spyOn(serviceApi, "me").mockRejectedValue(new ApiError(401, "AUTHENTICATION_REQUIRED"));
  vi.spyOn(serviceApi, "games").mockResolvedValue(listing);
  vi.spyOn(serviceApi, "detail").mockResolvedValue({
    game: {gameId:"steam:570",steamAppId:570,name:"Synthetic Game",developers:{availability:"EMPTY",value:[]},releaseAt:{availability:"UNAVAILABLE",value:null},steamConnection:"CONNECTED",youtubeConnection:"UNAVAILABLE",currentCcu:{availability:"EMPTY",value:null,observedAt:null},peak24h:{availability:"EMPTY",value:null,observedAt:null},newYoutubeVideos:{availability:"UNAVAILABLE",value:null,observedAt:null},freshness:"UNASSESSED"},
    asOf:listing.asOf,steamPreview:{appId:570,days:30,dataStatus:"EMPTY",freshnessStatus:"UNASSESSED",lastObservedAt:null,points:[]},youtubePreviewAvailability:"UNAVAILABLE",
  });
  vi.spyOn(serviceApi,"ccu").mockResolvedValue({appId:570,days:7,dataStatus:"EMPTY",freshnessStatus:"UNASSESSED",lastObservedAt:null,points:[]});
  vi.spyOn(serviceApi,"associations").mockRejectedValue(new ApiError(401,"AUTHENTICATION_REQUIRED"));
  vi.spyOn(serviceApi, "periods").mockResolvedValue({content:[],dataStatus:"EMPTY"});
  vi.spyOn(serviceApi, "composition").mockResolvedValue({asOf:listing.asOf,dataStatus:"EMPTY",composition:{total:0,games:0,nonGames:0,unknown:0,gameRatio:null,nonGameRatio:null,unknownRatio:null}});
  vi.spyOn(serviceApi, "request").mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each([
  ["/games", "관측 게임 탐색"],
  ["/dashboard", "게임 활동 현황"],
  ["/charts/steam", "Steam 트렌드 차트"],
  ["/charts/youtube", "YouTube 관측 분석"],
  ["/games/steam:570", "Synthetic Game"],
  ["/games/steam:570/steam", "Synthetic Game · Steam"],
  ["/games/steam:570/youtube", "Synthetic Game · YouTube"],
])("opens public %s for a guest without redirecting to login", async (path, title) => {
  window.history.replaceState({}, "", path);
  render(<ServiceApp />);
  expect(await screen.findByRole("heading", {name:title})).toBeVisible();
  await waitFor(() => expect(serviceApi.me).toHaveBeenCalled());
  expect(window.location.pathname).toBe(path);
  expect(screen.getByRole("link", {name:"로그인"})).toBeVisible();
  expect(serviceApi.associations).not.toHaveBeenCalled();
});
it.each([["/settings","/login"],["/admin","/admin/login"]])("keeps %s protected for a guest", async (path, destination) => {
  window.history.replaceState({}, "", path);
  render(<ServiceApp />);
  await waitFor(() => expect(window.location.pathname).toBe(destination));
  expect(serviceApi.games).not.toHaveBeenCalled();
});
it("searches as a guest with opted-in tracking without assuming a member identity", async () => {
  vi.spyOn(serviceApi, "search").mockResolvedValue({...listing,searchTracking:{availability:"AVAILABLE",clientEventId:"synthetic-event",searchContextId:"synthetic-context",properties:{totalResultCount:0},receipt:"synthetic-receipt"}});
  window.history.replaceState({}, "", "/games");
  render(<ServiceApp />);
  await screen.findByText("표시할 관측 데이터가 없습니다.");
  fireEvent.change(screen.getByLabelText("게임명 검색"), {target:{value:"Synthetic"}});
  fireEvent.click(screen.getByRole("button",{name:"검색"}));
  await waitFor(() => expect(serviceApi.search).toHaveBeenCalled());
  await waitFor(() => expect(serviceApi.request).toHaveBeenCalledWith("/api/v1/events",expect.objectContaining({account:undefined,body:expect.objectContaining({eventType:"SEARCH_EXECUTED"})})));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(window.location.pathname).toBe("/games");
});
it("selects a source NULL category without conflating it with literal category names", async () => {
  vi.spyOn(serviceApi,"periods").mockResolvedValue({dataStatus:"AVAILABLE",content:
    [null,"null","UNSPECIFIED"].map(category=>({source:"weekly_native",category,start:"2026-10-13T00:00:00Z",end:"2026-10-20T00:00:00Z"}))});
  const rankings=vi.spyOn(serviceApi,"rankings").mockResolvedValue(null!);
  window.history.replaceState({},"","/charts/steam");render(<ServiceApp />);
  const scope=await screen.findByRole("combobox",{name:"관측 원천 / 범주"});
  await waitFor(()=>expect(rankings).toHaveBeenCalled());
  expect(rankings.mock.lastCall![0].get("source")).toBe("weekly_native");
  expect(rankings.mock.lastCall![0].has("category")).toBe(false);
  expect(screen.getByRole("option",{name:"weekly_native / 범주 미지정"})).toBeVisible();
  for(const category of ["null","UNSPECIFIED"]){
    fireEvent.change(scope,{target:{value:JSON.stringify(["weekly_native",category])}});
    await waitFor(()=>expect(rankings.mock.lastCall![0].get("category")).toBe(category));
  }
  fireEvent.change(scope,{target:{value:JSON.stringify(["weekly_native",null])}});
  await waitFor(()=>expect(rankings.mock.lastCall![0].has("category")).toBe(false));
  expect(window.location.pathname).toBe("/charts/steam");
});
it("keeps source weekly end separate from a later query time and labels observed names", async () => {
  vi.spyOn(serviceApi,"periods").mockResolvedValue({dataStatus:"AVAILABLE",content:[
    {source:"weekly_native",category:null,start:"2026-10-13T00:00:00Z",end:"2026-10-20T00:00:00Z"}]});
  const region={country:"KR",availability:"AVAILABLE",comparable:1,uncomparable:0,up:1,down:0,same:0,upRatio:1,downRatio:0,sameRatio:0,deltaHistogram:{"5":1},topRisers:[{appId:570,name:"Observed earlier title",previous:10,current:5,positionChange:5}],topFallers:[]};
  const report:RankReport={source:"weekly_native",category:null,asOf:"2026-10-30T00:00:00Z",freshness:"UNASSESSED",calculationVersion:"source-weekly-rank-v1",charts:{rankOneAtTop:true,weeks:[{periodStart:"2026-10-13T00:00:00Z",kr:region,unspecified:{...region,country:"UNSPECIFIED"},pairAvailability:"UNAVAILABLE",pairs:[],largestGaps:[]}],lastThreeWeekTrends:[],top20Continuity:[]}};
  vi.spyOn(serviceApi,"rankings").mockResolvedValue(report);
  window.history.replaceState({},"","/charts/steam");render(<ServiceApp />);
  const end=await screen.findByText(/선택 원천의 관측 주간 종료/);
  expect(end).toHaveTextContent("2026. 10. 20.");
  expect(end).not.toHaveTextContent("2026. 10. 30.");
  const query=await screen.findByText(/조회 시각/);
  expect(query).toHaveTextContent("2026. 10. 30.");expect(query).toHaveTextContent("신선도 판정 전");
  expect(screen.getByText(/순위 게임명은 관측 당시 원천 표기/)).toBeVisible();
  expect(screen.getAllByText("Observed earlier title").length).toBeGreaterThan(0);
  expect(serviceApi.detail).not.toHaveBeenCalled();
});
it("keeps a missing release date unavailable instead of substituting the query date", async () => {
  window.history.replaceState({},"","/games/steam:570");render(<ServiceApp />);
  expect(await screen.findByText(/출시일 정보 없음/)).toBeVisible();
  expect(screen.queryByText(/출시일 미지원/)).toBeNull();
});
it("shows unverified game-video linkage and returns to the exact native game detail",async()=>{
  window.history.replaceState({},"","/games/steam:570/youtube");render(<ServiceApp />);
  expect(await screen.findByText(/Steam 앱 ID 570 · 게임별 YouTube 연결 미확인/)).toBeVisible();
  const back=screen.getByRole("link",{name:"← 게임 상세"});expect(back).toHaveAttribute("href","/games/steam:570");
  fireEvent.click(back);expect(await screen.findByRole("heading",{name:"Synthetic Game"})).toBeVisible();
  expect(window.location.pathname).toBe("/games/steam:570");
});
it.each([false,true])("keeps native video observation time and absent observations distinct (empty=%s)",async empty=>{
  const observations=empty?[]:[{id:1,slot:"2026-10-27T00:00:00Z",receivedAt:"2026-10-27T00:00:01Z",views:0}];
  vi.spyOn(serviceApi,"video").mockResolvedValue({from:"2026-10-23T00:00:00Z",to:"2026-10-30T00:00:00Z",freshness:"UNASSESSED",mappingBasis:"NATIVE_VIDEO_ID_NO_GAME_MAPPING",comparison:{availability:"UNAVAILABLE",reason:"INSUFFICIENT_OBSERVATIONS",elapsedSeconds:null,cumulativeDifference:null,first:empty?null:{views:0,slot:observations[0].slot},last:null},observations});
  window.history.replaceState({},"","/charts/youtube");render(<ServiceApp />);
  fireEvent.change(await screen.findByLabelText("YouTube 영상 ID"),{target:{value:"abcdefghijk"}});
  fireEvent.click(screen.getByRole("button",{name:"실제 영상 관측 조회"}));
  const caption=await screen.findByText(/마지막 영상 관측/);
  expect(caption).toHaveTextContent("조회 시각 2026. 10. 30.");expect(caption).toHaveTextContent("신선도 판정 전");
  expect(caption).toHaveTextContent(empty?"관측 시각 없음":"2026. 10. 27.");
  expect(serviceApi.associations).not.toHaveBeenCalled();
});
it("returns from login to public browsing and keeps browsing public after logout", async () => {
  const identity: Identity={kind:"USER",id:"00000000-0000-0000-0000-000000000123",emailVerified:false};
  vi.spyOn(serviceApi,"login").mockResolvedValue(identity);
  vi.spyOn(serviceApi,"logout").mockResolvedValue(undefined);
  vi.spyOn(serviceApi,"settings").mockResolvedValue({version:0,values:{theme:"system"}});
  window.history.replaceState({}, "", "/games");
  render(<ServiceApp />);
  fireEvent.click(await screen.findByRole("link",{name:"로그인"}));
  fireEvent.change(screen.getByLabelText("이메일 주소",{exact:true}),{target:{value:"member@example.invalid"}});
  fireEvent.change(screen.getByLabelText("비밀번호",{exact:true}),{target:{value:"synthetic long password 1234"}});
  fireEvent.click(screen.getByRole("button",{name:"로그인"}));
  const logout=await screen.findByRole("button",{name:"로그아웃"});
  expect(window.location.pathname).toBe("/games");
  fireEvent.click(logout);
  await screen.findByRole("link",{name:"로그인"});
  expect(serviceApi.logout).toHaveBeenCalledOnce();
  expect(window.location.pathname).toBe("/games");
  fireEvent.click(screen.getByRole("button",{name:"설정"}));
  await waitFor(() => expect(window.location.pathname).toBe("/login"));
});
