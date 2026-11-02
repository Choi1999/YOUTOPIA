import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { ApiError, serviceApi, type Publications } from "./api";
import { trackingLabel,metric } from "./components";
const empty={availability:"EMPTY",value:null,observedAt:null};
const detail={game:{gameId:"steam:570",steamAppId:570,name:"Synthetic <Arena>",developers:{availability:"EMPTY",value:[]},releaseAt:{availability:"UNAVAILABLE",value:null},steamConnection:"UNAVAILABLE",youtubeConnection:"PENDING_CONTRACT",currentCcu:{availability:"AVAILABLE",value:0,observedAt:"2026-09-30T00:00:00Z"},peak24h:empty,newYoutubeVideos:{availability:"PENDING_CONTRACT",value:null,observedAt:null},freshness:"UNASSESSED"},asOf:"2026-11-02T00:00:00Z",steamPreview:{appId:570,days:30,dataStatus:"EMPTY",freshnessStatus:"UNASSESSED",lastObservedAt:null,points:[]},youtubePreviewAvailability:"UNAVAILABLE"};
const publications:Publications={appId:570,days:30,asOf:detail.asOf,timezone:"Asia/Seoul",dataStatus:"AVAILABLE",coverage:"UNASSESSED",missingPublishedAt:1,selectedDate:"2026-11-02",points:[{date:"2026-11-01",observedVideos:1,inProgress:false},{date:"2026-11-02",observedVideos:1,inProgress:true}],videos:{content:[{videoId:"abcdefghijk",title:"<img src=x onerror=alert(1)>",publishedAt:"2026-11-02T00:00:00Z",firstObservedAt:"2026-11-02T00:01:00Z"}],page:{number:0,size:20,totalElements:1,hasNext:false}}};
beforeEach(()=>{
 vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED","false");vi.spyOn(serviceApi,"me").mockRejectedValue(new ApiError(401,"AUTHENTICATION_REQUIRED"));
 vi.spyOn(serviceApi,"detail").mockResolvedValue(detail);vi.spyOn(serviceApi,"publications").mockResolvedValue(publications);
 vi.spyOn(serviceApi,"games").mockResolvedValue({content:[],page:{number:0,size:20,totalElements:0,totalPages:0},asOf:detail.asOf,dataStatus:"EMPTY",freshness:"UNASSESSED"});
 vi.spyOn(serviceApi,"ccu").mockResolvedValue(detail.steamPreview);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
it("does not turn unknown tracking or source state into non-target or empty",()=>{
 expect(trackingLabel("CONNECTED")).toBe("현재 추적 활성");expect(trackingLabel("UNAVAILABLE")).toBe("현재 활성 표시 없음");for(const s of [null,undefined,"INVALID","UNKNOWN"])expect(trackingLabel(s)).toBe("추적 상태 미확인");
 expect(metric({...empty,availability:"PENDING_CONTRACT"})).toBe("상태 미확인");expect(metric({...empty,availability:"AVAILABLE"})).toBe("상태 미확인");expect(metric({availability:"AVAILABLE",value:0,observedAt:detail.asOf})).toBe("0");
});
it("shows old observed zero independently of tracking and an empty selected period",async()=>{
 window.history.replaceState({},"","/games/steam:570");render(<ServiceApp/>);
 expect(await screen.findByText(/현재 활성 표시 없음/)).toBeVisible();expect(screen.getByText("마지막 관측 CCU")).toBeVisible();expect(screen.getByText("0")).toBeVisible();expect(screen.getByText(/선택 기간 관측 없음/)).toBeVisible();expect(screen.queryByText("수집 대상 아님")).toBeNull();
});
it("selects publication dates and periods without video ID entry, and escapes stored titles",async()=>{
 window.history.replaceState({},"","/games/steam:570/youtube");render(<ServiceApp/>);
 const link=await screen.findByRole("link",{name:"<img src=x onerror=alert(1)>"});expect(link).toHaveAttribute("href","https://www.youtube.com/watch?v=abcdefghijk");expect(link).toHaveAttribute("rel","noopener noreferrer");expect(link.querySelector("img")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"2026-11-01 관측 영상 1개"}));await waitFor(()=>expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].get("date")).toBe("2026-11-01"));
 fireEvent.change(screen.getByLabelText("게시 영상 기간"),{target:{value:"7"}});await waitFor(()=>expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].get("days")).toBe("7"));expect(vi.mocked(serviceApi.publications).mock.lastCall?.[1].has("date")).toBe(false);expect(screen.queryByLabelText("YouTube 영상 ID")).toBeNull();
});
it.each(["PENDING_CONTRACT","PERMISSION_UNCONFIRMED"])("keeps %s separate from zero videos",async dataStatus=>{
 vi.mocked(serviceApi.publications).mockResolvedValue({...publications,dataStatus,missingPublishedAt:null,points:[],videos:null});window.history.replaceState({},"","/games/steam:570/youtube");render(<ServiceApp/>);expect(await screen.findByText(/영상 0개를 뜻하지 않습니다/)).toBeVisible();expect(screen.queryByRole("group",{name:"게시일별 영상 수 차트"})).toBeNull();
});
it("shows a failed publication query as an error and never as an empty count",async()=>{
 vi.mocked(serviceApi.publications).mockRejectedValue(new ApiError(503,"DATA_SOURCE_UNAVAILABLE"));window.history.replaceState({},"","/games/steam:570/youtube");render(<ServiceApp/>);expect(await screen.findByRole("alert")).toHaveTextContent("데이터를 불러오지 못했습니다");expect(screen.queryByText(/실제 게시량 0개/)).toBeNull();
});
it("opens a preparation-only modal, traps focus and restores the trigger without requests",async()=>{
 const requests=vi.spyOn(serviceApi,"request");window.history.replaceState({},"","/games/steam:570");render(<ServiceApp/>);await screen.findByRole("heading",{name:detail.game.name});const trigger=screen.getByRole("button",{name:"Youtopia 분석 도우미 열기"});fireEvent.click(trigger);
 const dialog=screen.getByRole("dialog",{name:"Youtopia 분석 도우미"});expect(dialog).toHaveAttribute("aria-modal","true");expect(dialog).toHaveTextContent(detail.game.name);expect(screen.getByRole("textbox",{name:"질문"})).toBeDisabled();expect(screen.getByRole("button",{name:"전송"})).toBeDisabled();const close=screen.getByRole("button",{name:"분석 도우미 닫기"});expect(close).toHaveFocus();fireEvent.keyDown(dialog,{key:"Tab",shiftKey:true});expect(close).toHaveFocus();fireEvent.keyDown(dialog,{key:"Escape"});expect(screen.queryByRole("dialog")).toBeNull();expect(trigger).toHaveFocus();expect(requests).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("link",{name:"← 게임 목록"}));await waitFor(()=>expect(window.location.pathname).toBe("/games"));fireEvent.click(trigger);expect(screen.getByRole("dialog")).toHaveTextContent("게임을 선택하지 않았습니다");expect(screen.getByRole("dialog")).not.toHaveTextContent(detail.game.name);
});
it.each(["/login","/signup","/admin/login"])("offers an explicit public path on %s",async path=>{
 window.history.replaceState({},"",path);render(<ServiceApp/>);const links=await screen.findAllByRole("link",{name:/게임 목록으로/});expect(links.every(x=>x.getAttribute("href")==="/games")).toBe(true);expect(screen.queryByRole("button",{name:"Youtopia 분석 도우미 열기"})).toBeNull();fireEvent.click(links.at(-1)!);await waitFor(()=>expect(window.location.pathname).toBe("/games"));
});
