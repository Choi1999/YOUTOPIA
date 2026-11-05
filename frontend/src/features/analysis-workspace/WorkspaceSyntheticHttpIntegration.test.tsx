import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisWorkspacePage } from "../../pages/analysis/AnalysisWorkspacePage";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { simulateOfflineMetadataBackend } from "./workspaceSyntheticMetadata";
import { WORKSPACE_TARGET_PRESENTATION_KEY } from "./workspaceTargetPresentation";
import { SYNTHETIC_HTTP_PATH } from "./workspaceSyntheticHttpClient";

const VIDEO = { kind:"VIDEO" as const, id:"Ab0_-123xyz" };
const CHANNEL = { kind:"CHANNEL_HANDLE" as const, id:"@samplecreator" };

function mount() {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <Routes><Route path="/analysis/youtube/workspace"
          element={<AnalysisWorkspacePage/>}/></Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>
  );
}

function response(target: typeof VIDEO | typeof CHANNEL) {
  return new Response(JSON.stringify(simulateOfflineMetadataBackend(target)), {
    status: 200,
    headers: {
      "Content-Type":"application/json",
      "X-YOUTOPIA-Synthetic":"test-only",
      "Cache-Control":"no-store",
    },
  });
}

beforeEach(() => {
  vi.stubEnv("DEV",true);
  vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP","enabled");
});
afterEach(() => {
  sessionStorage.clear();
  document.body.style.overflow = "";
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("UI-R04-Y — explicit Spring loopback synthetic response in workspace", () => {
  it("never fetches before opt-in, then displays exact Spring-shaped response in graph and card", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => response(VIDEO));
    vi.stubGlobal("fetch",fetcher);
    mount();
    const focus = screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.type(within(focus).getByRole("textbox",{name:"URL 추가 입력"}),
      "https://youtu.be/Ab0_-123xyz");
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    expect(fetcher).not.toHaveBeenCalled();
    const canvas = within(focus).getByRole("region",{
      name:"URL 등록 대상 전체 화면 탐색",
    });
    expect(within(canvas).getByText("영상 제목 미확인")).toBeInTheDocument();
    await user.click(within(focus).getByRole("button",{name:"Spring 합성 연결"}));
    await waitFor(() => expect(
      within(canvas).getByText("합성 영상 제목 · Ab0_-123xyz")
    ).toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(SYNTHETIC_HTTP_PATH+"/videos/Ab0_-123xyz");
    expect(within(focus).getByText(/Spring 테스트 서버 합성 응답 1개 확인/))
      .toBeInTheDocument();
    expect(focus.querySelectorAll('[data-preview="synthetic"]').length)
      .toBeGreaterThan(0);
    expect(focus.querySelectorAll("img[src]")).toHaveLength(0);
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY)).toBeNull();
    await user.click(within(focus).getByRole("button",{name:"Spring 합성 연결 끄기"}));
    expect(within(canvas).getByText("영상 제목 미확인")).toBeInTheDocument();
    expect(focus.querySelectorAll('[data-preview="synthetic"]')).toHaveLength(0);
  });

  it("treats 503 or untrusted server response as failure, never local fallback", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({code:"METADATA_UNAVAILABLE"}),{
        status:503, headers:{"Content-Type":"application/problem+json"}
      }));
    vi.stubGlobal("fetch",fetcher);
    mount();
    const focus=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.type(within(focus).getByRole("textbox",{name:"URL 추가 입력"}),
      "https://youtu.be/Ab0_-123xyz");
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    await user.click(within(focus).getByRole("button",{name:"Spring 합성 연결"}));
    await waitFor(() => expect(within(focus).getByText(
      /1개 실패\(미확인 유지\)/)).toBeInTheDocument());
    const canvas=within(focus).getByRole("region",{
      name:"URL 등록 대상 전체 화면 탐색",
    });
    expect(within(canvas).getByText("영상 제목 미확인")).toBeInTheDocument();
    expect(focus.querySelectorAll('[data-preview="synthetic"]')).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reactively requests each newly registered target with bounded explicit mode", async () => {
    const user=userEvent.setup();
    const fetcher=vi.fn(async (input:RequestInfo | URL) =>
      String(input).includes("/videos/") ? response(VIDEO) : response(CHANNEL));
    vi.stubGlobal("fetch",fetcher);
    mount();
    const focus=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(focus).getByRole("button",{name:"Spring 합성 연결"}));
    const input=within(focus).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://youtu.be/Ab0_-123xyz");
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    await waitFor(()=>expect(within(focus).getByText(
      /Spring 테스트 서버 합성 응답 1개 확인/)).toBeInTheDocument());
    await user.type(input,"https://youtube.com/@samplecreator");
    await user.click(within(focus).getByRole("button",{name:"추가하기"}));
    await waitFor(()=>expect(within(focus).getByText(
      /Spring 테스트 서버 합성 응답 2개 확인/)).toBeInTheDocument());
    const canvas=within(focus).getByRole("region",{
      name:"URL 등록 대상 전체 화면 탐색",
    });
    expect(within(canvas).getByText("합성 채널 이름 · @samplecreator"))
      .toBeInTheDocument();
    expect(fetcher.mock.calls.some(call=>
      String(call[0]).includes("/handles/%40samplecreator"))).toBe(true);
    expect(focus.querySelectorAll("img[src]")).toHaveLength(0);
  });
});
