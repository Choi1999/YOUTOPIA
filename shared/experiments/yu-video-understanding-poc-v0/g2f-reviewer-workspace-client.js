'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const ui={movie:$('movie'),subtitle:$('subtitle'),clock:$('clock'),cueNumber:$('cueNumber'),cueText:$('cueText'),
  wave:$('wave'),zoom:$('zoom'),nav:$('questionNav'),progress:$('progressText'),bar:$('progressBar'),
  badge:$('progressBadge'),film:$('filmBadge'),reviewer:$('reviewerBadge'),question:$('questionText'),
  meta:$('questionMeta'),anchors:$('anchors'),jump:$('jumpAnchor'),questionStatus:$('questionStatus'),
  verdict:$('verdict'),supported:$('supportedFields'),unsupported:$('unsupportedFields'),ambiguous:$('ambiguousFields'),
  answer:$('answer'),unsupportedAnswer:$('unsupportedAnswer'),absence:$('absence'),fullMovie:$('fullMovie'),
  ambiguousNote:$('ambiguousNote'),evidence:$('evidenceList'),add:$('addEvidence'),save:$('save'),
  feedback:$('feedback'),blind:$('blind'),exposed:$('exposed'),watched:$('watched'),
  saveDeclaration:$('saveDeclaration'),declarationMessage:$('declarationMessage')};
 let packet=null,rev=null,cues=[],waveform=null,selected=0,dirty=false,fields=[],busy=false,lastWaveTime=0;
 function label(msg,error=false,success=false){
  ui.feedback.textContent=msg;ui.feedback.className='alert'+(error?' error':success?' success':'');
 }
 function declLabel(msg,error=false,success=false){
  ui.declarationMessage.textContent=msg;
  ui.declarationMessage.className='alert'+(error?' error':success?' success':'');
 }
 function fmt(ms){
  const n=Math.round(ms||0);const h=Math.floor(n/3600000),m=Math.floor(n/60000)%60,
   s=Math.floor(n/1000)%60,tail=String(n%1000).padStart(3,'0');
  return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+
   String(s).padStart(2,'0')+'.'+tail;
 }
 function parseTime(text){
  if(typeof text!=='string')return null;
  const m=/^(\d{1,3}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/.exec(text.trim());
  if(!m)return null;
  let h=0,min=0,s=0;
  if(m[3]===undefined){min=Number(m[1]);s=Number(m[2]);}
  else{h=Number(m[1]);min=Number(m[2]);s=Number(m[3]);}
  if(s>=60||(m[3]!==undefined&&min>=60))return null;
  const dec=Number((m[4]||'0').padEnd(3,'0'));
  const total=((h*3600+min*60+s)*1000)+dec;
  return Number.isSafeInteger(total)?total:null;
 }
 function showDirty(){
  dirty=true;
  label('아직 저장하지 않은 변경 사항이 있습니다. 「현재 질문 저장」을 눌러야 파일에 기록됩니다.');
 }
 function question(){return packet.questions[selected];}
 function summary(){
  const done=packet.questions.filter(q=>q.response.verdict!=='NOT_REVIEWED'&&q.response.verdict!=='AMBIGUOUS').length;
  const ambiguous=packet.questions.filter(q=>q.response.verdict==='AMBIGUOUS').length;
  const count=done+ambiguous;
  ui.progress.textContent=count+'/6';ui.bar.style.width=count/6*100+'%';
  ui.badge.textContent=count+'/6 검토'+(ambiguous?' · 불확실 '+ambiguous:'');
  ui.nav.replaceChildren();
  packet.questions.forEach((q,i)=>{
   const button=document.createElement('button');button.type='button';
   button.className=i===selected?'active':'';
   const left=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small');
   title.textContent=q.questionId;
   sub.textContent=q.localAnchorMs.length?q.localAnchorMs.map(fmt).join(' / '):'영화 전체 확인';
   left.append(title,sub);
   const status=document.createElement('em');
   status.textContent=q.response.verdict==='NOT_REVIEWED'?'미작성':
    q.response.verdict==='AMBIGUOUS'?'불확실':'작성';
   status.className=q.response.verdict==='SUPPORTED'||q.response.verdict==='UNSUPPORTED'?'done':'';
   button.append(left,status);
   button.addEventListener('click',()=>select(i));ui.nav.append(button);
  });
 }
 function status(){
  const v=question().response.verdict;
  ui.questionStatus.textContent=v==='NOT_REVIEWED'?'미검토':v==='AMBIGUOUS'?'불확실':'작성';
  ui.questionStatus.className=v==='SUPPORTED'||v==='UNSUPPORTED'?'tag green':'tag caution';
 }
 function seekTo(ms){
  ui.movie.pause();
  ui.movie.currentTime=Math.max(0,ms/1000-3);
  syncVideo();
 }
 function buildEvidence(q,existing){
  ui.evidence.replaceChildren();fields=[];
  const minimum=Math.max(1,q.localAnchorMs.length);
  const entries=existing.length?existing:
   Array.from({length:minimum},(_,i)=>({modality:q.questionId.endsWith('01')||q.questionId.endsWith('02')?'AUDIO':'FRAME',
    localStartMs:null,localEndMs:null,observationNote:'',_anchor:i}));
  entries.forEach((e,i)=>{
   const card=document.createElement('section');card.className='evidence-card';
   const head=document.createElement('div');head.className='evidence-title';
   const title=document.createElement('strong');title.textContent='근거 #'+(i+1)+' · '+(q.localAnchorMs[i]!==undefined?fmt(q.localAnchorMs[i]):'자유 기준');
   const remove=document.createElement('button');remove.type='button';remove.textContent='제거';remove.disabled=entries.length<=minimum;
   remove.addEventListener('click',()=>{card.remove();fields=fields.filter(x=>x.card!==card);showDirty();});
   head.append(title,remove);
   const grid=document.createElement('div');grid.className='evidence-grid';
   function make(label,node){
    const tag=document.createElement('label');tag.textContent=label;tag.append(node);grid.append(tag);return node;
   }
   const modality=document.createElement('select');
   for(const type of ['AUDIO','TRANSCRIPT','FRAME','OCR']){
    const opt=document.createElement('option');opt.value=type;opt.textContent=type;modality.append(opt);
   }
   modality.value=e.modality||'FRAME';modality.addEventListener('input',showDirty);make('근거 모달리티',modality);
   function time(value){
    const inp=document.createElement('input');inp.type='text';inp.placeholder='mm:ss.SSS';
    inp.value=Number.isSafeInteger(value)?fmt(value):'';
    inp.addEventListener('input',showDirty);return inp;
   }
   const start=make('시작 시각 (로컬)',time(e.localStartMs));
   const end=make('종료 시각 (로컬)',time(e.localEndMs));
   const capture=document.createElement('div');capture.className='capture';
   function button(name,fn){
    const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',fn);capture.append(b);
   }
   button('기준점 이동',()=>seekTo(q.localAnchorMs[i]??3000));
   button('현재 시점 → 시작',()=>{start.value=fmt(ui.movie.currentTime*1000);showDirty();});
   button('현재 시점 → 종료',()=>{end.value=fmt(ui.movie.currentTime*1000);showDirty();});
   const notes=document.createElement('textarea');notes.rows=2;
   notes.value=e.observationNote||'';
   notes.placeholder='실제 화면/대사에서 답을 뒷받침하는 관찰 내용 (18자 이상)';
   notes.addEventListener('input',showDirty);
   const noteLabel=document.createElement('label');noteLabel.textContent='독립 관찰 기록';noteLabel.append(notes);
   card.append(head,grid,capture,noteLabel);ui.evidence.append(card);
   fields.push({card,modality,start,end,notes});
  });
 }
 function rerenderMode(){
  const v=ui.verdict.value;
  ui.supported.hidden=v!=='SUPPORTED';ui.unsupported.hidden=v!=='UNSUPPORTED';ui.ambiguous.hidden=v!=='AMBIGUOUS';
  if(v==='SUPPORTED'&&ui.evidence.childElementCount===0)buildEvidence(question(),[]);
 }
 function render(){
  const q=question(),r=q.response;
  ui.question.textContent=q.questionText;ui.meta.textContent=q.questionId+' · 원본 기준 시간으로 근거를 기록하세요.';
  ui.anchors.textContent=q.localAnchorMs.length?q.localAnchorMs.map(fmt).join(' · '):'특정 시각 없음 · 근거 부재는 영화 전체 확인';
  ui.verdict.value=r.verdict;
  ui.answer.value=r.verdict==='SUPPORTED'?r.answerText||'':'';
  ui.unsupportedAnswer.value=r.verdict==='UNSUPPORTED'?r.answerText||'':'';
  ui.absence.value=r.absenceRationale||'';ui.fullMovie.checked=r.fullMovieReviewed||false;
  ui.ambiguousNote.value=r.verdict==='AMBIGUOUS'?r.observationNote||'':'';
  buildEvidence(q,r.verdict==='SUPPORTED'?r.evidence:[]);
  rerenderMode();status();summary();dirty=false;
 }
 function select(index){
  if(!packet)return;
  if(dirty&&!window.confirm('현재 질문에 저장하지 않은 변경 사항이 있습니다. 버리고 이동하시겠습니까?'))return;
  selected=index;
  const q=question();if(q.localAnchorMs.length)seekTo(q.localAnchorMs[0]);render();
  label('독립적으로 실제 영상을 확인하고 답변과 근거를 작성하세요.');
 }
 function collect(){
  const out=structuredClone(packet);const r=out.questions[selected].response;
  r.verdict=ui.verdict.value;
  r.answerText=null;r.evidence=[];r.absenceRationale=null;r.fullMovieReviewed=false;r.observationNote=null;
  if(r.verdict==='SUPPORTED'){
   r.answerText=ui.answer.value.trim();
   r.evidence=fields.map(item=>{
    const a=parseTime(item.start.value),b=parseTime(item.end.value);
    if(a===null||b===null)throw Error('근거 시작·종료 시각을 mm:ss.SSS 형식으로 입력하세요.');
    return {modality:item.modality.value,localStartMs:a,localEndMs:b,observationNote:item.notes.value.trim()};
   });
  }else if(r.verdict==='UNSUPPORTED'){
   r.answerText=ui.unsupportedAnswer.value.trim();
   r.absenceRationale=ui.absence.value.trim();
   r.fullMovieReviewed=ui.fullMovie.checked;
  }else if(r.verdict==='AMBIGUOUS'){
   r.observationNote=ui.ambiguousNote.value.trim();
  }
  return out;
 }
 async function postSave(fresh){
  const res=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({packet:fresh,revision:rev})});
  const body=await res.json();if(!res.ok)throw Error(body.error||'로컬 파일 저장 실패');
  packet=fresh;rev=body.revision;return body;
 }
 async function save(){
  if(busy)return;busy=true;ui.save.disabled=true;
  try{
   const next=collect();const result=await postSave(next);
   render();label('검수자 전용 로컬 JSON에 저장했습니다. '+result.summary.status,false,true);
  }catch(e){label('저장되지 않았습니다: '+e.message,true);}
  finally{busy=false;ui.save.disabled=false;}
 }
 function selectDecl(value){return value===null?'':String(value);}
 async function saveDeclaration(){
  if(busy)return;
  if(dirty){declLabel('먼저 현재 질문을 저장하거나 저장하지 않은 변경 사항을 취소하세요.',true);return;}
  busy=true;ui.saveDeclaration.disabled=true;
  try{
   const fresh=structuredClone(packet);
   function asBool(x){return x.value===''?null:x.value==='true';}
   fresh.blindReviewDeclaration=asBool(ui.blind);
   fresh.sawOperatorAnswersBeforeSubmission=asBool(ui.exposed);
   fresh.watchedLocalPublisherFilm=asBool(ui.watched);
   const result=await postSave(fresh);
   summary();declLabel('검수자의 자기 진술이 로컬에 저장됐습니다: '+result.summary.status,false,true);
  }catch(e){declLabel('선언을 저장하지 못했습니다: '+e.message,true);}
  finally{busy=false;ui.saveDeclaration.disabled=false;}
 }
 function cueNow(ms){
  if(!cues.length)return null;
  return cues.find(c=>ms>=c.startMs&&ms<=c.endMs)||null;
 }
 function canvasWave(){
  if(!waveform||!packet)return;
  const canvas=ui.wave,ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#101b2a';ctx.fillRect(0,0,width,height);
  const current=ui.movie.currentTime*1000,duration=packet.durationMs;
  const zoom=ui.zoom.value,span=zoom==='full'?duration:Number(zoom)*1000;
  const from=zoom==='full'?0:Math.max(0,Math.min(duration-span,current-span/2));
  const to=Math.min(duration,from+span);
  const scale=x=>Math.round((x-from)/(to-from)*width);
  ctx.fillStyle='rgba(91,165,202,.13)';
  for(const c of cues){
   if(c.endMs<from||c.startMs>to)continue;
   ctx.fillRect(Math.max(0,scale(c.startMs)),0,Math.max(1,scale(c.endMs)-scale(c.startMs)),height);
  }
  ctx.fillStyle='#45c3a4';
  const peaks=waveform.peaks,windowMs=waveform.windowMs,visibleFrom=Math.max(0,Math.floor(from/windowMs));
  const visibleTo=Math.min(peaks.length,Math.ceil(to/windowMs));
  const maxDraw=width,step=Math.max(1,Math.ceil((visibleTo-visibleFrom)/maxDraw));
  for(let i=visibleFrom;i<visibleTo;i+=step){
   let max=0;for(let j=i;j<Math.min(visibleTo,i+step);j++)max=Math.max(max,peaks[j]||0);
   const x=scale(i*windowMs),bar=Math.max(1,max*(height*.40));
   ctx.fillRect(x,height/2-bar,Math.max(1,scale((i+step)*windowMs)-x),bar*2);
  }
  ctx.strokeStyle='#f2ce83';ctx.lineWidth=3;
  const x=scale(current);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();
  ui.wave.dataset.from=String(from);ui.wave.dataset.to=String(to);
 }
 function syncVideo(){
  if(!packet)return;
  const current=ui.movie.currentTime*1000;
  ui.clock.textContent=fmt(current);
  const cue=cueNow(current);
  ui.subtitle.textContent=cue?cue.text:'';
  ui.cueNumber.textContent=cue?'SRT #'+cue.number+' · '+fmt(cue.startMs)+'–'+fmt(cue.endMs):'SRT 자막 없음';
  ui.cueText.textContent=cue?cue.text:'해당 시점에 영어 자막이 없습니다.';
  const now=performance.now();
  if(now-lastWaveTime>80){canvasWave();lastWaveTime=now;}
 }
 function animate(){
  if(!ui.movie.paused)syncVideo();
  requestAnimationFrame(animate);
 }
 async function init(){
  for(const [id,n] of [['back5',-5000],['back01',-100],['forward01',100],['forward5',5000]]){
   $(id).addEventListener('click',()=>{ui.movie.currentTime=Math.max(0,ui.movie.currentTime+n/1000);syncVideo();});
  }
  $('play').addEventListener('click',()=>{if(ui.movie.paused)ui.movie.play().catch(()=>{});else ui.movie.pause();});
  ui.movie.addEventListener('timeupdate',syncVideo);
  ui.movie.addEventListener('seeked',syncVideo);
  ui.zoom.addEventListener('change',canvasWave);
  ui.wave.addEventListener('click',event=>{
   if(!packet)return;
   const rect=ui.wave.getBoundingClientRect();
   const ratio=Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width));
   const from=Number(ui.wave.dataset.from)||0,to=Number(ui.wave.dataset.to)||packet.durationMs;
   ui.movie.currentTime=Math.min(packet.durationMs/1000,(from+(to-from)*ratio)/1000);
   syncVideo();
  });
  ui.verdict.addEventListener('change',()=>{rerenderMode();showDirty();});
  for(const field of [ui.answer,ui.unsupportedAnswer,ui.absence,ui.fullMovie,ui.ambiguousNote]){
   field.addEventListener('input',showDirty);
  }
  ui.add.addEventListener('click',()=>{
   const q=question();
   if(fields.length>=10){label('근거 구간은 최대 10개입니다.',true);return;}
   const existing=fields.map(item=>({modality:item.modality.value,localStartMs:parseTime(item.start.value),
    localEndMs:parseTime(item.end.value),observationNote:item.notes.value}));
   existing.push({modality:'FRAME',localStartMs:null,localEndMs:null,observationNote:''});
   buildEvidence(q,existing);showDirty();
  });
  ui.jump.addEventListener('click',()=>seekTo(question().localAnchorMs[0]??0));
  ui.save.addEventListener('click',save);
  ui.saveDeclaration.addEventListener('click',saveDeclaration);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  try{
   const res=await fetch('/api/session');const session=await res.json();
   if(!res.ok)throw Error(session.error||'검수 파일을 읽을 수 없습니다.');
   packet=session.packet;rev=session.revision;cues=session.cues;waveform=session.waveform;
   if(!packet||!packet.questions||packet.questions.length!==6)throw Error('검수자 전용 질문 6개를 확인할 수 없습니다.');
   ui.film.textContent=session.film;ui.reviewer.textContent=session.reviewerCode;
   ui.blind.value=selectDecl(packet.blindReviewDeclaration);
   ui.exposed.value=selectDecl(packet.sawOperatorAnswersBeforeSubmission);
   ui.watched.value=selectDecl(packet.watchedLocalPublisherFilm);
   select(0);syncVideo();requestAnimationFrame(animate);
  }catch(e){label('검수자 전용 로컬 작업공간을 시작할 수 없습니다: '+e.message,true);ui.save.disabled=true;}
 }
 window.addEventListener('DOMContentLoaded',init);
})();
