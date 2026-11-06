import { render,screen,within,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter,Routes,Route } from "react-router-dom";
import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { AnalysisWorkspacePage } from "../../pages/analysis/AnalysisWorkspacePage";
import { OFFLINE_CONSUMER_ROUTE } from "./workspaceOfflineConsumerDenial";

const video="Ab0_-123xyz";
function mount(diagnostics:boolean) {
  const path=diagnostics?"/analysis/youtube/workspace/diagnostics":
    "/analysis/youtube/workspace";
  render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={path}
          element={<AnalysisWorkspacePage diagnosticsMode={diagnostics}/>}/></Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>);
}

async function add() {
  const user=userEvent.setup();
  const modal=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
  await user.type(within(modal).getByRole("textbox",{name:"URL 추가 입력"}),
    "https://youtu.be/"+video);
  await user.click(within(modal).getByRole("button",{name:"추가하기"}));
  return {user,modal};
}

beforeEach(()=>{
  vi.stubEnv("DEV",true);
  vi.stubEnv("VITE_R04AC_DIAGNOSTICS","enabled");
  vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP","enabled");
  vi.stubEnv("VITE_R04AG_CONSUMER_DENIAL","enabled");
});
afterEach(()=>{
  vi.unstubAllEnvs();vi.unstubAllGlobals();
  sessionStorage.clear();
  document.body.style.overflow="";
});

describe("UI-R04-AG — denied Spring consumer in DEV diagnostics only",()=>{
  it("user-facing workspace never mounts denial controls or runs a provider query",async()=>{
    const fetcher=vi.fn(async()=>new Response("unexpected",{status:500}));
    vi.stubGlobal("fetch",fetcher);
    mount(false);
    const {modal}=await add();
    expect(within(modal).queryByRole("button",{name:"AF 정책 차단 QA"}))
      .not.toBeInTheDocument();
    expect(within(modal).getByRole("heading",{name:"영상 제목 미확인"}))
      .toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("explicit DEV-only opt-in shows FAILED on denied HTTP; no metadata is published",async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      type:"urn:youtopia:problem:metadata-policy-hold",
      title:"Metadata unavailable",status:503,
      code:"METADATA_POLICY_HOLD",detail:"Metadata is unavailable.",
      instance:OFFLINE_CONSUMER_ROUTE,
    }),{
      status:503,headers:{
        "content-type":"application/problem+json","cache-control":"no-store",
      },
    }));
    vi.stubGlobal("fetch",fetcher);
    mount(true);
    const {user,modal}=await add();
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(within(modal).getByRole("button",{name:"개발자 진단 열기"}));
    await user.click(within(modal).getByRole("button",{name:"AF 정책 차단 QA"}));
    await waitFor(()=>expect(modal.querySelector('[data-provider-status="FAILED"]'))
      .toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe(
      OFFLINE_CONSUMER_ROUTE+"/videos/"+video);
    expect(within(modal).getByRole("heading",{name:"영상 제목 미확인"}))
      .toBeInTheDocument();
    expect(within(modal).getByText("메타데이터 조회 실패 · 기존 정보를 추정하지 않음"))
      .toBeInTheDocument();
    expect(modal.querySelector('[data-provider-status="READY"]'))
      .not.toBeInTheDocument();
    expect(modal.querySelector("img[src]")).not.toBeInTheDocument();

    await user.click(within(modal).getByRole("button",{name:"AF 정책 차단 QA 끄기"}));
    expect(modal.querySelector('[data-provider-status="FAILED"]'))
      .not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
