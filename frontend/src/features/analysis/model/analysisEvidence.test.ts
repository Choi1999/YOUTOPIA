
import { describe, expect, it } from "vitest";

import { demoReadySnapshot } from "../data/demoReadySnapshot";
import {
  isEvidencePointerConsistent,
  type AnalysisEvidencePointer,
} from "./analysisEvidence";

const evidence: AnalysisEvidencePointer = {
  evidenceId: "synthetic-recipe-evidence-001",
  snapshotId: demoReadySnapshot.snapshotId,
  target: demoReadySnapshot.target,
  kind: "TOPIC_AGGREGATE",
  topicId: "RECIPE",
  sourceType: "STATIC_FIXTURE",
  isSynthetic: true,
  visibility: "PUBLIC_REUSABLE",
  tenantId: null,
};

describe("분석 근거 참조 검증", () => {
  it("같은 스냅샷의 등록된 주제 근거를 허용한다", () => {
    expect(
      isEvidencePointerConsistent(evidence, demoReadySnapshot)
    ).toBe(true);
  });

  it("다른 스냅샷 ID에 연결된 근거를 거부한다", () => {
    expect(
      isEvidencePointerConsistent(
        { ...evidence, snapshotId: "other-snapshot" },
        demoReadySnapshot,
      )
    ).toBe(false);
  });

  it("존재하지 않는 주제에 연결된 근거를 거부한다", () => {
    expect(
      isEvidencePointerConsistent(
        { ...evidence, topicId: "UNKNOWN_TOPIC" },
        demoReadySnapshot,
      )
    ).toBe(false);
  });

  it("테넌트 범위가 일치하지 않으면 거부한다", () => {
    expect(
      isEvidencePointerConsistent(
        {
          ...evidence,
          visibility: "TENANT_PRIVATE",
          tenantId: "other-tenant",
        },
        demoReadySnapshot,
      )
    ).toBe(false);
  });
});
