"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const code=fs.readFileSync(path.join(root,"src","local-source-adapter.cjs"),"utf8");
const {descriptors,assessOperatorEvidence,classifyOfflineProviderError}=require("../src/local-source-adapter.cjs");
const {buildSyntheticSnapshot}=require("../src/pipeline.cjs");
const A="Ab0_-123xyz",B="Zb0_-123xyz",C="Xb0_-123xyz";
const reason=(f)=>assert.throws(f,/G45_LOCAL_ADAPTER_REJECTED/);
test("G45-S01: one-video descriptor remains non-executable and quota-bounded",()=>{
 const p=descriptors({videoIds:[A]});
 assert.equal(p.version,"G45_LOCAL_YOUTUBE_DESCRIPTOR_V01");
 assert.equal(p.plannedExternalRequests,1);
 assert.equal(p.quotaUnitsPlanned,1);
 assert.equal(p.actualExternalRequests,0);
 assert.equal(p.quotaUnitsConsumed,0);
 assert.equal(p.sourcePolicy,"POLICY_HOLD");
 assert.equal(p.liveCollectionAuthorized,false);
 assert.equal(p.networkTransportEnabled,false);
 assert.equal(p.candidates.length,1);
});
test("G45-S02: fixed Google hostname and query shape, not a runnable URL",()=>{
 const d=descriptors({videoIds:[A]}).candidates[0];
 assert.deepEqual(d.query,{part:"snippet",videoId:A,maxResults:100,order:"time",textFormat:"plainText"});
 assert.equal(d.hostname,"www.googleapis.com");
 assert.equal(d.pathname,"/youtube/v3/commentThreads");
 assert.equal(d.method,"GET");
 assert.equal(d.transport,"NOT_IMPLEMENTED");
 assert.equal(d.pagination,"FIRST_PAGE_ONLY");
 assert.equal(d.replies,"DISABLED");
 assert.equal(d.automaticRetries,0);
 assert.equal(d.expectedQuotaUnits,1);
});
test("G45-S03: three unique videos are exact upper limit",()=>{
 const p=descriptors({videoIds:[A,B,C]});
 assert.equal(p.candidates.length,3);
 assert.equal(p.plannedExternalRequests,3);
 assert.equal(p.quotaUnitsPlanned,3);
 assert.equal(p.actualExternalRequests,0);
});
test("G45-S04: wrong target and repeated video IDs are denied",()=>{
 for(const bad of [[A,A],["@unresolved"],["short"],["https://youtu.be/a"],
   [A,B,C,"Gb0_-123xyz"],[]])reason(()=>descriptors({videoIds:bad}));
});
test("G45-S05: unbounded page size and malformed maxResults are denied",()=>{
 for(const bad of [0,-1,101,1.5,"100",null,Infinity,NaN])
  reason(()=>descriptors({videoIds:[A],maxResults:bad}));
});
test("G45-S06: smaller page size is supported without larger quota claim",()=>{
 const p=descriptors({videoIds:[A],maxResults:25});
 assert.equal(p.candidates[0].query.maxResults,25);
 assert.equal(p.quotaUnitsPlanned,1);
});
test("G45-S07: locale allowlist and unknown locale denial",()=>{
 assert.equal(descriptors({videoIds:[A],locale:"en-US"}).candidates[0].locale,"en-US");
 for(const bad of ["fr-FR","*",0,"en_US"])
  reason(()=>descriptors({videoIds:[A],locale:bad}));
});
test("G45-S08: client-side approval, role, key, OAuth or pageToken options are forbidden",()=>{
 for(const [name,value] of Object.entries({
  apiKey:"synthetic-example-secret",oauth:true,approved:true,operatorRole:"ADMIN",
  pageToken:"more",includeReplies:true,retryLimit:8,url:"https://example.invalid",
  sink:"production",disableGates:true
 })) reason(()=>descriptors({videoIds:[A],[name]:value}));
});
test("G45-S09: input accessors, symbols, maps and inherited objects are rejected",()=>{
 const tricky={videoIds:[A]};Object.defineProperty(tricky,"maxResults",{enumerable:true,get(){throw Error("accessor executed");}});
 reason(()=>descriptors(tricky));
 reason(()=>descriptors(new Map([["videoIds",[A]]] )));
 reason(()=>descriptors(Object.assign(Object.create({approved:true}),{videoIds:[A]})));
 reason(()=>descriptors({videoIds:[A],[Symbol("anything")]:true}));
});
test("G45-S10: planned request has no key in query and no secret value anywhere",()=>{
 const p=descriptors({videoIds:[A]});
 const txt=JSON.stringify(p);
 assert.equal(p.candidates[0].credentialHeaderName,"x-goog-api-key");
 assert.equal(p.candidates[0].credentialValuePresent,false);
 assert.equal(p.candidates[0].queryContainsKey,false);
 assert.equal(p.authorizedKeysRead,0);
 assert.equal(p.providerDataCollected,0);
 assert.ok(!txt.includes("synthetic-example-secret"));
 assert.ok(!txt.includes("AIza"));
});
test("G45-S11: missing evidence flags are rejected rather than default-true",()=>{
 reason(()=>assessOperatorEvidence({}));
 reason(()=>assessOperatorEvidence({projectVerified:true}));
 reason(()=>assessOperatorEvidence(null));
});
test("G45-S12: complete operator evidence cannot self-authorize real calls",()=>{
 const flags={projectVerified:true,apiEnabled:true,apiRestricted:true,ipRestricted:true,
  publicEgressVerified:true,osVaultVerified:true,policyAccepted:true,
  retentionApproved:true,firstCallApproved:true};
 const r=assessOperatorEvidence(flags);
 assert.equal(r.operatorReportedFlagsComplete,true);
 assert.equal(r.independentEvidenceVerified,false);
 assert.equal(r.mayCollectRealComments,false);
 assert.equal(r.mayComputeDerivedSentiment,false);
 assert.equal(r.callsPermitted,0);
 assert.equal(r.policy,"POLICY_HOLD");
});
test("G45-S13: false key restriction or missing source approval stays closed",()=>{
 const flags={projectVerified:true,apiEnabled:true,apiRestricted:false,ipRestricted:true,
  publicEgressVerified:true,osVaultVerified:true,policyAccepted:false,
  retentionApproved:true,firstCallApproved:true};
 const r=assessOperatorEvidence(flags);
 assert.equal(r.operatorReportedFlagsComplete,false);
 assert.equal(r.mayCollectRealComments,false);
});
test("G45-S14: operator evidence cannot accept actual secret or IP input values",()=>{
 const flags={projectVerified:true,apiEnabled:true,apiRestricted:true,ipRestricted:true,
  publicEgressVerified:true,osVaultVerified:true,policyAccepted:true,
  retentionApproved:true,firstCallApproved:true};
 reason(()=>assessOperatorEvidence({...flags,apiKey:"dont-accept-secrets"}));
 reason(()=>assessOperatorEvidence({...flags,publicIp:"203.0.113.4"}));
 reason(()=>assessOperatorEvidence({...flags,firstCallApproved:1}));
});
test("G45-S15: comments disabled is not a zero-comment successful page",()=>{
 const o=classifyOfflineProviderError({status:403,reason:"commentsDisabled"});
 assert.equal(o.status,"COMMENTS_DISABLED");
 assert.equal(o.sample,null);
 assert.equal(o.sentiment,null);
 assert.deepEqual(o.topics,[]);
 assert.equal(o.providerRequestsMade,0);
});
test("G45-S16: quota and rate-limits do not appear as NO_DATA",()=>{
 for(const v of [{status:403,reason:"quotaExceeded"},{status:429,reason:"rateLimitExceeded"}]){
  const d=classifyOfflineProviderError(v);
  assert.equal(d.status,"ERROR");
  assert.equal(d.errorCode,"QUOTA_OR_RATE_LIMIT");
  assert.equal(d.rawCount,null);
 }
});
test("G45-S17: forbidden/invalid API key is POLICY_BLOCKED, never READY",()=>{
 for(const reasonCode of ["forbidden","apiKeyInvalid"]){
  const d=classifyOfflineProviderError({status:403,reason:reasonCode});
  assert.equal(d.status,"POLICY_BLOCKED");
  assert.equal(d.errorCode,"AUTHORIZATION_FAILED");
 }
});
test("G45-S18: video not found and processing failures have no fabricated sentiment",()=>{
 const n=classifyOfflineProviderError({status:404,reason:"videoNotFound"});
 const p=classifyOfflineProviderError({status:400,reason:"processingFailure"});
 assert.equal(n.status,"ERROR");
 assert.equal(n.errorCode,"NOT_FOUND");
 assert.equal(p.errorCode,"SOURCE_ERROR");
 for(const x of [n,p])assert.equal(x.sentiment,null);
});
test("G45-S19: malformed error envelopes and untrusted provider bodies are rejected",()=>{
 for(const input of [
  {status:200,reason:"unknown"},{status:403,reason:"untrustedRawText"},
  {status:403,reason:"forbidden",body:"private comment text"},
  {status:403,reason:0},{status:"403",reason:"quotaExceeded"},
  {status:403},{status:403,reason:"quotaExceeded",apiKey:"secret"}])
  reason(()=>classifyOfflineProviderError(input));
});
test("G45-S20: synthetic fixture still flows to existing safe analysis-v1 snapshot",()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(root,"fixtures","partial.json"),"utf8"));
 const plan=descriptors({videoIds:[fixture.videoId]});
 const result=buildSyntheticSnapshot(fixture);
 assert.equal(plan.quotaUnitsConsumed,0);
 assert.equal(result.snapshot.isSynthetic,true);
 assert.equal(result.snapshot.sourceType,"STATIC_FIXTURE");
 assert.equal(result.snapshot.status,"PARTIAL");
 assert.equal(result.evidence.providerRequestsMade,0);
});
test("G45-S21: no HTTP SDK, credential access, cloud resources, disk persistence or shell",()=>{
 assert.doesNotMatch(code,/\bfetch\s*\(|node:https|node:http|axios|child_process|XMLHttpRequest|googleapis/);
 assert.doesNotMatch(code,/fs\.write|fs\.unlink|process\.env|x-goog-api-key.*\$\{|DELETE FROM|INSERT INTO/);
});
test("G45-S22: no source gate escalation or an outbound transport exposed by module",()=>{
 const api=require("../src/local-source-adapter.cjs");
 assert.deepEqual(Object.keys(api).sort(),
  ["assessOperatorEvidence","classifyOfflineProviderError","descriptors"].sort());
 const d=descriptors({videoIds:[A]});
 assert.equal(d.candidates[0].query.pageToken,undefined);
 assert.equal(d.candidates[0].query.key,undefined);
 assert.ok(Object.isFrozen(d));
 assert.ok(Object.isFrozen(d.candidates[0].query));
});
