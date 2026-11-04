import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,describe,expect,it,vi} from "vitest";

import {AnalysisWorkspacePage} from "../../pages/analysis/AnalysisWorkspacePage";
import {AnalysisRepositoryProvider} from "../analysis/data/AnalysisRepositoryContext";
import {demoAnalysisRepository} from "../analysis/data/DemoAnalysisRepository";

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
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();document.body.style.overflow="";});

describe("UI-R04-G — workspace preflight integration and policy hold",()=>{
  it("plans channel metadata only after registration and never invokes network",async()=>{
    const user=userEvent.setup();
    const fetchSpy=vi.fn(async()=>{throw Error("unexpected network");});
    vi.stubGlobal("fetch",fetchSpy);
    show();
    expect(screen.queryByRole("region",{name:"공개 채널 메타데이터 사전 검증"}))
      .not.toBeInTheDocument();
    const urlInput=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(urlInput,"https://www.youtube.com/@ExampleCreator");
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    const report=screen.getByRole("region",{name:"공개 채널 메타데이터 사전 검증"});
    expect(within(report).getByText("1단위")).toBeInTheDocument();
    expect(within(report).getByRole("status")).toHaveTextContent("POLICY_HOLD");
    expect(within(report).getByText("0건")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    // Channel registration does not alter the existing 2-slot demo fixture.
    expect(screen.getByRole("combobox",{name:"영상 A"}))
      .toHaveValue("Ab0_-123xyz");
    expect(screen.getByRole("combobox",{name:"채널 B"}))
      .toHaveValue("UC"+"B".repeat(22));
    await user.click(within(report).getByRole("button",{name:"오프라인 요청 계획 보기"}));
    expect(within(report).getByText(/channels.list · forHandle/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves offline hold in focus mode after URL and simulated thumbnails",async()=>{
    const user=userEvent.setup();
    const fetchSpy=vi.fn(async()=>{throw Error("unexpected API");});
    vi.stubGlobal("fetch",fetchSpy);
    show();
    const urlInput=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(urlInput,"https://youtube.com/channel/UC"+"A".repeat(22));
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    await user.click(screen.getByRole("button",{name:"전체 화면 집중 모드"}));
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    const list=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    expect(within(list).getByText(/채널 ID 형식 확인 · 실제 채널 미검증/))
      .toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelectorAll('img[src^="https://yt3."]')).toHaveLength(0);
    await user.click(within(dialog).getByRole("button",{name:"집중 모드 종료"}));
    expect(screen.getByRole("region",{name:"공개 채널 메타데이터 사전 검증"}))
      .toBeInTheDocument();
  });
});
