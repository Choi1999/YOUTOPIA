'use strict';
// Operator-only LOCALHOST G2-G adjudication: original film + immutable G2-E/G2-F comparison.
// No cloud or outside requests. Writes ONLY private G2-G adjudication record.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const adjudication=require('./g2g-final-adjudication.cjs');
const aiDrafts=require('./g2g-adjudication-proposals.cjs');
const media=require('./g2d-workspace-media.cjs');
const g2c=require('./g2c-offline-verifier.cjs');
const assistWeb=require('./g2f-assisted-workspace-server.cjs');
const ROOT=__dirname;
const HTML=path.join(ROOT,'g2g-final-adjudication.html');
const CSS=path.join(ROOT,'g2f-assisted-workspace.css');
const CSS2=path.join(ROOT,'g2g-final-adjudication.css');
const JS=path.join(ROOT,'g2g-final-adjudication-client.js');
function gate(ok,message){if(!ok)throw Error('G2G_WEB_FAIL_CLOSED: '+message);}
function parseCli(args){
 const names=['--record','--author','--review-a','--review-b','--movie','--srt','--operator'];
 gate(args.length===names.length*2&&names.every((x,i)=>args[i*2]===x),
  'required: --record PATH --author PATH --review-a PATH --review-b PATH --movie PATH --srt PATH --operator CODE');
 const values={};
 for(let i=0;i<names.length;i++)values[names[i].slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=args[i*2+1];
 gate(/^[A-Z0-9_-]{3,32}$/.test(values.operator||''),'operator code');
 return values;
}
function security(res){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; media-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}
function sendJson(res,value,status=200){
 security(res);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));
}
function sendFile(res,file,type,head=false){
 const content=fs.readFileSync(file);security(res);
 res.writeHead(200,{'Content-Type':type,'Content-Length':content.length});
 if(head)res.end();else res.end(content);
}
function sourceFiles(state){
 return {authorFile:state.author,reviewAFile:state.reviewA,reviewBFile:state.reviewB};
}
function session(state){
 const current=adjudication.load(state.record,sourceFiles(state));
 gate(current.record.operatorCode===state.operator&&current.record.film===state.film,'operator or film mismatch');
 return {film:state.film,operatorCode:state.operator,record:current.record,
  revision:current.revision,summary:current.summary,cues:state.cues,waveform:state.waveform,
  aiDraftSuggestions:aiDrafts.suggestions(state.film,current.record.questions),
  sources:{reviewerA:current.sources.a.questions.map(x=>({questionId:x.questionId,review:x.review})),
   reviewerB:current.sources.b.questions.map(x=>({questionId:x.questionId,review:x.review})),
   g2eAuthor:current.sources.author.questions.map(x=>({questionId:x.id,answerability:x.gold.answerability,
    answerText:x.gold.answerText}))},
  limits:{assistedNonBlind:true,aiDraftSuggestionsUnverified:true,
   operatorDecisionRemainsPendingUntilSaved:true,blindGoldApproved:0,g3Authorized:false,
   operatorCanOnlyWriteOwnAdjudicationRecord:true,publisherVideoSha256Verified:true,
   publisherSubtitleSha256Verified:true,sourceReportsFrozenByHash:true}};
}
function update(state,body){
 gate(body&&typeof body==='object'&&!Array.isArray(body)&&
  Object.keys(body).sort().join('|')==='record|revision','save payload shape');
 const current=adjudication.load(state.record,sourceFiles(state));
 gate(current.record.operatorCode===state.operator,'operator identity');
 return adjudication.save(state.record,sourceFiles(state),body.record,body.revision);
}
async function handler(state,port,req,res){
 try{
  assistWeb.protectRequest(req,port);
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(url.search!=='')return sendJson(res,{error:'invalid resource'},404);
  const route=url.pathname;
  const head=req.method==='HEAD';
  if(['GET','HEAD'].includes(req.method)){
   if(route==='/')return sendFile(res,HTML,'text/html; charset=utf-8',head);
   if(route==='/style.css')return sendFile(res,CSS,'text/css; charset=utf-8',head);
   if(route==='/operator.css')return sendFile(res,CSS2,'text/css; charset=utf-8',head);
   if(route==='/client.js')return sendFile(res,JS,'text/javascript; charset=utf-8',head);
   if(route==='/movie')return assistWeb.video(res,state.proxy,req);
   if(route==='/api/session'&&req.method==='GET')return sendJson(res,session(state));
  }
  if(req.method==='POST'&&route==='/api/save'){
   try{
    const body=await assistWeb.requestBody(req);
    return sendJson(res,update(state,body));
   }catch(e){return sendJson(res,{error:'Operator decision rejected: check reason, source review, evidence, or source revisions.'},400);}
  }
  return sendJson(res,{error:'unknown resource'},404);
 }catch(e){return sendJson(res,{error:'Operator localhost request blocked.'},400);}
}
async function fileHash(file){
 const hasher=crypto.createHash('sha256');
 for await(const chunk of fs.createReadStream(file))hasher.update(chunk);
 return hasher.digest('hex');
}
async function prepare(args){
 const files={authorFile:args.author,reviewAFile:args.reviewA,reviewBFile:args.reviewB};
 const initial=adjudication.load(args.record,files);
 gate(args.operator===initial.record.operatorCode,'explicit operator identity');
 const film=initial.record.film;
 assistWeb.regular(args.movie,1000000);
 assistWeb.regular(args.srt,50,200000);
 gate(new Set([args.record,args.author,args.reviewA,args.reviewB,args.movie,args.srt]).size===6,
  'distinct private source/media paths');
 const [movieHash,srtHash]=await Promise.all([fileHash(args.movie),fileHash(args.srt)]);
 gate(initial.record.sourceVideoSha256===movieHash&&initial.record.sourceCaptionSha256===srtHash,
  'local publisher movie or SRT does not match G2-E original hashes');
 const parsed=g2c.parseSrt(fs.readFileSync(args.srt,'utf8'));
 gate(parsed.cueCount>0&&parsed.lastEndMs<initial.record.durationMs+1000,'local SRT bounds');
 const cues=media.parseLocalSrt(fs.readFileSync(args.srt,'utf8'),parsed.rows);
 const appData=process.env.LOCALAPPDATA;
 gate(typeof appData==='string'&&path.isAbsolute(appData),'LOCALAPPDATA required');
 const cache=path.join(appData,'YOUTOPIA','G2F-Reviewer-MediaCache');
 fs.mkdirSync(cache,{recursive:true});
 const key=media.sourceCacheKey(film,args.movie,movieHash);
 const proxy=path.join(cache,film+'-'+key+'.mp4');
 const waveformPath=path.join(cache,film+'-'+key+'.wave.json');
 process.stdout.write('G2G: preparing existing private video cache; no uploads...\n');
 await media.createProxy(args.movie,proxy);
 const waveform=(await media.createPeaks(args.movie,waveformPath)).info;
 gate(Math.abs(waveform.totalSamples/waveform.sampleRate*1000-initial.record.durationMs)<2500,
  'original audio duration mismatch');
 return {...args,film,proxy,cues,waveform};
}
async function start(args){
 const state=await prepare(args);
 return new Promise((resolve,reject)=>{
  const server=http.createServer((req,res)=>{void handler(state,server.address().port,req,res);});
  server.on('error',reject);
  server.listen(0,'127.0.0.1',()=>{
   const url='http://127.0.0.1:'+server.address().port+'/';
   process.stdout.write('G2G_FINAL_ADJUDICATION_READY '+url+'\n');
   process.stdout.write('Operator-only localhost adjudication, '+state.film+'; G2-E/G2-F immutable and G3 still blocked.\n');
   resolve({server,url,state});
  });
 });
}
if(require.main===module){
 (async()=>{const args=parseCli(process.argv.slice(2));await start(args);})().catch(e=>{
  process.stderr.write(String(e.message)+'\n');process.exitCode=1;
 });
}
module.exports={parseCli,sourceFiles,session,update,handler,prepare,start};
