"use strict";

/**
 * YOUTOPIA YU-32 G4-2 — 오프라인 후보 계약/부정 테스트 보조 코드.
 *
 * 네트워크·DB·인증/세션·HTTP·Chrome·YouTube 호출 없음.
 * NEVER use this module as a production authorization service.
 * A test-only APPROVED_TEST_ONLY marker cannot approve real source policy.
 */
const {normalizeScope} = require("../../experiments/coverage-scheduler-v0/engine.cjs");

const REQUEST_FIELDS = [
  "target", "analysisSpecVersion", "observationWindowId",
  "samplingPolicyVersion", "locale",
];
const TARGET_FIELDS = ["source", "targetType", "targetId"];
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const VERSION = /^[A-Za-z0-9._:-]{1,80}$/;
const LOCALE = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSITIONS = Object.freeze({
  QUEUED: Object.freeze(["RUNNING", "FAILED"]),
  RUNNING: Object.freeze(["SUCCEEDED", "FAILED"]),
  SUCCEEDED: Object.freeze([]),
  FAILED: Object.freeze([]),
});

function exactRecord(value, fields) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every(field => Object.prototype.hasOwnProperty.call(value, field));
}

/**
 * 검증하지 않은 클라이언트 요청에서 scope.visibility, tenantId, role,
 * policyApproved, requestAllowed, isTrusted 등 서버 판정을 받지 않는다.
 */
function parseCreateJobRequest(value) {
  try {
    if (!exactRecord(value, REQUEST_FIELDS) ||
        !exactRecord(value.target, TARGET_FIELDS)) return null;

    if (value.target.source !== "YOUTUBE" ||
        value.target.targetType !== "VIDEO" ||
        typeof value.target.targetId !== "string" ||
        !VIDEO_ID.test(value.target.targetId) ||
        typeof value.analysisSpecVersion !== "string" ||
        !VERSION.test(value.analysisSpecVersion) ||
        typeof value.observationWindowId !== "string" ||
        !VERSION.test(value.observationWindowId) ||
        typeof value.samplingPolicyVersion !== "string" ||
        !VERSION.test(value.samplingPolicyVersion) ||
        typeof value.locale !== "string" ||
        !LOCALE.test(value.locale)) return null;

    return Object.freeze({
      target: Object.freeze({
        source: "YOUTUBE",
        targetType: "VIDEO",
        targetId: value.target.targetId,
      }),
      analysisSpecVersion: value.analysisSpecVersion,
      observationWindowId: value.observationWindowId,
      samplingPolicyVersion: value.samplingPolicyVersion,
      locale: value.locale,
    });
  } catch {
    return null;
  }
}

// 테스트용 고정 순서 직렬화; 실제 서버의 안전한 digest/DB 멱등성 구현이 아니다.
function requestFingerprint(value) {
  const request = parseCreateJobRequest(value);
  if (!request) return null;
  return JSON.stringify([
    request.target.source,
    request.target.targetType,
    request.target.targetId,
    request.analysisSpecVersion,
    request.observationWindowId,
    request.samplingPolicyVersion,
    request.locale,
  ]);
}

function validIdempotencyKey(value) {
  return typeof value === "string" && UUID_V4.test(value);
}

/**
 * 이중 POST가 발생해도 안전해야 한다는 불변식의 오프라인 예시.
 * 실제 경쟁/원자성/동시성은 DB unique constraint와 transaction으로 검증한다.
 */
function classifyIdempotency(previous, incoming) {
  if (!previous || !incoming ||
      !validIdempotencyKey(previous.key) ||
      !validIdempotencyKey(incoming.key) ||
      typeof previous.principalId !== "string" ||
      typeof incoming.principalId !== "string") {
    return "INVALID_REQUEST";
  }
  const oldFingerprint = requestFingerprint(previous.request);
  const newFingerprint = requestFingerprint(incoming.request);
  if (!oldFingerprint || !newFingerprint) return "INVALID_REQUEST";
  if (previous.principalId !== incoming.principalId ||
      previous.key !== incoming.key) return "NEW";
  return oldFingerprint === newFingerprint ? "REPLAY" : "IDEMPOTENCY_CONFLICT";
}

function deny(reason) {
  return Object.freeze({kind: "DENIED", reason});
}
const ALLOWED_TEST_ONLY = Object.freeze({kind: "ALLOWED_TEST_ONLY"});

/**
 * 검증용 policyState=APPROVED_TEST_ONLY는 가상 시험 데이터다.
 * 실제 서버에서는 독립적인 인증/인가/정책/쿼터/DB 통제가 필요하다.
 */
function evaluateOfflineGate({
  operation,
  scope,
  viewer = null,
  policyState = "POLICY_HOLD",
  featureEnabled = false,
  entitlementGranted = false,
  quotaAvailable = false,
} = {}) {
  if (operation !== "READ" && operation !== "CREATE_JOB") {
    return deny("INVALID_OPERATION");
  }
  const resolved = normalizeScope(scope);
  if (!resolved) return deny("INVALID_SCOPE");

  const kind = viewer?.kind;
  if (kind !== "GUEST" && kind !== "CUSTOMER") {
    return deny("AUTHENTICATION_REQUIRED");
  }
  if (operation === "CREATE_JOB" && kind !== "CUSTOMER") {
    return deny("AUTHENTICATION_REQUIRED");
  }

  if (resolved.visibility === "TENANT_PRIVATE" &&
      (kind !== "CUSTOMER" || viewer.tenantId !== resolved.tenantId)) {
    // 존재 여부 은닉 — 실제 상태의 전부를 보여주지 않는다.
    return deny("RESOURCE_UNAVAILABLE");
  }

  if (policyState !== "APPROVED_TEST_ONLY") {
    return deny("POLICY_BLOCKED");
  }
  if (operation === "READ") return ALLOWED_TEST_ONLY;
  if (featureEnabled !== true) return deny("FEATURE_DISABLED");
  if (entitlementGranted !== true) return deny("ENTITLEMENT_LIMITED");
  if (quotaAvailable !== true) return deny("QUOTA_DEFERRED");

  return ALLOWED_TEST_ONLY;
}

/**
 * 단순 검증 통과 플래그만으로 캐시 수치를 표시하도록 허용하지 않는다.
 * 반드시 동일 Snapshot ID·상태·시각·9필드 Scope로 묶인 합성 참조가 필요하다.
 * 주의: 참조 메타데이터 검사이며 원본/분모 검증을 대체하지 않는다.
 */
function canShowSyntheticMetrics({lookup, verifiedSnapshot, expectedScope, gate} = {}) {
  if (gate?.kind !== "ALLOWED_TEST_ONLY" ||
      lookup?.kind !== "FRESH" ||
      !["READY", "PARTIAL"].includes(lookup.status)) return false;

  const scope = normalizeScope(expectedScope);
  const reference = parseSnapshotReference(verifiedSnapshot);
  if (!scope || !reference ||
      reference.sourceType !== "STATIC_FIXTURE" ||
      reference.isSynthetic !== true ||
      reference.snapshotId !== lookup.snapshotId ||
      reference.status !== lookup.status ||
      reference.analyzedAt !== lookup.analyzedAt) return false;

  return Object.keys(scope).every(key => reference.scope[key] === scope[key]);
}

function mayTransitionJob(from, to, verifiedSnapshotId = null) {
  // "__proto__"/"constructor"가 Object.prototype의 메서드를 호출하지 않도록 차단.
  if (!Object.hasOwn(TRANSITIONS, from) ||
      !TRANSITIONS[from].includes(to)) return false;
  if (to === "SUCCEEDED") {
    return typeof verifiedSnapshotId === "string" &&
      /^[A-Za-z0-9._:-]{1,128}$/.test(verifiedSnapshotId);
  }
  return verifiedSnapshotId === null;
}

/**
 * Date.parse()는 존재하지 않는 날짜(예: 2월 30일)를 보정할 수 있으므로
 * 달력과 RFC3339 UTC offset을 먼저 독립 검증한다.
 */
function validRfc3339(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1] && Number.isFinite(Date.parse(value));
}

/**
 * 후보 Snapshot 메타데이터만 검증한다. 원문/서명/출처 사용권 또는
 * analysis-v1 전체 분모 검증을 대체하지 않는다.
 */
function parseSnapshotReference(value) {
  const fields=[
    "kind", "snapshotId", "scope", "status", "sourceType",
    "isSynthetic", "analyzedAt", "payloadContract",
  ];
  try {
    if (!exactRecord(value,fields) ||
        value.kind !== "SNAPSHOT_REFERENCE" ||
        typeof value.snapshotId !== "string" ||
        !/^[A-Za-z0-9._:-]{1,128}$/.test(value.snapshotId) ||
        value.payloadContract !== "analysis-v1-candidate") return null;

    const scope=normalizeScope(value.scope);
    if (!scope) return null;

    if (!["READY","PARTIAL","STALE","NO_DATA"].includes(value.status)) return null;
    if (!["STATIC_FIXTURE","APPROVED_PROVIDER"].includes(value.sourceType)) return null;
    if (value.isSynthetic !== (value.sourceType === "STATIC_FIXTURE")) return null;

    const hasTime = validRfc3339(value.analyzedAt);

    if (value.status === "NO_DATA" && value.analyzedAt !== null) return null;
    if (["READY","PARTIAL"].includes(value.status) && !hasTime) return null;
    if (value.status === "STALE" && value.analyzedAt !== null && !hasTime) return null;

    return Object.freeze({
      kind:"SNAPSHOT_REFERENCE",
      snapshotId:value.snapshotId,
      scope,
      status:value.status,
      sourceType:value.sourceType,
      isSynthetic:value.isSynthetic,
      analyzedAt:value.analyzedAt,
      payloadContract:"analysis-v1-candidate",
    });
  } catch {
    return null;
  }
}

// 참조가 동일 Scope에 속하는지만 확인한다. 검증된 Snapshot 본문/서명을 대체하지 않는다.
function matchesSnapshotScope(scope, snapshot) {
  try {
    const resolved = normalizeScope(scope);
    if (!resolved || !snapshot || typeof snapshot !== "object") return false;
    return snapshot.target?.source === resolved.source &&
      snapshot.target?.targetType === resolved.targetType &&
      snapshot.target?.targetId === resolved.targetId &&
      snapshot.analysisSpecVersion === resolved.analysisSpecVersion &&
      snapshot.observationWindowId === resolved.observationWindowId &&
      snapshot.samplingPolicyVersion === resolved.samplingPolicyVersion &&
      snapshot.locale === resolved.locale &&
      snapshot.visibility === resolved.visibility &&
      snapshot.tenantId === resolved.tenantId;
  } catch {
    return false;
  }
}

module.exports = Object.freeze({
  parseCreateJobRequest,
  requestFingerprint,
  validIdempotencyKey,
  classifyIdempotency,
  evaluateOfflineGate,
  canShowSyntheticMetrics,
  mayTransitionJob,
  parseSnapshotReference,
  matchesSnapshotScope,
});
