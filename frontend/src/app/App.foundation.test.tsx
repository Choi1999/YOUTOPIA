import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ThemeProvider, THEME_STORAGE_KEY } from "../theme/ThemeProvider";
import { AppRoutes } from "./AppRoutes";
import { yutopiaRoutes } from "./routeDefinitions";

function renderAt(initialEntries: string[], initialIndex = initialEntries.length - 1) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("P0-1 라우터·테마·AppShell 기반", () => {
  it.each(["/", "/login"])("%s에서 기존 로그인 화면을 유지한다", (path) => {
    renderAt([path]);
    expect(screen.getByRole("heading", { name: "환영합니다." })).toBeInTheDocument();
    expect(screen.getByText(/demo@youtopia.app/)).toBeInTheDocument();
  });

  it("YU-01부터 YU-12까지 고유한 라우트 정의를 유지한다", () => {
    expect(yutopiaRoutes).toHaveLength(12);
    expect(new Set(yutopiaRoutes.map(({ code }) => code)).size).toBe(12);
    expect(new Set(yutopiaRoutes.map(({ path }) => path)).size).toBe(12);
    expect(yutopiaRoutes.find(({ code }) => code === "YU-12")?.summary).toMatch(/로컬 시뮬레이션/);
  });

  it("명시적으로 선택한 테마를 적용하고 기존 저장 키와 분리해 유지한다", async () => {
    const user = userEvent.setup();
    const view = renderAt(["/connect/youtube"]);

    await user.click(screen.getByRole("button", { name: "라이트" }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "light"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(localStorage.getItem("youtopia-login-email")).toBeNull();

    view.unmount();
    renderAt(["/connect/youtube"]);
    expect(screen.getByRole("button", { name: "라이트" })).toHaveAttribute("aria-pressed", "true");
  });

  it("키보드로 테마를 선택하고 주 탐색 링크를 실행한다", async () => {
    const user = userEvent.setup();
    renderAt(["/connect/youtube"]);

    const lightButton = screen.getByRole("button", { name: "라이트" });
    lightButton.focus();
    await user.keyboard("{Enter}");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    const projectLink = screen.getByRole("link", { name: "프로젝트" });
    projectLink.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "관측 프로젝트 생성" })).toBeInTheDocument();
  });

  it("이전 단계 버튼이 라우터 기록으로 돌아간다", async () => {
    const user = userEvent.setup();
    renderAt(["/login", "/connect/youtube"], 1);

    await user.click(screen.getByRole("button", { name: "← 이전 단계" }));
    expect(screen.getByRole("heading", { name: "환영합니다." })).toBeInTheDocument();
  });

  it("알 수 없는 경로에서 안전한 404 화면을 표시한다", () => {
    renderAt(["/not-a-yutopia-route"]);
    expect(screen.getByRole("heading", { name: "요청한 YUTOPIA 화면을 찾을 수 없습니다." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인 화면으로 이동" })).toHaveAttribute("href", "/login");
  });
});
