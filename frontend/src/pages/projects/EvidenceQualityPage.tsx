import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { DEMO_PROJECT_ID, getRoute } from "../../app/routeDefinitions";
import { useProjectDemo } from "../../features/project-demo/ProjectDemoProvider";
import {
  DEMO_CLAIM_REVIEWS,
  DEMO_TREND_OBSERVATION,
  transitionClaimReview,
  type ClaimReview,
  type ClaimReviewAction,
} from "../../features/project-demo/trendEvidenceModel";
import { ProjectDataGuard } from "../../features/project-insights/ProjectDataGuard";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

function isReviewId(value: string | null): value is ClaimReview["issueId"] {
  return DEMO_CLAIM_REVIEWS.some(({ issueId }) => issueId === value);
}

const actionCopy: Record<ClaimReviewAction, string> = {
  KEEP_OBSERVATION: "관측 상태 유지",
  PLACE_HOLD: "HOLD 적용",
  REQUEST_REVIEW: "추가 검토 요청",
  ATTEMPT_VERIFY: "실제 주장 승인 시도",
};

export function EvidenceQualityPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project, projectId: activeProjectId, collectionStatus } = useProjectDemo();
  const requestedId = searchParams.get("issue");
  const initialId: ClaimReview["issueId"] = isReviewId(requestedId) ? requestedId : "PERF-001";
  const [selectedId, setSelectedId] = useState<ClaimReview["issueId"]>(initialId);
  const [reviews, setReviews] = useState(DEMO_CLAIM_REVIEWS);
  const [announcement, setAnnouncement] = useState("검토할 주장을 선택해 주세요.");
  const available = Boolean(
    project &&
    activeProjectId === DEMO_PROJECT_ID &&
    projectId === DEMO_PROJECT_ID &&
    collectionStatus === "SUCCEEDED",
  );
  const selected = useMemo(
    () => reviews.find(({ issueId }) => issueId === selectedId) ?? reviews[0],
    [reviews, selectedId],
  );

  if (!available) {
    return (
      <ProductScreenFrame title="근거 및 데이터 품질 검증">
        <ProjectDataGuard hasProject={Boolean(project)} title="검증할 완료 수집을 찾을 수 없습니다." />
      </ProductScreenFrame>
    );
  }

  function selectReview(issueId: ClaimReview["issueId"]) {
    setSelectedId(issueId);
    const next = new URLSearchParams(searchParams);
    next.set("issue", issueId);
    setSearchParams(next, { replace: true });
    setAnnouncement(`${issueId} 검토 항목을 선택했습니다.`);
  }

  function applyAction(action: ClaimReviewAction) {
    const updated = transitionClaimReview(selected, action);
    setReviews((current) => current.map((review) => review.issueId === selected.issueId ? updated : review));
    const blocked = action === "ATTEMPT_VERIFY";
    setAnnouncement(
      blocked
        ? `${selected.issueId} 실제 주장 승인이 차단되었습니다. ${selected.issueId === "PAY-002" ? "증가 주장은 HOLD입니다." : "실제 게임 결함은 미검증입니다."}`
        : `${selected.issueId}에 ${actionCopy[action]} 상태를 적용했습니다.`,
    );
  }

  return (
    <ProductScreenFrame title="근거 및 데이터 품질 검증">
      <div className="evidence-intro-row">
        <p>NEXUS 시즌2 · 패치 2025.03.25 · YUTOPIA 시연 / 검증 상태를 우선합니다.</p>
        <span className="simulation-pill">DEMO / SIMULATED REVIEW</span>
      </div>

      <div className="evidence-review-grid">
        <section className="claim-list-panel" aria-labelledby="claim-list-title">
          <h2 id="claim-list-title">분석 주장 · 근거 확인</h2>
          <div className="claim-review-list">
            {reviews.map((review) => (
              <button
                aria-pressed={selected.issueId === review.issueId}
                className={selected.issueId === review.issueId ? "selected" : ""}
                key={review.issueId}
                onClick={() => selectReview(review.issueId)}
                type="button"
              >
                <span><strong>{review.issueId}</strong> · {review.title}</span>
                <small>{review.permittedConclusion}</small>
                <em className={`claim-status state-${review.status.toLowerCase()}`}>{review.status}</em>
              </button>
            ))}
          </div>
        </section>

        <section className="selected-claim-panel" aria-labelledby="selected-claim-title">
          <div className="section-heading-row">
            <div>
              <span className={`claim-status state-${selected.status.toLowerCase()}`}>{selected.status}</span>
              <h2 id="selected-claim-title">선택한 주장 / {selected.issueId}</h2>
            </div>
            <span className="simulation-pill">REAL-WORLD VERIFIED: NO</span>
          </div>
          <h3>{selected.statement}</h3>
          <p className="permitted-conclusion">허용 결론: {selected.permittedConclusion}</p>
          <dl className="claim-summary-list">
            <div><dt>비교 가능성</dt><dd>{DEMO_TREND_OBSERVATION.comparability}</dd></div>
            <div><dt>근거 가용성</dt><dd>{selected.evidence.map(({ availability }) => availability).join(", ")}</dd></div>
            <div><dt>불확실성</dt><dd>{selected.uncertainty}</dd></div>
          </dl>
          <div className="reason-code-list" aria-label="판정 사유 코드">
            {selected.reasonCodes.map((code) => <span key={code}>{code}</span>)}
          </div>
          <div className="review-action-row" aria-label={`${selected.issueId} 리뷰어 작업`}>
            <button onClick={() => applyAction("KEEP_OBSERVATION")} type="button">관측 상태 유지</button>
            <button onClick={() => applyAction("PLACE_HOLD")} type="button">HOLD 적용</button>
            <button onClick={() => applyAction("REQUEST_REVIEW")} type="button">추가 검토 요청</button>
            <button className="danger-action" onClick={() => applyAction("ATTEMPT_VERIFY")} type="button">실제 주장 승인 시도</button>
          </div>
          <p className="review-announcement" aria-live="polite" role="status">{announcement}</p>
        </section>
      </div>

      <section className="evidence-lineage-panel" aria-labelledby="evidence-lineage-title">
        <div className="section-heading-row">
          <div>
            <h2 id="evidence-lineage-title">근거 계보 · 가용성</h2>
            <p>누락·합성·오래됨·차단 근거는 실제 검증 완료로 승격할 수 없습니다.</p>
          </div>
          <span className="simulation-pill">{selected.evidence.length} DEMO EVIDENCE</span>
        </div>
        <div className="evidence-table-wrap">
          <table>
            <thead><tr><th>근거 ID</th><th>소스 ID</th><th>관측일</th><th>조회 시각</th><th>가용성</th><th>계보</th><th>정책</th></tr></thead>
            <tbody>
              {selected.evidence.map((evidence) => (
                <tr key={evidence.id}>
                  <td>{evidence.id}</td><td>{evidence.sourceId}</td><td>{evidence.observedAt}</td>
                  <td>{evidence.retrievedAt}</td><td>{evidence.availability}</td><td>{evidence.lineage}</td><td>{evidence.policyState}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="evidence-policy-warning" role="alert">
        PERF-001은 댓글의 성능 저하 호소 관측만 허용하며 실제 게임 결함은 미검증입니다. PAY-002는 모집단 불일치로
        증가 주장을 HOLD합니다. 모든 상태와 리뷰 작업은 로컬 시뮬레이션이며 실세계 검증이 아닙니다.
      </p>

      <div className="evidence-next-action">
        <Link className="secondary-action" to={`/projects/${DEMO_PROJECT_ID}/evidence/${selected.issueId}`}>
          {selected.issueId} 근거 상세 검토 →
        </Link>
      </div>
    </ProductScreenFrame>
  );
}
