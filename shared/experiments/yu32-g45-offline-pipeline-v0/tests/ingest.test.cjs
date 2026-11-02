"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {parseSyntheticCommentThreadsPage,FIXTURE}=require("../src/ingest.cjs");
const root=path.resolve(__dirname,"..");
const source=()=>JSON.parse(fs.readFileSync(path.join(root,"fixtures","partial.json"),"utf8"));
function rejected(mutator){
  const a=source();mutator(a);
  assert.throws(()=>parseSyntheticCommentThreadsPage(a),/G45_FIXTURE_INVALID/);
}
test("G45-I01: documented commentThreads response shape is read from fixed synthetic fixture",()=>{
  const a=source(),p=parseSyntheticCommentThreadsPage(a);
  assert.equal(a.response.kind,"youtube#commentThreadListResponse");
  assert.equal(a.sourceType,"STATIC_FIXTURE");
  assert.equal(a.providerRequestsMade,0);
  assert.equal(p.fixtureId,FIXTURE);
  assert.equal(p.rows.length,5);
  assert.equal(p.rawCount,5);
  assert.equal(p.hasNextPage,true);
  assert.equal(p.replyTotal,3);
});
test("G45-I02: no author, profile, URL, etag or raw response object copied into rows",()=>{
  const p=parseSyntheticCommentThreadsPage(source());
  const serialized=JSON.stringify(p);
  assert.ok(!serialized.includes("SYNTHETIC_USER_"));
  assert.ok(!serialized.includes("authorProfile"));
  assert.ok(!serialized.includes("https://"));
  assert.ok(!serialized.includes("SYNTHETIC_NEXT_PAGE_DO_NOT_FETCH"));
  assert.equal(p.rows[0].text.startsWith("편집"),true);
});
test("G45-I03: exact one-video scope matching is enforced",()=>{
  rejected(a=>a.videoId="@handle");
  rejected(a=>a.response.items[0].snippet.videoId="Zb0_-123xyz");
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.videoId="Zb0_-123xyz");
});
test("G45-I04: data must be genuinely marked fixture-only, zero provider calls",()=>{
  rejected(a=>a.sourceType="APPROVED_PROVIDER");
  rejected(a=>a.isSynthetic=false);
  rejected(a=>a.apiKeyUsed=true);
  rejected(a=>a.providerRequestsMade=1);
  rejected(a=>a.fixtureId="LIVE");
});
test("G45-I05: private or missing thread visibility cannot leak into public candidate",()=>{
  rejected(a=>a.response.items[0].snippet.isPublic=false);
  rejected(a=>delete a.response.items[0].snippet.isPublic);
});
test("G45-I06: non-first-page reply resources are not supported or automatically fetched",()=>{
  rejected(a=>a.response.items[0].replies={comments:[]});
  rejected(a=>a.response.items[0].snippet.totalReplyCount=-1);
});
test("G45-I07: duplicate thread ID or broken comment object is rejected",()=>{
  rejected(a=>a.response.items[1].id=a.response.items[0].id);
  rejected(a=>delete a.response.items[0].snippet.topLevelComment);
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.textOriginal=null);
});
test("G45-I08: bounded 100 threads and consistent pageInfo",()=>{
  rejected(a=>a.response.pageInfo.resultsPerPage=101);
  rejected(a=>a.response.pageInfo.totalResults=2);
  rejected(a=>a.response.items=Array.from({length:101},(_,i)=>({
    ...a.response.items[0],id:"test"+i
  })));
});
test("G45-I09: page token is never exposed, cannot be empty or oversized",()=>{
  rejected(a=>a.response.nextPageToken="");
  rejected(a=>a.response.nextPageToken="x".repeat(1001));
  const p=parseSyntheticCommentThreadsPage(source());
  assert.equal(p.hasNextPage,true);
  assert.equal(Object.hasOwn(p,"nextPageToken"),false);
});
test("G45-I10: wrong scope and calendar ordering are rejected",()=>{
  rejected(a=>a.scope.mode="SELECTED_CHANNEL_VIDEOS");
  rejected(a=>a.scope.locale="xx-XX");
  rejected(a=>a.scope.windowEnd=a.scope.windowStart);
  rejected(a=>a.analyzedAt="2026-10-01T00:00:00Z");
});
test("G45-I11: future/retroactive invalid comment timestamps are blocked",()=>{
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.updatedAt="2027-01-01T00:00:00Z");
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.updatedAt="2026-01-01T00:00:00Z");
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.publishedAt="bogus");
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.publishedAt="2026-02-30T01:00:00Z");
});
test("G45-I12: malformed top-level comment text and numeric counts are rejected",()=>{
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.textOriginal="");
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.textDisplay="");
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.textOriginal="x".repeat(10001));
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.likeCount="2");
});
test("G45-I13: empty valid success response has 0 rows but is not an API error",()=>{
  const x=JSON.parse(fs.readFileSync(path.join(root,"fixtures","empty.json"),"utf8"));
  const p=parseSyntheticCommentThreadsPage(x);
  assert.equal(p.rows.length,0);
  assert.equal(p.hasNextPage,false);
});
test("G45-I14: document response kind, pagination and top-level fields are not replaced by a fake format",()=>{
  rejected(a=>a.response.kind="anotherResponse");
  rejected(a=>a.response.items[0].kind="anotherThread");
  rejected(a=>a.response.items[0].snippet.topLevelComment.snippet.videoId=null);
});
