'use strict';
// G2-F blinded two-reviewer film evidence collection. LOCAL FILES ONLY.
// No published answers, video frames, transcripts, model SDK or verified human gold labels.
const fs=require('node:fs');
const crypto=require('node:crypto');
const g2e=require('./g2e-gold-pilot.cjs');
const V='YU_VIDEO_G2F_BLIND_REVIEW_V01';
const FILMS=['Sintel','TearsOfSteel'];
const VERDICTS=['NOT_REVIEWED','SUPPORTED','UNSUPPORTED','AMBIGUOUS'];
const MODALITIES=['AUDIO','TRANSCRIPT','FRAME','OCR'];
const ROOT=['schemaVersion','kind','protocolVersion','film','publisherEdition','sourceDraftSha256','sourceQuestionSha256',
 'sourceVideoSha256','sourceCaptionSha256','durationMs','reviewerCode','blindReviewDeclaration','sawOperatorAnswersBeforeSubmission',
 'watchedLocalPublisherFilm','questions','sourceTemplateDigest','goldApprovalGranted','g3Authorized','externalProviderCalls','actualSpendUsd'];
const Q=['questionId','questionText','localAnchorMs','response'];
const RESPONSE=['verdict','answerText','evidence','absenceRationale','fullMovieReviewed','observationNote'];
const EVIDENCE=['modality','localStartMs','localEndMs','observationNote'];
function gate(ok,msg){if(!ok)throw Error('G2F_FAIL_CLOSED: '+msg);}
function strict(x,fields,where){
 gate(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===fields.slice().sort().join('|'),where+' schema');
}
function sha(s){return crypto.createHash('sha256').update(typeof s==='string'?s:JSON.stringify(s)).digest('hex');}
function same(x,y){return JSON.stringify(x)===JSON.stringify(y);}
function textBetween(s,min,max){return typeof s==='string'&&s.trim().length>=min&&s.length<=max;}
function integer(n){return Number.isSafeInteger(n);}
function officialAuthor(file){
 const loc=g2e.safeJsonFile(file,{mustExist:true});
 const raw=fs.readFileSync(loc,'utf8'),author=JSON.parse(raw);
 const report=g2e.validatePlan(author);
 gate(FILMS.includes(author.film)&&report.operatorAuthored===6&&report.notAuthored===0&&report.needsRewrite===0,'G2-E author draft not fully complete');
 gate(report.humanGoldApproved===false&&report.g3Authorized===false,'G2-E authority must remain unapproved');
 return {author,sourceDraftSha256:sha(raw)};
}
function questionDigest(author){
 return sha({film:author.film,publisherEdition:author.publisherEdition,videoSha256:author.localSource.videoSha256,
  captionSha256:author.localSource.captionSha256,
  questions:author.questions.map(q=>({id:q.id,text:q.finalQuestionText,anchors:q.anchorLocalMs}))});
}
function immutable(p){
 return {schemaVersion:p.schemaVersion,kind:p.kind,protocolVersion:p.protocolVersion,film:p.film,
  publisherEdition:p.publisherEdition,sourceDraftSha256:p.sourceDraftSha256,sourceQuestionSha256:p.sourceQuestionSha256,
  sourceVideoSha256:p.sourceVideoSha256,sourceCaptionSha256:p.sourceCaptionSha256,durationMs:p.durationMs,
  reviewerCode:p.reviewerCode,questions:p.questions.map(q=>({questionId:q.questionId,questionText:q.questionText,
  localAnchorMs:q.localAnchorMs})),goldApprovalGranted:p.goldApprovalGranted,g3Authorized:p.g3Authorized,
  externalProviderCalls:p.externalProviderCalls,actualSpendUsd:p.actualSpendUsd};
}
function createPacket(authorFile,reviewerCode,outputFile){
 const {author,sourceDraftSha256}=officialAuthor(authorFile);
 gate(typeof reviewerCode==='string'&&/^[A-Z0-9_-]{3,32}$/.test(reviewerCode),'reviewer code format');
 gate(!author.questions.some(q=>q.authorCode===reviewerCode),'author cannot be blind independent reviewer');
 const target=g2e.safeJsonFile(outputFile);
 const questions=author.questions.map(q=>({
  questionId:q.id,questionText:q.finalQuestionText,localAnchorMs:[...q.anchorLocalMs],
  response:{verdict:'NOT_REVIEWED',answerText:null,evidence:[],absenceRationale:null,fullMovieReviewed:false,observationNote:null}
 }));
 const p={schemaVersion:1,kind:'G2F_LOCAL_BLIND_REVIEW_PACKET',protocolVersion:V,film:author.film,
  publisherEdition:author.publisherEdition,sourceDraftSha256,sourceQuestionSha256:questionDigest(author),
  sourceVideoSha256:author.localSource.videoSha256,sourceCaptionSha256:author.localSource.captionSha256,
  durationMs:author.localSource.durationMs,reviewerCode,
  blindReviewDeclaration:null,sawOperatorAnswersBeforeSubmission:null,watchedLocalPublisherFilm:null,
  questions,sourceTemplateDigest:null,goldApprovalGranted:false,g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
 p.sourceTemplateDigest=sha(immutable(p));
 fs.writeFileSync(target,JSON.stringify(p,null,2)+'\n',{flag:'wx',mode:0o600});
 return {stage:'G2-F',status:'BLIND_QUESTION_PACK_CREATED_NO_ANSWERS',film:author.film,questionCount:questions.length,
  reviewerCode,containsOperatorAnswers:false,storedOutsideGit:true,goldApproved:false,g3Authorized:false,
  providerApiCalls:0,actualSpendUsd:0};
}
function validatePacket(p){
 strict(p,ROOT,'blind packet');
 gate(p.schemaVersion===1&&p.kind==='G2F_LOCAL_BLIND_REVIEW_PACKET'&&p.protocolVersion===V&&FILMS.includes(p.film),
  'protocol and film');
 gate(typeof p.publisherEdition==='string'&&p.publisherEdition.length>4,'edition');
 for(const key of ['sourceDraftSha256','sourceQuestionSha256','sourceVideoSha256','sourceCaptionSha256','sourceTemplateDigest']){
  gate(typeof p[key]==='string'&&/^[a-f0-9]{64}$/.test(p[key]),key+' sha256');
 }
 gate(integer(p.durationMs)&&p.durationMs>100000&&p.durationMs<36000000,'film duration');
 gate(/^[A-Z0-9_-]{3,32}$/.test(p.reviewerCode||''),'reviewer code');
 gate(p.goldApprovalGranted===false&&p.g3Authorized===false&&p.externalProviderCalls===0&&p.actualSpendUsd===0,'approval and provider calls denied');
 gate(sha(immutable(p))===p.sourceTemplateDigest,'immutable blind question template was changed');
 for(const k of ['blindReviewDeclaration','sawOperatorAnswersBeforeSubmission','watchedLocalPublisherFilm']){
  gate(p[k]===null||typeof p[k]==='boolean',k+' declaration');
 }
 gate(Array.isArray(p.questions)&&p.questions.length===6,'6-item film review');
 let complete=0,uncertain=0,notReviewed=0;
 const seen=new Set();
 for(const q of p.questions){
  strict(q,Q,'question');
  gate(!seen.has(q.questionId)&&typeof q.questionId==='string'&&/^G2E-(SIN|TOS)-0[1-6]$/.test(q.questionId),'question id');
  seen.add(q.questionId);
  gate(q.questionId.startsWith(p.film==='Sintel'?'G2E-SIN':'G2E-TOS'),'question film');
  gate(textBetween(q.questionText,18,350),'final question');
  gate(Array.isArray(q.localAnchorMs)&&q.localAnchorMs.length<=2&&
   q.localAnchorMs.every(x=>integer(x)&&x>=0&&x<=p.durationMs),'local anchors');
  strict(q.response,RESPONSE,'review response');
  const x=q.response;
  gate(VERDICTS.includes(x.verdict),'verdict');
  gate(Array.isArray(x.evidence)&&x.evidence.length<=10,'evidence list');
  gate(x.fullMovieReviewed===true||x.fullMovieReviewed===false,'full movie review flag');
  gate(x.absenceRationale===null||textBetween(x.absenceRationale,20,500),'absence rationale');
  gate(x.observationNote===null||textBetween(x.observationNote,20,500),'review note');
  if(x.verdict==='NOT_REVIEWED'){
   gate(x.answerText===null&&x.evidence.length===0&&x.absenceRationale===null&&
     x.fullMovieReviewed===false&&x.observationNote===null,'unreviewed must stay empty');
   notReviewed++;continue;
  }
  if(x.verdict==='AMBIGUOUS'){
   gate(x.answerText===null&&x.evidence.length===0&&x.absenceRationale===null&&
    x.fullMovieReviewed===false&&textBetween(x.observationNote,20,500),'ambiguous explanation required');
   uncertain++;continue;
  }
  gate(textBetween(x.answerText,8,1200),'reviewer answer');
  if(x.verdict==='UNSUPPORTED'){
   gate(x.evidence.length===0&&x.absenceRationale!==null&&x.fullMovieReviewed===true,
     'unsupported needs original full-film absence inspection and rationale');
  }else{
   gate(x.absenceRationale===null&&x.fullMovieReviewed===false&&x.evidence.length>=Math.max(1,q.localAnchorMs.length),
    'supported requires directly observed local evidence');
   for(const e of x.evidence){
    strict(e,EVIDENCE,'review evidence');
    gate(MODALITIES.includes(e.modality)&&integer(e.localStartMs)&&integer(e.localEndMs)&&
      e.localStartMs>=0&&e.localEndMs>e.localStartMs&&e.localEndMs<=p.durationMs,
      'review evidence modality or time bounds');
    gate(textBetween(e.observationNote,18,500),'review evidence observation');
   }
   for(const anchor of q.localAnchorMs){
    gate(x.evidence.some(e=>e.localStartMs<=anchor+30000&&e.localEndMs>=anchor-30000),
     'review evidence must cover each original film anchor vicinity');
   }
   if(q.localAnchorMs.length===2){
    const st=x.evidence.map(e=>e.localStartMs).sort((a,b)=>a-b);
    gate(st[0]<st[1],'temporal evidence must contain two distinct events');
   }
  }
  complete++;
 }
 const correctDeclaration=p.blindReviewDeclaration===true&&p.sawOperatorAnswersBeforeSubmission===false&&
  p.watchedLocalPublisherFilm===true;
 const exposed=p.sawOperatorAnswersBeforeSubmission===true||p.blindReviewDeclaration===false;
 const status=exposed?'REVIEWER_SOURCE_EXPOSURE_REQUIRES_REWORK':
  complete+uncertain+notReviewed!==6?'REVIEW_PACKET_INVALID':
  notReviewed>0?'INDEPENDENT_REVIEW_IN_PROGRESS':
  !correctDeclaration?'REVIEW_COMPLETED_BUT_BLIND_PROVENANCE_NOT_DECLARED':
  uncertain>0?'SELF_REPORTED_BLIND_REVIEW_WITH_UNCERTAIN_ITEMS':
  'SELF_REPORTED_BLIND_REVIEW_SUBMITTED_NOT_VERIFIED';
 return {stage:'G2-F',status,film:p.film,reviewerCode:p.reviewerCode,
  questionCount:6,answered:complete,uncertain,notReviewed,
  blindIndependenceSelfDeclared:correctDeclaration,verifiedHumanIdentity:false,
  independentGoldApprovalCount:0,g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
}
function readReview(file){const raw=fs.readFileSync(g2e.safeJsonFile(file,{mustExist:true}),'utf8');return {packet:JSON.parse(raw),digest:sha(raw)};}
function overlap(x,y){
 const a=x.filter(e=>e&&integer(e.localStartMs)&&integer(e.localEndMs));
 const b=y.filter(e=>e&&integer(e.localStartMs)&&integer(e.localEndMs));
 return a.some(m=>b.some(n=>m.localStartMs<=n.localEndMs+5000&&n.localStartMs<=m.localEndMs+5000));
}
function assess(authorFile,aFile,bFile){
 const {author,sourceDraftSha256}=officialAuthor(authorFile),a=readReview(aFile),b=readReview(bFile);
 const ra=validatePacket(a.packet),rb=validatePacket(b.packet);
 gate(a.packet.film===author.film&&b.packet.film===author.film,'all film identities must match');
 gate(a.packet.reviewerCode!==b.packet.reviewerCode,'two different reviewer codes required');
 gate(!author.questions.some(q=>q.authorCode===a.packet.reviewerCode||q.authorCode===b.packet.reviewerCode),
  'author may not be counted as either independent reviewer');
 const expected=questionDigest(author);
 for(const p of [a.packet,b.packet]){
  gate(p.sourceDraftSha256===sourceDraftSha256&&p.sourceQuestionSha256===expected&&
   p.publisherEdition===author.publisherEdition&&p.sourceVideoSha256===author.localSource.videoSha256&&
   p.sourceCaptionSha256===author.localSource.captionSha256&&p.durationMs===author.localSource.durationMs,
   'source G2-E draft or publisher media changed after blind pack creation');
  gate(p.questions.length===author.questions.length&&p.questions.every((q,i)=>
   q.questionId===author.questions[i].id&&q.questionText===author.questions[i].finalQuestionText&&
   same(q.localAnchorMs,author.questions[i].anchorLocalMs)),'reviewer questions differ from frozen G2-E questions');
 }
 const summary={};
 let agreeVerdict=0,disagreeVerdict=0,mismatchAuthor=0,evidenceAlignmentNeedsCheck=0;
 const flags=[];
 for(let i=0;i<author.questions.length;i++){
  const q=author.questions[i],x=a.packet.questions[i].response,y=b.packet.questions[i].response;
  if(x.verdict===y.verdict)agreeVerdict++;else{disagreeVerdict++;flags.push({questionId:q.id,reason:'REVIEWER_ANSWERABILITY_CONFLICT'});}
  if(x.verdict!==q.gold.answerability||y.verdict!==q.gold.answerability){
   mismatchAuthor++;flags.push({questionId:q.id,reason:'REVIEWER_VS_OPERATOR_ANSWERABILITY_CONFLICT'});
  }
  if(x.verdict==='SUPPORTED'&&y.verdict==='SUPPORTED'&&
   (!overlap(x.evidence,y.evidence)||!overlap(x.evidence,q.gold.evidence)||!overlap(y.evidence,q.gold.evidence))){
   evidenceAlignmentNeedsCheck++;flags.push({questionId:q.id,reason:'SOURCE_EVIDENCE_TIME_RECONCILIATION'});
  }
 }
 const looksCopied=sha(a.packet.questions.map(q=>q.response))===sha(b.packet.questions.map(q=>q.response))&&ra.notReviewed===0;
 if(looksCopied)flags.push({questionId:null,reason:'IDENTICAL_REVIEW_RESPONSES_REQUIRE_INDEPENDENCE_EXPLANATION'});
 const pairSubmitted=ra.notReviewed===0&&rb.notReviewed===0&&
  ra.status!=='REVIEWER_SOURCE_EXPOSURE_REQUIRES_REWORK'&&rb.status!=='REVIEWER_SOURCE_EXPOSURE_REQUIRES_REWORK';
 const pairBlind=pairSubmitted&&ra.blindIndependenceSelfDeclared&&rb.blindIndependenceSelfDeclared;
 const status=!pairSubmitted?'BLIND_REVIEW_IN_PROGRESS_OR_SOURCE_EXPOSURE':
  !pairBlind?'BLIND_PROVENANCE_DECLARATION_REQUIRED':
  'TWO_BLIND_REVIEWER_REPORTS_SUBMITTED_PENDING_HUMAN_ADJUDICATION';
 return {stage:'G2-F',status,film:author.film,questionCount:6,authorDrafts:6,
  reviewerASummary:ra,reviewerBSummary:rb,
  selfDeclaredBlindReviewers:pairBlind?2:0,verifiedIndependentHumanReviewers:0,
  reviewerAnswerabilityAgreements:agreeVerdict,reviewerAnswerabilityDisagreements:disagreeVerdict,
  authorVsReviewerAnswerabilityConflicts:mismatchAuthor,evidenceTimeFlags:evidenceAlignmentNeedsCheck,
  flags,allSixQuestionTextsRequireSemanticAdjudication:true,
  independentGoldApproved:0,filmRightsForServiceVerified:false,fullYoutubeEditionEquivalenceVerified:false,
  g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0,
  note:'Reviewer codes/checkboxes and even matching evidence do not prove independence, truth, rights or final approval.'};
}
function run(argv){
 if(argv.length===0)return {stage:'G2-F',status:'OFFLINE_TWO_BLIND_REVIEWER_PROTOCOL_READY_NO_REVIEWS',externalProviderCalls:0,
  verifiedIndependentHumanReviewers:0,independentGoldApproved:0,g3Authorized:false};
 if(argv.length===9&&argv[0]==='plan'&&argv[1]==='--author'&&argv[3]==='--reviewer'&&argv[5]==='--out'&&argv[7]==='--film'){
  gate(officialAuthor(argv[2]).author.film===argv[8],'film mismatch before private file creation');
  return createPacket(argv[2],argv[4],argv[6]);
 }
 if(argv.length===3&&argv[0]==='check'&&argv[1]==='--file')return validatePacket(readReview(argv[2]).packet);
 if(argv.length===7&&argv[0]==='assess'&&argv[1]==='--author'&&argv[3]==='--review-a'&&argv[5]==='--review-b'){
  return assess(argv[2],argv[4],argv[6]);
 }
 throw Error('G2F_FAIL_CLOSED: [no args], plan --author PRIVATE_JSON --reviewer CODE --out PRIVATE_JSON --film NAME, check --file PRIVATE_JSON, assess --author PRIVATE_JSON --review-a A_JSON --review-b B_JSON');
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(run(process.argv.slice(2)),null,2)+'\n');}
 catch(e){process.stderr.write((e.message?.startsWith('G2F_FAIL_CLOSED:')?e.message:'G2F_FAIL_CLOSED: invalid local private JSON or reviewer evidence')+'\n');process.exitCode=1;}
}
module.exports={V,createPacket,validatePacket,assess,immutable,questionDigest,officialAuthor,run};
