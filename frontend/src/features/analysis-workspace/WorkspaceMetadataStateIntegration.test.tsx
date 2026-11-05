import {render,screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {AnalysisWorkspacePage} from "../../pages/analysis/AnalysisWorkspacePage";
import {AnalysisRepositoryProvider} from "../analysis/data/AnalysisRepositoryContext";
import {demoAnalysisRepository} from "../analysis/data/DemoAnalysisRepository";
import {STATE_SCHEMA} from "./workspaceMetadataConsumerState";
import {WORKSPACE_TARGET_PRESENTATION_KEY} from "./workspaceTargetPresentation";

const VIDEO="Ab0_-123xyz";
function show() {
  render(<AnalysisRepositoryProvider repository={demoAnalysisRepository}>
    <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
      <Routes><Route path="/analysis/youtube/workspace"
        element={<AnalysisWorkspacePage/>}/></Routes>
    </MemoryRouter>
  </AnalysisRepositoryProvider>);
}

function response(input:string) {
  const url=new URL(input,"http://localhost");
  const scenario=url.searchParams.get("scenario")??"READY";
  const video=url.pathname.includes("/videos/");
  const kind=video?"VIDEO":url.pathname.includes("/handles/")
    ?"CHANNEL_HANDLE":"CHANNEL";
  const id=decodeURIComponent(url.pathname.split("/").at(-1)!);
  const now=Date.now();
  const has= scenario==="READY" || scenario==="STALE";
  const obj={
    schema:STATE_SCHEMA,status:scenario,source:"LOCAL_SYNTHETIC_ONLY",
    kind,requestedId:id,
    title:has?(video?"합성 영상 제목 · ":"합성 채널 이름 · ")+id:null,
    channelName:has&&video?"합성 채널 안내 · 실제 소속 미확인":null,
    artwork:has?(video?"VIDEO_PLACEHOLDER":"CHANNEL_PLACEHOLDER"):null,
    channelId:null,associationVerified:false,
    observedAt:has?(scenario==="STALE"?now-120_000:now):0,
    expiresAt:has?(scenario==="STALE"?now-60_000:now+60_000):0,
    failureCode:scenario==="READY"?null:scenario==="NOT_FOUND"?"FIXTURE_NOT_FOUND":
      scenario==="FAILED"?"FIXTURE_UNAVAILABLE":"FIXTURE_EXPIRED",
    sourceAuthenticated:false,providerRequestsMade:0,
    consumerPublicationAuthorized:false,
  };
  return new Response(JSON.stringify(obj),{
    status:scenario==="NOT_FOUND"?404:scenario==="FAILED"?503:200,
    headers:{"Content-Type":"application/json","X-YOUTOPIA-Synthetic":"test-only",
      "Cache-Control":"no-store"},
  });
}
beforeEach(()=>{
  vi.stubEnv("DEV",true);
  vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP","enabled");
  vi.stubEnv("VITE_R04AA_METADATA_STATES","enabled");
});
afterEach(()=>{
  vi.unstubAllEnvs();vi.unstubAllGlobals();
  document.body.style.overflow="";
  sessionStorage.clear();
});

describe("UI-R04-AA — end-user graph state controls, synthetic only",()=>{
  it("default remains offline; READY opt-in updates node/card/detail and manual aliases",async()=>{
    const user=userEvent.setup();
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>response(String(input)));
    vi.stubGlobal("fetch",fetcher);
    show();
    const focus=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const input=within(focus).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://youtu.be/"+VIDEO);
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    expect(fetcher).not.toHaveBeenCalled();
    const canvas=within(focus).getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    expect(within(canvas).getByText("영상 제목 미확인")).toBeInTheDocument();
    await user.click(within(focus).getByRole("button",{name:"메타데이터 상태 QA"}));
    await waitFor(()=>expect(
      within(canvas).getByText("합성 영상 제목 · "+VIDEO)
    ).toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain("/synthetic-state/videos/"+VIDEO);
    expect(canvas.querySelector('[data-metadata-status="READY"]')).toBeInTheDocument();
    expect(focus.querySelectorAll('img[src]')).toHaveLength(0);
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY)).toBeNull();

    await user.click(within(focus).getByRole("button",{name:"메타데이터 새로고침"}));
    await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
    expect(canvas.querySelector('[data-metadata-status="READY"]')).toBeInTheDocument();

    const editor=within(focus).getByRole("textbox",{name:"표시 제목 (직접 입력)"});
    await user.type(editor,"내가 정한 별칭");
    await user.click(within(focus).getByRole("button",{name:"표시 제목 저장"}));
    expect(within(canvas).getByText("내가 정한 별칭")).toBeInTheDocument();
    const saved=sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY);
    expect(saved).toContain("내가 정한 별칭");
    expect(saved).not.toContain("합성 영상 제목");
    await user.click(within(focus).getByRole("button",{name:"상태 QA 끄기"}));
    expect(within(canvas).getByText("내가 정한 별칭")).toBeInTheDocument();
  });

  it("NOT_FOUND, FAILED and STALE do not publish synthetic title or image",async()=>{
    const user=userEvent.setup();
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>response(String(input)));
    vi.stubGlobal("fetch",fetcher);
    show();
    const focus=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.type(within(focus).getByRole("textbox",{name:"URL 추가 입력"}),
      "https://youtu.be/"+VIDEO);
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    await user.click(within(focus).getByRole("button",{name:"메타데이터 상태 QA"}));
    const canvas=within(focus).getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    await waitFor(()=>expect(canvas.querySelector('[data-metadata-status="READY"]'))
      .toBeInTheDocument());

    for (const status of ["NOT_FOUND","FAILED","STALE"] as const) {
      await user.selectOptions(within(focus).getByRole("combobox",{
        name:"메타데이터 QA 시나리오",
      }),status);
      await waitFor(()=>expect(canvas.querySelector(
        '[data-metadata-status="'+status+'"]')).toBeInTheDocument());
      expect(within(canvas).getByText("영상 제목 미확인")).toBeInTheDocument();
      expect(focus.querySelectorAll('img[src]')).toHaveLength(0);
      expect(canvas.querySelector('[data-preview="synthetic"]')).not.toBeInTheDocument();
    }
    expect(fetcher).toHaveBeenCalledTimes(4);
    await user.selectOptions(within(focus).getByRole("combobox",{
      name:"메타데이터 QA 시나리오",
    }),"READY");
    await waitFor(()=>expect(canvas.querySelector('[data-metadata-status="READY"]'))
      .toBeInTheDocument());
    expect(within(canvas).getByText("합성 영상 제목 · "+VIDEO)).toBeInTheDocument();
  });

  it("does not introduce verified channel identity or a relationship from matching synthetic fixtures",async()=>{
    const user=userEvent.setup();
    vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL)=>response(String(input))));
    show();
    const focus=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const input=within(focus).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://youtu.be/"+VIDEO);
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    await user.type(input,"https://youtube.com/@samplecreator");
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    await user.click(within(focus).getByRole("button",{name:"메타데이터 상태 QA"}));
    const canvas=within(focus).getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    await waitFor(()=>expect(within(canvas).getByText("합성 채널 이름 · @samplecreator"))
      .toBeInTheDocument());
    expect(focus.querySelectorAll('[data-channel-profile="READY"]')).toHaveLength(0);
    expect(focus.querySelectorAll('img[src]')).toHaveLength(0);
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY)).toBeNull();
  });
});
