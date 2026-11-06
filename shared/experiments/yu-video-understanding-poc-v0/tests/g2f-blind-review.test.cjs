'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const g2f=require('../g2f-blind-review.cjs');
const g2e=require('../g2e-gold-pilot.cjs');
const g2d=require('../g2d-human-review.cjs');
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'yu-g2f-'));}
function synth(film='Sintel'){
 const tears=film==='TearsOfSteel',n=tears?76:26,duration=tears?734167:888032,start=tears?23000:107250,last=tears?567000:629800;
 const rows=Array.from({length:n},(_,i)=>{const t=Math.floor(start+(last-start-2000)*i/(n-1));return {startMs:t,endMs:Math.min(last,t+2000)};});
 rows[n-1].endMs=last;
 const packet=g2d.completePacket(film,{status:'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY',slot:g2d.FILMS[film].slot,
  video:{sha256:'a'.repeat(64),durationMs:duration},caption:{sha256:'b'.repeat(64),cueCount:n,lastEndMs:last,syntaxAndDurationBounds:'PASS_BOUNDS_ONLY'},
  providerCalls:0,g3Authorized:false},rows);
 packet.youtubeUploaderObservation='OFFICIAL_OWNER_CONFIRMED';packet.observedYoutubeDurationMs=tears?734000:888000;
 const y=packet.checkpoints.filter(c=>c.kind==='YOUTUBE_SCENE');
 for(const c of packet.checkpoints){
  c.verdict='OBSERVED_MATCH';c.observationNote='Synthetic local test observation only, not actual source media';
  if(c.kind==='AUDIO_SYNC')c.observedSpeechStartMs=c.localMs;
  if(c.kind==='YOUTUBE_SCENE')c.observedYoutubeMs=c.localMs;
 }
 if(tears){y[1].observedYoutubeMs+=5000;y[2].observedYoutubeMs+=5000;}
 return packet;
}
function fillAuthor(film='Sintel'){
 const p=g2e.planFilm(film,synth(film),'c'.repeat(64));
 for(const q of p.questions){
  q.finalQuestionText=q.questionDraft;q.authorCode='LOCAL_AUTHOR_1';
  q.gold.answerText='Synthetic human author draft; not an independently verified film observation.';
  if(q.kind==='UNSUPPORTED'){
   q.gold.answerability='UNSUPPORTED';q.gold.absenceRationale='Synthetic operator states full movie examined, no direct timing mentioned.';
   q.gold.fullMovieReviewed=true;
  }else{
   q.gold.answerability='SUPPORTED';
   q.gold.evidence=q.anchorLocalMs.map(t=>({modality:q.requiredModalities[0],
    localStartMs:t-1000,localEndMs:t+2000,youtubeObservedMs:null,
    observationNote:'Synthetic operator evidence note used for structural tests only.'}));
  }
 }
 assert.equal(g2e.validatePlan(p).operatorAuthored,6);
 return p;
}
function env(film='Sintel'){
 const dir=temp(),authorPath=path.join(dir,film+'-operator-gold.json');
 fs.writeFileSync(authorPath,JSON.stringify(fillAuthor(film),null,2)+'\n');
 const a=path.join(dir,film+'-review-A.json'),b=path.join(dir,film+'-review-B.json');
 return {dir,film,authorPath,a,b};
}
function clean(x){fs.rmSync(x.dir,{recursive:true,force:true});}
function create(x){
 const first=g2f.createPacket(x.authorPath,'REVIEWER_A',x.a);
 const second=g2f.createPacket(x.authorPath,'REVIEWER_B',x.b);
 return [first,second];
}
function file(path){return JSON.parse(fs.readFileSync(path,'utf8'));}
function save(path,x){fs.writeFileSync(path,JSON.stringify(x,null,2)+'\n');}
function review(p,{verdict=null,blinded=true,offset=0}={}){
 p.blindReviewDeclaration=blinded;
 p.sawOperatorAnswersBeforeSubmission=!blinded;
 p.watchedLocalPublisherFilm=true;
 for(const q of p.questions){
  const v=verdict||(/^G2E-(SIN|TOS)-06$/.test(q.questionId)?'UNSUPPORTED':'SUPPORTED');
  q.response.verdict=v;
  if(v==='AMBIGUOUS'){
   q.response.observationNote='Synthetic reviewer could not determine actual answer from sources';
   continue;
  }
  q.response.answerText='Reviewer-authored synthetic response with no real film data.';
  if(v==='UNSUPPORTED'){
   q.response.fullMovieReviewed=true;q.response.absenceRationale='Synthetic reviewer claims full-film absence, human verification pending';
  }else{
   q.response.evidence=(q.localAnchorMs.length?q.localAnchorMs:[30000]).map(t=>({
    modality:'FRAME',localStartMs:Math.max(0,t-1000+offset),localEndMs:t+2000+offset,
    observationNote:'Synthetic independent reviewer evidence for offline test only'}));
  }
 }
 return p;
}
test('G2-F no args is safe with no external calls and no verified reviewer',()=>{
 const r=g2f.run([]);
 assert.equal(r.status,'OFFLINE_TWO_BLIND_REVIEWER_PROTOCOL_READY_NO_REVIEWS');
 assert.equal(r.independentGoldApproved,0);assert.equal(r.g3Authorized,false);
});
test('creates two private six-question packets without revealing operator gold answers',()=>{
 const x=env();try{
  const r=create(x);
  assert.equal(r[0].containsOperatorAnswers,false);
  assert.equal(r[1].questionCount,6);
  const raw=fs.readFileSync(x.a,'utf8'),p=file(x.a),operator=file(x.authorPath);
  assert.ok(raw.includes('G2F_LOCAL_BLIND_REVIEW_PACKET'));
  assert.ok(!raw.includes(operator.questions[0].gold.answerText));
  assert.ok(!raw.includes('LOCAL_AUTHOR_1'));
  assert.ok(!raw.includes('"gold"'));
  assert.equal(p.questions[0].response.answerText,null);
  assert.equal(p.questions[5].response.verdict,'NOT_REVIEWED');
  assert.equal(g2f.validatePacket(p).notReviewed,6);
  assert.equal(p.goldApprovalGranted,false);
 }finally{clean(x);}
});
test('prevents reviewer from using author ID, overwriting prior packet, saving inside repo',()=>{
 const x=env();try{
  assert.throws(()=>g2f.createPacket(x.authorPath,'LOCAL_AUTHOR_1',x.a),/author/);
  assert.throws(()=>g2f.createPacket(x.authorPath,'BAD.CODE',x.a),/reviewer code/);
  create(x);
  assert.throws(()=>g2f.createPacket(x.authorPath,'REVIEWER_C',x.a),/overwrite/);
  assert.throws(()=>g2f.createPacket(x.authorPath,'REVIEWER_C',path.join(__dirname,'private.json')),/outside Git/);
 }finally{clean(x);}
});
test('a reviewer can complete separate blind report and still cannot approve gold',()=>{
 const x=env();try{
  create(x);const p=review(file(x.a));const r=g2f.validatePacket(p);
  assert.equal(r.status,'SELF_REPORTED_BLIND_REVIEW_SUBMITTED_NOT_VERIFIED');
  assert.equal(r.answered,6);assert.equal(r.blindIndependenceSelfDeclared,true);
  assert.equal(r.verifiedHumanIdentity,false);
  assert.equal(r.independentGoldApprovalCount,0);
 }finally{clean(x);}
});
test('full G2-F report with two distinct self-declared reviewers is only pending human reconciliation',()=>{
 const x=env();try{
  create(x);save(x.a,review(file(x.a)));save(x.b,review(file(x.b)));
  const r=g2f.assess(x.authorPath,x.a,x.b);
  assert.equal(r.status,'TWO_BLIND_REVIEWER_REPORTS_SUBMITTED_PENDING_HUMAN_ADJUDICATION');
  assert.equal(r.reviewerAnswerabilityAgreements,6);
  assert.equal(r.verifiedIndependentHumanReviewers,0);
  assert.equal(r.independentGoldApproved,0);
  assert.equal(r.allSixQuestionTextsRequireSemanticAdjudication,true);
  assert.equal(r.g3Authorized,false);
  assert.ok(r.flags.some(f=>f.reason==='IDENTICAL_REVIEW_RESPONSES_REQUIRE_INDEPENDENCE_EXPLANATION'));
 }finally{clean(x);}
});
test('same reviewer code cannot be counted twice even if two files exist',()=>{
 const x=env();try{
  create(x);save(x.a,review(file(x.a)));
  const b=review(file(x.b));b.reviewerCode='REVIEWER_A';b.sourceTemplateDigest=g2f.hash?.('x')||b.sourceTemplateDigest;
  // Immutable template guard rejects editing reviewer code, before any comparison.
  save(x.b,b);
  assert.throws(()=>g2f.assess(x.authorPath,x.a,x.b),/immutable blind question/);
 }finally{clean(x);}
});
test('cannot falsely declare gold/API/paid status even with correct answers',()=>{
 const x=env();try{
  create(x);
  for(const [field,val] of [['goldApprovalGranted',true],['g3Authorized',true],['externalProviderCalls',1],['actualSpendUsd',1]]){
   const p=review(file(x.a));p[field]=val;
   assert.throws(()=>g2f.validatePacket(p),/approval and provider calls/);
  }
 }finally{clean(x);}
});
test('editing question, anchor, publisher film ID or reviewer code invalidates blinded packet',()=>{
 const x=env();try{
  create(x);for(const fn of [
   p=>p.questions[0].questionText+=' [modified]',
   p=>p.questions[1].localAnchorMs[0]+=1000,
   p=>p.sourceVideoSha256='f'.repeat(64),
   p=>p.reviewerCode='REVIEWER_Z'
  ]){const p=file(x.a);fn(p);assert.throws(()=>g2f.validatePacket(p),/immutable blind question/);}
 }finally{clean(x);}
});
test('missing evidence and unsupported without full movie statement are blocked',()=>{
 const x=env();try{
  create(x);
  const a=review(file(x.a));a.questions[0].response.evidence=[];
  assert.throws(()=>g2f.validatePacket(a),/directly observed/);
  const b=review(file(x.b));b.questions[5].response.fullMovieReviewed=false;
  assert.throws(()=>g2f.validatePacket(b),/full-film/);
 }finally{clean(x);}
});
test('reviewers can disagree with author without having verdict falsified as PASS',()=>{
 const x=env();try{
  create(x);
  const a=review(file(x.a)),b=review(file(x.b));
  b.questions[1].response.verdict='AMBIGUOUS';
  b.questions[1].response.answerText=null;
  b.questions[1].response.evidence=[];
  b.questions[1].response.observationNote='Synthetic reviewer cannot tell if visual evidence is adequate';
  const rCheck=g2f.validatePacket(b);assert.equal(rCheck.uncertain,1);
  save(x.a,a);save(x.b,b);
  const r=g2f.assess(x.authorPath,x.a,x.b);
  assert.equal(r.reviewerAnswerabilityDisagreements,1);
  assert.ok(r.flags.some(f=>f.questionId===a.questions[1].questionId));
  assert.equal(r.independentGoldApproved,0);
 }finally{clean(x);}
});
test('source G2-E draft edit after packet creation causes fail-closed stale-review detection',()=>{
 const x=env();try{
  create(x);const author=file(x.authorPath);
  author.questions[0].gold.answerText+=' extra revised operator text';
  save(x.authorPath,author);
  assert.equal(g2e.validatePlan(author).operatorAuthored,6);
  assert.throws(()=>g2f.assess(x.authorPath,x.a,x.b),/source G2-E draft/);
 }finally{clean(x);}
});
test('Sintel and Tears source packets cannot be mixed',()=>{
 const x=env('Sintel'),y=env('TearsOfSteel');try{
  create(x);create(y);
  assert.throws(()=>g2f.assess(x.authorPath,x.a,y.b),/film identities/);
 }finally{clean(x);clean(y);}
});
test('source-exposed review cannot count as blind reviewer',()=>{
 const x=env();try{
  create(x);const a=review(file(x.a),{blinded:false});
  const b=review(file(x.b),{blinded:true});
  assert.equal(g2f.validatePacket(a).status,'REVIEWER_SOURCE_EXPOSURE_REQUIRES_REWORK');
  save(x.a,a);save(x.b,b);
  const r=g2f.assess(x.authorPath,x.a,x.b);
  assert.equal(r.status,'BLIND_REVIEW_IN_PROGRESS_OR_SOURCE_EXPOSURE');
  assert.equal(r.selfDeclaredBlindReviewers,0);
 }finally{clean(x);}
});
test('partial reviews do not accidentally imply two reviewers or approved gold',()=>{
 const x=env();try{
  create(x);save(x.a,review(file(x.a)));
  const r=g2f.assess(x.authorPath,x.a,x.b);
  assert.equal(r.status,'BLIND_REVIEW_IN_PROGRESS_OR_SOURCE_EXPOSURE');
  assert.equal(r.independentGoldApproved,0);
 }finally{clean(x);}
});
test('review time outside duration and malformed strict schema are rejected',()=>{
 const x=env();try{
  create(x);const a=review(file(x.a));
  a.questions[0].response.evidence[0].localEndMs=999999999;
  assert.throws(()=>g2f.validatePacket(a),/review evidence modality or time/);
  const b=file(x.b);b.questions[0].gold={answerText:'forged gold'};
  assert.throws(()=>g2f.validatePacket(b),/question schema/);
 }finally{clean(x);}
});
test('no network, model API, merge or approval subcommands',()=>{
 for(const args of [['--g3','approve'],['run','--model','gemini'],['--merge'],['--youtube','http://test']]){
  assert.throws(()=>g2f.run(args),/use|G2F_FAIL_CLOSED/);
 }
});
