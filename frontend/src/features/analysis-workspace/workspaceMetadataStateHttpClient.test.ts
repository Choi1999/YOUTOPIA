import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { fetchMetadataStateHttp,metadataStateDevEnabled,STATE_ROUTE } from "./workspaceMetadataStateHttpClient";
import { STATE_SCHEMA, type StateScenario } from "./workspaceMetadataConsumerState";

const VIDEO={kind:"VIDEO" as const,id:"Ab0_-123xyz"};
const now=Date.now();

function data(scenario:StateScenario="READY") {
  const record=scenario==="READY" || scenario==="STALE";
  return {
    schema:STATE_SCHEMA,status:scenario,source:"LOCAL_SYNTHETIC_ONLY",
    kind:"VIDEO",requestedId:VIDEO.id,
    title:record?"합성 영상 제목 · "+VIDEO.id:null,
    channelName:record?"합성 채널 안내 · 실제 소속 미확인":null,
    artwork:record?"VIDEO_PLACEHOLDER":null,
    channelId:null,associationVerified:false,
    observedAt:record?(scenario==="STALE"?now-120_000:now-500):0,
    expiresAt:record?(scenario==="STALE"?now-60_000:now+60_000):0,
    failureCode:scenario==="READY"?null:scenario==="NOT_FOUND"?"FIXTURE_NOT_FOUND":
      scenario==="FAILED"?"FIXTURE_UNAVAILABLE":"FIXTURE_EXPIRED",
    sourceAuthenticated:false,providerRequestsMade:0,
    consumerPublicationAuthorized:false,
  };
}
function response(scenario:StateScenario,change:Record<string,unknown>={},
                  status?:number) {
  return new Response(JSON.stringify({...data(scenario),...change}),{
    status:status??(scenario==="NOT_FOUND"?404:scenario==="FAILED"?503:200),
    headers:{
      "Content-Type":"application/json; charset=UTF-8",
      "X-YOUTOPIA-Synthetic":"test-only",
      "Cache-Control":"no-store",
    }
  });
}
beforeEach(()=>{
  vi.stubEnv("DEV",true);
  vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP","enabled");
  vi.stubEnv("VITE_R04AA_METADATA_STATES","enabled");
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe("UI-R04-AA — strict versioned dev-only state HTTP client",()=>{
  it("never fetches without two flags, dev mode or explicit consent",async()=>{
    const req=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>response("READY"));
    const signal=new AbortController().signal;
    vi.stubEnv("VITE_R04AA_METADATA_STATES","");
    expect(metadataStateDevEnabled()).toBe(false);
    expect(await fetchMetadataStateHttp(VIDEO,"READY",signal,
      req as unknown as typeof fetch)).toBeNull();
    vi.stubEnv("VITE_R04AA_METADATA_STATES","enabled");
    vi.stubEnv("DEV",false);
    expect(metadataStateDevEnabled()).toBe(false);
    expect(await fetchMetadataStateHttp(VIDEO,"READY",signal,
      req as unknown as typeof fetch)).toBeNull();
    expect(req).not.toHaveBeenCalled();
  });

  it("maps four server HTTP status codes onto distinct client states",async()=>{
    for(const scenario of ["READY","NOT_FOUND","FAILED","STALE"] as const) {
      const req=vi.fn(async (_input:RequestInfo|URL,_init?:RequestInit)=>
        response(scenario));
      const state=await fetchMetadataStateHttp(VIDEO,scenario,
        new AbortController().signal,req as unknown as typeof fetch);
      expect(state?.status).toBe(scenario);
      expect(state?.relationVerified).toBe(false);
      expect(state?.record?.title).toBe(
        scenario==="READY"?"합성 영상 제목 · "+VIDEO.id:undefined);
      expect(req).toHaveBeenCalledOnce();
      const path=req.mock.calls[0][0];
      expect(path).toBe(STATE_ROUTE+"/videos/"+VIDEO.id+
        (scenario==="READY"?"":"?scenario="+scenario));
      const options=req.mock.calls[0][1] as RequestInit;
      expect(options).toMatchObject({
        method:"GET",mode:"same-origin",credentials:"omit",
        redirect:"error",cache:"no-store",referrerPolicy:"no-referrer",
        headers:{Accept:"application/json"},
      });
      expect(JSON.stringify(options)).not.toContain("apiKey");
    }
  });

  it("rejects HTTP status mismatches and any fake authorization/header/large JSON",async()=>{
    const cases=[
      response("READY",{},404),
      response("NOT_FOUND",{},200),
      response("READY",{associationVerified:true,channelId:"UC"+"A".repeat(22)}),
      response("READY",{sourceAuthenticated:true}),
      response("READY",{providerRequestsMade:1}),
      response("READY",{thumbnailUrl:"https://evil.example/sender"}),
      new Response(JSON.stringify(data("READY")),{status:200,
        headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}),
      new Response(JSON.stringify(data("READY")),{status:200,
        headers:{"Content-Type":"text/plain","X-YOUTOPIA-Synthetic":"test-only","Cache-Control":"no-store"}}),
      new Response("x".repeat(5000),{status:200,
        headers:{"Content-Type":"application/json","X-YOUTOPIA-Synthetic":"test-only","Cache-Control":"no-store"}}),
    ];
    for(const reply of cases) {
      const req=vi.fn(async()=>reply);
      expect(await fetchMetadataStateHttp(VIDEO,"READY",
        new AbortController().signal,req as unknown as typeof fetch)).toBeNull();
    }
  });

  it("blocks invalid IDs, aborted requests and invalid scenario values",async()=>{
    const req=vi.fn(async()=>response("READY"));
    const aborted=new AbortController();aborted.abort();
    expect(await fetchMetadataStateHttp(VIDEO,"READY",aborted.signal,
      req as unknown as typeof fetch)).toBeNull();
    expect(await fetchMetadataStateHttp({kind:"VIDEO",id:"bad"},"READY",
      new AbortController().signal,req as unknown as typeof fetch)).toBeNull();
    expect(await fetchMetadataStateHttp(VIDEO,"FUTURE" as StateScenario,
      new AbortController().signal,req as unknown as typeof fetch)).toBeNull();
    expect(req).not.toHaveBeenCalled();
  });
});
