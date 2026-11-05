'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const g = require('../g2c-offline-verifier.cjs');
const g2b = require('../g2b-research-audit.cjs');
const clone = x => structuredClone(x);
const deny = (m,pattern=/G2C_FAIL_CLOSED/) => assert.throws(() => g.audit(m),pattern);
const example = '1\n00:00:00,750 --> 00:00:02,000\nFirst imaginary line.\n\n2\n00:00:04,000 --> 00:00:07,500\nSecond imaginary line.\n';

test('two official film metadata candidates, no media inspected',()=>{
 const r=g.audit(g.load()); assert.equal(r.documentaryEvidenceCount,2);
 assert.deepEqual(r.records.map(x=>x.filmId),['SINTEL','TEARS_OF_STEEL']);
 assert.equal(r.records[0].durationPublishedSeconds,888);
 assert.equal(r.records[1].durationPublishedSeconds,734);
 assert.equal(r.sourceFileHashesVerified,0);
});
test('official timed English captions documented for both',()=>{
 const r=g.audit(g.load());
 assert.ok(r.records.every(x=>x.officialSrtListingConfirmed));
 assert.equal(r.spokenCaptionAlignmentsVerified,0);
});
test('Tears 2012 and 2013 edit variants remain separate',()=>{
 const m=g.load();
 assert.deepEqual(m.films[1].candidateVariants.map(v=>v.variantId),['TOS_FIRST_HD_2012','TOS_RERENDER_4K_2013']);
 assert.equal(m.films[1].selectedVariantId,null);
});
test('individual rights exclusions persist',()=>{
 const m=g.load();assert.match(m.films[0].separatedRightsConcern,/MARKS/);
 assert.match(m.films[1].separatedRightsConcern,/PORTRAIT/);
});
test('cannot change canonical publisher source or YouTube pointer',()=>{
 for(const field of ['publisherDownloadUrl','youtubePointer']){
  const m=g.load();m.films[0][field]='https://example.org/bad';deny(m,/canonical/);
 }
});
test('cannot substitute published runtime with observed file duration',()=>{
 const m=g.load();m.films[1].publishedDuration.kind='LOCAL_FILE_OBSERVED';deny(m,/runtime/);
});
test('source rights / annotations / capture approval always blocked',()=>{
 for(const [field,value] of [['rightsForLLMProcessing','APPROVED'],['independentLegalReviewers',2],
 ['independentGoldReviewers',2],['approvedForEvaluation',true]]){
  const m=g.load();m.films[0][field]=value;deny(m,/rights or annotation/);
 }
});
test('media hashes do not prove YouTube equivalence',()=>{
 for(const field of ['localMediaFingerprint','localCaptionFingerprint']){
  const m=g.load();m.films[1][field]='a'.repeat(64);deny(m,/unverified media/);
 }
});
test('can not forge content observation',()=>{
 for(const field of ['publisherSubtitleObtained','publisherVideoObtained']){
  const m=g.load();m.films[0][field]=true;deny(m,/unobtained/);
 }
});
test('no upgrades for caption alignment or video comparison',()=>{
 for(const field of ['youtubeVersionContentCompared','captionBoundsChecked','speechCaptionAlignmentChecked']){
  const m=g.load();m.films[0][field]=true;deny(m);
 }
});
test('top-level API calls and rights approval remain zero',()=>{
 for(const [field,value] of [['providerApiCalls',1],['actualSpendUsd',1],
 ['serviceRightsApproved',true],['sourceToYoutubeEquivalent',true],['approvedRealDatasetCount',1]]){
  const m=g.load();m[field]=value;deny(m);
 }
});
test('cannot add fields or duplicate film to evade audit',()=>{
 const a=g.load();a.operatorApproved=true;deny(a,/schema/);
 const b=g.load();b.films[1].slot=b.films[0].slot;deny(b);
});
test('SRT parser extracts only timing metadata, not dialogue',()=>{
 const p=g.parseSrt(example);assert.equal(p.cueCount,2);
 assert.equal(p.firstStartMs,750);assert.equal(p.lastEndMs,7500);
 assert.equal(JSON.stringify(p).includes('imaginary line'),false);
});
test('BOM and CRLF SRT text accepted',()=>{
 const p=g.parseSrt('\uFEFF'+example.replace(/\n/g,'\r\n'));
 assert.equal(p.cueCount,2);
});
test('reversed SRT duration and wrong cue ordering blocked',()=>{
 assert.throws(()=>g.parseSrt(example.replace('00:00:02,000','00:00:00,000')),/cue order/);
 assert.throws(()=>g.parseSrt(example.replace(/\n2\n/,'\n4\n')),/cue number/);
});
test('malformed timestamp and empty subtitle cue blocked',()=>{
 assert.throws(()=>g.parseSrt(example.replace('00:00:02,000','00:66:02,000')),/SRT time range/);
 assert.throws(()=>g.parseSrt(example.replace('First imaginary line.','')),/SRT empty text/);
});
test('SRT timing overlap does not prove spoken audio alignment',()=>{
 const p=g.parseSrt(example.replace('00:00:04,000','00:00:01,500'));
 assert.equal(p.overlapCount,1);
 const c=g.checkCaptionBounds(p,8000);
 assert.equal(c.syntaxAndDurationBounds,'PASS_BOUNDS_ONLY');
 assert.equal(c.speechToCaptionAlignment,'NOT_VERIFIED_WITH_AUDIO');
});
test('overflow past actual media duration rejected',()=>{
 const p=g.parseSrt(example),r=g.checkCaptionBounds(p,7000);
 assert.equal(r.overflowCueCount,1);
 assert.equal(r.syntaxAndDurationBounds,'FAIL_CAPTION_EXCEEDS_FILE_DURATION');
});
test('valid ffprobe JSON is not YouTube version proof',()=>{
 const x=g.metadataFromProbe({format:{duration:'734.111'},streams:[{codec_type:'video',width:1920,height:800,codec_name:'h264',r_frame_rate:'24/1'}]});
 assert.equal(x.durationMs,734111);
 assert.equal(x.source,'LOCAL_FFPROBE_NOT_YOUTUBE');
});
test('missing video stream or duration fail',()=>{
 assert.throws(()=>g.metadataFromProbe({format:{duration:'30'},streams:[]}),/stream/);
 assert.throws(()=>g.metadataFromProbe({streams:[{codec_type:'video',width:100,height:100}]}),/duration/);
});
test('URL and playlist inputs cannot reach ffprobe',()=>{
 assert.throws(()=>g.fileAt('https://youtu.be/abcdefghijk',['.mp4'],100),/extension\/path/);
 assert.throws(()=>g.fileAt('video.m3u8',['.mp4'],100),/extension\/path/);
});
test('local file symlink is refused',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yu-g2c-'));
 try{
  const p=path.join(dir,'sample.mp4'),s=path.join(dir,'link.mp4');
  fs.writeFileSync(p,'synthetic bytes');fs.symlinkSync(p,s);
  assert.throws(()=>g.fileAt(s,['.mp4'],100),/symlink/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unknown CLI switches cannot trigger calls',async()=>{
 await assert.rejects(()=>g.main(['--url','https://youtube.com/watch?v=wrong']),/only --slot/);
});
test('G1 G2 B and C still block provider work',async()=>{
 const r=await g.main([]);
 assert.equal(r.externalCalls,0);assert.equal(r.actualSpendUsd,0);assert.equal(r.g3Authorized,false);
 const b=g2b.audit(g2b.load());assert.equal(b.officialTimedCaptionListings,4);
 assert.equal(b.liveCallsAuthorized,false);
});
