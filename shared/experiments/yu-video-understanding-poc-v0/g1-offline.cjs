'use strict';
// YOUTOPIA G1: synthetic-only evidence evaluation, no network or provider SDK.
const ARMS=['NATIVE_MULTIMODAL','SEMANTIC_INDEX','TRANSCRIPT_ONLY'];
const TYPES=['SPEECH','VISUAL','OCR','TEMPORAL','UNSUPPORTED'];
const S=[
 ['INTERVIEW',[
 ['SPEECH','제작자가 가장 먼저 정하는 것은?','핵심 질문'],
 ['SPEECH','초기 조사는 어떤 자료로 하는가?','공식 문서와 사용자 피드백'],
 ['SPEECH','최종 검수의 우선순위는?','맥락 왜곡 방지'],
 ['TEMPORAL','편집 시안과 게시 승인의 순서는?','시안 공유 후 게시 승인'],
 ['UNSUPPORTED','사용한 개인 노트북 모델은?','확인 불가'],
 ['UNSUPPORTED','제작자의 연간 실제 매출은?','확인 불가']]],
 ['INTERVIEW',[
 ['SPEECH','설문 해석 전 무엇을 확인하는가?','표본 구성'],
 ['SPEECH','두 집단 비교 전에 무엇을 확인하는가?','집단별 분모'],
 ['SPEECH','논란 있는 자료를 어떻게 다루는가?','출처 대조'],
 ['TEMPORAL','전처리와 가설 검증 중 먼저 하는 작업은?','전처리 후 가설 검증'],
 ['UNSUPPORTED','미공개 서버 비밀번호는?','확인 불가'],
 ['UNSUPPORTED','영상 밖 제3자의 상세 주소는?','확인 불가']]],
 ['SCREENCAST',[
 ['SPEECH','컷 편집 전에 정리하는 것은?','미디어 클립과 트랙'],
 ['SPEECH','색보정 첫 단계는?','노출 확인'],
 ['VISUAL','음성 클립이 이동한 트랙은?','오디오 2번 트랙'],
 ['OCR','내보내기 해상도는?','1920×1080'],
 ['OCR','프레임 레이트는?','30 fps'],
 ['TEMPORAL','클립 이동과 렌더 클릭 순서는?','클립 이동 후 렌더 클릭']]],
 ['SCREENCAST',[
 ['SPEECH','차트 해석 전에 통일하는 조건은?','관측 기간'],
 ['SPEECH','결측치를 어떻게 다루는가?','별도 표시'],
 ['VISUAL','필터 선택 후 그래프 변화는?','항목 수 감소'],
 ['OCR','대시보드 기간 표기는?','Last 30 days'],
 ['OCR','필터 입력값은?','Mobile'],
 ['TEMPORAL','필터 적용과 내보내기 순서는?','필터 적용 후 내보내기']]],
 ['ACTION',[
 ['SPEECH','두 번째 페이즈에서 주의할 공격은?','연속 돌진'],
 ['VISUAL','보스가 방패를 내린 뒤 하는 행동은?','오른쪽 돌진'],
 ['VISUAL','플레이어가 회피한 뒤 일어난 일은?','공격 빗나감'],
 ['VISUAL','강공격 때 나타나는 표시는?','원형 경고'],
 ['OCR','HUD 회복약 수는?','2'],
 ['TEMPORAL','경고와 충격파 순서는?','경고 후 충격파']]],
 ['ACTION',[
 ['SPEECH','반죽을 섞을 때 피할 행동은?','과도한 혼합'],
 ['VISUAL','버터가 들어가는 형태는?','작은 차가운 큐브'],
 ['VISUAL','반죽을 자르는 도구는?','스크래퍼'],
 ['VISUAL','굽기 전에 윗면에 하는 일은?','달걀물 바름'],
 ['OCR','오븐 표시 온도는?','170°C'],
 ['UNSUPPORTED','모든 시청자의 만족도는?','확인 불가']]]
];
function guard(ok,msg){if(!ok)throw Error('G1_FAIL_CLOSED: '+msg);}
function benchmark(){
 const videos=[],questions=[];
 S.forEach((group,i)=>{
   const videoRef='SYNTH-VID-0'+(i+1),scenes=[];
   group[1].forEach(([kind,questionText,answerText])=>{
     const questionId='SYNTH-Q'+String(questions.length+1).padStart(2,'0'),evidence=[];
     for(let k=0;k<(kind==='UNSUPPORTED'?0:kind==='TEMPORAL'?2:1);k++){
       const j=scenes.length+1,startMs=30000+(j-1)*60000,endMs=startMs+8000;
       const modality=kind==='OCR'?'OCR':kind==='VISUAL'||kind==='TEMPORAL'?'FRAME':'AUDIO';
       const sourceRef='synthetic://'+videoRef+'/scene-'+String(j).padStart(2,'0');
       const role=kind==='TEMPORAL'?(k===0?'BEFORE':'AFTER'):'PRIMARY';
       scenes.push({sourceRef,startMs,endMs,modality,observation:answerText});
       evidence.push({sourceRef,startMs,endMs,modality,role});
     }
     questions.push({videoRef,questionId,kind,questionText,gold:{answerability:kind==='UNSUPPORTED'?'UNSUPPORTED':'SUPPORTED',answerId:kind==='UNSUPPORTED'?null:'ANS-'+questionId,answerText,evidence}});
   });
   while(scenes.length<6){const j=scenes.length+1,startMs=30000+(j-1)*60000;scenes.push({sourceRef:'synthetic://'+videoRef+'/scene-'+String(j).padStart(2,'0'),startMs,endMs:startMs+8000,modality:'FRAME',observation:'합성 배경 장면'});}
   videos.push({videoRef,genre:group[0],durationMs:780000,rightsState:'SYNTHETIC_ONLY',sourceType:'SYNTHETIC_FIXTURE',rightsEpoch:0,contentVersion:'synthetic-v1',scenes});
 });
 return {datasetId:'YU-VIDEO-G1-SYNTH-V01',sourceType:'SYNTHETIC_FIXTURE',realMediaIncluded:false,externalCalls:0,videos,questions};
}
function validate(data){
 guard(data.sourceType==='SYNTHETIC_FIXTURE'&&data.realMediaIncluded===false&&data.externalCalls===0,'real media or network forbidden');
 guard(Array.isArray(data.videos)&&data.videos.length===6&&Array.isArray(data.questions)&&data.questions.length===36,'dataset size');
 const count=Object.fromEntries(TYPES.map(t=>[t,0])),genres={INTERVIEW:0,SCREENCAST:0,ACTION:0},ids=new Set(),vmap=new Map();
 for(const v of data.videos){
   guard(v.sourceType==='SYNTHETIC_FIXTURE'&&v.rightsState==='SYNTHETIC_ONLY'&&v.rightsEpoch===0,'rights');
   guard(/^SYNTH-VID-0[1-6]$/.test(v.videoRef)&&!vmap.has(v.videoRef),'video id');
   guard(Object.hasOwn(genres,v.genre),'genre');genres[v.genre]++;
   const scenes=new Map();
   for(const s of v.scenes){guard(s.sourceRef.startsWith('synthetic://'+v.videoRef+'/')&&!scenes.has(s.sourceRef),'synthetic scene');
     guard(Number.isSafeInteger(s.startMs)&&s.startMs>=0&&s.endMs>s.startMs&&s.endMs<=v.durationMs,'scene time');scenes.set(s.sourceRef,s);}
   vmap.set(v.videoRef,{video:v,scenes,n:0});
 }
 guard(Object.values(genres).every(n=>n===2),'genre distribution');
 for(const q of data.questions){
   guard(!ids.has(q.questionId)&&/^SYNTH-Q\d{2}$/.test(q.questionId),'question id');ids.add(q.questionId);
   const v=vmap.get(q.videoRef);guard(v&&TYPES.includes(q.kind),'question reference');v.n++;count[q.kind]++;
   guard(q.gold.answerability===(q.kind==='UNSUPPORTED'?'UNSUPPORTED':'SUPPORTED'),'gold status');
   guard(q.gold.evidence.length===(q.kind==='UNSUPPORTED'?0:q.kind==='TEMPORAL'?2:1),'gold evidence count');
   guard(q.kind==='UNSUPPORTED'?q.gold.answerId===null:typeof q.gold.answerId==='string','gold label');
   for(const e of q.gold.evidence){const scene=v.scenes.get(e.sourceRef);guard(scene&&scene.startMs===e.startMs&&scene.endMs===e.endMs&&scene.modality===e.modality,'gold source');}
   if(q.kind==='TEMPORAL')guard(q.gold.evidence[0].role==='BEFORE'&&q.gold.evidence[1].role==='AFTER'&&q.gold.evidence[0].endMs<=q.gold.evidence[1].startMs,'order');
 }
 guard([...vmap.values()].every(v=>v.n===6),'6 questions per video');
 guard([12,8,6,5,5].every((n,i)=>count[TYPES[i]]===n),'kind distribution');
 return {vmap,qmap:new Map(data.questions.map(q=>[q.questionId,q])),count};
}
function responses(data){
 const fails={NATIVE_MULTIMODAL:{4:'time',10:'source',22:'answer',30:'missing',36:'invent'},SEMANTIC_INDEX:{8:'answer',18:'time',25:'missing'},TRANSCRIPT_ONLY:{8:'answer'}};
 const rows=[];
 ARMS.forEach((arm,k)=>data.questions.forEach(q=>{
   const num=Number(q.questionId.slice(-2)),abstain=q.kind==='UNSUPPORTED'||(arm==='TRANSCRIPT_ONLY'&&q.kind!=='SPEECH');
   let answerability=abstain?'UNSUPPORTED':'SUPPORTED',answerId=abstain?null:q.gold.answerId;
   let evidence=abstain?[]:q.gold.evidence.map(e=>({...e,contentVersion:'synthetic-v1',rightsEpoch:0,modelVersion:'mock-v1',promptVersion:'mock-p1',extractionVersion:'mock-e1'}));
   const bad=fails[arm][num];
   if(bad==='answer')answerId='WRONG-'+q.questionId;
   else if(bad==='time'){evidence[0].startMs+=6000;evidence[0].endMs+=6000;}
   else if(bad==='missing')evidence=[];
   else if(bad==='source'){const v=data.videos.find(v=>v.videoRef===q.videoRef),s=v.scenes.find(s=>s.modality===evidence[0].modality&&s.sourceRef!==evidence[0].sourceRef);evidence[0].sourceRef=s.sourceRef;evidence[0].startMs=s.startMs;evidence[0].endMs=s.endMs;}
   else if(bad==='invent'){answerability='SUPPORTED';answerId='INVENTED-'+q.questionId;evidence=[];}
   rows.push({arm,questionId:q.questionId,videoRef:q.videoRef,answerability,answerId,evidence,provenance:'SYNTHETIC_MOCK_OUTPUTS',usage:{externalCalls:0,retries:0},latencyMs:210+k*130+num%5*19});
 }));
 return {datasetId:data.datasetId,provenance:'SYNTHETIC_MOCK_OUTPUTS',externalCalls:0,rows};
}
function validateResponses(data,p){
 const idx=validate(data);guard(p.datasetId===data.datasetId&&p.provenance==='SYNTHETIC_MOCK_OUTPUTS'&&p.externalCalls===0,'real outputs forbidden');
 guard(p.rows.length===108,'3x36 coverage');const seen=new Set();
 for(const row of p.rows){
   const q=idx.qmap.get(row.questionId),v=idx.vmap.get(row.videoRef),id=row.arm+'/'+row.questionId;
   guard(ARMS.includes(row.arm)&&q&&q.videoRef===row.videoRef&&!seen.has(id),'duplicate or unknown trial');seen.add(id);
   guard(row.provenance==='SYNTHETIC_MOCK_OUTPUTS'&&row.usage.externalCalls===0&&row.usage.retries===0,'live request or retry');
   guard(['SUPPORTED','UNSUPPORTED','AMBIGUOUS'].includes(row.answerability)&&Array.isArray(row.evidence),'trial shape');
   guard(row.answerability==='SUPPORTED'?typeof row.answerId==='string'&&row.answerId.length>0:row.answerId===null&&row.evidence.length===0,'invalid claim');
   for(const e of row.evidence){guard(e.sourceRef.startsWith('synthetic://'+row.videoRef+'/')&&e.startMs>=0&&e.endMs>e.startMs&&e.endMs<=v.video.durationMs,'cross-video or invalid time');
     guard(typeof e.contentVersion==='string'&&typeof e.modelVersion==='string'&&typeof e.promptVersion==='string'&&typeof e.extractionVersion==='string'&&Number.isInteger(e.rightsEpoch),'trace metadata');}
 }
 return idx;
}
function traceable(row,v){return row.answerability==='SUPPORTED'&&row.evidence.length>0&&row.evidence.every(e=>v.scenes.has(e.sourceRef)&&v.scenes.get(e.sourceRef).modality===e.modality&&e.contentVersion===v.video.contentVersion&&e.rightsEpoch===v.video.rightsEpoch&&e.modelVersion&&e.promptVersion&&e.extractionVersion);}
function aligned(row,q,v){
 if(!traceable(row,v))return false;
 if(!q.gold.evidence.every(g=>row.evidence.some(e=>e.sourceRef===g.sourceRef&&e.modality===g.modality&&e.role===g.role&&Math.min(e.endMs,g.endMs)>Math.max(e.startMs,g.startMs)&&Math.abs((e.startMs+e.endMs-g.startMs-g.endMs)/2)<=5000)))return false;
 if(q.kind==='TEMPORAL'){const a=row.evidence.find(e=>e.role==='BEFORE'),b=row.evidence.find(e=>e.role==='AFTER');return !!(a&&b&&a.endMs<=b.startMs);}return true;
}
function evaluate(data,p){
 const idx=validateResponses(data,p),out={},rate=(a,b)=>b?Math.round(a/b*1e6)/1e6:null;
 for(const arm of ARMS){
   let answerable=0,good=0,visual=0,visualGood=0,unknown=0,abstained=0,claims=0,bad=0,tracked=0,temporal=0;
   for(const row of p.rows.filter(r=>r.arm===arm)){
     const q=idx.qmap.get(row.questionId),v=idx.vmap.get(q.videoRef),claim=row.answerability==='SUPPORTED',time=aligned(row,q,v);
     const correct=claim&&q.kind!=='UNSUPPORTED'&&row.answerId===q.gold.answerId&&time;
     if(q.kind==='UNSUPPORTED'){unknown++;if(row.answerability==='UNSUPPORTED')abstained++;}
     else{answerable++;if(correct)good++;if(time)temporal++;if(q.kind==='VISUAL'||q.kind==='OCR'){visual++;if(correct)visualGood++;}}
     if(claim){claims++;if(!correct)bad++;if(traceable(row,v))tracked++;}
   }
   out[arm]={sampleCount:36,groundedAnswerRate:rate(good,answerable),visualGroundedRate:rate(visualGood,visual),unsupportedCorrectRate:rate(abstained,unknown),unsupportedClaimRate:rate(bad,claims),evidenceTraceCompleteness:rate(tracked,claims),temporalEvidenceRate:rate(temporal,answerable)};
 }
 return {status:'G1_SYNTHETIC_ONLY',liveAccuracyVerified:false,decision:'INCONCLUSIVE_OFFLINE_SYNTHETIC',externalCalls:0,byArm:out};
}
const PRICE={
 NATIVE_MULTIMODAL:{setup:{ingestion:.004,preprocessing:0,indexing:0,storage:0,lifecycle:.001},query:{inference:.009,retrieval:.001,recheck:0}},
 SEMANTIC_INDEX:{setup:{ingestion:.005,preprocessing:.009,indexing:.006,storage:.001,lifecycle:.001},query:{inference:.002,retrieval:.0005,recheck:0}},
 TRANSCRIPT_ONLY:{setup:{ingestion:.002,preprocessing:.002,indexing:.001,storage:.001,lifecycle:.001},query:{inference:.001,retrieval:.0005,recheck:0}}
};
function cost(model=PRICE){
 const out={};for(const arm of ARMS){
   const item=model[arm];guard(item&&item.setup&&item.query,'cost missing');
   guard(Object.keys(item.setup).sort().join(',')==='indexing,ingestion,lifecycle,preprocessing,storage'&&Object.keys(item.query).sort().join(',')==='inference,recheck,retrieval','cost component missing');
   const values=[...Object.values(item.setup),...Object.values(item.query)];
   guard(values.every(v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0)),'invalid or negative cost');
   out[arm]={};for(const n of [1,5,20]){
     const amount=values.some(v=>v===null)?null:Math.round((Object.values(item.setup).reduce((a,b)=>a+b,0)+n*Object.values(item.query).reduce((a,b)=>a+b,0))*1e8)/1e8;
     out[arm][n]={perVideoUsd:amount,sixVideoUsd:amount===null?null:Math.round(amount*6*1e8)/1e8};
   }
 }
 return {status:'ILLUSTRATIVE_ONLY',actualSpendUsd:0,providerRatesVerified:false,decision:'INCONCLUSIVE_OFFLINE_SYNTHETIC',byArm:out};
}
function run(){const data=benchmark(),p=responses(data);return {phase:'G1',status:'OFFLINE_ONLY',liveCallsAuthorized:false,externalCalls:0,actualSpendUsd:0,mergeApproved:false,dataset:{videos:6,questions:36,mockOutputs:108},quality:evaluate(data,p),hypotheticalCost:cost()};}
if(require.main===module){if(process.argv.length!==2){process.stderr.write('G1_OFFLINE_ONLY: no arguments supported\n');process.exitCode=1;}else process.stdout.write(JSON.stringify(run(),null,2)+'\n');}
module.exports={ARMS,benchmark,validate,responses,validateResponses,traceable,aligned,evaluate,cost,run};