"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "analysis.schema.json"), "utf8"));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(root, "fixtures", name), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

const ANALYSIS_VERSION = "analysis-v1-candidate";
const RESULT_STATES = new Set(["READY", "PARTIAL", "STALE", "NO_DATA", "COMMENTS_DISABLED", "ENTITLEMENT_LIMITED", "POLICY_BLOCKED", "ERROR"]);
const NO_ANALYSIS_STATES = new Set(["NO_DATA", "COMMENTS_DISABLED", "ENTITLEMENT_LIMITED", "POLICY_BLOCKED", "ERROR"]);

function validateTarget(target) {
  assert.equal(target.source, "YOUTUBE");
  assert.ok(target.targetType === "VIDEO" || target.targetType === "CHANNEL");
  if (target.targetType === "VIDEO") {
    assert.match(target.targetId, /^[A-Za-z0-9_-]{11}$/);
  } else {
    assert.match(target.targetId, /^UC[A-Za-z0-9_-]{22}$/);
  }
}

function validateSnapshot(snapshot) {
  assert.equal(snapshot.contractVersion, ANALYSIS_VERSION);
  validateTarget(snapshot.target);
  assert.ok(RESULT_STATES.has(snapshot.status));
  assert.ok(["PUBLIC_REUSABLE", "TENANT_PRIVATE"].includes(snapshot.visibility));
  assert.ok(["STATIC_FIXTURE", "APPROVED_PROVIDER"].includes(snapshot.sourceType));
  assert.equal(snapshot.isSynthetic, snapshot.sourceType === "STATIC_FIXTURE");
  if (snapshot.visibility === "TENANT_PRIVATE") {
    assert.equal(typeof snapshot.tenantId, "string");
    assert.ok(snapshot.tenantId.length > 0);
  } else {
    assert.equal(snapshot.tenantId, null);
  }
  const start = Date.parse(snapshot.scope.windowStart);
  const end = Date.parse(snapshot.scope.windowEnd);
  assert.ok(Number.isFinite(start) && Number.isFinite(end) && start < end);
  if (NO_ANALYSIS_STATES.has(snapshot.status)) {
    assert.equal(snapshot.sample, null);
    assert.equal(snapshot.sentiment, null);
    assert.deepEqual(snapshot.topics, []);
    assert.equal(snapshot.analyzedAt, null);
    return;
  }
  assert.ok(snapshot.sample && snapshot.sentiment);
  const sample = snapshot.sample;
  const values = [sample.rawCount, sample.eligibleCount, sample.excludedCount, sample.classifiedCount, sample.unclassifiedCount];
  for (const value of values) {
    if (value !== null) assert.ok(Number.isInteger(value) && value >= 0);
  }
  if (values.every((value) => value !== null)) {
    assert.equal(sample.rawCount, sample.eligibleCount + sample.excludedCount);
    assert.equal(sample.eligibleCount, sample.classifiedCount + sample.unclassifiedCount);
  }
  if (sample.classifiedCount !== null) {
    assert.equal(snapshot.sentiment.positive + snapshot.sentiment.neutral + snapshot.sentiment.negative, sample.classifiedCount);
  }
  for (const topic of snapshot.topics) {
    assert.ok(topic.mentionCount >= topic.classifiedTopicCount);
    assert.ok(topic.classifiedTopicCount >= topic.negativeTopicCount);
    if (sample.eligibleCount !== null) assert.ok(topic.mentionCount <= sample.eligibleCount);
  }
  if (snapshot.status === "READY") {
    assert.ok((sample.classifiedCount ?? 0) > 0);
  }
  assert.ok(Date.parse(snapshot.analyzedAt) >= Date.parse(snapshot.observedAt));
}

function validateTrend(trend) {
  assert.equal(trend.contractVersion, ANALYSIS_VERSION);
  validateTarget(trend.target);
  assert.ok(["COMPARABLE", "CONDITIONAL", "UNCOMPARABLE"].includes(trend.comparability));
  assert.ok(["READY", "TREND_UNAVAILABLE"].includes(trend.state));
  if (trend.state === "READY") {
    assert.ok(trend.bins.length >= 2, "trend requires at least two time bins");
    assert.notEqual(trend.comparability, "UNCOMPARABLE");
  }
  let previousEnd = -Infinity;
  for (const bin of trend.bins) {
    const start = Date.parse(bin.windowStart);
    const end = Date.parse(bin.windowEnd);
    assert.ok(start >= previousEnd && start < end, "trend bins must be chronological and non-overlapping");
    previousEnd = end;
    const counts = [bin.eligibleCount, bin.topicMentionCount, bin.sentimentClassifiedTopicCount, bin.negativeTopicCount];
    if (counts.every((v) => v !== null)) {
      assert.ok(bin.eligibleCount >= bin.topicMentionCount);
      assert.ok(bin.topicMentionCount >= bin.sentimentClassifiedTopicCount);
      assert.ok(bin.sentimentClassifiedTopicCount >= bin.negativeTopicCount);
    }
  }
}

function safeRatio(numerator, denominator) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

test("M1 draft JSON Schema exposes six cross-team contracts", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  for (const name of ["AnalysisTarget", "AnalysisSnapshot", "AnalysisJob", "TopicTrend", "ErrorEnvelope", "UserEntitlement"]) {
    assert.ok(schema.$defs[name], "missing " + name);
  }
});

for (const name of ["ready.snapshot.json", "partial.snapshot.json", "no-data.snapshot.json", "policy-blocked.snapshot.json"]) {
  test("candidate semantic fixture: " + name, () => {
    const item = fixture(name);
    validateSnapshot(item);
    assert.equal(item.isSynthetic, true);
    assert.equal(item.sourceType, "STATIC_FIXTURE");
  });
}

test("READY fixture count denominators and topic sentiment are distinct", () => {
  const item = fixture("ready.snapshot.json");
  assert.equal(item.sample.rawCount, 120);
  assert.equal(item.sample.eligibleCount, 100);
  assert.equal(item.sample.classifiedCount, 80);
  assert.equal(safeRatio(item.sentiment.negative, item.sample.classifiedCount), 0.125);
  const price = item.topics.find((t) => t.topicId === "PRICE");
  assert.equal(safeRatio(price.mentionCount, item.sample.eligibleCount), 0.22);
  assert.equal(safeRatio(price.negativeTopicCount, price.classifiedTopicCount), 0.35);
});

test("reject invalid or unresolved video identity", () => {
  const item = clone(fixture("ready.snapshot.json"));
  item.target.targetId = "@unresolved";
  assert.throws(() => validateSnapshot(item));
});

test("reject mismatch of raw, eligible, excluded counts", () => {
  const item = clone(fixture("ready.snapshot.json"));
  item.sample.rawCount = 121;
  assert.throws(() => validateSnapshot(item));
});

test("reject mismatch of classified, unclassified counts", () => {
  const item = clone(fixture("ready.snapshot.json"));
  item.sample.unclassifiedCount = 21;
  assert.throws(() => validateSnapshot(item));
});

test("reject fabricated sentiment on no-data", () => {
  const item = clone(fixture("no-data.snapshot.json"));
  item.sentiment = { positive: 0, neutral: 0, negative: 0 };
  assert.throws(() => validateSnapshot(item));
});

test("reject tenant-private snapshot without tenant scope", () => {
  const item = clone(fixture("ready.snapshot.json"));
  item.visibility = "TENANT_PRIVATE";
  assert.throws(() => validateSnapshot(item));
});

test("reject source provenance inconsistent with synthetic flag", () => {
  const item = clone(fixture("ready.snapshot.json"));
  item.sourceType = "APPROVED_PROVIDER";
  assert.throws(() => validateSnapshot(item));
});

test("reject a topic negative count larger than classified topic count", () => {
  const item = clone(fixture("ready.snapshot.json"));
  item.topics[0].negativeTopicCount = 31;
  assert.throws(() => validateSnapshot(item));
});

test("reject a contract version mismatch", () => {
  const item = clone(fixture("ready.snapshot.json"));
  item.contractVersion = "analysis-v2";
  assert.throws(() => validateSnapshot(item));
});

test("synthetic two-bin topic trend retains separate denominators", () => {
  const item = fixture("topic-trend.json");
  validateTrend(item);
  assert.equal(safeRatio(item.bins[0].topicMentionCount, item.bins[0].eligibleCount), 0.12);
  assert.equal(safeRatio(item.bins[1].topicMentionCount, item.bins[1].eligibleCount), 0.22);
  assert.equal(safeRatio(item.bins[1].negativeTopicCount, item.bins[1].sentimentClassifiedTopicCount), 0.35);
});

test("single time bin may not be treated as ready trend", () => {
  const item = clone(fixture("topic-trend.json"));
  item.bins = [item.bins[0]];
  assert.throws(() => validateTrend(item));
});

test("uncomparable trend may not be marked ready", () => {
  const item = clone(fixture("topic-trend.json"));
  item.comparability = "UNCOMPARABLE";
  assert.throws(() => validateTrend(item));
});

test("zero or unknown denominator does not produce zero-percent sentiment", () => {
  assert.equal(safeRatio(0, 0), null);
  assert.equal(safeRatio(1, null), null);
  assert.equal(safeRatio(null, 10), null);
});

test("time bins must be ordered and not overlap", () => {
  const item = clone(fixture("topic-trend.json"));
  item.bins.reverse();
  assert.throws(() => validateTrend(item));
});
