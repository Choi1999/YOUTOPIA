
import {
  createAnalysisTarget,
  type AnalysisTarget,
} from "../../analysis-target/analysisTarget";

import {
  projectDemoAnalysisSnapshot,
  type AnalysisProjectionResult,
  type HoverSummaryProjection,
} from "../model/analysisProjection";

/**
 * 아직 신뢰하지 않는 스냅샷 공급자.
 * 기존 AnalysisRepository도 이 인터페이스를 만족한다.
 */
type RawSnapshotSource = Readonly<{
  getSnapshot(target: AnalysisTarget): Promise<unknown>;
}>;

type ProjectionRejectionReason =
  Extract<
    AnalysisProjectionResult,
    { kind: "REJECTED" }
  >["reason"];

export type HoverSummaryLookupResult =
  | Readonly<{
      kind: "SNAPSHOT";
      summary: HoverSummaryProjection;
    }>
  | Readonly<{
      kind: "NOT_FOUND";
    }>
  | Readonly<{
      kind: "REJECTED";
      reason:
        | ProjectionRejectionReason
        | "INVALID_RESPONSE"
        | "SOURCE_ERROR";
    }>;

export type DemoHoverSummaryProvider = Readonly<{
  getSummary(input: unknown): Promise<HoverSummaryLookupResult>;
}>;

/**
 * 외부 입력 대상의 구조와 canonical ID를 검증한다.
 * 유효하지 않은 @handle이나 추가 필드를 허용하지 않는다.
 */
function parseTarget(input: unknown): AnalysisTarget | null {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    return null;
  }

  const record = input as Record<string, unknown>;
  const required = ["source", "targetType", "targetId"];

  if (
    Object.keys(record).length !== required.length ||
    !required.every((key) =>
      Object.prototype.hasOwnProperty.call(record, key)
    ) ||
    record.source !== "YOUTUBE" ||
    (
      record.targetType !== "VIDEO" &&
      record.targetType !== "CHANNEL"
    ) ||
    typeof record.targetId !== "string"
  ) {
    return null;
  }

  return createAnalysisTarget(
    record.targetType,
    record.targetId
  );
}

/**
 * Projection의 중첩 데이터를 복제·동결한다.
 * 공급자 입력이나 다른 요청의 변경이 결과를 오염시키지 않는다.
 */
function freezeSummary(
  summary: HoverSummaryProjection,
): HoverSummaryProjection {
  return Object.freeze({
    ...summary,

    target: Object.freeze({ ...summary.target }),

    provenance: Object.freeze({
      ...summary.provenance,
    }),

    observationScope: Object.freeze({
      ...summary.observationScope,
    }),

    sentimentPercent: summary.sentimentPercent
      ? Object.freeze({ ...summary.sentimentPercent })
      : null,

    topTopics: Object.freeze(
      summary.topTopics.map((topic) =>
        Object.freeze({ ...topic })
      )
    ),
  });
}

/**
 * 데모 스냅샷을 Hover 요약으로 공급한다.
 *
 * - 실제 API 호출을 새로 만들지 않는다.
 * - 기존 Repository를 주입받는다.
 * - 응답 구조와 출처를 다시 검증한다.
 * - 합성·공개 데이터만 허용한다.
 * - ILLUSTRATIVE_ONLY Preview를 분석 결과로 승격하지 않는다.
 *
 * Chrome 확장 프로그램과의 통신은 담당하지 않는다.
 */
export function createDemoHoverSummaryProvider(
  source: RawSnapshotSource,
): DemoHoverSummaryProvider {
  return {
    async getSummary(input) {
      let target: AnalysisTarget | null;

      try {
        target = parseTarget(input);
      } catch {
        return {
          kind: "REJECTED",
          reason: "INVALID_TARGET",
        };
      }

      if (!target) {
        return {
          kind: "REJECTED",
          reason: "INVALID_TARGET",
        };
      }

      let response: unknown;

      try {
        response = await source.getSnapshot(target);
      } catch {
        return {
          kind: "REJECTED",
          reason: "SOURCE_ERROR",
        };
      }

      try {
        if (
          !response ||
          typeof response !== "object" ||
          Array.isArray(response)
        ) {
          return {
            kind: "REJECTED",
            reason: "INVALID_RESPONSE",
          };
        }

        const record = response as Record<string, unknown>;
        const keys = Object.keys(record);

        /*
         * NOT_FOUND는 정확히 kind 필드만 가져야 한다.
         * NO_DATA 스냅샷과 혼동하지 않는다.
         */
        if (record.kind === "NOT_FOUND") {
          return keys.length === 1
            ? { kind: "NOT_FOUND" }
            : {
                kind: "REJECTED",
                reason: "INVALID_RESPONSE",
              };
        }

        /*
         * FOUND는 kind와 snapshot만 허용한다.
         * 공급자의 임의 메타데이터는 그대로 전달하지 않는다.
         */
        if (
          record.kind !== "FOUND" ||
          keys.length !== 2 ||
          !Object.prototype.hasOwnProperty.call(
            record,
            "snapshot"
          )
        ) {
          return {
            kind: "REJECTED",
            reason: "INVALID_RESPONSE",
          };
        }

        const projected = projectDemoAnalysisSnapshot(
          record.snapshot,
          target
        );

        if (projected.kind === "REJECTED") {
          return {
            kind: "REJECTED",
            reason: projected.reason,
          };
        }

        return {
          kind: "SNAPSHOT",
          summary: freezeSummary(projected.hover),
        };
      } catch {
        // 예외를 던지는 비정상 객체도 출력 단계로 전달하지 않는다.
        return {
          kind: "REJECTED",
          reason: "INVALID_RESPONSE",
        };
      }
    },
  };
}
