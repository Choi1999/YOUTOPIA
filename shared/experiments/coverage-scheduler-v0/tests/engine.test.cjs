
"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeScope,
  createSimulator,
} = require("../engine.cjs");

const START = Date.parse("2026-10-08T10:00:00Z");

const BASE = Object.freeze({
  source: "YOUTUBE",
  targetType: "VIDEO",
  targetId: "Ab0_-123xyz",
  analysisSpecVersion: "mock-0",
  observationWindowId: "20261001-20261008",
  samplingPolicyVersion: "mock-0",
  locale: "ko-KR",
  visibility: "PUBLIC_REUSABLE",
  tenantId: null,
});

const VIDEO_B = "Zb0_-123xyz";

function qa(options = {}) {
  return createSimulator({
    mode: "QA_SYNTHETIC",
    now: () => START,
    ...options,
  });
}

function fixture(scope = BASE, patch = {}) {
  return {
    snapshotId: "synthetic-one-video-001",
    status: "READY",
    sourceType: "STATIC_FIXTURE",
    isSynthetic: true,
    visibility: scope.visibility,
    tenantId: scope.tenantId,
    analyzedAt: "2026-10-08T09:50:00Z",

    target: {
      source: scope.source,
      targetType: scope.targetType,
      targetId: scope.targetId,
    },

    analysisSpecVersion: scope.analysisSpecVersion,
    observationWindowId: scope.observationWindowId,
    samplingPolicyVersion: scope.samplingPolicyVersion,
    locale: scope.locale,

    // 반드시 마지막에 배치하여 테스트별 변경값을 적용한다.
    ...patch,
  };
}

const ALLOW = Object.freeze({
  explicitClick: true,
  requestAllowed: true,
});

test("C01: 기존 합성 분석은 즉시 조회하고 새 Job을 만들지 않는다", () => {
  const s = qa();

  assert.equal(
    s.seedSynthetic(BASE, fixture()).kind,
    "SEEDED"
  );

  for (let i = 0; i < 20; i++) {
    const view = s.hover(BASE, {requestAllowed: true});

    assert.equal(view.kind, "READY");
    assert.equal(view.action.type, "DETAIL");
  }

  assert.equal(s.stats().createdJobs, 0);
  assert.equal(s.stats().hoverCount, 20);
  assert.equal(s.stats().freshHits, 20);
});

test("C02: Cold MISS는 버튼 조건을 표시하지만 Hover만으로 실행하지 않는다", () => {
  const s = qa();

  const result = s.hover(BASE, {requestAllowed: true});

  assert.equal(result.kind, "MISS");
  assert.equal(result.action.type, "DEMO_REQUEST");
  assert.equal(result.action.enabled, true);

  assert.equal(s.stats().createdJobs, 0);
  assert.equal(s.stats().usedUnits, 0);
});

test("C03: 명시적 클릭과 QA 자격이 없으면 Job을 생성하지 않는다", () => {
  const s = qa();

  assert.equal(
    s.request(BASE, {requestAllowed: true}).reason,
    "EXPLICIT_CLICK_REQUIRED"
  );

  assert.equal(
    s.request(BASE, {explicitClick: true}).reason,
    "ELIGIBILITY_UNCONFIRMED"
  );

  const safe = createSimulator({
    now: () => START,
  });

  assert.equal(
    safe.hover(BASE, {requestAllowed: true}).action.enabled,
    false
  );

  assert.equal(
    safe.request(BASE, ALLOW).kind,
    "BLOCKED"
  );

  assert.equal(s.stats().createdJobs, 0);
  assert.equal(safe.stats().createdJobs, 0);
});

test("C04: 동일 분석 범위의 중복 요청은 하나의 Job에 합류한다", () => {
  const s = qa();

  const first = s.request(BASE, ALLOW);
  const second = s.request(BASE, ALLOW);

  assert.equal(first.kind, "CREATED");
  assert.equal(second.kind, "JOINED");
  assert.equal(second.jobId, first.jobId);

  assert.equal(s.stats().createdJobs, 1);
  assert.equal(s.stats().joinedJobs, 1);
  assert.equal(s.stats().usedUnits, 1);
});

test("C05: 가상 할당량 초과 시 추가 Job을 만들지 않는다", () => {
  const s = qa({budgetUnits: 1});

  const first = s.request(BASE, ALLOW);
  assert.equal(first.kind, "CREATED");

  const other = {
    ...BASE,
    targetId: VIDEO_B,
  };

  assert.equal(
    s.request(other, ALLOW).kind,
    "QUOTA_DEFERRED"
  );

  // 예산을 모두 사용한 뒤에도 기존 Job 합류는 가능하다.
  assert.equal(
    s.request(BASE, ALLOW).kind,
    "JOINED"
  );

  assert.equal(s.stats().usedUnits, 1);
  assert.equal(s.stats().createdJobs, 1);
});

test("C06: TTL이 경과하면 STALE로 처리하고 수치를 생성하지 않는다", () => {
  let clock = START;

  const s = qa({
    now: () => clock,
    ttlMs: 60 * 60 * 1000,
  });

  assert.equal(
    s.seedSynthetic(BASE, fixture()).kind,
    "SEEDED"
  );

  assert.equal(s.lookup(BASE).kind, "FRESH");

  clock += 51 * 60 * 1000;

  const result = s.lookup(BASE);

  assert.equal(result.kind, "STALE");
  assert.equal(result.analyzedAt, fixture().analyzedAt);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result, "sentimentPercent"
    ),
    false
  );

  assert.equal(
    s.action(BASE, {requestAllowed: true}).action.type,
    "DEMO_REQUEST"
  );
});

test("C07: Job 완료와 캐시 저장은 별개 전이로 검증한다", () => {
  const s = qa();
  const requested = s.request(BASE, ALLOW);

  assert.equal(
    s.getJob(requested.jobId).state,
    "QUEUED"
  );

  assert.equal(
    s.complete(requested.jobId, fixture()).kind,
    "REJECTED"
  );

  assert.equal(s.startNext().state, "RUNNING");

  const completed = s.complete(
    requested.jobId,
    fixture()
  );

  assert.equal(completed.kind, "SUCCEEDED");
  assert.equal(
    s.getJob(requested.jobId).state,
    "SUCCEEDED"
  );

  assert.equal(s.lookup(BASE).kind, "FRESH");
  assert.equal(s.action(BASE).kind, "READY");

  assert.equal(
    s.request(BASE, ALLOW).kind,
    "ALREADY_CACHED"
  );

  assert.equal(s.stats().createdJobs, 1);
});

test("C08: 비공개 Tenant 데이터는 다른 Tenant에게 노출하지 않는다", () => {
  const privateScope = {
    ...BASE,
    visibility: "TENANT_PRIVATE",
    tenantId: "tenant-A",
  };

  const s = qa();

  assert.equal(
    s.seedSynthetic(
      privateScope,
      fixture(privateScope)
    ).kind,
    "SEEDED"
  );

  assert.equal(
    s.lookup(privateScope, {
      viewerTenantId: "tenant-B",
    }).kind,
    "ACCESS_DENIED"
  );

  assert.equal(
    s.action(privateScope, {
      viewerTenantId: "tenant-B",
      requestAllowed: true,
    }).action.enabled,
    false
  );

  assert.equal(
    s.request(privateScope, {
      ...ALLOW,
      viewerTenantId: "tenant-B",
    }).kind,
    "BLOCKED"
  );

  assert.equal(
    s.lookup(privateScope, {
      viewerTenantId: "tenant-A",
    }).kind,
    "FRESH"
  );
});

test("C09: NO_DATA와 MISS를 구별하고 허위 수치를 생성하지 않는다", () => {
  const s = qa();

  assert.equal(s.lookup(BASE).kind, "MISS");

  assert.equal(
    s.seedSynthetic(BASE, fixture(BASE, {
      snapshotId: "synthetic-no-data-001",
      status: "NO_DATA",
      analyzedAt: null,
    })).kind,
    "SEEDED"
  );

  const result = s.lookup(BASE);

  assert.equal(result.kind, "FRESH");
  assert.equal(result.status, "NO_DATA");

  assert.equal(
    s.action(BASE, {requestAllowed: true}).action.enabled,
    false
  );

  assert.equal(s.request(BASE, ALLOW).kind, "ALREADY_CACHED");
  assert.equal(s.stats().createdJobs, 0);
});

test("C10: 분석 정의가 다르면 같은 영상도 다른 캐시로 구분한다", () => {
  const s = qa();

  assert.equal(
    s.seedSynthetic(BASE, fixture()).kind,
    "SEEDED"
  );

  const otherSpec = {
    ...BASE,
    analysisSpecVersion: "mock-1",
  };

  assert.equal(s.lookup(BASE).kind, "FRESH");
  assert.equal(s.lookup(otherSpec).kind, "MISS");
});

test("C11: 잘못된 대상과 비합성 출처를 거부한다", () => {
  const s = qa();

  assert.equal(
    normalizeScope({
      ...BASE,
      targetId: "INVALID",
    }),
    null
  );

  assert.equal(
    normalizeScope({
      ...BASE,
      visibility: "PUBLIC_REUSABLE",
      tenantId: "tenant-A",
    }),
    null
  );

  assert.equal(
    s.seedSynthetic(BASE, fixture(BASE, {
      sourceType: "APPROVED_PROVIDER",
      isSynthetic: false,
    })).kind,
    "REJECTED"
  );

  assert.equal(s.lookup(BASE).kind, "MISS");
});

test("C12: 반복 Hover와 새로운 시뮬레이터의 상태는 분리된다", () => {
  const s = qa();

  for (let i = 0; i < 40; i++) {
    const scope = i % 2 === 0
      ? BASE
      : {...BASE, targetId: VIDEO_B};

    s.hover(scope, {requestAllowed: true});
  }

  assert.equal(s.stats().hoverCount, 40);
  assert.equal(s.stats().createdJobs, 0);

  const requested = s.request(BASE, ALLOW);
  assert.equal(requested.kind, "CREATED");

  // 별도의 새 인스턴스는 기존 작업을 자동 복원하지 않는다.
  const restarted = qa();

  assert.equal(
    restarted.getJob(requested.jobId).kind,
    "NOT_FOUND"
  );

  assert.equal(restarted.stats().createdJobs, 0);
});

test("C13: 다른 영상의 스냅샷 참조를 잘못 저장하지 않는다", () => {
  const s = qa();

  const mismatched = fixture(BASE, {
    target: {
      source: "YOUTUBE",
      targetType: "VIDEO",
      targetId: VIDEO_B,
    },
  });

  assert.equal(mismatched.target.targetId, VIDEO_B);
  assert.notEqual(mismatched.target.targetId, BASE.targetId);

  assert.equal(
    s.seedSynthetic(BASE, mismatched).kind,
    "REJECTED"
  );

  assert.equal(s.lookup(BASE).kind, "MISS");
});

test("C14: 실패한 합성 Job은 MISS가 아닌 FAILED로 표시하고 명시적 재시도를 허용한다", () => {
  const s = qa({budgetUnits: 2});
  const first = s.request(BASE, ALLOW);

  assert.equal(first.kind, "CREATED");
  assert.equal(s.startNext().jobId, first.jobId);
  assert.equal(s.fail(first.jobId).kind, "FAILED");

  const view = s.action(BASE, {requestAllowed: true});
  assert.equal(view.kind, "FAILED");
  assert.equal(view.jobId, first.jobId);
  assert.equal(view.action.type, "DEMO_REQUEST");
  assert.equal(view.action.enabled, true);
  assert.equal(s.getJob(first.jobId).state, "FAILED");

  // Hover만으로 실패 작업을 자동 재시작하지 않는다.
  assert.equal(s.hover(BASE, {requestAllowed: true}).kind, "FAILED");
  assert.equal(s.stats().createdJobs, 1);

  const retried = s.request(BASE, ALLOW);
  assert.equal(retried.kind, "CREATED");
  assert.notEqual(retried.jobId, first.jobId);
  assert.equal(s.action(BASE).kind, "QUEUED");

  assert.equal(s.startNext().jobId, retried.jobId);
  assert.equal(s.complete(retried.jobId, fixture()).kind, "SUCCEEDED");
  assert.equal(s.action(BASE).kind, "READY");
});

test("C15: 실패 기록은 예산 소진 후에도 보이고 재시도는 차단한다", () => {
  const s = qa({budgetUnits: 1});
  const first = s.request(BASE, ALLOW);

  assert.equal(s.startNext().jobId, first.jobId);
  assert.equal(s.fail(first.jobId).kind, "FAILED");

  const view = s.action(BASE, {requestAllowed: true});
  assert.equal(view.kind, "FAILED");
  assert.equal(view.action.type, "NONE");
  assert.equal(view.action.enabled, false);
  assert.equal(s.request(BASE, ALLOW).kind, "QUOTA_DEFERRED");
  assert.equal(s.stats().createdJobs, 1);
});
