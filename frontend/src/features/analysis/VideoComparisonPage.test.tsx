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
  it("YU-36: 검증된 두 영상의 B − A 감성 차이와 주제 차이를 표시한다", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "차이 한눈에 보기" }))
      .toBeInTheDocument();
    expect(screen.getByText("영상 B의 긍정 비율은 영상 A보다 22.5%p 낮습니다."))
      .toBeInTheDocument();
    expect(screen.getByText("-22.5%p")).toBeInTheDocument();
    expect(screen.getByText("+10.0%p")).toBeInTheDocument();
    expect(screen.getByText("+12.5%p")).toBeInTheDocument();
    expect(screen.getByText("B − A: +13건")).toBeInTheDocument();
    expect(screen.getByText("B − A: -13건")).toBeInTheDocument();
    expect(screen.getByText(/통계적 유의성을 뜻하지 않습니다/))
      .toBeInTheDocument();
  });

  it("YU-36: 호환되지 않는 관측 범위는 차이 카드도 표시하지 않는다", async () => {
    renderPage("/analysis/youtube/compare", resultWithB({
      scope: {
        ...demoComparisonSnapshot.scope,
        windowEnd: "2026-10-09T00:00:00+09:00",
      },
    }));
    expect(await screen.findByText(/관측 기간 또는 언어·범위가 달라/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "차이 한눈에 보기" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/22.5%p/)).not.toBeInTheDocument();
  });

  it("YU-37: A/B 순서를 바꾸면 차이 부호도 바뀌고 목록은 유지된다", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("영상 B의 긍정 비율은 영상 A보다 22.5%p 낮습니다."))
      .toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "A/B 순서 바꾸기" }));
    expect(screen.getByText("영상 B의 긍정 비율은 영상 A보다 22.5%p 높습니다."))
      .toBeInTheDocument();
    expect(screen.getByText("+22.5%p")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /영상 A 긍정 40.0%/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(2);
  });

  it("YU-37: 비교 선택 해제는 임시 목록을 삭제하지 않으며 재선택 가능하다", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "감성 분포 비교" });
    await user.click(screen.getByRole("button", { name: "비교 선택 해제" }));
    expect(screen.getByText("비교할 영상 두 개를 선택하세요."))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "차이 한눈에 보기" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A/B 순서 바꾸기" }))
      .toBeDisabled();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(2);

    await user.click(screen.getByRole("checkbox", { name: "비교 선택 " + B }));
    await user.click(screen.getByRole("checkbox", { name: "비교 선택 " + A }));
    expect(await screen.findByRole("heading", { name: "차이 한눈에 보기" }))
      .toBeInTheDocument();
  });

  it("YU-37: ID 필터는 현재 선택을 변경하지 않고 목록 표시만 바꾼다", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "감성 분포 비교" });
    const input = screen.getByRole("searchbox", { name: "영상 ID 필터" });
    await user.type(input, A.slice(0, 5));
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "감성 분포 비교" }))
      .toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "not-found");
    expect(screen.getByText(/현재 필터에 맞는 영상이 없습니다/))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "감성 분포 비교" }))
      .toBeInTheDocument();

    await user.clear(input);
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(2);
  });

  it("YU-37: READY 필터는 미제공 영상을 숨기되 등록/선택 상태는 보존한다", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "감성 분포 비교" });
    await user.type(screen.getByLabelText("영상 ID 추가"), UNKNOWN);
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByText("분석 데이터 미제공")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "READY 스냅샷만 표시" }));
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "감성 분포 비교" }))
      .toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "READY 스냅샷만 표시" }));
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("분석 데이터 미제공")).toBeInTheDocument();
  });

  it("YU-37: 등록되지 않은 선택 대상은 구체적인 미제공 이유를 보여준다", async () => {
    const user = userEvent.setup();
    renderPage("/analysis/youtube/compare?video=" + UNKNOWN);
    expect(await screen.findByText("분석 데이터 미제공")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: A + " 추가" }));
    expect(await screen.findByText("영상 " + UNKNOWN + "의 등록된 합성 스냅샷이 없습니다."))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "차이 한눈에 보기" }))
      .not.toBeInTheDocument();
  });

  it("YU-37: 선택된 영상의 Repository 오류는 안전한 원인 안내만 표시한다", async () => {
    const repository: AnalysisRepository = {
      async getSnapshot(target) {
        if (target.targetId === B) throw new Error("PRIVATE_PROVIDER_ERROR");
        return demoAnalysisRepository.getSnapshot(target);
      },
    };
    renderPage("/analysis/youtube/compare", repository);
    expect(await screen.findByText("영상 " + B + "의 데이터 조회에 오류가 발생했습니다."))
      .toBeInTheDocument();
    expect(screen.queryByText("PRIVATE_PROVIDER_ERROR")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "차이 한눈에 보기" }))
      .not.toBeInTheDocument();
  });

  it("YU-37: 검증 실패 스냅샷은 상세 원인을 노출하지 않고 비교를 막는다", async () => {
    renderPage("/analysis/youtube/compare", resultWithB({
      sourceType: "APPROVED_PROVIDER",
      isSynthetic: false,
    }));
    expect(await screen.findByText("영상 " + B + "의 분석 스냅샷을 검증할 수 없습니다."))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "차이 한눈에 보기" }))
      .not.toBeInTheDocument();
  });

  it("YU-37: 두 영상을 모두 제거하면 빈 목록 안내와 선택 해제 상태를 보여준다", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "감성 분포 비교" });
    await user.click(screen.getByRole("button", { name: "목록에서 제거 " + A }));
    await user.click(screen.getByRole("button", { name: "목록에서 제거 " + B }));
    expect(screen.getByText("목록이 비어 있습니다. 영상 ID를 추가하세요."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "비교 선택 해제" }))
      .toBeDisabled();
    expect(screen.queryByRole("heading", { name: "감성 분포 비교" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: A + " 추가" }))
      .toBeEnabled();
  });

});
