"use strict";
/* G45-L1: an offline HTTP envelope boundary. NO network, keys or storage. */
const {descriptors,classifyOfflineProviderError}=require("./local-source-adapter.cjs");
const {buildSyntheticSnapshot}=require("./pipeline.cjs");
// Canonical known-good checked-in fixtures only: user-supplied provenance labels
// are never sufficient to allow a new arbitrary payload through this boundary.
const KNOWN_FIXTURES=new Set([
  JSON.stringify(require("../fixtures/partial.json")),
  JSON.stringify(require("../fixtures/ready.json")),
  JSON.stringify(require("../fixtures/empty.json"))
]);
const gates=require("../../../contracts/yu32-youtube-readiness-v0/policy-gates.json");
const MAX_BYTES=512*1024;
function reject(code){
  const e=new Error("G45_L1_BLOCKED:"+code);
  e.code="G45_L1_BLOCKED";
  throw e;
}
function hold(){
  if(gates.status!=="POLICY_HOLD"||gates.verifiedCount!==0||
    gates.liveCallsAuthorized!==false||gates.derivedSentimentAuthorized!==false||
    gates.externalDataCollected!==false)reject("GATES_CHANGED");
}
function planHttpFirstPage(options){
  hold();
  const p=descriptors(options);
  if(p.quotaUnitsPlanned>3||p.actualExternalRequests!==0)
    reject("BUDGET");
  const requests=p.candidates.map(d=>{
    if(d.transport!=="NOT_IMPLEMENTED"||d.automaticRetries!==0||
      d.pagination!=="FIRST_PAGE_ONLY")reject("TRANSPORT");
    const q=d.query;
    const query=new URLSearchParams([
      ["part","snippet"],["videoId",q.videoId],
      ["maxResults",String(q.maxResults)],["order","time"],
      ["textFormat","plainText"]
    ]).toString();
    return Object.freeze({
      protocol:"https:",hostname:"www.googleapis.com",port:443,
      method:"GET",pathname:"/youtube/v3/commentThreads",
      query,videoId:q.videoId,plannedQuotaUnits:1,
      redirectEnabled:false,retryEnabled:false,pages:1,
      bodyLimitBytes:MAX_BYTES,timeoutMsCandidate:5000,
      authentication:"UNVERIFIED_YOUTUBE_SPECIFIC",
      credentialAttached:false,networkEnabled:false
    });
  });
  return Object.freeze({status:"OFFLINE_HTTP_REQUEST_PLAN",
    sourceType:"STATIC_FIXTURE",providerRequestsMade:0,
    maxPlannedRequests:requests.length,
    candidates:Object.freeze(requests)});
}
function decodeSyntheticHttpEnvelope(envelope,videoId){
  hold();
  if(!envelope||Object.getPrototypeOf(envelope)!==Object.prototype||
     typeof videoId!=="string"||!/^[A-Za-z0-9_-]{11}$/.test(videoId))
    reject("ENVELOPE");
  // Inspect own data-property descriptors BEFORE reading values to avoid
  // executing a caller-provided getter during validation.
  const allowed=["statusCode","contentType","body","reason"];
  if(Reflect.ownKeys(envelope).some(k=>typeof k!=="string"||
      !allowed.includes(k)||!Object.hasOwn(
        Object.getOwnPropertyDescriptor(envelope,k),"value"))||
     !Object.hasOwn(envelope,"statusCode")||
     !Number.isInteger(envelope.statusCode))
    reject("UNEXPECTED_FIELD");
  if(envelope.statusCode!==200){
    if(Object.hasOwn(envelope,"body")||
       Object.hasOwn(envelope,"contentType"))reject("ERROR_BODY_FORBIDDEN");
    let result;
    try {
      result=classifyOfflineProviderError({
        status:envelope.statusCode,reason:envelope.reason
      });
    }catch {reject("UNKNOWN_ERROR");}
    return Object.freeze({videoId,status:result.status,
      errorCode:result.errorCode,sourceType:"STATIC_FIXTURE",
      sentiment:null,sample:null,providerRequestsMade:0});
  }
  if(Object.hasOwn(envelope,"reason")||
     typeof envelope.contentType!=="string"||
     !/^application\/json(?:;\s*charset=utf-8)?$/i.test(envelope.contentType)||
     typeof envelope.body!=="string")reject("RESPONSE_TYPE");
  const bytes=Buffer.byteLength(envelope.body,"utf8");
  if(bytes<2||bytes>MAX_BYTES)reject("RESPONSE_SIZE");
  let parsed;
  try {parsed=JSON.parse(envelope.body);}
  catch {reject("INVALID_JSON");}
  if(!parsed||parsed.fixtureId!=="G45_SYNTHETIC_RESPONSE_V01"||
     parsed.sourceType!=="STATIC_FIXTURE"||parsed.isSynthetic!==true||
     parsed.providerRequestsMade!==0||parsed.apiKeyUsed!==false||
     parsed.videoId!==videoId)reject("UNTRUSTED_PROVENANCE");
  // A real API payload relabeled as a synthetic fixture MUST NOT be analyzed.
  // JSON.parse produces plain data; compare its canonical serialization to
  // the three reviewed, repo-controlled fixture bodies, without any secrets.
  if(!KNOWN_FIXTURES.has(JSON.stringify(parsed)))
    reject("NON_BUNDLED_RESPONSE_FORBIDDEN");
  let result;
  try {result=buildSyntheticSnapshot(parsed);}
  catch {reject("INVALID_SYNTHETIC_RESPONSE");}
  return Object.freeze({videoId,status:result.snapshot.status,
    sample:result.snapshot.sample,sentiment:result.snapshot.sentiment,
    topics:result.snapshot.topics,
    partialPage:result.evidence.nextPageAvailable,
    sourceType:"STATIC_FIXTURE",isSynthetic:true,
    model:"SYNTHETIC_RULES_UNVALIDATED",
    rawTextSaved:false,providerRequestsMade:0,
    bytesValidated:bytes});
}
/* An explicit later change review is required to add actual HTTPS dispatch. */
function executeLiveFirstCall(){reject("LIVE_HTTP_NOT_IMPLEMENTED_POLICY_HOLD");}
module.exports=Object.freeze({MAX_BYTES,planHttpFirstPage,
  decodeSyntheticHttpEnvelope,executeLiveFirstCall});
