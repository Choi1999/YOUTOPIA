"use strict";
/**
 * UI-R04-O: offline-only, backend-candidate metadata read boundary.
 *
 * This module has NO network client, transport, credentials, API keys, file
 * writes, environment-variable reads, HTTP routes, or client-side import.
 * A YouTube-shaped JSON body is NEVER proof of real provider provenance.
 * A future separately approved server transport must own authentication,
 * quota reservation, TTL/retention, and publication gates.
 */
const {TextDecoder}=require("node:util");
const gates=require("../../../contracts/yu32-youtube-readiness-v0/policy-gates.json");

const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const CHANNEL=/^UC[A-Za-z0-9_-]{22}$/;
const HANDLE=/^@[\p{L}\p{N}._-]{3,30}$/u;
const CONTROL=/[\u0000-\u001f\u007f]/;
const MAX_TARGETS=3;
const MAX_BODY_BYTES=256*1024;
const CACHE_TTL_MS=15*60*1000;
const CACHE_LIMIT=64;
const HOSTS=Object.freeze({
  VIDEO:new Set(["i.ytimg.com"]),
  CHANNEL:new Set(["yt3.ggpht.com","yt3.googleusercontent.com"])
});
const SUPPORTED=new Set(["videoIds","channelIds","handles"]);
const PLANS=new WeakSet();
const DECODED_RECORDS=new WeakSet();

function deny(reason) {
  const error=new TypeError("R04O_METADATA_"+reason);
  error.code="R04O_METADATA_"+reason;
  throw error;
}
function hold() {
  // Compile-time implementation is offline ONLY. Even changing policy-gates
  // in a later PR cannot activate a transport through this module.
  if(gates.status!=="POLICY_HOLD"||
    gates.liveCallsAuthorized!==false||
    gates.externalDataCollected!==false||
    gates.derivedSentimentAuthorized!==false||
    gates.verifiedCount!==0)deny("NOT_OFFLINE_POLICY_HOLD");
}
function record(value) {
  return value!==null&&typeof value==="object"&&!Array.isArray(value)&&
    (Object.getPrototypeOf(value)===Object.prototype||
      Object.getPrototypeOf(value)===null);
}
function list(value,regex) {
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>MAX_TARGETS)deny("TARGET_LIMIT");
  const result=[];
  for(let i=0;i<value.length;i++){
    const desc=Object.getOwnPropertyDescriptor(value,i);
    if(!desc||!Object.hasOwn(desc,"value")||
      typeof desc.value!=="string"||!regex.test(desc.value))
      deny("INVALID_TARGET");
    result.push(desc.value);
  }
  if(new Set(result).size!==result.length)deny("DUPLICATE_TARGET");
  return result;
}
function cleanHandle(value) {
  const normalized=value.normalize("NFC").toLocaleLowerCase("en-US");
  if(!HANDLE.test(normalized))deny("INVALID_HANDLE");
  return normalized;
}
function validTime(now) {
  if(!Number.isSafeInteger(now)||now<0)deny("INVALID_TIME");
  return now;
}
function candidate(method,filter,keys) {
  const isVideo=method==="videos.list";
  const fields=isVideo
    ? "items(kind,id,snippet(title,channelId,thumbnails)),pageInfo(totalResults,resultsPerPage)"
    : "items(kind,id,snippet(title,thumbnails)),pageInfo(totalResults,resultsPerPage)";
  return Object.freeze({
    method,host:"www.googleapis.com",path:isVideo?"/youtube/v3/videos":"/youtube/v3/channels",
    requestMethod:"GET",
    // A query descriptor is NOT a URL, credential or executable request.
    query:Object.freeze({part:"snippet",fields,...filter}),
    requestedKeys:Object.freeze([...keys]),
    expectedQuotaUnits:1,
    networkEnabled:false,
    credentialsAttached:false,
    automaticRetries:0,
    redirectsAllowed:false
  });
}

/**
 * Canonical inputs only. videos.list and channels.list each cost 1 quota unit
 * per call per Google's current reference, but this function spends zero.
 * 1-3 targets total, batched by ID type; handles require forHandle calls.
 */
function planOfflineMetadataRead(options) {
  hold();
  if(!record(options))deny("BAD_OPTIONS");
  const props=Reflect.ownKeys(options);
  for(const key of props) {
    const d=Object.getOwnPropertyDescriptor(options,key);
    if(typeof key!=="string"||!SUPPORTED.has(key)||
      !d||!Object.hasOwn(d,"value"))deny("UNEXPECTED_OPTIONS");
  }
  const videos=list(options.videoIds,VIDEO);
  const channels=list(options.channelIds,CHANNEL);
  const handles=list(options.handles,HANDLE).map(cleanHandle);
  if(new Set(handles).size!==handles.length)deny("DUPLICATE_TARGET");
  const total=videos.length+channels.length+handles.length;
  if(total<1||total>MAX_TARGETS)deny("TARGET_LIMIT");
  const requests=[];
  if(videos.length)requests.push(candidate("videos.list",
    {id:videos.join(",")},videos.map(id=>"VIDEO:"+id)));
  if(channels.length)requests.push(candidate("channels.list",
    {id:channels.join(",")},channels.map(id=>"CHANNEL:"+id)));
  for(const handle of handles)requests.push(candidate("channels.list",
    {forHandle:handle},["CHANNEL_HANDLE:"+handle]));
  const plannedQuotaUnits=requests.length;
  const result=Object.freeze({
    schema:"R04O_OFFLINE_METADATA_PLAN_V01",
    status:"NON_EXECUTABLE_CANDIDATE",
    providerPolicy:"POLICY_HOLD",
    networkEnabled:false, credentialsAccepted:false,
    providerRequestsMade:0, quotaUnitsConsumed:0,
    maxTargets:MAX_TARGETS,totalTargets:total,plannedQuotaUnits,
    sourceAuthenticated:false,consumerPublicationAuthorized:false,
    candidates:Object.freeze(requests)
  });
  PLANS.add(result);
  return result;
}
function validTitle(value) {
  if(typeof value!=="string"||value.length<1||value.length>160||
    CONTROL.test(value)||!value.trim())deny("INVALID_TITLE");
  return value.trim();
}
function safeImageUrl(raw,type) {
  if(typeof raw!=="string"||raw.length<12||raw.length>2048||
    CONTROL.test(raw))return null;
  try {
    const url=new URL(raw);
    if(url.protocol!=="https:"||!HOSTS[type].has(url.hostname.toLowerCase())||
      url.username||url.password||url.port||url.hash||url.pathname.length<2)
      return null;
    return raw; // never synthesize/modify a provider image URL
  } catch {return null;}
}
function thumbnail(snippet,type) {
  if(!record(snippet.thumbnails))return null;
  for(const key of ["high","medium","default"]) {
    const image=snippet.thumbnails[key];
    if(!record(image))continue;
    const url=safeImageUrl(image.url,type);
    if(url)return url;
  }
  return null;
}
function bodyObject(body) {
  if(!(typeof body==="string"||Buffer.isBuffer(body)))deny("INVALID_BODY");
  const bytes=Buffer.byteLength(body);
  if(bytes<2||bytes>MAX_BODY_BYTES)deny("BODY_LIMIT");
  try {
    const json=Buffer.isBuffer(body)
      ?new TextDecoder("utf-8",{fatal:true}).decode(body):body;
    const parsed=JSON.parse(json);
    if(!record(parsed))deny("BAD_RESPONSE");
    return parsed;
  } catch {deny("INVALID_JSON_OR_UTF8");}
}
function decodeOfflineMetadataShape(plan,index,body,now=Date.now()) {
  hold();validTime(now);
  if(!record(plan)||!PLANS.has(plan)||
    !Number.isInteger(index)||index<0||index>=plan.candidates.length)
    deny("UNTRUSTED_PLAN");
  const requested=plan.candidates[index];
  const page=bodyObject(body);
  const video=requested.method==="videos.list";
  const expectedKind=video?"youtube#videoListResponse":"youtube#channelListResponse";
  if(page.kind!==undefined&&page.kind!==expectedKind)deny("RESPONSE_KIND");
  if(!Array.isArray(page.items)||page.items.length>requested.requestedKeys.length||
    !record(page.pageInfo))deny("INVALID_PAGE");
  if(!Number.isSafeInteger(page.pageInfo.totalResults)||
    page.pageInfo.totalResults<page.items.length||
    !Number.isSafeInteger(page.pageInfo.resultsPerPage)||
    page.pageInfo.resultsPerPage!==page.items.length)
    deny("PAGE_COUNT");
  const isHandle=Object.hasOwn(requested.query,"forHandle");
  if(isHandle&&page.items.length>1)deny("HANDLE_AMBIGUOUS");
  const seen=new Set(),found=new Set(),normalized=[];
  for(const item of page.items) {
    if(!record(item)||item.kind!==(video?"youtube#video":"youtube#channel")||
      typeof item.id!=="string"||
      !(video?VIDEO:CHANNEL).test(item.id)||!record(item.snippet))
      deny("INVALID_ITEM");
    if(seen.has(item.id))deny("DUPLICATE_ITEM");
    seen.add(item.id);
    const key=isHandle?requested.requestedKeys[0]:
      (video?"VIDEO:":"CHANNEL:")+item.id;
    if(!requested.requestedKeys.includes(key))deny("WRONG_SCOPE");
    if(video&&(!CHANNEL.test(item.snippet.channelId)))
      deny("VIDEO_CHANNEL_ID");
    const title=validTitle(item.snippet.title);
    const value=Object.freeze({
      lookupKey:key,
      kind:video?"VIDEO":"CHANNEL",
      canonicalId:item.id,
      // For a handle lookup this is ONLY a candidate mapping from arbitrary
      // input JSON, NOT verified handle ownership/identity.
      handleResolutionCandidate:isHandle?item.id:null,
      title,
      thumbnailUrl:thumbnail(item.snippet,video?"VIDEO":"CHANNEL"),
      observedAt:now,
      sourceAuthenticated:false,
      consumerReady:false
    });
    DECODED_RECORDS.add(value);
    normalized.push(value);found.add(key);
  }
  return Object.freeze({
    schema:"R04O_OFFLINE_METADATA_SHAPE_V01",
    status:normalized.length?"SHAPE_VALIDATED_UNAUTHENTICATED":"EMPTY_UNAUTHENTICATED",
    providerPolicy:"POLICY_HOLD",
    providerRequestsMade:0, credentialsAccepted:false,
    sourceAuthenticated:false, consumerPublicationAuthorized:false,
    records:Object.freeze(normalized),
    unmatchedKeys:Object.freeze(requested.requestedKeys.filter(key=>!found.has(key)))
  });
}

/**
 * Bounded in-memory QA cache only. Never accepts caller-asserted provenance,
 * never writes storage, never refreshes TTL on access and never publishes
 * metadata to a consumer. Future server authorization is a separate feature.
 */
function createOfflineMetadataCache(maxEntries=CACHE_LIMIT) {
  hold();
  if(!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>CACHE_LIMIT)
    deny("INVALID_CACHE_LIMIT");
  const entries=new Map();
  function prune(now) {
    for(const [key,v] of entries)
      if(v.expiresAt<=now)entries.delete(key);
  }
  return Object.freeze({
    put(value,now=Date.now()) {
      hold();validTime(now);prune(now);
      if(!record(value)||!DECODED_RECORDS.has(value)||
        value.observedAt>now||now-value.observedAt>=CACHE_TTL_MS)
        return false;
      const key=value.lookupKey;
      entries.delete(key);
      while(entries.size>=maxEntries)entries.delete(entries.keys().next().value);
      entries.set(key,{value,expiresAt:value.observedAt+CACHE_TTL_MS});
      return true;
    },
    get(key,now=Date.now()) {
      hold();validTime(now);prune(now);
      return typeof key==="string"?entries.get(key)?.value??null:null;
    },
    clear() {hold();entries.clear();},
    get size(){hold();return entries.size;}
  });
}
module.exports=Object.freeze({
  MAX_TARGETS,MAX_BODY_BYTES,CACHE_TTL_MS,CACHE_LIMIT,
  planOfflineMetadataRead,decodeOfflineMetadataShape,
  createOfflineMetadataCache
});
