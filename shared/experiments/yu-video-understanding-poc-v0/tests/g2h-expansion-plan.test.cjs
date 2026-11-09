'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const planner=require('../g2h-expansion-plan.cjs');
const origin=()=>JSON.parse(fs.readFileSync(path.join(root,'g2h-expansion-blueprint.json'),'utf8'));
const g2b=()=>JSON.parse(fs.readFileSync(path.join(root,'g2b-public-candidates.json'),'utf8'));
const g2e=()=>JSON.parse(fs.readFileSync(path.join(root,'g2e-question-candidates.json'),'utf8'));
const audit=(doc)=>planner.validate(doc,g2b(),g2e());
test('G2-H canonical design balances 2 existing and 4 proposed films across exactly 36 questions',()=>{
 const out=planner.inspect(),p=origin();
 assert.equal(out.stage,'G2-H');
 assert.equal(out.status,'DESIGN_ONLY_4_FILMS_24_QUESTION_BLUEPRINTS_NO_G3');
 assert.equal(out.targetFilms,6);
 assert.equal(out.targetQuestions,36);
 assert.equal(out.existingPilotQuestions,12);
 assert.equal(out.existingPilotOperatorApproved,10);
 assert.equal(out.existingPilotOperatorHeld,2);
 assert.equal(out.plannedNewFilms,4);
 assert.equal(out.plannedNewQuestionTemplates,24);
 assert.deepEqual(out.plannedKinds,{SPEECH:8,VISUAL:4,OCR:6,TEMPORAL:3,UNSUPPORTED:3});
 assert.deepEqual(p.target.questionKinds,{SPEECH:12,VISUAL:8,OCR:6,TEMPORAL:5,UNSUPPORTED:5});
 assert.equal(out.rightsApproved,0);
 assert.equal(out.independentBlindGoldApproved,0);
 assert.equal(out.g3Authorized,false);
 assert.equal(out.externalProviderCalls,0);
 assert.equal(out.actualSpendUsd,0);
});
test('G2-H per-slot category allocation and all questions are templates not real observed facts',()=>{
 const p=origin(),expected={
  'SYNTH-VID-01':{SPEECH:3,VISUAL:1,OCR:0,TEMPORAL:1,UNSUPPORTED:1},
  'SYNTH-VID-02':{SPEECH:3,VISUAL:1,OCR:0,TEMPORAL:1,UNSUPPORTED:1},
  'SYNTH-VID-03':{SPEECH:1,VISUAL:1,OCR:3,TEMPORAL:1,UNSUPPORTED:0},
  'SYNTH-VID-04':{SPEECH:1,VISUAL:1,OCR:3,TEMPORAL:0,UNSUPPORTED:1}
 };
 for(const slot of p.entries){
  assert.deepEqual(planner.counts(slot.questionBlueprints),expected[slot.slot]);
  assert.equal(slot.questionBlueprints.length,6);
  assert.equal(slot.realDurationMs,null);
  assert.equal(slot.rightsStatus,'UNVERIFIED_FOR_YOUTOPIA');
  assert.equal(slot.sourceStatus,'RESEARCH_CANDIDATE_NOT_DATASET');
  for(const q of slot.questionBlueprints){
   assert.equal(q.answerability,null);
   assert.equal(q.answerText,null);
   assert.equal(q.anchorLocalMs,null);
   assert.deepEqual(q.evidence,[]);
   assert.equal(q.independentBlindGoldApproved,false);
  }
 }
});
test('G2-H no premature approval for media/rights/Gold/G3 or paid calls',()=>{
 const cases=[
  ['rightsClearedCount',1],['independentBlindGoldApproved',1],['g3Authorized',true],
  ['externalProviderCalls',1],['actualSpendUsd',0.01],['authorizedMediaDownloaded',true],
  ['approvedForMediaIngestion',true],['modelQualityVerified',true]
 ];
 for(const [key,val] of cases){const x=origin();x[key]=val;assert.throws(()=>audit(x),/G2H_BLUEPRINT_FAIL_CLOSED/);}
 for(const [key,val] of [['g3Ready',true],['operatorAdjudicationApproved',true],
  ['realDurationMs',555000],['authorizedLocalVideoSha256','a'.repeat(64)],
  ['independentBlindLabelerCount',2]]){
  const x=origin();x.entries[0][key]=val;assert.throws(()=>audit(x),/G2H_BLUEPRINT_FAIL_CLOSED/);
 }
});
test('G2-H refuses fabricated answer, time evidence, category or original question contract drift',()=>{
 const changes=[
  q=>{q.answerText='Fabricated unseen speech content';},
  q=>{q.answerability='SUPPORTED';},
  q=>{q.anchorLocalMs=[5000,6500];},
  q=>{q.evidence=[{localStartMs:1000,localEndMs:3000}];},
  q=>{q.independentBlindGoldApproved=true;}
 ];
 for(const modify of changes){
  const x=origin();modify(x.entries[0].questionBlueprints[0]);
  assert.throws(()=>audit(x),/G2H_BLUEPRINT_FAIL_CLOSED/);
 }
 const altered=origin();altered.target.questionCount=35;
 assert.throws(()=>audit(altered),/G2H_BLUEPRINT_FAIL_CLOSED/);
 const wrongKind=origin();wrongKind.entries[0].questionBlueprints[0].kind='OCR';
 assert.throws(()=>audit(wrongKind),/G2H_BLUEPRINT_FAIL_CLOSED/);
});
test('G2-H refuses replacing NASA research candidates with unreviewed or mismatched media',()=>{
 const alt=origin();alt.entries[0].officialSource='https://example.invalid/unrelated';
 assert.throws(()=>audit(alt),/G2H_BLUEPRINT_FAIL_CLOSED/);
 const duplicate=origin();duplicate.entries[1].slot=duplicate.entries[0].slot;
 assert.throws(()=>audit(duplicate),/G2H_BLUEPRINT_FAIL_CLOSED/);
 const missing=origin();missing.entries.pop();
 assert.throws(()=>audit(missing),/G2H_BLUEPRINT_FAIL_CLOSED/);
 const wrong=origin();wrong.entries[2].captionAlignmentStatus='VERIFIED';
 assert.throws(()=>audit(wrong),/G2H_BLUEPRINT_FAIL_CLOSED/);
});
test('G2-H identifies absent-evidence questions and requires future full-scope review rather than claiming negative facts',()=>{
 const p=origin();
 const unsupported=p.entries.flatMap(x=>x.questionBlueprints).filter(x=>x.kind==='UNSUPPORTED');
 assert.equal(unsupported.length,3);
 for(const x of unsupported){
  assert.equal(x.minimumEvidenceSegments,0);
  assert.deepEqual(x.requiredModalities,[]);
  assert.equal(x.requiresWholeVideoAbsenceCheck,true);
  assert.equal(x.answerText,null);
  assert.equal(x.candidateStatus,'QUESTION_TEMPLATE_NOT_REAL_MEDIA_OBSERVED');
 }
 for(const q of p.entries.flatMap(x=>x.questionBlueprints).filter(x=>x.kind==='OCR'))
  assert.deepEqual(q.requiredModalities,['FRAME','OCR']);
});
