"use strict";

/*
 * YOUTOPIA Admin v1 후보 계약 — 의존성 없는 의미 규칙 점검.
 * 이 테스트는 완전한 JSON Schema Draft 2020-12 검증이나 실제 서버 인가 검증이 아니다.
 * Node 실행 증거 없이 PASS로 기록하지 않는다.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "admin.schema.json"), "utf8"));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(root, "fixtures", name), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const version = "admin-v1-candidate";
const sourceTypes = new Set(["STATIC_FIXTURE", "APPROVED_PROVIDER"]);
const jobStates = new Set(["QUEUED", "RUNNING", "PARTIAL", "FAILED", "SUCCEEDED", "CANCELLED"]);

function validateSource(record) {
  assert.equal(record.contractVersion, version);
  assert.ok(sourceTypes.has(record.sourceType));
  assert.equal(record.isSynthetic, record.sourceType === "STATIC_FIXTURE");
}

function validateCoverage(sample) {
  if (sample === null) return;
  const keys = ["rawCount", "eligibleCount", "excludedCount", "classifiedCount", "unclassifiedCount"];
  const values = keys.map((key) => sample[key]);
  for (const count of values) {
    if (count !== null) assert.ok(Number.isInteger(count) && count >= 0);
  }
  if (values.every((count) => count !== null)) {
    assert.equal(sample.rawCount, sample.eligibleCount + sample.excludedCount);
    assert.equal(sample.eligibleCount, sample.classifiedCount + sample.unclassifiedCount);
  }
  if (sample.windowStart !== null && sample.windowEnd !== null) {
    assert.ok(Date.parse(sample.windowStart) < Date.parse(sample.windowEnd));
  }
}

function validateScope(scope) {
  assert.ok(["GLOBAL_METADATA", "TENANT_PRIVATE"].includes(scope.classification));
  if (scope.classification === "TENANT_PRIVATE") {
    assert.ok(typeof scope.tenantId === "string" && scope.tenantId.length > 0);
  } else {
    assert.equal(scope.tenantId, null);
  }
}

function validateOpsStatus(status) {
  assert.equal(status.kind, "OPS_STATUS");
  validateSource(status);
  assert.ok(["UNCONNECTED", "UNKNOWN", "HEALTHY", "DEGRADED", "UNAVAILABLE"].includes(status.status));
  for (const field of ["queued", "running", "failed"]) {
    const count = status.jobCounts[field];
    if (count !== null) assert.ok(Number.isInteger(count) && count >= 0);
  }
  if (status.status === "UNCONNECTED") {
    assert.equal(status.observedAt, null);
    assert.equal(status.quotaRemaining, null);
    assert.equal(status.jobCounts.queued, null);
    assert.equal(status.jobCounts.running, null);
    assert.equal(status.jobCounts.failed, null);
  }
}

function validateJobDetail(payload) {
  assert.equal(payload.kind, "OPS_JOB_DETAIL");
  assert.equal(payload.contractVersion, version);
  const job = payload.job;
  assert.ok(typeof job.runId === "string" && job.runId.length > 0);
  assert.ok(sourceTypes.has(job.sourceType));
  assert.equal(job.isSynthetic, job.sourceType === "STATIC_FIXTURE");
  validateScope(job.scope);
  assert.ok(jobStates.has(job.state));
  assert.ok(Number.isInteger(job.attempt) && job.attempt >= 1);
  assert.ok(Date.parse(job.requestedAt) <= Date.parse(job.updatedAt));
  assert.ok(Array.isArray(payload.eventHistory));
  for (const entry of payload.eventHistory) {
    assert.ok(jobStates.has(entry.state));
    assert.ok(Date.parse(entry.occurredAt) >= Date.parse(job.requestedAt));
    assert.ok(Date.parse(entry.occurredAt) <= Date.parse(job.updatedAt));
  }
  validateCoverage(payload.coverage);
}

function validatePolicyOverview(value) {
  validateSource(value);
  assert.equal(value.kind, "POLICY_OVERVIEW");
  assert.ok(["UNKNOWN", "BLOCKED", "APPROVED"].includes(value.approvalStatus));
  if (value.approvalStatus === "APPROVED") {
    assert.ok(typeof value.approvalEvidenceRef === "string" && value.approvalEvidenceRef.length > 0);
    assert.ok(typeof value.policyRevision === "string" && value.policyRevision.length > 0);
    assert.ok(typeof value.reviewedAt === "string" && Number.isFinite(Date.parse(value.reviewedAt)));
  }
  // 합성 Fixture의 APPROVED는 운영 허가 증거로 인정하지 않는다.
  if (value.isSynthetic) assert.notEqual(value.approvalStatus, "APPROVED");
}

function validatePolicyDecision(value) {
  validateSource(value);
  assert.equal(value.kind, "POLICY_DECISION");
  assert.equal(typeof value.allow, "boolean");
  if (value.allow) {
    assert.ok(typeof value.approvalEvidenceRef === "string" && value.approvalEvidenceRef.length > 0);
    assert.ok(typeof value.policyRevision === "string" && value.policyRevision.length > 0);
  }
  // 실제 라이브 권한을 합성 입력으로 획득하는 경로를 테스트에서 차단.
  if (value.isSynthetic) assert.equal(value.allow, false);
}

function validateAudit(value) {
  validateSource(value);
  assert.equal(value.kind, "AUDIT_EVENT");
  assert.ok(["ALLOW", "DENY", "ERROR"].includes(value.outcome));
  // 사용자 이메일/토큰/원시 댓글을 감사 참조에 넣지 않는다.
  for (const field of ["actorRef", "targetRef"]) {
    assert.ok(typeof value[field] === "string" && value[field].length > 0);
    assert.doesNotMatch(value[field], /@|bearer\s|authorization\s*:/i);
  }
}

test("admin v1 definitions and response kinds are present", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(Object.keys(schema.$defs).length, 11);
  assert.equal(schema.oneOf.length, 6);
  for (const entry of schema.oneOf) {
    const definitionName = entry.$ref.replace("#/$defs/", "");
    assert.ok(Object.hasOwn(schema.$defs, definitionName));
  }
});

test("UNCONNECTED requires unknown counts, not fabricated zeros", () => {
  const sample = fixture("ops-unconnected.json");
  validateOpsStatus(sample);
  const inventedZero = clone(sample);
  inventedZero.jobCounts.failed = 0;
  assert.throws(() => validateOpsStatus(inventedZero));
  const inventedTimestamp = clone(sample);
  inventedTimestamp.observedAt = "2026-10-21T12:00:00Z";
  assert.throws(() => validateOpsStatus(inventedTimestamp));
});

test("policy without source approval remains UNKNOWN", () => {
  const policy = fixture("policy-unknown.json");
  validatePolicyOverview(policy);
  const falseApproval = clone(policy);
  falseApproval.approvalStatus = "APPROVED";
  falseApproval.approvalEvidenceRef = "SYNTH-FORGED-APPROVAL";
  falseApproval.policyRevision = "SYNTH-V1";
  falseApproval.reviewedAt = "2026-10-21T12:00:00Z";
  assert.throws(() => validatePolicyOverview(falseApproval));
});

test("failed job records stable run metadata, scope and arithmetic", () => {
  const job = fixture("job-failed.synthetic.json");
  validateJobDetail(job);
  const invalidTenant = clone(job);
  invalidTenant.job.scope.tenantId = null;
  assert.throws(() => validateJobDetail(invalidTenant));
  const invalidCoverage = clone(job);
  invalidCoverage.coverage.classifiedCount = 61;
  assert.throws(() => validateJobDetail(invalidCoverage));
  const invertedTime = clone(job);
  invertedTime.eventHistory[1].occurredAt = "2026-10-21T11:00:00Z";
  assert.throws(() => validateJobDetail(invertedTime));
});

test("policy decision cannot grant approval through synthetic fixture", () => {
  const denied = fixture("policy-denied.synthetic.json");
  validatePolicyDecision(denied);
  const fakeApproved = clone(denied);
  fakeApproved.allow = true;
  fakeApproved.approvalEvidenceRef = "SYNTH-FORGED-DECISION";
  fakeApproved.policyRevision = "SYNTH-V1";
  assert.throws(() => validatePolicyDecision(fakeApproved));
});

test("audit event is scoped and does not embed obvious secrets or email", () => {
  const audit = fixture("audit-denied.synthetic.json");
  validateAudit(audit);
  const withEmail = clone(audit);
  withEmail.actorRef = "user@example.com";
  assert.throws(() => validateAudit(withEmail));
});

test("forbidden access is a terminal authorization error", () => {
  const error = fixture("error-forbidden.synthetic.json");
  assert.equal(error.contractVersion, version);
  assert.equal(error.kind, "ERROR");
  assert.equal(error.httpStatus, 403);
  assert.equal(error.retryable, false);
});
