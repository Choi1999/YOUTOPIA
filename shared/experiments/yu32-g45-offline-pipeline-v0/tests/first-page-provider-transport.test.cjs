"use strict";
const {test,mock}=require("node:test");
const assert=require("node:assert/strict");
const https=require("node:https");
const fs=require("node:fs");
const path=require("node:path");
const {
  MAX_RESPONSE_BYTES,RELEASED_FOR_FIRST_REAL_CALL,
  planFirstPage,decodeFirstPageShape,executeApprovedFirstPage
}=require("../src/first-page-provider-transport.cjs");
const ID="Ab0_-123xyz";
const OTHER="Zb0_-123xyz";
function providerPage(){
  return {
    kind:"youtube#commentThreadListResponse",
    etag:"fake-provider-etag-PRIVATE",
    nextPageToken:"SENSITIVE_NEXT_PAGE_MARKER",
    pageInfo:{totalResults:2,resultsPerPage:2},
    items:[
      {kind:"youtube#commentThread",id:"thread-1",
        snippet:{videoId:ID,isPublic:true,totalReplyCount:4,
          topLevelComment:{kind:"youtube#comment",id:"comment-1",
            snippet:{videoId:ID,textDisplay:"정말 좋아요.",
              authorDisplayName:"FAKE_PRIVATE_AUTHOR",authorChannelId:{value:"SENSITIVE_ID"},
              authorProfileImageUrl:"https://private.example.invalid/avatar",
              likeCount:3,publishedAt:"2026-10-20T10:00:00Z"}}}},
      {kind:"youtube#commentThread",id:"thread-2",
        snippet:{videoId:ID,totalReplyCount:0,
          topLevelComment:{kind:"youtube#comment",id:"comment-2",
            snippet:{videoId:ID,textDisplay:"음질은 아쉬워요.",
              likeCount:0,publishedAt:"2026-10-21T10:00:00.123Z"}}}}
    ]
  };
}
const decode=(p=providerPage(),params={videoId:ID,maxResults:100})=>
  decodeFirstPageShape(JSON.stringify(p),params);

test("L7-01: one bounded official HTTPS GET plan without auth or execution",()=>{
  const p=planFirstPage({videoId:ID});
  assert.equal(p.hostname,"www.googleapis.com");
  assert.equal(p.pathname,"/youtube/v3/commentThreads");
  assert.equal(p.method,"GET");
  assert.equal(p.protocol,"https:");
  assert.equal(p.maxResults,100);
  assert.equal(p.pages,1);
  assert.equal(p.automaticRetries,0);
  assert.equal(p.expectedQuotaUnits,1);
  assert.equal(p.networkEnabled,false);
  assert.equal(p.credentialAttached,false);
  assert.deepEqual([...new URLSearchParams(p.query).keys()],
    ["part","videoId","maxResults","order","textFormat"]);
  assert.equal(new URLSearchParams(p.query).get("textFormat"),"plainText");
});
test("L7-02: caller cannot change URL, auth, pagination or retry scope",()=>{
  for(const [key,value] of Object.entries({
    apiKey:"fake",url:"https://evil.invalid",approved:true,
    pageToken:"next",includeReplies:true,automaticRetries:1,videoIds:[ID]
  }))assert.throws(()=>planFirstPage({videoId:ID,[key]:value}),/G45_L7_/);
  for(const bad of ["@handle","https://youtu.be/x","short",ID+"x"])
    assert.throws(()=>planFirstPage({videoId:bad}));
  for(const limit of [0,101,"100",NaN,1.5,-1])
    assert.throws(()=>planFirstPage({videoId:ID,maxResults:limit}));
  assert.equal(planFirstPage({videoId:ID,maxResults:1}).maxResults,1);
});
test("L7-03: input accessors rejected before execution",()=>{
  let called=false;
  const input={};
  Object.defineProperty(input,"videoId",{enumerable:true,get(){called=true;return ID;}});
  assert.throws(()=>planFirstPage(input),/UNEXPECTED_INPUT/);
  assert.equal(called,false);
});
test("L7-04: real provider JSON shape parsed without author identities or source authentication",()=>{
  const r=decode();
  assert.equal(r.status,"SHAPE_VALIDATED_UNAUTHENTICATED");
  assert.equal(r.sourceAuthenticated,false);
  assert.equal(r.videoId,ID);
  assert.equal(r.sampleCount,2);
  assert.equal(r.sampleIsPopulation,false);
  assert.equal(r.nextPageAvailable,true);
  assert.equal(r.repliesComplete,false);
  assert.equal(r.derivedSentiment,null);
  assert.equal(r.rawTextPersisted,false);
  assert.equal(r.comments[0].text,"정말 좋아요.");
  assert.equal(r.comments[0].likeCount,3);
  assert.ok(Object.isFrozen(r.comments));
  const output=JSON.stringify(r);
  for(const hidden of ["FAKE_PRIVATE_AUTHOR","SENSITIVE_ID","private.example",
    "SENSITIVE_NEXT_PAGE_MARKER","fake-provider-etag-PRIVATE","authorProfileImageUrl"])
    assert.equal(output.includes(hidden),false,hidden);
});
test("L7-05: empty page is not a population-level no-comments claim",()=>{
  const p=providerPage();p.items=[];delete p.nextPageToken;
  p.pageInfo={totalResults:0,resultsPerPage:0};
  const r=decode(p);
  assert.equal(r.status,"EMPTY_PAGE_UNAUTHENTICATED");
  assert.equal(r.sampleCount,0);
  assert.equal(r.sampleIsPopulation,false);
  assert.equal(r.derivedSentiment,null);
});
test("L7-06: wrong VIDEO, duplicates and nonpublic thread rejected",()=>{
  let p=providerPage();p.items[1].snippet.videoId=OTHER;
  assert.throws(()=>decode(p),/WRONG_VIDEO_SCOPE/);
  p=providerPage();p.items[1].id=p.items[0].id;
  assert.throws(()=>decode(p),/DUPLICATE_THREAD/);
  p=providerPage();p.items[1].snippet.topLevelComment.id=p.items[0].snippet.topLevelComment.id;
  assert.throws(()=>decode(p),/DUPLICATE_COMMENT/);
  p=providerPage();p.items[0].snippet.isPublic=false;
  assert.throws(()=>decode(p),/WRONG_VIDEO_SCOPE/);
});
test("L7-07: body, timestamp and page count are strictly bounded",()=>{
  assert.throws(()=>decodeFirstPageShape("x".repeat(MAX_RESPONSE_BYTES+1),{videoId:ID}),/BODY_LIMIT/);
  assert.throws(()=>decodeFirstPageShape("{",{videoId:ID}),/BODY_LIMIT|INVALID_JSON/);
  let p=providerPage();p.pageInfo.resultsPerPage=99;
  assert.throws(()=>decode(p),/PAGE_COUNT_MISMATCH/);
  p=providerPage();p.items[0].snippet.topLevelComment.snippet.publishedAt="2026-02-30T00:00:00Z";
  assert.throws(()=>decode(p),/BAD_TIMESTAMP/);
  p=providerPage();p.items[0].snippet.topLevelComment.snippet.textDisplay="x".repeat(10001);
  assert.throws(()=>decode(p),/INVALID_COMMENT_TEXT/);
});
test("L7-08: unrequested more results rejected even for a response shaped as YouTube",()=>{
  assert.throws(()=>decode(providerPage(),{videoId:ID,maxResults:1}),/INVALID_PAGE/);
  const p=providerPage();p.nextPageToken=123;
  assert.throws(()=>decode(p),/INVALID_PAGE_MARKER/);
});
test("L7-09: hard policy lock means no HTTPS request and no credential reader",async()=>{
  assert.equal(RELEASED_FOR_FIRST_REAL_CALL,false);
  let reads=0,calls=0;
  const spy=mock.method(https,"request",()=>{calls++;throw Error("NETWORK_SHOULD_NOT_RUN");});
  try{
    await assert.rejects(executeApprovedFirstPage({videoId:ID},()=>{
      reads++;return "not-a-real-credential";
    }),/G45_L7_POLICY_HOLD/);
    await assert.rejects(executeApprovedFirstPage({
      approved:true,admin:true,videoId:ID,apiKey:"fake"
    },()=>{reads++;throw Error("SECRET_SHOULD_NOT_BE_READ")}),/G45_L7_POLICY_HOLD/);
    assert.equal(reads,0);
    assert.equal(calls,0);
  }finally{spy.mock.restore();}
});
test("L7-10: malicious option getter cannot run while policy held",async()=>{
  let touched=false;
  const input={};
  Object.defineProperty(input,"videoId",{
    enumerable:true,get(){touched=true;throw Error("getter executed");}
  });
  await assert.rejects(executeApprovedFirstPage(input,()=>{touched=true;}),/G45_L7_POLICY_HOLD/);
  assert.equal(touched,false);
});
test("L7-11: old offline synthetic analyzer still rejects any actual provider payload",()=>{
  const {executeLiveFirstCall,decodeSyntheticHttpEnvelope}=
    require("../src/first-call-http-boundary.cjs");
  assert.throws(()=>executeLiveFirstCall(),/LIVE_HTTP_NOT_IMPLEMENTED_POLICY_HOLD/);
  assert.throws(()=>decodeSyntheticHttpEnvelope({
    statusCode:200,contentType:"application/json",
    body:JSON.stringify(providerPage())
  },ID),/G45_L1_BLOCKED/);
});
test("L7-12: canonical policy still denies real API and derived analytics",()=>{
  const policy=require("../../../contracts/yu32-youtube-readiness-v0/policy-gates.json");
  assert.equal(policy.status,"POLICY_HOLD");
  assert.equal(policy.verifiedCount,0);
  assert.equal(policy.liveCallsAuthorized,false);
  assert.equal(policy.derivedSentimentAuthorized,false);
  assert.equal(policy.externalDataCollected,false);
  const code=fs.readFileSync(path.resolve(__dirname,"../src/first-page-provider-transport.cjs"),"utf8");
  assert.match(code,/RELEASED_FOR_FIRST_REAL_CALL=false/);
  assert.doesNotMatch(code,/console\.log|process\.env|fs\.writeFile|res\.setHeader/);
});
