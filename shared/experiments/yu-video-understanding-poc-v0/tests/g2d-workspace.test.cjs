'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const media=require('../g2d-workspace-media.cjs');
const workspace=require('../g2d-workspace-server.cjs');
const g2d=require('../g2d-human-review.cjs');

function fixture(film='Sintel'){
 const tears=film==='TearsOfSteel',n=tears?76:26;
 const duration=tears?734167:888032,start=tears?23000:107250,last=tears?567000:629800;
 const rows=Array.from({length:n},(_,i)=>{
  const s=Math.floor(start+(last-start-2000)*i/(n-1));return {startMs:s,endMs:Math.min(last,s+2000)};
 });
 rows[rows.length-1].endMs=last;
 const evidence={status:'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY',slot:g2d.FILMS[film].slot,
  video:{sha256:'a'.repeat(64),durationMs:duration},caption:{sha256:'b'.repeat(64),
   cueCount:n,lastEndMs:last,syntaxAndDurationBounds:'PASS_BOUNDS_ONLY'},
  providerCalls:0,g3Authorized:false};
 return g2d.completePacket(film,evidence,rows);
}
function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'youtopia-g2d-workspace-'));}
function fixtureFile(dir,film='Sintel'){
 const f=path.join(dir,film+'-manual-review.json');
 fs.writeFileSync(f,JSON.stringify(fixture(film),null,2)+'\n','utf8');return f;
}
test('workspace is fixed to two G2-C local film paths and never accepts an URL',()=>{
 const root=path.join(path.resolve(os.tmpdir()),'operator','AppData','Local');
 const sintel=media.filmFiles('Sintel',root),tears=media.filmFiles('TearsOfSteel',root);
 assert.ok(sintel.movie.endsWith('Sintel.2010.720p.mkv'));
 assert.ok(tears.movie.endsWith('tears_of_steel_720p.mov'));
 assert.ok(sintel.review.endsWith('Sintel-manual-review.json'));
 assert.ok(sintel.cacheRoot.startsWith(root));
 assert.throws(()=>media.filmFiles('https://youtube.com',root),/unknown film/);
 assert.throws(()=>workspace.parseCli(['--film','https://bad.site']),/only --film/);
 assert.deepEqual(workspace.parseCli(['--film','Sintel']),{film:'Sintel'});
});
test('50ms waveform bins from signed PCM work with split byte chunks',()=>{
 const b=media.pcmPeakBinner(1000,50);
 const pcm=Buffer.alloc(200);
 for(let i=0;i<100;i++)pcm.writeInt16LE(i<50?16384:-8192,i*2);
 b.add(pcm.subarray(0,13));b.add(pcm.subarray(13,121));b.add(pcm.subarray(121));
 const out=b.result();
 assert.equal(out.windowMs,50);assert.equal(out.totalSamples,100);
 assert.equal(out.peaks.length,2);assert.ok(Math.abs(out.peaks[0]-0.5)<0.001);
 assert.ok(Math.abs(out.peaks[1]-0.25)<0.001);
});
test('waveform cannot be calculated from a truncated PCM sample',()=>{
 const b=media.pcmPeakBinner();b.add(Buffer.from([0x11]));
 assert.throws(()=>b.result(),/truncated PCM/);
});
test('SRT text reader supports adjacent numbered publisher cues and multiline subtitle',()=>{
 const txt='1\n00:00:01,000 --> 00:00:01,500\nFirst test\nSecond line\n2\n00:00:02,000 --> 00:00:03,000\nNext test';
 const rows=[{startMs:1000,endMs:1500},{startMs:2000,endMs:3000}];
 const out=media.parseLocalSrt(txt,rows);
 assert.equal(out.length,2);assert.equal(out[0].text,'First test\nSecond line');assert.equal(out[1].startMs,2000);
 assert.throws(()=>media.parseLocalSrt(txt,[rows[0]]),/known cue timing/);
});
test('cache fingerprint includes true local file size and is blocked for symlinks',()=>{
 const d=temp();
 try{const m=path.join(d,'a.mkv');fs.writeFileSync(m,Buffer.alloc(1000001));
 const key=media.sourceCacheKey('Sintel',m,'a'.repeat(64));
 assert.match(key,/^[0-9a-f]{24}$/);
 assert.notEqual(key,media.sourceCacheKey('Sintel',m,'b'.repeat(64)));
 const link=path.join(d,'linked.mkv');fs.symlinkSync(m,link);
 assert.throws(()=>media.sourceCacheKey('Sintel',link,'a'.repeat(64)),/local source movie/);
 }finally{fs.rmSync(d,{force:true,recursive:true});}
});
test('review files are validated and existing packet digest is preserved on save',()=>{
 const d=temp();
 try{const file=fixtureFile(d);
 const initial=workspace.loadReview(file,'Sintel');
 assert.equal(initial.packet.g3Authorized,false);
 const edited=structuredClone(initial.packet);
 edited.checkpoints[0].verdict='UNCERTAIN';
 edited.checkpoints[0].observationNote='Directly inspected the cue but cannot confidently locate spoken onset';
 const next=workspace.applyUpdate(file,'Sintel',{revision:initial.revision,packet:edited});
 assert.equal(next.summary.status,'PENDING_HUMAN_REVIEW');
 assert.notEqual(next.revision,initial.revision);
 assert.equal(workspace.loadReview(file,'Sintel').packet.checkpoints[0].verdict,'UNCERTAIN');
 assert.throws(()=>workspace.applyUpdate(file,'Sintel',{revision:initial.revision,packet:edited}),/stale review/);
 }finally{fs.rmSync(d,{force:true,recursive:true});}
});
test('workspace rejects forged G3/immutable fields instead of allowing UI authorization',()=>{
 const d=temp();try{
 const file=fixtureFile(d),initial=workspace.loadReview(file,'Sintel');
 for(const mutate of [x=>x.g3Authorized=true,x=>x.local.videoSha256='c'.repeat(64),
 x=>x.checkpoints[0].localMs+=100]){
  const edited=structuredClone(initial.packet);mutate(edited);
  assert.throws(()=>workspace.applyUpdate(file,'Sintel',{revision:initial.revision,packet:edited}));
 }
 assert.equal(workspace.loadReview(file,'Sintel').packet.g3Authorized,false);
 }finally{fs.rmSync(d,{force:true,recursive:true});}
});
test('HTTP range serves local proxy bytes only and returns 416 for out-of-bounds',async()=>{
 const d=temp();let server;
 try{
  const file=fixtureFile(d),movie=path.join(d,'fake.mp4');fs.writeFileSync(movie,Buffer.from('0123456789abcdef'));
  const state={film:'Sintel',review:file,proxy:movie,waveform:{windowMs:50,peaks:[.1,.4]},cues:[]};
  server=http.createServer((req,res)=>workspace.serverHandler(state,server.address().port,req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port,base='http://127.0.0.1:'+port;
  let response=await fetch(base+'/movie',{headers:{Range:'bytes=3-8'}});
  assert.equal(response.status,206);assert.equal(await response.text(),'345678');
  response=await fetch(base+'/movie',{headers:{Range:'bytes=99-123'}});
  assert.equal(response.status,416);
  response=await fetch(base+'/api/session');
  assert.equal(response.status,200);
  const session=await response.json();assert.equal(session.packet.g3Authorized,false);
  assert.equal(session.youtubeDownloadEnabled,false);
  assert.equal(session.localOnly,true);
  for(const [url,type] of [['/','text/html'],['/style.css','text/css'],['/client.js','text/javascript']]){
   const r=await fetch(base+url);assert.equal(r.status,200);
   assert.ok((r.headers.get('content-type')||'').startsWith(type));
  }
  response=await fetch(base+'/api/save',{method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},
   body:JSON.stringify({packet:session.packet,revision:session.revision})});
  assert.equal(response.status,400);
  assert.equal(workspace.loadReview(file,'Sintel').revision,session.revision);
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  fs.rmSync(d,{force:true,recursive:true});
 }
});
test('workspace HTML and client source do not include model uploads or unguarded YouTube capture',()=>{
 const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'g2d-workspace.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'g2d-workspace-client.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'g2d-workspace.css'),'utf8');
 const server=fs.readFileSync(path.join(root,'g2d-workspace-server.cjs'),'utf8');
 for(const required of ['id="localVideo"','id="wave"','id="youtubeFrame"','id="checkpoints"','id="save"']){
  assert.ok(html.includes(required),'missing '+required);
 }
 assert.ok(js.includes("www.youtube-nocookie.com/embed/"));
 assert.ok(js.includes('textContent=caption'));
 assert.ok(!js.includes('eval('));
 assert.ok(!server.includes('createReadStream(url)'));
 assert.ok(!js.includes('fetch(review.youtubeUrl)'));
 assert.ok(css.includes('.dual'));
});
test('movie proxy creation requires existing local source; no remote sources',async()=>{
 await assert.rejects(()=>media.createProxy('https://youtube.com/watch?v=abc',path.join(os.tmpdir(),'fake.mp4')),/absolute media/);
});

test('HTTP JSON body parser keeps Korean notes when UTF-8 bytes split mid-character',async()=>{
 const {EventEmitter}=require('node:events');
 const request=new EventEmitter();
 const message=JSON.stringify({note:'발화 시작 시각과 장면을 직접 확인'});
 const bytes=Buffer.from(message,'utf8');
 const index=bytes.indexOf(Buffer.from('발','utf8'));
 assert.ok(index>0);
 const task=workspace.readJsonLimited(request);
 request.emit('data',bytes.subarray(0,index+1));
 request.emit('data',bytes.subarray(index+1));
 request.emit('end');
 const parsed=await task;
 assert.equal(parsed.note,'발화 시작 시각과 장면을 직접 확인');
});

test('FFmpeg synthetic H264+AAC clip produces playable MP4 proxy and sampled waveform',
 {skip:require('node:child_process').spawnSync('ffmpeg',['-version'],{encoding:'utf8'}).status!==0},
 async()=>{
  const {execFileSync}=require('node:child_process');
  const dir=temp();
  try{
   const source=path.join(dir,'synthetic.mkv'),proxy=path.join(dir,'proxy.mp4'),wave=path.join(dir,'peaks.json');
   execFileSync('ffmpeg',['-nostdin','-hide_banner','-v','error','-y',
    '-f','lavfi','-i','color=c=black:s=160x90:r=10:d=2',
    '-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=2',
    '-map','0:v:0','-map','1:a:0','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',source],
    {timeout:30000,windowsHide:true});
   const video=await media.createProxy(source,proxy);
   const audio=await media.createPeaks(source,wave);
   assert.equal(video.cached,false);assert.equal(audio.cached,false);
   assert.ok(fs.statSync(proxy).size>10000);
   assert.equal(audio.info.windowMs,50);
   assert.ok(audio.info.peaks.length>=30&&audio.info.peaks.length<=45);
   assert.ok(audio.info.peaks.some(x=>x>.01));
   assert.equal((await media.createProxy(source,proxy)).cached,true);
   assert.equal((await media.createPeaks(source,wave)).cached,true);
   const raw=execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name','-of','json',proxy],{encoding:'utf8'});
   const inspected=JSON.parse(raw);
   assert.ok(inspected.streams.some(x=>x.codec_name==='h264'));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 });
