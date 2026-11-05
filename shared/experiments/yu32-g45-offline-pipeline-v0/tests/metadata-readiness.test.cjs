"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {
  MAX_TARGETS,MAX_BODY_BYTES,CACHE_TTL_MS,CACHE_LIMIT,
  planOfflineMetadataRead,decodeOfflineMetadataShape,createOfflineMetadataCache
}=require("../src/metadata-readiness.cjs");
const gates=require("../../../contracts/yu32-youtube-readiness-v0/policy-gates.json");

const V1="Ab0_-123xyz",V2="Bb0_-123xyz";
const C1="UC"+"A".repeat(22),C2="UC"+"B".repeat(22);
const H1="@somecreator";
const vitem=(id=V1,title="공식 영상 제목 후보",thumbnail="https://i.ytimg.com/vi/"+id+"/hqdefault.jpg")=>({
  kind:"youtube#video",id,
  snippet:{title,channelId:C1,thumbnails:{high:{url:thumbnail}}}
});
const citem=(id=C1,title="공식 채널 이름 후보",thumbnail="https://yt3.googleusercontent.com/a")=>({
  kind:"youtube#channel",id,snippet:{title,thumbnails:{high:{url:thumbnail}}}
});
function page(kind,items){
  return JSON.stringify({kind,items,pageInfo:{
    totalResults:items.length,resultsPerPage:items.length}});
}
const videos=(items)=>page("youtube#videoListResponse",items);
const channels=(items)=>page("youtube#channelListResponse",items);
function denied(callback,reason){
  assert.throws(callback,err=>err&&
    typeof err.code==="string"&&err.code.startsWith("R04O_METADATA_")&&
    (!reason||err.code==="R04O_METADATA_"+reason));
}

test("R04O-01: immutable POLICY_HOLD and no executable network transport",()=>{
  assert.equal(gates.status,"POLICY_HOLD");
  assert.equal(gates.liveCallsAuthorized,false);
  assert.equal(gates.derivedSentimentAuthorized,false);
  assert.equal(gates.externalDataCollected,false);
  assert.equal(gates.verifiedCount,0);
  const modulePath=path.join(__dirname,"..","src","metadata-readiness.cjs");
  const code=fs.readFileSync(modulePath,"utf8");
  assert.doesNotMatch(code,/\brequire\s*\(\s*["'](?:node:)?(?:https?|net|tls|dns)["']\s*\)/);
  assert.doesNotMatch(code,/\b(?:fetch|XMLHttpRequest|https\.request|http\.request)\s*\(/);
  const plan=planOfflineMetadataRead({videoIds:[V1]});
  assert.equal(plan.networkEnabled,false);
  assert.equal(plan.credentialsAccepted,false);
  assert.equal(plan.providerRequestsMade,0);
  assert.equal(plan.quotaUnitsConsumed,0);
  assert.equal(plan.sourceAuthenticated,false);
  assert.equal(plan.consumerPublicationAuthorized,false);
  assert.equal(typeof plan.send,"undefined");
});

test("R04O-02: explicit bounded batch plan for video, channel ID and @handle",()=>{
  const p=planOfflineMetadataRead({videoIds:[V1],channelIds:[C1],handles:[H1]});
  assert.equal(p.totalTargets,3);
  assert.equal(p.plannedQuotaUnits,3);
  assert.equal(p.candidates.length,3);
  assert.equal(p.candidates[0].method,"videos.list");
  assert.equal(p.candidates[0].query.id,V1);
  assert.equal(p.candidates[0].query.part,"snippet");
  assert.match(p.candidates[0].query.fields,/snippet\(title,channelId,thumbnails\)/);
  assert.equal(p.candidates[1].method,"channels.list");
  assert.equal(p.candidates[1].query.id,C1);
  assert.equal(p.candidates[2].query.forHandle,H1);
  assert.equal(p.candidates[2].query.id,undefined);
  assert(p.candidates.every(x=>x.host==="www.googleapis.com"&&
    x.networkEnabled===false&&x.credentialsAttached===false&&
    x.expectedQuotaUnits===1&&x.automaticRetries===0));
  assert(Object.isFrozen(p));
  assert(Object.isFrozen(p.candidates));
  assert(Object.isFrozen(p.candidates[0].query));
});

test("R04O-03: same-kind ID batching reduces proposed quota units",()=>{
  const p=planOfflineMetadataRead({videoIds:[V1,V2],channelIds:[C1]});
  assert.equal(p.candidates.length,2);
  assert.equal(p.plannedQuotaUnits,2);
  assert.equal(p.candidates[0].query.id,V1+","+V2);
  assert.equal(p.candidates[0].requestedKeys.length,2);
  assert.equal(MAX_TARGETS,3);
});

test("R04O-04: invalid IDs, duplicates, unsupported authority and getter options fail closed",()=>{
  const invalid=[
    {},{videoIds:[]},{videoIds:["../../evil"]},{videoIds:["BAD"]},
    {channelIds:["not-a-channel"]},{handles:["somecreator"]},
    {handles:["@a"]},{handles:[H1,"@somecreator"]},
    {videoIds:[V1,V1]},{videoIds:[V1,V2,V1]},
    {videoIds:[V1,V2],handles:[H1],channelIds:[C1]},
    {videoIds:[V1],allowRead:true},
    {videoIds:[V1],apiKey:"secret"},
    {videoIds:[V1],url:"https://evil.example"},
    {videoIds:[V1],networkEnabled:true}
  ];
  for(const value of invalid)denied(()=>planOfflineMetadataRead(value));
  let read=false;
  const options={};
  Object.defineProperty(options,"videoIds",{enumerable:true,get(){read=true;return [V1];}});
  denied(()=>planOfflineMetadataRead(options),"UNEXPECTED_OPTIONS");
  assert.equal(read,false);
  const arr=[];
  Object.defineProperty(arr,"0",{enumerable:true,get(){read=true;return V1;}});
  arr.length=1;
  denied(()=>planOfflineMetadataRead({videoIds:arr}),"INVALID_TARGET");
  assert.equal(read,false);
});

test("R04O-05: parse a fixed video snippet into untrusted, bounded UI-ready CANDIDATE",()=>{
  const plan=planOfflineMetadataRead({videoIds:[V1]});
  const result=decodeOfflineMetadataShape(plan,0,videos([vitem()]),1000);
  assert.equal(result.status,"SHAPE_VALIDATED_UNAUTHENTICATED");
  assert.equal(result.sourceAuthenticated,false);
  assert.equal(result.consumerPublicationAuthorized,false);
  assert.equal(result.providerRequestsMade,0);
  assert.deepEqual(result.unmatchedKeys,[]);
  assert.deepEqual(result.records,[{
    lookupKey:"VIDEO:"+V1,kind:"VIDEO",canonicalId:V1,
    handleResolutionCandidate:null,title:"공식 영상 제목 후보",
    thumbnailUrl:"https://i.ytimg.com/vi/"+V1+"/hqdefault.jpg",
    observedAt:1000,sourceAuthenticated:false,consumerReady:false
  }]);
  assert.equal(result.records[0].description,undefined);
  assert.equal(result.records[0].channelId,undefined); // no inferred channel edge
  assert(Object.isFrozen(result.records[0]));
});

test("R04O-06: handle mapping remains an unauthenticated candidate",()=>{
  const plan=planOfflineMetadataRead({handles:["@SomeCreator"]});
  assert.equal(plan.candidates[0].query.forHandle,H1);
  const result=decodeOfflineMetadataShape(plan,0,channels([citem(C2)]),1234);
  assert.equal(result.records[0].lookupKey,"CHANNEL_HANDLE:"+H1);
  assert.equal(result.records[0].canonicalId,C2);
  assert.equal(result.records[0].handleResolutionCandidate,C2);
  assert.equal(result.records[0].sourceAuthenticated,false);
  assert.equal(result.records[0].consumerReady,false);
});

test("R04O-07: exact channel-ID scope and safe thumbnail hosts",()=>{
  const plan=planOfflineMetadataRead({channelIds:[C1]});
  const good=decodeOfflineMetadataShape(plan,0,channels([citem()]),500);
  assert.equal(good.records[0].thumbnailUrl,"https://yt3.googleusercontent.com/a");
  const hostile=[
    "http://yt3.googleusercontent.com/a",
    "https://yt3.googleusercontent.com.evil.example/a",
    "https://example.com/avatar",
    "javascript:alert(1)",
    "https://user:pass@yt3.googleusercontent.com/a",
    "https://yt3.ggpht.com:8443/a"
  ];
  for(const url of hostile){
    const result=decodeOfflineMetadataShape(plan,0,channels([citem(C1,"Channel",url)]),501);
    assert.equal(result.records[0].thumbnailUrl,null);
    assert.equal(result.records[0].title,"Channel");
  }
});

test("R04O-08: missing items produce UNKNOWN/UNAUTHENTICATED, never provider NOT_FOUND",()=>{
  const plan=planOfflineMetadataRead({videoIds:[V1,V2]});
  const partial=decodeOfflineMetadataShape(plan,0,videos([vitem(V2)]),3000);
  assert.deepEqual(partial.unmatchedKeys,["VIDEO:"+V1]);
  assert.equal(partial.records.length,1);
  const empty=decodeOfflineMetadataShape(plan,0,videos([]),3000);
  assert.equal(empty.status,"EMPTY_UNAUTHENTICATED");
  assert.deepEqual(empty.unmatchedKeys,["VIDEO:"+V1,"VIDEO:"+V2]);
  assert.equal(empty.consumerPublicationAuthorized,false);
});

test("R04O-09: wrong IDs, duplicate rows, malformed page, missing title fail closed",()=>{
  const plan=planOfflineMetadataRead({videoIds:[V1,V2]});
  for(const bad of [
    videos([vitem("ZZ0_-123xyz")]),
    videos([vitem(),vitem()]),
    videos([vitem(V1,"")]),
    videos([vitem(V1,"bad\nname")]),
    videos([vitem(V1,"ok")]).replace("youtube#videoListResponse","youtube#channelListResponse"),
    JSON.stringify({kind:"youtube#videoListResponse",items:[vitem()],
      pageInfo:{totalResults:0,resultsPerPage:1}}),
    JSON.stringify({items:[{id:V1,snippet:{title:"OK"}}],
      pageInfo:{totalResults:1,resultsPerPage:1}}),
    channels([citem()])
  ])denied(()=>decodeOfflineMetadataShape(plan,0,bad,3000));
  denied(()=>decodeOfflineMetadataShape(plan,99,videos([]),3000),"UNTRUSTED_PLAN");
  denied(()=>decodeOfflineMetadataShape({candidates:plan.candidates},0,videos([]),3000),"UNTRUSTED_PLAN");
});

test("R04O-10: reject oversized, malformed or invalid UTF-8 provider-shaped body",()=>{
  const plan=planOfflineMetadataRead({videoIds:[V1]});
  denied(()=>decodeOfflineMetadataShape(plan,0,"{ ",3000),"INVALID_JSON_OR_UTF8");
  denied(()=>decodeOfflineMetadataShape(plan,0,Buffer.from([0xff,0xfe]),3000),"INVALID_JSON_OR_UTF8");
  denied(()=>decodeOfflineMetadataShape(plan,0,"x".repeat(MAX_BODY_BYTES+1),3000),"BODY_LIMIT");
  denied(()=>decodeOfflineMetadataShape(plan,0,{items:[vitem()]},3000),"INVALID_BODY");
});

test("R04O-11: cache remains in-process, 15-minute TTL, no read extension",()=>{
  const plan=planOfflineMetadataRead({videoIds:[V1]});
  const shaped=decodeOfflineMetadataShape(plan,0,videos([vitem()]),1000);
  const cache=createOfflineMetadataCache(2);
  assert.equal(CACHE_TTL_MS,900000);
  assert.equal(CACHE_LIMIT,64);
  assert.equal(cache.put(shaped.records[0],1000),true);
  assert.equal(cache.get("VIDEO:"+V1,1001),shaped.records[0]);
  assert.equal(cache.get("VIDEO:"+V1,1000+CACHE_TTL_MS),null);
  assert.equal(cache.size,0);
  assert.equal(cache.put(shaped.records[0],1000+CACHE_TTL_MS),false);
  assert.equal(cache.put({...shaped.records[0],consumerReady:true},1001),false);
  assert.equal(cache.put({lookupKey:"VIDEO:"+V1,sourceAuthenticated:true},1001),false);
  cache.clear();
  assert.equal(cache.size,0);
  denied(()=>createOfflineMetadataCache(999),"INVALID_CACHE_LIMIT");
});

test("R04O-12: cache bounded FIFO with no raw provider payload or credential storage",()=>{
  const plan=planOfflineMetadataRead({videoIds:[V1,V2],channelIds:[C1]});
  const v=decodeOfflineMetadataShape(plan,0,videos([vitem(V1),vitem(V2)]),1000).records;
  const c=decodeOfflineMetadataShape(plan,1,channels([citem(C1)]),1000).records;
  const cache=createOfflineMetadataCache(2);
  for(const row of [v[0],v[1],c[0]])assert.equal(cache.put(row,1000),true);
  assert.equal(cache.size,2);
  assert.equal(cache.get("VIDEO:"+V1,1000),null);
  assert.equal(cache.get("VIDEO:"+V2,1000),v[1]);
  assert.equal(cache.get("CHANNEL:"+C1,1000),c[0]);
  assert.equal(Object.keys(c[0]).includes("apiKey"),false);
  assert.equal(Object.keys(c[0]).includes("rawBody"),false);
  assert.equal(Object.keys(c[0]).includes("description"),false);
});
