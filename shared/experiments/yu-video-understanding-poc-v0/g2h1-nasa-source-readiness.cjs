'use strict';
// G2-H1 PUBLIC NASA source discovery. No media/network, rights approval, timestamps or G3 calls.
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'g2h1-nasa-source-readiness.json');
const g2b=path.join(__dirname,'g2b-public-candidates.json');
const g2h=path.join(__dirname,'g2h-expansion-blueprint.json');
const known={
 'SYNTH-VID-01':{category:'INTERVIEW',page:'https://science.nasa.gov/asset/webb/transients-from-space-science-workshop-interviews/',
  hasTimedCaptions:true,hasTranscript:true,officialYouTubeId:null,assetKinds:['MP4_WITHOUT_SUBTITLES','MP4_WITH_SUBTITLES','SRT','VTT','TXT_TRANSCRIPT']},
 'SYNTH-VID-03':{category:'SCREENCAST',page:'https://science.nasa.gov/resource/tutorial-nasas-eyes-on-the-earth/',
  hasTimedCaptions:false,hasTranscript:false,officialYouTubeId:'p-6DusnZ1pQ',assetKinds:['MP4_1080P']}
};
function gate(ok,msg){if(!ok)throw Error('G2H1_FAIL_CLOSED: '+msg);}
function exact(obj,keys,where){gate(obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join('|')===keys.slice().sort().join('|'),where+' schema');}
function equals(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function validate(doc,prior,plan){
 exact(doc,['schemaVersion','registryId','auditedAt','status','baselineContract','phase','sources','candidates',
  'researchCandidateCount','officialMediaListingCount','officialTimedCaptionListingCount',
  'officialYoutubeIdConfirmedCount','sourceRuntimeVerifiedCount','sourceEditionMatchedCount',
  'scopedRightsApprovedCount','mediaIngestApprovedCount','independentBlindGoldApproved',
  'externalProviderCalls','actualSpendUsd','g3Authorized',
  'noVideoOrCaptionsDownloadedByThisResearch','outputDoesNotCertifyRealMediaOrRights'],'root');
 gate(doc.schemaVersion===1&&doc.registryId==='YU_VIDEO_G2H1_NASA_METADATA_SOURCE_READINESS_V01'&&
  doc.auditedAt==='2026-11-09'&&doc.status==='PUBLIC_METADATA_REVIEW_ONLY_SOURCES_UNAPPROVED'&&
  doc.baselineContract==='G0_6_FILMS_36_QUESTIONS_UNCHANGED'&&doc.phase==='G2-H1_SOURCE_AND_RIGHTS_RESEARCH',
  'H1 identity and original contract');
 gate(doc.researchCandidateCount===2&&doc.officialMediaListingCount===2&&
  doc.officialTimedCaptionListingCount===1&&doc.officialYoutubeIdConfirmedCount===1&&
  doc.sourceRuntimeVerifiedCount===0&&doc.sourceEditionMatchedCount===0&&
  doc.scopedRightsApprovedCount===0&&doc.mediaIngestApprovedCount===0&&
  doc.independentBlindGoldApproved===0&&doc.externalProviderCalls===0&&
  doc.actualSpendUsd===0&&doc.g3Authorized===false&&
  doc.noVideoOrCaptionsDownloadedByThisResearch===true&&
  doc.outputDoesNotCertifyRealMediaOrRights===true,
  'H1 public research cannot claim actual source, rights, gold or G3 authorization');
 gate(Array.isArray(doc.sources)&&doc.sources.length===2,'NASA and YouTube policy sources required');
 const urls=['https://www.nasa.gov/nasa-brand-center/images-and-media/',
  'https://developers.google.com/youtube/terms/developer-policies'];
 const srcSeen=new Set();
 for(const source of doc.sources){
  exact(source,['key','url','finding'],'policy source');
  gate(urls.includes(source.url)&&!srcSeen.has(source.url)&&
   typeof source.finding==='string'&&source.finding.length>70,'authoritative cited policy scope');
  srcSeen.add(source.url);
 }
 gate(Array.isArray(doc.candidates)&&doc.candidates.length===2,'two selected research metadata checks');
 gate(prior&&Array.isArray(prior.candidates)&&prior.candidates.length===6&&
  plan&&Array.isArray(plan.entries)&&plan.entries.length===4,'previous G2B/G2H public plan');
 const original=new Map(prior.candidates.map(c=>[c.slot,c]));
 const expanded=new Map(plan.entries.map(c=>[c.slot,c]));
 const seen=new Set();
 for(const c of doc.candidates){
  exact(c,['slot','category','title','officialPage','reportedReleaseDate','officialCredit','assets',
   'officialMovieListed','officialTimedCaptionListed','officialTranscriptListed',
   'officialYouTubePlayerObserved','officialYouTubeId','youtubeIdEstablished',
   'originalVersusYouTubeEditionVerified','videoDurationMsVerified','durationWithinG0ThreeToFifteenMin',
   'captionAudioAlignmentVerified','localMediaBytesInspected','rightsForYoutopiaServiceApproved',
   'thirdPartyCreditsRequireReview','identifiablePeopleRightsRequireReview',
   'status','blockers','nextReadOnlyAction'],'candidate');
  const standard=known[c.slot],older=original.get(c.slot),blueprint=expanded.get(c.slot);
  gate(standard&&!seen.has(c.slot)&&older&&blueprint,'unknown or duplicate metadata slot');
  seen.add(c.slot);
  gate(c.officialPage===standard.page&&c.category===standard.category&&
   older.primarySource===c.officialPage&&older.category===c.category&&
   blueprint.officialSource===c.officialPage&&blueprint.category===c.category,
   'canonical G2B/G2H source/genre mismatch');
  gate(typeof c.title==='string'&&c.title.length>20&&
   typeof c.officialCredit==='string'&&c.officialCredit.length>=12&&
   /^\d{4}-\d{2}-\d{2}$/.test(c.reportedReleaseDate),
   'published official metadata scope');
  gate(c.officialMovieListed===true&&c.officialYouTubePlayerObserved===true&&
   c.officialTimedCaptionListed===standard.hasTimedCaptions&&
   c.officialTranscriptListed===standard.hasTranscript&&
   older.officialTimedCaptionsListed===c.officialTimedCaptionListed&&
   older.officialTranscriptListed===c.officialTranscriptListed,
   'official media/caption listings cannot contradict source');
  gate(c.officialYouTubeId===standard.officialYouTubeId&&
   c.youtubeIdEstablished===(standard.officialYouTubeId!==null),
   'YouTube ID cannot be guessed');
  if(c.youtubeIdEstablished){
   gate(older.youtubeWatchUrl==='https://www.youtube.com/watch?v='+c.officialYouTubeId&&
    older.youtubeMappingBasis==='OFFICIAL_SOURCE_EMBED_ID',
    'YouTube ID requires publisher source embed');
  }else gate(older.youtubeWatchUrl===null,'unverified official video must keep null ID');
  gate(c.originalVersusYouTubeEditionVerified===false&&c.videoDurationMsVerified===null&&
   c.durationWithinG0ThreeToFifteenMin==='UNKNOWN_UNVERIFIED'&&
   c.captionAudioAlignmentVerified===false&&c.localMediaBytesInspected===false&&
   c.rightsForYoutopiaServiceApproved===false&&
   c.thirdPartyCreditsRequireReview===true&&c.identifiablePeopleRightsRequireReview===true&&
   c.status==='PUBLIC_ASSETS_DOCUMENTED_SELECTION_BLOCKED',
   'unverified duration, versions, rights or people status promoted');
  gate(Array.isArray(c.assets)&&c.assets.length===standard.assetKinds.length&&
   equals(c.assets.map(a=>a.kind),standard.assetKinds),
   'official asset listing or order changed');
  for(const a of c.assets){
   exact(a,['kind','resolution','fps','listedSizeMb'],'metadata asset');
   const isMovie=a.kind.startsWith('MP4');
   gate(isMovie?(a.resolution==='1920x1080'&&a.listedSizeMb>20&&a.listedSizeMb<200):
     (a.resolution===null&&a.fps===null&&a.listedSizeMb===null),
    'media metadata may not masquerade as acquired bytes');
  }
  gate(Array.isArray(c.blockers)&&c.blockers.length>=5&&
   c.blockers.every(b=>typeof b==='string'&&/^[A-Z0-9_]{15,100}$/.test(b))&&
   typeof c.nextReadOnlyAction==='string'&&c.nextReadOnlyAction.length>=100,
   'all outstanding research gates and next read-only action required');
 }
 return {stage:'G2-H1',status:'PUBLIC_METADATA_RESEARCH_COMPLETE_SOURCE_ELIGIBILITY_BLOCKED',
  checkedCandidates:2,officialVideoListings:2,officialTimedCaptionListings:1,
  officialYouTubeIdsEstablished:1,verifiedFilmRuntimes:0,verifiedSameEditPairs:0,
  scopedRightsApproved:0,realMediaIngestApproved:0,blindGoldApproved:0,
  g3Authorized:false,externalProviderCalls:0,actualSpendUsd:0,
  next:'CANDIDATE_ORIGIN_AND_RIGHTS_REVIEW_NO_MEDIA_DOWNLOAD'};
}
function inspect(){
 return validate(JSON.parse(fs.readFileSync(file,'utf8')),
  JSON.parse(fs.readFileSync(g2b,'utf8')),JSON.parse(fs.readFileSync(g2h,'utf8')));
}
if(require.main===module){
 try{process.stdout.write(JSON.stringify(inspect(),null,2)+'\n');}
 catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
}
module.exports={validate,inspect,known};
