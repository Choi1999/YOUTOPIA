/*
 * YUTOPIA Extension Shared Utilities — 로컬 MOCK 계약
 *
 * 목적: Content Script와 Side Panel이 서로 다른 환경에서 실행될 때
 *       공통 버전과 단순 입력 검증 규칙을 제공한다.
 * 주의: 이 파일은 브라우저 확장 전용이며 실제 YouTube API 호출을 하지 않는다.
 */
(function registerYutopiaShared(scope) {
  "use strict";

  const VERSION = "0.0.1-local-demo";

  /*
   * 텍스트를 UI/메시지에 쓰기 전 짧은 문자열로 정규화한다.
   * 문자열이 아니거나 빈 값이면 null을 반환한다.
   */
  function normalizedText(value, limit = 200) {
    if (typeof value !== "string") return null;
    const text = value.trim().slice(0, limit);
    return text.length ? text : null;
  }

  scope.YUTOPIA_SHARED = Object.freeze({
    VERSION,
    normalizedText,
  });
})(globalThis);
