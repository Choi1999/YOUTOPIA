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
  it("YU-45: verified two-video set shows exact classified denominator and channel-limited rates", async () => {
    renderPage("/analysis/youtube/channel/" + CHANNEL);
    expect(await screen.findByRole("img", {
      name: /선정 영상 감성 분포: 긍정 51.25%, 중립 30.00%, 부정 18.75%/,
    })).toBeInTheDocument();
    expect(screen.getByText("원시 댓글: 240건")).toBeInTheDocument();
    expect(screen.getByText("적격 댓글: 200건")).toBeInTheDocument();
    expect(screen.getByText("분류 완료: 160건")).toBeInTheDocument();
    expect(screen.getByText("미분류: 40건")).toBeInTheDocument();
    expect(screen.getByText("긍정: 51.25% (82건)")).toBeInTheDocument();
    expect(screen.getByText(/실제 채널의 전체 영상이나/))
      .toBeInTheDocument();
  });

  it("YU-45: topic contributions retain each video's count and multi-label caveat", async () => {
    renderPage("/analysis/youtube/channel/" + CHANNEL);
    const topics = await screen.findByRole("list", {
      name: "채널 선정 영상 주제 언급량",
    });
    expect(within(topics).getByText("RECIPE · 63건")).toBeInTheDocument();
    expect(within(topics).getByText("PRICE · 57건")).toBeInTheDocument();
    expect(within(topics).getByText("DELIVERY · 12건")).toBeInTheDocument();
    const contributions = screen.getByRole("list", {
      name: "영상별 분석 기여도",
    });
    expect(within(contributions).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/주제는 다중 라벨입니다/))
      .toBeInTheDocument();
  });

  it("YU-45: missing one selected VIDEO makes all aggregate metrics unavailable", async () => {
    const missing: AnalysisRepository = {
      async getSnapshot(target) {
        if (target.targetId === "Qb0_-123xyz") return { kind: "NOT_FOUND" };
        return demoAnalysisRepository.getSnapshot(target);
      },
    };
    renderPage("/analysis/youtube/channel/" + CHANNEL, missing);
    expect(await screen.findByText(/선정 영상 중 분석 데이터 미제공/))
      .toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /선정 영상 감성 분포/ }))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/분류 완료: 160건/))
      .not.toBeInTheDocument();
  });

  it("YU-45: PARTIAL and mismatched observation windows fail closed", async () => {
    const repository: AnalysisRepository = {
      async getSnapshot(target) {
        const result = await demoAnalysisRepository.getSnapshot(target);
        if (result.kind !== "FOUND" || target.targetId !== "Qb0_-123xyz")
          return result;
        return {
          kind: "FOUND",
          snapshot: { ...result.snapshot, scope: {
            ...result.snapshot.scope, locale: "en-US",
          } },
        };
      },
    };
    renderPage("/analysis/youtube/channel/" + CHANNEL, repository);
    expect(await screen.findByText(/모든 선정 영상이 동일 조건의 READY 스냅샷이어야 합니다/))
      .toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "채널 선정 영상 주제 언급량" }))
      .not.toBeInTheDocument();
  });

});
