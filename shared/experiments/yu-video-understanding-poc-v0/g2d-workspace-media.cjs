'use strict';
// Offline FFmpeg helpers for G2-D: create a browser-playable MP4 proxy and
// 50ms amplitude peaks from authorized LOCAL movie. No URLs or provider APIs.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');

function insist(ok,msg){if(!ok)throw Error('G2D_WORKSPACE_FAIL_CLOSED: '+msg);}
function filmFiles(film,localAppData){
 insist(film==='Sintel'||film==='TearsOfSteel','unknown film');
 insist(typeof localAppData==='string'&&path.isAbsolute(localAppData),'LOCALAPPDATA required');
 const root=path.join(localAppData,'YOUTOPIA');
 const media=path.join(root,'G2C-AuthorizedPublisherMedia',film);
 const review=path.join(root,'G2D-ManualReviews',film+'-manual-review.json');
 const movie=path.join(media,film==='Sintel'?'Sintel.2010.720p.mkv':'tears_of_steel_720p.mov');
 const subtitle=path.join(media,film==='Sintel'?'sintel_en.srt':'TOS-en.srt');
 return {film,root,review,movie,subtitle,cacheRoot:path.join(root,'G2D-Workspace-Cache')};
}
function sourceCacheKey(film,moviePath,localFingerprint){
 insist(/^[a-f0-9]{64}$/.test(localFingerprint),'local movie fingerprint required');
 const stat=fs.lstatSync(moviePath);insist(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>1000000,'local source movie required');
 return crypto.createHash('sha256').update(JSON.stringify({film,localFingerprint,
   size:stat.size,modifiedMs:stat.mtimeMs})).digest('hex').slice(0,24);
}
function pcmPeakBinner(sampleRate=8000,windowMs=50){
 insist(Number.isInteger(sampleRate)&&sampleRate>0&&Number.isInteger(windowMs)&&windowMs>0,'binner input');
 const samplesPerPeak=Math.round(sampleRate*windowMs/1000);
 insist(samplesPerPeak>0,'peak resolution');
 const peaks=[];let peak=0,count=0,carry=null,totalSamples=0;
 return {
  add(data){
   insist(Buffer.isBuffer(data),'PCM buffer');
   let i=0;
   if(carry!==null&&data.length){
    const sample=carry|(data[0]<<8);peak=Math.max(peak,Math.abs((sample<<16)>>16)/32768);
    count++;totalSamples++;carry=null;i=1;
    if(count===samplesPerPeak){peaks.push(+peak.toFixed(4));peak=0;count=0;}
   }
   for(;i+1<data.length;i+=2){
    const value=data.readInt16LE(i);
    peak=Math.max(peak,Math.abs(value)/32768);
    totalSamples++;count++;
    if(count===samplesPerPeak){peaks.push(+peak.toFixed(4));peak=0;count=0;}
   }
   if(i<data.length)carry=data[i];
  },
  result(){
   insist(carry===null,'truncated PCM sample');
   if(count>0)peaks.push(+peak.toFixed(4));
   insist(peaks.length>0&&totalSamples>0,'no audio samples');
   return {sampleRate,windowMs,totalSamples,peaks};
  }
 };
}
function spawnFfmpeg(args,{onStdout=null}={}){
 return new Promise((resolve,reject)=>{
  const p=spawn('ffmpeg',args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stderr='',settled=false;
  p.stderr.on('data',v=>{stderr=(stderr+v.toString('utf8')).slice(-2000);});
  if(onStdout)p.stdout.on('data',v=>{try{onStdout(v);}catch(e){p.kill();if(!settled){settled=true;reject(e);}}});
  else p.stdout.resume();
  p.on('error',err=>{if(!settled){settled=true;reject(Error('G2D_WORKSPACE_FAIL_CLOSED: ffmpeg unavailable: '+err.code));}});
  p.on('close',code=>{if(settled)return;settled=true;
    code===0?resolve():reject(Error('G2D_WORKSPACE_FAIL_CLOSED: ffmpeg local processing failed: '+stderr.slice(-500)));
  });
 });
}
async function createProxy(source,destination){
 insist(path.isAbsolute(source)&&path.isAbsolute(destination),'absolute media paths required');
 insist(fs.existsSync(source)&&fs.lstatSync(source).isFile(),'source file absent');
 if(fs.existsSync(destination)){insist(fs.statSync(destination).size>100000,'existing proxy invalid');return {cached:true,path:destination};}
 const temp=destination+'.part.mp4';
 insist(!fs.existsSync(temp),'previous incomplete proxy exists; operator must inspect');
 try{
  await spawnFfmpeg(['-nostdin','-hide_banner','-v','error','-n','-i',source,
   '-map','0:v:0','-map','0:a:0?','-c:v','copy','-c:a','aac','-b:a','160k',
   '-movflags','+faststart','-f','mp4',temp]);
  insist(fs.statSync(temp).size>100000,'generated proxy too small');
  fs.renameSync(temp,destination);
  return {cached:false,path:destination};
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
async function createPeaks(source,destination){
 insist(path.isAbsolute(source)&&path.isAbsolute(destination),'absolute file paths required');
 if(fs.existsSync(destination)){
  const cached=JSON.parse(fs.readFileSync(destination,'utf8'));
  insist(cached.windowMs===50&&Array.isArray(cached.peaks)&&cached.peaks.length>0&&cached.peaks.length<400000,
    'invalid waveform cache');
  return {cached:true,path:destination,info:cached};
 }
 const binner=pcmPeakBinner(8000,50);
 await spawnFfmpeg(['-nostdin','-hide_banner','-v','error','-i',source,'-map','0:a:0',
  '-vn','-ac','1','-ar','8000','-c:a','pcm_s16le','-f','s16le','pipe:1'],{onStdout:v=>binner.add(v)});
 const info=binner.result();
 insist(info.peaks.length<400000,'unexpected waveform length');
 fs.writeFileSync(destination,JSON.stringify(info),{flag:'wx',mode:0o600});
 return {cached:false,path:destination,info};
}
function parseLocalSrt(text,expectedTimings){
 insist(typeof text==='string'&&Array.isArray(expectedTimings)&&expectedTimings.length>0,'local SRT input');
 const lines=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split('\n');
 let cursor=0;const cues=[];
 while(cursor<lines.length){
  while(cursor<lines.length&&!lines[cursor].trim())cursor++;
  if(cursor===lines.length)break;
  insist(lines[cursor++].trim()===String(cues.length+1),'SRT cue numbering');
  const times=lines[cursor++]||'';
  insist(/-->/.test(times),'SRT cue timestamp');
  const textLines=[];
  while(cursor<lines.length){
   const line=lines[cursor];
   if(!line.trim()){cursor++;break;}
   if(/^\d+$/.test(line.trim())&&/-->/.test(lines[cursor+1]||''))break;
   textLines.push(line);cursor++;
  }
  const timing=expectedTimings[cues.length];
  insist(!!timing&&textLines.some(x=>x.trim()),'SRT must have text and known cue timing');
  const cue={number:cues.length+1,startMs:timing.startMs,endMs:timing.endMs,text:textLines.join('\n')};
  cues.push(cue);
 }
 insist(cues.length===expectedTimings.length,'SRT cue count mismatch');
 return cues;
}
module.exports={filmFiles,sourceCacheKey,pcmPeakBinner,createProxy,createPeaks,parseLocalSrt,spawnFfmpeg};
