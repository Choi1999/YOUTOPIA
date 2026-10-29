
import type { AnalysisSnapshot } from "../model/analysisSnapshot";

/**
 * analysis-v1의 READY 합성 fixture를 바탕으로 한 테스트 데이터.
 *
 * 실제 YouTube 영상이나 댓글 분석 결과가 아니다.
 * 지정된 테스트 대상에만 연결한다.
 */
export const demoReadySnapshot: AnalysisSnapshot = {
  contractVersion: "analysis-v1-candidate",
  snapshotId: "synthetic-one-video-001",

  target: {
    source: "YOUTUBE",
    targetType: "VIDEO",
    targetId: "Ab0_-123xyz",
  },

  scope: {
    mode: "ONE_VIDEO",
    windowStart: "2026-10-01T00:00:00+09:00",
    windowEnd: "2026-10-08T00:00:00+09:00",
    locale: "ko-KR",
  },

  status: "READY",
  sourceType: "STATIC_FIXTURE",
  isSynthetic: true,

  visibility: "PUBLIC_REUSABLE",
  tenantId: null,

  observedAt: "2026-10-08T09:10:00+09:00",
  analyzedAt: "2026-10-08T09:20:00+09:00",

  sample: {
    rawCount: 120,
    eligibleCount: 100,
    excludedCount: 20,
    classifiedCount: 80,
    unclassifiedCount: 20,
  },

  sentiment: {
    positive: 50,
    neutral: 20,
    negative: 10,
  },

  topics: [
    {
      topicId: "RECIPE",
      mentionCount: 38,
      classifiedTopicCount: 30,
      negativeTopicCount: 3,
    },
    {
      topicId: "PRICE",
      mentionCount: 22,
      classifiedTopicCount: 20,
      negativeTopicCount: 7,
    },
  ],

  analysisVersion: "mock-0",
  topicTaxonomyVersion: "mock-0",
};
