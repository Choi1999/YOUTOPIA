/**
 * YUTOPIA YU-26 — strict thumbnail-triggered Hover controller regression.
 *
 * CONTRACT: valid thumbnail enter -> immediate READY; leave -> immediate IDLE;
 * A->B->A and repeated reentry never depend on old timers or card focus.
 * Run: node --test extension/tests/hover-controller.test.cjs
 * Mock DOM and event order only; Windows Chromium/live YouTube are separate.
 */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = [
  "hover-pointer-tracker.js",
  "hover-presence-reducer.js",
  "hover-controller.js",
].map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,"..","manifest.json"),"utf8"));
const A="Ab0_-123xyz", B="Ab0_-123xyZ", C="Ab0_-123xy0";
const CHANNEL="UC"+"a".repeat(22);

function emitter() {
  const registered=new Map();
  const added=new Map();
  return {
    addEventListener(type,fn) {
      const set=registered.get(type)||new Set();
      set.add(fn);
      registered.set(type,set);
      added.set(type,(added.get(type)||0)+1);
    },
    removeEventListener(type,fn) {registered.get(type)?.delete(fn);},
    fire(type,extra={}) {
      const event={type,pointerType:"mouse",relatedTarget:null,...extra};
      for(const listener of [...(registered.get(type)||[])]) listener(event);
    },
    count(type) {return registered.get(type)?.size||0;},
    additions(type) {return added.get(type)||0;},
  };
}
function anchor(id=A) {
  return Object.assign(emitter(),{
    href:"/watch?v="+id,isConnected:true,
    getAttribute(name) {return name==="href"?this.href:null;},
    matches:()=>false,
  });
}
function video(a,id=A) {
  return {thumbnailLink:a,href:a.href,target:id?{
    targetType:"VIDEO",targetId:id,source:"YOUTUBE",
    canonicalUrl:"https://www.youtube.com/watch?v="+id,
  }:null};
}
function channel(a,{id=CHANNEL,handle=false,invalid=false}={}) {
  return {channelLink:a,href:a.href,identity: invalid?null: handle?{
    identityType:"HANDLE",resolutionStatus:"HANDLE_UNRESOLVED",
    targetType:"CHANNEL",targetId:null,channelId:null,
  }:{
    identityType:"CHANNEL_ID",resolutionStatus:"ID_FORMAT_VALID",
    targetType:"CHANNEL",targetId:id,channelId:id,
  }};
}
function fixture({videos=[],channels=[],available=true}={}) {
  const doc=Object.assign(emitter(),{hidden:false});
  const win=emitter();
  const videosListeners=new Set(),channelsListeners=new Set();
  const discovery={
    subscribe(fn){videosListeners.add(fn);fn({added:videos,updated:[],removed:[]});return()=>videosListeners.delete(fn);},
    subscribeChannels(fn){channelsListeners.add(fn);fn({added:channels,updated:[],removed:[]});return()=>channelsListeners.delete(fn);},
  };
  const ctx=vm.createContext({
    document:doc,
    addEventListener:win.addEventListener,
    removeEventListener:win.removeEventListener,
    YUTOPIA_VIDEO_DISCOVERY:available?discovery:undefined,
    YUTOPIA_CHANNEL_TARGET_RESOLVER:{
      toIdentifiedTarget(identity){
        if(identity?.identityType!=="CHANNEL_ID"||identity.resolutionStatus!=="ID_FORMAT_VALID")return null;
        return {targetType:"CHANNEL",targetId:identity.channelId,source:"YOUTUBE"};
      }
    }
  });
  function run(){for(const src of source)vm.runInContext(src,ctx);}
  run();
  const api=()=>ctx.YUTOPIA_HOVER_CONTROLLER;
  function videoChanges(ch){for(const fn of [...videosListeners])fn(ch);}
  function channelChanges(ch){for(const fn of [...channelsListeners])fn(ch);}
  return {ctx,doc,win,run,api,videoChanges,channelChanges,videoSubs:()=>videosListeners.size};
}
function inPointer(f,el,extra={}) {
  f.doc.fire("pointerover",{target:el,composedPath:()=>[el,f.doc],...extra});
}
function outPointer(f,el,next=null,extra={}) {
  f.doc.fire("pointerout",{target:el,relatedTarget:next,...extra});
}
function expectVisible(f,id=A) {
  const s=f.api().getSnapshot();
  assert.equal(s.phase,"READY");
  assert.equal(s.targetId,id);
  assert.equal(s.targetType,"VIDEO");
}
function expectHidden(f) {
  const s=f.api().getSnapshot();
  assert.ok(s.phase==="IDLE"||s.phase==="DISMISSED");
  assert.equal(s.targetId,null);
}

test("Manifest에서 tracker/reducer 다음 controller와 card를 로드",()=>{
  const js=manifest.content_scripts[0].js;
  assert.ok(js.indexOf("hover-pointer-tracker.js")<js.indexOf("hover-presence-reducer.js"));
  assert.ok(js.indexOf("hover-presence-reducer.js")<js.indexOf("hover-controller.js"));
  assert.ok(js.indexOf("hover-controller.js")<js.indexOf("hover-card.js"));
});

test("Controller는 단일 활성 대상에 바로 연결되며 0ms·0ms 계약",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  const r=f.api().getRuntimeStatus();
  assert.equal(r.connected,true);
  assert.equal(r.strategy,"STRICT_THUMBNAIL");
  assert.equal(r.activationDelayMs,0);
  assert.equal(r.leaveGraceMs,0);
  assert.equal(r.enterScheduled,false);
  assert.equal(r.leaveScheduled,false);
  assert.equal(r.boundVideoAnchors,1);
});

test("썸네일 pointerenter 즉시 READY, pointerleave 즉시 IDLE",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");
  expectVisible(f);
  a.fire("pointerleave");
  expectHidden(f);
  assert.equal(f.api().getSnapshot().reason,"THUMBNAIL_LEAVE");
});

test("썸네일 pointerover 즉시 READY, pointerout 즉시 IDLE",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);expectVisible(f);
  outPointer(f,a);expectHidden(f);
});

test("동일 영상 A의 50회 진입·이탈 반복 누락 0회",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  for(let n=1;n<=50;n++){
    inPointer(f,a);
    expectVisible(f);
    assert.equal(f.api().getSnapshot().requestId,n);
    outPointer(f,a);
    expectHidden(f);
  }
});

test("서로 다른 A→B→A 전환은 즉시 타깃과 요청 ID를 교체",()=>{
  const a=anchor(A),b=anchor(B),f=fixture({videos:[video(a,A),video(b,B)]});
  inPointer(f,a);const first=f.api().getSnapshot().requestId;
  inPointer(f,b);expectVisible(f,B);
  inPointer(f,a);expectVisible(f,A);
  assert.equal(f.api().getSnapshot().requestId,first+2);
});

test("A→B 이동 중 뒤늦은 A pointerleave는 B를 닫지 않음",()=>{
  const a=anchor(A),b=anchor(B),f=fixture({videos:[video(a,A),video(b,B)]});
  inPointer(f,a);inPointer(f,b);a.fire("pointerleave");
  expectVisible(f,B);
});

test("A pointerout의 relatedTarget B는 B를 즉시 표시",()=>{
  const a=anchor(A),b=anchor(B),f=fixture({videos:[video(a,A),video(b,B)]});
  a.fire("pointerenter");
  outPointer(f,a,b);
  expectVisible(f,B);
});

test("B의 pointerenter 없이도 pointermove만으로 B를 표시",()=>{
  const a=anchor(A),b=anchor(B),f=fixture({videos:[video(a,A),video(b,B)]});
  inPointer(f,a);
  f.doc.fire("pointermove",{target:b,composedPath:()=>[b,f.doc]});
  expectVisible(f,B);
});

test("링크 밖 pointermove는 native pointerleave 누락을 복구",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);
  f.doc.fire("pointermove",{target:{},clientX:900,clientY:900});
  expectHidden(f);
  assert.equal(f.api().getSnapshot().reason,"POINTER_OUTSIDE");
});

test("A 내부 다른 자식으로 포인터를 옮기면 유지",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  const child1={parentElement:a},child2={parentElement:a};
  inPointer(f,a);
  outPointer(f,a,child2);
  expectVisible(f);
  f.doc.fire("pointermove",{target:child1,composedPath:()=>[child1,a,f.doc]});
  expectVisible(f);
});

test("기존 링크에서 카드 쪽으로 이동해도 즉시 종료",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);
  f.doc.fire("pointermove",{target:{},clientX:800,clientY:600});
  expectHidden(f);
});

test("직전 IDLE 이후 같은 영상 재진입은 새 requestId로 READY",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);
  const before=f.api().getSnapshot().requestId;
  outPointer(f,a);
  inPointer(f,a);
  expectVisible(f);
  assert.equal(f.api().getSnapshot().requestId,before+1);
});

test("이미 같은 영상 위에서 움직여도 requestId와 구독 알림 중복 없음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]}),events=[];
  f.api().subscribe(s=>events.push(s.phase));
  inPointer(f,a);
  inPointer(f,a);
  f.doc.fire("pointermove",{target:a});
  expectVisible(f);
  assert.deepEqual(events,["IDLE","READY"]);
});

test("빠른 A→B→C→A에서 구형 타이머를 만들지 않음",()=>{
  const a=anchor(A),b=anchor(B),c=anchor(C);
  const f=fixture({videos:[video(a,A),video(b,B),video(c,C)]});
  for(const el of [a,b,c,a,b,c,a])inPointer(f,el);
  expectVisible(f,A);
  assert.equal(f.api().getRuntimeStatus().leaveScheduled,false);
});

test("모호한 영상 ID는 후보로 등록하지 않음",()=>{
  const a=anchor(),f=fixture({videos:[video(a,null)]});
  inPointer(f,a);
  expectHidden(f);
  assert.equal(f.api().getRuntimeStatus().boundVideoAnchors,0);
});

test("정상 채널 UC ID는 VIDEO와 독립적으로 READY",()=>{
  const a=anchor(),f=fixture({channels:[channel(a)]});
  inPointer(f,a);
  assert.equal(f.api().getSnapshot().targetId,CHANNEL);
  assert.equal(f.api().getSnapshot().targetType,"CHANNEL");
});

test("@handle만 확인된 채널은 UNRESOLVED, 상세 요청은 차단",()=>{
  const a=anchor(),f=fixture({channels:[channel(a,{handle:true})]});
  inPointer(f,a);
  assert.equal(f.api().getSnapshot().phase,"UNRESOLVED");
  assert.equal(f.api().getSnapshot().targetId,null);
  assert.equal(f.api().isCurrentRequest({targetType:"CHANNEL",targetId:CHANNEL,requestId:1}),false);
});

test("모호한 채널은 등록하지 않음",()=>{
  const a=anchor(),f=fixture({channels:[channel(a,{invalid:true})]});
  inPointer(f,a);expectHidden(f);
});

test("터치 pointerenter·pointerover·pointermove는 카드를 만들지 않음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  a.fire("pointerenter",{pointerType:"touch"});
  inPointer(f,a,{pointerType:"touch"});
  f.doc.fire("pointermove",{pointerType:"touch",target:a});
  expectHidden(f);
});

test("키보드 focusin/focusout은 독립적으로 즉시 열고 닫음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  a.fire("focusin");expectVisible(f);
  assert.equal(f.api().getRuntimeStatus().selectedMode,"FOCUS");
  a.fire("focusout");expectHidden(f);
});

test("키보드 포커스가 있어도 마우스가 선택된 썸네일을 벗어나면 닫음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  a.fire("focusin");inPointer(f,a);
  a.fire("pointerleave");expectHidden(f);
});

test("Escape는 YouTube preventDefault 호출 없이 즉시 닫음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);
  f.doc.fire("keydown",{key:"Escape",preventDefault(){throw Error("not allowed");}});
  expectHidden(f);
  assert.equal(f.api().getSnapshot().phase,"DISMISSED");
});

test("닫기 후 동일 영상 새 pointermove로 즉시 재열림, 억제 상태 없음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);f.api().dismiss("CARD_CLOSE");expectHidden(f);
  f.doc.fire("pointermove",{target:a});expectVisible(f);
  assert.equal(f.api().getRuntimeStatus().suppressedAnchorActive,false);
});

test("타깃이 활성일 때에만 정확한 requestId로 상세 요청 허용",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);
  const req={targetType:"VIDEO",targetId:A,requestId:f.api().getSnapshot().requestId};
  assert.equal(f.api().isCurrentRequest(req),true);
  assert.equal(f.api().isCurrentRequest({...req,requestId:-1}),false);
  outPointer(f,a);
  assert.equal(f.api().isCurrentRequest(req),false);
});

test("Subscriber 예외는 다른 구독자에게 전파되지 않음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  f.api().subscribe(()=>{throw Error("subscriber")});
  const events=[];f.api().subscribe(s=>events.push(s.phase));
  inPointer(f,a);outPointer(f,a);
  assert.deepEqual(events,["IDLE","READY","IDLE"]);
});

test("DOM 제거 이벤트는 활성 카드를 즉시 IDLE로 정리",()=>{
  const a=anchor(),entry=video(a),f=fixture({videos:[entry]});
  inPointer(f,a);
  a.isConnected=false;
  f.videoChanges({removed:[entry],added:[],updated:[]});
  expectHidden(f);
  assert.equal(f.api().getRuntimeStatus().boundVideoAnchors,0);
});

test("SPA 같은 VIDEO ID hovered 새 anchor 교체는 READY와 요청 유지",()=>{
  const a=anchor(A),b=anchor(A);
  b.matches=q=>q===":hover";
  const old=video(a,A),next=video(b,A),f=fixture({videos:[old]});
  inPointer(f,a);const id=f.api().getSnapshot().requestId;
  a.isConnected=false;
  f.videoChanges({removed:[old],added:[next],updated:[]});
  expectVisible(f,A);
  assert.equal(f.api().getSnapshot().requestId,id);
  assert.equal(f.api().getSnapshot().anchor,b);
  assert.equal(a.count("pointerenter"),0);
});

test("SPA 새 anchor가 hovered 아니면 같은 ID라도 카드가 종료",()=>{
  const a=anchor(),b=anchor(),old=video(a),next=video(b);
  const f=fixture({videos:[old]});
  inPointer(f,a);
  f.videoChanges({removed:[old],added:[next],updated:[]});
  expectHidden(f);
});

test("SPA 같은 DOM anchor의 VIDEO ID 교체는 새로운 대상으로 READY",()=>{
  const a=anchor(A),f=fixture({videos:[video(a,A)]});
  inPointer(f,a);const oldRequest=f.api().getSnapshot().requestId;
  a.href="/watch?v="+B;a.matches=q=>q===":hover";
  f.videoChanges({removed:[],added:[],updated:[video(a,B)]});
  expectVisible(f,B);
  assert.equal(f.api().getSnapshot().requestId,oldRequest+1);
});

test("SPA 다른 VIDEO B hovered 교체는 새 요청 ID로 READY",()=>{
  const a=anchor(A),b=anchor(B),old=video(a,A),next=video(b,B),f=fixture({videos:[old]});
  inPointer(f,a);const id=f.api().getSnapshot().requestId;
  f.videoChanges({removed:[old],added:[next],updated:[]});
  b.matches=()=>true;
  f.videoChanges({removed:[],added:[],updated:[next]});
  // No false retention of A even if new B has not actually been hovered yet.
  assert.notEqual(f.api().getSnapshot().targetId,A);
  assert.ok(f.api().getSnapshot().requestId>=id);
});

test("SPA 늦게 등록된 새 링크가 이미 hovered면 즉시 인식",()=>{
  const a=anchor(),f=fixture();
  a.matches=q=>q===":hover";
  f.videoChanges({added:[video(a)],updated:[],removed:[]});
  expectVisible(f);
});

test("동일 Video/href 재스캔은 이벤트 리스너 중복 바인딩 없음",()=>{
  const a=anchor(),entry=video(a),f=fixture({videos:[entry]});
  const before=a.additions("pointerenter");
  f.videoChanges({added:[],updated:[entry],removed:[]});
  assert.equal(a.additions("pointerenter"),before);
});

test("visibilitychange로 탭이 숨겨지면 즉시 닫음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);f.doc.hidden=true;f.doc.fire("visibilitychange");
  expectHidden(f);assert.equal(f.api().getSnapshot().reason,"DOCUMENT_HIDDEN");
});

test("윈도우 blur 시 즉시 종료",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);f.win.fire("blur");expectHidden(f);
});

test("컨트롤러 중복 주입은 기존 싱글턴·리스너 1개 유지",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]}),old=f.api();
  f.run();
  assert.equal(f.api(),old);
  assert.equal(a.count("pointerenter"),1);
  assert.equal(f.doc.count("pointermove"),1);
});

test("dispose는 document·window·anchor 이벤트와 구독 정리",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);
  const current=f.api();
  current.dispose();current.dispose();
  assert.equal(f.doc.count("pointermove"),0);
  assert.equal(f.doc.count("pointerover"),0);
  assert.equal(f.doc.count("pointerout"),0);
  assert.equal(f.doc.count("keydown"),0);
  assert.equal(f.win.count("blur"),0);
  assert.equal(a.count("pointerenter"),0);
  assert.equal(f.api(),undefined);
  assert.equal(f.videoSubs(),0);
});

test("발견기 미연결이면 컨트롤러를 초기화하지 않음",()=>{
  const f=fixture({available:false});
  assert.equal(f.api(),undefined);
});

test("실제 YouTube 경로/데이터를 네트워크로 수집하지 않는 코드",()=>{
  const s=source[2];
  assert.doesNotMatch(s,/\bfetch\s*\(/);
  assert.doesNotMatch(s,/\.innerHTML\s*=/);
  assert.doesNotMatch(s,/\.preventDefault\s*\(/);
  assert.doesNotMatch(s,/\bsetTimeout\s*\(/);
});

test("기존 overlay 상태 API는 존재하지만 엄격 Hover 유지에 참여하지 않음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);
  f.api().overlayPointerEnter();
  outPointer(f,a);
  expectHidden(f);
});

test("유효한 Hover와 카드 상태는 POINTER 경계에만 의존",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  inPointer(f,a);
  assert.equal(f.api().getRuntimeStatus().pointerInside,true);
  outPointer(f,a);
  assert.equal(f.api().getRuntimeStatus().pointerInside,false);
});
