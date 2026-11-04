import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import type { AnalysisRepository } from "../analysis/data/AnalysisRepository";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { demoChannelSelections } from "../analysis/data/demoChannelSelection";
import { AnalysisWorkspacePage } from "../../pages/analysis/AnalysisWorkspacePage";
import { ANALYSIS_WORKSPACE_SESSION_KEY } from "./analysisWorkspaceSession";

const A = demoChannelSelections[0].channelId;
const B = demoChannelSelections[1].channelId;

function show(
  repo: AnalysisRepository = demoAnalysisRepository,
  path = "/analysis/youtube/workspace",
) {
  return render(
    <AnalysisRepositoryProvider repository={repo}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/analysis/youtube/workspace" element={<AnalysisWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}
afterEach(() => sessionStorage.clear());

describe("YU-50~52 — integrated synthetic analysis workspace", () => {
  it("links existing routes from the demo and shows independently verified evidence", async () => {
    show();
    expect(screen.getByRole("heading", {name:"통합 분석 워크스페이스"})).toBeInTheDocument();
    const nav = screen.getByRole("navigation", {name:"분석 바로가기"});
    expect(within(nav).getByRole("link", {name:"영상 A/B 비교 화면"})).toHaveAttribute(
      "href", "/analysis/youtube/compare?video=Ab0_-123xyz&video=Qb0_-123xyz",
    );
    expect(within(nav).getByRole("link", {name:"채널 A/B 비교 화면"})).toHaveAttribute(
      "href", "/analysis/youtube/channels/compare?channel=" + A + "&channel=" + B,
    );
    expect(within(nav).getByRole("link", {name:"선택 주제 심층 탐색"})).toHaveAttribute(
      "href", "/analysis/youtube/topics?topic=RECIPE&channel=" + A + "&channel=" + B,
    );
    const video = screen.getByRole("region", {name:"영상 근거 상세"});
    expect(await within(video).findByText("120건")).toBeInTheDocument();
    expect(await screen.findByText("240건")).toBeInTheDocument();
  });

  it("keeps chosen synthetic IDs and comparison order after unmount/reopen", async () => {
    const user = userEvent.setup();
    const view = show();
    await user.selectOptions(screen.getByRole("combobox", {name:"영상 A"}), "Cb0_-123xyz");
    expect(screen.getByRole("combobox", {name:"영상 A"})).toHaveValue("Cb0_-123xyz");
    expect(screen.getByRole("link", {name:"영상 A/B 비교 화면"})).toHaveAttribute(
      "href", "/analysis/youtube/compare?video=Cb0_-123xyz&video=Qb0_-123xyz",
    );
    expect(JSON.parse(sessionStorage.getItem(ANALYSIS_WORKSPACE_SESSION_KEY)!).recentTargets)
      .toEqual([{type:"VIDEO",id:"Cb0_-123xyz"}]);
    view.unmount();
    show();
    expect(screen.getByRole("combobox", {name:"영상 A"})).toHaveValue("Cb0_-123xyz");
    await user.click(screen.getByRole("button", {name:"영상 A/B 순서 교환"}));
    expect(screen.getByRole("link", {name:"영상 A/B 비교 화면"})).toHaveAttribute(
      "href", "/analysis/youtube/compare?video=Qb0_-123xyz&video=Cb0_-123xyz",
    );
    expect(screen.getByRole("region", {name:"최근 분석 대상"})).toBeInTheDocument();
  });

  it("preserves partial selection but suppresses incomplete links; clearing removes storage", async () => {
    const user = userEvent.setup();
    show();
    await user.selectOptions(screen.getByRole("combobox", {name:"채널 B"}), "");
    const nav = screen.getByRole("navigation", {name:"분석 바로가기"});
    expect(within(nav).queryByRole("link", {name:"채널 A/B 비교 화면"}))
      .not.toBeInTheDocument();
    expect(within(nav).getByRole("link", {name:"선택 주제 심층 탐색"}))
      .toHaveAttribute("href", "/analysis/youtube/topics?topic=RECIPE&channel=" + A);
    await user.click(screen.getByRole("button", {name:"작업 세션 삭제"}));
    expect(sessionStorage.getItem(ANALYSIS_WORKSPACE_SESSION_KEY)).toBeNull();
    expect(screen.getByRole("combobox", {name:"채널 B"})).toHaveValue(B);
  });

  it("allows bounded UTM but rejects unknown, duplicated, or malformed URL query", () => {
    const start = "/analysis/youtube/workspace";
    for (const query of [
      "?token=secret",
      "?utm_custom=x",
      "?utm_source=",
      "?utm_source=one&utm_source=two",
    ]) {
      const view = show(demoAnalysisRepository, start + query);
      expect(screen.getByRole("alert")).toHaveTextContent(/지원하지 않는 URL/);
      expect(screen.queryByRole("navigation", {name:"분석 바로가기"}))
        .not.toBeInTheDocument();
      view.unmount();
    }
    show(demoAnalysisRepository, start + "?utm_source=chatgpt.com");
    expect(screen.getByRole("link", {name:"영상 A/B 비교 화면"}))
      .toBeInTheDocument();
  });

  it("rejects corrupt/unregistered state and blocks missing evidence", async () => {
    sessionStorage.setItem(ANALYSIS_WORKSPACE_SESSION_KEY, JSON.stringify({
      version:1, savedAt:Date.now(), videoIds:["Ab0_-123xyz","unknown"],
      channelIds:[A,B], topicId:"RECIPE", recentTargets:[], secret:"BAD",
    }));
    const repo: AnalysisRepository = {
      async getSnapshot() { return {kind:"NOT_FOUND"}; },
    };
    show(repo);
    expect(screen.getByRole("combobox", {name:"영상 B"})).toHaveValue("Qb0_-123xyz");
    const video = screen.getByRole("region", {name:"영상 근거 상세"});
    expect(await within(video).findByText(/근거 검증 제한: NOT_FOUND/))
      .toBeInTheDocument();
    expect(within(video).queryByText("120건")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(ANALYSIS_WORKSPACE_SESSION_KEY)).toContain("BAD");
    expect(screen.getByRole("status", {name:""})).toHaveTextContent(/이전 세션이 만료되었거나/);
  });
});
