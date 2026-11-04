import {describe,expect,it,vi} from "vitest";
import {ApprovedChannelProfileCache} from "./workspaceChannelProfile";
import {
  CHANNEL_METADATA_RUNTIME_GATE,
  readChannelProfileWithGate,
} from "./workspaceChannelReader";

const now=1_000_000;
const handle={kind:"CHANNEL_HANDLE" as const,id:"@example.channel"};
const verified={
  source:"APPROVED_CHANNEL_SNIPPET" as const,
  channelId:"UC"+"A".repeat(22),
  handle:"@example.channel",
  title:"Example",
  thumbnailUrl:"https://yt3.ggpht.com/a-/AOh14Gg_photo=s88",
  retrievedAt:now,
};

describe("UI-R04-F — provider adapter authorization and failures",()=>{
  it("never calls a reader when the metadata gate is held",async()=>{
    const cache=new ApprovedChannelProfileCache();
    const reader=vi.fn(async()=>verified);
    expect(CHANNEL_METADATA_RUNTIME_GATE).toBe("POLICY_HOLD");
    expect(await readChannelProfileWithGate(handle,cache,{allowRead:false,reader},now))
      .toMatchObject({status:"POLICY_HOLD",thumbnailUrl:null,channelId:null});
    expect(reader).not.toHaveBeenCalled();
    expect(cache.size).toBe(0);
  });

  it("accepts only an exact validated, explicitly approved reader response in simulated tests",async()=>{
    const cache=new ApprovedChannelProfileCache();
    const reader=vi.fn(async()=>verified);
    const view=await readChannelProfileWithGate(handle,cache,{allowRead:true,reader},now);
    expect(view).toMatchObject({
      status:"READY",identity:"HANDLE_RESOLVED",
      title:"Example",channelId:"UC"+"A".repeat(22),
    });
    expect(reader).toHaveBeenCalledTimes(1);
    expect(cache.get(handle,now)?.status).toBe("READY");
  });

  it("fails closed on missing, mismatched or failing provider responses",async()=>{
    const cache=new ApprovedChannelProfileCache();
    expect((await readChannelProfileWithGate(handle,cache,{
      allowRead:true,reader:async()=>null,
    },now))?.status).toBe("NOT_FOUND");
    expect((await readChannelProfileWithGate(handle,cache,{
      allowRead:true,reader:async()=>({...verified,handle:"@another"}),
    },now))?.status).toBe("FAILED");
    expect((await readChannelProfileWithGate(handle,cache,{
      allowRead:true,reader:async()=>{throw Error("network disabled")},
    },now))?.status).toBe("FAILED");
    expect(cache.size).toBe(0);
  });
});
