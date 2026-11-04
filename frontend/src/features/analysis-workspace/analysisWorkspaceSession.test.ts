import { describe, expect, it } from "vitest";

import { demoChannelSelections } from "../analysis/data/demoChannelSelection";
import {
  ANALYSIS_WORKSPACE_SESSION_KEY,
  ANALYSIS_WORKSPACE_TTL_MS,
  buildWorkspacePaths,
  clearWorkspaceSession,
  createDefaultWorkspaceSession,
  isValidWorkspaceSession,
  readWorkspaceSession,
  withWorkspacePair,
  withWorkspaceTopic,
  writeWorkspaceSession,
} from "./analysisWorkspaceSession";

const A = demoChannelSelections[0].channelId;
const B = demoChannelSelections[1].channelId;
const T = 1_000_000;

describe("YU-51 — bounded, synthetic-only browser-tab work session", () => {
  it("creates canonical navigation without snapshot/credential data", () => {
    const session = createDefaultWorkspaceSession(T);
    const paths = buildWorkspacePaths(session);
    expect(paths.videoCompare).toBe(
      "/analysis/youtube/compare?video=Ab0_-123xyz&video=Qb0_-123xyz",
    );
    expect(paths.channelCompare).toBe(
      "/analysis/youtube/channels/compare?channel=" + A + "&channel=" + B,
    );
    expect(paths.topicExplorer).toBe(
      "/analysis/youtube/topics?topic=RECIPE&channel=" + A + "&channel=" + B,
    );
    expect(JSON.stringify(session)).not.toMatch(/comment|token|secret|snapshot/i);
  });

  it("preserves drafts without generating incomplete compare URLs", () => {
    const initial = createDefaultWorkspaceSession(T);
    const partial = withWorkspacePair(initial, "channelIds", 1, "", T + 1);
    expect(partial).not.toBeNull();
    expect(buildWorkspacePaths(partial!).channelCompare).toBeNull();
    expect(buildWorkspacePaths(partial!).topicExplorer).toBe(
      "/analysis/youtube/topics?topic=RECIPE&channel=" + A,
    );
    expect(withWorkspacePair(partial!, "channelIds", 1, A, T + 2)).toBeNull();
    expect(withWorkspacePair(partial!, "channelIds", 1, "UC" + "Z".repeat(22), T + 2))
      .toBeNull();
    expect(withWorkspaceTopic(partial!, "NOT_REGISTERED", T + 2)).toBeNull();
  });

  it("keeps six unique recent targets in recency order", () => {
    let current = createDefaultWorkspaceSession(T);
    for (const [field, index, id] of [
      ["videoIds", 0, "Cb0_-123xyz"],
      ["videoIds", 1, "Db0_-123xyz"],
      ["channelIds", 0, B],
      ["channelIds", 1, A],
      ["videoIds", 0, "Ab0_-123xyz"],
      ["videoIds", 1, "Qb0_-123xyz"],
      ["channelIds", 0, B],
    ] as const) {
      const next = withWorkspacePair(current, field, index, id, T);
      expect(next).not.toBeNull();
      current = next!;
    }
    expect(current.recentTargets).toHaveLength(6);
    expect(current.recentTargets[0]).toEqual({ type: "CHANNEL", id: B });
    expect(new Set(current.recentTargets.map(item => item.type + item.id)).size).toBe(6);
  });

  it("restores only a valid v1 record before its TTL", () => {
    const session = withWorkspacePair(
      createDefaultWorkspaceSession(T), "videoIds", 0, "Cb0_-123xyz", T + 1,
    )!;
    expect(writeWorkspaceSession(sessionStorage, session, T + 1)).toBe(true);
    expect(readWorkspaceSession(sessionStorage, T + 2)).toEqual(session);
    expect(readWorkspaceSession(sessionStorage, T + 1 + ANALYSIS_WORKSPACE_TTL_MS + 1))
      .toBeNull();
    expect(clearWorkspaceSession(sessionStorage)).toBe(true);
    expect(sessionStorage.getItem(ANALYSIS_WORKSPACE_SESSION_KEY)).toBeNull();
  });

  it("refuses unregistered, duplicate, future, oversized, or polluted state", () => {
    const original = createDefaultWorkspaceSession(T);
    for (const altered of [
      { ...original, videoIds: ["Ab0_-123xyz", "Ab0_-123xyz"] },
      { ...original, channelIds: [A, "UC" + "Z".repeat(22)] },
      { ...original, topicId: "UNKNOWN" },
      { ...original, savedAt: T + 10 },
      { ...original, token: "do-not-read" },
      { ...original, recentTargets: [{type:"VIDEO",id:"unknown"}] },
    ]) {
      expect(isValidWorkspaceSession(altered, T)).toBe(false);
      sessionStorage.setItem(ANALYSIS_WORKSPACE_SESSION_KEY, JSON.stringify(altered));
      expect(readWorkspaceSession(sessionStorage, T)).toBeNull();
    }
    sessionStorage.setItem(ANALYSIS_WORKSPACE_SESSION_KEY, "x".repeat(4097));
    expect(readWorkspaceSession(sessionStorage, T)).toBeNull();
  });

  it("fails closed when storage is unavailable or throws", () => {
    const session = createDefaultWorkspaceSession(T);
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(readWorkspaceSession(broken, T)).toBeNull();
    expect(writeWorkspaceSession(broken, session, T)).toBe(false);
    expect(clearWorkspaceSession(broken)).toBe(false);
    expect(readWorkspaceSession(null, T)).toBeNull();
    expect(writeWorkspaceSession(null, session, T)).toBe(false);
  });
});
