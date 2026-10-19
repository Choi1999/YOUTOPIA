/**
 * YUTOPIA 작업 22 — SPA/무한 스크롤/해제 Node Fixture
 *
 * 실행: node --test extension/tests/content-spa-observer.test.cjs
 * 외부 DOM 라이브러리, YouTube API, Chrome 확장 설치를 요구하지 않는다.
 * 실제 youtube.com / Service Worker / Side Panel 검증은 별도로 필요하다.
 */
"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");

function link(href, options = {}) {
  return {
    nodeType: 1,
    href,
    getAttribute(name) { return name === "href" ? this.href : null; },
    closest(selector) {
      if (options.ad && selector.includes("ytd-ad-slot-renderer")) return {};
      if (selector.includes("ytd-rich-item-renderer")) return {};
      return null;
    },
    matches(selector) { return selector.includes("a[href]") && Boolean(this.href); },
    querySelector() { return null; },
  };
}

function card(links = [], options = {}) {
  return {
    nodeType: 1,
    links,
    closest(selector) {
      return options.ad && selector.includes("ytd-ad-slot-renderer") ? {} : null;
    },
    matches(selector) {
      if (selector.includes("ytd-rich-item-renderer")) return true;
      return Boolean(options.hidden);
    },
    querySelectorAll() { return this.links; },
    querySelector() { return this.links[0] || null; },
  };
}

function irrelevantNode() {
  return {
    nodeType: 1,
    matches() { return false; },
    closest() { return null; },
    querySelector() { return null; },
  };
}

function mutation(addedNodes = [], removedNodes = []) {
  return {type:"childList", addedNodes, removedNodes};
}

function attrs(target, attributeName = "href") {
  return {type:"attributes", target, attributeName};
}

function createEventStore() {
  const handlers = new Map();
  return {
    addEventListener(type, fn) {
      const entries = handlers.get(type) || new Set();
      entries.add(fn);
      handlers.set(type, entries);
    },
    removeEventListener(type, fn) { handlers.get(type)?.delete(fn); },
    fire(type) { for (const callback of [...(handlers.get(type) || [])]) callback({type}); },
    count(type) { return handlers.get(type)?.size || 0; },
  };
}

function sandbox({pathname = "/", cards = [], readyState = "complete", hasObserver = true} = {}) {
  const pageEvents = createEventStore();
  const windowEvents = createEventStore();
  const location = {pathname, origin:"https://www.youtube.com", href:"https://www.youtube.com" + pathname};
  const timers = new Map();
  const observers = [];
  let timerSequence = 0;

  const doc = {
    ...pageEvents, readyState, cards, queryCount:0, documentElement:irrelevantNode(),
    querySelectorAll() { this.queryCount += 1; return this.cards; },
  };

  class MockMutationObserver {
    constructor(callback) {this.callback=callback;this.active=false;this.observeCalls=0;observers.push(this);}
    observe(root, options) {this.active=true;this.observeCalls+=1;this.root=root;this.options=options;}
    disconnect() {this.active=false;}
    emit(records) {if(this.active)this.callback(records);}
  }

  const contextValues = {
    document:doc, location, URL,
    addEventListener:windowEvents.addEventListener,
    removeEventListener:windowEvents.removeEventListener,
    setTimeout(fn,delay) {const id=++timerSequence;timers.set(id,{fn,delay});return id;},
    clearTimeout(id) {timers.delete(id);},
  };
  if(hasObserver)contextValues.MutationObserver=MockMutationObserver;

  const context=vm.createContext(contextValues);
  const execute=()=>vm.runInContext(source,context,{filename:"content.js"});
  const api=()=>context.YUTOPIA_VIDEO_DISCOVERY;
  const flush=()=> {
    const list=[...timers.entries()];
    timers.clear();
    for(const [,entry] of list)entry.fn();
    return list.length;
  };
  const emit=(records)=>observers.at(-1)?.emit(records);
  const setPath=(v)=>{location.pathname=v;location.href=location.origin+v;};
  return {doc,context,execute,api,flush,emit,setPath,timers,observers,pageEvents,windowEvents};
}

test("기본 시작: 최초 홈 검색 후 MutationObserver 1개만 등록", () => {
  const fixture=sandbox({cards:[card([link("/watch?v=A")])]});
  fixture.execute();fixture.execute();
  assert.equal(fixture.observers.length,1);
  assert.equal(fixture.observers[0].observeCalls,1);
  assert.equal(fixture.observers[0].options.subtree,true);
  assert.equal(fixture.observers[0].options.childList,true);
  assert.ok(fixture.observers[0].options.attributeFilter.includes("href"));
  assert.equal(fixture.api().getSnapshot().candidates,1);
  assert.equal(fixture.doc.queryCount,1);
});

test("무한 스크롤: 삽입된 썸네일을 자동 재탐지", () => {
  const old=card([link("/watch?v=first")]);const fixture=sandbox({cards:[old]});fixture.execute();
  const added=card([link("/watch?v=second")]);fixture.doc.cards.push(added);
  fixture.emit([mutation([added])]);
  assert.equal(fixture.api().getRuntimeStatus().scanScheduled,true);
  assert.equal(fixture.api().getSnapshot().candidates,1);
  assert.equal(fixture.flush(),1);
  assert.equal(fixture.api().getSnapshot().candidates,2);
  assert.equal(fixture.api().getSnapshot().newCandidates,1);
});

test("mutation 폭주·다중 navigation 이벤트를 타이머 한 개로 합침", () => {
  const fixture=sandbox({cards:[card([link("/watch?v=one")])]});fixture.execute();
  const n=card([link("/watch?v=two")]);fixture.doc.cards.push(n);
  for(let i=0;i<60;i++)fixture.emit([mutation([n])]);
  fixture.doc.fire("yt-navigate-finish");
  fixture.doc.fire("yt-page-data-updated");
  fixture.windowEvents.fire("popstate");
  assert.equal(fixture.timers.size,1);
  assert.equal(fixture.doc.queryCount,1);
  fixture.flush();
  assert.equal(fixture.doc.queryCount,2);
  assert.equal(fixture.api().getSnapshot().candidates,2);
});

test("무관한 장식 DOM 변경은 재검색하지 않음", () => {
  const fixture=sandbox({cards:[card([link("/watch?v=one")])]});fixture.execute();
  const other=irrelevantNode();
  fixture.emit([mutation([other])]);fixture.emit([attrs(other,"href")]);
  fixture.emit([mutation([{nodeType:3}])]);
  assert.equal(fixture.timers.size,0);
  assert.equal(fixture.doc.queryCount,1);
});

test("삭제된 썸네일 참조 해제 및 이벤트 통지", () => {
  const old=card([link("/watch?v=one")]);const fixture=sandbox({cards:[old]});fixture.execute();
  const events=[];fixture.api().subscribe(x=>events.push(x));assert.equal(events[0].added.length,1);
  fixture.doc.cards=[];fixture.emit([mutation([], [old])]);fixture.flush();
  assert.equal(fixture.api().getSnapshot().candidates,0);
  assert.equal(fixture.api().getRuntimeStatus().trackedCandidates,0);
  assert.equal(events.at(-1).removed.length,1);
  assert.equal(events.at(-1).added.length,0);
});

test("동일 앵커 href 교체 시 신규 DOM로 착각하지 않고 updated 발행", () => {
  const a=link("/watch?v=one");const fixture=sandbox({cards:[card([a])]});fixture.execute();
  const events=[];fixture.api().subscribe(x=>events.push(x));
  a.href="/watch?v=two";fixture.emit([attrs(a)]);fixture.flush();
  const x=events.at(-1);
  assert.equal(x.updated.length,1);
  assert.equal(x.added.length,0);
  assert.equal(x.removed.length,0);
  assert.equal(fixture.api().getSnapshot().newCandidates,0);
  assert.equal(fixture.api().getSnapshot().seenTotal,1);
});

test("SPA HOME → WATCH → SEARCH: 미지원 페이지에서는 후보 해제, 복귀 시 재바인딩", () => {
  const original=card([link("/watch?v=old")]);const fixture=sandbox({cards:[original]});fixture.execute();
  const events=[];fixture.api().subscribe(x=>events.push(x));
  fixture.setPath("/watch");fixture.doc.fire("yt-navigate-finish");fixture.flush();
  assert.equal(fixture.api().getSnapshot().route,"UNSUPPORTED");
  assert.equal(fixture.api().getSnapshot().candidates,0);
  assert.equal(fixture.api().getRuntimeStatus().trackedCandidates,0);
  assert.equal(events.at(-1).removed.length,1);
  fixture.setPath("/results");fixture.doc.cards=[card([link("/watch?v=search")])];
  fixture.windowEvents.fire("popstate");fixture.flush();
  assert.equal(fixture.api().getSnapshot().route,"SEARCH");
  assert.equal(fixture.api().getSnapshot().candidates,1);
  assert.equal(events.at(-1).added.length,1);
});

test("href 없는 카드가 유효 링크로 변경되면 자동 재탐지", () => {
  const a=link(null);const fixture=sandbox({cards:[card([a])]});fixture.execute();
  assert.equal(fixture.api().getSnapshot().candidates,0);
  a.href="/watch?v=new";fixture.emit([attrs(a)]);fixture.flush();
  assert.equal(fixture.api().getSnapshot().candidates,1);
});

test("광고/Shorts 필터와 숨김 상태는 재탐지 이후에도 유지", () => {
  const normal=card([link("/watch?v=visible")]);
  const ad=card([link("/watch?v=ad")],{ad:true});
  const short=card([link("/shorts/test")]);
  const fixture=sandbox({cards:[normal,ad,short]});fixture.execute();
  assert.equal(fixture.api().getSnapshot().candidates,1);
  const newAd=card([link("/watch?v=promo")],{ad:true});
  fixture.doc.cards.push(newAd);fixture.emit([mutation([newAd])]);fixture.flush();
  assert.equal(fixture.api().getSnapshot().candidates,1);
});

test("DOMContentLoaded 이전 대기 및 재주입 시 네비게이션/observer 중복 등록 없음", () => {
  const fixture=sandbox({readyState:"loading",cards:[card([link("/watch?v=late")])]});
  fixture.execute();fixture.execute();
  assert.equal(fixture.observers.length,0);
  assert.equal(fixture.doc.count("DOMContentLoaded"),1);
  fixture.doc.fire("DOMContentLoaded");
  assert.equal(fixture.observers.length,1);
  assert.equal(fixture.doc.count("yt-navigate-finish"),1);
  assert.equal(fixture.windowEvents.count("popstate"),1);
});

test("dispose는 observer·pending timer·listeners·후보 참조를 정리", () => {
  const original=card([link("/watch?v=one")]);const fixture=sandbox({cards:[original]});fixture.execute();
  fixture.emit([mutation([original])]);assert.equal(fixture.timers.size,1);
  const oldApi=fixture.api();oldApi.dispose();oldApi.dispose();
  assert.equal(fixture.timers.size,0);
  assert.equal(fixture.observers[0].active,false);
  assert.equal(fixture.doc.count("yt-navigate-finish"),0);
  assert.equal(fixture.windowEvents.count("popstate"),0);
  assert.equal(oldApi.getRuntimeStatus().trackedCandidates,0);
  assert.equal(fixture.context.__yutopiaContentInitialized,false);
  assert.equal(fixture.api(),undefined);
  assert.equal(fixture.flush(),0);
  fixture.doc.readyState="complete";fixture.execute();
  assert.notEqual(fixture.api(),oldApi);
  assert.equal(fixture.observers.length,2);
});

test("오류를 던지는 구독자가 정상 구독자 및 탐지 루프를 막지 못함", () => {
  const fixture=sandbox({cards:[card([link("/watch?v=one")])]});fixture.execute();
  fixture.api().subscribe(()=>{throw Error("consumer exception")});
  let invoked=0;const unsub=fixture.api().subscribe(()=>invoked++);
  fixture.doc.cards.push(card([link("/watch?v=two")]));
  fixture.doc.fire("yt-page-data-updated");fixture.flush();
  assert.equal(fixture.api().getSnapshot().candidates,2);
  assert.equal(invoked,2);
  unsub();assert.equal(fixture.api().getRuntimeStatus().subscriberCount,1);
});

test("MutationObserver 부재 환경: 기본 스캔과 명시적 scan 사용 가능", () => {
  const fixture=sandbox({cards:[card([link("/watch?v=first")])],hasObserver:false});
  fixture.execute();assert.equal(fixture.api().getRuntimeStatus().observing,false);
  fixture.doc.cards.push(card([link("/watch?v=second")]));
  assert.equal(fixture.api().scan().candidates,2);
});
