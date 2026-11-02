"use strict";
/** G45 server-only collector: offline architecture invariants, no cloud/API actions. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=path.resolve(__dirname,"..");
const manifest=JSON.parse(fs.readFileSync(path.join(base,"server-boundary.v01.json"),"utf8"));
const gates=JSON.parse(fs.readFileSync(path.join(base,"policy-gates.json"),"utf8"));
const contract=require("../source-plan.cjs");
const doc=fs.readFileSync(path.join(base,"../../../docs/integration/YU32_G4_5_SERVER_COLLECTOR_HOSTING_SECURITY_V01.md"),"utf8");
const policy=fs.readFileSync(path.join(base,"../../../docs/integration/YU32_G4_5_YOUTUBE_SOURCE_READINESS_V01.md"),"utf8");

test("G45-H01: runtime is private, manually executed server workload only",()=>{
  assert.equal(manifest.runtime.candidate,"CLOUD_RUN_JOB");
  assert.equal(manifest.runtime.execution,"MANUAL_IAM_OPERATOR_ONLY");
  assert.equal(manifest.runtime.publicEndpoint,false);
  assert.equal(manifest.runtime.inboundPublicService,false);
  assert.equal(manifest.runtime.deployed,false);
  assert.equal(manifest.runtime.scheduleEnabled,false);
  assert.equal(manifest.runtime.automaticRetries,0);
  assert.equal(manifest.runtime.maxParallelRuns,1);
});
test("G45-H02: backend-only direction cannot authorize cloud spend or live call",()=>{
  assert.equal(manifest.approval.backendOnlyDirection,true);
  for(const key of ["cloudRuntimeProvisioning","cloudSpend","apiKeyCreation",
    "enableNewCloudAPIs","liveCommentRead","derivedSentiment","prMerge"])
    assert.equal(manifest.approval[key],false,key);
  assert.equal(manifest.externalRequestsMade,0);
  assert.equal(manifest.productionChangesMade,0);
});
test("G45-H03: restricted API key must remain absent, and OAuth is not silently created",()=>{
  assert.equal(manifest.credentials.enabled,false);
  assert.equal(manifest.credentials.apiKeyCreated,false);
  assert.equal(manifest.credentials.oauthClientCreated,false);
  assert.equal(manifest.credentials.secretCreated,false);
  assert.equal(manifest.credentials.executableReadPath,false);
  assert.equal(manifest.credentials.secretValueInRepo,false);
  assert.equal(manifest.credentials.storageCandidate,"GOOGLE_SECRET_MANAGER");
  assert.equal(manifest.credentials.apiRestrictionService,"youtube.googleapis.com");
});
test("G45-H04: server API key requires a reserved external egress IP and single application restriction",()=>{
  assert.equal(manifest.credentials.applicationRestriction,"STATIC_PUBLIC_EGRESS_IP");
  assert.equal(manifest.credentials.ipRestrictionConfigured,false);
  assert.equal(manifest.networking.outboundRuntimeDefault,"DYNAMIC_IP_POOL");
  assert.equal(manifest.networking.egressCandidate,"DIRECT_VPC_ALL_TRAFFIC_CLOUD_NAT_STATIC_IP");
  for(const k of ["vpcCreated","natCreated","reservedPublicIpCreated","staticIpObserved","sourceIpTested","estimateApproved"])
    assert.equal(manifest.networking[k],false,k);
});
test("G45-H05: manifest never contains concrete secret or project identifier",()=>{
  const raw=JSON.stringify(manifest);
  assert.doesNotMatch(raw,/youtopia-513507|AIza[0-9A-Za-z_-]{25,}|oauthToken|refreshToken/);
  assert.equal(manifest.projectEvidence.projectIdVisibleInQuotaScreenshot,false);
  assert.equal(manifest.projectEvidence.projectOwnerIndependentlyVerified,false);
  assert.equal(manifest.projectEvidence.verifiedGateCount,0);
  assert.equal(manifest.projectEvidence.userScreenshotQuotaPerDay,10000);
  assert.equal(manifest.projectEvidence.userScreenshotCurrentUsage,0);
});
test("G45-H06: intended first PoC has fixed request and sampling boundaries",()=>{
  assert.equal(manifest.worker.source,"YOUTUBE");
  assert.equal(manifest.worker.targetType,"VIDEO");
  assert.equal(manifest.worker.maxVideos,3);
  assert.equal(manifest.worker.maxPagesPerVideo,1);
  assert.equal(manifest.worker.maxThreadsPerPage,100);
  assert.equal(manifest.worker.repliesEnabled,false);
  assert.equal(manifest.worker.maxExternalRequests,3);
  assert.equal(manifest.worker.maxPlannedQuotaUnitsWithoutErrors,3);
});
test("G45-H07: no raw comment, sentiment, production write or published snapshot",()=>{
  for(const key of ["persistRawComments","logRawComments","writeProductionDatabase","publishSnapshots","runNlp"])
    assert.equal(manifest.worker[key],false,key);
  assert.equal(contract.policyGateSnapshot().liveApiRequests,0);
});
test("G45-H08: never modify Spring read-only DB and deny-all unknown routes",()=>{
  const b=manifest.referenceBackend;
  assert.equal(b.branch,"feat/backend-bootstrap");
  assert.equal(b.commit,"7e24bb90058d717226315f4f921aa04535747775");
  assert.equal(b.javaToolchain,21);
  assert.equal(b.springBoot,"4.0.9");
  assert.equal(b.existingDefaultDataSourceReadOnly,true);
  assert.equal(b.existingUnknownRoutesDenyAll,true);
  assert.equal(b.existingBackendModifiedByThisProposal,false);
});
test("G45-H09: provider policy, privacy and first-call approvals are all pending",()=>{
  assert.equal(gates.verifiedCount,0);
  assert.equal(gates.status,"POLICY_HOLD");
  assert.equal(manifest.gates.basicSourceUse,"POLICY_HOLD");
  assert.equal(manifest.gates.derivedMetrics,"POLICY_HOLD");
  assert.equal(manifest.gates.rawLifecycle,"NOT_IMPLEMENTED");
  assert.equal(manifest.gates.firstLiveCall,"NOT_APPROVED");
  assert.equal(manifest.gates.cloudResourceCost,"NOT_APPROVED");
  assert.equal(manifest.gates.productionAuthorization,"NOT_APPROVED");
});
test("G45-H10: backend architecture document records cost and Cloud Run key restrictions",()=>{
  for(const v of ["Cloud Run Job","Secret Manager","Cloud NAT","all-traffic",
    "고정 공인","비용","POLICY_HOLD","2026-11-02"])
    assert.ok(doc.includes(v),v);
  assert.ok(policy.includes("LIVE_CALLS=0"));
  assert.ok(doc.includes("No API")||doc.includes("API 키"));
});
test("G45-H11: planning code is still non-executable provider metadata only",()=>{
  const query=contract.proposeFirstPublicCommentRead({videoIds:["Ab0_-123xyz"]});
  assert.equal(query.collectionAuthorized,false);
  assert.equal(query.networkRequestsPermitted,0);
  assert.equal(query.derivedMetricsAuthorized,false);
  assert.equal(query.requestCandidates.length,1);
});
test("G45-H12: no runtime secret, key-file, Docker, Cloud job or access token in proposal",()=>{
  const raw=fs.readFileSync(path.join(base,"server-boundary.v01.json"),"utf8");
  assert.doesNotMatch(raw,/\bAIza[0-9A-Za-z_-]{25,}|\bghp_[0-9A-Za-z]+|-----BEGIN PRIVATE KEY-----/);
  assert.doesNotMatch(doc,/gcloud\s+run\s+jobs\s+execute|gcloud\s+run\s+jobs\s+create/);
  assert.equal(manifest.approval.cloudSpend,false);
});
