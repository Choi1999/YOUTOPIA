
import { describe, expect, it } from "vitest";

import { createAnalysisTarget } from "../../analysis-target/analysisTarget";
import { demoReadySnapshot } from "./demoReadySnapshot";
import { demoAnalysisRepository } from "./DemoAnalysisRepository";
import { createValidatedDemoAnalysisRepository } from "./ValidatedDemoAnalysisRepository";

function targetFor(id: string) {
  const target = createAnalysisTarget("VIDEO", id);

  if (!target) {
    throw new Error("Invalid test video ID");
  }

  return target;
}

function withSnapshot(snapshot: unknown) {
  return createValidatedDemoAnalysisRepository({
    async getSnapshot() {
      return { kind: "FOUND", snapshot };
    },
  });
}

describe("ValidatedDemoAnalysisRepository", () => {
  it("유효한 READY 합성 스냅샷을 반환한다", async () => {
    const repository =
      createValidatedDemoAnalysisRepository(demoAnalysisRepository);

    const result = await repository.getSnapshot(
      targetFor("Ab0_-123xyz"),
    );

    expect(result.kind).toBe("FOUND");
  });

  it("등록되지 않은 영상의 NOT_FOUND를 유지한다", async () => {
    const repository =
      createValidatedDemoAnalysisRepository(demoAnalysisRepository);

    const result = await repository.getSnapshot(
      targetFor("Zb0_-123xyz"),
    );

    expect(result).toEqual({ kind: "NOT_FOUND" });
  });

  it("잘못된 스냅샷을 화면에 전달하지 않는다", async () => {
    const repository = withSnapshot({
      ...demoReadySnapshot,
      sample: {
        ...demoReadySnapshot.sample,
        rawCount: 121,
      },
    });

    await expect(
      repository.getSnapshot(targetFor("Ab0_-123xyz")),
    ).rejects.toThrow("INVALID_ANALYSIS_SNAPSHOT");
  });

  it("요청한 영상과 다른 스냅샷을 차단한다", async () => {
    const repository = withSnapshot(demoReadySnapshot);

    await expect(
      repository.getSnapshot(targetFor("Zb0_-123xyz")),
    ).rejects.toThrow("ANALYSIS_TARGET_MISMATCH");
  });

  it("실제 제공자 데이터는 현재 데모 경계에서 거부한다", async () => {
    const repository = withSnapshot({
      ...demoReadySnapshot,
      sourceType: "APPROVED_PROVIDER",
      isSynthetic: false,
    });

    await expect(
      repository.getSnapshot(targetFor("Ab0_-123xyz")),
    ).rejects.toThrow("UNVERIFIED_ANALYSIS_ACCESS");
  });

  it("테넌트 비공개 데이터는 현재 데모에서 거부한다", async () => {
    const repository = withSnapshot({
      ...demoReadySnapshot,
      visibility: "TENANT_PRIVATE",
      tenantId: "tenant-a",
    });

    await expect(
      repository.getSnapshot(targetFor("Ab0_-123xyz")),
    ).rejects.toThrow("UNVERIFIED_ANALYSIS_ACCESS");
  });
});
