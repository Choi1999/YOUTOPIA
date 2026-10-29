
import type { AnalysisTarget } from "../../analysis-target/analysisTarget";
import type { AnalysisSnapshot } from "./analysisSnapshot";

/**
 * 프론트엔드 내부 근거 참조 후보 모델.
 * 아직 공유 API 계약에 포함하지 않는다.
 *
 * 원문 댓글이나 개인정보는 보관하지 않는다.
 */
export type AnalysisEvidencePointer = Readonly<{
  evidenceId: string;
  snapshotId: string;
  target: AnalysisTarget;

  kind:
    | "COMMENT_SAMPLE"
    | "TOPIC_AGGREGATE"
    | "METHODOLOGY_NOTE";

  topicId: string | null;

  sourceType: AnalysisSnapshot["sourceType"];
  isSynthetic: boolean;

  visibility: AnalysisSnapshot["visibility"];
  tenantId: string | null;
}>;

/**
 * 근거 참조와 스냅샷의 메타데이터 일관성 검사.
 *
 * true는 연결 정보가 일치한다는 뜻이지,
 * 실제 근거의 존재·신뢰성·사용 권한을 증명하지 않는다.
 */
export function isEvidencePointerConsistent(
  evidence: AnalysisEvidencePointer,
  snapshot: AnalysisSnapshot,
): boolean {
  const matches =
    evidence.evidenceId.trim().length > 0 &&
    evidence.snapshotId === snapshot.snapshotId &&
    evidence.target.source === snapshot.target.source &&
    evidence.target.targetType === snapshot.target.targetType &&
    evidence.target.targetId === snapshot.target.targetId &&
    evidence.sourceType === snapshot.sourceType &&
    evidence.isSynthetic === snapshot.isSynthetic &&
    evidence.visibility === snapshot.visibility &&
    evidence.tenantId === snapshot.tenantId;

  if (!matches) return false;

  if (
    evidence.isSynthetic !==
    (evidence.sourceType === "STATIC_FIXTURE")
  ) {
    return false;
  }

  if (
    evidence.visibility === "PUBLIC_REUSABLE" &&
    evidence.tenantId !== null
  ) {
    return false;
  }

  if (
    evidence.visibility === "TENANT_PRIVATE" &&
    !evidence.tenantId?.trim()
  ) {
    return false;
  }

  if (evidence.kind === "TOPIC_AGGREGATE") {
    return (
      evidence.topicId !== null &&
      snapshot.topics.some(
        (topic) => topic.topicId === evidence.topicId,
      )
    );
  }

  return evidence.topicId === null;
}
