"use strict";
/** G45 L0 local-first tests: no Google/YouTube network or secrets. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,"..");
const cli=path.join(root,"scripts","windows-local-preflight.cjs");
const state=JSON.parse(fs.readFileSync(path.join(root,"windows-local-boundary.v01.json"),"utf8"));
const source=fs.readFileSync(cli,"utf8");
const doc=fs.readFileSync(path.join(root,"../../../docs/integration/YU32_G4_5_WINDOWS_LOCAL_BACKEND_POC_V01.md"),"utf8");
const vid="Ab0_-123xyz";
const cleanEnv={...process.env};
for(const k of ["GOOGLE_API_KEY","YOUTUBE_API_KEY","YOUTOPIA_YOUTUBE_API_KEY"])delete cleanEnv[k];
const cliRun=(args,env=cleanEnv)=>spawnSync(process.execPath,[cli,...args],{encoding:"utf8",
  timeout:10000,maxBuffer:128*1024,env});
test("G45-L01: Windows-local server-side direction, not deployed Cloud Run",()=>{
  assert.equal(state.decision,"WINDOWS_LOCAL_BACKEND_FIRST");
  assert.equal(state.runtime.platformCandidate,"win32");
  assert.equal(state.runtime.nodeMajorCandidate,24);
  assert.equal(state.runtime.mode,"MANUAL_CLI_NO_HTTP_SERVER");
  assert.equal(state.runtime.publicListener,false);
  assert.equal(state.runtime.scheduled,false);
});
test("G45-L02: --check reports OS and always denies provider collection",()=>{
  const r=cliRun(["--check"]);
  assert.equal(r.status,0,r.stderr);
  const j=JSON.parse(r.stdout);
  assert.equal(j.status,"LOCAL_OFFLINE_PRECHECK_ONLY");
  assert.equal(j.platformObserved,process.platform);
  assert.equal(j.collectionAuthorized,false);
  assert.equal(j.providerRequests,0);
  assert.equal(j.policy,"POLICY_HOLD");
});
test("G45-L03: --plan with one synthetic video is bounded and nonexecutable",()=>{
  const r=cliRun(["--plan","--video-id="+vid]);
  assert.equal(r.status,0,r.stderr);
  const j=JSON.parse(r.stdout);
  assert.equal(j.videoCount,1);
  assert.equal(j.estimatedRequests,1);
  assert.equal(j.estimatedQuotaUnits,1);
  assert.equal(j.maxThreadsPerVideo,100);
  assert.equal(j.maxPagesPerVideo,1);
  assert.equal(j.collectionAuthorized,false);
  assert.equal(j.providerRequests,0);
  assert.ok(!r.stdout.includes(vid));
});
test("G45-L04: three valid videos are at most three planned calls",()=>{
  const r=cliRun(["--plan","--video-id="+vid,
    "--video-id=Zb0_-123xyz","--video-id=Xb0_-123xyz"]);
  assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(r.stdout).estimatedQuotaUnits,3);
});
test("G45-L05: --run, --live and --execute always fail without output",()=>{
  for(const a of [["--run"],["--live"],["--execute"],
    ["--plan","--video-id="+vid,"--run"]]){
    const r=cliRun(a);
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/G45_LOCAL_STOP/);
    assert.equal(r.stdout,"");
  }
});
test("G45-L06: credential-bearing process environment fails closed without leak",()=>{
  for(const key of ["GOOGLE_API_KEY","YOUTUBE_API_KEY","YOUTOPIA_YOUTUBE_API_KEY"]){
    const secret="example-provider-secret-do-not-display";
    const r=cliRun(["--check"],{...cleanEnv,[key]:secret});
    assert.notEqual(r.status,0);
    assert.ok(!r.stderr.includes(secret));
    assert.ok(!r.stdout.includes(secret));
  }
});
test("G45-L07: approval, URL, output path and OAuth bypass flags rejected",()=>{
  for(const args of [["--approved"],["--plan","--video-id="+vid,"--approved"],
    ["--plan","--url=example.invalid"],["--plan","--out=file"],
    ["--oauth=1"]])assert.notEqual(cliRun(args).status,0);
});
test("G45-L08: missing, invalid, duplicate and >3 videoIds rejected",()=>{
  for(const args of [
    ["--plan"],["--plan","--video-id=@handle"],["--plan","--video-id=abc"],
    ["--plan","--video-id="+vid,"--video-id="+vid],
    ["--plan","--video-id="+vid,"--video-id=Zb0_-123xyz",
      "--video-id=Xb0_-123xyz","--video-id=Gb0_-123xyz"]
  ])assert.notEqual(cliRun(args).status,0);
});
test("G45-L09: actual provider-policy/raw lifecycle/first call remain pending",()=>{
  assert.equal(state.policy,"POLICY_HOLD");
  assert.equal(state.status,"OFFLINE_PRECHECK_ONLY");
  assert.equal(state.providerGates.basicSourceUse,"POLICY_HOLD");
  assert.equal(state.providerGates.derivedMetrics,"POLICY_HOLD");
  assert.equal(state.providerGates.rawLifecycle,"NOT_IMPLEMENTED");
  assert.equal(state.providerGates.firstLiveCall,"NOT_APPROVED");
});
test("G45-L10: no credentials, cloud provisioning, public endpoint, billing or merge",()=>{
  assert.equal(state.approvals.localFirstDirection,true);
  for(const k of ["createCredentials","makeRealYouTubeCall","configureCloudResources",
    "chargeBilling","writeRawComments","operatePublicEndpoint","mergePullRequest"])
    assert.equal(state.approvals[k],false,k);
  assert.equal(state.keySecurity.keysCreated,0);
});
test("G45-L11: IP restrictions required, dynamic IP cannot justify an unrestricted key",()=>{
  assert.equal(state.keySecurity.apiRestriction,"youtube.googleapis.com");
  assert.equal(state.keySecurity.applicationRestrictionCandidate,"CURRENT_PUBLIC_EGRESS_IP");
  assert.equal(state.keySecurity.currentPublicIpVerified,false);
  assert.equal(state.keySecurity.ipRestrictionVerified,false);
  assert.equal(state.keySecurity.allowUnrestrictedKeyFallback,false);
  assert.equal(state.keySecurity.mustReverifyAfterAddressChange,true);
});
test("G45-L12: source has no HTTP, network, shell execution or OAuth client",()=>{
  assert.doesNotMatch(source,/node:https|node:http|node:net|XMLHttpRequest|axios|googleapis|createServer\s*\(|child_process|execSync/);
  assert.doesNotMatch(source,/\bfetch\s*\(|youtube\.com\/watch|www\.googleapis\.com/);
});
test("G45-L13: every actual execution/data/cloud metric remains zero",()=>{
  assert.equal(state.limits.maxVideoCount,3);
  assert.equal(state.limits.maxPagesPerVideo,1);
  assert.equal(state.limits.plannedMaxQuotaUnits,3);
  assert.equal(state.limits.noReplies,true);
  assert.equal(state.limits.noNlp,true);
  for(const x of Object.values(state.results))assert.equal(x,0);
});
test("G45-L14: docs distinguish local offline CLI from Spring backend and Cloud optional",()=>{
  for(const s of ["Windows PC","Node 24","Spring Boot","Cloud Run",
    "Cloud NAT","POLICY_HOLD","30일","별도"])
    assert.ok(doc.includes(s),s);
});
