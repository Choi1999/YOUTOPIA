/**
 * YUTOPIA PR #13 — benchmark-inspired, independent Hover primitives.
 *
 * node --test extension/tests/hover-interaction-benchmark.test.cjs
 * Pure pointer hit testing, safe transit geometry and occupancy reducer.
 * No Chrome network, YouTube account, real video data or external UI libraries.
 */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "hover-pointer-tracker.js"), "utf8");
const presenceSource = fs.readFileSync(path.join(__dirname, "..", "hover-presence-reducer.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

function fixture() {
  const scope = vm.createContext({});
  vm.runInContext(source, scope);
  vm.runInContext(presenceSource, scope);
  return {
    scope,
    pointer: scope.YUTOPIA_HOVER_POINTER_TRACKER,
    reducer: scope.YUTOPIA_HOVER_PRESENCE_REDUCER
  };
}
function link(renderer, rect) {
  return {
    isConnected: true,
    parentElement: renderer,
    closest: () => renderer,
    getBoundingClientRect: () => rect,
  };
}
function box(left, top, right, bottom) {
  return {left, top, right, bottom, width:right-left, height:bottom-top};
}
function bind(targetId, element) {
  return {
    element, kind:"VIDEO", target:{targetType:"VIDEO",targetId},
  };
}

test("Manifest: tracker → reducer → controller → model → card",()=>{
  const scripts=manifest.content_scripts[0].js;
  const ix=n=>scripts.indexOf(n);
  assert.ok(ix("content.js") < ix("hover-pointer-tracker.js"));
  assert.ok(ix("hover-pointer-tracker.js") < ix("hover-presence-reducer.js"));
  assert.ok(ix("hover-presence-reducer.js") < ix("hover-controller.js"));
  assert.ok(ix("hover-controller.js") < ix("hover-card-model.js"));
  assert.ok(ix("hover-card-model.js") < ix("hover-card.js"));
});

test("포인터 tracker는 중복 로드 시 같은 API를 유지",()=>{
  const {scope,pointer}=fixture();
  vm.runInContext(source,scope);
  assert.equal(scope.YUTOPIA_HOVER_POINTER_TRACKER,pointer);
});

test("reducer는 중복 로드 시 같은 API를 유지",()=>{
  const {scope,reducer}=fixture();
  vm.runInContext(presenceSource,scope);
  assert.equal(scope.YUTOPIA_HOVER_PRESENCE_REDUCER,reducer);
});

test("composedPath의 등록된 VIDEO anchor를 우선 인식",()=>{
  const {pointer}=fixture(),renderer={};
  const a=link(renderer,box(0,0,100,80));
  const b=bind("Ab0_-123xyz",a);
  const image={parentElement:a};
  assert.equal(pointer.resolve({
    pointerType:"mouse",target:image,composedPath:()=>[image,a,renderer],
  },new Map([[a,b]]),{}),b);
});

test("composedPath가 없을 때 parentElement/parentNode로 링크 인식",()=>{
  const {pointer}=fixture(),renderer={};
  const a=link(renderer,box(0,0,100,80)),b=bind("Ab0_-123xyz",a);
  const wrapper={parentElement:a},img={parentNode:wrapper};
  assert.equal(pointer.resolve({pointerType:"mouse",target:img},new Map([[a,b]]),{}),b);
});

test("SPA에서 분리된 anchor는 오래된 composedPath가 있어도 선택하지 않음",()=>{
  const {pointer}=fixture(),renderer={};
  const a=link(renderer,box(0,0,100,80)),b=bind("Ab0_-123xyz",a);
  a.isConnected=false;
  assert.equal(pointer.resolve({
    pointerType:"mouse",target:a,composedPath:()=>[a,renderer],
  },new Map([[a,b]]),{}),null);
});

test("touch 포인터는 hover target으로 취급하지 않음",()=>{
  const {pointer}=fixture(),renderer={};
  const a=link(renderer,box(0,0,100,80)),b=bind("Ab0_-123xyz",a);
  assert.equal(pointer.resolve({pointerType:"touch",target:a},new Map([[a,b]]),{}),null);
});

test("대상을 모르는 영역이나 이벤트 없음은 null",()=>{
  const {pointer}=fixture();
  assert.equal(pointer.resolve(null,new Map(),{}),null);
  assert.equal(pointer.resolve({target:{}},new Map(),{}),null);
});

test("YouTube 미리보기 Overlay는 같은 렌더러/링크 직사각형에서만 허용",()=>{
  const {pointer}=fixture();
  const renderer={},a=link(renderer,box(10,20,110,100)),b=bind("Ab0_-123xyz",a);
  renderer.querySelectorAll=()=>[a];
  const overlay={closest:()=>renderer};
  const doc={elementFromPoint:()=>overlay};
  assert.equal(pointer.resolve({
    type:"pointermove",pointerType:"mouse",target:overlay,clientX:60,clientY:60,
  },new Map([[a,b]]),doc),b);
});

test("Overlay 포인터가 썸네일 직사각형 밖이면 null",()=>{
  const {pointer}=fixture();
  const renderer={},a=link(renderer,box(10,20,110,100)),b=bind("Ab0_-123xyz",a);
  renderer.querySelectorAll=()=>[a];
  const overlay={closest:()=>renderer},doc={elementFromPoint:()=>overlay};
  assert.equal(pointer.resolve({pointerType:"mouse",target:overlay,clientX:130,clientY:60},new Map([[a,b]]),doc),null);
});

test("다른 영상 렌더러 Overlay는 등록된 영상으로 위장할 수 없음",()=>{
  const {pointer}=fixture();
  const real={},other={};
  const a=link(real,box(10,20,110,100)),b=bind("Ab0_-123xyz",a);
  other.querySelectorAll=()=>[a];
  const overlay={closest:()=>other},doc={elementFromPoint:()=>overlay};
  assert.equal(pointer.resolve({pointerType:"mouse",target:overlay,clientX:40,clientY:60},new Map([[a,b]]),doc),null);
});

test("여러 링크가 같은 좌표에 겹치면 더 좁은 anchor를 선택",()=>{
  const {pointer}=fixture(),renderer={};
  const large=link(renderer,box(0,0,180,130));
  const small=link(renderer,box(20,20,80,70));
  renderer.querySelectorAll=()=>[large,small];
  const event={target:{closest:()=>renderer},clientX:40,clientY:40,pointerType:"mouse"};
  const lookup=new Map([[large,bind("AAAAAAAAAAA",large)],[small,bind("BBBBBBBBBBB",small)]]);
  assert.equal(pointer.resolve(event,lookup,{elementFromPoint:()=>event.target}).target.targetId,"BBBBBBBBBBB");
});

test("렌더러 querySelectorAll이 없을 때도 등록된 Map으로 좁은 후보 확인",()=>{
  const {pointer}=fixture(),renderer={};
  const a=link(renderer,box(10,10,90,100)),b=bind("Ab0_-123xyz",a);
  const over={closest:()=>renderer},doc={elementFromPoint:()=>over};
  assert.equal(pointer.resolve({target:over,pointerType:"mouse",clientX:30,clientY:35},new Map([[a,b]]),doc),b);
});

test("논리 targetKey는 VIDEO/CHANNEL 타입과 ID만으로 결정",()=>{
  const {pointer}=fixture();
  assert.equal(pointer.targetKey({target:{targetType:"VIDEO",targetId:"Ab0_-123xyz"}}),"VIDEO:Ab0_-123xyz");
  assert.equal(pointer.targetKey({target:{targetType:"CHANNEL",targetId:"UC"+"a".repeat(22)}}),"CHANNEL:UC"+"a".repeat(22));
});

test("@handle 미식별 target과 null target은 키가 없음",()=>{
  const {pointer}=fixture();
  assert.equal(pointer.targetKey({target:null,identityStatus:"HANDLE_UNRESOLVED"}),null);
  assert.equal(pointer.targetKey({target:{targetType:"CHANNEL",targetId:null}}),null);
  assert.equal(pointer.targetKey(null),null);
});

test("논리 targetKey는 같은 타깃 다른 DOM anchor에서도 동일",()=>{
  const {pointer}=fixture();
  const left=bind("Ab0_-123xyz",{}),right=bind("Ab0_-123xyz",{});
  assert.equal(pointer.targetKey(left),pointer.targetKey(right));
});

test("contains는 링크 내부 이미지·Shadow host 부모를 인식",()=>{
  const {pointer}=fixture(),root={},image={parentElement:root};
  const shadowNode={host:root};
  assert.equal(pointer.contains(root,image),true);
  assert.equal(pointer.contains(root,shadowNode),true);
  assert.equal(pointer.contains(root,{}),false);
});

test("우측 카드로 향하는 안전 경로의 가운데 지점은 포함",()=>{
  const {pointer}=fixture();
  assert.equal(pointer.safeTransitPoint(box(0,10,100,110),box(130,0,330,160),115,70),true);
});

test("카드와 무관한 화면 영역은 안전 경로가 아님",()=>{
  const {pointer}=fixture();
  assert.equal(pointer.safeTransitPoint(box(0,10,100,110),box(130,0,330,160),115,280),false);
  assert.equal(pointer.safeTransitPoint(box(0,10,100,110),box(130,0,330,160),400,70),false);
});

test("왼쪽/아래쪽 카드 이동 경로의 점도 검사",()=>{
  const {pointer}=fixture();
  assert.equal(pointer.safeTransitPoint(box(130,0,230,100),box(0,0,100,180),115,45),true);
  assert.equal(pointer.safeTransitPoint(box(20,10,120,80),box(0,120,160,280),80,100),true);
});

test("대각 방향 이탈·잘못된 직사각형은 안전 경로로 인정하지 않음",()=>{
  const {pointer}=fixture();
  assert.equal(pointer.safeTransitPoint(box(0,0,90,80),box(110,100,220,180),110,200),false);
  assert.equal(pointer.safeTransitPoint(box(0,0,90,80),{left:NaN,right:50,top:0,bottom:50},100,20),false);
  assert.equal(pointer.safeTransitPoint(null,null,20,20),false);
});

test("presence reducer 초기 상태는 모두 false이며 frozen",()=>{
  const {reducer}=fixture(),p=reducer.initial();
  assert.equal(p.pointerInside,false);
  assert.equal(p.focusInside,false);
  assert.equal(p.overlayPointerInside,false);
  assert.equal(p.overlayFocusInside,false);
  assert.equal(Object.isFrozen(p),true);
});

test("POINTER_ENTER/LEAVE는 유일한 포인터 점유 플래그만 바꿈",()=>{
  const {reducer}=fixture();
  let state=reducer.reduce(reducer.initial(),"POINTER_ENTER");
  assert.equal(state.pointerInside,true);
  assert.equal(state.focusInside,false);
  state=reducer.reduce(state,"POINTER_LEAVE");
  assert.equal(state.pointerInside,false);
});

test("포인터가 없어도 카드 내부 포커스가 남으면 occupied",()=>{
  const {reducer}=fixture();
  let p=reducer.reduce(reducer.initial(),"OVERLAY_FOCUS_ENTER");
  assert.equal(reducer.occupied(p),true);
  p=reducer.reduce(p,"OVERLAY_FOCUS_LEAVE");
  assert.equal(reducer.occupied(p),false);
});

test("포인터/키보드/카드의 4개 occupancy 경로가 독립",()=>{
  const {reducer}=fixture();
  let p=reducer.initial();
  p=reducer.reduce(p,"POINTER_ENTER");
  p=reducer.reduce(p,"FOCUS_ENTER");
  p=reducer.reduce(p,"OVERLAY_POINTER_ENTER");
  p=reducer.reduce(p,"OVERLAY_FOCUS_ENTER");
  assert.equal(reducer.occupied(p),true);
  p=reducer.reduce(p,"POINTER_LEAVE");
  p=reducer.reduce(p,"FOCUS_LEAVE");
  assert.equal(reducer.occupied(p),true);
  p=reducer.reduce(p,"OVERLAY_POINTER_LEAVE");
  assert.equal(reducer.occupied(p),true);
  p=reducer.reduce(p,"OVERLAY_FOCUS_LEAVE");
  assert.equal(reducer.occupied(p),false);
});

test("RESET은 카드·트리거 모든 occupancy 상태를 원자적으로 정리",()=>{
  const {reducer}=fixture();
  const p=reducer.reduce(reducer.reduce(reducer.initial(),"POINTER_ENTER"),"OVERLAY_FOCUS_ENTER");
  assert.equal(reducer.occupied(p),true);
  const clean=reducer.reduce(p,"RESET");
  assert.equal(clean.pointerInside,false);
  assert.equal(clean.overlayFocusInside,false);
  assert.equal(reducer.occupied(clean),false);
});

test("unknown action/중복 enter는 상태를 불필요하게 재생성하지 않음",()=>{
  const {reducer}=fixture();
  const p=reducer.reduce(reducer.initial(),"POINTER_ENTER");
  assert.equal(reducer.reduce(p,"POINTER_ENTER"),p);
  assert.equal(reducer.reduce(p,"NON_EXISTENT"),p);
});

test("presence reducer는 기존 상태 객체를 변경하지 않음",()=>{
  const {reducer}=fixture(),before=reducer.initial();
  const after=reducer.reduce(before,"POINTER_ENTER");
  assert.equal(before.pointerInside,false);
  assert.equal(after.pointerInside,true);
  assert.equal(Object.isFrozen(after),true);
});
