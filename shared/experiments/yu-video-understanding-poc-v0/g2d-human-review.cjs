'use strict';
// G2-D local operator worksheet: plan human audio-caption and browser-playback comparisons.
// NEVER captures YouTube streams, uses model APIs, or upgrades G3 authorization.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const g2c=require('./g2c-offline-verifier.cjs');
const FILMS=Object.freeze({
 Sintel:{slot:'SYNTH-VID-05',youtubeUrl:'https://www.youtube.com/watch?v=eRsGyueVLvQ',
  publisherEdition:'SINTEL_UPDATED_720P_MKV',
  editionRisk:'YOUTUBE_EDIT_NOT_PROVEN; verify exact uploader and scene timing'},
 TearsOfSteel:{slot:'SYNTH-VID-06',youtubeUrl:'https://www.youtube.com/watch?v=OHOpb2fS-cM',
  publisherEdition:'TEARS_2012_FIRST_HD_720P_MOV',
  editionRisk:'YOUTUBE_LINK_REFERENCED_FROM_4K_ARCHIVE; 2012 FIRST HD vs 2013 4K RERENDER MUST NOT BE ASSUMED EQUIVALENT'}
});
const PASS='OBSERVED_MATCH',FAIL='OBSERVED_DIFFERENCE',UNKNOWN='UNCERTAIN',UNREVIEWED='NOT_REVIEWED';
const ALLOWED=new Set([PASS,FAIL,UNKNOWN,UNREVIEWED]);
function check(ok,msg){if(!ok)throw Error('G2D_FAIL_CLOSED: '+msg);}
function strict(obj,keys,label){
 check(obj&&typeof obj==='object'&&!Array.isArray(obj),'invalid '+label);
 check(Object.keys(obj).sort().join('|')===keys.slice().sort().join('|'),'unexpected/missing '+label+' field');
}
function sha(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function pickIndices(n){check(Number.isInteger(n)&&n>=3,'minimum 3 caption cues');return [0,Math.floor((n-1)/2),n-1];}
function skeleton(film,evidence){
 const cfg=FILMS[film];check(cfg,'unknown film');
 check(evidence&&evidence.status==='LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY'&&evidence.slot===cfg.slot&&
 evidence.video&&evidence.caption&&evidence.caption.syntaxAndDurationBounds==='PASS_BOUNDS_ONLY'&&
 evidence.providerCalls===0&&evidence.g3Authorized===false,'local G2C proof required');
 const duration=evidence.video.durationMs, rows=evidence.caption.rows;
 check(Number.isSafeInteger(duration)&&duration>0,'local duration');
 // inspectLocal exposes caption bounds, not raw dialogue. A companion SRT parser supplies rows.
 // The caller supplies rows extracted from the SAME local SRT whose SHA256 is in evidence.
 check(Array.isArray(rows)&&rows.length===evidence.caption.cueCount,'SRT cue timings required');
 check(/^[a-f0-9]{64}$/.test(evidence.video.sha256)&&/^[a-f0-9]{64}$/.test(evidence.caption.sha256),'local fingerprints');
 check(rows.every(r=>Number.isSafeInteger(r.startMs)&&Number.isSafeInteger(r.endMs)&&r.startMs>=0&&r.endMs>r.startMs&&r.endMs<=duration),'SRT row bounds');
 const checkpoint=(id,kind,ms,prompt,cueIndex=null)=>({
   id,kind,localMs:ms,cueIndex,prompt,
   verdict:UNREVIEWED,observationNote:null,observedSpeechStartMs:null,observedYoutubeMs:null
 });
 const out=[];
 const names=['FIRST','MIDDLE','LAST'];
 pickIndices(rows.length).forEach((idx,i)=>out.push(checkpoint(
   'AUDIO_'+names[i],'AUDIO_SYNC',rows[idx].startMs,
   'Play local publisher film. Verify subtitle displays with the corresponding spoken line, note the observed speech onset (ms). No dialogue text in report.',idx+1)));
 for(const [label,ratio] of [['OPENING',0.10],['MIDPOINT',0.50],['ENDING',0.90]]){
  const ms=Math.round(duration*ratio);
  out.push(checkpoint('YOUTUBE_'+label,'YOUTUBE_SCENE',ms,
  'Compare local scene and audio event at this position with the YouTube watch page. Record matching YouTube time (ms), shot order and whether edited/regraded.',null));
 }
 if(film==='TearsOfSteel'){
  const last=evidence.caption.lastEndMs;
  check(Number.isSafeInteger(last)&&last<duration,'tail requires real uncaptioned window');
  for(const [label,ms] of [['AFTER_CAPTIONS',Math.min(last+20000,duration-1000)],
   ['NEAR_END',Math.max(last+1000,duration-45000)]]){
    check(ms>last&&ms<duration,'tail sample');
    out.push(checkpoint('COVERAGE_'+label,'CAPTION_COVERAGE',ms,
      'Inspect local film after final SRT cue (09:27 observed). OBSERVED_MATCH means no dialogue needing a missing caption in inspected window; check remainder, not only this instant.',null));
  }
 }
 return {
 schemaVersion:1,kind:'G2D_LOCAL_OPERATOR_REVIEW_V01',film,slot:cfg.slot,sourceType:'USER_SUPPLIED_LOCAL_MEDIA_RIGHTS_UNVERIFIED',
 provenance:'LOCAL_G2C_INSPECTION_PLUS_UNREVIEWED_MANUAL_CHECKPOINTS',
 publisherEdition:cfg.publisherEdition,youtubeEditionCaveat:cfg.editionRisk,youtubeUrl:cfg.youtubeUrl,
 local:{videoSha256:evidence.video.sha256,captionSha256:evidence.caption.sha256,durationMs:duration,
    captionCueCount:evidence.caption.cueCount,captionLastEndMs:evidence.caption.lastEndMs},
 observedYoutubeDurationMs:null,youtubeUploaderObservation:'NOT_REVIEWED',
 reviewerCode:'LOCAL_OPERATOR_1',checkpoints:out,
 packetDigest:null,realDatasetApproved:false,g3Authorized:false,externalProviderCalls:0
 };
}
function immutable(packet){
 return {schemaVersion:packet.schemaVersion,kind:packet.kind,film:packet.film,slot:packet.slot,
   sourceType:packet.sourceType,provenance:packet.provenance,publisherEdition:packet.publisherEdition,
   youtubeEditionCaveat:packet.youtubeEditionCaveat,youtubeUrl:packet.youtubeUrl,local:packet.local,
   checkpoints:packet.checkpoints.map(c=>({id:c.id,kind:c.kind,localMs:c.localMs,cueIndex:c.cueIndex,prompt:c.prompt})),
   realDatasetApproved:packet.realDatasetApproved,g3Authorized:packet.g3Authorized,
   externalProviderCalls:packet.externalProviderCalls};
}
function completePacket(film,evidence,rows){
 const data=structuredClone(evidence);data.caption.rows=rows;
 const packet=skeleton(film,data);packet.packetDigest=sha(immutable(packet));return packet;
}
function assess(p){
 strict(p,['schemaVersion','kind','film','slot','sourceType','provenance','publisherEdition','youtubeEditionCaveat','youtubeUrl','local','observedYoutubeDurationMs','youtubeUploaderObservation','reviewerCode','checkpoints','packetDigest','realDatasetApproved','g3Authorized','externalProviderCalls'],'packet');
 const cfg=FILMS[p.film];check(!!cfg,'film');
 check(p.kind==='G2D_LOCAL_OPERATOR_REVIEW_V01'&&p.schemaVersion===1&&p.slot===cfg.slot&&p.youtubeUrl===cfg.youtubeUrl&&
 p.publisherEdition===cfg.publisherEdition&&p.youtubeEditionCaveat===cfg.editionRisk&&p.sourceType==='USER_SUPPLIED_LOCAL_MEDIA_RIGHTS_UNVERIFIED'&&
 p.provenance==='LOCAL_G2C_INSPECTION_PLUS_UNREVIEWED_MANUAL_CHECKPOINTS','provenance');
 check(p.realDatasetApproved===false&&p.g3Authorized===false&&p.externalProviderCalls===0,'unauthorized promotion');
 strict(p.local,['videoSha256','captionSha256','durationMs','captionCueCount','captionLastEndMs'],'local');
 check(/^[a-f0-9]{64}$/.test(p.local.videoSha256)&&/^[a-f0-9]{64}$/.test(p.local.captionSha256),'hash format');
 check(Number.isSafeInteger(p.local.durationMs)&&p.local.durationMs>0&&
 Number.isSafeInteger(p.local.captionCueCount)&&p.local.captionCueCount>=3&&
 Number.isSafeInteger(p.local.captionLastEndMs)&&p.local.captionLastEndMs<=p.local.durationMs,'duration');
 check(/^[a-f0-9]{64}$/.test(p.packetDigest)&&sha(immutable(p))===p.packetDigest,'packet modified after plan');
 check(typeof p.reviewerCode==='string'&&/^[A-Z0-9_-]{3,32}$/.test(p.reviewerCode),'reviewer code');
 check(['NOT_REVIEWED','OFFICIAL_OWNER_CONFIRMED','UNVERIFIED','THIRD_PARTY'].includes(p.youtubeUploaderObservation),'uploader observation');
 check(p.observedYoutubeDurationMs===null||(Number.isSafeInteger(p.observedYoutubeDurationMs)&&p.observedYoutubeDurationMs>=60000&&p.observedYoutubeDurationMs<=36000000),'youtube duration');
 check(p.checkpoints.length===(p.film==='TearsOfSteel'?8:6),'checkpoint count');
 const ids=new Set(),summary={audioSync:{match:0,difference:0,unknown:0,unreviewed:0},youtubeScenes:{match:0,difference:0,unknown:0,unreviewed:0},captionCoverage:{match:0,difference:0,unknown:0,unreviewed:0}};
 for(const c of p.checkpoints){
  strict(c,['id','kind','localMs','cueIndex','prompt','verdict','observationNote','observedSpeechStartMs','observedYoutubeMs'],'checkpoint');
  check(!ids.has(c.id)&&/^(AUDIO_(FIRST|MIDDLE|LAST)|YOUTUBE_(OPENING|MIDPOINT|ENDING)|COVERAGE_(AFTER_CAPTIONS|NEAR_END))$/.test(c.id),'checkpoint identity');ids.add(c.id);
  check(ALLOWED.has(c.verdict),'verdict enum');
  const group=c.kind==='AUDIO_SYNC'?'audioSync':c.kind==='YOUTUBE_SCENE'?'youtubeScenes':'captionCoverage';
  check(['audioSync','youtubeScenes','captionCoverage'].includes(group),'checkpoint group');
  const status=c.verdict===PASS?'match':c.verdict===FAIL?'difference':c.verdict===UNKNOWN?'unknown':'unreviewed';
  summary[group][status]++;
  const obs=c.verdict!==UNREVIEWED;
  check(obs?typeof c.observationNote==='string'&&c.observationNote.trim().length>=12&&c.observationNote.length<=300:
   c.observationNote===null,'review note');
  if(c.kind==='AUDIO_SYNC'){
    check(c.id.startsWith('AUDIO_')&&Number.isSafeInteger(c.cueIndex)&&c.cueIndex>0,'audio checkpoint');
    check(c.observedYoutubeMs===null,'audio no youtube timestamp');
    check(c.observedSpeechStartMs===null||(Number.isSafeInteger(c.observedSpeechStartMs)&&c.observedSpeechStartMs>=0&&c.observedSpeechStartMs<=p.local.durationMs),'audio time');
    if(c.verdict===PASS)check(c.observedSpeechStartMs!==null&&Math.abs(c.observedSpeechStartMs-c.localMs)<=1500,'audio match requires <=1500ms observed onset deviation');
    if(c.verdict===FAIL)check(c.observedSpeechStartMs!==null,'audio difference requires observed timestamp');
    if(!obs)check(c.observedSpeechStartMs===null,'unfinished audio timestamp');
  } else if(c.kind==='YOUTUBE_SCENE'){
    check(c.id.startsWith('YOUTUBE_')&&c.observedSpeechStartMs===null,'youtube checkpoint');
    check(c.observedYoutubeMs===null||(Number.isSafeInteger(c.observedYoutubeMs)&&c.observedYoutubeMs>=0&&c.observedYoutubeMs<=p.observedYoutubeDurationMs),'youtube timestamp');
    if(c.verdict===PASS)check(c.observedYoutubeMs!==null&&p.youtubeUploaderObservation==='OFFICIAL_OWNER_CONFIRMED','youtube match needs observed time and uploader review');
    if(c.verdict===FAIL)check(c.observedYoutubeMs!==null,'youtube difference needs observed time');
    if(!obs)check(c.observedYoutubeMs===null,'unfinished youtube timestamp');
  } else {
    check(p.film==='TearsOfSteel'&&c.id.startsWith('COVERAGE_')&&c.observedSpeechStartMs===null&&c.observedYoutubeMs===null,'tail no time');
  }
 }
 check(summary.audioSync.match+summary.audioSync.difference+summary.audioSync.unknown+summary.audioSync.unreviewed===3,'three audio checkpoints');
 check(summary.youtubeScenes.match+summary.youtubeScenes.difference+summary.youtubeScenes.unknown+summary.youtubeScenes.unreviewed===3,'three youtube checkpoints');
 if(p.film==='TearsOfSteel')check(Object.values(summary.captionCoverage).reduce((a,b)=>a+b,0)===2,'two tail checkpoints');
 const totals=Object.values(summary).reduce((totals,x)=>({match:totals.match+x.match,difference:totals.difference+x.difference,
  unknown:totals.unknown+x.unknown,unreviewed:totals.unreviewed+x.unreviewed}),{match:0,difference:0,unknown:0,unreviewed:0});
 const sceneSamples=p.checkpoints.filter(x=>x.kind==='YOUTUBE_SCENE'&&x.verdict===PASS);
 const offsets=sceneSamples.map(x=>x.observedYoutubeMs-x.localMs);
 const maxOffsetSpreadMs=offsets.length>=2?Math.max(...offsets)-Math.min(...offsets):null;
 const durationDeltaMs=p.observedYoutubeDurationMs===null?null:p.observedYoutubeDurationMs-p.local.durationMs;
 const durationDiscrepancy=durationDeltaMs!==null&&Math.abs(durationDeltaMs)>2000;
 const consistentOffsets=offsets.length===3&&maxOffsetSpreadMs<=2000;
 const timelineDrift=sceneSamples.length===3&&!consistentOffsets;
 const allSampleMatches=totals.match===p.checkpoints.length&&
 p.youtubeUploaderObservation==='OFFICIAL_OWNER_CONFIRMED'&&p.observedYoutubeDurationMs!==null;
 const hasProblem=totals.difference>0;
 const status=hasProblem||timelineDrift||durationDiscrepancy?'OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW':
    totals.unreviewed>0||totals.unknown>0?'PENDING_HUMAN_REVIEW':
    allSampleMatches?'OPERATOR_REPORTED_SAMPLED_MATCHES_NOT_FULL_PROOF':'INCOMPLETE_REVIEW';
 return {stage:'G2-D',status,film:p.film,publisherEdition:p.publisherEdition,
    youtubeEditionCaveat:p.youtubeEditionCaveat,
    source:'OPERATOR_ENTERED_HUMAN_OBSERVATIONS_NOT_INDEPENDENT',
    checkpoints:p.checkpoints.length,counts:totals,byCategory:summary,
    youtubeDurationObserved:p.observedYoutubeDurationMs!==null,uploaderObserved:p.youtubeUploaderObservation,
    youtubeSampleOffsetSpreadMs:maxOffsetSpreadMs,
    reportedYoutubeDurationDeltaMs:durationDeltaMs,
    reportedYoutubeDurationClass:durationDeltaMs===null?'NOT_OBSERVED':durationDiscrepancy?'DURATION_DISCREPANCY_REVIEW':'WITHIN_TWO_SECONDS_NOT_FULL_EQUIVALENCE',
    youtubeSampleOffsetConsistency:consistentOffsets?'OPERATOR_REPORTED_CONSISTENT':'NOT_ESTABLISHED',
    reportedAudioSyncSamplesMatched:summary.audioSync.match,
    reportedYoutubeSceneSamplesMatched:summary.youtubeScenes.match,
    reportedTailCoverageSamplesMatched:summary.captionCoverage.match,
    independentReviewerCount:0,fullAudioCaptionAlignmentVerified:false,
    fullYoutubeEditionEquivalenceVerified:false,filmRightsForServiceVerified:false,
    humanGoldLabelsVerified:false,g3Authorized:false,
    externalProviderCalls:0,actualSpendUsd:0,
    guidance:hasProblem?'Differences must be resolved by inspecting source versions; do not approve the dataset':
      'Manual samples are not full audio/video equivalence, rights approval, or a model-quality benchmark'};
}
function insideRepo(p){
 const repo=path.resolve(__dirname,'../../..');
 const abs=path.resolve(p);
 return abs===repo||abs.startsWith(repo+path.sep);
}
function localReviewFile(p){
 check(typeof p==='string'&&p.length>0&&!p.includes('://')&&path.extname(p).toLowerCase()==='.json'&&!insideRepo(p),'review JSON must be local and outside Git repo');
 const abs=path.resolve(p);if(fs.existsSync(abs)){const st=fs.lstatSync(abs);check(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=128000,'review file size/symlink');}
 return abs;
}
async function run(argv){
 if(argv.length===9&&argv[0]==='plan'&&argv[1]==='--film'&&argv[3]==='--video'&&argv[5]==='--srt'&&argv[7]==='--out'){
  const film=argv[2],videoPath=argv[4],srtPath=argv[6],out=localReviewFile(argv[8]);
  check(!fs.existsSync(out),'cannot overwrite review plan');
  const spec=FILMS[film];check(spec,'film'); 
  const probe=await g2c.inspectLocal({slot:spec.slot,videoPath,srtPath});
  check(probe.caption.syntaxAndDurationBounds==='PASS_BOUNDS_ONLY','SRT must fit movie');
  const rows=g2c.parseSrt(fs.readFileSync(srtPath,'utf8')).rows;
  const packet=completePacket(film,probe,rows);
  check(assess(packet).status==='PENDING_HUMAN_REVIEW','planned report defaults to blocked');
  const folder=path.dirname(out);check(fs.existsSync(folder)&&fs.statSync(folder).isDirectory(),'destination folder must exist');
  fs.writeFileSync(out,JSON.stringify(packet,null,2)+'\n',{flag:'wx',mode:0o600});
  return {stage:'G2-D',status:'LOCAL_REVIEW_PACKET_CREATED_NOT_REVIEWED',film,
   savedOutsideGit:true,checkpointCount:packet.checkpoints.length,
   youtubeUrl:packet.youtubeUrl,manualEditRequired:true,externalProviderCalls:0,g3Authorized:false};
 }
 if(argv.length===3&&argv[0]==='assess'&&argv[1]==='--review'){
  const p=localReviewFile(argv[2]);check(fs.existsSync(p),'missing review packet');
  const packet=JSON.parse(fs.readFileSync(p,'utf8'));return assess(packet);
 }
 throw Error('G2D_FAIL_CLOSED: use plan --film NAME --video LOCAL_FILE --srt LOCAL_FILE --out PRIVATE_JSON or assess --review PRIVATE_JSON');
}
if(require.main===module){run(process.argv.slice(2)).then(r=>process.stdout.write(JSON.stringify(r,null,2)+'\n'))
 .catch(e=>{process.stderr.write((String(e.message).startsWith('G2D_FAIL_CLOSED:')?e.message:'G2D_FAIL_CLOSED: local inspection or input error')+'\n');process.exitCode=1;});}
module.exports={FILMS,immutable,pickIndices,completePacket,assess,insideRepo,localReviewFile,run};
