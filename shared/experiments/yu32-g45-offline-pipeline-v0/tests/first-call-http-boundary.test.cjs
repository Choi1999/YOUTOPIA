"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"src","first-call-http-boundary.cjs"),"utf8");
const {MAX_BYTES,planHttpFirstPage,decodeSyntheticHttpEnvelope,executeLiveFirstCall}
  =require("../src/first-call-http-boundary.cjs");
const ID="Ab0_-123xyz",OTHER="Zb0_-123xyz";
function fixture(mode="partial"){
  const body=fs.readFileSync(path.join(root,"fixtures",mode+".json"),"utf8");
  return {statusCode:200,contentType:"application/json",body};
}
const blocked=f=>assert.throws(f,/G45_L1_BLOCKED/);
test("G45-L101: a single fixed HTTPS GET is descriptive only",()=>{
  const p=planHttpFirstPage({videoIds:[ID]});
  assert.equal(p.status,"OFFLINE_HTTP_REQUEST_PLAN");
  assert.equal(p.sourceType,"STATIC_FIXTURE");
  assert.equal(p.providerRequestsMade,0);
  assert.equal(p.maxPlannedRequests,1);
  const req=p.candidates[0];
  assert.equal(req.protocol,"https:");
  assert.equal(req.hostname,"www.googleapis.com");
  assert.equal(req.port,443);
  assert.equal(req.method,"GET");
  assert.equal(req.pathname,"/youtube/v3/commentThreads");
  assert.equal(req.networkEnabled,false);
  assert.equal(req.credentialAttached,false);
});
test("G45-L102: official minimal query contains no credentials or reply enumeration",()=>{
  const q=new URLSearchParams(planHttpFirstPage({videoIds:[ID]}).candidates[0].query);
  assert.deepEqual([...q.keys()],["part","videoId","maxResults","order","textFormat"]);
  assert.equal(q.get("part"),"snippet");
  assert.equal(q.get("videoId"),ID);
  assert.equal(q.get("maxResults"),"100");
  assert.equal(q.get("order"),"time");
  assert.equal(q.get("textFormat"),"plainText");
  for(const key of ["key","apiKey","access_token","pageToken","replies"])
    assert.equal(q.has(key),false);
});
test("G45-L103: three video descriptors, one page each and no retries",()=>{
  const p=planHttpFirstPage({videoIds:[ID,OTHER,"Xb0_-123xyz"]});
  assert.equal(p.maxPlannedRequests,3);
  assert.equal(p.candidates.reduce((n,d)=>n+d.plannedQuotaUnits,0),3);
  for(const d of p.candidates) {
    assert.equal(d.pages,1);
    assert.equal(d.redirectEnabled,false);
    assert.equal(d.retryEnabled,false);
    assert.equal(d.authentication,"UNVERIFIED_YOUTUBE_SPECIFIC");
  }
});
test("G45-L104: malformed and duplicate video ids rejected",()=>{
  for(const ids of [[],[ID,ID],["@handle"],["invalid"],
    [ID,OTHER,"Xb0_-123xyz","Yb0_-123xyz"]])
    assert.throws(()=>planHttpFirstPage({videoIds:ids}));
});
test("G45-L105: cap maxResults to 1..100",()=>{
  assert.equal(new URLSearchParams(planHttpFirstPage({
    videoIds:[ID],maxResults:1
  }).candidates[0].query).get("maxResults"),"1");
  for(const maxResults of [0,101,-1,1.2,"100",Infinity])
    assert.throws(()=>planHttpFirstPage({videoIds:[ID],maxResults}));
});
test("G45-L106: caller-supplied approval, key, URL or retry flag not accepted",()=>{
  for(const [k,value] of Object.entries({
    approved:true,apiKey:"fake",requestUrl:"https://example.invalid",
    attemptLive:true,retry:2,includeReplies:true,pageToken:"x"
  })) assert.throws(()=>planHttpFirstPage({videoIds:[ID],[k]:value}));
});
test("G45-L107: no run-live capability exists even with approval-shaped flags",()=>{
  blocked(()=>executeLiveFirstCall({approved:true,admin:true}));
  blocked(()=>executeLiveFirstCall());
});
test("G45-L108: partial response is parsed offline and text is redacted",()=>{
  const r=decodeSyntheticHttpEnvelope(fixture("partial"),ID);
  assert.equal(r.status,"PARTIAL");
  assert.equal(r.sourceType,"STATIC_FIXTURE");
  assert.equal(r.isSynthetic,true);
  assert.equal(r.providerRequestsMade,0);
  assert.equal(r.partialPage,true);
  assert.equal(r.sample.rawCount,5);
  assert.equal(r.sample.eligibleCount,4);
  assert.equal(r.sample.classifiedCount,3);
  assert.equal(r.rawTextSaved,false);
  const text=JSON.stringify(r);
  for(const secret of ["SYNTHETIC_USER","편집이 정말 좋아요","SYNTHETIC_NEXT_PAGE",
    "authorProfileImageUrl","textOriginal"])
    assert.equal(text.includes(secret),false,secret);
});
test("G45-L109: ready case is always marked synthetic, not operational READY",()=>{
  const r=decodeSyntheticHttpEnvelope(fixture("ready"),ID);
  assert.equal(r.status,"READY");
  assert.equal(r.sourceType,"STATIC_FIXTURE");
  assert.equal(r.model,"SYNTHETIC_RULES_UNVALIDATED");
  assert.equal(r.providerRequestsMade,0);
});
test("G45-L110: empty successful result does not claim zero sentiment",()=>{
  const r=decodeSyntheticHttpEnvelope(fixture("empty"),ID);
  assert.equal(r.status,"NO_DATA");
  assert.equal(r.sentiment,null);
  assert.equal(r.sample,null);
  assert.equal(r.providerRequestsMade,0);
});
test("G45-L111: provider-shaped unmarked body is rejected",()=>{
  const p=JSON.parse(fixture().body);
  delete p.fixtureId;
  blocked(()=>decodeSyntheticHttpEnvelope({
    statusCode:200,contentType:"application/json",body:JSON.stringify(p)
  },ID));
});
test("G45-L112: real/unknown source flags and wrong video cannot be elevated",()=>{
  for(const change of [
    p=>p.sourceType="APPROVED_PROVIDER",
    p=>p.isSynthetic=false,
    p=>p.providerRequestsMade=1,
    p=>p.apiKeyUsed=true,
    p=>p.videoId=OTHER
  ]){
    const p=JSON.parse(fixture().body);change(p);
    blocked(()=>decodeSyntheticHttpEnvelope({
      statusCode:200,contentType:"application/json",body:JSON.stringify(p)
    },ID));
  }
});
test("G45-L113: response content type and status checked before parsing",()=>{
  blocked(()=>decodeSyntheticHttpEnvelope({...fixture(),contentType:"text/html"},ID));
  blocked(()=>decodeSyntheticHttpEnvelope({...fixture(),statusCode:302},ID));
  blocked(()=>decodeSyntheticHttpEnvelope({...fixture(),statusCode:206},ID));
});
test("G45-L114: body byte limit, empty body and bad JSON are blocked",()=>{
  blocked(()=>decodeSyntheticHttpEnvelope({...fixture(),body:""},ID));
  blocked(()=>decodeSyntheticHttpEnvelope({...fixture(),body:"{"},ID));
  blocked(()=>decodeSyntheticHttpEnvelope({...fixture(),body:"x".repeat(MAX_BYTES+1)},ID));
});
test("G45-L115: errors never masquerade as zero comments or READY",()=>{
  const r=decodeSyntheticHttpEnvelope({statusCode:403,reason:"commentsDisabled"},ID);
  assert.equal(r.status,"COMMENTS_DISABLED");
  assert.equal(r.sample,null);
  assert.equal(r.sentiment,null);
  assert.equal(r.providerRequestsMade,0);
});
test("G45-L116: quota, forbidden and missing video produce distinct diagnostics",()=>{
  const out=[
    decodeSyntheticHttpEnvelope({statusCode:403,reason:"quotaExceeded"},ID),
    decodeSyntheticHttpEnvelope({statusCode:403,reason:"forbidden"},ID),
    decodeSyntheticHttpEnvelope({statusCode:404,reason:"videoNotFound"},ID)
  ];
  assert.deepEqual(out.map(x=>x.errorCode),
    ["QUOTA_OR_RATE_LIMIT","AUTHORIZATION_FAILED","NOT_FOUND"]);
  assert.deepEqual(out.map(x=>x.status),["ERROR","POLICY_BLOCKED","ERROR"]);
});
test("G45-L117: raw HTTP error body and unknown codes are not logged or accepted",()=>{
  blocked(()=>decodeSyntheticHttpEnvelope({statusCode:403,
    reason:"forbidden",body:"sensitive provider error"},ID));
  blocked(()=>decodeSyntheticHttpEnvelope({statusCode:500,
    reason:"newProviderError"},ID));
  blocked(()=>decodeSyntheticHttpEnvelope({statusCode:302,reason:"unknown"},ID));
});
test("G45-L118: extra headers/options or malformed targets are rejected",()=>{
  blocked(()=>decodeSyntheticHttpEnvelope({...fixture(),location:"https://evil.invalid"},ID));
  blocked(()=>decodeSyntheticHttpEnvelope(fixture(),"too-short"));
  blocked(()=>decodeSyntheticHttpEnvelope({...fixture(),reason:"approved"},ID));
});
test("G45-L119: strictly offline code exposes no actual network or credential reader",()=>{
  assert.doesNotMatch(source,/require\s*\(\s*["']node:https|require\s*\(\s*["']https|fetch\s*\(|XMLHttpRequest|axios|process\.env/);
  assert.doesNotMatch(source,/fs\.write|fs\.unlink|child_process|spawnSync|execSync/);
  const api=require("../src/first-call-http-boundary.cjs");
  assert.deepEqual(Object.keys(api).sort(),[
    "MAX_BYTES","planHttpFirstPage","decodeSyntheticHttpEnvelope",
    "executeLiveFirstCall"
  ].sort());
});
test("G45-L120: policy gates are still zero-verified and forbid real reads",()=>{
  const p=require("../../../contracts/yu32-youtube-readiness-v0/policy-gates.json");
  assert.equal(p.status,"POLICY_HOLD");
  assert.equal(p.verifiedCount,0);
  assert.equal(p.liveCallsAuthorized,false);
  assert.equal(p.derivedSentimentAuthorized,false);
  assert.equal(p.externalDataCollected,false);
});

test("G45-L121: spoofed synthetic labels cannot launder arbitrary comment text",()=>{
  const v=JSON.parse(fixture("partial").body);
  v.response.items[0].snippet.topLevelComment.snippet.textOriginal=
    "Unreviewed real comment presented with fake fixture flags";
  assert.equal(v.isSynthetic,true);
  assert.equal(v.sourceType,"STATIC_FIXTURE");
  blocked(()=>decodeSyntheticHttpEnvelope({
    statusCode:200,contentType:"application/json",body:JSON.stringify(v)
  },ID));
});
test("G45-L122: modified author/metadata cannot be hidden inside fixture wrapper",()=>{
  const v=JSON.parse(fixture("ready").body);
  v.response.items[0].snippet.topLevelComment.snippet.authorDisplayName="Unapproved author";
  blocked(()=>decodeSyntheticHttpEnvelope({
    statusCode:200,contentType:"application/json",body:JSON.stringify(v)
  },ID));
});
test("G45-L123: statusCode accessor is rejected BEFORE executing getter",()=>{
  let executed=false;
  const envelope={};
  Object.defineProperty(envelope,"statusCode",{
    enumerable:true,get(){executed=true;return 200;}
  });
  blocked(()=>decodeSyntheticHttpEnvelope(envelope,ID));
  assert.equal(executed,false);
});
test("G45-L124: successful response body accessor is rejected before execution",()=>{
  const envelope=fixture("partial");
  let executed=false;
  Object.defineProperty(envelope,"body",{
    enumerable:true,get(){executed=true;return "sensitive raw data";}
  });
  blocked(()=>decodeSyntheticHttpEnvelope(envelope,ID));
  assert.equal(executed,false);
});
