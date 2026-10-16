import { Link, useParams } from "react-router-dom";

import { DEMO_PROJECT_ID, getRoute } from "../../app/routeDefinitions";
import { useProjectDemo } from "../../features/project-demo/ProjectDemoProvider";
import { DEMO_DAILY_OBSERVATIONS, DEMO_SOURCE_VIDEOS } from "../../features/project-demo/nexusDemoData";
import { DEMO_TREND_OBSERVATION } from "../../features/project-demo/trendEvidenceModel";
import { DataProvenance } from "../../features/project-insights/DataProvenance";
import { ProjectDataGuard } from "../../features/project-insights/ProjectDataGuard";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

const decisionCopy = {
  COMPARABLE: "동일 조건 비교 가능",
  CONDITIONAL: "조건부 비교 · 검증된 증가 주장 차단",
  INCOMPARABLE: "비교 불가 · 수치 해석 차단",
} as const;

export function ProjectTrendPage() {
  const { projectId } = useParams();
  const { project, projectId: activeProjectId, collectionStatus } = useProjectDemo();
  const available = Boolean(
    project &&
    activeProjectId === DEMO_PROJECT_ID &&
    projectId === DEMO_PROJECT_ID &&
    collectionStatus === "SUCCEEDED",
  );

  if (!available) {
    return (
      <ProductScreenFrame title="트렌드 관측 · 패치 전후 비교">
        <ProjectDataGuard hasProject={Boolean(project)} title="완료된 인메모리 수집이 필요합니다." />
      </ProductScreenFrame>
    );
  }

  const maxDaily = Math.max(...DEMO_DAILY_OBSERVATIONS.map(({ rawComments }) => rawComments));

  return (
    <ProductScreenFrame title="트렌드 관측 · 패치 전후 비교">
      <div className="trend-intro-row">
        <div>
          <p>NEXUS 시즌2 · v1.4 업데이트 · 원천 데이터의 범위와 해석을 구분합니다.</p>
          <span className="event-date-badge">패치일 2025.03.25</span>
        </div>
        <span className="simulation-pill">DEMO / SIMULATED</span>
      </div>

      <div className="trend-main-grid">
        <section className="trend-chart-panel" aria-labelledby="trend-chart-title">
          <div className="section-heading-row">
            <div>
              <h2 id="trend-chart-title">관측 댓글 언급량 · 출처: 선택된 공식 영상</h2>
              <p>기존 39일 rawComments fixture에서 직접 파생한 일별 수치입니다.</p>
            </div>
            <span className="simulation-pill">DERIVED DEMO METRIC</span>
          </div>
          <ol className="trend-bar-chart" aria-label="2025-03-01부터 2025-04-08까지 일별 데모 원시 댓글 관측량">
            {DEMO_DAILY_OBSERVATIONS.map((item) => (
              <li key={item.date} title={`${item.date}: ${item.rawComments}건`}>
                <span style={{ height: `${Math.max(7, (item.rawComments / maxDaily) * 100)}%` }} />
                <span className="sr-only">{item.date} {item.rawComments}건</span>
              </li>
            ))}
          </ol>
          <div className="trend-window-axis" aria-hidden="true">
            <span>03.11–03.24 · 14일</span>
            <span>03.25–04.07 · 14일</span>
          </div>
          <p className="chart-caption">
            전체 관측 창 39일 중 비교 창 28일, 비교 창 밖 11일({DEMO_TREND_OBSERVATION.outsideComparison.intervals.join(", ")})
            · 밖의 관측 {DEMO_TREND_OBSERVATION.outsideComparison.rawComments.toLocaleString("ko-KR")}건도 전체 합계에 포함됩니다.
          </p>
        </section>

        <aside className="trend-comparison-panel" aria-labelledby="comparison-title">
          <h2 id="comparison-title">비교 조건 확인</h2>
          <div className="comparison-metric-card">
            <span>패치 전 14일</span>
            <strong>{DEMO_TREND_OBSERVATION.before.rawComments.toLocaleString("ko-KR")}건</strong>
            <small>{DEMO_TREND_OBSERVATION.before.start}~{DEMO_TREND_OBSERVATION.before.end} · 분모 14일</small>
          </div>
          <div className="comparison-metric-card">
            <span>패치 후 14일</span>
            <strong>{DEMO_TREND_OBSERVATION.after.rawComments.toLocaleString("ko-KR")}건</strong>
            <small>{DEMO_TREND_OBSERVATION.after.start}~{DEMO_TREND_OBSERVATION.after.end} · 분모 14일</small>
          </div>
          <div className={`comparability-decision state-${DEMO_TREND_OBSERVATION.comparability.toLowerCase()}`} role="status">
            <strong>{DEMO_TREND_OBSERVATION.comparability}</strong>
            <span>{decisionCopy[DEMO_TREND_OBSERVATION.comparability]}</span>
          </div>
        </aside>
      </div>

      <section className="comparison-audit" aria-labelledby="comparison-audit-title">
        <div className="section-heading-row">
          <div>
            <h2 id="comparison-audit-title">비교 가능성 감사</h2>
            <p>영상 게시일·모집단·커버리지·측정 정의를 각각 판정합니다.</p>
          </div>
          <span className="simulation-pill">MISSING INTERVALS 0</span>
        </div>
        <div className="comparison-factor-grid">
          {DEMO_TREND_OBSERVATION.factors.map((factor) => (
            <article key={factor.code}>
              <span className={`factor-state state-${factor.state.toLowerCase()}`}>{factor.state}</span>
              <h3>{factor.label}</h3>
              <p>{factor.reason}</p>
            </article>
          ))}
        </div>
        <p className="trend-claim-block" role="alert">
          검증된 증가 주장 차단: 영상 모집단과 노출 조건이 같지 않습니다. 관측량 차이는 패치 인과, 게임 매출,
          전체 이용자 관심 또는 시장 전체 인기를 뜻하지 않습니다.
        </p>
      </section>

      <section className="source-cohort-ledger" aria-labelledby="source-cohort-title">
        <h2 id="source-cohort-title">영상 코호트 · 관측 시점</h2>
        <div>
          {DEMO_SOURCE_VIDEOS.map((video) => (
            <article key={video.id}>
              <strong>{video.id}</strong>
              <span>{video.title}</span>
              <small>게시일 {video.publishedAt}</small>
            </article>
          ))}
        </div>
        <p>관측 시각 {DEMO_TREND_OBSERVATION.observedAt} · 커버리지 {DEMO_TREND_OBSERVATION.coverage.observedDays}/{DEMO_TREND_OBSERVATION.coverage.expectedDays}일 · 누락 구간 없음</p>
      </section>

      <DataProvenance sourceIds={project?.selectedVideoIds ?? []} />

      <div className="analysis-next-action">
        <Link className="primary-action" to={getRoute("YU-09").href}>분석 근거 검증 →</Link>
      </div>
    </ProductScreenFrame>
  );
}
