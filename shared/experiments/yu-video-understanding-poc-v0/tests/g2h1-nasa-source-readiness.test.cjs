'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const gate=require('../g2h1-nasa-source-readiness.cjs');
function load(name){return JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));}
const baseline=()=>load('g2h1-nasa-source-readiness.json');
const b=()=>load('g2b-public-candidates.json');
const h=()=>load('g2h-expansion-blueprint.json');
const validate=(p)=>gate.validate(p,b(),h());
test('G2-H1 public NASA research identifies two official movie listings without media, rights or G3 approvals',()=>{
 const result=gate.inspect();
 assert.equal(result.stage,'G2-H1');
 assert.equal(result.checkedCandidates,2);
 assert.equal(result.officialVideoListings,2);
 assert.equal(result.officialTimedCaptionListings,1);
 assert.equal(result.officialYouTubeIdsEstablished,1);
 assert.equal(result.verifiedFilmRuntimes,0);
 assert.equal(result.verifiedSameEditPairs,0);
 assert.equal(result.scopedRightsApproved,0);
 assert.equal(result.realMediaIngestApproved,0);
 assert.equal(result.blindGoldApproved,0);
 assert.equal(result.g3Authorized,false);
 assert.equal(result.externalProviderCalls,0);
 assert.equal(result.actualSpendUsd,0);
});
test('VID-01 source lists MP4, caption SRT/VTT and transcript without official verified YouTube video ID',()=>{
 const first=baseline().candidates.find(c=>c.slot==='SYNTH-VID-01');
 assert.equal(first.category,'INTERVIEW');
 assert.equal(first.officialMovieListed,true);
 assert.equal(first.officialTimedCaptionListed,true);
 assert.equal(first.officialTranscriptListed,true);
 assert.equal(first.officialYouTubePlayerObserved,true);
 assert.equal(first.officialYouTubeId,null);
 assert.equal(first.youtubeIdEstablished,false);
 assert.deepEqual(first.assets.map(x=>x.kind),
  ['MP4_WITHOUT_SUBTITLES','MP4_WITH_SUBTITLES','SRT','VTT','TXT_TRANSCRIPT']);
 assert.equal(first.videoDurationMsVerified,null);
 assert.equal(first.durationWithinG0ThreeToFifteenMin,'UNKNOWN_UNVERIFIED');
 assert.ok(first.officialCredit.includes('STScI'));
 assert.equal(first.rightsForYoutopiaServiceApproved,false);
});
test('VID-03 NASA embeds ID but original MP4 equivalence and official timed captions remain unverified',()=>{
 const x=baseline().candidates.find(c=>c.slot==='SYNTH-VID-03');
 assert.equal(x.officialYouTubeId,'p-6DusnZ1pQ');
 assert.equal(x.youtubeIdEstablished,true);
 assert.equal(x.officialMovieListed,true);
 assert.equal(x.officialTimedCaptionListed,false);
 assert.equal(x.officialTranscriptListed,false);
 assert.equal(x.originalVersusYouTubeEditionVerified,false);
 assert.equal(x.captionAudioAlignmentVerified,false);
 assert.equal(x.videoDurationMsVerified,null);
});
test('H1 refuses to claim valid rights, new downloads, Gold or first external model calls',()=>{
 const cases=[
  ['scopedRightsApprovedCount',1],['mediaIngestApprovedCount',1],['sourceRuntimeVerifiedCount',2],
  ['sourceEditionMatchedCount',1],['independentBlindGoldApproved',1],['g3Authorized',true],
  ['externalProviderCalls',1],['actualSpendUsd',0.25],
  ['noVideoOrCaptionsDownloadedByThisResearch',false],['outputDoesNotCertifyRealMediaOrRights',false]
 ];
 for(const [k,value] of cases){const p=baseline();p[k]=value;assert.throws(()=>validate(p),/G2H1_FAIL_CLOSED/);}
 for(const [k,v] of [
  ['rightsForYoutopiaServiceApproved',true],['localMediaBytesInspected',true],
  ['originalVersusYouTubeEditionVerified',true],['captionAudioAlignmentVerified',true],
  ['videoDurationMsVerified',300000],['durationWithinG0ThreeToFifteenMin','PASS']
 ]){
  const p=baseline();p.candidates[0][k]=v;assert.throws(()=>validate(p),/G2H1_FAIL_CLOSED/);
 }
});
test('H1 refuses fake YouTube ID and altered official caption/asset listing or G2B mismatch',()=>{
 const variants=[
  d=>{d.candidates[0].officialYouTubeId='inventedID11';d.candidates[0].youtubeIdEstablished=true;},
  d=>{d.candidates[1].officialTimedCaptionListed=true;},
  d=>{d.candidates[1].officialYouTubeId=null;d.candidates[1].youtubeIdEstablished=false;},
  d=>{d.candidates[0].assets[0].listedSizeMb=0;},
  d=>{d.candidates[0].officialPage='https://example.com';},
  d=>{d.candidates[1].slot='SYNTH-VID-01';}
 ];
 for(const change of variants){const p=baseline();change(p);assert.throws(()=>validate(p),/G2H1_FAIL_CLOSED/);}
});
test('H1 retains public-source-only policy provenance with explicit source access scope',()=>{
 const p=baseline();
 assert.equal(p.sources.length,2);
 assert.ok(p.sources.some(x=>x.url==='https://www.nasa.gov/nasa-brand-center/images-and-media/'));
 assert.ok(p.sources.some(x=>x.url==='https://developers.google.com/youtube/terms/developer-policies'));
 assert.ok(p.candidates.every(x=>x.status==='PUBLIC_ASSETS_DOCUMENTED_SELECTION_BLOCKED'));
 assert.ok(p.candidates.every(x=>x.blockers.length>=5));
 assert.equal(p.noVideoOrCaptionsDownloadedByThisResearch,true);
 assert.equal(p.outputDoesNotCertifyRealMediaOrRights,true);
});
