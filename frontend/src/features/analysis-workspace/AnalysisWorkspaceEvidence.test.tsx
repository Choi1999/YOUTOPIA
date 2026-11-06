import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import type { AnalysisRepository } from "../analysis/data/AnalysisRepository";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { demoChannelSelections } from "../analysis/data/demoChannelSelection";
import { ChannelWorkspaceEvidence, VideoWorkspaceEvidence } from "./AnalysisWorkspaceEvidence";

function show(repo: AnalysisRepository = demoAnalysisRepository) {
  return render(
    <AnalysisRepositoryProvider repository={repo}>
      <VideoWorkspaceEvidence videoId="Ab0_-123xyz" />
      <ChannelWorkspaceEvidence channelId={demoChannelSelections[0].channelId} />
    </AnalysisRepositoryProvider>,
  );
}

describe("YU-52 — verified synthetic evidence drilldown", () => {
  it("distinguishes raw/eligible/excluded/classified denominators and channel scope", async () => {
    show();
    const video = screen.getByRole("region", {name:"영상 근거 상세"});
    const channel = screen.getByRole("region", {name:"채널 근거 상세"});
    expect(await within(video).findByText("120건")).toBeInTheDocument();
    expect(within(video).getByText("80건")).toBeInTheDocument();
    expect(within(video).getByText(/감성 비율 분모: 분류 완료 80건/)).toBeInTheDocument();
    expect(await within(channel).findByText("240건")).toBeInTheDocument();
    expect(within(channel).getByText("160건")).toBeInTheDocument();
    expect(within(channel).getByText(/실제 채널 소속/)).toBeInTheDocument();
  });

  it("does not display fabricated zeroes or stale counts for unregistered/missing data", async () => {
    const repo: AnalysisRepository = {
      async getSnapshot() { return { kind: "NOT_FOUND" }; },
    };
    show(repo);
    const video = screen.getByRole("region", {name:"영상 근거 상세"});
    const channel = screen.getByRole("region", {name:"채널 근거 상세"});
    expect(await within(video).findByText(/근거 검증 제한: NOT_FOUND/)).toBeInTheDocument();
    expect(await within(channel).findByText(/근거 검증 제한: INCOMPLETE_OR_UNVERIFIED/))
      .toBeInTheDocument();
    expect(within(video).queryByText("120건")).not.toBeInTheDocument();
    expect(within(channel).queryByText("240건")).not.toBeInTheDocument();
  });

  it("refuses mismatched projection and never leaks its metrics", async () => {
    const repo: AnalysisRepository = {
      async getSnapshot(target) {
        if (target.targetId === "Ab0_-123xyz") {
          return demoAnalysisRepository.getSnapshot({ ...target, targetId: "Qb0_-123xyz" });
        }
        return demoAnalysisRepository.getSnapshot(target);
      },
    };
    show(repo);
    const video = screen.getByRole("region", {name:"영상 근거 상세"});
    expect(await within(video).findByText(/근거 검증 제한: TARGET_MISMATCH/))
      .toBeInTheDocument();
    expect(within(video).queryByText("80건")).not.toBeInTheDocument();
  });
});
