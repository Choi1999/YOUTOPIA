"use strict";
/* YU-49: cross-surface synthetic fixture availability and preview semantics. */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..", "..");
const read = file => fs.readFileSync(path.join(root,file),"utf8");
const ctx=vm.createContext({});
vm.runInContext(read("extension/hover-card-model.js"),ctx);
const model=ctx.YUTOPIA_HOVER_CARD_MODEL;
const videos=["Ab0_-123xyz","Qb0_-123xyz","Cb0_-123xyz","Db0_-123xyz"];
const channels=["UC"+"A".repeat(22),"UC"+"B".repeat(22)];

test("YU49-01 Web fixtures and independent Side Panel availability allowlists agree",()=>{
  assert.deepEqual(Array.from(model.registeredVideoIds),videos);
  assert.deepEqual(Array.from(model.registeredChannelIds),channels);
  const sourceFiles=[
    "frontend/src/features/analysis/data/demoReadySnapshot.ts",
    "frontend/src/features/analysis/data/demoComparisonSnapshot.ts",
    "frontend/src/features/analysis/data/demoChannelBSnapshots.ts",
  ].map(read).join("\n");
  for(const video of videos)assert.match(sourceFiles,new RegExp(video));
  const selection=read("frontend/src/features/analysis/data/demoChannelSelection.ts");
  assert.match(selection,/channelId: "UC" \+ "A"\.repeat\(22\)/);
  assert.match(selection,/channelId: "UC" \+ "B"\.repeat\(22\)/);
  for(const id of videos)assert.match(selection,new RegExp(id));
});

test("YU49-02 only registered explicit synthetic targets can say Web fixture available",()=>{
  for(const id of videos) {
    const value=model.mockForTarget({targetType:"VIDEO",targetId:id});
    assert.equal(value.webAvailability,"WEB_SYNTHETIC_REGISTERED");
    assert.match(value.webAvailabilityLabel,/미리보기의 가상 수치는 그 결과가 아닙니다/);
    assert.equal(value.previewContract.valueSemantics,"ILLUSTRATIVE_ONLY");
    assert.equal(value.previewContract.sentimentDenominator,null);
    assert.equal(value.previewContract.analyzedAt,null);
  }
  for(const id of channels) {
    const value=model.mockForTarget({targetType:"CHANNEL",targetId:id});
    assert.equal(value.webAvailability,"WEB_SYNTHETIC_REGISTERED");
  }
});

test("YU49-03 valid but unregistered VIDEO and CHANNEL never imply Web data",()=>{
  for(const [type,id] of [
    ["VIDEO","Zb0_-123xyz"],["CHANNEL","UC"+"Z".repeat(22)],
  ]) {
    const value=model.mockForTarget({targetType:type,targetId:id});
    assert.equal(value.webAvailability,"WEB_DATA_NOT_FOUND");
    assert.match(value.webAvailabilityLabel,/웹에 등록된 분석 자료가 없습니다/);
    assert.equal(value.previewContract.valueSemantics,"ILLUSTRATIVE_ONLY");
    assert.equal(value.previewContract.sentimentCounts,null);
  }
});

test("YU49-04 invalid targets cannot trick availability or create mock models",()=>{
  assert.equal(model.mockForTarget({targetType:"VIDEO",targetId:"../../bad"}),null);
  assert.equal(model.mockForTarget({targetType:"CHANNEL",targetId:"@unverified"}),null);
  assert.equal(model.webAvailability("VIDEO","Ab0_-123xyz&token=secret"),
    "WEB_DATA_NOT_FOUND");
});

test("YU49-05 hover and Side Panel labels stay demo-only without external network",()=>{
  const hover=read("extension/hover-card.js");
  const panel=read("extension/sidepanel.js");
  const html=read("extension/sidepanel.html");
  assert.match(hover,/YU-49: Web's explicitly registered synthetic fixture availability/);
  assert.match(panel,/demo-web-availability/);
  assert.match(html,/ILLUSTRATIVE_ONLY/);
  assert.doesNotMatch(panel,/\bfetch\s*\(|XMLHttpRequest/);
  assert.doesNotMatch(read("extension/hover-card-model.js"),/\bfetch\s*\(|XMLHttpRequest/);
});
