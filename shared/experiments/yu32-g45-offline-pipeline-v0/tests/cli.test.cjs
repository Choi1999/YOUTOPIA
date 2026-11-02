"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,"..");
const runner=path.join(root,"scripts","run-offline.cjs");
const code=fs.readFileSync(runner,"utf8");
const env={...process.env};
for(const key of ["GOOGLE_API_KEY","YOUTUBE_API_KEY","YOUTOPIA_YOUTUBE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS","YOUTUBE_OAUTH_TOKEN"])delete env[key];
const call=(args,extraEnv={})=>spawnSync(process.execPath,[runner,...args],{
  env:{...env,...extraEnv},encoding:"utf8",timeout:10000,maxBuffer:128*1024
});
test("G45-CLI01: no flags never starts an external request",()=>{
  const r=call([]);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/G45_PIPELINE_STOP/);
  assert.equal(r.stdout,"");
});
test("G45-CLI02: explicit --check reveals only static source restrictions",()=>{
  const r=call(["--check"]);
  assert.equal(r.status,0,r.stderr);
  const data=JSON.parse(r.stdout);
  assert.equal(data.status,"OFFLINE_PIPELINE_ONLY");
  assert.equal(data.providerRequests,0);
  assert.equal(data.liveComments,0);
  assert.equal(data.policy,"POLICY_HOLD");
  assert.equal(data.derivedProviderMetricsApproved,false);
  assert.deepEqual(data.allowedFixtures,["partial","ready","empty"]);
});
test("G45-CLI03: partial offline demo produces aggregate and no raw text",()=>{
  const r=call(["--demo","partial"]);
  assert.equal(r.status,0,r.stderr);
  const x=JSON.parse(r.stdout);
  assert.equal(x.snapshot.status,"PARTIAL");
  assert.equal(x.snapshot.sample.rawCount,5);
  assert.equal(x.snapshot.sample.eligibleCount,4);
  assert.equal(x.snapshot.sample.classifiedCount,3);
  assert.equal(x.snapshot.sourceType,"STATIC_FIXTURE");
  assert.equal(x.evidence.providerRequestsMade,0);
  assert.equal(x.evidence.nextPageAvailable,true);
  for(const sensitive of ["편집이 정말 좋아요","SYNTHETIC_USER",
    "SYNTHETIC_NEXT_PAGE","synthetic-comment-","https://example.invalid"])
    assert.ok(!r.stdout.includes(sensitive));
});
test("G45-CLI04: complete synthetic fixture can show QA READY but never approved provider",()=>{
  const r=call(["--demo","ready"]);
  assert.equal(r.status,0,r.stderr);
  const x=JSON.parse(r.stdout);
  assert.equal(x.snapshot.status,"READY");
  assert.equal(x.snapshot.isSynthetic,true);
  assert.equal(x.evidence.externalProviderApproved,false);
  assert.equal(x.evidence.derivedMetricsApproved,false);
});
test("G45-CLI05: empty response yields NO_DATA without 0% impression",()=>{
  const r=call(["--demo","empty"]);
  assert.equal(r.status,0,r.stderr);
  const x=JSON.parse(r.stdout);
  assert.equal(x.snapshot.status,"NO_DATA");
  assert.equal(x.snapshot.sentiment,null);
  assert.equal(x.snapshot.sample,null);
});
test("G45-CLI06: --run, --collect, --live and custom --input always fail",()=>{
  for(const args of [["--run"],["--live"],["--collect"],
    ["--demo","partial","--run"],["--input","C:\\data\\comments.json"],
    ["--demo","https://example.invalid"],["--demo","../partial.json"]]) {
    const r=call(args);
    assert.notEqual(r.status,0,args.join(" "));
    assert.equal(r.stdout,"");
    assert.match(r.stderr,/G45_PIPELINE_STOP/);
  }
});
test("G45-CLI07: environment secrets cause preflight rejection without echo",()=>{
  for(const key of ["GOOGLE_API_KEY","YOUTUBE_API_KEY","YOUTOPIA_YOUTUBE_API_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS","YOUTUBE_OAUTH_TOKEN"]){
    const secret="synthetic-secret-do-not-log";
    const r=call(["--check"],{[key]:secret});
    assert.notEqual(r.status,0);
    assert.ok(!r.stderr.includes(secret));
    assert.ok(!r.stdout.includes(secret));
  }
});
test("G45-CLI08: no developer provider SDK, shell, API URL or credential client in runner",()=>{
  assert.doesNotMatch(code,/\bfetch\s*\(|node:https?|node:net|axios|googleapis|puppeteer|playwright/);
  assert.doesNotMatch(code,/child_process|execSync|spawnSync|createServer|dotenv|process\.env\.[A-Z]*KEY\s*\|\|/);
  assert.ok(!code.includes("youtube.googleapis.com"));
  assert.match(code,/fs\.statSync\(file\)\.size>128\*1024/);
});
test("G45-CLI09: no runtime file path selection or page token replay path",()=>{
  const r=call(["--demo","partial","--pageToken=2"]);
  assert.notEqual(r.status,0);
  assert.equal(r.stdout,"");
});
test("G45-CLI10: CLI prints no raw author for all three synthetic cases",()=>{
  for(const id of ["partial","ready","empty"]){
    const r=call(["--demo",id]);
    assert.equal(r.status,0,r.stderr);
    assert.ok(!/(authorDisplayName|authorProfileImageUrl|textOriginal|textDisplay|pageToken|replyCount)/.test(r.stdout));
  }
});
