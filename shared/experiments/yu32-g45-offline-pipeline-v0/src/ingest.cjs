"use strict";
/**
 * G45 - pure synthetic-only adapter for the documented shape of
 * youtube#commentThreadListResponse (part=snippet).
 * No HTTP client, credential reader or persistent write API.
 * Does NOT authorize processing real fetched YouTube comments.
 */
const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const FIXTURE="G45_SYNTHETIC_RESPONSE_V01";
function invalid(reason){
  const error=new TypeError("G45_FIXTURE_INVALID:"+reason);
  error.code="G45_FIXTURE_INVALID";
  throw error;
}
function record(v){return v!==null&&typeof v==="object"&&!Array.isArray(v)&&
  (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);}
function boundedText(v,length=10000){
  return typeof v==="string"&&v.length>0&&v.length<=length;
}
function utc(v) {
  if(typeof v!=="string"||!(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)))
    invalid("invalid timestamp");
  const parsed=Date.parse(v);
  if(!Number.isFinite(parsed))invalid("invalid timestamp");
  const exact=v.includes(".")?v.replace(/\.(\d{1,3})Z$/,(_,digits)=>"."+digits.padEnd(3,"0")+"Z"):
    v.replace(/Z$/,".000Z");
  // Date.parse accepts impossible calendar dates on some runtimes; exact round trip
  // prevents Feb 30, overflow days or normalized hour/minute from silently passing.
  if(new Date(parsed).toISOString()!==exact)invalid("nonexistent timestamp");
  return parsed;
}
function unsigned(v){return Number.isSafeInteger(v)&&v>=0;}
function parseSyntheticCommentThreadsPage(source) {
  if(!record(source) || source.fixtureId!==FIXTURE || source.sourceType!=="STATIC_FIXTURE" ||
     source.isSynthetic!==true || source.providerRequestsMade!==0 || source.apiKeyUsed!==false)
    invalid("source provenance or execution gate");
  if(!VIDEO.test(source.videoId||"")) invalid("canonical VIDEO target");
  if(!record(source.scope)||source.scope.locale!=="ko-KR"||
     source.scope.mode!=="ONE_VIDEO"||
     Reflect.ownKeys(source.scope).length!==4||
     !["mode","windowStart","windowEnd","locale"].every(k=>Object.hasOwn(source.scope,k)))
    invalid("scope");
  const start=utc(source.scope.windowStart),end=utc(source.scope.windowEnd),
        captured=utc(source.observedAt),analyzed=utc(source.analyzedAt);
  if(!(start<end&&end<=analyzed&&captured<=analyzed))invalid("window ordering");
  const page=source.response;
  if(!record(page)||page.kind!=="youtube#commentThreadListResponse"||
     !record(page.pageInfo)||!Array.isArray(page.items)||
     page.items.length>100||!unsigned(page.pageInfo.totalResults)||
     !unsigned(page.pageInfo.resultsPerPage)||
     page.pageInfo.resultsPerPage>100||
     page.pageInfo.totalResults!==page.items.length||
     page.pageInfo.resultsPerPage!==page.items.length)
    invalid("first page structure or bounds");
  if(page.nextPageToken!==undefined&&
     !boundedText(page.nextPageToken,1000))invalid("next page token");
  const seen=new Set(),rows=[];
  for(const item of page.items) {
    if(!record(item)||item.kind!=="youtube#commentThread"||
       !boundedText(item.id,128)||seen.has(item.id)||
       !record(item.snippet)||item.snippet.videoId!==source.videoId||
       item.snippet.isPublic!==true||!unsigned(item.snippet.totalReplyCount)||
       Object.hasOwn(item,"replies")) invalid("thread identity, scope or unsupported replies");
    const top=item.snippet.topLevelComment;
    if(!record(top)||!boundedText(top.id,128)||!record(top.snippet)||
       top.snippet.videoId!==source.videoId||
       !boundedText(top.snippet.textOriginal,10000)||
       !boundedText(top.snippet.textDisplay,10000)||
       !unsigned(top.snippet.likeCount))invalid("top comment");
    const published=utc(top.snippet.publishedAt),updated=utc(top.snippet.updatedAt);
    if(updated<published || published>captured || updated>captured)
      invalid("impossible comment times");
    seen.add(item.id);
    // Deliberately do NOT copy author IDs, avatar URLs, URLs, or provider objects.
    rows.push({threadId:item.id,
      text:top.snippet.textOriginal.normalize("NFKC"),
      publishedAt:published,eligible:published>=start&&published<end,
      replyCount:item.snippet.totalReplyCount});
  }
  return {
    fixtureId:source.fixtureId,videoId:source.videoId,
    scope:{...source.scope},observedAt:source.observedAt,analyzedAt:source.analyzedAt,
    rows,rawCount:rows.length,hasNextPage:Boolean(page.nextPageToken),
    replyTotal:rows.reduce((a,b)=>a+b.replyCount,0),
    sourceType:"STATIC_FIXTURE",providerRequestsMade:0
  };
}
module.exports=Object.freeze({parseSyntheticCommentThreadsPage,FIXTURE});
