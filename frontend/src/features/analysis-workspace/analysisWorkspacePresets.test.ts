import { describe, expect, it } from "vitest";
import { applyWorkspacePreset, WORKSPACE_PRESETS } from "./analysisWorkspacePresets";
import { buildWorkspacePaths, createDefaultWorkspaceSession, withWorkspacePair } from "./analysisWorkspaceSession";
import { demoChannelSelections } from "../analysis/data/demoChannelSelection";

const T=2_000_000;

describe("YU-55 — code-defined synthetic selection presets", () => {
  it("offers three named, registered immutable presets", () => {
    expect(WORKSPACE_PRESETS.map(x => x.id)).toEqual(["CHANNEL_A","CHANNEL_B","PRICE_FOCUS"]);
    const initial=createDefaultWorkspaceSession(T);
    const b=applyWorkspacePreset(initial,"CHANNEL_B",T+1)!;
    expect(b.videoIds).toEqual(demoChannelSelections[1].videoIds);
    expect(b.channelIds[0]).toBe(demoChannelSelections[1].channelId);
    expect(b.topicId).toBe("QUALITY");
    expect(buildWorkspacePaths(b).channelCompare).toBe(
      "/analysis/youtube/channels/compare?channel="+demoChannelSelections[1].channelId+
      "&channel="+demoChannelSelections[0].channelId
    );
  });

  it("preserves prior recent targets while swapping current selection", () => {
    const base=withWorkspacePair(createDefaultWorkspaceSession(T),
      "videoIds",0,"Cb0_-123xyz",T+1)!;
    const next=applyWorkspacePreset(base,"PRICE_FOCUS",T+2)!;
    expect(next.recentTargets).toEqual(base.recentTargets);
    expect(next.videoIds).toEqual(["Qb0_-123xyz","Db0_-123xyz"]);
    expect(next.topicId).toBe("PRICE");
    expect(next.savedAt).toBe(T+2);
  });

  it("rejects unknown presets and untrusted extra session fields", () => {
    const base=createDefaultWorkspaceSession(T);
    expect(applyWorkspacePreset(base,"unknown" as "CHANNEL_A",T)).toBeNull();
    expect(applyWorkspacePreset({...base,token:"secret"} as typeof base,"CHANNEL_A",T))
      .toBeNull();
  });
});
