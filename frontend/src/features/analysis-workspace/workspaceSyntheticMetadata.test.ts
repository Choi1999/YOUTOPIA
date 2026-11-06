import { describe, expect, it } from "vitest";
import {
  createOfflineWorkspacePreview, decodeOfflineSyntheticMetadata,
  simulateOfflineMetadataBackend, SYNTHETIC_METADATA_SCHEMA,
} from "./workspaceSyntheticMetadata";
import { addWorkspaceUrlTargets, workspaceUrlTargetKey } from "./workspaceUrlTargets";

const VIDEO = { kind: "VIDEO" as const, id: "Ab0_-123xyz" };
const OTHER = { kind: "VIDEO" as const, id: "Cb0_-123xyz" };
const CHANNEL = { kind: "CHANNEL" as const, id: "UC" + "A".repeat(22) };
const HANDLE = { kind: "CHANNEL_HANDLE" as const, id: "@samplecreator" };

describe("UI-R04-W — local synthetic metadata envelope", () => {
  it("simulates a bounded future backend shape without any provider claim", () => {
    const response = simulateOfflineMetadataBackend(VIDEO);
    expect(response?.schema).toBe(SYNTHETIC_METADATA_SCHEMA);
    expect(response?.status).toBe("SYNTHETIC_NOT_PROVIDER_DATA");
    expect(response?.record).toMatchObject({
      source: "LOCAL_SYNTHETIC_ONLY",
      kind: "VIDEO",
      requestedId: VIDEO.id,
      sourceAuthenticated: false,
      providerRequestsMade: 0,
      consumerPublicationAuthorized: false,
      artwork: "VIDEO_PLACEHOLDER",
    });
    const record = decodeOfflineSyntheticMetadata(response, VIDEO);
    expect(record?.title).toContain("합성 영상 제목");
    expect(record?.channelName).toContain("실제 소속 미확인");
    expect(record).not.toHaveProperty("thumbnailUrl");
    expect(record).not.toHaveProperty("metrics");
    expect(record).not.toHaveProperty("imageUrl");
    expect(record).not.toHaveProperty("apiKey");
  });

  it("matches only the target's canonical VIDEO/CHANNEL/HANDLE identity", () => {
    for (const target of [VIDEO, CHANNEL, HANDLE]) {
      const response = simulateOfflineMetadataBackend(target);
      expect(decodeOfflineSyntheticMetadata(response, target)?.requestedId)
        .toBe(target.id);
    }
    expect(decodeOfflineSyntheticMetadata(
      simulateOfflineMetadataBackend(VIDEO), OTHER,
    )).toBeNull();
    expect(decodeOfflineSyntheticMetadata(
      simulateOfflineMetadataBackend(CHANNEL), HANDLE,
    )).toBeNull();
    expect(simulateOfflineMetadataBackend({ kind: "VIDEO", id: "bad" }))
      .toBeNull();
  });

  it("rejects provider authentication, unknown fields, wrong status and data injection", () => {
    const good = simulateOfflineMetadataBackend(VIDEO)!;
    const cases: unknown[] = [
      { ...good, status: "PROVIDER_VERIFIED" },
      { ...good, schema: "SOME_OTHER_SCHEMA" },
      { ...good, apiKey: "DONT_ACCEPT" },
      { ...good, record: { ...good.record, sourceAuthenticated: true } },
      { ...good, record: { ...good.record, providerRequestsMade: 1 } },
      { ...good, record: { ...good.record, consumerPublicationAuthorized: true } },
      { ...good, record: { ...good.record, requestedId: OTHER.id } },
      { ...good, record: { ...good.record, thumbnailUrl: "https://evil.example/collect" } },
      { ...good, record: { ...good.record, title: "bad\ncontrol" } },
      { ...good, record: { ...good.record, title: "" } },
      { ...good, record: { ...good.record, channelName: null } },
      null, [], {},
    ];
    for (const raw of cases)
      expect(decodeOfflineSyntheticMetadata(raw, VIDEO)).toBeNull();
  });

  it("creates only per-target in-memory synthetic metadata; adding/removing re-derives", () => {
    const input = addWorkspaceUrlTargets([], [
      "https://youtu.be/Ab0_-123xyz",
      "https://youtube.com/@samplecreator",
    ].join("\n")).targets;
    const all = createOfflineWorkspacePreview(input);
    expect(Object.keys(all)).toEqual(input.map(workspaceUrlTargetKey));
    expect(all["VIDEO:" + VIDEO.id].title).toContain(VIDEO.id);
    expect(all["CHANNEL_HANDLE:@samplecreator"].artwork).toBe("CHANNEL_PLACEHOLDER");
    expect(createOfflineWorkspacePreview(input.slice(1)))
      .not.toHaveProperty("VIDEO:" + VIDEO.id);
    expect(createOfflineWorkspacePreview([])).toEqual({});
  });
});
