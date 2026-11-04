import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {ServiceApp} from "./ServiceApp";
import {ApiError,serviceApi,type Identity} from "./api";
import {CHAT_STORAGE_PREFIX,decodeHistory} from "./ChatHistory";
const owner:Identity={kind:"ADMIN",id:"11111111-1111-4111-8111-111111111111",emailVerified:false,authVersion:"3",adminGeneration:"7"};
const question="Youtopia는 어떤 프로젝트인가요?";
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
beforeEach(()=>{
 sessionStorage.clear();vi.stubGlobal("BroadcastChannel",undefined);vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED","false");
 vi.spyOn(serviceApi,"me").mockResolvedValue(owner);vi.spyOn(serviceApi,"logout").mockResolvedValue(undefined);
 vi.spyOn(serviceApi,"games").mockResolvedValue({content:[],page:{number:0,size:20,totalElements:0,totalPages:0},asOf:"2026-11-04T00:00:00Z",dataStatus:"EMPTY",freshness:"UNASSESSED"});
 vi.spyOn(serviceApi,"periods").mockResolvedValue({content:[],dataStatus:"EMPTY"});
 vi.spyOn(serviceApi,"classifications").mockResolvedValue({state:"EMPTY",options:[],meaning:""});vi.spyOn(serviceApi,"steamTags").mockResolvedValue({state:"EMPTY",options:[],meaning:""});
 vi.spyOn(serviceApi,"chatStatus").mockResolvedValue({available:true,state:"READY",message:"프로젝트 소개용 LLM입니다."});
 vi.spyOn(serviceApi,"chatAnswer").mockImplementation(async(questionId,requestId)=>({questionId,requestId,text:"보존할 첫 답변",replayed:false,basis:"GENERAL_METRIC_EXPLANATION_NO_GAME_DATA"}));
 window.history.replaceState({},"","/games");
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();sessionStorage.clear()});
async function open(){fireEvent.click(screen.getByRole("button",{name:"Youtopia 분석 도우미 열기"}));await waitFor(()=>expect(screen.getByRole("button",{name:question})).toBeEnabled());}
async function answer(){await open();fireEvent.click(screen.getByRole("button",{name:question}));await screen.findByText("보존할 첫 답변");}
function close(){fireEvent.click(screen.getByRole("button",{name:"분석 도우미 닫기"}));}
it("keeps previous turns through status checks, a new pending question and a failure",async()=>{
 render(<ServiceApp/>);await answer();fireEvent.click(screen.getByRole("button",{name:"상태 다시 확인"}));await waitFor(()=>expect(screen.getByRole("button",{name:question})).toBeEnabled());expect(screen.getByText("보존할 첫 답변")).toBeVisible();
 const next=deferred<Awaited<ReturnType<typeof serviceApi.chatAnswer>>>();vi.mocked(serviceApi.chatAnswer).mockReturnValueOnce(next.promise);
 fireEvent.click(screen.getByRole("button",{name:"앞으로 분석 모델과 RAG는 어떻게 연결할 예정인가요?"}));expect(screen.getByText("보존할 첫 답변")).toBeVisible();expect(screen.getByText("응답을 기다리고 있습니다.")).toBeVisible();
 await act(async()=>next.reject(new ApiError(503,"CHAT_PROVIDER_FAILURE")));expect(screen.getByText("보존할 첫 답변")).toBeVisible();expect(await screen.findByRole("alert")).toHaveTextContent("점검 중");expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(2);
});
it("retains but hides records during checking/unavailable, then restores the same verified scope",async()=>{
 render(<ServiceApp/>);await answer();const check=deferred<Identity>();vi.mocked(serviceApi.me).mockReturnValueOnce(check.promise);
 act(()=>window.dispatchEvent(new Event("focus")));expect(screen.queryByText("보존할 첫 답변")).toBeNull();expect(sessionStorage.length).toBeGreaterThan(0);
 await act(async()=>check.reject(new ApiError(503,"UNAVAILABLE")));expect(screen.queryByText("보존할 첫 답변")).toBeNull();
 act(()=>window.dispatchEvent(new Event("focus")));expect(await screen.findByText("보존할 첫 답변")).toBeVisible();expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(1);
});
it("restores closing, public navigation and same-tab reload without any answer replay",async()=>{
 let view=render(<ServiceApp/>);await answer();close();await open();expect(screen.getByText("보존할 첫 답변")).toBeVisible();close();
 fireEvent.click(screen.getByRole("link",{name:"Steam 차트"}));await screen.findByRole("heading",{name:"Steam 트렌드 차트"});await open();expect(screen.getByText("보존할 첫 답변")).toBeVisible();
 view.unmount();view=render(<ServiceApp/>);await open();expect(await screen.findByText("보존할 첫 답변")).toBeVisible();expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(1);
 const key=Object.keys(sessionStorage).find(k=>k.startsWith(CHAT_STORAGE_PREFIX))!;const stored=JSON.parse(sessionStorage.getItem(key)!);expect(stored.scope).toBe(`ADMIN:${owner.id}:3:7`);expect(Object.keys(stored.turns[0]).sort()).toEqual(["questionId","requestId","state","text"]);
});
it("deletes previous records on account change, administrator generation change and logout",async()=>{
 render(<ServiceApp/>);await answer();vi.mocked(serviceApi.me).mockResolvedValue({...owner,id:"22222222-2222-4222-8222-222222222222"});act(()=>window.dispatchEvent(new Event("focus")));await waitFor(()=>expect(screen.getByRole("button",{name:question})).toBeEnabled());expect(screen.queryByText("보존할 첫 답변")).toBeNull();expect(Object.keys(sessionStorage).some(k=>k.includes(owner.id))).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:question}));await screen.findByText("보존할 첫 답변");vi.mocked(serviceApi.me).mockResolvedValue({...owner,id:"22222222-2222-4222-8222-222222222222",adminGeneration:"8"});act(()=>window.dispatchEvent(new Event("focus")));await waitFor(()=>expect(screen.getByRole("button",{name:question})).toBeEnabled());expect(screen.queryByText("보존할 첫 답변")).toBeNull();
 close();fireEvent.click(screen.getByRole("button",{name:"로그아웃"}));await screen.findByRole("link",{name:"로그인"});expect(Object.keys(sessionStorage).filter(k=>k.startsWith(CHAT_STORAGE_PREFIX))).toHaveLength(0);expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(2);
});
it("never exposes stored owner records before authentication confirms the account",async()=>{
 const view=render(<ServiceApp/>);await answer();view.unmount();const check=deferred<Identity>();vi.mocked(serviceApi.me).mockReturnValueOnce(check.promise);render(<ServiceApp/>);fireEvent.click(screen.getByRole("button",{name:"Youtopia 분석 도우미 열기"}));expect(screen.queryByText("보존할 첫 답변")).toBeNull();await act(async()=>check.resolve({...owner,authVersion:"4"}));expect(screen.queryByText("보존할 첫 답변")).toBeNull();expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(1);
});
it("marks a reload-interrupted request unknown without creating or sending another answer request",async()=>{
 const pending=deferred<Awaited<ReturnType<typeof serviceApi.chatAnswer>>>();vi.mocked(serviceApi.chatAnswer).mockReturnValue(pending.promise);const view=render(<ServiceApp/>);await open();fireEvent.click(screen.getByRole("button",{name:question}));expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(1);view.unmount();render(<ServiceApp/>);fireEvent.click(screen.getByRole("button",{name:"Youtopia 분석 도우미 열기"}));expect(await screen.findByText(/처리 결과 미확인/)).toBeVisible();fireEvent.click(screen.getByRole("button",{name:"상태 다시 확인"}));await waitFor(()=>expect(screen.getByRole("button",{name:question})).toBeEnabled());expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(1);
});
it("keeps bounded memory history when sessionStorage is denied",async()=>{
 vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new Error("차단")});vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("차단")});render(<ServiceApp/>);await answer();close();await open();expect(screen.getByText("보존할 첫 답변")).toBeVisible();expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(1);
});
it("does not pull a reader away from older messages and offers an explicit latest button",async()=>{
 render(<ServiceApp/>);await answer();const scroll=screen.getByRole("region",{name:"분석 도우미 대화 기록"});Object.defineProperties(scroll,{scrollHeight:{value:1000,configurable:true},clientHeight:{value:200,configurable:true}});scroll.scrollTop=100;fireEvent.scroll(scroll);
 fireEvent.click(screen.getByRole("button",{name:question}));await waitFor(()=>expect(screen.getAllByText("보존할 첫 답변")).toHaveLength(2));expect(scroll.scrollTop).toBe(100);fireEvent.click(screen.getByRole("button",{name:"최신 답변으로"}));expect(scroll.scrollTop).toBe(1000);
});
it("rejects corrupt, oversized and extra-field stored histories",()=>{
 for(const raw of ["not json","x".repeat(64001),JSON.stringify({version:1,scope:"owner",turns:[],cookie:"forbidden"}),JSON.stringify({version:1,scope:"owner",turns:Array(13).fill({})})])expect(()=>decodeHistory(raw,"owner")).toThrow();
});
