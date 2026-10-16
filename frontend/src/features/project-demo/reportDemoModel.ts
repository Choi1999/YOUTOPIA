import {
  DEMO_COLLECTION_TOTALS,
  DEMO_REPRESENTATIVE_COMMENTS,
  DEMO_SOURCE,
  DEMO_SOURCE_VIDEOS,
  type DemoIssueId,
} from "./nexusDemoData";
import { INITIAL_DEMO_ISSUES, type DemoIssueRecord } from "./issueBoardModel";
import { DEMO_CLAIM_REVIEWS, DEMO_TREND_OBSERVATION } from "./trendEvidenceModel";

export type ReportWorkflowState =
  | "IDLE"
  | "SIMULATED_RUNNING"
  | "SIMULATED_SUCCESS"
  | "FAILED"
  | "RETRY"
  | "UNAVAILABLE"
  | "POLICY_BLOCKED"
  | "AWAITING_REVIEW";

export type ReportWorkflowAction =
  | "START"
  | "COMPLETE_DRAFT"
  | "COMPLETE_PREVIEW"
  | "FAIL"
  | "PREPARE_RETRY"
  | "MARK_UNAVAILABLE"
  | "BLOCK_POLICY"
  | "RESET";

export type EvidenceBundlePermission = "LOCAL_MASKED_DEMO" | "DENIED";

export type ReportEvidenceReference = {
  evidenceId: string;
  issueId: DemoIssueId;
  sourceId: string;
  availability: string;
  lineage: string;
  synthetic: boolean;
  masked: boolean;
  includedInPrompt: boolean;
  realWorldVerified: false;
  reviewReason: string;
};

export type AllowedEvidenceBundle = {
  id: "BUNDLE-NEXUS-S2-LOCAL-001";
  projectId: "nexus-season-2";
  permission: EvidenceBundlePermission;
  policyState: "LOCAL_DEMO_ONLY" | "POLICY_BLOCKED";
  sourceIds: string[];
  observedAt: string;
  observationWindow: typeof DEMO_TREND_OBSERVATION.observationWindow;
  comparisonWindows: {
    before: typeof DEMO_TREND_OBSERVATION.before;
    after: typeof DEMO_TREND_OBSERVATION.after;
    outsideComparison: typeof DEMO_TREND_OBSERVATION.outsideComparison;
  };
  coverage: typeof DEMO_TREND_OBSERVATION.coverage;
  comparability: typeof DEMO_TREND_OBSERVATION.comparability;
  totals: typeof DEMO_COLLECTION_TOTALS;
  evidence: ReportEvidenceReference[];
  allowedObservationIds: DemoIssueId[];
  blockedConclusionIds: DemoIssueId[];
  maskingDisclosure: string;
  derivedMetricDisclosure: string;
};

export type ReportDraft = {
  id: "REPORT-NEXUS-S2-LOCAL-001";
  projectId: "nexus-season-2";
  title: string;
  generatedAt: string;
  state: "DEMO_DRAFT";
  formallyApproved: false;
  shareable: false;
  exportable: false;
  sections: Array<{ id: string; title: string; body: string }>;
  observationCandidateIds: DemoIssueId[];
  excludedConclusionIds: DemoIssueId[];
  disclosures: string[];
};

export const DEMO_AI_TOOLS = [
  { id: "CHATGPT", label: "ChatGPT", detail: "계정 연결 필요", availability: "UNAVAILABLE" },
  { id: "CLAUDE", label: "Claude", detail: "연동 준비 / 미구현", availability: "UNAVAILABLE" },
  { id: "INTERNAL_AI", label: "내부 AI", detail: "브라우저 로컬 시뮬레이터", availability: "LOCAL_DEMO" },
  { id: "MCP", label: "MCP 인터페이스", detail: "정책 검토 후 제공", availability: "POLICY_BLOCKED" },
] as const;

export type DemoAiToolId = (typeof DEMO_AI_TOOLS)[number]["id"];

export function maskEvidenceText(evidenceId: string) {
  return `[원문 마스킹 · ${evidenceId}]`;
}

export function buildAllowedEvidenceBundle(
  permission: EvidenceBundlePermission = "LOCAL_MASKED_DEMO",
): AllowedEvidenceBundle {
  const evidence = DEMO_CLAIM_REVIEWS.flatMap((claim) =>
    claim.evidence.map((item): ReportEvidenceReference => ({
      evidenceId: item.id,
      issueId: claim.issueId,
      sourceId: item.sourceId,
      availability: item.availability,
      lineage: item.lineage,
      synthetic: item.synthetic,
      masked: true,
      includedInPrompt: false,
      realWorldVerified: false,
      reviewReason:
        permission === "DENIED"
          ? "권한 거부로 프롬프트 포함 차단"
          : "합성 원문은 개별 프롬프트에서 제외하고 ID와 검토 판정만 사용",
    })),
  );

  return {
    id: "BUNDLE-NEXUS-S2-LOCAL-001",
    projectId: "nexus-season-2",
    permission,
    policyState: permission === "DENIED" ? "POLICY_BLOCKED" : "LOCAL_DEMO_ONLY",
    sourceIds: DEMO_SOURCE_VIDEOS.map(({ id }) => id),
    observedAt: DEMO_SOURCE.observedAt,
    observationWindow: DEMO_TREND_OBSERVATION.observationWindow,
    comparisonWindows: {
      before: DEMO_TREND_OBSERVATION.before,
      after: DEMO_TREND_OBSERVATION.after,
      outsideComparison: DEMO_TREND_OBSERVATION.outsideComparison,
    },
    coverage: DEMO_TREND_OBSERVATION.coverage,
    comparability: DEMO_TREND_OBSERVATION.comparability,
    totals: DEMO_COLLECTION_TOTALS,
    evidence,
    allowedObservationIds: ["PERF-001"],
    blockedConclusionIds: ["PAY-002"],
    maskingDisclosure: "합성 댓글 원문은 로컬 프롬프트에서도 제외하며 식별자와 허용 결론만 표시합니다.",
    derivedMetricDisclosure:
      "비교 수치는 동일한 39일 rawComments fixture에서 파생되며 영상 모집단 차이로 CONDITIONAL입니다.",
  };
}

export function buildPromptPreview(bundle: AllowedEvidenceBundle) {
  if (bundle.policyState === "POLICY_BLOCKED") {
    return "[POLICY_BLOCKED] 권한이 없어 근거 번들을 프롬프트로 구성하지 않습니다.";
  }

  return [
    "[DEMO / SIMULATED · 외부 전송 없음]",
    "NEXUS 시즌2 v1.4 업데이트에서 검토해야 할 주요 이슈를 근거와 함께 정리해 줘.",
    `출처 ID: ${bundle.sourceIds.join(", ")}`,
    `관측: ${bundle.observationWindow.start}~${bundle.observationWindow.end} · ${bundle.coverage.observedDays}/${bundle.coverage.expectedDays}일`,
    `분모: 원시 ${bundle.totals.rawComments} · 분석 대상 ${bundle.totals.eligibleComments} · 제외 ${bundle.totals.excludedComments} · 분류 완료 ${bundle.totals.classifiedComments}`,
    "PERF-001: 합성 댓글에서 프레임 저하 호소 표현 관측 · 실제 게임 결함 미검증.",
    "PAY-002: 증가 주장을 뒷받침할 비교 근거가 없어 HOLD · 확정 결론 제외.",
    `비교 가능성: ${bundle.comparability} · 패치 인과관계로 해석 금지.`,
    bundle.maskingDisclosure,
  ].join("\n");
}

export function buildReportDraft(
  bundle: AllowedEvidenceBundle,
  issues: readonly DemoIssueRecord[] = INITIAL_DEMO_ISSUES,
): ReportDraft | null {
  if (bundle.policyState === "POLICY_BLOCKED") return null;

  const completedIssueIds = issues.filter(({ status }) => status === "COMPLETED").map(({ id }) => id);

  return {
    id: "REPORT-NEXUS-S2-LOCAL-001",
    projectId: bundle.projectId,
    title: "NEXUS 시즌2 v1.4 관측 및 검토 보고서",
    generatedAt: "2025-04-08 10:30 KST · 결정적 로컬 시뮬레이션",
    state: "DEMO_DRAFT",
    formallyApproved: false,
    shareable: false,
    exportable: false,
    sections: [
      {
        id: "scope",
        title: "관측 범위",
        body: `${bundle.observationWindow.start}~${bundle.observationWindow.end} · 공식 영상 ${bundle.sourceIds.length}개 · 커버리지 ${bundle.coverage.observedDays}/${bundle.coverage.expectedDays}일`,
      },
      {
        id: "denominators",
        title: "분모와 제외",
        body: `원시 ${bundle.totals.rawComments.toLocaleString("ko-KR")}건 = 분석 대상 ${bundle.totals.eligibleComments.toLocaleString("ko-KR")}건 + 제외/보류 ${bundle.totals.excludedComments.toLocaleString("ko-KR")}건 · 분류 완료 ${bundle.totals.classifiedComments.toLocaleString("ko-KR")}건`,
      },
      {
        id: "perf",
        title: "PERF-001 · 관측 후보",
        body: "합성 데모 댓글에서 프레임 저하 호소 표현이 관측되었습니다. 실제 게임 결함과 패치 인과관계는 미검증입니다.",
      },
      {
        id: "pay",
        title: "PAY-002 · HOLD",
        body: "영상 모집단과 게시 시점이 달라 증가 주장을 검증할 수 없습니다. 확정 결론과 공유 대상에서 제외합니다.",
      },
    ],
    observationCandidateIds: ["PERF-001"],
    excludedConclusionIds: ["PAY-002"],
    disclosures: [
      "DEMO / SIMULATED 초안이며 실제 AI가 생성하지 않았습니다.",
      "CONDITIONAL 비교 결과는 패치 효과나 시장 전체 인기를 증명하지 않습니다.",
      `Kanban 완료 항목(${completedIssueIds.join(", ") || "없음"})도 검증된 주장으로 자동 전환하지 않습니다.`,
      "합성·누락·삭제·만료·오래됨·접근 거부·정책 차단 근거는 실제 검증 근거가 아닙니다.",
    ],
  };
}

export function transitionReportWorkflow(
  state: ReportWorkflowState,
  action: ReportWorkflowAction,
): ReportWorkflowState {
  if (action === "RESET") return "IDLE";
  if (action === "MARK_UNAVAILABLE") return "UNAVAILABLE";
  if (action === "BLOCK_POLICY") return "POLICY_BLOCKED";
  if (state === "IDLE" && action === "START") return "SIMULATED_RUNNING";
  if (state === "SIMULATED_RUNNING" && action === "COMPLETE_DRAFT") return "AWAITING_REVIEW";
  if (state === "SIMULATED_RUNNING" && action === "FAIL") return "FAILED";
  if (state === "FAILED" && action === "PREPARE_RETRY") return "RETRY";
  if (state === "RETRY" && action === "START") return "SIMULATED_RUNNING";
  if (state === "AWAITING_REVIEW" && action === "COMPLETE_PREVIEW") return "SIMULATED_SUCCESS";
  return state;
}

export function containsSyntheticCommentText(value: string) {
  return DEMO_REPRESENTATIVE_COMMENTS.some(({ text }) => value.includes(text));
}
