
import type { AnalysisRepository } from "./AnalysisRepository";
import { demoReadySnapshot } from "./demoReadySnapshot";
import { demoComparisonSnapshot } from "./demoComparisonSnapshot";
import { demoChannelBVideoOne, demoChannelBVideoTwo } from "./demoChannelBSnapshots";

/**
 * 합성 스냅샷을 제공하는 테스트 전용 Repository.
 *
 * 등록된 테스트 대상만 FOUND를 반환한다.
 * 그 외 모든 대상에는 임의의 분석 데이터를 생성하지 않는다.
 */
export const demoAnalysisRepository: AnalysisRepository = {
  async getSnapshot(target) {
    // 정확히 등록한 두 합성 대상 외에는 데이터를 만들지 않는다.
    const fixture = [demoReadySnapshot, demoComparisonSnapshot, demoChannelBVideoOne, demoChannelBVideoTwo].find(
      ({ target: fixtureTarget }) =>
        target.source === fixtureTarget.source &&
        target.targetType === fixtureTarget.targetType &&
        target.targetId === fixtureTarget.targetId,
    );

    if (!fixture) {
      return { kind: "NOT_FOUND" };
    }

    return { kind: "FOUND", snapshot: fixture };
  },
};
