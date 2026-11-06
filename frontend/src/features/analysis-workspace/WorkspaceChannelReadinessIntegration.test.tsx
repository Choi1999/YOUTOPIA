import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,describe,expect,it,vi} from "vitest";
import {AnalysisWorkspacePage} from "../../pages/analysis/AnalysisWorkspacePage";
import {AnalysisRepositoryProvider} from "../analysis/data/AnalysisRepositoryContext";
import {demoAnalysisRepository} from "../analysis/data/DemoAnalysisRepository";
import {assessChannelReadiness} from "./workspaceChannelReadiness";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";

function show() {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <Routes>
          <Route path="/analysis/youtube/workspace" element={<AnalysisWorkspacePage/>}/>
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>
  );
}
afterEach(()=>{
  sessionStorage.clear();
  document.body.style.overflow="";
  vi.unstubAllGlobals();
});

describe("UI-R04-I — repository audit retained without consumer panel exposure",()=>{
  it("preserves fail-closed readiness internally while omitting the eight-gate audit UI",async()=>{
    const user=userEvent.setup();
    const fetchSpy=vi.fn(async()=>{throw Error("unexpected network");});
    vi.stubGlobal("fetch",fetchSpy);
    const url="https://youtube.com/@CreatorOne";
    const result=assessChannelReadiness(addWorkspaceUrlTargets([],url).targets);
    expect(result).toMatchObject({
      decision:"BLOCKED",policyGate:"POLICY_HOLD",
      requiredGates:8,verifiedGates:0,liveCallsAuthorized:false,
      networkExecuted:false,
    });

    show();
    await user.type(screen.getByRole("textbox",{name:/URL을 붙여넣으면/}),url);
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    // AD-2: avoid a second registered-target collection during fullscreen.
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();

    expect(screen.queryByRole("region",{name:"채널 실조회 준비 상태"}))
      .not.toBeInTheDocument();
    expect(screen.queryByText("0/8")).not.toBeInTheDocument();
    // BLOCKED remains a legitimate analysis-status filter option in the
    // consumer catalogue; only the *operator readiness dashboard* is gone.
    expect(screen.queryByRole("heading",{name:"실조회 준비 상태"}))
      .not.toBeInTheDocument();
    expect(screen.queryByText("POLICY_HOLD")).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/필수 증빙 8항목/}))
      .not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox",{name:"영상 A"}))
      .toHaveValue("Ab0_-123xyz");
  });

  it("reveals analysis sample scope only on explicit user request, not policy internals",async()=>{
    const user=userEvent.setup();
    show();
    const scope=screen.getByRole("region",{name:"데이터 범위"});
    const expand=within(scope).getByRole("button",{name:"데이터 범위 보기"});
    expect(expand).toHaveAttribute("aria-expanded","false");
    expect(screen.queryByRole("region",{name:"영상 근거 상세"}))
      .not.toBeInTheDocument();

    await user.click(expand);
    expect(within(scope).getByRole("button",{name:"데이터 범위 접기"}))
      .toHaveAttribute("aria-expanded","true");
    const video=screen.getByRole("region",{name:"영상 근거 상세"});
    expect(await within(video).findByText("120건")).toBeInTheDocument();
    expect(within(scope).queryByText("POLICY_HOLD")).not.toBeInTheDocument();

    await user.click(within(scope).getByRole("button",{name:"데이터 범위 접기"}));
    expect(screen.queryByRole("region",{name:"영상 근거 상세"}))
      .not.toBeInTheDocument();
    expect(screen.getByRole("region",{name:"통합 분석 요약"}))
      .toBeInTheDocument();
  });
});
