/** YU-27: Node/V8 MV3 messaging and synthetic session-cache contract tests. */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const source = {"shared.js": read("shared.js"), "hover-card-model.js": read("hover-card-model.js"),
  "background.js": read("background.js"), "preview-client.js": read("preview-client.js"),
  "panel-selection-contract.js": read("panel-selection-contract.js")};
const manifest = JSON.parse(read("manifest.json"));
const A = "Ab0_-123xyz", B = "Ab0_-123xyZ", C = "Ab0_-123xy0";
const CH = "UC" + "a".repeat(22);
function memory() {
  const data = new Map();
  const statistics = {gets: 0, sets: 0};
  return {data, statistics, session: {
    async get(key) {statistics.gets++; return {[key]:structuredClone(data.get(key))};},
    async set(updates) {statistics.sets++; for(const [k,v] of Object.entries(updates))data.set(k,structuredClone(v));},
  }};
}
function startWorker(mem=memory(),{time=1000000}={}) {
  let clock=time;
  const listeners=[];
  const chrome={runtime:{id:"ext-yutopia",onInstalled:{addListener() {}},
    onMessage:{addListener(fn) {listeners.push(fn);}}},
    sidePanel:{setPanelBehavior: async()=>{}},storage:{session:mem.session}};
  const context=vm.createContext({chrome,URL,Promise,console,Date:{now:()=>clock}});
  context.importScripts=(...names)=>{for(const n of names)vm.runInContext(source[n],context,{filename:n});};
  vm.runInContext(source["background.js"],context,{filename:"background.js"});
  assert.equal(listeners.length,1);
  const sender={id:"ext-yutopia",tab:{id:17},frameId:0,
    documentId:"37c0a110-70ab-4545-aaf2-bff993cb3990",
    url:"https://www.youtube.com/results?search_query=gaming"};
  function send(message, from=sender) {
    return new Promise((resolve,reject)=>{
      let responded=false;
      const asyncResponse = listeners[0](message,from,value=>{responded=true;resolve(value);});
      if(asyncResponse !== true && !responded)resolve(null);
    });
  }
  return {send,sender,mem,now(v){clock=v;},shared:context.YUTOPIA_SHARED};
}
function preview(targetId=A, requestId=1, targetType="VIDEO") {
  return {type:"YUTOPIA_MOCK_PREVIEW_GET_V1",version:1,requestId,targetType,targetId};
}

// Contract and sender authorization.
test("content manifest keeps hover-card.js last and preview-client after controller",()=>{
  const js=manifest.content_scripts[0].js;
  assert.equal(js.at(-1),"hover-card.js");
  assert.ok(js.indexOf("hover-controller.js")<js.indexOf("preview-client.js"));
  assert.ok(js.indexOf("preview-client.js")<js.indexOf("hover-card.js"));
  assert.deepEqual(manifest.permissions,["sidePanel","storage"]);
});
test("valid VIDEO request yields DEMO result; repeat is session HIT",async()=>{
  const w=startWorker();
  const first=await w.send(preview());
  assert.equal(first.ok,true);assert.equal(first.cache,"MISS");
  assert.equal(first.preview.source,"STATIC_FIXTURE");
  assert.equal(first.preview.isSynthetic,true);
  assert.equal(first.targetKey,"VIDEO:"+A);
  const next=await w.send(preview(A,2));
  assert.equal(next.ok,true);assert.equal(next.cache,"HIT");
  assert.equal(next.requestId,2);
});
test("valid CHANNEL uses separate target namespace",async()=>{
  const w=startWorker();
  const a=await w.send(preview(A,1));
  const ch=await w.send(preview(CH,2,"CHANNEL"));
  assert.equal(a.ok,true);assert.equal(ch.ok,true);
  assert.equal(ch.cache,"MISS");assert.equal(ch.targetKey,"CHANNEL:"+CH);
});
test("request validation rejects @handle, invalid IDs and malformed fields",async()=>{
  const w=startWorker();
  for(const req of [preview("@somebody",1,"CHANNEL"),preview("bad",1),
    preview(A,0),preview(A,1,"MOVIE"),{...preview(A),targetKey:"VIDEO:"+B},
    {...preview(A), requestId:1.5}, {...preview(A),version:999}]) {
    const result=await w.send(req);
    assert.equal(result.status,"INVALID_REQUEST");
  }
  assert.equal(w.mem.statistics.sets,0);
});
test("sender checks extension, top frame, tab, document, origin",async()=>{
  const w=startWorker();
  const invalid=[{...w.sender,id:"other"},
    {...w.sender,frameId:2}, {...w.sender,tab:null},
    {...w.sender,documentId:null}, {...w.sender,url:"https://youtube.com/watch?v="+A},
    {...w.sender,url:"https://www.youtube.com.attacker.net/"}];
  for(const sender of invalid)assert.equal((await w.send(preview(),sender)).status,"UNTRUSTED_SENDER");
  assert.equal(w.mem.statistics.sets,0);
});
test("older request cannot replace the latest scope",async()=>{
  const w=startWorker();
  assert.equal((await w.send(preview(A,11))).status,"READY");
  assert.equal((await w.send(preview(B,12))).status,"READY");
  assert.equal((await w.send(preview(A,11))).status,"STALE_REQUEST");
  assert.equal((await w.send(preview(A,12))).status,"REQUEST_CONFLICT");
  assert.equal((await w.send(preview(B,12))).cache,"HIT");
});
test("tab and document scopes are isolated",async()=>{
  const w=startWorker();
  const otherTab={...w.sender,tab:{id:18}};
  const otherDoc={...w.sender,documentId:"875709c5-0544-4f93-b809-ad3206a1a506"};
  assert.equal((await w.send(preview(A,8))).status,"READY");
  assert.equal((await w.send(preview(B,1),otherTab)).status,"READY");
  assert.equal((await w.send(preview(B,1),otherDoc)).status,"READY");
  assert.equal((await w.send(preview(A,1))).status,"STALE_REQUEST");
});
test("session cache survives worker restart and prevents old request replay",async()=>{
  const m=memory(); const first=startWorker(m);
  assert.equal((await first.send(preview(A,15))).cache,"MISS");
  const next=startWorker(m);
  assert.equal((await next.send(preview(A,16))).cache,"HIT");
  assert.equal((await next.send(preview(B,14))).status,"STALE_REQUEST");
});
test("TTL expiry regenerates synthetic cache without claiming current data",async()=>{
  const w=startWorker();
  assert.equal((await w.send(preview(A,1))).cache,"MISS");
  w.now(1059999);
  assert.equal((await w.send(preview(A,2))).cache,"HIT");
  w.now(1060001);
  assert.equal((await w.send(preview(A,3))).cache,"MISS");
  assert.equal((await w.send(preview(A,3))).preview.updatedLabel,"실제 갱신 시각 없음");
});
test("cache and scope session data stays bounded",async()=>{
  const w=startWorker();
  const alphabet="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
  for(let i=0;i<80;i++) {
    const target=("Ab0_-"+alphabet[i%alphabet.length]+String(i).padStart(5,"0")).slice(0,11);
    assert.equal(target.length,11);
    await w.send(preview(target,i+1),{...w.sender,documentId:"doc012345-"+i});
  }
  const saved=w.mem.data.get("YU27_SYNTHETIC_SESSION_V1");
  assert.ok(Object.keys(saved.cache).length<=64);
  assert.ok(Object.keys(saved.scopes).length<=64);
});
test("storage failure returns fail-closed error",async()=>{
  const m=memory();m.session.get=async()=>{throw Error("storage closed");};
  const w=startWorker(m);
  assert.equal((await w.send(preview())).status,"STORAGE_ERROR");
  assert.equal((await w.send(preview())).ok,false);
});
test("legacy DEMO ping still responds",async()=>{
  const w=startWorker();
  assert.equal((await w.send({type:"YUTOPIA_DEMO_PING"})).ok,true);
});
test("invalid and unrelated message never initializes cache",async()=>{
  const w=startWorker();
  assert.equal(await w.send({type:"UNRELATED"}),null);
  assert.equal(w.mem.statistics.gets,0);
});

// Content integration: only currently-hovered request may be accepted.
function startClient() {
  const listeners=new Set(), calls=[];
  let current=null;
  const controller={
    subscribe(fn){listeners.add(fn);fn(current||{phase:"IDLE"});return()=>listeners.delete(fn);},
    isCurrentRequest(request){return Boolean(current?.phase==="READY" &&
      request.requestId===current.requestId && request.targetType===current.targetType &&
      request.targetId===current.targetId);},
  };
  const promiseFactory=[];
  const chrome={runtime:{sendMessage(req){calls.push(req);
    return new Promise((resolve,reject)=>promiseFactory.push({resolve,reject}));}}};
  const context=vm.createContext({chrome,Promise,console,YUTOPIA_HOVER_CONTROLLER:controller});
  vm.runInContext(source["shared.js"],context);
  vm.runInContext(source["preview-client.js"],context);
  const client=context.YUTOPIA_PREVIEW_CLIENT;
  function hover(targetId,requestId) {
    current={phase:"READY",targetId,targetType:"VIDEO",requestId};
    for(const fn of [...listeners])fn(current);
  }
  function leave(){current={phase:"IDLE"};for(const fn of [...listeners])fn(current);}
  return {client,calls,promiseFactory,hover,leave,listeners};
}
async function flush() {await Promise.resolve();await Promise.resolve();await Promise.resolve();}
test("client dispatches on READY but not on unresolved or duplicate snapshots",()=>{
  const f=startClient();f.hover(A,1);f.hover(A,1);
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].type,"YUTOPIA_MOCK_PREVIEW_GET_V1");
  f.leave();f.hover(B,2);assert.equal(f.calls.length,2);
  f.client.dispose();f.hover(C,3);assert.equal(f.calls.length,2);
});
test("client drops late A reply after B hover",async()=>{
  const f=startClient();f.hover(A,1);f.hover(B,2);
  const a=startWorker();
  const ra=await a.send(preview(A,1));
  f.promiseFactory[0].resolve(ra);await flush();
  assert.equal(f.client.getRuntimeStatus().lastAccepted,null);
  assert.equal(f.client.getRuntimeStatus().ignoredResponses,1);
  const rb=await a.send(preview(B,2));
  f.promiseFactory[1].resolve(rb);await flush();
  assert.equal(f.client.getRuntimeStatus().lastAccepted.targetId,B);
});
test("client rejects forged target response and unavailable worker",async()=>{
  const f=startClient();f.hover(A,1);
  const r=await startWorker().send(preview(A,1));
  f.promiseFactory[0].resolve({...r,targetId:B});await flush();
  assert.equal(f.client.getRuntimeStatus().lastError,"RESPONSE_MISMATCH");
  f.hover(B,2);f.promiseFactory[1].reject(Error("closed"));await flush();
  assert.equal(f.client.getRuntimeStatus().lastError,"WORKER_UNAVAILABLE");
});
test("client never mutates stale state after disposal",async()=>{
  const f=startClient();f.hover(A,1);f.client.dispose();
  f.promiseFactory[0].resolve(await startWorker().send(preview(A,1)));
  await flush();assert.equal(f.client.getRuntimeStatus().lastAccepted,null);
});
