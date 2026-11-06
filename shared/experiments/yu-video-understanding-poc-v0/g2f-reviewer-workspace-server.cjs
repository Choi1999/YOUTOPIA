'use strict';
// G2-F DEDICATED reviewer-only browser server. Independent on EACH reviewer's PC.
// Never imports/opens G2-E author answers, G2-D review packets, or other reviewer packets.
// Binds ONLY 127.0.0.1. No remote logins, YouTube iframe, analytics, provider API.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const g2f=require('./g2f-blind-review.cjs');
const g2e=require('./g2e-gold-pilot.cjs');
const g2d=require('./g2d-human-review.cjs');
const g2c=require('./g2c-offline-verifier.cjs');
const media=require('./g2d-workspace-media.cjs');
const ROOT=__dirname;
const BASE=['Sintel','TearsOfSteel'];
const CSS=path.join(ROOT,'g2f-reviewer-workspace.css');
const HTML=path.join(ROOT,'g2f-reviewer-workspace.html');
const CLIENT=path.join(ROOT,'g2f-reviewer-workspace-client.js');
function deny(cond,label){if(!cond)throw Error('G2F_REVIEWER_WEB_FAIL_CLOSED: '+label);}
function digest(s){return crypto.createHash('sha256').update(s).digest('hex');}
async function hashFile(p){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(p))h.update(b);return h.digest('hex');}
function regular(p,min=1,max=10000000000){
 deny(typeof p==='string'&&path.isAbsolute(p)&&!g2d.insideRepo(p),'absolute local path outside Git repo required');
 const stat=fs.lstatSync(p);
 deny(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>=min&&stat.size<=max,'local file invalid');
 return stat;
}
function parseCli(args){
 deny(args.length===8&&args[0]==='--packet'&&args[2]==='--movie'&&args[4]==='--srt'&&args[6]==='--reviewer',
  'required: --packet PATH --movie PATH --srt PATH --reviewer CODE');
 const [,packet,,movie,,srt,,reviewer]=args;
 deny(/^[A-Z0-9_-]{3,32}$/.test(reviewer||''),'reviewer code');
 return {packet,movie,srt,reviewer};
}
function load(state){
 regular(state.packet,100,200000);
 const raw=fs.readFileSync(state.packet,'utf8'),packet=JSON.parse(raw);
 deny(packet.reviewerCode===state.reviewer&&packet.film===state.film,'reviewer and film scope');
 const summary=g2f.validatePacket(packet);
 return {packet,revision:digest(raw),summary};
}
function editorPayload(state){
 const value=load(state);
 return {film:state.film,reviewerCode:state.reviewer,publisherEdition:value.packet.publisherEdition,
  durationMs:value.packet.durationMs,
  cueCount:state.cues.length,cues:state.cues,
  waveform:state.waveform,
  questions:value.packet.questions,blindReviewDeclaration:value.packet.blindReviewDeclaration,
  sawOperatorAnswersBeforeSubmission:value.packet.sawOperatorAnswersBeforeSubmission,
  watchedLocalPublisherFilm:value.packet.watchedLocalPublisherFilm,
  revision:value.revision,summary:value.summary,
  sourceChecks:{publisherVideoHashMatched:true,subtitleHashMatched:true,otherReviewerLoaded:false,
   operatorGoldLoaded:false,independentGoldApproved:0,g3Authorized:false}};
}
function update(state,body){
 deny(body&&typeof body==='object'&&!Array.isArray(body)&&
  Object.keys(body).sort().join('|')==='packet|revision','expected exact save payload');
 const old=load(state);
 deny(body.revision===old.revision,'outdated version: reload before editing');
 const fresh=body.packet;
 deny(fresh&&typeof fresh==='object'&&!Array.isArray(fresh),'invalid packet');
 deny(fresh.film===state.film&&fresh.reviewerCode===state.reviewer,'reviewer scope mismatch');
 deny(JSON.stringify(g2f.immutable(fresh))===JSON.stringify(g2f.immutable(old.packet)),
  'immutable film/question/reviewer/approval metadata changed');
 const summary=g2f.validatePacket(fresh);
 const json=JSON.stringify(fresh,null,2)+'\n';
 deny(Buffer.byteLength(json,'utf8')<200000,'packet too large');
 // Local atomic replacement; no network, no other review paths.
 const tmp=state.packet+'.pending-'+crypto.randomBytes(8).toString('hex');
 try{
  fs.writeFileSync(tmp,json,{flag:'wx',mode:0o600});
  fs.renameSync(tmp,state.packet);
 }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
 return {revision:digest(json),summary};
}
function securityHeaders(res){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; media-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
}
function json(res,value,status=200){
 securityHeaders(res);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
 res.end(JSON.stringify(value));
}
function staticFile(res,file,type,head=false){
 const source=fs.readFileSync(file);
 securityHeaders(res);res.writeHead(200,{'Content-Type':type,'Content-Length':source.length});
 if(head)res.end();else res.end(source);
}
function video(res,file,req){
 const st=regular(file,64);
 const size=st.size;
 const range=req.headers.range;
 let start=0,end=size-1,status=200;
 if(range!==undefined){
  const match=/^bytes=(\d+)-(\d*)$/.exec(range);
  if(!match){securityHeaders(res);res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return;}
  start=Number(match[1]);end=match[2]?Number(match[2]):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size||end>=size){
   securityHeaders(res);res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return;
  }
  status=206;
 }
 securityHeaders(res);
 const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1};
 if(status===206)headers['Content-Range']='bytes '+start+'-'+end+'/'+size;
 res.writeHead(status,headers);
 if(req.method==='HEAD'){res.end();return;}
 const stream=fs.createReadStream(file,{start,end});
 stream.on('error',()=>res.destroy());stream.pipe(res);
}
function requestBody(req,max=210000){
 return new Promise((resolve,reject)=>{
  const chunks=[];let total=0,done=false;
  const stop=e=>{if(!done){done=true;reject(e);}};
  req.on('data',chunk=>{total+=chunk.length;if(total>max){stop(Error('payload too large'));req.destroy();return;}chunks.push(chunk);});
  req.on('error',stop);
  req.on('end',()=>{if(done)return;try{done=true;resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){stop(e);}});
 });
}
function protectRequest(req,port){
 deny(req.headers.host==='127.0.0.1:'+port,'host must be exact loopback');
 deny(req.headers['sec-fetch-site']===undefined||req.headers['sec-fetch-site']==='same-origin'||req.headers['sec-fetch-site']==='none',
  'cross-site browser request blocked');
 if(req.method==='POST'){
  deny(req.headers.origin==='http://127.0.0.1:'+port,'POST same origin required');
  deny(req.headers['content-type']==='application/json','POST JSON required');
 }
}
async function handler(state,port,req,res){
 try{
  protectRequest(req,port);
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(url.search!=='')return json(res,{error:'unknown resource'},404);
  const route=url.pathname;
  if((req.method==='GET'||req.method==='HEAD')&&route==='/')return staticFile(res,HTML,'text/html; charset=utf-8',req.method==='HEAD');
  if((req.method==='GET'||req.method==='HEAD')&&route==='/style.css')return staticFile(res,CSS,'text/css; charset=utf-8',req.method==='HEAD');
  if((req.method==='GET'||req.method==='HEAD')&&route==='/client.js')return staticFile(res,CLIENT,'text/javascript; charset=utf-8',req.method==='HEAD');
  if((req.method==='GET'||req.method==='HEAD')&&route==='/movie')return video(res,state.proxy,req);
  if(req.method==='GET'&&route==='/api/session')return json(res,editorPayload(state));
  if(req.method==='POST'&&route==='/api/save'){
   try{
    const body=await requestBody(req);
    return json(res,update(state,body));
   }catch(err){return json(res,{error:'Review save rejected: verify answer, timestamps, unchanged source, and no stale concurrent changes.'},400);}
  }
  return json(res,{error:'not found'},404);
 }catch(err){return json(res,{error:'Local reviewer request blocked: check server address, origin or input.'},400);}
}
async function prepare({packet:packetFile,movie,srt,reviewer,appData}){
 deny(typeof appData==='string'&&path.isAbsolute(appData),'LOCALAPPDATA required');
 regular(packetFile,100,200000);regular(movie,1000000);regular(srt,50,200000);
 deny(packetFile!==movie&&movie!==srt&&packetFile!==srt,'source paths must be separate');
 const raw=fs.readFileSync(packetFile,'utf8'),packet=JSON.parse(raw);
 deny(BASE.includes(packet.film)&&packet.reviewerCode===reviewer,'reviewer/film identity mismatch');
 g2f.validatePacket(packet);
 const [movieHash,srtHash]=await Promise.all([hashFile(movie),hashFile(srt)]);
 deny(packet.sourceVideoSha256===movieHash&&packet.sourceCaptionSha256===srtHash,
  'local official publisher media/SRT sha256 does not match blinded pack');
 const parsed=g2c.parseSrt(fs.readFileSync(srt,'utf8'));
 deny(parsed.cueCount>0&&parsed.lastEndMs<packet.durationMs+1000,'subtitle times must fit local publisher film');
 const cues=media.parseLocalSrt(fs.readFileSync(srt,'utf8'),parsed.rows);
 const cache=path.join(appData,'YOUTOPIA','G2F-Reviewer-MediaCache');
 fs.mkdirSync(cache,{recursive:true});
 const cacheKey=media.sourceCacheKey(packet.film,movie,packet.sourceVideoSha256);
 const proxy=path.join(cache,packet.film+'-'+cacheKey+'.mp4');
 const wavePath=path.join(cache,packet.film+'-'+cacheKey+'.wave.json');
 process.stdout.write('G2F: local MP4 video proxy preparation, no cloud upload...\n');
 await media.createProxy(movie,proxy);
 process.stdout.write('G2F: local 50ms audio waveform preparation...\n');
 const w=await media.createPeaks(movie,wavePath);
 deny(Math.abs(w.info.totalSamples/w.info.sampleRate*1000-packet.durationMs)<2500,
  'local audio duration mismatch');
 return {film:packet.film,reviewer,packet:packetFile,proxy,cues,waveform:w.info};
}
async function start(args){
 const state=await prepare(args);
 const port=args.port===undefined?0:args.port;
 deny(Number.isInteger(port)&&port>=0&&port<65536,'port');
 return new Promise((resolve,reject)=>{
  const server=http.createServer((req,res)=>{void handler(state,server.address().port,req,res);});
  server.on('error',reject);
  server.listen(port,'127.0.0.1',()=>{
   const url='http://127.0.0.1:'+server.address().port+'/';
   process.stdout.write('G2F_REVIEWER_WORKSPACE_READY '+url+'\n');
   process.stdout.write('G2F reviewer '+state.reviewer+' / '+state.film+'; browser-only on THIS computer. No G2-E answers, no G3 calls.\n');
   resolve({server,url,state});
  });
 });
}
if(require.main===module){
 (async()=>{
  const input=parseCli(process.argv.slice(2));
  deny(!!process.env.LOCALAPPDATA,'Windows local AppData unavailable');
  await start({...input,appData:process.env.LOCALAPPDATA});
 })().catch(e=>{process.stderr.write(String(e.message)+'\n');process.exitCode=1;});
}
module.exports={parseCli,regular,load,editorPayload,update,protectRequest,requestBody,video,handler,prepare,start};
