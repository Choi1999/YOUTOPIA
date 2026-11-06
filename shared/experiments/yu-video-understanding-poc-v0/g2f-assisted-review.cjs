'use strict';
// G2-F assisted review: assistant-authored UNVERIFIED answers first, human reviewers verify/edit.
// Different mode from blind G2-F. Seeing the same answer draft disqualifies BLIND review claims.
// Never reads other reviewer reports in a reviewer-facing web process; no external provider API.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const g2e=require('./g2e-gold-pilot.cjs');
const PROPOSALS=path.join(__dirname,'g2f-assisted-proposals.json');
const KIND='G2F_LOCAL_AI_ASSISTED_REVIEW_PACKET',VERSION='YU_VIDEO_G2F_AI_ASSISTED_V01';
const ROOT=['schemaVersion','kind','protocolVersion','film','publisherEdition','reviewerCode','sourceDraftSha256','sourceVideoSha256',
 'sourceCaptionSha256','durationMs','proposalSetId','proposalDigest','questions','templateDigest',
 'goldApproved','g3Authorized','externalProviderCalls','actualSpendUsd'];
const Q=['questionId','questionText','kind','localAnchorMs','aiDraft','review'];
const AI=['proposedVerdict','answerText','evidenceHints','caveat','requiresHumanVerification'];
const HINT=['modality','localStartMs','localEndMs'];
const R=['decision','verdict','answerText','evidence','absenceRationale','fullMovieReviewed','reviewerNote','watchedSource'];
const E=['modality','localStartMs','localEndMs','observationNote'];
const DECISIONS=['PENDING','ACCEPT','EDIT','REJECT','UNCERTAIN'];
function guard(ok,msg){if(!ok)throw Error('G2F_ASSISTED_FAIL_CLOSED: '+msg);}
function strict(x,fields,label){guard(x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).sort().join('|')===fields.slice().sort().join('|'),label+' schema');}
function sha(x){return crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');}
function isHash(s){return typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);}
function note(s,min=18,max=1200){return typeof s==='string'&&s.trim().length>=min&&s.length<=max;}
function safeFile(p,{exists=true}={}){
 guard(typeof p==='string'&&!p.includes('://')&&path.extname(p).toLowerCase()==='.json'&&path.isAbsolute(p),
  'absolute local JSON path');
 const file=g2e.safeJsonFile(p,{mustExist:exists});
 return file;
}
function proposalRegistry(){
 const data=JSON.parse(fs.readFileSync(PROPOSALS,'utf8'));
 strict(data,['schemaVersion','proposalSetId','status','created','generatedBy','realFilmDirectlyInspected','reliesOn','scope',
  'filmRightsForServiceVerified','g3Authorized','externalCalls','actualSpendUsd','drafts'],'AI public draft registry');
 guard(data.schemaVersion===1&&data.proposalSetId==='YU_VIDEO_G2F_ASSISTED_EDITORIAL_DRAFT_V01'&&
 data.status==='AI_ASSISTED_UNVERIFIED_CANDIDATES_NOT_HUMAN_GOLD'&&data.realFilmDirectlyInspected===false&&
 data.filmRightsForServiceVerified===false&&data.g3Authorized===false&&
 data.externalCalls===0&&data.actualSpendUsd===0,'AI proposals must remain not verified');
 guard(Array.isArray(data.drafts)&&data.drafts.length===12,'12 AI editorial draft questions');
 const seen=new Set();
 for(const q of data.drafts){
  strict(q,['questionId','film','kind','proposedVerdict','answerText','evidenceHints','caveat','requiresHumanVerification'],'AI draft');
  guard(!seen.has(q.questionId)&&/^G2E-(SIN|TOS)-0[1-6]$/.test(q.questionId),'AI draft unique ID');
  seen.add(q.questionId);
  guard((q.film==='Sintel'||q.film==='TearsOfSteel')&&
   q.questionId.startsWith(q.film==='Sintel'?'G2E-SIN-':'G2E-TOS-'),'AI draft film');
  guard(['SPEECH','VISUAL','TEMPORAL','UNSUPPORTED'].includes(q.kind),'AI draft kind');
  guard(q.proposedVerdict===(q.kind==='UNSUPPORTED'?'UNSUPPORTED':'SUPPORTED'),'AI suggestion status');
  guard(note(q.answerText,12)&&note(q.caveat,20,700)&&q.requiresHumanVerification===true,'unverified AI text');
  guard(Array.isArray(q.evidenceHints)&&q.evidenceHints.length===(q.kind==='UNSUPPORTED'?0:q.kind==='TEMPORAL'?2:1),
   'AI evidence hint count');
  for(const e of q.evidenceHints){
   strict(e,HINT,'AI evidence hint');
   guard(['AUDIO','TRANSCRIPT','FRAME'].includes(e.modality)&&
    Number.isSafeInteger(e.localStartMs)&&Number.isSafeInteger(e.localEndMs)&&
    e.localEndMs>e.localStartMs&&e.localStartMs>=0,'AI timing shape');
  }
 }
 return data;
}
function sourceDraft(file){
 const p=safeFile(file),raw=fs.readFileSync(p,'utf8'),author=JSON.parse(raw);
 const check=g2e.validatePlan(author);
 guard(check.operatorAuthored===6&&check.needsRewrite===0&&check.notAuthored===0,'G2-E source drafts incomplete');
 guard(check.humanGoldApproved===false&&check.g3Authorized===false,'source approval remains blocked');
 return {author,sourceDraftSha256:sha(raw)};
}
function immutable(p){
 return {schemaVersion:p.schemaVersion,kind:p.kind,protocolVersion:p.protocolVersion,
  film:p.film,publisherEdition:p.publisherEdition,reviewerCode:p.reviewerCode,
  sourceDraftSha256:p.sourceDraftSha256,sourceVideoSha256:p.sourceVideoSha256,
  sourceCaptionSha256:p.sourceCaptionSha256,durationMs:p.durationMs,
  proposalSetId:p.proposalSetId,proposalDigest:p.proposalDigest,
  questions:p.questions.map(q=>({questionId:q.questionId,questionText:q.questionText,kind:q.kind,
   localAnchorMs:q.localAnchorMs,aiDraft:q.aiDraft})),
  goldApproved:p.goldApproved,g3Authorized:p.g3Authorized,
  externalProviderCalls:p.externalProviderCalls,actualSpendUsd:p.actualSpendUsd};
}
function plan(authorFile,reviewerCode,dest){
 guard(/^[A-Z0-9_-]{3,32}$/.test(reviewerCode||''),'reviewer code');
 const {author,sourceDraftSha256}=sourceDraft(authorFile);
 guard(!author.questions.some(q=>q.authorCode===reviewerCode),'operator cannot be separate reviewer');
 const registry=proposalRegistry(),map=new Map(registry.drafts.map(q=>[q.questionId,q]));
 const file=safeFile(dest,{exists:false});
 const questions=author.questions.map(q=>{
  const ai=map.get(q.id);
  guard(ai&&ai.film===author.film&&ai.kind===q.kind,'AI proposal missing or mismatched');
  for(const hint of ai.evidenceHints){
   guard(hint.localEndMs<=author.localSource.durationMs,'proposal time outside original film');
  }
  return {questionId:q.id,questionText:q.finalQuestionText,kind:q.kind,
   localAnchorMs:[...q.anchorLocalMs],
   aiDraft:{proposedVerdict:ai.proposedVerdict,answerText:ai.answerText,evidenceHints:ai.evidenceHints,
    caveat:ai.caveat,requiresHumanVerification:true},
   review:{decision:'PENDING',verdict:null,answerText:null,evidence:[],absenceRationale:null,
    fullMovieReviewed:false,reviewerNote:null,watchedSource:false}};
 });
 const p={schemaVersion:1,kind:KIND,protocolVersion:VERSION,film:author.film,publisherEdition:author.publisherEdition,
  reviewerCode,sourceDraftSha256,sourceVideoSha256:author.localSource.videoSha256,
  sourceCaptionSha256:author.localSource.captionSha256,durationMs:author.localSource.durationMs,
  proposalSetId:registry.proposalSetId,proposalDigest:sha(registry.drafts.filter(x=>x.film===author.film)),
  questions,templateDigest:null,goldApproved:false,g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
 p.templateDigest=sha(immutable(p));
 fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n',{flag:'wx',mode:0o600});
 return {stage:'G2-F',status:'AI_ASSISTED_REVIEW_DRAFT_CREATED_UNVERIFIED',film:author.film,reviewerCode,
  questionCount:6,proposedByAssistant:6,humanReviewed:0,
  previousBlindPacketsUnchanged:true,goldApproved:false,g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
}
function validate(p){
 strict(p,ROOT,'assisted packet');
 guard(p.schemaVersion===1&&p.kind===KIND&&p.protocolVersion===VERSION&&
  ['Sintel','TearsOfSteel'].includes(p.film),'assisted version');
 guard(/^[A-Z0-9_-]{3,32}$/.test(p.reviewerCode||'')&&note(p.publisherEdition,8,80),'reviewer and source');
 for(const key of ['sourceDraftSha256','sourceVideoSha256','sourceCaptionSha256','proposalDigest','templateDigest']){
  guard(isHash(p[key]),key+' hash');
 }
 guard(Number.isSafeInteger(p.durationMs)&&p.durationMs>100000&&p.durationMs<36000000,'source duration');
 guard(p.goldApproved===false&&p.g3Authorized===false&&p.externalProviderCalls===0&&p.actualSpendUsd===0,'approvals denied');
 guard(sha(immutable(p))===p.templateDigest,'AI draft or question/film metadata modified');
 const registry=proposalRegistry();
 guard(p.proposalSetId===registry.proposalSetId,'AI proposal registry identity');
 guard(p.proposalDigest===sha(registry.drafts.filter(x=>x.film===p.film)),'published AI proposal changed');
 guard(Array.isArray(p.questions)&&p.questions.length===6,'6 review questions');
 let reviewed=0,accepted=0,edited=0,rejected=0,uncertain=0,pending=0;
 const seen=new Set();
 for(const q of p.questions){
  strict(q,Q,'review question');
  guard(/^G2E-(SIN|TOS)-0[1-6]$/.test(q.questionId)&&!seen.has(q.questionId),'question ID');
  seen.add(q.questionId);
  guard(q.questionId.startsWith(p.film==='Sintel'?'G2E-SIN-':'G2E-TOS-'),'question film');
  guard(['SPEECH','VISUAL','TEMPORAL','UNSUPPORTED'].includes(q.kind)&&note(q.questionText,18,350),'question type/text');
  guard(Array.isArray(q.localAnchorMs)&&q.localAnchorMs.length===(q.kind==='UNSUPPORTED'?0:q.kind==='TEMPORAL'?2:1)&&
   q.localAnchorMs.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=p.durationMs),'source local anchors');
  strict(q.aiDraft,AI,'AI draft');
  guard(q.aiDraft.requiresHumanVerification===true,'AI evidence cannot be auto verified');
  strict(q.review,R,'review response');
  const v=q.review;
  guard(DECISIONS.includes(v.decision)&&
   (v.verdict===null||['SUPPORTED','UNSUPPORTED','AMBIGUOUS'].includes(v.verdict)),'review verdict and decision');
  guard(v.fullMovieReviewed===true||v.fullMovieReviewed===false,'full movie flag');
  guard(v.watchedSource===true||v.watchedSource===false,'source viewing flag');
  guard(Array.isArray(v.evidence)&&v.evidence.length<=10,'evidence');
  guard(v.absenceRationale===null||note(v.absenceRationale,20,500),'absence rationale');
  guard(v.reviewerNote===null||note(v.reviewerNote,18,1000),'review note');
  if(v.decision==='PENDING'){
   guard(v.verdict===null&&v.answerText===null&&v.evidence.length===0&&
    v.absenceRationale===null&&v.fullMovieReviewed===false&&v.reviewerNote===null&&v.watchedSource===false,
    'unreviewed fields must stay blank');
   pending++;continue;
  }
  guard(v.watchedSource===true,'human must explicitly confirm actual local film inspected');
  if(v.decision==='REJECT'||v.decision==='UNCERTAIN'){
   guard(v.verdict==='AMBIGUOUS'&&v.answerText===null&&v.evidence.length===0&&
     v.absenceRationale===null&&v.fullMovieReviewed===false&&note(v.reviewerNote,20,1000),
     'reject/uncertain requires reason, no automatic positive answer');
   if(v.decision==='REJECT')rejected++;else uncertain++;
   reviewed++;continue;
  }
  guard(v.verdict===q.aiDraft.proposedVerdict||v.decision==='EDIT','change of answerability must be EDIT');
  guard(typeof v.answerText==='string'&&note(v.answerText,8,1200),'human-reviewed answer text');
  if(v.decision==='ACCEPT'){
   guard(v.answerText===q.aiDraft.answerText&&v.verdict===q.aiDraft.proposedVerdict,
    'ACCEPT cannot silently rewrite AI proposal; use EDIT');
   accepted++;
  }else{
   guard(v.answerText!==q.aiDraft.answerText||v.verdict!==q.aiDraft.proposedVerdict||
    (v.reviewerNote!==null&&v.reviewerNote.trim().length>=20),'EDIT must describe material correction');
   edited++;
  }
  if(v.verdict==='UNSUPPORTED'){
   guard(v.evidence.length===0&&v.fullMovieReviewed===true&&v.absenceRationale!==null,
     'unsupported requires full original film review and absence rationale');
  }else if(v.verdict==='SUPPORTED'){
   guard(v.fullMovieReviewed===false&&v.absenceRationale===null&&
    v.evidence.length>=Math.max(1,q.localAnchorMs.length),'supported requires human-checked evidence ranges');
   for(const e of v.evidence){
    strict(e,E,'human evidence');
    const allowed=q.kind==='SPEECH'?['AUDIO','TRANSCRIPT']:q.kind==='VISUAL'||q.kind==='TEMPORAL'?['FRAME']:[];
    guard(allowed.includes(e.modality)&&Number.isSafeInteger(e.localStartMs)&&Number.isSafeInteger(e.localEndMs)&&
      e.localEndMs>e.localStartMs&&e.localStartMs>=0&&e.localEndMs<=p.durationMs&&note(e.observationNote,18,500),
      'source evidence invalid modality, timing or observation');
   }
   for(const anchor of q.localAnchorMs){
    const tolerance=q.kind==='SPEECH'?15000:30000;
    guard(v.evidence.some(e=>e.localStartMs<=anchor+tolerance&&e.localEndMs>=anchor-tolerance),
     'human evidence must support local question anchor');
   }
   if(q.kind==='TEMPORAL'){
    guard(v.evidence.length>=2&&v.evidence[0].localStartMs!==v.evidence[1].localStartMs,
     'temporal events must be different observations');
   }
  }else guard(false,'positive review cannot claim ambiguous answer');
  reviewed++;
 }
 return {stage:'G2-F',status:pending>0?'AI_ASSISTED_REVIEW_IN_PROGRESS':
  (rejected+uncertain)>0?'AI_ASSISTED_HUMAN_REVIEW_COMPLETED_WITH_OPEN_ISSUES':
  'AI_ASSISTED_HUMAN_REVIEW_SUBMITTED_PENDING_ADJUDICATION',
  film:p.film,reviewerCode:p.reviewerCode,questionCount:6,humanReviewed:reviewed,
  accepted,edited,rejected,uncertain,pending,reviewerSawAiSuggestedAnswers:true,
  blindIndependentReview:false,verifiedIndependentReviewerCount:0,
  goldApproved:false,g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
}
function read(file){const raw=fs.readFileSync(safeFile(file),'utf8');return {packet:JSON.parse(raw),sha:sha(raw)};}
function assess(authorPath,aPath,bPath){
 const {author,sourceDraftSha256}=sourceDraft(authorPath);
 const a=read(aPath).packet,b=read(bPath).packet,sa=validate(a),sb=validate(b);
 guard(a.film===author.film&&b.film===author.film&&a.reviewerCode!==b.reviewerCode,'two distinct reviewers same film');
 for(const packet of [a,b]){
  guard(packet.sourceDraftSha256===sourceDraftSha256&&packet.sourceVideoSha256===author.localSource.videoSha256&&
    packet.sourceCaptionSha256===author.localSource.captionSha256&&packet.durationMs===author.localSource.durationMs,
    'original source changed or wrong edition');
  guard(packet.questions.every((q,i)=>q.questionId===author.questions[i].id&&
   q.questionText===author.questions[i].finalQuestionText&&
   JSON.stringify(q.localAnchorMs)===JSON.stringify(author.questions[i].anchorLocalMs)),'question changed');
 }
 const flags=[];let agreements=0,disagreements=0;
 for(let i=0;i<6;i++){
  const x=a.questions[i],y=b.questions[i],id=x.questionId;
  if(x.review.decision==='PENDING'||y.review.decision==='PENDING'){flags.push({questionId:id,reason:'REVIEW_PENDING'});continue;}
  if(x.review.verdict!==y.review.verdict){disagreements++;flags.push({questionId:id,reason:'REVIEWER_VERDICT_CONFLICT'});}
  else agreements++;
  if(x.review.decision==='EDIT'||y.review.decision==='EDIT')flags.push({questionId:id,reason:'EDITED_AI_PROPOSAL_REQUIRES_ADJUDICATION'});
  if(x.review.decision==='REJECT'||y.review.decision==='REJECT'||x.review.decision==='UNCERTAIN'||y.review.decision==='UNCERTAIN')
   flags.push({questionId:id,reason:'REJECTED_OR_UNCERTAIN_PROPOSAL'});
 }
 return {stage:'G2-F',status:sa.pending+sb.pending>0?'AI_ASSISTED_PAIR_IN_PROGRESS':'TWO_AI_ASSISTED_REVIEW_REPORTS_SUBMITTED_PENDING_HUMAN_ADJUDICATION',
  film:author.film,reviewerASummary:sa,reviewerBSummary:sb,
  reviewerVerdictAgreements:agreements,reviewerVerdictDisagreements:disagreements,
  flaggedQuestions:flags,questionCount:6,blindReviewCount:0,independentGoldApproved:0,
  modelQualityVerified:false,filmRightsForServiceVerified:false,g3Authorized:false,
  externalProviderCalls:0,actualSpendUsd:0,
  warning:'These reviewers were exposed to AI drafts, not blinded. No automatic gold approval or G3 authorization.'};
}
function run(args){
 if(args.length===0){
  const p=proposalRegistry();
  return {stage:'G2-F',status:'AI_ASSISTED_DRAFTS_UNVERIFIED',drafts:p.drafts.length,goldApproved:false,
   blindReview:false,g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
 }
 if(args.length===7&&args[0]==='plan'&&args[1]==='--author'&&args[3]==='--reviewer'&&args[5]==='--out')
  return plan(args[2],args[4],args[6]);
 if(args.length===3&&args[0]==='check'&&args[1]==='--file')return validate(read(args[2]).packet);
 if(args.length===7&&args[0]==='assess'&&args[1]==='--author'&&args[3]==='--review-a'&&args[5]==='--review-b')
  return assess(args[2],args[4],args[6]);
 throw Error('G2F_ASSISTED_FAIL_CLOSED: use [none] or plan --author LOCAL_JSON --reviewer CODE --out LOCAL_JSON or check --file JSON or assess --author JSON --review-a JSON --review-b JSON');
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(run(process.argv.slice(2)),null,2)+'\n');}
 catch(e){process.stderr.write((e.message?.startsWith('G2F_ASSISTED_FAIL_CLOSED:')?e.message:'G2F_ASSISTED_FAIL_CLOSED: invalid local draft/packet')+'\n');process.exitCode=1;}
}
module.exports={KIND,PROPOSALS,proposalRegistry,sourceDraft,immutable,plan,validate,assess,run};
