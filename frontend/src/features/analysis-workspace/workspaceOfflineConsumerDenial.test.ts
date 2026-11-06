import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkOfflineConsumerDenial, offlineConsumerDenialReader,
  offlineConsumerDevEnabled, offlineConsumerPath,
  OFFLINE_CONSUMER_ROUTE,
} from "./workspaceOfflineConsumerDenial";

const video={kind:"VIDEO" as const,id:"Ab0_-123xyz"};
const channel={kind:"CHANNEL_HANDLE" as const,id:"@samplecreator"};

function problem(status:number,code:string,extra:Record<string,unknown>={}) {
  return new Response(JSON.stringify({
    type:"urn:youtopia:problem:metadata-policy-hold",
    title:"Metadata unavailable",status,
    detail:"Metadata is unavailable.",
    instance:OFFLINE_CONSUMER_ROUTE,code,...extra,
  }),{
    status,headers:{
      "content-type":"application/problem+json",
      "cache-control":"no-store",
    },
  });
}
beforeEach(()=>{
  vi.stubEnv("DEV",true);
  vi.stubEnv("VITE_R04AC_DIAGNOSTICS","enabled");
  vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP","enabled");
  vi.stubEnv("VITE_R04AG_CONSUMER_DENIAL","enabled");
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe("UI-R04-AG — DEV-only denied consumer HTTP",()=>{
  it("normalizes a relative route; only canonical target keys enter the path",()=>{
    expect(offlineConsumerPath(video)).toBe(
      OFFLINE_CONSUMER_ROUTE+"/videos/Ab0_-123xyz");
    expect(offlineConsumerPath(channel)).toBe(
      OFFLINE_CONSUMER_ROUTE+"/handles/%40samplecreator");
    expect(offlineConsumerPath({...video,id:"../evil"})).toBeNull();
  });

  it("does not issue any fetch with a missing DEV diagnostic or proxy flag",async()=>{
    vi.stubEnv("VITE_R04AG_CONSUMER_DENIAL","off");
    const fetcher=vi.fn(async()=>problem(503,"METADATA_POLICY_HOLD"));
    expect(offlineConsumerDevEnabled()).toBe(false);
    expect(await checkOfflineConsumerDenial(video,new AbortController().signal,
      fetcher as typeof fetch)).toBe("DISABLED");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401,"AUTHENTICATION_REQUIRED","UNAUTHORIZED"],
    [403,"ACCESS_DENIED","FORBIDDEN"],
    [503,"METADATA_POLICY_HOLD","POLICY_HOLD"],
  ] as const)("maps %s server denial without credentials or provider data",
  async(status,code,expected)=>{
    const fetcher=vi.fn(async()=>problem(status,code));
    expect(await checkOfflineConsumerDenial(video,new AbortController().signal,
      fetcher as typeof fetch)).toBe(expected);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain("/consumer-offline/videos/");
    const opts=fetcher.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("GET");
    expect(opts.credentials).toBe("omit");
    expect(opts.mode).toBe("same-origin");
    expect(opts.redirect).toBe("error");
    expect(opts.cache).toBe("no-store");
    expect(opts.headers).not.toHaveProperty("Authorization");
  });

  it("rejects a fake READY, leaked key, mismatch, cacheable or redirected denial",async()=>{
    const cases=[
      problem(503,"METADATA_POLICY_HOLD",{sourceAuthenticated:true}),
      problem(503,"METADATA_POLICY_HOLD",{apiKey:"DONT_LEAK"}),
      problem(403,"METADATA_POLICY_HOLD"),
      new Response(JSON.stringify({status:"READY",sourceAuthenticated:true,
        title:"Fake official title"}),{
          status:200,headers:{"content-type":"application/json"},
        }),
      new Response(JSON.stringify({status:503,code:"METADATA_POLICY_HOLD"}),{
        status:503,headers:{"content-type":"application/problem+json",
          "cache-control":"public,max-age=300"},
        }),
      new Response(JSON.stringify({status:503,code:"METADATA_POLICY_HOLD",
        instance:"/api/v1/youtube/metadata/other"}),{
          status:503,headers:{"content-type":"application/problem+json",
          "cache-control":"no-store"},
        }),
    ];
    for(const response of cases) {
      const fetcher=vi.fn(async()=>response);
      expect(await checkOfflineConsumerDenial(video,new AbortController().signal,
        fetcher as typeof fetch)).toBe("REJECTED");
    }
  });

  it("always returns null to AE; even policy-denied transport cannot mint READY",async()=>{
    const fetcher=vi.fn(async()=>problem(503,"METADATA_POLICY_HOLD"));
    vi.stubGlobal("fetch",fetcher);
    expect(await offlineConsumerDenialReader(video,new AbortController().signal))
      .toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    const controller=new AbortController();
    controller.abort();
    expect(await checkOfflineConsumerDenial(video,controller.signal,
      fetcher as typeof fetch)).toBe("DISABLED");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
