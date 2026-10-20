/**
 * YUTOPIA 작업 25 — Hover 상태·동시성·포인터/키보드·DOM 해제 Fixture.
 *
 * 실행: node --test extension/tests/hover-controller.test.cjs
 * 진입/이탈 지연은 가상 시계로 검증. 실제 Chrome Hover 카드 UI 검증은 별도.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const hoverSource = fs.readFileSync(path.join(__dirname, "..", "hover-controller.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
const VIDEO_A = "Ab0_-123xyz";
const VIDEO_B = "Ab0_-123xyZ";
const VIDEO_C = "Ab0_-123xy0";
const CHANNEL_A = "UC" + "a".repeat(22);

function eventTarget() {
  const map = new Map();
  const added = new Map();
  const removed = new Map();
  return {
    addEventListener(type, fn) {
      const set = map.get(type) || new Set();
      set.add(fn);map.set(type,set);
      added.set(type,(added.get(type)||0)+1);
    },
    removeEventListener(type, fn) {
      map.get(type)?.delete(fn);
      removed.set(type,(removed.get(type)||0)+1);
    },
    fire(type, extra={}) {
      for(const fn of [...(map.get(type)||[])])fn({type,...extra});
    },
    count(type) {return map.get(type)?.size||0;},
    adds(type) {return added.get(type)||0;},
    removes(type) {return removed.get(type)||0;},
  };
}

function anchor(href) {
  return Object.assign(eventTarget(),{
    href,
    getAttribute(name) {return name==="href" ? this.href : null;},
  });
}

function video(element, id=VIDEO_A) {
  return {
    thumbnailLink:element,
    href:element.href,
    target:id ? Object.freeze({
      targetType:"VIDEO",
      targetId:id,
      source:"YOUTUBE",
      canonicalUrl:"https://www.youtube.com/watch?v="+id,
    }) : null,
  };
}

function channel(element, {id=CHANNEL_A, handle=null, ambiguous=false}={}) {
  const identity=ambiguous ? null : handle ? {
    targetType:"CHANNEL",
    identityType:"HANDLE",
    resolutionStatus:"HANDLE_UNRESOLVED",
    channelId:null,
    targetId:null,
    handle,
  } : {
    targetType:"CHANNEL",
    identityType:"CHANNEL_ID",
    resolutionStatus:"ID_FORMAT_VALID",
    channelId:id,
    targetId:id,
    handle:null,
  };
  return {channelLink:element,href:element.href,identity};
}

function fixture({videos=[],channels=[],withDiscovery=true,withTimers=true}={}) {
  const doc=Object.assign(eventTarget(),{hidden:false});
  const win=eventTarget();
  const timers=new Map();
  let clock=0, timerId=0;
  const videoHandlers=new Set(),channelHandlers=new Set();
  let videoUnsubscribed=0,channelUnsubscribed=0;
  const discovery={
    subscribe(fn) {
      videoHandlers.add(fn);
      fn({added:videos,removed:[],updated:[]});
      return ()=>{videoHandlers.delete(fn);videoUnsubscribed+=1;};
    },
    subscribeChannels(fn) {
      channelHandlers.add(fn);
      fn({added:channels,removed:[],updated:[]});
      return ()=>{channelHandlers.delete(fn);channelUnsubscribed+=1;};
    },
  };
  const contextValues={
    document:doc,
    addEventListener:win.addEventListener,
    removeEventListener:win.removeEventListener,
    YUTOPIA_CHANNEL_TARGET_RESOLVER:{
      toIdentifiedTarget(identity) {
        if(identity?.identityType!=="CHANNEL_ID" || identity.resolutionStatus!=="ID_FORMAT_VALID")return null;
        return {targetType:"CHANNEL",targetId:identity.channelId,source:"YOUTUBE"};
      },
    },
  };
  if(withDiscovery)contextValues.YUTOPIA_VIDEO_DISCOVERY=discovery;
  if(withTimers) {
    contextValues.setTimeout=(fn,delay)=>{
      const id=++timerId;
      timers.set(id,{fn,at:clock+delay,delay});
      return id;
    };
    contextValues.clearTimeout=id=>{timers.delete(id);};
  }
  const ctx=vm.createContext(contextValues);
  const run=()=>vm.runInContext(hoverSource,ctx,{filename:"hover-controller.js"});
  run();
  function advance(ms) {
    const until=clock+ms;
    for(let attempt=0;attempt<2000;attempt++) {
      const due=[...timers.entries()].filter(([,item])=>item.at<=until)
        .sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!due)break;
      clock=due[1].at;
      timers.delete(due[0]);
      due[1].fn();
      if(attempt===1999)throw Error("unbounded timer loop");
    }
    clock=until;
  }
  return {
    ctx,doc,win,run,advance,timers,
    api:()=>ctx.YUTOPIA_HOVER_CONTROLLER,
    videoChanges(change){for(const fn of videoHandlers)fn(change);},
    channelChanges(change){for(const fn of channelHandlers)fn(change);},
    sourceCounts(){return{video:videoHandlers.size,channel:channelHandlers.size,videoUnsubscribed,channelUnsubscribed};},
  };
}

test("Manifest는 discovery 다음 Hover Controller, 이후 26번 Card를 순서대로 로드",()=>{
  const scripts=manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf("content.js")<scripts.indexOf("hover-controller.js"));
  assert.ok(scripts.indexOf("hover-controller.js")<scripts.indexOf("hover-card-model.js"));
  assert.ok(scripts.indexOf("hover-card-model.js")<scripts.indexOf("hover-card.js"));
});

test("초기 VIDEO·CHANNEL 후보 리스너를 별도로 1회 등록",()=>{
  const a=anchor("/watch?v="+VIDEO_A),b=anchor("/channel/"+CHANNEL_A);
  const f=fixture({videos:[video(a)],channels:[channel(b)]});
  assert.equal(f.api().getRuntimeStatus().connected,true);
  assert.equal(f.api().getRuntimeStatus().boundVideoAnchors,1);
  assert.equal(f.api().getRuntimeStatus().boundChannelAnchors,1);
  assert.equal(a.count("pointerenter"),1);
  assert.equal(b.count("focusin"),1);
});

test("Hover 159ms는 HOVER_PENDING, 160ms 이후 READY",()=>{
  const a=anchor("/watch?v="+VIDEO_A),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  assert.equal(f.api().getRuntimeStatus().enterScheduled,true);
  f.advance(159);assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  f.advance(1);assert.equal(f.api().getSnapshot().phase,"READY");
  assert.equal(f.api().getSnapshot().targetId,VIDEO_A);
});

test("100ms만 머물고 떠나면 READY로 전이하지 않음",()=>{
  const a=anchor("/watch?v="+VIDEO_A),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(100);a.fire("pointerleave");
  assert.equal(f.api().getSnapshot().phase,"IDLE");
  f.advance(600);
  assert.equal(f.api().getSnapshot().phase,"IDLE");
  assert.equal(f.timers.size,0);
});

test("Pointermove만 전달된 늦게 바인딩된 영상도 160ms 대기 후 활성화",()=>{
  const a=anchor("/watch?v="+VIDEO_A),f=fixture({videos:[video(a)]});
  f.doc.fire("pointermove",{target:a,pointerType:"mouse"});
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  assert.equal(f.api().getSnapshot().reason,"POINTER_MOVE_RECOVERY");
  assert.equal(f.api().getRuntimeStatus().activationDelayMs,160);
  assert.equal(f.api().getRuntimeStatus().pointerRecoveries,1);
  f.advance(160);
  assert.equal(f.api().getSnapshot().phase,"READY");
  assert.equal(f.api().getSnapshot().targetId,VIDEO_A);
});

test("실제 자식 이미지의 composedPath로 원래 앵커를 복구",()=>{
  const a=anchor("video"),child={parentElement:a},f=fixture({videos:[video(a)]});
  f.doc.fire("pointermove",{target:child,pointerType:"mouse",
    composedPath:()=>[child,a,f.doc]});
  assert.equal(f.api().getSnapshot().reason,"POINTER_MOVE_RECOVERY");
  f.advance(160);
  assert.equal(f.api().getSnapshot().targetId,VIDEO_A);
});

test("SPA가 포인터 아래 새로운 링크를 바인딩하면 :hover를 통해 자동 복구",()=>{
  const a=anchor("video");
  a.matches=selector=>selector===":hover";
  const f=fixture();
  f.videoChanges({added:[video(a)],removed:[],updated:[]});
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  assert.equal(f.api().getSnapshot().reason,"DOM_HOVER_RECOVERY");
  f.advance(160);
  assert.equal(f.api().getSnapshot().targetId,VIDEO_A);
});

test("터치 Pointermove나 후보가 없는 영역에서는 Hover가 자동으로 시작되지 않음",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  f.doc.fire("pointermove",{target:a,pointerType:"touch"});
  f.doc.fire("pointermove",{target:{},pointerType:"mouse"});
  assert.equal(f.api().getSnapshot().phase,"IDLE");
  assert.equal(f.api().getRuntimeStatus().pointerRecoveries,0);
});

test("닫기 후 동일 썸네일에서 움직여도 자동 재오픈하지 않고 재진입은 허용",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(160);
  f.api().dismiss("CARD_CLOSE");
  f.doc.fire("pointermove",{target:a,pointerType:"mouse"});
  assert.equal(f.api().getSnapshot().phase,"DISMISSED");
  f.doc.fire("pointermove",{target:{},pointerType:"mouse"});
  a.fire("pointerenter");
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  f.advance(160);
  assert.equal(f.api().getSnapshot().phase,"READY");
});

test("진입 전에 이탈한 원인은 IDLE 상태에서도 진단 가능",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(50);a.fire("pointerleave");
  assert.equal(f.api().getSnapshot().phase,"IDLE");
  assert.equal(f.api().getRuntimeStatus().lastReason,"LEFT_BEFORE_DELAY");
});

test("같은 영상 A를 완전히 떠났다가 반복 재진입하면 매번 160ms 후 READY",()=>{
  const a=anchor("A"),f=fixture({videos:[video(a)]});
  for(let cycle=0;cycle<3;cycle++){
    f.doc.fire("pointerover",{target:a,pointerType:"mouse"});
    assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
    f.advance(159);assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
    f.advance(1);assert.equal(f.api().getSnapshot().phase,"READY");
    f.doc.fire("pointerout",{target:a,relatedTarget:{},pointerType:"mouse"});
    assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
    f.advance(200);assert.equal(f.api().getSnapshot().phase,"IDLE");
  }
  assert.equal(f.api().getSnapshot().requestId,3);
  assert.equal(f.timers.size,0);
});

test("명시적 닫기 후 링크의 실제 pointerleave는 suppression을 해제",()=>{
  const a=anchor("A"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(160);
  f.api().dismiss("CARD_CLOSE");
  assert.equal(f.api().getRuntimeStatus().suppressedAnchorActive,true);
  a.fire("pointerleave");
  assert.equal(f.api().getRuntimeStatus().suppressedAnchorActive,false);
  f.doc.fire("pointermove",{target:a,pointerType:"mouse"});
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  f.advance(160);
  assert.equal(f.api().getSnapshot().phase,"READY");
});

test("명시적 닫기 후 anchor pointerleave가 누락돼도 문서 pointerout으로 해제",()=>{
  const a=anchor("A"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(160);f.api().dismiss("CARD_CLOSE");
  f.doc.fire("pointerout",{target:a,relatedTarget:{},pointerType:"mouse"});
  assert.equal(f.api().getRuntimeStatus().suppressedAnchorActive,false);
  f.doc.fire("pointerover",{target:a,pointerType:"mouse"});
  f.advance(160);
  assert.equal(f.api().getSnapshot().phase,"READY");
});

test("명시적 닫기 후 링크 내부 이동만으로는 카드가 바로 재열리지 않음",()=>{
  const a=anchor("A"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(160);f.api().dismiss("ESCAPE");
  f.doc.fire("pointerover",{target:a,pointerType:"mouse"});
  f.doc.fire("pointermove",{target:a,pointerType:"mouse"});
  f.advance(500);
  assert.equal(f.api().getSnapshot().phase,"DISMISSED");
  assert.equal(f.api().getRuntimeStatus().suppressedAnchorActive,true);
});

test("anchor 내부 자식 간 pointerout은 전체 썸네일 이탈로 취급하지 않음",()=>{
  const a=anchor("A"),one={parentElement:a},two={parentElement:a};
  const f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(160);
  f.doc.fire("pointerout",{target:one,relatedTarget:two,pointerType:"mouse"});
  assert.equal(f.api().getSnapshot().phase,"READY");
  assert.equal(f.api().getRuntimeStatus().pointerInside,true);
});

test("anchor 자식에서 바깥으로 이동한 pointerout은 200ms 후 종료",()=>{
  const a=anchor("A"),child={parentElement:a},f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(160);
  f.doc.fire("pointerout",{target:child,relatedTarget:{},pointerType:"mouse"});
  assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
  f.advance(200);assert.equal(f.api().getSnapshot().phase,"IDLE");
});

test("native pointerleave가 누락되면 문서 pointermove가 이탈을 정리",()=>{
  const a=anchor("A"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(160);
  f.doc.fire("pointermove",{target:{},pointerType:"mouse"});
  assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
  f.advance(200);assert.equal(f.api().getSnapshot().phase,"IDLE");
});

test("카드 Overlay에 포인터가 있으면 anchor의 누락된 이탈을 보정해도 READY 유지",()=>{
  const a=anchor("A"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(160);
  f.api().overlayPointerEnter();
  f.doc.fire("pointermove",{target:{},pointerType:"mouse"});
  assert.equal(f.api().getRuntimeStatus().pointerInside,false);
  f.advance(300);
  assert.equal(f.api().getSnapshot().phase,"READY");
  f.api().overlayPointerLeave();
  f.advance(200);
  assert.equal(f.api().getSnapshot().phase,"IDLE");
});

test("A→B→A 문서 pointerover 전환 시 마지막 요청만 재활성화",()=>{
  const a=anchor("A"),b=anchor("B");
  const f=fixture({videos:[video(a,VIDEO_A),video(b,VIDEO_B)]});
  f.doc.fire("pointerover",{target:a,pointerType:"mouse"});f.advance(160);
  const first=f.api().getSnapshot().requestId;
  f.doc.fire("pointerover",{target:b,pointerType:"mouse"});f.advance(160);
  f.doc.fire("pointerover",{target:a,pointerType:"mouse"});f.advance(160);
  const state=f.api().getSnapshot();
  assert.equal(state.phase,"READY");
  assert.equal(state.targetId,VIDEO_A);
  assert.equal(state.requestId,first+2);
});

test("터치 pointerenter와 pointerover는 Hover 상태를 생성하지 않음",()=>{
  const a=anchor("A"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter",{pointerType:"touch"});
  f.doc.fire("pointerover",{target:a,pointerType:"touch"});
  f.advance(500);
  assert.equal(f.api().getSnapshot().phase,"IDLE");
});

test("같은 영상 렌더러 내 썸네일 미리보기 Overlay의 좌표로만 복구",()=>{
  const a=anchor("A");
  const renderer={};
  const overlay={closest:()=>renderer};
  a.isConnected=true;
  a.closest=()=>renderer;
  a.getBoundingClientRect=()=>({left:40,right:230,top:40,bottom:150,width:190,height:110});
  const f=fixture({videos:[video(a)]});
  f.doc.elementFromPoint=()=>overlay;
  f.doc.fire("pointermove",{target:overlay,clientX:100,clientY:100,pointerType:"mouse"});
  f.advance(160);
  assert.equal(f.api().getSnapshot().targetId,VIDEO_A);
  assert.equal(f.api().getSnapshot().phase,"READY");
  f.doc.fire("pointermove",{target:overlay,clientX:350,clientY:100,pointerType:"mouse"});
  assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
});

test("빠른 A→B→C 진입 시 마지막 C만 READY",()=>{
  const a=anchor("A"),b=anchor("B"),c=anchor("C");
  const f=fixture({videos:[video(a,VIDEO_A),video(b,VIDEO_B),video(c,VIDEO_C)]});
  a.fire("pointerenter");f.advance(100);
  b.fire("pointerenter");f.advance(100);
  c.fire("pointerenter");f.advance(400);
  const s=f.api().getSnapshot();
  assert.equal(s.phase,"READY");assert.equal(s.targetId,VIDEO_C);assert.equal(s.requestId,3);
  assert.equal(f.timers.size,0);
});

test("VIDEO→CHANNEL 빠른 전환은 동시에 두 대상을 활성화하지 않음",()=>{
  const a=anchor("/watch?v="+VIDEO_A),b=anchor("/channel/"+CHANNEL_A);
  const f=fixture({videos:[video(a)],channels:[channel(b)]});
  a.fire("pointerenter");f.advance(400);
  b.fire("pointerenter");
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  assert.equal(f.api().getSnapshot().targetType,"CHANNEL");
  f.advance(400);
  assert.equal(f.api().getSnapshot().targetId,CHANNEL_A);
  assert.equal(f.api().getSnapshot().targetType,"CHANNEL");
});

test("키보드 focusin만으로 HOVER_PENDING→READY 진입",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("focusin");f.advance(400);
  assert.equal(f.api().getSnapshot().phase,"READY");
  assert.equal(f.api().getSnapshot().targetType,"VIDEO");
});

test("마우스가 떠나도 키보드 포커스가 남아 있으면 READY 유지",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");a.fire("focusin");f.advance(400);
  a.fire("pointerleave");f.advance(500);
  assert.equal(f.api().getSnapshot().phase,"READY");
  a.fire("focusout");assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
});

test("READY에서 떠나면 200ms 유예 후 IDLE",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);a.fire("pointerleave");
  assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
  f.advance(199);assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
  f.advance(1);assert.equal(f.api().getSnapshot().phase,"IDLE");
});

test("유예 중 원래 anchor로 돌아오면 READY 복원",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);const previous=f.api().getSnapshot().requestId;
  a.fire("pointerleave");f.advance(100);a.fire("pointerenter");
  assert.equal(f.api().getSnapshot().phase,"READY");
  assert.equal(f.api().getSnapshot().requestId,previous);
  f.advance(250);assert.equal(f.api().getSnapshot().phase,"READY");
});

test("카드 Overlay 포인터 진입은 유예를 취소하고 READY 유지",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);a.fire("pointerleave");
  f.api().overlayPointerEnter();f.advance(250);
  assert.equal(f.api().getSnapshot().phase,"READY");
  f.api().overlayPointerLeave();
  assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
  f.advance(200);assert.equal(f.api().getSnapshot().phase,"IDLE");
});

test("Overlay 키보드 포커스는 포인터 이탈과 관계없이 READY 유지",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("focusin");f.advance(400);a.fire("focusout");
  f.api().overlayFocusIn();f.advance(500);
  assert.equal(f.api().getSnapshot().phase,"READY");
  f.api().overlayFocusOut();f.advance(200);
  assert.equal(f.api().getSnapshot().phase,"IDLE");
});

test("Overlay를 떠났어도 anchor 안에 포인터가 남으면 닫지 않음",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);
  f.api().overlayPointerEnter();f.api().overlayPointerLeave();f.advance(800);
  assert.equal(f.api().getSnapshot().phase,"READY");
});

test("Escape는 현재 Hover만 DISMISSED 처리하고 preventDefault 호출하지 않음",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);
  f.doc.fire("keydown",{key:"Escape",preventDefault(){throw Error("do not prevent default");}});
  assert.equal(f.api().getSnapshot().phase,"DISMISSED");
  assert.equal(f.api().getSnapshot().targetId,null);
});

test("Escape는 대기 타이머도 취소하여 늦은 READY를 차단",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(30);f.doc.fire("keydown",{key:"Escape"});
  f.advance(1000);
  assert.equal(f.api().getSnapshot().phase,"DISMISSED");
});

test("다른 키는 Hover 상태를 변경하지 않음",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.doc.fire("keydown",{key:"Enter"});
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
});

test("문서가 hidden이 되면 현재 Hover를 DISMISSED 처리",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);
  f.doc.hidden=true;f.doc.fire("visibilitychange");
  assert.equal(f.api().getSnapshot().phase,"DISMISSED");
});

test("문서가 보이는 visibilitychange는 Hover를 닫지 않음",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);
  f.doc.hidden=false;f.doc.fire("visibilitychange");
  assert.equal(f.api().getSnapshot().phase,"READY");
});

test("동일 anchor의 VIDEO target 변경은 새 requestId로 재대기",()=>{
  const a=anchor("A"),f=fixture({videos:[video(a,VIDEO_A)]});
  a.fire("pointerenter");f.advance(400);
  const old=f.api().getSnapshot().requestId;
  a.href="B";f.videoChanges({added:[],removed:[],updated:[video(a,VIDEO_B)]});
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  assert.ok(f.api().getSnapshot().requestId>old);
  f.advance(400);assert.equal(f.api().getSnapshot().targetId,VIDEO_B);
});

test("취소된 과거 타이머가 수동 실행되더라도 A가 C를 덮지 않음",()=>{
  const a=anchor("A"),c=anchor("C"),f=fixture({videos:[video(a,VIDEO_A),video(c,VIDEO_C)]});
  a.fire("pointerenter");
  const stale=[...f.timers.values()][0].fn;
  c.fire("pointerenter");stale();
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  assert.equal(f.api().getSnapshot().targetId,VIDEO_C);
  f.advance(400);assert.equal(f.api().getSnapshot().targetId,VIDEO_C);
});

test("대기 중 DOM 제거는 타이머·리스너·선택을 해제",()=>{
  const a=anchor("video"),entry=video(a),f=fixture({videos:[entry]});
  a.fire("pointerenter");f.videoChanges({added:[],updated:[],removed:[entry]});
  f.advance(500);
  assert.equal(f.api().getSnapshot().phase,"IDLE");
  assert.equal(a.count("pointerenter"),0);
  assert.equal(f.api().getRuntimeStatus().boundVideoAnchors,0);
});

test("READY에서 채널 anchor 제거 시 즉시 취소",()=>{
  const a=anchor("channel"),entry=channel(a),f=fixture({channels:[entry]});
  a.fire("pointerenter");f.advance(400);
  f.channelChanges({added:[],updated:[],removed:[entry]});
  assert.equal(f.api().getSnapshot().phase,"IDLE");
  assert.equal(a.count("focusin"),0);
});

test("SPA로 후보가 새로 추가되면 해당 anchor에만 이벤트 바인딩",()=>{
  const a=anchor("new video"),f=fixture();
  assert.equal(f.api().getRuntimeStatus().boundVideoAnchors,0);
  f.videoChanges({added:[video(a)],removed:[],updated:[]});
  assert.equal(a.count("pointerenter"),1);
  a.fire("pointerenter");f.advance(400);
  assert.equal(f.api().getSnapshot().phase,"READY");
});

test("VIDEO target이 null이면 앵커를 바인딩하지 않음",()=>{
  const a=anchor("ambiguous"),f=fixture({videos:[video(a,null)]});
  assert.equal(f.api().getRuntimeStatus().boundVideoAnchors,0);
  a.fire("pointerenter");f.advance(500);
  assert.equal(f.api().getSnapshot().phase,"IDLE");
});

test("CHANNEL_ID 형식 확인은 targetType CHANNEL, targetId 보존",()=>{
  const a=anchor("channel"),f=fixture({channels:[channel(a)]});
  a.fire("pointerenter");f.advance(400);
  const s=f.api().getSnapshot();
  assert.equal(s.phase,"READY");assert.equal(s.targetType,"CHANNEL");
  assert.equal(s.targetId,CHANNEL_A);assert.equal(s.identityStatus,"CHANNEL_ID_FORMAT_VALID");
});

test("@handle은 UNRESOLVED로 표시하되 targetId는 null",()=>{
  const a=anchor("/@creator"),f=fixture({channels:[channel(a,{handle:"@creator"})]});
  a.fire("pointerenter");f.advance(400);
  const s=f.api().getSnapshot();
  assert.equal(s.phase,"UNRESOLVED");
  assert.equal(s.targetId,null);
  assert.equal(s.identityStatus,"HANDLE_UNRESOLVED");
  assert.equal(f.api().isCurrentRequest({requestId:s.requestId,targetType:"CHANNEL",targetId:CHANNEL_A}),false);
});

test("불확실한 CHANNEL identity는 미리보기 대상에 등록하지 않음",()=>{
  const a=anchor("ambiguous channel"),f=fixture({channels:[channel(a,{ambiguous:true})]});
  assert.equal(f.api().getRuntimeStatus().boundChannelAnchors,0);
});

test("CHANNEL handle이 ID로 교체되면 현재 Hover 재평가",()=>{
  const a=anchor("/@creator"),f=fixture({channels:[channel(a,{handle:"@creator"})]});
  a.fire("pointerenter");f.advance(400);
  a.href="/channel/"+CHANNEL_A;
  f.channelChanges({added:[],removed:[],updated:[channel(a)]});
  assert.equal(f.api().getSnapshot().phase,"HOVER_PENDING");
  f.advance(400);
  assert.equal(f.api().getSnapshot().phase,"READY");
  assert.equal(f.api().getSnapshot().targetId,CHANNEL_A);
});

test("동일 target/href 갱신은 이벤트 리스너를 중복 등록하지 않음",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  const adds=a.adds("pointerenter");
  f.videoChanges({added:[],removed:[],updated:[video(a)]});
  assert.equal(a.adds("pointerenter"),adds);
  assert.equal(a.count("pointerenter"),1);
});

test("상태 구독은 IDLE 초깃값과 이후 변경을 모두 받음",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]}),states=[];
  f.api().subscribe(s=>states.push(s.phase));
  a.fire("pointerenter");f.advance(400);
  assert.deepEqual(states,["IDLE","HOVER_PENDING","READY"]);
});

test("상태 구독자 예외는 정상 구독자 통지를 차단하지 않음",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  f.api().subscribe(()=>{throw Error("consumer failure")});
  let count=0;const stop=f.api().subscribe(()=>count++);
  a.fire("pointerenter");f.advance(400);
  assert.equal(count,3);
  stop();assert.equal(f.api().getRuntimeStatus().stateSubscribers,1);
});

test("isCurrentRequest는 READY의 정확한 ID와 requestId만 허용",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");
  let s=f.api().getSnapshot();
  const current={targetType:"VIDEO",targetId:VIDEO_A,requestId:s.requestId};
  assert.equal(f.api().isCurrentRequest(current),false);
  f.advance(400);assert.equal(f.api().isCurrentRequest(current),true);
  assert.equal(f.api().isCurrentRequest({...current,requestId:-1}),false);
  assert.equal(f.api().isCurrentRequest({...current,targetId:VIDEO_B}),false);
  a.fire("pointerleave");assert.equal(f.api().isCurrentRequest(current),false);
});

test("DISMISSED 후 동일 anchor 재진입은 새로운 requestId를 발행",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");const id=f.api().getSnapshot().requestId;
  f.api().dismiss();a.fire("pointerenter");
  assert.ok(f.api().getSnapshot().requestId>id);
});

test("pagehide에서 구독·타이머·DOM 리스너를 모두 정리",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.win.fire("pagehide");
  const status=f.sourceCounts();
  assert.equal(status.videoUnsubscribed,1);
  assert.equal(status.channelUnsubscribed,1);
  assert.equal(a.count("pointerenter"),0);
  assert.equal(f.api(),undefined);
  assert.equal(f.timers.size,0);
});

test("dispose는 중복 호출해도 안전하고 이벤트 소비자를 해제",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  const ctl=f.api();ctl.dispose();ctl.dispose();
  assert.equal(ctl.getRuntimeStatus().disposed,true);
  assert.equal(ctl.getRuntimeStatus().boundVideoAnchors,0);
  assert.equal(f.doc.count("keydown"),0);
  assert.equal(f.doc.count("pointermove"),0);
  assert.equal(f.doc.count("pointerover"),0);
  assert.equal(f.doc.count("pointerout"),0);
  assert.equal(f.win.count("pagehide"),0);
});

test("동일 Content Script 재주입은 Hover 컨트롤러·리스너 중복 생성 방지",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  const original=f.api();
  f.run();assert.equal(f.api(),original);
  assert.equal(a.count("pointerenter"),1);
  assert.equal(f.sourceCounts().video,1);
});

test("타이머가 없는 환경에서는 READY로 위장하지 않고 취소",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)],withTimers:false});
  a.fire("pointerenter");
  assert.equal(f.api().getSnapshot().phase,"IDLE");
  assert.equal(f.api().getSnapshot().targetId,null);
});

test("발견기 구독 API가 없다면 연결 상태를 거짓으로 표시하지 않음",()=>{
  const f=fixture({withDiscovery:false});
  assert.equal(f.api().getRuntimeStatus().connected,false);
  assert.equal(f.doc.count("keydown"),0);
});

test("YouTube 링크에 원래 달린 이벤트를 막지 않고 DOM href도 수정하지 않음",()=>{
  const a=anchor("/watch?v="+VIDEO_A);let clicked=0;
  a.addEventListener("click",()=>clicked++);
  const f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);a.fire("click");
  assert.equal(clicked,1);
  assert.equal(a.href,"/watch?v="+VIDEO_A);
  assert.equal(a.count("click"),1);
});


test("취소된 이전 이탈 유예 콜백이 새 유예 시간을 단축하지 못함",()=>{
  const a=anchor("video"),f=fixture({videos:[video(a)]});
  a.fire("pointerenter");f.advance(400);
  a.fire("pointerleave");
  const stale=[...f.timers.values()][0].fn;
  f.advance(60);
  a.fire("pointerenter");
  a.fire("pointerleave");
  stale(); // clearTimeout 직전 큐에 남아 있던 오래된 콜백을 흉내 낸다.
  assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
  f.advance(199);assert.equal(f.api().getSnapshot().phase,"LEAVE_PENDING");
  f.advance(1);assert.equal(f.api().getSnapshot().phase,"IDLE");
});
