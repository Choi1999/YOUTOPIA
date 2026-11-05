'use strict';
// G2 is a source/provider DOCUMENTATION and offline eligibility inventory.
// Never fetch, download, upload, transcribe, call a provider, or authorize a live request.
const {benchmark,ARMS}=require('./g1-offline.cjs');
const REVIEWED_AT='2026-11-05';
const SOURCES=Object.freeze([
  {id:'GEMINI_VIDEO',type:'PROVIDER_CAPABILITY',url:'https://ai.google.dev/gemini-api/docs/video-understanding',observation:'PUBLIC_YOUTUBE_URL_PREVIEW',confidence:'DOCUMENTATION_ONLY'},
  {id:'GEMINI_MODEL',type:'PROVIDER_MODEL',url:'https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite',observation:'VIDEO_INPUT_DOCUMENTED',confidence:'DOCUMENTATION_ONLY'},
  {id:'GEMINI_PRICING',type:'PUBLIC_PRICING',url:'https://ai.google.dev/gemini-api/docs/pricing',observation:'STANDARD_PAID_PUBLIC_RATE_SNAPSHOT',confidence:'DOCUMENTATION_ONLY'},
  {id:'YOUTUBE_POLICY',type:'ACCESS_POLICY',url:'https://developers.google.com/youtube/terms/developer-policies',observation:'DOWNLOAD_CACHE_RESTRICTIONS',confidence:'DOCUMENTATION_ONLY'},
  {id:'YOUTUBE_CAPTIONS',type:'CAPTION_ACCESS',url:'https://developers.google.com/youtube/data/reference/rest/v3/captions/download',observation:'VIDEO_EDIT_AUTH_REQUIRED',confidence:'DOCUMENTATION_ONLY'},
  {id:'GEMINI_URL_CONTEXT',type:'WRONG_TOOL_GUARD',url:'https://ai.google.dev/gemini-api/docs/url-context',observation:'YOUTUBE_VIDEO_UNSUPPORTED_BY_URL_CONTEXT',confidence:'DOCUMENTATION_ONLY'}
]);
const PRICING=Object.freeze({provider:'GOOGLE_GEMINI',modelId:'gemini-3.5-flash-lite',billingTier:'PAID_STANDARD',reviewedAt:REVIEWED_AT,referenceId:'GEMINI_PRICING',perMillionInputUsd:0.30,perMillionOutputUsd:2.50,quoteStatus:'PUBLIC_PRICE_SNAPSHOT_NOT_BILLING',tokenMixMeasured:false});
const MODES=Object.freeze({
  NATIVE_MULTIMODAL:'PUBLIC_YOUTUBE_URL_VIA_GEMINI_VIDEO_INPUT',
  SEMANTIC_INDEX:'RIGHTS_CLEARED_MEDIA_WITH_DERIVATIVE_PERMISSION',
  TRANSCRIPT_ONLY:'RIGHTS_CLEARED_TRANSCRIPT_WITH_PROCESSING_PERMISSION'
});
function guard(v,message){if(!v)throw Error('G2_FAIL_CLOSED: '+message);}
function inventory(){
 const data=benchmark();
 return {
  schemaVersion:1,manifestId:'YU_VIDEO_G2_SOURCE_INVENTORY_V01',reviewedAt:REVIEWED_AT,
  provenance:'EMPTY_CANDIDATE_SLOTS_NOT_RIGHTS_APPROVAL',hasRealMedia:false,externalCalls:0,
  candidates:data.videos.map(v=>({
    videoRef:v.videoRef,category:v.genre,sourceKind:'NOT_SELECTED',videoLocator:null,
    mediaAttached:false,rightsState:'UNVERIFIED',rightsEvidenceLocation:null,
    verifiedByIndependentReviewer:false,permissionToAnalyze:false,
    permissionToTransmit:false,permissionToStoreDerivatives:false,
    accessScopeVerified:false,privacyAndRetentionReviewed:false,
    humanGoldLabelsVerified:false,humanReviewerCount:0,
    comparableAcrossAllArms:false
  }))
 };
}
function assessInventory(m){
 guard(m&&m.schemaVersion===1&&m.manifestId==='YU_VIDEO_G2_SOURCE_INVENTORY_V01','manifest schema');
 guard(m.provenance==='EMPTY_CANDIDATE_SLOTS_NOT_RIGHTS_APPROVAL'&&m.hasRealMedia===false&&m.externalCalls===0,'live input or external call');
 guard(Array.isArray(m.candidates)&&m.candidates.length===6,'requires six slots');
 const expected=new Map(benchmark().videos.map(v=>[v.videoRef,v.genre])),seen=new Set();
 const slots=m.candidates.map(c=>{
  guard(c&&expected.has(c.videoRef)&&!seen.has(c.videoRef),'unknown or duplicate candidate');seen.add(c.videoRef);
  guard(c.category===expected.get(c.videoRef),'category mismatch');
  guard(c.sourceKind==='NOT_SELECTED'&&c.videoLocator===null&&c.mediaAttached===false,'real source or URL injected');
  guard(c.rightsState==='UNVERIFIED'&&c.rightsEvidenceLocation===null&&c.verifiedByIndependentReviewer===false,'rights claim requires independent review');
  guard(c.permissionToAnalyze===false&&c.permissionToTransmit===false&&c.permissionToStoreDerivatives===false,'processing permission not established');
  guard(c.accessScopeVerified===false&&c.privacyAndRetentionReviewed===false,'privacy and source authorization unknown');
  guard(c.humanGoldLabelsVerified===false&&c.humanReviewerCount===0&&c.comparableAcrossAllArms===false,'gold labels or fairness unverified');
  return {videoRef:c.videoRef,sourceEligibility:'NOT_EVALUATED_NO_VIDEO',rightsEligibility:'UNVERIFIED',humanAnnotation:'NOT_STARTED',comparableAcrossArms:false,
   blockers:['VIDEO_NOT_SELECTED','RIGHTS_EVIDENCE_MISSING','TRANSMIT_AND_DERIVATIVE_PERMISSION_MISSING','PRIVACY_RETENTION_NOT_REVIEWED','TWO_HUMAN_REVIEWERS_NOT_COMPLETE','ARM_COMPARABILITY_UNKNOWN']};
 });
 return {phase:'G2',status:'RESEARCH_ONLY_BLOCKED',offlineOnly:true,externalCalls:0,actualSpendUsd:0,
   liveCallsAuthorized:false,approvedForG3:false,providerApiVerifiedForAccount:false,
   sourceRightsVerifiedCount:0,rightsClearedDatasetSize:0,questionsWithVerifiedHumanGold:0,
   sameDatasetAcrossThreeArmsVerified:false,sourceCandidates:slots};
}
function providerReview(){
 return {phase:'G2',reviewedAt:REVIEWED_AT,provider:'GOOGLE_GEMINI',
   documentationObserved:true,accountSpecificServiceEnabled:null,accountModelAccessVerified:false,
   publicYouTubeUrlSupport:'DOCUMENTED_PREVIEW_PUBLIC_ONLY',
   publicUrlFeatureFee:'DOCUMENTED_PREVIEW_NO_EXTRA_CHARGE_CHECK_AT_USE',
   apiModelPricing:PRICING,
   constraints:[
    'PUBLIC_VIDEO_ONLY_NO_PRIVATE_OR_UNLISTED',
    'URL_CONTEXT_NOT_VIDEO_INPUT',
    'OFFICIAL_YOUTUBE_CAPTIONS_DOWNLOAD_REQUIRES_VIDEO_EDIT_PERMISSION',
    'YOUTUBE_AUDIOVISUAL_DOWNLOAD_CACHE_RESTRICTED',
    'URL_FEATURE_SUPPORT_NOT_MEDIA_RIGHTS_CLEARANCE',
    'ACCOUNT_SPECIFIC_QUOTA_BILLING_TERMS_UNVERIFIED',
    'SAME_VIDEO_ALL_ARMS_REQUIRED_FOR_COMPARISON'
   ],
   references:SOURCES.map(s=>({id:s.id,type:s.type,url:s.url,observation:s.observation,confidence:s.confidence})),
   arms:ARMS.map(id=>({id,accessMode:MODES[id],availability:'DOCUMENTED_OR_PROPOSED_NOT_ACCOUNT_VERIFIED',
     datasetRights:'UNVERIFIED',quality:'NOT_MEASURED',approvedForLive:false}))
 };
}
function estimateTokenComponent({inputTokens,outputTokens},pricing=PRICING){
 guard(pricing&&pricing.quoteStatus==='PUBLIC_PRICE_SNAPSHOT_NOT_BILLING'&&pricing.referenceId==='GEMINI_PRICING','pricing provenance');
 guard(['inputTokens','outputTokens'].every(k=>Object.hasOwn({inputTokens,outputTokens},k)),'token fields');
 guard([inputTokens,outputTokens].every(v=>v===null||(Number.isSafeInteger(v)&&v>=0)),'invalid tokens');
 guard([pricing.perMillionInputUsd,pricing.perMillionOutputUsd].every(v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0)),'invalid rate');
 const known=[inputTokens,outputTokens,pricing.perMillionInputUsd,pricing.perMillionOutputUsd].every(v=>v!==null);
 const tokenComponentUsd=known?Math.round((inputTokens*pricing.perMillionInputUsd+outputTokens*pricing.perMillionOutputUsd)/1e6*1e8)/1e8:null;
 return {status:'DOCUMENTED_RATE_TOKEN_COMPONENT_ONLY',currency:'USD',modelId:pricing.modelId,referenceId:pricing.referenceId,reviewedAt:pricing.reviewedAt,
   inputTokens,outputTokens,tokenComponentUsd,estimatedEndToEndTotalUsd:null,realProviderUsageObserved:false,
   missing:['ACTUAL_MEDIA_TOKENS','TOOL_FEES_IF_ANY','SOURCE_RIGHTS_CLEARANCE','PREPROCESSING_OR_EXTRACTION_COST','STORAGE_AND_RETENTION','ACCOUNT_QUOTA_AND_BILLING','RETRIES_AND_ERROR_OVERHEAD'],
   canAuthorizeSpend:false};
}
function run(){
 const inv=assessInventory(inventory()),provider=providerReview();
 return {phase:'G2',status:'SOURCE_PROVIDER_DOCUMENT_REVIEW_ONLY',decision:'NO_GO_LIVE_SOURCE_RIGHTS_AND_ACCOUNT_EVIDENCE_MISSING',
   externalCalls:0,actualSpendUsd:0,liveCallsAuthorized:false,mergeApproved:false,
   source:inv,provider,illustrativeTokenComponent:estimateTokenComponent({inputTokens:60000,outputTokens:1000}),
   g1TestbedStillSynthetic:true};
}
if(require.main===module){
 if(process.argv.length!==2){process.stderr.write('G2_OFFLINE_ONLY: no parameters or URLs accepted\n');process.exitCode=1;}
 else process.stdout.write(JSON.stringify(run(),null,2)+'\n');
}
module.exports={REVIEWED_AT,SOURCES,PRICING,MODES,inventory,assessInventory,providerReview,estimateTokenComponent,run};
