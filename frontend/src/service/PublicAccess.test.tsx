import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { ApiError, serviceApi, type Identity, type Listing } from "./api";

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
