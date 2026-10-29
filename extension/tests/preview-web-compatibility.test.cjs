
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");

const modelSource = fs.readFileSync(
  path.join(ROOT, "extension", "hover-card-model.js"),
  "utf8"
);

const readySnapshot = JSON.parse(
  fs.readFileSync(
    path.join(
      ROOT,
      "shared",
      "contracts",
      "analysis-v1",
      "fixtures",
      "ready.snapshot.json"
    ),
    "utf8"
  )
);

function createModel() {
  const context = vm.createContext({});

  vm.runInContext(modelSource, context, {
    filename: "hover-card-model.js",
  });

  return context.YUTOPIA_HOVER_CARD_MODEL;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const VIDEO = "Ab0_-123xyz";
const CHANNEL = "UC" + "a".repeat(22);

test("Preview와 Web이 동일한 YouTube 영상 식별 규칙을 사용한다", () => {
  const model = createModel();

  const preview = model.mockForTarget({
    targetType: "VIDEO",
    targetId: VIDEO,
  });

  assert.ok(preview);

  assert.deepEqual(
    plain(preview.previewContract.target),
    readySnapshot.target
  );

  assert.equal(
    preview.previewContract.provenance.sourceType,
    readySnapshot.sourceType
  );

  assert.equal(
    preview.previewContract.provenance.isSynthetic,
    readySnapshot.isSynthetic
  );
});

test("Preview를 READY 분석 스냅샷으로 승격하지 않는다", () => {
  const preview = createModel().mockForTarget({
    targetType: "VIDEO",
    targetId: VIDEO,
  });

  const metadata = preview.previewContract;

  assert.equal(
    metadata.contractVersion,
    "preview-web-compat-v1-draft"
  );

  assert.equal(
    metadata.valueSemantics,
    "ILLUSTRATIVE_ONLY"
  );

  assert.equal(metadata.snapshotId, null);
  assert.equal(metadata.analysisStatus, null);
  assert.equal(metadata.observationScope, null);
  assert.equal(metadata.observedAt, null);
  assert.equal(metadata.analyzedAt, null);

  assert.equal(readySnapshot.status, "READY");
  assert.notEqual(
    metadata.contractVersion,
    readySnapshot.contractVersion
  );
});

test("가상 백분율을 Web의 감성 집계 건수로 변환하지 않는다", () => {
  const preview = createModel().mockForTarget({
    targetType: "VIDEO",
    targetId: VIDEO,
  });

  const metadata = preview.previewContract;

  assert.equal(
    preview.positive + preview.neutral + preview.negative,
    100
  );

  assert.equal(metadata.sampleCounts, null);
  assert.equal(metadata.sentimentCounts, null);
  assert.equal(metadata.sentimentDenominator, null);

  assert.equal(readySnapshot.sample.classifiedCount, 80);

  assert.equal(
    readySnapshot.sentiment.positive /
      readySnapshot.sample.classifiedCount,
    0.625
  );

  assert.match(preview.sampleLabel, /가상/);
  assert.match(preview.periodLabel, /가상/);
});

test("CHANNEL도 공통 식별 메타데이터를 유지한다", () => {
  const preview = createModel().mockForTarget({
    targetType: "CHANNEL",
    targetId: CHANNEL,
  });

  assert.ok(preview);

  assert.deepEqual(
    plain(preview.previewContract.target),
    {
      source: "YOUTUBE",
      targetType: "CHANNEL",
      targetId: CHANNEL,
    }
  );

  assert.equal(
    preview.previewContract.valueSemantics,
    "ILLUSTRATIVE_ONLY"
  );

  assert.equal(
    preview.previewContract.observationScope,
    null
  );
});

test("미확인 handle과 잘못된 대상에는 계약을 생성하지 않는다", () => {
  const model = createModel();

  for (const target of [
    { targetType: "CHANNEL", targetId: "@unresolved" },
    { targetType: "VIDEO", targetId: "invalid" },
    { targetType: "CHANNEL", targetId: VIDEO },
    { targetType: "OTHER", targetId: VIDEO },
  ]) {
    assert.equal(model.mockForTarget(target), null);
  }
});

test("Preview 메타데이터는 불변이며 같은 입력에 결정적이다", () => {
  const model = createModel();
  const target = {
    targetType: "VIDEO",
    targetId: VIDEO,
  };

  const first = model.mockForTarget(target);
  const second = model.mockForTarget(target);

  assert.deepEqual(plain(first), plain(second));

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.previewContract), true);
  assert.equal(Object.isFrozen(first.previewContract.target), true);
  assert.equal(Object.isFrozen(first.previewContract.provenance), true);
});
