'use strict';
// Presentation-only AI draft suggestions for operator G2-G adjudication.
// All film/answer claims are UNVERIFIED, sourced from earlier AI-assisted G2-F drafts.
// The user's saved G2-G operator decisions always take precedence. No automatic Gold/G3 approval.
const catalog=require('./g2g-adjudication-proposals.json');
const g2f=require('./g2f-assisted-review.cjs');
const scenes=require('./g2f-assisted-observation-drafts.json');
function guard(ok,label){if(!ok)throw Error('G2G_AI_DRAFT_FAIL_CLOSED: '+label);}
function exact(x,fields,label){
 guard(x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).sort().join('|')===fields.slice().sort().join('|'),label+' schema');
}
function suggestions(film,questions){
 guard(film==='Sintel'||film==='TearsOfSteel','film');
 guard(Array.isArray(questions)&&questions.length===6,'six immutable operator questions');
 exact(catalog,['schemaVersion','id','status','videoPersonallyWatchedByAssistant','priorReviewerExposure',
  'operatorDecisionsAlreadyGranted','independentBlindGoldApproved','g3Authorized',
  'externalProviderCalls','actualSpendUsd','items'],'operator AI draft registry');
 guard(catalog.schemaVersion===1&&catalog.id==='YU_VIDEO_G2G_AI_OPERATOR_DRAFTS_V01'&&
  catalog.status==='AI_CANDIDATE_ONLY_NOT_OPERATOR_DECISIONS'&&
  catalog.videoPersonallyWatchedByAssistant===false&&
  catalog.operatorDecisionsAlreadyGranted===0&&catalog.independentBlindGoldApproved===0&&
  catalog.g3Authorized===false&&catalog.externalProviderCalls===0&&catalog.actualSpendUsd===0,
  'AI editorial proposals cannot be approved source evidence');
 guard(Array.isArray(catalog.items)&&catalog.items.length===12,'12 AI status/rationale proposals');
 guard(scenes.schemaVersion===1&&scenes.videoPersonallyWatchedByAssistant===false&&
  scenes.humanReviewed===false&&scenes.approvedGold===false&&
  Array.isArray(scenes.notes)&&scenes.notes.length===12,
  'scene evidence must remain AI-authored unverified candidate');
 const ai=g2f.proposalRegistry();
 const proposed=new Map(),source=new Map(),notes=new Map();
 for(const p of catalog.items){
  exact(p,['questionId','film','proposedStatus','rationale'],'operator decision draft');
  guard(typeof p.questionId==='string'&&
   p.questionId.startsWith(p.film==='Sintel'?'G2E-SIN-':'G2E-TOS-')&&
   ['APPROVE','REVISE','HOLD'].includes(p.proposedStatus)&&
   typeof p.rationale==='string'&&p.rationale.trim().length>=20&&p.rationale.length<=1200,
   'AI proposed status or reason');
  guard(!proposed.has(p.questionId),'unique status proposal');
  proposed.set(p.questionId,p);
 }
 for(const p of ai.drafts){
  guard(!source.has(p.questionId),'unique AI answer proposal');
  source.set(p.questionId,p);
 }
 for(const p of scenes.notes){
  guard(!notes.has(p.questionId),'unique AI observation proposal');
  notes.set(p.questionId,p);
 }
 const result={};
 for(const q of questions){
  const draft=proposed.get(q.questionId),answer=source.get(q.questionId),observation=notes.get(q.questionId);
  guard(draft&&answer&&observation&&draft.film===film&&answer.film===film,
   'matching film/question/answer proposal required');
  guard(q.kind===answer.kind&&q.questionId===draft.questionId&&
   Array.isArray(q.localAnchorMs)&&
   (q.kind==='UNSUPPORTED'?q.localAnchorMs.length===0:
    q.kind==='TEMPORAL'?q.localAnchorMs.length===2:q.localAnchorMs.length===1),
   'immutable operator question scope');
  guard(Array.isArray(observation.evidenceNotes)&&
   answer.evidenceHints.length===observation.evidenceNotes.length,'observation and source count');
  const evidence=answer.evidenceHints.map((x,i)=>{
   guard(typeof observation.evidenceNotes[i]==='string'&&
    observation.evidenceNotes[i].trim().length>=18,'human-readable observation draft');
   guard(Number.isSafeInteger(x.localStartMs)&&Number.isSafeInteger(x.localEndMs)&&
    x.localStartMs>=0&&x.localEndMs>x.localStartMs,
    'candidate local film timing');
   return {modality:x.modality,localStartMs:x.localStartMs,
    localEndMs:x.localEndMs,observationNote:observation.evidenceNotes[i]};
  });
  guard((q.kind==='UNSUPPORTED')===
   (typeof observation.absenceRationale==='string'&&observation.absenceRationale.length>=20),
   'UNSUPPORTED AI absence candidate');
  result[q.questionId]={
   proposedStatus:draft.proposedStatus,
   finalVerdict:answer.proposedVerdict,
   finalAnswerText:answer.answerText,
   finalEvidence:evidence,
   absenceRationale:observation.absenceRationale,
   rationale:draft.rationale,
   selectedBasis:'CUSTOM',
   fromAiDraft:true,
   operatorConfirmed:false
  };
 }
 return result;
}
module.exports={suggestions};
