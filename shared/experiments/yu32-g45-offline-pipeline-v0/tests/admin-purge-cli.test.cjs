"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const script=path.resolve(__dirname,"../scripts/run-admin-purge-demo.cjs");
const source=fs.readFileSync(script,"utf8");
const env={...process.env};
for(const k of ["GOOGLE_API_KEY","YOUTUBE_API_KEY","YOUTOPIA_YOUTUBE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS","YOUTUBE_OAUTH_TOKEN"])delete env[k];
const call=(args,extras={})=>spawnSync(process.execPath,[script,...args],{
  env:{...env,...extras},encoding:"utf8",timeout:5000,maxBuffer:64*1024
});
test("G45-DC01: check never claims real admin delete or production authorization",()=>{
  const r=call(["--check"]);assert.equal(r.status,0,r.stderr);
  const x=JSON.parse(r.stdout);
  assert.equal(x.status,"SYNTHETIC_ADMIN_DELETE_ONLY");
  assert.equal(x.deleteActualData,false);
  assert.equal(x.realProviderRequests,0);
  assert.equal(x.productionAdminAuth,false);
  assert.equal(x.productionStorage,false);
  assert.equal(x.userErasureNeedsAdmin,false);
  assert.equal(x.policy,"POLICY_HOLD");
});
test("G45-DC02: admin demo previews and then deletes synthetic dependents",()=>{
  const r=call(["--demo-admin-delete"]);assert.equal(r.status,0,r.stderr);
  const x=JSON.parse(r.stdout);
  assert.equal(x.preview.state,"PREVIEW_ONLY");
  assert.equal(x.result.status,"PURGED_SYNTHETIC_ONLY");
  assert.equal(x.result.removed.cachedCards,1);
  assert.equal(x.result.removed.snapshots,1);
  assert.equal(x.active.tombstoned,true);
  assert.equal(x.active.exists,false);
  assert.equal(x.auditEventCount,1);
  assert.equal(x.syntheticOnly,true);
});
test("G45-DC03: system expiry demo does not need admin login",()=>{
  const r=call(["--demo-expiry"]);assert.equal(r.status,0,r.stderr);
  const x=JSON.parse(r.stdout);
  assert.equal(x.result.deleted,1);
  assert.equal(x.result.providerRequestsMade,0);
  assert.equal(x.syntheticOnly,true);
});
test("G45-DC04: verified user erasure demo has no administrative bottleneck",()=>{
  const r=call(["--demo-user-erasure"]);assert.equal(r.status,0,r.stderr);
  const x=JSON.parse(r.stdout);
  assert.equal(x.result.deadlineStatus,"WITHIN_7_DAYS");
  assert.equal(x.result.tombstoned,true);
  assert.equal(x.syntheticOnly,true);
});
test("G45-DC05: no dynamic CLI target, real delete or unknown role is accepted",()=>{
  for(const args of [[],["--run"],["--delete"],["--demo-admin-delete","--real"],
    ["--role=ADMIN"],["--video-id=Ab0_-123xyz"],["--all-tenants"],["--input=C:\\real.json"]]){
    const r=call(args);
    assert.notEqual(r.status,0,args.join(" "));
    assert.equal(r.stdout,"");
    assert.match(r.stderr,/G45_PURGE_DEMO_STOP/);
  }
});
test("G45-DC06: demo rejects API key variables and never exposes raw or providers",()=>{
  const r=call(["--check"],{GOOGLE_API_KEY:"synthetic-test-secret"});
  assert.notEqual(r.status,0);
  assert.ok(!r.stderr.includes("synthetic-test-secret"));
  assert.ok(!r.stdout.includes("synthetic-test-secret"));
  assert.doesNotMatch(source,/\bfetch\s*\(|node:https|node:http|child_process|fs\.unlink|DELETE FROM/);
  for(const flag of ["--demo-admin-delete","--demo-expiry","--demo-user-erasure"]){
    const x=call([flag]);assert.equal(x.status,0);
    assert.ok(!/(textOriginal|authorDisplayName|authorProfileImageUrl|SYNTHETIC_USER)/.test(x.stdout));
  }
});
