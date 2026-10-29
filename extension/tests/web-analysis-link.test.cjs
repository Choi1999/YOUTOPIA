
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = name =>
  fs.readFileSync(
    path.join(__dirname, "..", name),
    "utf8"
  );

function load(context, name) {
  vm.runInContext(read(name), context, {
    filename: name,
  });
}

test("유효한 VIDEO ID로 로컬 Web URL을 생성한다", () => {
  const context = vm.createContext({});

  load(context, "web-analysis-link.js");

  const api = context.YUTOPIA_WEB_ANALYSIS_LINK;

  assert.equal(
    api.buildVideoUrl("VIDEO", "Ab0_-123xyz"),
    "http://localhost:5173/analysis/youtube/video/Ab0_-123xyz"
  );
});

test("채널과 유효하지 않은 ID는 거부한다", () => {
  const context = vm.createContext({});

  load(context, "web-analysis-link.js");

  const api = context.YUTOPIA_WEB_ANALYSIS_LINK;

  assert.equal(
    api.buildVideoUrl("CHANNEL", "UC" + "a".repeat(22)),
    null
  );

  for (const id of [
    "@unresolved",
    "invalid",
    "../malicious",
    " Ab0_-123xyz",
  ]) {
    assert.equal(api.buildVideoUrl("VIDEO", id), null);
  }
});

test("Side Panel의 선택 변경 및 초기화를 반영한다", async () => {
  const elements = new Map();

  for (const id of [
    "selection-status",
    "selection-details",
    "selection-kind",
    "selection-id",
    "web-analysis-link",
  ]) {
    elements.set(id, {
      hidden: true,
      textContent: "",
      href: "",
      removeAttribute(name) {
        if (name === "href") this.href = "";
      },
    });
  }

  let reply = null;

  const context = vm.createContext({
    document: {
      getElementById: id => elements.get(id) ?? null,
      documentElement: { dataset: {} },
    },
    chrome: {
      tabs: {
        query: async () => [{ id: 17 }],
        onActivated: {
          addListener() {},
          removeListener() {},
        },
      },
      runtime: {
        sendMessage: async () => reply,
      },
      storage: {
        onChanged: {
          addListener() {},
          removeListener() {},
        },
      },
    },
    Date,
    Promise,
    console,
    setTimeout: () => 1,
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
  });

  load(context, "panel-selection-contract.js");
  load(context, "web-analysis-link.js");
  load(context, "sidepanel.js");

  const contract = context.YUTOPIA_PANEL_SELECTION;
  const panel = context.YUTOPIA_SIDE_PANEL;
  const link = elements.get("web-analysis-link");

  function selection(targetType, targetId) {
    const pin = contract.makePin(
      { targetType, targetId, requestId: 1 },
      17,
      "document_demo_123"
    );

    return {
      type: contract.READ_RESULT_TYPE,
      version: contract.VERSION,
      tabId: 17,
      ok: true,
      status: "READY",
      pin,
    };
  }

  reply = selection("VIDEO", "Ab0_-123xyz");
  await panel.refresh();

  assert.equal(link.hidden, false);
  assert.equal(
    link.href,
    "http://localhost:5173/analysis/youtube/video/Ab0_-123xyz"
  );

  reply = selection("VIDEO", "Ab0_-123xyZ");
  await panel.refresh();

  assert.match(link.href, /Ab0_-123xyZ$/);

  reply = selection("CHANNEL", "UC" + "a".repeat(22));
  await panel.refresh();

  assert.equal(link.hidden, true);
  assert.equal(link.href, "");

  reply = {
    type: contract.READ_RESULT_TYPE,
    version: contract.VERSION,
    tabId: 17,
    ok: true,
    status: "EMPTY",
  };

  await panel.refresh();

  assert.equal(link.hidden, true);
  assert.equal(link.href, "");

  panel.dispose();
});
