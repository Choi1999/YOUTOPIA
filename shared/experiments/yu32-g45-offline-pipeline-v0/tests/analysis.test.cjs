"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const {buildSyntheticSnapshot,classifySourceFailure}=require("../src/pipeline.cjs");
const {classifySyntheticText}=require("../src/synthetic-classifier.cjs");
const schema=JSON.parse(fs.readFileSync(path.join(root,"../../contracts/analysis-v1/analysis.schema.json"),"utf8"));
const read=n=>JSON.parse(fs.readFileSync(path.join(root,"fixtures",n+".json"),"utf8"));
test("G45-A01: partial first-page synthetic analysis has grounded denominator counts",()=>{
  const {snapshot:s,evidence:e}=buildSyntheticSnapshot(read("partial"));
  assert.equal(s.status,"PARTIAL");
  assert.equal(s.sample.rawCount,5);
  assert.equal(s.sample.eligibleCount,4);
  assert.equal(s.sample.excludedCount,1);
  assert.equal(s.sample.classifiedCount,3);
  assert.equal(s.sample.unclassifiedCount,1);
  assert.deepEqual(s.sentiment,{positive:1,neutral:1,negative:1});
  assert.equal(e.nextPageAvailable,true);
  assert.equal(e.providerRequestsMade,0);
});
test("G45-A02: categories are topic mentions, not false probability partitions",()=>{
  const s=buildSyntheticSnapshot(read("partial")).snapshot;
  assert.deepEqual(s.topics,[
    {topicId:"AUDIO",mentionCount:1,classifiedTopicCount:1,negativeTopicCount:1},
    {topicId:"CAPTIONS",mentionCount:1,classifiedTopicCount:1,negativeTopicCount:0},
    {topicId:"EDITING",mentionCount:1,classifiedTopicCount:1,negativeTopicCount:0}
  ]);
});
test("G45-A03: complete, fully-classified synthetic page can be READY (never provider-ready)",()=>{
  const s=buildSyntheticSnapshot(read("ready")).snapshot;
  assert.equal(s.status,"READY");
  assert.equal(s.sourceType,"STATIC_FIXTURE");
  assert.equal(s.isSynthetic,true);
  assert.equal(s.sample.classifiedCount,2);
  assert.equal(s.sample.unclassifiedCount,0);
  assert.deepEqual(s.sentiment,{positive:1,neutral:0,negative:1});
});
test("G45-A04: empty, successful first-page observation is NO_DATA without fabricated 0%",()=>{
  const {snapshot:s,evidence:e}=buildSyntheticSnapshot(read("empty"));
  assert.equal(s.status,"NO_DATA");
  assert.equal(s.sample,null);
  assert.equal(s.sentiment,null);
  assert.deepEqual(s.topics,[]);
  assert.equal(s.analyzedAt,null);
  assert.equal(s.analysisVersion,null);
  assert.equal(e.providerRequestsMade,0);
});
test("G45-A05: unknown prose abstains instead of forced sentiment",()=>{
  const label=classifySyntheticText("단순한 안내 공지입니다.");
  assert.equal(label.sentiment,null);
  assert.deepEqual(label.topics,[]);
});
test("G45-A06: conflicting positive and negative signals abstain",()=>{
  const label=classifySyntheticText("편집이 좋아요. 소리는 아쉬워요.");
  assert.equal(label.sentiment,null);
  assert.deepEqual(label.topics,["EDITING","AUDIO"]);
});
test("G45-A07: neutral requires an explicit synthetic neutral cue",()=>{
  assert.equal(classifySyntheticText("자막은 무난해요.").sentiment,"neutral");
  assert.equal(classifySyntheticText("자막이 있습니다.").sentiment,null);
});
test("G45-A08: topic tagging is multi-label, classification still one comment",()=>{
  const label=classifySyntheticText("편집이 좋아요. 자막도 좋아요.");
  assert.equal(label.sentiment,"positive");
  assert.deepEqual(label.topics,["EDITING","CAPTIONS"]);
});
test("G45-A09: out-of-window comments never add sentiment or topic counts",()=>{
  const a=read("ready");
  a.response.items[0].snippet.topLevelComment.snippet.publishedAt="2026-10-01T10:00:00Z";
  a.response.items[0].snippet.topLevelComment.snippet.updatedAt="2026-10-01T10:00:00Z";
  const s=buildSyntheticSnapshot(a).snapshot;
  assert.equal(s.sample.rawCount,2);
  assert.equal(s.sample.eligibleCount,1);
  assert.equal(s.sample.excludedCount,1);
  assert.equal(s.sample.classifiedCount,1);
  assert.equal(s.sentiment.positive,0);
  assert.equal(s.sentiment.negative,1);
});
test("G45-A10: if all sampled comments fall outside window, do not label NO_DATA",()=>{
  const a=read("ready");
  for(const thread of a.response.items){
    const sn=thread.snippet.topLevelComment.snippet;
    sn.publishedAt="2026-10-01T10:00:00Z";
    sn.updatedAt=sn.publishedAt;
  }
  const s=buildSyntheticSnapshot(a).snapshot;
  assert.equal(s.status,"PARTIAL");
  assert.equal(s.sample.rawCount,2);
  assert.equal(s.sample.eligibleCount,0);
  assert.equal(s.sample.classifiedCount,0);
  assert.deepEqual(s.sentiment,{positive:0,neutral:0,negative:0});
});
test("G45-A11: one topic may count one unclassified mention but no negative classified",()=>{
  const a=read("ready");
  a.response.items[0].snippet.topLevelComment.snippet.textOriginal="편집 안내";
  const s=buildSyntheticSnapshot(a).snapshot;
  assert.equal(s.status,"PARTIAL");
  assert.equal(s.sample.classifiedCount,1);
  assert.deepEqual(s.topics.find(t=>t.topicId==="EDITING"),
    {topicId:"EDITING",mentionCount:1,classifiedTopicCount:0,negativeTopicCount:0});
});
test("G45-A12: no author identity, raw text, provider reply, or page token escapes output",()=>{
  for(const n of ["partial","ready","empty"]){
    const result=buildSyntheticSnapshot(read(n));
    const out=JSON.stringify(result);
    assert.ok(!out.includes("SYNTHETIC_USER"),n);
    assert.ok(!out.includes("아쉬워요"),n);
    assert.ok(!out.includes("SYNTHETIC_NEXT_PAGE"),n);
    assert.ok(!out.includes("https://example.invalid"),n);
    assert.ok(!out.includes("synthetic-comment-"),n);
    assert.ok(!out.includes("synthetic-thread-"),n);
  }
});
test("G45-A13: snapshot keys and REQUIRED properties match existing analysis-v1 contract",()=>{
  const def=schema.$defs.AnalysisSnapshot;
  for(const n of ["partial","ready","empty"]){
    const s=buildSyntheticSnapshot(read(n)).snapshot;
    assert.deepEqual(Object.keys(s).sort(),Object.keys(def.properties).sort());
    assert.ok(def.required.every(k=>Object.hasOwn(s,k)));
    assert.ok(def.properties.status.enum.includes(s.status));
    assert.ok(def.properties.sourceType.enum.includes(s.sourceType));
    assert.equal(s.contractVersion,def.properties.contractVersion.const);
    assert.equal(s.target.targetType,"VIDEO");
  }
});
test("G45-A14: public synthetic result never implies provider use permission",()=>{
  const {snapshot:s,evidence:e}=buildSyntheticSnapshot(read("partial"));
  assert.equal(s.visibility,"PUBLIC_REUSABLE");
  assert.equal(s.tenantId,null);
  assert.equal(e.externalProviderApproved,false);
  assert.equal(e.derivedMetricsApproved,false);
  assert.equal(e.rawCommentPersistence,"NONE");
  assert.equal(e.trendStatus,"TREND_UNAVAILABLE");
  assert.equal(e.classificationModel,"SYNTHETIC_RULES_UNVALIDATED");
});
test("G45-A15: errors are not converted to zero comments or READY",()=>{
  for(const reason of ["quotaExceeded","forbidden","videoNotFound","unknown"]){
    const d=classifySourceFailure(reason);
    assert.ok(["ERROR","POLICY_BLOCKED"].includes(d.status));
    assert.equal(d.sentiment,null);
    assert.equal(d.sample,null);
    assert.deepEqual(d.topics,[]);
  }
});
test("G45-A16: comments disabled is distinct from successful empty page",()=>{
  const d=classifySourceFailure("commentsDisabled");
  const s=buildSyntheticSnapshot(read("empty")).snapshot;
  assert.equal(d.status,"COMMENTS_DISABLED");
  assert.equal(s.status,"NO_DATA");
});
test("G45-A17: all synthetic fixture results have no live quota consumption",()=>{
  for(const n of ["partial","ready","empty"]){
    const {evidence:e}=buildSyntheticSnapshot(read(n));
    assert.equal(e.providerRequestsMade,0);
    assert.equal(e.quotaUnitsConsumed,0);
    assert.equal(e.repliesNotEnumerated,true);
    assert.equal(e.profileInference,"NONE");
    assert.equal(e.topicsNotProbability,true);
  }
});
test("G45-A18: provenance mislabeling as approved provider throws rather than displays numbers",()=>{
  const a=read("ready");
  a.sourceType="APPROVED_PROVIDER";
  assert.throws(()=>buildSyntheticSnapshot(a),/G45_FIXTURE_INVALID/);
});
