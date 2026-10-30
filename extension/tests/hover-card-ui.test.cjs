/**
 * YUTOPIA 26 — 실제 Shadow DOM Hover 카드의 DOM/키보드/대상 분리 테스트.
 *
 * 실행: node --test extension/tests/hover-card-ui.test.cjs
 * Fake DOM/위치 시뮬레이션만 시험한다. 브라우저 픽셀/YouTube DOM 검증은 별도.
 */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modelSource = fs.readFileSync(path.join(__dirname, "..", "hover-card-model.js"), "utf8");
const cardSource = fs.readFileSync(path.join(__dirname, "..", "hover-card.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
const VIDEO_A = "Ab0_-123xyz";
const VIDEO_B = "Ab0_-123xyZ";

/*
 * YU-32 3단계 — 실제 기존 계약과 합성 READY Fixture 재사용.
 * 모든 데이터는 QA 전용이며 실제 YouTube 데이터가 아니다.
 */
const qaContractContext = vm.createContext({});

vm.runInContext(
  fs.readFileSync(
    path.join(__dirname, "..", "hover-summary-contract.js"),
    "utf8"
  ),
  qaContractContext,
  {filename: "hover-summary-contract.js"}
);

const qaContract =
  qaContractContext.YUTOPIA_HOVER_SUMMARY_CONTRACT;

const qaReadyRaw = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "shared",
      "contracts",
      "analysis-v1",
      "fixtures",
      "ready.snapshot.json"
    ),
    "utf8"
  )
);

function makeQaWireReadySummary() {
  const raw = qaReadyRaw;
  const denominator = raw.sample.classifiedCount;

  return {
    snapshotId: raw.snapshotId,
    target: {...raw.target},
    status: "READY",

    provenance: {
      sourceType: "STATIC_FIXTURE",
      isSynthetic: true,
      visibility: "PUBLIC_REUSABLE",
      tenantId: null,
    },

    observationScope: {...raw.scope},
    observedAt: raw.observedAt,
    analyzedAt: raw.analyzedAt,

    valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC",

    sentimentPercent: {
      denominator,
      positivePercent:
        raw.sentiment.positive / denominator * 100,
      neutralPercent:
        raw.sentiment.neutral / denominator * 100,
      negativePercent:
        raw.sentiment.negative / denominator * 100,
      classificationCoveragePercent:
        denominator / raw.sample.eligibleCount * 100,
    },

    topTopics: raw.topics.map(topic => ({
      topicId: topic.topicId,
      mentionCount: topic.mentionCount,
    })),
  };
}

const CHANNEL_ID = "UC" + "a".repeat(22);

const { createSimulator } = require(
  "../../shared/experiments/coverage-scheduler-v0/engine.cjs"
);

class FakeNode {
  constructor(tag="div", parent=null) {
    this.tagName = tag.toUpperCase();
    this.parentNode = parent;
    this.childNodes = [];
    this.listeners = new Map();
    this.style = {};
    this.dataset = {};
    this.attributes = new Map();
    this.className = "";
    this.id = "";
    this.hidden = false;
    this.type = "";
    this._text = "";
    this._root = false;
    this.shadowRoot = null;
    this.rect = {left:80, top:90, right:260, bottom:190, width:180, height:100};
  }
  set textContent(s) {
    this._text = String(s);
    this.childNodes = [];
  }
  get textContent() {
    return this._text + this.childNodes.map(n=>n.textContent).join("");
  }
  setAttribute(name,value) {
    this.attributes.set(name,String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name) {return this.attributes.has(name);}
  addEventListener(type,handler) {
    const list=this.listeners.get(type)||new Set();
    list.add(handler);this.listeners.set(type,list);
  }
  removeEventListener(type,handler) {this.listeners.get(type)?.delete(handler);}
  fire(type,extra={}) {
    for(const handler of [...(this.listeners.get(type)||[])]) {
      handler({type,relatedTarget:null,...extra});
    }
  }
  count(type) {return this.listeners.get(type)?.size||0;}
  appendChild(node) {
    if(node.parentNode)node.remove();
    node.parentNode=this;
    this.childNodes.push(node);
    return node;
  }
  replaceChildren(...nodes) {
    for(const child of this.childNodes)child.parentNode=null;
    this.childNodes=[];
    for(const node of nodes)this.appendChild(node);
  }
  remove() {
    if(!this.parentNode)return;
    const list=this.parentNode.childNodes;
    const idx=list.indexOf(this);
    if(idx>=0)list.splice(idx,1);
    this.parentNode=null;
  }
  get isConnected() {
    if(this._root)return true;
    return Boolean(this.parentNode?.isConnected);
  }
  attachShadow() {
    if(this.shadowRoot)throw Error("Duplicate shadow root");
    this.shadowRoot = new FakeNode("shadow-root",this);
    return this.shadowRoot;
  }
  getBoundingClientRect() {
    if(this.id==="yutopia-extension-hover-card"){
      const width=parseFloat(this.style.width)||344;
      const surface=this.shadowRoot?.childNodes?.find(n=>n.attributes?.has("data-yutopia-card-surface"));
      const limit=parseFloat(surface?.childNodes?.[0]?.style?.maxHeight);
      const height=Math.min(this.syntheticCardHeight||260,Number.isFinite(limit)?limit:Infinity);
      return {width,height,left:parseFloat(this.style.left)||0,
        top:parseFloat(this.style.top)||0,
        right:(parseFloat(this.style.left)||0)+width,
        bottom:(parseFloat(this.style.top)||0)+height};
    }
    return {...this.rect};
  }
  contains(node) {
    if(this===node)return true;
    return this.childNodes.some(child=>child.contains(node));
  }
}

function deepFind(node,predicate) {
  if(!node)return null;
  if(predicate(node))return node;
  for(const child of node.childNodes){
    const found=deepFind(child,predicate);
    if(found)return found;
  }
  return null;
}
function all(node,predicate) {
  if(!node)return [];
  return [...(predicate(node)?[node]:[]),...node.childNodes.flatMap(x=>all(x,predicate))];
}
function videoState(id=VIDEO_A,requestId=1,anchor=null) {
  return {phase:"READY",requestId,targetType:"VIDEO",targetId:id,
    identityStatus:"VIDEO_ID_VALID",anchor,
    target:{targetType:"VIDEO",targetId:id}};
}
function channelState(requestId=1,anchor=null) {
  return {phase:"READY",requestId,targetType:"CHANNEL",targetId:CHANNEL_ID,
    identityStatus:"CHANNEL_ID_FORMAT_VALID",anchor,
    target:{targetType:"CHANNEL",targetId:CHANNEL_ID}};
}
function unresolvedState(requestId=1,anchor=null) {
  return {phase:"UNRESOLVED",requestId,targetType:"CHANNEL",targetId:null,
    identityStatus:"HANDLE_UNRESOLVED",anchor,target:null};
}
function makeFixture({vw=1200, vh=800, dark=false, cardHeight=260, sendMessage=null, summaryClient=null, qaBridge = null}={}) {
  const doc=new FakeNode("document");
  doc._root=true;
  doc.body=new FakeNode("body",doc);
  doc.documentElement=new FakeNode("html",doc);
  if(dark)doc.documentElement.setAttribute("dark","");
  doc.childNodes.push(doc.body,doc.documentElement);
  doc.createElement=tag=> {
    const node=new FakeNode(tag);
    node.syntheticCardHeight=cardHeight;
    return node;
  };
  doc.createTextNode=text=>new FakeNode("#text");
  const docCreateTextNode=doc.createTextNode;
  doc.createTextNode=s=>{const n=docCreateTextNode();n.textContent=s;return n;};

  const win=new FakeNode("window");
  let current={phase:"IDLE",requestId:0,targetType:null,targetId:null,anchor:null};
  const subs=new Set();
  let unsubscribeCount=0;
  let dismissReason=null;
  let overlayEnters=0,overlayLeaves=0,focusEnters=0,focusLeaves=0;
  let cardRegion=null, cardRegistrations=0;
  const controller={
    setCardRegion(host,card) {
      cardRegion=host && card ? {host,card} : null;
      cardRegistrations+=1;
    },
    subscribe(fn) {subs.add(fn);fn(current);return()=>{subs.delete(fn);unsubscribeCount++;};},
    isCurrentRequest(req) {
      return current.phase==="READY" &&
        current.requestId===req.requestId &&
        current.targetType===req.targetType &&
        current.targetId===req.targetId;
    },
    dismiss(reason) {
      dismissReason=reason;
      emit({...current,phase:"DISMISSED",targetId:null,target:null,anchor:null});
    },
    overlayPointerEnter(){overlayEnters++;},
    overlayPointerLeave(){overlayLeaves++;},
    overlayFocusIn(){focusEnters++;},
    overlayFocusOut(){focusLeaves++;},
  };
  function emit(state) {
    current=state;
    for(const fn of [...subs])fn(state);
  }
  const ctx=vm.createContext({
    document:doc,innerWidth:vw,innerHeight:vh,
    addEventListener:win.addEventListener.bind(win),
    removeEventListener:win.removeEventListener.bind(win),
    YUTOPIA_HOVER_CONTROLLER:controller,
    YUTOPIA_HOVER_SUMMARY_CLIENT: summaryClient || undefined,
    chrome: sendMessage ? {runtime:{sendMessage}} : undefined,
    YUTOPIA_YU32_QA_BRIDGE: qaBridge || undefined,
    YUTOPIA_HOVER_SUMMARY_CONTRACT: qaContract,
  });
  vm.runInContext(modelSource,ctx,{filename:"hover-card-model.js"});
  vm.runInContext(cardSource,ctx,{filename:"hover-card.js"});
  function anchor(rect) {
    const el=new FakeNode("a",doc.body);
    el.rect=rect||{left:80,top:90,right:260,bottom:190,width:180,height:100};
    return el;
  }
  function host() {return doc.body.childNodes.find(n=>n.id==="yutopia-extension-hover-card")||null;}
  function surface(){return host()?.shadowRoot.childNodes.find(n=>n.attributes?.has("data-yutopia-card-surface"))||null;}
  function cardText(){return surface()?.textContent||"";}
  function findClass(className){return deepFind(surface(),n=>n.className.split(" ").includes(className));}
  return{
    ctx,doc,win,controller,emit,anchor,host,surface,cardText,findClass,
    get api(){return ctx.YUTOPIA_HOVER_CARD;},
    get model(){return ctx.YUTOPIA_HOVER_CARD_MODEL;},
    get dismissReason(){return dismissReason;},
    get unsubscribes(){return unsubscribeCount;},
    get subscribers(){return subs.size;},
    get overlayCalls(){return {overlayEnters,overlayLeaves,focusEnters,focusLeaves};},
    get cardRegion(){return cardRegion;},
    get cardRegistrations(){return cardRegistrations;},
    setViewport(w,h){ctx.innerWidth=w;ctx.innerHeight=h;},
    rerun(){vm.runInContext(cardSource,ctx);},
  };
}

test("Manifest: model/renderer는 Hover controller 이후 순서로 실행",()=>{
  const list=manifest.content_scripts[0].js;

  assert.deepEqual(list.slice(-7), [
    "hover-controller.js",
    "preview-client.js",
    "hover-card-model.js",
    "hover-summary-contract.js",
    "hover-summary-transport.js",
    "hover-summary-client.js",
    "hover-card.js",
  ]);
});

test("모델: 고정된 가상 분포는 합이 100이며 실제 수집 근거를 가장하지 않음",()=>{
  const f=makeFixture();
  const model=f.model.mockForTarget({targetType:"VIDEO",targetId:VIDEO_A});
  assert.equal(model.positive+model.neutral+model.negative,100);
  assert.equal(model.isSynthetic,true);
  assert.equal(model.source,"STATIC_FIXTURE");
  assert.match(model.briefing,/실제 댓글을 분석하지 않은/);
  assert.match(model.sampleLabel,/가상/);
  assert.equal(Object.isFrozen(model),true);
});

test("모델: 동일 ID의 값은 결정적이며, VIDEO/CHANNEL 형식이 틀리면 null",()=>{
  const f=makeFixture();
  const target={targetType:"VIDEO",targetId:VIDEO_A};
  assert.deepEqual(JSON.parse(JSON.stringify(f.model.mockForTarget(target))),
    JSON.parse(JSON.stringify(f.model.mockForTarget(target))));
  assert.equal(f.model.mockForTarget({targetType:"VIDEO",targetId:"bad"}),null);
  assert.equal(f.model.mockForTarget({targetType:"CHANNEL",targetId:VIDEO_A}),null);
  assert.equal(f.model.mockForTarget({targetType:"OTHER",targetId:CHANNEL_ID}),null);
});

test("IDLE과 HOVER_PENDING에는 DOM 카드가 생성되지 않음",()=>{
  const f=makeFixture(),a=f.anchor();
  assert.equal(f.api.getRuntimeStatus().connected,true);
  assert.equal(f.host(),null);
  f.emit({...videoState(VIDEO_A,1,a),phase:"HOVER_PENDING"});
  assert.equal(f.host(),null);
});


test("READY VIDEO는 검증 전 수치를 표시하지 않고 카드를 생성한다", () => {
  const f = makeFixture(), a = f.anchor();

  f.emit(videoState(VIDEO_A, 1, a));

  assert.equal(f.host()?.isConnected, true);
  assert.ok(f.host().shadowRoot);
  assert.equal(f.api.getRuntimeStatus().hostCount, 1);
  assert.equal(f.api.getRuntimeStatus().targetId, VIDEO_A);
  assert.match(f.cardText(), new RegExp(VIDEO_A));
  assert.match(f.cardText(), /DEMO/);
  assert.match(f.cardText(), /검증된 요약을 사용할 수 없습니다/);
  assert.equal(f.findClass("bar"), null);
});


test("Card만 pointer-events:auto, Host·Surface는 투명하며 Controller에 등록",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  const card=f.findClass("card");
  assert.equal(f.host()?.style.pointerEvents,"none");
  assert.equal(f.surface()?.style.pointerEvents,"none");
  assert.match(cardSource,/\.card \{ pointer-events: auto;/);
  assert.equal(f.cardRegion?.host,f.host());
  assert.equal(f.cardRegion?.card,card);
  assert.ok(f.cardRegistrations>=1);
});

test("카드 종료시 Controller에서 hit region을 해제하여 오래된 Overlay 선택 방지",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  assert.ok(f.cardRegion);
  f.emit({phase:"IDLE"});
  assert.equal(f.host(),null);
  assert.equal(f.cardRegion,null);
});

test("A→B 카드 내용 갱신 시 새 cardRoot로 Controller hit region 갱신",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  const oldCard=f.cardRegion?.card;
  f.emit(videoState(VIDEO_B,2,f.anchor()));
  assert.ok(f.cardRegion?.card);
  assert.notEqual(f.cardRegion.card,oldCard);
  assert.equal(f.cardRegion.host,f.host());
  assert.equal(f.api.getRuntimeStatus().targetId,VIDEO_B);
});

test("요약을 사용할 수 없으면 기존 가상 감성 비율을 표시하지 않는다", () => {
  const f = makeFixture();

  f.emit(videoState(VIDEO_A, 1, f.anchor()));

  assert.equal(f.findClass("bar"), null);
  assert.doesNotMatch(
    f.cardText(),
    /긍정\s+\d+(?:\.\d+)?%/
  );
  assert.match(f.cardText(), /분석 비율은 제공하지 않습니다/);
});

test("영상 A→B 선택 변경 시 이전 ID·카드가 재사용되지 않음",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  f.emit(videoState(VIDEO_B,2,f.anchor()));
  assert.match(f.cardText(),new RegExp(VIDEO_B));
  assert.doesNotMatch(f.cardText(),new RegExp(VIDEO_A));
  assert.equal(f.api.getRuntimeStatus().requestId,2);
  assert.equal(f.doc.body.childNodes.filter(x=>x.id==="yutopia-extension-hover-card").length,1);
});

test("Controller 상태 이유와 renderer 미표시 이유를 분리",()=>{
  const f=makeFixture();
  const a=f.anchor({left:200,top:900,right:300,bottom:960,width:100,height:60});
  f.emit({...videoState(VIDEO_A,1,a),reason:"THUMBNAIL_ENTER"});
  const result=f.api.getRuntimeStatus();
  assert.equal(result.hostCount,0);
  assert.equal(result.lastHoverPhase,"READY");
  assert.equal(result.lastHoverReason,"THUMBNAIL_ENTER");
  assert.equal(result.lastRenderReason,"ANCHOR_NOT_VISIBLE");
});

test("READY A 이후 HOVER_PENDING B가 오면 A의 카드 즉시 제거",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  f.emit({...videoState(VIDEO_B,2,a),phase:"HOVER_PENDING"});
  assert.equal(f.host(),null);
});

test("legacy LEAVE_PENDING도 strict 계약에서는 즉시 제거",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  f.emit({...videoState(VIDEO_A,1,a),phase:"LEAVE_PENDING"});
  assert.equal(f.host(),null);
  assert.equal(f.api.getRuntimeStatus().lastRenderReason,"NO_ACTIVE_TARGET");
});

test("다른 requestId의 LEAVE_PENDING은 이전 카드 유지하지 않음",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  f.emit({...videoState(VIDEO_A,2,a),phase:"LEAVE_PENDING"});
  assert.equal(f.host(),null);
});

test("IDLE/DISMISSED로 전이하면 Host가 완전히 제거됨",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  f.emit({phase:"IDLE"});
  assert.equal(f.host(),null);
  f.emit(videoState(VIDEO_A,2,a));
  f.emit({phase:"DISMISSED"});
  assert.equal(f.host(),null);
});

test("READY CHANNEL도 미검증 예시 비율을 표시하지 않는다", () => {
  const f = makeFixture();

  f.emit(channelState(1, f.anchor()));

  assert.equal(f.api.getRuntimeStatus().targetType, "CHANNEL");
  assert.match(f.cardText(), new RegExp(CHANNEL_ID));
  assert.equal(f.findClass("bar"), null);
  assert.doesNotMatch(f.cardText(), /선정 영상 8개/);
});

test("HANDLE_UNRESOLVED는 거짓 비율이나 더보기 CTA를 만들지 않음",()=>{
  const f=makeFixture();
  f.emit(unresolvedState(1,f.anchor()));
  assert.equal(f.api.getRuntimeStatus().targetId,null);
  assert.match(f.cardText(),/채널 ID 확인 필요/);
  assert.match(f.cardText(),/정확한 채널 ID/);
  assert.equal(f.findClass("bar"),null);
  assert.equal(f.findClass("more"),null);
});

test("불확실한 VIDEO ID로 READY를 위장하면 모델 거부로 렌더링하지 않음",()=>{
  const f=makeFixture();
  f.emit(videoState("INVALID",1,f.anchor()));
  assert.equal(f.host(),null);
});

test("기존 YouTube 문서는 Shadow Root 바깥에서 수정되지 않음",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  assert.equal(f.doc.body.childNodes.filter(x=>x.id!=="yutopia-extension-hover-card").length,0);
  assert.equal(f.doc.body.childNodes.length,1);
  assert.equal(f.host().attributes.get("data-yutopia-demo"),"true");
});

test("G28-2: Chrome 메시징 없는 Fake DOM에서는 더보기 비활성",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const button=f.findClass("more");
  assert.ok(button);
  const note=f.findClass("more-status");
  assert.equal(button.disabled,true);assert.equal(note.hidden,true);
  button.fire("click");
  assert.equal(note.hidden,true);
  assert.equal(f.api.getRuntimeStatus().lastAction,null);
});

test("G28-2: 사용자 실제 클릭에서만 선택 메시지 전송, 응답 echo 검증",async()=>{
  const calls=[];
  const f=makeFixture({sendMessage:req=>{
    calls.push(req);
    return Promise.resolve({
      type:"YUTOPIA_YU28_PIN_RESULT_V1",version:1,
      requestId:req.requestId,targetType:req.targetType,targetId:req.targetId,
      targetKey:req.targetType+":"+req.targetId,tabId:17,ok:true,status:"PINNED",pinned:true,
      pin:{targetType:req.targetType,targetId:req.targetId,isSynthetic:true,source:"STATIC_FIXTURE"},
    });
  }});
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  const button=f.findClass("more"), note=f.findClass("more-status");
  assert.equal(button.disabled,false);
  button.fire("click",{isTrusted:false});
  assert.equal(calls.length,0);
  button.fire("click",{isTrusted:true});
  assert.equal(calls.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{
    type:"YUTOPIA_YU28_PIN_AND_OPEN_V1",version:1,
    requestId:1,targetType:"VIDEO",targetId:VIDEO_A,
  });
  assert.equal(f.api.getRuntimeStatus().lastAction,"YU28_G28_2_REQUESTED");
  // Node vm cross-context Promise reactions may run on a later event-loop turn.
  // Await a macrotask boundary instead of assuming two microtasks are enough.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.api.getRuntimeStatus().lastAction,"YU28_G28_2_PINNED");
  assert.match(note.textContent,/선택 대상 고정 확인/);
});

test("G28-2: 오래된 Hover 카드의 클릭은 전송하지 않음",()=>{
  const calls=[];
  const f=makeFixture({sendMessage:req=>{calls.push(req);return Promise.resolve(null);}});
  const anchor=f.anchor();
  f.emit(videoState(VIDEO_A,1,anchor));
  const stale=f.findClass("more");
  f.emit(videoState(VIDEO_B,2,anchor));
  stale.fire("click",{isTrusted:true});
  assert.equal(calls.length,0);
  assert.equal(f.api.getRuntimeStatus().lastAction,null);
});

test("G28-2: 저장 실패 응답을 선택 성공으로 표시하지 않음",async()=>{
  const f=makeFixture({sendMessage:req=>Promise.resolve({
    type:"YUTOPIA_YU28_PIN_RESULT_V1",version:1,
    requestId:req.requestId,targetType:req.targetType,targetId:req.targetId,
    targetKey:req.targetType+":"+req.targetId,tabId:17,ok:false,status:"PIN_FAILED",pinned:false,
  })});
  f.emit(channelState(3,f.anchor()));
  f.findClass("more").fire("click",{isTrusted:true});
  // Node vm cross-context Promise reactions may run on a later event-loop turn.
  // Await a macrotask boundary instead of assuming two microtasks are enough.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.api.getRuntimeStatus().lastAction,"YU28_G28_2_PIN_FAILED");
  assert.match(f.findClass("more-status").textContent,/실패/);
});

test("더보기는 오래된 requestId를 받아들이지 않음",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  const old=f.findClass("more");
  f.emit(videoState(VIDEO_B,2,a));
  old.fire("click");
  assert.equal(f.api.getRuntimeStatus().lastAction,null);
});

test("닫기 버튼도 disabled이며 Escape만 controller 종료를 담당",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const close=f.findClass("close");assert.equal(close.disabled,true);close.fire("click");
  assert.equal(f.dismissReason,null);assert.ok(f.host());
});

test("카드 surface는 overlay 점유 이벤트를 만들지 않음",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const surface=f.surface();
  surface.fire("pointerenter");surface.fire("pointerleave");
  surface.fire("focusin");surface.fire("focusout");
  assert.deepEqual(f.overlayCalls,{overlayEnters:0,overlayLeaves:0,focusEnters:0,focusLeaves:0});
});

test("포커스가 같은 카드 내부로 이동하면 overlayFocusOut 미전달",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const button=f.findClass("more");
  f.surface().fire("focusout",{relatedTarget:button});
  assert.equal(f.overlayCalls.focusLeaves,0);
});

test("Shadow Card만 pointer 이벤트를 받으며 뒤쪽 썸네일은 차단",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  assert.equal(f.host().style.pointerEvents,"none");
  assert.equal(f.surface().style.pointerEvents,"none");
  assert.match(cardSource,/\.card \{ pointer-events: auto;/);
  assert.equal(f.cardRegion?.card,f.findClass("card"));
  assert.equal(f.findClass("close").disabled,true);
  assert.equal(f.findClass("more").disabled,true);
});

test("배치는 다른 썸네일을 조회하지 않고 click-through 우측을 우선",()=>{
  const f=makeFixture();
  const target=f.anchor({left:50,top:80,right:200,bottom:160,width:150,height:80});
  const neighbor=f.anchor({left:220,top:75,right:430,bottom:175,width:210,height:100});
  f.doc.querySelectorAll=()=>[target,neighbor];
  f.emit(videoState(VIDEO_A,1,target));
  assert.equal(parseFloat(f.host().style.top),80);
  assert.equal(parseFloat(f.host().style.left),212);
  assert.equal(f.host().dataset.layout,"right");
  assert.ok(f.api.getRuntimeStatus().visible);
});

test("높은 카드도 pointer input을 막지 않고 viewport 높이로 제한",()=>{
  const f=makeFixture({vw:1000,vh:740,cardHeight:540});
  const target=f.anchor({left:22,top:137,right:212,bottom:247,width:190,height:110});
  const neighbor=f.anchor({left:262,top:137,right:452,bottom:247,width:190,height:110});
  f.doc.querySelectorAll=()=>[target,neighbor];
  f.emit(videoState(VIDEO_A,1,target));
  const host=f.host();
  assert.ok(host);
  assert.equal(parseFloat(host.style.top),137);
  assert.equal(parseFloat(host.style.left),224);
  assert.equal(host.style.pointerEvents,"none");
  const subtree=f.surface().childNodes[0];
  assert.ok(parseFloat(subtree.style.maxHeight)<=724);
  f.findClass("more").fire("click");
  assert.equal(parseFloat(host.style.top),137);
  assert.ok(parseFloat(subtree.style.maxHeight)<=724);
});

test("안전한 배치가 없어도 유효한 Hover 카드는 click-through fallback으로 유지",()=>{
  const f=makeFixture({vw:720,vh:400,cardHeight:350});
  const target=f.anchor({left:230,top:150,right:430,bottom:240,width:200,height:90});
  const left=f.anchor({left:0,top:0,right:230,bottom:400,width:230,height:400});
  const right=f.anchor({left:430,top:0,right:720,bottom:400,width:290,height:400});
  const below=f.anchor({left:300,top:260,right:490,bottom:390,width:190,height:130});
  f.doc.querySelectorAll=()=>[target,left,right,below];
  f.emit(videoState(VIDEO_A,1,target));
  assert.ok(f.host()!==null);
  assert.ok(["right","left","below","above","viewport-fallback"].includes(f.host().dataset.layout));
  assert.equal(f.host().style.visibility,"visible");
  assert.equal(f.host().style.pointerEvents,"none");
  assert.equal(f.dismissReason,null);
  assert.equal(f.api.getRuntimeStatus().lastRenderReason,"VISIBLE");
});

test("앵커 우측 여백이 충분하면 카드가 오른쪽에 위치",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor({left:50,top:80,right:200,bottom:160,width:150,height:80})));
  assert.equal(parseFloat(f.host().style.left),212);
});

test("오른쪽 가장자리에서는 카드가 왼쪽에 배치",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor({left:850,top:80,right:1120,bottom:160,width:270,height:80})));
  assert.equal(parseFloat(f.host().style.left),494);
});

test("좁은 화면에서 카드 위치·너비는 화면 안쪽으로 클램프",()=>{
  const f=makeFixture({vw:310,vh:400});
  f.emit(videoState(VIDEO_A,1,f.anchor({left:150,top:210,right:280,bottom:260,width:130,height:50})));
  const host=f.host();
  assert.ok(parseFloat(host.style.left)>=8);
  assert.ok(parseFloat(host.style.left)+parseFloat(host.style.width)<=302);
  assert.ok(parseFloat(host.style.top)>=8);
  assert.ok(parseFloat(host.style.top)<=392);
});

test("뷰포트 위/아래로 벗어난 anchor는 과거 카드를 유지하지 않음",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor({left:200,top:900,right:300,bottom:960,width:100,height:60})));
  assert.equal(f.host(),null);
  assert.equal(f.dismissReason,null);
  assert.equal(f.api.getRuntimeStatus().lastRenderReason,"ANCHOR_NOT_VISIBLE");
});

test("DOM에서 떨어진 앵커는 view만 제거하고 controller 이유와 분리",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  a.parentNode=null;
  f.win.fire("scroll");
  assert.equal(f.host(),null);
  assert.equal(f.dismissReason,null);
  assert.equal(f.api.getRuntimeStatus().lastRenderReason,"ANCHOR_DETACHED");
});

test("스크롤과 리사이즈 시 현재 대상 위치를 다시 계산",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  const initial=parseFloat(f.host().style.left);
  a.rect={left:500,top:140,right:670,bottom:240,width:170,height:100};
  f.win.fire("scroll");
  assert.notEqual(parseFloat(f.host().style.left),initial);
  assert.equal(parseFloat(f.host().style.left),682);
});

test("YouTube 다크 테마이면 Shadow Host에도 다크 테마 지정",()=>{
  const f=makeFixture({dark:true});
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  assert.equal(f.host().dataset.theme,"dark");
});

test("모든 카드 DOM 텍스트는 textContent 기반으로 생성하고 innerHTML 할당 없음",()=>{
  assert.doesNotMatch(cardSource,/\.innerHTML\s*=/);
  assert.doesNotMatch(cardSource,/eval\s*\(/);
  assert.doesNotMatch(cardSource,/fetch\s*\(/);
});

test("재주입해도 동일 API 및 같은 UI Root 유지",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const original=f.api,host=f.host();
  f.rerun();
  assert.equal(f.api,original);
  assert.equal(f.host(),host);
  assert.equal(f.subscribers,1);
});

test("dispose 호출은 Host·스크롤/resize/pagehide 리스너 및 구독을 해제",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const old=f.api;
  old.dispose();old.dispose();
  assert.equal(f.host(),null);
  assert.equal(f.subscribers,0);
  assert.equal(f.unsubscribes,1);
  assert.equal(f.win.count("scroll"),0);
  assert.equal(f.win.count("resize"),0);
  assert.equal(f.win.count("pagehide"),0);
  assert.equal(old.getRuntimeStatus().disposed,true);
  assert.equal(f.ctx.YUTOPIA_HOVER_CARD,undefined);
});

test("pagehide 시 Host가 정리되며 API도 해제",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  f.win.fire("pagehide");
  assert.equal(f.host(),null);
  assert.equal(f.ctx.YUTOPIA_HOVER_CARD,undefined);
});


function makeSummaryStub() {
  let current = null;
  const listeners = new Set();
  const jobScopes = new Map();
  const qaReadySummary = makeQaWireReadySummary();

  return {
    getView(state) {
      if (
        current &&
        current.requestId === state?.requestId &&
        current.targetType === state?.targetType &&
        current.targetId === state?.targetId
      ) {
        return current;
      }
      return { kind: "LOADING" };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    publish(view) {
      current = view;
      for (const listener of [...listeners]) {
        listener(view);
      }
    },

    listenerCount() {
      return listeners.size;
    },
  };
}

function readySummaryView(requestId = 1) {
  return {
    kind: "SNAPSHOT",
    requestId,
    targetType: "VIDEO",
    targetId: VIDEO_A,

    summary: {
      status: "READY",
      valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC",

      target: {
        source: "YOUTUBE",
        targetType: "VIDEO",
        targetId: VIDEO_A,
      },

      provenance: {
        sourceType: "STATIC_FIXTURE",
        isSynthetic: true,
        visibility: "PUBLIC_REUSABLE",
        tenantId: null,
      },

      sentimentPercent: {
        denominator: 80,
        positivePercent: 62.5,
        neutralPercent: 25,
        negativePercent: 12.5,
      },

      topTopics: [
        { topicId: "RECIPE", mentionCount: 38 },
        { topicId: "PRICE", mentionCount: 22 },
      ],

      observationScope: {
        mode: "ONE_VIDEO",
        windowStart: "2026-10-01T00:00:00+09:00",
        windowEnd: "2026-10-08T00:00:00+09:00",
      },

      analyzedAt: "2026-10-08T09:20:00+09:00",
    },
  };
}

test("합성 READY 도착 시 카드 Root를 유지한 채 수치를 표시한다", () => {
  const summary = makeSummaryStub();
  const f = makeFixture({ summaryClient: summary });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));

  const originalCard = f.cardRegion.card;

  assert.equal(f.findClass("bar"), null);

  summary.publish(readySummaryView());

  assert.equal(f.cardRegion.card, originalCard);
  assert.equal(f.findClass("bar")?.getAttribute("role"), "img");
  assert.match(f.cardText(), /긍정 62.5%/);
  assert.match(f.cardText(), /중립 25%/);
  assert.match(f.cardText(), /부정 12.5%/);
  assert.match(f.cardText(), /분모: 80건/);
  assert.match(f.cardText(), /RECIPE · 언급 38건/);
  assert.match(f.cardText(), /STATIC_FIXTURE/);
  assert.equal(f.api.getRuntimeStatus().summaryKind, "SNAPSHOT");
});

test("NOT_FOUND는 감성 차트와 이전 수치를 제거한다", () => {
  const summary = makeSummaryStub();
  const f = makeFixture({ summaryClient: summary });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  summary.publish(readySummaryView());

  assert.ok(f.findClass("bar"));

  summary.publish({
    kind: "NOT_FOUND",
    requestId: 1,
    targetType: "VIDEO",
    targetId: VIDEO_A,
  });

  assert.equal(f.findClass("bar"), null);
  assert.doesNotMatch(f.cardText(), /62.5%/);
  assert.match(f.cardText(), /합성 스냅샷이 없습니다/);
  assert.equal(f.api.getRuntimeStatus().summaryKind, "NOT_FOUND");
});

test("이전 A의 늦은 갱신은 현재 B 카드에 적용하지 않는다", () => {
  const summary = makeSummaryStub();
  const f = makeFixture({ summaryClient: summary });
  const a = f.anchor();

  f.emit(videoState(VIDEO_A, 1, a));
  f.emit(videoState(VIDEO_B, 2, a));

  summary.publish(readySummaryView(1));

  assert.equal(f.api.getRuntimeStatus().targetId, VIDEO_B);
  assert.match(f.cardText(), new RegExp(VIDEO_B));
  assert.doesNotMatch(f.cardText(), /62.5%/);
  assert.equal(f.findClass("bar"), null);

  f.api.dispose();
  assert.equal(summary.listenerCount(), 0);
});

/*
 * 19단계 — 상태별 비노출·출처 검증·진단 상태 회귀.
 * 기존 makeFixture, makeSummaryStub, readySummaryView를 사용한다.
 */

const NO_METRIC_STATUSES = [
  "PARTIAL",
  "STALE",
  "NO_DATA",
  "COMMENTS_DISABLED",
  "ENTITLEMENT_LIMITED",
  "POLICY_BLOCKED",
  "ERROR",
];

for (const status of NO_METRIC_STATUSES) {
  test(`${status} 상태에서는 미검증 감성 비율을 표시하지 않는다`, () => {
    const summary = makeSummaryStub();
    const f = makeFixture({ summaryClient: summary });

    f.emit(videoState(VIDEO_A, 1, f.anchor()));
    summary.publish(readySummaryView());

    const originalRoot = f.cardRegion.card;
    assert.ok(f.findClass("bar"));

    const view = readySummaryView();
    view.summary.status = status;

    // STALE은 잘못된 숫자가 Client 검증을 우회했다고 가정한다.
    // 렌더러에서도 차단되어야 한다.
    if (status !== "STALE") {
      view.summary.sentimentPercent = null;
      view.summary.topTopics = [];
    }

    summary.publish(view);

    assert.equal(f.cardRegion.card, originalRoot);
    assert.equal(f.findClass("bar"), null);
    assert.doesNotMatch(f.cardText(), /긍정 62\.5%/);
    assert.match(
      f.cardText(),
      new RegExp("분석 상태: " + status)
    );
    assert.equal(
      f.api.getRuntimeStatus().summaryKind,
      "SNAPSHOT"
    );
  });
}

test("PARTIAL에서 검증된 분모가 존재하면 상태와 수치를 함께 표시한다", () => {
  const summary = makeSummaryStub();
  const f = makeFixture({ summaryClient: summary });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));

  const view = readySummaryView();
  view.summary.status = "PARTIAL";

  summary.publish(view);

  assert.ok(f.findClass("bar"));
  assert.match(f.cardText(), /긍정 62\.5%/);
  assert.match(f.cardText(), /분모: 80건/);
  assert.match(f.cardText(), /분석 상태: PARTIAL/);
});

test("비공개·Tenant 지정·비합성 출처를 카드에서도 거부한다", () => {
  const summary = makeSummaryStub();
  const f = makeFixture({ summaryClient: summary });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  summary.publish(readySummaryView());

  const card = f.cardRegion.card;
  assert.ok(f.findClass("bar"));

  const invalidProvenances = [
    { visibility: "TENANT_PRIVATE" },
    { tenantId: "tenant-123" },
    { isSynthetic: false },
    { sourceType: "LIVE_API" },
  ];

  for (const patch of invalidProvenances) {
    const view = readySummaryView();

    Object.assign(view.summary.provenance, patch);
    summary.publish(view);

    assert.equal(f.cardRegion.card, card);
    assert.equal(f.findClass("bar"), null);
    assert.doesNotMatch(f.cardText(), /62\.5%/);
  }

  summary.publish(readySummaryView());
  assert.ok(f.findClass("bar"));
});

test("잘못된 주제 배열은 렌더링 예외 없이 차단한다", () => {
  const summary = makeSummaryStub();
  const f = makeFixture({ summaryClient: summary });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));

  const malformed = readySummaryView();
  malformed.summary.topTopics = null;

  assert.doesNotThrow(() => summary.publish(malformed));
  assert.equal(f.findClass("bar"), null);

  const negative = readySummaryView();
  negative.summary.topTopics = [
    { topicId: "RECIPE", mentionCount: -1 },
  ];

  assert.doesNotThrow(() => summary.publish(negative));
  assert.equal(f.findClass("bar"), null);

  summary.publish(readySummaryView());
  assert.ok(f.findClass("bar"));
});

test("Hover 종료 후 진단 상태와 카드 영역을 초기화한다", () => {
  const summary = makeSummaryStub();
  const f = makeFixture({ summaryClient: summary });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  summary.publish(readySummaryView());

  assert.equal(
    f.api.getRuntimeStatus().summaryKind,
    "SNAPSHOT"
  );

  f.emit({ phase: "IDLE" });

  assert.equal(f.host(), null);
  assert.equal(f.cardRegion, null);
  assert.equal(
    f.api.getRuntimeStatus().summaryKind,
    "IDLE"
  );
});

/*
 * YU-32 — 실제 합성 캐시 엔진을 사용하는 QA 브리지.
 * 이 브리지는 Node 테스트 환경에만 주입한다.
 * extension/manifest.json에는 등록하지 않는다.
 */

function makeYu32QaBridge() {
  // TTL 테스트에서 시간을 변경하므로 let을 사용한다.
  let clock = Date.parse("2026-10-08T10:00:00Z");

  const simulator = createSimulator({
    mode: "QA_SYNTHETIC",
    now: () => clock,
    budgetUnits: 3,
  });

  const listeners = new Set();

  // YU-32 3단계: Job ID별 분석 범위를 보존한다.
  const jobScopes = new Map();

  // 기존 분석 계약을 통과할 합성 READY Summary
  const qaReadySummary = makeQaWireReadySummary();

  function scopeFor(state) {
    return {
      source: "YOUTUBE",
      targetType: "VIDEO",
      targetId: state.targetId,
      analysisSpecVersion: "mock-0",
      observationWindowId: "20261001-20261008",
      samplingPolicyVersion: "mock-0",
      locale: "ko-KR",
      visibility: "PUBLIC_REUSABLE",
      tenantId: null,
    };
  }

  function notify() {
    for (const listener of [...listeners]) listener();
  }

  return {
    mode: "QA_SYNTHETIC",

    getView(state) {
      return {
        ...simulator.action(scopeFor(state), {
          requestAllowed: true,
        }),
        requestId: state.requestId,
        targetType: state.targetType,
        targetId: state.targetId,
      };
    },

    request(state, options = {}) {
      const analysisScope = scopeFor(state);

      const result = simulator.request(analysisScope, {
        explicitClick: options.explicitClick === true,
        requestAllowed: true,
      });

      // 생성 또는 기존 Job 합류 시 분석 범위 기록
      if (
        typeof result.jobId === "string" &&
        (
          result.kind === "CREATED" ||
          result.kind === "JOINED"
        )
      ) {
        jobScopes.set(result.jobId, analysisScope);
      }

      notify();

      return result;
    },

    startNext() {
      const result = simulator.startNext();
      notify();
      return result;
    },

    // 완료되지 않은 합성 Job 실패를 현재 Hover 카드에 알린다.
    fail(jobId) {
      const result = simulator.fail(jobId);
      notify();
      return result;
    },

    /*
    * 합성 Job 완료:
    * 고정된 READY Fixture가 존재하는 영상에만 완료를 허용한다.
    * 영상 B에 영상 A의 Fixture를 복사해 성공 처리하지 않는다.
    */
    complete(jobId) {
      const analysisScope = jobScopes.get(jobId);

      if (
        !analysisScope ||
        analysisScope.targetType !== "VIDEO" ||
        analysisScope.targetId !== qaReadyRaw.target.targetId ||
        analysisScope.analysisSpecVersion !== qaReadyRaw.analysisVersion ||
        analysisScope.locale !== qaReadyRaw.scope.locale ||
        analysisScope.visibility !== "PUBLIC_REUSABLE" ||
        analysisScope.tenantId !== null
      ) {
        return {
          kind: "REJECTED",
          reason: "QA_FIXTURE_MISMATCH",
        };
      }

      const expected = qaContract.makeRequest(
        analysisScope.targetType,
        analysisScope.targetId,
        1
      );

      const validated = qaContract.makeResponse(expected, {
        kind: "SNAPSHOT",
        summary: qaReadySummary,
      });

      if (validated?.result?.kind !== "SNAPSHOT") {
        return {
          kind: "REJECTED",
          reason: "INVALID_QA_SNAPSHOT",
        };
      }

      const safe = validated.result.summary;

      const completed = simulator.complete(jobId, {
        snapshotId: safe.snapshotId,
        target: {...safe.target},
        status: safe.status,
        sourceType: safe.provenance.sourceType,
        isSynthetic: safe.provenance.isSynthetic,
        visibility: safe.provenance.visibility,
        tenantId: safe.provenance.tenantId,
        analyzedAt: safe.analyzedAt,
        analysisSpecVersion: analysisScope.analysisSpecVersion,
        observationWindowId: analysisScope.observationWindowId,
        samplingPolicyVersion: analysisScope.samplingPolicyVersion,
        locale: analysisScope.locale,
      });

      notify();
      return completed;
    },

    /*
    * 캐시가 FRESH이고 snapshotId가 합성 Fixture와 일치할 때만
    * 기존 Hover Summary wire 응답을 생성한다.
    */
    getCompletedPacket(state) {
      if (
        state?.targetType !== "VIDEO" ||
        state.targetId !== qaReadyRaw.target.targetId
      ) return null;

      const cached = simulator.lookup(scopeFor(state));

      if (
        cached.kind !== "FRESH" ||
        cached.status !== "READY" ||
        cached.snapshotId !== qaReadySummary.snapshotId
      ) return null;

      const expected = qaContract.makeRequest(
        state.targetType,
        state.targetId,
        state.requestId
      );

      if (!expected) return null;

      return qaContract.makeResponse(expected, {
        kind: "SNAPSHOT",
        summary: qaReadySummary,
      });
    },

    /*
    * TTL 및 STALE 전이의 재현 가능한 테스트용 가상 시계.
    */
    advanceTime(milliseconds) {
      if (
        !Number.isSafeInteger(milliseconds) ||
        milliseconds < 0
      ) {
        throw new TypeError("Invalid virtual time increment");
      }

      clock += milliseconds;
      notify();
      return clock;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    stats() {
      return simulator.stats();
    },

    listenerCount() {
      return listeners.size;
    },
  };
}

function publishNotFound(summary, targetId, requestId) {
  summary.publish({
    kind: "NOT_FOUND",
    targetType: "VIDEO",
    targetId,
    requestId,
  });
}

test("YU32: 일반 모드에는 실행 가능한 분석 요청 버튼이 없다", () => {
  const summary = makeSummaryStub();
  const f = makeFixture({summaryClient: summary});

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  assert.equal(f.findClass("yu32-request"), null);
  assert.match(f.cardText(), /분석 요청 기능 준비 중/);
  assert.equal(f.findClass("bar"), null);
});

test("YU32: QA 모드에서도 Hover만으로 Job을 생성하지 않는다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  const button = f.findClass("yu32-request");

  assert.ok(button);
  assert.equal(button.disabled, false);
  assert.equal(qa.stats().createdJobs, 0);
  assert.equal(qa.stats().usedUnits, 0);
});

test("YU32: 신뢰된 명시적 클릭만 합성 Job 하나를 생성한다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  const root = f.cardRegion.card;
  const more = f.findClass("more");
  const button = f.findClass("yu32-request");

  button.fire("click", {isTrusted: false});
  assert.equal(qa.stats().createdJobs, 0);

  button.fire("click", {isTrusted: true});

  assert.equal(qa.stats().createdJobs, 1);
  assert.equal(qa.stats().usedUnits, 1);

  assert.equal(f.cardRegion.card, root);
  assert.equal(f.findClass("more"), more);
  assert.equal(f.findClass("yu32-request"), null);
  assert.match(f.cardText(), /데모 분석 대기 중/);
  assert.equal(f.findClass("bar"), null);
});

test("YU32: 합성 Job 진행 상태가 카드에 반영된다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  f.findClass("yu32-request").fire(
    "click", {isTrusted: true}
  );

  assert.equal(qa.startNext().state, "RUNNING");
  assert.match(f.cardText(), /데모 분석 진행 중/);
  assert.equal(f.findClass("bar"), null);
});

test("YU32: 다른 영상 전환 후 오래된 버튼 클릭은 무시한다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  const anchor = f.anchor();

  f.emit(videoState(VIDEO_A, 1, anchor));
  publishNotFound(summary, VIDEO_A, 1);

  const oldButton = f.findClass("yu32-request");

  f.emit(videoState(VIDEO_B, 2, anchor));
  publishNotFound(summary, VIDEO_B, 2);

  oldButton.fire("click", {isTrusted: true});

  assert.equal(qa.stats().createdJobs, 0);
  assert.equal(f.api.getRuntimeStatus().targetId, VIDEO_B);
  assert.ok(f.findClass("yu32-request"));
});

test("YU32: READY에서는 요청 버튼이 없고 dispose는 QA 구독을 해제한다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  summary.publish(readySummaryView());

  assert.equal(f.findClass("yu32-request"), null);
  assert.equal(qa.stats().createdJobs, 0);
  assert.equal(qa.listenerCount(), 1);

  f.api.dispose();

  assert.equal(qa.listenerCount(), 0);
});


test("YU32: 브리지 예외 후 요청 가능 상태를 다시 평가한다", () => {
  const summary = makeSummaryStub();

  const qa = {
    mode: "QA_SYNTHETIC",

    getView(identity) {
      return {
        ...identity,
        kind: "MISS",
        action: {
          type: "DEMO_REQUEST",
          enabled: true,
        },
      };
    },

    request() {
      throw new Error("Simulated request failure");
    },

    subscribe() {
      return () => {};
    },
  };

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  const original = f.findClass("yu32-request");
  original.fire("click", {isTrusted: true});

  assert.match(
    f.cardText(),
    /데모 분석 요청이 수락되지 않았습니다/
  );

  const retry = f.findClass("yu32-request");

  assert.ok(retry);
  assert.notEqual(retry, original);
  assert.equal(retry.disabled, false);
});

/*
 * YU-32 3단계 — 합성 완료 결과의 계약 검증 및 재사용.
 */

test("YU32-3: Job 완료 후 검증된 합성 Summary를 표시한다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  const originalCard = f.cardRegion.card;
  const more = f.findClass("more");

  f.findClass("yu32-request").fire(
    "click", {isTrusted: true}
  );

  const started = qa.startNext();

  assert.equal(started.kind, "STARTED");
  assert.equal(qa.complete(started.jobId).kind, "SUCCEEDED");

  assert.equal(f.cardRegion.card, originalCard);
  assert.equal(f.findClass("more"), more);
  assert.equal(f.findClass("yu32-request"), null);

  assert.ok(f.findClass("bar"));
  assert.match(f.cardText(), /긍정 62\.5%/);
  assert.match(f.cardText(), /분모: 80건/);
  assert.match(f.cardText(), /STATIC_FIXTURE/);

  assert.equal(
    f.api.getRuntimeStatus().summaryKind,
    "SNAPSHOT"
  );

  assert.equal(qa.stats().createdJobs, 1);
});

test("YU32-3: 동일 영상 재방문 시 기존 Snapshot을 재사용한다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  const anchor = f.anchor();

  f.emit(videoState(VIDEO_A, 1, anchor));
  publishNotFound(summary, VIDEO_A, 1);

  f.findClass("yu32-request").fire(
    "click", {isTrusted: true}
  );

  const started = qa.startNext();
  assert.equal(qa.complete(started.jobId).kind, "SUCCEEDED");

  f.emit({phase: "IDLE"});
  assert.equal(f.host(), null);

  f.emit(videoState(VIDEO_A, 2, anchor));
  publishNotFound(summary, VIDEO_A, 2);

  assert.ok(f.findClass("bar"));
  assert.match(f.cardText(), /긍정 62\.5%/);
  assert.equal(f.findClass("yu32-request"), null);
  assert.equal(qa.stats().createdJobs, 1);
});

test("YU32-3: 다른 영상에는 A의 Snapshot을 연결하지 않는다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_B, 1, f.anchor()));
  publishNotFound(summary, VIDEO_B, 1);

  f.findClass("yu32-request").fire(
    "click", {isTrusted: true}
  );

  const started = qa.startNext();
  const completed = qa.complete(started.jobId);

  assert.equal(completed.kind, "REJECTED");
  assert.equal(completed.reason, "QA_FIXTURE_MISMATCH");
  assert.equal(f.findClass("bar"), null);
  assert.doesNotMatch(f.cardText(), /62\.5%/);
});

test("YU32-3: A 완료 이후에도 현재 Hover B는 변경되지 않는다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  const anchor = f.anchor();

  f.emit(videoState(VIDEO_A, 1, anchor));
  publishNotFound(summary, VIDEO_A, 1);

  f.findClass("yu32-request").fire(
    "click", {isTrusted: true}
  );

  const started = qa.startNext();

  f.emit(videoState(VIDEO_B, 2, anchor));
  publishNotFound(summary, VIDEO_B, 2);

  assert.equal(qa.complete(started.jobId).kind, "SUCCEEDED");

  assert.equal(f.api.getRuntimeStatus().targetId, VIDEO_B);
  assert.equal(f.findClass("bar"), null);
  assert.doesNotMatch(f.cardText(), /긍정 62\.5%/);
});

test("YU32-3: TTL 경과 후에는 합성 수치를 숨긴다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  f.findClass("yu32-request").fire(
    "click", {isTrusted: true}
  );

  const started = qa.startNext();
  assert.equal(qa.complete(started.jobId).kind, "SUCCEEDED");

  assert.ok(f.findClass("bar"));

  qa.advanceTime(48 * 60 * 60 * 1000);

  assert.equal(f.findClass("bar"), null);
  assert.doesNotMatch(f.cardText(), /긍정 62\.5%/);
  assert.match(f.cardText(), /데모 분석 갱신 필요/);
});

test("YU32-3: Worker 거부 결과를 QA 캐시가 덮어쓰지 않는다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();

  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  f.findClass("yu32-request").fire(
    "click", {isTrusted: true}
  );

  const started = qa.startNext();
  assert.equal(qa.complete(started.jobId).kind, "SUCCEEDED");

  assert.ok(f.findClass("bar"));

  summary.publish({
    kind: "REJECTED",
    requestId: 1,
    targetType: "VIDEO",
    targetId: VIDEO_A,
    reason: "SOURCE_ERROR",
  });

  assert.equal(f.findClass("bar"), null);
  assert.equal(
    f.api.getRuntimeStatus().summaryKind,
    "REJECTED"
  );
});

test("YU32-3: 위조된 QA 응답은 기존 계약에서 거부한다", () => {
  const qa = makeYu32QaBridge();

  qa.getCompletedPacket = state => ({
    type: "YUTOPIA_HOVER_SUMMARY_RESULT_V1",
    version: 1,
    requestId: state.requestId,
    targetType: "VIDEO",
    targetId: VIDEO_B,
    targetKey: "VIDEO:" + VIDEO_B,
    result: {
      kind: "SNAPSHOT",
      summary: makeQaWireReadySummary(),
    },
  });

  const summary = makeSummaryStub();
  const f = makeFixture({
    summaryClient: summary,
    qaBridge: qa,
  });

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  assert.equal(f.findClass("bar"), null);
  assert.equal(
    f.api.getRuntimeStatus().summaryKind,
    "NOT_FOUND"
  );
});

test("YU32-AUDIT: STALE 합성 결과에는 명시적 갱신 버튼만 표시한다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();
  const f = makeFixture({summaryClient: summary, qaBridge: qa});

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  f.findClass("yu32-request").fire("click", {isTrusted: true});
  const started = qa.startNext();
  assert.equal(qa.complete(started.jobId).kind, "SUCCEEDED");
  assert.ok(f.findClass("bar"));

  qa.advanceTime(48 * 60 * 60 * 1000);

  assert.equal(f.findClass("bar"), null);
  assert.match(f.cardText(), /데모 분석 갱신 필요/);
  const refresh = f.findClass("yu32-request");
  assert.ok(refresh);
  assert.match(refresh.textContent, /데모 갱신 요청/);
  assert.equal(qa.stats().createdJobs, 1);

  refresh.fire("click", {isTrusted: false});
  assert.equal(qa.stats().createdJobs, 1);

  refresh.fire("click", {isTrusted: true});
  assert.equal(qa.stats().createdJobs, 2);
  assert.equal(f.findClass("yu32-request"), null);
  assert.match(f.cardText(), /데모 분석 대기 중/);
  assert.equal(f.findClass("bar"), null);
});

test("YU32-AUDIT: 실패한 합성 Job은 실패를 표시하고 사용자 재시도만 허용한다", () => {
  const qa = makeYu32QaBridge();
  const summary = makeSummaryStub();
  const f = makeFixture({summaryClient: summary, qaBridge: qa});

  f.emit(videoState(VIDEO_A, 1, f.anchor()));
  publishNotFound(summary, VIDEO_A, 1);

  const root = f.cardRegion.card;
  const more = f.findClass("more");
  f.findClass("yu32-request").fire("click", {isTrusted: true});

  const started = qa.startNext();
  assert.equal(qa.fail(started.jobId).kind, "FAILED");

  assert.equal(f.cardRegion.card, root);
  assert.equal(f.findClass("more"), more);
  assert.equal(f.findClass("bar"), null);
  assert.match(f.cardText(), /데모 분석 작업 실패/);

  const retry = f.findClass("yu32-request");
  assert.ok(retry);
  assert.match(retry.textContent, /재시도/);
  assert.equal(qa.stats().createdJobs, 1);

  retry.fire("click", {isTrusted: false});
  assert.equal(qa.stats().createdJobs, 1);

  retry.fire("click", {isTrusted: true});
  assert.equal(qa.stats().createdJobs, 2);
  assert.match(f.cardText(), /데모 분석 대기 중/);
  assert.equal(f.findClass("bar"), null);

  // 이미 제거된 버튼은 Job을 추가 생성할 수 없다.
  retry.fire("click", {isTrusted: true});
  assert.equal(qa.stats().createdJobs, 2);
});
