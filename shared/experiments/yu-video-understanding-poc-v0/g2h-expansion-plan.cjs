'use strict';
// G2-H public dataset expansion DESIGN only; no media, rights, answers, Gold, network or G3.
const fs=require('node:fs');
const path=require('node:path');
const PLAN=path.join(__dirname,'g2h-expansion-blueprint.json');
const G2B=path.join(__dirname,'g2b-public-candidates.json');
const G2E=path.join(__dirname,'g2e-question-candidates.json');
const TYPES=['SPEECH','VISUAL','OCR','TEMPORAL','UNSUPPORTED'];
const EXPECTED={
 'SYNTH-VID-01':{category:'INTERVIEW',counts:{SPEECH:3,VISUAL:1,OCR:0,TEMPORAL:1,UNSUPPORTED:1}},
 'SYNTH-VID-02':{category:'INTERVIEW',counts:{SPEECH:3,VISUAL:1,OCR:0,TEMPORAL:1,UNSUPPORTED:1}},
 'SYNTH-VID-03':{category:'SCREENCAST',counts:{SPEECH:1,VISUAL:1,OCR:3,TEMPORAL:1,UNSUPPORTED:0}},
 'SYNTH-VID-04':{category:'SCREENCAST',counts:{SPEECH:1,VISUAL:1,OCR:3,TEMPORAL:0,UNSUPPORTED:1}}
};
const MODALITIES={SPEECH:['AUDIO','TRANSCRIPT'],VISUAL:['FRAME'],OCR:['FRAME','OCR'],TEMPORAL:['FRAME','AUDIO'],UNSUPPORTED:[]};
function gate(ok,msg){if(!ok)throw Error('G2H_BLUEPRINT_FAIL_CLOSED: '+msg);}
function strict(o,names,label){gate(o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join('|')===names.slice().sort().join('|'),label+' schema');}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function counts(rows){
 const r=Object.fromEntries(TYPES.map(t=>[t,0]));
 for(const q of rows){gate(TYPES.includes(q.kind),'invalid question category');r[q.kind]++;}
 return r;
}
function validate(p,b,e){
 strict(p,['schemaVersion','registryId','documentedAt','status','baselineContract','usesPriorEvidence','existingPilot',
  'target','extension','authorizedMediaDownloaded','approvedForMediaIngestion','rightsClearedCount',
  'independentBlindGoldApproved','modelQualityVerified','g3Authorized','externalProviderCalls',
  'actualSpendUsd','entries'],'root');
 gate(p.schemaVersion===1&&p.registryId==='YU_VIDEO_G2H_DATASET_EXPANSION_BLUEPRINT_V01'&&
  p.documentedAt==='2026-11-09'&&p.status==='DESIGN_ONLY_UNSELECTED_UNVERIFIED'&&
  p.baselineContract==='G0_6_FILMS_36_QUESTIONS_UNCHANGED'&&
  p.usesPriorEvidence==='G2B_NASA_RESEARCH_CANDIDATES_AND_G2E_2_FILM_PILOT_COUNTS',
  'identity/contract must be fixed');
 gate(p.authorizedMediaDownloaded===false&&p.approvedForMediaIngestion===false&&p.rightsClearedCount===0&&
  p.independentBlindGoldApproved===0&&p.modelQualityVerified===false&&p.g3Authorized===false&&
  p.externalProviderCalls===0&&p.actualSpendUsd===0,'cannot authorize rights, media, Gold or G3');
 gate(b.schemaVersion===1&&Array.isArray(b.candidates)&&b.candidates.length===6&&
  e.schemaVersion===1,'G2-B and G2-E public research inputs');
 for(const [key,allowedGenres] of [['target',['INTERVIEW','SCREENCAST','ACTION']],['extension',['INTERVIEW','SCREENCAST']]]){
  const o=p[key];strict(o,['filmCount','questionCount','genres','questionKinds'],key);
  strict(o.genres,allowedGenres,key+' genres');strict(o.questionKinds,TYPES,key+' kinds');
 }
 strict(p.existingPilot,['filmCount','questionCount','operatorAdjudicatedApproved',
  'operatorAdjudicatedHeld','independentBlindGoldApproved'],'prior pilot');
 gate(same(p.target,e.fullG0Target)&&same(p.extension,e.remaining)&&
  p.existingPilot.filmCount===e.pilot.filmCount&&
  p.existingPilot.questionCount===e.pilot.questionCount&&
  p.existingPilot.operatorAdjudicatedApproved===10&&
  p.existingPilot.operatorAdjudicatedHeld===2&&
  p.existingPilot.independentBlindGoldApproved===0,'G0/G2-E scope or user-reported pilot count changed');
 const totals={...e.pilot.questionKinds};
 for(const [k,v] of Object.entries(p.extension.questionKinds))totals[k]=(totals[k]||0)+v;
 gate(same(totals,p.target.questionKinds)&&
  p.target.filmCount===p.existingPilot.filmCount+p.extension.filmCount&&
  p.target.questionCount===p.existingPilot.questionCount+p.extension.questionCount&&
  p.extension.filmCount===4&&p.extension.questionCount===24,'36-question accounting');
 gate(Array.isArray(p.entries)&&p.entries.length===4,'exactly 4 extension candidates');
 const canon=new Map(b.candidates.map(x=>[x.slot,x]));
 const seen=new Set(),questionIds=new Set(),questions=[],genreCounts={INTERVIEW:0,SCREENCAST:0};
 for(const item of p.entries){
  strict(item,['slot','category','candidateTitle','officialSource','candidateEvidence','sourceStatus',
    'rightsStatus','youtubeEditionStatus','captionAlignmentStatus','realDurationMs',
    'authorizedLocalVideoSha256','authorizedLocalCaptionSha256','independentBlindLabelerCount',
    'operatorAdjudicationApproved','g3Ready','blockingEvidence','questionBlueprints'],'slot');
  const ref=canon.get(item.slot),target=EXPECTED[item.slot];
  gate(ref&&target&&!seen.has(item.slot),'unknown/duplicated slot');
  seen.add(item.slot);
  gate(item.category===target.category&&ref.category===target.category&&item.officialSource===ref.primarySource&&
    typeof item.candidateTitle==='string'&&item.candidateTitle.length>=12&&
    typeof item.candidateEvidence==='string'&&item.candidateEvidence.length>=20,
    'candidate source/category mismatch');
  gate(item.sourceStatus==='RESEARCH_CANDIDATE_NOT_DATASET'&&
    item.rightsStatus==='UNVERIFIED_FOR_YOUTOPIA'&&
    item.youtubeEditionStatus==='UNVERIFIED_NO_MEDIA_COMPARISON'&&
    item.captionAlignmentStatus==='UNVERIFIED_NO_CAPTION_COMPARISON'&&
    item.realDurationMs===null&&item.authorizedLocalVideoSha256===null&&
    item.authorizedLocalCaptionSha256===null&&item.independentBlindLabelerCount===0&&
    item.operatorAdjudicationApproved===false&&item.g3Ready===false,
    'source, rights, captions, Gold or G3 spuriously promoted');
  gate(Array.isArray(item.blockingEvidence)&&item.blockingEvidence.length>=4&&
    item.blockingEvidence.every(x=>typeof x==='string'&&/^[A-Z0-9_]{12,100}$/.test(x))&&
    new Set(item.blockingEvidence).size===item.blockingEvidence.length,
    'expected open blockers');
  gate(Array.isArray(item.questionBlueprints)&&item.questionBlueprints.length===6,
    'must be exactly six questions per film');
  for(let i=0;i<item.questionBlueprints.length;i++){
   const q=item.questionBlueprints[i];
   strict(q,['id','kind','promptDesign','requiredModalities','minimumEvidenceSegments',
     'requiresWholeVideoAbsenceCheck','answerability','answerText','anchorLocalMs','evidence',
     'candidateStatus','independentBlindGoldApproved'],'question blueprint');
   const expectedId='G2H-'+item.slot.slice(-2)+'-'+String(i+1).padStart(2,'0');
   gate(q.id===expectedId&&!questionIds.has(q.id),'unique question ID');
   questionIds.add(q.id);
   gate(TYPES.includes(q.kind)&&typeof q.promptDesign==='string'&&q.promptDesign.trim().length>=25&&
    q.promptDesign.length<=300&&same(q.requiredModalities,MODALITIES[q.kind])&&
    q.minimumEvidenceSegments===(q.kind==='TEMPORAL'?2:q.kind==='UNSUPPORTED'?0:1)&&
    q.requiresWholeVideoAbsenceCheck===(q.kind==='UNSUPPORTED'),
    'evidence type/count or question template quality');
   gate(q.answerability===null&&q.answerText===null&&q.anchorLocalMs===null&&
    Array.isArray(q.evidence)&&q.evidence.length===0&&
    q.candidateStatus==='QUESTION_TEMPLATE_NOT_REAL_MEDIA_OBSERVED'&&
    q.independentBlindGoldApproved===false,'fabricated answer, timestamps or Gold');
   questions.push(q);
  }
  gate(same(counts(item.questionBlueprints),target.counts),'per-film six-question distribution');
  genreCounts[item.category]++;
 }
 gate(same(genreCounts,{INTERVIEW:2,SCREENCAST:2})&&
  seen.size===4&&questionIds.size===24&&same(counts(questions),p.extension.questionKinds),
  '24-question/genre plan not balanced');
 return {
  stage:'G2-H',status:'DESIGN_ONLY_4_FILMS_24_QUESTION_BLUEPRINTS_NO_G3',
  targetFilms:p.target.filmCount,targetQuestions:p.target.questionCount,
  existingPilotQuestions:p.existingPilot.questionCount,
  existingPilotOperatorApproved:p.existingPilot.operatorAdjudicatedApproved,
  existingPilotOperatorHeld:p.existingPilot.operatorAdjudicatedHeld,
  plannedNewFilms:p.entries.length,plannedNewQuestionTemplates:questions.length,
  plannedKinds:counts(questions),rightsApproved:0,
  mediaIngestionAuthorized:false,independentBlindGoldApproved:0,
  g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0
 };
}
function inspect(){
 return validate(JSON.parse(fs.readFileSync(PLAN,'utf8')),
  JSON.parse(fs.readFileSync(G2B,'utf8')),
  JSON.parse(fs.readFileSync(G2E,'utf8')));
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(inspect(),null,2)+'\n');}
 catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
}
module.exports={PLAN,TYPES,EXPECTED,MODALITIES,counts,validate,inspect};
