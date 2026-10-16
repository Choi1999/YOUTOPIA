import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DEMO_PROJECT_ID, getRoute } from "../../app/routeDefinitions";
import { DataProvenance } from "../../features/project-insights/DataProvenance";
import { InsightMetricGrid } from "../../features/project-insights/InsightMetricGrid";
import { useProjectDemo } from "../../features/project-demo/ProjectDemoProvider";
import {
  DEMO_COLLECTION_METRICS,
  DEMO_COLLECTION_TOTALS,
  DEMO_DAILY_OBSERVATIONS,
  DEMO_ISSUES,
  deriveDashboardDataState,
  type DashboardDataState,
} from "../../features/project-demo/nexusDemoData";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

type DashboardOverride = "AUTO" | "EMPTY" | "STALE" | "UNAVAILABLE";

const stateCopy: Record<Exclude<DashboardDataState, "success" | "stale">, { title: string; description: string }> = {
  loading: {
    title: "수집 데이터를 준비하고 있습니다.",
    description: "QUEUED 또는 RUNNING 상태입니다. 분석 대상이나 감성 분류 완료를 주장하지 않습니다.",
  },
  empty: {
    title: "표시할 관측 데이터가 없습니다.",
    description: "프로젝트는 존재하지만 이 데모 상태에는 관측 레코드가 없습니다. 0건의 실제 관측으로 해석하지 마세요.",
  },
  partial: {
    title: "부분 수집 결과만 사용할 수 있습니다.",
    description: "누락된 영상 구간이 있어 전체 대시보드와 감성 분석을 열지 않습니다. YU-05에서 누락 사유를 확인해 주세요.",
  },
  failed: {
    title: "수집 실패로 대시보드를 만들 수 없습니다.",
    description: "이번 시도의 집계는 미확정입니다. 실패 값을 0으로 바꾸거나 이전 성공으로 대체하지 않습니다.",
  },
  unavailable: {
    title: "활성 프로젝트 데이터를 찾을 수 없습니다.",
    description: "직접 진입, 새로고침 또는 데모 가용성 시뮬레이션 상태입니다. 성공한 수집을 임의로 만들지 않았습니다.",
  },
};

function DashboardStatePanel({
  hasProject,
  state,
}: {
  hasProject: boolean;
  state: Exclude<DashboardDataState, "success" | "stale">;
}) {
  const copy = stateCopy[state];
  const partial = state === "partial" ? DEMO_COLLECTION_METRICS.PARTIAL : null;

  return (
    <section className={`dashboard-state-panel state-${state}`} aria-live="polite" role="status">
      <span className="simulation-pill">DEMO / {state.toUpperCase()}</span>
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
      {partial && (
        <dl className="partial-metric-summary">
          <div><dt>원시 댓글</dt><dd>{partial.raw?.toLocaleString("ko-KR")}건</dd></div>
          <div><dt>분석 대상 후보</dt><dd>{partial.eligible?.toLocaleString("ko-KR")}건</dd></div>
          <div><dt>제외/보류</dt><dd>{partial.excluded?.toLocaleString("ko-KR")}건</dd></div>
        </dl>
      )}
      <Link className="primary-action" to={getRoute(hasProject ? "YU-05" : "YU-04").href}>
        {hasProject ? "수집 상태 확인하기" : "프로젝트 생성으로 돌아가기"}
      </Link>
    </section>
  );
}

export function ProjectDashboardPage() {
  const { projectId } = useParams();
  const { project, projectId: activeProjectId, collectionStatus } = useProjectDemo();
  const [override, setOverride] = useState<DashboardOverride>("AUTO");
  const matchesActiveProject = Boolean(
    project && activeProjectId === DEMO_PROJECT_ID && projectId === DEMO_PROJECT_ID,
  );
  const dataState = deriveDashboardDataState(matchesActiveProject, collectionStatus, override);
  const showDashboard = dataState === "success" || dataState === "stale";
  const maxDaily = Math.max(...DEMO_DAILY_OBSERVATIONS.map((item) => item.rawComments));

  return (
    <ProductScreenFrame title="프로젝트 대시보드">
      {matchesActiveProject && collectionStatus === "SUCCEEDED" && (
        <label className="demo-state-selector">
          <span>대시보드 상태 시뮬레이션</span>
          <select value={override} onChange={(event) => setOverride(event.target.value as DashboardOverride)}>
            <option value="AUTO">성공 데이터</option>
            <option value="EMPTY">빈 데이터</option>
            <option value="STALE">오래된 데이터</option>
            <option value="UNAVAILABLE">사용 불가</option>
          </select>
        </label>
      )}

      {!showDashboard ? (
        <DashboardStatePanel hasProject={matchesActiveProject} state={dataState} />
      ) : (
        <>
          {dataState === "stale" && (
            <div className="data-state-warning" role="status">
              <strong>DEMO / STALE</strong>
              <span>관측 시각 2025-04-08 이후 갱신되지 않은 데이터입니다. 최신 상태로 해석하지 마세요.</span>
            </div>
          )}

          <InsightMetricGrid
            metrics={[
              { label: "선택 영상", value: `${DEMO_COLLECTION_TOTALS.selectedVideos}개`, note: "공개 영상 · DEMO" },
              { label: "원시 댓글", value: `${DEMO_COLLECTION_TOTALS.rawComments.toLocaleString("ko-KR")}건`, note: "수집 전체 분모" },
              { label: "분석 대상", value: `${DEMO_COLLECTION_TOTALS.eligibleComments.toLocaleString("ko-KR")}건`, note: "분류 완료와 다름" },
              { label: "검토할 후보", value: `${DEMO_COLLECTION_TOTALS.reviewCandidates}건`, note: "사람 검토 큐" },
            ]}
          />

          <div className="dashboard-main-grid">
            <section className="daily-observation-panel" aria-labelledby="daily-observation-title">
              <div className="section-heading-row">
                <div>
                  <h2 id="daily-observation-title">일별 댓글 관측량 · 공개 영상 3개</h2>
                  <p>전체 관측 창의 원시 댓글 합계 · 감성 분류 수치가 아님</p>
                </div>
                <span className="simulation-pill">DEMO SERIES</span>
              </div>
              <ol className="daily-bar-chart" aria-label="2025-03-01부터 2025-04-08까지 일별 원시 댓글 관측량">
                {DEMO_DAILY_OBSERVATIONS.map((item) => (
                  <li key={item.date} title={`${item.date}: ${item.rawComments}건`}>
                    <span style={{ height: `${Math.max(8, (item.rawComments / maxDaily) * 100)}%` }} />
                    <span className="sr-only">{item.date} {item.rawComments}건</span>
                  </li>
                ))}
              </ol>
              <p className="chart-caption">일별 관측 값 · 전체 합계 {DEMO_COLLECTION_TOTALS.rawComments.toLocaleString("ko-KR")}건 · 관측 시점 2025.04.08</p>
            </section>

            <section className="recent-issues-panel" aria-labelledby="recent-issues-title">
              <h2 id="recent-issues-title">최근 발견한 이슈</h2>
              <div className="recent-issue-list">
                {DEMO_ISSUES.filter((issue) => issue.id !== "STAB-005").map((issue) => (
                  <Link key={issue.id} to={`${getRoute("YU-07").href}?issue=${issue.id}`}>
                    <strong>{issue.id}</strong>
                    <span>{issue.summary}</span>
                    {issue.state === "HOLD" && <em>HOLD</em>}
                  </Link>
                ))}
              </div>
              <Link className="primary-action dashboard-next-action" to={getRoute("YU-07").href}>
                댓글 분석으로 이동 →
              </Link>
            </section>
          </div>

          <DataProvenance sourceIds={project?.selectedVideoIds ?? []} />
        </>
      )}
    </ProductScreenFrame>
  );
}
