import type { AnalysisSnapshot } from "../model/analysisSnapshot";
import { demoReadySnapshot } from "./demoReadySnapshot";

/**
 * YU-47: separate explicit synthetic VIDEO fixtures for the second example
 * channel. These IDs/associations do NOT assert real YouTube membership.
 */
export const demoChannelBVideoOne: AnalysisSnapshot = {
  ...demoReadySnapshot,
  snapshotId: "synthetic-channel-b-video-001",
  target: { source: "YOUTUBE", targetType: "VIDEO", targetId: "Cb0_-123xyz" },
  sample: { rawCount: 110, eligibleCount: 90, excludedCount: 20,
    classifiedCount: 70, unclassifiedCount: 20 },
  sentiment: { positive: 28, neutral: 27, negative: 15 },
  topics: [
    { topicId: "RECIPE", mentionCount: 20, classifiedTopicCount: 15, negativeTopicCount: 4 },
    { topicId: "PRICE", mentionCount: 30, classifiedTopicCount: 23, negativeTopicCount: 8 },
    { topicId: "QUALITY", mentionCount: 18, classifiedTopicCount: 15, negativeTopicCount: 5 },
  ],
};

export const demoChannelBVideoTwo: AnalysisSnapshot = {
  ...demoReadySnapshot,
  snapshotId: "synthetic-channel-b-video-002",
  target: { source: "YOUTUBE", targetType: "VIDEO", targetId: "Db0_-123xyz" },
  sample: { rawCount: 105, eligibleCount: 90, excludedCount: 15,
    classifiedCount: 70, unclassifiedCount: 20 },
  sentiment: { positive: 20, neutral: 30, negative: 20 },
  topics: [
    { topicId: "RECIPE", mentionCount: 12, classifiedTopicCount: 10, negativeTopicCount: 3 },
    { topicId: "PRICE", mentionCount: 20, classifiedTopicCount: 16, negativeTopicCount: 4 },
    { topicId: "QUALITY", mentionCount: 25, classifiedTopicCount: 20, negativeTopicCount: 8 },
  ],
};
