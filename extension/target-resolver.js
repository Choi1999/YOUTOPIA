/*
 * YUTOPIA YouTube Video Target Resolver — 작업 23
 *
 * 목적: YouTube 홈/검색에서 발견한 썸네일 후보를 신뢰 가능한 VIDEO 식별자로 제한.
 * 입력: href 문자열 또는 DOM anchor, 카드/썸네일 후보.
 * 출력: targetType/targetId/source/canonicalUrl 또는 null(거부·불확실).
 * 실패: 오인 가능한 URL/중복 v/ID 형식/링크 불일치 -> null.
 * 제한: 11자 base64url 형식 검증은 ID 존재·YouTube 소유권의 온라인 검증이 아니다.
 * 보안: fetch, API, 댓글, 브라우징 기록 수집, DOM 수정 없음.
 */
(function registerYutopiaVideoTargetResolver(scope) {
  "use strict";

  if (scope.YUTOPIA_VIDEO_TARGET_RESOLVER) return;

  const YOUTUBE_ORIGIN = "https://www.youtube.com";
  const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

  /*
   * 정규화된 단일 v 파라미터를 가진 https://www.youtube.com/watch URL만 수락.
   * URLSearchParams는 percent-encoding을 한 번 처리하며, 추가 수동 decode를 하지 않는다.
   * 중복 v와 사용자 정보 포함 URL은 혼동 가능성이 있으므로 거부한다.
   */
  function resolveFromHref(href) {
    if (typeof href !== "string" || !href.trim() || href !== href.trim()) return null;
    let parsed;
    try {
      const base = typeof scope.location?.href === "string" ? scope.location.href : YOUTUBE_ORIGIN + "/";
      parsed = new URL(href, base);
    } catch (_error) {
      return null;
    }
    if (
      parsed.origin !== YOUTUBE_ORIGIN ||
      parsed.pathname !== "/watch" ||
      parsed.username ||
      parsed.password
    ) return null;

    const values = parsed.searchParams.getAll("v");
    if (values.length !== 1 || !VIDEO_ID_PATTERN.test(values[0])) return null;

    const targetId = values[0];
    return Object.freeze({
      targetType: "VIDEO",
      targetId,
      source: "YOUTUBE",
      canonicalUrl: YOUTUBE_ORIGIN + "/watch?v=" + targetId,
    });
  }

  /*
   * anchor 값은 브라우저의 자동 URL 정규화 속성 대신 원본 href attribute로 확인한다.
   */
  function resolveFromAnchor(anchor) {
    if (!anchor || typeof anchor.getAttribute !== "function") return null;
    return resolveFromHref(anchor.getAttribute("href"));
  }

  /*
   * 썸네일과 같은 카드 내 다른 영상 링크가 서로 다른 영상 ID를 가리키면 유보.
   * title 링크·thumbnail 링크의 교차 오인으로 잘못된 상세 패널을 열지 않는다.
   * 채널·메뉴·검색 링크처럼 /watch가 아닌 주소는 비교에서 제외한다.
   */
  function resolveCandidate(candidate) {
    if (!candidate || !candidate.thumbnailLink) return null;
    const primary = resolveFromAnchor(candidate.thumbnailLink);
    if (!primary) return null;
    const card = candidate.card;
    if (!card || typeof card.querySelectorAll !== "function") return primary;

    let allAnchors;
    try {
      allAnchors = card.querySelectorAll("a[href]");
    } catch (_error) {
      return null;
    }
    for (const anchor of allAnchors) {
      const href = anchor?.getAttribute?.("href");
      if (typeof href !== "string" || !href) continue;
      let url;
      try {
        const base = typeof scope.location?.href === "string" ? scope.location.href : YOUTUBE_ORIGIN + "/";
        url = new URL(href, base);
      } catch (_error) {
        continue;
      }
      if (url.origin !== YOUTUBE_ORIGIN || url.pathname !== "/watch") continue;
      const other = resolveFromHref(href);
      if (!other || other.targetId !== primary.targetId) return null;
    }
    return primary;
  }

  scope.YUTOPIA_VIDEO_TARGET_RESOLVER = Object.freeze({
    resolveFromHref,
    resolveFromAnchor,
    resolveCandidate,
  });
})(globalThis);
