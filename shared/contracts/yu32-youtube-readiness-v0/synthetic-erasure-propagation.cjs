"use strict";
/**
 * G45-L4 TEST-ONLY propagation model: fixed synthetic VIDEO/tenant fixtures.
 * It neither authorizes a caller nor touches real storage, files, secrets,
 * network, YouTube, queues, caches or backups. "Acknowledgements" are fake.
 * This model is not a Spring Security or data-deletion implementation.
 */
const FIXTURE = "G45_L4_STATIC_TEST_ONLY";
const SCOPES = new Set(["tenant-alpha:Ab0_-123xyz","tenant-beta:Ab0_-123xyz"]);
const TARGETS = Object.freeze([
  "raw-and-identity","snapshot-and-derived","report","search-index",
  "server-cache","client-and-cdn-cache","job-and-outbox","temporary-export",
  "backup-and-restore-fence"
]);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function deny(code) {
  const e = new Error("G45_L4_SYNTHETIC_REJECTED:"+code);
  e.code = "G45_L4_SYNTHETIC_REJECTED";
  throw e;
}
function dataRecord(input, expected) {
  if (input===null || typeof input!=="object" || Array.isArray(input) ||
      Object.getPrototypeOf(input)!==Object.prototype) return false;
  const keys=Reflect.ownKeys(input);
  return keys.length===expected.length &&
    keys.every(k=>typeof k==="string" && expected.includes(k) &&
      Object.hasOwn(Object.getOwnPropertyDescriptor(input,k),"value")) &&
    expected.every(k=>Object.hasOwn(input,k));
}
function scopeOf(tenantId,videoId) {
  const name=String(tenantId)+":"+String(videoId);
  if (!SCOPES.has(name)) deny("FIXTURE_SCOPE_ONLY");
  return name;
}
function requestIdValid(id) {
  return typeof id==="string" && ID.test(id);
}
function createSyntheticPropagationLab() {
  const operations=new Map(),tombstones=new Map();
  function statusFor(op) {
    return Object.freeze({
      syntheticOnly:true,requestId:op.requestId,state:op.state,
      remainingTargets:Object.freeze([...op.pending]),
      acknowledgedTargets:TARGETS.length-op.pending.size,
      requiredTargets:TARGETS.length,
      tombstoneEpoch:op.policyEpoch,
      providerRequestsMade:0,productionDeletes:0,realDataPresent:false
    });
  }
  function lookup(input) {
    if (!dataRecord(input,["requestId"]) || !requestIdValid(input.requestId))
      deny("REQUEST_ID");
    const op=operations.get(input.requestId);
    if (!op) deny("NOT_FOUND");
    return op;
  }
  function issueSyntheticDeletion(input) {
    const fields=["fixtureId","tenantId","videoId","requestId","policyEpoch"];
    if (!dataRecord(input,fields) || input.fixtureId!==FIXTURE ||
        !requestIdValid(input.requestId) ||
        !Number.isSafeInteger(input.policyEpoch) || input.policyEpoch<1)
      deny("INVALID_STATIC_FIXTURE");
    const scope=scopeOf(input.tenantId,input.videoId);
    const signature=JSON.stringify([scope,input.policyEpoch,FIXTURE]);
    const prior=operations.get(input.requestId);
    if (prior) {
      if (prior.signature!==signature) deny("IDEMPOTENCY_CONFLICT");
      return Object.freeze({...statusFor(prior),idempotentReplay:true});
    }
    if(tombstones.has(scope))deny("TOMBSTONED_SCOPE");
    // Test tombstone occurs BEFORE any mocked propagation acknowledgements.
    tombstones.set(scope,input.policyEpoch);
    const op={requestId:input.requestId,signature,scope,policyEpoch:input.policyEpoch,
      state:"PENDING",pending:new Set(TARGETS)};
    operations.set(input.requestId,op);
    return statusFor(op);
  }
  function beginSyntheticExecution(input) {
    const op=lookup(input);
    if(op.state!=="PENDING")deny("TRANSITION");
    op.state="EXECUTING";
    return statusFor(op);
  }
  function beginSyntheticPropagation(input) {
    const op=lookup(input);
    if(op.state!=="EXECUTING")deny("TRANSITION");
    op.state="PROPAGATING";
    return statusFor(op);
  }
  function acknowledgeSyntheticTarget(input) {
    if(!dataRecord(input,["requestId","target"]) || !TARGETS.includes(input.target))
      deny("TARGET");
    const op=lookup({requestId:input.requestId});
    if(op.state!=="PROPAGATING")deny("NOT_PROPAGATING");
    op.pending.delete(input.target); // duplicate receipts are idempotent
    if(op.pending.size===0) op.state="PURGED_SYNTHETIC_ONLY";
    return statusFor(op);
  }
  function failSyntheticTarget(input) {
    if(!dataRecord(input,["requestId","target"]) || !TARGETS.includes(input.target))
      deny("TARGET");
    const op=lookup({requestId:input.requestId});
    if(op.state!=="PROPAGATING"||!op.pending.has(input.target))
      deny("INVALID_FAILURE");
    op.state="PURGE_FAILED";
    return statusFor(op);
  }
  function retrySyntheticPropagation(input) {
    const op=lookup(input);
    if(op.state!=="PURGE_FAILED")deny("TRANSITION");
    op.state="PROPAGATING";
    return statusFor(op);
  }
  function checkSyntheticReplay(input) {
    if(!dataRecord(input,["tenantId","videoId","jobPolicyEpoch"])||
      !Number.isSafeInteger(input.jobPolicyEpoch)||input.jobPolicyEpoch<1)
      deny("REPLAY_ARGUMENT");
    const scope=scopeOf(input.tenantId,input.videoId);
    const tombstone=tombstones.get(scope);
    return Object.freeze({
      syntheticOnly:true,
      decision:tombstone!==undefined&&input.jobPolicyEpoch<=tombstone
        ?"REPLAY_BLOCKED_BY_TOMBSTONE":"REAL_REPLAY_NOT_AUTHORIZED",
      mayIssueProviderRequest:false
    });
  }
  return Object.freeze({
    issueSyntheticDeletion,beginSyntheticExecution,beginSyntheticPropagation,
    acknowledgeSyntheticTarget,failSyntheticTarget,retrySyntheticPropagation,
    checkSyntheticReplay
  });
}
module.exports=Object.freeze({createSyntheticPropagationLab,TARGETS,FIXTURE});
