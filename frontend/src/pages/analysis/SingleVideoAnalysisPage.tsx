
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
  createAnalysisTarget,
  type AnalysisTarget,
} from "../../features/analysis-target/analysisTarget";

import { useAnalysisRepository } from "../../features/analysis/data/AnalysisRepositoryContext";
import { deriveSentimentMetrics } from "../../features/analysis/model/sentimentMetrics";
import type { AnalysisSnapshot } from "../../features/analysis/model/analysisSnapshot";


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

  const snapshot = state.snapshot;
  const presentation = SNAPSHOT_PRESENTATION[snapshot.status];
  const metrics = presentation.showCounts
  ? deriveSentimentMetrics(snapshot)
  : null;

  return (
    <section className="analysis-guard">
      <h2>{presentation.title}</h2>

      <p>영상 ID: {target.targetId}</p>
      <p>분석 상태: {snapshot.status}</p>

      <p role="status">{presentation.description}</p>

      {presentation.showCounts && (
        metrics?.kind === "AVAILABLE" ? (
          <>
            {typeof snapshot.sample?.rawCount === "number" && (
              <p>
                원시 댓글: {snapshot.sample.rawCount.toLocaleString("ko-KR")}건
              </p>
            )}

            <p>
              감성 분류 완료: {metrics.denominator.toLocaleString("ko-KR")}건
            </p>

            <p>
              감성 비율 분모: 분류 완료 {metrics.denominator.toLocaleString("ko-KR")}건
            </p>

            <p>긍정: {metrics.positivePercent.toFixed(1)}%</p>
            <p>중립: {metrics.neutralPercent.toFixed(1)}%</p>
            <p>부정: {metrics.negativePercent.toFixed(1)}%</p>

            {metrics.classificationCoveragePercent !== null && (
              <p>
                적격 표본 중 감성 분류 비율:{" "}
                {metrics.classificationCoveragePercent.toFixed(1)}%
              </p>
            )}

            <p>
              분석 시각: {snapshot.analyzedAt ?? "미확정"}
            </p>
          </>
        ) : (
          <p role="note">
            표본 수치의 분모 또는 정합성을 검증할 수 없어
            감성 비율과 표본 수치를 표시하지 않습니다.
          </p>
        )
      )}

      <p>
        {snapshot.isSynthetic
          ? "합성 데모 데이터이며 실제 YouTube 분석 결과가 아닙니다."
          : "분석 데이터의 출처와 사용 범위를 확인해야 합니다."}
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

  const target = videoId
    ? createAnalysisTarget("VIDEO", videoId)
    : null;

  return (
    <div className="product-screen">
      <header className="product-heading">
        <h1>영상 상세 분석</h1>
        <p>YOUTOPIA · YouTube 영상 반응 분석</p>
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
