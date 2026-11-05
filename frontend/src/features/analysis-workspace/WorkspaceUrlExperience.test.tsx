import {render,screen,within,fireEvent} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Routes,Route} from "react-router-dom";
import {afterEach,describe,expect,it} from "vitest";
import {AnalysisRepositoryProvider} from "../analysis/data/AnalysisRepositoryContext";
import {demoAnalysisRepository} from "../analysis/data/DemoAnalysisRepository";
import {AnalysisWorkspacePage} from "../../pages/analysis/AnalysisWorkspacePage";
import {WORKSPACE_URL_TARGETS_KEY} from "./workspaceUrlTargets";
import {ANALYSIS_WORKSPACE_SESSION_KEY} from "./analysisWorkspaceSession";

function show() {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <Routes><Route path="/analysis/youtube/workspace"
          element={<AnalysisWorkspacePage/>}/></Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}
afterEach(()=>{
  sessionStorage.clear();
  document.body.style.overflow="";
});

describe("UI-R04B/AD-2 — single visible registered-target collection",()=>{
  it("registers URLs into fullscreen graph; compact collection appears only after exit",async()=>{
    const user=userEvent.setup();
    show();
    expect(screen.getByRole("heading",{name:"통합 분석 워크스페이스"}))
      .toBeInTheDocument();
    expect(screen.queryByRole("region",{name:"URL 등록 대상 전체 화면 탐색"}))
      .not.toBeInTheDocument();

    const url=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(url,"https://youtu.be/Ab0_-123xyz");
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    let canvas=screen.getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    expect(within(canvas).getByRole("button",{name:/등록된 영상 Ab0_-123xyz 선택/}))
      .toBeInTheDocument();
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();
    expect(screen.getByRole("combobox",{name:"영상 A"})).toHaveValue("Ab0_-123xyz");
    expect(JSON.parse(sessionStorage.getItem(WORKSPACE_URL_TARGETS_KEY)!).targets)
      .toHaveLength(1);
    expect(sessionStorage.getItem(ANALYSIS_WORKSPACE_SESSION_KEY)).toBeNull();

    await user.click(screen.getByRole("button",{name:"집중 모드 종료"}));
    let board=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(within(board).getByRole("article",{name:"영상 등록 대상 Ab0_-123xyz"}))
      .toBeInTheDocument();
    expect(within(board).getByRole("heading",{name:/등록 대상 목록/}))
      .toBeInTheDocument();
    expect(board.querySelector(".workspace-url-board__grid"))
      .toHaveAttribute("data-density","single");

    await user.type(url,"https://youtube.com/@SomeCreator");
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    expect(screen.getByRole("dialog",{name:"그래프 집중 탐색"}))
      .toBeInTheDocument();
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();
    canvas=screen.getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    expect(within(canvas).getByRole("button",{name:/등록된 채널 @somecreator 선택/}))
      .toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"집중 모드 종료"}));
    board=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(within(board).getAllByRole("article")).toHaveLength(2);
    expect(within(board).getByText("채널 ID 해석 대기")).toBeInTheDocument();
    expect(screen.getByRole("combobox",{name:"채널 B"})).toHaveValue("UC"+"B".repeat(22));
  });

  it("accepts link drop, avoids duplicated board during fullscreen and rejects file drops",async()=>{
    const user=userEvent.setup();
    show();
    const hero=document.querySelector(".workspace-hero")!;
    fireEvent.dragOver(hero,{dataTransfer:{files:[],getData:()=>""}});
    expect(hero).toHaveClass("workspace-hero--dragging");
    fireEvent.drop(hero,{dataTransfer:{
      files:[],
      getData:(format:string)=>format==="text/uri-list"
        ?"https://www.youtube.com/shorts/Cb0_-123xyz":""
    }});
    expect(hero).not.toHaveClass("workspace-hero--dragging");
    expect(screen.getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"}))
      .toBeInTheDocument();
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"집중 모드 종료"}));
    const card=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(within(card).getByText("식별자: Cb0_-123xyz")).toBeInTheDocument();
    fireEvent.drop(hero,{dataTransfer:{files:[{name:"secret.txt"}],getData:()=>""}});
    expect(screen.getByText(/파일 업로드는 지원하지 않습니다/)).toBeInTheDocument();
  });

  it("keeps URL registrations independent of synthetic A/B and clears in the unified dock",async()=>{
    const user=userEvent.setup();
    const view=show();
    const input=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    view.unmount();
    show();
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"}))
      .not.toBeInTheDocument();
    const focus=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(focus).getByRole("button",{name:"대상 목록"}));
    const dock=within(focus).getByRole("complementary",{name:"도킹 대상 목록"});
    await user.click(within(dock).getByRole("button",{name:"등록 목록 비우기"}));
    expect(sessionStorage.getItem(WORKSPACE_URL_TARGETS_KEY)).toBeNull();
    expect(within(focus).getByText("영상 또는 채널을 추가하세요"))
      .toBeInTheDocument();
    expect(screen.getByRole("combobox",{name:"영상 A"})).toHaveValue("Ab0_-123xyz");
  });
});
