import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,describe,expect,it} from "vitest";
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
afterEach(()=>{sessionStorage.clear();document.body.style.overflow="";});

describe("UI-R04-F — channel registration identity across UI surfaces",()=>{
  it("shows unverified handle and ID statuses, without channel image requests",async()=>{
    const user=userEvent.setup();
    show();
    const input=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(input,[
      "https://www.youtube.com/@Example.Channel",
      "https://www.youtube.com/channel/UC"+"A".repeat(22),
    ].join(" "));
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    // AD-2: while fullscreen is open, there is only the canonical dock list.
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"영상 이미지 미리보기 켜기"}));
    expect(document.querySelectorAll('img[src^="https://yt3."]')).toHaveLength(0);
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    const list=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    expect(within(list).getByText("핸들 등록 · 채널 ID 해석 대기")).toBeInTheDocument();
    expect(within(list).getByText("채널 ID 형식 확인 · 실제 채널 미검증"))
      .toBeInTheDocument();
    await user.click(within(list).getByRole("button",{
      name:"대상 선택 채널 핸들 @example.channel",
    }));
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(within(detail).getByText("핸들 등록 · 채널 ID 해석 대기"))
      .toBeInTheDocument();
    expect(within(detail).getByText(/채널 정보가 아직 제공되지 않습니다/))
      .toBeInTheDocument();
    expect(dialog.querySelectorAll('img[src^="https://yt3."]')).toHaveLength(0);
  });
});
