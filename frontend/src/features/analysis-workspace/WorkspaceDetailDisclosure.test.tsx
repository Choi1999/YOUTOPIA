import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { AnalysisWorkspacePage } from "../../pages/analysis/AnalysisWorkspacePage";
import { WORKSPACE_TARGET_PRESENTATION_KEY } from "./workspaceTargetPresentation";

function mount() {
  render(
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

describe("UI-R04-AD-3 — accessible, compact selected detail sections",()=>{
  it("preserves header/basic information, opens edit on request and saves only user alias",async()=>{
    const user=userEvent.setup();
    mount();
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const input=within(dialog).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    const identity=within(detail).getByRole("group",{name:"선택 대상 요약"});
    expect(within(identity).getByRole("heading",{name:"영상 제목 미확인"}))
      .toBeInTheDocument();
    expect(within(identity).getByText("등록 식별자: Ab0_-123xyz"))
      .toBeInTheDocument();
    expect(within(detail).getByText(/분석 정보는 아직 제공되지 않습니다/))
      .toBeInTheDocument();

    expect(within(detail).queryByRole("textbox",{name:"표시 제목 (직접 입력)"}))
      .not.toBeInTheDocument();
    expect(within(detail).queryByRole("button",{name:"이 등록 대상 제거"}))
      .not.toBeInTheDocument();
    const edit=within(detail).getByText("표시 제목·이미지 편집");
    await user.click(edit);
    const title=within(detail).getByRole("textbox",{name:"표시 제목 (직접 입력)"});
    await user.type(title,"사용자 별칭 AD3");
    await user.click(within(detail).getByRole("button",{name:"표시 제목 저장"}));
    expect(within(identity).getByRole("heading",{name:"사용자 별칭 AD3"}))
      .toBeInTheDocument();
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY))
      .toContain("사용자 별칭 AD3");

    await user.click(within(detail).getByText("대상 관리"));
    const link=within(detail).getByRole("link",{name:"YouTube에서 열기"});
    expect(link).toHaveAttribute("href","https://www.youtube.com/watch?v=Ab0_-123xyz");
    expect(link).toHaveAttribute("rel","noopener noreferrer");
    expect(within(detail).getByRole("button",{name:"이 등록 대상 제거"}))
      .toBeInTheDocument();
    await user.click(edit);
    expect(within(detail).queryByRole("textbox",{name:"표시 제목 (직접 입력)"}))
      .not.toBeInTheDocument();
    expect(within(identity).getByText("등록 식별자: Ab0_-123xyz"))
      .toBeInTheDocument();
  });

  it("shows channel profile uncertainty while keeping image editing and removal behind disclosure",async()=>{
    const user=userEvent.setup();
    mount();
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.type(within(dialog).getByRole("textbox",{name:"URL 추가 입력"}),
      "https://www.youtube.com/@samplecreator");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(within(detail).getByText("등록 식별자: @samplecreator"))
      .toBeInTheDocument();
    expect(within(detail).getByText(/채널 정보가 아직 제공되지 않습니다/))
      .toBeInTheDocument();
    expect(within(detail).queryByRole("textbox",{name:"채널 썸네일 이미지 URL"}))
      .not.toBeInTheDocument();
    await user.click(within(detail).getByText("표시 제목·이미지 편집"));
    const image=within(detail).getByRole("textbox",{name:"채널 썸네일 이미지 URL"});
    await user.type(image,"https://yt3.googleusercontent.com/sample-avatar-image");
    await user.click(within(detail).getByRole("button",{name:"채널 이미지 적용"}));
    expect(dialog.querySelector('img[src^="https://yt3."]')).not.toBeInTheDocument();
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY))
      .toContain("yt3.googleusercontent.com");
    await user.click(within(detail).getByText("대상 관리"));
    await user.click(within(detail).getByRole("button",{name:"이 등록 대상 제거"}));
    expect(within(dialog).getByText("영상 또는 채널을 추가하세요"))
      .toBeInTheDocument();
  });

  it("resets open management/editor disclosure when the selected target changes",async()=>{
    const user=userEvent.setup();
    mount();
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const input=within(dialog).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    const first=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    await user.click(within(first).getByText("표시 제목·이미지 편집"));
    expect(within(first).getByRole("textbox",{name:"표시 제목 (직접 입력)"}))
      .toBeInTheDocument();
    await user.type(input,"https://youtu.be/Cb0_-123xyz");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    const next=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(within(next).getByText("등록 식별자: Cb0_-123xyz"))
      .toBeInTheDocument();
    expect(within(next).queryByRole("textbox",{name:"표시 제목 (직접 입력)"}))
      .not.toBeInTheDocument();
    expect(within(next).queryByRole("button",{name:"이 등록 대상 제거"}))
      .not.toBeInTheDocument();
  });
});
