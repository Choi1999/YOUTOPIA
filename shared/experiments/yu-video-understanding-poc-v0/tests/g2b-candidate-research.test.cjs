'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const g1=require('../g1-offline.cjs');
const g2=require('../g2-source-provider.cjs');
const g2b=require('../g2b-research-audit.cjs');
const copy=v=>structuredClone(v);
const invalid=(m,pattern=/G2B_FAIL_CLOSED/)=>assert.throws(()=>g2b.audit(m),pattern);
test('research manifest has exactly six canonical candidates',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.documentedCandidates,6);
 assert.deepEqual(r.genres,{INTERVIEW:2,SCREENCAST:2,ACTION:2});
});
test('all six candidates remain blocked from actual data use',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.approvedRealDatasetCount,0);assert.equal(r.sourceRightsVerified,0);
 for(const row of r.rows){assert.equal(row.readyForLive,false);assert.equal(row.goldReviewed,false);assert.equal(row.youtubeSameVersionVerified,false);assert.ok(row.blockers.length>=5);}
});
test('registered media and caption availability is metadata only',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.officialVideoListings,5);
 assert.equal(r.officialTimedCaptionListings,3);assert.equal(r.officialTranscriptListings,3);
 assert.equal(r.mediaOrCaptionBytesDownloaded,false);
});
test('only three YouTube pointers are documented without version equivalence',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.externallyDocumentedYouTubePointers,3);
 assert.equal(r.youtubeToSourceVersionMatchesVerified,0);
});
test('no human reviewed gold labels or alignment claims',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.humanReviewedGoldQuestionCount,0);
 assert.equal(r.captionTimelineAlignmentsVerified,0);
});
test('G2-B does not use API, spend money, or merge',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.actualProviderCalls,0);assert.equal(r.actualSpendUsd,0);
 assert.equal(r.liveCallsAuthorized,false);assert.equal(r.mergeAuthorized,false);
});
test('research registry hash is not a video fingerprint',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.sourceHashKind,'PUBLIC_REGISTRY_CONTENT_SHA256_NOT_VIDEO_HASH');
 assert.match(r.registryDigestSha256,/^[a-f0-9]{64}$/);
});
test('NASA footage cannot be silently classified as blanket CC BY',()=>{
 const m=g2b.load();m.candidates[0].policyClass='CC_BY_3_0_DOCUMENTED';invalid(m,/canonical/);
});
test('Blender open movie attribution does not become scope-approved status',()=>{
 const m=g2b.load();for(const c of m.candidates.slice(4)){
 assert.equal(c.policyClass,'CC_BY_3_0_DOCUMENTED');assert.equal(c.rightsScopeState,'UNVERIFIED_FOR_YOUTOPIA');}
});
test('third-party interview music is called out as a rights blocker',()=>{
 const r=g2b.audit(g2b.load());assert.ok(r.rows[1].blockers.includes('THIRD_PARTY_MUSIC_PERMISSION_NOT_CLEARED'));
});
test('actor portrait rights remain unverified for Tears of Steel',()=>{
 const r=g2b.audit(g2b.load());assert.ok(r.rows[5].blockers.includes('IDENTIFIABLE_PERSON_COMMERCIAL_RIGHTS_NOT_REVIEWED'));
});
test('video unknown for NASA exoplanets remains missing original and YouTube references',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.rows[3].officialMediaListed,false);
 assert.equal(r.rows[3].youtubePointerDocumented,false);
});
test('missing timed captions are not mislabeled as aligned transcript',()=>{
 const r=g2b.audit(g2b.load());assert.equal(r.rows[2].officialTimedCaptionsListed,false);
 assert.ok(r.rows[2].blockers.includes('OFFICIAL_TIMED_CAPTIONS_NOT_IDENTIFIED'));
});
test('cannot inject a provider API call in registry',()=>{
 const m=g2b.load();m.externalProviderCalls=1;invalid(m,/live transport/);
});
test('cannot inject media or caption download state',()=>{
 for(const field of ['realMediaDownloaded','captionsDownloaded','rawTranscriptStored']){
   const m=g2b.load();m[field]=true;invalid(m,/raw media/);
 }
});
test('cannot inject account credential usage',()=>{
 const m=g2b.load();m.accountCredentialsUsed=true;invalid(m,/live transport/);
});
test('cannot self-approve service rights or dataset comparability',()=>{
 for(const field of ['rightsApprovedForService','comparabilityVerified','humanAnnotationsVerified','liveCallsAuthorized']){
   const m=g2b.load();m[field]=true;invalid(m);
 }
});
test('cannot add unreviewed candidate metadata fields',()=>{
 const m=g2b.load();m.candidates[0].operatorApproved=true;invalid(m,/unexpected/);
});
test('cannot add unreviewed top-level authorization fields',()=>{
 const m=g2b.load();m.force=true;invalid(m,/unexpected/);
});
test('missing registry field cannot bypass audit',()=>{
 const m=g2b.load();delete m.rightsApprovedForService;invalid(m,/unexpected/);
});
test('duplicate candidate rejected regardless of row ordering',()=>{
 const m=g2b.load();m.candidates[1].slot=m.candidates[0].slot;invalid(m,/canonical source mismatch|duplicate/);
});
test('canonical primary source may not be silently replaced',()=>{
 const m=g2b.load();m.candidates[0].primarySource='https://science.nasa.gov/';invalid(m,/canonical/);
});
test('YouTube watch ID mismatch fails closed',()=>{
 const m=g2b.load();m.candidates[2].youtubeWatchUrl='https://www.youtube.com/watch?v=ABCDEFGHIJK';invalid(m,/canonical/);
});
test('candidate cannot be promoted into an approved dataset',()=>{
 const m=g2b.load();m.candidates[0].selectionStatus='APPROVED';invalid(m,/rights status/);
});
test('rights scope approval from public license page is rejected',()=>{
 const m=g2b.load();m.candidates[5].rightsScopeState='VERIFIED_FOR_SCOPE';invalid(m,/rights status/);
});
test('made-up media and transcript hashes cannot confirm equality',()=>{
 for(const k of ['authorizedLocalMediaSha256','youtubeEquivalentMediaSha256','captionOrTranscriptSha256']){
   const m=g2b.load();m.candidates[4][k]='0'.repeat(64);invalid(m,/unverified media checksums/);
 }
});
test('forged aligned captions or video equivalence rejected',()=>{
 for(const k of ['youtubeMediaEqualityState','captionAlignmentState']){
  const m=g2b.load();m.candidates[0][k]='VERIFIED';invalid(m,/source identity/);
 }
});
test('duration cannot be assumed verified without reading video',()=>{
 const m=g2b.load();m.candidates[0].durationSecondsVerified=400;invalid(m,/approval or review/);
});
test('self-asserted human review counts cannot unlock gold labels',()=>{
 for(const field of ['independentRightsReviewers','independentGoldReviewers']){
  const m=g2b.load();m.candidates[0][field]=2;invalid(m,/approval or review/);
 }
});
test('catalog alone cannot grant actual content ingestion',()=>{
 const m=g2b.load();m.candidates[0].contentIngestApproved=true;invalid(m,/approval or review/);
});
test('G1 and G2 previous offline gates remain unchanged',()=>{
 const g1r=g1.run(),g2r=g2.run();
 assert.equal(g1r.externalCalls,0);assert.equal(g1r.liveCallsAuthorized,false);
 assert.equal(g2r.externalCalls,0);assert.equal(g2r.liveCallsAuthorized,false);
 assert.equal(g2r.source.sourceRightsVerifiedCount,0);
});
