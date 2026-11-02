import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { ApiError, serviceApi } from "./api";
const owner="11111111-1111-4111-8111-111111111111";
beforeEach(()=>{
 vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED","false");
 vi.spyOn(serviceApi,"me").mockResolvedValue({kind:"ADMIN",id:owner,emailVerified:false});
 vi.spyOn(serviceApi,"games").mockResolvedValue({content:[],page:{number:0,size:20,totalElements:0,totalPages:0},asOf:"2026-11-02T15:00:00Z",dataStatus:"EMPTY",freshness:"UNASSESSED"});
 vi.spyOn(serviceApi,"chatStatus").mockResolvedValue({available:true,state:"READY",message:"일반적인 지표 설명을 제공합니다."});
 vi.spyOn(serviceApi,"chatAnswer").mockImplementation(async(questionId,requestId)=>({questionId,requestId,text:"일반 설명입니다.",replayed:false,basis:"GENERAL_METRIC_EXPLANATION_NO_GAME_DATA"}));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
async function open(){window.history.replaceState({},"","/games");render(<ServiceApp/>);fireEvent.click(screen.getByRole("button",{name:"Youtopia 분석 도우미 열기"}));await waitFor(()=>expect(screen.getByRole("button",{name:"CCU는 무엇인가요?"})).toBeEnabled());}
it("sends only a fixed question and UUID with current account context, and renders plain text safely",async()=>{
 vi.mocked(serviceApi.chatAnswer).mockImplementation(async(questionId,requestId)=>({questionId,requestId,text:"<img src=x onerror=alert(1)>\n일반 설명",replayed:false,basis:"GENERAL_METRIC_EXPLANATION_NO_GAME_DATA"}));await open();
 expect(screen.getByText("LLM 응답 시연입니다. 실제 게임 데이터 조회와 RAG는 아직 연결되지 않았습니다.")).toBeVisible();expect(screen.queryByRole("textbox")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"CCU는 무엇인가요?"}));const answer=await screen.findByRole("status",{name:"LLM 일반 설명 응답"});expect(answer).toHaveTextContent("<img src=x onerror=alert(1)>");expect(answer.querySelector("img")).toBeNull();
 const args=vi.mocked(serviceApi.chatAnswer).mock.lastCall!;expect(args[0]).toBe("CCU_BASICS");expect(args[1]).toMatch(/^[0-9a-f-]{36}$/);expect(args[2]).toBe(owner);expect(args).toHaveLength(4);
});
it("keeps keyless maintenance disabled without making an answer request",async()=>{
 vi.mocked(serviceApi.chatStatus).mockResolvedValue({available:false,state:"MAINTENANCE",message:"현재 점검 중입니다. 잠시 후 다시 이용해 주세요."});window.history.replaceState({},"","/games");render(<ServiceApp/>);fireEvent.click(screen.getByRole("button",{name:"Youtopia 분석 도우미 열기"}));expect(await screen.findByText("현재 점검 중입니다. 잠시 후 다시 이용해 주세요.")).toBeVisible();expect(screen.getByRole("button",{name:"CCU는 무엇인가요?"})).toBeDisabled();expect(serviceApi.chatAnswer).not.toHaveBeenCalled();
});
it.each([[401,"세션이 만료"],[403,"호출 권한"],[429,"호출 한도"],[503,"현재 점검 중"],[0,"현재 점검 중"]])("separates status %s and never displays a failed call as an answer",async(status,expected)=>{
 vi.mocked(serviceApi.chatAnswer).mockRejectedValue(new ApiError(status,"CHAT_PROVIDER_QUOTA"));await open();fireEvent.click(screen.getByRole("button",{name:"게임 관련 영상 게시량은 어떻게 해석하나요?"}));expect(await screen.findByRole("alert")).toHaveTextContent(expected);expect(screen.queryByRole("status",{name:"LLM 일반 설명 응답"})).toBeNull();expect(screen.getByRole("button",{name:"CCU는 무엇인가요?"})).toBeDisabled();
});
it("reuses a request ID after an ambiguous client failure and never auto retries",async()=>{
 vi.mocked(serviceApi.chatAnswer).mockRejectedValue(new ApiError(0,"REQUEST_TIMEOUT"));await open();fireEvent.click(screen.getByRole("button",{name:"CCU는 무엇인가요?"}));await screen.findByRole("alert");expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole("button",{name:"상태 다시 확인"}));await waitFor(()=>expect(screen.getByRole("button",{name:"CCU는 무엇인가요?"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"CCU는 무엇인가요?"}));await waitFor(()=>expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(2));expect(vi.mocked(serviceApi.chatAnswer).mock.calls[0][1]).toBe(vi.mocked(serviceApi.chatAnswer).mock.calls[1][1]);
});
it("ignores double clicks while an answer is pending and clears it on session loss",async()=>{
 let done!:(value:Awaited<ReturnType<typeof serviceApi.chatAnswer>>)=>void;vi.mocked(serviceApi.chatAnswer).mockImplementation(()=>new Promise(resolve=>{done=resolve}));await open();
 const button=screen.getByRole("button",{name:"CCU는 무엇인가요?"});fireEvent.click(button);fireEvent.click(button);expect(serviceApi.chatAnswer).toHaveBeenCalledTimes(1);
 vi.mocked(serviceApi.me).mockRejectedValue(new ApiError(401,"AUTHENTICATION_REQUIRED"));window.dispatchEvent(new Event("youtopia-session-changed"));await screen.findByRole("link",{name:"관리자 로그인"});
 const args=vi.mocked(serviceApi.chatAnswer).mock.calls[0];done({questionId:args[0],requestId:args[1],text:"stale answer",replayed:false,basis:"GENERAL_METRIC_EXPLANATION_NO_GAME_DATA"});await waitFor(()=>expect(screen.queryByText("stale answer")).toBeNull());expect(button).toBeDisabled();
});
