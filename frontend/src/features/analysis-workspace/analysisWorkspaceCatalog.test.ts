import { describe, expect, it } from "vitest";
import type { AnalysisRepository } from "../analysis/data/AnalysisRepository";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { demoReadySnapshot } from "../analysis/data/demoReadySnapshot";
import { demoChannelSelections } from "../analysis/data/demoChannelSelection";
import { filterWorkspaceCatalog, readWorkspaceCatalog } from "./analysisWorkspaceCatalog";

describe("YU-53/54 — explicit verified synthetic catalogue", () => {
  it("loads four videos and two registered channels with correct denominator", async () => {
    const entries = await readWorkspaceCatalog(demoAnalysisRepository);
    expect(entries).toHaveLength(6);
    expect(entries.filter(e => e.kind === "VIDEO")).toHaveLength(4);
    const video = entries.find(e => e.id === "Ab0_-123xyz");
    expect(video?.status).toBe("READY");
    expect(video?.classified).toBe(80);
    expect(video?.eligible).toBe(100);
    expect(video?.positivePercent).toBe(62.5);
    const channelA = entries.find(e => e.id === demoChannelSelections[0].channelId);
    const channelB = entries.find(e => e.id === demoChannelSelections[1].channelId);
    expect(channelA?.classified).toBe(160);
    expect(channelB?.classified).toBe(140);
    expect(channelB?.topics.find(t => t.id === "QUALITY")?.count).toBe(43);
  });

  it("filters by exact verified status, kind, ID and mentioned topics", async () => {
    const entries = await readWorkspaceCatalog(demoAnalysisRepository);
    expect(filterWorkspaceCatalog(entries, {
      search: "Ab0_", kind: "VIDEO", status: "READY", topic: "",
    }).map(e => e.id)).toEqual(["Ab0_-123xyz"]);
    const quality = filterWorkspaceCatalog(entries, {
      search: "", kind: "CHANNEL", status: "READY", topic: "QUALITY",
    });
    expect(quality.map(e => e.id)).toEqual([demoChannelSelections[1].channelId]);
    expect(filterWorkspaceCatalog(entries, {
      search: "", kind: "CHANNEL", status: "BLOCKED", topic: "",
    })).toHaveLength(0);
    expect(filterWorkspaceCatalog(entries, {
      search: "", kind: "ALL", status: "ALL", topic: "NOT_REGISTERED",
    })).toHaveLength(0);
  });

  it("blocks missing data and does not turn missing into zeroes", async () => {
    const repo: AnalysisRepository = {async getSnapshot() {return {kind:"NOT_FOUND"};}};
    const entries = await readWorkspaceCatalog(repo);
    expect(entries.every(e => e.status === "BLOCKED")).toBe(true);
    expect(entries.every(e => e.classified === null && e.positivePercent === null)).toBe(true);
    expect(filterWorkspaceCatalog(entries, {
      search: "", kind: "ALL", status: "READY", topic: "",
    })).toHaveLength(0);
  });

  it("flags STALE without leaking sample and blocks dependent channel aggregation", async () => {
    const repo: AnalysisRepository = {
      async getSnapshot(target) {
        if (target.targetId === "Ab0_-123xyz") {
          return {kind:"FOUND", snapshot: {...demoReadySnapshot, status:"STALE"}};
        }
        return demoAnalysisRepository.getSnapshot(target);
      },
    };
    const entries = await readWorkspaceCatalog(repo);
    const stale = entries.find(e => e.id === "Ab0_-123xyz");
    expect(stale?.status).toBe("STALE");
    expect(stale?.classified).toBeNull();
    const channel = entries.find(e => e.id === demoChannelSelections[0].channelId);
    expect(channel?.status).toBe("BLOCKED");
    expect(channel?.classified).toBeNull();
  });

  it("rejects a mismatched target and noncanonical query text without leaking metrics", async () => {
    const repo: AnalysisRepository = {
      async getSnapshot(target) {
        if (target.targetId === "Ab0_-123xyz") {
          return demoAnalysisRepository.getSnapshot({...target,targetId:"Qb0_-123xyz"});
        }
        return demoAnalysisRepository.getSnapshot(target);
      },
    };
    const entries = await readWorkspaceCatalog(repo);
    expect(entries.find(e => e.id === "Ab0_-123xyz")?.reason).toBe("TARGET_MISMATCH");
    expect(entries.find(e => e.id === "Ab0_-123xyz")?.classified).toBeNull();
    expect(filterWorkspaceCatalog(entries,{
      search: "a".repeat(81), kind:"ALL", status:"ALL", topic:"",
    })).toHaveLength(0);
  });
});
