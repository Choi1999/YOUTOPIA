'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const crypto=require('node:crypto');
const g2f=require('../g2f-blind-review.cjs');
const web=require('../g2f-reviewer-workspace-server.cjs');
function sha(v){return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');}
function dir(){return fs.mkdtempSync(path.join(os.tmpdir(),'yu-g2f-web-'));}
function makePacket(reviewer='REVIEWER_A',film='Sintel'){
 const tears=film==='TearsOfSteel';
 const anchors=tears?[[23000],[260000],[73417],[367084],[73417,367084],[]]:
   [[107250],[207250],[88803],[444016],[88803,444016],[]];
 const questions=anchors.map((times,i)=>({questionId:'G2E-'+(tears?'TOS':'SIN')+'-0'+(i+1),
  questionText:'Independently describe the observed source event for question '+(i+1)+' without author answers.',
  localAnchorMs:times,
  response:{verdict:'NOT_REVIEWED',answerText:null,evidence:[],absenceRationale:null,fullMovieReviewed:false,observationNote:null}}));
 const p={schemaVersion:1,kind:'G2F_LOCAL_BLIND_REVIEW_PACKET',protocolVersion:g2f.V,
  film,publisherEdition:tears?'TEARS_2012_FIRST_HD_720P_MOV':'SINTEL_UPDATED_720P_MKV',
  sourceDraftSha256:'a'.repeat(64),sourceQuestionSha256:'b'.repeat(64),sourceVideoSha256:'c'.repeat(64),
  sourceCaptionSha256:'d'.repeat(64),durationMs:tears?734167:888032,reviewerCode:reviewer,
  blindReviewDeclaration:null,sawOperatorAnswersBeforeSubmission:null,watchedLocalPublisherFilm:null,
  questions,sourceTemplateDigest:null,goldApprovalGranted:false,g3Authorized:false,
  externalProviderCalls:0,actualSpendUsd:0};
 p.sourceTemplateDigest=sha(g2f.immutable(p));
 assert.equal(g2f.validatePacket(p).notReviewed,6);
 return p;
}
function fixture(reviewer='REVIEWER_A'){
 const base=dir(),packet=path.join(base,'reviewer.json'),other=path.join(base,'other-reviewer-private.json');
 const proxy=path.join(base,'movie.mp4');
 fs.writeFileSync(packet,JSON.stringify(makePacket(reviewer),null,2)+'\n');
 fs.writeFileSync(other,'SECRET_OTHER_REVIEWER_PRIVATE_ANSWER_987654');
 fs.writeFileSync(path.join(base,'operator-secret.txt'),'SECRET_G2E_GOLD_ANSWER_123456');
 fs.writeFileSync(proxy,Buffer.alloc(200,0x77));
 const state={packet,reviewer,film:'Sintel',proxy,cues:[{number:1,startMs:107250,endMs:108250,text:'Local source SRT text'}],
  waveform:{windowMs:50,peaks:[0,0.1,0.3,0.2]}};
 return {base,packet,other,proxy,state};
}
async function openServer(state,fn){
 const server=http.createServer((req,res)=>{void web.handler(state,server.address().port,req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{await fn({origin,server});}finally{await new Promise(resolve=>server.close(resolve));}
}
function cleanup(f){fs.rmSync(f.base,{recursive:true,force:true});}
test('G2-F reviewer web requires explicit exactly one packet, source video, SRT and reviewer',()=>{
 assert.deepEqual(web.parseCli(['--packet','/private/A.json','--movie','/private/movie.mkv',
  '--srt','/private/subs.srt','--reviewer','REVIEWER_A']),
  {packet:'/private/A.json',movie:'/private/movie.mkv',srt:'/private/subs.srt',reviewer:'REVIEWER_A'});
 assert.throws(()=>web.parseCli(['--film','Sintel']),/required/);
 assert.throws(()=>web.parseCli(['--packet','a','--movie','b','--srt','c','--reviewer','../../etc']),/reviewer code/);
});
test('G2-F source endpoint shows exclusively the selected reviewer packet and local source cues, never author gold',async()=>{
 const f=fixture();
 try{
  await openServer(f.state,async({origin})=>{
   const res=await fetch(origin+'/api/session');
   assert.equal(res.status,200);
   const raw=await res.text(),v=JSON.parse(raw);
   assert.equal(v.reviewerCode,'REVIEWER_A');assert.equal(v.packet.questions.length,6);
   assert.equal(v.packet.questions[0].response.answerText,null);
   assert.equal(v.sourceChecks.operatorGoldLoaded,false);
   assert.equal(v.sourceChecks.otherReviewerLoaded,false);
   assert.ok(!raw.includes('SECRET_G2E_GOLD_ANSWER_123456'));
   assert.ok(!raw.includes('SECRET_OTHER_REVIEWER_PRIVATE_ANSWER_987654'));
   assert.ok(!raw.includes('gold.answerText'));
   assert.equal(res.headers.get('access-control-allow-origin'),null);
   assert.equal(res.headers.get('x-frame-options'),'DENY');
   assert.ok(res.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  });
 }finally{cleanup(f);}
});
test('G2-F only serves known fixed routes, cannot browse author files, arbitrary local paths or other reviewer data',async()=>{
 const f=fixture();
 try{
  await openServer(f.state,async({origin})=>{
   for(const route of ['/other-reviewer-private.json','/operator-secret.txt','/api/g2e/session',
    '/api/author','/api/admin','/files?path=other-reviewer-private.json','/../operator-secret.txt']){
    const r=await fetch(origin+route);
    assert.notEqual(r.status,200,'unexpected route accessible '+route);
   }
   for(const route of ['/','/client.js','/style.css']){
    const r=await fetch(origin+route);
    assert.equal(r.status,200,'reviewer frontend asset missing '+route);
   }
  });
 }finally{cleanup(f);}
});
test('G2-F persists only this reviewer independent answer, preserving current question immutable identity',async()=>{
 const f=fixture();
 try{
  await openServer(f.state,async({origin})=>{
   const before=await (await fetch(origin+'/api/session')).json();
   const proposed=structuredClone(before.packet),q=proposed.questions[0],t=q.localAnchorMs[0];
   q.response.verdict='SUPPORTED';
   q.response.answerText='Synthetic reviewer independent response, not a verified film fact.';
   q.response.evidence=[{modality:'AUDIO',localStartMs:t-1000,localEndMs:t+2000,
    observationNote:'Synthetic review observation against only local official source timeline'}];
   const saved=await fetch(origin+'/api/save',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({packet:proposed,revision:before.revision})});
   assert.equal(saved.status,200);
   const summary=(await saved.json()).summary;
   assert.equal(summary.answered,1);
   assert.equal(summary.independentGoldApprovalCount,0);assert.equal(summary.g3Authorized,false);
   const reloaded=(await (await fetch(origin+'/api/session')).json()).packet;
   assert.equal(reloaded.questions[0].response.answerText,q.response.answerText);
   assert.equal(reloaded.questions[1].response.answerText,null);
   assert.ok(fs.readFileSync(f.other,'utf8').includes('SECRET_OTHER_REVIEWER'));
   const stale=await fetch(origin+'/api/save',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({packet:proposed,revision:before.revision})});
   assert.equal(stale.status,400);
  });
 }finally{cleanup(f);}
});
test('G2-F rejects invalid answers, forged approval, altered reviewer identity, or cross-origin writes without altering local packet',async()=>{
 const f=fixture();
 try{
  await openServer(f.state,async({origin})=>{
   const before=(await (await fetch(origin+'/api/session')).json());
   const original=fs.readFileSync(f.packet,'utf8');
   const attempts=[];
   const forged=structuredClone(before.packet);forged.g3Authorized=true;attempts.push(forged);
   const changed=structuredClone(before.packet);changed.reviewerCode='REVIEWER_B';attempts.push(changed);
   const bad=structuredClone(before.packet);bad.questions[0].response.verdict='SUPPORTED';attempts.push(bad);
   const edited=structuredClone(before.packet);edited.questions[0].questionText+=' tampered';attempts.push(edited);
   for(const packet of attempts){
    const r=await fetch(origin+'/api/save',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
     body:JSON.stringify({packet,revision:before.revision})});
    assert.equal(r.status,400);
   }
   const evil=await fetch(origin+'/api/save',{method:'POST',headers:{Origin:'https://evil.example',
    'Content-Type':'application/json'},body:JSON.stringify({packet:before.packet,revision:before.revision})});
   assert.equal(evil.status,400);
   assert.equal(fs.readFileSync(f.packet,'utf8'),original);
  });
 }finally{cleanup(f);}
});
test('G2-F blocks wrong reviewer packet and never accepts a same-PC profile bypass',()=>{
 const f=fixture('REVIEWER_B');
 try{
  assert.throws(()=>web.load({...f.state,reviewer:'REVIEWER_A'}),/reviewer and film scope/);
  assert.equal(web.load(f.state).packet.reviewerCode,'REVIEWER_B');
 }finally{cleanup(f);}
});
test('G2-F browser handles local video range and rejects arbitrary range',async()=>{
 const f=fixture();
 try{
  await openServer(f.state,async({origin})=>{
   const full=await fetch(origin+'/movie',{headers:{Range:'bytes=3-9'}});
   assert.equal(full.status,206);assert.equal(full.headers.get('content-range'),'bytes 3-9/200');
   assert.equal((await full.arrayBuffer()).byteLength,7);
   const bad=await fetch(origin+'/movie',{headers:{Range:'bytes=200-300'}});
   assert.equal(bad.status,416);
  });
 }finally{cleanup(f);}
});
test('G2-F rejects malformed JSON body without hanging or overwriting, preserving no other reviewer leaks',async()=>{
 const f=fixture();
 try{
  await openServer(f.state,async({origin})=>{
   const before=fs.readFileSync(f.packet,'utf8');
   const r=await fetch(origin+'/api/save',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{bad json'});
   assert.equal(r.status,400);
   assert.equal(fs.readFileSync(f.packet,'utf8'),before);
  });
 }finally{cleanup(f);}
});
test('G2-F source hash integrity is checked before any ffmpeg processing or browser session',async()=>{
 const f=fixture();
 try{
  const srt=path.join(f.base,'local.srt');fs.writeFileSync(srt,'1\n00:00:01,000 --> 00:00:02,000\nSynthetic subtitle line\n');
  const movie=path.join(f.base,'local.mkv');fs.writeFileSync(movie,Buffer.alloc(1100000,0x5d));
  await assert.rejects(()=>web.prepare({packet:f.packet,movie,srt,reviewer:'REVIEWER_A',appData:f.base}),
   /sha256 does not match/);
 }finally{cleanup(f);}
});
test('reviewer-only web source neither embeds author G2-E panel nor YouTube nor remote API',()=>{
 const root=path.join(__dirname,'..');
 const server=fs.readFileSync(path.join(root,'g2f-reviewer-workspace-server.cjs'),'utf8');
 const client=fs.readFileSync(path.join(root,'g2f-reviewer-workspace-client.js'),'utf8');
 const page=fs.readFileSync(path.join(root,'g2f-reviewer-workspace.html'),'utf8');
 for(const phrase of ['G2-E 작성자 정답','SRT','독립 검수','질문']){
  assert.ok(page.includes(phrase),'expected helpful QA UI text missing');
 }
 for(const hidden of ['g2d-workspace-client.js','g2d-workspace.html','/api/g2e/session','/api/g2e/save','YouTube IFrame']){
  assert.ok(!server.includes(hidden),'forbidden author control/server route '+hidden);
  assert.ok(!page.includes(hidden),'forbidden author UI '+hidden);
 }
 assert.ok(client.includes("fetch('/api/session'"));
 assert.ok(client.includes("fetch('/api/save'"));
 assert.ok(!client.includes("https://"));
 assert.ok(server.includes("server.listen(port,'127.0.0.1'"));
 assert.ok(!server.includes("fs.readFileSync(state.goldFile"));
});
