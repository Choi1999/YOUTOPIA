import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { DEMO_COLLECTION_TOTALS, DEMO_REPRESENTATIVE_COMMENTS } from "../features/project-demo/nexusDemoData";
import { INITIAL_DEMO_ISSUES } from "../features/project-demo/issueBoardModel";
import {
  buildAllowedEvidenceBundle,
  buildPromptPreview,
  buildReportDraft,
  containsSyntheticCommentText,
  maskEvidenceText,
  transitionReportWorkflow,
  type ReportWorkflowAction,
  type ReportWorkflowState,
} from "../features/project-demo/reportDemoModel";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AppRoutes } from "./AppRoutes";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider><AppRoutes /></ThemeProvider>
    </MemoryRouter>,
  );
}

async function openIssueWorkspace() {
  const user = userEvent.setup();
  renderAt("/projects/new");
  await user.click(screen.getByRole("button", { name: "데이터 수집 시작 →" }));
  await user.click(screen.getByRole("button", { name: "수집 실행 시뮬레이션" }));
  await user.click(screen.getByRole("button", { name: "완료 시뮬레이션" }));
  await user.click(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" }));
  await user.click(screen.getByRole("link", { name: "댓글 분석으로 이동 →" }));
  await user.click(screen.getByRole("link", { name: "트렌드 관측 및 비교 →" }));
  await user.click(screen.getByRole("link", { name: "분석 근거 검증 →" }));
  await user.click(screen.getByRole("link", { name: "PERF-001 근거 상세 검토 →" }));
  await user.click(screen.getByRole("link", { name: "검토 이슈로 등록 →" }));
  return user;
}

async function openReportWorkspace() {
  const user = await openIssueWorkspace();
  await user.click(screen.getByRole("link", { name: "AI 워크스페이스 · 보고서 초안 →" }));
  return user;
}

describe("YU-12 AllowedEvidenceBundle / ReportDraft 계약", () => {
  it("기존 출처·기간·수치·조건부 비교 계약을 재사용한다", () => {
    const bundle = buildAllowedEvidenceBundle();
    expect(bundle.sourceIds).toEqual(["update-trailer-0318", "patch-notes-0324", "developer-live-0325"]);
    expect(bundle.observationWindow).toEqual({ start: "2025-03-01", end: "2025-04-08" });
    expect(bundle.comparisonWindows.before).toMatchObject({ start: "2025-03-11", end: "2025-03-24", days: 14, rawComments: 3_543 });
    expect(bundle.comparisonWindows.after).toMatchObject({ start: "2025-03-25", end: "2025-04-07", days: 14, rawComments: 7_244 });
    expect(bundle.comparisonWindows.outsideComparison).toMatchObject({ days: 11, rawComments: 2_055 });
    expect(bundle.coverage).toEqual({ expectedDays: 39, observedDays: 39, missingIntervals: [] });
    expect(bundle.comparability).toBe("CONDITIONAL");
    expect(bundle.totals).toBe(DEMO_COLLECTION_TOTALS);
  });

  it("합성 원문을 마스킹하고 로컬 프롬프트에 포함하지 않는다", () => {
    const bundle = buildAllowedEvidenceBundle();
    const prompt = buildPromptPreview(bundle);
    expect(bundle.evidence.every(({ masked, includedInPrompt, realWorldVerified }) => masked && !includedInPrompt && !realWorldVerified)).toBe(true);
    expect(maskEvidenceText("EVD-SYN-PERF-01")).toBe("[원문 마스킹 · EVD-SYN-PERF-01]");
    expect(containsSyntheticCommentText(prompt)).toBe(false);
    for (const comment of DEMO_REPRESENTATIVE_COMMENTS) expect(prompt).not.toContain(comment.text);
  });

  it("PERF-001은 관측 후보, PAY-002는 HOLD 제외로만 보고서에 남긴다", () => {
    const draft = buildReportDraft(buildAllowedEvidenceBundle())!;
    expect(draft.observationCandidateIds).toEqual(["PERF-001"]);
    expect(draft.excludedConclusionIds).toEqual(["PAY-002"]);
    expect(draft.formallyApproved).toBe(false);
    expect(draft.shareable).toBe(false);
    expect(draft.exportable).toBe(false);
    expect(draft.sections.find(({ id }) => id === "perf")?.body).toMatch(/실제 게임 결함.*미검증/);
    expect(draft.sections.find(({ id }) => id === "pay")?.body).toMatch(/증가 주장을 검증할 수 없습니다/);
    expect(draft.disclosures.join(" ")).toMatch(/Kanban.*검증된 주장으로 자동 전환하지 않습니다/);
  });

  it("권한 거부 번들은 프롬프트·보고서 생성을 차단한다", () => {
    const denied = buildAllowedEvidenceBundle("DENIED");
    expect(denied.policyState).toBe("POLICY_BLOCKED");
    expect(buildPromptPreview(denied)).toMatch(/POLICY_BLOCKED/);
    expect(buildReportDraft(denied)).toBeNull();
  });

  it("완료된 작업은 보고서 고지에 전달되지만 주장 검증이나 보고서 승인이 되지 않는다", () => {
    const completed = INITIAL_DEMO_ISSUES.map((issue) => issue.id === "PERF-001"
      ? { ...issue, status: "COMPLETED" as const, reviewDecision: "SIMULATED_REVIEWED" as const }
      : issue);
    const draft = buildReportDraft(buildAllowedEvidenceBundle(), completed)!;
    expect(draft.disclosures.join(" ")).toContain("Kanban 완료 항목(PERF-001)");
    expect(draft.formallyApproved).toBe(false);
    expect(draft.observationCandidateIds).toEqual(["PERF-001"]);
    expect(draft.sections.find(({ id }) => id === "perf")?.body).toMatch(/실제 게임 결함.*미검증/);
  });

  it.each<[ReportWorkflowState, ReportWorkflowAction, ReportWorkflowState]>([
    ["IDLE", "START", "SIMULATED_RUNNING"],
    ["SIMULATED_RUNNING", "COMPLETE_DRAFT", "AWAITING_REVIEW"],
    ["AWAITING_REVIEW", "COMPLETE_PREVIEW", "SIMULATED_SUCCESS"],
    ["SIMULATED_RUNNING", "FAIL", "FAILED"],
    ["FAILED", "PREPARE_RETRY", "RETRY"],
    ["RETRY", "START", "SIMULATED_RUNNING"],
    ["IDLE", "MARK_UNAVAILABLE", "UNAVAILABLE"],
    ["IDLE", "BLOCK_POLICY", "POLICY_BLOCKED"],
    ["FAILED", "RESET", "IDLE"],
  ])("%s + %s → %s 상태 전이를 결정적으로 적용한다", (from, action, expected) => {
    expect(transitionReportWorkflow(from, action)).toBe(expected);
  });

  it("허용하지 않은 전이는 현재 상태를 유지한다", () => {
    expect(transitionReportWorkflow("IDLE", "COMPLETE_PREVIEW")).toBe("IDLE");
    expect(transitionReportWorkflow("POLICY_BLOCKED", "START")).toBe("POLICY_BLOCKED");
  });
});

describe("YU-12 AI 워크스페이스 컴포넌트", () => {
  it("YU-11에서 3열 워크스페이스로 이동하고 마스킹 프롬프트를 표시한다", async () => {
    await openReportWorkspace();
    expect(screen.getByRole("heading", { name: "AI 워크스페이스 · 보고서 공유" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "연결 가능한 AI 도구" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "검증된 근거를 활용하는 AI" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "보고서 · 공유" })).toBeInTheDocument();
    const prompt = screen.getByRole("heading", { name: "프롬프트 미리보기 · 외부 전송 없음" }).closest("div")!;
    expect(prompt).toHaveTextContent("외부 전송 없음");
    for (const comment of DEMO_REPRESENTATIVE_COMMENTS) expect(prompt).not.toHaveTextContent(comment.text);
  });

  it("초안 실행·검토 대기·미리보기 성공을 실제 승인과 분리한다", async () => {
    const user = await openReportWorkspace();
    await user.click(screen.getByRole("button", { name: "로컬 초안 시뮬레이션" }));
    expect(screen.getByRole("status")).toHaveTextContent("외부 요청은 없습니다");
    await user.click(screen.getByRole("button", { name: "초안 생성 완료" }));
    expect(screen.getByRole("status")).toHaveTextContent("사람 검토 대기");
    const draft = screen.getByRole("article", { name: "시뮬레이션 보고서 초안" });
    expect(within(draft).getByText(/PERF-001 · 관측 후보/)).toBeInTheDocument();
    expect(within(draft).getByText(/PAY-002 · HOLD/)).toBeInTheDocument();
    expect(within(draft).getByText(/실제 AI가 생성하지 않았습니다/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "검토 대기 초안 미리보기" }));
    expect(screen.getByRole("status")).toHaveTextContent("정식 승인·저장·공유 상태가 아닙니다");
  });

  it("실패와 재시도를 결정적으로 복구한다", async () => {
    const user = await openReportWorkspace();
    await user.click(screen.getByRole("button", { name: "로컬 초안 시뮬레이션" }));
    await user.click(screen.getByRole("button", { name: "실패 시뮬레이션" }));
    expect(screen.getByRole("status")).toHaveTextContent("로컬 생성 실패");
    await user.click(screen.getByRole("button", { name: "재시도 준비" }));
    expect(screen.getByRole("status")).toHaveTextContent("재시도 준비 상태");
    await user.click(screen.getByRole("button", { name: "동일 fixture로 다시 실행" }));
    expect(screen.getByRole("status")).toHaveTextContent("외부 요청은 없습니다");
  });

  it("외부 도구와 권한 거부를 UNAVAILABLE/POLICY_BLOCKED로 격리한다", async () => {
    const user = await openReportWorkspace();
    await user.click(screen.getByRole("button", { name: /ChatGPT/ }));
    expect(screen.getByRole("status")).toHaveTextContent("사용할 수 없습니다");
    await user.click(screen.getByRole("button", { name: "내부 로컬 데모로 돌아가기" }));
    await user.click(screen.getByRole("button", { name: /MCP 인터페이스/ }));
    expect(screen.getByRole("status")).toHaveTextContent("정책 때문에");
    await user.click(screen.getByRole("button", { name: "내부 로컬 데모로 돌아가기" }));
    await user.selectOptions(screen.getByLabelText("근거 번들 권한 · SIMULATED"), "DENIED");
    expect(screen.getByRole("status")).toHaveTextContent("권한 또는 외부 전달 정책");
    expect(screen.getByText(/\[POLICY_BLOCKED\]/)).toBeInTheDocument();
  });

  it("내보내기·공유·다운로드를 이유와 함께 비활성화한다", async () => {
    await openReportWorkspace();
    for (const name of ["내보내기", "링크 공유", "다운로드"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByText(/실제 내보내기·공유·다운로드·외부 도구 실행/)).toBeInTheDocument();
  });

  it("직접 진입은 보고서 성공 상태를 만들지 않는다", () => {
    renderAt("/projects/nexus-season-2/ai-report");
    expect(screen.getByRole("heading", { name: "AI 보고서에 필요한 완료 수집이 없습니다." })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "시뮬레이션 보고서 초안" })).not.toBeInTheDocument();
  });

  it("YU-11 작업 완료를 YU-12로 공유하되 검증·정식 승인으로 승격하지 않는다", async () => {
    const user = await openIssueWorkspace();
    const issuePanel = screen.getByRole("heading", { name: "PERF-001 · 성능 저하" }).closest("section")!;
    await user.click(within(issuePanel).getByRole("button", { name: "검토 완료 시도" }));
    expect(within(issuePanel).getByText("COMPLETED", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "AI 워크스페이스 · 보고서 초안 →" }));
    await user.click(screen.getByRole("button", { name: "로컬 초안 시뮬레이션" }));
    await user.click(screen.getByRole("button", { name: "초안 생성 완료" }));
    const draft = screen.getByRole("article", { name: "시뮬레이션 보고서 초안" });
    expect(within(draft).getByText(/Kanban 완료 항목\(PERF-001\).*검증된 주장으로 자동 전환하지 않습니다/)).toBeInTheDocument();
    expect(within(draft).getByText(/실제 게임 결함과 패치 인과관계는 미검증/)).toBeInTheDocument();
    expect(within(draft).getByText(/실제 AI가 생성하지 않았습니다/)).toBeInTheDocument();
  });
});
