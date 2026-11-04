import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {ServiceApp} from "./ServiceApp";
import {ApiError,serviceApi} from "./api";
const admin={kind:"ADMIN" as const,id:"11111111-1111-4111-8111-111111111111",emailVerified:false,authVersion:"1",adminGeneration:"4"};
beforeEach(()=>{
 sessionStorage.clear();vi.stubGlobal("BroadcastChannel",undefined);vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED","false");
 vi.spyOn(serviceApi,"me").mockRejectedValue(new ApiError(401,"AUTHENTICATION_REQUIRED"));vi.spyOn(serviceApi,"login").mockResolvedValue(admin);vi.spyOn(serviceApi,"logout").mockResolvedValue(undefined);
 vi.spyOn(serviceApi,"games").mockResolvedValue({content:[],page:{number:0,size:20,totalElements:0,totalPages:0},asOf:"2026-11-04T00:00:00Z",dataStatus:"EMPTY",freshness:"UNASSESSED"});
 vi.spyOn(serviceApi,"classifications").mockResolvedValue({state:"EMPTY",options:[],meaning:""});vi.spyOn(serviceApi,"steamTags").mockResolvedValue({state:"EMPTY",options:[],meaning:""});vi.spyOn(serviceApi,"request").mockRejectedValue(new ApiError(503,"UNAVAILABLE"));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs()});
async function login(){fireEvent.change(await screen.findByLabelText("관리자 로그인명"),{target:{value:"synthetic-operator"}});fireEvent.change(screen.getByLabelText("비밀번호",{exact:true}),{target:{value:"synthetic password 1234"}});fireEvent.click(screen.getByRole("button",{name:"로그인"}));}
it("connects admin and public screens using the same session without a new identity request",async()=>{
 vi.mocked(serviceApi.me).mockResolvedValue(admin);window.history.replaceState({},"","/admin");render(<ServiceApp/>);fireEvent.click(await screen.findByRole("link",{name:"공개 게임 목록"}));await screen.findByRole("heading",{name:"관측 게임 탐색"});expect(screen.getByRole("button",{name:"Youtopia 분석 도우미 열기"})).toBeVisible();fireEvent.click(screen.getByRole("link",{name:"관리자 화면"}));await screen.findByRole("heading",{name:"관리자 · 서비스 이용 현황"});expect(serviceApi.me).toHaveBeenCalledTimes(1);expect(screen.getByRole("button",{name:"로그아웃"})).toBeVisible();
});
it("defaults admin login to games and retains the administrator ID input",async()=>{
 window.history.replaceState({},"","/login");render(<ServiceApp/>);fireEvent.click(await screen.findByRole("link",{name:"관리자 전용 로그인"}));expect(await screen.findByLabelText("관리자 로그인명")).toHaveAttribute("type","text");await login();await screen.findByRole("heading",{name:"관측 게임 탐색"});expect(window.location.pathname).toBe("/games");expect(serviceApi.login).toHaveBeenCalledWith("synthetic-operator","synthetic password 1234",true);expect(serviceApi.me).toHaveBeenCalledTimes(1);
});
it("preserves an explicit protected admin return path",async()=>{
 window.history.replaceState({},"","/admin/users?page=2");render(<ServiceApp/>);await login();await waitFor(()=>expect(window.location.pathname+window.location.search).toBe("/admin/users?page=2"));expect(screen.getByRole("link",{name:"공개 게임 목록"})).toBeVisible();
});
it.each(["/login","/signup","/admin/login"])("connects %s to public games without logging in",async path=>{
 window.history.replaceState({},"",path);render(<ServiceApp/>);fireEvent.click((await screen.findAllByRole("link",{name:/게임 목록으로/}))[0]);await screen.findByRole("heading",{name:"관측 게임 탐색"});expect(screen.queryByRole("link",{name:"관리자 화면"})).toBeNull();expect(screen.getByRole("link",{name:"로그인"})).toBeVisible();expect(serviceApi.login).not.toHaveBeenCalled();
});
