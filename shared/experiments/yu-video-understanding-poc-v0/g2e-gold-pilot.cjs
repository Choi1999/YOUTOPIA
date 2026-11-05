'use strict';
// G2-E actual-film question candidates with EMPTY gold labels.
// All answer/evidence authoring stays in a private local JSON outside the repo.
// No video download, no YouTube extraction, no model API, no approval elevation.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const g2d=require('./g2d-human-review.cjs');
const PUBLIC=path.join(__dirname,'g2e-question-candidates.json');
const GENRES=['INTERVIEW','SCREENCAST','ACTION'];
const KINDS=['SPEECH','VISUAL','OCR','TEMPORAL','UNSUPPORTED'];
const Q_KEYS=['id','kind','questionDraft','anchorCheckpointIds','anchorLocalMs','requiredModalities','requiredEvidenceCount',
 'finalQuestionText','authorCode','gold'];
const GOLD_KEYS=['answerability','answerText','evidence','absenceRationale','fullMovieReviewed'];
const E_KEYS=['modality','localStartMs','localEndMs','youtubeObservedMs','observationNote'];
const ROOT_KEYS=['schemaVersion','kind','datasetId','film','slot','publisherEdition','provenance','sourceReviewDigest','sourceReviewStatus',
 'localSource','questions','planDigest','goldIndependentReviewVerified','realGoldApproved','g3Authorized','externalProviderCalls','actualSpendUsd'];
const LOCAL_KEYS=['videoSha256','captionSha256','durationMs','captionCueCount','youtubeTimelineMapping'];
function guard(ok,msg){if(!ok)throw Error('G2E_FAIL_CLOSED: '+msg);}
function strict(obj,fields,label){
 guard(obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).sort().join('|')===fields.slice().sort().join('|'),label+' schema');
}
function sha(value){return crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');}
function exactCounts(items,field){
 return Object.fromEntries(KINDS.map(k=>[k,items.filter(x=>x[field]===k).length]));
}
function registry(){
 const data=JSON.parse(fs.readFileSync(PUBLIC,'utf8'));
 strict(data,['schemaVersion','registryId','reviewedOn','status','provenance','realFilmBytesInRepo',
  'questionsContainVerifiedAnswers','filmRightsForServiceVerified','independentHumanGoldApproved','g3Authorized',
  'externalProviderCalls','actualSpendUsd','merged','fullG0Target','pilot','remaining','filmProvenance','questions'],'public registry');
 guard(data.schemaVersion===1&&data.registryId==='YU_VIDEO_G2E_BLENDER_PILOT_CANDIDATES_V01'&&
  data.status==='PUBLIC_QUESTION_DRAFTS_ONLY_NO_GOLD_ANSWERS'&&
  data.realFilmBytesInRepo===false&&data.questionsContainVerifiedAnswers===false&&
  data.filmRightsForServiceVerified===false&&data.independentHumanGoldApproved===false&&
  data.g3Authorized===false&&data.merged===false&&data.externalProviderCalls===0&&data.actualSpendUsd===0,'public default deny');
 guard(data.fullG0Target.filmCount===6&&data.fullG0Target.questionCount===36&&
  data.pilot.filmCount===2&&data.pilot.questionCount===12&&
  data.remaining.filmCount===4&&data.remaining.questionCount===24,'G0 scope');
 guard(JSON.stringify(data.fullG0Target.questionKinds)===JSON.stringify({SPEECH:12,VISUAL:8,OCR:6,TEMPORAL:5,UNSUPPORTED:5}), 'G0 quota');
 guard(JSON.stringify(data.pilot.questionKinds)===JSON.stringify({SPEECH:4,VISUAL:4,OCR:0,TEMPORAL:2,UNSUPPORTED:2}), 'pilot quota');
 guard(data.questions.length===12&&JSON.stringify(exactCounts(data.questions,'kind'))===
  JSON.stringify({SPEECH:4,VISUAL:4,OCR:0,TEMPORAL:2,UNSUPPORTED:2}), 'pilot types');
 guard(Object.keys(data.filmProvenance).sort().join('|')==='Sintel|TearsOfSteel','two films');
 const unique=new Set();
 for(const [film,info] of Object.entries(data.filmProvenance)){
  strict(info,['slot','realFilmId','publisherEdition','videoDurationMs','subtitleCueCount','g2dStatus','youtubeTimelineMapping'],'film provenance');
  guard(info.slot===(film==='Sintel'?'SYNTH-VID-05':'SYNTH-VID-06'),'source slot');
  guard(info.videoDurationMs===(film==='Sintel'?888032:734167),'source movie duration');
  guard(info.subtitleCueCount===(film==='Sintel'?26:76),'source SRT size');
 }
 for(const q of data.questions){
  strict(q,['id','film','kind','questionDraft','anchorCheckpointIds','requiredModalities','requiredEvidenceCount','candidateOnly'],'candidate');
  guard((q.film==='Sintel'||q.film==='TearsOfSteel')&&KINDS.includes(q.kind),'question scope');
  guard(/^(G2E-SIN|G2E-TOS)-0[1-6]$/.test(q.id)&&!unique.has(q.id),'question ID');
  unique.add(q.id);
  guard(q.id.startsWith(q.film==='Sintel'?'G2E-SIN':'G2E-TOS'),'film ID mismatch');
  guard(q.candidateOnly===true&&typeof q.questionDraft==='string'&&q.questionDraft.length>=18&&q.questionDraft.length<=350,'not answer-bearing candidate');
  guard(Array.isArray(q.anchorCheckpointIds)&&Array.isArray(q.requiredModalities),'question modalities');
  guard(q.kind==='UNSUPPORTED'?
   q.anchorCheckpointIds.length===0&&q.requiredModalities.length===0&&q.requiredEvidenceCount===0:
   q.anchorCheckpointIds.length===(q.kind==='TEMPORAL'?2:1),'anchor count');
  guard(q.kind==='UNSUPPORTED'||q.requiredEvidenceCount===(q.kind==='TEMPORAL'?2:1),'minimum evidence');
  guard(q.requiredModalities.every(m=>['AUDIO','TRANSCRIPT','FRAME','OCR'].includes(m)),'evidence modality');
 }
 guard(data.questions.filter(x=>x.film==='Sintel').length===6&&
  data.questions.filter(x=>x.film==='TearsOfSteel').length===6,'six questions per film');
 return data;
}
function safeJsonFile(name,{mustExist=false}={}){
 guard(typeof name==='string'&&!name.includes('://')&&path.extname(name).toLowerCase()==='.json','local JSON filename only');
 const absolute=path.resolve(name);
 guard(!g2d.insideRepo(absolute),'must write outside Git repo');
 if(mustExist){
  const st=fs.lstatSync(absolute);
  guard(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<200000,'local file size or symlink');
 }else{
  guard(!fs.existsSync(absolute),'will not overwrite existing file');
  guard(fs.existsSync(path.dirname(absolute))&&fs.statSync(path.dirname(absolute)).isDirectory(),'output folder missing');
 }
 return absolute;
}
function readJson(name){return JSON.parse(fs.readFileSync(safeJsonFile(name,{mustExist:true}),'utf8'));}
function sourceAssessment(packet,film){
 const result=g2d.assess(packet);
 guard(packet.film===film&&result.film===film,'G2-D film identity');
 guard(result.counts.match===(film==='Sintel'?6:8)&&
  result.counts.unknown===0&&result.counts.unreviewed===0&&result.counts.difference===0,
  'G2-D samples must be fully reported before planning candidate questions');
 guard(result.g3Authorized===false&&result.fullYoutubeEditionEquivalenceVerified===false&&
 result.independentReviewerCount===0,'G2-D cannot imply G3 or rights');
 return result;
}
function immutable(plan){
 return {schemaVersion:plan.schemaVersion,kind:plan.kind,datasetId:plan.datasetId,film:plan.film,slot:plan.slot,
  publisherEdition:plan.publisherEdition,provenance:plan.provenance,
  sourceReviewDigest:plan.sourceReviewDigest,sourceReviewStatus:plan.sourceReviewStatus,
  localSource:plan.localSource,
  questions:plan.questions.map(q=>({id:q.id,kind:q.kind,questionDraft:q.questionDraft,
    anchorCheckpointIds:q.anchorCheckpointIds,anchorLocalMs:q.anchorLocalMs,
    requiredModalities:q.requiredModalities,requiredEvidenceCount:q.requiredEvidenceCount})),
  goldIndependentReviewVerified:plan.goldIndependentReviewVerified,realGoldApproved:plan.realGoldApproved,
  g3Authorized:plan.g3Authorized,externalProviderCalls:plan.externalProviderCalls,actualSpendUsd:plan.actualSpendUsd};
}
function planFilm(film,packet,sourceReviewDigest){
 const d=registry();const provenance=d.filmProvenance[film];
 guard(provenance&&/^[a-f0-9]{64}$/.test(sourceReviewDigest),'source private review fingerprint');
 const assessment=sourceAssessment(packet,film);
 guard(packet.local.durationMs===provenance.videoDurationMs&&
   packet.local.captionCueCount===provenance.subtitleCueCount&&
   packet.slot===provenance.slot&&packet.publisherEdition===provenance.publisherEdition,'G2-C local source fidelity');
 const anchors=new Map(packet.checkpoints.map(c=>[c.id,c.localMs]));
 const rows=d.questions.filter(q=>q.film===film).map(q=>{
  guard(q.anchorCheckpointIds.every(id=>anchors.has(id)),'missing local checkpoint');
  return {id:q.id,kind:q.kind,questionDraft:q.questionDraft,
   anchorCheckpointIds:q.anchorCheckpointIds,
   anchorLocalMs:q.anchorCheckpointIds.map(id=>anchors.get(id)),
   requiredModalities:q.requiredModalities,requiredEvidenceCount:q.requiredEvidenceCount,
   finalQuestionText:null,authorCode:null,
   gold:{answerability:null,answerText:null,evidence:[],absenceRationale:null,fullMovieReviewed:false}};
 });
 const result={schemaVersion:1,kind:'G2E_PRIVATE_GOLD_AUTHORING_V01',datasetId:d.registryId,film,slot:provenance.slot,
  publisherEdition:provenance.publisherEdition,provenance:'G2D_OPERATOR_REPORTED_CHECKPOINTS_NOT_FULL_VIDEO_PROOF',
  sourceReviewDigest,sourceReviewStatus:assessment.status,
  localSource:{videoSha256:packet.local.videoSha256,captionSha256:packet.local.captionSha256,
    durationMs:packet.local.durationMs,captionCueCount:packet.local.captionCueCount,
    youtubeTimelineMapping:provenance.youtubeTimelineMapping},
  questions:rows,planDigest:null,goldIndependentReviewVerified:false,realGoldApproved:false,
  g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
 result.planDigest=sha(immutable(result));
 return result;
}
function validatePlan(p){
 strict(p,ROOT_KEYS,'private gold authoring');
 const d=registry(),info=d.filmProvenance[p.film];
 guard(p.schemaVersion===1&&p.kind==='G2E_PRIVATE_GOLD_AUTHORING_V01'&&p.datasetId===d.registryId&&!!info&&
  p.slot===info.slot&&p.publisherEdition===info.publisherEdition,'private source');
 guard(p.provenance==='G2D_OPERATOR_REPORTED_CHECKPOINTS_NOT_FULL_VIDEO_PROOF'&&
  /^[a-f0-9]{64}$/.test(p.sourceReviewDigest),'local human provenance');
 guard(p.sourceReviewStatus===info.g2dStatus,'G2-D reported sample status');
 guard(p.goldIndependentReviewVerified===false&&p.realGoldApproved===false&&
  p.g3Authorized===false&&p.externalProviderCalls===0&&p.actualSpendUsd===0,'forged approval');
 strict(p.localSource,LOCAL_KEYS,'local source');
 guard(p.localSource.durationMs===info.videoDurationMs&&p.localSource.captionCueCount===info.subtitleCueCount&&
 p.localSource.youtubeTimelineMapping===info.youtubeTimelineMapping&&
 /^[a-f0-9]{64}$/.test(p.localSource.videoSha256)&&/^[a-f0-9]{64}$/.test(p.localSource.captionSha256),'local fingerprints');
 guard(p.questions.length===6&&/^[a-f0-9]{64}$/.test(p.planDigest)&&sha(immutable(p))===p.planDigest,'plan modified after generation');
 let complete=0,needsRewrite=0,reviewedFullFilm=0;
 const byType=Object.fromEntries(KINDS.map(kind=>[kind,{planned:0,authored:0,needsRewrite:0}]));
 for(let i=0;i<6;i++){
  const q=p.questions[i],spec=d.questions.filter(x=>x.film===p.film)[i];
  strict(q,Q_KEYS,'private candidate');
  guard(q.id===spec.id&&q.kind===spec.kind&&q.questionDraft===spec.questionDraft&&
    q.requiredEvidenceCount===spec.requiredEvidenceCount,'question identity');
  strict(q.gold,GOLD_KEYS,'gold');
  const g=q.gold;byType[q.kind].planned++;
  guard(g.answerability===null||['SUPPORTED','UNSUPPORTED','AMBIGUOUS'].includes(g.answerability),'answerability enum');
  guard(g.finalApproved===undefined,'cannot approve gold via extra field');
  guard(g.evidence&&Array.isArray(g.evidence)&&g.evidence.length<=10,'evidence list');
  guard(g.fullMovieReviewed===false||g.fullMovieReviewed===true,'whole movie review boolean');
  guard(g.absenceRationale===null||(typeof g.absenceRationale==='string'&&g.absenceRationale.trim().length>=20&&g.absenceRationale.length<=500),'absence rationale');
  const notAuthored=g.answerability===null;
  if(notAuthored){
   guard(q.finalQuestionText===null&&q.authorCode===null&&g.answerText===null&&g.evidence.length===0&&
    g.absenceRationale===null&&g.fullMovieReviewed===false,'unreviewed fields must stay empty');
   continue;
  }
  guard(typeof q.finalQuestionText==='string'&&q.finalQuestionText.trim().length>=18&&q.finalQuestionText.length<=350,'final question');
  guard(typeof q.authorCode==='string'&&/^[A-Z0-9_-]{3,32}$/.test(q.authorCode),'nonidentifying author code');
  if(g.answerability==='AMBIGUOUS'){
   guard(typeof g.answerText==='string'&&g.answerText.trim().length>=12&&g.answerText.length<=600,'ambiguous reason');
   guard(g.evidence.length===0,'ambiguous draft cannot claim supporting evidence');
   needsRewrite++;byType[q.kind].needsRewrite++;continue;
  }
  guard(typeof g.answerText==='string'&&g.answerText.trim().length>=8&&g.answerText.length<=1200,'authored answer');
  if(g.answerability==='UNSUPPORTED'){
   guard(q.kind==='UNSUPPORTED','unsupported answer cannot silently replace supported question');
   guard(g.evidence.length===0&&g.fullMovieReviewed===true&&g.absenceRationale!==null,'unsupported requires whole-film absence review');
   reviewedFullFilm++;
  }else{
   guard(q.kind!=='UNSUPPORTED','unsupported candidate cannot assert positive facts');
   guard(g.evidence.length>=q.requiredEvidenceCount&&g.evidence.length<=10,'minimum grounding evidence');
   guard(g.absenceRationale===null,'supported answer cannot have absence rationale');
   for(const e of g.evidence){
    strict(e,E_KEYS,'evidence');
    guard(q.requiredModalities.includes(e.modality),'wrong modality for question');
    guard(Number.isSafeInteger(e.localStartMs)&&Number.isSafeInteger(e.localEndMs)&&
      e.localStartMs>=0&&e.localEndMs>e.localStartMs&&e.localEndMs<=p.localSource.durationMs,'invalid local evidence bounds');
    guard(e.youtubeObservedMs===null,'unverified YouTube timestamp cannot be gold evidence');
    guard(typeof e.observationNote==='string'&&e.observationNote.trim().length>=18&&
      e.observationNote.length<=500,'human evidence observation required');
   }
   if(q.kind==='TEMPORAL'){
    const ordered=[...g.evidence].sort((a,b)=>a.localStartMs-b.localStartMs);
    guard(ordered[0].localStartMs<ordered[1].localStartMs,'temporal evidence must have distinct ordered events');
   }
  }
  complete++;byType[q.kind].authored++;
 }
 return {stage:'G2-E',status:complete===6&&needsRewrite===0?'OPERATOR_DRAFT_QUESTIONS_ALL_AUTHORED_NOT_VERIFIED':
   'PRIVATE_GOLD_CANDIDATES_IN_PROGRESS',film:p.film,questionCount:6,operatorAuthored:complete,
   notAuthored:6-complete-needsRewrite,needsRewrite,fullFilmAbsenceClaimsReported:reviewedFullFilm,byType,
   localTimelineEvidenceOnly:true,providerApiCalls:0,actualSpendUsd:0,
   independentGoldReviewVerified:false,humanGoldApproved:false,realGoldApproved:false,g3Authorized:false,
   warning:'Human-authored draft answers are not independently reviewed gold labels. Never transmit raw media or answers to a provider without separate approval.'};
}
function run(args){
 if(args.length===0){
  const r=registry();return {stage:'G2-E',status:r.status,pilotQuestionDrafts:r.questions.length,
   g0TargetQuestions:r.fullG0Target.questionCount,filmCount:r.pilot.filmCount,
   pilotCounts:r.pilot.questionKinds,missingCounts:r.remaining.questionKinds,
   goldAnswersVerified:0,externalProviderCalls:0,actualSpendUsd:0,g3Authorized:false};
 }
 if(args.length===7&&args[0]==='plan'&&args[1]==='--film'&&args[3]==='--g2d'&&args[5]==='--out'){
  const out=safeJsonFile(args[6]);const reviewFile=safeJsonFile(args[4],{mustExist:true});
  const src=fs.readFileSync(reviewFile,'utf8');
  const plan=planFilm(args[2],JSON.parse(src),sha(src));
  fs.writeFileSync(out,JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o600});
  return {stage:'G2-E',status:'PRIVATE_QUESTION_AUTHORING_CREATED_UNLABELED',film:plan.film,
   questions:plan.questions.length,privateOutsideGit:true,firstPartyMediaUploaded:false,
   humanGoldApproved:false,providerApiCalls:0,actualSpendUsd:0,g3Authorized:false};
 }
 if(args.length===3&&args[0]==='assess'&&args[1]==='--file'){
  return validatePlan(readJson(args[2]));
 }
 throw Error('G2E_FAIL_CLOSED: use [no args] OR plan --film Sintel|TearsOfSteel --g2d PRIVATE_JSON --out PRIVATE_JSON OR assess --file PRIVATE_JSON');
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(run(process.argv.slice(2)),null,2)+'\n');}
 catch(e){process.stderr.write((String(e.message).startsWith('G2E_FAIL_CLOSED:')?e.message:'G2E_FAIL_CLOSED: invalid private input or source evidence')+'\n');process.exitCode=1;}
}
module.exports={PUBLIC,registry,safeJsonFile,sourceAssessment,planFilm,immutable,validatePlan,run};
