"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const gates=require("../../../contracts/yu32-youtube-readiness-v0/policy-gates.json");
const {
  WINDOW_MS,MAX_PLANNED_UNITS_PER_WINDOW,MAX_PENDING_TICKETS,
  createLockedMetadataLifecycle
}=require("../src/metadata-guarded-lifecycle.cjs");

const V1="Ab0_-123xyz",V2="Bb0_-123xyz",C1="UC"+"A".repeat(22);
const video=(id=V1)=>({kind:"youtube#video",id,
  snippet:{title:"자동 조회 가능한 제목 후보",channelId:C1,
    thumbnails:{high:{url:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg"}}}});
const channel=(id=C1)=>({kind:"youtube#channel",id,
  snippet:{title:"채널 이름 후보",
    thumbnails:{high:{url:"https://yt3.ggpht.com/samplechannel"}}}});
const page=(kind,items)=>JSON.stringify({
  kind,items,pageInfo:{totalResults:items.length,resultsPerPage:items.length}
});
const videoPage=(items)=>page("youtube#videoListResponse",items);
const channelPage=(items)=>page("youtube#channelListResponse",items);
function code(expected,fn){
  assert.throws(fn,e=>e?.code===expected);
}

test("R04P-01: source and external request gates stay fully locked",()=>{
  assert.equal(gates.status,"POLICY_HOLD");
  assert.equal(gates.liveCallsAuthorized,false);
  assert.equal(gates.externalDataCollected,false);
  assert.equal(gates.derivedSentimentAuthorized,false);
  assert.equal(gates.verifiedCount,0);
  const dir=path.join(__dirname,"..","src");
  const source=fs.readFileSync(path.join(dir,"metadata-guarded-lifecycle.cjs"),"utf8");
  assert.doesNotMatch(source,/\brequire\s*\(\s*["'](?:node:)?(?:https?|net|tls|dns|child_process|fs)["']\s*\)/);
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|https\.request|http\.request)\s*\(/);
  assert.doesNotMatch(source,/\bprocess\.env\b/);
  const lifecycle=createLockedMetadataLifecycle();
  const current=lifecycle.status(1000);
  assert.equal(current.networkEnabled,false);
  assert.equal(current.credentialsAccepted,false);
  assert.equal(current.sourceAuthenticated,false);
  assert.equal(current.consumerPublicationAuthorized,false);
  assert.equal(current.actualProviderRequests,0);
  assert.equal(current.actualQuotaUnitsConsumed,0);
  assert.equal(current.serverCredentialReaderPresent,false);
  assert.equal(typeof lifecycle.execute,"undefined");
  assert.equal(typeof lifecycle.authorize,"undefined");
});

test("R04P-02: plans only bounded official metadata requests; no live send",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const result=lifecycle.propose({videoIds:[V1],channelIds:[C1],handles:["@somecreator"]},1000);
  assert.equal(result.status,"NON_EXECUTABLE_PLAN_ISSUED");
  assert.equal(result.plan.totalTargets,3);
  assert.equal(result.plannedQuotaUnits,3);
  assert.equal(result.remainingUnits,3);
  assert.equal(result.plan.networkEnabled,false);
  assert.equal(result.plan.providerRequestsMade,0);
  assert.equal(result.plan.candidates[0].query.part,"snippet");
  assert.equal(result.plan.candidates[0].method,"videos.list");
  assert.equal(result.plan.candidates[1].method,"channels.list");
  assert.equal(result.plan.candidates[2].query.forHandle,"@somecreator");
  assert.equal(result.credentialsAccepted,false);
});

test("R04P-03: no caller credential/role/URL/approval field can authorize a plan",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const rejected=[
    {videoIds:[V1],apiKey:"1234567890123456789012345678901234567890"},
    {videoIds:[V1],authorization:"ADMIN"},
    {videoIds:[V1],allowRead:true},
    {videoIds:[V1],fetchUrl:"https://www.googleapis.com/youtube/v3/videos"},
    {videoIds:[V1],networkEnabled:true},
    {videoIds:[V1,V1]},
    {videoIds:["not-valid"]},
    {},
  ];
  for(const option of rejected)
    assert.throws(()=>lifecycle.propose(option,1000),/R04O_METADATA_/);
  assert.equal(lifecycle.status(1000).plannedQuotaUnits,0);
});

test("R04P-04: per-minute simulated reservation budget cannot be exceeded",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  assert.equal(WINDOW_MS,60000);
  assert.equal(MAX_PLANNED_UNITS_PER_WINDOW,6);
  const first=lifecycle.propose({videoIds:[V1],channelIds:[C1],handles:["@somecreator"]},1000);
  const second=lifecycle.propose({videoIds:[V2],channelIds:[C1],handles:["@othercreator"]},1000);
  assert.equal(first.status,"NON_EXECUTABLE_PLAN_ISSUED");
  assert.equal(second.status,"NON_EXECUTABLE_PLAN_ISSUED");
  assert.equal(lifecycle.cancel(first.ticket,1000),true);
  const blocked=lifecycle.propose({videoIds:[V1]},1000);
  assert.equal(blocked.status,"OFFLINE_PLAN_BUDGET_BLOCKED");
  assert.equal(blocked.ticket,null);
  assert.equal(blocked.remainingUnits,0);
  const snapshot=lifecycle.status(1000);
  assert.equal(snapshot.plannedQuotaUnits,6);
  assert.equal(snapshot.actualQuotaUnitsConsumed,0);
  assert.equal(snapshot.actualProviderRequests,0);
  assert(Object.isFrozen(snapshot));
});

test("R04P-05: pending ticket maximum and cancellation do not refund planned quota",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const tickets=[V1,V2,"Cb0_-123xyz"].map(videoId=>
    lifecycle.propose({videoIds:[videoId]},1000).ticket);
  assert.equal(tickets.length,3);
  assert.equal(MAX_PENDING_TICKETS,3);
  assert.equal(lifecycle.propose({videoIds:[V1]},1000).status,
    "OFFLINE_PENDING_LIMIT_BLOCKED");
  assert.equal(lifecycle.cancel(tickets[1],1000),true);
  assert.equal(lifecycle.cancel(tickets[1],1000),false);
  assert.equal(lifecycle.status(1000).plannedQuotaUnits,3);
  const another=lifecycle.propose({videoIds:[V1]},1000);
  assert.equal(another.status,"NON_EXECUTABLE_PLAN_ISSUED");
  assert.equal(lifecycle.status(1000).plannedQuotaUnits,4);
});

test("R04P-06: a minute boundary resets simulated budget and cancels stale tickets",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const old=lifecycle.propose({videoIds:[V1]},1000);
  const newer=lifecycle.propose({videoIds:[V2]},61000);
  assert.equal(newer.status,"NON_EXECUTABLE_PLAN_ISSUED");
  assert.equal(newer.plannedUnits,1);
  assert.equal(lifecycle.status(61000).pendingTickets,1);
  code("R04P_OFFLINE_UNKNOWN_OR_REPLAYED_TICKET",()=>
    lifecycle.inspectSyntheticBodies(old.ticket,[videoPage([video()])],61000));
  code("R04P_OFFLINE_CLOCK_ROLLBACK",()=>lifecycle.status(1000));
});

test("R04P-07: synthetic video/channel bodies validate without authenticating origin",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const plan=lifecycle.propose({videoIds:[V1],channelIds:[C1]},1000);
  const result=lifecycle.inspectSyntheticBodies(plan.ticket,
    [videoPage([video()]),channelPage([channel()])],1000);
  assert.equal(result.status,"OFFLINE_SHAPE_VALIDATED_NOT_AUTHENTICATED");
  assert.equal(result.records.length,2);
  assert.equal(result.records[0].title,"자동 조회 가능한 제목 후보");
  assert.equal(result.records[1].thumbnailUrl,"https://yt3.ggpht.com/samplechannel");
  assert(result.records.every(record=>record.sourceAuthenticated===false&&
    record.consumerReady===false));
  assert.equal(result.consumerPublicationAuthorized,false);
  assert.equal(result.actualProviderRequests,0);
  assert.equal(result.actualQuotaUnitsConsumed,0);
  assert.equal(lifecycle.readOfflineCache("VIDEO:"+V1,1001),result.records[0]);
  assert.equal(lifecycle.readOfflineCache("CHANNEL:"+C1,1001),result.records[1]);
});

test("R04P-08: all response candidates validated before cache writes",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const first=lifecycle.propose({videoIds:[V1],channelIds:[C1]},1000);
  assert.throws(()=>lifecycle.inspectSyntheticBodies(first.ticket,
    [videoPage([video()]),"not-json"],1000),/R04O_METADATA_/);
  assert.equal(lifecycle.readOfflineCache("VIDEO:"+V1,1000),null);
  code("R04P_OFFLINE_UNKNOWN_OR_REPLAYED_TICKET",()=>
    lifecycle.inspectSyntheticBodies(first.ticket,[videoPage([video()]),channelPage([channel()])],1000));
  const second=lifecycle.propose({videoIds:[V2]},1000);
  assert.equal(lifecycle.inspectSyntheticBodies(second.ticket,
    [videoPage([video(V2)])],1000).decodedCount,1);
  assert.equal(lifecycle.readOfflineCache("VIDEO:"+V2,1000)?.title,
    "자동 조회 가능한 제목 후보");
});

test("R04P-09: failed offline envelope is consumed and never retried automatically",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const p=lifecycle.propose({videoIds:[V1]},1000);
  code("R04P_OFFLINE_RESPONSE_ENVELOPE",()=>
    lifecycle.inspectSyntheticBodies(p.ticket,[],1000));
  code("R04P_OFFLINE_UNKNOWN_OR_REPLAYED_TICKET",()=>
    lifecycle.inspectSyntheticBodies(p.ticket,[videoPage([video()])],1000));
  assert.equal(lifecycle.status(1000).plannedQuotaUnits,1);
});

test("R04P-10: safe simulated provider error taxonomy cannot inject body/logs",()=>{
  const valid=[
    [403,"quotaExceeded","QUOTA_EXCEEDED_CANDIDATE"],
    [403,"forbidden","FORBIDDEN_CANDIDATE"],
    [404,"notFound","NOT_FOUND_CANDIDATE"],
    [429,"rateLimitExceeded","RATE_LIMITED_CANDIDATE"],
    [500,"serverError","TEMPORARY_FAILURE_CANDIDATE"],
    [503,"serverError","TEMPORARY_FAILURE_CANDIDATE"],
  ];
  const lifecycle=createLockedMetadataLifecycle();
  for(const [http,reason,expected] of valid){
    const p=lifecycle.propose({videoIds:[V1]},1000);
    const result=lifecycle.simulateFailure(p.ticket,{statusCode:http,reason},1000);
    assert.equal(result.status,expected);
    assert.equal(result.sourceAuthenticated,false);
    assert.equal(result.consumerPublicationAuthorized,false);
    assert.equal(result.autoRetry,false);
    assert.deepEqual(result.records,[]);
    code("R04P_OFFLINE_UNKNOWN_OR_REPLAYED_TICKET",()=>
      lifecycle.simulateFailure(p.ticket,{statusCode:http,reason},1000));
  }
  const blocked=lifecycle.propose({videoIds:[V1]},1000);
  assert.equal(blocked.status,"OFFLINE_PLAN_BUDGET_BLOCKED");
});

test("R04P-11: reject raw body and unexpected diagnostic/credential fields",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  for(const diagnostic of [
    {statusCode:403,reason:"quotaExceeded",body:"raw forbidden"},
    {statusCode:403,reason:"quotaExceeded",apiKey:"secret"},
    {statusCode:200,reason:"success"},
    {statusCode:403,reason:"someRandomProviderString"},
  ]){
    const p=lifecycle.propose({videoIds:[V1]},1000);
    assert.throws(()=>lifecycle.simulateFailure(p.ticket,diagnostic,1000),
      /R04P_OFFLINE_/);
    code("R04P_OFFLINE_UNKNOWN_OR_REPLAYED_TICKET",()=>
      lifecycle.simulateFailure(p.ticket,{statusCode:429,reason:"rateLimitExceeded"},1000));
  }
});

test("R04P-12: cached shape expires at 15 min even if repeatedly read",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const p=lifecycle.propose({videoIds:[V1]},1000);
  lifecycle.inspectSyntheticBodies(p.ticket,[videoPage([video()])],1000);
  assert.equal(lifecycle.readOfflineCache("VIDEO:"+V1,1010)?.canonicalId,V1);
  assert.equal(lifecycle.readOfflineCache("VIDEO:"+V1,1000+15*60*1000),null);
  assert.equal(lifecycle.readOfflineCache("VIDEO:"+V1,1000+15*60*1000+1),null);
  assert.equal(lifecycle.status(1000+15*60*1000+1).actualProviderRequests,0);
});

test("R04P-13: closing lifecycle clears all data and cannot reopen",()=>{
  const lifecycle=createLockedMetadataLifecycle();
  const p=lifecycle.propose({videoIds:[V1]},1000);
  lifecycle.inspectSyntheticBodies(p.ticket,[videoPage([video()])],1000);
  const end=lifecycle.close();
  assert.equal(end.status,"OFFLINE_COORDINATOR_CLOSED");
  assert.equal(end.consumerPublicationAuthorized,false);
  code("R04P_OFFLINE_CLOSED",()=>lifecycle.status(1001));
  code("R04P_OFFLINE_CLOSED",()=>lifecycle.propose({videoIds:[V1]},1001));
  code("R04P_OFFLINE_CLOSED",()=>lifecycle.readOfflineCache("VIDEO:"+V1,1001));
});
