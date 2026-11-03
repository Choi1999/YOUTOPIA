"use strict";
/** G45-L3: purely local/offline cross-contract guards. No provider calls. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const load=(name)=>JSON.parse(fs.readFileSync(path.join(root,name),"utf8"));
const m=load("g45-l3-windows-security-lifecycle.v01.json");
const p=load("policy-gates.json");
const w=load("windows-local-boundary.v01.json");
const source=fs.readFileSync(path.join(root,"scripts/windows-local-preflight.cjs"),"utf8");
const guide=fs.readFileSync(path.join(root,"../../../docs/integration/YU32_G45_L3_WINDOWS_AUTH_EVIDENCE_LIFECYCLE_V01.md"),"utf8");
const prior=fs.readFileSync(path.join(root,"../../../docs/integration/YU32_G4_5_WINDOWS_LOCAL_BACKEND_POC_V01.md"),"utf8");

test("G45-L3-01: G45 L3 is design-only and cannot serve as runtime policy authority",()=>{
 assert.equal(m.contractVersion,"YU32_G45_L3_WINDOWS_SECURITY_LIFECYCLE_V01");
 assert.equal(m.status,"OFFLINE_DESIGN_ONLY");
 assert.match(m.authority,/NON_EXECUTABLE/);
 assert.equal(m.policy.status,"POLICY_HOLD");
 assert.equal(m.policy.reviewedEvidenceCount,0);
});
test("G45-L3-02: source policy is still the 12-gate unverified hold",()=>{
 assert.equal(m.authoritativeGatePath,"shared/contracts/yu32-youtube-readiness-v0/policy-gates.json");
 assert.equal(p.status,"POLICY_HOLD");
 assert.equal(p.verifiedCount,0);
 assert.equal(p.externalDataCollected,false);
 assert.equal(p.liveCallsAuthorized,false);
 assert.equal(p.derivedSentimentAuthorized,false);
 const expected=Array.from({length:12},(_,i)=>"Y45-E"+String(i+1).padStart(2,"0"));
 assert.deepEqual(m.evidence.requiredIds,expected);
 assert.deepEqual(p.evidence.map(e=>e.id),expected);
 assert.equal(m.evidence.verifiedCount,0);
 assert.equal(m.evidence.evidenceReceiptsInRepository,false);
 assert.equal(m.evidence.independentReviewerRequired,true);
 assert.equal(m.evidence.consentAndAnalyticsUseCaseApproved,false);
});
test("G45-L3-03: authentication candidate is not an implemented or approved choice",()=>{
 const a=m.authentication;
 assert.equal(a.selectedMode,"NONE_PENDING_YOUTUBE_AND_PROJECT_VERIFICATION");
 assert.deepEqual(a.youtubeDocumentedCandidates,["API_KEY_QUERY_KEY_PARAMETER","OAUTH2_AUTHORIZATION_BEARER"]);
 assert.equal(a.genericGoogleApiKeyHeader,"x-goog-api-key");
 assert.equal(a.youtubeSpecificHeaderSupportVerified,false);
 for(const key of ["useHeaderForYouTube","useQueryApiKeyForLive","useOAuthForLive","credentialProvisioningAuthorized","keyReadOrWriteImplemented"])
  assert.equal(a[key],false,key);
});
test("G45-L3-04: candidate Windows secret/IP controls never imply verification",()=>{
 const a=m.authentication;
 assert.equal(a.secretStoreCandidate,"WINDOWS_CREDENTIAL_MANAGER_DPAPI_NOT_CONFIGURED");
 assert.equal(a.apiRestrictionCandidate,"youtube.googleapis.com");
 assert.equal(a.applicationRestrictionCandidate,"PUBLIC_EGRESS_IP");
 for(const k of ["apiRestrictionObserved","actualPublicEgressIpObserved","allowlistMatchesCurrentIpVerified","automaticUnrestrictedFallback","loggingCredentialOrUrlAllowed"])
  assert.equal(a[k],false,k);
 assert.equal(a.manualRotationAndRevocationRunbookRequired,true);
 assert.equal(w.keySecurity.allowUnrestrictedKeyFallback,false);
});
test("G45-L3-05: no transport, server, DB, browser automation or secret reader",()=>{
 for(const [key,value] of Object.entries(m.runtime))
  if(key!=="candidate")assert.equal(value,false,key);
 assert.equal(m.firstPageCandidate.liveDispatcherImplemented,false);
 assert.equal(m.firstPageCandidate.transportEnabled,false);
 assert.equal(w.approvals.makeRealYouTubeCall,false);
 assert.equal(w.approvals.createCredentials,false);
});
test("G45-L3-06: proposed requests remain bounded and do not authorize any calls",()=>{
 const q=m.firstPageCandidate;
 assert.equal(q.source,"YOUTUBE");
 assert.equal(q.minVideos,1);
 assert.equal(q.maxVideos,3);
 assert.equal(q.maxThreadsPerPage,100);
 assert.equal(q.pagesPerVideo,1);
 assert.equal(q.allowedHttpMethod,"GET");
 assert.equal(q.allowedHost,"www.googleapis.com");
 assert.equal(q.allowedPath,"/youtube/v3/commentThreads");
 assert.deepEqual(q.requiredQuery,["part=snippet","order=time","textFormat=plainText"]);
 assert.equal(q.quotaUnitsPerCall,1);
 assert.equal(q.plannedMaxRequests,3);
 assert.equal(q.plannedMaxQuotaUnits,3);
 assert.equal(q.automaticRetries,0);
 assert.equal(q.redirects,0);
 assert.equal(q.repliesEnumerated,false);
 assert.equal(q.actualQuotaAndProjectCapacityVerified,false);
});
test("G45-L3-07: provider failures and partial data cannot become fake complete sentiment",()=>{
 const f=m.failureHandling;
 for(const key of ["stopOnUnexpectedResponse","failClosedOnCredentialOrIpMismatch","noSentimentFromProviderError","doNotConvertErrorToNoData","missingOrDeletedAndDisabledSeparate","partialPageNeverClaimsPopulation","noAutomaticNextPage","noRawErrorPayloadInLogs"])
  assert.equal(f[key],true,key);
});
test("G45-L3-08: data retention and deletion deadlines are targets, not implemented capabilities",()=>{
 const d=m.lifecycle;
 assert.equal(d.rawCommentPersistenceAllowed,false);
 assert.equal(d.realSentimentProcessingAllowed,false);
 assert.equal(d.nonAuthorizedDataRefreshOrDeleteByDays,30);
 assert.equal(d.userDataErasureByCalendarDays,7);
 assert.equal(d.productionLifecycleImplemented,false);
 assert.equal(w.providerGates.rawLifecycle,"NOT_IMPLEMENTED");
});
test("G45-L3-09: administrator manual deletion is distinct from mandatory system deletion",()=>{
 const d=m.lifecycle;
 assert.equal(d.adminManualDeletionRequiresServerAuthenticatedAdmin,true);
 assert.equal(d.systemExpiryWithoutAdmin,true);
 assert.equal(d.systemUserErasureWithoutAdmin,true);
 assert.equal(d.erasureTarget,"YOUTOPIA_STORED_DATA_NOT_YOUTUBE_ORIGINAL");
 assert.equal(d.tombstoneAndPolicyEpochRequired,true);
 assert.equal(d.noPurgedStatusBeforePropagationVerified,true);
 assert.deepEqual(d.deletionStages,["PENDING","EXECUTING","PROPAGATING","PURGED","PURGE_FAILED"]);
});
test("G45-L3-10: deletion covers all copies and cannot claim PURGED on partial failure",()=>{
 const required=["raw-and-identity","snapshot-and-derived","report","search-index",
   "server-cache","client-and-cdn-cache","job-and-outbox","temporary-export","backup-and-restore-fence"];
 assert.deepEqual(m.lifecycle.propagationTargets,required);
 assert.equal(m.lifecycle.noPurgedStatusBeforePropagationVerified,true);
});
test("G45-L3-11: no approvals, network calls, data access or production deletion",()=>{
 for(const [key,value] of Object.entries(m.approvals)) assert.equal(value,false,key);
 for(const [key,value] of Object.entries(m.effects))assert.equal(value,0,key);
});
test("G45-L3-12: offline preflight and docs do not enable network or an unverified key header",()=>{
 assert.doesNotMatch(source,/\bfetch\s*\(|node:https|node:http|XMLHttpRequest|axios|createServer\s*\(/);
 assert.match(source,/G45_LOCAL_STOP/);
 assert.match(guide,/G45-L3/);
 assert.match(guide,/POLICY_HOLD/);
 assert.match(guide,/E01~E12/);
 assert.match(guide,/2026-11-03/);
 assert.match(prior,/x-goog-api-key/);
 assert.match(prior,/YouTube Data API v3/);
 assert.match(prior,/공식 근거/);
});
