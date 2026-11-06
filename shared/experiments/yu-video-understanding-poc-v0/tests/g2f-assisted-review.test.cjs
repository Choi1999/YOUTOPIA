'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const g2e=require('../g2e-gold-pilot.cjs');
const g2d=require('../g2d-human-review.cjs');
const g2f=require('../g2f-assisted-review.cjs');
const web=require('../g2f-assisted-workspace-server.cjs');
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'yu-g2f-assisted-'));}
function sourcePacket(film='Sintel'){
 const tears=film==='TearsOfSteel',n=tears?76:26,duration=tears?734167:888032,start=tears?23000:107250,last=tears?567000:629800;
 const pivot=tears?37:12, middle=tears?318000:207250;
 const rows=Array.from({length:n},(_,i)=>{const t=Math.floor(i<=pivot?
  start+(middle-start)*i/pivot:
  middle+(last-middle-2000)*(i-pivot)/(n-1-pivot));
  return {startMs:t,endMs:Math.min(last,t+1500)};});
 rows[n-1].endMs=last;
 const packet=g2d.completePacket(film,{status:'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY',slot:g2d.FILMS[film].slot,
  video:{sha256:'a'.repeat(64),durationMs:duration},caption:{sha256:'b'.repeat(64),
   cueCount:n,lastEndMs:last,syntaxAndDurationBounds:'PASS_BOUNDS_ONLY'},providerCalls:0,g3Authorized:false},rows);
 packet.youtubeUploaderObservation='OFFICIAL_OWNER_CONFIRMED';packet.observedYoutubeDurationMs=tears?734000:888000;
 const youtube=packet.checkpoints.filter(q=>q.kind==='YOUTUBE_SCENE');
 for(const q of packet.checkpoints){
  q.verdict='OBSERVED_MATCH';q.observationNote='Synthetic user-submitted observation for offline unit testing only';
  if(q.kind==='AUDIO_SYNC')q.observedSpeechStartMs=q.localMs;
  if(q.kind==='YOUTUBE_SCENE')q.observedYoutubeMs=q.localMs;
 }
 if(tears){youtube[1].observedYoutubeMs+=5000;youtube[2].observedYoutubeMs+=5000;}
 return packet;
}
function author(film){
 const p=g2e.planFilm(film,sourcePacket(film),'c'.repeat(64));
 for(const q of p.questions){
  q.finalQuestionText=q.questionDraft;
  q.authorCode='LOCAL_AUTHOR_1';
  q.gold.answerability=q.kind==='UNSUPPORTED'?'UNSUPPORTED':'SUPPORTED';
  q.gold.answerText='Synthetic user operator draft from source film, not actual real facts.';
  if(q.kind==='UNSUPPORTED'){
   q.gold.absenceRationale='Synthetic user reports whole film absent claim, not independently verified.';
   q.gold.fullMovieReviewed=true;
  }else q.gold.evidence=q.anchorLocalMs.map(t=>({modality:q.requiredModalities[0],
   localStartMs:t-1000,localEndMs:t+2000,youtubeObservedMs:null,
   observationNote:'Synthetic original publisher observed evidence for unit test only'}));
 }
 assert.equal(g2e.validatePlan(p).operatorAuthored,6);return p;
}
function env(film='Sintel'){
 const dir=temp(),a=path.join(dir,film+'-G2E.json'),one=path.join(dir,film+'-A-assisted.json'),
  two=path.join(dir,film+'-B-assisted.json');
 fs.writeFileSync(a,JSON.stringify(author(film),null,2)+'\n');
 return {dir,author:a,a:one,b:two,film};
}
function clean(e){fs.rmSync(e.dir,{recursive:true,force:true});}
function load(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function save(p,v){fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');}
function humanReview(packet){
 for(const q of packet.questions){
  const r=q.review;r.decision='ACCEPT';r.verdict=q.aiDraft.proposedVerdict;
  r.answerText=q.aiDraft.answerText;r.watchedSource=true;
  if(r.verdict==='SUPPORTED')r.evidence=q.aiDraft.evidenceHints.map(e=>({
   ...e,observationNote:'Synthetic reviewer personally checked film for structural simulation only'}));
  else{r.fullMovieReviewed=true;r.absenceRationale='Synthetic reviewer claims inspected the full movie and no exact timing was given.';}
 }
 return packet;
}
test('12 actual-chat AI proposals are explicit unverified suggestions, not human gold',()=>{
 const p=g2f.proposalRegistry();assert.equal(p.drafts.length,12);
 assert.equal(p.realFilmDirectlyInspected,false);
 assert.equal(p.g3Authorized,false);
 for(const film of ['Sintel','TearsOfSteel'])
  assert.equal(p.drafts.filter(x=>x.film===film).length,6);
 assert.equal(g2f.run([]).status,'AI_ASSISTED_DRAFTS_UNVERIFIED');
});
test('G2-F assisted packets are separate from existing BLIND files; no automatic review by generation',()=>{
 const e=env();try{
  const result=g2f.plan(e.author,'REVIEWER_A',e.a);
  const p=load(e.a);assert.equal(result.humanReviewed,0);
  assert.equal(p.kind,g2f.KIND);
  assert.equal(p.questions.length,6);
  assert.equal(p.questions[0].aiDraft.requiresHumanVerification,true);
  assert.equal(p.questions[0].review.decision,'PENDING');
  assert.equal(p.questions[0].review.answerText,null);
  assert.equal(g2f.validate(p).pending,6);
  assert.equal(p.goldApproved,false);assert.equal(p.g3Authorized,false);
  assert.ok(!e.a.includes('blind-review'));
 }finally{clean(e);}
});
test('AI proposal may be accepted only after human source/evidence check',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);
  const p=load(e.a),q=p.questions[0];q.review.decision='ACCEPT';q.review.verdict=q.aiDraft.proposedVerdict;
  q.review.answerText=q.aiDraft.answerText;
  assert.throws(()=>g2f.validate(p),/actual local film inspected/);
  q.review.watchedSource=true;
  assert.throws(()=>g2f.validate(p),/evidence ranges/);
  q.review.evidence=q.aiDraft.evidenceHints.map(x=>({...x,observationNote:'Human film reviewer actually checked source scene evidence'}));
  assert.equal(g2f.validate(p).accepted,1);
  assert.equal(g2f.validate(p).blindIndependentReview,false);
 }finally{clean(e);}
});
test('editing AI proposal is permitted and explicitly tracked, not blind or gold approval',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);const p=humanReview(load(e.a));
  const q=p.questions[0];q.review.decision='EDIT';q.review.answerText+=' Human corrected qualification.';
  q.review.reviewerNote='Reviewer observed an inaccurate or incomplete draft and corrected this response.';
  const result=g2f.validate(p);assert.equal(result.edited,1);assert.equal(result.accepted,5);
  assert.equal(result.humanReviewed,6);assert.equal(result.goldApproved,false);
 }finally{clean(e);}
});
test('reject/uncertain AI answers require explicit issue notes, no fabricated positive answer',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);const p=load(e.a),q=p.questions[2];
  q.review.decision='REJECT';q.review.verdict='AMBIGUOUS';q.review.watchedSource=true;
  assert.throws(()=>g2f.validate(p),/reject\/uncertain/);
  q.review.reviewerNote='The original screen is different from the AI proposal. The question requires rewriting.';
  const r=g2f.validate(p);assert.equal(r.rejected,1);assert.equal(r.pending,5);
 }finally{clean(e);}
});
test('unsupported AI claim requires full film verification, not AI guesses',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);const p=load(e.a),q=p.questions[5];
  q.review.decision='ACCEPT';q.review.verdict='UNSUPPORTED';q.review.answerText=q.aiDraft.answerText;
  q.review.watchedSource=true;
  assert.throws(()=>g2f.validate(p),/full original film review/);
  q.review.fullMovieReviewed=true;
  q.review.absenceRationale='Synthetic human reviewer watched whole original film, absence unverified here.';
  assert.equal(g2f.validate(p).accepted,1);
 }finally{clean(e);}
});
test('cannot forge gold, G3, source metadata, AI suggestions or duplicate reviewer code',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);const p=load(e.a);
  for(const [k,v] of [['goldApproved',true],['g3Authorized',true],['externalProviderCalls',1],['actualSpendUsd',1]]){
   const copy=structuredClone(p);copy[k]=v;assert.throws(()=>g2f.validate(copy),/approvals denied/);
  }
  const changed=structuredClone(p);changed.questions[0].aiDraft.answerText+=' edited hidden';assert.throws(()=>g2f.validate(changed),/metadata modified/);
  assert.throws(()=>g2f.plan(e.author,'REVIEWER_A',e.a),/overwrite/);
  assert.throws(()=>g2f.plan(e.author,'LOCAL_AUTHOR_1',e.b),/operator cannot/);
 }finally{clean(e);}
});
test('Tears keeps 5-second YouTube uncertainty while AI draft uses local film only',()=>{
 const e=env('TearsOfSteel');try{
  g2f.plan(e.author,'REVIEWER_B',e.b);const p=load(e.b);
  assert.equal(p.questions.length,6);
  assert.ok(p.questions[0].questionId.startsWith('G2E-TOS'));
  assert.equal(p.questions[0].aiDraft.proposedVerdict,'SUPPORTED');
  assert.equal(g2f.validate(p).pending,6);
 }finally{clean(e);}
});
test('pair assessment never claims BLIND independent gold even if both reviewers accept',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);g2f.plan(e.author,'REVIEWER_B',e.b);
  save(e.a,humanReview(load(e.a)));save(e.b,humanReview(load(e.b)));
  const report=g2f.assess(e.author,e.a,e.b);
  assert.equal(report.status,'TWO_AI_ASSISTED_REVIEW_REPORTS_SUBMITTED_PENDING_HUMAN_ADJUDICATION');
  assert.equal(report.reviewerVerdictAgreements,6);
  assert.equal(report.blindReviewCount,0);
  assert.equal(report.independentGoldApproved,0);
  assert.equal(report.g3Authorized,false);
 }finally{clean(e);}
});
test('AI-assisted reviewers may disagree and conflict is retained for reconciliation',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);g2f.plan(e.author,'REVIEWER_B',e.b);
  const a=humanReview(load(e.a)),b=humanReview(load(e.b));
  const r=b.questions[0].review;
  r.decision='UNCERTAIN';r.verdict='AMBIGUOUS';r.answerText=null;r.evidence=[];
  r.reviewerNote='Synthetic second reviewer is uncertain about the speaker and timing from this film.';
  save(e.a,a);save(e.b,b);
  const out=g2f.assess(e.author,e.a,e.b);
  assert.equal(out.reviewerVerdictDisagreements,1);
  assert.ok(out.flaggedQuestions.some(x=>x.reason==='REVIEWER_VERDICT_CONFLICT'));
 }finally{clean(e);}
});
test('source G2-E change invalidates already started assisted review',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);g2f.plan(e.author,'REVIEWER_B',e.b);
  const src=load(e.author);src.questions[0].gold.answerText+=' later correction';save(e.author,src);
  assert.throws(()=>g2f.assess(e.author,e.a,e.b),/original source changed/);
 }finally{clean(e);}
});
test('assisted browser API returns AI draft but no author answers or another reviewers files',async()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);
  const secret=path.join(e.dir,'B-private.json');fs.writeFileSync(secret,'SECRET_REVIEWER_B_ANSWER');
  const movie=path.join(e.dir,'proxy.mp4');fs.writeFileSync(movie,Buffer.alloc(150,0x6b));
  const state={film:'Sintel',reviewer:'REVIEWER_A',packet:e.a,proxy:movie,cues:[],
   waveform:{windowMs:50,peaks:[0.1,0.3]}};
  const server=http.createServer((req,res)=>{void web.handler(state,server.address().port,req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
   const result=await fetch(origin+'/api/session'),body=await result.text(),session=JSON.parse(body);
   assert.equal(result.status,200);
   assert.equal(session.reviewMode,'AI_ASSISTED_NON_BLIND');
   assert.equal(session.sourceChecks.operatorGoldLoaded,false);
   assert.equal(session.sourceChecks.otherReviewerLoaded,false);
   assert.equal(session.packet.questions.length,6);
   assert.ok(!body.includes('Synthetic user operator draft from source film'));
   assert.ok(!body.includes('SECRET_REVIEWER_B_ANSWER'));
   const tampered=structuredClone(session.packet);tampered.goldApproved=true;
   const rejected=await fetch(origin+'/api/save',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({packet:tampered,revision:session.revision})});
   assert.equal(rejected.status,400);
   const fresh=structuredClone(session.packet),q=fresh.questions[0];
   q.review.decision='ACCEPT';q.review.verdict=q.aiDraft.proposedVerdict;
   q.review.answerText=q.aiDraft.answerText;q.review.watchedSource=true;
   q.review.evidence=q.aiDraft.evidenceHints.map(x=>({...x,
    observationNote:'Source review observed personally during synthetic automation QA'}));
   const saved=await fetch(origin+'/api/save',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({packet:fresh,revision:session.revision})});
   assert.equal(saved.status,200);
   assert.equal((await saved.json()).summary.accepted,1);
   const reload=(await (await fetch(origin+'/api/session')).json());
   assert.equal(reload.packet.questions[0].review.decision,'ACCEPT');
  }finally{await new Promise(resolve=>server.close(resolve));}
 }finally{clean(e);}
});
test('separate assisted form has no blind independence toggle or automatic gold approval',()=>{
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'g2f-assisted-workspace.html'),'utf8');
 const client=fs.readFileSync(path.join(root,'g2f-assisted-workspace-client.js'),'utf8');
 const server=fs.readFileSync(path.join(root,'g2f-assisted-workspace-server.cjs'),'utf8');
 for(const id of ['aiAnswer','aiCaveat','decision','reviewerNote','negativeNote','watched','verdict','answer','evidenceList']){
  assert.ok(html.includes('id="'+id+'"'),id+' absent');
 }
 assert.ok(html.includes('비블라인드'));
 assert.ok(!html.includes('id="blind"'));
 assert.ok(!server.includes('g2e-gold-pilot.cjs'));
 assert.ok(!server.includes('state.goldFile'));
 assert.ok(client.includes("fetch('/api/save'"));
 assert.ok(!client.includes('https://'));
});


test('reviewer may overturn an AI UNSUPPORTED guess with positive local film evidence',()=>{
 const e=env();try{
  g2f.plan(e.author,'REVIEWER_A',e.a);const p=load(e.a),q=p.questions[5];
  q.review.decision='EDIT';q.review.verdict='SUPPORTED';q.review.watchedSource=true;
  q.review.answerText='Synthetic reviewer found an actual source statement that contradicts the guessed absence.';
  q.review.reviewerNote='The AI unsupported claim was wrong; original film directly supports this new answer.';
  q.review.evidence=[{modality:'AUDIO',localStartMs:200000,localEndMs:202000,
   observationNote:'Synthetic positive source evidence directly refuting the missing-timing hypothesis'}];
  const summary=g2f.validate(p);assert.equal(summary.edited,1);assert.equal(summary.goldApproved,false);
 }finally{clean(e);}
});
