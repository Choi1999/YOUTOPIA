import { describe, expect, it } from "vitest";
import { createAnalysisTarget } from "../../analysis-target/analysisTarget";
import { demoReadySnapshot } from "../data/demoReadySnapshot";
import { demoComparisonSnapshot } from "../data/demoComparisonSnapshot";
import { projectDemoAnalysisSnapshot, type WebDetailProjection } from "./analysisProjection";
import { compareVideoProjections, type VideoComparisonResult } from "./videoComparison";
import {
  serializeSyntheticComparisonCsv,
  SYNTHETIC_COMPARISON_CSV_FILENAME,
} from "./comparisonCsv";

function project(snapshot: typeof demoReadySnapshot): WebDetailProjection {
  const target = createAnalysisTarget("VIDEO", snapshot.target.targetId);
  if (!target) throw new Error("TEST_ID");
  const result = projectDemoAnalysisSnapshot(snapshot, target);
  if (result.kind !== "PROJECTED") throw new Error("TEST_FIXTURE");
  return result.web;
}
const a = project(demoReadySnapshot);
const b = project(demoComparisonSnapshot);
const ready = compareVideoProjections(a, b);

describe("YU-43 — synthetic two-video comparison CSV contract", () => {
  it("exports fixed CSV columns, explicit synthetic notice and two video IDs", () => {
    const csv = serializeSyntheticComparisonCsv(ready);
    expect(csv).not.toBeNull();
    expect(csv?.split("\r\n")[0]).toBe(
      '"record_type","metric","video_a","video_b","delta_b_minus_a","unit","source"');
    expect(csv).toContain("SYNTHETIC_DEMO_NOT_REAL_YOUTUBE_ANALYSIS");
    expect(csv).toContain('"video_id","Ab0_-123xyz","Qb0_-123xyz"');
    expect(csv).toContain('"classified_denominator","80","80"');
    expect(SYNTHETIC_COMPARISON_CSV_FILENAME).toContain("synthetic");
    expect(csv).not.toContain("comment_text");
    expect(csv).not.toContain("api_key");
  });

  it("exports B minus A percent-point differences, not percent growth", () => {
    const csv = serializeSyntheticComparisonCsv(ready);
    expect(csv).toContain(
      '"sentiment","positive_percent","62.5","40.0","-22.5","percentage_points"');
    expect(csv).toContain(
      '"sentiment","neutral_percent","25.0","35.0","10.0","percentage_points"');
    expect(csv).toContain(
      '"sentiment","negative_percent","12.5","25.0","12.5","percentage_points"');
  });

  it("exports topic counts by ID, including only-in-B zero for A", () => {
    const csv = serializeSyntheticComparisonCsv(ready);
    expect(csv).toContain('"topic_mentions","RECIPE","38","25","-13","mentions"');
    expect(csv).toContain('"topic_mentions","PRICE","22","35","13","mentions"');
    expect(csv).toContain('"topic_mentions","DELIVERY","0","12","12","mentions"');
  });

  it("reversing A/B reverses signed differences while retaining exact source", () => {
    const csv = serializeSyntheticComparisonCsv(compareVideoProjections(b, a));
    expect(csv).toContain('"video_id","Qb0_-123xyz","Ab0_-123xyz"');
    expect(csv).toContain('"positive_percent","40.0","62.5","22.5"');
    expect(csv).toContain("STATIC_FIXTURE_SYNTHETIC_DEMO");
  });

  it("rejects blocked stale/partial/mismatched comparison without CSV", () => {
    const partial = { ...b, status: "PARTIAL" as const };
    const stale = { ...b, status: "STALE" as const };
    const mismatch = { ...b, observationScope: {
      ...b.observationScope, locale: "en-US",
    } };
    for (const input of [partial, stale, mismatch]) {
      expect(serializeSyntheticComparisonCsv(compareVideoProjections(a, input)))
        .toBeNull();
    }
    expect(serializeSyntheticComparisonCsv({
      kind: "BLOCKED", reason: "INSUFFICIENT_DATA",
    })).toBeNull();
  });

  it("revalidates forged READY source claims rather than exporting them", () => {
    if (ready.kind !== "READY") throw new Error("TEST_READY");
    const forged: VideoComparisonResult = {
      ...ready,
      right: {...ready.right, provenance: {
        ...ready.right.provenance, sourceType: "APPROVED_PROVIDER",
      } as unknown as WebDetailProjection["provenance"] },
    };
    expect(serializeSyntheticComparisonCsv(forged)).toBeNull();
  });

  it("escapes CSV formula prefix and multiline snapshot metadata", () => {
    const dangerous = { ...a, snapshotId: '=HYPERLINK("x","y")\n=CMD' };
    const csv = serializeSyntheticComparisonCsv(compareVideoProjections(dangerous, b));
    expect(csv).toContain('"\u0027=HYPERLINK(""x"",""y"")\n=CMD"');
    // A quoted multiline value must remain a single logical cell.
    expect(csv).toContain('"snapshot_id"');
  });

  it("does not export live-network responses or infer missing topics", () => {
    if (ready.kind !== "READY") throw new Error("TEST_READY");
    const fake = {
      ...ready,
      left: {...ready.left, sentimentPercent: null},
    } as VideoComparisonResult;
    expect(serializeSyntheticComparisonCsv(fake)).toBeNull();
  });
});
