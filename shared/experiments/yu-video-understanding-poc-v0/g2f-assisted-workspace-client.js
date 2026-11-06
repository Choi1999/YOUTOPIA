'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const el={movie:$('movie'),subtitle:$('subtitle'),clock:$('clock'),cueNumber:$('cueNumber'),cueText:$('cueText'),
  wave:$('wave'),zoom:$('zoom'),nav:$('questionNav'),progress:$('progressText'),bar:$('progressBar'),
  badge:$('progressBadge'),film:$('filmBadge'),reviewer:$('reviewerBadge'),question:$('questionText'),meta:$('questionMeta'),
  anchors:$('anchors'),jump:$('jumpAnchor'),questionStatus:$('questionStatus'),aiVerdict:$('aiProposedVerdict'),
  aiAnswer:$('aiAnswer'),aiTiming:$('aiTiming'),aiCaveat:$('aiCaveat'),decision:$('decision'),
  positive:$('positiveFields'),negative:$('negativeFields'),supported:$('supportedFields'),unsupported:$('unsupportedFields'),
  verdict:$('verdict'),answer:$('answer'),absence:$('absence'),fullMovie:$('fullMovie'),
  reviewerNote:$('reviewerNote'),negativeNote:$('negativeNote'),watchedLabel:$('watchedLabel'),
  watched:$('watched'),evidence:$('evidenceList'),add:$('addEvidence'),save:$('save'),feedback:$('feedback')};
 let packet=null,revision=null,cues=[],waveform=null,selected=0,dirty=false,fields=[],busy=false;
 let aiObservationDrafts={};
 let lastWaveTick=0;
 function fmt(ms){
  const n=Math.max(0,Math.round(ms||0)),h=Math.floor(n/3600000),m=Math.floor(n/60000)%60,s=Math.floor(n/1000)%60,
   tail=String(n%1000).padStart(3,'0');
  return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+tail;
 }
 function parseTime(raw){
  if(typeof raw!=='string')return null;
  const m=/^(\d{1,3}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/.exec(raw.trim());if(!m)return null;
  let hour=0,min=0,sec=0;
  if(m[3]===undefined){min=Number(m[1]);sec=Number(m[2]);}else{hour=Number(m[1]);min=Number(m[2]);sec=Number(m[3]);}
  if(sec>=60||(m[3]!==undefined&&min>=60))return null;
  const total=(hour*3600+min*60+sec)*1000+Number((m[4]||'0').padEnd(3,'0'));
  return Number.isSafeInteger(total)?total:null;
 }
 function notice(s,isErr=false,ok=false){
  el.feedback.textContent=s;el.feedback.className='alert'+(isErr?' error':ok?' success':'');
 }
 function markDirty(){dirty=true;notice('저장하지 않은 변경 사항이 있습니다. 원본과 대조한 후 검토 결과 저장을 누르세요.');}
 function question(){return packet.questions[selected];}
 function currentEvidence(){
  return fields.map(row=>({modality:row.modality.value,
   localStartMs:parseTime(row.start.value),localEndMs:parseTime(row.end.value),
   observationNote:row.notes.value.trim()}));
 }
 function jump(ms){
  el.movie.pause();el.movie.currentTime=Math.max(0,ms/1000-3);tick();
 }
 function evidenceCard(q,e,i){
  const card=document.createElement('section');card.className='evidence-card';
  const head=document.createElement('div');head.className='evidence-title';
  const label=document.createElement('strong');
  label.textContent='로컬 근거 #'+(i+1)+(q.localAnchorMs[i]!==undefined?' · '+fmt(q.localAnchorMs[i]):'');
  const remove=document.createElement('button');remove.type='button';remove.textContent='제거';
  remove.disabled=i<Math.max(1,q.localAnchorMs.length);
  remove.addEventListener('click',()=>{card.remove();fields=fields.filter(x=>x.card!==card);markDirty();});
  head.append(label,remove);
  const grid=document.createElement('div');grid.className='evidence-grid';
  function field(name,input){
   const box=document.createElement('label');box.textContent=name;box.append(input);grid.append(box);return input;
  }
  const modality=document.createElement('select');
  const types=q.kind==='SPEECH'?['AUDIO','TRANSCRIPT']:['FRAME'];
  for(const t of types){const opt=document.createElement('option');opt.value=t;opt.textContent=t;modality.append(opt);}
  modality.value=types.includes(e.modality)?e.modality:types[0];modality.addEventListener('input',markDirty);
  field('근거 모달리티',modality);
  function timeInput(value){
   const inp=document.createElement('input');inp.type='text';inp.placeholder='mm:ss.SSS';
   inp.value=Number.isSafeInteger(value)?fmt(value):'';
   inp.addEventListener('input',markDirty);return inp;
  }
  const start=field('시작 시각 (로컬)',timeInput(e.localStartMs));
  const end=field('종료 시각 (로컬)',timeInput(e.localEndMs));
  const capture=document.createElement('div');capture.className='capture';
  function button(text,action){
   const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);capture.append(b);
  }
  button('이 기준점 이동',()=>jump(q.localAnchorMs[i]??e.localStartMs??0));
  button('현재 시점 → 시작',()=>{start.value=fmt(el.movie.currentTime*1000);markDirty();});
  button('현재 시점 → 종료',()=>{end.value=fmt(el.movie.currentTime*1000);markDirty();});
  const notes=document.createElement('textarea');notes.rows=2;notes.value=e.observationNote||'';
  notes.placeholder='AI 답안과 무관하게 실제 원본에서 확인한 장면/발화를 18자 이상 기록';
  notes.addEventListener('input',markDirty);
  const notesLabel=document.createElement('label');notesLabel.textContent='근거 관찰 기록 · AI 작성 초안 (사람이 영상 확인 후 수정·확정)';notesLabel.append(notes);
  card.append(head,grid,capture,notesLabel);
  return {card,modality,start,end,notes};
 }
 function buildEvidence(q,initial=[]){
  el.evidence.replaceChildren();fields=[];
  const minimum=Math.max(1,q.localAnchorMs.length);
  const suggestion=aiObservationDrafts[q.questionId];
  const hints=q.aiDraft.evidenceHints.map((e,i)=>({...e,
   observationNote:suggestion?.evidenceNotes?.[i]??e.observationNote??''}));
  const rows=initial.length?initial:hints.length?hints:
   Array.from({length:minimum},(_,i)=>({modality:q.kind==='SPEECH'?'AUDIO':'FRAME',
    localStartMs:q.localAnchorMs[i]??null,localEndMs:null,observationNote:''}));
  rows.forEach((e,i)=>{const f=evidenceCard(q,e,i);fields.push(f);el.evidence.append(f.card);});
 }
 function applyMode(){
  const decision=el.decision.value,active=decision!=='PENDING',positive=decision==='ACCEPT'||decision==='EDIT';
  el.positive.hidden=!positive;el.negative.hidden=!(decision==='REJECT'||decision==='UNCERTAIN');
  el.watchedLabel.hidden=!active;
  const q=question();
  if(decision==='ACCEPT'){
   el.verdict.value=q.aiDraft.proposedVerdict;
   el.answer.value=q.aiDraft.answerText;
  }
  el.verdict.disabled=decision==='ACCEPT';el.answer.readOnly=decision==='ACCEPT';
  const supported=el.verdict.value==='SUPPORTED';
  el.supported.hidden=!positive||!supported;
  el.unsupported.hidden=!positive||supported;
  if(positive&&supported&&fields.length===0)buildEvidence(q);
  el.save.disabled=!active||busy;
 }
 function render(){
  const q=question(),r=q.review,a=q.aiDraft;
  el.question.textContent=q.questionText;
  el.meta.textContent=q.questionId+' · '+q.kind+' · AI 초안과 실제 원본 내용이 맞는지 검증합니다.';
  el.anchors.textContent=q.localAnchorMs.length?q.localAnchorMs.map(fmt).join(' / '):'특정 기준점 없음 · 전체 영화 확인';
  el.aiVerdict.textContent='AI 예상 분류: '+a.proposedVerdict;
  el.aiAnswer.textContent=a.answerText;
  el.aiTiming.textContent=a.evidenceHints.length?'AI 제안 구간 (검증 전): '+
   a.evidenceHints.map(x=>fmt(x.localStartMs)+' ~ '+fmt(x.localEndMs)).join(' / '):
   'AI는 근거 부재를 추정한 상태이며 전체 영화 검증이 필요합니다.';
  el.aiCaveat.textContent='주의: '+a.caveat+' 관찰 기록 입력란도 AI가 작성한 미검증 초안입니다. 실제 영상을 확인하고 수정·수용하세요.';
  el.decision.value=r.decision;
  el.verdict.value=r.verdict||a.proposedVerdict;
  el.answer.value=r.answerText||a.answerText;
  el.absence.value=r.absenceRationale??aiObservationDrafts[q.questionId]?.absenceRationale??a.absenceRationale??'';
  el.fullMovie.checked=r.fullMovieReviewed;
  el.reviewerNote.value=r.reviewerNote&&r.decision!=='REJECT'&&r.decision!=='UNCERTAIN'?r.reviewerNote:'';
  el.negativeNote.value=r.reviewerNote&&(r.decision==='REJECT'||r.decision==='UNCERTAIN')?r.reviewerNote:'';
  el.watched.checked=r.watchedSource;
  buildEvidence(q,r.evidence);
  applyMode();
  const status=r.decision==='PENDING'?'미검토':r.decision==='ACCEPT'?'수용':r.decision==='EDIT'?'수정':r.decision==='REJECT'?'반려':'불확실';
  el.questionStatus.textContent=status;
  el.questionStatus.className=(r.decision==='ACCEPT'||r.decision==='EDIT')?'tag green':'tag caution';
  renderNav();dirty=false;
 }
 function renderNav(){
  const progress=packet.questions.filter(q=>q.review.decision!=='PENDING').length;
  el.progress.textContent=progress+'/6';el.bar.style.width=progress/6*100+'%';el.badge.textContent=progress+'/6 검토';
  el.nav.replaceChildren();
  packet.questions.forEach((q,i)=>{
   const button=document.createElement('button');button.type='button';button.className=i===selected?'active':'';
   const span=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small');
   title.textContent=q.questionId;meta.textContent=q.kind+' · '+(q.localAnchorMs.length?q.localAnchorMs.map(fmt).join(' / '):'전체 확인');
   span.append(title,meta);
   const tag=document.createElement('em');tag.textContent={
    PENDING:'미검토',ACCEPT:'수용',EDIT:'수정',REJECT:'반려',UNCERTAIN:'불확실'}[q.review.decision];
   tag.className=(q.review.decision==='ACCEPT'||q.review.decision==='EDIT')?'done':'';
   button.append(span,tag);button.addEventListener('click',()=>select(i));el.nav.append(button);
  });
 }
 function select(index){
  if(!packet)return;
  if(dirty&&!window.confirm('현재 문항에 저장하지 않은 변경 사항이 있습니다. 버리고 이동하시겠습니까?'))return;
  selected=index;
  const q=question();if(q.localAnchorMs.length)jump(q.localAnchorMs[0]);
  render();notice('AI 제안과 실제 원본을 대조한 뒤 수용·수정·반려 또는 불확실을 선택하세요.');
 }
 function collect(){
  const proposed=structuredClone(packet),q=proposed.questions[selected],r=q.review;
  r.decision=el.decision.value;
  r.verdict=null;r.answerText=null;r.evidence=[];r.absenceRationale=null;
  r.fullMovieReviewed=false;r.reviewerNote=null;r.watchedSource=false;
  if(r.decision==='PENDING')throw Error('검토 결정을 선택해야 저장할 수 있습니다.');
  r.watchedSource=el.watched.checked;
  if(r.decision==='REJECT'||r.decision==='UNCERTAIN'){
   r.verdict='AMBIGUOUS';r.reviewerNote=el.negativeNote.value.trim();
   return proposed;
  }
  r.verdict=el.verdict.value;r.answerText=el.answer.value.trim();
  r.reviewerNote=el.reviewerNote.value.trim()||null;
  if(r.verdict==='SUPPORTED'){
   r.evidence=currentEvidence();
   if(r.evidence.some(e=>e.localStartMs===null||e.localEndMs===null))throw Error('모든 근거 시각을 직접 확인하고 입력하세요.');
  }else{
   r.absenceRationale=el.absence.value.trim()||null;r.fullMovieReviewed=el.fullMovie.checked;
  }
  return proposed;
 }
 async function save(){
  if(busy)return;busy=true;el.save.disabled=true;
  try{
   const p=collect();
   const result=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({packet:p,revision})});
   const saved=await result.json();if(!result.ok)throw Error(saved.error||'검수 파일 저장 거절');
   packet=p;revision=saved.revision;render();
   notice('로컬 JSON에 검토 결과가 저장됐습니다. '+saved.summary.status,false,true);
  }catch(e){notice('저장 실패: '+e.message,true);}
  finally{busy=false;applyMode();}
 }
 function cueNow(t){return cues.find(c=>t>=c.startMs&&t<=c.endMs)||null;}
 function wave(){
  if(!packet||!waveform)return;
  const canvas=el.wave,ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#0c1c28';ctx.fillRect(0,0,w,h);
  const t=el.movie.currentTime*1000,duration=packet.durationMs;
  const span=el.zoom.value==='full'?duration:Number(el.zoom.value)*1000;
  const from=el.zoom.value==='full'?0:Math.max(0,Math.min(Math.max(0,duration-span),t-span/2)),to=Math.min(duration,from+span);
  const scale=x=>Math.round((x-from)/Math.max(1,to-from)*w);
  ctx.fillStyle='rgba(91,165,202,.16)';
  for(const c of cues){if(c.endMs<from||c.startMs>to)continue;const x1=scale(c.startMs),x2=scale(c.endMs);
   ctx.fillRect(Math.max(0,x1),0,Math.max(1,x2-x1),h);}
  ctx.fillStyle='#44c7a1';
  const peaks=waveform.peaks,ms=waveform.windowMs;
  const begin=Math.max(0,Math.floor(from/ms)),end=Math.min(peaks.length,Math.ceil(to/ms)),step=Math.max(1,Math.ceil((end-begin)/w));
  for(let i=begin;i<end;i+=step){
   let max=0;for(let j=i;j<Math.min(end,i+step);j++)max=Math.max(max,peaks[j]||0);
   const x=scale(i*ms),bar=Math.max(1,max*h*.4);
   ctx.fillRect(x,h/2-bar,Math.max(1,scale((i+step)*ms)-x),2*bar);
  }
  ctx.strokeStyle='#e7bd71';ctx.lineWidth=3;const cx=scale(t);ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.stroke();
  canvas.dataset.from=String(from);canvas.dataset.to=String(to);
 }
 function tick(){
  if(!packet)return;
  const t=el.movie.currentTime*1000,now=performance.now();
  el.clock.textContent=fmt(t);
  const c=cueNow(t);el.subtitle.textContent=c?c.text:'';
  el.cueNumber.textContent=c?'SRT #'+c.number+' · '+fmt(c.startMs)+'–'+fmt(c.endMs):'SRT 자막 없음';
  el.cueText.textContent=c?c.text:'현재 시각에 영어 자막이 없습니다.';
  if(now-lastWaveTick>80){wave();lastWaveTick=now;}
 }
 function frame(){if(!el.movie.paused)tick();requestAnimationFrame(frame);}
 async function init(){
  for(const [id,seconds] of [['back5',-5],['back01',-.1],['forward01',.1],['forward5',5]]){
   $(id).addEventListener('click',()=>{el.movie.currentTime=Math.max(0,el.movie.currentTime+seconds);tick();});
  }
  $('play').addEventListener('click',()=>{if(el.movie.paused)el.movie.play().catch(()=>{});else el.movie.pause();});
  el.movie.addEventListener('timeupdate',tick);el.movie.addEventListener('seeked',tick);
  el.zoom.addEventListener('change',wave);
  el.wave.addEventListener('click',ev=>{
   if(!packet)return;
   const box=el.wave.getBoundingClientRect(),fraction=Math.min(1,Math.max(0,(ev.clientX-box.left)/box.width));
   const begin=Number(el.wave.dataset.from)||0,end=Number(el.wave.dataset.to)||packet.durationMs;
   el.movie.currentTime=(begin+(end-begin)*fraction)/1000;tick();
  });
  el.decision.addEventListener('change',()=>{applyMode();markDirty();});
  el.verdict.addEventListener('change',()=>{applyMode();markDirty();});
  for(const x of [el.answer,el.absence,el.fullMovie,el.reviewerNote,el.negativeNote,el.watched]){
   x.addEventListener('input',markDirty);
  }
  el.add.addEventListener('click',()=>{
   const q=question();if(fields.length>=10){notice('근거는 최대 10개입니다.',true);return;}
   const rows=currentEvidence();
   rows.push({modality:q.kind==='SPEECH'?'AUDIO':'FRAME',localStartMs:null,localEndMs:null,observationNote:''});
   buildEvidence(q,rows);markDirty();
  });
  el.jump.addEventListener('click',()=>jump(question().localAnchorMs[0]??0));
  el.save.addEventListener('click',save);
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  try{
   const res=await fetch('/api/session');const session=await res.json();
   if(!res.ok)throw Error(session.error||'서버 응답 오류');
   packet=session.packet;revision=session.revision;cues=session.cues;waveform=session.waveform;
   aiObservationDrafts=session.aiObservationSuggestions||{};
   if(packet.kind!=='G2F_LOCAL_AI_ASSISTED_REVIEW_PACKET'||packet.questions.length!==6)throw Error('AI 보조 검토 전용 패킷이 아닙니다.');
   el.film.textContent=session.film;el.reviewer.textContent=session.reviewerCode;
   select(0);tick();requestAnimationFrame(frame);
  }catch(e){notice('AI 보조 검토 웹 시작 실패: '+e.message,true);el.save.disabled=true;}
 }
 window.addEventListener('DOMContentLoaded',init);
})();
