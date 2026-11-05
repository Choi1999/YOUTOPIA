'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const el={
  film:$('filmLabel'),progress:$('progressLabel'),count:$('checkpointCount'),checkpoints:$('checkpoints'),
  stats:$('stats'),video:$('localVideo'),subtitle:$('subtitle'),localTime:$('localTime'),captionText:$('captionText'),
  wave:$('wave'),zoom:$('zoom'),playPause:$('playPause'),prev5:$('prev5'),next5:$('next5'),prev01:$('prev01'),next01:$('next01'),
  youtubeFrame:$('youtubeFrame'),youtubeLink:$('youtubeLink'),loadEmbed:$('loadEmbed'),embedPrompt:$('embedPrompt'),
  editionCaveat:$('editionCaveat'),uploader:$('uploader'),youtubeDuration:$('youtubeDuration'),
  prompt:$('checkpointPrompt'),checkpointId:$('checkpointId'),verdict:$('verdict'),observedTime:$('observedTime'),
  recordTimeLabel:$('recordTimeLabel'),captureLocal:$('captureLocal'),timeHelp:$('timeHelp'),note:$('note'),
  target:$('targetTime'),cueIndex:$('cueIndex'),jump:$('jumpTarget'),save:$('save'),toast:$('toast')
 };
 let data,review,revision,selected=0,saving=false,dirty=false,dragStart=null,waveRect=null;
 function fmt(ms){
  ms=Math.max(0,Math.round(Number(ms)||0));
  const h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60,sub=String(ms%1000).padStart(3,'0');
  return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+sub;
 }
 function parseTime(value){
  const t=String(value||'').trim();
  if(!t)return null;
  if(!/^\d{1,2}(?::\d{1,2}){1,2}(?:\.\d{1,3})?$/.test(t))throw Error('시간 형식은 mm:ss 또는 mm:ss.SSS입니다.');
  const p=t.split(':'),ss=p.pop().split('.');
  const sec=Number(ss[0]),mins=Number(p.pop()),hours=p.length?Number(p.pop()):0;
  if(sec>=60||mins>=60||!Number.isSafeInteger(hours))throw Error('시간 범위를 확인하세요.');
  const ms=(hours*3600+mins*60+sec)*1000+Number((ss[1]||'').padEnd(3,'0'));
  if(!Number.isSafeInteger(ms)||ms<0)throw Error('시간 값이 잘못되었습니다.');
  return ms;
 }
 function note(message,kind=''){el.toast.textContent=message;el.toast.className='toast'+(kind?' '+kind:'');}
 function selectedItem(){return review.checkpoints[selected];}
 function statusSymbol(v){return ({OBSERVED_MATCH:'✓',OBSERVED_DIFFERENCE:'!',UNCERTAIN:'?',NOT_REVIEWED:'○'})[v]||'○';}
 function statusClass(v){return ({OBSERVED_MATCH:'match',OBSERVED_DIFFERENCE:'difference',UNCERTAIN:'uncertain'})[v]||'';}
 function onInput(){dirty=true;note('변경 사항이 있습니다. 저장을 누르세요.');}
 function updateProgress(){
  const total=review.checkpoints.length,done=review.checkpoints.filter(c=>c.verdict!=='NOT_REVIEWED').length;
  el.count.textContent=String(total);
  el.progress.textContent=done+'/'+total+' 검토';
  el.stats.replaceChildren();
  const statusCount={OBSERVED_MATCH:0,OBSERVED_DIFFERENCE:0,UNCERTAIN:0,NOT_REVIEWED:0};
  for(const x of review.checkpoints)statusCount[x.verdict]++;
  for(const [label,k] of [['일치','OBSERVED_MATCH'],['차이','OBSERVED_DIFFERENCE'],['불확실','UNCERTAIN'],['미검토','NOT_REVIEWED']]){
   const b=document.createElement('span');b.className='stat';b.textContent=label+' '+statusCount[k];el.stats.append(b);
  }
 }
 function renderList(){
  el.checkpoints.replaceChildren();
  review.checkpoints.forEach((c,i)=>{
   const button=document.createElement('button');button.type='button';button.className=i===selected?'active':'';
   const box=document.createElement('span'),label=document.createElement('strong'),detail=document.createElement('small');
   label.textContent=c.id.replace(/_/g,' ');detail.textContent=fmt(c.localMs)+' · '+({AUDIO_SYNC:'음성·자막',YOUTUBE_SCENE:'YouTube 장면',CAPTION_COVERAGE:'후반 발화'})[c.kind];
   box.append(label,detail);
   const icon=document.createElement('span');icon.className='symbol '+statusClass(c.verdict);icon.textContent=statusSymbol(c.verdict);
   button.append(box,icon);
   button.addEventListener('click',()=>selectItem(i));
   el.checkpoints.append(button);
  });
  updateProgress();
 }
 function syncTopFields(){
  el.uploader.value=review.youtubeUploaderObservation;
  el.youtubeDuration.value=review.observedYoutubeDurationMs===null?'':fmt(review.observedYoutubeDurationMs);
 }
 function selectItem(i,force=false){
  if(!force&&dirty&&!window.confirm('현재 검수 항목에 저장하지 않은 변경 사항이 있습니다. 이동하면 입력 내용이 사라집니다. 계속할까요?'))return;
  dirty=false;selected=i;
  const c=selectedItem();
  el.checkpointId.textContent=c.id;el.prompt.textContent=c.prompt;
  el.target.textContent=fmt(c.localMs);el.cueIndex.textContent=c.cueIndex===null?c.kind:'SRT cue #'+c.cueIndex;
  el.verdict.value=c.verdict;el.note.value=c.observationNote||'';
  el.recordTimeLabel.firstChild.textContent=c.kind==='AUDIO_SYNC'?'실제 발화 시작 시각':c.kind==='YOUTUBE_SCENE'?'YouTube 대응 장면 시각':'이 항목에서는 시각 입력 불필요';
  el.observedTime.disabled=c.kind==='CAPTION_COVERAGE';
  el.captureLocal.disabled=c.kind!=='AUDIO_SYNC';
  el.observedTime.placeholder='mm:ss.SSS';
  const value=c.kind==='AUDIO_SYNC'?c.observedSpeechStartMs:c.kind==='YOUTUBE_SCENE'?c.observedYoutubeMs:null;
  el.observedTime.value=value===null?'':fmt(value);
  el.timeHelp.textContent=c.kind==='AUDIO_SYNC'?'파형과 소리를 듣고 실제 발화가 시작된 시점을 기록합니다.':
   c.kind==='YOUTUBE_SCENE'?'YouTube 영상에서 같은 장면의 현재 시각을 직접 입력하세요.':
   'Tears 09:27 이후의 대사 누락 여부를 듣고 판정하세요.';
  el.video.pause();el.video.currentTime=Math.max(0,c.localMs/1000-4);
  renderList();drawWave();note('직접 관찰 후 판정과 기록을 입력하세요.');
 }
 function checkDirtyAndApply(){
  const c=selectedItem();const verdict=el.verdict.value,observationNote=el.note.value.trim()||null;
  const observedTime=parseTime(el.observedTime.value);
  if(verdict==='NOT_REVIEWED'){
   c.verdict=verdict;c.observationNote=null;c.observedSpeechStartMs=null;c.observedYoutubeMs=null;
  }else{
   if(!observationNote||observationNote.length<12||observationNote.length>300)throw Error('관찰 메모는 12~300자로 입력하세요.');
   c.verdict=verdict;c.observationNote=observationNote;
   c.observedSpeechStartMs=c.kind==='AUDIO_SYNC'?observedTime:null;
   c.observedYoutubeMs=c.kind==='YOUTUBE_SCENE'?observedTime:null;
   if(c.kind==='AUDIO_SYNC'&&verdict==='OBSERVED_MATCH'&&observedTime===null)throw Error('음성 일치 판정에는 실제 발화 시점을 기록하세요.');
   if(c.kind==='YOUTUBE_SCENE'&&['OBSERVED_MATCH','OBSERVED_DIFFERENCE'].includes(verdict)&&observedTime===null)throw Error('YouTube 장면 시점을 직접 기록하세요.');
  }
  review.youtubeUploaderObservation=el.uploader.value;
  review.observedYoutubeDurationMs=parseTime(el.youtubeDuration.value);
  return review;
 }
 async function save(){
  if(saving)return;
  saving=true;el.save.disabled=true;
  try{
   const packet=checkDirtyAndApply();
   const r=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({revision,packet})});
   const body=await r.json();
   if(!r.ok)throw Error(body.error||'저장 실패');
   revision=body.revision;dirty=false;
   renderList();
   note('로컬 JSON 저장 완료 · '+body.summary.status,'ok');
  }catch(e){note(e.message||'저장 오류','err');}
  finally{saving=false;el.save.disabled=false;}
 }
 function waveformWindow(){
  const duration=Number(review.local.durationMs),now=Number(el.video.currentTime||0)*1000;
  const widthMs=el.zoom.value==='full'?duration:Math.min(duration,Number(el.zoom.value)*1000);
  const left=widthMs>=duration?0:Math.max(0,Math.min(duration-widthMs,now-widthMs/2));
  return {left,right:left+widthMs,widthMs,duration};
 }
 function drawWave(){
  if(!data||!review)return;
  const canvas=el.wave,rect=canvas.getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2),W=Math.max(100,Math.floor(rect.width)),H=126;
  if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b1422';ctx.fillRect(0,0,W,H);
  const win=waveformWindow();waveRect={...win,width:W};
  const map=t=>(t-win.left)/win.widthMs*W;
  // timing grid
  ctx.font='11px ui-monospace,Consolas,monospace';ctx.fillStyle='#92a8c2';
  const ticks=5;
  for(let i=0;i<=ticks;i++){const x=W*i/ticks,t=win.left+win.widthMs*i/ticks;
   ctx.strokeStyle='#273747';ctx.beginPath();ctx.moveTo(x,.5);ctx.lineTo(x,H);ctx.stroke();
   ctx.fillText(fmt(t).slice(0,-4),Math.max(2,Math.min(W-43,x+3)),12);
  }
  // original audio peak envelope: NOT speech detection
  const peaks=data.waveform.peaks,step=data.waveform.windowMs;
  ctx.fillStyle='#69c4fa';
  for(let x=0;x<W;x++){
   const a=Math.max(0,Math.floor((win.left+x/W*win.widthMs)/step));
   const b=Math.min(peaks.length,Math.max(a+1,Math.ceil((win.left+(x+1)/W*win.widthMs)/step)));
   let v=0;for(let k=a;k<b;k++)v=Math.max(v,peaks[k]||0);
   const amp=Math.max(1,v*(H-29)*.42);
   ctx.fillRect(x,(H-amp*2)/2+6,1,amp*2);
  }
  // SRT time ranges, green segments at bottom (not audio fingerprints)
  ctx.fillStyle='#35c9a399';
  for(const c of data.cues)if(c.endMs>=win.left&&c.startMs<=win.right){
   const x0=Math.max(0,map(c.startMs)),x1=Math.min(W,map(c.endMs));
   ctx.fillRect(x0,H-12,Math.max(2,x1-x0),5);
  }
  // selected manual check
  const selectedC=selectedItem();
  const xCue=map(selectedC.localMs);
  if(xCue>=0&&xCue<=W){
   ctx.strokeStyle='#f4bd69';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(xCue,17);ctx.lineTo(xCue,H);ctx.stroke();
  }
  // playhead
  const p=map((el.video.currentTime||0)*1000);
  ctx.strokeStyle='#ff8b8b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p,16);ctx.lineTo(p,H);ctx.stroke();
 }
 function showSubtitle(){
  if(!data)return;
  const t=el.video.currentTime*1000;
  const lines=data.cues.filter(c=>c.startMs<=t&&c.endMs>=t).map(c=>c.text);
  const caption=lines.join('\n');el.subtitle.textContent=caption;el.captionText.textContent=caption||'이 시점에는 SRT 자막이 없습니다.';
 }
 function onTick(){
  el.localTime.textContent=fmt(el.video.currentTime*1000);
  showSubtitle();drawWave();
 }
 function waveSeek(event,initial=false){
  if(!waveRect)return;
  const rect=el.wave.getBoundingClientRect(),percent=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
  const t=waveRect.left+percent*waveRect.widthMs;
  el.video.currentTime=Math.max(0,Math.min(Number(review.local.durationMs)/1000,t/1000));
  onTick();
 }
 function seek(delta){el.video.currentTime=Math.max(0,Math.min(review.local.durationMs/1000,el.video.currentTime+delta));onTick();}
 async function load(){
  const response=await fetch('/api/session');if(!response.ok)throw Error('로컬 세션을 가져오지 못했습니다.');
  data=await response.json();review=data.packet;revision=data.revision;
  el.film.textContent=data.film;el.youtubeLink.href=review.youtubeUrl;el.editionCaveat.textContent=review.youtubeEditionCaveat;
  syncTopFields();selectItem(0,true);
  el.video.addEventListener('timeupdate',onTick);el.video.addEventListener('seeked',onTick);
  el.video.addEventListener('loadedmetadata',onTick);
  el.video.addEventListener('play',()=>{
   const loop=()=>{onTick();if(!el.video.paused&&!el.video.ended)requestAnimationFrame(loop);};
   requestAnimationFrame(loop);
  });
  window.addEventListener('resize',drawWave);
  el.zoom.addEventListener('change',drawWave);
  el.wave.addEventListener('pointerdown',e=>{dragStart=true;el.wave.setPointerCapture(e.pointerId);waveSeek(e,true);});
  el.wave.addEventListener('pointermove',e=>{if(dragStart)waveSeek(e);});
  el.wave.addEventListener('pointerup',()=>{dragStart=false;});
  el.wave.addEventListener('pointercancel',()=>{dragStart=false;});
  el.prev5.addEventListener('click',()=>seek(-5));el.next5.addEventListener('click',()=>seek(5));
  el.prev01.addEventListener('click',()=>seek(-.1));el.next01.addEventListener('click',()=>seek(.1));
  el.playPause.addEventListener('click',()=>{if(el.video.paused)el.video.play().catch(()=>note('재생에 실패했습니다. 브라우저 MP4 지원을 확인하세요.','err'));else el.video.pause();});
  el.jump.addEventListener('click',()=>{el.video.pause();el.video.currentTime=selectedItem().localMs/1000;onTick();});
  el.captureLocal.addEventListener('click',()=>{el.observedTime.value=fmt(el.video.currentTime*1000);onInput();});
  for(const e of [el.verdict,el.note,el.observedTime,el.youtubeDuration,el.uploader])e.addEventListener('input',onInput);
  el.save.addEventListener('click',save);
  el.loadEmbed.addEventListener('click',()=>{
   const url=new URL(review.youtubeUrl);
   const id=url.searchParams.get('v');
   if(url.hostname!=='www.youtube.com'||!/^[A-Za-z0-9_-]{11}$/.test(id||'')){note('허용되지 않은 YouTube 참조입니다.','err');return;}
   el.youtubeFrame.src='https://www.youtube-nocookie.com/embed/'+id+'?playsinline=1&rel=0';
   el.youtubeFrame.hidden=false;el.embedPrompt.hidden=true;
  });
  document.addEventListener('keydown',e=>{
   const editable=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
   if(editable||e.altKey||e.ctrlKey||e.metaKey)return;
   if(e.key==='['){e.preventDefault();seek(-.1);}
   if(e.key===']'){e.preventDefault();seek(.1);}
  });
  // expose no report data to third-party scripts; YouTube player is iframe only.
  note('로컬 영상과 검수 데이터를 읽었습니다. 확인된 사실만 기록하세요.');
 }
 load().catch(e=>{note(e.message||'실행 오류','err');});
})();
