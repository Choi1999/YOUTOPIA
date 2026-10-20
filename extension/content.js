/*
 * YUTOPIA YouTube Content Script — 작업 21·22: DOM 탐지 및 SPA 자동 갱신
 *
 * 목적:
 *   - YouTube 홈·검색의 일반 영상 렌더러를 읽기 전용으로 탐지한다.
 *   - SPA 이동·무한 스크롤·썸네일 교체 후 후보를 안전하게 재탐지한다.
 *   - 삭제/교체된 DOM 참조를 정리하고 향후 Hover 구독자가 해제할 수 있게 한다.
 *
 * 입력: 현재 문서의 영상 렌더러, MutationObserver, YouTube 경로 전환 이벤트.
 * 출력: 격리된 콘텐츠 스크립트의 후보/변경 이벤트 및 숫자 요약.
 * 실패: 미지원 경로·외부 링크·광고·Shorts는 후보에서 제외.
 * 보안: DOM을 변경하지 않고 실제 댓글/API/원문·시청 기록을 수집/전송하지 않는다.
 *
 * 다음 단계: 23 videoId 엄격 검증, 24 channelId 매핑, 25 Hover 상태 제어.
 */
(function initializeYutopiaContent(scope) {
  "use strict";

  if (scope.__yutopiaContentInitialized) return;
  scope.__yutopiaContentInitialized = true;

  const CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "yt-lockup-view-model",
  ].join(", ");

  const LINK_SELECTOR = [
    "a#thumbnail[href]",
    "a.yt-lockup-view-model__content-image[href]",
    "a[href^='/watch?']",
    "a[href^='https://www.youtube.com/watch?']",
  ].join(", ");

  const EXCLUDED_SELECTOR = [
    "ytd-ad-slot-renderer",
    "ytd-promoted-video-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-reel-shelf-renderer",
    "ytd-rich-shelf-renderer",
    "ytd-shorts-lockup-view-model",
    "[is-promoted]",
    "[data-ad-slot]",
  ].join(", ");

  const NAVIGATION_EVENTS = ["yt-navigate-finish", "yt-page-data-updated"];
  const MUTATION_ATTRIBUTES = ["href", "hidden", "aria-hidden", "is-promoted", "data-ad-slot"];
  const SCAN_DEBOUNCE_MS = 120;

  const seenLinks = new WeakSet();
  const subscribers = new Set();
  let liveCandidates = new Map();
  let totalDiscovered = 0;
  let scanCount = 0;
  let observer = null;
  let pendingTimer = null;
  let started = false;
  let disposed = false;
  let snapshot = Object.freeze({
    route: "NOT_SCANNED",
    candidates: 0,
    newCandidates: 0,
    seenTotal: 0,
    scanCount: 0,
  });

  /*
   * 홈·검색 외에는 후보를 0건으로 처리한다.
   * URL 내 query는 라우트 구분에 사용하지 않고, ID 계약은 23번에서 검증한다.
   */
  function currentRoute() {
    const path = scope.location?.pathname;
    if (path === "/") return "HOME";
    if (path === "/results") return "SEARCH";
    return "UNSUPPORTED";
  }

  /*
   * 동일 YouTube 출처의 /watch?v=... 형태만 후보로 허용.
   * 이는 영상 ID의 존재를 추측하는 필터이며 ID의 정확성을 인증하지 않는다.
   */
  function isWatchLink(anchor) {
    const href = anchor?.getAttribute?.("href");
    if (typeof href !== "string" || href.length === 0) return false;
    try {
      const url = new URL(href, scope.location.href);
      return url.origin === scope.location.origin &&
        url.pathname === "/watch" &&
        Boolean(url.searchParams.get("v")?.trim());
    } catch (_error) {
      return false;
    }
  }

  /*
   * 광고/Shorts 및 중첩 렌더러의 중복 링크를 제외한다.
   * DOM 카드와 링크를 반환하며 원문 텍스트나 사용자 메타데이터를 읽지 않는다.
   */
  function findCandidates(root = scope.document) {
    if (currentRoute() === "UNSUPPORTED" || typeof root?.querySelectorAll !== "function") {
      return [];
    }
    const cards = root.querySelectorAll(CARD_SELECTOR);
    const currentLinks = new WeakSet();
    const candidates = [];

    for (const card of cards) {
      if (card.closest?.(EXCLUDED_SELECTOR)) continue;
      if (card.matches?.("[hidden], [aria-hidden='true']")) continue;

      const anchors = card.querySelectorAll?.(LINK_SELECTOR) || [];
      for (const link of anchors) {
        if (link.closest?.(EXCLUDED_SELECTOR)) continue;
        if (!isWatchLink(link)) continue;
        if (!currentLinks.has(link)) {
          currentLinks.add(link);
          candidates.push({ card, thumbnailLink: link });
        }
        break;
      }
    }
    return candidates;
  }

  /*
   * 현재 DOM 참조 Map을 통째로 갱신하므로 제거된 썸네일에 대한 강한 참조가 남지 않는다.
   * added/removed/updated는 향후 Hover 리스너 등록/해제(25번)의 연결점이다.
   * 같은 링크 요소에서 href만 바뀐 경우 updated로 명확히 통지한다.
   */
  function scan() {
    if (disposed) return { ...snapshot };

    const candidates = findCandidates();
    const next = new Map();
    const added = [];
    const removed = [];
    const updated = [];
    let newCandidates = 0;

    for (const candidate of candidates) {
      const anchor = candidate.thumbnailLink;
      const entry = {
        card: candidate.card,
        thumbnailLink: anchor,
        href: anchor.getAttribute("href"),
      };
      next.set(anchor, entry);
      const previous = liveCandidates.get(anchor);

      if (!previous) added.push(entry);
      else if (previous.href !== entry.href || previous.card !== entry.card) updated.push(entry);

      if (!seenLinks.has(anchor)) {
        seenLinks.add(anchor);
        newCandidates += 1;
      }
    }

    for (const [anchor, previous] of liveCandidates) {
      if (!next.has(anchor)) removed.push(previous);
    }
    liveCandidates = next;
    totalDiscovered += newCandidates;
    scanCount += 1;
    snapshot = Object.freeze({
      route: currentRoute(),
      candidates: candidates.length,
      newCandidates,
      seenTotal: totalDiscovered,
      scanCount,
    });

    if (added.length || removed.length || updated.length) {
      for (const subscriber of [...subscribers]) {
        try {
          subscriber({ added, removed, updated, snapshot: { ...snapshot } });
        } catch (_error) {
          // 다른 소비자의 오류로 탐지기나 나머지 구독자를 중단하지 않는다.
        }
      }
    }
    return { ...snapshot };
  }

  /*
   * 관련 후보/링크를 포함하는 DOM 변화만 재탐지한다.
   * YouTube 추천 카드 이외의 페이지 장식 변화는 불필요한 전역 재스캔을 유발하지 않는다.
   */
  function isCandidateNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.matches?.(CARD_SELECTOR) || node.closest?.(CARD_SELECTOR)) return true;
    if (node.matches?.("a[href], " + EXCLUDED_SELECTOR)) return true;
    return Boolean(node.querySelector?.(CARD_SELECTOR));
  }

  function hasRelevantMutation(records) {
    for (const record of records) {
      if (record.type === "attributes") {
        if (isCandidateNode(record.target)) return true;
        continue;
      }
      if (record.type !== "childList") continue;
      for (const node of record.addedNodes || []) {
        if (isCandidateNode(node)) return true;
      }
      for (const node of record.removedNodes || []) {
        if (isCandidateNode(node)) return true;
      }
    }
    return false;
  }

  /*
   * 대량 Mutation/복수 navigation 이벤트를 120ms 한 번의 재스캔으로 합친다.
   * 타이머는 탭당 최대 1개이며 dispose()에서 해제한다.
   */
  function scheduleScan() {
    if (disposed || !started || pendingTimer !== null) return;
    if (typeof scope.setTimeout !== "function") {
      scan();
      return;
    }
    pendingTimer = scope.setTimeout(() => {
      pendingTimer = null;
      if (!disposed) scan();
    }, SCAN_DEBOUNCE_MS);
  }

  function handleMutation(records) {
    if (hasRelevantMutation(records)) scheduleScan();
  }

  function handleNavigation() {
    scheduleScan();
  }

  /*
   * 22번은 동적 후보 변경을 알리기만 한다. 실제 카드/Hover 이벤트는 바인딩하지 않는다.
   * 가입 시 현재 후보를 initial added로 한번 보내 늦게 가입한 소비자도 따라갈 수 있다.
   */
  function subscribe(listener) {
    if (disposed) throw new Error("YUTOPIA discovery disposed");
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    subscribers.add(listener);
    try {
      listener({ added: [...liveCandidates.values()], removed: [], updated: [], snapshot: { ...snapshot } });
    } catch (_error) {
      // 소비자 초기 렌더링 오류가 탐지기 등록을 무효화하지 않도록 한다.
    }
    return () => subscribers.delete(listener);
  }

  /*
   * 개발 환경의 재주입/탭 종료를 위한 명시적 정리 함수.
   * observer, 타이머, 이벤트, DOM 참조 및 구독자를 해제한 뒤 재초기화 허용.
   */
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (pendingTimer !== null) scope.clearTimeout?.(pendingTimer);
    pendingTimer = null;
    observer?.disconnect();
    observer = null;
    scope.document?.removeEventListener?.("DOMContentLoaded", start);
    for (const eventName of NAVIGATION_EVENTS) {
      scope.document?.removeEventListener?.(eventName, handleNavigation);
      scope.removeEventListener?.(eventName, handleNavigation);
    }
    scope.removeEventListener?.("popstate", handleNavigation);
    liveCandidates.clear();
    subscribers.clear();
    scope.__yutopiaContentInitialized = false;
    if (scope.YUTOPIA_VIDEO_DISCOVERY === api) delete scope.YUTOPIA_VIDEO_DISCOVERY;
  }

  function getRuntimeStatus() {
    return {
      started,
      disposed,
      observing: Boolean(observer),
      scanScheduled: pendingTimer !== null,
      trackedCandidates: liveCandidates.size,
      subscriberCount: subscribers.size,
    };
  }

  function start() {
    if (started || disposed) return;
    started = true;
    scan();

    if (typeof scope.MutationObserver === "function" && scope.document?.documentElement) {
      observer = new scope.MutationObserver(handleMutation);
      observer.observe(scope.document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: MUTATION_ATTRIBUTES,
      });
    }
    for (const eventName of NAVIGATION_EVENTS) {
      scope.document?.addEventListener?.(eventName, handleNavigation);
      scope.addEventListener?.(eventName, handleNavigation);
    }
    scope.addEventListener?.("popstate", handleNavigation);
  }

  const api = Object.freeze({
    findCandidates,
    scan,
    getSnapshot: () => ({ ...snapshot }),
    getRuntimeStatus,
    subscribe,
    dispose,
  });

  // 이 API는 Content Script의 격리된 세계에 존재하며 페이지 window에 직접 노출되지 않는다.
  scope.YUTOPIA_VIDEO_DISCOVERY = api;
  if (scope.document?.readyState === "loading") {
    scope.document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(globalThis);
