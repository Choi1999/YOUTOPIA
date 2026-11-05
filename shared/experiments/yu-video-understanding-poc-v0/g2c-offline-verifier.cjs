'use strict';
// G2-C publisher evidence + optional user-supplied LOCAL authorized-media inspection.
// Zero fetch, zero YouTube extraction, zero provider SDK, zero upload or original-text logging.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const FILE=path.join(__dirname,'g2c-blender-evidence.json');
const CANON={
 'SYNTH-VID-05':{filmId:'SINTEL',seconds:888,license:'https://durian.blender.org/sharing/',
   download:'https://durian.blender.org/download/',runtime:'https://studio.blender.org/projects/sintel/',
   youtube:'https://www.youtube.com/watch?v=eRsGyueVLvQ',
   variants:['SINTEL_OFFICIAL_DISTRIBUTION']},
 'SYNTH-VID-06':{filmId:'TEARS_OF_STEEL',seconds:734,license:'https://mango.blender.org/about/',
   download:'https://mango.blender.org/download/',
   runtime:'https://studio.blender.org/projects/tears-of-steel/?asset=42',
   youtube:'https://www.youtube.com/watch?v=OHOpb2fS-cM',
   variants:['TOS_FIRST_HD_2012','TOS_RERENDER_4K_2013']}
};
const ROOT_KEYS=['schemaVersion','registryId','reviewedAt','provenance','mediaBytesExamined','subtitleBytesExamined','youtubeMediaExtracted','providerApiCalls','actualSpendUsd','modelTransmissionAuthorized','serviceRightsApproved','sourceToYoutubeEquivalent','spokenCaptionAlignmentVerified','humanGoldLabelsVerified','approvedRealDatasetCount','films'];
const FILM_KEYS=['slot','filmId','title','publisher','license','publisherLicenseUrl','publisherDownloadUrl','publishedDuration','publisherEnglishSrtListed','subtitleReference','youtubePointer','youtubePointerEvidence','youtubePointerProvenance','attributionConstraint','separatedRightsConcern','candidateVariants','selectedVariantId','rightsForLLMProcessing','publisherSubtitleObtained','publisherVideoObtained','localMediaFingerprint','localCaptionFingerprint','youtubeVersionContentCompared','captionBoundsChecked','speechCaptionAlignmentChecked','independentLegalReviewers','independentGoldReviewers','approvedForEvaluation'];
function check(ok,msg){if(!ok)throw Error('G2C_FAIL_CLOSED: '+msg);}
function exactFields(v,fields,label){check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===fields.slice().sort().join('|'),label+' schema');}
function secureUrl(u,allow){
 check(typeof u==='string','source URL');
 let p;try{p=new URL(u);}catch{throw Error('G2C_FAIL_CLOSED: source URL');}
 check(p.protocol==='https:'&&!p.username&&!p.password&&!p.hash&&allow.has(p.hostname),'source URL host');
}
const OFFICIAL=new Set(['durian.blender.org','mango.blender.org','studio.blender.org']);
const REFERENCES=new Set([...OFFICIAL,'www.youtube.com','vimeo.com','commons.wikimedia.org']);
function load(){return JSON.parse(fs.readFileSync(FILE,'utf8'));}
function audit(m){
 exactFields(m,ROOT_KEYS,'registry');
 check(m.schemaVersion===1&&m.registryId==='YU_VIDEO_G2C_BLENDER_EVIDENCE_V01'&&m.reviewedAt==='2026-11-05'&&m.provenance==='PUBLISHER_PUBLIC_DOCUMENTS_ONLY','registry provenance');
 check(m.mediaBytesExamined===false&&m.subtitleBytesExamined===false&&m.youtubeMediaExtracted===false,'real-media claim');
 check(m.providerApiCalls===0&&m.actualSpendUsd===0&&m.modelTransmissionAuthorized===false,'provider activity');
 check(m.serviceRightsApproved===false&&m.sourceToYoutubeEquivalent===false&&m.spokenCaptionAlignmentVerified===false&&m.humanGoldLabelsVerified===false&&m.approvedRealDatasetCount===0,'approval forged');
 check(Array.isArray(m.films)&&m.films.length===2,'two-film pilot');
 let records=[];
 for(const f of m.films){
  exactFields(f,FILM_KEYS,'film');
  const c=CANON[f.slot];check(c&&!records.some(x=>x.slot===f.slot),'unexpected duplicate film');
  check(f.filmId===c.filmId&&f.publisher==='Blender Foundation'&&f.license==='CC_BY_3_0','film identity/license');
  check(typeof f.title==='string'&&f.title.length>4,'film title');
  check(f.publisherLicenseUrl===c.license&&f.publisherDownloadUrl===c.download&&f.youtubePointer===c.youtube,'canonical links');
  secureUrl(f.publisherLicenseUrl,OFFICIAL);secureUrl(f.publisherDownloadUrl,OFFICIAL);
  secureUrl(f.subtitleReference,OFFICIAL);secureUrl(f.youtubePointer,REFERENCES);secureUrl(f.youtubePointerEvidence,REFERENCES);
  check(f.subtitleReference===c.download,'publisher captions listing');
  check(f.publishedDuration&&f.publishedDuration.seconds===c.seconds&&f.publishedDuration.kind==='BLENDER_STUDIO_PAGE_METADATA_NOT_MEDIA_PROBE'&&f.publishedDuration.source===c.runtime,'runtime is only published metadata');
  check(f.publisherEnglishSrtListed===true,'SRT public listing');
  check(Array.isArray(f.candidateVariants)&&f.candidateVariants.length===c.variants.length&&
   f.candidateVariants.every((v,i)=>v&&v.variantId===c.variants[i]&&v.source===c.download&&typeof v.description==='string'&&v.description.length>14),'publication variants');
  check(f.selectedVariantId===null&&f.publisherSubtitleObtained===false&&f.publisherVideoObtained===false,'unobtained asset status');
  check(f.localMediaFingerprint===null&&f.localCaptionFingerprint===null&&f.youtubeVersionContentCompared===false,'unverified media content');
  check(f.captionBoundsChecked===false&&f.speechCaptionAlignmentChecked===false,'unverified subtitles');
  check(f.rightsForLLMProcessing==='INDEPENDENT_SCOPE_REVIEW_REQUIRED'&&f.independentLegalReviewers===0&&f.independentGoldReviewers===0&&f.approvedForEvaluation===false,'rights or annotation forged');
  check(typeof f.attributionConstraint==='string'&&f.attributionConstraint.length>15&&typeof f.separatedRightsConcern==='string'&&f.separatedRightsConcern.length>15&&typeof f.youtubePointerProvenance==='string','rights and provenance');
  check(f.slot==='SYNTH-VID-06'?f.separatedRightsConcern.includes('PORTRAIT'):f.separatedRightsConcern.includes('MARKS'),'separate rights');
  records.push({slot:f.slot,filmId:f.filmId,publisherCCByLicenseDocumented:true,officialSrtListingConfirmed:true,
   durationPublishedSeconds:c.seconds,filmVariantsDocumented:c.variants,videoContentInspected:false,
   fileHashVerified:false,youtubeEquivalent:false,subtitleBoundsPassed:false,spokenCaptionAligned:false,
   scopeRightsReviewed:false,humanGoldReviewed:false,readyForG3:false});
 }
 check(records[0].slot==='SYNTH-VID-05'&&records[1].slot==='SYNTH-VID-06','slot order');
 return {stage:'G2-C',status:'PUBLISHER_RIGHTS_AND_SUBTITLE_LISTINGS_DOCUMENTED_MEDIA_UNVERIFIED',
   documentaryEvidenceCount:2,filmRightsForServiceApproved:0,sourceFileHashesVerified:0,
   youtubeVersionEquivalencesVerified:0,captionSyntaxRealFilesVerified:0,spokenCaptionAlignmentsVerified:0,
   humanGoldReviewed:0,externalCalls:0,actualSpendUsd:0,liveCallsAuthorized:false,
   operatingState:'OFFLINE_DOCUMENTARY_ONLY',g3Authorized:false,merged:false,records};
}
function ms(v){
 const m=/^(\d{2,4}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(v);
 check(m,'invalid SRT timestamp');
 return ((+m[1]*3600 + +m[2]*60 + +m[3])*1000)+(+m[4]);
}
function parseSrt(text){
 check(typeof text==='string'&&text.length>0&&text.length<=5_000_000,'SRT size');
 const blocks=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim().split(/\n[ \t]*\n+/);
 check(blocks.length>0&&blocks.length<=30000,'SRT block count');
 let previousStart=-1,previousEnd=0,overlapCount=0,rows=[];
 for(let i=0;i<blocks.length;i++){
  const lines=blocks[i].split('\n');
  check(lines.length>=3&&lines[0].trim()===String(i+1),'SRT cue number');
  const match=/^\s*(\d{2,4}:[0-5]\d:[0-5]\d[,.]\d{3})\s+-->\s+(\d{2,4}:[0-5]\d:[0-5]\d[,.]\d{3})(?:\s+.*)?$/.exec(lines[1]);
  check(match,'SRT time range');
  const startMs=ms(match[1]),endMs=ms(match[2]);
  check(startMs>=0&&endMs>startMs&&startMs>=previousStart,'SRT cue order or duration');
  check(lines.slice(2).some(s=>s.trim().length>0),'SRT empty text');
  if(i>0&&startMs<previousEnd)overlapCount++;
  rows.push({startMs,endMs});previousStart=startMs;previousEnd=endMs;
 }
 return {cueCount:rows.length,firstStartMs:rows[0].startMs,lastEndMs:rows[rows.length-1].endMs,
  overlapCount:overlapCount,rangeOnly:true,spokenAlignment:'NOT_CHECKED',rows};
}
function checkCaptionBounds(subtitle,durationMs){
 check(subtitle&&Array.isArray(subtitle.rows)&&Number.isSafeInteger(durationMs)&&durationMs>0,'local media duration required');
 const overflow=subtitle.rows.filter(r=>r.endMs>durationMs).length;
 return {cueCount:subtitle.cueCount,firstStartMs:subtitle.firstStartMs,lastEndMs:subtitle.lastEndMs,
   overflowCueCount:overflow,overlapCueCount:subtitle.overlapCount,
   syntaxAndDurationBounds:overflow===0?'PASS_BOUNDS_ONLY':'FAIL_CAPTION_EXCEEDS_FILE_DURATION',
   speechToCaptionAlignment:'NOT_VERIFIED_WITH_AUDIO'};
}
function metadataFromProbe(raw){
 check(raw&&Array.isArray(raw.streams)&&raw.streams.some(s=>s.codec_type==='video'),'local video stream missing');
 const durationMs=Math.round(Number(raw.format?.duration)*1000);
 check(Number.isSafeInteger(durationMs)&&durationMs>0&&durationMs<=36000000,'invalid probed duration');
 const video=raw.streams.find(s=>s.codec_type==='video');
 check(Number.isInteger(video.width)&&video.width>0&&Number.isInteger(video.height)&&video.height>0,'invalid video dimensions');
 return {durationMs,width:video.width,height:video.height,codec:typeof video.codec_name==='string'?video.codec_name:'UNKNOWN',frameRate:typeof video.r_frame_rate==='string'?video.r_frame_rate:'UNKNOWN',source:'LOCAL_FFPROBE_NOT_YOUTUBE'};
}
function fileAt(p,exts,maxBytes){
 check(typeof p==='string'&&p.length>0&&!p.includes('://')&&!p.includes('\0')&&exts.includes(path.extname(p).toLowerCase()),'local file extension/path');
 const resolved=path.resolve(p),st=fs.lstatSync(resolved);
 check(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=maxBytes,'local file size or symlink');
 return {path:resolved,sizeBytes:st.size};
}
async function hash(p){const h=crypto.createHash('sha256');for await(const c of fs.createReadStream(p))h.update(c);return h.digest('hex');}
async function inspectLocal({slot,videoPath,srtPath}){
 check(Object.hasOwn(CANON,slot),'film not in pilot');
 const movie=fileAt(videoPath,['.mov','.mkv','.mp4','.webm','.ogv'],16*1024**3);
 const caption=fileAt(srtPath,['.srt'],5*1024*1024);
 const srtText=fs.readFileSync(caption.path,'utf8'),srt=parseSrt(srtText);
 // ffprobe may inspect only local file/pipe; remote HTTP/HTTPS protocols are not allowed.
 let probe;
 try{probe=JSON.parse(execFileSync('ffprobe',['-v','error','-protocol_whitelist','file,pipe',
  '-show_entries','format=duration:stream=codec_type,codec_name,width,height,r_frame_rate',
  '-of','json',movie.path],{encoding:'utf8',timeout:90000,maxBuffer:1024*1024,windowsHide:true}));}
 catch{throw Error('G2C_FAIL_CLOSED: local ffprobe unavailable or rejected source');}
 const video=metadataFromProbe(probe),bounds=checkCaptionBounds(srt,video.durationMs);
 const [fileHash,captionHash]=await Promise.all([hash(movie.path),hash(caption.path)]);
 return {stage:'G2-C',slot,status:'LOCAL_MEDIA_FILE_BOUNDS_REVIEW_ONLY',sourceType:'USER_SUPPLIED_LOCAL_FILE',
  video:{sha256:fileHash,byteSize:movie.sizeBytes,...video},
  caption:{sha256:captionHash,byteSize:caption.sizeBytes,...bounds},
  officialPublisherVariantMatched:false,publisherSourceRightsIndependentReview:false,
  youtubeMediaVersionMatched:false,actualSpokenCaptionAlignmentVerified:false,
  humanGoldAnnotationVerified:false,g3Authorized:false,providerCalls:0,actualSpendUsd:0,
  warning:'Local file hashes and subtitle bounds cannot prove YouTube equivalence, license scope, or spoken-word synchrony'};
}
async function main(args){
 if(args.length===0)return audit(load());
 check(args.length===6&&args[0]==='--slot'&&args[2]==='--video'&&args[4]==='--srt','only --slot <ID> --video <LOCAL_FILE> --srt <LOCAL_FILE> supported');
 return inspectLocal({slot:args[1],videoPath:args[3],srtPath:args[5]});
}
if(require.main===module){main(process.argv.slice(2)).then(x=>process.stdout.write(JSON.stringify(x,null,2)+'\n'))
 .catch(e=>{process.stderr.write((String(e.message).startsWith('G2C_FAIL_CLOSED:')?e.message:'G2C_FAIL_CLOSED: local file access or parsing error')+'\n');process.exitCode=1;});}
module.exports={CANON,FILE,load,audit,ms,parseSrt,checkCaptionBounds,metadataFromProbe,fileAt,inspectLocal,main};
