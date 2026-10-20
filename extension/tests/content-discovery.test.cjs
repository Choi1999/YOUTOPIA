/**
 * YUTOPIA 작업 21 — DOM Fixture 테스트 (Node.js 표준 라이브러리만 사용)
 * 명령: node --test extension/tests/content-discovery.test.cjs
 * 실제 YouTube 또는 Chrome 확장 브라우저 E2E의 성공 증거는 아니다.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");

function link(href, ad = false) {
  return {
    getAttribute(name) { return name === "href" ? href : null; },
    closest() { return ad ? {} : null; },
  };
}

function card(links, opts = {}) {
  return {
    links,
    closest() { return opts.ad ? {} : null; },
    matches() { return Boolean(opts.hidden); },
    querySelectorAll() { return this.links; },
  };
}

function sandbox({pathname = "/", cards = [], readyState = "complete"} = {}) {
  const listeners = new Map();
  const doc = {
    readyState,
    cards,
    queries: 0,
    querySelectorAll() { this.queries += 1; return this.cards; },
    addEventListener(type, handler, options) {
      const registered = listeners.get(type) || [];
      registered.push({ handler, options });
      listeners.set(type, registered);
    },
    fire(type) { for (const listener of listeners.get(type) || []) listener.handler(); },
    count(type) { return (listeners.get(type) || []).length; },
  };
  const context = vm.createContext({
    document: doc,
    location: { pathname, origin: "https://www.youtube.com", href: "https://www.youtube.com" + pathname },
    URL,
  });
  const execute = () => vm.runInContext(source, context, {filename:"content.js"});
  return {context,doc,execute,api:()=>context.YUTOPIA_VIDEO_DISCOVERY};
}

test("HOME: 일반 영상 썸네일 2개를 읽기 전용으로 탐지", () => {
  const valid = [card([link("/watch?v=homeA")]), card([link("/watch?v=homeB")])];
  const fixture = sandbox({cards:valid});fixture.execute();
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.api().getSnapshot())), {
    route:"HOME", candidates:2, newCandidates:2, seenTotal:2, scanCount:1,
  });
  assert.equal(fixture.api().findCandidates()[0].card, valid[0]);
  assert.equal(fixture.doc.cards.length,2);
});

test("SEARCH: 일반 영상과 절대 YouTube watch 주소 감지", () => {
  const fixture = sandbox({pathname:"/results",cards:[card([link("https://www.youtube.com/watch?v=resultA")]) ]});
  fixture.execute();assert.equal(fixture.api().getSnapshot().route,"SEARCH");
  assert.equal(fixture.api().getSnapshot().candidates,1);
});

test("광고·숨겨진 카드·Shorts·외부 도메인·빈 ID 제외", () => {
  const fixture = sandbox({cards:[
    card([link("/watch?v=ad")],{ad:true}),card([link("/watch?v=hidden")],{hidden:true}),
    card([link("/shorts/s123")]),card([link("https://example.com/watch?v=foreign")]),
    card([link("/watch?v=")]),card([link("javascript:alert(1)")]),card([link("/watch?v=ok")]),
    card([link("/watch?v=linkAd",true)]),
  ]}); fixture.execute();assert.equal(fixture.api().getSnapshot().candidates,1);
});

test("카드 내부에 중첩 렌더러가 있어도 같은 링크는 한 번만 처리", () => {
  const oneLink = link("/watch?v=unique");
  const fixture = sandbox({cards:[card([oneLink]),card([oneLink])]});
  fixture.execute();assert.equal(fixture.api().getSnapshot().candidates,1);
});

test("동일 스크립트 재실행 시 초기화·리스너·탐지 중복 없음", () => {
  const fixture = sandbox({cards:[card([link("/watch?v=same")])]});
  fixture.execute();const api=fixture.api();fixture.execute();
  assert.equal(fixture.api(),api);assert.equal(fixture.doc.queries,1);
  assert.equal(api.getSnapshot().seenTotal,1);
});

test("DOMContentLoaded 이전에는 탐지하지 않고 1회만 등록", () => {
  const fixture = sandbox({readyState:"loading",cards:[card([link("/watch?v=late")])]});
  fixture.execute();fixture.execute();assert.equal(fixture.doc.count("DOMContentLoaded"),1);
  assert.equal(fixture.api().getSnapshot().route,"NOT_SCANNED");
  fixture.doc.fire("DOMContentLoaded");assert.equal(fixture.api().getSnapshot().candidates,1);
});

test("SPA 대응 전 단계의 명시적 재탐지: 새 후보만 누적", () => {
  const first=card([link("/watch?v=first")]);const fixture=sandbox({cards:[first]});
  fixture.execute();assert.equal(fixture.api().scan().newCandidates,0);
  fixture.doc.cards.push(card([link("/watch?v=second")]));
  const now=fixture.api().scan();assert.equal(now.candidates,2);
  assert.equal(now.newCandidates,1);assert.equal(now.seenTotal,2);assert.equal(now.scanCount,3);
});

test("Shorts/동영상 재생 화면에서는 탐지하지 않음", () => {
  for (const pathname of ["/watch", "/shorts/abc", "/feed/subscriptions", "/playlist"]) {
    const fixture=sandbox({pathname,cards:[card([link("/watch?v=skip")])]});
    fixture.execute();assert.equal(fixture.api().getSnapshot().route,"UNSUPPORTED");
    assert.equal(fixture.api().getSnapshot().candidates,0);
    assert.equal(fixture.doc.queries,0);
  }
});

test("후보 링크를 찾지 못했을 때 다른 부수 효과 없이 0건", () => {
  const fixture=sandbox({cards:[card([])]});fixture.execute();
  assert.equal(fixture.api().getSnapshot().candidates,0);
  assert.equal(fixture.doc.count("DOMContentLoaded"),0);
});
