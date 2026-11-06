import {describe,expect,it} from "vitest";
import {
  ApprovedChannelProfileCache,
  CHANNEL_PROFILE_TTL_MS,
  channelIdentityText,
  channelProfileForTarget,
  isApprovedChannelThumbnailUrl,
  validateApprovedChannelProfile,
} from "./workspaceChannelProfile";

const ID="UC"+"A".repeat(22);
const OTHER="UC"+"B".repeat(22);
const handle={kind:"CHANNEL_HANDLE" as const,id:"@example.channel"};
const channel={kind:"CHANNEL" as const,id:ID};
const now=1_000_000;
const verified={
  source:"APPROVED_CHANNEL_SNIPPET" as const,
  channelId:ID,handle:"@Example.Channel",
  title:"Example • verified metadata record",
  thumbnailUrl:"https://yt3.ggpht.com/a-/AOh14Gg_photo=s240-c-k-c0x00ffffff-no-rj",
  retrievedAt:now,
};

describe("UI-R04-F: fail-closed channel identity and profile contract",()=>{
  it("distinguishes registered channel ID from unresolved handle without network or guessed ownership",()=>{
    const pending=channelProfileForTarget(handle);
    expect(pending).toMatchObject({
      status:"POLICY_HOLD",identity:"HANDLE_UNRESOLVED",channelId:null,
      title:null,thumbnailUrl:null,
    });
    expect(channelIdentityText(pending!)).toMatch(/해석 대기/);
    expect(channelProfileForTarget(channel)).toMatchObject({
      status:"POLICY_HOLD",identity:"CHANNEL_ID_UNVERIFIED",channelId:ID,
      title:null,thumbnailUrl:null,
    });
    expect(channelProfileForTarget({kind:"VIDEO",id:"Ab0_-123xyz"})).toBeNull();
  });

  it("accepts approved source + exact identity and rejects a different channel/handle",()=>{
    const normalized=validateApprovedChannelProfile(verified,now);
    expect(normalized?.handle).toBe("@example.channel");
    const state=channelProfileForTarget(handle,normalized,now);
    expect(state).toMatchObject({
      status:"READY",identity:"HANDLE_RESOLVED",channelId:ID,
      title:"Example • verified metadata record",
    });
    expect(channelProfileForTarget(channel,normalized,now)?.status).toBe("READY");
    expect(channelProfileForTarget({kind:"CHANNEL",id:OTHER},normalized,now)?.status)
      .toBe("POLICY_HOLD");
    expect(channelProfileForTarget({kind:"CHANNEL_HANDLE",id:"@somebody"},normalized,now)?.status)
      .toBe("POLICY_HOLD");
  });

  it("requires a strict https image host; preserves exact approved URL",()=>{
    const accepted=verified.thumbnailUrl;
    expect(isApprovedChannelThumbnailUrl(accepted)).toBe(true);
    expect(validateApprovedChannelProfile(verified,now)?.thumbnailUrl).toBe(accepted);
    for(const bad of [
      "http://yt3.ggpht.com/photo", "https://yt3.ggpht.com.evil.test/image",
      "https://user:pw@yt3.ggpht.com/photo", "https://yt3.ggpht.com:444/photo",
      "https://evil.example/photo", "javascript:alert(1)",
    ]) {
      expect(isApprovedChannelThumbnailUrl(bad)).toBe(false);
      expect(validateApprovedChannelProfile({...verified,thumbnailUrl:bad},now))
        .toBeNull();
    }
  });

  it("rejects invented metadata, extra sensitive fields, malformed ids and future timestamps",()=>{
    for(const bad of [
      {...verified,source:"SCRAPED_UNAPPROVED"},
      {...verified,channelId:"not-a-channel"},
      {...verified,handle:"@"},
      {...verified,retrievedAt:now+1},
      {...verified,token:"secret"},
      {...verified,title:""},
    ]) expect(validateApprovedChannelProfile(bad,now)).toBeNull();
  });

  it("keeps bounded in-memory cached identities, resolves aliases and expires without extending TTL",()=>{
    const cache=new ApprovedChannelProfileCache(2);
    expect(cache.put(verified,now)).toBe(true);
    expect(cache.get(handle,now+1)).toMatchObject({
      status:"READY",channelId:ID,
    });
    expect(cache.get(channel,now+CHANNEL_PROFILE_TTL_MS)).toMatchObject({status:"READY"});
    expect(cache.get(handle,now+CHANNEL_PROFILE_TTL_MS+1)).toMatchObject({
      status:"STALE",thumbnailUrl:null,
    });
    expect(cache.size).toBe(1);
    const next={...verified,channelId:OTHER,handle:"@newhandle"};
    expect(cache.put(next,now)).toBe(true);
    expect(cache.size).toBe(2);
    const third={...verified,channelId:"UC"+"C".repeat(22),handle:"@thirdhandle"};
    expect(cache.put(third,now)).toBe(true);
    expect(cache.size).toBe(2);
    expect(cache.get(channel,now)?.status).toBe("POLICY_HOLD");
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("does not mistake a stale approval for a current channel profile",()=>{
    const stale=channelProfileForTarget(handle,verified,now+CHANNEL_PROFILE_TTL_MS+1);
    expect(stale).toMatchObject({status:"STALE",channelId:null,thumbnailUrl:null});
  });
});
