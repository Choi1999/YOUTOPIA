/**
 * YUTOPIA YU-26 — delegated strict thumbnail Hover regression.
 *
 * Contract: enter -> immediate READY, leave -> immediate IDLE. One document
 * listener set owns A/B/C transitions; DOM replacement cannot strand state.
 */
"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname,"..","hover-controller.js"),"utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,"..","manifest.json"),"utf8"));
const A="Ab0_-123xyz", B="Ab0_-123xyZ", C="Ab0_-123xy0";
const CHANNEL="UC"+"a".repeat(22);

function emitter() {
  const listeners=new Map();
  return {
    addEventListener(type,fn) {const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);},
    removeEventListener(type,fn) {listeners.get(type)?.delete(fn);},
    fire(type,extra={}) {
      const event={type,pointerType:"mouse",target:null,relatedTarget:null,...extra};
      for(const fn of [...(listeners.get(type)||[])])fn(event);
    },
    count(type) {return listeners.get(type)?.size||0;},
  };
}
function renderer() {
  const r={isConnected:true,parentElement:null};
  r.closest=()=>r;
  return r;
}
function anchor(id=A,card=renderer(),rect={left:10,top:10,right:210,bottom:120,width:200,height:110}) {
  return {
    href:"/watch?v="+id,isConnected:true,parentElement:card,_hover:false,_focus:false,
    getAttribute(name){return name==="href"?this.href:null;},
    getBoundingClientRect(){return rect;},
    matches(query){return query===":hover"?this._hover:query===":focus-within"?this._focus:false;},
  };
}
function video(a,id=A){return {card:a.parentElement,thumbnailLink:a,href:a.href,target:id?{
  targetType:"VIDEO",targetId:id,source:"YOUTUBE",canonicalUrl:"https://www.youtube.com/watch?v="+id,
}:null};}
function channel(a,{id=CHANNEL,handle=false,invalid=false}={}){return{
  card:a.parentElement,channelLink:a,href:a.href,identity:invalid?null:handle?{
    identityType:"HANDLE",resolutionStatus:"HANDLE_UNRESOLVED",targetType:"CHANNEL",targetId:null,channelId:null,
  }:{identityType:"CHANNEL_ID",resolutionStatus:"ID_FORMAT_VALID",targetType:"CHANNEL",targetId:id,channelId:id},
};}
function fixture({videos=[],channels=[],available=true}={}){
  const doc=Object.assign(emitter(),{hidden:false,elementFromPoint:()=>null});
  const win=emitter(),videoListeners=new Set(),channelListeners=new Set();
  const timers=new Map();
  let clock=0, nextTimerId=0;
  const discovery={
    subscribe(fn){videoListeners.add(fn);fn({added:videos,updated:[],removed:[]});return()=>videoListeners.delete(fn);},
    subscribeChannels(fn){channelListeners.add(fn);fn({added:channels,updated:[],removed:[]});return()=>channelListeners.delete(fn);},
  };
  const ctx=vm.createContext({
    document:doc,
    addEventListener:win.addEventListener,
    removeEventListener:win.removeEventListener,
    setTimeout(fn,ms) {
      const id=++nextTimerId;
      timers.set(id,{fn,at:clock+ms});
      return id;
    },
    clearTimeout(id){timers.delete(id);},
    YUTOPIA_VIDEO_DISCOVERY:available?discovery:undefined,
    YUTOPIA_CHANNEL_TARGET_RESOLVER:{toIdentifiedTarget(identity){
      if(identity?.identityType!=="CHANNEL_ID"||identity.resolutionStatus!=="ID_FORMAT_VALID")return null;
      return {targetType:"CHANNEL",targetId:identity.channelId,source:"YOUTUBE"};
    }},
  });
  function run(){vm.runInContext(source,ctx);}
  function advance(ms){
    const end=clock+ms;
    for(let i=0;i<500;i++){
      const next=[...timers.entries()].filter(([,t])=>t.at<=end)
        .sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!next)break;
      clock=next[1].at;
      timers.delete(next[0]);
      next[1].fn();
      if(i===499)throw Error("infinite timer loop");
    }
    clock=end;
  }
  run();
  return {
    ctx,doc,win,run,advance,timers,api:()=>ctx.YUTOPIA_HOVER_CONTROLLER,
    videoChanges(change){for(const fn of [...videoListeners])fn(change);},
    channelChanges(change){for(const fn of [...channelListeners])fn(change);},
    videoSubs:()=>videoListeners.size,
  };
}
function pointer(f,type,target,extra={}){
  f.doc.fire(type,{target,composedPath:()=>target?[target,target.parentElement,f.doc]:[f.doc],...extra});
}
function enter(f,target,extra={}){target._hover=true;pointer(f,"pointerover",target,extra);}
function move(f,target,extra={}){pointer(f,"pointermove",target,extra);}
function leave(f,target,next=null,extra={}){
  target._hover=false;if(next)next._hover=true;
  pointer(f,"pointerout",target,{relatedTarget:next,...extra});
}
function expectVisible(f,id=A){
  const state=f.api().getSnapshot();
  assert.equal(state.phase,"READY");assert.equal(state.targetId,id);assert.equal(state.targetKey,"VIDEO:"+id);
}
function expectHidden(f){
  const state=f.api().getSnapshot();assert.ok(state.phase==="IDLE"||state.phase==="DISMISSED");assert.equal(state.targetId,null);
}

test("Manifest는 tracker/reducer 없이 controller를 직접 로드",()=>{
  const js=manifest.content_scripts[0].js;
  assert.equal(js.includes("hover-pointer-tracker.js"),false);
  assert.equal(js.includes("hover-presence-reducer.js"),false);
  assert.ok(js.indexOf("content.js")<js.indexOf("hover-controller.js"));
  assert.ok(js.indexOf("hover-controller.js")<js.indexOf("hover-card.js"));
});

test("문서 위임 리스너만 사용하고 0ms·0ms 계약",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]}),status=f.api().getRuntimeStatus();
  assert.equal(status.strategy,"DELEGATED_INTERACTIVE_CARD");
  assert.equal(status.cardTransitGraceMs,160);
  assert.equal(status.cardTransitScheduled,false);
  assert.equal(status.activationDelayMs,0);assert.equal(status.leaveGraceMs,0);
  assert.equal(status.perAnchorListeners,0);assert.equal(status.delegatedPointerListeners,3);
  assert.equal(f.doc.count("pointerover"),1);assert.equal(f.doc.count("pointermove"),1);assert.equal(f.doc.count("pointerout"),1);
});

test("pointerover 즉시 READY, pointerout 즉시 IDLE",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);expectVisible(f);leave(f,a);expectHidden(f);
  assert.equal(f.api().getSnapshot().reason,"THUMBNAIL_LEAVE");
});

test("같은 A 30회 완전 이탈·재진입에서 누락 0회",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  for(let cycle=1;cycle<=30;cycle++){
    enter(f,a);expectVisible(f);assert.equal(f.api().getSnapshot().requestId,cycle);
    leave(f,a);expectHidden(f);
  }
});

test("A→B→C를 20회 반복해도 현재 target 하나만 유지",()=>{
  const a=anchor(A),b=anchor(B),c=anchor(C),f=fixture({videos:[video(a,A),video(b,B),video(c,C)]});
  for(let cycle=0;cycle<20;cycle++){
    enter(f,a);expectVisible(f,A);leave(f,a,b);expectVisible(f,B);leave(f,b,c);expectVisible(f,C);leave(f,c,a);expectVisible(f,A);
  }
  assert.equal(f.api().getSnapshot().requestId,61);
  assert.equal(f.api().getRuntimeStatus().leaveScheduled,false);
});

test("늦게 도착한 A pointerout이 활성 B를 닫지 않음",()=>{
  const a=anchor(A),b=anchor(B),f=fixture({videos:[video(a,A),video(b,B)]});
  enter(f,a);enter(f,b);leave(f,a,null);expectVisible(f,B);
});

test("pointerenter 누락은 pointermove 위임으로 복구",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  a._hover=true;move(f,a);expectVisible(f);
  assert.equal(f.api().getRuntimeStatus().pointerRecoveries,1);
});

test("링크 밖 pointermove는 누락된 leave를 복구",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);move(f,{parentElement:null});expectHidden(f);
});

test("앵커 내부 자식 이동은 같은 대상 유지",()=>{
  const a=anchor(),child1={parentElement:a},child2={parentElement:a},f=fixture({videos:[video(a)]});
  enter(f,a);pointer(f,"pointerout",child1,{relatedTarget:child2});expectVisible(f);
  move(f,child2);expectVisible(f);
});

test("애니메이션 preview sibling은 같은 renderer와 anchor 좌표에서만 복구",()=>{
  const card=renderer(),a=anchor(A,card),overlay={parentElement:card,closest:()=>card};
  const f=fixture({videos:[video(a,A)]});f.doc.elementFromPoint=()=>overlay;
  move(f,overlay,{clientX:50,clientY:50});expectVisible(f,A);
  move(f,overlay,{clientX:500,clientY:500});expectHidden(f);
});

test("renderer 밖 YouTube portal preview도 발견된 anchor 좌표로 복구",()=>{
  const a=anchor(A),portalVideo={parentElement:null,closest:()=>null};
  const f=fixture({videos:[video(a,A)]});f.doc.elementFromPoint=()=>portalVideo;
  move(f,portalVideo,{clientX:80,clientY:60});expectVisible(f,A);
});

test("portal preview로 pointerout된 A는 좌표의 B로 즉시 전환",()=>{
  const a=anchor(A,renderer(),{left:10,top:10,right:210,bottom:120,width:200,height:110});
  const b=anchor(B,renderer(),{left:250,top:10,right:450,bottom:120,width:200,height:110});
  const portalVideo={parentElement:null,closest:()=>null};
  const f=fixture({videos:[video(a,A),video(b,B)]});f.doc.elementFromPoint=()=>portalVideo;
  enter(f,a);pointer(f,"pointerout",a,{relatedTarget:portalVideo,clientX:300,clientY:60});expectVisible(f,B);
});

test("모호한 영상 ID는 binding을 만들지 않음",()=>{
  const a=anchor(),f=fixture({videos:[video(a,null)]});enter(f,a);expectHidden(f);
  assert.equal(f.api().getRuntimeStatus().boundVideoAnchors,0);
});

test("정상 채널 ID는 READY, handle만 있으면 UNRESOLVED",()=>{
  const identified=anchor(),handle=anchor();
  const f=fixture({channels:[channel(identified),channel(handle,{handle:true})]});
  enter(f,identified);assert.equal(f.api().getSnapshot().targetId,CHANNEL);
  enter(f,handle);assert.equal(f.api().getSnapshot().phase,"UNRESOLVED");assert.equal(f.api().getSnapshot().targetId,null);
});

test("터치 포인터는 상태를 만들지 않음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});enter(f,a,{pointerType:"touch"});move(f,a,{pointerType:"touch"});expectHidden(f);
});

test("delegated focusin/focusout은 키보드 경계를 지원",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  pointer(f,"focusin",a,{pointerType:undefined});expectVisible(f);
  pointer(f,"focusout",a,{pointerType:undefined,relatedTarget:null});expectHidden(f);
});

test("Escape는 사이트 이벤트를 막지 않고 닫으며 다음 움직임에 재개",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});enter(f,a);
  f.doc.fire("keydown",{key:"Escape",preventDefault(){throw Error("must not call");}});expectHidden(f);
  move(f,a);expectVisible(f);
});

test("정확한 활성 request만 현재 요청으로 인정",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});enter(f,a);
  const request={targetType:"VIDEO",targetId:A,requestId:f.api().getSnapshot().requestId};
  assert.equal(f.api().isCurrentRequest(request),true);leave(f,a);assert.equal(f.api().isCurrentRequest(request),false);
});

test("Subscriber 오류가 다른 구독자를 막지 않음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]}),events=[];
  f.api().subscribe(()=>{throw Error("subscriber");});f.api().subscribe(s=>events.push(s.phase));
  enter(f,a);leave(f,a);assert.deepEqual(events,["IDLE","READY","IDLE"]);
});

test("활성 anchor 제거는 즉시 IDLE",()=>{
  const a=anchor(),entry=video(a),f=fixture({videos:[entry]});enter(f,a);a.isConnected=false;
  f.videoChanges({removed:[entry],added:[],updated:[]});expectHidden(f);
  assert.equal(f.api().getSnapshot().reason,"ANCHOR_REMOVED");
});

test("SPA가 같은 VIDEO ID anchor를 교체하면 stable targetKey와 request 유지",()=>{
  const a=anchor(A),b=anchor(A),old=video(a,A),next=video(b,A),f=fixture({videos:[old]});
  enter(f,a);const before=f.api().getSnapshot();a.isConnected=false;b._hover=true;
  f.videoChanges({removed:[old],added:[next],updated:[]});
  const after=f.api().getSnapshot();expectVisible(f,A);
  assert.equal(after.targetKey,before.targetKey);assert.equal(after.requestId,before.requestId);assert.equal(after.anchor,b);
});

test("SPA 교체 anchor가 hovered 아니면 종료",()=>{
  const a=anchor(A),b=anchor(A),old=video(a,A),next=video(b,A),f=fixture({videos:[old]});
  enter(f,a);a.isConnected=false;f.videoChanges({removed:[old],added:[next],updated:[]});expectHidden(f);
});

test("같은 DOM anchor가 A에서 B로 바뀌면 새 stable targetKey",()=>{
  const a=anchor(A),f=fixture({videos:[video(a,A)]});enter(f,a);const before=f.api().getSnapshot().requestId;
  a.href="/watch?v="+B;a._hover=true;f.videoChanges({removed:[],added:[],updated:[video(a,B)]});
  expectVisible(f,B);assert.equal(f.api().getSnapshot().requestId,before+1);
});

test("포인터 아래 늦게 발견된 anchor는 :hover로 복구",()=>{
  const a=anchor();a._hover=true;const f=fixture();f.videoChanges({removed:[],updated:[],added:[video(a)]});expectVisible(f);
});

test("visibilitychange와 window blur는 활성 상태 정리",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});enter(f,a);f.doc.hidden=true;f.doc.fire("visibilitychange");expectHidden(f);
  f.doc.hidden=false;enter(f,a);f.win.fire("blur");expectHidden(f);
});

test("중복 주입은 singleton과 문서 리스너 하나를 유지",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]}),api=f.api();f.run();
  assert.equal(f.api(),api);assert.equal(f.doc.count("pointerover"),1);
});

test("dispose는 위임 이벤트와 discovery 구독을 정리",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]}),api=f.api();enter(f,a);api.dispose();api.dispose();
  for(const name of ["pointerover","pointermove","pointerout","focusin","focusout","keydown"])assert.equal(f.doc.count(name),0);
  assert.equal(f.win.count("blur"),0);assert.equal(f.videoSubs(),0);assert.equal(f.api(),undefined);
});

function floatingCard(f,rect={left:222,top:10,right:566,bottom:270,width:344,height:260}){
  const host={isConnected:true,parentElement:null};
  const card={isConnected:true,parentElement:host,getBoundingClientRect:()=>rect};
  const child={parentElement:card};
  f.api().setCardRegion(host,card);
  function over(extra={}){
    pointer(f,"pointerover",child,{clientX:250,clientY:60,
      composedPath:()=>[child,card,host,f.doc],...extra});
  }
  function moveOn(extra={}){
    pointer(f,"pointermove",child,{clientX:250,clientY:60,
      composedPath:()=>[child,card,host,f.doc],...extra});
  }
  function out(next=null,x=800,y=600){
    pointer(f,"pointerout",child,{relatedTarget:next,clientX:x,clientY:y,
      composedPath:()=>[child,card,host,f.doc]});
  }
  return {host,card,child,over,moveOn,out};
}

test("썸네일 A→Shadow 카드 직접 진입 시 ACTIVE A 고정 및 requestId 유지",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);
  const id=f.api().getSnapshot().requestId;
  const card=floatingCard(f);
  leave(f,a,card.child,{clientX:211,clientY:60});
  card.over();
  expectVisible(f);
  assert.equal(f.api().getSnapshot().requestId,id);
  assert.equal(f.api().getRuntimeStatus().cardPointerInside,true);
});

test("카드가 B 썸네일을 덮더라도 B 이벤트 대신 카드 포인터가 우선",()=>{
  const a=anchor(A),b=anchor(B,renderer(),{left:250,top:10,right:450,bottom:120,width:200,height:110});
  const f=fixture({videos:[video(a,A),video(b,B)]});
  enter(f,a);
  const card=floatingCard(f);
  f.doc.elementFromPoint=()=>b;
  card.over({clientX:300,clientY:65});
  const initial=f.api().getSnapshot().requestId;
  for(let i=0;i<20;i++){
    card.moveOn({clientX:330+i%15,clientY:80});
    expectVisible(f,A);
  }
  assert.equal(f.api().getSnapshot().requestId,initial);
});

test("카드에서 실제 B 썸네일로 벗어나면 A 대신 B가 즉시 활성",()=>{
  const a=anchor(A),b=anchor(B,renderer(),{left:650,top:20,right:840,bottom:125,width:190,height:105});
  const f=fixture({videos:[video(a,A),video(b,B)]});
  enter(f,a);const card=floatingCard(f);card.over();
  card.out(b,700,65);expectVisible(f,B);
  assert.equal(f.api().getRuntimeStatus().cardPointerInside,false);
});

test("카드 밖 빈 공간으로 나가면 즉시 IDLE",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);const card=floatingCard(f);card.over();
  card.out(null,850,650);expectHidden(f);
  assert.equal(f.api().getSnapshot().reason,"CARD_LEAVE");
});

test("카드 위에서 오래된 A pointerout이 도착해도 카드가 닫히지 않음",()=>{
  const a=anchor(A),b=anchor(B),f=fixture({videos:[video(a,A),video(b,B)]});
  enter(f,a);const card=floatingCard(f);card.over();
  leave(f,a,b,{clientX:300,clientY:50});expectVisible(f,A);
});

test("A→카드 간격 12px만 160ms 이하로 이동하면 카드 유지",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);const card=floatingCard(f);
  leave(f,a,{parentElement:null},{clientX:211,clientY:60});
  assert.equal(f.api().getRuntimeStatus().cardTransitScheduled,true);
  f.advance(100);expectVisible(f);
  card.over();
  assert.equal(f.api().getRuntimeStatus().cardTransitScheduled,false);
  f.advance(200);expectVisible(f);
});

test("안전한 간격에 멈춰 있으면 160ms 경과 후 반드시 카드 종료",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);floatingCard(f);
  leave(f,a,{parentElement:null},{clientX:211,clientY:60});
  f.advance(159);expectVisible(f);
  f.advance(1);expectHidden(f);
  assert.equal(f.api().getSnapshot().reason,"CARD_TRANSIT_EXPIRED");
  assert.equal(f.timers.size,0);
});

test("안전 경로 안에서 pointermove를 반복해도 종료 시한이 연장되지 않음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);floatingCard(f);
  leave(f,a,{parentElement:null},{clientX:211,clientY:60});
  for(let i=0;i<5;i++){
    f.advance(20);
    move(f,{parentElement:null},{clientX:215,clientY:60});
    expectVisible(f);
  }
  f.advance(60);expectHidden(f);
});

test("안전 경로 밖으로 포인터가 이동하면 160ms를 기다리지 않고 종료",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);floatingCard(f);
  leave(f,a,{parentElement:null},{clientX:211,clientY:60});
  move(f,{parentElement:null},{clientX:750,clientY:500});
  expectHidden(f);
  assert.equal(f.timers.size,0);
});

test("같은 영상 A↔카드↔A 20회 반복해도 카드 누락·requestId 교체 없음",()=>{
  const a=anchor(),f=fixture({videos:[video(a)]});
  enter(f,a);const card=floatingCard(f),id=f.api().getSnapshot().requestId;
  for(let i=0;i<20;i++){
    leave(f,a,card.child,{clientX:211,clientY:60});
    card.over();expectVisible(f);
    card.out(a,209,60);
    enter(f,a);expectVisible(f);
    assert.equal(f.api().getSnapshot().requestId,id);
  }
});

test("포인터가 카드 위에 있는 동안 SPA가 같은 ID anchor 교체해도 고정",()=>{
  const a=anchor(A),b=anchor(A),old=video(a,A),next=video(b,A);
  const f=fixture({videos:[old]});
  enter(f,a);const card=floatingCard(f);card.over();
  const id=f.api().getSnapshot().requestId;
  a.isConnected=false;
  f.videoChanges({removed:[old],updated:[],added:[next]});
  expectVisible(f,A);
  assert.equal(f.api().getSnapshot().requestId,id);
  assert.equal(f.api().getSnapshot().anchor,b);
});

test("discovery가 없으면 controller를 초기화하지 않음",()=>{assert.equal(fixture({available:false}).api(),undefined);});

test("controller는 일반 Hover 타이머 없이 카드 이동에만 제한된 유예 사용",()=>{
  assert.match(source,/CARD_TRANSIT_MS = 160/);
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/\.innerHTML\s*=/);
  assert.doesNotMatch(source,/\.preventDefault\s*\(/);
});
