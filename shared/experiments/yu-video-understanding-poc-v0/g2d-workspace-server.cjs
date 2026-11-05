'use strict';
// G2-D local-only QA workspace. Listen ONLY on 127.0.0.1; never proxies, fetches,
// or downloads YouTube streams. A Youtube-nocookie iframe is loaded BY THE USER'S BROWSER.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const g2c=require('./g2c-offline-verifier.cjs');
const g2d=require('./g2d-human-review.cjs');
const media=require('./g2d-workspace-media.cjs');
const FILMS=new Set(['Sintel','TearsOfSteel']);
function deny(ok,msg){if(!ok)throw Error('G2D_WORKSPACE_FAIL_CLOSED: '+msg);}
function digest(s){return crypto.createHash('sha256').update(s).digest('hex');}
async function fileHash(p){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(p))h.update(b);return h.digest('hex');}
function parseCli(argv){
 deny(argv.length===2&&argv[0]==='--film'&&FILMS.has(argv[1]),'only --film Sintel|TearsOfSteel');
 return {film:argv[1]};
}
function safeRegularFile(p,min=1,max=10000000000){
 const st=fs.lstatSync(p);deny(st.isFile()&&!st.isSymbolicLink()&&st.size>=min&&st.size<=max,'local file missing, symlink or invalid');
 return st;
}
function loadReview(file,film){
 safeRegularFile(file,1,128000);
 const raw=fs.readFileSync(file,'utf8'),packet=JSON.parse(raw);
 deny(packet.film===film,'review film mismatch');
 g2d.assess(packet);
 return {packet,revision:digest(raw)};
}
function assertUpdate(oldPacket,newPacket){
 deny(oldPacket.film===newPacket.film&&oldPacket.packetDigest===newPacket.packetDigest,'review plan changed');
 deny(JSON.stringify(g2d.immutable(oldPacket))===JSON.stringify(g2d.immutable(newPacket)),
  'immutable review fields changed');
 g2d.assess(newPacket);
}
function applyUpdate(reviewFile,film,body){
 deny(body&&typeof body==='object'&&!Array.isArray(body)&&
  Object.keys(body).sort().join('|')==='packet|revision','save payload');
 const current=loadReview(reviewFile,film);
 deny(body.revision===current.revision,'stale review; refresh before saving');
 assertUpdate(current.packet,body.packet);
 const json=JSON.stringify(body.packet,null,2)+'\n';
 deny(Buffer.byteLength(json,'utf8')<128000,'review packet too large');
 const tmp=reviewFile+'.pending-'+crypto.randomBytes(8).toString('hex');
 try{
  fs.writeFileSync(tmp,json,{flag:'wx',mode:0o600});
  fs.renameSync(tmp,reviewFile);
 }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
 return {revision:digest(json),summary:g2d.assess(body.packet)};
}
function corsAndHost(req,port){
 const expected='127.0.0.1:'+port;
 deny(req.headers.host===expected,'unexpected Host header');
 if(req.method==='POST'){
  deny(req.headers.origin==='http://'+expected,'cross-site write blocked');
  deny(req.headers['content-type']==='application/json','JSON content type required');
 }
}
function readJsonLimited(req,max=128000){
 return new Promise((resolve,reject)=>{
  let n=0,buf='';
  req.on('data',chunk=>{n+=chunk.length;if(n>max){reject(Error('G2D_WORKSPACE_FAIL_CLOSED: request too large'));req.destroy();return;}buf+=chunk.toString('utf8');});
  req.on('end',()=>{try{resolve(JSON.parse(buf));}catch{reject(Error('G2D_WORKSPACE_FAIL_CLOSED: bad JSON'));}});
  req.on('error',reject);
 });
}
function serveVideo(req,res,filepath){
 const size=fs.statSync(filepath).size,range=req.headers.range;
 res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Type','video/mp4');
 res.setHeader('Cache-Control','private, no-store');
 if(!range){res.writeHead(200,{'Content-Length':size});if(req.method==='HEAD'){res.end();return;}fs.createReadStream(filepath).pipe(res);return;}
 const m=/^bytes=(\d*)-(\d*)$/.exec(range);
 if(!m){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return;}
 let start=0,end=size-1;
 if(m[1]===''){const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0){res.writeHead(416);res.end();return;}start=Math.max(0,size-suffix);}
 else {start=Number(m[1]);if(m[2]!=='')end=Number(m[2]);}
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return;}
 end=Math.min(end,size-1);
 res.writeHead(206,{'Content-Length':end-start+1,'Content-Range':"bytes "+start+"-"+end+"/"+size});
 if(req.method==='HEAD'){res.end();return;}
 fs.createReadStream(filepath,{start,end}).pipe(res);
}
function sendJson(res,obj,status=200){
 const buf=Buffer.from(JSON.stringify(obj));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':buf.length,'Cache-Control':'no-store'});res.end(buf);
}
function serverHandler(state,port,req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',[
  "default-src 'self'","script-src 'self'","style-src 'self'",
  "img-src 'self' data:","media-src 'self'","connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "object-src 'none'","base-uri 'none'","form-action 'self'"
 ].join('; '));
 try{
  corsAndHost(req,port);
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(req.method==='GET'&&url.pathname==='/'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   res.end(fs.readFileSync(path.join(__dirname,'g2d-workspace.html')));return;
  }
  if(req.method==='GET'&&url.pathname==='/style.css'){
   res.writeHead(200,{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-store'});
   res.end(fs.readFileSync(path.join(__dirname,'g2d-workspace.css')));return;
  }
  if(req.method==='GET'&&url.pathname==='/client.js'){
   res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
   res.end(fs.readFileSync(path.join(__dirname,'g2d-workspace-client.js')));return;
  }
  if((req.method==='GET'||req.method==='HEAD')&&url.pathname==='/movie'){
   serveVideo(req,res,state.proxy);return;
  }
  if(req.method==='GET'&&url.pathname==='/api/session'){
   const cur=loadReview(state.review,state.film);
   sendJson(res,{film:state.film,packet:cur.packet,revision:cur.revision,
    summary:g2d.assess(cur.packet),waveform:state.waveform,cues:state.cues,
    localOnly:true,youtubeDownloadEnabled:false,modelApiEnabled:false,
    videoProxyMayHaveAudioTranscodeDelay:true});
   return;
  }
  if(req.method==='POST'&&url.pathname==='/api/save'){
   readJsonLimited(req).then(body=>sendJson(res,applyUpdate(state.review,state.film,body)))
    .catch(()=>sendJson(res,{error:'Review rejected: invalid input, stale revision or unsupported verdict. Check local review JSON and refresh.'},400));
   return;
  }
  sendJson(res,{error:'not found'},404);
 }catch(e){sendJson(res,{error:'Local workspace request rejected. Check address and review file.'},400);}
}
async function prepare({film,localAppData}){
 deny(FILMS.has(film),'film');
 const paths=media.filmFiles(film,localAppData);
 safeRegularFile(paths.review,20,128000);
 safeRegularFile(paths.movie,1000000);
 safeRegularFile(paths.subtitle,100);
 const cur=loadReview(paths.review,film);
 const [videoHash,captionHash]=await Promise.all([fileHash(paths.movie),fileHash(paths.subtitle)]);
 deny(cur.packet.local.videoSha256===videoHash&&cur.packet.local.captionSha256===captionHash,
  'G2-C source files changed since review plan');
 const srt=g2c.parseSrt(fs.readFileSync(paths.subtitle,'utf8'));
 deny(srt.cueCount===cur.packet.local.captionCueCount&&srt.lastEndMs===cur.packet.local.captionLastEndMs,
  'SRT cue references differ from review packet');
 const cues=media.parseLocalSrt(fs.readFileSync(paths.subtitle,'utf8'),srt.rows);
 const key=media.sourceCacheKey(film,paths.movie,cur.packet.local.videoSha256);
 fs.mkdirSync(paths.cacheRoot,{recursive:true});
 const proxy=path.join(paths.cacheRoot,film+'-'+key+'.mp4');
 const waveformPath=path.join(paths.cacheRoot,film+'-'+key+'.wave.json');
 process.stdout.write('G2-D: preparing local browser media proxy (no cloud upload)...\n');
 await media.createProxy(paths.movie,proxy);
 process.stdout.write('G2-D: generating 50ms amplitude waveform from local original audio...\n');
 const wav=await media.createPeaks(paths.movie,waveformPath);
 const expected=cur.packet.local.durationMs;
 deny(Math.abs(wav.info.totalSamples/wav.info.sampleRate*1000-expected)<2500,
  'decoded audio duration differs significantly from local video');
 return {film,review:paths.review,proxy,cues,waveform:wav.info};
}
async function start({film,localAppData,port=0}){
 deny(Number.isInteger(port)&&port>=0&&port<65536,'port');
 const state=await prepare({film,localAppData});
 return new Promise((resolve,reject)=>{
  const server=http.createServer((req,res)=>serverHandler(state,server.address().port,req,res));
  server.on('error',reject);
  server.listen(port,'127.0.0.1',()=>{
   const address='http://127.0.0.1:'+server.address().port+'/';
   process.stdout.write('G2D_LOCAL_WORKSPACE_READY '+address+'\n');
   process.stdout.write('Only 127.0.0.1 accepts connections. Youtube iframe uses your browser, not a download service.\n');
   resolve({server,address});
  });
 });
}
if(require.main===module){
 (async()=>{
  const {film}=parseCli(process.argv.slice(2));
  deny(!!process.env.LOCALAPPDATA,'LOCALAPPDATA unavailable');
  await start({film,localAppData:process.env.LOCALAPPDATA});
 })().catch(e=>{process.stderr.write(String(e.message)+'\n');process.exitCode=1;});
}
module.exports={parseCli,loadReview,assertUpdate,applyUpdate,readJsonLimited,serveVideo,prepare,start,filmFiles:media.filmFiles};
