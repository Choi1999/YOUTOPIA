import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { VideoComparisonPage } from "../../pages/analysis/VideoComparisonPage";
import { SingleVideoAnalysisPage } from "../../pages/analysis/SingleVideoAnalysisPage";
import type { AnalysisRepository, AnalysisLookupResult } from "./data/AnalysisRepository";
import { AnalysisRepositoryProvider } from "./data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "./data/DemoAnalysisRepository";
import { demoComparisonSnapshot } from "./data/demoComparisonSnapshot";

const A = "Ab0_-123xyz";
const B = "Qb0_-123xyz";
const UNKNOWN = "Zb0_-123xyz";

function QuerySwitcher() {
  const navigate = useNavigate();
  return (
    <button type="button"
      onClick={() => navigate("/analysis/youtube/compare?video=" + B + "&video=" + A)}>
      테스트: 동일 페이지 공유 링크 전환
    </button>
  );
}

function renderPage(
  location = "/analysis/youtube/compare",
  repository: AnalysisRepository = demoAnalysisRepository,
  showQuerySwitcher = false,
) {
  return render(
    <AnalysisRepositoryProvider repository={repository}>
      <MemoryRouter initialEntries={[location]}>
        <Routes>
          <Route path="/analysis/youtube/compare" element={
            <>
              {showQuerySwitcher && <QuerySwitcher />}
              <VideoComparisonPage />
            </>
          } />
          <Route path="/analysis/youtube/video/:videoId"
            element={<SingleVideoAnalysisPage />} />
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

  it("YU-39: 잘못된 비교 쿼리는 안전하게 빈 목록으로 시작한다", async () => {
    renderPage("/analysis/youtube/compare?video=../../bad");
    expect(screen.getByText(/공유 링크의 영상 ID나 매개변수가 올바르지 않습니다/))
      .toBeInTheDocument();
    expect(screen.getByText("목록이 비어 있습니다. 영상 ID를 추가하세요."))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "감성 분포 비교" }))
      .not.toBeInTheDocument();
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

  it("YU-38: watch URL을 안전하게 영상 ID로 정규화하고 미등록 데이터는 생성하지 않는다", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "감성 분포 비교" });

    fireEvent.change(screen.getByLabelText("영상 ID 추가"), {
      target: { value: "https://www.youtube.com/watch?v=" + UNKNOWN + "&t=30" },
    });
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByText("분석 데이터 미제공")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + UNKNOWN }))
      .toBeInTheDocument();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(3);
  });

  it("YU-38: 다중 URL을 한 번에 추가하되 실제 합성 두 영상만 비교한다", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "목록에서 제거 " + A }));
    await user.click(screen.getByRole("button", { name: "목록에서 제거 " + B }));
    const input = screen.getByLabelText("영상 ID 추가");
    fireEvent.change(input, {
      target: { value: "https://youtu.be/" + A + "?si=demo\nhttps://youtube.com/watch?v=" + B },
    });
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(await screen.findByRole("heading", { name: "감성 분포 비교" }))
      .toBeInTheDocument();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + A }))
      .toBeChecked();
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + B }))
      .toBeChecked();
    expect(input).toHaveValue("");
  });

  it("YU-38: 혼합된 악성 URL은 일괄 등록하지 않는다", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText("영상 ID 추가");
    fireEvent.change(input, {
      target: { value: "https://youtu.be/" + UNKNOWN + "\nhttps://youtube.com.evil.test/watch?v=" + A },
    });
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText(/2번째 입력: 허용되지 않은 URL/))
      .toBeInTheDocument();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(2);
    expect(screen.queryByRole("checkbox", { name: "비교 선택 " + UNKNOWN }))
      .not.toBeInTheDocument();
  });

  it("YU-38: 기존 목록과 중복되는 공유 링크는 전체 배치를 거부한다", async () => {
    const user = userEvent.setup();
    renderPage();
    fireEvent.change(screen.getByLabelText("영상 ID 추가"), {
      target: { value: "https://youtu.be/" + A + "\n" + UNKNOWN },
    });
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("이미 목록에 추가한 영상입니다.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "비교 선택 " + UNKNOWN }))
      .not.toBeInTheDocument();
  });

  it("YU-38: shorts URL은 기존 정책에 따라 명시적으로 거부한다", async () => {
    const user = userEvent.setup();
    renderPage();
    fireEvent.change(screen.getByLabelText("영상 ID 추가"), {
      target: { value: "https://youtube.com/shorts/" + UNKNOWN },
    });
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText(/허용되지 않은 URL/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(2);
  });

  it("YU-39: two-video share URL restores the exact A/B order and verified results", async () => {
    renderPage("/analysis/youtube/compare?video=" + B + "&video=" + A);
    expect(await screen.findByRole("heading", { name: "차이 한눈에 보기" }))
      .toBeInTheDocument();
    expect(screen.getByText("영상 B의 긍정 비율은 영상 A보다 22.5%p 높습니다."))
      .toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + A })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + B })).toBeChecked();
    const link = screen.getByRole("textbox", { name: "비교 공유 링크" });
    expect(link).toHaveAttribute("readonly");
    expect(link).toHaveValue(window.location.origin +
      "/analysis/youtube/compare?video=" + B + "&video=" + A);
  });

  it("YU-39: single Side Panel URL handoff shows one item and no share link", async () => {
    renderPage("/analysis/youtube/compare?video=" + B);
    expect(await screen.findByText("비교할 영상 두 개를 선택하세요."))
      .toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + B })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "비교 선택 " + A }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "비교 공유 링크" }))
      .not.toBeInTheDocument();
  });

  it.each([
    "?video=" + A + "&video=" + A,
    "?video=" + A + "&video=" + B + "&video=Zb0_-123xyz",
    "?video=" + A + "&token=secret",
  ])("YU-39: malformed share query is rejected without implicit fallback: %s", query => {
    renderPage("/analysis/youtube/compare" + query);
    expect(screen.getByText(/공유 링크의 영상 ID나 매개변수가 올바르지 않습니다/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "차이 한눈에 보기" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "비교 공유 링크" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "분석 대상 영상 목록" })
      .querySelectorAll("li")).toHaveLength(0);
  });

  it("YU-39: selection swap updates the canonical share URL, then clears on unselect", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "감성 분포 비교" });
    const link = screen.getByRole("textbox", { name: "비교 공유 링크" });
    expect(link).toHaveValue(window.location.origin +
      "/analysis/youtube/compare?video=" + A + "&video=" + B);
    await user.click(screen.getByRole("button", { name: "A/B 순서 바꾸기" }));
    expect(link).toHaveValue(window.location.origin +
      "/analysis/youtube/compare?video=" + B + "&video=" + A);
    await user.click(screen.getByRole("button", { name: "비교 선택 해제" }));
    expect(screen.queryByRole("textbox", { name: "비교 공유 링크" }))
      .not.toBeInTheDocument();
  });

  it("YU-39: share link exposes no comment text, token or source metadata", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "감성 분포 비교" });
    const link = screen.getByRole("textbox", { name: "비교 공유 링크" });
    const url = new URL((link as HTMLInputElement).value);
    expect([...url.searchParams.keys()]).toEqual(["video", "video"]);
    expect(url.searchParams.getAll("video")).toEqual([A, B]);
    expect(url.hash).toBe("");
    expect(url.search).not.toContain("token");
    expect(screen.getByText(/현재 localhost 실행 환경에서만 열 수 있습니다/))
      .toBeInTheDocument();
  });

  it("YU-40: 비교 목록에서 상세로 이동한 후 같은 A/B 순서로 돌아온다", async () => {
    const user = userEvent.setup();
    renderPage("/analysis/youtube/compare?video=" + B + "&video=" + A);
    await screen.findByRole("heading", { name: "차이 한눈에 보기" });
    const links = within(screen.getByRole("list", { name: "분석 대상 영상 목록" }))
      .getAllByRole("link", { name: "상세 보기" });
    await user.click(links[0]);
    expect(await screen.findByRole("heading", { name: "영상 상세 분석" }))
      .toBeInTheDocument();
    const back = screen.getByRole("link", {
      name: "선택한 두 영상 비교로 돌아가기",
    });
    expect(back).toHaveAttribute("href",
      "/analysis/youtube/compare?video=" + B + "&video=" + A);
    await user.click(back);
    expect(await screen.findByText("영상 B의 긍정 비율은 영상 A보다 22.5%p 높습니다."))
      .toBeInTheDocument();
  });

  it("YU-40: 같은 비교 화면에서 URL만 변경해도 선택과 분석이 갱신된다", async () => {
    const user = userEvent.setup();
    renderPage("/analysis/youtube/compare?video=" + A + "&video=" + B,
      demoAnalysisRepository, true);
    expect(await screen.findByText("영상 B의 긍정 비율은 영상 A보다 22.5%p 낮습니다."))
      .toBeInTheDocument();
    await user.click(screen.getByRole("button", {
      name: "테스트: 동일 페이지 공유 링크 전환",
    }));
    expect(await screen.findByText("영상 B의 긍정 비율은 영상 A보다 22.5%p 높습니다."))
      .toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "비교 공유 링크" }))
      .toHaveValue(window.location.origin +
        "/analysis/youtube/compare?video=" + B + "&video=" + A);
  });

  it("YU-40: 일반 상세 화면에서는 한 영상만 비교 목록으로 전달한다", async () => {
    const user = userEvent.setup();
    renderPage("/analysis/youtube/video/" + A);
    expect(await screen.findByRole("heading", { name: "영상 상세 분석" }))
      .toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "이 영상을 비교 목록에 추가" }));
    expect(await screen.findByText("비교할 영상 두 개를 선택하세요."))
      .toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "비교 선택 " + A }))
      .toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "비교 선택 " + B }))
      .not.toBeInTheDocument();
  });

  it("YU-40: 상세 화면의 악성/불일치 쿼리는 반사하지 않는다", async () => {
    renderPage("/analysis/youtube/video/" + A +
      "?video=" + B + "&video=Zb0_-123xyz");
    expect(await screen.findByRole("heading", { name: "영상 상세 분석" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "선택한 두 영상 비교로 돌아가기" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이 영상을 비교 목록에 추가" }))
      .toHaveAttribute("href", "/analysis/youtube/compare?video=" + A);
  });

  it("YU-43: only a validated READY synthetic comparison exposes CSV download", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "비교 결과 내보내기" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "합성 비교 CSV 다운로드" }))
      .toBeEnabled();
    expect(screen.getByText(/실제 YouTube 댓글 원문이나 개인 정보는 포함되지 않습니다/))
      .toBeInTheDocument();
  });

  it("YU-43: blocked PARTIAL comparison cannot export any metrics", async () => {
    renderPage("/analysis/youtube/compare", resultWithB({
      status: "PARTIAL",
    }));
    expect(await screen.findByText(/두 영상 모두 검증된 READY 상태여야 합니다/))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "합성 비교 CSV 다운로드" }))
      .not.toBeInTheDocument();
  });

  it("YU-43: clicking CSV export uses a local Blob, fixed filename and no fetch", async () => {
    const user = userEvent.setup();
    const beforeCreate = URL.createObjectURL;
    const beforeRevoke = URL.revokeObjectURL;
    const mockedCreate = vi.fn((_blob: Blob) => "blob:yu43-local-demo");
    const mockedRevoke = vi.fn();
    let clickedFileName = "";
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true, writable: true, value: mockedCreate,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true, writable: true, value: mockedRevoke,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function(this: HTMLAnchorElement) {
        clickedFileName = this.download;
      });
    try {
      renderPage();
      const button = await screen.findByRole("button", {
        name: "합성 비교 CSV 다운로드",
      });
      await user.click(button);
      expect(clickedFileName).toBe("youtopia-synthetic-video-comparison.csv");
      expect(mockedCreate).toHaveBeenCalledTimes(1);
      const blob = mockedCreate.mock.calls[0]?.[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob?.type).toBe("text/csv;charset=utf-8");
      expect(blob?.size).toBeGreaterThan(0);
      expect(screen.getByText(/합성 데모 비교 CSV 저장을 시작했습니다/))
        .toBeInTheDocument();
    } finally {
      clickSpy.mockRestore();
      if (beforeCreate) URL.createObjectURL = beforeCreate;
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (beforeRevoke) URL.revokeObjectURL = beforeRevoke;
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

});
