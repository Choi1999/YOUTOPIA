'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const gold=require('../g2e-gold-pilot.cjs');
const g2d=require('../g2d-human-review.cjs');
function sourcePacket(film='Sintel'){
 const tears=film==='TearsOfSteel',n=tears?76:26;
 const duration=tears?734167:888032,start=tears?23000:107250,last=tears?567000:629800;
 const rows=Array.from({length:n},(_,i)=>{
  const s=Math.floor(start+(last-start-2000)*i/(n-1));return {startMs:s,endMs:Math.min(last,s+2000)};
 });
 rows[rows.length-1].endMs=last;
 const evidence={status:'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY',slot:g2d.FILMS[film].slot,
  video:{sha256:'a'.repeat(64),durationMs:duration},caption:{sha256:'b'.repeat(64),
   cueCount:n,lastEndMs:last,syntaxAndDurationBounds:'PASS_BOUNDS_ONLY'},providerCalls:0,g3Authorized:false};
 const packet=g2d.completePacket(film,evidence,rows);
 packet.youtubeUploaderObservation='OFFICIAL_OWNER_CONFIRMED';
 packet.observedYoutubeDurationMs=tears?734000:888000;
 const yt=packet.checkpoints.filter(c=>c.kind==='YOUTUBE_SCENE');
 for(let i=0;i<packet.checkpoints.length;i++){
  const c=packet.checkpoints[i];c.verdict='OBSERVED_MATCH';
  c.observationNote='Synthetic test: human observation placeholder, not a real video claim';
  if(c.kind==='AUDIO_SYNC')c.observedSpeechStartMs=c.localMs;
  if(c.kind==='YOUTUBE_SCENE')c.observedYoutubeMs=c.localMs+(tears&&i===3?0:tears?5000:0);
 }
 // For Tears, first YouTube scene differs by five seconds from the remaining 2:
 if(tears){yt[0].observedYoutubeMs=yt[0].localMs;yt[1].observedYoutubeMs=yt[1].localMs+5000;yt[2].observedYoutubeMs=yt[2].localMs+5000;}
 return packet;
}
function p(film='Sintel'){return gold.planFilm(film,sourcePacket(film),'1'.repeat(64));}
function authored(q,answerability='SUPPORTED'){
 q.finalQuestionText=q.questionDraft;
 q.authorCode='LOCAL_AUTHOR_1';
 q.gold.answerability=answerability;
 q.gold.answerText=answerability==='SUPPORTED'?'Synthetic placeholder answer for static local QA only.':'이 구간은 근거가 모호하여 사람의 재작성 검토가 필요함.';
 if(answerability==='SUPPORTED'){
  q.gold.evidence=q.anchorLocalMs.map(localMs=>({
   modality:q.requiredModalities[0],localStartMs:Math.max(0,localMs-1500),
   localEndMs:localMs+1500,youtubeObservedMs:null,
   observationNote:'Synthetic local publisher timing evidence in off-line unit test; no actual facts'}));
 }
 return q;
}
function tmp(){return fs.mkdtempSync(path.join(os.tmpdir(),'yu-g2e-'));}
test('G2-E public registry preserves original 36-Q taxonomy and separately scoped pilot 12',()=>{
 const r=gold.registry();
 assert.equal(r.fullG0Target.filmCount,6);assert.equal(r.fullG0Target.questionCount,36);
 assert.equal(r.pilot.questionCount,12);
 assert.equal(r.pilot.questionKinds.OCR,0);
 assert.equal(r.remaining.questionKinds.OCR,6);
 assert.equal(r.questions.length,12);
 assert.equal(r.realFilmBytesInRepo,false);
 assert.equal(r.questionsContainVerifiedAnswers,false);
 assert.equal(r.g3Authorized,false);
});
test('offline registry CLI never claims any verified human gold',()=>{
 const r=gold.run([]);
 assert.equal(r.status,'PUBLIC_QUESTION_DRAFTS_ONLY_NO_GOLD_ANSWERS');
 assert.equal(r.goldAnswersVerified,0);assert.equal(r.externalProviderCalls,0);
 assert.equal(r.actualSpendUsd,0);assert.equal(r.g3Authorized,false);
});
test('Sintel draft has 6 empty gold fields with non-fabricated local time anchors',()=>{
 const data=p(),sum=gold.validatePlan(data);
 assert.equal(data.questions.length,6);
 assert.equal(data.questions[0].anchorCheckpointIds[0],'AUDIO_FIRST');
 assert.equal(data.questions[0].anchorLocalMs[0],107250);
 assert.equal(data.questions[2].anchorLocalMs[0],88803);
 assert.equal(data.questions[4].anchorLocalMs.length,2);
 assert.equal(data.questions[5].anchorLocalMs.length,0);
 assert.ok(data.questions.every(q=>q.gold.answerability===null&&q.gold.answerText===null&&q.finalQuestionText===null));
 assert.equal(sum.notAuthored,6);
 assert.equal(sum.humanGoldApproved,false);
});
test('Tears preserves variable 5s scene-offset warning, not mislabeling as content mismatch',()=>{
 const src=sourcePacket('TearsOfSteel');
 assert.equal(g2d.assess(src).status,'OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW');
 const data=gold.planFilm('TearsOfSteel',src,'1'.repeat(64)),sum=gold.validatePlan(data);
 assert.equal(data.sourceReviewStatus,'OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW');
 assert.equal(data.localSource.youtubeTimelineMapping,'OFFSET_SPREAD_5000MS_REQUIRES_REVIEW');
 assert.equal(sum.status,'PRIVATE_GOLD_CANDIDATES_IN_PROGRESS');
 assert.equal(sum.realGoldApproved,false);
});
test('author can write grounded speech draft with original local audio timestamp',()=>{
 const data=p(),q=data.questions[0];authored(q);
 const summary=gold.validatePlan(data);
 assert.equal(summary.operatorAuthored,1);
 assert.equal(summary.notAuthored,5);
 assert.equal(summary.independentGoldReviewVerified,false);
 assert.equal(summary.g3Authorized,false);
});
test('visual evidence must be FRAME and near original film checkpoint',()=>{
 const data=p(),q=data.questions[2];authored(q);
 assert.equal(gold.validatePlan(data).operatorAuthored,1);
 q.gold.evidence[0].modality='TRANSCRIPT';
 assert.throws(()=>gold.validatePlan(data),/wrong modality/);
 q.gold.evidence[0].modality='FRAME';
 q.gold.evidence[0].localStartMs=500000;q.gold.evidence[0].localEndMs=501000;
 assert.throws(()=>gold.validatePlan(data),/near|checkpoint/);
});
test('temporal question requires two distinct grounded regions',()=>{
 const data=p(),q=data.questions[4];authored(q);
 assert.equal(q.gold.evidence.length,2);
 assert.equal(gold.validatePlan(data).operatorAuthored,1);
 q.gold.evidence.pop();
 assert.throws(()=>gold.validatePlan(data),/minimum grounding evidence/);
});
test('unsupported candidates require a full-film absence review and no positive evidence',()=>{
 const data=p(),q=data.questions[5];authored(q,'UNSUPPORTED');
 q.gold.answerText='영상 근거만으로는 해당 사실을 확인할 수 없습니다.';
 q.gold.absenceRationale='원본 영상을 처음부터 끝까지 확인했으며 이 정확한 장면 밖 사건의 시각은 직접 제시되지 않았음.';
 assert.throws(()=>gold.validatePlan(data),/whole-film absence/);
 q.gold.fullMovieReviewed=true;
 const summary=gold.validatePlan(data);assert.equal(summary.fullFilmAbsenceClaimsReported,1);
 q.gold.evidence=[{modality:'FRAME',localStartMs:10,localEndMs:20,youtubeObservedMs:null,observationNote:'Synthetic invalid evidence for absent detail'}];
 assert.throws(()=>gold.validatePlan(data),/whole-film absence/);
});
test('unsupported can never silently be promoted into a supported claim',()=>{
 const data=p(),q=data.questions[5];authored(q,'SUPPORTED');
 assert.throws(()=>gold.validatePlan(data),/unsupported candidate/);
});
test('ambiguous author note requires rewrite rather than evidence approval',()=>{
 const data=p(),q=data.questions[1];authored(q,'AMBIGUOUS');
 q.gold.evidence=[];
 const summary=gold.validatePlan(data);
 assert.equal(summary.needsRewrite,1);assert.equal(summary.operatorAuthored,0);
 assert.equal(summary.notAuthored,5);assert.equal(summary.humanGoldApproved,false);
});
test('author cannot edit immutable anchors, video identity, or question type',()=>{
 const data=p();
 data.questions[0].anchorLocalMs[0]+=1000;
 assert.throws(()=>gold.validatePlan(data),/plan modified/);
 const b=p();b.localSource.videoSha256='f'.repeat(64);
 assert.throws(()=>gold.validatePlan(b),/plan modified/);
});
test('forged G3/rights/reviewer approval always rejected even for drafted answers',()=>{
 for(const [key,val] of [['g3Authorized',true],['realGoldApproved',true],['goldIndependentReviewVerified',true],['externalProviderCalls',1],['actualSpendUsd',0.01]]){
  const data=p();data[key]=val;assert.throws(()=>gold.validatePlan(data));
 }
 const data=p();data.questions[0].gold.independentGoldApproved=true;
 assert.throws(()=>gold.validatePlan(data),/gold schema/);
});
test('unreviewed answer text and unverified YouTube timestamp cannot be smuggled',()=>{
 const a=p();a.questions[0].gold.answerText='unreviewed fabricated answer';
 assert.throws(()=>gold.validatePlan(a),/unreviewed fields/);
 const b=p();authored(b.questions[0]);b.questions[0].gold.evidence[0].youtubeObservedMs=110000;
 assert.throws(()=>gold.validatePlan(b),/unverified YouTube/);
});
test('out-of-range evidence time, missing notes and wrong source modality blocked',()=>{
 const a=p();authored(a.questions[0]);a.questions[0].gold.evidence[0].localEndMs=900000;
 assert.throws(()=>gold.validatePlan(a),/bounds/);
 const b=p();authored(b.questions[0]);b.questions[0].gold.evidence[0].observationNote='ok';
 assert.throws(()=>gold.validatePlan(b),/observation/);
});
test('Sintel wrong film cannot be paired with Tears G2-D proof',()=>{
 const data=sourcePacket('Sintel');
 assert.throws(()=>gold.planFilm('TearsOfSteel',data,'1'.repeat(64)),/film identity/);
});
test('G2-D sample packet with omitted human checks cannot seed authoring',()=>{
 const packet=sourcePacket();packet.checkpoints[0].verdict='NOT_REVIEWED';
 packet.checkpoints[0].observationNote=null;packet.checkpoints[0].observedSpeechStartMs=null;
 assert.throws(()=>gold.planFilm('Sintel',packet,'1'.repeat(64)),/fully reported/);
});
test('private files are outside Git and cannot be clobbered',()=>{
 const dir=tmp();try{
  const q=path.join(dir,'gold.json');assert.equal(gold.safeJsonFile(q),q);
  fs.writeFileSync(q,'{}');
  assert.throws(()=>gold.safeJsonFile(q),/overwrite/);
  assert.throws(()=>gold.safeJsonFile(path.join(__dirname,'..','gold.json')),/outside Git/);
  assert.throws(()=>gold.safeJsonFile('https://example.org/gold.json'),/local JSON/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('plan and assess write/read private-only JSON without modifying G2-D source file',()=>{
 const dir=tmp();
 try{
  const g2dFile=path.join(dir,'Sintel-manual-review.json'),dest=path.join(dir,'Sintel-gold-candidates.json');
  const raw=JSON.stringify(sourcePacket('Sintel'),null,2)+'\n';
  fs.writeFileSync(g2dFile,raw);
  const out=gold.run(['plan','--film','Sintel','--g2d',g2dFile,'--out',dest]);
  assert.equal(out.status,'PRIVATE_QUESTION_AUTHORING_CREATED_UNLABELED');
  assert.equal(out.humanGoldApproved,false);
  const assessed=gold.run(['assess','--file',dest]);
  assert.equal(assessed.notAuthored,6);assert.equal(assessed.g3Authorized,false);
  assert.equal(fs.readFileSync(g2dFile,'utf8'),raw);
  assert.throws(()=>gold.run(['plan','--film','Sintel','--g2d',g2dFile,'--out',dest]),/overwrite/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('network, provider SDK, cost or G3 flags not exposed as executable arguments',()=>{
 assert.throws(()=>gold.run(['--youtube','https://youtube.com/watch?v=test']),/use/);
 assert.throws(()=>gold.run(['--model','gemini']),/use/);
 assert.throws(()=>gold.run(['--approve','G3']),/use/);
});
