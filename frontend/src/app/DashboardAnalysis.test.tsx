import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  DEMO_COLLECTION_TOTALS,
  DEMO_DAILY_OBSERVATIONS,
  DEMO_ISSUES,
  DEMO_SENTIMENT_DISTRIBUTION,
  deriveDashboardDataState,
} from "../features/project-demo/nexusDemoData";
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

describe("YU-06/YU-07 공유 NEXUS fixture", () => {
  it("수집·분류·일별 관측의 모든 분모를 정합하게 유지한다", () => {
    expect(DEMO_COLLECTION_TOTALS.rawComments).toBe(
      DEMO_COLLECTION_TOTALS.eligibleComments + DEMO_COLLECTION_TOTALS.excludedComments,
    );
    expect(DEMO_COLLECTION_TOTALS.eligibleComments).toBe(
      DEMO_COLLECTION_TOTALS.classifiedComments + DEMO_COLLECTION_TOTALS.unclassifiedEligibleComments,
    );
    expect(DEMO_SENTIMENT_DISTRIBUTION.reduce((sum, item) => sum + item.count, 0)).toBe(
      DEMO_COLLECTION_TOTALS.eligibleComments,
    );
    expect(DEMO_DAILY_OBSERVATIONS.reduce((sum, item) => sum + item.rawComments, 0)).toBe(
      DEMO_COLLECTION_TOTALS.rawComments,
    );
    expect(DEMO_DAILY_OBSERVATIONS[0].date).toBe("2025-03-01");
    expect(DEMO_DAILY_OBSERVATIONS.at(-1)?.date).toBe("2025-04-08");
  });

  it("안정된 이슈 ID와 PERF 관측·PAY HOLD 계약을 보존한다", () => {
    expect(DEMO_ISSUES.map((issue) => issue.id)).toEqual([
      "PERF-001",
      "PAY-002",
      "STAB-005",
      "BAL-003",
      "CONT-004",
    ]);
    expect(DEMO_ISSUES.find((issue) => issue.id === "PERF-001")?.interpretation).toMatch(/결함을 확정하지/);
    expect(DEMO_ISSUES.find((issue) => issue.id === "PAY-002")?.state).toBe("HOLD");
  });

  it("loading·empty·partial·failed·stale·unavailable·success를 명시적으로 도출한다", () => {
    expect(deriveDashboardDataState(false, null)).toBe("unavailable");
    expect(deriveDashboardDataState(true, "QUEUED")).toBe("loading");
    expect(deriveDashboardDataState(true, "RUNNING")).toBe("loading");
    expect(deriveDashboardDataState(true, "PARTIAL")).toBe("partial");
    expect(deriveDashboardDataState(true, "FAILED")).toBe("failed");
    expect(deriveDashboardDataState(true, "SUCCEEDED", "EMPTY")).toBe("empty");
    expect(deriveDashboardDataState(true, "SUCCEEDED", "STALE")).toBe("stale");
    expect(deriveDashboardDataState(true, "SUCCEEDED")).toBe("success");
  });
});

describe("YU-06 프로젝트 대시보드 SIMULATED", () => {
  it("YU-05 성공 상태에서 KPI·일별 관측·이슈·출처를 표시한다", async () => {
    const user = await createSuccessfulCollection();
    await user.click(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" }));

    expect(screen.getByRole("heading", { name: "프로젝트 대시보드" })).toBeInTheDocument();
    expect(screen.getByText("12,842건")).toBeInTheDocument();
    expect(screen.getByText("10,204건")).toBeInTheDocument();
    expect(screen.getByText("28건")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "일별 댓글 관측량 · 공개 영상 3개" })).toBeInTheDocument();
    expect(screen.getByLabelText("데모 데이터 출처와 범위")).toHaveTextContent("2025-03-01~2025-04-08");
    expect(screen.getByLabelText("데모 데이터 출처와 범위")).toHaveTextContent("developer-live-0325");
  });

  it("부분·실패 상태를 성공 대시보드로 오인하지 않는다", async () => {
    const user = userEvent.setup();
    const partialView = renderAt("/projects/new");
    await user.click(screen.getByRole("button", { name: "데이터 수집 시작 →" }));
    await user.click(screen.getByRole("button", { name: "수집 실행 시뮬레이션" }));
    await user.click(screen.getByRole("button", { name: "부분 결과 시뮬레이션" }));
    await user.click(screen.getByRole("link", { name: "현재 상태로 대시보드 미리보기" }));
    expect(screen.getByRole("heading", { name: "부분 수집 결과만 사용할 수 있습니다." })).toBeInTheDocument();
    expect(screen.queryByText("28건")).not.toBeInTheDocument();
    partialView.unmount();

    renderAt("/projects/new");
    await user.click(screen.getByRole("button", { name: "데이터 수집 시작 →" }));
    await user.click(screen.getByRole("button", { name: "수집 실행 시뮬레이션" }));
    await user.click(screen.getByRole("button", { name: "실패 시뮬레이션" }));
    await user.click(screen.getByRole("link", { name: "현재 상태로 대시보드 미리보기" }));
    expect(screen.getByRole("heading", { name: "수집 실패로 대시보드를 만들 수 없습니다." })).toBeInTheDocument();
  });

  it("성공 fixture에서 empty·stale·unavailable 상태를 전환한다", async () => {
    const user = await createSuccessfulCollection();
    await user.click(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" }));
    const selector = screen.getByLabelText("대시보드 상태 시뮬레이션");

    await user.selectOptions(selector, "EMPTY");
    expect(screen.getByRole("heading", { name: "표시할 관측 데이터가 없습니다." })).toBeInTheDocument();
    await user.selectOptions(selector, "STALE");
    expect(screen.getByRole("status")).toHaveTextContent("DEMO / STALE");
    await user.selectOptions(selector, "UNAVAILABLE");
    expect(screen.getByRole("heading", { name: "활성 프로젝트 데이터를 찾을 수 없습니다." })).toBeInTheDocument();
  });

  it("직접 진입은 사용할 수 없는 상태이며 성공 수치를 만들지 않는다", () => {
    renderAt("/projects/nexus-season-2/overview");
    expect(screen.getByRole("heading", { name: "활성 프로젝트 데이터를 찾을 수 없습니다." })).toBeInTheDocument();
    expect(screen.queryByText("12,842건")).not.toBeInTheDocument();
  });
});

describe("YU-07 댓글 감성·이슈 분석 SIMULATED", () => {
  it("감성 분모, 다중 라벨, 대표 합성 댓글과 PAY-002 HOLD를 탐색한다", async () => {
    const user = await createSuccessfulCollection();
    await user.click(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" }));
    await user.click(screen.getByRole("link", { name: "댓글 분석으로 이동 →" }));

    expect(screen.getByRole("heading", { name: "댓글 감성 · 이슈 분석" })).toBeInTheDocument();
    expect(screen.getByLabelText("분류 분모 정합성")).toHaveTextContent("8,421건");
    expect(screen.getByLabelText("분류 분모 정합성")).toHaveTextContent("1,783건");
    expect(screen.getByText("4,884건")).toBeInTheDocument();
    expect(screen.getByText(/다중 라벨 할당 3,731건 \/ 분석 대상 10,204건/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("이슈 필터"), "PAY-002");
    const detail = screen.getByRole("heading", { name: "PAY-002 · 과금/가격" }).closest("section");
    expect(detail).not.toBeNull();
    expect(within(detail as HTMLElement).getByText("HOLD")).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText(/급증을 주장하지 않습니다/)).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByText(/SYN-PAY-01/)).toBeInTheDocument();
    expect(within(detail as HTMLElement).getByRole("link", { name: "근거 화면으로 이동" })).toHaveAttribute(
      "href",
      "/projects/nexus-season-2/evidence?issue=PAY-002",
    );

    await user.click(screen.getByRole("tab", { name: "긍정" }));
    expect(screen.getByRole("status")).toHaveTextContent("해당하는 합성 대표 댓글이 없습니다");
  });

  it("대시보드 이슈 딥 링크와 이전 단계 이동에서 인메모리 상태를 유지한다", async () => {
    const user = await createSuccessfulCollection();
    await user.click(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" }));
    await user.click(screen.getByRole("link", { name: /PAY-002/ }));
    expect(screen.getByRole("heading", { name: "PAY-002 · 과금/가격" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "← 이전 단계" }));
    expect(screen.getByRole("heading", { name: "프로젝트 대시보드" })).toBeInTheDocument();
    expect(screen.getByText("12,842건")).toBeInTheDocument();
  });

  it("직접 진입은 분류 결과를 생성하지 않는다", () => {
    renderAt("/projects/nexus-season-2/comments?issue=PAY-002");
    expect(screen.getByRole("heading", { name: "완료된 인메모리 수집이 필요합니다." })).toBeInTheDocument();
    expect(screen.queryByText("4,884건")).not.toBeInTheDocument();
  });
});
