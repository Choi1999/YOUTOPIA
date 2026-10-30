
import { describe, expect, it } from "vitest";

import { createAnalysisTarget } from "../../analysis-target/analysisTarget";
import { demoAnalysisRepository } from "./DemoAnalysisRepository";

describe("DemoAnalysisRepository", () => {
  it("등록된 테스트 영상의 합성 READY 스냅샷을 반환한다", async () => {
    const target = createAnalysisTarget("VIDEO", "Ab0_-123xyz");
    if (!target) throw new Error("Invalid test target");

    const result = await demoAnalysisRepository.getSnapshot(target);

    expect(result.kind).toBe("FOUND");

    if (result.kind !== "FOUND") {
      throw new Error("Expected FOUND");
    }

    expect(result.snapshot.status).toBe("READY");
    expect(result.snapshot.isSynthetic).toBe(true);
    expect(result.snapshot.sourceType).toBe("STATIC_FIXTURE");
    expect(result.snapshot.target).toEqual(target);

    expect(result.snapshot.sample).toMatchObject({
      rawCount: 120,
      eligibleCount: 100,
      excludedCount: 20,
      classifiedCount: 80,
      unclassifiedCount: 20,
    });
  });

  it("등록되지 않은 영상에는 분석 결과를 생성하지 않는다", async () => {
    const target = createAnalysisTarget("VIDEO", "Zb0_-123xyz");
    if (!target) throw new Error("Invalid test target");

    const result = await demoAnalysisRepository.getSnapshot(target);

    expect(result).toEqual({ kind: "NOT_FOUND" });
  });

  it("채널 조회에 영상 스냅샷을 반환하지 않는다", async () => {
    const target = createAnalysisTarget("CHANNEL", "UC" + "A".repeat(22));
    if (!target) throw new Error("Invalid test target");

    const result = await demoAnalysisRepository.getSnapshot(target);

    expect(result).toEqual({ kind: "NOT_FOUND" });
  });
});
