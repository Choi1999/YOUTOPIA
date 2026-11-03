import type { AnalysisSnapshot } from "../model/analysisSnapshot";
import { demoReadySnapshot } from "./demoReadySnapshot";

/**
 * YU-35: 두 번째 명시적 합성 영상 fixture.
 * 미등록 영상에 임의 반응을 생성하지 않는다.
 * 기본 fixture와 관측 범위/분류 표본/버전을 의도적으로 일치시켜
 * 비교 화면이 정직하게 동작하는지 테스트한다.
 */
export const demoComparisonSnapshot: AnalysisSnapshot = {
  ...demoReadySnapshot,
  snapshotId: "synthetic-one-video-002",
  target: {
    source: "YOUTUBE",
    targetType: "VIDEO",
    targetId: "Qb0_-123xyz",
  },
  sentiment: { positive: 32, neutral: 28, negative: 20 },
  topics: [
    {
      topicId: "RECIPE",
      mentionCount: 25,
      classifiedTopicCount: 22,
      negativeTopicCount: 6,
    },
    {
      topicId: "PRICE",
      mentionCount: 35,
      classifiedTopicCount: 28,
      negativeTopicCount: 9,
    },
    {
      topicId: "DELIVERY",
      mentionCount: 12,
      classifiedTopicCount: 10,
      negativeTopicCount: 2,
    },
  ],
};
