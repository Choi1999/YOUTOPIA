'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const g2d=require('../g2d-human-review.cjs');
const g2e=require('../g2e-gold-pilot.cjs');
const g2f=require('../g2f-assisted-review.cjs');
const g2g=require('../g2g-final-adjudication.cjs');
const web=require('../g2g-final-adjudication-server.cjs');
function tmp(){return fs.mkdtempSync(path.join(os.tmpdir(),'yu-g2g-op-'));}
function sourcePacket(film){
 const tears=film==='TearsOfSteel',n=tears?76:26,duration=tears?734167:888032,start=tears?23000:107250,last=tears?567000:629800;
 const pivot=tears?37:12,middle=tears?318000:207250;
 const rows=Array.from({length:n},(_,i)=>{const t=Math.floor(i<=pivot?start+(middle-start)*i/pivot:
  middle+(last-middle-2000)*(i-pivot)/(n-1-pivot));
  return {startMs:t,endMs:Math.min(last,t+1500)};});
 rows[n-1].endMs=last;
 const packet=g2d.completePacket(film,{status:'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY',slot:g2d.FILMS[film].slot,
  video:{sha256:'a'.repeat(64),durationMs:duration},caption:{sha256:'b'.repeat(64),
   cueCount:n,lastEndMs:last,syntaxAndDurationBounds:'PASS_BOUNDS_ONLY'},providerCalls:0,g3Authorized:false},rows);
 packet.youtubeUploaderObservation='OFFICIAL_OWNER_CONFIRMED';packet.observedYoutubeDurationMs=tears?734000:888000;
 const yt=packet.checkpoints.filter(q=>q.kind==='YOUTUBE_SCENE');
 for(const q of packet.checkpoints){
  q.verdict='OBSERVED_MATCH';q.observationNote='Synthetic operator source observation for testing only';
  if(q.kind==='AUDIO_SYNC')q.observedSpeechStartMs=q.localMs;
  if(q.kind==='YOUTUBE_SCENE')q.observedYoutubeMs=q.localMs;
 }
 if(tears){yt[1].observedYoutubeMs+=5000;yt[2].observedYoutubeMs+=5000;}
 return packet;
}
function author(film){
 const p=g2e.planFilm(film,sourcePacket(film),'c'.repeat(64));
 for(const q of p.questions){
  q.finalQuestionText=q.questionDraft;q.authorCode='OPERATOR_AUTHOR';
  q.gold.answerability=q.kind==='UNSUPPORTED'?'UNSUPPORTED':'SUPPORTED';
  q.gold.answerText='Synthetic original author answer for restricted offline test.';
  if(q.kind==='UNSUPPORTED'){
   q.gold.absenceRationale='Synthetic user-reported absence rationale in controlled unit test, not real proof.';
   q.gold.fullMovieReviewed=true;
  }else{
   q.gold.evidence=q.anchorLocalMs.map(t=>({modality:q.requiredModalities[0],
    localStartMs:t-1000,localEndMs:t+2000,youtubeObservedMs:null,
    observationNote:'Synthetic local source evidence only for unit testing'}));
  }
 }
 assert.equal(g2e.validatePlan(p).operatorAuthored,6);
 return p;
}
function human(p){
 for(const q of p.questions){
  const r=q.review;r.decision='ACCEPT';r.verdict=q.aiDraft.proposedVerdict;
  r.answerText=q.aiDraft.answerText;r.watchedSource=true;
  if(r.verdict==='UNSUPPORTED'){
   r.fullMovieReviewed=true;
   r.absenceRationale='Synthetic human reviewer claimed whole film reviewed; no real media used in CI.';
  }else r.evidence=q.aiDraft.evidenceHints.map(x=>({...x,
   observationNote:'Synthetic reviewer scene observation, no actual source media in this CI test'}));
 }
 return p;
}
function fixture(film='Sintel'){
 const dir=tmp(),authorFile=path.join(dir,film+'-source.json'),
  reviewAFile=path.join(dir,film+'-A.json'),reviewBFile=path.join(dir,film+'-B.json'),
  recordFile=path.join(dir,film+'-operator.json');
 fs.writeFileSync(authorFile,JSON.stringify(author(film),null,2)+'\n');
 g2f.plan(authorFile,'REVIEWER_A',reviewAFile);
 g2f.plan(authorFile,'REVIEWER_B',reviewBFile);
 fs.writeFileSync(reviewAFile,JSON.stringify(human(JSON.parse(fs.readFileSync(reviewAFile,'utf8'))),null,2)+'\n');
 fs.writeFileSync(reviewBFile,JSON.stringify(human(JSON.parse(fs.readFileSync(reviewBFile,'utf8'))),null,2)+'\n');
 return {dir,film,authorFile,reviewAFile,reviewBFile,recordFile};
}
function files(e){return {authorFile:e.authorFile,reviewAFile:e.reviewAFile,reviewBFile:e.reviewBFile};}
function get(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function write(p,x){fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');}
function cleanup(e){fs.rmSync(e.dir,{recursive:true,force:true});}
function approve(q,review){
 const r=q.result;r.status='APPROVE';r.selectedBasis='A';r.finalVerdict=review.verdict;
 r.finalAnswerText=review.answerText;r.operatorViewedSource=true;
 r.rationale='Human operator checked the exact local source, reviewed reviewer evidence, and approved this item.';
 if(r.finalVerdict==='UNSUPPORTED'){
  r.fullMovieReviewed=true;
  r.absenceRationale='Human operator reviewed whole source film and found no direct timestamp for unshown action.';
 }else r.finalEvidence=structuredClone(review.evidence);
}
test('G2-G creates 6 pending operator-only decisions and never edits original reviewer reports',()=>{
 const e=fixture();try{
  const before=[e.authorFile,e.reviewAFile,e.reviewBFile].map(p=>fs.readFileSync(p,'utf8'));
  const summary=g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);
  assert.equal(summary.pending,6);assert.equal(summary.operatorApproved,0);
  assert.equal(summary.finalGoldGateSatisfied,false);assert.equal(summary.g3Authorized,false);
  const record=get(e.recordFile);
  assert.equal(record.kind,g2g.TYPE);assert.equal(record.questions.length,6);
  assert.equal(record.independentBlindGoldApproved,0);assert.equal(record.g3Authorized,false);
  assert.deepEqual([e.authorFile,e.reviewAFile,e.reviewBFile].map(p=>fs.readFileSync(p,'utf8')),before);
  assert.equal(g2g.load(e.recordFile,files(e)).summary.pending,6);
  assert.throws(()=>g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile),/overwriting/);
 }finally{cleanup(e);}
});
test('G2-G rejects operator APPROVE without source confirmation or evidence and never grants blind gold',()=>{
 const e=fixture();try{
  g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);
  const p=get(e.recordFile),q=p.questions[0],r=q.result,review=get(e.reviewAFile).questions[0].review;
  r.status='APPROVE';r.selectedBasis='A';r.finalVerdict='SUPPORTED';r.finalAnswerText=review.answerText;
  r.rationale='Operator considered relevant original media and reviewer responses carefully.';
  assert.throws(()=>g2g.validate(p),/human original source review/);
  r.operatorViewedSource=true;
  assert.throws(()=>g2g.validate(p),/original source time evidence/);
  r.finalEvidence=structuredClone(review.evidence);
  const result=g2g.validate(p);assert.equal(result.operatorApproved,1);
  assert.equal(result.independentBlindGoldApproved,0);assert.equal(result.finalGoldGateSatisfied,false);
  assert.equal(result.g3Authorized,false);
 }finally{cleanup(e);}
});
test('G2-G unsupported source absence requires explicit whole-film confirmation, not reviewer checkbox',()=>{
 const e=fixture();try{
  g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);const p=get(e.recordFile),review=get(e.reviewBFile).questions[5].review,q=p.questions[5];
  q.result.status='APPROVE';q.result.finalVerdict='UNSUPPORTED';q.result.finalAnswerText=review.answerText;
  q.result.selectedBasis='B';q.result.operatorViewedSource=true;
  q.result.rationale='Operator checked every scene of the local film and independently decided this absence.';
  q.result.absenceRationale='Operator reviewed entire original film; exact time of offscreen event is never provided.';
  assert.throws(()=>g2g.validate(p),/full-film review/);
  q.result.fullMovieReviewed=true;
  assert.equal(g2g.validate(p).operatorApproved,1);
 }finally{cleanup(e);}
});
test('G2-G HOLD and REVISE require rationale and never silently create approved evidence',()=>{
 const e=fixture();try{
  g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);const p=get(e.recordFile);
  p.questions[0].result.status='REVISE';
  assert.throws(()=>g2g.validate(p),/reason required/);
  p.questions[0].result.rationale='The local time bounds and speech content require another review before approval.';
  p.questions[1].result.status='HOLD';
  p.questions[1].result.rationale='Publisher frame evidence remains uncertain at the requested local scene time.';
  assert.equal(g2g.validate(p).requiresRevision,1);
  assert.equal(g2g.validate(p).held,1);
  assert.equal(g2g.validate(p).pending,4);
  p.questions[1].result.finalVerdict='SUPPORTED';
  assert.throws(()=>g2g.validate(p),/cannot silently store an approved answer/);
 }finally{cleanup(e);}
});
test('G2-G final operator evidence cannot mutate immutable author or reviewer identities',()=>{
 const e=fixture();try{
  g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);const base=get(e.recordFile);
  for(const [k,v] of [['independentBlindGoldApproved',1],['g3Authorized',true],['externalProviderCalls',1],['actualSpendUsd',1]]){
   const p=structuredClone(base);p[k]=v;assert.throws(()=>g2g.validate(p),/default-deny/);
  }
  const p=structuredClone(base);p.questions[0].questionText+=' changed';
  assert.throws(()=>g2g.validate(p),/identity changed/);
 }finally{cleanup(e);}
});
test('G2-G rejects altered G2-F evidence after a final adjudication source snapshot was created',()=>{
 const e=fixture();try{
  g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);
  const altered=get(e.reviewAFile);
  altered.questions[0].review.evidence[0].observationNote+=' changed';
  write(e.reviewAFile,altered);
  assert.throws(()=>g2g.load(e.recordFile,files(e)),/source changed after operator record creation/);
 }finally{cleanup(e);}
});
test('G2-G rejects reviewer pair if one film is incomplete',()=>{
 const e=fixture();try{
  const p=get(e.reviewBFile);
  p.questions[0].review={decision:'PENDING',verdict:null,answerText:null,evidence:[],
   absenceRationale:null,fullMovieReviewed:false,reviewerNote:null,watchedSource:false};
  write(e.reviewBFile,p);
  assert.throws(()=>g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile),/both AI-assisted reviewer reports/);
 }finally{cleanup(e);}
});
test('G2-G saves only the final local record with optimistic revision checks and source preservation',()=>{
 const e=fixture();try{
  g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);
  const before=[e.authorFile,e.reviewAFile,e.reviewBFile].map(p=>fs.readFileSync(p,'utf8'));
  const old=g2g.load(e.recordFile,files(e)),p=structuredClone(old.record);
  approve(p.questions[0],get(e.reviewAFile).questions[0].review);
  const saved=g2g.save(e.recordFile,files(e),p,old.revision);
  assert.equal(saved.summary.operatorApproved,1);
  assert.throws(()=>g2g.save(e.recordFile,files(e),p,old.revision),/stale record/);
  assert.deepEqual([e.authorFile,e.reviewAFile,e.reviewBFile].map(p=>fs.readFileSync(p,'utf8')),before);
  assert.equal(g2g.load(e.recordFile,files(e)).summary.operatorApproved,1);
 }finally{cleanup(e);}
});
test('G2-G supports Tears of Steel and retains G3 default-deny',()=>{
 const e=fixture('TearsOfSteel');try{
  const res=g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);
  assert.equal(res.film,'TearsOfSteel');assert.equal(res.questionCount,6);
  const p=get(e.recordFile),reviews=get(e.reviewAFile);
  for(let i=0;i<p.questions.length;i++)approve(p.questions[i],reviews.questions[i].review);
  const result=g2g.validate(p);
  assert.equal(result.operatorApproved,6);assert.equal(result.pending,0);
  assert.equal(result.status,'OPERATOR_ADJUDICATION_RECORDED_NOT_BLIND_GOLD');
  assert.equal(result.finalGoldGateSatisfied,false);assert.equal(result.g3Authorized,false);
 }finally{cleanup(e);}
});
test('G2-G loopback API shows reviewer A/B + G2-E source but writes only operator file',async()=>{
 const e=fixture();try{
  g2g.plan(files(e),'FINAL_OPERATOR',e.recordFile);
  const proxy=path.join(e.dir,'proxy.mp4');fs.writeFileSync(proxy,Buffer.alloc(120,23));
  const state={record:e.recordFile,author:e.authorFile,reviewA:e.reviewAFile,reviewB:e.reviewBFile,
   movie:proxy,proxy,film:'Sintel',operator:'FINAL_OPERATOR',cues:[],waveform:{peaks:[0.1,0.2],windowMs:50}};
  const server=http.createServer((req,res)=>{void web.handler(state,server.address().port,req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/';
  try{
   const raw=await fetch(url+'api/session'),body=await raw.json();
   assert.equal(raw.status,200);assert.equal(body.record.kind,g2g.TYPE);
   assert.equal(body.sources.reviewerA.length,6);assert.equal(body.sources.reviewerB.length,6);
   assert.equal(body.sources.g2eAuthor.length,6);
   assert.equal(body.limits.blindGoldApproved,0);assert.equal(body.limits.g3Authorized,false);
   const forged=structuredClone(body.record);forged.g3Authorized=true;
   const rejected=await fetch(url+'api/save',{method:'POST',headers:{Origin:url.slice(0,-1),'Content-Type':'application/json'},
    body:JSON.stringify({record:forged,revision:body.revision})});
   assert.equal(rejected.status,400);
   const p=structuredClone(body.record);
   approve(p.questions[0],get(e.reviewAFile).questions[0].review);
   const submitted=await fetch(url+'api/save',{method:'POST',headers:{Origin:url.slice(0,-1),'Content-Type':'application/json'},
    body:JSON.stringify({record:p,revision:body.revision})});
   assert.equal(submitted.status,200);assert.equal((await submitted.json()).summary.operatorApproved,1);
   assert.equal(get(e.recordFile).questions[0].result.status,'APPROVE');
  }finally{await new Promise(resolve=>server.close(resolve));}
 }finally{cleanup(e);}
});
test('G2-G static operator web has all referenced fields and no network external dependencies',()=>{
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'g2g-final-adjudication.html'),'utf8');
 const client=fs.readFileSync(path.join(root,'g2g-final-adjudication-client.js'),'utf8');
 for(const id of ['movie','wave','questionNav','status','basis','verdict','finalAnswer','finalEvidence',
  'absenceRationale','fullMovie','viewed','rationale','save','reviewerComparisons']){
  assert.ok(html.includes('id="'+id+'"'),'missing operator UI element '+id);
 }
 assert.ok(client.includes("fetch('/api/session'"));
 assert.ok(client.includes("fetch('/api/save'"));
 assert.ok(!client.includes('https://'));
 assert.ok(html.includes('G2-G'));
 assert.ok(html.includes('Gold 승인'));
});
