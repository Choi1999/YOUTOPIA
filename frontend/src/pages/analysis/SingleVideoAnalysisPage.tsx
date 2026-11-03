
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import "./single-video-analysis.css";

import {
  createAnalysisTarget,
  type AnalysisTarget,
} from "../../features/analysis-target/analysisTarget";

import { useAnalysisRepository } from "../../features/analysis/data/AnalysisRepositoryContext";
import { projectDemoAnalysisSnapshot } from "../../features/analysis/model/analysisProjection";
import type { AnalysisSnapshot } from "../../features/analysis/model/analysisSnapshot";
import { parseComparisonQuery, buildComparisonSharePath } from "../../features/analysis-target/comparisonShareLink";


type LoadState =
  | { kind: "LOADING" }
  | { kind: "NOT_FOUND" }
  | { kind: "ERROR" }
  | { kind: "FOUND"; snapshot: AnalysisSnapshot };

  /**
 * 분석 상태에 따른 화면 표현 규칙.
 *
 * 데이터가 없는 상태나 정책 차단 상태에서는
 * 표본 수치를 표시하지 않는다.
 */
const SNAPSHOT_PRESENTATION: Record<
  AnalysisSnapshot["status"],
  {
    title: string;
    description: string;
    showCounts: boolean;
  }
> = {
  READY: {
    title: "분석 스냅샷 조회 결과",
    description: "사용 가능한 분석 스냅샷입니다.",
    showCounts: true,
  },
  PARTIAL: {
    title: "부분 분석 결과",
    description: "확인된 표본 범위만 표시합니다. 일부 데이터가 누락되었을 수 있습니다.",
    showCounts: true,
  },
  STALE: {
    title: "오래된 분석 결과",
    description: "이전 관측 결과입니다. 최신 분석으로 해석할 수 없습니다.",
    showCounts: true,
  },
  NO_DATA: {
    title: "분석할 데이터가 없습니다.",
    description: "분석 결과는 존재하지만 사용 가능한 댓글 표본이 없습니다.",
    showCounts: false,
  },
  COMMENTS_DISABLED: {
    title: "댓글을 이용할 수 없습니다.",
    description: "현재 댓글 데이터에 접근할 수 없습니다.",
    showCounts: false,
  },
  ENTITLEMENT_LIMITED: {
    title: "현재 이용 범위에서 제공되지 않는 분석입니다.",
    description: "분석 결과 이용 권한이 제한되어 있습니다.",
    showCounts: false,
  },
  POLICY_BLOCKED: {
    title: "정책상 분석 결과를 제공할 수 없습니다.",
    description: "데이터 이용 정책에 따라 분석 결과가 제한되어 있습니다.",
    showCounts: false,
  },
  ERROR: {
    title: "분석 결과를 제공할 수 없습니다.",
    description: "분석 스냅샷에 오류 상태가 기록되어 있습니다.",
    showCounts: false,
  },
};

/**
 * 유효한 분석 대상의 스냅샷을 조회한다.
 * 대상이 변경되면 이전 비동기 결과를 화면에 반영하지 않는다.
 */
function AnalysisResult({ target }: { target: AnalysisTarget }) {
  const repository = useAnalysisRepository();

  const [state, setState] = useState<LoadState>({
    kind: "LOADING",
  });

  useEffect(() => {
    let cancelled = false;

    setState({ kind: "LOADING" });

    repository
      .getSnapshot(target)
      .then((result) => {
        if (cancelled) return;

        if (result.kind === "NOT_FOUND") {
          setState({ kind: "NOT_FOUND" });
          return;
        }

        const snapshot = result.snapshot;

        // 요청한 영상과 다른 영상의 결과를 표시하지 않는다.
        if (
          snapshot.target.source !== target.source ||
          snapshot.target.targetType !== target.targetType ||
          snapshot.target.targetId !== target.targetId
        ) {
          setState({ kind: "ERROR" });
          return;
        }

        setState({
          kind: "FOUND",
          snapshot,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: "ERROR" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    repository,
    target.source,
    target.targetType,
    target.targetId,
  ]);

  if (state.kind === "LOADING") {
    return (
      <section className="analysis-guard">
        <h2>분석 데이터 조회 중</h2>
        <p role="status">선택한 영상의 분석 스냅샷을 확인합니다.</p>
      </section>
    );
  }

  if (state.kind === "NOT_FOUND") {
    return (
      <section className="analysis-guard">
        <h2>분석 데이터가 아직 제공되지 않습니다.</h2>
        <p>선택한 영상 ID: <code>{target.targetId}</code></p>
        <p role="status">
          현재 조회 가능한 분석 스냅샷이 없습니다.
          실제 댓글 수집·분석 작업을 자동 실행하지 않습니다.
        </p>
      </section>
    );
  }

  if (state.kind === "ERROR") {
    return (
      <section className="analysis-guard">
        <h2>분석 결과를 조회할 수 없습니다.</h2>
        <p role="alert">
          조회 중 오류가 발생했거나 요청한 영상과
          결과의 식별자가 일치하지 않습니다.
        </p>
      </section>
    );
  }

  /*
   * Repository가 반환한 스냅샷에서 검증된 표시 모델을 만든다.
   * Projection이 거부한 데이터는 부분적으로도 표시하지 않는다.
   */
  const projection = projectDemoAnalysisSnapshot(
    state.snapshot,
    target,
  );

  if (projection.kind === "REJECTED") {
    return (
      <section className="analysis-guard">
        <h2>분석 결과를 조회할 수 없습니다.</h2>
        <p role="alert">
          검증되지 않은 분석 결과는 표시하지 않습니다.
        </p>
      </section>
    );
  }

  const web = projection.web;
  const presentation = SNAPSHOT_PRESENTATION[web.status];
  const hasAnalysisData =
    web.status === "READY" ||
    web.status === "PARTIAL" ||
    web.status === "STALE";

  /*
   * YU-34: 기존 Projection의 안전한 표시 범위만 시각화한다.
   * READY/PARTIAL + 검증된 분모일 때만 감성 차트와 주제 언급량을 보여준다.
   * STALE/NO_DATA/POLICY_BLOCKED 및 분모 미확정 상태에서는 수치 차트를 만들지 않는다.
   * 주제는 다중 라벨이고, 막대 길이는 가장 많이 언급된 주제 대비 상대 길이다.
   */
  const metrics =
    web.status === "READY" || web.status === "PARTIAL"
      ? web.sentimentPercent
      : null;
  const topics = metrics
    ? [...web.topics].sort(
        (a, b) =>
          b.mentionCount - a.mentionCount ||
          a.topicId.localeCompare(b.topicId),
      )
    : [];
  const maxTopicMentions = topics.reduce(
    (highest, topic) => Math.max(highest, topic.mentionCount),
    0,
  );

  return (
    <section className="analysis-guard analysis-detail" aria-label="영상 분석 결과">
      <div className="analysis-detail__topline">
        <span
          className={"analysis-status analysis-status--" + web.status.toLowerCase().replaceAll("_", "-")}
          data-analysis-status={web.status}
        >
          {web.status}
        </span>
        <span className="analysis-detail__source">STATIC FIXTURE · 합성 DEMO</span>
      </div>

      <h2>{presentation.title}</h2>
      <p>영상 ID: {web.target.targetId}</p>
      <p>분석 상태: {web.status}</p>
      <p role="status">{presentation.description}</p>

      {hasAnalysisData && (
        <nav className="analysis-detail__nav" aria-label="분석 항목 이동">
          {metrics && <a href="#analysis-sentiment">감성 분포</a>}
          {topics.length > 0 && <a href="#analysis-topics">주제별 언급</a>}
          <a href="#analysis-evidence">분석 근거</a>
        </nav>
      )}

      {metrics && (
        <section
          id="analysis-sentiment"
          className="analysis-detail__panel"
          aria-labelledby="analysis-sentiment-heading"
        >
          <div className="analysis-detail__section-title">
            <h3 id="analysis-sentiment-heading">감성 분포</h3>
            <span>합성 데이터 · 분류 완료 표본 기준</span>
          </div>
          <p>
            감성 비율 분모: 분류 완료{" "}
            {metrics.denominator.toLocaleString("ko-KR")}건
          </p>
          <div
            className="analysis-sentiment__bar"
            role="img"
            aria-label={
              "가상 감성 분포: 긍정 " + metrics.positivePercent.toFixed(1) + "%, " +
              "중립 " + metrics.neutralPercent.toFixed(1) + "%, " +
              "부정 " + metrics.negativePercent.toFixed(1) + "%. " +
              "분류 완료 " + metrics.denominator + "건 기준"
            }
          >
            <span className="analysis-sentiment__positive"
              style={{ width: metrics.positivePercent + "%" }} />
            <span className="analysis-sentiment__neutral"
              style={{ width: metrics.neutralPercent + "%" }} />
            <span className="analysis-sentiment__negative"
              style={{ width: metrics.negativePercent + "%" }} />
          </div>
          <div className="analysis-sentiment__legend" aria-label="감성별 분포 수치">
            <p><span className="analysis-sentiment__dot analysis-sentiment__dot--positive" aria-hidden="true" />긍정: {metrics.positivePercent.toFixed(1)}%</p>
            <p><span className="analysis-sentiment__dot analysis-sentiment__dot--neutral" aria-hidden="true" />중립: {metrics.neutralPercent.toFixed(1)}%</p>
            <p><span className="analysis-sentiment__dot analysis-sentiment__dot--negative" aria-hidden="true" />부정: {metrics.negativePercent.toFixed(1)}%</p>
          </div>
          <div className="analysis-sentiment__sample">
            {typeof web.sample?.rawCount === "number" && (
              <p>원시 댓글: {web.sample.rawCount.toLocaleString("ko-KR")}건</p>
            )}
            <p>감성 분류 완료: {metrics.denominator.toLocaleString("ko-KR")}건</p>
            {metrics.classificationCoveragePercent !== null && (
              <p>
                적격 표본 중 감성 분류 비율:{" "}
                {metrics.classificationCoveragePercent.toFixed(1)}%
              </p>
            )}
          </div>
        </section>
      )}

      {topics.length > 0 && (
        <section id="analysis-topics" className="analysis-detail__panel"
          aria-label="주제별 언급">
          <div className="analysis-detail__section-title">
            <h3>주제별 언급</h3>
            <span>언급량 내림차순 · 합성 데이터</span>
          </div>
          <ol className="analysis-topics" aria-label="주제별 언급량">
            {topics.map(topic => (
              <li key={topic.topicId} className="analysis-topics__item">
                <div className="analysis-topics__label">
                  <strong>{topic.topicId}: {topic.mentionCount.toLocaleString("ko-KR")}건</strong>
                </div>
                <div className="analysis-topics__track" role="img"
                  aria-label={topic.topicId + " 언급 " + topic.mentionCount +
                    "건, 최다 언급 주제 대비 상대 길이"}>
                  <span className="analysis-topics__fill"
                    style={{ width: (
                      maxTopicMentions > 0
                        ? topic.mentionCount / maxTopicMentions * 100
                        : 0
                    ) + "%" }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="analysis-detail__footnote">
            막대 길이는 가장 많이 언급된 주제 기준 상대 길이이며 댓글 점유율이 아닙니다.
            주제는 다중 라벨이므로 언급 건수를 합산해 전체 댓글 수로 해석하지 않습니다.
          </p>
        </section>
      )}

      {hasAnalysisData && (
        <section id="analysis-evidence" className="analysis-detail__panel"
          aria-labelledby="analysis-evidence-heading">
          <div className="analysis-detail__section-title">
            <h3 id="analysis-evidence-heading">분석 근거</h3>
            <span>스냅샷 메타데이터</span>
          </div>
          <div className="analysis-evidence__items">
            <p>스냅샷 ID: <code>{web.snapshotId}</code></p>
            <p>
              관측 기간: {web.observationScope.windowStart}
              {" ~ "}{web.observationScope.windowEnd}
            </p>
            <p>분석 시각: {web.analyzedAt ?? "미확정"}</p>
            <p>분석 버전: {web.analysisVersion ?? "미확정"}</p>
          </div>
        </section>
      )}

      {web.status === "STALE" && (
        <p role="note" className="analysis-detail__notice">
          오래된 분석 결과이므로 감성 비율과 표본 수치를
          표시하지 않습니다.
        </p>
      )}

      {(web.status === "READY" || web.status === "PARTIAL") &&
        metrics === null && (
          <p role="note" className="analysis-detail__notice">
            표본 수치의 분모 또는 정합성을 검증할 수 없어
            감성 비율과 표본 수치를 표시하지 않습니다.
          </p>
        )}

      <p className="analysis-detail__disclaimer">
        합성 데모 데이터이며 실제 YouTube 분석 결과가 아닙니다.
      </p>
    </section>
  );
}

/**
 * 단일 YouTube 영상 상세 분석 화면.
 *
 * URL의 영상 ID를 검증하고 Repository를 통해 데이터를 조회한다.
 * 프로젝트 생성 여부와 독립적으로 동작한다.
 */
export function SingleVideoAnalysisPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [searchParams] = useSearchParams();

  const target = videoId
    ? createAnalysisTarget("VIDEO", videoId)
    : null;

  // YU-40: return to a shared A/B comparison ONLY if its exact validated
  // query explicitly includes this current VIDEO. Never reflect arbitrary URL.
  const incoming = parseComparisonQuery(searchParams);
  const returnToComparison = target &&
    incoming.kind === "PAIR" &&
    incoming.videoIds.includes(target.targetId)
      ? buildComparisonSharePath(incoming.videoIds)
      : null;

  return (
    <div className="product-screen">
      <header className="product-heading">
        <h1>영상 상세 분석</h1>
        <p>YOUTOPIA · YouTube 영상 반응 분석</p>
        <nav aria-label="분석 화면 탐색" className="analysis-detail__page-nav">
          <Link className="analysis-detail__compare-link"
            to="/analysis/youtube/compare">
            영상 비교 목록
          </Link>
          {target && (
            <Link className="analysis-detail__compare-link"
              to={returnToComparison ??
                "/analysis/youtube/compare?video=" + target.targetId}>
              {returnToComparison
                ? "선택한 두 영상 비교로 돌아가기"
                : "이 영상을 비교 목록에 추가"}
            </Link>
          )}
        </nav>
      </header>

      {!target ? (
        <section className="analysis-guard">
          <h2>유효하지 않은 영상 ID입니다.</h2>
          <p role="alert">
            YouTube 영상 식별자 형식을 확인할 수 없습니다.
          </p>
        </section>
      ) : (
        <AnalysisResult key={target.targetId} target={target} />
      )}
    </div>
  );
}
