"use strict";
/**
 * G45-L7: REAL YouTube API response-shape decoder and bounded HTTPS transport,
 * with an immutable compile-time RELEASE LOCK. Neither this module nor any
 * caller flag can send a provider request while POLICY_HOLD is active.
 *
 * Do not import this module into the synthetic analyzer. The latter accepts
 * only three canonical repo-controlled fixtures. This module is for the
 * separately approved first actual read, not for derived sentiment metrics.
 */
const https=require("node:https");
const gates=require("../../../contracts/yu32-youtube-readiness-v0/policy-gates.json");

const RELEASED_FOR_FIRST_REAL_CALL=false; // MUST be changed only in a separately reviewed, approved PR
const MAX_RESPONSE_BYTES=512*1024;
const MAX_RESULTS=100;
const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const REQUIRED_EVIDENCE=Object.freeze([
  "Y45-E01","Y45-E02","Y45-E03","Y45-E04","Y45-E05",
  "Y45-E07","Y45-E08","Y45-E11"
]);
const ALLOWED_INPUT=new Set(["videoId","maxResults"]);

function deny(code) {
  const e=new Error("G45_L7_"+code); // no raw API error, credential or URL
  e.code="G45_L7_"+code;
  throw e;
}
function isRecord(x) {
  return x!==null&&typeof x==="object"&&!Array.isArray(x)&&
    (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
}
function planFirstPage(input) {
  if(!isRecord(input))deny("BAD_INPUT");
  const keys=Reflect.ownKeys(input);
  for(const key of keys) {
    if(typeof key!=="string"||!ALLOWED_INPUT.has(key)||
       !Object.hasOwn(Object.getOwnPropertyDescriptor(input,key),"value"))
      deny("UNEXPECTED_INPUT");
  }
  if(typeof input.videoId!=="string"||!VIDEO.test(input.videoId))deny("INVALID_VIDEO");
  const max=input.maxResults===undefined?MAX_RESULTS:input.maxResults;
  if(!Number.isInteger(max)||max<1||max>MAX_RESULTS)deny("INVALID_LIMIT");
  const query=new URLSearchParams([
    ["part","snippet"],["videoId",input.videoId],
    ["maxResults",String(max)],["order","time"],
    ["textFormat","plainText"]
  ]).toString();
  return Object.freeze({
    status:"NON_EXECUTING_READ_PLAN",method:"GET",protocol:"https:",
    hostname:"www.googleapis.com",pathname:"/youtube/v3/commentThreads",
    videoId:input.videoId,maxResults:max,query,
    expectedQuotaUnits:1,pages:1,automaticRetries:0,
    repliesEnumerated:false,networkEnabled:false,credentialAttached:false
  });
}
function asTimestamp(x) {
  if(typeof x!=="string"||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(x)||
    !Number.isFinite(Date.parse(x))||
    new Date(Date.parse(x)).toISOString().slice(0,19)!==x.slice(0,19))
    deny("BAD_TIMESTAMP");
  return x;
}
function asId(x) {
  if(typeof x!=="string"||x.length<1||x.length>200)deny("BAD_ID");
  return x;
}
function asUnsigned(x) {
  if(!Number.isSafeInteger(x)||x<0)deny("BAD_NUMBER");
  return x;
}
/**
 * Parse only a YouTube-shaped first page. This is PURE and cannot prove that
 * a string originated from Google. No write, persistence, network or NLP.
 * Text remains only in memory; caller must not log it or treat it as approved
 * for sentiment. The result deliberately contains no author/account/avatar,
 * raw provider body, etag, or nextPageToken.
 */
function decodeFirstPageShape(body,input) {
  const plan=planFirstPage(input);
  if(!(typeof body==="string"||Buffer.isBuffer(body)))deny("BAD_BODY");
  const bytes=Buffer.byteLength(body);
  if(bytes<2||bytes>MAX_RESPONSE_BYTES)deny("BODY_LIMIT");
  let page;
  try{page=JSON.parse(body.toString());}
  catch{deny("INVALID_JSON");}
  if(!isRecord(page)||page.kind!=="youtube#commentThreadListResponse"||
     !Array.isArray(page.items)||page.items.length>plan.maxResults||
     !isRecord(page.pageInfo))deny("INVALID_PAGE");
  asUnsigned(page.pageInfo.totalResults);
  if(asUnsigned(page.pageInfo.resultsPerPage)!==page.items.length)
    deny("PAGE_COUNT_MISMATCH");
  if(page.nextPageToken!==undefined&&
    (typeof page.nextPageToken!=="string"||!page.nextPageToken||
     page.nextPageToken.length>2000))deny("INVALID_PAGE_MARKER");
  const seenThread=new Set(),seenComment=new Set(),comments=[];
  for(const item of page.items) {
    if(!isRecord(item)||item.kind!=="youtube#commentThread")deny("INVALID_THREAD");
    const threadId=asId(item.id);
    if(seenThread.has(threadId))deny("DUPLICATE_THREAD");
    seenThread.add(threadId);
    const s=item.snippet;
    if(!isRecord(s)||s.videoId!==plan.videoId||s.isPublic===false)
      deny("WRONG_VIDEO_SCOPE");
    if(s.totalReplyCount!==undefined)asUnsigned(s.totalReplyCount);
    const top=s.topLevelComment;
    if(!isRecord(top)||top.kind!=="youtube#comment"||!isRecord(top.snippet))
      deny("INVALID_TOP_COMMENT");
    const id=asId(top.id),t=top.snippet;
    if(seenComment.has(id))deny("DUPLICATE_COMMENT");
    seenComment.add(id);
    if(t.videoId!==undefined&&t.videoId!==plan.videoId)
      deny("COMMENT_SCOPE_MISMATCH");
    if(typeof t.textDisplay!=="string"||!t.textDisplay||
       t.textDisplay.length>10000)deny("INVALID_COMMENT_TEXT");
    const publishedAt=asTimestamp(t.publishedAt);
    const likeCount=t.likeCount===undefined?null:asUnsigned(t.likeCount);
    comments.push(Object.freeze({threadId,commentId:id,
      text:t.textDisplay,publishedAt,likeCount}));
  }
  return Object.freeze({
    schema:"G45_L7_FIRST_PAGE_SHAPE_V01",
    status:comments.length?"SHAPE_VALIDATED_UNAUTHENTICATED":"EMPTY_PAGE_UNAUTHENTICATED",
    sourceAuthenticated:false, // Never assert real provenance from arbitrary JSON
    videoId:plan.videoId,
    sampleCount:comments.length,
    sampleIsPopulation:false,
    nextPageAvailable:Boolean(page.nextPageToken),
    repliesComplete:false,
    derivedSentiment:null,
    rawTextPersisted:false,
    comments:Object.freeze(comments)
  });
}
function assertReleasedForFirstCall() {
  // First gate is compile-time, before touching caller input or credentials.
  if(RELEASED_FOR_FIRST_REAL_CALL!==true)deny("POLICY_HOLD");
  const evidence=new Map(gates.evidence.map(e=>[e.id,e.status]));
  if(gates.liveCallsAuthorized!==true||
     REQUIRED_EVIDENCE.some(id=>evidence.get(id)!=="VERIFIED"))
    deny("EVIDENCE_NOT_APPROVED");
}
/** Fixed-host transport. No URL/credential/error-body logging, redirect or retry. */
function sendBoundedFirstPage(plan,apiKey) {
  if(typeof apiKey!=="string"||!(/^[A-Za-z0-9_-]{30,160}$/.test(apiKey)))
    deny("INVALID_CREDENTIAL");
  const query=new URLSearchParams(plan.query);
  query.set("key",apiKey); // Official YouTube API key query parameter; NEVER log path.
  const options={
    protocol:"https:",hostname:"www.googleapis.com",port:443,
    path:"/youtube/v3/commentThreads?"+query.toString(),
    method:"GET",headers:{Accept:"application/json"},
    rejectUnauthorized:true,agent:false
  };
  return new Promise((resolve,reject)=>{
    let settled=false;
    function fail(code){
      if(settled)return;
      settled=true;
      reject(Object.assign(new Error("G45_L7_"+code),{code:"G45_L7_"+code}));
    }
    const req=https.request(options,res=>{
      if(res.statusCode!==200){res.resume();fail("PROVIDER_HTTP_STATUS");return;}
      const type=res.headers["content-type"];
      if(typeof type!=="string"||
         !/^application\/json(?:;\s*charset=utf-8)?$/i.test(type.trim())){
        res.resume();fail("PROVIDER_CONTENT_TYPE");return;
      }
      const chunks=[];let bytes=0;
      res.on("data",chunk=>{
        if(settled)return;
        bytes+=chunk.length;
        if(bytes>MAX_RESPONSE_BYTES){fail("PROVIDER_BODY_TOO_LARGE");req.destroy();return;}
        chunks.push(chunk);
      });
      res.on("error",()=>fail("PROVIDER_STREAM_ERROR"));
      res.on("end",()=>{
        if(settled)return;
        try{
          const shaped=decodeFirstPageShape(Buffer.concat(chunks),{
            videoId:plan.videoId,maxResults:plan.maxResults
          });
          settled=true;
          resolve(Object.freeze({...shaped,sourceAuthenticated:true,
            status:shaped.sampleCount?"FIRST_PAGE_FETCHED":"FIRST_PAGE_EMPTY",
            observedAt:new Date().toISOString(),providerRequestsMade:1}));
        }catch{fail("INVALID_PROVIDER_RESPONSE");}
      });
    });
    req.on("error",()=>fail("PROVIDER_NETWORK_ERROR"));
    req.setTimeout(5000,()=>{fail("PROVIDER_TIMEOUT");req.destroy();});
    req.end();
  });
}
/**
 * Future approved one-shot entrypoint. Today hard-blocked even if a caller
 * supplies false approvals, a fake key, a malicious getter, or a fetch hook.
 * No credential reader is invoked until a separate code-release review
 * AND the canonical E01-E05/E07/E08/E11 live-read evidence gates pass.
 */
async function executeApprovedFirstPage(input,readServerCredential) {
  assertReleasedForFirstCall();
  const plan=planFirstPage(input);
  if(typeof readServerCredential!=="function")deny("CREDENTIAL_READER_REQUIRED");
  let key;
  try{key=await readServerCredential();}
  catch{deny("CREDENTIAL_UNAVAILABLE");}
  return sendBoundedFirstPage(plan,key);
}
module.exports=Object.freeze({
  MAX_RESPONSE_BYTES,RELEASED_FOR_FIRST_REAL_CALL,
  planFirstPage,decodeFirstPageShape,executeApprovedFirstPage
});
