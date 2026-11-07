'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const ui={
  movie:$('movie'),clock:$('clock'),subtitle:$('subtitle'),cueNumber:$('cueNumber'),cueText:$('cueText'),
  film:$('filmBadge'),operator:$('operatorBadge'),nav:$('questionNav'),progress:$('progressText'),
  bar:$('progressBar'),badge:$('progressBadge'),anchors:$('anchors'),wave:$('wave'),zoom:$('zoom'),
  question:$('questionText'),meta:$('questionMeta'),questionStatus:$('questionStatus'),
  comps:$('reviewerComparisons'),author:$('authorAnswer'),status:$('status'),
  approved:$('approvedFields'),basis:$('basis'),verdict:$('verdict'),answer:$('finalAnswer'),
  supported:$('supportedFields'),unsupported:$('unsupportedFields'),
  evidence:$('finalEvidence'),add:$('addEvidence'),absence:$('absenceRationale'),fullMovie:$('fullMovie'),
  viewed:$('viewed'),rationale:$('rationale'),save:$('save'),feedback:$('feedback')};
 let packet=null,revision=null,sources=null,cues=[],waveform=null,selected=0,dirty=false,busy=false,fields=[];
 let waveTick=0;
 function fmt(ms){
  const x=Math.max(0,Math.round(ms||0)),h=Math.floor(x/3600000),m=Math.floor(x/60000)%60,s=Math.floor(x/1000)%60,ms3=String(x%1000).padStart(3,'0');
  return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+ms3;
 }
 function parseTime(text){
  if(typeof text!=='string')return null;
  const m=/^(\d{1,3}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/.exec(text.trim());
  if(!m)return null;
  let h=0,min=0,s=0;
  if(m[3]===undefined){min=Number(m[1]);s=Number(m[2]);}
  else{h=Number(m[1]);min=Number(m[2]);s=Number(m[3]);}
  if(s>=60||(m[3]!==undefined&&min>=60))return null;
  const v=(h*3600+min*60+s)*1000+Number((m[4]||'0').padEnd(3,'0'));
  return Number.isSafeInteger(v)?v:null;
 }
 function announce(msg,error=false,ok=false){
  ui.feedback.textContent=msg;ui.feedback.className='alert'+(error?' error':ok?' success':'');
 }
 function dirtyNotice(){dirty=true;announce('저장하지 않은 판정 변경 사항이 있습니다.');}
 function question(){return packet.questions[selected];}
 function sourceReview(tag){
  return (tag==='B'?sources.reviewerB:sources.reviewerA)[selected].review;
 }
 function seek(ms){ui.movie.pause();ui.movie.currentTime=Math.max(0,ms/1000-3);tick();}
 function evidenceCard(q,data,i){
  const card=document.createElement('section');card.className='evidence-card';
  const title=document.createElement('div');title.className='evidence-title';
  const name=document.createElement('strong');name.textContent='최종 근거 #'+(i+1);
  const remove=document.createElement('button');remove.type='button';remove.textContent='제거';
  remove.disabled=i<Math.max(1,q.localAnchorMs.length);
  remove.addEventListener('click',()=>{card.remove();fields=fields.filter(x=>x.card!==card);dirtyNotice();});
  title.append(name,remove);
  const grid=document.createElement('div');grid.className='evidence-grid';
  function make(label,control){
   const box=document.createElement('label');box.textContent=label;box.append(control);grid.append(box);return control;
  }
  const modality=document.createElement('select');
  const types=q.kind==='SPEECH'?['AUDIO','TRANSCRIPT']:['FRAME'];
  for(const t of types){const opt=document.createElement('option');opt.value=t;opt.textContent=t;modality.append(opt);}
  modality.value=types.includes(data.modality)?data.modality:types[0];modality.addEventListener('change',dirtyNotice);
  make('근거 유형',modality);
  function time(v){
   const control=document.createElement('input');control.type='text';control.placeholder='mm:ss.SSS';
   control.value=Number.isSafeInteger(v)?fmt(v):'';
   control.addEventListener('input',dirtyNotice);return control;
  }
  const start=make('시작 시간',time(data.localStartMs));
  const end=make('종료 시간',time(data.localEndMs));
  const capture=document.createElement('div');capture.className='capture';
  function addButton(text,fn){
   const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);capture.append(b);
  }
  addButton('기준점으로 이동',()=>seek(q.localAnchorMs[i]??data.localStartMs??0));
  addButton('현재 시점 → 시작',()=>{start.value=fmt(ui.movie.currentTime*1000);dirtyNotice();});
  addButton('현재 시점 → 종료',()=>{end.value=fmt(ui.movie.currentTime*1000);dirtyNotice();});
  const notes=document.createElement('textarea');notes.rows=2;notes.value=data.observationNote||'';
  notes.addEventListener('input',dirtyNotice);
  const notesLabel=document.createElement('label');notesLabel.textContent='최종 관찰 기록';notesLabel.append(notes);
  card.append(title,grid,capture,notesLabel);
  return {card,modality,start,end,notes};
 }
 function setEvidence(q,data){
  fields=[];ui.evidence.replaceChildren();
  const count=Math.max(1,q.localAnchorMs.length);
  const entries=data.length?data:
   Array.from({length:count},(_,i)=>({modality:q.kind==='SPEECH'?'AUDIO':'FRAME',localStartMs:q.localAnchorMs[i]??null,
    localEndMs:null,observationNote:''}));
  for(let i=0;i<entries.length;i++){
   const row=evidenceCard(q,entries[i],i);fields.push(row);ui.evidence.append(row.card);
  }
 }
 function currentEvidence(){
  return fields.map(x=>({modality:x.modality.value,localStartMs:parseTime(x.start.value),
   localEndMs:parseTime(x.end.value),observationNote:x.notes.value.trim()}));
 }
 function loadFromReviewer(who){
  if(!packet)return;
  const response=sourceReview(who);
  ui.verdict.value=response.verdict==='UNSUPPORTED'?'UNSUPPORTED':'SUPPORTED';
  ui.answer.value=response.answerText||'';
  ui.absence.value=response.absenceRationale||'';
  // Full original film review is an operator-specific action; do NOT copy a reviewer declaration.
  ui.fullMovie.checked=false;
  ui.viewed.checked=false;
  setEvidence(question(),response.evidence||[]);
  setVerdictVisibility();
 }
 function setVerdictVisibility(){
  const show=ui.status.value==='APPROVE';
  ui.approved.hidden=!show;
  ui.supported.hidden=!show||ui.verdict.value!=='SUPPORTED';
  ui.unsupported.hidden=!show||ui.verdict.value!=='UNSUPPORTED';
  ui.save.disabled=busy||ui.status.value==='PENDING';
 }
 function formatEvidence(evidence,index){
  if(!evidence||evidence.length===0)return '근거 구간 기록 없음';
  return evidence.map((e,i)=>'#'+(i+1)+' '+e.modality+' · '+fmt(e.localStartMs)+' ~ '+fmt(e.localEndMs)+'\n'+
   (e.observationNote||'')).join('\n\n');
 }
 function reviewerCard(tag,review){
  const card=document.createElement('article');card.className='reviewer-card';
  const heading=document.createElement('h4'),title=document.createElement('span'),verdict=document.createElement('span');
  title.textContent='리뷰어 '+tag;verdict.textContent=review.verdict+' · '+review.decision;
  heading.append(title,verdict);
  const answer=document.createElement('p');answer.textContent=review.answerText||'(답변 미작성)';
  const detail=document.createElement('div');detail.className='detail';
  detail.textContent=review.verdict==='UNSUPPORTED'?
   ('원본 전체 검토 여부: '+String(review.fullMovieReviewed)+'\n'+(review.absenceRationale||'')):
   formatEvidence(review.evidence);
  card.append(heading,answer,detail);
  // Original reviewer evidence is read-only. A separate seek button helps verify actual scenes.
  for(const evidence of review.evidence||[]){
   const btn=document.createElement('button');btn.type='button';
   btn.textContent='원본 '+fmt(evidence.localStartMs)+' 근거로 이동';
   btn.addEventListener('click',()=>seek(evidence.localStartMs));detail.append(btn);
  }
  return card;
 }
 function renderCompare(){
  ui.comps.replaceChildren(reviewerCard('A',sourceReview('A')),reviewerCard('B',sourceReview('B')));
  const author=sources.g2eAuthor[selected];
  ui.author.textContent=(author.answerability||'N/A')+' · '+(author.answerText||'(작성자 답변 없음)');
 }
 function renderNav(){
  const count=packet.questions.filter(q=>q.result.status!=='PENDING').length;
  ui.progress.textContent=count+'/6';ui.badge.textContent=count+'/6 결정';
  ui.bar.style.width=count/6*100+'%';ui.nav.replaceChildren();
  packet.questions.forEach((q,i)=>{
   const item=document.createElement('button');item.type='button';item.className=i===selected?'active':'';
   const label=document.createElement('span'),strong=document.createElement('strong'),details=document.createElement('small');
   strong.textContent=q.questionId;details.textContent=q.kind+' · '+(q.localAnchorMs.map(fmt).join(' / ')||'전체 영화');
   label.append(strong,details);
   const state=document.createElement('em');state.textContent=q.result.status;
   if(q.result.status==='APPROVE')state.className='done';
   item.append(label,state);item.addEventListener('click',()=>select(i));ui.nav.append(item);
  });
 }
 function render(){
  const q=question(),r=q.result;
  ui.question.textContent=q.questionText;ui.meta.textContent=q.questionId+' · '+q.kind;
  ui.questionStatus.textContent=r.status;ui.questionStatus.className=r.status==='APPROVE'?'tag green':'tag caution';
  renderCompare();renderNav();
  ui.anchors.replaceChildren();
  for(const a of q.localAnchorMs){
   const b=document.createElement('button');b.type='button';b.textContent='기준점 '+fmt(a);
   b.addEventListener('click',()=>seek(a));ui.anchors.append(b);
  }
  if(q.localAnchorMs.length===0){
   const b=document.createElement('span');b.textContent='전체 영화 확인 문항';ui.anchors.append(b);
  }
  ui.status.value=r.status;ui.basis.value=r.selectedBasis||'A';
  const existing=r.status==='APPROVE';
  if(existing){
   ui.verdict.value=r.finalVerdict;ui.answer.value=r.finalAnswerText||'';
   ui.absence.value=r.absenceRationale||'';ui.fullMovie.checked=r.fullMovieReviewed;
   ui.viewed.checked=r.operatorViewedSource;
   setEvidence(q,r.finalEvidence);
  }else{
   loadFromReviewer('A');
  }
  ui.rationale.value=r.rationale||'';
  setVerdictVisibility();
  dirty=false;
 }
 function select(i){
  if(!packet)return;
  if(dirty&&!window.confirm('현재 문항의 미저장 변경 사항을 버리고 다른 문항으로 이동하시겠습니까?'))return;
  selected=i;render();
  if(question().localAnchorMs.length)seek(question().localAnchorMs[0]);
  announce('A/B 결과와 원본을 대조한 후 운영자 판정을 선택하세요.');
 }
 function collect(){
  if(ui.status.value==='PENDING')throw Error('운영자 판정을 선택하세요.');
  const p=structuredClone(packet),r=p.questions[selected].result;
  r.status=ui.status.value;r.rationale=ui.rationale.value.trim();
  r.finalVerdict=null;r.finalAnswerText=null;r.finalEvidence=[];
  r.absenceRationale=null;r.fullMovieReviewed=false;r.operatorViewedSource=false;r.selectedBasis=null;
  if(r.status==='APPROVE'){
   r.finalVerdict=ui.verdict.value;r.finalAnswerText=ui.answer.value.trim();r.selectedBasis=ui.basis.value;
   r.operatorViewedSource=ui.viewed.checked;
   if(r.finalVerdict==='SUPPORTED'){
    r.finalEvidence=currentEvidence();
    if(r.finalEvidence.some(e=>e.localStartMs===null||e.localEndMs===null))
     throw Error('최종 근거의 시작·종료 시각을 입력하세요.');
   }else{
    r.absenceRationale=ui.absence.value.trim();r.fullMovieReviewed=ui.fullMovie.checked;
   }
  }else{
   // REVISE/HOLD never creates approved evidence.
   r.operatorViewedSource=ui.viewed.checked;
  }
  return p;
 }
 async function save(){
  if(busy)return;busy=true;ui.save.disabled=true;
  try{
   const result=collect();
   const response=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({record:result,revision})});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'저장 거부');
   packet=result;revision=body.revision;render();
   announce('운영자 판정을 별도 G2-G 파일에 저장했습니다. '+body.summary.status,false,true);
  }catch(e){announce('저장 실패: '+e.message,true);}
  finally{busy=false;setVerdictVisibility();}
 }
 function wave(){
  if(!packet||!waveform)return;
  const canvas=ui.wave,ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,
   now=ui.movie.currentTime*1000,duration=packet.durationMs,
   span=ui.zoom.value==='full'?duration:Number(ui.zoom.value)*1000,
   from=ui.zoom.value==='full'?0:Math.max(0,Math.min(duration-span,now-span/2)),
   to=Math.min(duration,from+span);
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#0e1b2a';ctx.fillRect(0,0,w,h);
  const scale=t=>Math.round((t-from)/Math.max(1,to-from)*w);
  ctx.fillStyle='rgba(124,180,209,.17)';
  for(const c of cues){
   if(c.endMs<from||c.startMs>to)continue;
   const left=scale(c.startMs),right=scale(c.endMs);
   ctx.fillRect(Math.max(0,left),0,Math.max(1,right-left),h);
  }
  ctx.fillStyle='#44c7a1';
  const peaks=waveform.peaks,windowMs=waveform.windowMs;
  const first=Math.max(0,Math.floor(from/windowMs)),last=Math.min(peaks.length,Math.ceil(to/windowMs)),step=Math.max(1,Math.ceil((last-first)/w));
  for(let i=first;i<last;i+=step){
   let max=0;for(let j=i;j<Math.min(last,i+step);j++)max=Math.max(max,peaks[j]||0);
   const x=scale(i*windowMs),amp=Math.max(1,max*h*.4);
   ctx.fillRect(x,h/2-amp,Math.max(1,scale((i+step)*windowMs)-x),amp*2);
  }
  ctx.strokeStyle='#e7bd71';ctx.lineWidth=2;const x=scale(now);
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  canvas.dataset.from=String(from);canvas.dataset.to=String(to);
 }
 function tick(){
  if(!packet)return;
  const ms=ui.movie.currentTime*1000;
  ui.clock.textContent=fmt(ms);
  const current=cues.find(c=>ms>=c.startMs&&ms<=c.endMs);
  ui.subtitle.textContent=current?current.text:'';
  ui.cueNumber.textContent=current?'SRT #'+current.number:'자막 없음';
  ui.cueText.textContent=current?current.text:'현재 재생 시각에는 자막이 없습니다.';
  if(performance.now()-waveTick>80){wave();waveTick=performance.now();}
 }
 function animate(){if(!ui.movie.paused)tick();requestAnimationFrame(animate);}
 async function init(){
  for(const [id,delta] of [['back5',-5],['back01',-.1],['forward01',.1],['forward5',5]])
   $(id).addEventListener('click',()=>{ui.movie.currentTime=Math.max(0,ui.movie.currentTime+delta);tick();});
  $('play').addEventListener('click',()=>{if(ui.movie.paused)ui.movie.play().catch(()=>{});else ui.movie.pause();});
  ui.movie.addEventListener('timeupdate',tick);
  ui.movie.addEventListener('seeked',tick);
  ui.zoom.addEventListener('change',wave);
  ui.wave.addEventListener('click',e=>{
   if(!packet)return;
   const b=ui.wave.getBoundingClientRect(),x=Math.min(1,Math.max(0,(e.clientX-b.left)/b.width)),
    from=Number(ui.wave.dataset.from)||0,to=Number(ui.wave.dataset.to)||packet.durationMs;
   ui.movie.currentTime=(from+(to-from)*x)/1000;tick();
  });
  ui.status.addEventListener('change',()=>{setVerdictVisibility();dirtyNotice();});
  ui.basis.addEventListener('change',()=>{
   if(ui.basis.value!=='CUSTOM')loadFromReviewer(ui.basis.value);
   dirtyNotice();
  });
  ui.verdict.addEventListener('change',()=>{setVerdictVisibility();dirtyNotice();});
  for(const x of [ui.answer,ui.absence,ui.fullMovie,ui.viewed,ui.rationale])
   x.addEventListener('input',dirtyNotice);
  ui.add.addEventListener('click',()=>{
   if(fields.length>=10){announce('근거 최대 10개',true);return;}
   const list=currentEvidence();
   list.push({modality:question().kind==='SPEECH'?'AUDIO':'FRAME',
    localStartMs:null,localEndMs:null,observationNote:''});
   setEvidence(question(),list);dirtyNotice();
  });
  ui.save.addEventListener('click',save);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  try{
   const r=await fetch('/api/session'),v=await r.json();
   if(!r.ok)throw Error(v.error||'세션 로드 실패');
   if(v.record.kind!=='G2G_LOCAL_OPERATOR_ADJUDICATION_V01')throw Error('운영자 전용 판정 파일 아님');
   packet=v.record;revision=v.revision;sources=v.sources;cues=v.cues;waveform=v.waveform;
   ui.film.textContent=v.film;ui.operator.textContent=v.operatorCode;
   select(0);tick();requestAnimationFrame(animate);
  }catch(e){announce('최종 판정 웹 로드 실패: '+e.message,true);ui.save.disabled=true;}
 }
 window.addEventListener('DOMContentLoaded',init);
})();
