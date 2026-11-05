'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const g=require('../g2d-human-review.cjs');
const g2c=require('../g2c-offline-verifier.cjs');
function fixture(film='Sintel'){
 const tears=film==='TearsOfSteel',duration=tears?734167:888032,n=tears?76:26;
 const start=tears?23000:107250,last=tears?567000:629800;
 const step=(last-start-2000)/(n-1);
 const rows=Array.from({length:n},(_,i)=>({startMs:Math.floor(start+step*i),endMs:Math.min(last,Math.floor(start+step*i)+2000)}));
 rows[n-1].endMs=last;
 const evidence={status:'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY',slot:g.FILMS[film].slot,
  video:{sha256:'a'.repeat(64),durationMs:duration},caption:{sha256:'b'.repeat(64),cueCount:n,lastEndMs:last,
    syntaxAndDurationBounds:'PASS_BOUNDS_ONLY'},providerCalls:0,g3Authorized:false};
 return {evidence,rows};
}
function packet(film='Sintel'){const {evidence,rows}=fixture(film);return g.completePacket(film,evidence,rows);}
function clone(x){return structuredClone(x);}
function fill(x){
 x.observedYoutubeDurationMs=x.local.durationMs;x.youtubeUploaderObservation='OFFICIAL_OWNER_CONFIRMED';
 x.checkpoints.forEach(c=>{
  c.verdict='OBSERVED_MATCH';c.observationNote='Verified matching local and browser scene by direct manual inspection';
  if(c.kind==='AUDIO_SYNC')c.observedSpeechStartMs=c.localMs;
  if(c.kind==='YOUTUBE_SCENE')c.observedYoutubeMs=c.localMs;
 });
 return x;
}
test('Sintel plan generates 3 audio + 3 YouTube reviews, never labels verified',()=>{
 const p=packet();assert.equal(p.checkpoints.length,6);assert.equal(p.g3Authorized,false);
 const out=g.assess(p);assert.equal(out.status,'PENDING_HUMAN_REVIEW');
 assert.equal(out.reportedAudioSyncSamplesMatched,0);assert.equal(out.fullAudioCaptionAlignmentVerified,false);
});
test('Tears adds mandatory checks after last SRT ends at 09:27',()=>{
 const p=packet('TearsOfSteel'),tail=p.checkpoints.filter(c=>c.kind==='CAPTION_COVERAGE');
 assert.equal(p.checkpoints.length,8);assert.equal(tail.length,2);
 assert.ok(tail.every(c=>c.localMs>567000&&c.localMs<734167));
 assert.equal(g.assess(p).reportedTailCoverageSamplesMatched,0);
});
test('sample checkpoints are first, middle, last actual SRT rows',()=>{
 const p=packet();assert.deepEqual(p.checkpoints.filter(x=>x.kind==='AUDIO_SYNC').map(x=>x.cueIndex),[1,13,26]);
});
test('YouTube time checks cover beginning, middle and near-end',()=>{
 const p=packet();assert.deepEqual(p.checkpoints.filter(x=>x.kind==='YOUTUBE_SCENE').map(x=>x.id),
  ['YOUTUBE_OPENING','YOUTUBE_MIDPOINT','YOUTUBE_ENDING']);
});
test('all human observed sample matches still never authorize G3 or prove full equality',()=>{
 for(const film of ['Sintel','TearsOfSteel']){
 const r=g.assess(fill(packet(film)));
 assert.equal(r.status,'OPERATOR_REPORTED_SAMPLED_MATCHES_NOT_FULL_PROOF');
 assert.equal(r.fullAudioCaptionAlignmentVerified,false);assert.equal(r.fullYoutubeEditionEquivalenceVerified,false);
 assert.equal(r.filmRightsForServiceVerified,false);assert.equal(r.humanGoldLabelsVerified,false);
 assert.equal(r.independentReviewerCount,0);assert.equal(r.g3Authorized,false);
 }
});
test('Mismatches are preserved as problems rather than disappearing into averages',()=>{
 const x=fill(packet('TearsOfSteel'));const c=x.checkpoints.find(c=>c.id==='COVERAGE_NEAR_END');
 c.verdict='OBSERVED_DIFFERENCE';const r=g.assess(x);
 assert.equal(r.status,'OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW');
 assert.equal(r.counts.difference,1);assert.equal(r.g3Authorized,false);
});
test('Unknown or unfinished checks cannot be silently auto-approved',()=>{
 const x=fill(packet());x.checkpoints[0].verdict='UNCERTAIN';const r=g.assess(x);
 assert.equal(r.status,'PENDING_HUMAN_REVIEW');assert.equal(r.counts.unknown,1);
});
test('Audio alignment requires the inspector to record a measured speech start',()=>{
 const x=fill(packet());x.checkpoints[0].observedSpeechStartMs=null;
 assert.throws(()=>g.assess(x),/audio match requires/);
});
test('Audio alignment must not be marked matched with more than 1500ms onset error',()=>{
 const x=fill(packet());x.checkpoints[0].observedSpeechStartMs+=2000;
 assert.throws(()=>g.assess(x),/audio match requires/);
});
test('YouTube scene match requires explicit observed uploader and timestamp',()=>{
 const x=fill(packet());x.youtubeUploaderObservation='UNVERIFIED';
 assert.throws(()=>g.assess(x),/youtube match needs/);
 const y=fill(packet());y.checkpoints[3].observedYoutubeMs=null;
 assert.throws(()=>g.assess(y),/youtube match needs/);
});
test('YouTube duration must be reported if browser scene times are entered',()=>{
 const x=fill(packet());x.observedYoutubeDurationMs=null;
 assert.throws(()=>g.assess(x),/youtube timestamp/);
});
test('No note or very short note cannot assert a manual observation',()=>{
 const x=fill(packet());x.checkpoints[2].observationNote='ok';
 assert.throws(()=>g.assess(x),/review note/);
});
test('An observation marked unreviewed cannot secretly carry measured time',()=>{
 const x=packet();x.checkpoints[0].observedSpeechStartMs=2000;
 assert.throws(()=>g.assess(x),/unfinished audio timestamp/);
});
test('Missing observed YouTube duration may coexist with all unreviewed status',()=>{
 const x=packet();assert.equal(g.assess(x).youtubeDurationObserved,false);
});
test('Editing immutable checkpoint sample time is caught by digest comparison',()=>{
 const x=packet();x.checkpoints[0].localMs+=1;assert.throws(()=>g.assess(x),/packet modified/);
});
test('Editing local media fingerprint is caught by digest comparison',()=>{
 const x=packet();x.local.videoSha256='c'.repeat(64);assert.throws(()=>g.assess(x),/packet modified/);
});
test('Changing pointer to unrelated YouTube video cannot pass',()=>{
 const x=packet();x.youtubeUrl='https://www.youtube.com/watch?v=ABCDEFGHIJK';assert.throws(()=>g.assess(x),/provenance/);
});
test('Tears 2012/2013 edition caveat remains mandatory',()=>{
 const x=packet('TearsOfSteel');assert.match(x.youtubeEditionCaveat,/2012 FIRST HD vs 2013 4K/);
 x.publisherEdition='TEARS_2013_4K';assert.throws(()=>g.assess(x),/provenance/);
});
test('Invented approval, external calls, or extra authorization field blocked',()=>{
 for(const [k,v] of [['realDatasetApproved',true],['g3Authorized',true],['externalProviderCalls',1],['rightsAuthorized',true]]){
  const x=packet();x[k]=v;assert.throws(()=>g.assess(x));
 }
});
test('Unrecognized checkpoint or extra user field fails closed',()=>{
 const x=packet();x.checkpoints[0].attested=true;assert.throws(()=>g.assess(x),/checkpoint field/);
});
test('Wrong cue count or missing local proof cannot generate plans',()=>{
 const {evidence,rows}=fixture();evidence.caption.cueCount=10;
 assert.throws(()=>g.completePacket('Sintel',evidence,rows),/SRT cue timings/);
 const next=fixture();next.evidence.providerCalls=1;
 assert.throws(()=>g.completePacket('Sintel',next.evidence,next.rows),/local G2C proof/);
});
test('Tears tail requires remaining video after final caption',()=>{
 const {evidence,rows}=fixture('TearsOfSteel');evidence.caption.lastEndMs=800000;
 assert.throws(()=>g.completePacket('TearsOfSteel',evidence,rows));
});
test('Unknown film cannot produce review packets',()=>{
 const {evidence,rows}=fixture();assert.throws(()=>g.completePacket('UnknownMovie',evidence,rows),/unknown film/);
});
test('Review file destination is outside Git and never remote URL',()=>{
 assert.equal(g.insideRepo(path.join(__dirname,'..','g2d-human-review.cjs')),true);
 assert.throws(()=>g.localReviewFile(path.join(__dirname,'..','review.json')),/outside Git/);
 assert.throws(()=>g.localReviewFile('https://youtube.com/movie.json'),/outside Git/);
});
test('Review packet must not have unguarded URL access or remote input option',async()=>{
 await assert.rejects(()=>g.run(['plan','--url','https://youtube.com']),/use plan/);
});
test('Assessment reads local JSON only; does not contact providers',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'youtopia-g2d-'));
 try{const file=path.join(dir,'review.json');fs.writeFileSync(file,JSON.stringify(packet()),'utf8');
  const out=await g.run(['assess','--review',file]);
  assert.equal(out.status,'PENDING_HUMAN_REVIEW');assert.equal(out.externalProviderCalls,0);assert.equal(out.actualSpendUsd,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('A review with consistent sampled scene offsets remains insufficient for full edition equality',()=>{
 const x=fill(packet());const out=g.assess(x);assert.equal(out.youtubeSampleOffsetConsistency,'OPERATOR_REPORTED_CONSISTENT');
 assert.equal(out.fullYoutubeEditionEquivalenceVerified,false);
});
test('Potential edition offset drift is surfaced, not treated as equivalence',()=>{
 const x=fill(packet());const scenes=x.checkpoints.filter(c=>c.kind==='YOUTUBE_SCENE');
 scenes[0].observedYoutubeMs+=3000;
 const out=g.assess(x);assert.equal(out.youtubeSampleOffsetConsistency,'NOT_ESTABLISHED');
 assert.equal(out.status,'OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW');
});

test('Even a manually claimed complete scene match cannot ignore YouTube duration difference',()=>{
 const x=fill(packet());x.observedYoutubeDurationMs=x.local.durationMs+10000;
 const r=g.assess(x);assert.equal(r.reportedYoutubeDurationClass,'DURATION_DISCREPANCY_REVIEW');
 assert.equal(r.status,'OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW');
 assert.equal(r.g3Authorized,false);
});
test('local user-supplied media is not incorrectly called rights-authorized',()=>{
 const x=packet();assert.equal(x.sourceType,'USER_SUPPLIED_LOCAL_MEDIA_RIGHTS_UNVERIFIED');
 assert.equal(g.assess(x).filmRightsForServiceVerified,false);
});
