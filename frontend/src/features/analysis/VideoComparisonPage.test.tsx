import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { VideoComparisonPage } from "../../pages/analysis/VideoComparisonPage";
import type { AnalysisRepository, AnalysisLookupResult } from "./data/AnalysisRepository";
import { AnalysisRepositoryProvider } from "./data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "./data/DemoAnalysisRepository";
import { demoComparisonSnapshot } from "./data/demoComparisonSnapshot";

const A = "Ab0_-123xyz";
const B = "Qb0_-123xyz";
const UNKNOWN = "Zb0_-123xyz";

function renderPage(
  location = "/analysis/youtube/compare",
  repository: AnalysisRepository = demoAnalysisRepository,
) {
  return render(
    <AnalysisRepositoryProvider repository={repository}>
      <MemoryRouter initialEntries={[location]}>
        <Routes>
          <Route path="/analysis/youtube/compare"
            element={<VideoComparisonPage />} />
          <Route path="/analysis/youtube/video/:videoId"
            element={<p>상세 분석 페이지</p>} />
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}

function resultWithB(
  override: Partial<typeof demoComparisonSnapshot>,
): AnalysisRepository {
  return {
    async getSnapshot(target) {
      if (target.targetId === B) {
        return {
          kind: "FOUND",
          snapshot: { ...demoComparisonSnapshot, ...override },
        };
      }
      return demoAnalysisRepository.getSnapshot(target);
    },
  };
}

describe("YU-35 — 영상 목록 및 비교 Web UX", () => {
  it("기본 합성 두 영상에서 감성·주제 비교를 실제 화면에 표시한다", async () => {
    renderPage();

    expect(await screen.findByRole("heading", {
      name: "감성 분포 비교",
    })).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "두 영상 비교" });
    expect(within(panel).getByRole("img", {
      name: /영상 A 긍정 62.5% 중립 25.0% 부정 12.5%/,
    })).toBeInTheDocument();
    expect(within(panel).getByRole("img", {
      name: /영상 B 긍정 40.0% 중립 35.0% 부정 25.0%/,
    })).toBeInTheDocument();

    const topics = within(panel).getByRole("list", {
      name: "주제별 영상 비교",
    });
    expect(within(topics).getByText("DELIVERY")).toBeInTheDocument();
    expect(within(topics).getByRole("img", {
      name: "DELIVERY 영상 A 언급 0건",
    })).toBeInTheDocument();

    expect(screen.getByText(/실제 YouTube 댓글을 수집하거나 분석하지 않습니다/))
      .toBeInTheDocument();
    expect(screen.getByText(/합성 DEMO · 실제 YouTube 반응이나 시계열/))
      .toBeInTheDocument();
  });

  it("목록에 등록되지 않은 영상은 임의 수치가 아니라 데이터 미제공으로 표시한다", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "감성 분포 비교" });
    await user.type(screen.getByLabelText("영상 ID 추가"), UNKNOWN);
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByText("분석 데이터 미제공")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + UNKNOWN }))
      .toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "비교 선택 " + B }));
    await user.click(screen.getByRole("checkbox", { name: "비교 선택 " + UNKNOWN }));
    expect(screen.getByText(/데이터가 미제공되었거나 검증되지 않아 비교할 수 없습니다/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "감성 분포 비교" }))
      .not.toBeInTheDocument();
  });

  it("목록에서 영상 삭제 후 선택과 비교 결과도 정리한다", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "감성 분포 비교" });
    await user.click(screen.getByRole("button", {
      name: "목록에서 제거 " + B,
    }));
    expect(screen.getByText(/비교할 영상 두 개를 선택하세요/))
      .toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /영상 B 긍정/ }))
      .not.toBeInTheDocument();

    const list = screen.getByRole("list", { name: "분석 대상 영상 목록" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText(A)).toBeInTheDocument();
  });

  it("URL에서 전달된 영상 1개만 초기 선택하고, 명시적 두 번째 추가 후 비교한다", async () => {
    const user = userEvent.setup();
    renderPage("/analysis/youtube/compare?video=" + B);

    await screen.findByText("비교할 영상 두 개를 선택하세요.");
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + B }))
      .toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "비교 선택 " + A }))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole("button", {
      name: A + " 추가",
    }));
    expect(await screen.findByRole("heading", { name: "감성 분포 비교" }))
      .toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + A }))
      .toBeChecked();
  });

  it("잘못된 입력/중복 ID를 차단하고 목록에 추가하지 않는다", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText("영상 ID 추가");
    await user.type(input, "https://evil.example/");
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText(/영상 ID는 영문·숫자·하이픈·밑줄/))
      .toBeInTheDocument();

    await user.clear(input);
    await user.type(input, A);
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("이미 목록에 추가한 영상입니다."))
      .toBeInTheDocument();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(2);
  });

  it("PARTIAL은 별도 검증된 감성 비율이 있더라도 비교 수치를 차단한다", async () => {
    renderPage("/analysis/youtube/compare", resultWithB({
      status: "PARTIAL",
    }));
    expect(await screen.findByText(/두 영상 모두 검증된 READY 상태여야 합니다/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "감성 분포 비교" }))
      .not.toBeInTheDocument();
  });

  it("관측 기간이 다른 영상은 비교를 막고 구체적인 원인을 보여준다", async () => {
    renderPage("/analysis/youtube/compare", resultWithB({
      scope: {
        ...demoComparisonSnapshot.scope,
        windowStart: "2026-09-01T00:00:00+09:00",
      },
    }));
    expect(await screen.findByText(/관측 기간 또는 언어·범위가 달라/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "주제별 언급량 비교" }))
      .not.toBeInTheDocument();
  });

  it("분석 시각 차이는 비교 제한으로 명확히 표시한다", async () => {
    renderPage("/analysis/youtube/compare", resultWithB({
      analyzedAt: "2026-10-09T09:20:00+09:00",
    }));
    expect(await screen.findByText(/분석·관측 시점이 일치하지 않아/))
      .toBeInTheDocument();
  });

  it("가짜 쿼리 ID는 분석을 시작하지 않고 명시적 예시만 보여준다", async () => {
    renderPage("/analysis/youtube/compare?video=../../bad");
    expect(await screen.findByRole("heading", { name: "감성 분포 비교" }))
      .toBeInTheDocument();
    expect(screen.queryByText("../../bad")).not.toBeInTheDocument();
  });

  it("늦게 완료된 제거 대상 조회가 새 비교를 덮어쓰지 않는다", async () => {
    const user = userEvent.setup();
    const deferred: { resolve?: (value: AnalysisLookupResult) => void } = {};
    const repository: AnalysisRepository = {
      async getSnapshot(target) {
        if (target.targetId !== B) {
          return demoAnalysisRepository.getSnapshot(target);
        }
        return new Promise<AnalysisLookupResult>(resolve => {
          deferred.resolve = resolve;
        });
      },
    };

    renderPage("/analysis/youtube/compare", repository);
    await user.click(screen.getByRole("button", { name: "목록에서 제거 " + B }));
    expect(screen.getByText("비교할 영상 두 개를 선택하세요."))
      .toBeInTheDocument();

    const pending = deferred.resolve;
    if (!pending) throw new Error("Expected deferred comparison read");
    await act(async () => {
      pending({ kind: "FOUND", snapshot: demoComparisonSnapshot });
    });

    expect(screen.queryByRole("heading", { name: "감성 분포 비교" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(1);
  });
});
