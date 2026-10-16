/*
 * YUTOPIA YouTube Content Script — 20번 스켈레톤
 *
 * 목적: YouTube 홈페이지에 안전하게 주입되는 로컬 확장 진입점.
 * 사용자에게 카드가 보이는 기능은 21~29 단계에서 추가한다.
 * 외부 API 호출 및 원문 댓글 수집을 하지 않는다.
 */
(function initializeYutopia() {
  "use strict";

  if (globalThis.__yutopiaContentInitialized) return;
  globalThis.__yutopiaContentInitialized = true;
  // DOM과 플레이어를 변경하지 않는 초기화만 수행한다.
})();
