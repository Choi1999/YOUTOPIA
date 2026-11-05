import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisWorkspacePage } from "../../pages/analysis/AnalysisWorkspacePage";
import { AppRoutes } from "../../app/AppRoutes";
import { ThemeProvider } from "../../theme/ThemeProvider";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import {
  DIAGNOSTIC_WORKSPACE_PATH, USER_WORKSPACE_PATH,
} from "./workspaceDiagnosticsGate";
import { WORKSPACE_TARGET_PRESENTATION_KEY } from "./workspaceTargetPresentation";

function show(path: string) {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={USER_WORKSPACE_PATH} element={<AnalysisWorkspacePage />} />
          <Route path={DIAGNOSTIC_WORKSPACE_PATH}
            element={<AnalysisWorkspacePage diagnosticsMode />} />
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}
function showRealRoutes(path: string) {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider><AppRoutes /></ThemeProvider>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}
beforeEach(() => {
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP", "enabled");
  vi.stubEnv("VITE_R04AA_METADATA_STATES", "enabled");
  vi.stubEnv("VITE_R04AC_DIAGNOSTICS", "enabled");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  document.body.style.overflow = "";
});

describe("UI-R04-AC — consumer UI and developer diagnostics never mix", () => {
  it("hides all QA controls and does not request Spring from the user route despite enabled dev flags", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    show(USER_WORKSPACE_PATH);

    const focus = screen.getByRole("dialog", { name: "그래프 집중 탐색" });
    expect(within(focus).queryByRole("button",{name:"개발자 진단 열기"}))
      .not.toBeInTheDocument();
    for (const name of [
      "합성 정보 미리보기", "Spring 합성 연결", "메타데이터 상태 QA",
      "메타데이터 새로고침",
    ]) expect(within(focus).queryByRole("button",{name}))
      .not.toBeInTheDocument();
    expect(within(focus).queryByRole("combobox",{
      name:"메타데이터 QA 시나리오",
    })).not.toBeInTheDocument();

    await user.type(within(focus).getByRole("textbox",{name:"URL 추가 입력"}),
      "https://youtu.be/Ab0_-123xyz");
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    const graph = within(focus).getByRole("region",{
      name:"URL 등록 대상 전체 화면 탐색",
    });
    expect(within(graph).getByText("영상 제목 미확인")).toBeInTheDocument();
    expect(graph.querySelectorAll("[data-metadata-status]")).toHaveLength(0);
    expect(graph.querySelectorAll('[data-preview="synthetic"]')).toHaveLength(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY)).toBeNull();
    expect(screen.queryByText(/REGISTERED VIDEOS \(FIXTURE\)/))
      .not.toBeInTheDocument();
  });

  it("does not expose diagnostics merely by passing the page prop without the explicit flag", () => {
    vi.stubEnv("VITE_R04AC_DIAGNOSTICS", "");
    show(DIAGNOSTIC_WORKSPACE_PATH);
    expect(screen.getByRole("dialog",{name:"그래프 집중 탐색"}))
      .toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"개발자 진단 열기"}))
      .not.toBeInTheDocument();
  });

  it("keeps a dedicated, initially collapsed developer dock on the flagged route", async () => {
    const user=userEvent.setup();
    const fetcher=vi.fn();
    vi.stubGlobal("fetch",fetcher);
    show(DIAGNOSTIC_WORKSPACE_PATH);
    const focus=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    expect(within(focus).getByRole("button",{name:"개발자 진단 열기"}))
      .toHaveAttribute("aria-expanded","false");
    expect(within(focus).queryByRole("region",{name:"개발자 진단 도구"}))
      .not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();

    await user.click(within(focus).getByRole("button",{name:"개발자 진단 열기"}));
    const dock=within(focus).getByRole("region",{name:"개발자 진단 도구"});
    expect(within(dock).getByRole("button",{name:"합성 정보 미리보기"}))
      .toBeInTheDocument();
    expect(within(dock).getByRole("button",{name:"Spring 합성 연결"}))
      .toBeInTheDocument();
    expect(within(dock).getByRole("button",{name:"메타데이터 상태 QA"}))
      .toBeInTheDocument();
    expect(within(dock).getByText(/실제 YouTube 조회·키 사용 없음/))
      .toBeInTheDocument();

    await user.click(within(dock).getByRole("button",{name:"메타데이터 상태 QA"}));
    expect(within(dock).getByRole("combobox",{name:"메타데이터 QA 시나리오"}))
      .toBeInTheDocument();
    await user.click(within(dock).getByRole("button",{name:"상태 QA 끄기"}));
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(within(dock).getByRole("link",{name:"일반 사용자 화면으로 이동"}));
    expect(screen.getByRole("dialog",{name:"그래프 집중 탐색"}))
      .toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"개발자 진단 열기"}))
      .not.toBeInTheDocument();
  });

  it("does not expose the developer dock when the build is not DEV", () => {
    vi.stubEnv("DEV", false);
    show(DIAGNOSTIC_WORKSPACE_PATH);
    expect(screen.queryByRole("button",{name:"개발자 진단 열기"}))
      .not.toBeInTheDocument();
  });

  it("the REAL application router returns 404 for the diagnostic URL in production", () => {
    vi.stubEnv("DEV", false);
    showRealRoutes(DIAGNOSTIC_WORKSPACE_PATH);
    expect(screen.getByRole("heading",{
      name:"요청한 YUTOPIA 화면을 찾을 수 없습니다.",
    })).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"개발자 진단 열기"}))
      .not.toBeInTheDocument();
  });

  it("the REAL application router does not register the diagnostic URL without its flag", () => {
    vi.stubEnv("VITE_R04AC_DIAGNOSTICS", "");
    showRealRoutes(DIAGNOSTIC_WORKSPACE_PATH);
    expect(screen.getByRole("heading",{
      name:"요청한 YUTOPIA 화면을 찾을 수 없습니다.",
    })).toBeInTheDocument();
  });

  it("the REAL application router registers only a flagged DEV diagnostic route", () => {
    showRealRoutes(DIAGNOSTIC_WORKSPACE_PATH);
    expect(screen.getByRole("dialog",{name:"그래프 집중 탐색"}))
      .toBeInTheDocument();
    expect(screen.getByRole("button",{name:"개발자 진단 열기"}))
      .toBeInTheDocument();
    expect(document.querySelector(".app-shell"))
      .toHaveClass("app-shell--immersive-workspace");
  });

});
