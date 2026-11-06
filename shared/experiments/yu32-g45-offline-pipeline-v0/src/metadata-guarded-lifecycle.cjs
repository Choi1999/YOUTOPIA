"use strict";
/**
 * UI-R04-P: server-oriented OFFLINE metadata lifecycle rehearsal.
 *
 * This module intentionally has NO network API, secret access, HTTP handler,
 * storage adapter, token/credential input, or authorization elevation.
 * Request tickets and responses are synthetic QA bookkeeping only.
 * A YouTube-shaped body cannot authenticate its own provenance.
 */
const gates=require("../../../contracts/yu32-youtube-readiness-v0/policy-gates.json");
const {
  planOfflineMetadataRead,decodeOfflineMetadataShape,createOfflineMetadataCache
}=require("./metadata-readiness.cjs");

const WINDOW_MS=60*1000;
const MAX_PLANNED_UNITS_PER_WINDOW=6;
const MAX_PENDING_TICKETS=3;
const FAILURE_MAP=Object.freeze({
  "403:quotaExceeded":"QUOTA_EXCEEDED_CANDIDATE",
  "403:forbidden":"FORBIDDEN_CANDIDATE",
  "404:notFound":"NOT_FOUND_CANDIDATE",
  "429:rateLimitExceeded":"RATE_LIMITED_CANDIDATE",
  "500:serverError":"TEMPORARY_FAILURE_CANDIDATE",
  "503:serverError":"TEMPORARY_FAILURE_CANDIDATE"
});

function invalid(code){
  const e=new TypeError("R04P_OFFLINE_"+code);
  e.code="R04P_OFFLINE_"+code;
  throw e;
}
function enforceLock(){
  if(gates.status!=="POLICY_HOLD"||
     gates.liveCallsAuthorized!==false||
     gates.externalDataCollected!==false||
     gates.derivedSentimentAuthorized!==false||
     gates.verifiedCount!==0)invalid("POLICY_CHANGED");
}
function plain(value){
  return value!==null&&typeof value==="object"&&!Array.isArray(value)&&
    (Object.getPrototypeOf(value)===Object.prototype||
     Object.getPrototypeOf(value)===null);
}
function assertOnlyData(value,allowed){
  if(!plain(value))invalid("BAD_RECORD");
  for(const key of Reflect.ownKeys(value)){
    const d=Object.getOwnPropertyDescriptor(value,key);
    if(typeof key!=="string"||!allowed.has(key)||
       !d||!Object.hasOwn(d,"value"))invalid("UNEXPECTED_FIELD");
  }
}
function checkClock(value,last){
  if(!Number.isSafeInteger(value)||value<0)invalid("TIME");
  if(last!==null&&value<last)invalid("CLOCK_ROLLBACK");
  return value;
}
function freezeStatus(status,extra={}){
  return Object.freeze({
    schema:"R04P_OFFLINE_METADATA_LIFECYCLE_V01",
    status,
    providerPolicy:"POLICY_HOLD",
    sourceAuthenticated:false,
    consumerPublicationAuthorized:false,
    credentialsAccepted:false,
    networkEnabled:false,
    actualProviderRequests:0,
    actualQuotaUnitsConsumed:0,
    ...extra
  });
}

/**
 * Simulated quota accounting is NOT an OAuth token, API quota reservation,
 * production authorization or shared-instance rate limiter.
 * No caller can raise its hard-coded limits.
 */
function createLockedMetadataLifecycle(){
  enforceLock();
  const cache=createOfflineMetadataCache();
  const pending=new Map();
  let windowStart=null,lastClock=null,plannedUnits=0,serial=0,closed=false;

  function tick(now){
    enforceLock();
    if(closed)invalid("CLOSED");
    lastClock=checkClock(now,lastClock);
    if(windowStart===null)windowStart=now;
    if(now-windowStart>=WINDOW_MS){
      windowStart=now;
      plannedUnits=0;
      pending.clear(); // old, unexecuted plans are not valid in a new window
    }
  }
  function status(now=Date.now()){
    tick(now);
    return freezeStatus("OFFLINE_POLICY_HOLD",{
      pendingTickets:pending.size,
      simulatedWindowStartsAt:windowStart,
      plannedQuotaUnits:plannedUnits,
      simulatedRemainingUnits:MAX_PLANNED_UNITS_PER_WINDOW-plannedUnits,
      retryEnabled:false,
      serverCredentialReaderPresent:false,
      consumerAccessEnabled:false
    });
  }
  function propose(options,now=Date.now()){
    tick(now);
    // Existing R04-O rejects arbitrary URLs, API keys and caller approval flags.
    const plan=planOfflineMetadataRead(options);
    if(plannedUnits+plan.plannedQuotaUnits>MAX_PLANNED_UNITS_PER_WINDOW)
      return freezeStatus("OFFLINE_PLAN_BUDGET_BLOCKED",{
        requiredUnits:plan.plannedQuotaUnits,
        remainingUnits:MAX_PLANNED_UNITS_PER_WINDOW-plannedUnits,
        ticket:null
      });
    if(pending.size>=MAX_PENDING_TICKETS)
      return freezeStatus("OFFLINE_PENDING_LIMIT_BLOCKED",{
        pendingTickets:pending.size,ticket:null
      });
    plannedUnits+=plan.plannedQuotaUnits;
    const ticket="offline-ticket-"+(++serial);
    pending.set(ticket,plan);
    return freezeStatus("NON_EXECUTABLE_PLAN_ISSUED",{
      ticket,plan,plannedUnits,
      plannedQuotaUnits:plan.plannedQuotaUnits,
      remainingUnits:MAX_PLANNED_UNITS_PER_WINDOW-plannedUnits
    });
  }
  function takeTicket(ticket,now){
    tick(now);
    if(typeof ticket!=="string"||!pending.has(ticket))
      invalid("UNKNOWN_OR_REPLAYED_TICKET");
    const plan=pending.get(ticket);
    pending.delete(ticket); // single-use even on malformed inputs
    return plan;
  }
  function inspectSyntheticBodies(ticket,bodies,now=Date.now()){
    const plan=takeTicket(ticket,now);
    if(!Array.isArray(bodies)||bodies.length!==plan.candidates.length)
      invalid("RESPONSE_ENVELOPE");
    const sanitized=[];
    for(let i=0;i<bodies.length;i++){
      const d=Object.getOwnPropertyDescriptor(bodies,i);
      if(!d||!Object.hasOwn(d,"value")||
        !(typeof d.value==="string"||Buffer.isBuffer(d.value)))
        invalid("RESPONSE_ENVELOPE");
      sanitized.push(d.value);
    }
    // Transactional shape validation: do not update cache until ALL batches
    // decode correctly. No provenance promotion or user-facing publication.
    const decodes=sanitized.map((body,i)=>
      decodeOfflineMetadataShape(plan,i,body,now));
    const values=decodes.flatMap(r=>r.records);
    for(const record of values){
      if(!cache.put(record,now))invalid("INVALID_OFFLINE_CACHE_ENTRY");
    }
    return freezeStatus("OFFLINE_SHAPE_VALIDATED_NOT_AUTHENTICATED",{
      ticket,decodedCount:values.length,
      unmatchedKeys:Object.freeze(decodes.flatMap(r=>r.unmatchedKeys)),
      records:Object.freeze(values),
      plannedQuotaUnits:plan.plannedQuotaUnits
    });
  }
  function simulateFailure(ticket,diagnostic,now=Date.now()){
    takeTicket(ticket,now);
    assertOnlyData(diagnostic,new Set(["statusCode","reason"]));
    if(!Object.hasOwn(diagnostic,"statusCode")||
      !Object.hasOwn(diagnostic,"reason")||
      !Number.isInteger(diagnostic.statusCode)||
      typeof diagnostic.reason!=="string")
      invalid("DIAGNOSTIC");
    const code=FAILURE_MAP[diagnostic.statusCode+":"+diagnostic.reason];
    if(!code)invalid("UNKNOWN_DIAGNOSTIC");
    // No raw HTTP/error body, account, URL, credential or provider status
    // attestation is accepted from the caller.
    return freezeStatus(code,{ticket,records:Object.freeze([]),autoRetry:false});
  }
  function readOfflineCache(key,now=Date.now()){
    tick(now);
    return cache.get(key,now); // decoded JSON shape only, never trusted provider
  }
  function cancel(ticket,now=Date.now()){
    tick(now);
    if(typeof ticket!=="string"||!pending.has(ticket))return false;
    pending.delete(ticket); // no budget refund; prevents retry loopholes
    return true;
  }
  function close(){
    enforceLock();
    pending.clear();cache.clear();closed=true;
    return freezeStatus("OFFLINE_COORDINATOR_CLOSED");
  }
  return Object.freeze({
    status,propose,inspectSyntheticBodies,simulateFailure,
    readOfflineCache,cancel,close
  });
}

module.exports=Object.freeze({
  WINDOW_MS,MAX_PLANNED_UNITS_PER_WINDOW,MAX_PENDING_TICKETS,
  createLockedMetadataLifecycle
});
