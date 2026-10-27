/** G28-1: real Chrome user activation requires manual QA; this tests only the worker contract. */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const workerSource = source("background.js");
const inputs = { "shared.js":source("shared.js"),"hover-card-model.js":source("hover-card-model.js"),
  "panel-selection-contract.js":source("panel-selection-contract.js") };
const VIDEO = "Ab0_-123xyz", VIDEO_B = "Ab0_-123xyZ", CHANNEL = "UC"+"a".repeat(22);
const req=(targetId=VIDEO, requestId=1, targetType="VIDEO")=>({
  type:"YUTOPIA_YU28_GESTURE_OPEN_V1",version:1,requestId,targetType,targetId,
});

function fixture({open=()=>Promise.resolve(),openSupported=true}={}) {
  const handlers=[], opened=[];
  const chrome={
    runtime:{id:"ext-yutopia",onInstalled:{addListener(){}},
      onMessage:{addListener(handler){handlers.push(handler);}}},
    sidePanel:{setPanelBehavior:async()=>{}},
    storage:{session:{async get(){return{};},async set(){}}},
  };
  if(openSupported)chrome.sidePanel.open=options=>{
    opened.push(options);
    return open(options);
  };
  const ctx=vm.createContext({chrome,URL,Promise,console,Date});
  ctx.importScripts=(...names)=>{
    for(const name of names)vm.runInContext(inputs[name],ctx,{filename:name});
  };
  vm.runInContext(workerSource,ctx,{filename:"background.js"});
  assert.equal(handlers.length,1);
  const sender={id:"ext-yutopia",tab:{id:17},frameId:0,
    documentId:"37c0a110-70ab-4545-aaf2-bff993cb3990",
    url:"https://www.youtube.com/results?search_query=test"};
  function dispatch(request,from=sender) {
    let settled=false, resolveReply;
    const reply=new Promise(resolve=>{resolveReply=resolve;});
    const responded=value=>{settled=true;resolveReply(JSON.parse(JSON.stringify(value)));};
    const returned=handlers[0](request,from,responded);
    if(returned!==true&&!settled)resolveReply(null);
    return {returned,reply};
  }
  return {dispatch,opened,sender};
}

test("G28-1: exact click request opens tab Side Panel before async work",async()=>{
  let finish;
  const w=fixture({open:()=>new Promise(resolve=>{finish=resolve;})});
  const attempt=w.dispatch(req());
  assert.equal(attempt.returned,true);
  assert.equal(w.opened.length,1,"sidePanel.open must be synchronous in onMessage");
  assert.deepEqual(JSON.parse(JSON.stringify(w.opened[0])),{tabId:17});
  finish();
  const response=await attempt.reply;
  assert.deepEqual(response,{
    type:"YUTOPIA_YU28_GESTURE_RESULT_V1",version:1,requestId:1,
    targetType:"VIDEO",targetId:VIDEO,targetKey:"VIDEO:"+VIDEO,
    ok:true,status:"OPENED",
  });
});

test("G28-1: CHANNEL click request uses same strict schema",async()=>{
  const w=fixture();
  const response=await w.dispatch(req(CHANNEL,3,"CHANNEL")).reply;
  assert.equal(response.ok,true);
  assert.equal(response.targetKey,"CHANNEL:"+CHANNEL);
  assert.equal(w.opened.length,1);
});

test("G28-1: strict payload rejects forged/unknown fields and unresolved handles",async()=>{
  const w=fixture();
  const bad=[
    req("@someone",1,"CHANNEL"),req("bad"),req(VIDEO,0),
    req(VIDEO,1,"GAME"),{...req(),version:0},
    {...req(),requestId:1.5},{...req(),targetKey:"VIDEO:"+VIDEO_B},
    {...req(),unexpected:true},
  ];
  for(const request of bad){
    const result=await w.dispatch(request).reply;
    assert.equal(result.status,"INVALID_REQUEST");
    assert.equal(result.ok,false);
  }
  assert.equal(w.opened.length,0);
});

test("G28-1: sender top frame/tab/document/origin validation denies open",async()=>{
  const w=fixture();
  for(const s of [
    {...w.sender,id:"alien-extension"},
    {...w.sender,tab:null},
    {...w.sender,frameId:1},
    {...w.sender,documentId:"bad"},
    {...w.sender,url:"https://www.youtube.com.evil.test/watch?v="+VIDEO},
    {...w.sender,url:"https://youtube.com/watch?v="+VIDEO},
  ]) {
    const x=await w.dispatch(req(),s).reply;
    assert.equal(x.status,"UNTRUSTED_SENDER");
    assert.equal(x.ok,false);
  }
  assert.equal(w.opened.length,0);
});

test("G28-1: rejects promise from sidePanel.open without success claim",async()=>{
  const w=fixture({open:()=>Promise.reject(Error("sidePanel.open() may only be called in response to a user gesture"))});
  const attempt=w.dispatch(req());
  assert.equal(attempt.returned,true);
  const response=await attempt.reply;
  assert.equal(response.ok,false);
  assert.equal(response.status,"OPEN_FAILED");
  assert.equal(w.opened.length,1);
});

test("G28-1: synchronous sidePanel.open throw is reported as failure",async()=>{
  const w=fixture({open:()=>{throw Error("blocked");}});
  const attempt=w.dispatch(req());
  assert.equal(attempt.returned,false);
  assert.equal((await attempt.reply).status,"OPEN_FAILED");
  assert.equal(w.opened.length,1);
});

test("G28-1: missing API is OPEN_UNAVAILABLE, no call",async()=>{
  const w=fixture({openSupported:false});
  const attempt=w.dispatch(req());
  assert.equal(attempt.returned,false);
  assert.equal((await attempt.reply).status,"OPEN_UNAVAILABLE");
  assert.equal(w.opened.length,0);
});

test("G28-1: a non-promise return is not called OPENED",async()=>{
  const w=fixture({open:()=>undefined});
  const attempt=w.dispatch(req());
  assert.equal((await attempt.reply).status,"OPEN_UNCONFIRMED");
  assert.equal(w.opened.length,1);
});

test("G28-1: ordinary YU-27 preview and PING never open the panel",async()=>{
  const w=fixture();
  const ping=await w.dispatch({type:"YUTOPIA_DEMO_PING"}).reply;
  assert.equal(ping.ok,true);
  const preview=await w.dispatch({type:"YUTOPIA_MOCK_PREVIEW_GET_V1",
    version:1,requestId:1,targetType:"VIDEO",targetId:VIDEO}).reply;
  assert.equal(preview.status,"READY");
  assert.equal(preview.isSynthetic,true);
  assert.equal(w.opened.length,0);
});

test("G28-1: unrelated worker messages cannot open the panel",async()=>{
  const w=fixture();
  const a=await w.dispatch({type:"OTHER_MESSAGE"}).reply;
  assert.equal(a,null);
  assert.equal(w.opened.length,0);
});
