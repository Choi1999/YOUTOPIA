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
 vi.spyOn(serviceApi,"classifications").mockResolvedValue({state:"AVAILABLE",options:[{id:"DAILY_MOST_PLAYED|",label:"일간 최다 플레이 수집"}],meaning:"수집 분류"});
 vi.spyOn(serviceApi,"steamTags").mockResolvedValue({state:"AVAILABLE",options:[{tagId:"701",label:"스포츠",sourceLanguage:"korean",gameCount:2,lastSeenAt:"2026-09-28T00:00:00Z",tagLastSeenAt:"2026-09-28T00:00:00Z"},{tagId:"1254546",label:"축구",sourceLanguage:"korean",gameCount:1,lastSeenAt:"2026-09-28T00:00:00Z",tagLastSeenAt:"2026-09-28T00:00:00Z"}],meaning:"Steam 태그 전체가 공식 장르는 아니며, 활성 상태는 최근 수집 성공을 뜻하지 않습니다."});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
it("uses numeric tag identity and combines URL tag, classification, search, period and sorting",async()=>{
 window.history.replaceState({},"","/games?page=2&size=1&days=7&tagId=701&classification=DAILY_MOST_PLAYED%7C&connectionStatus=CONNECTED&sort=currentCcu&direction=DESC");render(<ServiceApp/>);
 const select=await screen.findByLabelText("Steam 태그");await waitFor(()=>expect(select).toBeEnabled());expect(select).toHaveValue("701");expect(screen.getByRole("option",{name:"스포츠"})).toHaveValue("701");
 expect(await screen.findByText(/활성 상태는 최근 수집 성공을 뜻하지 않습니다/)).toBeVisible();
 fireEvent.change(select,{target:{value:"1254546"}});await waitFor(()=>expect(new URLSearchParams(window.location.search).get("page")).toBe("0"));
 fireEvent.change(screen.getByLabelText("게임명 검색"),{target:{value:"Arena"}});fireEvent.click(screen.getByRole("button",{name:"검색"}));
 await waitFor(()=>expect(serviceApi.search).toHaveBeenCalled());expect(vi.mocked(serviceApi.search).mock.lastCall?.[0]).toMatchObject({q:"Arena",tagId:"1254546",classification:"DAILY_MOST_PLAYED|",days:7,connectionStatus:"CONNECTED",sort:"currentCcu",direction:"DESC",page:0,size:1});
 fireEvent.change(select,{target:{value:"ALL"}});await waitFor(()=>expect(new URLSearchParams(window.location.search).get("tagId")).toBe("ALL"));expect(new URLSearchParams(window.location.search).get("classification")).toBe("DAILY_MOST_PLAYED|");
});
it.each(["PENDING_CONTRACT","PERMISSION_UNCONFIRMED","EMPTY"])("keeps %s distinct from a failed or absent tag source",async state=>{
 vi.mocked(serviceApi.steamTags).mockResolvedValue({state,options:[],meaning:""});window.history.replaceState({},"","/games");render(<ServiceApp/>);
 await waitFor(()=>expect(screen.getByLabelText("Steam 태그")).toBeDisabled());expect(await screen.findByText(state==="EMPTY"?/조회 가능한 활성 Steam 태그 연결이 없습니다/:/Steam 태그 원천·권한을 확인할 수 없습니다/)).toBeVisible();expect(serviceApi.games).toHaveBeenCalled();
});
it("keeps a failed tag query visible and lets the selected tag be cleared",async()=>{
 vi.mocked(serviceApi.steamTags).mockRejectedValue(new ApiError(503,"DATA_SOURCE_ERROR"));window.history.replaceState({},"","/games?tagId=701&page=2");render(<ServiceApp/>);
 expect(await screen.findByText(/Steam 태그를 불러오지 못했습니다/)).toBeVisible();const select=screen.getByLabelText("Steam 태그");expect(select).toBeEnabled();fireEvent.change(select,{target:{value:"ALL"}});
 await waitFor(()=>expect(new URLSearchParams(window.location.search).get("tagId")).toBe("ALL"));expect(new URLSearchParams(window.location.search).get("page")).toBe("0");
});
