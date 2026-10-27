/**
 * YU-29 AR-01: module boundary/boot order guardrails.
 * Regression behavior is exercised by G28-1/G28-2/YU-27 suites.
 * These tests intentionally do not require a real Chrome instance.
 */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("AR-01: Worker entrypoint loads versioned contract before selection worker",()=>{
  const entry = read("background.js");
  assert.match(entry,/importScripts\("shared\.js", "hover-card-model\.js",\s*"panel-selection-contract\.js", "panel-selection-worker\.js"\)/);
  assert.match(entry,/YOUTOPIA_SELECTION_WORKER\.create\(/);
  assert.match(entry,/validateYouTubeSender: yu27SenderScope/);
});

test("AR-01: selection storage/races/listeners belong to extracted module only",()=>{
  const entry = read("background.js");
  const service = read("panel-selection-worker.js");
  assert.doesNotMatch(entry,/function yu28PinAndOpen\(/);
  assert.doesNotMatch(entry,/yu28LatestGenerations/);
  assert.doesNotMatch(entry,/function yu28ReadSelection\(/);
  assert.match(entry,/return YU28_SELECTION\.handlePinAndOpen\(message, sender, sendResponse\)/);
  assert.match(entry,/return YU28_SELECTION\.handleReadSelection\(message, sender, sendResponse\)/);
  assert.match(service,/function yu28PinAndOpen\(/);
  assert.match(service,/function yu28ReadSelection\(/);
  assert.match(service,/chrome\.tabs\?\.onRemoved\?\.addListener/);
});

test("AR-01: Chrome gesture open remains synchronous before session await",()=>{
  const code = read("panel-selection-worker.js");
  const start = code.indexOf("function yu28PinAndOpen(");
  const end = code.indexOf("function yu28PanelSenderTrusted(",start);
  assert.ok(start >= 0 && end > start);
  // Drop line comments: "do not await" in a safety comment is not an await.
  const click = code.slice(start,end).replace(/\/\/[^\n]*/g,"");
  const open = click.indexOf("opening = chrome.sidePanel.open({tabId});");
  const firstAwait = click.search(/\bawait\s+/);
  assert.ok(open > 0);
  assert.ok(firstAwait < 0 || open < firstAwait,
    "sidePanel.open must execute before any storage/tabs await");
});

test("AR-01: selection module refuses missing dependencies without registering",()=>{
  const context = vm.createContext({});
  vm.runInContext(read("panel-selection-worker.js"),context);
  assert.equal(typeof context.YOUTOPIA_SELECTION_WORKER.create,"function");
  assert.throws(()=>context.YOUTOPIA_SELECTION_WORKER.create({}),
    /dependencies unavailable/);
  assert.equal(typeof context.YOUTOPIA_SELECTION_WORKER.create,"function");
});

test("AR-01: no added manifest permissions, network or product data integration",()=>{
  const manifest = JSON.parse(read("manifest.json"));
  const service = read("panel-selection-worker.js");
  assert.deepEqual(manifest.permissions,["sidePanel","storage"]);
  assert.deepEqual(manifest.host_permissions,["https://www.youtube.com/*"]);
  assert.equal(manifest.background.service_worker,"background.js");
  assert.doesNotMatch(service,/\bfetch\s*\(/);
  assert.doesNotMatch(service,/XMLHttpRequest|eval\s*\(/);
});
