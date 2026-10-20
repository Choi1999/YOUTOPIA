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
const CHANNEL_ID = "UC" + "a".repeat(22);

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
function makeFixture({vw=1200,vh=800,dark=false,cardHeight=260}={}) {
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
  const controller={
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
    setViewport(w,h){ctx.innerWidth=w;ctx.innerHeight=h;},
    rerun(){vm.runInContext(cardSource,ctx);},
  };
}

test("Manifest: model/renderer는 Hover controller 이후 순서로 실행",()=>{
  const list=manifest.content_scripts[0].js;
  assert.equal(list.at(-2),"hover-card-model.js");
  assert.equal(list.at(-1),"hover-card.js");
  assert.equal(list.at(-3),"hover-controller.js");
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

test("READY VIDEO는 Shadow DOM으로 단일 카드와 타깃 ID를 표시",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  assert.equal(f.host()?.isConnected,true);
  assert.ok(f.host().shadowRoot);
  assert.equal(f.api.getRuntimeStatus().hostCount,1);
  assert.equal(f.api.getRuntimeStatus().targetId,VIDEO_A);
  assert.match(f.cardText(),new RegExp(VIDEO_A));
  assert.match(f.cardText(),/DEMO/);
  assert.match(f.cardText(),/실제 YouTube 댓글/);
  assert.equal(f.findClass("bar")?.attributes.get("role"),"img");
});

test("가상 감성 차트에는 긍정/중립/부정 라벨과 비율이 모두 있음",()=>{
  const f=makeFixture();
  f.emit(videoState(VIDEO_A,1,f.anchor()));
  const text=f.cardText();
  assert.match(text,/긍정/);assert.match(text,/중립/);assert.match(text,/부정/);
  assert.match(text,/%/);
  assert.match(text,/가상/);
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

test("READY A 이후 HOVER_PENDING B가 오면 A의 카드 즉시 제거",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  f.emit({...videoState(VIDEO_B,2,a),phase:"HOVER_PENDING"});
  assert.equal(f.host(),null);
});

test("LEAVE_PENDING은 같은 request/anchor의 카드 유지",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  const host=f.host();
  f.emit({...videoState(VIDEO_A,1,a),phase:"LEAVE_PENDING"});
  assert.equal(f.host(),host);
  assert.equal(host.dataset.phase,"LEAVE_PENDING");
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

test("READY CHANNEL은 동일 컴포넌트에서 채널 ID와 가상 선정 범위 표시",()=>{
  const f=makeFixture();
  f.emit(channelState(1,f.anchor()));
  assert.equal(f.api.getRuntimeStatus().targetType,"CHANNEL");
  assert.match(f.cardText(),new RegExp(CHANNEL_ID));
  assert.match(f.cardText(),/선정 영상 8개/);
  assert.match(f.cardText(),/실제 갱신 시각 없음/);
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

test("CTA 더보기는 Side Panel을 열지 않고 후속 연결 안내를 표시",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const button=f.findClass("more");
  assert.ok(button);
  const note=f.findClass("more-status");
  assert.equal(note.hidden,true);
  button.fire("click");
  assert.equal(note.hidden,false);
  assert.match(note.textContent,/27~28번/);
  assert.equal(f.api.getRuntimeStatus().lastAction,"MORE_INFO");
});

test("더보기는 오래된 requestId를 받아들이지 않음",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  const old=f.findClass("more");
  f.emit(videoState(VIDEO_B,2,a));
  old.fire("click");
  assert.equal(f.api.getRuntimeStatus().lastAction,null);
});

test("닫기 버튼은 컨트롤러의 dismiss를 호출하고 카드 닫힘",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  f.findClass("close").fire("click");
  assert.equal(f.dismissReason,"CARD_CLOSE");
  assert.equal(f.host(),null);
});

test("Overlay 포인터와 키보드 포커스 이벤트는 컨트롤러에 전달",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const surface=f.surface();
  surface.fire("pointerenter");surface.fire("pointerleave");
  surface.fire("focusin");surface.fire("focusout");
  assert.deepEqual(f.overlayCalls,{overlayEnters:1,overlayLeaves:1,focusEnters:1,focusLeaves:1});
});

test("포커스가 같은 카드 내부로 이동하면 overlayFocusOut 미전달",()=>{
  const f=makeFixture();f.emit(videoState(VIDEO_A,1,f.anchor()));
  const button=f.findClass("more");
  f.surface().fire("focusout",{relatedTarget:button});
  assert.equal(f.overlayCalls.focusLeaves,0);
});

test("우측 팝업이 다른 썸네일을 크게 가리면 아래로 배치",()=>{
  const f=makeFixture();
  const target=f.anchor({left:50,top:80,right:200,bottom:160,width:150,height:80});
  const neighbor=f.anchor({left:220,top:75,right:430,bottom:175,width:210,height:100});
  f.doc.querySelectorAll=()=>[target,neighbor];
  f.emit(videoState(VIDEO_A,1,target));
  assert.equal(parseFloat(f.host().style.top),172);
  assert.equal(parseFloat(f.host().style.left),50);
  assert.ok(f.api.getRuntimeStatus().visible);
});

test("브라우저처럼 높은 카드가 B 썸네일을 가리면 높이 제한 후 아래로 이동",()=>{
  const f=makeFixture({vw:1000,vh:740,cardHeight:540});
  const target=f.anchor({left:22,top:137,right:212,bottom:247,width:190,height:110});
  const neighbor=f.anchor({left:262,top:137,right:452,bottom:247,width:190,height:110});
  f.doc.querySelectorAll=()=>[target,neighbor];
  f.emit(videoState(VIDEO_A,1,target));
  const host=f.host();
  assert.ok(host);
  assert.equal(parseFloat(host.style.top),259);
  assert.equal(parseFloat(host.style.left),22);
  assert.equal(host.style.pointerEvents,"none");
  const subtree=f.surface().childNodes[0];
  assert.ok(parseFloat(subtree.style.maxHeight)<=473);
  assert.equal(host.getBoundingClientRect().bottom<=732,true);
  const hoverCenterX=(neighbor.rect.left+neighbor.rect.right)/2;
  const hoverCenterY=(neighbor.rect.top+neighbor.rect.bottom)/2;
  const rect=host.getBoundingClientRect();
  assert.equal(hoverCenterX>rect.left && hoverCenterX<rect.right &&
    hoverCenterY>rect.top && hoverCenterY<rect.bottom,false);
  f.findClass("more").fire("click");
  assert.equal(parseFloat(host.style.top),259);
  assert.ok(parseFloat(subtree.style.maxHeight)<=473);
});

test("모든 안전 위치가 막히면 YouTube 클릭을 가로채지 않고 카드를 취소",()=>{
  const f=makeFixture({vw:720,vh:400,cardHeight:350});
  const target=f.anchor({left:230,top:150,right:430,bottom:240,width:200,height:90});
  const left=f.anchor({left:0,top:0,right:230,bottom:400,width:230,height:400});
  const right=f.anchor({left:430,top:0,right:720,bottom:400,width:290,height:400});
  f.doc.querySelectorAll=()=>[target,left,right];
  f.emit(videoState(VIDEO_A,1,target));
  assert.equal(f.host(),null);
  assert.equal(f.dismissReason,"NO_SAFE_HOVER_PLACEMENT");
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
  assert.equal(f.dismissReason,"ANCHOR_NOT_VISIBLE");
});

test("DOM에서 떨어진 앵커는 카드 제거와 dismiss 유발",()=>{
  const f=makeFixture(),a=f.anchor();
  f.emit(videoState(VIDEO_A,1,a));
  a.parentNode=null;
  f.win.fire("scroll");
  assert.equal(f.host(),null);
  assert.equal(f.dismissReason,"ANCHOR_DETACHED");
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
