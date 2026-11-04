import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { AnalysisWorkspacePage } from "../../pages/analysis/AnalysisWorkspacePage";

function show() {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <Routes>
          <Route path="/analysis/youtube/workspace" element={<AnalysisWorkspacePage/>}/>
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}
const CDN_SELECTOR = 'img[src^="https://i.ytimg.com/vi/"]';

afterEach(() => {
  sessionStorage.clear();
  document.body.style.overflow = "";
});

describe("UI-R04-E — user-gated thumbnail previews integrated with URL workspace", () => {
  it("never fetches images on adding targets, then renders video thumbnails only after user opt-in", async () => {
    const user=userEvent.setup();
    show();
    const input=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    expect(document.querySelectorAll(CDN_SELECTOR)).toHaveLength(0);
    const permission=screen.getByRole("button",{name:"영상 이미지 미리보기 켜기"});
    expect(permission).toHaveAttribute("aria-pressed","false");
    await user.click(permission);
    expect(screen.getByRole("button",{name:"영상 이미지 미리보기 끄기"}))
      .toHaveAttribute("aria-pressed","true");
    const images=document.querySelectorAll(CDN_SELECTOR);
    expect(images.length).toBeGreaterThan(0);
    for(const img of images){
      expect(img).toHaveAttribute("referrerpolicy","no-referrer");
      expect(img).toHaveAttribute("loading","lazy");
    }
    const board=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(board.querySelector(CDN_SELECTOR)).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"영상 이미지 미리보기 끄기"}));
    expect(document.querySelectorAll(CDN_SELECTOR)).toHaveLength(0);
  });

  it("renders channel avatar fallback even when opt-in is enabled", async () => {
    const user=userEvent.setup();
    show();
    const input=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(input,"https://www.youtube.com/@SomeCreator");
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    await user.click(screen.getByRole("button",{name:"영상 이미지 미리보기 켜기"}));
    expect(document.querySelectorAll(CDN_SELECTOR)).toHaveLength(0);
    const board=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(within(board).getByText("채널 ID 해석 대기")).toBeInTheDocument();
    expect(board.querySelector('[title="채널 핸들·프로필 미확인"]'))
      .toBeInTheDocument();
  });

  it("shares opt-in state with the fullscreen node, list and focused detail, without persisting it", async () => {
    const user=userEvent.setup();
    const view=show();
    const input=screen.getByRole("textbox",{name:/URL을 붙여넣으면/});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(screen.getByRole("button",{name:"URL 추가"}));
    await user.click(screen.getByRole("button",{name:"전체 화면 집중 모드"}));
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    expect(dialog.querySelectorAll(CDN_SELECTOR)).toHaveLength(0);
    await user.click(within(dialog).getByRole("button",{name:"영상 이미지 켜기"}));
    expect(dialog.querySelectorAll(CDN_SELECTOR).length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    const list=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    expect(list.querySelectorAll(CDN_SELECTOR)).toHaveLength(1);
    await user.click(within(list).getByRole("button",{name:"대상 선택 영상 Ab0_-123xyz"}));
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(detail.querySelectorAll(CDN_SELECTOR)).toHaveLength(1);
    await user.click(within(dialog).getByRole("button",{name:"집중 모드 종료"}));
    view.unmount();
    show();
    expect(document.querySelectorAll(CDN_SELECTOR)).toHaveLength(0);
    expect(screen.getByRole("button",{name:"영상 이미지 미리보기 켜기"}))
      .toHaveAttribute("aria-pressed","false");
  });
});
