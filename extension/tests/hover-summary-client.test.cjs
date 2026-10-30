
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = name =>
  fs.readFileSync(path.join(root, name), "utf8");

const files = [
  "hover-summary-contract.js",
  "hover-summary-transport.js",
  "demo-hover-summary-provider.js",
  "hover-summary-client.js",
];

const VIDEO_A = "Ab0_-123xyz";
const VIDEO_B = "Zb0_-123xyz";

const tick = () =>
  new Promise(resolve => setImmediate(resolve));

function state(targetId, requestId) {
  return {
    phase: "READY",
    requestId,
    targetType: "VIDEO",
    targetId,
  };
}

function bootstrap({ respond, disabled = false } = {}) {
  let current = { phase: "IDLE" };
  const subscribers = new Set();
  const sent = [];
  let context;

  const controller = {
    subscribe(listener) {
      subscribers.add(listener);
      listener(current);
      return () => subscribers.delete(listener);
    },

    isCurrentRequest(request) {
      return current.phase === "READY" &&
        current.requestId === request.requestId &&
        current.targetType === request.targetType &&
        current.targetId === request.targetId;
    },
  };

  const runtime = disabled ? undefined : {
    sendMessage(request) {
      sent.push(request);

      if (respond) {
        return respond(request, context);
      }

      const provider =
        context.YOUTOPIA_DEMO_HOVER_SUMMARY_PROVIDER;

      const contract =
        context.YUTOPIA_HOVER_SUMMARY_CONTRACT;

      return provider.getSummary({
        source: "YOUTUBE",
        targetType: request.targetType,
        targetId: request.targetId,
      }).then(result =>
        contract.makeResponse(request, result)
      );
    },
  };

  context = vm.createContext({
    console,
    URL,
    Date,
    Promise,
    chrome: runtime ? { runtime } : undefined,
    YUTOPIA_HOVER_CONTROLLER: controller,
  });

  for (const file of files) {
    vm.runInContext(read(file), context, {
      filename: file,
    });
  }

  function emit(next) {
    current = next;

    for (const listener of [...subscribers]) {
      listener(next);
    }
  }

  return {
    context,
    sent,
    emit,
    get client() {
      return context.YUTOPIA_HOVER_SUMMARY_CLIENT;
    },
  };
}

test("READY 합성 스냅샷을 검증 후 현재 Hover에 제공한다", async () => {
  const f = bootstrap();
  const active = state(VIDEO_A, 1);

  f.emit(active);
  await tick();

  const view = f.client.getView(active);

  assert.equal(view.kind, "SNAPSHOT");
  assert.equal(view.summary.status, "READY");
  assert.equal(
    view.summary.valueSemantics,
    "SNAPSHOT_DERIVED_SYNTHETIC"
  );
  assert.equal(
    view.summary.sentimentPercent.denominator,
    80
  );
  assert.equal(
    f.client.getRuntimeStatus().sentRequests,
    1
  );
});

test("미등록 영상은 NOT_FOUND, 동일 요청은 중복 송신하지 않는다", async () => {
  const f = bootstrap();
  const active = state(VIDEO_B, 1);

  f.emit(active);
  f.emit(active);

  await tick();

  assert.equal(f.sent.length, 1);
  assert.equal(f.client.getView(active).kind, "NOT_FOUND");
  assert.equal(f.client.getView(active).summary, null);
});

test("영상 B 선택 후 영상 A의 지연 응답을 폐기한다", async () => {
  const pending = new Map();

  const f = bootstrap({
    respond: request =>
      new Promise(resolve => {
        pending.set(request.requestId, {
          request,
          resolve,
        });
      }),
  });

  const a = state(VIDEO_A, 1);
  const b = state(VIDEO_B, 2);

  f.emit(a);
  f.emit(b);

  const contract =
    f.context.YUTOPIA_HOVER_SUMMARY_CONTRACT;

  const second = pending.get(2);
  const first = pending.get(1);

  second.resolve(
    contract.makeResponse(second.request, {
      kind: "NOT_FOUND",
    })
  );

  await tick();

  assert.equal(f.client.getView(b).kind, "NOT_FOUND");

  first.resolve(
    contract.makeResponse(first.request, {
      kind: "NOT_FOUND",
    })
  );

  await tick();

  assert.equal(f.client.getView(b).kind, "NOT_FOUND");
  assert.equal(f.client.getView(a), null);
  assert.ok(
    f.client.getRuntimeStatus().ignoredResponses >= 1
  );
});

test("위조된 Worker 응답은 TRANSPORT_ERROR로 격리한다", async () => {
  const f = bootstrap({
    respond: () => Promise.resolve({ forged: true }),
  });

  const active = state(VIDEO_A, 1);

  f.emit(active);
  await tick();

  const view = f.client.getView(active);

  assert.equal(view.kind, "TRANSPORT_ERROR");
  assert.equal(view.reason, "INVALID_RESPONSE");
  assert.equal(view.summary, null);
});

test("Worker 미사용 및 Hover 종료는 fail-closed로 처리한다", async () => {
  const unavailable = bootstrap({ disabled: true });
  const active = state(VIDEO_A, 1);

  unavailable.emit(active);

  assert.equal(
    unavailable.client.getView(active).kind,
    "UNAVAILABLE"
  );
  assert.equal(unavailable.sent.length, 0);

  let finish;

  const pending = bootstrap({
    respond: () => new Promise(resolve => {
      finish = resolve;
    }),
  });

  pending.emit(active);

  const request = pending.sent[0];

  pending.emit({ phase: "IDLE" });

  const contract =
    pending.context.YUTOPIA_HOVER_SUMMARY_CONTRACT;

  finish(contract.makeResponse(request, {
    kind: "NOT_FOUND",
  }));

  await tick();

  assert.equal(
    pending.client.getRuntimeStatus().kind,
    "IDLE"
  );
  assert.equal(pending.client.getView(active), null);

  pending.client.dispose();

  assert.equal(
    pending.client,
    undefined
  );
});

/*
 * 19단계 — 거부 응답, 무분모 상태, 연속 Hover 전환.
 */

test("REJECTED는 사유만 전달하고 분석 수치를 공개하지 않는다", async () => {
  const f = bootstrap({
    respond: (request, context) =>
      Promise.resolve(
        context.YUTOPIA_HOVER_SUMMARY_CONTRACT.makeResponse(
          request,
          { kind: "REJECTED", reason: "SOURCE_ERROR" }
        )
      ),
  });

  const active = state(VIDEO_A, 1);
  f.emit(active);
  await tick();

  const view = f.client.getView(active);

  assert.equal(view.kind, "REJECTED");
  assert.equal(view.reason, "SOURCE_ERROR");
  assert.equal(view.summary, null);
});

for (const status of ["PARTIAL", "STALE", "NO_DATA"]) {
  test(`${status} 스냅샷을 무분모 상태 그대로 전달한다`, async () => {
    const f = bootstrap({
      respond: async (request, context) => {
        const provider =
          context.YOUTOPIA_DEMO_HOVER_SUMMARY_PROVIDER;

        const original = await provider.getSummary({
          source: "YOUTUBE",
          targetType: request.targetType,
          targetId: request.targetId,
        });

        const safe = {
          ...original.summary,
          status,
          sentimentPercent: null,
          topTopics: [],
          observedAt: status === "NO_DATA"
            ? null : original.summary.observedAt,
          analyzedAt: status === "NO_DATA"
            ? null : original.summary.analyzedAt,
        };

        return context.YUTOPIA_HOVER_SUMMARY_CONTRACT
          .makeResponse(request, {
            kind: "SNAPSHOT",
            summary: safe,
          });
      },
    });

    const active = state(VIDEO_A, 1);
    f.emit(active);
    await tick();

    const view = f.client.getView(active);

    assert.equal(view.kind, "SNAPSHOT");
    assert.equal(view.summary.status, status);
    assert.equal(view.summary.sentimentPercent, null);
    assert.deepEqual(
      JSON.parse(JSON.stringify(view.summary.topTopics)),
      []
    );
  });
}

test("40회 연속 Hover 후 최신 요청만 결과를 유지한다", async () => {
  const pending = new Map();

  const f = bootstrap({
    respond: request =>
      new Promise(resolve => {
        pending.set(request.requestId, { request, resolve });
      }),
  });

  for (let requestId = 1; requestId <= 40; requestId++) {
    f.emit(state(
      requestId % 2 === 1 ? VIDEO_A : VIDEO_B,
      requestId
    ));
  }

  assert.equal(f.sent.length, 40);

  const contract =
    f.context.YUTOPIA_HOVER_SUMMARY_CONTRACT;

  const latest = pending.get(40);

  latest.resolve(
    contract.makeResponse(
      latest.request,
      { kind: "NOT_FOUND" }
    )
  );

  await tick();

  const active = state(VIDEO_B, 40);
  assert.equal(f.client.getView(active).kind, "NOT_FOUND");

  // 나머지 응답은 최신 요청 이후에 역순으로 도착한다.
  for (let requestId = 39; requestId >= 1; requestId--) {
    const old = pending.get(requestId);

    old.resolve(
      contract.makeResponse(
        old.request,
        { kind: "NOT_FOUND" }
      )
    );
  }

  await tick();

  assert.equal(f.client.getView(active).kind, "NOT_FOUND");
  assert.equal(f.client.getView(state(VIDEO_A, 39)), null);
  assert.ok(
    f.client.getRuntimeStatus().ignoredResponses >= 39
  );
});
