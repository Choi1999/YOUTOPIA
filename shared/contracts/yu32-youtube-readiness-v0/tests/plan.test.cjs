"use strict";

/** YU-32 G4-5. Purely offline: no network or external provider setup. */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  proposeFirstPublicCommentRead, policyGateSnapshot, POLICY_HOLD
} = require("../source-plan.cjs");

const root = path.resolve(__dirname,"..");
const code = fs.readFileSync(path.join(root,"source-plan.cjs"),"utf8");
const matrix = JSON.parse(fs.readFileSync(path.join(root,"policy-gates.json"),"utf8"));
const video = "Ab0_-123xyz";

function proposal(options={}) {
  return proposeFirstPublicCommentRead({videoIds:[video],...options});
}

test("G45-C01: single-video first-page proposal is blocked and synthetic-free",()=>{
  const x=proposal();
  assert.equal(x.contractVersion,"YU32_G4_5_OFFLINE_V01");
  assert.equal(x.status,"OFFLINE_CANDIDATE_ONLY");
  assert.equal(x.providerPolicy,POLICY_HOLD);
  assert.equal(x.collectionAuthorized,false);
  assert.equal(x.networkRequestsPermitted,0);
  assert.equal(x.youtubeResultsFetched,0);
  assert.equal(x.originalCommentsPersisted,0);
  assert.equal(x.derivedMetricsAuthorized,false);
  assert.equal(x.sentimentOutput,null);
  assert.equal(x.sampleIsPopulation,false);
  assert.equal(x.repliesComplete,false);
});
test("G45-C02: query descriptor is bounded and never a runnable URL",()=>{
  const x=proposal();
  assert.equal(x.requestCandidates.length,1);
  assert.deepEqual(x.requestCandidates[0],{
    method:"commentThreads.list",source:"YOUTUBE",targetType:"VIDEO",
    targetId:video,part:"snippet",maxResults:100,order:"time",
    textFormat:"plainText",maxPages:1,nextPageToken:null,
    expectedQuotaUnitsForOneRequest:1
  });
  assert.equal(x.plannedUpperBoundRequests,1);
  assert.equal(x.plannedQuotaUnitsWithoutRetries,1);
  assert.equal("url" in x.requestCandidates[0],false);
  assert.equal("apiKey" in x.requestCandidates[0],false);
});
test("G45-C03: up to three different VIDEO identifiers have a 3-unit candidate bound",()=>{
  const x=proposeFirstPublicCommentRead({
    videoIds:[video,"Zb0_-123xyz","Xb0_-123xyz"],maxResults:20,
    pageLimit:1,order:"time",textFormat:"plainText",includeReplies:false
  });
  assert.equal(x.requestCandidates.length,3);
  assert.equal(x.plannedUpperBoundRequests,3);
  assert.equal(x.plannedQuotaUnitsWithoutRetries,3);
  assert.ok(x.requestCandidates.every(v=>v.maxResults===20 && v.maxPages===1));
});
test("G45-C04: invalid target types, handles, URLs and non-canonical IDs are rejected",()=>{
  for(const id of ["abc","@handle","https://youtu.be/Ab0_-123xyz",
      "Ab0_-123xy!","Ab0_-123xyza","한글영상식별"])
    assert.throws(()=>proposal({videoIds:[id]}),/G45_OFFLINE_INVALID/);
});
test("G45-C05: undefined or zero/four video IDs are rejected",()=>{
  for(const ids of [undefined,null,"Ab0_-123xyz",[],[video,video,video,video]])
    assert.throws(()=>proposeFirstPublicCommentRead({videoIds:ids}),/G45_OFFLINE_INVALID/);
});
test("G45-C06: duplicate VIDEO IDs are not silently counted as separate scope",()=>{
  assert.throws(()=>proposal({videoIds:[video,video]}),/duplicate/);
});
test("G45-C07: maxResults must be an integer from 1 through 100",()=>{
  for(const n of [0,101,-1,1.1,NaN,Infinity,"100",null])
    assert.throws(()=>proposal({maxResults:n}),/maxResults/);
  assert.equal(proposal({maxResults:1}).requestCandidates[0].maxResults,1);
  assert.equal(proposal({maxResults:100}).requestCandidates[0].maxResults,100);
});
test("G45-C08: additional pages, relevance order or HTML are outside the first PoC",()=>{
  for(const input of [{pageLimit:0},{pageLimit:2},{order:"relevance"},
    {textFormat:"html"},{pageLimit:"1"}])
    assert.throws(()=>proposal(input),/G45_OFFLINE_INVALID/);
});
test("G45-C09: replies are separate and cannot be enabled by a Boolean",()=>{
  assert.throws(()=>proposal({includeReplies:true}),/reply enumeration/);
  assert.equal(proposal({includeReplies:false}).repliesComplete,false);
});
test("G45-C10: client-side approval/tenant/role/secret/URL override cannot open collection",()=>{
  for(const extra of [
    {policyApproved:true},{approved:true},{sourceType:"APPROVED_PROVIDER"},
    {tenantId:"tenant-A"},{role:"ADMIN"},{apiKey:"secret"},{oauthToken:"secret"},
    {enabled:true},{url:"https://example.test"}
  ]) assert.throws(()=>proposal(extra),/unexpected option/);
});
test("G45-C11: getters, Symbols and inherited prototype objects are rejected",()=>{
  const x={videoIds:[video]};
  Object.defineProperty(x,"maxResults",{get(){throw new Error("getter invoked");},enumerable:true});
  assert.throws(()=>proposeFirstPublicCommentRead(x),/accessor/);
  assert.throws(()=>proposeFirstPublicCommentRead({videoIds:[video],[Symbol("x")]:1}),/unexpected option/);
  assert.throws(()=>proposeFirstPublicCommentRead(new Date()),/plain object/);
});
test("G45-C12: output does not mutate inputs and proposal object is frozen",()=>{
  const ids=[video];
  const input={videoIds:ids};
  const x=proposeFirstPublicCommentRead(input);
  assert.deepEqual(ids,[video]);
  assert.ok(Object.isFrozen(x)&&Object.isFrozen(x.requestCandidates));
  assert.ok(Object.isFrozen(x.requestCandidates[0]));
});
test("G45-C13: policy gate never claims an approval or provider read",()=>{
  const gate=policyGateSnapshot();
  assert.equal(gate.providerPolicy,POLICY_HOLD);
  assert.equal(gate.rawCommentRead,"NOT_AUTHORIZED");
  assert.equal(gate.derivedMetrics,"NOT_AUTHORIZED");
  assert.equal(gate.liveApiRequests,0);
  assert.equal(gate.sourceProjectVerified,false);
  assert.equal(gate.totalProviderEvidenceVerified,0);
  assert.equal(gate.rawRetention,"NOT_APPROVED");
});
test("G45-C14: evidence register has 12 unique IDs and zero approved gates",()=>{
  assert.equal(matrix.contractVersion,"YU32_G4_5_PROVIDER_GATES_V01");
  assert.equal(matrix.status,"POLICY_HOLD");
  assert.equal(matrix.liveCallsAuthorized,false);
  assert.equal(matrix.derivedSentimentAuthorized,false);
  assert.equal(matrix.verifiedCount,0);
  assert.equal(matrix.evidence.length,12);
  const ids=matrix.evidence.map(g=>g.id);
  assert.equal(new Set(ids).size,12);
  for(let i=1;i<=12;i++)
    assert.ok(ids.includes("Y45-E"+String(i).padStart(2,"0")));
  assert.ok(matrix.evidence.every(g=>
    ["UNVERIFIED","POLICY_HOLD","NOT_IMPLEMENTED","NOT_APPROVED"].includes(g.status)));
});
test("G45-C15: read permission and derived-metric approval are distinct gates",()=>{
  const gates=Object.fromEntries(matrix.evidence.map(g=>[g.id,g]));
  assert.equal(gates["Y45-E05"].gate,"LIVE_READ");
  assert.equal(gates["Y45-E06"].gate,"DERIVED_METRICS");
  assert.equal(gates["Y45-E11"].gate,"LIVE_READ");
  assert.equal(gates["Y45-E12"].gate,"PRODUCTION");
});
test("G45-C16: module has no network, credential, scraper, SDK or executable connector",()=>{
  assert.doesNotMatch(code,/\bfetch\s*\(|\baxios\b|XMLHttpRequest|https?\.request|node:https?|node:net|puppeteer|playwright|googleapis/);
  assert.doesNotMatch(code,/youtube\.com|youtube\.googleapis\.com|googleapis\.com|apiKey\s*:/);
  assert.doesNotMatch(code,/process\.env|require\(["'](?:http|https|net)/);
});
