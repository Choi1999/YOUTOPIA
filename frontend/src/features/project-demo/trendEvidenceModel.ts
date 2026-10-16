import {
  DEMO_COMPARISON_WINDOWS,
  DEMO_DAILY_OBSERVATIONS,
  DEMO_ISSUES,
  DEMO_OBSERVATION_WINDOW,
  DEMO_REPRESENTATIVE_COMMENTS,
  DEMO_SOURCE,
  DEMO_SOURCE_VIDEOS,
  type DemoIssueId,
} from "./nexusDemoData";

export type ComparabilityDecision = "COMPARABLE" | "CONDITIONAL" | "INCOMPARABLE";
export type ComparabilityFactorState = "PASS" | "WARN" | "FAIL";

export type ComparabilityInput = {
  publicationDates: ComparabilityFactorState;
  videoCohorts: ComparabilityFactorState;
  coverage: ComparabilityFactorState;
  measurementConsistency: ComparabilityFactorState;
};

export type ComparabilityFactor = {
  code: "PUBLICATION_DATES" | "VIDEO_COHORTS" | "COVERAGE" | "MEASUREMENT_CONSISTENCY";
  label: string;
  state: ComparabilityFactorState;
  reason: string;
};

export function evaluateComparability(input: ComparabilityInput): ComparabilityDecision {
  const states = Object.values(input);
  if (states.includes("FAIL")) return "INCOMPARABLE";
  if (states.includes("WARN")) return "CONDITIONAL";
  return "COMPARABLE";
}

export const FIXTURE_COMPARABILITY_INPUT: ComparabilityInput = {
  publicationDates: "WARN",
  videoCohorts: "WARN",
  coverage: "PASS",
  measurementConsistency: "PASS",
};

export const FIXTURE_COMPARABILITY_FACTORS: ComparabilityFactor[] = [
  {
    code: "PUBLICATION_DATES",
    label: "영상 게시일",
    state: FIXTURE_COMPARABILITY_INPUT.publicationDates,
    reason: "선택 영상이 2025-03-18, 03-24, 03-25에 게시되어 각 비교 창의 노출 기간이 다릅니다.",
  },
  {
    code: "VIDEO_COHORTS",
    label: "영상 모집단",
    state: FIXTURE_COMPARABILITY_INPUT.videoCohorts,
    reason: "패치 전후에 관측 가능한 영상 구성이 같지 않아 동일 모집단 비교가 아닙니다.",
  },
  {
    code: "COVERAGE",
    label: "일별 커버리지",
    state: FIXTURE_COMPARABILITY_INPUT.coverage,
    reason: "고정 fixture의 39개 일별 관측 슬롯이 모두 존재하며 누락 구간은 없습니다.",
  },
  {
    code: "MEASUREMENT_CONSISTENCY",
    label: "측정 정의",
    state: FIXTURE_COMPARABILITY_INPUT.measurementConsistency,
    reason: "두 비교 창 모두 동일한 rawComments 필드와 포함 날짜 규칙으로 합산합니다.",
  },
];

function observationsBetween(start: string, end: string) {
  return DEMO_DAILY_OBSERVATIONS.filter(({ date }) => date >= start && date <= end);
}

function total(observations: typeof DEMO_DAILY_OBSERVATIONS) {
  return observations.reduce((sum, observation) => sum + observation.rawComments, 0);
}

const beforeObservations = observationsBetween(
  DEMO_COMPARISON_WINDOWS.before.start,
  DEMO_COMPARISON_WINDOWS.before.end,
);
const afterObservations = observationsBetween(
  DEMO_COMPARISON_WINDOWS.after.start,
  DEMO_COMPARISON_WINDOWS.after.end,
);
const comparisonDates = new Set([...beforeObservations, ...afterObservations].map(({ date }) => date));
const outsideObservations = DEMO_DAILY_OBSERVATIONS.filter(({ date }) => !comparisonDates.has(date));

export const DEMO_TREND_OBSERVATION = {
  observationWindow: DEMO_OBSERVATION_WINDOW,
  before: {
    ...DEMO_COMPARISON_WINDOWS.before,
    days: beforeObservations.length,
    rawComments: total(beforeObservations),
  },
  after: {
    ...DEMO_COMPARISON_WINDOWS.after,
    days: afterObservations.length,
    rawComments: total(afterObservations),
  },
  outsideComparison: {
    days: outsideObservations.length,
    rawComments: total(outsideObservations),
    intervals: ["2025-03-01~2025-03-10", "2025-04-08"],
  },
  coverage: {
    expectedDays: 39,
    observedDays: DEMO_DAILY_OBSERVATIONS.length,
    missingIntervals: [] as string[],
  },
  sourceIds: DEMO_SOURCE_VIDEOS.map(({ id }) => id),
  observedAt: DEMO_SOURCE.observedAt,
  comparability: evaluateComparability(FIXTURE_COMPARABILITY_INPUT),
  factors: FIXTURE_COMPARABILITY_FACTORS,
  verifiedIncreaseBlocked: true,
} as const;

export type EvidenceAvailability =
  | "AVAILABLE"
  | "MISSING"
  | "DELETED"
  | "EXPIRED"
  | "STALE"
  | "ACCESS_DENIED"
  | "SYNTHETIC"
  | "BLOCKED";
export type EvidenceLineage = "SOURCE_OBSERVATION" | "DERIVED_METRIC" | "SIMULATED_EXCERPT";
export type ClaimReviewStatus = "OBSERVED_ONLY" | "HOLD" | "CONDITIONAL" | "BLOCKED";
export type ClaimReviewAction = "KEEP_OBSERVATION" | "PLACE_HOLD" | "REQUEST_REVIEW" | "ATTEMPT_VERIFY";
export type ClaimReasonCode =
  | "SYNTHETIC_SOURCE"
  | "COHORT_MISMATCH"
  | "TECHNICAL_VALIDATION_REQUIRED"
  | "CAUSALITY_NOT_ESTABLISHED"
  | "MISSING_EVIDENCE"
  | "STALE_EVIDENCE"
  | "POLICY_BLOCKED";

export type ClaimEvidence = {
  id: string;
  issueId: DemoIssueId;
  sourceId: string;
  observedAt: string;
  retrievedAt: string;
  availability: EvidenceAvailability;
  lineage: EvidenceLineage;
  coverage: string;
  policyState: "DEMO_ONLY" | "HOLD";
  synthetic: boolean;
};

export type ClaimReview = {
  issueId: DemoIssueId;
  title: string;
  statement: string;
  permittedConclusion: string;
  status: ClaimReviewStatus;
  reasonCodes: ClaimReasonCode[];
  uncertainty: string;
  evidence: ClaimEvidence[];
  realWorldVerified: boolean;
};

const commentEvidence = (issueId: DemoIssueId): ClaimEvidence[] =>
  DEMO_REPRESENTATIVE_COMMENTS.filter((comment) => comment.issueId === issueId).map((comment) => ({
    id: `EVD-${comment.id}`,
    issueId,
    sourceId: `${comment.videoId}/${comment.id}`,
    observedAt: comment.observedAt,
    retrievedAt: DEMO_SOURCE.observedAt,
    availability: "SYNTHETIC",
    lineage: "SIMULATED_EXCERPT",
    coverage: "고정 DEMO fixture 내 대표 합성 댓글",
    policyState: issueId === "PAY-002" ? "HOLD" : "DEMO_ONLY",
    synthetic: true,
  }));

export const DEMO_CLAIM_REVIEWS: ClaimReview[] = [
  {
    issueId: "PERF-001",
    title: "프레임 저하 호소",
    statement: "패치 이후 일부 이용자가 프레임 저하를 호소하고 있습니다.",
    permittedConclusion: "합성 데모 댓글에서 성능 저하 호소 표현이 관측되었습니다. 실제 게임 결함은 미검증입니다.",
    status: "OBSERVED_ONLY",
    reasonCodes: ["SYNTHETIC_SOURCE", "TECHNICAL_VALIDATION_REQUIRED", "CAUSALITY_NOT_ESTABLISHED"],
    uncertainty: "실제 원문, 재현 절차, 기기 환경과 기술 진단이 없어 결함 존재나 패치 원인을 확정할 수 없습니다.",
    evidence: commentEvidence("PERF-001"),
    realWorldVerified: false,
  },
  {
    issueId: "PAY-002",
    title: "과금 불만 증가 주장",
    statement: "패치 후 과금 불만이 증가했다는 주장을 검토합니다.",
    permittedConclusion: "과금 관련 불만 표현 후보가 있으나 증가 주장은 HOLD입니다.",
    status: "HOLD",
    reasonCodes: ["SYNTHETIC_SOURCE", "COHORT_MISMATCH", "CAUSALITY_NOT_ESTABLISHED"],
    uncertainty: "영상 게시일과 모집단이 달라 전후 증가를 검증할 비교 근거가 없습니다.",
    evidence: commentEvidence("PAY-002"),
    realWorldVerified: false,
  },
  {
    issueId: "BAL-003",
    title: "캐릭터 밸런스 논쟁",
    statement: "캐릭터 밸런스 관련 상반된 표현 후보를 검토합니다.",
    permittedConclusion: "합성 데모 댓글의 다중 라벨 후보이며 밸런스 우열은 미검증입니다.",
    status: "CONDITIONAL",
    reasonCodes: ["SYNTHETIC_SOURCE", "TECHNICAL_VALIDATION_REQUIRED"],
    uncertainty: "대표 합성 댓글 한 건만으로 플레이 환경 전체를 설명할 수 없습니다.",
    evidence: commentEvidence("BAL-003"),
    realWorldVerified: false,
  },
];

export function transitionClaimReview(claim: ClaimReview, action: ClaimReviewAction): ClaimReview {
  if (action === "ATTEMPT_VERIFY") {
    return {
      ...claim,
      status: claim.issueId === "PAY-002" ? "HOLD" : "BLOCKED",
      reasonCodes: Array.from(new Set([...claim.reasonCodes, "POLICY_BLOCKED"])) as ClaimReasonCode[],
      realWorldVerified: false,
    };
  }
  if (claim.issueId === "PAY-002") {
    return { ...claim, status: "HOLD", realWorldVerified: false };
  }
  if (action === "KEEP_OBSERVATION") {
    return { ...claim, status: "OBSERVED_ONLY", realWorldVerified: false };
  }
  if (action === "PLACE_HOLD") {
    return { ...claim, status: "HOLD", realWorldVerified: false };
  }
  return { ...claim, status: "CONDITIONAL", realWorldVerified: false };
}

export function canVerifyRealWorldClaim(claim: ClaimReview) {
  const blockedAvailability = claim.evidence.some(({ availability, synthetic }) =>
    availability !== "AVAILABLE" || synthetic,
  );
  return !blockedAvailability && claim.reasonCodes.length === 0 && claim.realWorldVerified;
}

export function simulateEvidenceAvailability(
  evidence: ClaimEvidence,
  availability: EvidenceAvailability,
): ClaimEvidence {
  return {
    ...evidence,
    availability,
    synthetic: true,
  };
}

export const ISSUE_BY_ID = new Map(DEMO_ISSUES.map((issue) => [issue.id, issue]));
