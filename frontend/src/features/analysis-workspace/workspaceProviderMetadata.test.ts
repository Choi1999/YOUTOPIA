import { describe, expect, it } from "vitest";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";
import {
  decodeProviderMetadata, providerMetadataRequest, providerMetadataStatusLabel,
  readyProviderMetadata, unavailableProviderState,
  PROVIDER_METADATA_RESPONSE_SCHEMA, PROVIDER_METADATA_REQUEST_SCHEMA,
} from "./workspaceProviderMetadata";

const video = { kind: "VIDEO" as const, id: "Ab0_-123xyz" };
const channel = { kind: "CHANNEL_HANDLE" as const, id: "@samplecreator" };
const now = 1_793_946_000_000;

function ready(target: Pick<WorkspaceUrlTarget,"kind"|"id"> = video) {
  return {
    schema: PROVIDER_METADATA_RESPONSE_SCHEMA,
    source: "AUTHORIZED_BACKEND",
    sourceAuthenticated: true,
    kind: target.kind,
    requestedId: target.id,
    status: "READY",
    title: "서버 제공 제목",
    channelTitle: target.kind === "VIDEO" ? "서버 제공 채널 이름" : null,
    thumbnailUrl: target.kind === "VIDEO"
      ? "https://i.ytimg.com/vi/Ab0_-123xyz/hqdefault.jpg"
      : "https://yt3.googleusercontent.com/sample-avatar",
    observedAt: now - 100,
    expiresAt: now + 60_000,
  };
}

describe("UI-R04-AE — offline provider metadata seam", () => {
  it("builds only a canonical request descriptor, not a network operation", () => {
    expect(providerMetadataRequest(video)).toEqual({
      schema: PROVIDER_METADATA_REQUEST_SCHEMA,
      kind: "VIDEO", requestedId: "Ab0_-123xyz",
    });
  });

  it("rejects all claimed backend metadata without an independently supplied reader gate", () => {
    expect(decodeProviderMetadata(ready(),video,false,now)).toBeNull();
    expect(decodeProviderMetadata(ready(),video,undefined,now)).toBeNull();
    const result = decodeProviderMetadata(ready(),video,true,now);
    expect(result?.status).toBe("READY");
    expect(readyProviderMetadata(result ?? undefined,video,now)?.title)
      .toBe("서버 제공 제목");
    expect(providerMetadataStatusLabel(result ?? undefined,now))
      .toContain("백엔드 메타데이터");
  });

  it("rejects identity mismatch, synthetic source, extra fields and unverifiable artwork", () => {
    expect(decodeProviderMetadata({...ready(),requestedId:"different"},video,true,now))
      .toBeNull();
    expect(decodeProviderMetadata({...ready(),source:"LOCAL_SYNTHETIC_ONLY"},video,true,now))
      .toBeNull();
    expect(decodeProviderMetadata({...ready(),sourceAuthenticated:false},video,true,now))
      .toBeNull();
    expect(decodeProviderMetadata({...ready(),apiKey:"secret"},video,true,now))
      .toBeNull();
    expect(decodeProviderMetadata({...ready(),thumbnailUrl:"https://evil.example/x.jpg"},video,true,now))
      .toBeNull();
    expect(decodeProviderMetadata({
      ...ready(),thumbnailUrl:"https://i.ytimg.com/vi/OtherVideo0/hqdefault.jpg",
    },video,true,now)).toBeNull();
    expect(decodeProviderMetadata({
      ...ready(),expiresAt:now+20*60_000,
    },video,true,now)).toBeNull();
    expect(decodeProviderMetadata({...ready(),title:"bad\nline"},video,true,now))
      .toBeNull();
  });

  it("keeps channel-handle identity separate from title and image", () => {
    const record = decodeProviderMetadata(ready(channel),channel,true,now);
    expect(record?.record?.title).toBe("서버 제공 제목");
    expect(record?.record?.channelTitle).toBeNull();
    expect(record?.record?.thumbnailUrl).toMatch(/^https:\/\/yt3\./);
    expect(readyProviderMetadata(record ?? undefined,video,now)).toBeNull();
    expect(readyProviderMetadata(record ?? undefined,channel,now+60_001))
      .toBeNull();
  });

  it("accepts only non-publishing negative states and never guesses a title on failure", () => {
    for (const status of ["NOT_FOUND","FAILED","STALE"] as const) {
      const negative = {
        ...ready(),status,title:null,channelTitle:null,thumbnailUrl:null,
        observedAt:0,expiresAt:0,
      };
      const state = decodeProviderMetadata(negative,video,true,now);
      expect(state?.status).toBe(status);
      expect(state?.record).toBeNull();
      expect(readyProviderMetadata(state ?? undefined,video,now)).toBeNull();
      expect(providerMetadataStatusLabel(state ?? undefined,now)).toBeTruthy();
    }
    expect(decodeProviderMetadata({
      ...ready(),status:"NOT_FOUND",
    },video,true,now)).toBeNull();

    const pending=unavailableProviderState(video);
    const failed=unavailableProviderState(video,"FAILED");
    expect(pending.status).toBe("PENDING");
    expect(failed.status).toBe("FAILED");
    expect(pending.sourceAuthenticated).toBe(false);
    expect(providerMetadataStatusLabel(failed)).toContain("조회 실패");
  });
});
