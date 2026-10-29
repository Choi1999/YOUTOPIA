
import {
  createAnalysisTarget,
  type AnalysisTarget,
} from "../../analysis-target/analysisTarget";

import type {
  AnalysisSnapshot,
  AnalysisStatus,
} from "./analysisSnapshot";

import { deriveSentimentMetrics } from "./sentimentMetrics";
import { validateAnalysisSnapshot } from "./validateAnalysisSnapshot";

export type ProjectedSentiment = Readonly<{
  denominator: number;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
  classificationCoveragePercent: number | null;
}>;

type ProjectionBase = Readonly<{
  snapshotId: string;
  target: AnalysisTarget;
  status: AnalysisStatus;

  provenance: Readonly<{
    sourceType: "STATIC_FIXTURE";
    isSynthetic: true;
    visibility: "PUBLIC_REUSABLE";
    tenantId: null;
  }>;

  observationScope: AnalysisSnapshot["scope"];
  observedAt: string | null;
  analyzedAt: string | null;
}>;

/**
 * Hover 카드용 짧은 분석 요약.
 *
 * 기존 ILLUSTRATIVE_ONLY Preview와 구분한다.
 * 실제 데이터가 아닌 검증된 합성 스냅샷에서 파생한다.
 */
export type HoverSummaryProjection = ProjectionBase & Readonly<{
  valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC";

  sentimentPercent: ProjectedSentiment | null;

  topTopics: ReadonlyArray<Readonly<{
    topicId: string;
    mentionCount: number;
  }>>;
}>;

/**
 * Web 상세 화면에서 사용할 데이터 모델.
 * 비율뿐 아니라 계산에 사용한 표본과 처리 버전을 보존한다.
 */
export type WebDetailProjection = ProjectionBase & Readonly<{
  valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC";

  sample: AnalysisSnapshot["sample"];
  sentimentCounts: AnalysisSnapshot["sentiment"];
  sentimentPercent: ProjectedSentiment | null;

  topics: AnalysisSnapshot["topics"];

  analysisVersion: string | null;
  topicTaxonomyVersion: string | null;
}>;

export type AnalysisProjectionResult =
  | Readonly<{
      kind: "PROJECTED";
      hover: HoverSummaryProjection;
      web: WebDetailProjection;
    }>
  | Readonly<{
      kind: "REJECTED";
      reason:
        | "INVALID_SNAPSHOT"
        | "INVALID_TARGET"
        | "TARGET_MISMATCH"
        | "DEMO_SCOPE_ONLY"
        | "METRICS_UNAVAILABLE";
    }>;

/**
 * 검증되지 않은 입력에서 두 화면의 표시 데이터를 만든다.
 *
 * 현재는 합성·공개 스냅샷만 허용한다.
 * 서버 인증, 실제 제공자 및 비공개 테넌트 데이터는 지원하지 않는다.
 *
 * 이 함수는 입력 객체를 수정하지 않으며 API 호출도 하지 않는다.
 */
export function projectDemoAnalysisSnapshot(
  input: unknown,
  expectedTarget: AnalysisTarget,
): AnalysisProjectionResult {
  // 1. 요청 대상 자체의 형식을 확인한다.
  const canonicalTarget = createAnalysisTarget(
    expectedTarget.targetType,
    expectedTarget.targetId,
  );

  if (
    !canonicalTarget ||
    expectedTarget.source !== "YOUTUBE"
  ) {
    return {
      kind: "REJECTED",
      reason: "INVALID_TARGET",
    };
  }

  // 2. 스냅샷 전체 구조와 의미 규칙을 검증한다.
  const validation = validateAnalysisSnapshot(input);

  if (validation.kind !== "VALID") {
    return {
      kind: "REJECTED",
      reason: "INVALID_SNAPSHOT",
    };
  }

  const snapshot = validation.snapshot;

  // 3. 요청한 영상·채널과 응답 대상이 정확히 일치해야 한다.
  if (
    snapshot.target.source !== canonicalTarget.source ||
    snapshot.target.targetType !== canonicalTarget.targetType ||
    snapshot.target.targetId !== canonicalTarget.targetId
  ) {
    return {
      kind: "REJECTED",
      reason: "TARGET_MISMATCH",
    };
  }

  // 4. 현재는 합성·공개 데이터만 Projection 대상으로 허용한다.
  if (
    snapshot.sourceType !== "STATIC_FIXTURE" ||
    snapshot.isSynthetic !== true ||
    snapshot.visibility !== "PUBLIC_REUSABLE" ||
    snapshot.tenantId !== null
  ) {
    return {
      kind: "REJECTED",
      reason: "DEMO_SCOPE_ONLY",
    };
  }

  // 5. READY와 PARTIAL에서만 감성 비율을 생성한다.
  // STALE은 이전 결과이므로 Hover에서 비율을 표시하지 않는다.
  const canProjectMetrics =
    snapshot.status === "READY" ||
    snapshot.status === "PARTIAL";

  const derived = canProjectMetrics
    ? deriveSentimentMetrics(snapshot)
    : null;

  const sentimentPercent: ProjectedSentiment | null =
    derived?.kind === "AVAILABLE"
      ? {
          denominator: derived.denominator,
          positivePercent: derived.positivePercent,
          neutralPercent: derived.neutralPercent,
          negativePercent: derived.negativePercent,
          classificationCoveragePercent:
            derived.classificationCoveragePercent,
        }
      : null;

  // READY에서 분모가 검증되지 않았다면 전체 Projection을 거부한다.
  if (
    snapshot.status === "READY" &&
    sentimentPercent === null
  ) {
    return {
      kind: "REJECTED",
      reason: "METRICS_UNAVAILABLE",
    };
  }

  // 6. 두 화면이 공유할 식별·출처·관측 메타데이터.
  const common: ProjectionBase = {
    snapshotId: snapshot.snapshotId,
    target: { ...snapshot.target },
    status: snapshot.status,

    provenance: {
      sourceType: "STATIC_FIXTURE",
      isSynthetic: true,
      visibility: "PUBLIC_REUSABLE",
      tenantId: null,
    },

    observationScope: { ...snapshot.scope },
    observedAt: snapshot.observedAt,
    analyzedAt: snapshot.analyzedAt,
  };

  // 7. Hover에서는 검증된 주제의 상위 2개만 사용한다.
  // 다중 라벨 주제이므로 비율을 합산하거나 새로 계산하지 않는다.
  const topTopics =
    sentimentPercent === null
      ? []
      : [...snapshot.topics]
          .sort(
            (a, b) =>
              b.mentionCount - a.mentionCount ||
              a.topicId.localeCompare(b.topicId),
          )
          .slice(0, 2)
          .map((topic) => ({
            topicId: topic.topicId,
            mentionCount: topic.mentionCount,
          }));

  // 8. 동일한 검증 결과에서 두 화면의 데이터를 생성한다.
  return {
    kind: "PROJECTED",

    hover: {
      ...common,
      valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC",
      sentimentPercent,
      topTopics,
    },

    web: {
      ...common,
      valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC",

      sample: snapshot.sample
        ? { ...snapshot.sample }
        : null,

      sentimentCounts: snapshot.sentiment
        ? { ...snapshot.sentiment }
        : null,

      sentimentPercent: sentimentPercent
        ? { ...sentimentPercent }
        : null,

      topics: snapshot.topics.map((topic) => ({
        ...topic,
      })),

      analysisVersion: snapshot.analysisVersion,
      topicTaxonomyVersion: snapshot.topicTaxonomyVersion,
    },
  };
}
