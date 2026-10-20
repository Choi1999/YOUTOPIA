/**
 * YUTOPIA 작업 24 — 채널 ID·@handle 안전 분리 및 DOM/SPA 회귀
 *
 * 실행: node --test extension/tests/channel-target-resolver.test.cjs
 * 실제 채널 조회/API 매핑이 아닌 URL 문법·DOM 식별 Fixture에 한정한다.
 */
"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const channelSource = fs.readFileSync(path.join(__dirname, "..", "channel-target-resolver.js"), "utf8");
const videoSource = fs.readFileSync(path.join(__dirname, "..", "target-resolver.js"), "utf8");
const discoverySource = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
const A = "UC" + "a".repeat(22);
const B = "UC" + "b".repeat(22);
const VIDEO = "Ab0_-123xyz";

function anchor(href, {ad=false} = {}) {
  return {
    nodeType: 1,
    href,
    getAttribute(name) { return name === "href" ? this.href : null; },
    closest(selector) { return ad && selector.includes("ytd-ad-slot-renderer") ? {} : null; },
    matches(selector) { return Boolean(href) && selector.includes("a[href"); },
    querySelector() { return null; },
  };
}
function card(links=[], {ad=false,hidden=false} = {}) {
  return {
    nodeType: 1,
    links,
    closest(selector) {return ad && selector.includes("ytd-ad-slot-renderer") ? {} : null;},
    matches(selector) {
      if (selector.includes("ytd-video-renderer") || selector.includes("ytd-channel-renderer")) return true;
      return hidden;
    },
    querySelectorAll() { return this.links; },
    querySelector() { return this.links[0] || null; },
  };
}
function fixture({
  pathname="/", cards=[], readyState="complete", useObserver=true, withVideo=false,
} = {}) {
  const listeners=new Map(),timers=new Map(),observers=[];
  const location={origin:"https://www.youtube.com",href:"https://www.youtube.com"+pathname,pathname};
  let nextTimer=0;
  function addEventListener(type,fn) {
    const set=listeners.get(type)||new Set();
    set.add(fn);listeners.set(type,set);
  }
  function removeEventListener(type,fn){listeners.get(type)?.delete(fn);}
  const doc={
    readyState,
    documentElement:{nodeType:1},
    cards,
    querySelectorAll() {return this.cards;},
    addEventListener,
    removeEventListener,
  };
  class MockObserver {
    constructor(handler){this.handler=handler;this.active=false;observers.push(this);}
    observe(){this.active=true;}
    disconnect(){this.active=false;}
    emit(changes){if(this.active)this.handler(changes);}
  }
  const values={
    URL,location,document:doc,
    setTimeout(fn,delay){const id=++nextTimer;timers.set(id,{fn,delay});return id;},
    clearTimeout(id){timers.delete(id);},
    addEventListener,removeEventListener,
  };
  if(useObserver)values.MutationObserver=MockObserver;
  const context=vm.createContext(values);
  vm.runInContext(channelSource,context,{filename:"channel-target-resolver.js"});
  if(withVideo)vm.runInContext(videoSource,context,{filename:"target-resolver.js"});
  vm.runInContext(discoverySource,context,{filename:"content.js"});
  const flush=()=>{const list=[...timers.values()];timers.clear();list.forEach(x=>x.fn());};
  return {
    context,doc,location,timers,observers,flush,
    api:context.YUTOPIA_CHANNEL_TARGET_RESOLVER,
    discovery:context.YUTOPIA_VIDEO_DISCOVERY,
    setPath(p){location.pathname=p;location.href=location.origin+p;},
    fire(type){for(const fn of [...(listeners.get(type)||[])])fn();},
    emit(changes){observers.at(-1)?.emit(changes);},
  };
}
function resolver() {
  const c=vm.createContext({URL,location:{href:"https://www.youtube.com/",origin:"https://www.youtube.com"}});
  vm.runInContext(channelSource,c);
  return c.YUTOPIA_CHANNEL_TARGET_RESOLVER;
}
function norm(value) {return JSON.parse(JSON.stringify(value));}

test("채널 ID: UC + 22자 형태는 채널 ID 형식 후보로 구분",()=>{
  const got=resolver().resolveFromHref("/channel/"+A);
  assert.deepEqual(norm(got),{
    targetType:"CHANNEL",identityType:"CHANNEL_ID",resolutionStatus:"ID_FORMAT_VALID",
    channelId:A,targetId:A,handle:null,source:"YOUTUBE",
    canonicalUrl:"https://www.youtube.com/channel/"+A,
  });
  assert.equal(Object.isFrozen(got),true);
});

test("채널 ID 경로의 trailing slash·videos/shorts 탭은 같은 ID로 정규화",()=>{
  const r=resolver();
  for(const suffix of ["/","/videos","/shorts","/streams","/playlists","/community","/about","/featured"]){
    assert.equal(r.resolveFromHref("/channel/"+A+suffix)?.targetId,A,suffix);
  }
});

test("잘못된 UC 길이·문자 및 임의 사용자 ID는 거부",()=>{
  const r=resolver();
  for(const s of ["/channel/UCabc","/channel/"+A+"z","/channel/AB"+"a".repeat(22),"/channel/UC"+"a".repeat(21)+"!","/channel/UC%61"+"a".repeat(21)])
    assert.equal(r.resolveFromHref(s),null,s);
});

test("@handle은 CHANNEL로 구분하지만 targetId/channelId를 부여하지 않음",()=>{
  const identity=resolver().resolveFromHref("/@Creator.Lab-1");
  assert.deepEqual(norm(identity),{
    targetType:"CHANNEL",identityType:"HANDLE",resolutionStatus:"HANDLE_UNRESOLVED",
    channelId:null,targetId:null,handle:"@Creator.Lab-1",
    source:"YOUTUBE",canonicalUrl:"https://www.youtube.com/@Creator.Lab-1",
  });
});

test("handle의 허용된 tab과 상대/절대 URL을 보수적으로 정규화",()=>{
  const r=resolver();
  assert.equal(r.resolveFromHref("https://www.youtube.com/@Some_Channel/videos")?.handle,"@Some_Channel");
  assert.equal(r.resolveFromHref("/@simple")?.handle,"@simple");
  assert.equal(r.resolveFromHref("/@abc/shorts")?.resolutionStatus,"HANDLE_UNRESOLVED");
});

test("handle의 너무 짧거나 긴 문자열 및 문자 혼동 거부",()=>{
  const r=resolver();
  for(const url of ["/@ab","/@"+"a".repeat(31),"/@.abc","/@abc.","/@ab+cd","/@@creator","/@ab%63","/@가나다","/@a/b/c"])
    assert.equal(r.resolveFromHref(url),null,url);
});

test("youtube 이외·유사 도메인·HTTP 및 비표준 도메인을 거부",()=>{
  const r=resolver();
  for(const url of ["http://www.youtube.com/channel/"+A,
    "https://www.youtube.com.evil.test/channel/"+A,
    "https://youtube.com/channel/"+A,
    "https://m.youtube.com/@creator",
    "https://evil.test/@creator",
    "https://www.youtube.com@evil.test/@creator"])
    assert.equal(r.resolveFromHref(url),null,url);
});

test("사용자 정보 URL 및 잘못된 프로토콜·공백 거부",()=>{
  const r=resolver();
  for(const url of ["https://test@www.youtube.com/@creator",
    "javascript:alert(1)","data:text/html,a","file:///channel/"+A,
    " /@creator","/@creator "])
    assert.equal(r.resolveFromHref(url),null,url);
});

test("custom /c/, /user/, redirect, /watch 및 모호한 경로는 매핑하지 않음",()=>{
  const r=resolver();
  for(const url of ["/c/custom","/user/legacy","/watch?v=Ab0_-123xyz",
    "/redirect?q=/@creator","/@creator/other","/channel/"+A+"/live/extra",
    "/channel//"+A])
    assert.equal(r.resolveFromHref(url),null,url);
});

test("채널 URL의 query/fragment는 canonical identity에 섞이지 않음",()=>{
  const r=resolver();
  assert.equal(r.resolveFromHref("/channel/"+A+"?feature=shared#tab")?.canonicalUrl,"https://www.youtube.com/channel/"+A);
  assert.equal(r.resolveFromHref("/@creator?t=10#about")?.canonicalUrl,"https://www.youtube.com/@creator");
});

test("채널 ID 형식 확인된 경우에만 상세 대상의 targetId 제공",()=>{
  const r=resolver();
  const id=r.resolveFromHref("/channel/"+A);
  const handle=r.resolveFromHref("/@creator");
  assert.deepEqual(norm(r.toIdentifiedTarget(id)),{targetType:"CHANNEL",targetId:A,source:"YOUTUBE"});
  assert.equal(r.toIdentifiedTarget(handle),null);
  assert.equal(r.toIdentifiedTarget(null),null);
});

test("검증되지 않은 객체로 toIdentifiedTarget을 속일 수 없음",()=>{
  const r=resolver();
  for(const bogus of [
    {targetType:"CHANNEL",identityType:"CHANNEL_ID",resolutionStatus:"ID_FORMAT_VALID",channelId:"notreal",targetId:"notreal"},
    {targetType:"CHANNEL",identityType:"CHANNEL_ID",resolutionStatus:"HANDLE_UNRESOLVED",channelId:A,targetId:A},
    {targetType:"VIDEO",identityType:"CHANNEL_ID",resolutionStatus:"ID_FORMAT_VALID",channelId:A,targetId:A},
    {targetType:"CHANNEL",identityType:"CHANNEL_ID",resolutionStatus:"ID_FORMAT_VALID",channelId:A,targetId:B},
  ]) assert.equal(r.toIdentifiedTarget(bogus),null);
});

test("DOM anchor의 href만 읽고 정상/미정 handle을 구분",()=>{
  const r=resolver();
  assert.equal(r.resolveFromAnchor(anchor("/channel/"+A))?.channelId,A);
  assert.equal(r.resolveFromAnchor(anchor("/@creator"))?.channelId,null);
  assert.equal(r.resolveFromAnchor({href:"/channel/"+A}),null);
});

test("채널명과 아바타가 동일한 ID이면 카드 식별 성공",()=>{
  const r=resolver(), a=anchor("/channel/"+A);
  const c=card([a,anchor("https://www.youtube.com/channel/"+A)]);
  assert.equal(r.resolveCandidate({card:c,channelLink:a})?.channelId,A);
});

test("같은 카드의 두 채널 ID 불일치는 null",()=>{
  const r=resolver(),a=anchor("/channel/"+A),c=card([a,anchor("/channel/"+B)]);
  assert.equal(r.resolveCandidate({card:c,channelLink:a}),null);
});

test("같은 카드의 handle/UC ID는 대응 확인 전 null",()=>{
  const r=resolver(), a=anchor("/channel/"+A),c=card([a,anchor("/@creator")]);
  assert.equal(r.resolveCandidate({card:c,channelLink:a}),null);
  assert.equal(r.resolveCandidate({card:c,channelLink:c.links[1]}),null);
});

test("채널명과 아바타의 서로 다른 handle은 추정 매핑하지 않음",()=>{
  const r=resolver(),a=anchor("/@alpha"),c=card([a,anchor("/@bravo")]);
  assert.equal(r.resolveCandidate({card:c,channelLink:a}),null);
});

test("잘못된 채널 링크를 포함한 카드의 다른 정상 링크도 보수적으로 유보",()=>{
  const r=resolver(),a=anchor("/channel/"+A),c=card([a,anchor("/channel/not-a-channel-id")]);
  assert.equal(r.resolveCandidate({card:c,channelLink:a}),null);
});

test("카드의 영상 /watch 링크는 CHANNEL 링크와 혼동하지 않음",()=>{
  const r=resolver(),a=anchor("/@creator"),c=card([a,anchor("/watch?v="+VIDEO)]);
  assert.equal(r.resolveCandidate({card:c,channelLink:a})?.handle,"@creator");
});

test("홈 카드 내 채널명 링크와 채널 검색 결과만 후보로 읽음",()=>{
  const c1=card([anchor("/@creator")]);
  const c2=card([anchor("/channel/"+A)]);
  const fx=fixture({cards:[c1,c2]});
  const matches=fx.api.findCandidates();
  assert.equal(matches.length,2);
  assert.equal(matches[0].identity.resolutionStatus,"HANDLE_UNRESOLVED");
  assert.equal(matches[1].identity.channelId,A);
  assert.equal(fx.discovery.getRuntimeStatus().channelLinksTracked,2);
});

test("검색 /results에서도 채널 링크를 탐지, 동영상 재생 화면에서는 0건",()=>{
  const fx=fixture({pathname:"/results",cards:[card([anchor("/@creator")])]});
  assert.equal(fx.api.findCandidates().length,1);
  fx.setPath("/watch");
  assert.equal(fx.api.findCandidates().length,0);
});

test("광고 채널 카드와 외부 링크를 후보에서 배제",()=>{
  const fx=fixture({cards:[
    card([anchor("/channel/"+A)],{ad:true}),
    card([anchor("https://evil.test/channel/"+B)]),
    card([anchor("/@creator")]),
  ]});
  assert.equal(fx.api.findCandidates().length,1);
  assert.equal(fx.discovery.getRuntimeStatus().channelLinksTracked,1);
});

test("VIDEO 후보 집계와 CHANNEL 후보 집계가 섞이지 않음",()=>{
  const c=card([anchor("/watch?v="+VIDEO),anchor("/@creator")]);
  const fx=fixture({cards:[c],withVideo:true});
  const status=fx.discovery.getRuntimeStatus();
  assert.equal(fx.discovery.getSnapshot().candidates,1);
  assert.equal(status.identifiedCandidates,1);
  assert.equal(status.channelLinksTracked,1);
  assert.equal(status.channelIdsFormatted,0);
  assert.equal(status.unresolvedHandles,1);
});

test("VIDEO와 CHANNEL은 독립적으로 구독하고 이벤트를 처리",()=>{
  const c=card([anchor("/watch?v="+VIDEO),anchor("/channel/"+A)]);
  const fx=fixture({cards:[c],withVideo:true});
  const videos=[],channels=[];
  fx.discovery.subscribe(x=>videos.push(x));
  fx.discovery.subscribeChannels(x=>channels.push(x));
  assert.equal(videos[0].added[0].target.targetType,"VIDEO");
  assert.equal(channels[0].added[0].identity.targetType,"CHANNEL");
  assert.equal(channels[0].added[0].identity.targetId,A);
});

test("같은 DOM에서 handle→채널 ID 링크 수정 시 channelUpdated 발생",()=>{
  const link=anchor("/@creator"),c=card([link]),fx=fixture({cards:[c]});
  const events=[];fx.discovery.subscribeChannels(e=>events.push(e));
  assert.equal(events[0].added[0].identity.channelId,null);
  link.href="/channel/"+A;
  fx.discovery.scan();
  assert.equal(events.at(-1).updated.length,1);
  assert.equal(events.at(-1).updated[0].identity.targetId,A);
  assert.equal(fx.discovery.getRuntimeStatus().channelIdsFormatted,1);
});

test("SPA HOME→WATCH→SEARCH 시 채널 후보가 해제되고 재추가됨",()=>{
  const link=anchor("/channel/"+A),c=card([link]),fx=fixture({cards:[c]});
  const events=[];fx.discovery.subscribeChannels(e=>events.push(e));
  fx.setPath("/watch");
  fx.discovery.scan();
  assert.equal(fx.discovery.getRuntimeStatus().channelLinksTracked,0);
  assert.equal(events.at(-1).removed.length,1);
  fx.setPath("/results");
  fx.discovery.scan();
  assert.equal(fx.discovery.getRuntimeStatus().channelLinksTracked,1);
  assert.equal(events.at(-1).added.length,1);
});

test("동일 채널 링크가 DOM에서 제거되면 참조를 해제",()=>{
  const c=card([anchor("/@creator")]),fx=fixture({cards:[c]});
  const events=[];fx.discovery.subscribeChannels(e=>events.push(e));
  fx.doc.cards=[];
  fx.discovery.scan();
  assert.equal(fx.discovery.getRuntimeStatus().channelLinksTracked,0);
  assert.equal(events.at(-1).removed.length,1);
});

test("중복 anchor 노드는 한 번만 식별",()=>{
  const a=anchor("/channel/"+A),fx=fixture({cards:[card([a]),card([a])]});
  assert.equal(fx.api.findCandidates().length,1);
});

test("채널 구독자가 예외를 던져도 다른 채널 구독자에게 전파되지 않음",()=>{
  const c=card([anchor("/@creator")]),fx=fixture({cards:[c]});
  fx.discovery.subscribeChannels(()=>{throw Error("UI consumer failed")});
  let called=0;const stop=fx.discovery.subscribeChannels(()=>called++);
  fx.doc.cards.push(card([anchor("/channel/"+A)]));
  fx.discovery.scan();
  assert.equal(called,2);
  stop();assert.equal(fx.discovery.getRuntimeStatus().channelSubscriberCount,1);
});

test("dispose()는 VIDEO/CHANNEL 후보·구독자를 모두 정리",()=>{
  const c=card([anchor("/channel/"+A)]),fx=fixture({cards:[c]});
  fx.discovery.subscribeChannels(()=>{});
  fx.discovery.dispose();
  const status=fx.discovery.getRuntimeStatus();
  assert.equal(status.channelLinksTracked,0);
  assert.equal(status.channelSubscriberCount,0);
  assert.equal(status.disposed,true);
});

test("채널 Resolver의 재주입은 기존 API를 유지",()=>{
  const ctx=vm.createContext({URL,location:{href:"https://www.youtube.com/"}});
  vm.runInContext(channelSource,ctx);
  const one=ctx.YUTOPIA_CHANNEL_TARGET_RESOLVER;
  vm.runInContext(channelSource,ctx);
  assert.equal(ctx.YUTOPIA_CHANNEL_TARGET_RESOLVER,one);
});
