import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ChannelAnalysisPage } from "../../pages/analysis/ChannelAnalysisPage";
import { AnalysisRepositoryProvider } from "./data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "./data/DemoAnalysisRepository";
import type { AnalysisRepository } from "./data/AnalysisRepository";
import { demoReadySnapshot } from "./data/demoReadySnapshot";
import { demoChannelSelection } from "./data/demoChannelSelection";

const CHANNEL = demoChannelSelection.channelId;

function renderPage(
  url: string,
  repository: AnalysisRepository = demoAnalysisRepository,
) {
  return render(
    <AnalysisRepositoryProvider repository={repository}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/analysis/youtube/channel/:channelId"
            element={<ChannelAnalysisPage />} />
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}

describe("YU-44 — registered synthetic channel selection only", () => {
  it("shows the exact explicit channel selection and two constituent video IDs", async () => {
    renderPage("/analysis/youtube/channel/" + CHANNEL);
    expect(screen.getByRole("heading", { name: "채널 상세 분석" }))
      .toBeInTheDocument();
    expect(screen.getByText("선정 영상 수: 2개 (실제 소속 증명 아님)"))
      .toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "채널의 선정 영상 목록" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("영상 ID: Ab0_-123xyz")).toBeInTheDocument();
    expect(within(list).getByText("영상 ID: Qb0_-123xyz")).toBeInTheDocument();
    expect(within(list).getAllByText("검증된 합성 READY 스냅샷"))
      .toHaveLength(2);
    expect(screen.getByText(/실제 채널의 모든 영상 목록이 아닙니다/))
      .toBeInTheDocument();
  });

  it("valid but unregistered channel must not invent data", () => {
    renderPage("/analysis/youtube/channel/UC" + "B".repeat(22));
    expect(screen.getByRole("heading", { name: "채널 분석 데이터 미제공" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "채널의 선정 영상 목록" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/선정 영상 수: 2개/))
      .not.toBeInTheDocument();
  });

  it("invalid @handle, traversal or malformed IDs are rejected", () => {
    renderPage("/analysis/youtube/channel/@unresolved");
    expect(screen.getByRole("alert")).toHaveTextContent("채널 ID");
    expect(screen.queryByText(/검증된 합성 READY/)).not.toBeInTheDocument();
  });

  it("NOT_FOUND constituent shows a factual missing state rather than 0%", async () => {
    const missing: AnalysisRepository = {
      async getSnapshot(target) {
        if (target.targetId === "Qb0_-123xyz") return { kind: "NOT_FOUND" };
        return demoAnalysisRepository.getSnapshot(target);
      },
    };
    renderPage("/analysis/youtube/channel/" + CHANNEL, missing);
    expect(await screen.findByText("등록된 합성 분석 결과 없음"))
      .toBeInTheDocument();
    expect(screen.queryByText("채널 전체 긍정 비율")).not.toBeInTheDocument();
  });

  it("invalid snapshot cannot be shown as a valid channel-selected video", async () => {
    const malformed: AnalysisRepository = {
      async getSnapshot(target) {
        return {
          kind: "FOUND",
          snapshot: { ...demoReadySnapshot, target, sample: {
            ...demoReadySnapshot.sample, rawCount: 500,
          } },
        };
      },
    };
    renderPage("/analysis/youtube/channel/" + CHANNEL, malformed);
    expect((await screen.findAllByText("검증되지 않은 스냅샷 — 합산 불가")))
      .toHaveLength(2);
    expect(screen.queryByText("검증된 합성 READY 스냅샷"))
      .not.toBeInTheDocument();
  });

  it("safe repository exceptions do not reveal provider error details", async () => {
    const broken: AnalysisRepository = {
      async getSnapshot() { throw new Error("SENSITIVE_PROVIDER_DETAIL"); },
    };
    renderPage("/analysis/youtube/channel/" + CHANNEL, broken);
    expect(await screen.findAllByText("조회 오류 — 합산 불가"))
      .toHaveLength(2);
    expect(screen.queryByText("SENSITIVE_PROVIDER_DETAIL")).not.toBeInTheDocument();
  });
});
