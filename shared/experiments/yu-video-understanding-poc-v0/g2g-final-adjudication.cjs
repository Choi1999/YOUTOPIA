'use strict';
// G2-G: human operator adjudicates two completed G2-F AI-assisted reports.
// This is NOT blind independent gold or G3 authorization. All original files are read-only.
// Private adjudication is saved in its OWN local JSON, never in the Git repo.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const g2f=require('./g2f-assisted-review.cjs');
const g2e=require('./g2e-gold-pilot.cjs');
const TYPE='G2G_LOCAL_OPERATOR_ADJUDICATION_V01';
const STATUSES=['PENDING','APPROVE','REVISE','HOLD'];
const FIELDS=['schemaVersion','kind','film','publisherEdition','operatorCode','durationMs',
 'sourceVideoSha256','sourceCaptionSha256','authorFileSha256','reviewerAFileSha256','reviewerBFileSha256',
 'reviewerACode','reviewerBCode','questions','templateDigest',
 'independentBlindGoldApproved','g3Authorized','externalProviderCalls','actualSpendUsd'];
const QUESTION=['questionId','questionText','kind','localAnchorMs','result'];
const RESULT=['status','finalVerdict','finalAnswerText','finalEvidence','absenceRationale',
 'fullMovieReviewed','operatorViewedSource','rationale','selectedBasis'];
const EVIDENCE=['modality','localStartMs','localEndMs','observationNote'];
function gate(ok,message){if(!ok)throw Error('G2G_ADJUDICATION_FAIL_CLOSED: '+message);}
function isObject(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
function strict(x,fields,name){gate(isObject(x)&&Object.keys(x).sort().join('|')===fields.slice().sort().join('|'),name+' schema');}
function sha(raw){return crypto.createHash('sha256').update(raw).digest('hex');}
function isHash(s){return typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);}
function words(x,min=20,max=1200){return typeof x==='string'&&x.trim().length>=min&&x.length<=max;}
function readJSON(file){
 gate(typeof file==='string'&&path.isAbsolute(file)&&path.extname(file).toLowerCase()==='.json','absolute local JSON filename');
 g2e.safeJsonFile(file,{mustExist:true}); // reject repo paths, symlinks and missing files
 const stat=fs.lstatSync(file);
 gate(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>100&&stat.size<200000,'regular local JSON <=200K');
 return {path:file,raw:fs.readFileSync(file,'utf8')};
}
function inputs({authorFile,reviewAFile,reviewBFile}){
 gate([authorFile,reviewAFile,reviewBFile].every(x=>typeof x==='string'&&path.isAbsolute(x)), 'three absolute local source files required');
 gate(new Set([authorFile,reviewAFile,reviewBFile]).size===3,'three distinct input paths');
 const source=readJSON(authorFile),aFile=readJSON(reviewAFile),bFile=readJSON(reviewBFile);
 const {author,sourceDraftSha256}=g2f.sourceDraft(source.path);
 const a=JSON.parse(aFile.raw),b=JSON.parse(bFile.raw);
 const summaryA=g2f.validate(a),summaryB=g2f.validate(b);
 gate(a.film===author.film&&b.film===author.film&&a.reviewerCode!==b.reviewerCode,
  'reviewer film/identity or pair mismatch');
 gate(summaryA.pending===0&&summaryB.pending===0&&summaryA.humanReviewed===6&&summaryB.humanReviewed===6,
  'both AI-assisted reviewer reports must have all six submitted');
 const assessment=g2f.assess(source.path,aFile.path,bFile.path);
 gate(assessment.questionCount===6&&assessment.blindReviewCount===0&&
  assessment.independentGoldApproved===0&&assessment.g3Authorized===false,
  'AI-assisted assessment scope or approval violated');
 gate(sourceDraftSha256===sha(source.raw),'G2-E digest mismatch');
 return {author,a,b,summaryA,summaryB,assessment,
  authorFileSha256:sha(source.raw),reviewerAFileSha256:sha(aFile.raw),reviewerBFileSha256:sha(bFile.raw)};
}
function invariant(p){
 return {schemaVersion:p.schemaVersion,kind:p.kind,film:p.film,publisherEdition:p.publisherEdition,
  operatorCode:p.operatorCode,durationMs:p.durationMs,
  sourceVideoSha256:p.sourceVideoSha256,sourceCaptionSha256:p.sourceCaptionSha256,
  authorFileSha256:p.authorFileSha256,reviewerAFileSha256:p.reviewerAFileSha256,reviewerBFileSha256:p.reviewerBFileSha256,
  reviewerACode:p.reviewerACode,reviewerBCode:p.reviewerBCode,
  questions:p.questions.map(q=>({questionId:q.questionId,questionText:q.questionText,kind:q.kind,localAnchorMs:q.localAnchorMs})),
  independentBlindGoldApproved:p.independentBlindGoldApproved,g3Authorized:p.g3Authorized,
  externalProviderCalls:p.externalProviderCalls,actualSpendUsd:p.actualSpendUsd};
}
function emptyResult(){
 return {status:'PENDING',finalVerdict:null,finalAnswerText:null,finalEvidence:[],
  absenceRationale:null,fullMovieReviewed:false,operatorViewedSource:false,
  rationale:null,selectedBasis:null};
}
function plan(files,operatorCode,output){
 gate(typeof operatorCode==='string'&&/^[A-Z0-9_-]{3,32}$/.test(operatorCode),
  'operator identity format');
 const src=inputs(files);
 gate(typeof output==='string'&&path.isAbsolute(output)&&output.toLowerCase().endsWith('.json'),'output must be absolute JSON');
 gate(![files.authorFile,files.reviewAFile,files.reviewBFile].includes(output),'cannot replace source');
 gate(!fs.existsSync(output),'no overwriting previous decisions');
 const dir=path.dirname(output);gate(fs.existsSync(dir)&&fs.statSync(dir).isDirectory(),'destination folder missing');
 g2e.safeJsonFile(output); // private result must stay OUTSIDE Git and must not overwrite
 const p={schemaVersion:1,kind:TYPE,film:src.author.film,publisherEdition:src.author.publisherEdition,
  operatorCode,durationMs:src.author.localSource.durationMs,
  sourceVideoSha256:src.author.localSource.videoSha256,sourceCaptionSha256:src.author.localSource.captionSha256,
  authorFileSha256:src.authorFileSha256,reviewerAFileSha256:src.reviewerAFileSha256,reviewerBFileSha256:src.reviewerBFileSha256,
  reviewerACode:src.a.reviewerCode,reviewerBCode:src.b.reviewerCode,
  questions:src.a.questions.map(q=>({questionId:q.questionId,questionText:q.questionText,
   kind:q.kind,localAnchorMs:[...q.localAnchorMs],result:emptyResult()})),
  templateDigest:null,independentBlindGoldApproved:0,g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
 p.templateDigest=sha(JSON.stringify(invariant(p)));
 validate(p,src);
 fs.writeFileSync(output,JSON.stringify(p,null,2)+'\n',{flag:'wx',mode:0o600});
 return summary(p);
}
function validate(p,src){
 strict(p,FIELDS,'operator record');
 gate(p.schemaVersion===1&&p.kind===TYPE&&['Sintel','TearsOfSteel'].includes(p.film),'record identity');
 gate(/^[A-Z0-9_-]{3,32}$/.test(p.operatorCode||'')&&words(p.publisherEdition,8,100),'operator and source');
 gate(Number.isSafeInteger(p.durationMs)&&p.durationMs>100000,'duration');
 for(const key of ['sourceVideoSha256','sourceCaptionSha256','authorFileSha256',
  'reviewerAFileSha256','reviewerBFileSha256','templateDigest'])gate(isHash(p[key]),'hash '+key);
 gate(p.independentBlindGoldApproved===0&&p.g3Authorized===false&&p.externalProviderCalls===0&&p.actualSpendUsd===0,
  'gold/G3/provider default-deny contract');
 gate(sha(JSON.stringify(invariant(p)))===p.templateDigest,'immutable question/source/decision identity changed');
 gate(Array.isArray(p.questions)&&p.questions.length===6,'exact six questions');
 gate(p.reviewerACode!==p.reviewerBCode&&/^[A-Z0-9_-]{3,32}$/.test(p.reviewerACode||'')&&
  /^[A-Z0-9_-]{3,32}$/.test(p.reviewerBCode||''),'distinct reviewer codes');
 if(src){
  gate(p.film===src.author.film&&p.publisherEdition===src.author.publisherEdition,
    'publisher or film changed');
  gate(p.authorFileSha256===src.authorFileSha256&&p.reviewerAFileSha256===src.reviewerAFileSha256&&
   p.reviewerBFileSha256===src.reviewerBFileSha256,
   'G2-E or G2-F source changed after operator record creation; explicit rebase required');
  gate(p.sourceVideoSha256===src.author.localSource.videoSha256&&
   p.sourceCaptionSha256===src.author.localSource.captionSha256&&
   p.durationMs===src.author.localSource.durationMs,'local edition changed');
  gate(p.reviewerACode===src.a.reviewerCode&&p.reviewerBCode===src.b.reviewerCode,
   'reviewer identity mapping changed');
 }
 const seen=new Set();
 for(let i=0;i<p.questions.length;i++){
  const q=p.questions[i];
  strict(q,QUESTION,'adjudication question');
  gate(/^G2E-(SIN|TOS)-0[1-6]$/.test(q.questionId)&&!seen.has(q.questionId),'unique question ID');
  seen.add(q.questionId);
  gate(q.questionId.startsWith(p.film==='Sintel'?'G2E-SIN-':'G2E-TOS-'),'film question ID');
  gate(['SPEECH','VISUAL','TEMPORAL','UNSUPPORTED'].includes(q.kind)&&words(q.questionText,18,350),'question fields');
  const expected=q.kind==='UNSUPPORTED'?0:q.kind==='TEMPORAL'?2:1;
  gate(Array.isArray(q.localAnchorMs)&&q.localAnchorMs.length===expected&&
   q.localAnchorMs.every(t=>Number.isSafeInteger(t)&&t>=0&&t<=p.durationMs),'question anchors');
  if(src){
   const fromA=src.a.questions[i],fromB=src.b.questions[i],fromGold=src.author.questions[i];
   for(const external of [fromA,fromB]){
    gate(external.questionId===q.questionId&&external.questionText===q.questionText&&
     external.kind===q.kind&&JSON.stringify(external.localAnchorMs)===JSON.stringify(q.localAnchorMs),
     'reviewer question scope changed');
   }
   gate(fromGold.id===q.questionId&&fromGold.finalQuestionText===q.questionText&&fromGold.kind===q.kind&&
     JSON.stringify(fromGold.anchorLocalMs)===JSON.stringify(q.localAnchorMs),
    'G2-E author question changed');
  }
  const r=q.result;strict(r,RESULT,'operator result');
  gate(STATUSES.includes(r.status),'invalid adjudication status');
  gate(r.operatorViewedSource===true||r.operatorViewedSource===false,'human reviewed flag');
  gate(r.fullMovieReviewed===true||r.fullMovieReviewed===false,'whole film flag');
  gate(Array.isArray(r.finalEvidence)&&r.finalEvidence.length<=10,'final evidence array');
  gate(r.selectedBasis===null||['A','B','CUSTOM'].includes(r.selectedBasis),'source selection');
  if(r.status==='PENDING'){
   gate(JSON.stringify(r)===JSON.stringify(emptyResult()),'pending record must not contain final decisions');
   continue;
  }
  gate(words(r.rationale,20,1200),'operator adjudication reason required');
  if(r.status==='HOLD'||r.status==='REVISE'){
   // Nonterminal decisions may record a suggested correction, but can never approve source evidence.
   gate(r.finalVerdict===null&&r.finalAnswerText===null&&r.finalEvidence.length===0&&
    r.absenceRationale===null&&r.fullMovieReviewed===false&&r.selectedBasis===null,
    'hold/revise cannot silently store an approved answer');
   continue;
  }
  gate(r.status==='APPROVE'&&r.operatorViewedSource===true&&
   ['SUPPORTED','UNSUPPORTED'].includes(r.finalVerdict)&&
   words(r.finalAnswerText,8,1200)&&r.selectedBasis!==null,
   'APPROVE requires human original source review and explicit answer/basis');
  if(r.finalVerdict==='UNSUPPORTED'){
   gate(r.fullMovieReviewed===true&&r.finalEvidence.length===0&&words(r.absenceRationale,20,1000),
    'UNSUPPORTED must be backed by human full-film review and reason');
  }else{
   gate(r.fullMovieReviewed===false&&r.absenceRationale===null&&
    r.finalEvidence.length>=Math.max(1,expected),'SUPPORTED must have original source time evidence');
   for(const e of r.finalEvidence){
    strict(e,EVIDENCE,'final evidence');
    gate(['AUDIO','TRANSCRIPT','FRAME','OCR'].includes(e.modality)&&
     (q.kind==='SPEECH'?['AUDIO','TRANSCRIPT'].includes(e.modality):
       ['FRAME'].includes(e.modality))&&
     Number.isSafeInteger(e.localStartMs)&&Number.isSafeInteger(e.localEndMs)&&
     e.localStartMs>=0&&e.localEndMs>e.localStartMs&&e.localEndMs<=p.durationMs&&
     words(e.observationNote,18,500),'final original media evidence invalid');
   }
   for(const anchor of q.localAnchorMs){
    const tolerance=q.kind==='SPEECH'?15000:30000;
    gate(r.finalEvidence.some(e=>e.localStartMs<=anchor+tolerance&&e.localEndMs>=anchor-tolerance),
      'final evidence does not cover anchor tolerance');
   }
  }
 }
 return summary(p);
}
function summary(p){
 const counts={PENDING:0,APPROVE:0,REVISE:0,HOLD:0};
 for(const q of p.questions)counts[q.result.status]++;
 return {stage:'G2-G',status:counts.PENDING===0?'OPERATOR_ADJUDICATION_RECORDED_NOT_BLIND_GOLD':'OPERATOR_ADJUDICATION_IN_PROGRESS',
  film:p.film,operatorCode:p.operatorCode,questionCount:6,
  operatorApproved:counts.APPROVE,requiresRevision:counts.REVISE,held:counts.HOLD,pending:counts.PENDING,
  sourceReviewMode:'AI_ASSISTED_NON_BLIND',
  independentBlindGoldApproved:0,finalGoldGateSatisfied:false,g3Authorized:false,
  externalProviderCalls:0,actualSpendUsd:0};
}
function load(recordFile,files){
 const rec=readJSON(recordFile);
 const p=JSON.parse(rec.raw);
 const src=inputs(files);
 const result=validate(p,src);
 return {record:p,revision:sha(rec.raw),summary:result,sources:src};
}
function save(recordFile,files,p,revision){
 const old=load(recordFile,files);
 gate(typeof revision==='string'&&old.revision===revision,'stale record: reload before edit');
 gate(JSON.stringify(invariant(old.record))===JSON.stringify(invariant(p)),
  'cannot change sources, question identity or operator identity');
 const src=old.sources,report=validate(p,src),next=JSON.stringify(p,null,2)+'\n';
 gate(Buffer.byteLength(next,'utf8')<=200000,'adjudication output too large');
 const tmp=recordFile+'.pending-'+crypto.randomBytes(8).toString('hex');
 try{
  fs.writeFileSync(tmp,next,{flag:'wx',mode:0o600});
  fs.renameSync(tmp,recordFile);
 }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
 return {revision:sha(next),summary:report};
}
function run(args){
 if(args.length===10&&args[0]==='plan'&&args[1]==='--author'&&args[3]==='--review-a'&&
  args[5]==='--review-b'&&args[7]==='--operator'&&args[9]==='--out')
   throw Error('G2G_ADJUDICATION_FAIL_CLOSED: missing output path');
 if(args.length===11&&args[0]==='plan'&&args[1]==='--author'&&args[3]==='--review-a'&&
  args[5]==='--review-b'&&args[7]==='--operator'&&args[9]==='--out')
  return plan({authorFile:args[2],reviewAFile:args[4],reviewBFile:args[6]},args[8],args[10]);
 if(args.length===9&&(args[0]==='check'||args[0]==='report')&&args[1]==='--record'&&
  args[3]==='--author'&&args[5]==='--review-a'&&args[7]==='--review-b'){
  const report=load(args[2],{authorFile:args[4],reviewAFile:args[6],reviewBFile:args[8]});
  if(args[0]==='check')return report.summary;
  return {summary:report.summary,questions:report.record.questions.map((q,i)=>({
   questionId:q.questionId,kind:q.kind,status:q.result.status,rationale:q.result.rationale,
   reviewerAVerdict:report.sources.a.questions[i].review.verdict,
   reviewerBVerdict:report.sources.b.questions[i].review.verdict,
   answerAgreement:report.sources.a.questions[i].review.answerText===
    report.sources.b.questions[i].review.answerText,
   finalAnswerText:q.result.finalAnswerText,
   finalEvidenceCount:q.result.finalEvidence.length}))};
 }
 throw Error('G2G_ADJUDICATION_FAIL_CLOSED: use plan --author JSON --review-a JSON --review-b JSON --operator CODE --out JSON or check/report --record JSON --author JSON --review-a JSON --review-b JSON');
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(run(process.argv.slice(2)),null,2)+'\n');}
 catch(e){process.stderr.write((e.message?.startsWith('G2G_ADJUDICATION_FAIL_CLOSED:')?e.message:'G2G_ADJUDICATION_FAIL_CLOSED: invalid source or record')+'\n');process.exitCode=1;}
}
module.exports={TYPE,emptyResult,invariant,inputs,plan,validate,summary,load,save,run};
