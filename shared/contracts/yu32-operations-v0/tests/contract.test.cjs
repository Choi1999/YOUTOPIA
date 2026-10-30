"use strict";

/**
 * G4-2 — 합성 계약/권한 부정 테스트. 실제 서버 인증, YouTube API,
 * DB 및 HTTP 서비스 구현/검증을 수행하지 않는다.
 */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  parseCreateJobRequest,
  requestFingerprint,
  validIdempotencyKey,
  classifyIdempotency,
  evaluateOfflineGate,
  canShowSyntheticMetrics,
  mayTransitionJob,
  parseSnapshotReference,
  matchesSnapshotScope,
} = require("../contract.cjs");

const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "yu32-operations.schema.json"), "utf8")
);

const REQUEST = Object.freeze({
  target: Object.freeze({
    source: "YOUTUBE",
    targetType: "VIDEO",
    targetId: "Ab0_-123xyz",
  }),
  analysisSpecVersion: "mock-0",
  observationWindowId: "20261001-20261008",
  samplingPolicyVersion: "mock-0",
  locale: "ko-KR",
});

const SCOPE = Object.freeze({
  ...REQUEST.target,
  analysisSpecVersion: REQUEST.analysisSpecVersion,
  observationWindowId: REQUEST.observationWindowId,
  samplingPolicyVersion: REQUEST.samplingPolicyVersion,
  locale: REQUEST.locale,
  visibility: "PUBLIC_REUSABLE",
  tenantId: null,
});

const GUEST = Object.freeze({kind: "GUEST"});
const CUSTOMER = Object.freeze({kind: "CUSTOMER", tenantId: "tenant-A"});
const PRIVATE = Object.freeze({...SCOPE,visibility:"TENANT_PRIVATE",tenantId:"tenant-A"});
const KEY_A = "12a45678-1234-4abc-9def-abcdef123456";
const KEY_B = "23b45678-1234-4bcd-8def-abcdef123456";

function approveRead(scope = SCOPE, viewer = GUEST) {
  return evaluateOfflineGate({
    operation:"READ",scope,viewer,policyState:"APPROVED_TEST_ONLY",
  });
}
function approveJob(patch = {}) {
  return evaluateOfflineGate({
    operation:"CREATE_JOB",
    scope:SCOPE,
    viewer:CUSTOMER,
    policyState:"APPROVED_TEST_ONLY",
    featureEnabled:true,
    entitlementGranted:true,
    quotaAvailable:true,
    ...patch,
  });
}
const denial = result => result.kind === "DENIED";

test("T01: 계약은 미구현·정책 HOLD로 선언되고 위험한 자동 POST를 금지한다", () => {
  assert.equal(schema["x-youtopia-exposed-api"], false);
  assert.equal(schema["x-youtopia-policy-gate"], "POLICY_HOLD");
  assert.match(schema.title, /not a deployed server contract/);
  assert.equal(schema["x-youtopia-operations"].noAutomaticHoverPost, true);
  assert.match(schema["x-youtopia-operations"].summaryGet, /^GET /);
  assert.match(schema["x-youtopia-operations"].createJobPost, /^POST /);
});

test("T02: 요청·대상·Scope에 추가 필드를 허용하지 않는다", () => {
  for (const definition of ["CreateJobRequest","Target","Scope",
    "JobAccepted","JobStatus","SnapshotReference","Problem"]) {
    assert.equal(schema.$defs[definition].additionalProperties, false, definition);
  }
  const props = schema.$defs.CreateJobRequest.properties;
  for (const forbidden of ["tenantId","visibility","role","requestAllowed",
    "policyApproved","isTrusted","subscription","apiKey"]) {
    assert.equal(Object.hasOwn(props,forbidden), false, forbidden);
    assert.equal(
      schema["x-youtopia-operations"].serverDerivedOnly.includes(forbidden) ||
      ["requestAllowed","isTrusted","subscription","apiKey"].includes(forbidden),
      true,
      forbidden
    );
  }
});

test("T03: 정상 VIDEO 요청은 불변 값으로 정규화한다", () => {
  const safe = parseCreateJobRequest(REQUEST);
  assert.ok(safe);
  assert.deepEqual(safe,REQUEST);
  assert.equal(Object.isFrozen(safe),true);
  assert.equal(Object.isFrozen(safe.target),true);
  assert.equal(requestFingerprint(safe),requestFingerprint({...REQUEST}));
});

test("T04: VIDEO 식별자/분석 버전/locale 오류는 실패 안전하게 거부한다", () => {
  const bad = [
    {...REQUEST,target:{...REQUEST.target,targetType:"CHANNEL"}},
    {...REQUEST,target:{...REQUEST.target,targetId:"wrong"}},
    {...REQUEST,target:{...REQUEST.target,source:"OTHER"}},
    {...REQUEST,locale:"ko-kr"},
    {...REQUEST,analysisSpecVersion:" "},
    {...REQUEST,observationWindowId:"bad scope"},
    {...REQUEST,samplingPolicyVersion:""},
  ];
  for(const x of bad)assert.equal(parseCreateJobRequest(x),null);
});

test("T05: 역할·테넌트·인가·제스처 플래그 위조를 허용하지 않는다", () => {
  for(const field of ["tenantId","visibility","role","isTrusted","requestAllowed",
    "policyApproved","subscription","apiKey"]) {
    assert.equal(parseCreateJobRequest({...REQUEST,[field]:"forge"}),null,field);
  }
  assert.equal(parseCreateJobRequest({...REQUEST,target:{...REQUEST.target,tenantId:"tenant-A"}}),null);
});

test("T06: 예외 객체/프로토타입은 파서 오류를 외부로 전파하지 않는다", () => {
  const hostile = new Proxy({}, {ownKeys(){throw new Error("hostile");}});
  assert.equal(parseCreateJobRequest(hostile),null);
  assert.equal(parseCreateJobRequest(null),null);
  assert.equal(parseCreateJobRequest([]),null);
});

test("T07: 멱등 키 후보는 UUIDv4 형식을 요구한다", () => {
  assert.equal(validIdempotencyKey(KEY_A),true);
  assert.equal(validIdempotencyKey("1234"),false);
  assert.equal(validIdempotencyKey("12a45678-1234-1abc-9def-abcdef123456"),false);
  assert.equal(validIdempotencyKey({key:KEY_A}),false);
});

test("T08: 같은 주체·키·본문만 REPLAY, 다른 본문은 409 후보로 분리한다", () => {
  const previous={principalId:"customer-A",key:KEY_A,request:REQUEST};
  assert.equal(classifyIdempotency(previous,{...previous,request:{...REQUEST}}),"REPLAY");
  assert.equal(classifyIdempotency(previous,{
    ...previous,request:{...REQUEST,analysisSpecVersion:"mock-1"},
  }),"IDEMPOTENCY_CONFLICT");
  assert.equal(classifyIdempotency(previous,{...previous,key:KEY_B}),"NEW");
  assert.equal(classifyIdempotency(previous,{...previous,principalId:"customer-B"}),"NEW");
  assert.equal(classifyIdempotency(previous,{...previous,key:"bad"}),"INVALID_REQUEST");
});

test("T09: 기본값 정책 HOLD는 공개 Guest 조회도 거부한다", () => {
  const result=evaluateOfflineGate({operation:"READ",scope:SCOPE,viewer:GUEST});
  assert.equal(result.reason,"POLICY_BLOCKED");
  assert.equal(evaluateOfflineGate({
    operation:"READ",scope:SCOPE,viewer:GUEST,policyState:"APPROVED",
  }).reason,"POLICY_BLOCKED");
});

test("T10: 가상 승인 공개 읽기만 가능하며 Guest Job은 401 후보로 차단한다", () => {
  assert.equal(approveRead().kind,"ALLOWED_TEST_ONLY");
  const result=approveJob({viewer:GUEST});
  assert.equal(result.reason,"AUTHENTICATION_REQUIRED");
});

test("T11: 비공개 테넌트는 Guest와 타 테넌트의 존재 여부까지 차단한다", () => {
  assert.equal(approveRead(PRIVATE,GUEST).reason,"RESOURCE_UNAVAILABLE");
  assert.equal(approveRead(PRIVATE,{kind:"CUSTOMER",tenantId:"tenant-B"}).reason,
    "RESOURCE_UNAVAILABLE");
  assert.equal(approveJob({scope:PRIVATE,viewer:{kind:"CUSTOMER",tenantId:"tenant-B"}}).reason,
    "RESOURCE_UNAVAILABLE");
});

test("T12: 같은 테넌트도 미승인 정책이면 데이터가 없다", () => {
  assert.equal(approveRead(PRIVATE,CUSTOMER).kind,"ALLOWED_TEST_ONLY");
  assert.equal(evaluateOfflineGate({
    operation:"READ",scope:PRIVATE,viewer:CUSTOMER,
  }).reason,"POLICY_BLOCKED");
});

test("T13: 권한 없는 principal·범위 및 알 수 없는 명령은 차단한다", () => {
  assert.equal(evaluateOfflineGate({operation:"DELETE_JOB",scope:SCOPE,viewer:CUSTOMER}).reason,
    "INVALID_OPERATION");
  assert.equal(approveJob({scope:{...SCOPE,tenantId:"FORGED"}}).reason,"INVALID_SCOPE");
  assert.ok(denial(approveJob({viewer:{kind:"ADMIN",tenantId:"tenant-A"}})));
});

test("T14: 기능 OFF·구독 제한·사용량 부족은 서로 다른 거부 상태다", () => {
  assert.equal(approveJob({featureEnabled:false}).reason,"FEATURE_DISABLED");
  assert.equal(approveJob({entitlementGranted:false}).reason,"ENTITLEMENT_LIMITED");
  assert.equal(approveJob({quotaAvailable:false}).reason,"QUOTA_DEFERRED");
  assert.equal(approveJob({policyState:"POLICY_HOLD"}).reason,"POLICY_BLOCKED");
});

test("T15: 가상 승인 네 Gate가 모두 충족될 때만 ALLOWED_TEST_ONLY", () => {
  assert.equal(approveJob().kind,"ALLOWED_TEST_ONLY");
  assert.equal(approveJob({policyState:true}).reason,"POLICY_BLOCKED");
});

test("T16: 검증된 동일 Scope 합성 FRESH READY/PARTIAL 외에는 수치 표시를 거부한다", () => {
  const gate=approveRead();
  const analyzedAt="2026-10-08T09:20:00Z";
  const reference={
    kind:"SNAPSHOT_REFERENCE",
    snapshotId:"synthetic-one-video-001",
    scope:{...SCOPE},
    status:"READY",
    sourceType:"STATIC_FIXTURE",
    isSynthetic:true,
    analyzedAt,
    payloadContract:"analysis-v1-candidate",
  };
  const ready={kind:"FRESH",status:"READY",snapshotId:reference.snapshotId,analyzedAt};
  const allowed={lookup:ready,verifiedSnapshot:reference,expectedScope:SCOPE,gate};
  assert.equal(canShowSyntheticMetrics(allowed),true);
  assert.equal(canShowSyntheticMetrics({
    ...allowed,lookup:{...ready,status:"PARTIAL"},
    verifiedSnapshot:{...reference,status:"PARTIAL"},
  }),true);
  for(const data of [
    {kind:"MISS"}, {kind:"NO_DATA",status:"NO_DATA"},
    {kind:"STALE",snapshotId:reference.snapshotId},
    {...ready,status:"NO_DATA"},
  ])assert.equal(canShowSyntheticMetrics({...allowed,lookup:data}),false);
  assert.equal(canShowSyntheticMetrics({...allowed,verifiedSnapshot:true}),false);
  assert.equal(canShowSyntheticMetrics({...allowed,verifiedSnapshot:false}),false);
  assert.equal(canShowSyntheticMetrics({...allowed,
    gate:{kind:"DENIED",reason:"POLICY_BLOCKED"}}),false);
});

test("T17: Job 종단 상태는 같은 Job에서 되돌릴 수 없다", () => {
  assert.equal(mayTransitionJob("QUEUED","RUNNING"),true);
  assert.equal(mayTransitionJob("QUEUED","FAILED"),true);
  assert.equal(mayTransitionJob("RUNNING","SUCCEEDED","synthetic-001"),true);
  assert.equal(mayTransitionJob("RUNNING","SUCCEEDED"),false);
  assert.equal(mayTransitionJob("RUNNING","FAILED"),true);
  assert.equal(mayTransitionJob("FAILED","QUEUED"),false);
  assert.equal(mayTransitionJob("SUCCEEDED","RUNNING"),false);
  assert.equal(mayTransitionJob("UNKNOWN","SUCCEEDED","synthetic-001"),false);
});

test("T18: snapshot ID만이 아니라 완전한 Scope 결속을 확인한다", () => {
  const snapshot={
    target:{...REQUEST.target},
    analysisSpecVersion:SCOPE.analysisSpecVersion,
    observationWindowId:SCOPE.observationWindowId,
    samplingPolicyVersion:SCOPE.samplingPolicyVersion,
    locale:SCOPE.locale,
    visibility:SCOPE.visibility,
    tenantId:SCOPE.tenantId,
  };
  assert.equal(matchesSnapshotScope(SCOPE,snapshot),true);
  assert.equal(matchesSnapshotScope(SCOPE,{
    ...snapshot,target:{...snapshot.target,targetId:"Ab0_-123xyZ"},
  }),false);
  assert.equal(matchesSnapshotScope(SCOPE,{
    ...snapshot,analysisSpecVersion:"mock-1",
  }),false);
  assert.equal(matchesSnapshotScope(SCOPE,{
    ...snapshot,visibility:"TENANT_PRIVATE",tenantId:"tenant-A",
  }),false);
});

test("T19: Summary API 결과는 MISS·NO_DATA·STALE·FRESH를 분리한다", () => {
  const refs=schema.$defs.SummaryLookup.oneOf.map(x=>x.$ref.split("/").pop());
  assert.deepEqual(refs,["LookupMiss","LookupFresh","LookupNoData","LookupStale"]);
  for(const kind of refs)assert.equal(schema.$defs[kind].additionalProperties,false);
  assert.equal(schema.$defs.LookupMiss.required.includes("snapshotId"),false);
  assert.equal(schema.$defs.LookupNoData.properties.analyzedAt.type,"null");
  assert.equal(Object.hasOwn(schema.$defs.LookupStale.properties,"sentimentPercent"),false);
});

test("T20: API 응답은 최소한의 식별·상태와 Snapshot 참조만 정의한다", () => {
  const jobs=schema.$defs.JobStatus;
  assert.deepEqual(jobs.properties.state.enum,["QUEUED","RUNNING","SUCCEEDED","FAILED"]);
  assert.equal(jobs.required.includes("version"),true);
  assert.equal(jobs.required.includes("snapshotId"),true);
  assert.equal(schema.$defs.JobAccepted.properties.disposition.enum.includes("JOINED"),true);
  assert.equal(Object.hasOwn(schema.$defs.SnapshotReference.properties,"commentText"),false);
  assert.equal(Object.hasOwn(schema.$defs.CreateJobRequest.properties,"comments"),false);
});

test("T21: HTTP 오류 계약의 주요 실패 코드가 서로 분리된다", () => {
  const codes=schema.$defs.Problem.properties.code.enum;
  for(const name of ["AUTHENTICATION_REQUIRED","RESOURCE_UNAVAILABLE","POLICY_BLOCKED",
    "ENTITLEMENT_LIMITED","IDEMPOTENCY_CONFLICT","QUOTA_DEFERRED","UNAVAILABLE"]) {
    assert.equal(codes.includes(name),true,name);
  }
  assert.equal(schema.$defs.Problem.additionalProperties,false);
});
test("T22: 적격 합성 Snapshot 참조는 복제·동결된 Scope와 함께 반환한다", () => {
  const reference={
    kind:"SNAPSHOT_REFERENCE",
    snapshotId:"synthetic-one-video-001",
    scope:{...SCOPE},
    status:"READY",
    sourceType:"STATIC_FIXTURE",
    isSynthetic:true,
    analyzedAt:"2026-10-08T09:20:00+09:00",
    payloadContract:"analysis-v1-candidate",
  };
  const result=parseSnapshotReference(reference);
  assert.ok(result);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result.scope),true);
  assert.deepEqual(result.scope,SCOPE);
});

test("T23: Snapshot의 비합성/합성 출처 표시가 불일치하면 거부한다", () => {
  const reference={
    kind:"SNAPSHOT_REFERENCE",
    snapshotId:"synthetic-one-video-001",
    scope:{...SCOPE},
    status:"READY",
    sourceType:"STATIC_FIXTURE",
    isSynthetic:false,
    analyzedAt:"2026-10-08T09:20:00Z",
    payloadContract:"analysis-v1-candidate",
  };
  assert.equal(parseSnapshotReference(reference),null);
  assert.equal(parseSnapshotReference({...reference,sourceType:"APPROVED_PROVIDER",isSynthetic:true}),null);
  assert.ok(parseSnapshotReference({...reference,sourceType:"APPROVED_PROVIDER",isSynthetic:false}));
});

test("T24: NO_DATA는 분석 수치·시각을 승격하지 않으며 STALE는 과거 시각만 허용한다", () => {
  const reference={
    kind:"SNAPSHOT_REFERENCE",
    snapshotId:"synthetic-one-video-001",
    scope:{...SCOPE},
    status:"NO_DATA",
    sourceType:"STATIC_FIXTURE",
    isSynthetic:true,
    analyzedAt:null,
    payloadContract:"analysis-v1-candidate",
  };
  assert.ok(parseSnapshotReference(reference));
  assert.equal(parseSnapshotReference({...reference,analyzedAt:"2026-10-08T09:20:00Z"}),null);
  assert.ok(parseSnapshotReference({...reference,status:"STALE"}));
  assert.ok(parseSnapshotReference({...reference,status:"STALE",analyzedAt:"2026-10-08T09:20:00Z"}));
  assert.equal(parseSnapshotReference({...reference,status:"READY"}),null);
});

test("T25: Snapshot 참조에는 Scope 조작과 원문/비밀 필드 삽입이 허용되지 않는다", () => {
  const reference={
    kind:"SNAPSHOT_REFERENCE",
    snapshotId:"synthetic-one-video-001",
    scope:{...SCOPE},
    status:"READY",
    sourceType:"STATIC_FIXTURE",
    isSynthetic:true,
    analyzedAt:"2026-10-08T09:20:00Z",
    payloadContract:"analysis-v1-candidate",
  };
  assert.equal(parseSnapshotReference({...reference,commentText:"private"}),null);
  assert.equal(parseSnapshotReference({...reference,scope:{...SCOPE,tenantId:"tenant-B"}}),null);
  assert.equal(parseSnapshotReference({...reference,scope:{...SCOPE,extraFlag:true}}),null);
  assert.equal(parseSnapshotReference({...reference,payloadContract:"custom"}),null);
});

test("T26: JSON Schema에서 Snapshot 출처·NO_DATA 시각·READY 시각을 조건부 제약한다", () => {
  const constraints=schema.$defs.SnapshotReference.allOf;
  assert.equal(constraints.length,3);
  assert.equal(constraints[0].then.properties.isSynthetic.const,true);
  assert.equal(constraints[0].else.properties.isSynthetic.const,false);
  assert.equal(constraints[1].then.properties.analyzedAt.type,"null");
  assert.equal(constraints[2].then.properties.analyzedAt.format,"date-time");
});

test("T27: 캐시와 Snapshot ID·상태·시각·테넌트 범위 불일치를 거부한다", () => {
  const reference={
    kind:"SNAPSHOT_REFERENCE",
    snapshotId:"synthetic-one-video-001",
    scope:{...SCOPE},
    status:"READY",
    sourceType:"STATIC_FIXTURE",
    isSynthetic:true,
    analyzedAt:"2026-10-08T09:20:00Z",
    payloadContract:"analysis-v1-candidate",
  };
  const lookup={
    kind:"FRESH",status:"READY",snapshotId:reference.snapshotId,
    analyzedAt:reference.analyzedAt,
  };
  const common={lookup,verifiedSnapshot:reference,expectedScope:SCOPE,gate:approveRead()};
  assert.equal(canShowSyntheticMetrics(common),true);
  assert.equal(canShowSyntheticMetrics({...common,lookup:{...lookup,snapshotId:"synthetic-other"}}),false);
  assert.equal(canShowSyntheticMetrics({...common,lookup:{...lookup,status:"PARTIAL"}}),false);
  assert.equal(canShowSyntheticMetrics({...common,lookup:{...lookup,analyzedAt:"2026-10-08T09:21:00Z"}}),false);
  assert.equal(canShowSyntheticMetrics({...common,expectedScope:{...SCOPE,analysisSpecVersion:"mock-1"}}),false);
  assert.equal(canShowSyntheticMetrics({...common,expectedScope:{
    ...SCOPE,visibility:"TENANT_PRIVATE",tenantId:"tenant-A",
  }}),false);
  assert.equal(canShowSyntheticMetrics({...common,
    verifiedSnapshot:{...reference,sourceType:"APPROVED_PROVIDER",isSynthetic:false},
  }),false);
});

test("T28: 비정상 Job 상태 및 Object.prototype 키는 안전하게 거부한다", () => {
  for(const source of ["__proto__","constructor","toString","hasOwnProperty",null,42]) {
    assert.equal(mayTransitionJob(source,"RUNNING"),false,String(source));
  }
  assert.equal(mayTransitionJob("RUNNING","SUCCEEDED","synthetic-001"),true);
});

test("T29: 존재하지 않는 날짜·과도한 timezone offset은 Snapshot 시각으로 거부한다", () => {
  const reference={
    kind:"SNAPSHOT_REFERENCE",
    snapshotId:"synthetic-one-video-001",
    scope:{...SCOPE},status:"READY",
    sourceType:"STATIC_FIXTURE",isSynthetic:true,
    analyzedAt:"2026-10-08T09:20:00Z",payloadContract:"analysis-v1-candidate",
  };
  for(const date of [
    "2026-02-30T09:20:00Z",
    "2026-02-29T09:20:00Z",
    "2026-10-08T09:20:00+15:00",
    "2026-10-08T09:20:00+14:01",
    "2026-10-08T25:20:00Z",
  ])assert.equal(parseSnapshotReference({...reference,analyzedAt:date}),null,date);
  assert.ok(parseSnapshotReference({...reference,analyzedAt:"2024-02-29T09:20:00Z"}));
  assert.ok(parseSnapshotReference({...reference,analyzedAt:"2026-10-08T09:20:00+14:00"}));
});

test("T30: API 오류 Schema는 feature-off 거부 이유도 표현할 수 있다", () => {
  const codes=schema.$defs.Problem.properties.code.enum;
  assert.equal(codes.includes("FEATURE_DISABLED"),true);
});
