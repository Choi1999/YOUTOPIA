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

describe("UI-R04-H — integrated readiness without credentials or live calls",()=>{
  it("reveals evidence review after channel registration while keeping source gate and comparison",async()=>{
    const user=userEvent.setup();
    const fetchSpy=vi.fn(async()=>{throw Error("unexpected network")});
    vi.stubGlobal("fetch",fetchSpy);
    show();
    expect(screen.queryByRole("region",{name:"채널 실조회 준비 상태"})).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox",{name:/URL을 붙여넣으면/}),
      "https://youtube.com/@CreatorOne");
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    const review=screen.getByRole("region",{name:"채널 실조회 준비 상태"});
    expect(within(review).getByText("BLOCKED")).toBeInTheDocument();
    expect(within(review).getByText("0/8")).toBeInTheDocument();
    expect(screen.getByRole("combobox",{name:"영상 A"})).toHaveValue("Ab0_-123xyz");
    await user.click(within(review).getByRole("button",{name:"실조회 전 필수 증빙 8항목 보기"}));
    const required=within(review).getByRole("list",{name:"실조회 전 필수 증빙"});
    expect(within(required).getAllByRole("listitem")).toHaveLength(8);
    expect(within(review).getByText(/미지정 · 미승인/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the review read-only after opening focus graph and other UI controls",async()=>{
    const user=userEvent.setup();
    const fetchSpy=vi.fn(async()=>{throw Error("unexpected API request")});
    vi.stubGlobal("fetch",fetchSpy);
    show();
    const input=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(input,"https://youtube.com/channel/UC"+"A".repeat(22));
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    await user.click(screen.getByRole("button",{name:"전체 화면 집중 모드"}));
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(dialog).getByRole("button",{name:"집중 모드 종료"}));
    const review=screen.getByRole("region",{name:"채널 실조회 준비 상태"});
    expect(within(review).getByText("BLOCKED")).toBeInTheDocument();
    expect(within(review).queryByRole("textbox")).toBeNull();
    expect(within(review).queryByRole("button",{name:/API.*실행|권한.*허용/})).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
