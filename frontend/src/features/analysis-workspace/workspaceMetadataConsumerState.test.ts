import { describe, expect, it, vi, afterEach } from "vitest";
import { addWorkspaceUrlTargets, workspaceUrlTargetKey } from "./workspaceUrlTargets";
import {
  decodeMetadataState, InMemoryMetadataStateCache,
  metadataStateLabel, pendingMetadataState, verifiedVideoChannelRelation,
  STATE_SCHEMA,
} from "./workspaceMetadataConsumerState";

const VIDEO={kind:"VIDEO" as const,id:"Ab0_-123xyz"};
const OTHER={kind:"VIDEO" as const,id:"Cb0_-123xyz"};
const CHANNEL={kind:"CHANNEL" as const,id:"UC"+"A".repeat(22)};
const NOW=1_800_000_000_000;

function body(kind="VIDEO",id=VIDEO.id,now=NOW) {
  const isVideo=kind==="VIDEO";
  return {
    schema:STATE_SCHEMA,status:"READY",source:"LOCAL_SYNTHETIC_ONLY",
    kind,requestedId:id,
    title:(isVideo?"합성 영상 제목 · ":"합성 채널 이름 · ")+id,
    channelName:isVideo?"합성 채널 안내 · 실제 소속 미확인":null,
    artwork:isVideo?"VIDEO_PLACEHOLDER":"CHANNEL_PLACEHOLDER",
    channelId:null,associationVerified:false,
    observedAt:now-500,expiresAt:now+60_000,failureCode:null,
    sourceAuthenticated:false,providerRequestsMade:0,
    consumerPublicationAuthorized:false,
  };
}
afterEach(()=>vi.useRealTimers());

describe("UI-R04-AA — versioned synthetic state/status contract",()=>{
  it("decodes READY only with exact target and unauthenticated provenance",()=>{
    const ready=decodeMetadataState(body(),VIDEO,NOW);
    expect(ready?.status).toBe("READY");
    expect(ready?.record?.title).toContain(VIDEO.id);
    expect(ready?.record?.sourceAuthenticated).toBe(false);
    expect(ready?.relationVerified).toBe(false);
    expect(metadataStateLabel(ready ?? undefined)).toContain("실제 제공자 미확인");
    expect(pendingMetadataState()).toMatchObject({status:"PENDING",record:null});
  });
  it("requires strict status-specific body, timestamp freshness and exact identity",()=>{
    const ready=body();
    expect(decodeMetadataState(ready,OTHER,NOW)).toBeNull();
    const notFound={...ready,status:"NOT_FOUND",title:null,channelName:null,
      artwork:null,observedAt:0,expiresAt:0,failureCode:"FIXTURE_NOT_FOUND"};
    const failed={...notFound,status:"FAILED",failureCode:"FIXTURE_UNAVAILABLE"};
    const stale={...ready,status:"STALE",observedAt:NOW-120_000,
      expiresAt:NOW-60_000,failureCode:"FIXTURE_EXPIRED"};
    expect(decodeMetadataState(notFound,VIDEO,NOW)?.status).toBe("NOT_FOUND");
    expect(decodeMetadataState(failed,VIDEO,NOW)?.status).toBe("FAILED");
    expect(decodeMetadataState(stale,VIDEO,NOW)?.status).toBe("STALE");
    expect(decodeMetadataState(stale,VIDEO,NOW)?.record).toBeNull();
    expect(decodeMetadataState({...ready,expiresAt:NOW-1},VIDEO,NOW)).toBeNull();
    expect(decodeMetadataState({...stale,expiresAt:NOW+1},VIDEO,NOW)).toBeNull();
    expect(decodeMetadataState({...notFound,title:"Fake official"},VIDEO,NOW)).toBeNull();
    expect(decodeMetadataState({...failed,failureCode:null},VIDEO,NOW)).toBeNull();
  });
  it("rejects spoofed source, extra fields, secret, image or fake association",()=>{
    const b=body();
    for(const override of [
      {sourceAuthenticated:true},{consumerPublicationAuthorized:true},
      {providerRequestsMade:1},{associationVerified:true},
      {channelId:CHANNEL.id},{source:"APPROVED_GOOGLE_METADATA"},
      {title:"fake\ncontrol"},{title:"a".repeat(121)},
      {artwork:"https://evil.example/collect"},
      {requestedId:OTHER.id},{schema:"NEW_UNKNOWN_SCHEMA"},
      {secret:"test-key"},{thumbnailUrl:"https://evil.example/img"},
    ]) {
      expect(decodeMetadataState({...b,...override},VIDEO,NOW)).toBeNull();
    }
    const channel=decodeMetadataState(
      body("CHANNEL",CHANNEL.id),CHANNEL,NOW);
    const video=decodeMetadataState(b,VIDEO,NOW);
    expect(channel?.relationVerified).toBe(false);
    expect(video?.relationVerified).toBe(false);
    expect(verifiedVideoChannelRelation(video!,channel!)).toBe(false);
  });

  it("caches only READY with bounded TTL, explicit refresh and eviction",()=>{
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const cache=new InMemoryMetadataStateCache();
    const ready=decodeMetadataState(body(),VIDEO,NOW)!;
    const notFound={...ready,status:"NOT_FOUND" as const,record:null};
    expect(cache.put(VIDEO,notFound)).toBe(false);
    expect(cache.put(VIDEO,ready)).toBe(true);
    expect(cache.get(VIDEO,NOW)?.status).toBe("READY");
    expect(cache.get(VIDEO,NOW+60_001)?.status).toBe("STALE");
    expect(cache.get(VIDEO,NOW+60_002)).toBeNull();
    expect(cache.put(VIDEO,ready)).toBe(true);
    cache.invalidate(VIDEO);
    expect(cache.get(VIDEO,NOW)).toBeNull();
    const targets=addWorkspaceUrlTargets([],Array.from({length:40},(_,i)=>
      "https://youtu.be/"+"A"+i.toString().padStart(10,"0")).join("\n"),NOW).targets;
    expect(targets.length).toBe(32); // bounded URL ingestion per batch
    for(const target of targets) {
      const item=decodeMetadataState(body("VIDEO",target.id),target,NOW);
      expect(item?.status).toBe("READY");
      expect(cache.put(target,item!)).toBe(true);
    }
    expect(cache.size()).toBeLessThanOrEqual(32);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("keeps transient status separate from persisted labels and graph IDs",()=>{
    const targets=addWorkspaceUrlTargets([],"https://youtu.be/Ab0_-123xyz",NOW).targets;
    expect(workspaceUrlTargetKey(targets[0])).toBe("VIDEO:"+VIDEO.id);
    expect(metadataStateLabel(undefined)).toBe("메타데이터 미조회");
    expect(metadataStateLabel({status:"STALE",record:null,observedAt:0,
      expiresAt:0,reason:"CACHE_EXPIRED",relationVerified:false})).toContain("만료");
  });
});
