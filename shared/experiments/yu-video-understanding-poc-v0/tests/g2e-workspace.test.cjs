'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const g2d=require('../g2d-human-review.cjs');
const server=require('../g2d-workspace-server.cjs');
function fixture(film='Sintel'){
 const tears=film==='TearsOfSteel',n=tears?76:26;
 const duration=tears?734167:888032,start=tears?23000:107250,last=tears?567000:629800;
 const rows=Array.from({length:n},(_,i)=>{
  const st=Math.floor(start+(last-start-2000)*i/(n-1));
  return {startMs:st,endMs:Math.min(last,st+2000)};
 });
 rows[n-1].endMs=last;
 const packet=g2d.completePacket(film,{status:'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY',slot:g2d.FILMS[film].slot,
  video:{sha256:'a'.repeat(64),durationMs:duration},
  caption:{sha256:'b'.repeat(64),cueCount:n,lastEndMs:last,syntaxAndDurationBounds:'PASS_BOUNDS_ONLY'},providerCalls:0,g3Authorized:false},rows);
 packet.youtubeUploaderObservation='OFFICIAL_OWNER_CONFIRMED';
 packet.observedYoutubeDurationMs=tears?734000:888000;
 const yt=packet.checkpoints.filter(x=>x.kind==='YOUTUBE_SCENE');
 for(const c of packet.checkpoints){
  c.verdict='OBSERVED_MATCH';
  c.observationNote='Synthetic testing only: no actual user media or fact independently inspected';
  if(c.kind==='AUDIO_SYNC')c.observedSpeechStartMs=c.localMs;
  if(c.kind==='YOUTUBE_SCENE')c.observedYoutubeMs=c.localMs+(tears?5000:0);
 }
 if(tears)yt[0].observedYoutubeMs=yt[0].localMs;
 return packet;
}
function temporary(){return fs.mkdtempSync(path.join(os.tmpdir(),'yu-g2e-workspace-'));}
function createState(dir,film='Sintel'){
 const base=path.join(dir,'G2D-ManualReviews');fs.mkdirSync(base,{recursive:true});
 const file=path.join(base,film+'-manual-review.json');
 fs.writeFileSync(file,JSON.stringify(fixture(film),null,2)+'\n');
 const gold=server.goldPathForReview(file,film);
 return {film,review:file,goldFile:gold,proxy:path.join(dir,'dummy.mp4'),cues:[],waveform:{windowMs:50,peaks:[.1,.2]}};
}
async function withServer(state,fn){
 const srv=http.createServer((req,res)=>server.serverHandler(state,srv.address().port,req,res));
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+srv.address().port;
 try{
  const get=async(route)=>{
   const res=await fetch(base+route);return {code:res.status,body:await res.json()};
  };
  const post=async(route,body,origin=base)=>{
   const res=await fetch(base+route,{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
   return {code:res.status,body:await res.json()};
  };
  await fn({get,post});
 }finally{await new Promise(resolve=>srv.close(resolve));}
}
test('G2-E private candidate path is adjacent to existing G2-D local review, never inside Git',()=>{
 const dir=temporary();try{
  const st=createState(dir);
  assert.ok(st.goldFile.endsWith('G2E-PrivateGoldDrafts'+path.sep+'Sintel-gold-candidates.json'));
  assert.equal(g2d.insideRepo(st.goldFile),false);
  assert.equal(fs.existsSync(st.goldFile),false);
 }finally{fs.rmSync(dir,{force:true,recursive:true});}
});
test('G2-E user initiated API creates six empty questions with no prefilled answers and keeps G2-D immutable',async()=>{
 const dir=temporary();
 try{
  const state=createState(dir),before=fs.readFileSync(state.review,'utf8');
  await withServer(state,async({get,post})=>{
   const empty=await get('/api/g2e/session');
   assert.equal(empty.code,200);assert.equal(empty.body.exists,false);
   assert.equal(empty.body.verifiedGoldAnswers,0);
   const created=await post('/api/g2e/plan',{});
   assert.equal(created.code,200);assert.equal(created.body.exists,true);
   assert.equal(created.body.packet.questions.length,6);
   assert.ok(created.body.packet.questions.every(q=>q.gold.answerability===null));
   assert.equal(created.body.packet.g3Authorized,false);
   const again=await post('/api/g2e/plan',{});
   assert.equal(again.code,400);
   const loaded=await get('/api/g2e/session');
   assert.equal(loaded.body.revision,created.body.revision);
  });
  assert.equal(fs.readFileSync(state.review,'utf8'),before);
 }finally{fs.rmSync(dir,{force:true,recursive:true});}
});
test('G2-E save supports one fully grounded authored answer, not marking it as approved gold',async()=>{
 const dir=temporary();
 try{
  const state=createState(dir);
  await withServer(state,async({get,post})=>{
   const created=(await post('/api/g2e/plan',{})).body;
   const packet=structuredClone(created.packet),q=packet.questions[0],t=q.anchorLocalMs[0];
   q.finalQuestionText=q.questionDraft;q.authorCode='LOCAL_AUTHOR_1';
   q.gold.answerability='SUPPORTED';
   q.gold.answerText='Synthetic placeholder answer text for QA only, not actual film evidence.';
   q.gold.evidence=[{modality:'AUDIO',localStartMs:t-1000,localEndMs:t+1000,
    youtubeObservedMs:null,observationNote:'Synthetic local source observation; no real film interpretation was performed'}];
   const saved=await post('/api/g2e/save',{packet,revision:created.revision});
   assert.equal(saved.code,200);
   assert.equal(saved.body.summary.operatorAuthored,1);
   assert.equal(saved.body.summary.realGoldApproved,false);
   assert.equal(saved.body.summary.g3Authorized,false);
   const reloaded=await get('/api/g2e/session');
   assert.equal(reloaded.code,200);
   assert.equal(reloaded.body.packet.questions[0].gold.answerability,'SUPPORTED');
   assert.equal(reloaded.body.packet.questions[0].gold.evidence[0].youtubeObservedMs,null);
   const stale=await post('/api/g2e/save',{packet,revision:created.revision});
   assert.equal(stale.code,400);
  });
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('G2-E save rejects forged approvals, arbitrary evidence, hostile cross-origin, and preserves original file',async()=>{
 const dir=temporary();try{
  const state=createState(dir);
  await withServer(state,async({post})=>{
   const created=(await post('/api/g2e/plan',{})).body;
   const before=fs.readFileSync(state.goldFile,'utf8');
   const forged=structuredClone(created.packet);forged.g3Authorized=true;
   assert.equal((await post('/api/g2e/save',{packet:forged,revision:created.revision})).code,400);
   assert.equal((await post('/api/g2e/save',{packet:created.packet,revision:created.revision},
      'https://attacker.example')).code,400);
   assert.equal(fs.readFileSync(state.goldFile,'utf8'),before);
  });
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Tears variable time-offset G2-D report still can create unverified candidate dataset, not approve gold',async()=>{
 const dir=temporary();try{
  const st=createState(dir,'TearsOfSteel');
  assert.equal(g2d.assess(JSON.parse(fs.readFileSync(st.review,'utf8'))).status,'OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW');
  await withServer(st,async({post})=>{
   const res=await post('/api/g2e/plan',{});
   assert.equal(res.code,200);
   assert.equal(res.body.packet.localSource.youtubeTimelineMapping,'OFFSET_SPREAD_5000MS_REQUIRES_REVIEW');
   assert.equal(res.body.summary.operatorAuthored,0);
  });
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('G2-E editor UI stores answers only locally, keeps G2-D player and field signatures',()=>{
 const base=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(base,'g2d-workspace.html'),'utf8');
 const client=fs.readFileSync(path.join(base,'g2d-workspace-client.js'),'utf8');
 const backend=fs.readFileSync(path.join(base,'g2d-workspace-server.cjs'),'utf8');
 for(const id of ['goldCreate','goldEditor','goldSelect','goldQuestion','goldAnswerability','goldAnswer','goldEvidence',
  'goldFullFilm','goldSave','goldMessage']){
  assert.ok(html.includes('id="'+id+'"'),'missing local gold UI '+id);
 }
 assert.ok(html.includes('id="localVideo"'));
 assert.ok(client.includes("fetch('/api/g2e/plan'"));
 assert.ok(client.includes("fetch('/api/g2e/save'"));
 assert.ok(client.includes('youtubeObservedMs:null'));
 assert.ok(backend.includes('g2e.validatePlan(packet)'));
 assert.ok(backend.includes("url.pathname==='/api/g2e/session'"));
 assert.ok(backend.includes("url.pathname==='/api/g2e/save'"));
 assert.ok(!client.includes('fetch(review.youtubeUrl)'));
});
