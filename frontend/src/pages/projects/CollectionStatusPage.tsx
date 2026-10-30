import { Link, useParams } from "react-router-dom";

import { DEMO_PROJECT_ID, getRoute } from "../../app/routeDefinitions";
import {
  DEMO_VIDEOS,
  useProjectDemo,
  type CollectionStatus,
} from "../../features/project-demo/ProjectDemoProvider";
import { DEMO_COLLECTION_METRICS } from "../../features/project-demo/nexusDemoData";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

type StatePresentation = {
  label: string;
  description: string;
  timestamp: string;
  raw: number | null;
  analyzed: number | null;
  excluded: number | null;
};

const collectionPresentation: Record<CollectionStatus, StatePresentation> = {
  QUEUED: {
    label: "수집 대기",
    description: "인메모리 작업이 대기열에 추가된 것으로 시뮬레이션했습니다. 아직 댓글 수치는 없습니다.",
    timestamp: DEMO_COLLECTION_METRICS.QUEUED.timestamp,
    raw: DEMO_COLLECTION_METRICS.QUEUED.raw,
    analyzed: DEMO_COLLECTION_METRICS.QUEUED.eligible,
    excluded: DEMO_COLLECTION_METRICS.QUEUED.excluded,
  },
  RUNNING: {
    label: "수집 진행 중",
    description: "외부 요청 없이 결정된 중간 수치를 표시합니다. 브라우저를 새로고침하면 이 상태는 사라집니다.",
    timestamp: DEMO_COLLECTION_METRICS.RUNNING.timestamp,
    raw: DEMO_COLLECTION_METRICS.RUNNING.raw,
    analyzed: DEMO_COLLECTION_METRICS.RUNNING.eligible,
    excluded: DEMO_COLLECTION_METRICS.RUNNING.excluded,
  },
  PARTIAL: {
    label: "부분 수집",
    description: "개발자 라이브의 일부 댓글 구간이 누락된 데모입니다. 누락분은 0으로 대체하지 않고 결과 범위를 제한합니다.",
    timestamp: DEMO_COLLECTION_METRICS.PARTIAL.timestamp,
    raw: DEMO_COLLECTION_METRICS.PARTIAL.raw,
    analyzed: DEMO_COLLECTION_METRICS.PARTIAL.eligible,
    excluded: DEMO_COLLECTION_METRICS.PARTIAL.excluded,
  },
  FAILED: {
    label: "수집 실패",
    description: "시뮬레이션 오류로 이번 시도의 집계가 확정되지 않았습니다. 미확정 값은 0이 아니며 다시 시도할 수 있습니다.",
    timestamp: DEMO_COLLECTION_METRICS.FAILED.timestamp,
    raw: DEMO_COLLECTION_METRICS.FAILED.raw,
    analyzed: DEMO_COLLECTION_METRICS.FAILED.eligible,
    excluded: DEMO_COLLECTION_METRICS.FAILED.excluded,
  },
  SUCCEEDED: {
    label: "수집 완료",
    description: "세 영상의 결정된 데모 fixture 집계를 완료했습니다. 실제 YouTube API 수집 결과가 아닙니다.",
    timestamp: DEMO_COLLECTION_METRICS.SUCCEEDED.timestamp,
    raw: DEMO_COLLECTION_METRICS.SUCCEEDED.raw,
    analyzed: DEMO_COLLECTION_METRICS.SUCCEEDED.eligible,
    excluded: DEMO_COLLECTION_METRICS.SUCCEEDED.excluded,
  },
};

function formatMetric(value: number | null) {
  return value === null ? "미확정" : `${value.toLocaleString("ko-KR")}건`;
}

function videoState(status: CollectionStatus, index: number) {
  if (status === "SUCCEEDED") return "수집 완료";
  if (status === "QUEUED") return "대기";
  if (status === "RUNNING") return index === 0 ? "수집 완료" : index === 1 ? "수집 중" : "대기";
  if (status === "PARTIAL") return index < 2 ? "수집 완료" : "일부 누락";
  return index === 0 ? "확정 전" : "수집 실패";
}

export function CollectionStatusPage() {
  const { projectId } = useParams();
  const {
    project,
    projectId: activeProjectId,
    collectionStatus,
    attempt,
    retryCollection,
    resetDemo,
    setCollectionStatus,
  } = useProjectDemo();

  const hasActiveProject =
    project && collectionStatus && activeProjectId === DEMO_PROJECT_ID && projectId === DEMO_PROJECT_ID;

  if (!hasActiveProject) {
    return (
      <ProductScreenFrame title="수집 진행 · 완료 상태">
        <section className="collection-guard" aria-labelledby="collection-guard-title">
          <span className="simulation-pill">DEMO / NO ACTIVE RUN</span>
          <h2 id="collection-guard-title">진행 중인 인메모리 수집을 찾을 수 없습니다.</h2>
          <p role="alert">
            직접 주소로 들어오거나 새로고침하면 프로젝트와 수집 상태가 사라집니다. 성공 상태나 수집 수치를 임의로 만들지 않았습니다.
          </p>
          <Link className="primary-action" to={getRoute("YU-04").href}>프로젝트 생성으로 돌아가기</Link>
        </section>
      </ProductScreenFrame>
    );
  }

  const presentation = collectionPresentation[collectionStatus];
  const selectedVideos = project.selectedVideoIds
    .map((id) => DEMO_VIDEOS.find((video) => video.id === id))
    .filter((video): video is (typeof DEMO_VIDEOS)[number] => Boolean(video));
  const totalIsConsistent =
    presentation.raw === null ||
    presentation.analyzed === null ||
    presentation.excluded === null ||
    presentation.raw === presentation.analyzed + presentation.excluded;

  return (
    <ProductScreenFrame title="수집 진행 · 완료 상태">
      <section className="collection-status-banner" aria-live="polite" role="status">
        <div>
          <span className={`collection-state-pill state-${collectionStatus.toLowerCase()}`}>
            DEMO / {collectionStatus}
          </span>
          <h2>{presentation.label}</h2>
          <p>{presentation.description}</p>
        </div>
        <dl>
          <div><dt>프로젝트 ID</dt><dd>{DEMO_PROJECT_ID}</dd></div>
          <div><dt>시도</dt><dd>{attempt}회</dd></div>
          <div><dt>상태 시각</dt><dd>{presentation.timestamp}</dd></div>
        </dl>
      </section>

      <section className="collection-metrics" aria-label="시뮬레이션 수집 지표">
        <article><span>수집 영상</span><strong>{selectedVideos.length}개</strong><small>DEMO / SIMULATED</small></article>
        <article><span>원시 댓글</span><strong>{formatMetric(presentation.raw)}</strong><small>DEMO / SIMULATED</small></article>
        <article><span>분석 대상</span><strong>{formatMetric(presentation.analyzed)}</strong><small>DEMO / SIMULATED</small></article>
        <article><span>제외 / 보류</span><strong>{formatMetric(presentation.excluded)}</strong><small>DEMO / SIMULATED</small></article>
      </section>

      <section className="collection-records" aria-labelledby="collection-record-title">
        <div className="section-heading-row">
          <div>
            <h2 id="collection-record-title">데이터 수집 기록</h2>
            <p>선택 영상, 누락과 제외 사유, 결정된 데모 시각을 함께 표시합니다.</p>
          </div>
          <span className="simulation-pill">NO EXTERNAL REQUESTS</span>
        </div>

        <div className="collection-video-list">
          {selectedVideos.map((video, index) => (
            <article className="collection-video-row" key={video.id}>
              <span aria-hidden="true" className="video-index">{index + 1}</span>
              <div>
                <h3>{video.title}</h3>
                <p>{video.publishedAt.replaceAll("-", ".")} · {video.detail} · {videoState(collectionStatus, index)}</p>
              </div>
              <strong>{videoState(collectionStatus, index)}</strong>
            </article>
          ))}
        </div>

        <aside className="collection-integrity-note">
          <strong>{totalIsConsistent ? "수치 정의 일치" : "수치 정의 오류"}</strong>
          <p>
            {presentation.raw === null
              ? "이번 상태의 집계는 미확정입니다. 미확정·누락 데이터를 0건으로 표시하지 않습니다."
              : `${presentation.raw.toLocaleString("ko-KR")} = ${presentation.analyzed?.toLocaleString("ko-KR")} 분석 대상 + ${presentation.excluded?.toLocaleString("ko-KR")} 제외/보류`}
          </p>
        </aside>
      </section>

      <div className="collection-actions" aria-label="결정적 수집 상태 시뮬레이션">
        {collectionStatus !== "SUCCEEDED" && (
          <Link className="secondary-action" to={getRoute("YU-06").href}>
            현재 상태로 대시보드 미리보기
          </Link>
        )}
        {collectionStatus === "QUEUED" && (
          <button className="primary-action" onClick={() => setCollectionStatus("RUNNING")} type="button">수집 실행 시뮬레이션</button>
        )}
        {collectionStatus === "RUNNING" && (
          <>
            <button className="secondary-action" onClick={() => setCollectionStatus("PARTIAL")} type="button">부분 결과 시뮬레이션</button>
            <button className="secondary-action danger" onClick={() => setCollectionStatus("FAILED")} type="button">실패 시뮬레이션</button>
            <button className="primary-action" onClick={() => setCollectionStatus("SUCCEEDED")} type="button">완료 시뮬레이션</button>
          </>
        )}
        {collectionStatus === "PARTIAL" && (
          <>
            <button className="secondary-action" onClick={() => setCollectionStatus("RUNNING")} type="button">누락 설명 확인 후 계속</button>
            <button className="secondary-action danger" onClick={() => setCollectionStatus("FAILED")} type="button">실패 시뮬레이션</button>
          </>
        )}
        {collectionStatus === "FAILED" && (
          <button className="primary-action" onClick={retryCollection} type="button">데모 수집 다시 시도</button>
        )}
        {collectionStatus === "SUCCEEDED" && (
          <Link className="primary-action" to={getRoute("YU-06").href}>프로젝트 대시보드 보기 →</Link>
        )}
        <button className="secondary-action" onClick={resetDemo} type="button">인메모리 데모 초기화</button>
      </div>
    </ProductScreenFrame>
  );
}
