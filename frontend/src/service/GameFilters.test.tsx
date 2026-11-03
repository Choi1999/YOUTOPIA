import { fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { ServiceApp } from "./ServiceApp";
import { ApiError,serviceApi } from "./api";
const listing={content:[],page:{number:2,size:1,totalElements:4,totalPages:4},asOf:"2026-11-04T00:00:00Z",dataStatus:"AVAILABLE",freshness:"UNASSESSED"};
beforeEach(()=>{
 vi.stubEnv("VITE_PRODUCT_EVENTS_ENABLED","false");
 vi.spyOn(serviceApi,"me").mockRejectedValue(new ApiError(401,"AUTHENTICATION_REQUIRED"));
 vi.spyOn(serviceApi,"games").mockResolvedValue(listing);
 vi.spyOn(serviceApi,"search").mockResolvedValue({...listing,page:{...listing.page,number:0}});
 vi.spyOn(serviceApi,"classifications").mockResolvedValue({state:"AVAILABLE",options:[{id:"DAILY_MOST_PLAYED|",label:"일간 최다 플레이 수집"},{id:"WEEKLY_TOP_SELLERS|",label:"주간 판매 순위 수집"}],meaning:"완료된 수집 이력이며 공식 게임 장르가 아닙니다."});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
it("restores URL classification and combines search, period and sorting while resetting the page",async()=>{
 window.history.replaceState({},"","/games?page=2&size=1&days=7&classification=DAILY_MOST_PLAYED%7C&connectionStatus=CONNECTED");render(<ServiceApp/>);
 const select=await screen.findByLabelText("수집 분류");await waitFor(()=>expect(select).toBeEnabled());expect(select).toHaveValue("DAILY_MOST_PLAYED|");
 fireEvent.change(select,{target:{value:"WEEKLY_TOP_SELLERS|"}});await waitFor(()=>expect(new URLSearchParams(window.location.search).get("page")).toBe("0"));
 fireEvent.change(screen.getByLabelText("정렬"),{target:{value:"lastObservedAt"}});await waitFor(()=>expect(new URLSearchParams(window.location.search).get("direction")).toBe("DESC"));
 fireEvent.change(screen.getByLabelText("게임명 검색"),{target:{value:"Arena"}});fireEvent.click(screen.getByRole("button",{name:"검색"}));
 await waitFor(()=>expect(serviceApi.search).toHaveBeenCalled());expect(vi.mocked(serviceApi.search).mock.lastCall?.[0]).toMatchObject({q:"Arena",classification:"WEEKLY_TOP_SELLERS|",days:7,connectionStatus:"CONNECTED",sort:"lastObservedAt",direction:"DESC",page:0,size:1});
});
it.each(["PENDING_CONTRACT","PERMISSION_UNCONFIRMED","EMPTY"])("keeps %s distinct from absence of official genres",async state=>{
 vi.mocked(serviceApi.classifications).mockResolvedValue({state,options:[],meaning:""});window.history.replaceState({},"","/games");render(<ServiceApp/>);
 await waitFor(()=>expect(screen.getByLabelText("수집 분류")).toBeDisabled());expect(await screen.findByText(state==="EMPTY"?/공식 장르가 없다는 뜻이 아닙니다/:/원천·권한을 확인할 수 없습니다/)).toBeVisible();expect(serviceApi.games).toHaveBeenCalled();
});
it("reports a classification query failure instead of presenting a successful empty source",async()=>{
 vi.mocked(serviceApi.classifications).mockRejectedValue(new ApiError(503,"DATA_SOURCE_ERROR"));window.history.replaceState({},"","/games");render(<ServiceApp/>);
 expect(await screen.findByText(/수집 분류를 불러오지 못했습니다/)).toBeVisible();expect(screen.getByLabelText("수집 분류")).toBeDisabled();
});
it("allows returning to all games when a selected classification becomes unavailable",async()=>{
 vi.mocked(serviceApi.classifications).mockResolvedValue({state:"PERMISSION_UNCONFIRMED",options:[],meaning:""});window.history.replaceState({},"","/games?classification=DAILY_MOST_PLAYED%7C&page=2");render(<ServiceApp/>);
 const select=await screen.findByLabelText("수집 분류");expect(select).toBeEnabled();fireEvent.change(select,{target:{value:"ALL"}});
 await waitFor(()=>expect(new URLSearchParams(window.location.search).get("classification")).toBe("ALL"));expect(new URLSearchParams(window.location.search).get("page")).toBe("0");
});
