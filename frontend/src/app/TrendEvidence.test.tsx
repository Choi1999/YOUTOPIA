import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  DEMO_COLLECTION_TOTALS,
  DEMO_DAILY_OBSERVATIONS,
} from "../features/project-demo/nexusDemoData";
import {
  canVerifyRealWorldClaim,
  DEMO_CLAIM_REVIEWS,
  DEMO_TREND_OBSERVATION,
  evaluateComparability,
  transitionClaimReview,
} from "../features/project-demo/trendEvidenceModel";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AppRoutes } from "./AppRoutes";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

async function createSuccessfulCollection() {
  const user = userEvent.setup();
  renderAt("/projects/new");
  await user.click(screen.getByRole("button", { name: "데이터 수집 시작 →" }));
  await user.click(screen.getByRole("button", { name: "수집 실행 시뮬레이션" }));
  await user.click(screen.getByRole("button", { name: "완료 시뮬레이션" }));
  return user;
}

describe("YU-08 트렌드 계약", () => {
  it("39일을 14일 전·14일 후·11일 비교창 밖으로 한 번만 분할한다", () => {
    expect(DEMO_TREND_OBSERVATION.coverage.observedDays).toBe(39);
    expect(DEMO_TREND_OBSERVATION.before.days).toBe(14);
    expect(DEMO_TREND_OBSERVATION.after.days).toBe(14);
    expect(DEMO_TREND_OBSERVATION.outsideComparison.days).toBe(11);
    expect(
      DEMO_TREND_OBSERVATION.before.days +
      DEMO_TREND_OBSERVATION.after.days +
      DEMO_TREND_OBSERVATION.outsideComparison.days,
    ).toBe(39);
  });

  it("기존 일별 관측 배열에서 합계를 파생하고 전체 raw 분모와 일치시킨다", () => {
    expect(DEMO_TREND_OBSERVATION.before.rawComments).toBe(3_543);
    expect(DEMO_TREND_OBSERVATION.after.rawComments).toBe(7_244);
    expect(DEMO_TREND_OBSERVATION.outsideComparison.rawComments).toBe(2_055);
    expect(
      DEMO_TREND_OBSERVATION.before.rawComments +
      DEMO_TREND_OBSERVATION.after.rawComments +
      DEMO_TREND_OBSERVATION.outsideComparison.rawComments,
    ).toBe(DEMO_COLLECTION_TOTALS.rawComments);
    expect(DEMO_DAILY_OBSERVATIONS.reduce((sum, item) => sum + item.rawComments, 0)).toBe(12_842);
  });

  it("PASS·WARN·FAIL 조합을 세 가지 비교 가능성으로 결정한다", () => {
    expect(evaluateComparability({ publicationDates: "PASS", videoCohorts: "PASS", coverage: "PASS", measurementConsistency: "PASS" })).toBe("COMPARABLE");
    expect(evaluateComparability({ publicationDates: "WARN", videoCohorts: "PASS", coverage: "PASS", measurementConsistency: "PASS" })).toBe("CONDITIONAL");
    expect(evaluateComparability({ publicationDates: "PASS", videoCohorts: "PASS", coverage: "FAIL", measurementConsistency: "PASS" })).toBe("INCOMPARABLE");
    expect(DEMO_TREND_OBSERVATION.comparability).toBe("CONDITIONAL");
    expect(DEMO_TREND_OBSERVATION.verifiedIncreaseBlocked).toBe(true);
  });
});

describe("YU-09 근거·주장 계약", () => {
  it("PERF-001은 관측 전용이며 실제 결함 승인 시도가 차단된다", () => {
    const perf = DEMO_CLAIM_REVIEWS.find(({ issueId }) => issueId === "PERF-001")!;
    const updated = transitionClaimReview(perf, "ATTEMPT_VERIFY");
    expect(perf.status).toBe("OBSERVED_ONLY");
    expect(updated.status).toBe("BLOCKED");
    expect(updated.realWorldVerified).toBe(false);
    expect(updated.reasonCodes).toContain("TECHNICAL_VALIDATION_REQUIRED");
    expect(canVerifyRealWorldClaim(updated)).toBe(false);
  });

  it("PAY-002는 모든 리뷰 작업에서 증가 승인 없이 HOLD를 유지한다", () => {
    const pay = DEMO_CLAIM_REVIEWS.find(({ issueId }) => issueId === "PAY-002")!;
    for (const action of ["KEEP_OBSERVATION", "PLACE_HOLD", "REQUEST_REVIEW", "ATTEMPT_VERIFY"] as const) {
      const updated = transitionClaimReview(pay, action);
      expect(updated.status).toBe("HOLD");
      expect(updated.realWorldVerified).toBe(false);
      expect(canVerifyRealWorldClaim(updated)).toBe(false);
    }
  });

  it("합성 근거에는 소스 ID·시각·가용성·계보·정책 상태가 있다", () => {
    for (const review of DEMO_CLAIM_REVIEWS) {
      expect(review.evidence.length).toBeGreaterThan(0);
      for (const evidence of review.evidence) {
        expect(evidence.sourceId).not.toBe("");
        expect(evidence.observedAt).toMatch(/^2025-/);
        expect(evidence.retrievedAt).toContain("KST");
        expect(evidence.availability).toBe("SYNTHETIC");
        expect(evidence.lineage).toBe("SIMULATED_EXCERPT");
        expect(canVerifyRealWorldClaim(review)).toBe(false);
      }
    }
  });

  it.each(["MISSING", "SYNTHETIC", "STALE", "BLOCKED"] as const)(
    "%s 근거를 실제 검증 완료로 승격하지 않는다",
    (availability) => {
      const perf = DEMO_CLAIM_REVIEWS.find(({ issueId }) => issueId === "PERF-001")!;
      const candidate = {
        ...perf,
        reasonCodes: [],
        realWorldVerified: true,
        evidence: perf.evidence.map((evidence) => ({ ...evidence, availability })),
      };
      expect(canVerifyRealWorldClaim(candidate)).toBe(false);
    },
  );
});

describe("YU-08/YU-09 React UI SIMULATED", () => {
  it("YU-07에서 YU-08을 거쳐 YU-09로 이동하고 비교 분모와 차단 근거를 표시한다", async () => {
    const user = await createSuccessfulCollection();
    await user.click(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" }));
    await user.click(screen.getByRole("link", { name: "댓글 분석으로 이동 →" }));
    await user.click(screen.getByRole("link", { name: "트렌드 관측 및 비교 →" }));

    expect(screen.getByRole("heading", { name: "트렌드 관측 · 패치 전후 비교" })).toBeInTheDocument();
    expect(screen.getByText("3,543건")).toBeInTheDocument();
    expect(screen.getByText("7,244건")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("CONDITIONAL");
    expect(screen.getByRole("alert")).toHaveTextContent("검증된 증가 주장 차단");

    await user.click(screen.getByRole("link", { name: "분석 근거 검증 →" }));
    expect(screen.getByRole("heading", { name: "근거 및 데이터 품질 검증" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "선택한 주장 / PERF-001" })).toBeInTheDocument();
  });

  it("PAY-002 딥 링크의 승인 시도는 HOLD이고 PERF-001은 실제 결함으로 바뀌지 않는다", async () => {
    const user = await createSuccessfulCollection();
    await user.click(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" }));
    await user.click(screen.getByRole("link", { name: "댓글 분석으로 이동 →" }));
    await user.click(screen.getByRole("link", { name: "트렌드 관측 및 비교 →" }));
    await user.click(screen.getByRole("link", { name: "분석 근거 검증 →" }));

    await user.click(screen.getByRole("button", { name: /PAY-002/ }));
    const payPanel = screen.getByRole("heading", { name: "선택한 주장 / PAY-002" }).closest("section")!;
    await user.click(within(payPanel).getByRole("button", { name: "실제 주장 승인 시도" }));
    expect(within(payPanel).getByRole("status")).toHaveTextContent("증가 주장은 HOLD");
    expect(within(payPanel).getByText("HOLD")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /PERF-001/ }));
    const perfPanel = screen.getByRole("heading", { name: "선택한 주장 / PERF-001" }).closest("section")!;
    await user.click(within(perfPanel).getByRole("button", { name: "실제 주장 승인 시도" }));
    expect(within(perfPanel).getByRole("status")).toHaveTextContent("실제 게임 결함은 미검증");
    expect(within(perfPanel).getByText("BLOCKED")).toBeInTheDocument();
  });

  it("직접 진입은 트렌드와 검증 완료 상태를 만들지 않는다", () => {
    const trend = renderAt("/projects/nexus-season-2/trends");
    expect(screen.getByRole("heading", { name: "완료된 인메모리 수집이 필요합니다." })).toBeInTheDocument();
    expect(screen.queryByText("3,543건")).not.toBeInTheDocument();
    trend.unmount();

    renderAt("/projects/nexus-season-2/evidence?issue=PAY-002");
    expect(screen.getByRole("heading", { name: "검증할 완료 수집을 찾을 수 없습니다." })).toBeInTheDocument();
    expect(screen.queryByText("REAL-WORLD VERIFIED: NO")).not.toBeInTheDocument();
  });
});
