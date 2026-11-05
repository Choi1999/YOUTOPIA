import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,describe,expect,it,vi} from "vitest";

import {AnalysisWorkspacePage} from "../../pages/analysis/AnalysisWorkspacePage";
import {AnalysisRepositoryProvider} from "../analysis/data/AnalysisRepositoryContext";
import {demoAnalysisRepository} from "../analysis/data/DemoAnalysisRepository";
import {planOfflineChannelMetadata} from "./workspaceChannelPreflight";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";

function show() {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <Routes><Route path="/analysis/youtube/workspace"
          element={<AnalysisWorkspacePage/>}/></Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>
  );
}
afterEach(()=>{
  vi.unstubAllGlobals();
  sessionStorage.clear();
  document.body.style.overflow="";
});

describe("UI-R04-I — operator preflight remains internal, not consumer-facing",()=>{
  it("retains offline planning and target registration without adding an operator dashboard",async()=>{
    const user=userEvent.setup();
    const fetchSpy=vi.fn(async()=>{throw Error("unexpected network");});
    vi.stubGlobal("fetch",fetchSpy);
    show();

    const url="https://www.youtube.com/@ExampleCreator";
    const plan=planOfflineChannelMetadata(addWorkspaceUrlTargets([],url).targets);
    expect(plan.estimatedUnits).toBe(1);
    expect(plan.networkExecuted).toBe(false);
    expect(plan.policyGate).toBe("POLICY_HOLD");

    await user.type(screen.getByRole("textbox",{name:/URL을 붙여넣으면/}),url);
    await user.click(screen.getByRole("button",{name:"URL 추가"}));

    // AD-2: full-screen graph is canonical; the duplicate card board is absent.
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();
    expect(screen.getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"}))
      .toBeInTheDocument();

    expect(screen.queryByRole("region",{name:"공개 채널 메타데이터 사전 검증"}))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("region",{name:"채널 실조회 준비 상태"}))
      .not.toBeInTheDocument();
    expect(screen.queryByText("POLICY_HOLD")).not.toBeInTheDocument();
    expect(screen.queryByText(/Y45-E\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"오프라인 요청 계획 보기"}))
      .not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    expect(screen.getByRole("combobox",{name:"영상 A"}))
      .toHaveValue("Ab0_-123xyz");
    expect(screen.getByRole("combobox",{name:"채널 B"}))
      .toHaveValue("UC"+"B".repeat(22));
  });

  it("keeps focus graph and target list free of operational quota/readiness panels",async()=>{
    const user=userEvent.setup();
    const fetchSpy=vi.fn(async()=>{throw Error("unexpected API");});
    vi.stubGlobal("fetch",fetchSpy);
    show();

    await user.type(screen.getByRole("textbox",{name:/URL을 붙여넣으면/}),
      "https://youtube.com/channel/UC"+"A".repeat(22));
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    // The workspace already starts in focus mode.
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    const list=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    expect(within(list).getByText(/채널 ID 형식 확인 · 실제 채널 미검증/))
      .toBeInTheDocument();

    expect(within(dialog).queryByText("POLICY_HOLD")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("BLOCKED")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("region",{name:"채널 실조회 준비 상태"}))
      .not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelectorAll('img[src^="https://yt3."]')).toHaveLength(0);
    await user.click(within(dialog).getByRole("button",{name:"집중 모드 종료"}));
    expect(screen.queryByRole("region",{name:"공개 채널 메타데이터 사전 검증"}))
      .not.toBeInTheDocument();
  });
});
