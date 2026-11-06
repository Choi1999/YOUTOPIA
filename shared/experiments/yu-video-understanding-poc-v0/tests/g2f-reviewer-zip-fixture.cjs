'use strict';
// G2-F Windows CI fixture generator: synthetic empty question packets ONLY, no real media.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const g2f=require('../g2f-blind-review.cjs');
const [file,reviewer='CI_G2F_TEST']=process.argv.slice(2);
if(!file||!path.isAbsolute(file)||!/^[A-Z0-9_-]{3,32}$/.test(reviewer)){
 process.stderr.write('Synthetic offline test only: supply absolute JSON path and reviewer code\n');process.exit(2);
}
const anchors=[[107250],[207250],[88803],[444016],[88803,444016],[]];
const packet={schemaVersion:1,kind:'G2F_LOCAL_BLIND_REVIEW_PACKET',protocolVersion:g2f.V,
 film:'Sintel',publisherEdition:'SINTEL_UPDATED_720P_MKV',
 sourceDraftSha256:'a'.repeat(64),sourceQuestionSha256:'b'.repeat(64),
 sourceVideoSha256:'c'.repeat(64),sourceCaptionSha256:'d'.repeat(64),
 durationMs:888032,reviewerCode:reviewer,
 blindReviewDeclaration:null,sawOperatorAnswersBeforeSubmission:null,watchedLocalPublisherFilm:null,
 questions:anchors.map((a,i)=>({questionId:'G2E-SIN-0'+(i+1),
  questionText:'Synthetic blind reviewer Q'+(i+1)+' about real-film evidence requiring user observation.',
  localAnchorMs:a,response:{verdict:'NOT_REVIEWED',answerText:null,evidence:[],
   absenceRationale:null,fullMovieReviewed:false,observationNote:null}})),
 sourceTemplateDigest:null,goldApprovalGranted:false,g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0};
packet.sourceTemplateDigest=crypto.createHash('sha256').update(JSON.stringify(g2f.immutable(packet))).digest('hex');
g2f.validatePacket(packet);
fs.writeFileSync(file,JSON.stringify(packet,null,2)+'\n',{flag:'wx',mode:0o600});
process.stdout.write('G2F_SYNTHETIC_EMPTY_PACK_FOR_CI_ONLY\n');
