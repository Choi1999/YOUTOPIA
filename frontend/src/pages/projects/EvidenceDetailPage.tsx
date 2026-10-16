import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DEMO_PROJECT_ID, getRoute } from "../../app/routeDefinitions";
import { useProjectDemo } from "../../features/project-demo/ProjectDemoProvider";
import {
  DEMO_CLAIM_REVIEWS,
  simulateEvidenceAvailability,
  type ClaimReview,
  type EvidenceAvailability,
} from "../../features/project-demo/trendEvidenceModel";
import { ProjectDataGuard } from "../../features/project-insights/ProjectDataGuard";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

const availabilityOptions: EvidenceAvailability[] = [
  "AVAILABLE",
  "MISSING",
  "DELETED",
  "EXPIRED",
  "STALE",
  "ACCESS_DENIED",
];

const availabilityCopy: Record<EvidenceAvailability, { title: string; detail: string; contentVisible: boolean }> = {
  AVAILABLE: { title: "자료 사용 가능 · 합성 데모", detail: "고정 fixture의 합성 댓글과 메타데이터를 표시합니다.", contentVisible: true },
  MISSING: { title: "근거 누락", detail: "근거 레코드가 없어 원문을 0건 또는 확인됨으로 대체하지 않습니다.", contentVisible: false },
  DELETED: { title: "삭제됨", detail: "삭제된 근거의 내용은 복원하거나 캐시된 원문처럼 표시하지 않습니다.", contentVisible: false },
  EXPIRED: { title: "접근 기간 만료", detail: "만료된 근거는 재확인 전까지 검토에 사용할 수 없습니다.", contentVisible: false },
  STALE: { title: "오래된 근거", detail: "관측 시각 이후 갱신되지 않았으며 최신 상태로 해석할 수 없습니다.", contentVisible: true },
  ACCESS_DENIED: { title: "접근 거부", detail: "현재 데모 검토 권한으로 근거 내용을 열 수 없습니다.", contentVisible: false },
  SYNTHETIC: { title: "합성 근거", detail: "실제 YouTube 원문이 아닌 고정 데모 샘플입니다.", contentVisible: true },
  BLOCKED: { title: "정책 차단", detail: "정책 상태가 해제되기 전까지 근거를 검증에 사용할 수 없습니다.", contentVisible: false },
};

function findClaim(claimId: string | undefined): ClaimReview | undefined {
  return DEMO_CLAIM_REVIEWS.find((claim) => claim.issueId === claimId);
}

export function EvidenceDetailPage() {
  const { projectId, claimId } = useParams();
  const { project, projectId: activeProjectId, collectionStatus } = useProjectDemo();
  const claim = findClaim(claimId);
  const [availability, setAvailability] = useState<EvidenceAvailability>("AVAILABLE");
  const [reviewNote, setReviewNote] = useState("합성 데모 근거의 범위와 한계를 확인했습니다.");
  const presentedEvidence = useMemo(
    () => claim?.evidence.map((evidence) => simulateEvidenceAvailability(evidence, availability)) ?? [],
    [availability, claim],
  );
  const available = Boolean(
    project &&
    activeProjectId === DEMO_PROJECT_ID &&
    projectId === DEMO_PROJECT_ID &&
    collectionStatus === "SUCCEEDED",
  );

  if (!claimId) {
    return (
      <ProductScreenFrame title="근거 상세 검토">
        <section className="analysis-guard" aria-labelledby="missing-claim-title">
          <span className="simulation-pill">DEMO / MISSING CLAIM ID</span>
          <h2 id="missing-claim-title">검토할 주장 ID가 필요합니다.</h2>
          <p role="alert">빈 ID로 근거를 생성하거나 PERF-001로 자동 확정하지 않습니다.</p>
          <Link className="primary-action" to={getRoute("YU-09").href}>근거 목록으로 돌아가기</Link>
        </section>
      </ProductScreenFrame>
    );
  }

  if (!claim) {
    return (
      <ProductScreenFrame title="근거 상세 검토">
        <section className="analysis-guard" aria-labelledby="invalid-claim-title">
          <span className="simulation-pill">DEMO / INVALID CLAIM ID</span>
          <h2 id="invalid-claim-title">지원하지 않는 주장 ID입니다.</h2>
          <p role="alert">요청 ID: {claimId} · 존재하지 않는 주장이나 근거를 만들지 않았습니다.</p>
          <Link className="primary-action" to={getRoute("YU-09").href}>근거 목록으로 돌아가기</Link>
        </section>
      </ProductScreenFrame>
    );
  }

  if (!available) {
    return (
      <ProductScreenFrame title={`${claim.issueId} · 근거 상세 검토`}>
        <ProjectDataGuard hasProject={Boolean(project)} title="근거 상세에 필요한 완료 수집이 없습니다." />
      </ProductScreenFrame>
    );
  }

  const presentation = availabilityCopy[availability];

  return (
    <ProductScreenFrame title={`${claim.issueId} · 근거 상세 검토`}>
      <div className="evidence-detail-intro">
        <p>NEXUS 시즌2 · 패치 2025.03.25 · 관측 사실과 실제 결함·인과관계를 구분합니다.</p>
        <label>
          <span>근거 가용성 시뮬레이션</span>
          <select value={availability} onChange={(event) => setAvailability(event.target.value as EvidenceAvailability)}>
            {availabilityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="evidence-detail-grid">
        <section className="evidence-source-panel" aria-labelledby="linked-evidence-title">
          <div className="section-heading-row">
            <div>
              <h2 id="linked-evidence-title">연결된 댓글 근거 · 시연</h2>
              <p>실제 YouTube 원문이 아닌 합성 댓글만 사용합니다.</p>
            </div>
            <span className="synthetic-badge">SYNTHETIC</span>
          </div>

          <div className={`evidence-availability-banner state-${availability.toLowerCase()}`} role="status">
            <strong>{presentation.title}</strong>
            <span>{presentation.detail}</span>
          </div>

          {presentation.contentVisible ? (
            <div className="evidence-source-list">
              {presentedEvidence.map((evidence) => (
                <article key={evidence.id}>
                  <div><strong>{evidence.id}</strong><span className="synthetic-badge">SYNTHETIC COMMENT</span></div>
                  <p>{claim.permittedConclusion}</p>
                  <dl>
                    <div><dt>소스 ID</dt><dd>{evidence.sourceId}</dd></div>
                    <div><dt>관측일</dt><dd>{evidence.observedAt}</dd></div>
                    <div><dt>조회 시각</dt><dd>{evidence.retrievedAt}</dd></div>
                    <div><dt>커버리지</dt><dd>{evidence.coverage}</dd></div>
                    <div><dt>가용성</dt><dd>{evidence.availability}</dd></div>
                    <div><dt>계보</dt><dd>{evidence.lineage}</dd></div>
                    <div><dt>정책 상태</dt><dd>{evidence.policyState}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="evidence-content-unavailable" role="alert">
              원문 내용은 표시하지 않습니다. 메타데이터 상태만 유지하며 실제 검증 완료로 승격하지 않습니다.
            </div>
          )}
        </section>

        <aside className="evidence-decision-panel" aria-labelledby="evidence-decision-title">
          <h2 id="evidence-decision-title">검토 및 의사결정</h2>
          <span className={`claim-status state-${claim.status.toLowerCase()}`}>{claim.status}</span>
          <div className="evidence-conclusion allowed">
            <strong>확인 가능한 결론</strong>
            <p>{claim.permittedConclusion}</p>
          </div>
          <div className="evidence-conclusion blocked">
            <strong>확인되지 않은 결론</strong>
            <p>{claim.uncertainty}</p>
          </div>
          <div className="reason-code-list" aria-label="근거 상세 사유 코드">
            {claim.reasonCodes.map((code) => <span key={code}>{code}</span>)}
          </div>
          <label className="review-note-field">
            <span>검토 메모 · 브라우저 메모리 전용</span>
            <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
          </label>
          <p className="review-limitation" role="alert">
            {claim.issueId === "PAY-002"
              ? "PAY-002는 HOLD이며 어떤 가용성에서도 증가 주장으로 승격할 수 없습니다."
              : "PERF-001은 호소 표현 관측이며 실제 게임 결함으로 승인할 수 없습니다."}
          </p>
          <Link className="primary-action" to={`${getRoute("YU-11").href}?issue=${claim.issueId}`}>
            검토 이슈로 등록 →
          </Link>
        </aside>
      </div>
    </ProductScreenFrame>
  );
}
