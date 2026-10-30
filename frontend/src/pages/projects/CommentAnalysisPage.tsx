import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { DEMO_PROJECT_ID, getRoute } from "../../app/routeDefinitions";
import { DataProvenance } from "../../features/project-insights/DataProvenance";
import { InsightMetricGrid } from "../../features/project-insights/InsightMetricGrid";
import { useProjectDemo } from "../../features/project-demo/ProjectDemoProvider";
import {
  DEMO_COLLECTION_TOTALS,
  DEMO_ISSUES,
  DEMO_REPRESENTATIVE_COMMENTS,
  DEMO_SENTIMENT_DISTRIBUTION,
  type DemoIssueId,
  type SentimentId,
} from "../../features/project-demo/nexusDemoData";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

type SentimentFilter = "all" | SentimentId;

const sentimentTabs: Array<{ id: SentimentFilter; label: string }> = [
  { id: "all", label: "전체" },
  ...DEMO_SENTIMENT_DISTRIBUTION.map(({ id, label }) => ({ id, label })),
];

function isIssueId(value: string | null): value is DemoIssueId {
  return DEMO_ISSUES.some((issue) => issue.id === value);
}

export function CommentAnalysisPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project, projectId: activeProjectId, collectionStatus } = useProjectDemo();
  const initialIssue = isIssueId(searchParams.get("issue")) ? searchParams.get("issue") as DemoIssueId : "PERF-001";
  const [selectedIssueId, setSelectedIssueId] = useState<DemoIssueId>(initialIssue);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [issueFilter, setIssueFilter] = useState<"ALL" | DemoIssueId>("ALL");
  const available = Boolean(
    project &&
    activeProjectId === DEMO_PROJECT_ID &&
    projectId === DEMO_PROJECT_ID &&
    collectionStatus === "SUCCEEDED",
  );

  const selectedIssue = DEMO_ISSUES.find((issue) => issue.id === selectedIssueId) ?? DEMO_ISSUES[0];
  const visibleIssues = issueFilter === "ALL"
    ? DEMO_ISSUES
    : DEMO_ISSUES.filter((issue) => issue.id === issueFilter);
  const visibleComments = useMemo(
    () => DEMO_REPRESENTATIVE_COMMENTS.filter(
      (comment) => comment.issueId === selectedIssue.id &&
        (sentimentFilter === "all" || comment.sentiment === sentimentFilter),
    ),
    [selectedIssue.id, sentimentFilter],
  );
  const maxSentiment = Math.max(...DEMO_SENTIMENT_DISTRIBUTION.map((item) => item.count));
  const issueAssignmentCount = DEMO_ISSUES.reduce((sum, issue) => sum + issue.count, 0);

  function selectIssue(issueId: DemoIssueId) {
    setSelectedIssueId(issueId);
    const next = new URLSearchParams(searchParams);
    next.set("issue", issueId);
    setSearchParams(next, { replace: true });
  }

  if (!available) {
    return (
      <ProductScreenFrame title="댓글 감성 · 이슈 분석">
        <section className="analysis-guard" aria-labelledby="analysis-guard-title">
          <span className="simulation-pill">DEMO / UNAVAILABLE</span>
          <h2 id="analysis-guard-title">완료된 인메모리 수집이 필요합니다.</h2>
          <p role="alert">직접 진입, 새로고침, 부분 수집 또는 실패 상태에서는 분류 결과를 만들지 않습니다.</p>
          <Link className="primary-action" to={getRoute(project ? "YU-05" : "YU-04").href}>
            {project ? "수집 상태 확인하기" : "프로젝트 생성으로 돌아가기"}
          </Link>
        </section>
      </ProductScreenFrame>
    );
  }

  return (
    <ProductScreenFrame title="댓글 감성 · 이슈 분석">
      <InsightMetricGrid
        metrics={[
          { label: "수집된 원시 댓글", value: `${DEMO_COLLECTION_TOTALS.rawComments.toLocaleString("ko-KR")}건`, note: "전체 수집 분모" },
          { label: "분석 대상 댓글", value: `${DEMO_COLLECTION_TOTALS.eligibleComments.toLocaleString("ko-KR")}건`, note: "분류 가능 후보" },
          { label: "제외 · 보류", value: `${DEMO_COLLECTION_TOTALS.excludedComments.toLocaleString("ko-KR")}건`, note: "수집 분모에서 제외" },
        ]}
      />

      <section className="classification-ledger" aria-label="분류 분모 정합성">
        <div><span>분류 완료</span><strong>{DEMO_COLLECTION_TOTALS.classifiedComments.toLocaleString("ko-KR")}건</strong></div>
        <div><span>분석 대상 중 미분류</span><strong>{DEMO_COLLECTION_TOTALS.unclassifiedEligibleComments.toLocaleString("ko-KR")}건</strong></div>
        <p>
          원시 {DEMO_COLLECTION_TOTALS.rawComments.toLocaleString("ko-KR")} = 분석 대상 {DEMO_COLLECTION_TOTALS.eligibleComments.toLocaleString("ko-KR")} + 제외/보류 {DEMO_COLLECTION_TOTALS.excludedComments.toLocaleString("ko-KR")} · 분석 대상 {DEMO_COLLECTION_TOTALS.eligibleComments.toLocaleString("ko-KR")} = 분류 완료 {DEMO_COLLECTION_TOTALS.classifiedComments.toLocaleString("ko-KR")} + 미분류 {DEMO_COLLECTION_TOTALS.unclassifiedEligibleComments.toLocaleString("ko-KR")}
        </p>
      </section>

      <div className="analysis-main-grid">
        <section className="sentiment-panel" aria-labelledby="sentiment-title">
          <div className="section-heading-row">
            <div>
              <h2 id="sentiment-title">분류별 건수 · {DEMO_COLLECTION_TOTALS.eligibleComments.toLocaleString("ko-KR")}건</h2>
              <p>고정된 데모 분류 결과이며 실제 LLM 추론이 아닙니다.</p>
            </div>
            <span className="simulation-pill">SIMULATED CLASSIFICATION</span>
          </div>
          <div className="sentiment-bars">
            {DEMO_SENTIMENT_DISTRIBUTION.map((item) => (
              <div className={`sentiment-row tone-${item.tone}`} key={item.id}>
                <span>{item.label}</span>
                <div><i style={{ width: `${(item.count / maxSentiment) * 100}%` }} /></div>
                <strong>{item.count.toLocaleString("ko-KR")}건</strong>
              </div>
            ))}
          </div>
          <p className="analysis-disclaimer">분류 합계는 분석 대상 분모와 일치하지만, 댓글이 실제 버그·가격 인상·원인 관계를 입증하지는 않습니다.</p>
        </section>

        <section className="issue-top-panel" aria-labelledby="issue-top-title">
          <div className="section-heading-row">
            <div>
              <h2 id="issue-top-title">이슈 TOP 5 · 중복 분류 가능</h2>
              <p>다중 라벨 할당 {issueAssignmentCount.toLocaleString("ko-KR")}건 / 분석 대상 {DEMO_COLLECTION_TOTALS.eligibleComments.toLocaleString("ko-KR")}건 · 한 댓글이 여러 카테고리에 포함될 수 있습니다.</p>
            </div>
            <label className="issue-filter-control">
              <span>이슈 필터</span>
              <select
                value={issueFilter}
                onChange={(event) => {
                  const value = event.target.value as "ALL" | DemoIssueId;
                  setIssueFilter(value);
                  if (value !== "ALL") selectIssue(value);
                }}
              >
                <option value="ALL">전체 이슈</option>
                {DEMO_ISSUES.map((issue) => <option key={issue.id} value={issue.id}>{issue.id} · {issue.category}</option>)}
              </select>
            </label>
          </div>
          <div className="issue-candidate-list">
            {visibleIssues.map((issue) => (
              <button
                aria-pressed={selectedIssue.id === issue.id}
                className={selectedIssue.id === issue.id ? "selected" : ""}
                key={issue.id}
                onClick={() => selectIssue(issue.id)}
                type="button"
              >
                <span><strong>{issue.category}</strong><small>{issue.id}</small></span>
                <span>{issue.count.toLocaleString("ko-KR")}건 · 다중 라벨 후보</span>
                <em className={`issue-state state-${issue.state.toLowerCase()}`}>{issue.state}</em>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="issue-detail-panel" aria-labelledby="issue-detail-title">
        <div className="issue-detail-heading">
          <div>
            <span className={`issue-state state-${selectedIssue.state.toLowerCase()}`}>{selectedIssue.state}</span>
            <h2 id="issue-detail-title">{selectedIssue.id} · {selectedIssue.category}</h2>
            <p>{selectedIssue.summary}</p>
          </div>
          <Link className="secondary-action" to={selectedIssue.evidencePath}>근거 화면으로 이동</Link>
        </div>
        <p className="issue-interpretation">{selectedIssue.interpretation}</p>

        <div className="sentiment-tabs" role="tablist" aria-label="대표 댓글 감성 필터">
          {sentimentTabs.map((tab) => (
            <button
              aria-selected={sentimentFilter === tab.id}
              key={tab.id}
              onClick={() => setSentimentFilter(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="representative-comment-list" aria-live="polite">
          {visibleComments.length > 0 ? visibleComments.map((comment) => (
            <article key={comment.id}>
              <div>
                <span className="synthetic-badge">SYNTHETIC / {comment.sentiment.toUpperCase()}</span>
                <strong>{comment.id}</strong>
              </div>
              <blockquote>“{comment.text}”</blockquote>
              <p>소스 ID {comment.videoId} · 관측일 {comment.observedAt} · 실제 YouTube 원문이 아닌 합성 샘플</p>
            </article>
          )) : (
            <p className="empty-filter-result" role="status">선택한 감성 조건에 해당하는 합성 대표 댓글이 없습니다.</p>
          )}
        </div>
      </section>

      <DataProvenance sourceIds={project?.selectedVideoIds ?? []} />

      <div className="analysis-next-action">
        <Link className="primary-action" to={getRoute("YU-08").href}>트렌드 관측 및 비교 →</Link>
      </div>
    </ProductScreenFrame>
  );
}
