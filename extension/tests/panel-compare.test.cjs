"use strict";
/* YU-41: synthetic-only comparison session and trusted panel worker. */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

const A = "Ab0_-123xyz";
const B = "Qb0_-123xyz";
const C = "Zb0_-123xyz";
const now = () => Date.now();

function harness() {
  const data = new Map();
  const listeners = [];
  const removed = [];
  let activeTab = 17;
  let writes = 0;
  let removals = 0;
  const session = {
    async get(key) { return {[key]: data.get(key)}; },
    async set(values) {
      for (const [key,value] of Object.entries(values)) data.set(key, value);
      writes++;
    },
    async remove(key) { data.delete(key); removals++; },
  };
  const chrome = {
    runtime: {
      id:"yutopia-test", getURL:p=>"chrome-extension://yutopia-test/"+p,
      onMessage:{addListener:fn=>listeners.push(fn)},
    },
    tabs:{
      query:async()=>[{id:activeTab}],
      onRemoved:{addListener:fn=>removed.push(fn)},
    },
    storage:{session},
  };
  const context = vm.createContext({chrome,Date,Promise,console});
  for (const file of [
    "panel-selection-contract.js",
    "panel-compare-contract.js",
    "panel-compare-worker.js",
  ]) vm.runInContext(read(file),context,{filename:file});

  const contract = context.YUTOPIA_PANEL_COMPARE;
  const pin = context.YUTOPIA_PANEL_SELECTION;
  const sender = {id:"yutopia-test",
    url:"chrome-extension://yutopia-test/sidepanel.html"};
  const setPin = (id,tab=17,requestId=1,targetType="VIDEO") => {
    const request = {targetType,targetId:id,requestId};
    data.set(pin.keyForTab(tab),pin.makePin(request,tab,"document_demo_123"));
  };
  async function send(action,tab=17,id=null,from=sender) {
    const request=contract.request(action,tab,id);
    assert.ok(request);
    return new Promise(resolve=>{
      const keep=listeners[0](request,from,resolve);
      assert.equal(keep,true);
    });
  }
  return {contract,pin,data,session,sender,setPin,send,
    setActive(value){activeTab=value;},
    closeTab(id){for(const fn of removed)fn(id);},
    getWrites:()=>writes,getRemovals:()=>removals};
}

test("YU41-01 strict contract request shapes reject malformed data",()=>{
  const f=harness(),m=f.contract;
  assert.equal(m.keyForTab(17),"YU41_COMPARE_TAB_V1_17");
  assert.equal(m.keyForTab(-1),null);
  assert.equal(m.request("ADD",17,"invalid"),null);
  assert.equal(m.request("ADD",17,A).targetId,A);
  assert.equal(m.parseRequest({...m.request("READ",17),extra:true}),null);
  assert.equal(m.parseRequest({...m.request("READ",17),version:2}),null);
  assert.equal(m.request("SWAP",17,A),null);
});

test("YU41-02 cannot add hovered, unpinned VIDEO",async()=>{
  const f=harness();
  const response=await f.send("ADD",17,A);
  assert.equal(response.ok,false);
  assert.equal(response.status,"PIN_REQUIRED");
  assert.equal(f.data.has(f.contract.keyForTab(17)),false);
});

test("YU41-03 only explicitly pinned VIDEO can be added; no unrelated target",async()=>{
  const f=harness();
  f.setPin(A);
  assert.equal((await f.send("ADD",17,B)).status,"PIN_REQUIRED");
  const added=await f.send("ADD",17,A);
  assert.equal(added.ok,true);
  assert.equal(added.status,"ADDED");
  assert.equal(added.state.selected.join(","),A);
  assert.equal(added.state.items[0].videoId,A);
});

test("YU41-04 two separate explicit pinned selections make ordered A/B and real Web link",async()=>{
  const f=harness();f.setPin(A);
  assert.equal((await f.send("ADD",17,A)).ok,true);
  f.setPin(B,17,2);
  const added=await f.send("ADD",17,B);
  assert.equal(added.ok,true);
  assert.equal(added.state.selected.join(","),A+","+B);
  assert.equal(added.state.items.length,2);
  const ctx=vm.createContext({});
  vm.runInContext(read("web-analysis-link.js"),ctx);
  assert.equal(ctx.YUTOPIA_WEB_ANALYSIS_LINK.buildComparePairUrl(
    Array.from(added.state.selected)
  ),"http://localhost:5173/analysis/youtube/compare?video="+A+"&video="+B);
});

test("YU41-05 duplicates and full capacity never mutate stored candidates",async()=>{
  const f=harness();f.setPin(A);await f.send("ADD",17,A);
  assert.equal((await f.send("ADD",17,A)).status,"DUPLICATE");
  f.setPin(B,17,2);await f.send("ADD",17,B);
  f.setPin(C,17,3);
  const rejected=await f.send("ADD",17,C);
  assert.equal(rejected.status,"FULL");
  const list=await f.send("READ");
  assert.equal(list.state.items.length,2);
});

test("YU41-06 swap/remove/clear are explicit, ordered session mutations",async()=>{
  const f=harness();f.setPin(A);await f.send("ADD",17,A);
  f.setPin(B,17,2);await f.send("ADD",17,B);
  let response=await f.send("SWAP");
  assert.equal(response.state.selected.join(","),B+","+A);
  response=await f.send("REMOVE",17,A);
  assert.equal(response.state.items.length,1);
  assert.equal(response.state.selected.join(","),B);
  assert.equal((await f.send("SWAP")).status,"PAIR_REQUIRED");
  assert.equal((await f.send("CLEAR")).state.items.length,0);
  assert.equal(f.data.has(f.contract.keyForTab(17)),false);
});

test("YU41-07 tab-scope enforces active tab and disjoint session keys",async()=>{
  const f=harness();f.setPin(A,17);await f.send("ADD",17,A);
  f.setActive(18);
  const b17=await f.send("READ",17);
  assert.equal(b17.status,"NOT_ACTIVE_TAB");
  const b18=await f.send("READ",18);
  assert.equal(b18.state.items.length,0);
  f.setPin(B,18);assert.equal((await f.send("ADD",18,B)).ok,true);
  f.setActive(17);
  assert.equal((await f.send("READ",17)).state.selected.join(","),A);
  assert.equal(f.data.size >= 4,true);
});

test("YU41-08 untrusted extension/page sender cannot read or mutate",async()=>{
  const f=harness();f.setPin(A);
  const untrusted=[
    {...f.sender,url:"chrome-extension://yutopia-test/other.html"},
    {...f.sender,id:"other-extension"},
    {...f.sender,tab:{id:17}},
  ];
  for(const sender of untrusted){
    const message=await f.send("ADD",17,A,sender);
    assert.equal(message.status,"UNTRUSTED_SENDER");
  }
  assert.equal(f.data.has(f.contract.keyForTab(17)),false);
});

test("YU41-09 reading the session never mutates storage",async()=>{
  const f=harness(),initial=f.getWrites();
  assert.equal((await f.send("READ")).state.items.length,0);
  assert.equal(f.getWrites(),initial);
});

test("YU41-10 expired candidates are hidden and TTL cannot be extended",()=>{
  const f=harness(),m=f.contract,t=1000000;
  const pin={tabId:17,targetType:"VIDEO",targetId:A,
    isSynthetic:true,source:"STATIC_FIXTURE",expiresAt:t+5000};
  const added=m.modify(undefined,17,"ADD",A,t,pin);
  assert.equal(added.ok,true);
  assert.equal(added.state.items[0].expiresAt,t+5000);
  assert.equal(m.readState(added.state,17,t+5001).items.length,0);
  const malformed={...added.state, items:[{...added.state.items[0],videoId:"javascript:"}]};
  assert.equal(m.readState(malformed,17,t),null);
});

test("YU41-11 closure deletes candidate session, not another tab's data",async()=>{
  const f=harness();f.setPin(A);await f.send("ADD",17,A);
  f.setActive(18);f.setPin(B,18);await f.send("ADD",18,B);
  f.closeTab(17);
  for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.data.has(f.contract.keyForTab(17)),false);
  assert.equal(f.data.has(f.contract.keyForTab(18)),true);
});

test("YU41-12 panel compare URL rejects extra IDs and invalid target types",()=>{
  const f=vm.createContext({});
  vm.runInContext(read("web-analysis-link.js"),f);
  const url=f.YUTOPIA_WEB_ANALYSIS_LINK.buildComparePairUrl;
  for(const pair of [[],[A],[A,A],[A,B,C],[A,"invalid"],[null,B]]) {
    assert.equal(url(pair),null);
  }
});
