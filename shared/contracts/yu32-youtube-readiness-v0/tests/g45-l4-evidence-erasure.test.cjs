"use strict";
/** G45-L4: offline evidence and deletion-propagation readiness tests. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const contract=JSON.parse(fs.readFileSync(path.join(root,"g45-l4-evidence-erasure-readiness.v01.json"),"utf8"));
const gates=JSON.parse(fs.readFileSync(path.join(root,"policy-gates.json"),"utf8"));
const l3=JSON.parse(fs.readFileSync(path.join(root,"g45-l3-windows-security-lifecycle.v01.json"),"utf8"));
const source=fs.readFileSync(path.join(root,"synthetic-erasure-propagation.cjs"),"utf8");
const guide=fs.readFileSync(path.join(root,"../../../docs/integration/YU32_G45_L4_EVIDENCE_AND_LIFECYCLE_READINESS_V01.md"),"utf8");
const {createSyntheticPropagationLab,TARGETS,FIXTURE}=require("../synthetic-erasure-propagation.cjs");
const ID1="11111111-1111-4111-8111-111111111111", ID2="22222222-2222-4222-8222-222222222222";
const start=(lab=createSyntheticPropagationLab(),requestId=ID1,tenantId="tenant-alpha")=>
  lab.issueSyntheticDeletion({fixtureId:FIXTURE,tenantId,videoId:"Ab0_-123xyz",requestId,policyEpoch:4});
const denied=(fn)=>assert.throws(fn,/G45_L4_SYNTHETIC_REJECTED/);

test("G45-L4-01: 12 evidence IDs, statuses and scopes match the authoritative POLICY_HOLD register",()=>{
 assert.equal(contract.contractVersion,"YU32_G45_L4_EVIDENCE_ERASURE_READINESS_V01");
 assert.equal(contract.status,"PREIMPLEMENTATION_POLICY_HOLD");
 assert.equal(contract.evidenceVerifiedCount,0);
 assert.equal(contract.liveCallsAuthorized,false);
 assert.equal(contract.derivedSentimentAuthorized,false);
 assert.equal(contract.externalDataCollected,false);
 assert.equal(contract.authoritativeGatePath,"shared/contracts/yu32-youtube-readiness-v0/policy-gates.json");
 assert.equal(gates.status,"POLICY_HOLD");
 assert.equal(gates.verifiedCount,0);
 assert.equal(contract.evidence.length,12);
 assert.deepEqual(contract.evidence.map(e=>e.id),gates.evidence.map(e=>e.id));
 for(let i=0;i<12;i++){
   assert.equal(contract.evidence[i].status,gates.evidence[i].status);
   assert.equal(contract.evidence[i].scope,gates.evidence[i].gate);
   assert.equal(contract.evidence[i].receiptVerified,false);
   assert.equal(contract.evidence[i].evidenceCapturedInRepository,false);
   assert.equal(contract.evidence[i].independentReviewerRequired,true);
 }
});
test("G45-L4-02: project, keys, IP and quota are not represented as independently verified",()=>{
 const c=contract.credentialHandling;
 assert.equal(c.cloudApiConnectionAvailable,false);
 for(const field of ["accountOrProjectOwnershipIndependentlyVerified","cloudProjectChangeAuthorized",
  "keyCreationAuthorized","quotaAndUsageIndependentlyVerified","currentEgressIpObserved",
  "ipRestrictionMatchVerified","youtubeAuthenticationModeSelected"])
  assert.equal(c[field],false,field);
 assert.equal(c.credentialsRead,0);
 assert.ok(c.neverCommit.includes("API_KEY"));
 assert.ok(c.neverCommit.includes("RAW_COMMENT"));
 assert.ok(c.neverCommit.includes("PUBLIC_EGRESS_IP"));
 assert.deepEqual(l3.authentication.youtubeDocumentedCandidates,
   ["API_KEY_QUERY_KEY_PARAMETER","OAUTH2_AUTHORIZATION_BEARER"]);
});
test("G45-L4-03: receipt schema is metadata-only, not a self-attested authorization",()=>{
 const names=contract.evidenceReceiptRecordFields;
 assert.ok(["evidenceId","reviewer","reviewedAt","expiresAt","policyRevision","revocationStatus",
   "restrictedEvidenceLocationOrHash"].every(x=>names.includes(x)));
 assert.equal(contract.authority,"OFFLINE_TEST_AND_REVIEW_CHECKLIST_ONLY_NOT_POLICY_ENGINE");
 assert.equal(gates.liveCallsAuthorized,false);
 assert.equal(gates.derivedSentimentAuthorized,false);
});
test("G45-L4-04: independent user erasure, app consent revocation and external revocation time limits stay distinct",()=>{
 const x=contract.lifecycle;
 assert.equal(x.rawNonAuthorizedDataRefreshOrDeleteAfterCalendarDays,30);
 assert.equal(x.userErasureRequestWithinCalendarDays,7);
 assert.equal(x.oauthRevocationInAppWithinCalendarDays,7);
 assert.equal(x.oauthRevocationInGoogleSecuritySettingsWithinCalendarDays,30);
 assert.equal(x.deadlinesAreMaximumsNotReasonsToDelay,true);
 assert.equal(x.initialRawCommentPersistence,false);
 assert.equal(x.authority,"PRODUCTION_DELETION_NOT_IMPLEMENTED");
});
test("G45-L4-05: automatic mandatory deletion is not blocked by an ADMIN login",()=>{
 const x=contract.lifecycle;
 assert.equal(x.userErasureAndExpiryDoNotRequireAdmin,true);
 assert.equal(x.adminManualDeletionRequiresServerVerifiedAdmin,true);
 assert.equal(x.sourceTombstoneBeforePropagation,true);
 assert.equal(x.jobReplaysMustRespectMonotonicPolicyEpoch,true);
 assert.equal(x.backendSqlRedisQueueCdnBackupIntegrated,false);
});
test("G45-L4-06: propagation requires independent storage acknowledgements including backup/restore fence",()=>{
 assert.deepEqual(contract.lifecycle.propagationTargets,TARGETS);
 assert.equal(contract.lifecycle.purgedRequiresAllTargetsVerified,true);
 assert.equal(contract.lifecycle.failureState,"PURGE_FAILED");
 assert.equal(contract.syntheticLab.statusOnFullAcknowledgement,"PURGED_SYNTHETIC_ONLY");
});
test("G45-L4-07: fixed synthetic fixture and inputs reject approved/role/URL bypasses",()=>{
 const lab=createSyntheticPropagationLab();
 const proposal={fixtureId:FIXTURE,tenantId:"tenant-alpha",videoId:"Ab0_-123xyz",requestId:ID1,policyEpoch:4};
 denied(()=>lab.issueSyntheticDeletion({...proposal,approved:true}));
 denied(()=>lab.issueSyntheticDeletion({...proposal,role:"ADMIN"}));
 denied(()=>lab.issueSyntheticDeletion({...proposal,apiKey:"not-real"}));
 denied(()=>lab.issueSyntheticDeletion({...proposal,tenantId:"tenant-real"}));
 denied(()=>lab.issueSyntheticDeletion({...proposal,fixtureId:"APPROVED_PROVIDER"}));
 denied(()=>lab.issueSyntheticDeletion({...proposal,policyEpoch:0}));
});
test("G45-L4-08: PENDING and EXECUTING cannot fake a completed deletion",()=>{
 const lab=createSyntheticPropagationLab();
 let x=start(lab);
 assert.equal(x.state,"PENDING");
 assert.equal(x.remainingTargets.length,TARGETS.length);
 assert.equal(x.syntheticOnly,true);
 denied(()=>lab.acknowledgeSyntheticTarget({requestId:ID1,target:TARGETS[0]}));
 x=lab.beginSyntheticExecution({requestId:ID1});
 assert.equal(x.state,"EXECUTING");
 denied(()=>lab.acknowledgeSyntheticTarget({requestId:ID1,target:TARGETS[0]}));
 x=lab.beginSyntheticPropagation({requestId:ID1});
 assert.equal(x.state,"PROPAGATING");
 assert.equal(x.productionDeletes,0);
});
test("G45-L4-09: failure to verify backup fence prevents PURGED even after other acknowledgements",()=>{
 const lab=createSyntheticPropagationLab();
 start(lab); lab.beginSyntheticExecution({requestId:ID1});lab.beginSyntheticPropagation({requestId:ID1});
 for(const target of TARGETS.filter(x=>x!=="backup-and-restore-fence"))
   assert.equal(lab.acknowledgeSyntheticTarget({requestId:ID1,target}).state,"PROPAGATING");
 const x=lab.acknowledgeSyntheticTarget({requestId:ID1,target:"backup-and-restore-fence"});
 assert.equal(x.state,"PURGED_SYNTHETIC_ONLY");
 assert.equal(x.remainingTargets.length,0);
 assert.equal(x.providerRequestsMade,0);
 assert.equal(x.productionDeletes,0);
});
test("G45-L4-10: partial failure stays failed until a deliberate simulated retry",()=>{
 const lab=createSyntheticPropagationLab();start(lab);
 lab.beginSyntheticExecution({requestId:ID1});lab.beginSyntheticPropagation({requestId:ID1});
 let x=lab.acknowledgeSyntheticTarget({requestId:ID1,target:TARGETS[0]});
 assert.equal(x.state,"PROPAGATING");
 x=lab.failSyntheticTarget({requestId:ID1,target:TARGETS[1]});
 assert.equal(x.state,"PURGE_FAILED");
 denied(()=>lab.acknowledgeSyntheticTarget({requestId:ID1,target:TARGETS[2]}));
 x=lab.retrySyntheticPropagation({requestId:ID1});
 assert.equal(x.state,"PROPAGATING");
 for(const target of TARGETS.slice(1))x=lab.acknowledgeSyntheticTarget({requestId:ID1,target});
 assert.equal(x.state,"PURGED_SYNTHETIC_ONLY");
});
test("G45-L4-11: duplicate store acknowledgements and identical requests are idempotent; conflicts rejected",()=>{
 const lab=createSyntheticPropagationLab();start(lab);
 assert.equal(start(lab).idempotentReplay,true);
 denied(()=>start(lab,ID1,"tenant-beta"));
 denied(()=>start(lab,ID2,"tenant-alpha"));
 lab.beginSyntheticExecution({requestId:ID1});lab.beginSyntheticPropagation({requestId:ID1});
 const first=lab.acknowledgeSyntheticTarget({requestId:ID1,target:TARGETS[0]});
 const second=lab.acknowledgeSyntheticTarget({requestId:ID1,target:TARGETS[0]});
 assert.equal(first.acknowledgedTargets,1);
 assert.equal(second.acknowledgedTargets,1);
});
test("G45-L4-12: tombstone blocks old replay; newer policy epoch never grants live permission",()=>{
 const lab=createSyntheticPropagationLab();
 start(lab);
 assert.equal(lab.checkSyntheticReplay({tenantId:"tenant-alpha",videoId:"Ab0_-123xyz",jobPolicyEpoch:3}).decision,
   "REPLAY_BLOCKED_BY_TOMBSTONE");
 assert.equal(lab.checkSyntheticReplay({tenantId:"tenant-alpha",videoId:"Ab0_-123xyz",jobPolicyEpoch:5}).decision,
   "REAL_REPLAY_NOT_AUTHORIZED");
 assert.equal(lab.checkSyntheticReplay({tenantId:"tenant-alpha",videoId:"Ab0_-123xyz",jobPolicyEpoch:5}).mayIssueProviderRequest,false);
 denied(()=>lab.checkSyntheticReplay({tenantId:"tenant-other",videoId:"Ab0_-123xyz",jobPolicyEpoch:3}));
});
test("G45-L4-13: tenant scopes are isolated in the synthetic model",()=>{
 const lab=createSyntheticPropagationLab();
 start(lab,ID1,"tenant-alpha");
 const x=start(lab,ID2,"tenant-beta");
 assert.equal(x.state,"PENDING");
 assert.equal(lab.checkSyntheticReplay({tenantId:"tenant-beta",videoId:"Ab0_-123xyz",jobPolicyEpoch:4}).decision,
   "REPLAY_BLOCKED_BY_TOMBSTONE");
 assert.equal(lab.beginSyntheticExecution({requestId:ID1}).state,"EXECUTING");
 assert.equal(lab.beginSyntheticExecution({requestId:ID2}).state,"EXECUTING");
});
test("G45-L4-14: offline source cannot access network, storage, credentials or provider APIs",()=>{
 assert.doesNotMatch(source,/require\s*\(\s*["'](?:node:)?(?:fs|http|https|net|child_process|pg|ioredis)["']/);
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|axios|googleapis|process\.env|fs\.write|fs\.unlink|DELETE\s+FROM|DROP\s+TABLE/);
 for(const v of Object.values(contract.approvals)) assert.equal(v,false);
 for(const v of Object.values(contract.effects)) assert.equal(v,0);
 assert.equal(contract.syntheticLab.noTransport,true);
 assert.equal(contract.syntheticLab.noCredentialAccess,true);
 assert.equal(contract.syntheticLab.noPersistentWrites,true);
 assert.equal(contract.syntheticLab.noProductionDeletes,true);
 assert.match(guide,/G45-L4/);
 assert.match(guide,/POLICY_HOLD/);
 assert.match(guide,/E07/);
 assert.match(guide,/E08/);
});
