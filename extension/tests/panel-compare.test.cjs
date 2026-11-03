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

test("YU41/42-05 duplicates are blocked, but collection supports eight bounded items",async()=>{
  const f=harness();f.setPin(A);await f.send("ADD",17,A);
  assert.equal((await f.send("ADD",17,A)).status,"DUPLICATE");
  f.setPin(B,17,2);await f.send("ADD",17,B);
  const values=[C,"Cb0_-123xyz","Db0_-123xyz","Eb0_-123xyz",
    "Fb0_-123xyz","Gb0_-123xyz"];
  for(let i=0;i<values.length;i++){
    f.setPin(values[i],17,i+3);
    assert.equal((await f.send("ADD",17,values[i])).ok,true);
  }
  const all=await f.send("READ");
  assert.equal(all.state.items.length,8);
  assert.equal(all.state.selected.join(","),A+","+B);
  f.setPin("Hb0_-123xyz",17,10);
  assert.equal((await f.send("ADD",17,"Hb0_-123xyz")).status,"FULL");
  assert.equal((await f.send("READ")).state.items.length,8);
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


test("YU42-13 selection toggles only registered items and preserves A/B click order",async()=>{
  const f=harness();f.setPin(A);await f.send("ADD",17,A);
  f.setPin(B,17,2);await f.send("ADD",17,B);
  f.setPin(C,17,3);await f.send("ADD",17,C);
  assert.equal((await f.send("SELECT",17,C)).status,"PAIR_FULL");
  assert.equal((await f.send("SELECT",17,A)).status,"UNSELECTED");
  const added=await f.send("SELECT",17,C);
  assert.equal(added.status,"SELECTED");
  assert.equal(added.state.selected.join(","),B+","+C);
  const swapped=await f.send("SWAP");
  assert.equal(swapped.state.selected.join(","),C+","+B);
  assert.equal((await f.send("SELECT",17,A)).status,"PAIR_FULL");
  assert.equal((await f.send("SELECT",17,"Hb0_-123xyz")).status,"NOT_IN_COLLECTION");
  const removed=await f.send("REMOVE",17,C);
  assert.equal(removed.state.selected.join(","),B);
});

test("YU42-14 collection never leaks across tab switch, and unselected items remain",async()=>{
  const f=harness();f.setPin(A);await f.send("ADD",17,A);
  f.setPin(B,17,2);await f.send("ADD",17,B);
  f.setPin(C,17,3);await f.send("ADD",17,C);
  const set=await f.send("READ",17);
  assert.equal(set.state.items.length,3);
  assert.equal(set.state.selected.length,2);
  f.setActive(18);
  assert.equal((await f.send("READ",18)).state.items.length,0);
  f.setActive(17);
  assert.equal((await f.send("READ",17)).state.items.length,3);
});

test("YU42-15 selected pair is never more than two even with eight fixture IDs",()=>{
  const f=harness(),c=f.contract,t=2000000;
  assert.equal(c.MAX_ITEMS,8);
  let stored;
  for(let i=0;i<8;i++){
    const id="Ab0_-123xy"+i;
    const pin={tabId:17,targetType:"VIDEO",targetId:id,
      isSynthetic:true,source:"STATIC_FIXTURE",expiresAt:t+5000};
    const result=c.modify(stored,17,"ADD",id,t,pin);
    assert.equal(result.ok,true);
    stored=result.state;
  }
  assert.equal(stored.items.length,8);
  assert.equal(stored.selected.length,2);
  assert.equal(c.readState({
    ...stored,selected:[stored.items[0].videoId,
      stored.items[1].videoId,stored.items[2].videoId],
  },17,t),null);
});
