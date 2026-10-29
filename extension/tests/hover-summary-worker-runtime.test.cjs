
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const EXTENSION = path.join(__dirname, "..");

const read = name =>
  fs.readFileSync(
    path.join(EXTENSION, name),
    "utf8"
  );

const manifest = JSON.parse(read("manifest.json"));

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      EXTENSION, "..", "shared", "contracts",
      "analysis-v1", "fixtures", "ready.snapshot.json"
    ),
    "utf8"
  )
);

const names = [
  "background-entry.js",
  "background.js",
  "shared.js",
  "hover-card-model.js",
  "panel-selection-contract.js",
  "hover-summary-contract.js",
  "hover-summary-transport.js",
  "demo-hover-summary-provider.js",
];

const scripts = Object.fromEntries(
  names.map(name => [name, read(name)])
);

const VIDEO = "Ab0_-123xyz";
const VIDEO_B = "Zb0_-123xyz";
const CHANNEL = "UC" + "a".repeat(22);
const EXTENSION_ID = "ext-yutopia";

const SENDER = {
  id: EXTENSION_ID,
  tab: { id: 17 },
  frameId: 0,
  documentId: "37c0a110-70ab-4545-aaf2-bff993cb3990",
  url: "https://www.youtube.com/results?search_query=test",
};

function plain(value) {
  return value === null
    ? null
    : JSON.parse(JSON.stringify(value));
}

function startWorker() {
  const listeners = [];
  const storage = new Map();
  const opened = [];

  const chrome = {
    runtime: {
      id: EXTENSION_ID,
      getURL: file =>
        "chrome-extension://" + EXTENSION_ID + "/" + file,

      onInstalled: {
        addListener() {},
      },

      onMessage: {
        addListener(listener) {
          listeners.push(listener);
        },
      },
    },

    sidePanel: {
      async setPanelBehavior() {},

      open(options) {
        opened.push(plain(options));
        return Promise.resolve();
      },
    },

    tabs: {
      async query() {
        return [{ id: 17 }];
      },

      onUpdated: {
        addListener() {},
      },

      onRemoved: {
        addListener() {},
      },
    },

    storage: {
      session: {
        async get(key) {
          return { [key]: storage.get(key) };
        },

        async set(items) {
          for (const [key, value] of Object.entries(items)) {
            storage.set(key, plain(value));
          }
        },

        async remove(key) {
          storage.delete(key);
        },
      },

      onChanged: {
        addListener() {},
      },
    },
  };

  const context = vm.createContext({
    chrome,
    URL,
    Promise,
    Date,
    console,
  });

  context.importScripts = (...files) => {
    for (const name of files) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(scripts, name),
        "Unregistered import: " + name
      );

      vm.runInContext(scripts[name], context, {
        filename: name,
      });
    }
  };

  vm.runInContext(
    scripts["background-entry.js"],
    context,
    { filename: "background-entry.js" }
  );

  function send(message, sender = SENDER) {
    return new Promise(resolve => {
      let answered = false;
      let keepOpen = false;

      function respond(value) {
        if (answered) return;

        answered = true;
        resolve(plain(value));
      }

      for (const listener of listeners) {
        const result = listener(
          message,
          sender,
          respond
        );

        if (result === true) keepOpen = true;
      }

      if (!keepOpen && !answered) {
        resolve(null);
      }
    });
  }

  return {
    context,
    chrome,
    listeners,
    storage,
    opened,
    send,
  };
}

function summaryRequest(targetId = VIDEO, requestId = 1) {
  return {
    type: "YUTOPIA_HOVER_SUMMARY_GET_V1",
    version: 1,
    requestId,
    targetType: "VIDEO",
    targetId,
  };
}

test("Manifest가 신규 Worker 진입점을 사용하며 기존 권한을 유지한다", () => {
  assert.equal(
    manifest.background.service_worker,
    "background-entry.js"
  );

  assert.deepEqual(
    manifest.permissions,
    ["sidePanel", "storage"]
  );

  assert.deepEqual(
    manifest.host_permissions,
    ["https://www.youtube.com/*"]
  );

  assert.equal(
    manifest.content_scripts[0].js.at(-1),
    "hover-card.js"
  );
});

test("기존 Worker와 신규 Summary 리스너가 함께 등록된다", () => {
  const worker = startWorker();

  assert.equal(worker.listeners.length, 2);

  assert.ok(
    worker.context.YUTOPIA_SHARED
  );

  assert.ok(
    worker.context.YUTOPIA_HOVER_SUMMARY_CONTRACT
  );

  assert.ok(
    worker.context.YUTOPIA_HOVER_SUMMARY_TRANSPORT
  );

  assert.ok(
    worker.context.YOUTOPIA_DEMO_HOVER_SUMMARY_PROVIDER
  );
});

test("합성 공급자 데이터가 공유 READY fixture와 일치한다", async () => {
  const worker = startWorker();

  const provider =
    worker.context.YOUTOPIA_DEMO_HOVER_SUMMARY_PROVIDER;

  const response = await provider.getSummary(fixture.target);

  assert.equal(response.kind, "SNAPSHOT");

  const summary = response.summary;
  const denominator = fixture.sample.classifiedCount;

  assert.equal(summary.snapshotId, fixture.snapshotId);

  assert.deepEqual(
    plain(summary.target),
    fixture.target
  );

  assert.deepEqual(
    plain(summary.observationScope),
    fixture.scope
  );

  assert.equal(summary.observedAt, fixture.observedAt);
  assert.equal(summary.analyzedAt, fixture.analyzedAt);

  assert.equal(
    summary.sentimentPercent.denominator,
    denominator
  );

  assert.equal(
    summary.sentimentPercent.positivePercent,
    fixture.sentiment.positive / denominator * 100
  );

  assert.equal(
    summary.sentimentPercent.neutralPercent,
    fixture.sentiment.neutral / denominator * 100
  );

  assert.equal(
    summary.sentimentPercent.negativePercent,
    fixture.sentiment.negative / denominator * 100
  );

  assert.deepEqual(
    plain(summary.topTopics),
    fixture.topics.map(topic => ({
      topicId: topic.topicId,
      mentionCount: topic.mentionCount,
    }))
  );
});

test("정상적인 영상 요청은 검증된 합성 SNAPSHOT을 반환한다", async () => {
  const worker = startWorker();

  const request = summaryRequest(VIDEO, 1);
  const response = await worker.send(request);

  assert.equal(response.result.kind, "SNAPSHOT");

  assert.equal(
    response.result.summary.valueSemantics,
    "SNAPSHOT_DERIVED_SYNTHETIC"
  );

  assert.equal(
    response.result.summary.sentimentPercent.denominator,
    80
  );

  const contract =
    worker.context.YUTOPIA_HOVER_SUMMARY_CONTRACT;

  assert.ok(
    contract.parseResponse(response, request)
  );

  assert.equal(worker.opened.length, 0);
  assert.equal(worker.storage.size, 0);
});

test("미등록 영상과 채널은 NOT_FOUND를 반환한다", async () => {
  const worker = startWorker();

  const videoResponse = await worker.send(
    summaryRequest(VIDEO_B, 1)
  );

  assert.equal(videoResponse.result.kind, "NOT_FOUND");

  const channelResponse = await worker.send({
    ...summaryRequest(VIDEO, 2),
    targetType: "CHANNEL",
    targetId: CHANNEL,
  });

  assert.equal(channelResponse.result.kind, "NOT_FOUND");

  assert.equal(worker.opened.length, 0);
});

test("잘못된 메시지와 신뢰되지 않는 발신자는 차단된다", async () => {
  const worker = startWorker();

  assert.equal(
    await worker.send(summaryRequest("bad", 1)),
    null
  );

  assert.equal(
    await worker.send(
      { ...summaryRequest(VIDEO, 1), extra: true }
    ),
    null
  );

  const invalidSenders = [
    { ...SENDER, id: "other-extension" },
    { ...SENDER, frameId: 1 },
    { ...SENDER, documentId: "short" },
    { ...SENDER, tab: null },
    {
      ...SENDER,
      url: "https://www.youtube.com.evil.example/",
    },
  ];

  for (const sender of invalidSenders) {
    assert.equal(
      await worker.send(
        summaryRequest(VIDEO, 1),
        sender
      ),
      null
    );
  }

  assert.equal(worker.opened.length, 0);
});

test("오래된 요청을 거부하고 문서별 요청 순서를 분리한다", async () => {
  const worker = startWorker();

  const first = await worker.send(
    summaryRequest(VIDEO, 10)
  );

  assert.equal(first.result.kind, "SNAPSHOT");

  const next = await worker.send(
    summaryRequest(VIDEO_B, 11)
  );

  assert.equal(next.result.kind, "NOT_FOUND");

  assert.equal(
    await worker.send(summaryRequest(VIDEO, 9)),
    null
  );

  const otherDocument = {
    ...SENDER,
    documentId: "differentDoc123",
  };

  const independent = await worker.send(
    summaryRequest(VIDEO, 1),
    otherDocument
  );

  assert.equal(independent.result.kind, "SNAPSHOT");
});

test("기존 YU-27 Preview 메시징을 유지한다", async () => {
  const worker = startWorker();

  const reply = await worker.send({
    type: "YUTOPIA_MOCK_PREVIEW_GET_V1",
    version: 1,
    requestId: 1,
    targetType: "VIDEO",
    targetId: VIDEO,
  });

  assert.equal(reply.ok, true);
  assert.equal(reply.status, "READY");
  assert.equal(reply.isSynthetic, true);
  assert.equal(reply.source, "STATIC_FIXTURE");

  assert.equal(worker.opened.length, 0);
});

test("기존 YU-28 Side Panel 선택 고정을 유지한다", async () => {
  const worker = startWorker();

  const pinned = await worker.send({
    type: "YUTOPIA_YU28_PIN_AND_OPEN_V1",
    version: 1,
    requestId: 3,
    targetType: "VIDEO",
    targetId: VIDEO,
  });

  assert.equal(pinned.status, "PINNED");
  assert.equal(pinned.ok, true);
  assert.equal(pinned.pin.targetId, VIDEO);

  assert.equal(worker.opened.length, 1);

  const panelSender = {
    id: EXTENSION_ID,
    url: worker.chrome.runtime.getURL("sidepanel.html"),
  };

  const selected = await worker.send({
    type: "YUTOPIA_YU28_READ_SELECTION_V1",
    version: 1,
    tabId: 17,
  }, panelSender);

  assert.equal(selected.status, "READY");
  assert.equal(selected.pin.targetId, VIDEO);
});
