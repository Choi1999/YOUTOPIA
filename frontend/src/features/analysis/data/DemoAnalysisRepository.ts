
import type { AnalysisRepository } from "./AnalysisRepository";
import { demoReadySnapshot } from "./demoReadySnapshot";

/**
 * 합성 스냅샷을 제공하는 테스트 전용 Repository.
 *
 * 등록된 테스트 대상만 FOUND를 반환한다.
 * 그 외 모든 대상에는 임의의 분석 데이터를 생성하지 않는다.
 */
export const demoAnalysisRepository: AnalysisRepository = {
  async getSnapshot(target) {
    const fixtureTarget = demoReadySnapshot.target;

    const matches =
      target.source === fixtureTarget.source &&
      target.targetType === fixtureTarget.targetType &&
      target.targetId === fixtureTarget.targetId;

    if (!matches) {
      return { kind: "NOT_FOUND" };
    }

    return {
      kind: "FOUND",
      snapshot: demoReadySnapshot,
    };
  },
};
