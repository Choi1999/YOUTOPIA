/*
 * YUTOPIA YouTube Content Script — 작업 21: 영상 목록 요소 탐지
 *
 * 목적:
 *   - YouTube 홈/검색에서 일반 영상 썸네일 요소를 찾는다.
 *   - 같은 탭에 재주입돼도 초기화·이벤트 연결을 중복하지 않는다.
 *   - 원본 페이지 DOM·재생·클릭 동작은 수정하지 않는다.
 *
 * 입력: 현재 문서의 영상 렌더러/썸네일 링크(읽기 전용).
 * 출력: 콘텐츠 스크립트 격리 영역의 탐지 요약과 후보 DOM 참조.
 * 실패: 지원하지 않는 경로, 빈 href, 광고/Shorts, 외부 링크는 후보에서 제외.
 * 보안: 원문 댓글·시청 기록·텍스트 메타데이터를 저장/전송하지 않는다.
 *
 * 다음 작업:
 *   - 22: SPA 탐지와 MutationObserver를 통한 재검색.
 *   - 23: 정확한 videoId 검증.
 *   - 25~28: Hover 표시 및 Side Panel 메시지.
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

  const seenLinks = new WeakSet();
  let totalDiscovered = 0;
  let scanCount = 0;
  let snapshot = Object.freeze({
    route: "NOT_SCANNED",
    candidates: 0,
    newCandidates: 0,
    seenTotal: 0,
    scanCount: 0,
  });

  /*
   * 페이지 영역별 허용 경로.
   * YouTube watch/Shorts/Studio 등은 작업 21의 범위에 포함하지 않는다.
   */
  function currentRoute() {
    const path = scope.location?.pathname;
    if (path === "/") return "HOME";
    if (path === "/results") return "SEARCH";
    return "UNSUPPORTED";
  }

  /*
   * 탐지용 링크가 동일 YouTube 출처의 영상 보기 링크인지 확인한다.
   * videoId의 정확한 길이·문자열·채널 매핑은 작업 23에서 별도 검증한다.
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
   * 광고·Shorts·중첩 중복을 제외한 일반 영상 후보만 수집한다.
   * 결과에는 제목·댓글·사용자 정보가 없으며 DOM 읽기만 수행한다.
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
   * 최초 렌더링 탐지와 후속 명시적 재검사에 사용하는 읽기 전용 API.
   * MutationObserver와 SPA 경로 이벤트 연결은 작업 22에서 구현한다.
   */
  function scan() {
    const candidates = findCandidates();
    let newCandidates = 0;
    for (const { thumbnailLink } of candidates) {
      if (seenLinks.has(thumbnailLink)) continue;
      seenLinks.add(thumbnailLink);
      newCandidates += 1;
    }
    totalDiscovered += newCandidates;
    scanCount += 1;
    snapshot = Object.freeze({
      route: currentRoute(),
      candidates: candidates.length,
      newCandidates,
      seenTotal: totalDiscovered,
      scanCount,
    });
    return { ...snapshot };
  }

  // 이 객체는 Chrome의 격리된 콘텐츠 스크립트 세계에만 존재한다.
  scope.YUTOPIA_VIDEO_DISCOVERY = Object.freeze({
    findCandidates,
    scan,
    getSnapshot: () => ({ ...snapshot }),
  });

  if (scope.document?.readyState === "loading") {
    scope.document.addEventListener("DOMContentLoaded", scan, { once: true });
  } else {
    scan();
  }
})(globalThis);
