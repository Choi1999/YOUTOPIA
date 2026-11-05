import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AnalysisWorkspacePage } from "../../pages/analysis/AnalysisWorkspacePage";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import {
  WORKSPACE_TARGET_PRESENTATION_KEY,
} from "./workspaceTargetPresentation";
import { WORKSPACE_URL_TARGETS_KEY } from "./workspaceUrlTargets";

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

afterEach(() => {
  sessionStorage.clear();
  document.body.style.overflow = "";
});

describe("UI-R04-W — URL → synthetic backend envelope → graph/card/details", () => {
  it("leaves default URL-only state unchanged until an explicit synthetic opt-in", async () => {
    const user = userEvent.setup();
    show();
    const focus = screen.getByRole("dialog", { name: "그래프 집중 탐색" });
    const input = within(focus).getByRole("textbox", { name: "URL 추가 입력" });
    await user.type(input, "https://youtu.be/Ab0_-123xyz");
    await user.click(within(focus).getByRole("button", { name: "추가하기" }));
    const canvas = within(focus).getByRole("region", {
      name: "URL 등록 대상 전체 화면 탐색",
    });
    expect(within(canvas).getByText("영상 제목 미확인")).toBeInTheDocument();
    expect(focus.querySelectorAll('[data-preview="synthetic"]')).toHaveLength(0);
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY)).toBeNull();

    await user.click(within(focus).getByRole("button", {
      name: "합성 정보 미리보기",
    }));
    expect(within(focus).getByRole("button", { name: "합성 정보 끄기" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(canvas).getByText("합성 영상 제목 · Ab0_-123xyz"))
      .toBeInTheDocument();
    expect(within(focus).getByText(/합성 데이터 미리보기 · 실제 영상·채널 제목/))
      .toBeInTheDocument();
    expect(focus.querySelectorAll('[data-preview="synthetic"]').length)
      .toBeGreaterThan(0);
    expect(focus.querySelectorAll('img[src]')).toHaveLength(0);
    expect(within(focus).getByText(/합성 채널 정보:/)).toBeInTheDocument();
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(WORKSPACE_URL_TARGETS_KEY)!).targets)
      .toHaveLength(1);

    await user.click(within(focus).getByRole("button", { name: "합성 정보 끄기" }));
    expect(within(canvas).getByText("영상 제목 미확인")).toBeInTheDocument();
    expect(focus.querySelectorAll('[data-preview="synthetic"]')).toHaveLength(0);
  });

  it("automatically displays synthetic channel names for newly added URLs in preview mode", async () => {
    const user = userEvent.setup();
    show();
    const focus = screen.getByRole("dialog", { name: "그래프 집중 탐색" });
    await user.click(within(focus).getByRole("button", { name: "합성 정보 미리보기" }));
    const input = within(focus).getByRole("textbox", { name: "URL 추가 입력" });
    await user.type(input, "https://youtube.com/@somecreator");
    await user.click(within(focus).getByRole("button", { name: "추가하기" }));
    const canvas = within(focus).getByRole("region", {
      name: "URL 등록 대상 전체 화면 탐색",
    });
    expect(within(canvas).getByText("합성 채널 이름 · @somecreator"))
      .toBeInTheDocument();
    expect(focus.querySelectorAll('[data-preview="synthetic"]').length)
      .toBeGreaterThan(0);
    expect(focus.querySelectorAll("img[src]")).toHaveLength(0);
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY)).toBeNull();
    expect(within(focus).getByText(/채널 ID 해석 대기|채널 정보가 아직 제공되지 않습니다|채널.*미확인/))
      .toBeInTheDocument();
  });

  it("does not convert synthetic labels into human-authored title overrides", async () => {
    const user = userEvent.setup();
    show();
    const focus = screen.getByRole("dialog", { name: "그래프 집중 탐색" });
    await user.click(within(focus).getByRole("button", { name: "합성 정보 미리보기" }));
    await user.type(within(focus).getByRole("textbox", { name: "URL 추가 입력" }),
      "https://youtu.be/Ab0_-123xyz");
    await user.click(within(focus).getByRole("button", { name: "추가하기" }));
    const editable = within(focus).getByRole("textbox", { name: "표시 제목 (직접 입력)" });
    expect(editable).toHaveValue("");
    await user.type(editable, "내가 지정한 별칭");
    await user.click(within(focus).getByRole("button", { name: "표시 제목 저장" }));
    const canvas = within(focus).getByRole("region", {
      name: "URL 등록 대상 전체 화면 탐색",
    });
    expect(within(canvas).getByText("내가 지정한 별칭")).toBeInTheDocument();
    const stored = sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY);
    expect(stored).toContain("내가 지정한 별칭");
    expect(stored).not.toContain("합성 영상 제목");
    await user.click(within(focus).getByRole("button", { name: "합성 정보 끄기" }));
    expect(within(canvas).getByText("내가 지정한 별칭")).toBeInTheDocument();
  });
});
