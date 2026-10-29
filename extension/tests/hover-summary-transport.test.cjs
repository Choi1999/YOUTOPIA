
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");

function read(name) {
  return fs.readFileSync(
    path.join(ROOT, "extension", name),
    "utf8"
  );
}

const contractSource = read("hover-summary-contract.js");
const transportSource = read("hover-summary-transport.js");

const fixture = JSON.parse(
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

const VIDEO_A = "Ab0_-123xyz";
const VIDEO_B = "Zb0_-123xyz";
const EXTENSION_ID = "ext-yutopia";

const SENDER = {
  id: EXTENSION_ID,
  tab: { id: 17 },
  frameId: 0,
  documentId: "doc0123456789",
  url: "https://www.youtube.com/results?search_query=test",
};

function setup() {
  const context = vm.createContext({
    URL, Promise, Date, console,
  });

  vm.runInContext(contractSource, context, {
    filename: "hover-summary-contract.js",
  });

  vm.runInContext(transportSource, context, {
    filename: "hover-summary-transport.js",
  });

  return {
    contract: context.YUTOPIA_HOVER_SUMMARY_CONTRACT,
    transport: context.YUTOPIA_HOVER_SUMMARY_TRANSPORT,
  };
}

function summary(targetId = VIDEO_A) {
  const denominator = fixture.sample.classifiedCount;

  return {
    snapshotId: fixture.snapshotId,
    target: {
      source: "YOUTUBE",
      targetType: "VIDEO",
      targetId,
    },
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
      denominator,
      positivePercent: 62.5,
      neutralPercent: 25,
      negativePercent: 12.5,
      classificationCoveragePercent: 80,
    },
    topTopics: fixture.topics.map(topic => ({
      topicId: topic.topicId,
      mentionCount: topic.mentionCount,
    })),
  };
}

function source(getSummary = async target => ({
  kind: "SNAPSHOT",
  summary: summary(target.targetId),
})) {
  return { getSummary };
}

function receive(worker, message, sender = SENDER) {
  let resolve;
  let answered = false;

  const result = new Promise(done => {
    resolve = done;
  });

  const keep = worker.handleMessage(
    message,
    sender,
    response => {
      answered = true;
      resolve(
        response === null
          ? null
          : JSON.parse(JSON.stringify(response))
      );
    }
  );

  if (!keep && !answered) resolve(null);

  return { keep, result };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });

  return { promise, resolve };
}

test("계약이 로드되지 않으면 Transport를 등록하지 않는다", () => {
  const context = vm.createContext({
    URL, Promise, Date, console,
  });

  vm.runInContext(transportSource, context);

  assert.equal(
    context.YUTOPIA_HOVER_SUMMARY_TRANSPORT,
    undefined
  );
});

test("신뢰된 YouTube 최상위 프레임의 요청에 SNAPSHOT 응답", async () => {
  const { contract, transport } = setup();

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(),
  });

  const request = contract.makeRequest(
    "VIDEO", VIDEO_A, 1
  );

  const task = receive(worker, request);

  assert.equal(task.keep, true);

  const response = await task.result;

  assert.equal(response.result.kind, "SNAPSHOT");
  assert.equal(response.result.summary.status, "READY");
  assert.equal(
    response.result.summary.sentimentPercent.denominator,
    80
  );
  assert.ok(contract.parseResponse(response, request));
});

test("기존 YU-27 메시지와 무관한 요청은 건드리지 않는다", async () => {
  const { transport } = setup();
  let calls = 0;

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(async () => {
      calls++;
      return { kind: "NOT_FOUND" };
    }),
  });

  const task = receive(worker, {
    type: "YUTOPIA_MOCK_PREVIEW_GET_V1",
    version: 1,
    requestId: 1,
    targetType: "VIDEO",
    targetId: VIDEO_A,
  });

  assert.equal(task.keep, false);
  assert.equal(await task.result, null);
  assert.equal(calls, 0);
});

test("잘못된 요청은 공급자에 전달하지 않는다", async () => {
  const { contract, transport } = setup();
  let calls = 0;

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(async () => {
      calls++;
      return { kind: "NOT_FOUND" };
    }),
  });

  const valid = contract.makeRequest(
    "VIDEO", VIDEO_A, 1
  );

  for (const request of [
    { ...valid, requestId: 0 },
    { ...valid, targetId: "invalid" },
    { ...valid, version: 99 },
    { ...valid, unexpected: true },
  ]) {
    const task = receive(worker, request);

    assert.equal(task.keep, false);
    assert.equal(await task.result, null);
  }

  assert.equal(calls, 0);
});

test("위조된 발신자와 Side Panel 발신자를 거부한다", async () => {
  const { contract, transport } = setup();
  let calls = 0;

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(async () => {
      calls++;
      return { kind: "NOT_FOUND" };
    }),
  });

  const request = contract.makeRequest(
    "VIDEO", VIDEO_A, 1
  );

  for (const sender of [
    { ...SENDER, id: "other-extension" },
    { ...SENDER, tab: null },
    { ...SENDER, frameId: 1 },
    { ...SENDER, documentId: "short" },
    {
      ...SENDER,
      url: "https://www.youtube.com.evil.example/",
    },
    {
      id: EXTENSION_ID,
      url: "chrome-extension://ext-yutopia/sidepanel.html",
    },
  ]) {
    const task = receive(worker, request, sender);

    assert.equal(task.keep, false);
    assert.equal(await task.result, null);
  }

  assert.equal(calls, 0);
});

test("오래된 requestId와 동일 ID의 대상 충돌을 거부한다", async () => {
  const { contract, transport } = setup();

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(),
  });

  const current = contract.makeRequest(
    "VIDEO", VIDEO_A, 10
  );

  assert.equal(
    (await receive(worker, current).result).result.kind,
    "SNAPSHOT"
  );

  const stale = contract.makeRequest(
    "VIDEO", VIDEO_A, 9
  );

  const conflict = contract.makeRequest(
    "VIDEO", VIDEO_B, 10
  );

  assert.equal(
    await receive(worker, stale).result,
    null
  );

  assert.equal(
    await receive(worker, conflict).result,
    null
  );
});

test("영상 B가 먼저 완료되면 늦은 A 응답을 무효화한다", async () => {
  const { contract, transport } = setup();

  const a = deferred();
  const b = deferred();

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(target =>
      target.targetId === VIDEO_A
        ? a.promise
        : b.promise
    ),
  });

  const requestA = contract.makeRequest(
    "VIDEO", VIDEO_A, 1
  );

  const requestB = contract.makeRequest(
    "VIDEO", VIDEO_B, 2
  );

  const pendingA = receive(worker, requestA);
  const pendingB = receive(worker, requestB);

  b.resolve({ kind: "NOT_FOUND" });

  const responseB = await pendingB.result;

  assert.equal(responseB.result.kind, "NOT_FOUND");

  a.resolve({
    kind: "SNAPSHOT",
    summary: summary(VIDEO_A),
  });

  assert.equal(await pendingA.result, null);
});

test("탭과 documentId별 요청 순서는 독립적이다", async () => {
  const { contract, transport } = setup();

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(),
  });

  const first = contract.makeRequest(
    "VIDEO", VIDEO_A, 10
  );

  const another = contract.makeRequest(
    "VIDEO", VIDEO_A, 1
  );

  await receive(worker, first).result;

  const otherTab = {
    ...SENDER,
    tab: { id: 18 },
  };

  const otherDocument = {
    ...SENDER,
    documentId: "differentDoc123",
  };

  assert.equal(
    (await receive(worker, another, otherTab).result)
      .result.kind,
    "SNAPSHOT"
  );

  assert.equal(
    (await receive(worker, another, otherDocument).result)
      .result.kind,
    "SNAPSHOT"
  );
});

test("NOT_FOUND와 NO_DATA를 구별하고 공급자 오류를 처리한다", async () => {
  const { contract, transport } = setup();

  const request = contract.makeRequest(
    "VIDEO", VIDEO_A, 1
  );

  const notFoundWorker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(async () => ({ kind: "NOT_FOUND" })),
  });

  const notFound = await receive(
    notFoundWorker, request
  ).result;

  assert.equal(notFound.result.kind, "NOT_FOUND");

  const noDataWorker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(async () => ({
      kind: "SNAPSHOT",
      summary: {
        ...summary(),
        status: "NO_DATA",
        observedAt: null,
        analyzedAt: null,
        sentimentPercent: null,
        topTopics: [],
      },
    })),
  });

  const noData = await receive(
    noDataWorker, request
  ).result;

  assert.equal(noData.result.kind, "SNAPSHOT");
  assert.equal(noData.result.summary.status, "NO_DATA");

  const failedWorker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(async () => {
      throw new Error("TEST_PROVIDER_FAILURE");
    }),
  });

  const failure = await receive(
    failedWorker, request
  ).result;

  assert.equal(failure.result.kind, "REJECTED");
  assert.equal(failure.result.reason, "SOURCE_ERROR");
});

test("잘못된 공급자 데이터는 INVALID_RESPONSE로 격리한다", async () => {
  const { contract, transport } = setup();

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(async () => ({
      kind: "SNAPSHOT",
      summary: {
        ...summary(),
        valueSemantics: "ILLUSTRATIVE_ONLY",
      },
    })),
  });

  const request = contract.makeRequest(
    "VIDEO", VIDEO_A, 1
  );

  const response = await receive(
    worker, request
  ).result;

  assert.equal(response.result.kind, "REJECTED");
  assert.equal(response.result.reason, "INVALID_RESPONSE");
});

test("Content는 검증된 현재 응답만 수락한다", async () => {
  const { contract, transport } = setup();

  const worker = transport.createWorkerAdapter({
    extensionId: EXTENSION_ID,
    provider: source(),
  });

  const client = transport.createContentAdapter({
    sendMessage: request =>
      receive(worker, request).result,

    isCurrentRequest: request =>
      request.requestId === 1 &&
      request.targetId === VIDEO_A,
  });

  const result = await client.getSummary(
    "VIDEO", VIDEO_A, 1
  );

  assert.equal(result.kind, "ACCEPTED");
  assert.equal(result.response.result.kind, "SNAPSHOT");

  assert.equal(
    result.response.result.summary.target.targetId,
    VIDEO_A
  );

  assert.ok(
    contract.parseResponse(
      JSON.parse(JSON.stringify(result.response)),
      contract.makeRequest("VIDEO", VIDEO_A, 1)
    )
  );
});

test("Content는 A의 늦은 응답을 폐기하고 B만 수락한다", async () => {
  const { contract, transport } = setup();

  const a = deferred();
  const b = deferred();

  let currentId = VIDEO_A;

  const client = transport.createContentAdapter({
    sendMessage: request =>
      request.targetId === VIDEO_A
        ? a.promise
        : b.promise,

    isCurrentRequest: request =>
      request.targetId === currentId,
  });

  const pendingA = client.getSummary(
    "VIDEO", VIDEO_A, 1
  );

  currentId = VIDEO_B;

  const pendingB = client.getSummary(
    "VIDEO", VIDEO_B, 2
  );

  b.resolve(
    contract.makeResponse(
      contract.makeRequest("VIDEO", VIDEO_B, 2),
      { kind: "NOT_FOUND" }
    )
  );

  const resultB = await pendingB;

  assert.equal(resultB.kind, "ACCEPTED");
  assert.equal(resultB.response.result.kind, "NOT_FOUND");

  a.resolve(
    contract.makeResponse(
      contract.makeRequest("VIDEO", VIDEO_A, 1),
      { kind: "NOT_FOUND" }
    )
  );

  assert.equal(
    (await pendingA).kind,
    "IGNORED"
  );
});

test("Content는 위조 응답과 송신 실패를 구분한다", async () => {
  const { contract, transport } = setup();

  const request = contract.makeRequest(
    "VIDEO", VIDEO_A, 1
  );

  const forged = {
    ...contract.makeResponse(
      request,
      { kind: "NOT_FOUND" }
    ),
    targetId: VIDEO_B,
  };

  const forgedClient = transport.createContentAdapter({
    sendMessage: () => forged,
    isCurrentRequest: () => true,
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(
      await forgedClient.getSummary(
        "VIDEO", VIDEO_A, 1
      )
    )),
    {
      kind: "TRANSPORT_ERROR",
      reason: "INVALID_RESPONSE",
    }
  );

  const failedClient = transport.createContentAdapter({
    sendMessage: () => {
      throw new Error("SEND_FAILED");
    },
    isCurrentRequest: () => true,
  });

  assert.equal(
    (await failedClient.getSummary(
      "VIDEO", VIDEO_A, 1
    )).reason,
    "SEND_FAILED"
  );
});

test("Content 무효화와 dispose 이후에는 응답을 폐기한다", async () => {
  const { contract, transport } = setup();
  const work = deferred();

  const client = transport.createContentAdapter({
    sendMessage: () => work.promise,
    isCurrentRequest: () => true,
  });

  const pending = client.getSummary(
    "VIDEO", VIDEO_A, 1
  );

  client.invalidate();

  work.resolve(
    contract.makeResponse(
      contract.makeRequest("VIDEO", VIDEO_A, 1),
      { kind: "NOT_FOUND" }
    )
  );

  assert.equal(
    (await pending).kind,
    "IGNORED"
  );

  client.dispose();

  assert.equal(
    (await client.getSummary(
      "VIDEO", VIDEO_A, 2
    )).kind,
    "IGNORED"
  );
});
