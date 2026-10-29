
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");

const contractSource = fs.readFileSync(
  path.join(root, "extension", "hover-summary-contract.js"),
  "utf8"
);

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "shared",
      "contracts",
      "analysis-v1",
      "fixtures",
      "ready.snapshot.json"
    ),
    "utf8"
  )
);

const VIDEO = "Ab0_-123xyz";
const OTHER_VIDEO = "Zb0_-123xyz";

function createContract() {
  const context = vm.createContext({});

  vm.runInContext(
    contractSource,
    context,
    { filename: "hover-summary-contract.js" }
  );

  return context.YUTOPIA_HOVER_SUMMARY_CONTRACT;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeSummary() {
  const count = fixture.sample.classifiedCount;

  return {
    snapshotId: fixture.snapshotId,
    target: { ...fixture.target },
    status: "READY",

    provenance: {
      sourceType: "STATIC_FIXTURE",
      isSynthetic: true,
      visibility: "PUBLIC_REUSABLE",
      tenantId: null,
    },

    observationScope: { ...fixture.scope },
    observedAt: fixture.observedAt,
    analyzedAt: fixture.analyzedAt,

    valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC",

    sentimentPercent: {
      denominator: count,
      positivePercent:
        fixture.sentiment.positive / count * 100,
      neutralPercent:
        fixture.sentiment.neutral / count * 100,
      negativePercent:
        fixture.sentiment.negative / count * 100,
      classificationCoveragePercent:
        count / fixture.sample.eligibleCount * 100,
    },

    topTopics: fixture.topics.map(topic => ({
      topicId: topic.topicId,
      mentionCount: topic.mentionCount,
    })),
  };
}

function packet(contract, request, result) {
  return {
    type: contract.RESPONSE_TYPE,
    version: contract.VERSION,
    requestId: request.requestId,
    targetType: request.targetType,
    targetId: request.targetId,
    targetKey:
      request.targetType + ":" + request.targetId,
    result,
  };
}

test("유효한 VIDEO 요청을 생성하고 정규화한다", () => {
  const c = createContract();

  const req = c.makeRequest("VIDEO", VIDEO, 1);

  assert.equal(req.type, "YUTOPIA_HOVER_SUMMARY_GET_V1");
  assert.equal(req.version, 1);
  assert.equal(req.targetId, VIDEO);
  assert.equal(Object.isFrozen(req), true);
});

test("잘못된 ID, requestId, 추가 필드를 거부한다", () => {
  const c = createContract();

  assert.equal(
    c.makeRequest("VIDEO", "invalid", 1),
    null
  );

  assert.equal(
    c.makeRequest("CHANNEL", "@handle", 1),
    null
  );

  assert.equal(
    c.makeRequest("VIDEO", VIDEO, 0),
    null
  );

  assert.equal(
    c.makeRequest("VIDEO", VIDEO, 1.5),
    null
  );

  const req = c.makeRequest("VIDEO", VIDEO, 1);

  assert.equal(
    c.parseRequest({ ...req, extra: true }),
    null
  );
});

test("READY Snapshot Summary 응답을 검증한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 7);

  const response = c.makeResponse(req, {
    kind: "SNAPSHOT",
    summary: makeSummary(),
  });

  assert.ok(response);

  const accepted = c.parseResponse(
    plain(response),
    req
  );

  assert.ok(accepted);
  assert.equal(accepted.result.kind, "SNAPSHOT");

  assert.equal(
    accepted.result.summary.snapshotId,
    fixture.snapshotId
  );

  assert.equal(
    accepted.result.summary.sentimentPercent.denominator,
    80
  );

  assert.equal(
    accepted.result.summary.sentimentPercent.positivePercent,
    62.5
  );
});

test("이전 requestId와 다른 대상의 응답은 거부한다", () => {
  const c = createContract();

  const current = c.makeRequest("VIDEO", VIDEO, 10);

  const valid = packet(c, current, {
    kind: "SNAPSHOT",
    summary: makeSummary(),
  });

  assert.equal(
    c.parseResponse({
      ...valid,
      requestId: 9,
    }, current),
    null
  );

  assert.equal(
    c.parseResponse({
      ...valid,
      targetId: OTHER_VIDEO,
    }, current),
    null
  );

  assert.equal(
    c.parseResponse({
      ...valid,
      targetKey: "VIDEO:" + OTHER_VIDEO,
    }, current),
    null
  );
});

test("NOT_FOUND와 NO_DATA 스냅샷을 구분한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 1);

  const notFound = c.makeResponse(req, {
    kind: "NOT_FOUND",
  });

  assert.equal(notFound.result.kind, "NOT_FOUND");

  const noDataSummary = {
    ...makeSummary(),
    status: "NO_DATA",
    observedAt: null,
    analyzedAt: null,
    sentimentPercent: null,
    topTopics: [],
  };

  const noData = c.makeResponse(req, {
    kind: "SNAPSHOT",
    summary: noDataSummary,
  });

  assert.ok(noData);
  assert.equal(noData.result.kind, "SNAPSHOT");
  assert.equal(noData.result.summary.status, "NO_DATA");
  assert.equal(noData.result.summary.sentimentPercent, null);
});

test("PARTIAL의 분모 미확정 상태를 허용한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 2);

  const response = c.makeResponse(req, {
    kind: "SNAPSHOT",
    summary: {
      ...makeSummary(),
      status: "PARTIAL",
      sentimentPercent: null,
      topTopics: [],
    },
  });

  assert.ok(response);
  assert.equal(
    response.result.summary.sentimentPercent,
    null
  );
});

test("STALE의 감성 수치 노출을 차단한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 3);

  const stale = {
    ...makeSummary(),
    status: "STALE",
  };

  assert.equal(
    c.makeResponse(req, {
      kind: "SNAPSHOT",
      summary: stale,
    }),
    null
  );

  const safe = c.makeResponse(req, {
    kind: "SNAPSHOT",
    summary: {
      ...stale,
      sentimentPercent: null,
      topTopics: [],
    },
  });

  assert.ok(safe);
  assert.equal(safe.result.summary.status, "STALE");
});

test("정해진 REJECTED 사유만 허용한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 1);

  const valid = c.makeResponse(req, {
    kind: "REJECTED",
    reason: "SOURCE_ERROR",
  });

  assert.ok(valid);
  assert.equal(valid.result.reason, "SOURCE_ERROR");

  assert.equal(
    c.makeResponse(req, {
      kind: "REJECTED",
      reason: "UNKNOWN_REASON",
    }),
    null
  );

  assert.equal(
    c.makeResponse(req, {
      kind: "REJECTED",
      reason: "SOURCE_ERROR",
      internalToken: "SECRET",
    }),
    null
  );
});

test("가상 Preview 및 비공개·비합성 출처를 거부한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 1);

  const base = makeSummary();

  const invalid = [
    {
      ...base,
      valueSemantics: "ILLUSTRATIVE_ONLY",
    },
    {
      ...base,
      provenance: {
        ...base.provenance,
        sourceType: "APPROVED_PROVIDER",
        isSynthetic: false,
      },
    },
    {
      ...base,
      provenance: {
        ...base.provenance,
        visibility: "TENANT_PRIVATE",
        tenantId: "tenant-a",
      },
    },
    {
      ...base,
      target: {
        ...base.target,
        targetId: OTHER_VIDEO,
      },
    },
  ];

  for (const summary of invalid) {
    assert.equal(
      c.makeResponse(req, {
        kind: "SNAPSHOT",
        summary,
      }),
      null
    );
  }
});

test("잘못된 감성 비율과 주제 정보를 거부한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 1);

  const base = makeSummary();

  const invalid = [
    {
      ...base,
      sentimentPercent: {
        ...base.sentimentPercent,
        denominator: 0,
      },
    },
    {
      ...base,
      sentimentPercent: {
        ...base.sentimentPercent,
        positivePercent: 90,
      },
    },
    {
      ...base,
      sentimentPercent: {
        ...base.sentimentPercent,
        negativePercent: -1,
      },
    },
    {
      ...base,
      topTopics: [
        ...base.topTopics,
        { topicId: "EXTRA", mentionCount: 1 },
      ],
    },
    {
      ...base,
      topTopics: [
        base.topTopics[0],
        base.topTopics[0],
      ],
    },
  ];

  for (const summary of invalid) {
    assert.equal(
      c.makeResponse(req, {
        kind: "SNAPSHOT",
        summary,
      }),
      null
    );
  }
});

test("추가 필드와 잘못된 관측 기간을 거부한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 1);

  const valid = packet(c, req, {
    kind: "SNAPSHOT",
    summary: makeSummary(),
  });

  assert.equal(
    c.parseResponse({
      ...valid,
      unexpected: true,
    }, req),
    null
  );

  const invalidSummary = {
    ...makeSummary(),
    observationScope: {
      ...fixture.scope,
      windowStart: fixture.scope.windowEnd,
      windowEnd: fixture.scope.windowStart,
    },
  };

  assert.equal(
    c.makeResponse(req, {
      kind: "SNAPSHOT",
      summary: invalidSummary,
    }),
    null
  );
});

test("검증된 응답을 복제하고 중첩 객체까지 동결한다", () => {
  const c = createContract();
  const req = c.makeRequest("VIDEO", VIDEO, 1);
  const summary = makeSummary();

  const accepted = c.makeResponse(req, {
    kind: "SNAPSHOT",
    summary,
  });

  assert.ok(accepted);

  assert.equal(Object.isFrozen(accepted), true);
  assert.equal(Object.isFrozen(accepted.result), true);

  const resultSummary = accepted.result.summary;

  assert.equal(Object.isFrozen(resultSummary), true);
  assert.equal(Object.isFrozen(resultSummary.target), true);
  assert.equal(Object.isFrozen(resultSummary.provenance), true);
  assert.equal(Object.isFrozen(resultSummary.observationScope), true);
  assert.equal(Object.isFrozen(resultSummary.sentimentPercent), true);
  assert.equal(Object.isFrozen(resultSummary.topTopics), true);
  assert.equal(Object.isFrozen(resultSummary.topTopics[0]), true);

  summary.target.targetId = OTHER_VIDEO;

  assert.equal(
    resultSummary.target.targetId,
    VIDEO
  );
});
