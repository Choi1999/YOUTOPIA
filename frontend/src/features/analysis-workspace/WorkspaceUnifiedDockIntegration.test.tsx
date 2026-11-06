import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,describe,expect,it,vi} from "vitest";
import {AnalysisRepositoryProvider} from "../analysis/data/AnalysisRepositoryContext";
import {demoAnalysisRepository} from "../analysis/data/DemoAnalysisRepository";
import {AnalysisWorkspacePage} from "../../pages/analysis/AnalysisWorkspacePage";
import {FOCUS_DOCK_LAYOUT_KEY} from "./workspaceFocusLayout";

function show() {
  render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <Routes>
          <Route path="/analysis/youtube/workspace"
            element={<AnalysisWorkspacePage/>}/>
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}
afterEach(()=>{
  sessionStorage.clear();
  document.body.style.overflow="";
  vi.unstubAllGlobals();
});

describe("UI-R04-AD-1/2 — graph, focus list and fallback cards share dock state",()=>{
  it("uses one selection across list, graph and fallback collection after focus exit",async()=>{
    const user=userEvent.setup();
    const fetcher=vi.fn();
    vi.stubGlobal("fetch",fetcher);
    show();
    let dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();

    const input=within(dialog).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    await user.type(input,"https://youtu.be/Cb0_-123xyz");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));

    const canvas=within(dialog).getByRole("region",{
      name:"URL 등록 대상 전체 화면 탐색",
    });
    expect(within(dialog).getByRole("heading",{name:"영상 제목 미확인"}))
      .toBeInTheDocument();
    expect(within(canvas).getByRole("button",{
      name:"등록된 영상 Cb0_-123xyz 선택",
    })).toHaveAttribute("aria-pressed","true");

    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    const list=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    await user.click(within(list).getByRole("button",{
      name:"대상 선택 영상 Ab0_-123xyz",
    }));
    expect(within(canvas).getByRole("button",{
      name:"등록된 영상 Ab0_-123xyz 선택",
    })).toHaveAttribute("aria-pressed","true");

    await user.click(within(dialog).getByRole("button",{name:"집중 모드 종료"}));
    expect(screen.queryByRole("dialog",{name:"그래프 집중 탐색"}))
      .not.toBeInTheDocument();

    const board=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(within(board).getAllByRole("article")).toHaveLength(2);
    expect(within(board).queryByRole("button",{name:"패널 확장"}))
      .not.toBeInTheDocument();
    expect(board.querySelector(".workspace-url-board__expanded"))
      .not.toBeInTheDocument();

    const videoCard=within(board).getByRole("article",{
      name:"영상 등록 대상 Cb0_-123xyz",
    });
    await user.click(within(videoCard).getByRole("button",{
      name:"그래프에서 보기",
    }));
    dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();
    expect(within(dialog).getByText("등록 식별자: Cb0_-123xyz"))
      .toBeInTheDocument();
    expect(within(dialog).getByRole("complementary",{
      name:"도킹 대상 목록",
    })).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("removes a selected target without leaving phantom detail and keeps another registered target",async()=>{
    const user=userEvent.setup();
    show();
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const input=within(dialog).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    await user.type(input,"https://www.youtube.com/@samplecreator");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));

    expect(within(dialog).getByText("등록 식별자: @samplecreator"))
      .toBeInTheDocument();
    await user.click(within(dialog).getByText("대상 관리"));
    await user.click(within(dialog).getByRole("button",{name:"이 등록 대상 제거"}));
    expect(within(dialog).queryByText("등록 식별자: @samplecreator"))
      .not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    const dock=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    expect(within(dock).queryByRole("button",{
      name:"대상 선택 채널 핸들 @samplecreator",
    })).not.toBeInTheDocument();
    expect(within(dock).getByRole("button",{
      name:"대상 선택 영상 Ab0_-123xyz",
    })).toBeInTheDocument();

    await user.click(within(dock).getByRole("button",{name:"등록 목록 비우기"}));
    expect(within(dialog).getByText("영상 또는 채널을 추가하세요"))
      .toBeInTheDocument();
    expect(within(dialog).queryByText("등록 식별자: Ab0_-123xyz"))
      .not.toBeInTheDocument();
  });

  it("keeps dock widths and selected target while exiting and reopening fullscreen",async()=>{
    Object.defineProperty(window,"innerWidth",{configurable:true,value:1440});
    const user=userEvent.setup();
    show();
    let dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const input=within(dialog).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    const handle=within(dialog).getByRole("separator",{name:"대상 목록 너비 조절"});
    handle.focus();
    await user.keyboard("{ArrowRight}");
    const saved=sessionStorage.getItem(FOCUS_DOCK_LAYOUT_KEY);
    expect(saved).toContain('"version":1');
    await user.click(within(dialog).getByRole("button",{name:"집중 모드 종료"}));
    await user.click(screen.getByRole("button",{name:"전체 화면 집중 모드"}));
    dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    expect(within(dialog).getByText("등록 식별자: Ab0_-123xyz"))
      .toBeInTheDocument();
    expect(dialog.querySelector(".workspace-focus__body"))
      .toHaveAttribute("data-layout","both");
    expect(sessionStorage.getItem(FOCUS_DOCK_LAYOUT_KEY)).toBe(saved);
    expect(dialog.querySelector(".workspace-focus__body")?.getAttribute("style"))
      .toContain("--focus-list-width:");
  });
});
