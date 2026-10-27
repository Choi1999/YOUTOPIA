/** YU-28 G28-2: isolated Node tests for explicit-click per-tab selection. */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const files = {
  "shared.js":read("shared.js"),
  "hover-card-model.js":read("hover-card-model.js"),
  "panel-selection-contract.js":read("panel-selection-contract.js"),
  "background.js":read("background.js"),
  "sidepanel.js":read("sidepanel.js"),
};
const V1 = "Ab0_-123xyz", V2 = "Ab0_-123xyZ", CHANNEL = "UC" + "a".repeat(22);
const DOC1 = "37c0a110-70ab-4545-aaf2-bff993cb3990";
const DOC2 = "875709c5-0544-4f93-b809-ad3206a1a506";
const click=(id=V1,requestId=1,targetType="VIDEO")=>({
  type:"YUTOPIA_YU28_PIN_AND_OPEN_V1",version:1,requestId,targetType,targetId:id,
});
const preview=(id=V1,requestId=1)=>({
  type:"YUTOPIA_MOCK_PREVIEW_GET_V1",version:1,requestId,
  targetType:"VIDEO",targetId:id,
});
const readSelection=tabId=>({
  type:"YUTOPIA_YU28_READ_SELECTION_V1",version:1,tabId,
});
const pause=()=>new Promise(resolve=>setImmediate(resolve));

function bus(){
  const data=new Map(),changedListeners=new Set();
  const counters={gets:0,sets:0,removes:0};
  let failSet=false, failGet=false;
  function emit(values, area="session"){
    for(const callback of changedListeners)callback(values,area);
  }
  const session={
    async get(key){
      counters.gets++;
      if(failGet)throw Error("get denied");
      return {[key]:structuredClone(data.get(key))};
    },
    async set(obj){
      counters.sets++;
      if(failSet)throw Error("set denied");
      const changed={};
      for(const [key,val] of Object.entries(obj)){
        changed[key]={oldValue:structuredClone(data.get(key)),newValue:structuredClone(val)};
        data.set(key,structuredClone(val));
      }
      emit(changed);
    },
    async remove(key){
      counters.removes++;
      const prior=data.get(key);
      data.delete(key);
      emit({[key]:{oldValue:prior,newValue:undefined}});
    },
  };
  return {data,counters,session,changedListeners,
    failSet(v){failSet=v;},failGet(v){failGet=v;}};
}

function worker(mem=bus(),{open=()=>Promise.resolve()}={}) {
  const listeners=[],openCalls=[],updated=[],removed=[];
  let activeTabId=17;
  const chrome={
    runtime:{
      id:"ext-yutopia",
      getURL:p=>"chrome-extension://ext-yutopia/"+p,
      onInstalled:{addListener(){}},
      onMessage:{addListener:fn=>listeners.push(fn)},
    },
    sidePanel:{
      setPanelBehavior:async()=>{},
      open:opts=>{openCalls.push(opts);return open(opts);},
    },
    tabs:{
      query:async()=>[{id:activeTabId}],
      onUpdated:{addListener:fn=>updated.push(fn)},
      onRemoved:{addListener:fn=>removed.push(fn)},
    },
    storage:{session:mem.session,onChanged:{addListener:fn=>mem.changedListeners.add(fn)}},
  };
  const ctx=vm.createContext({chrome,URL,Promise,Date,console});
  ctx.importScripts=(...names)=>{
    for(const name of names)vm.runInContext(files[name],ctx,{filename:name});
  };
  vm.runInContext(files["background.js"],ctx,{filename:"background.js"});
  assert.equal(listeners.length,1);
  const youtube={id:"ext-yutopia",tab:{id:17},frameId:0,documentId:DOC1,
    url:"https://www.youtube.com/results?search_query=sample"};
  const panel={id:"ext-yutopia",frameId:0,
    url:"chrome-extension://ext-yutopia/sidepanel.html"};
  function dispatch(message,sender=youtube){
    let answered=false,resolver;
    const result=new Promise(resolve=>{resolver=resolve;});
    const callback=value=>{answered=true;resolver(JSON.parse(JSON.stringify(value)));};
    const keep= listeners[0](message,sender,callback);
    if(keep!==true && !answered)resolver(null);
    return{keep,result};
  }
  return {mem,chrome,ctx,youtube,panel,dispatch,openCalls,updated,removed,
    setActive(id){activeTabId=id;}};
}

test("G28-2 contract parses exact VIDEO/CHANNEL click and tab-scoped keys",()=>{
  const f=worker(),c=f.ctx.YUTOPIA_PANEL_SELECTION;
  assert.equal(c.parseClick(click())?.targetKey,"VIDEO:"+V1);
  assert.equal(c.parseClick(click(CHANNEL,7,"CHANNEL"))?.targetKey,"CHANNEL:"+CHANNEL);
  assert.equal(c.keyForTab(17),"YU28_SELECTED_TAB_V1_17");
  assert.equal(c.keyForTab(18),"YU28_SELECTED_TAB_V1_18");
  assert.equal(c.keyForTab(-1),null);
  assert.equal(c.parseClick({...click(),extra:true}),null);
  assert.equal(c.parseClick(click("@handle",1,"CHANNEL")),null);
  assert.equal(c.parseRead(readSelection(17)).tabId,17);
  assert.equal(c.parseRead({...readSelection(17),extra:"x"}),null);
});

test("G28-2 explicit click invokes open synchronously, then confirms stored PINNED",async()=>{
  let finish;
  const f=worker(bus(),{open:()=>new Promise(resolve=>{finish=resolve;})});
  const attempt=f.dispatch(click(V1,3));
  assert.equal(attempt.keep,true);
  assert.equal(f.openCalls.length,1,"must open before asynchronous storage");
  assert.deepEqual(JSON.parse(JSON.stringify(f.openCalls[0])),{tabId:17});
  assert.equal(f.mem.counters.sets,0);
  finish();
  const answer=await attempt.result;
  assert.equal(answer.status,"PINNED");
  assert.equal(answer.ok,true);
  assert.equal(answer.pin.isSynthetic,true);
  assert.equal(answer.pin.source,"STATIC_FIXTURE");
  assert.equal(answer.pin.targetId,V1);
  const storage=f.mem.data.get("YU28_SELECTED_TAB_V1_17");
  assert.equal(storage.targetKey,"VIDEO:"+V1);
  assert.equal(storage.documentId,DOC1);
});

test("G28-2 Hover B preview never changes A selection",async()=>{
  const f=worker();
  assert.equal((await f.dispatch(click(V1,1)).result).status,"PINNED");
  const older=f.mem.data.get("YU28_SELECTED_TAB_V1_17");
  const p=await f.dispatch(preview(V2,2)).result;
  assert.equal(p.status,"READY");
  const pin=f.mem.data.get("YU28_SELECTED_TAB_V1_17");
  assert.equal(pin.targetId,V1);
  assert.equal(pin.selectedAt,older.selectedAt);
  assert.equal(f.openCalls.length,1);
});

test("G28-2 explicitly clicking B changes pin from A to B",async()=>{
  const f=worker();
  assert.equal((await f.dispatch(click(V1,1)).result).status,"PINNED");
  assert.equal((await f.dispatch(click(V2,2)).result).status,"PINNED");
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_17").targetId,V2);
  assert.equal(f.openCalls.length,2);
});

test("G28-2 late A open resolution cannot overwrite subsequent B click",async()=>{
  const openings=[];
  const f=worker(bus(),{open:()=>new Promise(resolve=>openings.push(resolve))});
  const a=f.dispatch(click(V1,1));
  const b=f.dispatch(click(V2,2));
  assert.equal(f.openCalls.length,2);
  openings[1]();
  assert.equal((await b.result).status,"PINNED");
  openings[0]();
  assert.equal((await a.result).status,"SUPERSEDED");
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_17").targetId,V2);
});

test("G28-2 invalid IDs, @handle, external sender or forged fields never open",async()=>{
  const f=worker();
  for(const req of [
    click("@handle",1,"CHANNEL"),click("BAD"),click(V1,0),
    click(V1,1,"GAME"),{...click(),version:2},{...click(),unexpected:1},
  ])assert.equal((await f.dispatch(req).result).status,"INVALID_REQUEST");
  for(const sender of [
    {...f.youtube,id:"other"},
    {...f.youtube,url:"https://www.youtube.com.evil.example/results"},
    {...f.youtube,frameId:1},
    {...f.youtube,documentId:"short"},
    {...f.youtube,tab:null},
  ])assert.equal((await f.dispatch(click(),sender).result).status,"UNTRUSTED_SENDER");
  assert.equal(f.openCalls.length,0);
});

test("G28-2 rejected open and storage errors never confirm a new pin",async()=>{
  const rejected=worker(bus(),{open:()=>Promise.reject(Error("activation denied"))});
  assert.equal((await rejected.dispatch(click()).result).status,"OPEN_FAILED");
  assert.equal(rejected.mem.data.size,0);
  const mem=bus();mem.failSet(true);
  const f=worker(mem);
  assert.equal((await f.dispatch(click()).result).status,"PIN_FAILED");
  assert.equal(f.mem.data.size,0);
});

test("G28-2 distinct tabs have distinct stored pins",async()=>{
  const f=worker();
  const tab18={...f.youtube,tab:{id:18},documentId:DOC2};
  assert.equal((await f.dispatch(click(V1,1)).result).status,"PINNED");
  assert.equal((await f.dispatch(click(V2,1),tab18).result).status,"PINNED");
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_17").targetId,V1);
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_18").targetId,V2);
});

test("G28-2 panel READ requires extension origin and current active tab",async()=>{
  const f=worker();
  await f.dispatch(click(V1,1)).result;
  assert.equal((await f.dispatch(readSelection(17),f.youtube).result).status,"UNTRUSTED_SENDER");
  assert.equal((await f.dispatch(readSelection(17),
    {...f.panel,url:"chrome-extension://ext-yutopia/other.html"}).result).status,"UNTRUSTED_SENDER");
  assert.equal((await f.dispatch(readSelection(17),f.panel).result).status,"READY");
  f.setActive(18);
  assert.equal((await f.dispatch(readSelection(17),f.panel).result).status,"NOT_ACTIVE_TAB");
  assert.equal((await f.dispatch(readSelection(18),f.panel).result).status,"EMPTY");
});

test("G28-2 panel READ produces same persisted pin after worker restart",async()=>{
  const mem=bus();
  const before=worker(mem);
  await before.dispatch(click(CHANNEL,2,"CHANNEL")).result;
  const after=worker(mem);
  const response=await after.dispatch(readSelection(17),after.panel).result;
  assert.equal(response.status,"READY");
  assert.equal(response.pin.targetKey,"CHANNEL:"+CHANNEL);
  assert.equal(response.pin.source,"STATIC_FIXTURE");
});

test("G28-2 stale same-document request refuses to overwrite stored newer click",async()=>{
  const f=worker();
  await f.dispatch(click(V2,10)).result;
  assert.equal((await f.dispatch(click(V1,9)).result).status,"STALE_REQUEST");
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_17").targetId,V2);
});

test("G28-2 newer document may begin requestId sequence again",async()=>{
  const f=worker();
  await f.dispatch(click(V1,90)).result;
  const newDoc={...f.youtube,documentId:DOC2};
  assert.equal((await f.dispatch(click(V2,1),newDoc).result).status,"PINNED");
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_17").targetId,V2);
});

test("G28-2 malformed, expired, foreign-tab storage is never rendered as READY",async()=>{
  const f=worker(),key="YU28_SELECTED_TAB_V1_17";
  await f.dispatch(click()).result;
  const pin=f.mem.data.get(key);
  f.mem.data.set(key,{...pin,targetId:"INVALID"});
  assert.equal((await f.dispatch(readSelection(17),f.panel).result).status,"EMPTY");
  f.mem.data.set(key,{...pin,expiresAt:Date.now()-1});
  assert.equal((await f.dispatch(readSelection(17),f.panel).result).status,"EMPTY");
  f.mem.data.set(key,{...pin,tabId:18});
  assert.equal((await f.dispatch(readSelection(17),f.panel).result).status,"EMPTY");
});

test("G28-2 full navigation invalidates tab selection; SPA preview alone does not",async()=>{
  const f=worker();
  await f.dispatch(click()).result;
  await f.dispatch(preview(V2,2)).result;
  assert.equal(f.mem.data.has("YU28_SELECTED_TAB_V1_17"),true);
  assert.equal(f.updated.length,1);
  f.updated[0](17,{status:"loading"});
  await pause();
  assert.equal(f.mem.data.has("YU28_SELECTED_TAB_V1_17"),false);
});

test("G28-2 tab removal cleans up selected target",async()=>{
  const f=worker();
  await f.dispatch(click()).result;
  assert.equal(f.removed.length,1);
  f.removed[0](17);
  await pause();
  assert.equal(f.mem.data.has("YU28_SELECTED_TAB_V1_17"),false);
});

test("G28-2 panel DOM renders only user-click pin and refreshes on tab changes",async()=>{
  const f=worker();
  const nodes=new Map();
  for(const id of ["selection-status","selection-details","selection-kind","selection-id"]){
    nodes.set(id,{textContent:"",hidden:id==="selection-details"});
  }
  const listeners=new Map();
  const panelContext={
    chrome:{
      runtime:{sendMessage:async msg=>(await f.dispatch(msg,f.panel).result)},
      tabs:{
        query:async()=>await f.chrome.tabs.query({active:true,lastFocusedWindow:true}),
        onActivated:{
          addListener(fn){listeners.set("tab-activated",fn);},
          removeListener(fn){if(listeners.get("tab-activated")===fn)listeners.delete("tab-activated");},
        },
      },
      storage:{onChanged:{
        addListener:fn=>f.mem.changedListeners.add(fn),
        removeListener:fn=>f.mem.changedListeners.delete(fn),
      }},
    },
    document:{
      getElementById:id=>nodes.get(id),
      documentElement:{dataset:{}},
    },
    addEventListener(){},
    removeEventListener(){},
    Promise,console,
  };
  vm.createContext(panelContext);
  vm.runInContext(files["panel-selection-contract.js"],panelContext);
  vm.runInContext(files["sidepanel.js"],panelContext);
  await pause();
  assert.equal(panelContext.YUTOPIA_SIDE_PANEL.getRuntimeStatus().lastStatus,"EMPTY");
  assert.equal(nodes.get("selection-details").hidden,true);
  await f.dispatch(click(V1,1)).result;
  await pause();
  assert.equal(nodes.get("selection-details").hidden,false);
  assert.match(nodes.get("selection-id").textContent,/VIDEO: Ab0_-123xyz/);
  await f.dispatch(preview(V2,2)).result;
  await pause();
  assert.match(nodes.get("selection-id").textContent,/VIDEO: Ab0_-123xyz/);
  await f.dispatch(click(V2,3)).result;
  await pause();
  assert.match(nodes.get("selection-id").textContent,/VIDEO: Ab0_-123xyZ/);
  f.setActive(18);
  listeners.get("tab-activated")({tabId:18});
  await pause();
  assert.equal(panelContext.YUTOPIA_SIDE_PANEL.getRuntimeStatus().lastStatus,"EMPTY");
  assert.equal(nodes.get("selection-details").hidden,true);
  panelContext.YUTOPIA_SIDE_PANEL.dispose();
});

test("G28-2 repeated double-click on same target is idempotent",async()=>{
  const f=worker();
  assert.equal((await f.dispatch(click(V1,1)).result).status,"PINNED");
  assert.equal((await f.dispatch(click(V1,1)).result).status,"PINNED");
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_17").targetId,V1);
  assert.equal(f.openCalls.length,2);
});

test("G28-2 failed B open preserves previously confirmed A",async()=>{
  let attempts=0;
  const f=worker(bus(),{open:()=>{
    attempts++;
    return attempts===1 ? Promise.resolve() : Promise.reject(Error("browser rejected"));
  }});
  assert.equal((await f.dispatch(click(V1,1)).result).status,"PINNED");
  assert.equal((await f.dispatch(click(V2,2)).result).status,"OPEN_FAILED");
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_17").targetId,V1);
});

test("G28-2 same document/requestId with different target fails conflict",async()=>{
  const f=worker();
  assert.equal((await f.dispatch(click(V1,12)).result).status,"PINNED");
  assert.equal((await f.dispatch(click(V2,12)).result).status,"REQUEST_CONFLICT");
  assert.equal(f.mem.data.get("YU28_SELECTED_TAB_V1_17").targetId,V1);
});
