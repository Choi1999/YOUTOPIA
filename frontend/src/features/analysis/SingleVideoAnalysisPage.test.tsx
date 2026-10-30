
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AnalysisRepositoryProvider } from "../../features/analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../../features/analysis/data/DemoAnalysisRepository";
import type { AnalysisRepository } from "../../features/analysis/data/AnalysisRepository";

import { SingleVideoAnalysisPage } from "../../pages/analysis/SingleVideoAnalysisPage";

import { demoReadySnapshot } from "./data/demoReadySnapshot";

function renderPage(
  path: string,
  repository: AnalysisRepository = demoAnalysisRepository,
) {
  return render(
    <AnalysisRepositoryProvider repository={repository}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/analysis/youtube/video/:videoId"
            element={<SingleVideoAnalysisPage />}
          />
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>
  );
}

/**
 * 상태별 화면 검증을 위한 테스트 전용 Repository.
 * 실제 데모 Repository의 동작은 변경하지 않는다.
 */
function repositoryWithStatus(
  status: "PARTIAL" | "NO_DATA" | "POLICY_BLOCKED",
): AnalysisRepository {
  const isPartial = status === "PARTIAL";

  return {
    async getSnapshot(target) {
      return {
        kind: "FOUND",
        snapshot: {
          ...demoReadySnapshot,
          target,
          status,

          sample: isPartial
            ? {
                rawCount: 75,
                eligibleCount: 60,
                excludedCount: 15,
                classifiedCount: 45,
                unclassifiedCount: 15,
              }
            : null,

          sentiment: isPartial
            ? { positive: 20, neutral: 15, negative: 10 }
            : null,

          topics: isPartial
            ? [{
                topicId: "RECIPE",
                mentionCount: 25,
                classifiedTopicCount: 21,
                negativeTopicCount: 2,
              }]
            : [],

          observedAt: isPartial
            ? demoReadySnapshot.observedAt
            : null,

          analyzedAt: isPartial
            ? demoReadySnapshot.analyzedAt
            : null,
        },
      };
    },
  };
}

describe("SingleVideoAnalysisPage", () => {
  it("정상적인 영상 ID를 조회하고 미제공 상태를 표시한다", async () => {
    renderPage("/analysis/youtube/video/Zb0_-123xyz");

    expect(
      await screen.findByText("분석 데이터가 아직 제공되지 않습니다.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("status")
    ).toHaveTextContent("실제 댓글 수집");
  });

  it("유효하지 않은 영상 ID를 거부한다", () => {
    renderPage("/analysis/youtube/video/invalid");

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent("영상 식별자 형식");
  });

  it("Repository 조회 오류를 안전하게 표시한다", async () => {
    const failingRepository: AnalysisRepository = {
      async getSnapshot() {
        throw new Error("TEST_REPOSITORY_ERROR");
      },
    };

    renderPage(
      "/analysis/youtube/video/Ab0_-123xyz",
      failingRepository,
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("조회 중 오류");
  });

  it("합성 READY 결과를 실제 분석과 구별해 표시한다", async () => {
  renderPage("/analysis/youtube/video/Ab0_-123xyz");

  expect(
    await screen.findByText("분석 스냅샷 조회 결과")
  ).toBeInTheDocument();

  expect(
    screen.getByText("분석 상태: READY")
  ).toBeInTheDocument();

  expect(
    screen.getByText(
      /합성 데모 데이터이며 실제 YouTube 분석 결과가 아닙니다/
    )
  ).toBeInTheDocument();
});

it("PARTIAL에서는 확인된 범위만 표시한다", async () => {
  renderPage(
    "/analysis/youtube/video/Ab0_-123xyz",
    repositoryWithStatus("PARTIAL"),
  );

  expect(
    await screen.findByText("부분 분석 결과")
  ).toBeInTheDocument();

  expect(
    screen.getByText("원시 댓글: 75건")
  ).toBeInTheDocument();
});

it("NO_DATA에서는 분석 수치를 표시하지 않는다", async () => {
  renderPage(
    "/analysis/youtube/video/Ab0_-123xyz",
    repositoryWithStatus("NO_DATA"),
  );

  expect(
    await screen.findByText("분석할 데이터가 없습니다.")
  ).toBeInTheDocument();

  expect(
    screen.queryByText(/원시 댓글:/)
  ).not.toBeInTheDocument();
});

it("POLICY_BLOCKED에서는 분석 수치를 노출하지 않는다", async () => {
  renderPage(
    "/analysis/youtube/video/Ab0_-123xyz",
    repositoryWithStatus("POLICY_BLOCKED"),
  );

  expect(
    await screen.findByText("정책상 분석 결과를 제공할 수 없습니다.")
  ).toBeInTheDocument();

  expect(
    screen.queryByText(/원시 댓글:/)
  ).not.toBeInTheDocument();
});

it("READY 감성 비율을 분류 완료 80건 기준으로 표시한다", async () => {
  renderPage("/analysis/youtube/video/Ab0_-123xyz");

  expect(
    await screen.findByText("긍정: 62.5%")
  ).toBeInTheDocument();

  expect(
    screen.getByText("중립: 25.0%")
  ).toBeInTheDocument();

  expect(
    screen.getByText("부정: 12.5%")
  ).toBeInTheDocument();

  expect(
    screen.getByText("감성 비율 분모: 분류 완료 80건")
  ).toBeInTheDocument();
});

it("표본 건수가 모순되면 감성 비율을 숨긴다", async () => {
  const invalidRepository: AnalysisRepository = {
    async getSnapshot(target) {
      return {
        kind: "FOUND",
        snapshot: {
          ...demoReadySnapshot,
          target,
          sample: {
            rawCount: 121,
            eligibleCount: 100,
            excludedCount: 20,
            classifiedCount: 80,
            unclassifiedCount: 20,
          },
        },
      };
    },
  };

  renderPage(
    "/analysis/youtube/video/Ab0_-123xyz",
    invalidRepository,
  );

  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent("검증되지 않은 분석 결과");

  expect(
    screen.queryByText(/긍정:/)
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText(/원시 댓글:/)
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText(/스냅샷 ID:/)
  ).not.toBeInTheDocument();
});


it("Web Projection의 스냅샷과 주제 정보를 표시한다", async () => {
  renderPage("/analysis/youtube/video/Ab0_-123xyz");

  expect(
    await screen.findByText("분석 스냅샷 조회 결과")
  ).toBeInTheDocument();

  expect(
    screen.getByText(/스냅샷 ID:/)
  ).toHaveTextContent("synthetic-one-video-001");

  expect(
    screen.getByText(/관측 기간:/)
  ).toHaveTextContent("2026-10-01");

  expect(
    screen.getByText("RECIPE: 38건")
  ).toBeInTheDocument();

  expect(
    screen.getByText("PRICE: 22건")
  ).toBeInTheDocument();
});

it("STALE Projection에서는 이전 분석 수치를 숨긴다", async () => {
  const repository: AnalysisRepository = {
    async getSnapshot(target) {
      return {
        kind: "FOUND",
        snapshot: {
          ...demoReadySnapshot,
          target,
          status: "STALE",
        },
      };
    },
  };

  renderPage(
    "/analysis/youtube/video/Ab0_-123xyz",
    repository,
  );

  expect(
    await screen.findByText("오래된 분석 결과")
  ).toBeInTheDocument();

  expect(
    screen.getByRole("note")
  ).toHaveTextContent("감성 비율과 표본 수치");

  expect(
    screen.queryByText(/긍정:/)
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText(/원시 댓글:/)
  ).not.toBeInTheDocument();
});

it("PARTIAL의 분모가 미확정이면 수치를 표시하지 않는다", async () => {
  const repository: AnalysisRepository = {
    async getSnapshot(target) {
      return {
        kind: "FOUND",
        snapshot: {
          ...demoReadySnapshot,
          target,
          status: "PARTIAL",
          sample: {
            rawCount: 120,
            eligibleCount: 100,
            excludedCount: 20,
            classifiedCount: null,
            unclassifiedCount: null,
          },
        },
      };
    },
  };

  renderPage(
    "/analysis/youtube/video/Ab0_-123xyz",
    repository,
  );

  expect(
    await screen.findByText("부분 분석 결과")
  ).toBeInTheDocument();

  expect(
    screen.getByRole("note")
  ).toHaveTextContent("정합성을 검증할 수 없어");

  expect(
    screen.queryByText(/긍정:/)
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText(/원시 댓글:/)
  ).not.toBeInTheDocument();
});
});
