import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  assignIssue,
  INITIAL_DEMO_ISSUES,
  transitionIssue,
} from "../features/project-demo/issueBoardModel";
import { DEMO_ISSUES } from "../features/project-demo/nexusDemoData";
import {
  canVerifyRealWorldClaim,
  DEMO_CLAIM_REVIEWS,
  simulateEvidenceAvailability,
  type EvidenceAvailability,
} from "../features/project-demo/trendEvidenceModel";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AppRoutes } from "./AppRoutes";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider><AppRoutes /></ThemeProvider>
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

async function openEvidenceDetail() {
  const user = await createSuccessfulCollection();
  await user.click(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" }));
  await user.click(screen.getByRole("link", { name: "댓글 분석으로 이동 →" }));
  await user.click(screen.getByRole("link", { name: "트렌드 관측 및 비교 →" }));
  await user.click(screen.getByRole("link", { name: "분석 근거 검증 →" }));
  await user.click(screen.getByRole("link", { name: "PERF-001 근거 상세 검토 →" }));
  return user;
}

describe("YU-10 근거 가용성 계약", () => {
  it.each(["AVAILABLE", "MISSING", "DELETED", "EXPIRED", "STALE", "ACCESS_DENIED"] as EvidenceAvailability[])(
    "%s 상태에서도 합성 근거를 실제 검증으로 승격하지 않는다",
    (availability) => {
      const perf = DEMO_CLAIM_REVIEWS.find(({ issueId }) => issueId === "PERF-001")!;
      const updated = {
        ...perf,
        realWorldVerified: true,
        reasonCodes: [],
        evidence: perf.evidence.map((item) => simulateEvidenceAvailability(item, availability)),
      };
      expect(updated.evidence.every(({ synthetic }) => synthetic)).toBe(true);
      expect(updated.evidence.every((item) => item.availability === availability)).toBe(true);
      expect(canVerifyRealWorldClaim(updated)).toBe(false);
    },
  );
});

describe("YU-11 이슈 전이 계약", () => {
  it("YU-07 이슈 ID와 근거 계보를 그대로 초기화한다", () => {
    expect(INITIAL_DEMO_ISSUES.map(({ id }) => id)).toEqual(DEMO_ISSUES.map(({ id }) => id));
    expect(INITIAL_DEMO_ISSUES.find(({ id }) => id === "PERF-001")?.evidenceIds).toEqual([
      "EVD-SYN-PERF-01",
      "EVD-SYN-PERF-02",
    ]);
  });

  it("PERF-001은 진행 중에서 완료로 로컬 전이하고 감사 항목을 남긴다", () => {
    const perf = INITIAL_DEMO_ISSUES.find(({ id }) => id === "PERF-001")!;
    const result = transitionIssue(perf, "COMPLETED", "EDITOR");
    expect(result.error).toBeNull();
    expect(result.issue.status).toBe("COMPLETED");
    expect(result.issue.reviewDecision).toBe("SIMULATED_REVIEWED");
    expect(result.issue.audit.at(-1)?.actor).toBe("DEMO_REVIEWER_UNAUTHENTICATED");
  });

  it("PAY-002 HOLD를 완료로 승격하지 않는다", () => {
    const pay = INITIAL_DEMO_ISSUES.find(({ id }) => id === "PAY-002")!;
    const result = transitionIssue(pay, "COMPLETED", "EDITOR");
    expect(result.error).toBe("HOLD_PROMOTION_BLOCKED");
    expect(result.issue.status).toBe("WAITING");
    expect(result.issue.reviewDecision).toBe("HOLD");
  });

  it("허용되지 않은 전이와 VIEWER/DENIED 변경을 차단한다", () => {
    const balance = INITIAL_DEMO_ISSUES.find(({ id }) => id === "BAL-003")!;
    expect(transitionIssue(balance, "COMPLETED", "EDITOR").error).toBe("INVALID_TRANSITION");
    expect(transitionIssue(balance, "IN_PROGRESS", "VIEWER").error).toBe("PERMISSION_DENIED");
    expect(assignIssue(balance, "DEMO_REVIEWER_A", "DENIED").error).toBe("PERMISSION_DENIED");
  });

  it("반려 후 검토 대기로만 복귀한다", () => {
    const perf = INITIAL_DEMO_ISSUES.find(({ id }) => id === "PERF-001")!;
    const rejected = transitionIssue(perf, "REJECTED", "EDITOR").issue;
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.reviewDecision).toBe("REJECTED");
    expect(transitionIssue(rejected, "IN_PROGRESS", "EDITOR").error).toBe("INVALID_TRANSITION");
    expect(transitionIssue(rejected, "WAITING", "EDITOR").issue.status).toBe("WAITING");
  });
});

describe("YU-10/YU-11 React UI SIMULATED", () => {
  it("YU-09에서 PERF-001 상세로 이동해 메타데이터와 가용성 상태를 검토한다", async () => {
    const user = await openEvidenceDetail();
    expect(screen.getByRole("heading", { name: "PERF-001 · 근거 상세 검토" })).toBeInTheDocument();
    expect(screen.getAllByText("SYNTHETIC COMMENT")).toHaveLength(2);
    expect(screen.getByText(/developer-live-0325\/SYN-PERF-01/)).toBeInTheDocument();
    expect(screen.getAllByText(/2025-04-08 09:05 KST/)).toHaveLength(2);

    const selector = screen.getByLabelText("근거 가용성 시뮬레이션");
    await user.selectOptions(selector, "MISSING");
    expect(screen.getByText(/원문 내용은 표시하지 않습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/developer-live-0325\/SYN-PERF-01/)).not.toBeInTheDocument();
    await user.selectOptions(selector, "STALE");
    expect(screen.getByRole("status")).toHaveTextContent("오래된 근거");
    expect(screen.getAllByText("SYNTHETIC COMMENT")).toHaveLength(2);
  });

  it("근거 상세의 검토 메모를 편집하고 YU-11에 동일 ID를 전달한다", async () => {
    const user = await openEvidenceDetail();
    const note = screen.getByLabelText("검토 메모 · 브라우저 메모리 전용");
    await user.clear(note);
    await user.type(note, "PERF-001 시뮬레이션 검토 메모");
    expect(note).toHaveValue("PERF-001 시뮬레이션 검토 메모");
    await user.click(screen.getByRole("link", { name: "검토 이슈로 등록 →" }));
    expect(screen.getByRole("heading", { name: "PERF-001 · 성능 저하" })).toBeInTheDocument();
    expect(screen.getByText(/EVD-SYN-PERF-01/)).toBeInTheDocument();
  });

  it("YU-10의 빈 ID와 잘못된 ID를 안전하게 처리한다", () => {
    const missing = renderAt("/projects/nexus-season-2/evidence-detail");
    expect(screen.getByRole("heading", { name: "검토할 주장 ID가 필요합니다." })).toBeInTheDocument();
    missing.unmount();
    renderAt("/projects/nexus-season-2/evidence/UNKNOWN-999");
    expect(screen.getByRole("heading", { name: "지원하지 않는 주장 ID입니다." })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("UNKNOWN-999");
  });

  it("PAY-002 완료 시도를 차단하고 반려·담당자·감사 상태를 시뮬레이션한다", async () => {
    const user = await openEvidenceDetail();
    await user.click(screen.getByRole("link", { name: "검토 이슈로 등록 →" }));
    await user.click(screen.getByRole("button", { name: /PAY-002/ }));
    const panel = screen.getByRole("heading", { name: "PAY-002 · 과금\/가격" }).closest("section")!;
    await user.click(within(panel).getByRole("button", { name: "검토 완료 시도" }));
    expect(within(panel).getByRole("status")).toHaveTextContent("HOLD 주장은 검토 완료");
    await user.selectOptions(within(panel).getByLabelText("담당자 · SIMULATED"), "DEMO_REVIEWER_A");
    await user.click(within(panel).getByRole("button", { name: "검토 반려" }));
    expect(within(panel).getByText("REJECTED", { exact: true })).toBeInTheDocument();
    expect(within(panel).getByText("REVIEW_REJECTED", { exact: true })).toBeInTheDocument();
  });

  it("empty·unavailable·permission-denied 보드 상태를 제공한다", async () => {
    const user = await openEvidenceDetail();
    await user.click(screen.getByRole("link", { name: "검토 이슈로 등록 →" }));
    const boardState = screen.getByLabelText("보드 상태");
    await user.selectOptions(boardState, "EMPTY");
    expect(screen.getByRole("heading", { name: "표시할 이슈가 없습니다." })).toBeInTheDocument();
    await user.selectOptions(boardState, "UNAVAILABLE");
    expect(screen.getByRole("heading", { name: "이슈 보드를 사용할 수 없습니다." })).toBeInTheDocument();
    await user.selectOptions(boardState, "PERMISSION_DENIED");
    expect(screen.getByRole("heading", { name: "이슈 보드 접근 권한이 없습니다." })).toBeInTheDocument();
  });

  it("직접 진입은 YU-10·YU-11 성공 상태를 생성하지 않는다", () => {
    const detail = renderAt("/projects/nexus-season-2/evidence/PERF-001");
    expect(screen.getByRole("heading", { name: "근거 상세에 필요한 완료 수집이 없습니다." })).toBeInTheDocument();
    detail.unmount();
    renderAt("/projects/nexus-season-2/issues");
    expect(screen.getByRole("heading", { name: "이슈 보드에 필요한 완료 수집이 없습니다." })).toBeInTheDocument();
  });
});
