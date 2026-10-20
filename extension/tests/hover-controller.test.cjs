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
  const discovery={
    subscribe(fn){videoListeners.add(fn);fn({added:videos,updated:[],removed:[]});return()=>videoListeners.delete(fn);},
    subscribeChannels(fn){channelListeners.add(fn);fn({added:channels,updated:[],removed:[]});return()=>channelListeners.delete(fn);},
  };
  const ctx=vm.createContext({
    document:doc,
    addEventListener:win.addEventListener,
    removeEventListener:win.removeEventListener,
    YUTOPIA_VIDEO_DISCOVERY:available?discovery:undefined,
    YUTOPIA_CHANNEL_TARGET_RESOLVER:{toIdentifiedTarget(identity){
      if(identity?.identityType!=="CHANNEL_ID"||identity.resolutionStatus!=="ID_FORMAT_VALID")return null;
      return {targetType:"CHANNEL",targetId:identity.channelId,source:"YOUTUBE"};
    }},
  });
  function run(){vm.runInContext(source,ctx);}
  run();
  return {
    ctx,doc,win,run,api:()=>ctx.YUTOPIA_HOVER_CONTROLLER,
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
  assert.equal(status.strategy,"DELEGATED_STRICT_THUMBNAIL");
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

test("discovery가 없으면 controller를 초기화하지 않음",()=>{assert.equal(fixture({available:false}).api(),undefined);});

test("controller는 timer·network·DOM mutation을 사용하지 않음",()=>{
  assert.doesNotMatch(source,/\bsetTimeout\s*\(/);assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/\.innerHTML\s*=/);assert.doesNotMatch(source,/\.preventDefault\s*\(/);
});
