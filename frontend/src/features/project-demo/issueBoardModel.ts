import { DEMO_ISSUES, type DemoIssueId } from "./nexusDemoData";
import { DEMO_CLAIM_REVIEWS } from "./trendEvidenceModel";

export type IssueStatus = "WAITING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
export type IssuePermission = "EDITOR" | "VIEWER" | "DENIED";
export type DemoAssignee = "UNASSIGNED" | "DEMO_REVIEWER_A" | "DEMO_REVIEWER_B";
export type IssueTransitionError =
  | "PERMISSION_DENIED"
  | "HOLD_PROMOTION_BLOCKED"
  | "INVALID_TRANSITION";

export type IssueAuditEvent = {
  id: string;
  issueId: DemoIssueId;
  timestamp: string;
  actor: "DEMO_REVIEWER_UNAUTHENTICATED";
  action: "CREATED" | "ASSIGNED" | "STATUS_CHANGED" | "REVIEW_REJECTED";
  detail: string;
};

export type DemoIssueRecord = {
  id: DemoIssueId;
  title: string;
  summary: string;
  claimState: "OBSERVED" | "HOLD" | "CANDIDATE";
  status: IssueStatus;
  assignee: DemoAssignee;
  evidenceIds: string[];
  reviewDecision: "PENDING" | "SIMULATED_REVIEWED" | "REJECTED" | "HOLD";
  audit: IssueAuditEvent[];
};

const initialStatus: Record<DemoIssueId, IssueStatus> = {
  "PERF-001": "IN_PROGRESS",
  "PAY-002": "WAITING",
  "STAB-005": "WAITING",
  "BAL-003": "WAITING",
  "CONT-004": "IN_PROGRESS",
};

const initialAssignee: Record<DemoIssueId, DemoAssignee> = {
  "PERF-001": "DEMO_REVIEWER_A",
  "PAY-002": "UNASSIGNED",
  "STAB-005": "UNASSIGNED",
  "BAL-003": "UNASSIGNED",
  "CONT-004": "DEMO_REVIEWER_B",
};

function evidenceIdsFor(issueId: DemoIssueId) {
  return DEMO_CLAIM_REVIEWS.find((claim) => claim.issueId === issueId)?.evidence.map(({ id }) => id) ?? [];
}

export const INITIAL_DEMO_ISSUES: DemoIssueRecord[] = DEMO_ISSUES.map((issue, index) => ({
  id: issue.id,
  title: issue.category,
  summary: issue.summary,
  claimState: issue.state,
  status: initialStatus[issue.id],
  assignee: initialAssignee[issue.id],
  evidenceIds: evidenceIdsFor(issue.id),
  reviewDecision: issue.id === "PAY-002" ? "HOLD" : "PENDING",
  audit: [
    {
      id: `AUD-${issue.id}-001`,
      issueId: issue.id,
      timestamp: `2025-04-08 10:${String(index).padStart(2, "0")} KST`,
      actor: "DEMO_REVIEWER_UNAUTHENTICATED",
      action: "CREATED",
      detail: "공유 fixture에서 인메모리 검토 항목을 생성했습니다.",
    },
  ],
}));

const allowedTransitions: Record<IssueStatus, IssueStatus[]> = {
  WAITING: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["WAITING", "COMPLETED", "REJECTED"],
  COMPLETED: ["IN_PROGRESS"],
  REJECTED: ["WAITING"],
};

export function transitionIssue(
  issue: DemoIssueRecord,
  target: IssueStatus,
  permission: IssuePermission,
  sequence = issue.audit.length + 1,
): { issue: DemoIssueRecord; error: IssueTransitionError | null } {
  if (permission !== "EDITOR") return { issue, error: "PERMISSION_DENIED" };
  if (issue.id === "PAY-002" && target === "COMPLETED") {
    return { issue, error: "HOLD_PROMOTION_BLOCKED" };
  }
  if (!allowedTransitions[issue.status].includes(target)) {
    return { issue, error: "INVALID_TRANSITION" };
  }

  const rejected = target === "REJECTED";
  const timestamp = `2025-04-08 11:${String(sequence).padStart(2, "0")} KST`;
  const event: IssueAuditEvent = {
    id: `AUD-${issue.id}-${String(sequence).padStart(3, "0")}`,
    issueId: issue.id,
    timestamp,
    actor: "DEMO_REVIEWER_UNAUTHENTICATED",
    action: rejected ? "REVIEW_REJECTED" : "STATUS_CHANGED",
    detail: `${issue.status} → ${target} 로컬 시뮬레이션`,
  };

  return {
    error: null,
    issue: {
      ...issue,
      status: target,
      reviewDecision: issue.id === "PAY-002" ? "HOLD" : rejected ? "REJECTED" : target === "COMPLETED" ? "SIMULATED_REVIEWED" : "PENDING",
      audit: [...issue.audit, event],
    },
  };
}

export function assignIssue(
  issue: DemoIssueRecord,
  assignee: DemoAssignee,
  permission: IssuePermission,
  sequence = issue.audit.length + 1,
): { issue: DemoIssueRecord; error: IssueTransitionError | null } {
  if (permission !== "EDITOR") return { issue, error: "PERMISSION_DENIED" };
  if (issue.assignee === assignee) return { issue, error: "INVALID_TRANSITION" };

  const event: IssueAuditEvent = {
    id: `AUD-${issue.id}-${String(sequence).padStart(3, "0")}`,
    issueId: issue.id,
    timestamp: `2025-04-08 12:${String(sequence).padStart(2, "0")} KST`,
    actor: "DEMO_REVIEWER_UNAUTHENTICATED",
    action: "ASSIGNED",
    detail: `${issue.assignee} → ${assignee} 로컬 담당자 변경`,
  };

  return { issue: { ...issue, assignee, audit: [...issue.audit, event] }, error: null };
}
