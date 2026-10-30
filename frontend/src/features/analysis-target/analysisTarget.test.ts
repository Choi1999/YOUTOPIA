
import { describe, expect, it } from "vitest";

import { createAnalysisTarget } from "./analysisTarget";

describe("AnalysisTarget 검증", () => {
  it("정상적인 YouTube 영상 ID를 허용한다", () => {
    const target = createAnalysisTarget(
      "VIDEO",
      "Ab0_-123xyz"
    );

    expect(target).toEqual({
      source: "YOUTUBE",
      targetType: "VIDEO",
      targetId: "Ab0_-123xyz",
    });
  });

  it("정상적인 YouTube 채널 ID를 허용한다", () => {
    const channelId = "UC" + "A".repeat(22);

    const target = createAnalysisTarget(
      "CHANNEL",
      channelId
    );

    expect(target?.targetId).toBe(channelId);
  });

  it("잘못된 ID와 미해결 handle을 거부한다", () => {
    expect(
      createAnalysisTarget("VIDEO", "short")
    ).toBeNull();

    expect(
      createAnalysisTarget("VIDEO", " Ab0_-123xyz")
    ).toBeNull();

    expect(
      createAnalysisTarget("CHANNEL", "@example")
    ).toBeNull();

    expect(
      createAnalysisTarget("CHANNEL", "UCshort")
    ).toBeNull();
  });
});
