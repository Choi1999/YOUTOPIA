/*
 * YUTOPIA Channel Identity Resolver — 작업 24 (로컬 DEMO)
 *
 * 목적: VIDEO와 독립적으로 YouTube 채널명/아바타 링크의 정체성을 구분한다.
 * 입력: 채널 href/anchor 또는 허용된 영상·채널 카드의 채널명 링크.
 * 출력: CHANNEL_ID 형식 확인 또는 HANDLE_UNRESOLVED(매핑 미확정).
 * 실패: 잘못된 호스트/ID/handle, 중첩 링크 충돌, 임의 별칭은 null.
 *
 * 중요:
 *   - /channel/UC...의 구조 검사는 온라인 채널 존재/소유권 증명이 아니다.
 *   - /@handle을 임의의 UC... ID로 생성하거나 targetId로 전달하지 않는다.
 *   - 댓글/API/LLM/브라우징 이력을 읽거나 전송·저장하지 않는다.
 *   - 실제 유효성·정책·인가·Hover/Side Panel 연결은 후속 단계이다.
 */
(function registerYutopiaChannelTargetResolver(scope) {
  "use strict";

  if (scope.YUTOPIA_CHANNEL_TARGET_RESOLVER) return;

  const ORIGIN = "https://www.youtube.com";
  const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
  // 보수적인 MVP ASCII handle 형식. 비라틴 문자 등은 추측하지 않고 유보한다.
  const HANDLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;
  const ALLOWED_TABS = new Set(["videos", "shorts", "streams", "playlists", "community", "about", "featured"]);
  const CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-channel-renderer",
    "ytd-grid-channel-renderer",
    "yt-lockup-view-model",
  ].join(", ");
  const LINK_SELECTOR = [
    "ytd-channel-name a[href]",
    "a#channel-name[href]",
    "a[href^='/channel/']",
    "a[href^='/@']",
    "a[href^='https://www.youtube.com/channel/']",
    "a[href^='https://www.youtube.com/@']",
  ].join(", ");
  const EXCLUDED_SELECTOR = [
    "ytd-ad-slot-renderer",
    "ytd-promoted-video-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "[is-promoted]",
    "[data-ad-slot]",
  ].join(", ");

  /*
   * URL 경로의 채널 식별 부분만 검사한다.
   * 출처는 정확히 www.youtube.com/HTTPS로 제한한다.
   * 영상 탭(/videos 등)은 정체성과 무관하지만, 임의의 추가 경로는 허용하지 않는다.
   */
  function parseIdentity(href) {
    if (typeof href !== "string" || !href || href.trim() !== href) return null;
    let url;
    try {
      url = new URL(href, typeof scope.location?.href === "string" ? scope.location.href : ORIGIN + "/");
    } catch (_error) {
      return null;
    }
    if (url.origin !== ORIGIN || url.username || url.password) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 1 || parts.length > 3 || url.pathname.includes("//")) return null;
    if (parts.length === 3 && !ALLOWED_TABS.has(parts[2])) return null;

    // 명시적인 percent-encoding/경로 트릭은 안전한 기본값인 거부를 선택한다.
    if (parts.some(part => part.includes("%"))) return null;

    if (parts[0] === "channel") {
      if (parts.length < 2 || !CHANNEL_ID_PATTERN.test(parts[1])) return null;
      if (parts.length > 2 && !ALLOWED_TABS.has(parts[2])) return null;
      const channelId = parts[1];
      return Object.freeze({
        targetType: "CHANNEL",
        identityType: "CHANNEL_ID",
        resolutionStatus: "ID_FORMAT_VALID",
        channelId,
        targetId: channelId,
        handle: null,
        source: "YOUTUBE",
        canonicalUrl: ORIGIN + "/channel/" + channelId,
      });
    }

    if (parts.length > 2 || !parts[0].startsWith("@")) return null;
    if (parts.length === 2 && !ALLOWED_TABS.has(parts[1])) return null;
    const value = parts[0].slice(1);
    if (!HANDLE_PATTERN.test(value)) return null;
    const handle = "@" + value;
    return Object.freeze({
      targetType: "CHANNEL",
      identityType: "HANDLE",
      resolutionStatus: "HANDLE_UNRESOLVED",
      channelId: null,
      targetId: null,
      handle,
      source: "YOUTUBE",
      canonicalUrl: ORIGIN + "/" + handle,
    });
  }

  function resolveFromHref(href) {
    return parseIdentity(href);
  }

  /*
   * DOM anchor의 원본 href 속성을 읽는다.
   * 핸들에 channelId를 결합하는 매핑이나 API 조회는 절대 수행하지 않는다.
   */
  function resolveFromAnchor(anchor) {
    if (!anchor || typeof anchor.getAttribute !== "function") return null;
    return resolveFromHref(anchor.getAttribute("href"));
  }

  /*
   * 같은 카드의 다른 채널 링크가 동일한지 보수적으로 검증한다.
   * @handle과 /channel/UC...가 함께 있을 때 두 값의 대응이 불확실하므로 유보한다.
   */
  function resolveCandidate(candidate) {
    if (!candidate || !candidate.channelLink) return null;
    const primary = resolveFromAnchor(candidate.channelLink);
    if (!primary) return null;
    const card = candidate.card;
    if (!card || typeof card.querySelectorAll !== "function") return primary;

    let anchors;
    try {
      anchors = card.querySelectorAll("a[href]");
    } catch (_error) {
      return null;
    }
    for (const anchor of anchors) {
      const href = anchor?.getAttribute?.("href");
      if (typeof href !== "string" || !href) continue;
      let url;
      try {
        url = new URL(href, typeof scope.location?.href === "string" ? scope.location.href : ORIGIN + "/");
      } catch (_error) {
        continue;
      }
      if (url.origin !== ORIGIN) continue;
      const isChannelLike = url.pathname.startsWith("/channel/") || url.pathname.startsWith("/@");
      if (!isChannelLike) continue;

      const other = resolveFromHref(href);
      if (!other) return null;
      if (other.identityType !== primary.identityType) return null;
      if (other.channelId !== primary.channelId || other.handle !== primary.handle) return null;
    }
    return primary;
  }

  /*
   * YouTube 홈·검색의 영상 카드에 붙은 채널명 링크 및 채널 검색 결과만 대상으로 한다.
   * 썸네일의 /watch 링크나 일반 YouTube 페이지 내 전역 링크 전체를 탐색하지 않는다.
   */
  function findCandidates(root = scope.document) {
    const path = scope.location?.pathname;
    if (path !== "/" && path !== "/results") return [];
    if (typeof root?.querySelectorAll !== "function") return [];

    const cards = root.querySelectorAll(CARD_SELECTOR);
    const seen = new WeakSet();
    const candidates = [];
    for (const card of cards) {
      if (card.closest?.(EXCLUDED_SELECTOR)) continue;
      if (card.matches?.("[hidden], [aria-hidden='true']")) continue;

      const links = card.querySelectorAll?.(LINK_SELECTOR) || [];
      for (const channelLink of links) {
        if (seen.has(channelLink)) continue;
        if (channelLink.closest?.(EXCLUDED_SELECTOR)) continue;

        const parsed = resolveFromAnchor(channelLink);
        if (!parsed) continue;
        seen.add(channelLink);
        candidates.push({
          card,
          channelLink,
          identity: resolveCandidate({ card, channelLink }),
        });
      }
    }
    return candidates;
  }

  /*
   * MutationObserver가 채널 전용 DOM의 삽입·제거를 감지하도록 지원한다.
   * 실제 감시기는 22번의 단일 관측기를 재사용하며 Observer를 추가 생성하지 않는다.
   */
  function isChannelNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.matches?.(CARD_SELECTOR) || node.closest?.(CARD_SELECTOR)) return true;
    if (node.matches?.("a[href^='/@'], a[href^='/channel/']")) return true;
    return Boolean(node.querySelector?.(CARD_SELECTOR) || node.querySelector?.(LINK_SELECTOR));
  }

  /*
   * 더보기/Side Panel으로 전송 가능한 안정된 식별자를 얻는 경계.
   * HANDLE_UNRESOLVED에서는 절대 임의 channelId를 제공하지 않는다.
   */
  function toIdentifiedTarget(identity) {
    if (
      !identity ||
      identity.targetType !== "CHANNEL" ||
      identity.identityType !== "CHANNEL_ID" ||
      identity.resolutionStatus !== "ID_FORMAT_VALID" ||
      !CHANNEL_ID_PATTERN.test(identity.channelId) ||
      identity.targetId !== identity.channelId
    ) return null;
    return Object.freeze({
      targetType: "CHANNEL",
      targetId: identity.channelId,
      source: "YOUTUBE",
    });
  }

  scope.YUTOPIA_CHANNEL_TARGET_RESOLVER = Object.freeze({
    resolveFromHref,
    resolveFromAnchor,
    resolveCandidate,
    findCandidates,
    isChannelNode,
    toIdentifiedTarget,
  });
})(globalThis);
