"use strict";

/**
 * YU-32 G4-3 design-only verification.
 * No DB, no concurrency, no network, no runtime API, no external YouTube calls.
 * The fake model below establishes local logical examples, NOT real transactional safety.
 */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const model = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "invariants.json"), "utf8")
);
const job = model.job;
const byEntity = Object.fromEntries(model.persistence.entities.map(x => [x.name,x]));
const ALLOW = "APPROVED_TEST_ONLY";
const SCOPE = Object.freeze({
  source:"YOUTUBE",targetType:"VIDEO",targetId:"Ab0_-123xyz",
  analysisSpecVersion:"mock-0",observationWindowId:"20261001-20261008",
  samplingPolicyVersion:"mock-0",locale:"ko-KR",
  visibility:"PUBLIC_REUSABLE",tenantId:null,
});
const FULL_SCOPE_KEYS = model.scope.exactFields;

function scopeKey(s) {
  if (!s || Object.keys(s).length !== FULL_SCOPE_KEYS.length ||
      !FULL_SCOPE_KEYS.every(k => Object.hasOwn(s,k))) return null;
  if (s.source !== "YOUTUBE" || s.targetType !== "VIDEO" ||
      typeof s.targetId !== "string" ||
      !/^[A-Za-z0-9_-]{11}$/.test(s.targetId)) return null;
  if (s.visibility === "PUBLIC_REUSABLE" && s.tenantId !== null) return null;
  if (s.visibility === "TENANT_PRIVATE" &&
      (typeof s.tenantId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(s.tenantId))) return null;
  if (!model.scope.visibility.includes(s.visibility)) return null;
  return JSON.stringify(FULL_SCOPE_KEYS.map(k=>s[k]));
}

/**
 * Test-owned serial simulation. No actual DB locking, SQL, Redis, network,
 * Cross-process atomicity, or real authorization are implemented.
 */
class FakeDesign {
  constructor() {
    this.jobs = new Map();
    this.idem = new Map();
    this.reservations = [];
    this.outbox = [];
    this.latest = new Map();
    this.nextJob = 0;
    this.externalCalls = 0;
    this.revoked = false;
  }

  summaryRead({scope=SCOPE,policy="POLICY_HOLD"} = {}) {
    // Reads never create a Job or reserve any budget.
    if (this.revoked || policy!==ALLOW) return "POLICY_BLOCKED";
    const key=scopeKey(scope);
    return key===null ? "INVALID_SCOPE" : (this.latest.has(key) ? "FRESH" : "MISS");
  }

  submit({actor="customer-A",scope=SCOPE,requestKey="key-1",digest="digest-A",
    policy="POLICY_HOLD",explicitClick=true,
    featureEnabled=true,entitlement=true,quota=true} = {}) {
    // Execution partition is server-derived in the design; ignore caller flags.
    const executionPartition=actor;
    const skey=scopeKey(scope);
    if(!explicitClick)return {kind:"EXPLICIT_CLICK_REQUIRED"};
    if(actor==="GUEST")return {kind:"AUTHENTICATION_REQUIRED"};
    if(this.revoked || policy!==ALLOW)return {kind:"POLICY_BLOCKED"};
    if(!skey)return {kind:"INVALID_SCOPE"};
    if(!featureEnabled)return {kind:"FEATURE_DISABLED"};
    if(!entitlement)return {kind:"ENTITLEMENT_LIMITED"};
    if(!quota)return {kind:"QUOTA_DEFERRED"};
    const principalKey=actor+"|"+requestKey;
    const previous=this.idem.get(principalKey);
    if(previous)return previous.digest===digest
      ? {kind:"REPLAY",jobId:previous.jobId}
      : {kind:"IDEMPOTENCY_CONFLICT"};
    const active=[...this.jobs.values()].find(j=>
      j.scopeKey===skey && j.partition===executionPartition &&
      ["QUEUED","RUNNING"].includes(j.state));
    if(active){
      this.idem.set(principalKey,{digest,jobId:active.id});
      return {kind:"JOINED",jobId:active.id};
    }
    const j={id:"job-"+(++this.nextJob),scopeKey:skey,partition:executionPartition,
      state:"QUEUED",version:1,leaseEpoch:0,leaseOwner:null,leaseExpiresAt:null};
    this.jobs.set(j.id,j);
    this.idem.set(principalKey,{digest,jobId:j.id});
    this.reservations.push({jobId:j.id});
    this.outbox.push({jobId:j.id,type:"DISPATCH"});
    return {kind:"CREATED",jobId:j.id};
  }

  claim(id,owner,now,leaseMs=10) {
    const j=this.jobs.get(id);
    if (!j || (j.state!=="QUEUED" && !(j.state==="RUNNING" && now>=j.leaseExpiresAt)))
      return null;
    j.leaseEpoch++;
    j.leaseOwner=owner;
    j.leaseExpiresAt=now+leaseMs;
    j.state="RUNNING";
    j.version++;
    return Object.freeze({jobId:id,owner,epoch:j.leaseEpoch,version:j.version});
  }

  heartbeat(token,now) {
    const j=this.jobs.get(token.jobId);
    if(!j || j.state!=="RUNNING" || j.leaseEpoch!==token.epoch ||
      j.leaseOwner!==token.owner || j.version!==token.version ||
      now>=j.leaseExpiresAt)return false;
    j.leaseExpiresAt=now+10;
    j.version++;
    // Heartbeat returns the new version; the previous token is now stale.
    return Object.freeze({...token,version:j.version});
  }

  complete(token,now,{scope=SCOPE,policy=ALLOW,snapshotId="synthetic-001",status="READY"}={}) {
    const j=this.jobs.get(token.jobId);
    if(!j || j.state!=="RUNNING" || j.leaseEpoch!==token.epoch ||
      j.leaseOwner!==token.owner || j.version!==token.version ||
      now>=j.leaseExpiresAt || this.revoked || policy!==ALLOW ||
      scopeKey(scope)!==j.scopeKey ||
      !["READY","PARTIAL","NO_DATA"].includes(status) ||
      typeof snapshotId!=="string" || !snapshotId)return false;
    j.state="SUCCEEDED";
    j.version++;
    this.latest.set(j.scopeKey,{snapshotId,status,epoch:j.leaseEpoch});
    return true;
  }

  fail(token,now) {
    const j=this.jobs.get(token.jobId);
    if(!j || j.state!=="RUNNING" || j.leaseEpoch!==token.epoch ||
      j.leaseOwner!==token.owner || j.version!==token.version ||
      now>=j.leaseExpiresAt)return false;
    j.state="FAILED";j.version++;return true;
  }

  revoke() {this.revoked=true; this.latest.clear();}
}

test("G43-D01: 설계는 운영 API/DDL/외부 데이터를 모두 비활성화한다",()=>{
  for(const key of ["runtimeEnabled","apiImplemented","dbMigrationImplemented",
    "externalRequestsEnabled","youtubeProcessingEnabled","checkoutOrPayment"]){
    assert.equal(model.safety[key],false,key);
  }
  assert.equal(model.safety.policyState,"POLICY_HOLD");
  assert.equal(model.status,"DESIGN_DRAFT");
});

test("G43-D02: GitHub 기초 SHA는 승인한 frontend/backend 별도 참조다",()=>{
  assert.match(model.source.frontendBase,/^[0-9a-f]{40}$/);
  assert.match(model.source.backendReference,/^[0-9a-f]{40}$/);
  assert.notEqual(model.source.frontendBase,model.source.backendReference);
});

test("G43-D03: Scope는 G4-2의 9개 필드이고 서버 판정은 클라이언트가 선택할 수 없다",()=>{
  assert.deepEqual(FULL_SCOPE_KEYS,[
    "source","targetType","targetId","analysisSpecVersion",
    "observationWindowId","samplingPolicyVersion","locale","visibility","tenantId",
  ]);
  assert.equal(model.scope.serverDerivedOnly.includes("tenantId"),true);
  assert.equal(model.scope.serverDerivedOnly.includes("visibility"),true);
  assert.equal(model.scope.hashAloneSufficient,false);
});

test("G43-D04: 공개·테넌트 Scope의 정규화가 부정 입력을 거부한다",()=>{
  assert.ok(scopeKey(SCOPE));
  assert.equal(scopeKey({...SCOPE,tenantId:"tenant-A"}),null);
  assert.equal(scopeKey({...SCOPE,visibility:"TENANT_PRIVATE"}),null);
  assert.ok(scopeKey({...SCOPE,visibility:"TENANT_PRIVATE",tenantId:"tenant-A"}));
  assert.equal(scopeKey({...SCOPE,extra:"x"}),null);
  assert.notEqual(scopeKey(SCOPE),scopeKey({...SCOPE,analysisSpecVersion:"mock-1"}));
});

test("G43-D05: 기존 주 DB는 읽기 전용이며 분석 쓰기 계정으로 재사용할 수 없다",()=>{
  assert.equal(model.backendBoundary.baselineReadOnly,true);
  assert.equal(model.backendBoundary.baselineRole,"ytp_app_data_ro");
  assert.equal(model.backendBoundary.prohibitedPoolReuse.includes("dataSource"),true);
  assert.equal(model.backendBoundary.createOrConfigurePool,false);
});

test("G43-D06: DB 스키마 9개 개념 엔터티에 키·변경 정책이 있다",()=>{
  assert.equal(model.persistence.entities.length,9);
  for(const item of model.persistence.entities){
    assert.ok(item.name);
    assert.ok(item.key.length);
    assert.ok(item.mutation);
  }
  assert.deepEqual([...new Set(model.persistence.entities.map(x=>x.name))].length,9);
});

test("G43-D07: 활성 Job은 scope+execution_partition에서만 하나다",()=>{
  const j=byEntity.AnalysisJob;
  assert.deepEqual(j.uniqueActive,["scope_id","execution_partition"]);
  assert.deepEqual(j.activePredicate,["QUEUED","RUNNING"]);
  assert.equal(model.scope.executionPartition.crossPrincipalJoinAllowed,false);
  assert.equal(model.scope.executionPartition.requiresDecision,"DEC-G43-03");
});

test("G43-D08: 분석 비용 예약과 Job·멱등·Outbox는 한 DB 트랜잭션 후보이다",()=>{
  assert.deepEqual(model.persistence.atomicCreateSet,[
    "AnalysisJob","IdempotencyRecord","BudgetReservation","JobOutbox",
  ]);
  assert.equal(model.persistence.redisAndPostgresAtomic,false);
  assert.equal(model.persistence.externalProviderCallInsideTransaction,false);
});

test("G43-D09: SQL 후보는 부분 UNIQUE 및 SKIP LOCKED이고 실제 적용은 아니다",()=>{
  assert.equal(model.persistence.uniqueIndexType,"PARTIAL_UNIQUE");
  assert.equal(model.persistence.rowLockPattern,"FOR_UPDATE_SKIP_LOCKED");
  assert.equal(model.persistence.migrationApplied,false);
});

test("G43-D10: 외부 호출 exactly-once를 주장하지 않는다",()=>{
  assert.equal(model.persistence.externalExactlyOnceGuaranteed,false);
  assert.equal(model.persistence.duplicateOutboxDeliveryPossible,true);
  assert.equal(model.safety.productionQuotaDefined,false);
});

test("G43-D11: Job/상태/종단 경로는 G4-2를 유지한다",()=>{
  assert.deepEqual(job.states,["QUEUED","RUNNING","SUCCEEDED","FAILED"]);
  assert.deepEqual(job.terminal,["SUCCEEDED","FAILED"]);
  assert.deepEqual(job.transitions.map(t=>t.from+"->"+t.to),[
    "QUEUED->RUNNING","QUEUED->FAILED","RUNNING->SUCCEEDED","RUNNING->FAILED",
  ]);
  assert.equal(job.transitions.some(t=>job.terminal.includes(t.from)),false);
});

test("G43-D12: 리스 재claim과 명시적 사용자 재시도는 별개다",()=>{
  assert.equal(job.autoRecovery.sameJob,true);
  assert.equal(job.autoRecovery.newLeaseEpoch,true);
  assert.equal(job.userRetry.sameJob,false);
  assert.equal(job.userRetry.newJob,true);
  assert.equal(job.userRetry.explicitIntentRequired,true);
});

test("G43-D13: Worker 제출 경로에는 현재 lease epoch 및 nonexpired lease가 필수다",()=>{
  for(const key of ["job_id","lease_owner","lease_epoch","expected_version","state","nonexpired_lease"])
    assert.equal(job.lease.requiredCompareAndSwap.includes(key),true,key);
  assert.equal(job.lease.staleWorkerCanPublish,false);
  assert.equal(job.lease.monotoneEpoch,true);
  assert.equal(job.lease.ttlNumeric,null);
});

test("G43-D14: 정책은 요청·멱등 재생·실행·완료·공개·조회마다 확인한다",()=>{
  for(const stage of ["request","idempotency_replay","dispatch","completion","publication","read"])
    assert.equal(model.authorization.policyCheckAt.includes(stage),true,stage);
  assert.equal(model.authorization.policyHoldsDenyAllRealCalls,true);
});

test("G43-D15: Guest는 승인된 읽기만 가능하고 Job은 인증 고객만 가능하다",()=>{
  assert.deepEqual(model.authorization.guestAllowed,["READ_SUMMARY","READ_SNAPSHOT"]);
  assert.equal(model.authorization.customerAllowed.includes("CREATE_JOB"),true);
  assert.equal(model.authorization.internalWorkerAllowed.includes("WORKER_CLAIM"),true);
  assert.deepEqual(model.authorization.clientTrustedFlags,[]);
});

test("G43-D16: Snapshot은 immutable·scope/provenance/epoch 재검증이 필수다",()=>{
  assert.equal(model.snapshot.immutable,true);
  assert.equal(model.snapshot.jobSuccessImpliesDisplay,false);
  for(const key of ["scope_id","provenance","schema_version","policy_epoch"])
    assert.equal(model.snapshot.requiredBinding.includes(key),true,key);
  assert.equal(model.snapshot.readRequiresFreshAuthorization,true);
  assert.equal(model.snapshot.revokedPolicyEpochCanBePublished,false);
});

test("G43-D17: MISS, STALE, NO_DATA, POLICY_BLOCKED의 수치 승격을 금지한다",()=>{
  for(const status of ["MISS","NO_DATA","STALE","POLICY_BLOCKED","ENTITLEMENT_LIMITED"])
    assert.ok(model.snapshot.denyStatusesForCurrentMetrics.includes(status));
  assert.equal(model.snapshot.syntheticPromotionAllowed,false);
});

test("G43-D18: 삭제 저널·복구 펜스 우회 및 계정 권한 부활 금지",()=>{
  assert.equal(model.privacy.backendRestoreJournalBypassAllowed,false);
  assert.equal(model.privacy.deletedAccountCanReadAfterRestore,false);
  assert.equal(model.privacy.revocationCheckedBeforePublishAndRead,true);
  assert.equal(model.privacy.retentionPeriodApproved,false);
});

test("G43-D19: 28개 수용 시나리오는 현재 실행 근거로 표기되지 않는다",()=>{
  const scenarios=model.scenarios;
  assert.equal(scenarios.length,28);
  assert.deepEqual(scenarios.map(x=>x.id),Array.from({length:28},(_,i)=>"G43-O"+String(i+1).padStart(2,"0")));
  const allowed=new Set(["OFFLINE","DB_NOT_RUN","SECURITY_NOT_RUN","POLICY_HOLD"]);
  assert.ok(scenarios.every(x=>allowed.has(x.layer)));
  assert.ok(!scenarios.some(x=>x.layer==="PRODUCTION_PASS"));
});

test("G43-D20: 미승인 결정 8개와 실제 운영 불가가 구분된다",()=>{
  assert.equal(model.decisions.length,8);
  assert.ok(model.decisions.every(x=>x.status==="DECISION_REQUIRED"||x.status==="POLICY_HOLD"));
  assert.equal(model.decisions.find(x=>x.id==="DEC-G43-06").status,"POLICY_HOLD");
});

test("G43-D21: Fake Hover GET은 Job/예약/Outbox/외부 호출을 생성하지 않는다",()=>{
  const f=new FakeDesign();
  for(let i=0;i<100;i++)assert.equal(f.summaryRead({scope:SCOPE,policy:ALLOW}),"MISS");
  assert.equal(f.jobs.size,0);
  assert.equal(f.reservations.length,0);
  assert.equal(f.outbox.length,0);
  assert.equal(f.externalCalls,0);
});

test("G43-D22: Fake Job POST는 Guest/정책 HOLD/명시 클릭 없는 경우 거부한다",()=>{
  const f=new FakeDesign();
  assert.equal(f.submit().kind,"POLICY_BLOCKED");
  assert.equal(f.submit({policy:ALLOW,actor:"GUEST"}).kind,"AUTHENTICATION_REQUIRED");
  assert.equal(f.submit({policy:ALLOW,explicitClick:false}).kind,"EXPLICIT_CLICK_REQUIRED");
  assert.equal(f.jobs.size,0);
});

test("G43-D23: 같은 principal+key+digest 요청은 Fake Job/예약 1회",()=>{
  const f=new FakeDesign();
  const options={actor:"customer-A",requestKey:"unique-key",policy:ALLOW,digest:"same"};
  const one=f.submit(options),two=f.submit(options);
  assert.equal(one.kind,"CREATED");
  assert.equal(two.kind,"REPLAY");
  assert.equal(one.jobId,two.jobId);
  assert.equal(f.jobs.size,1);
  assert.equal(f.reservations.length,1);
  assert.equal(f.outbox.length,1);
});

test("G43-D24: 같은 키 다른 본문은 충돌, 다른 키 같은 scope는 합류",()=>{
  const f=new FakeDesign(),opts={policy:ALLOW,requestKey:"idempotency-1"};
  const first=f.submit(opts);
  assert.equal(f.submit({...opts,digest:"other"}).kind,"IDEMPOTENCY_CONFLICT");
  const joined=f.submit({...opts,requestKey:"idempotency-2"});
  assert.equal(joined.kind,"JOINED");
  assert.equal(joined.jobId,first.jobId);
  assert.equal(f.reservations.length,1);
});

test("G43-D25: 같은 PUBLIC Scope라도 타 principal의 Fake Job은 공유하지 않는다",()=>{
  const f=new FakeDesign();
  const one=f.submit({policy:ALLOW,actor:"customer-A",requestKey:"a"});
  const other=f.submit({policy:ALLOW,actor:"customer-B",requestKey:"b"});
  assert.notEqual(one.jobId,other.jobId);
  assert.equal(f.jobs.size,2);
  assert.equal(f.reservations.length,2);
});

test("G43-D26: Worker A 리스 만료 후 B 재claim하면 A 완료는 거부한다",()=>{
  const f=new FakeDesign();
  const j=f.submit({policy:ALLOW});
  const a=f.claim(j.jobId,"A",0,10);
  assert.ok(a);
  const b=f.claim(j.jobId,"B",11,10);
  assert.ok(b);
  assert.equal(a.epoch+1,b.epoch);
  assert.equal(f.complete(a,12),false);
  assert.equal(f.latest.size,0);
  assert.equal(f.complete(b,12),true);
  assert.equal(f.latest.size,1);
});

test("G43-D27: 지난 리스는 heartbeat/완료 불가, 새로운 lease는 활성",()=>{
  const f=new FakeDesign();
  const j=f.submit({policy:ALLOW});
  const token=f.claim(j.jobId,"worker-A",0,10);
  assert.equal(f.heartbeat(token,11),false);
  const refreshed=f.claim(j.jobId,"worker-B",11,10);
  assert.ok(refreshed);
  assert.equal(f.heartbeat(token,12),false);
  const latest=f.heartbeat(refreshed,12);
  assert.ok(latest);
  assert.equal(latest.version,refreshed.version+1);
  assert.equal(f.complete(refreshed,13),false);
  assert.equal(f.complete(latest,13),true);
});

test("G43-D28: Snapshot scope 불일치 또는 정책 철회 중에는 Fake 발행 차단",()=>{
  const f=new FakeDesign();
  const j=f.submit({policy:ALLOW});
  const token=f.claim(j.jobId,"worker-A",0,10);
  assert.equal(f.complete(token,1,{scope:{...SCOPE,analysisSpecVersion:"mock-2"}}),false);
  assert.equal(f.complete(token,1,{policy:"POLICY_HOLD"}),false);
  f.revoke();
  assert.equal(f.complete(token,1),false);
  assert.equal(f.latest.size,0);
  assert.equal(f.summaryRead({scope:SCOPE,policy:ALLOW}),"POLICY_BLOCKED");
});

test("G43-D29: 만료되지 않은 현 Worker만 결과를 Fake 최신 참조로 발행한다",()=>{
  const f=new FakeDesign();
  const j=f.submit({policy:ALLOW});
  const token=f.claim(j.jobId,"worker-A",0,10);
  assert.equal(f.complete(token,1,{scope:SCOPE}),true);
  assert.equal(f.jobs.get(j.jobId).state,"SUCCEEDED");
  assert.equal(f.summaryRead({scope:SCOPE,policy:ALLOW}),"FRESH");
  assert.equal(f.claim(j.jobId,"worker-B",20),null);
  assert.equal(f.complete(token,2),false);
});

test("G43-D30: Fake 실패 Job 사용자 재시도는 새 명시적 Job이어야 한다",()=>{
  const f=new FakeDesign();
  const created=f.submit({policy:ALLOW,requestKey:"first"});
  const token=f.claim(created.jobId,"worker-A",0,10);
  assert.equal(f.fail(token,1),true);
  assert.equal(f.jobs.get(created.jobId).state,"FAILED");
  const retried=f.submit({policy:ALLOW,requestKey:"retry"});
  assert.equal(retried.kind,"CREATED");
  assert.notEqual(retried.jobId,created.jobId);
  assert.equal(f.jobs.get(created.jobId).state,"FAILED");
});
test("G43-D31: 설계 데이터는 JSON Schema 인증 문서로 오인되지 않는다",()=>{
  assert.equal(model.documentKind,"YU32_G43_OFFLINE_DESIGN_DATA");
  assert.equal(model.schemaValidation,"NOT_A_JSON_SCHEMA");
  assert.equal(Object.hasOwn(model,"$schema"),false);
});

test("G43-D32: 클라이언트가 executionPartition 값을 위조해도 다른 actor Job에 합류하지 않는다",()=>{
  const f=new FakeDesign();
  const a=f.submit({policy:ALLOW,actor:"customer-A",requestKey:"a"});
  const b=f.submit({policy:ALLOW,actor:"customer-B",requestKey:"b",
    executionPartition:"customer-A"});
  assert.equal(a.kind,"CREATED");
  assert.equal(b.kind,"CREATED");
  assert.notEqual(a.jobId,b.jobId);
});

test("G43-D33: Job version이 뒤바뀐 heartbeat/완료는 같은 owner·epoch여도 거부한다",()=>{
  const f=new FakeDesign();
  const j=f.submit({policy:ALLOW});
  const first=f.claim(j.jobId,"worker-A",0,10);
  const renewed=f.heartbeat(first,1);
  assert.ok(renewed);
  assert.equal(f.heartbeat(first,2),false);
  assert.equal(f.complete(first,2),false);
  assert.equal(f.complete(renewed,2),true);
  assert.equal(f.latest.size,1);
});
