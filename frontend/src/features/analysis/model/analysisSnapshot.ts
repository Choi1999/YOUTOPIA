
import type { AnalysisTarget } from "../../analysis-target/analysisTarget";

/**
 * 기존 analysis-v1 후보 계약의 분석 결과 상태.
 * 실제 백엔드 연결 전까지는 검토 중인 구조다.
 */
export type AnalysisStatus =
  | "READY"
  | "PARTIAL"
  | "STALE"
  | "NO_DATA"
  | "COMMENTS_DISABLED"
  | "ENTITLEMENT_LIMITED"
  | "POLICY_BLOCKED"
  | "ERROR";

export type AnalysisSnapshot = Readonly<{
  contractVersion: "analysis-v1-candidate";
  snapshotId: string;
  target: AnalysisTarget;

  scope: Readonly<{
    mode: "ONE_VIDEO" | "SELECTED_CHANNEL_VIDEOS";
    windowStart: string;
    windowEnd: string;
    locale: string;
  }>;

  status: AnalysisStatus;
  sourceType: "STATIC_FIXTURE" | "APPROVED_PROVIDER";
  isSynthetic: boolean;

  visibility: "PUBLIC_REUSABLE" | "TENANT_PRIVATE";
  tenantId: string | null;

  observedAt: string | null;
  analyzedAt: string | null;

  sample: Readonly<{
    rawCount: number | null;
    eligibleCount: number | null;
    excludedCount: number | null;
    classifiedCount: number | null;
    unclassifiedCount: number | null;
  }> | null;

  sentiment: Readonly<{
    positive: number;
    neutral: number;
    negative: number;
  }> | null;

  topics: ReadonlyArray<Readonly<{
    topicId: string;
    mentionCount: number;
    classifiedTopicCount: number;
    negativeTopicCount: number;
  }>>;

  analysisVersion: string | null;
  topicTaxonomyVersion: string | null;
}>;
