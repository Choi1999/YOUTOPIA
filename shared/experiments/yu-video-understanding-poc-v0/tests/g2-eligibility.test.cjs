'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const g1=require('../g1-offline.cjs');
const g2=require('../g2-source-provider.cjs');
const clone=x=>structuredClone(x);
const invalid=(fn,pattern=/G2_FAIL_CLOSED/)=>assert.throws(fn,pattern);

test('G2 preserves six synthetic placeholder slots with two per genre',()=>{
 const m=g2.inventory(),r=g2.assessInventory(m);
 assert.deepEqual(m.candidates.map(c=>c.category).sort(),['ACTION','ACTION','INTERVIEW','INTERVIEW','SCREENCAST','SCREENCAST']);
 assert.equal(r.sourceCandidates.length,6);assert.equal(r.sourceRightsVerifiedCount,0);
});
test('all candidates are unselected and have no media, URLs, reviewer claims',()=>{
 const m=g2.inventory();
 for(const c of m.candidates){assert.equal(c.sourceKind,'NOT_SELECTED');assert.equal(c.videoLocator,null);
 assert.equal(c.mediaAttached,false);assert.equal(c.rightsState,'UNVERIFIED');assert.equal(c.humanReviewerCount,0);}
});
test('source identity cannot silently change',()=>{
 const m=g2.inventory();m.candidates[0].videoRef='REAL-VIDEO';invalid(()=>g2.assessInventory(m),/candidate/);
});
test('duplicated source identity rejected',()=>{
 const m=g2.inventory();m.candidates[1].videoRef=m.candidates[0].videoRef;invalid(()=>g2.assessInventory(m),/candidate/);
});
test('missing source slot rejected',()=>{
 const m=g2.inventory();m.candidates.pop();invalid(()=>g2.assessInventory(m),/six slots/);
});
test('category switches blocked',()=>{
 const m=g2.inventory();m.candidates[0].category='ACTION';invalid(()=>g2.assessInventory(m),/category/);
});
test('external YouTube URL cannot enter offline manifest',()=>{
 const m=g2.inventory();m.candidates[0].videoLocator='https://www.youtube.com/watch?v=abcdefghijk';
 invalid(()=>g2.assessInventory(m),/real source/);
});
test('real attached media cannot enter offline G2',()=>{
 const m=g2.inventory();m.candidates[0].mediaAttached=true;invalid(()=>g2.assessInventory(m),/real source/);
});
test('rights verified Boolean alone cannot authorize media access',()=>{
 const m=g2.inventory();m.candidates[0].verifiedByIndependentReviewer=true;invalid(()=>g2.assessInventory(m),/rights claim/);
});
test('arbitrary license status cannot pass rights verification',()=>{
 const m=g2.inventory();m.candidates[0].rightsState='VERIFIED_FOR_SCOPE';invalid(()=>g2.assessInventory(m),/rights claim/);
});
test('fake evidence pointer cannot bypass rights gate',()=>{
 const m=g2.inventory();m.candidates[0].rightsEvidenceLocation='approval.pdf';invalid(()=>g2.assessInventory(m),/rights claim/);
});
test('processing permission flags cannot be self-asserted',()=>{
 for(const k of ['permissionToAnalyze','permissionToTransmit','permissionToStoreDerivatives']){
   const m=g2.inventory();m.candidates[0][k]=true;invalid(()=>g2.assessInventory(m),/processing permission/);
 }
});
test('privacy and source authorization must be separately reviewed',()=>{
 for(const k of ['privacyAndRetentionReviewed','accessScopeVerified']){
  const m=g2.inventory();m.candidates[0][k]=true;invalid(()=>g2.assessInventory(m),/privacy and source/);
 }
});
test('self-labeled gold annotations cannot satisfy human review',()=>{
 for(const [k,value] of [['humanGoldLabelsVerified',true],['humanReviewerCount',2]]){
  const m=g2.inventory();m.candidates[0][k]=value;invalid(()=>g2.assessInventory(m),/gold labels/);
 }
});
test('comparison readiness cannot be self asserted',()=>{
 const m=g2.inventory();m.candidates[0].comparableAcrossAllArms=true;invalid(()=>g2.assessInventory(m),/gold labels/);
});
test('the source review stays offline irrespective of documentation',()=>{
 const r=g2.assessInventory(g2.inventory());
 assert.equal(r.liveCallsAuthorized,false);assert.equal(r.approvedForG3,false);
 assert.equal(r.providerApiVerifiedForAccount,false);assert.equal(r.sameDatasetAcrossThreeArmsVerified,false);
 assert.equal(r.actualSpendUsd,0);
});
test('any claimed API call is rejected',()=>{
 const m=g2.inventory();m.externalCalls=1;invalid(()=>g2.assessInventory(m),/live input/);
});
test('non-placeholder manifest provenance rejected',()=>{
 const m=g2.inventory();m.provenance='REAL_MEDIA';invalid(()=>g2.assessInventory(m),/live input/);
});
test('all provider documentation references are HTTPS and explicit',()=>{
 const p=g2.providerReview();
 assert.equal(p.references.length,6);
 for(const d of p.references){assert.match(d.url,/^https:\/\/(ai\.google\.dev|developers\.google\.com)\//);
 assert.equal(d.confidence,'DOCUMENTATION_ONLY');}
});
test('Google video input and URL-context are not conflated',()=>{
 const p=g2.providerReview();
 assert.equal(p.publicYouTubeUrlSupport,'DOCUMENTED_PREVIEW_PUBLIC_ONLY');
 assert.ok(p.constraints.includes('URL_CONTEXT_NOT_VIDEO_INPUT'));
});
test('account approval is independent of public documentation',()=>{
 const p=g2.providerReview();
 assert.equal(p.documentationObserved,true);
 assert.equal(p.accountSpecificServiceEnabled,null);
 assert.equal(p.accountModelAccessVerified,false);
 assert.equal(p.arms.filter(x=>x.approvedForLive).length,0);
 assert.equal(p.arms.length,3);
});
test('public pricing snapshot is not validated project billing',()=>{
 const p=g2.providerReview().apiModelPricing;
 assert.equal(p.modelId,'gemini-3.5-flash-lite');
 assert.equal(p.perMillionInputUsd,0.30);
 assert.equal(p.perMillionOutputUsd,2.50);
 assert.equal(p.tokenMixMeasured,false);
});
test('60k input + 1k output has documented-rate token component 0.0205 USD',()=>{
 const p=g2.estimateTokenComponent({inputTokens:60000,outputTokens:1000});
 assert.equal(p.tokenComponentUsd,.0205);
 assert.equal(p.estimatedEndToEndTotalUsd,null);
 assert.equal(p.realProviderUsageObserved,false);
 assert.equal(p.canAuthorizeSpend,false);
});
test('a missing token measurement stays unknown, not zero',()=>{
 const p=g2.estimateTokenComponent({inputTokens:null,outputTokens:1000});
 assert.equal(p.tokenComponentUsd,null);
});
test('zero observed tokens is distinct from missing token measurement',()=>{
 const p=g2.estimateTokenComponent({inputTokens:0,outputTokens:0});
 assert.equal(p.tokenComponentUsd,0);
 assert.equal(p.estimatedEndToEndTotalUsd,null);
});
test('unverified price overrides blocked even if plausible',()=>{
 invalid(()=>g2.estimateTokenComponent({inputTokens:60000,outputTokens:1000},{...g2.PRICING,perMillionInputUsd:0}),/snapshot override/);
});
test('negative, fractional and string token values rejected',()=>{
 for(const usage of [
  {inputTokens:-1,outputTokens:0},
  {inputTokens:3.14,outputTokens:0},
  {inputTokens:'60000',outputTokens:1000},
  {inputTokens:Infinity,outputTokens:0}
 ])invalid(()=>g2.estimateTokenComponent(usage),/invalid tokens/);
});
test('G2 output is blocked despite official evidence links',()=>{
 const r=g2.run();
 assert.equal(r.status,'SOURCE_PROVIDER_DOCUMENT_REVIEW_ONLY');
 assert.equal(r.decision,'NO_GO_LIVE_SOURCE_RIGHTS_AND_ACCOUNT_EVIDENCE_MISSING');
 assert.equal(r.externalCalls,0);assert.equal(r.actualSpendUsd,0);
 assert.equal(r.liveCallsAuthorized,false);assert.equal(r.mergeApproved,false);
});
test('G1 benchmark remains isolated and synthetic',()=>{
 const x=g1.run();
 assert.equal(x.status,'OFFLINE_ONLY');assert.equal(x.externalCalls,0);
 assert.equal(x.dataset.questions,36);assert.equal(x.quality.liveAccuracyVerified,false);
});
