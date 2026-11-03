import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AnalysisRepositoryProvider } from "./data/AnalysisRepositoryContext";
import type { AnalysisRepository } from "./data/AnalysisRepository";
import { demoAnalysisRepository } from "./data/DemoAnalysisRepository";
import { demoReadySnapshot } from "./data/demoReadySnapshot";
import { SingleVideoAnalysisPage } from "../../pages/analysis/SingleVideoAnalysisPage";
import type { AnalysisSnapshot } from "./model/analysisSnapshot";

const PAGE = "/analysis/youtube/video/Ab0_-123xyz";

function renderAnalysis(repository: AnalysisRepository = demoAnalysisRepository) {
  return render(
    <AnalysisRepositoryProvider repository={repository}>
      <MemoryRouter initialEntries={[PAGE]}>
        <Routes>
          <Route path="/analysis/youtube/video/:videoId"
            element={<SingleVideoAnalysisPage />} />
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}

function fromSnapshot(
  overrides: Partial<AnalysisSnapshot>,
): AnalysisRepository {
  return {
    async getSnapshot(target) {
      return {
        kind: "FOUND",
        snapshot: { ...demoReadySnapshot, ...overrides, target },
      };
    },
  };
}

describe("YU-34 — 웹 영상 상세 분석 시각화", () => {
  it("READY에서 검증된 80건 분모만 시각화하고 합성 데이터로 명시한다", async () => {
    renderAnalysis();

    expect(await screen.findByRole("heading", {
      name: "분석 스냅샷 조회 결과",
    })).toBeInTheDocument();

    const chart = screen.getByRole("img", { name: /가상 감성 분포:/ });
    expect(chart).toHaveAttribute("aria-label",
      expect.stringContaining("분류 완료 80건 기준"));

    expect(chart.querySelector(".analysis-sentiment__positive"))
      .toHaveStyle({ width: "62.5%" });
    expect(chart.querySelector(".analysis-sentiment__neutral"))
      .toHaveStyle({ width: "25%" });
    expect(chart.querySelector(".analysis-sentiment__negative"))
      .toHaveStyle({ width: "12.5%" });

    expect(screen.getByText("원시 댓글: 120건")).toBeInTheDocument();
    expect(screen.getByText("감성 비율 분모: 분류 완료 80건"))
      .toBeInTheDocument();
    expect(screen.getByText(/합성 데모 데이터이며 실제 YouTube 분석 결과가 아닙니다/))
      .toBeInTheDocument();
    expect(screen.getByText("STATIC FIXTURE · 합성 DEMO"))
      .toBeInTheDocument();
    expect(screen.getByText("분석 상태: READY")).toBeInTheDocument();
  });

  it("검증된 주제 언급량을 내림차순으로 표시하고 막대를 점유율로 오인하지 않게 한다", async () => {
    renderAnalysis(fromSnapshot({
      topics: [...demoReadySnapshot.topics].reverse(),
    }));
    expect(await screen.findByRole("heading", {
      name: "분석 스냅샷 조회 결과",
    })).toBeInTheDocument();

    const topics = screen.getByRole("list", { name: "주제별 언급량" });
    const rows = within(topics).getAllByRole("listitem");
    expect(within(rows[0]).getByText("RECIPE: 38건")).toBeInTheDocument();
    expect(within(rows[1]).getByText("PRICE: 22건")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("img", { name: /RECIPE 언급 38건/ })
      .querySelector(".analysis-topics__fill")).toHaveStyle({ width: "100%" });
    expect(within(rows[1]).getByRole("img", { name: /PRICE 언급 22건/ })
      .querySelector(".analysis-topics__fill")).toHaveStyle({
        width: String(22 / 38 * 100) + "%",
      });
    expect(screen.getByText(/막대 길이는 가장 많이 언급된 주제 기준 상대 길이/))
      .toHaveTextContent("댓글 점유율이 아닙니다");
  });

  it("화면 탐색 링크는 실제 표시되는 섹션만 가리킨다", async () => {
    renderAnalysis();
    expect(await screen.findByRole("heading", { name: "분석 스냅샷 조회 결과" }))
      .toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "분석 항목 이동" });
    expect(within(nav).getByRole("link", { name: "감성 분포" }))
      .toHaveAttribute("href", "#analysis-sentiment");
    expect(within(nav).getByRole("link", { name: "주제별 언급" }))
      .toHaveAttribute("href", "#analysis-topics");
    expect(within(nav).getByRole("link", { name: "분석 근거" }))
      .toHaveAttribute("href", "#analysis-evidence");
    expect(screen.getByText(/스냅샷 ID:/)).toHaveTextContent("synthetic-one-video-001");
  });

  it("PARTIAL은 실제 검증된 분모의 합성 결과만 차트로 보여준다", async () => {
    renderAnalysis(fromSnapshot({
      status: "PARTIAL",
      sample: {
        rawCount: 75, eligibleCount: 60, excludedCount: 15,
        classifiedCount: 45, unclassifiedCount: 15,
      },
      sentiment: { positive: 20, neutral: 15, negative: 10 },
      topics: [{
        topicId: "RECIPE", mentionCount: 25,
        classifiedTopicCount: 21, negativeTopicCount: 2,
      }],
    }));
    expect(await screen.findByRole("heading", { name: "부분 분석 결과" }))
      .toBeInTheDocument();
    expect(screen.getByText("원시 댓글: 75건")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /가상 감성 분포:/ }))
      .toHaveAttribute("aria-label", expect.stringContaining("분류 완료 45건 기준"));
    expect(screen.getByText("적격 표본 중 감성 분류 비율: 75.0%"))
      .toBeInTheDocument();
  });

  it("STALE은 근거만 표시하고 감성·주제 수치와 탐색 링크를 노출하지 않는다", async () => {
    renderAnalysis(fromSnapshot({ status: "STALE" }));
    expect(await screen.findByRole("heading", { name: "오래된 분석 결과" }))
      .toBeInTheDocument();
    expect(screen.getByText(/스냅샷 ID:/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /가상 감성 분포:/ }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "주제별 언급량" }))
      .not.toBeInTheDocument();
    const nav=screen.getByRole("navigation", { name: "분석 항목 이동" });
    expect(within(nav).queryByRole("link", { name: "감성 분포" }))
      .not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "주제별 언급" }))
      .not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "분석 근거" }))
      .toBeInTheDocument();
  });

  it.each(["NO_DATA", "POLICY_BLOCKED"] as const)(
    "%s는 분포 차트와 주제·근거 영역을 숨긴다",
    async status => {
      renderAnalysis(fromSnapshot({
        status, sample: null, sentiment: null, topics: [],
        observedAt: null, analyzedAt: null,
      }));
      expect(await screen.findByText("분석 상태: " + status))
        .toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /가상 감성 분포/ }))
        .not.toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "주제별 언급량" }))
        .not.toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "분석 항목 이동" }))
        .not.toBeInTheDocument();
      expect(screen.queryByText(/스냅샷 ID:/))
        .not.toBeInTheDocument();
    },
  );

  it("PARTIAL의 분모 미확정 상태는 주제도 함께 숨기고 상태 안내만 제공한다", async () => {
    renderAnalysis(fromSnapshot({
      status: "PARTIAL",
      sample: {
        rawCount: 120, eligibleCount: 100, excludedCount: 20,
        classifiedCount: null, unclassifiedCount: null,
      },
    }));
    expect(await screen.findByRole("heading", { name: "부분 분석 결과" }))
      .toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("정합성을 검증할 수 없어");
    expect(screen.queryByRole("img", { name: /가상 감성 분포:/ }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "주제별 언급량" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/원시 댓글:/))
      .not.toBeInTheDocument();
  });

  it("원본에 없는 시계열을 만들거나 네트워크 요청을 시작하지 않는다", async () => {
    renderAnalysis();
    expect(await screen.findByRole("heading", { name: "감성 분포" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /일별 추이|시간별 변화/ }))
      .not.toBeInTheDocument();
    expect(screen.getByText("합성 데모 데이터이며 실제 YouTube 분석 결과가 아닙니다."))
      .toBeInTheDocument();
  });
});
