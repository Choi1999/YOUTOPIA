'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const el={
  film:$('filmLabel'),progress:$('progressLabel'),count:$('checkpointCount'),checkpoints:$('checkpoints'),
  stats:$('stats'),video:$('localVideo'),subtitle:$('subtitle'),localTime:$('localTime'),captionText:$('captionText'),
  wave:$('wave'),zoom:$('zoom'),playPause:$('playPause'),prev5:$('prev5'),next5:$('next5'),prev01:$('prev01'),next01:$('next01'),
  youtubeFrame:$('youtubeFrame'),youtubeLink:$('youtubeLink'),loadEmbed:$('loadEmbed'),embedPrompt:$('embedPrompt'),
  independentMode:$('independentMode'),linkedMode:$('linkedMode'),captureOffset:$('captureOffset'),
  offsetReadout:$('offsetReadout'),syncState:$('syncState'),syncObserved:$('syncObserved'),
  alignYoutube:$('alignYoutube'),alignLocal:$('alignLocal'),
  editionCaveat:$('editionCaveat'),uploader:$('uploader'),youtubeDuration:$('youtubeDuration'),
  prompt:$('checkpointPrompt'),checkpointId:$('checkpointId'),verdict:$('verdict'),observedTime:$('observedTime'),
  recordTimeLabel:$('recordTimeLabel'),captureLocal:$('captureLocal'),timeHelp:$('timeHelp'),note:$('note'),
  target:$('targetTime'),cueIndex:$('cueIndex'),jump:$('jumpTarget'),save:$('save'),toast:$('toast')
 };
 let data,review,revision,selected=0,saving=false,dirty=false,dragStart=null,waveRect=null;
 let sync=null,youtubeApiRequested=false,youtubePlayer=null;
 let goldPacket=null,goldRevision=null,goldSelected=0,goldDirty=false,goldEvidenceRows=[];
 function showSyncMessage(message,kind=''){el.syncObserved.textContent=message;if(kind==='err')note(message,'err');}
 function syncStatus(state){
  if(!state)return;
  const ready=state.ready,calibrated=state.calibrated;
  el.captureOffset.disabled=!ready;
  el.linkedMode.disabled=!ready||!calibrated;
  el.alignYoutube.disabled=!ready||!calibrated;
  el.alignLocal.disabled=!ready||!calibrated;
  el.independentMode.classList.toggle('selected',!state.linked);
  el.linkedMode.classList.toggle('selected',state.linked);
  el.independentMode.setAttribute('aria-pressed',String(!state.linked));
  el.linkedMode.setAttribute('aria-pressed',String(state.linked));
  el.offsetReadout.textContent=calibrated
   ?(state.offsetSeconds>=0?'+':'−')+Math.abs(state.offsetSeconds).toFixed(3)+'초'
   :'미설정';
  el.syncState.textContent=state.linked?'연동 재생 · 임시 보정값 사용'
   :ready?(calibrated?'독립 재생 · 기준점 기록됨':'독립 재생 · 기준점 필요')
   :'독립 재생 · YouTube 연결 전';
  el.syncState.className=state.linked?'tinybadge':'tinybadge caution';
  if(state.linked&&state.driftSeconds!==null){
   const error=Math.abs(state.driftSeconds);
   el.syncObserved.textContent=error>2
    ?'시점 차이 '+state.driftSeconds.toFixed(2)+'초 · 판본/탐색 차이 확인 필요'
    :'두 플레이어의 현재 시점 차이 약 '+state.driftSeconds.toFixed(2)+'초 (관찰용)';
  }
 }
 function initializeSync(){
  if(!window.G2DPlaybackSync)throw Error('재생 연동 모듈을 불러오지 못했습니다.');
  sync=window.G2DPlaybackSync.create({local:el.video,onChange:syncStatus});
  syncStatus(sync.status());
  el.independentMode.addEventListener('click',()=>{
   sync.setLinked(false);showSyncMessage('독립 모드: 두 영상의 재생과 탐색을 각각 조작합니다.');
  });
  el.linkedMode.addEventListener('click',()=>{
   try{sync.setLinked(true);
    showSyncMessage('연동 모드 활성화: 로컬↔YouTube 재생·탐색 연동. 일치 여부는 별도 검수하세요.');
   }catch(e){showSyncMessage(e.message,'err');}
  });
  el.captureOffset.addEventListener('click',()=>{
   try{const state=sync.capture();
    showSyncMessage('기준점 기록: YouTube = 로컬 '+(state.offsetSeconds>=0?'+ ':'− ')+
     Math.abs(state.offsetSeconds).toFixed(3)+'초 · 연동 재생 버튼으로 연결하세요.');
   }catch(e){showSyncMessage(e.message,'err');}
  });
  el.alignYoutube.addEventListener('click',()=>{
   try{const t=sync.alignYoutube();showSyncMessage('YouTube 이동 요청: '+fmt(t*1000)+' · 키프레임 정확도 한계가 있습니다.');}
   catch(e){showSyncMessage(e.message,'err');}
  });
  el.alignLocal.addEventListener('click',()=>{
   try{const t=sync.alignLocal();showSyncMessage('로컬 이동: '+fmt(t*1000));}
   catch(e){showSyncMessage(e.message,'err');}
  });
  // The YouTube IFrame API has no seek event. Compare large discontinuities only;
  // do not continuously seek during ordinary playback and do not assert full equivalence.
  window.setInterval(()=>{if(sync&&sync.status().ready)sync.poll();},650);
 }
 function connectYoutube(){
  if(youtubeApiRequested)return;
  const url=new URL(review.youtubeUrl);
  const id=url.searchParams.get('v');
  if(url.hostname!=='www.youtube.com'||!/^[A-Za-z0-9_-]{11}$/.test(id||'')){
   showSyncMessage('허용되지 않은 YouTube 참조입니다.','err');return;
  }
  youtubeApiRequested=true;
  el.loadEmbed.disabled=true;
  const origin=encodeURIComponent(window.location.origin);
  el.youtubeFrame.src='https://www.youtube-nocookie.com/embed/'+id+
   '?playsinline=1&rel=0&enablejsapi=1&origin='+origin;
  el.youtubeFrame.hidden=false;el.embedPrompt.hidden=true;
  window.onYouTubeIframeAPIReady=()=>{
   try{
    youtubePlayer=new window.YT.Player('youtubeFrame',{events:{
     onReady:event=>{
      try{sync.attach(event.target);
       showSyncMessage('YouTube API 연결됨. 두 영상을 같은 장면에서 각각 멈춘 뒤 기준점을 기록하세요.');
      }catch(e){showSyncMessage(e.message,'err');}
     },
     onStateChange:event=>{if(sync)sync.youtubeStateChange(event.data);},
     onError:event=>{if(sync)sync.failed();
      showSyncMessage('YouTube 임베드 오류 코드 '+event.data+
       ' · 독립 모드로 유지됩니다. YouTube 원본 페이지에서 수동 비교하세요.','err');
     }
    }});
   }catch(e){if(sync)sync.failed();showSyncMessage('YouTube API 연결 실패: '+e.message,'err');}
  };
  const external=document.createElement('script');external.src='https://www.youtube.com/iframe_api';external.async=true;
  external.onerror=()=>{if(sync)sync.failed();showSyncMessage('YouTube API 스크립트 연결 실패 · 독립 재생만 사용할 수 있습니다.','err');};
  document.head.appendChild(external);
 }
 // G2-E question and local evidence authoring. Never auto-labels a film fact.
 function ge(id){return document.getElementById(id);}
 function goldMsg(text,error=false){ge('goldMessage').textContent=text;ge('goldMessage').className='toast'+(error?' err':'');}
 function goldDirtyNow(){goldDirty=true;goldMsg('골드 초안 입력 중입니다. 이 질문의 정답 초안 저장을 눌러야 기록됩니다.');}
 function goldStatus(){
  if(!goldPacket)return;
  const count=goldPacket.questions.filter(q=>q.gold.answerability!==null&&q.gold.answerability!=='AMBIGUOUS').length;
  const ambiguous=goldPacket.questions.filter(q=>q.gold.answerability==='AMBIGUOUS').length;
  ge('goldProgress').textContent='작성 '+count+'/6'+(ambiguous?' · 재검수 '+ambiguous:'')+' · 골드 승인 전';
  ge('goldStage').textContent=count===6&&ambiguous===0?'작성 완료 · 독립 검수 전':'골드 초안 · 미검증';
  ge('goldStage').className='tinybadge caution';
 }
 function goldEvidenceEditor(q){
  const host=ge('goldEvidence');host.replaceChildren();goldEvidenceRows=[];
  if(ge('goldAnswerability').value!=='SUPPORTED')return;
  const existing=q.gold.evidence.length?q.gold.evidence:
    Array.from({length:q.requiredEvidenceCount},()=>({modality:q.requiredModalities[0],
      localStartMs:null,localEndMs:null,youtubeObservedMs:null,observationNote:''}));
  existing.forEach((e,i)=>{
   const box=document.createElement('div');box.className='gold-evidence-row';
   const title=document.createElement('div');title.className='gold-evidence-title';
   title.textContent='로컬 원본 근거 #'+(i+1)+' · 기준 '+fmt(q.anchorLocalMs[Math.min(i,q.anchorLocalMs.length-1)]??0);
   box.append(title);
   const fields=document.createElement('div');fields.className='gold-evidence-fields';
   function field(label,type,value){
    const holder=document.createElement('label');holder.textContent=label;
    let inp;
    if(type==='select'){
     inp=document.createElement('select');
     for(const allowed of q.requiredModalities){const opt=document.createElement('option');opt.value=allowed;opt.textContent=allowed;inp.append(opt);}
     inp.value=value||q.requiredModalities[0];
    }else{
     inp=document.createElement('input');inp.type='text';inp.placeholder='mm:ss.SSS';inp.value=value===null?'':fmt(value);
    }
    inp.addEventListener('input',goldDirtyNow);holder.append(inp);fields.append(holder);return inp;
   }
   const modality=field('근거 모달리티','select',e.modality);
   const start=field('근거 시작 시각','time',e.localStartMs);
   const end=field('근거 종료 시각','time',e.localEndMs);
   box.append(fields);
   const controls=document.createElement('div');controls.className='gold-capture';
   function control(label,cb){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',cb);controls.append(button);
   }
   control('이 기준점으로 이동',()=>{
    const t=q.anchorLocalMs[Math.min(i,q.anchorLocalMs.length-1)];
    if(t===undefined)return;
    sync?.setLinked(false);el.video.pause();el.video.currentTime=Math.max(0,t/1000-4);onTick();
   });
   control('현재 시점 → 시작',()=>{start.value=fmt(el.video.currentTime*1000);goldDirtyNow();});
   control('현재 시점 → 종료',()=>{end.value=fmt(el.video.currentTime*1000);goldDirtyNow();});
   box.append(controls);
   const notes=document.createElement('label');notes.textContent='근거 장면을 직접 확인한 관찰 기록 (18~500자)';
   const textarea=document.createElement('textarea');textarea.rows=2;textarea.placeholder='실제 영상에서 본 행동이나 직접 들은 내용을 설명하세요. 확인하지 않은 사실은 작성하지 마세요.';
   textarea.value=e.observationNote||'';textarea.addEventListener('input',goldDirtyNow);notes.append(textarea);box.append(notes);
   goldEvidenceRows.push({modality,start,end,notes:textarea});
   host.append(box);
  });
 }
 function renderGoldQuestion(){
  if(!goldPacket)return;
  const q=goldPacket.questions[goldSelected];
  ge('goldQuestion').value=q.finalQuestionText||q.questionDraft;
  ge('goldAuthor').value=q.authorCode||'LOCAL_AUTHOR_1';
  ge('goldAnswerability').value=q.gold.answerability||'';
  ge('goldAnswer').value=q.gold.answerText||'';
  ge('goldAbsenceReason').value=q.gold.absenceRationale||'';
  ge('goldFullFilm').checked=q.gold.fullMovieReviewed;
  ge('goldAnchorTime').value=q.anchorLocalMs.length?q.anchorLocalMs.map(fmt).join(' / '):'영화 전체 확인';
  ge('goldAnchor').textContent='종류: '+q.kind+' · G2-D 검수 지점: '+
   (q.anchorCheckpointIds.length?q.anchorCheckpointIds.join(' / '):'특정 시각 없음 · 전체 원본 확인 필요')+
   ' · 근거 '+q.requiredEvidenceCount+'개 이상';
  ge('goldAnswerability').querySelector('option[value="SUPPORTED"]').disabled=q.kind==='UNSUPPORTED';
  ge('goldAnswerability').querySelector('option[value="UNSUPPORTED"]').disabled=q.kind!=='UNSUPPORTED';
  const unsupported=ge('goldAnswerability').value==='UNSUPPORTED';
  ge('goldAbsenceBox').hidden=!unsupported;
  goldEvidenceEditor(q);goldStatus();goldDirty=false;
 }
 function selectGoldQuestion(index,force=false){
  if(!goldPacket)return;
  if(!force&&goldDirty&&!window.confirm('G2-E 질문에 저장하지 않은 변경 사항이 있습니다. 버리고 이동하시겠습니까?')){
   ge('goldSelect').value=String(goldSelected);return;
  }
  goldSelected=index;ge('goldSelect').value=String(index);
  sync?.setLinked(false);
  const q=goldPacket.questions[index];
  if(q.anchorLocalMs.length){el.video.pause();el.video.currentTime=Math.max(0,q.anchorLocalMs[0]/1000-4);onTick();}
  renderGoldQuestion();goldMsg('영상과 SRT를 직접 확인한 뒤 질문·정답·근거 시간을 작성하세요.');
 }
 function showGoldSession(body){
  if(!body.exists){ge('goldEmpty').hidden=false;ge('goldEditor').hidden=true;ge('goldStage').textContent='질문 미생성';return;}
  goldPacket=body.packet;goldRevision=body.revision;goldSelected=0;goldDirty=false;
  ge('goldEmpty').hidden=true;ge('goldEditor').hidden=false;
  const select=ge('goldSelect');select.replaceChildren();
  goldPacket.questions.forEach((q,i)=>{
   const o=document.createElement('option');o.value=String(i);o.textContent=q.id+' · '+q.kind+' · '+q.questionDraft;
   select.append(o);
  });
  selectGoldQuestion(0,true);
 }
 function collectGoldEdits(){
  if(!goldPacket)throw Error('먼저 질문을 생성하세요.');
  const packet=structuredClone(goldPacket),q=packet.questions[goldSelected];
  const result=ge('goldAnswerability').value;
  if(!result)throw Error('정답 가능 여부를 선택하세요. 미작성 문항은 기존 상태 그대로 유지할 수 있습니다.');
  q.finalQuestionText=ge('goldQuestion').value.trim();
  q.authorCode=ge('goldAuthor').value.trim();
  q.gold.answerability=result;q.gold.answerText=ge('goldAnswer').value.trim();
  q.gold.absenceRationale=null;q.gold.fullMovieReviewed=false;q.gold.evidence=[];
  if(result==='SUPPORTED'){
   if(q.kind==='UNSUPPORTED')throw Error('근거 부족 질문은 SUPPORTED로 처리할 수 없습니다.');
   q.gold.evidence=goldEvidenceRows.map(e=>{
    const start=parseTime(e.start.value),end=parseTime(e.end.value);
    if(start===null||end===null)throw Error('근거 시작·종료 시각을 모두 기록하세요.');
    return {modality:e.modality.value,localStartMs:start,localEndMs:end,
      youtubeObservedMs:null,observationNote:e.notes.value.trim()};
   });
  }else if(result==='UNSUPPORTED'){
   if(q.kind!=='UNSUPPORTED')throw Error('이 유형은 UNSUPPORTED 판정을 사용할 수 없습니다.');
   q.gold.absenceRationale=ge('goldAbsenceReason').value.trim();
   q.gold.fullMovieReviewed=ge('goldFullFilm').checked;
  }
  return packet;
 }
 async function saveGold(){
  const btn=ge('goldSave');btn.disabled=true;
  try{
   const packet=collectGoldEdits();
   const r=await fetch('/api/g2e/save',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({packet,revision:goldRevision})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'정답 초안 저장이 거절되었습니다.');
   goldPacket=packet;goldRevision=d.revision;goldDirty=false;
   renderGoldQuestion();goldMsg('비공개 로컬 JSON 저장 완료 · '+d.summary.status);
  }catch(e){goldMsg(e.message||'골드 초안 입력 오류',true);}
  finally{btn.disabled=false;}
 }
 async function initializeGold(){
  const button=ge('goldCreate');
  button.addEventListener('click',async()=>{
   button.disabled=true;goldMsg('질문 6개를 비공개 로컬 파일에 생성합니다.');
   try{
    const r=await fetch('/api/g2e/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();if(!r.ok)throw Error(d.error||'질문 생성 실패');
    showGoldSession(d);goldMsg('질문 후보 6개가 생성되었습니다. 정답은 아직 모두 비어 있습니다.');
   }catch(e){goldMsg(e.message,true);}finally{button.disabled=false;}
  });
  ge('goldSelect').addEventListener('change',()=>selectGoldQuestion(Number(ge('goldSelect').value)));
  ge('goldAnswerability').addEventListener('change',()=>{
   goldDirtyNow();const q=goldPacket.questions[goldSelected];
   ge('goldAbsenceBox').hidden=ge('goldAnswerability').value!=='UNSUPPORTED';
   goldEvidenceEditor(q);
  });
  for(const id of ['goldQuestion','goldAuthor','goldAnswer','goldAbsenceReason','goldFullFilm']){
   ge(id).addEventListener('input',goldDirtyNow);
  }
  ge('goldSave').addEventListener('click',saveGold);
  try{
   const r=await fetch('/api/g2e/session');const data=await r.json();
   if(!r.ok)throw Error(data.error||'골드 파일을 불러오지 못했습니다.');
   showGoldSession(data);
  }catch(e){goldMsg(e.message,true);ge('goldCreate').disabled=true;}
 }

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
  syncTopFields();initializeSync();selectItem(0,true);
  el.video.addEventListener('timeupdate',onTick);
  el.video.addEventListener('seeked',()=>{onTick();sync?.localSeeked();});
  el.video.addEventListener('pause',()=>sync?.localPlayback(false));
  el.video.addEventListener('loadedmetadata',onTick);
  el.video.addEventListener('play',()=>{
   sync?.localPlayback(true);
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
  el.loadEmbed.addEventListener('click',connectYoutube);
  document.addEventListener('keydown',e=>{
   const editable=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
   if(editable||e.altKey||e.ctrlKey||e.metaKey)return;
   if(e.key==='['){e.preventDefault();seek(-.1);}
   if(e.key===']'){e.preventDefault();seek(.1);}
  });
  // Local review data stays in this origin. Only official YouTube IFrame controls are external.
  note('로컬 영상과 검수 데이터를 읽었습니다. 확인된 사실만 기록하세요.');
  await initializeGold();
 }
 load().catch(e=>{note(e.message||'실행 오류','err');});
})();
