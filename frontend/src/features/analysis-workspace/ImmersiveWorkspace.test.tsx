import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AppRoutes } from "../../app/AppRoutes";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { WorkspaceHero } from "./WorkspaceHero";

function showWorkspace() {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <ThemeProvider><AppRoutes /></ThemeProvider>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}

afterEach(() => sessionStorage.clear());

describe("UI-R01–R04: immersive responsive workspace visual contract", () => {
  it("preserves the product title and offers real in-page navigation targets", () => {
    render(<WorkspaceHero />);
    expect(screen.getByRole("heading", {name:"통합 분석 워크스페이스"}))
      .toBeInTheDocument();
    const nav = screen.getByRole("navigation", {name:"워크스페이스 빠른 이동"});
    expect(within(nav).getByRole("link", {name:/분석 구성하기/}))
      .toHaveAttribute("href", "#workspace-session");
    expect(within(nav).getByRole("link", {name:"분석 대상 탐색"}))
      .toHaveAttribute("href", "#workspace-catalog");
    expect(document.querySelector(".workspace-hero__visual"))
      .toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(/OFFLINE/)).toHaveTextContent("OFFLINE");
    expect(screen.getByRole("button",{name:"3D 모션 재생"}))
      .toHaveAttribute("aria-pressed","false");
  });

  it("requires explicit opt-in for nonessential 3D animation", async () => {
    const user=userEvent.setup();
    render(<WorkspaceHero />);
    const play=screen.getByRole("button",{name:"3D 모션 재생"});
    expect(document.querySelector(".workspace-hero")).not.toHaveClass("workspace-hero--is-playing");
    await user.click(play);
    expect(screen.getByRole("button",{name:"3D 모션 중지"}))
      .toHaveAttribute("aria-pressed","true");
    expect(document.querySelector(".workspace-hero")).toHaveClass("workspace-hero--is-playing");
    await user.click(screen.getByRole("button",{name:"3D 모션 중지"}));
    expect(screen.getByRole("button",{name:"3D 모션 재생"}))
      .toHaveAttribute("aria-pressed","false");
  });

  it("adds an opt-in immersive shell without changing existing routes", async () => {
    const user = userEvent.setup();
    showWorkspace();
    const shell = document.querySelector(".app-shell");
    expect(shell).toHaveClass("app-shell--immersive-workspace");
    expect(document.getElementById("workspace-session")).toBeInTheDocument();
    expect(document.getElementById("workspace-catalog")).toBeInTheDocument();
    expect(document.getElementById("workspace-evidence")).toBeInTheDocument();
    const toggle=screen.getByRole("button", {name:"메뉴 열기"});
    expect(toggle).toHaveAttribute("aria-controls", "workspace-sidebar-navigation");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", {name:"메뉴 닫기"}))
      .toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector(".app-sidebar"))
      .toHaveClass("app-sidebar--workspace-menu-open");
    await user.click(screen.getByRole("button", {name:"메뉴 닫기"}));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps registered synthetic comparison selection and validated counts", async () => {
    showWorkspace();
    expect(screen.getByRole("combobox", {name:"영상 A"}))
      .toHaveValue("Ab0_-123xyz");
    const summary = screen.getByRole("region", {name:"통합 분석 요약"});
    expect((await within(summary).findAllByText(/분류 완료 80건/)).length).toBe(2);
    expect(screen.getByRole("link", {name:"영상 A/B 비교 화면"}))
      .toHaveAttribute("href",
        "/analysis/youtube/compare?video=Ab0_-123xyz&video=Qb0_-123xyz");
  });
});
