
import type { AnalysisTarget } from "../../analysis-target/analysisTarget";
import { validateAnalysisSnapshot } from "../model/validateAnalysisSnapshot";
import type { AnalysisRepository } from "./AnalysisRepository";

/**
 * 입력값을 아직 신뢰하지 않는 데이터 공급자.
 * 현재 DemoRepository도 이 인터페이스로 전달할 수 있다.
 */
type RawAnalysisSource = Readonly<{
  getSnapshot(target: AnalysisTarget): Promise<unknown>;
}>;

/**
 * 현재 데모 단계에서만 사용하는 검증 어댑터.
 *
 * 유효한 합성·공개 스냅샷만 허용한다.
 * 실제 제공자 및 비공개 데이터는 서버 검증 경계가
 * 마련되기 전까지 화면에 전달하지 않는다.
 */
export function createValidatedDemoAnalysisRepository(
  source: RawAnalysisSource,
): AnalysisRepository {
  return {
    async getSnapshot(target) {
      const result: unknown = await source.getSnapshot(target);

      if (
        typeof result !== "object" ||
        result === null ||
        Array.isArray(result)
      ) {
        throw new Error("INVALID_ANALYSIS_RESPONSE");
      }

      const record = result as Record<string, unknown>;
      const keys = Object.keys(record);

      if (
        record.kind === "NOT_FOUND" &&
        keys.length === 1
      ) {
        return { kind: "NOT_FOUND" };
      }

      if (
        record.kind !== "FOUND" ||
        keys.length !== 2 ||
        !Object.prototype.hasOwnProperty.call(record, "snapshot")
      ) {
        throw new Error("INVALID_ANALYSIS_RESPONSE");
      }

      const validation = validateAnalysisSnapshot(record.snapshot);

      if (validation.kind !== "VALID") {
        throw new Error("INVALID_ANALYSIS_SNAPSHOT");
      }

      const snapshot = validation.snapshot;

      if (
        snapshot.target.source !== target.source ||
        snapshot.target.targetType !== target.targetType ||
        snapshot.target.targetId !== target.targetId
      ) {
        throw new Error("ANALYSIS_TARGET_MISMATCH");
      }

      if (
        snapshot.sourceType !== "STATIC_FIXTURE" ||
        !snapshot.isSynthetic ||
        snapshot.visibility !== "PUBLIC_REUSABLE" ||
        snapshot.tenantId !== null
      ) {
        throw new Error("UNVERIFIED_ANALYSIS_ACCESS");
      }

      return {
        kind: "FOUND",
        snapshot,
      };
    },
  };
}
