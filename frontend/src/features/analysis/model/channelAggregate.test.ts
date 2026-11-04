import { describe, expect, it } from "vitest";
import { createAnalysisTarget } from "../../analysis-target/analysisTarget";
import {
  demoChannelSelection,
  getDemoChannelSelection,
  belongsToDemoChannelSelection,
} from "../data/demoChannelSelection";
import { demoReadySnapshot } from "../data/demoReadySnapshot";
import { demoComparisonSnapshot } from "../data/demoComparisonSnapshot";
import type { AnalysisSnapshot } from "./analysisSnapshot";
import { projectDemoAnalysisSnapshot, type WebDetailProjection } from "./analysisProjection";
import { aggregateSyntheticChannelSelection } from "./channelAggregate";

const make = (snapshot: AnalysisSnapshot): WebDetailProjection => {
  const target = createAnalysisTarget("VIDEO", snapshot.target.targetId);
  if (!target) throw new Error("INVALID_TEST_ID");
  const projection = projectDemoAnalysisSnapshot(snapshot, target);
  if (projection.kind !== "PROJECTED") throw new Error("INVALID_TEST_FIXTURE");
  return projection.web;
};
const a = make(demoReadySnapshot);
const b = make(demoComparisonSnapshot);

describe("YU-45 — registered synthetic channel aggregation", () => {
  it("sums two verified video samples and preserves provenance", () => {
    const result = aggregateSyntheticChannelSelection(demoChannelSelection, [a, b]);
    expect(result.kind).toBe("READY");
    if (result.kind !== "READY") return;
    expect(result.sourceType).toBe("STATIC_FIXTURE");
    expect(result.isSynthetic).toBe(true);
    expect(result.selectedVideoIds).toEqual(["Ab0_-123xyz", "Qb0_-123xyz"]);
    expect(result.sample).toEqual({
      raw: 240, eligible: 200, excluded: 40,
      classified: 160, unclassified: 40,
    });
    expect(result.observationWindow).toEqual({
      start: "2026-10-01T00:00:00+09:00",
      end: "2026-10-08T00:00:00+09:00",
      locale: "ko-KR",
    });
  });

  it("recomputes percentages with SUM(classified), not mean video percentages", () => {
    const result = aggregateSyntheticChannelSelection(demoChannelSelection, [a, b]);
    if (result.kind !== "READY") throw new Error("NOT_READY");
    expect(result.sentiment.positive).toBe(82);
    expect(result.sentiment.neutral).toBe(48);
    expect(result.sentiment.negative).toBe(30);
    expect(result.sentiment.positivePercent).toBeCloseTo(51.25);
    expect(result.sentiment.neutralPercent).toBeCloseTo(30);
    expect(result.sentiment.negativePercent).toBeCloseTo(18.75);
  });

  it("sums multi-label topic counts and retains per-video contribution", () => {
    const result = aggregateSyntheticChannelSelection(demoChannelSelection, [a, b]);
    if (result.kind !== "READY") throw new Error("NOT_READY");
    expect(result.topics).toEqual([
      { topicId: "RECIPE", mentionCount: 63, perVideo: [
        { videoId: "Ab0_-123xyz", mentionCount: 38 },
        { videoId: "Qb0_-123xyz", mentionCount: 25 },
      ] },
      { topicId: "PRICE", mentionCount: 57, perVideo: [
        { videoId: "Ab0_-123xyz", mentionCount: 22 },
        { videoId: "Qb0_-123xyz", mentionCount: 35 },
      ] },
      { topicId: "DELIVERY", mentionCount: 12, perVideo: [
        { videoId: "Ab0_-123xyz", mentionCount: 0 },
        { videoId: "Qb0_-123xyz", mentionCount: 12 },
      ] },
    ]);
    expect(result.videos.map(v => v.classifiedSharePercent)).toEqual([50, 50]);
  });

  it("does not assign arbitrary channel IDs or unregistered video IDs to channel", () => {
    expect(getDemoChannelSelection("UC" + "Z".repeat(22))).toBeNull();
    expect(belongsToDemoChannelSelection(demoChannelSelection.channelId, "Zb0_-123xyz"))
      .toBe(false);
    expect(belongsToDemoChannelSelection(demoChannelSelection.channelId, "Ab0_-123xyz"))
      .toBe(true);
    expect(aggregateSyntheticChannelSelection({
      ...demoChannelSelection,
      channelId: "UC" + "Z".repeat(22),
    }, [a, b])).toEqual({
      kind: "BLOCKED", reason: "UNREGISTERED_CHANNEL",
    });
  });

  it("rejects duplicate, missing and reordered selected-video sets", () => {
    for (const rows of [[a], [a, a], [b, a], []]) {
      expect(aggregateSyntheticChannelSelection(demoChannelSelection, rows))
        .toEqual({ kind: "BLOCKED", reason: "SELECTED_SET_MISMATCH" });
    }
  });

  it("blocks PARTIAL, STALE and null denominator rather than inventing aggregates", () => {
    const partial = make({ ...demoComparisonSnapshot, status: "PARTIAL" });
    const stale = make({ ...demoComparisonSnapshot, status: "STALE" });
    const noCounts = { ...b, sentimentPercent: null };
    for (const p of [partial, stale, noCounts]) {
      expect(aggregateSyntheticChannelSelection(demoChannelSelection, [a, p]))
        .toEqual({ kind: "BLOCKED", reason: "INCOMPLETE_OR_UNVERIFIED" });
    }
  });

  it("blocks unmatched observation windows, analyzed dates and taxonomies", () => {
    for (const b2 of [
      { ...b, observationScope: { ...b.observationScope, windowEnd: "2026-10-09T00:00:00+09:00" } },
      { ...b, analyzedAt: "2026-10-08T10:20:00+09:00" },
      { ...b, topicTaxonomyVersion: "mock-1" },
    ]) {
      expect(aggregateSyntheticChannelSelection(demoChannelSelection, [a, b2]))
        .toEqual({
          kind: "BLOCKED", reason: "OBSERVATION_OR_VERSION_MISMATCH",
        });
    }
  });

  it("rejects arithmetic mismatch or forged rates before channel sum", () => {
    const malformed = {
      ...b,
      sample: { ...b.sample!, rawCount: 121 },
    };
    const forgedRate = {
      ...b,
      sentimentPercent: { ...b.sentimentPercent!, positivePercent: 100 },
    };
    for (const item of [malformed, forgedRate]) {
      expect(aggregateSyntheticChannelSelection(demoChannelSelection, [a, item]))
        .toEqual({ kind: "BLOCKED", reason: "INVALID_COUNTS" });
    }
  });

  it("provider provenance or selected manifest tampering fails closed", () => {
    const tampered = {
      ...b,
      provenance: { ...b.provenance, isSynthetic: false },
    } as unknown as WebDetailProjection;
    expect(aggregateSyntheticChannelSelection(demoChannelSelection, [a, tampered]))
      .toEqual({ kind: "BLOCKED", reason: "OBSERVATION_OR_VERSION_MISMATCH" });
    expect(aggregateSyntheticChannelSelection({
      ...demoChannelSelection, videoIds: ["Ab0_-123xyz", "Zb0_-123xyz"] as unknown as typeof demoChannelSelection.videoIds,
    }, [a, b])).toEqual({
      kind: "BLOCKED", reason: "UNREGISTERED_CHANNEL",
    });
  });
});
