/**
 * YUTOPIA 작업 23 — 엄격한 videoId 식별·영상 카드 충돌 차단
 *
 * 실행: node --test extension/tests/video-target-resolver.test.cjs
 * 영상 ID의 문자열 형식만 확인한다. 온라인 존재·소유권/데이터 사용권은 검증하지 않는다.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const resolverSource = fs.readFileSync(path.join(__dirname, "..", "target-resolver.js"), "utf8");
const discoverySource = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
const ID = "Ab0_-123xyz";
const SECOND = "Ab0_-123xyZ";

function resolver() {
  const context = vm.createContext({
    URL,
    location: {pathname: "/", origin: "https://www.youtube.com", href: "https://www.youtube.com/"},
  });
  vm.runInContext(resolverSource, context, {filename: "target-resolver.js"});
  return context.YUTOPIA_VIDEO_TARGET_RESOLVER;
}

function anchor(href) {
  return {
    href,
    getAttribute(name) { return name === "href" ? this.href : null; },
    nodeType: 1,
    matches() { return true; },
    closest() { return null; },
  };
}

function candidate(primary, others = []) {
  const card = {
    nodeType: 1,
    closest() { return null; },
    matches() { return false; },
    querySelectorAll() { return [primary, ...others]; },
  };
  return {card, thumbnailLink: primary};
}

test("정규 단일 VIDEO target은 고정 필드와 canonical URL 제공", () => {
  const out = resolver().resolveFromHref("/watch?v=" + ID);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), {
    targetType: "VIDEO", targetId: ID, source: "YOUTUBE",
    canonicalUrl: "https://www.youtube.com/watch?v=" + ID,
  });
  assert.equal(Object.isFrozen(out), true);
});

test("HTTPS 절대 YouTube 주소와 추가 쿼리·fragment 허용, canonical은 정리", () => {
  const input = "https://www.youtube.com/watch?feature=share&v=" + ID + "&t=16#comments";
  assert.equal(resolver().resolveFromHref(input)?.canonicalUrl, "https://www.youtube.com/watch?v=" + ID);
});

test("퍼센트 인코딩은 한 번만 해석하고 비정규 문자 제거", () => {
  const raw = "/watch?v=" + ID.replace("-", "%2D");
  assert.equal(resolver().resolveFromHref(raw)?.targetId, ID);
  const doubleEncoded = "/watch?v=" + ID.replace("-", "%252D");
  assert.equal(resolver().resolveFromHref(doubleEncoded), null);
});

test("11자 미만·초과, 비영숫자·공백·Unicode videoId 차단", () => {
  for (const id of ["a", "1234567890", "123456789012", "a-+12345678", "가나다라마바사아자차카", "12345 789ab"]) {
    assert.equal(resolver().resolveFromHref("/watch?v=" + encodeURIComponent(id)), null, id);
  }
});

test("중복된 v 매개변수는 값이 서로 같아도 거부", () => {
  const r=resolver();
  for(const href of [
    "/watch?v=" + ID + "&v=" + ID,
    "/watch?v=" + ID + "&v=" + SECOND,
    "/watch?v=&v=" + ID,
  ]) assert.equal(r.resolveFromHref(href), null);
});

test("외부 도메인·유사 도메인·HTTP·모바일·단축 URL 거부", () => {
  const r=resolver();
  for(const href of [
    "https://example.org/watch?v=" + ID,
    "https://www.youtube.com.example.org/watch?v=" + ID,
    "http://www.youtube.com/watch?v=" + ID,
    "https://m.youtube.com/watch?v=" + ID,
    "https://youtu.be/" + ID,
    "https://youtube.com/watch?v=" + ID,
  ]) assert.equal(r.resolveFromHref(href), null);
});

test("계정명 사용자정보 URL 및 비정상 프로토콜 차단", () => {
  const r=resolver();
  for(const href of [
    "https://attacker@www.youtube.com/watch?v=" + ID,
    "javascript:alert(1)",
    "data:text/html,a",
    "file:///watch?v=" + ID,
    " https://www.youtube.com/watch?v=" + ID,
    "/watch?v=" + ID + " ",
  ]) assert.equal(r.resolveFromHref(href), null);
});

test("watch가 아닌 경로와 v 없는 쿼리 차단", () => {
  const r=resolver();
  for(const href of [
    "/shorts/" + ID, "/embed/" + ID, "/playlist?list=" + ID,
    "/watch/", "/watch", "/watch?x=" + ID, "/redirect?q=/watch?v=" + ID,
  ]) assert.equal(r.resolveFromHref(href), null);
});

test("숫자처럼 보이거나 기호로 구성된 11자 ID도 문법이 맞으면 수락", () => {
  const r=resolver();
  for(const id of ["12345678901", "___________", "-----------"]) {
    assert.equal(r.resolveFromHref("/watch?v=" + id)?.targetId, id);
  }
});

test("anchor 원본 href로 검증하며 누락된 DOM은 null", () => {
  const r=resolver();
  assert.equal(r.resolveFromAnchor(anchor("/watch?v=" + ID))?.targetId, ID);
  assert.equal(r.resolveFromAnchor({href:"/watch?v=" + ID}), null);
  assert.equal(r.resolveFromAnchor(null), null);
});

test("제목과 썸네일이 같은 영상이면 식별 성공", () => {
  const p=anchor("/watch?v=" + ID);
  const title=anchor("https://www.youtube.com/watch?feature=abc&v=" + ID);
  assert.equal(resolver().resolveCandidate(candidate(p,[title]))?.targetId, ID);
});

test("제목 링크와 썸네일이 서로 다른 영상이면 대상 확인 유보", () => {
  const a=anchor("/watch?v=" + ID);
  const title=anchor("/watch?v=" + SECOND);
  assert.equal(resolver().resolveCandidate(candidate(a,[title])), null);
});

test("동일 카드에 잘못된 /watch 링크가 있으면 대상으로 채택하지 않음", () => {
  const a=anchor("/watch?v=" + ID);
  const invalid=anchor("/watch?v=bad");
  assert.equal(resolver().resolveCandidate(candidate(a,[invalid])), null);
});

test("채널 링크는 비디오 ID 불일치로 간주하지 않음", () => {
  const a=anchor("/watch?v=" + ID);
  const channel=anchor("/@somechannel");
  assert.equal(resolver().resolveCandidate(candidate(a,[channel]))?.targetId, ID);
});

test("thumbnail에 ID가 없으면 card에 정상 영상 링크가 있어도 무조건 거부", () => {
  assert.equal(resolver().resolveCandidate(candidate(anchor("/watch?v=bad"),[anchor("/watch?v=" + ID)])),null);
});

test("정상 target의 변경은 별도의 새 VIDEO 식별자로 반영", () => {
  const a=anchor("/watch?v=" + ID);
  assert.equal(resolver().resolveFromAnchor(a)?.targetId,ID);
  a.href="/watch?v=" + SECOND;
  assert.equal(resolver().resolveFromAnchor(a)?.targetId,SECOND);
});

test("resolver 재주입 시 동일 싱글턴 API 유지", () => {
  const context = vm.createContext({URL,location:{href:"https://www.youtube.com/",origin:"https://www.youtube.com"}});
  vm.runInContext(resolverSource,context);
  const first = context.YUTOPIA_VIDEO_TARGET_RESOLVER;
  vm.runInContext(resolverSource,context);
  assert.equal(context.YUTOPIA_VIDEO_TARGET_RESOLVER, first);
});

test("Content Script의 added 이벤트에서 VIDEO target 전달, 탐지 범위는 유지", () => {
  const link=anchor("/watch?v=" + ID), c=candidate(link);
  const doc={
    readyState:"complete",
    documentElement:{},
    querySelectorAll(){return [c.card]},
    addEventListener(){},
  };
  const ctx=vm.createContext({
    URL, document:doc,
    location:{pathname:"/",origin:"https://www.youtube.com",href:"https://www.youtube.com/"},
    addEventListener(){},
  });
  vm.runInContext(resolverSource,ctx);
  vm.runInContext(discoverySource,ctx);
  const api=ctx.YUTOPIA_VIDEO_DISCOVERY;
  const events=[];
  api.subscribe(x=>events.push(x));
  assert.equal(api.getSnapshot().candidates,1);
  assert.equal(api.getRuntimeStatus().identifiedCandidates,1);
  assert.equal(events[0].added[0].target.targetId,ID);
});

test("모순된 card라도 후보 탐지는 유지하고 target만 null로 제한", () => {
  const good=anchor("/watch?v=" + ID);
  const c=candidate(good,[anchor("/watch?v=" + SECOND)]);
  const doc={readyState:"complete",documentElement:{},querySelectorAll(){return [c.card]},addEventListener(){}};
  const ctx=vm.createContext({URL,document:doc,location:{pathname:"/",origin:"https://www.youtube.com",href:"https://www.youtube.com/"},addEventListener(){}});
  vm.runInContext(resolverSource,ctx);vm.runInContext(discoverySource,ctx);
  const api=ctx.YUTOPIA_VIDEO_DISCOVERY;
  const events=[];api.subscribe(x=>events.push(x));
  assert.equal(api.getSnapshot().candidates,1);
  assert.equal(api.getRuntimeStatus().identifiedCandidates,0);
  assert.equal(events[0].added[0].target,null);
});


test("제목 링크가 다른 영상으로 바뀌면 같은 DOM 요소도 updated + target null", () => {
  const thumb=anchor("/watch?v=" + ID),title=anchor("/watch?v=" + ID);
  const c=candidate(thumb,[title]);
  const doc={readyState:"complete",documentElement:{},querySelectorAll(){return [c.card]},addEventListener(){}};
  const ctx=vm.createContext({URL,document:doc,location:{pathname:"/",origin:"https://www.youtube.com",href:"https://www.youtube.com/"},addEventListener(){}});
  vm.runInContext(resolverSource,ctx);vm.runInContext(discoverySource,ctx);
  const api=ctx.YUTOPIA_VIDEO_DISCOVERY,events=[];
  api.subscribe(x=>events.push(x));
  assert.equal(events[0].added[0].target.targetId,ID);
  title.href="/watch?v=" + SECOND;
  api.scan();
  assert.equal(events.at(-1).updated.length,1);
  assert.equal(events.at(-1).updated[0].target,null);
  assert.equal(api.getRuntimeStatus().identifiedCandidates,0);
});

test("모순된 제목 링크가 복구되면 기존 DOM에서 VIDEO 식별 회복", () => {
  const thumb=anchor("/watch?v=" + ID),title=anchor("/watch?v=" + SECOND);
  const c=candidate(thumb,[title]);
  const doc={readyState:"complete",documentElement:{},querySelectorAll(){return [c.card]},addEventListener(){}};
  const ctx=vm.createContext({URL,document:doc,location:{pathname:"/",origin:"https://www.youtube.com",href:"https://www.youtube.com/"},addEventListener(){}});
  vm.runInContext(resolverSource,ctx);vm.runInContext(discoverySource,ctx);
  const api=ctx.YUTOPIA_VIDEO_DISCOVERY,events=[];
  api.subscribe(x=>events.push(x));
  assert.equal(events[0].added[0].target,null);
  title.href="/watch?v=" + ID;
  api.scan();
  assert.equal(events.at(-1).updated.length,1);
  assert.equal(events.at(-1).updated[0].target.targetId,ID);
  assert.equal(api.getRuntimeStatus().identifiedCandidates,1);
});
