
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
});
