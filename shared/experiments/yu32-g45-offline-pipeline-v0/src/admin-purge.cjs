"use strict";
/**
 * G45 OFFLINE SYNTHETIC PURGE HARNESS ONLY.
 * This is NOT authentication/authorization middleware or a production store.
 * The actor issuer exists solely for in-process tests; production must use the
 * independent Spring Security administrator realm and server-owned session.
 * No API, network, database, file deletion, provider data or queue access.
 */
const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const TENANT=/^tenant-[a-z0-9]{1,24}$/;
const REQUEST=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASONS=new Set(["ADMIN_REQUEST","DATA_QUALITY","POLICY_RESTRICTION"]);
const CONFIRM="DELETE_YOUTOPIA_DATA";
const COUNTS=["snapshots","cachedCards","topicIndexes","reports","jobs","outbox","rawComments"];
function refuse(code){
  const e=new Error("G45_PURGE_REJECTED:"+code);
  e.code="G45_PURGE_REJECTED";
  throw e;
}
function exactRecord(obj,keys){
  return obj!==null&&typeof obj==="object"&&!Array.isArray(obj)&&
    Object.getPrototypeOf(obj)===Object.prototype&&
    Reflect.ownKeys(obj).every(k=>typeof k==="string"&&keys.includes(k))&&
    keys.every(k=>Object.hasOwn(obj,k));
}
function instant(text){
  if(typeof text!=="string"||!(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(text)))refuse("TIMESTAMP");
  const n=Date.parse(text);
  if(!Number.isFinite(n)||new Date(n).toISOString()!==text.replace("Z",".000Z"))
    refuse("TIMESTAMP");
  return n;
}
function key(tenantId,videoId){
  if(typeof tenantId!=="string"||!TENANT.test(tenantId)||typeof videoId!=="string"||!VIDEO.test(videoId))
    refuse("SCOPE");
  return tenantId+":"+videoId;
}
function seed(tenantId,videoId,expiresAt){
  const suffix=tenantId+":"+videoId;
  return {
    tenantId,videoId,sourceType:"STATIC_FIXTURE",isSynthetic:true,
    revision:1,expiresAt,
    // Only synthetic opaque IDs. No comment text, author, real snapshot or API data.
    snapshots:["snapshot:"+suffix],
    cachedCards:["cache:"+suffix],
    topicIndexes:["index:"+suffix],
    reports:["report:"+suffix],
    jobs:["job:"+suffix],
    outbox:["outbox:"+suffix],
    rawComments:[]
  };
}
function counts(record){
  const result={};
  for(const k of COUNTS)result[k]=record[k].length;
  return Object.freeze(result);
}
function createSyntheticPurgeHarness(){
  const issued=new WeakSet(),entries=new Map(),tombstones=new Set(),audit=[],operations=new Map();
  const samples=[
    seed("tenant-alpha","Ab0_-123xyz","2026-11-10T00:00:00Z"),
    seed("tenant-beta","Ab0_-123xyz","2026-11-10T00:00:00Z"),
    seed("tenant-alpha","Zb0_-123xyz","2026-10-31T00:00:00Z")
  ];
  for(const s of samples)entries.set(key(s.tenantId,s.videoId),s);

  // Test-only capability issuer: it cannot be used as a production login.
  function syntheticActorForTests(kind,tenantId){
    if(!["ADMIN","USER","SYSTEM"].includes(kind))refuse("SYNTHETIC_ACTOR");
    if(kind==="SYSTEM"){
      if(tenantId!==undefined)refuse("SYSTEM_SCOPE");
    }else if(typeof tenantId!=="string"||!TENANT.test(tenantId))refuse("TENANT");
    const actor=Object.freeze({kind,tenantId:kind==="SYSTEM"?null:tenantId,
      syntheticOnly:true});
    issued.add(actor);
    return actor;
  }
  function requireActor(actor,kind,tenantId){
    if(actor===null||typeof actor!=="object"||!issued.has(actor)||
       actor.kind!==kind||(kind!=="SYSTEM"&&actor.tenantId!==tenantId))
      refuse("NOT_AUTHORIZED");
  }
  function current(actor,tenantId,videoId){
    requireActor(actor,"ADMIN",tenantId);
    const resource=entries.get(key(tenantId,videoId));
    if(!resource||tombstones.has(key(tenantId,videoId)))refuse("NOT_FOUND_OR_PURGED");
    if(resource.isSynthetic!==true||resource.sourceType!=="STATIC_FIXTURE")
      refuse("NO_REAL_DATA");
    return resource;
  }
  function preview(input){
    if(!exactRecord(input,["actor","tenantId","videoId"]))refuse("INPUT_FIELDS");
    const resource=current(input.actor,input.tenantId,input.videoId);
    return Object.freeze({state:"PREVIEW_ONLY",scope:"VIDEO",tenantId:resource.tenantId,
      videoId:resource.videoId,revision:resource.revision,
      affected:counts(resource),requiresConfirmation:CONFIRM,providerRequestsMade:0});
  }
  function purge(resource,kind,reason,requestId,at){
    const resourceKey=key(resource.tenantId,resource.videoId);
    if(tombstones.has(resourceKey))refuse("ALREADY_PURGED");
    const removed=counts(resource);
    // Tombstone before removal prevents replay/rediscovery in this synthetic harness.
    tombstones.add(resourceKey);
    entries.delete(resourceKey);
    const event=Object.freeze({operationId:requestId,scope:"VIDEO",
      tenantId:resource.tenantId,videoId:resource.videoId,
      actorKind:kind,reasonCode:reason,at,
      state:"PURGED_SYNTHETIC_ONLY",removed});
    audit.push(event);
    return Object.freeze({status:"PURGED_SYNTHETIC_ONLY",
      tenantId:resource.tenantId,videoId:resource.videoId,
      removed,tombstoned:true,providerRequestsMade:0});
  }
  function adminDelete(input){
    const props=["actor","tenantId","videoId","revision","requestId","confirmation","reasonCode","at"];
    if(!exactRecord(input,props))refuse("INPUT_FIELDS");
    const resourceKey=key(input.tenantId,input.videoId);
    requireActor(input.actor,"ADMIN",input.tenantId);
    if(typeof input.requestId!=="string"||!REQUEST.test(input.requestId))refuse("REQUEST_ID");
    if(input.confirmation!==CONFIRM)refuse("CONFIRM_REQUIRED");
    if(!REASONS.has(input.reasonCode))refuse("REASON_REQUIRED");
    instant(input.at);
    if(!Number.isSafeInteger(input.revision)||input.revision<1)refuse("REVISION");
    const signature=[resourceKey,input.revision,input.reasonCode,input.confirmation,input.at].join("|");
    const previous=operations.get(input.requestId);
    if(previous){
      if(previous.signature!==signature)refuse("IDEMPOTENCY_CONFLICT");
      return Object.freeze({...previous.result,replayed:true});
    }
    const resource=current(input.actor,input.tenantId,input.videoId);
    if(resource.revision!==input.revision)refuse("VERSION_CONFLICT");
    const result=purge(resource,"ADMIN",input.reasonCode,input.requestId,input.at);
    operations.set(input.requestId,{signature,result});
    return result;
  }
  function systemExpire(input){
    if(!exactRecord(input,["actor","at"]))refuse("INPUT_FIELDS");
    requireActor(input.actor,"SYSTEM");
    const when=instant(input.at);
    const done=[];
    for(const s of [...entries.values()]){
      if(instant(s.expiresAt)<=when){
        const id="retention-"+(audit.length+1);
        done.push(purge(s,"SYSTEM","POLICY_EXPIRY",id,input.at));
      }
    }
    return Object.freeze({status:"SYNTHETIC_EXPIRY_PASS",deleted:done.length,
      details:Object.freeze(done),providerRequestsMade:0});
  }
  function systemVerifiedUserErasure(input){
    const props=["actor","tenantId","videoId","requestId","requestedAt","at"];
    if(!exactRecord(input,props))refuse("INPUT_FIELDS");
    requireActor(input.actor,"SYSTEM");
    const resourceKey=key(input.tenantId,input.videoId);
    if(typeof input.requestId!=="string"||!REQUEST.test(input.requestId))refuse("REQUEST_ID");
    const requested=instant(input.requestedAt),completed=instant(input.at);
    if(completed<requested)refuse("TIME_ORDER");
    const signature=[resourceKey,input.requestedAt,input.at,"USER_ERASURE"].join("|");
    const previous=operations.get(input.requestId);
    if(previous){
      if(previous.signature!==signature)refuse("IDEMPOTENCY_CONFLICT");
      return Object.freeze({...previous.result,replayed:true});
    }
    const resource=entries.get(resourceKey);
    if(!resource||tombstones.has(resourceKey))refuse("NOT_FOUND_OR_PURGED");
    const result=purge(resource,"SYSTEM","VERIFIED_USER_ERASURE",input.requestId,input.at);
    const due=requested+7*24*60*60*1000;
    const decorated=Object.freeze({...result,deadlineStatus:completed<=due?"WITHIN_7_DAYS":"SLA_BREACH",
      // Do not block a late deletion; it is urgent even after the deadline.
      requestedAt:input.requestedAt});
    operations.set(input.requestId,{signature,result:decorated});
    return decorated;
  }
  function syntheticReplayAttempt(input){
    if(!exactRecord(input,["actor","tenantId","videoId"]))refuse("INPUT_FIELDS");
    requireActor(input.actor,"SYSTEM");
    const resourceKey=key(input.tenantId,input.videoId);
    if(tombstones.has(resourceKey))return Object.freeze({status:"REPLAY_BLOCKED_BY_TOMBSTONE"});
    return Object.freeze({status:"SYNTHETIC_RECORD_STILL_PRESENT",providerRequestsMade:0});
  }
  function inspect(input){
    if(!exactRecord(input,["actor","tenantId","videoId"]))refuse("INPUT_FIELDS");
    requireActor(input.actor,"ADMIN",input.tenantId);
    const resourceKey=key(input.tenantId,input.videoId);
    const resource=entries.get(resourceKey);
    return Object.freeze({exists:Boolean(resource),tombstoned:tombstones.has(resourceKey),
      affected:resource?counts(resource):null,providerRequestsMade:0});
  }
  function auditTrail(actor){
    requireActor(actor,"ADMIN",actor?.tenantId);
    return Object.freeze(audit.filter(x=>x.tenantId===actor.tenantId).map(x=>Object.freeze({...x})));
  }
  return Object.freeze({syntheticActorForTests,preview,adminDelete,systemExpire,
    systemVerifiedUserErasure,syntheticReplayAttempt,inspect,auditTrail});
}
module.exports=Object.freeze({createSyntheticPurgeHarness,CONFIRM});
