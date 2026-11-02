"use strict";
/**
 * G45 LIVE-SOURCE INTERFACE SHAPE, intentionally OFFLINE-ONLY.
 * It builds bounded HTTP request *descriptors* and validates a mock-only
 * outcome taxonomy. It cannot send HTTP requests or consume credentials.
 * This file must NOT be connected to real YouTube response/authorization.
 */
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;
const SAFE_LOCALE=new Set(["ko-KR","en-US"]);
const ALLOWED=new Set(["videoIds","maxResults","locale"]);
const ERROR_NAMES=new Set(["commentsDisabled","quotaExceeded","rateLimitExceeded",
 "forbidden","videoNotFound","unknown","apiKeyInvalid","processingFailure"]);
function failure(reason){
  const e=new TypeError("G45_LOCAL_ADAPTER_REJECTED:"+reason);
  e.code="G45_LOCAL_ADAPTER_REJECTED";
  throw e;
}
function plainObject(x){return x!==null&&typeof x==="object"&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);}
function descriptors(spec){
  if(!plainObject(spec) || !Reflect.ownKeys(spec).every(k=>
      typeof k==="string"&&ALLOWED.has(k)&&Object.getOwnPropertyDescriptor(spec,k)?.value!==undefined))
    failure("unknown input or accessor");
  if(!Array.isArray(spec.videoIds)||spec.videoIds.length<1||spec.videoIds.length>3||
      !spec.videoIds.every(v=>typeof v==="string"&&VIDEO_ID.test(v))||
      new Set(spec.videoIds).size!==spec.videoIds.length)failure("VIDEO_ID_SCOPE");
  if(spec.maxResults!==undefined&&(!Number.isInteger(spec.maxResults)||
      spec.maxResults<1||spec.maxResults>100))failure("maxResults");
  if(spec.locale!==undefined&&!SAFE_LOCALE.has(spec.locale))failure("locale");
  const maxResults=spec.maxResults??100;
  const candidates=spec.videoIds.map(videoId=>Object.freeze({
    transport:"NOT_IMPLEMENTED",
    method:"GET",
    hostname:"www.googleapis.com",
    pathname:"/youtube/v3/commentThreads",
    query:Object.freeze({
      part:"snippet",videoId,maxResults,order:"time",textFormat:"plainText"
    }),
    credentialHeaderName:"x-goog-api-key",
    credentialValuePresent:false,
    queryContainsKey:false,
    automaticRetries:0,
    pagination:"FIRST_PAGE_ONLY",
    replies:"DISABLED",
    expectedQuotaUnits:1,
    locale:spec.locale??"ko-KR"
  }));
  // Static descriptor does not attest source/credential security.
  return Object.freeze({
    version:"G45_LOCAL_YOUTUBE_DESCRIPTOR_V01",
    plannedExternalRequests:candidates.length,
    quotaUnitsPlanned:candidates.length,
    actualExternalRequests:0,
    quotaUnitsConsumed:0,
    providerDataCollected:0,
    sourcePolicy:"POLICY_HOLD",
    providerPermissionVerified:false,
    liveCollectionAuthorized:false,
    networkTransportEnabled:false,
    authorizedKeysRead:0,
    candidates:Object.freeze(candidates)
  });
}
/**
 * Explicitly non-authoritative preflight check: caller booleans are not
 * security proof and cannot enable a network request in this package.
 */
function assessOperatorEvidence(state){
  if(!plainObject(state)||
     !Reflect.ownKeys(state).every(k=>typeof k==="string"&&
       ["projectVerified","apiEnabled","apiRestricted","ipRestricted",
        "publicEgressVerified","osVaultVerified","policyAccepted",
        "retentionApproved","firstCallApproved"].includes(k)))
    failure("evidence flags only; no secrets/IP values allowed");
  const keys=["projectVerified","apiEnabled","apiRestricted","ipRestricted",
    "publicEgressVerified","osVaultVerified","policyAccepted",
    "retentionApproved","firstCallApproved"];
  if(!keys.every(k=>typeof state[k]==="boolean"))failure("complete boolean flags required");
  const allReported=keys.every(k=>state[k]);
  return Object.freeze({
    operatorReportedFlagsComplete:allReported,
    independentEvidenceVerified:false,
    mayCollectRealComments:false,
    mayComputeDerivedSentiment:false,
    policy:"POLICY_HOLD",
    secretsAccepted:false,
    callsPermitted:0
  });
}
function classifyOfflineProviderError(input){
  if(!plainObject(input)||Reflect.ownKeys(input).length!==2||
     !Object.hasOwn(input,"status")||!Object.hasOwn(input,"reason")||
     !Number.isInteger(input.status)||input.status<400||input.status>599||
     typeof input.reason!=="string"||!ERROR_NAMES.has(input.reason))
    failure("unsupported diagnostic metadata");
  const {status,reason}=input;
  const resultStatus=reason==="commentsDisabled"&&status===403?"COMMENTS_DISABLED":
    (reason==="forbidden"||reason==="apiKeyInvalid")&&status===403?"POLICY_BLOCKED":
    "ERROR";
  return Object.freeze({
    status:resultStatus,
    rawCount:null,
    sample:null,
    sentiment:null,
    topics:Object.freeze([]),
    analyzedAt:null,
    providerRequestsMade:0,
    syntheticDiagnostic:true,
    errorCode:reason==="commentsDisabled"?"COMMENTS_DISABLED":
      reason==="quotaExceeded"||reason==="rateLimitExceeded"?"QUOTA_OR_RATE_LIMIT":
      reason==="videoNotFound"?"NOT_FOUND":
      reason==="forbidden"||reason==="apiKeyInvalid"?"AUTHORIZATION_FAILED":
      "SOURCE_ERROR",
    stateNote:"not proof of live API behavior"
  });
}
module.exports=Object.freeze({descriptors,assessOperatorEvidence,classifyOfflineProviderError});
