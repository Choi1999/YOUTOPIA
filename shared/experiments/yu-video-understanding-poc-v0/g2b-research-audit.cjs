'use strict';
// G2-B public METADATA catalog. No network, credentials, YouTube API, video, or captions.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const FILENAME=path.join(__dirname,'g2b-public-candidates.json');
const SLOTS=Object.freeze({
 'SYNTH-VID-01':{category:'INTERVIEW',owner:'NASA / STScI',primarySource:'https://science.nasa.gov/asset/webb/transients-from-space-science-workshop-interviews/',youtubeWatchUrl:null,policyClass:'NASA_GUIDELINES_WITH_EXCEPTIONS'},
 'SYNTH-VID-02':{category:'INTERVIEW',owner:'NASA / STScI',primarySource:'https://science.nasa.gov/asset/webb/webb-draws-back-the-curtains-on-an-undiscovered-universe-interview-with-tommaso-treu/',youtubeWatchUrl:null,policyClass:'NASA_GUIDELINES_WITH_EXCEPTIONS'},
 'SYNTH-VID-03':{category:'SCREENCAST',owner:'NASA / JPL-Caltech',primarySource:'https://science.nasa.gov/resource/tutorial-nasas-eyes-on-the-earth/',youtubeWatchUrl:'https://www.youtube.com/watch?v=p-6DusnZ1pQ',policyClass:'NASA_GUIDELINES_WITH_EXCEPTIONS'},
 'SYNTH-VID-04':{category:'SCREENCAST',owner:'NASA / JPL-Caltech',primarySource:'https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/',youtubeWatchUrl:null,policyClass:'NASA_GUIDELINES_WITH_EXCEPTIONS'},
 'SYNTH-VID-05':{category:'ACTION',owner:'Blender Foundation',primarySource:'https://durian.blender.org/download/',youtubeWatchUrl:'https://www.youtube.com/watch?v=eRsGyueVLvQ',policyClass:'CC_BY_3_0_DOCUMENTED'},
 'SYNTH-VID-06':{category:'ACTION',owner:'Blender Foundation',primarySource:'https://mango.blender.org/download/',youtubeWatchUrl:'https://www.youtube.com/watch?v=OHOpb2fS-cM',policyClass:'CC_BY_3_0_DOCUMENTED'}
});
const EXPECTED_ROOT=['schemaVersion','registryId','reviewedAt','kind','allEvidencePublic','realMediaDownloaded','captionsDownloaded','rawTranscriptStored','externalProviderCalls','accountCredentialsUsed','rightsApprovedForService','comparabilityVerified','humanAnnotationsVerified','liveCallsAuthorized','candidates'];
const EXPECTED_ITEM=['slot','category','title','owner','primarySource','rightsReference','policyClass','officialMediaListed','officialTimedCaptionsListed','officialTranscriptListed','youtubeWatchUrl','youtubeMappingEvidence','youtubeMappingBasis','thirdPartyMusicRisk','identifiablePeopleRisk','notes','selectionStatus','rightsScopeState','youtubeMediaEqualityState','captionAlignmentState','authorizedLocalMediaSha256','youtubeEquivalentMediaSha256','captionOrTranscriptSha256','durationSecondsVerified','independentRightsReviewers','independentGoldReviewers','contentIngestApproved'];
const OFFICIAL_HOSTS=new Set(['science.nasa.gov','www.nasa.gov','durian.blender.org','mango.blender.org']);
const REFERENCE_HOSTS=new Set([...OFFICIAL_HOSTS,'www.youtube.com','vimeo.com','commons.wikimedia.org']);
function reject(message){throw new Error('G2B_FAIL_CLOSED: '+message);}
function check(v,message){if(!v)reject(message);}
function fields(item,names,label){check(item&&typeof item==='object'&&!Array.isArray(item),label+' invalid');
 const own=Object.keys(item).sort().join('|');check(own===names.slice().sort().join('|'),label+' unexpected/missing fields');}
function url(value,hosts,field){
 if(value===null)return;
 check(typeof value==='string',field+' invalid');
 let u;try{u=new URL(value);}catch{reject(field+' invalid URL');}
 check(u.protocol==='https:'&&u.username===''&&u.password===''&&u.hash===''&&hosts.has(u.hostname),field+' untrusted URL');
}
function load(){return JSON.parse(fs.readFileSync(FILENAME,'utf8'));}
function audit(m){
 fields(m,EXPECTED_ROOT,'registry');
 check(m.schemaVersion===1&&m.registryId==='YU_VIDEO_G2B_PUBLIC_CANDIDATES_V01'&&m.reviewedAt==='2026-11-05'&&m.kind==='PUBLIC_METADATA_RESEARCH_ONLY','registry identity');
 check(m.allEvidencePublic===true&&m.realMediaDownloaded===false&&m.captionsDownloaded===false&&m.rawTranscriptStored===false,'raw media/captions not permitted');
 check(m.externalProviderCalls===0&&m.accountCredentialsUsed===false&&m.liveCallsAuthorized===false,'live transport not permitted');
 check(m.rightsApprovedForService===false&&m.comparabilityVerified===false&&m.humanAnnotationsVerified===false,'rights/comparability/gold not approved');
 check(Array.isArray(m.candidates)&&m.candidates.length===6,'exactly six candidates');
 const counts={INTERVIEW:0,SCREENCAST:0,ACTION:0},seen=new Set();
 let originalListed=0,timedCaptionsListed=0,transcriptListed=0,youtubeLinks=0;
 const rows=[];
 for(const c of m.candidates){
   fields(c,EXPECTED_ITEM,'candidate');
   const expected=SLOTS[c.slot];
   check(expected&&!seen.has(c.slot),'unexpected or duplicate candidate');seen.add(c.slot);
   for(const k of ['category','owner','primarySource','youtubeWatchUrl','policyClass'])check(c[k]===expected[k],c.slot+' canonical source mismatch');
   check(typeof c.title==='string'&&c.title.trim().length>5&&typeof c.notes==='string'&&c.notes.trim().length>10,'candidate description');
   url(c.primarySource,OFFICIAL_HOSTS,'primary source');url(c.rightsReference,OFFICIAL_HOSTS,'rights reference');
   url(c.youtubeWatchUrl,REFERENCE_HOSTS,'YouTube pointer');url(c.youtubeMappingEvidence,REFERENCE_HOSTS,'YouTube mapping');
   if(c.youtubeWatchUrl!==null){check(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(c.youtubeWatchUrl),'YouTube format');
     check(c.youtubeMappingEvidence!==null&&['OFFICIAL_SOURCE_EMBED_ID','FILM_DIRECTOR_OFFICIAL_YOUTUBE_POINTER','THIRD_PARTY_ARCHIVE_SOURCE_POINTER'].includes(c.youtubeMappingBasis),'YouTube mapping evidence');youtubeLinks++;}
   else check(c.youtubeMappingEvidence===null&&['EMBED_OBSERVED_ID_NOT_ESTABLISHED','NOT_ESTABLISHED'].includes(c.youtubeMappingBasis),'unverified mapping');
   check(typeof c.officialMediaListed==='boolean'&&typeof c.officialTimedCaptionsListed==='boolean'&&typeof c.officialTranscriptListed==='boolean','official asset metadata');
   originalListed+=Number(c.officialMediaListed);timedCaptionsListed+=Number(c.officialTimedCaptionsListed);transcriptListed+=Number(c.officialTranscriptListed);
   check(['UNKNOWN','PRESENT_SOUNDSSTRIPE'].includes(c.thirdPartyMusicRisk),'music provenance');
   check(['PRESENT','UNKNOWN','FICTIONAL_CHARACTERS','PRESENT_ACTOR_PORTRAIT_RIGHTS'].includes(c.identifiablePeopleRisk),'people rights');
   check(c.selectionStatus==='RESEARCH_CANDIDATE_NOT_DATASET'&&c.rightsScopeState==='UNVERIFIED_FOR_YOUTOPIA','rights status');
   check(c.youtubeMediaEqualityState==='UNVERIFIED_NO_MEDIA_COMPARISON'&&c.captionAlignmentState==='UNVERIFIED_NO_CAPTION_COMPARISON','source identity and caption alignment');
   check(c.authorizedLocalMediaSha256===null&&c.youtubeEquivalentMediaSha256===null&&c.captionOrTranscriptSha256===null,'unverified media checksums');
   check(c.durationSecondsVerified===null&&c.independentRightsReviewers===0&&c.independentGoldReviewers===0&&c.contentIngestApproved===false,'approval or review forged');
   counts[c.category]++;
   const blockers=['SERVICE_USE_RIGHTS_NOT_SIGNED_OFF','PUBLISHER_VIDEO_VERSION_NOT_HASH_COMPARED','CAPTIONS_NOT_TIMELINE_ALIGNED','NO_TWO_INDEPENDENT_ANNOTATORS','DURATION_AND_FULL_QUESTION_COVERAGE_NOT_VERIFIED'];
   if(!c.youtubeWatchUrl)blockers.push('OFFICIAL_YOUTUBE_VIDEO_ID_NOT_CONFIRMED');
   if(c.youtubeMappingBasis==='THIRD_PARTY_ARCHIVE_SOURCE_POINTER')blockers.push('YOUTUBE_ID_THIRD_PARTY_MAPPING_ONLY');
   if(!c.officialTimedCaptionsListed)blockers.push('OFFICIAL_TIMED_CAPTIONS_NOT_IDENTIFIED');
   if(!c.officialMediaListed)blockers.push('OFFICIAL_MEDIA_DOWNLOAD_NOT_IDENTIFIED');
   if(c.thirdPartyMusicRisk==='PRESENT_SOUNDSSTRIPE')blockers.push('THIRD_PARTY_MUSIC_PERMISSION_NOT_CLEARED');
   if(c.identifiablePeopleRisk==='PRESENT'||c.identifiablePeopleRisk==='PRESENT_ACTOR_PORTRAIT_RIGHTS')blockers.push('IDENTIFIABLE_PERSON_COMMERCIAL_RIGHTS_NOT_REVIEWED');
   rows.push({slot:c.slot,title:c.title,category:c.category,officialMediaListed:c.officialMediaListed,
     officialTimedCaptionsListed:c.officialTimedCaptionsListed,officialTranscriptListed:c.officialTranscriptListed,
     youtubePointerDocumented:c.youtubeWatchUrl!==null,youtubeSameVersionVerified:false,rightsScopeVerified:false,
     goldReviewed:false,readyForLive:false,blockers});
 }
 check(Object.values(counts).every(n=>n===2),'genre distribution');
 check(originalListed===5&&timedCaptionsListed===3&&transcriptListed===3&&youtubeLinks===3,'evidence inventory changed without review');
 const fingerprint=createHash('sha256').update(JSON.stringify(m)).digest('hex');
 return {stage:'G2-B',status:'SIX_PUBLIC_RESEARCH_CANDIDATES_NOT_APPROVED_DATASET',
  sourceHashKind:'PUBLIC_REGISTRY_CONTENT_SHA256_NOT_VIDEO_HASH',registryDigestSha256:fingerprint,
  documentationReviewDate:m.reviewedAt,documentedCandidates:6,genres:counts,officialVideoListings:originalListed,
  officialTimedCaptionListings:timedCaptionsListed,officialTranscriptListings:transcriptListed,
  externallyDocumentedYouTubePointers:youtubeLinks,mediaOrCaptionBytesDownloaded:false,
  sourceRightsVerified:0,youtubeToSourceVersionMatchesVerified:0,captionTimelineAlignmentsVerified:0,
  humanReviewedGoldQuestionCount:0,approvedRealDatasetCount:0,
  liveCallsAuthorized:false,actualProviderCalls:0,actualSpendUsd:0,mergeAuthorized:false,
  decision:'BLOCKED_G2B_SOURCES_AND_ANNOTATIONS',rows};
}
if(require.main===module){
 if(process.argv.length!==2){process.stderr.write('G2B_OFFLINE_ONLY: no arguments, URLs or media accepted\n');process.exitCode=1;}
 else process.stdout.write(JSON.stringify(audit(load()),null,2)+'\n');
}
module.exports={FILENAME,SLOTS,load,audit};
