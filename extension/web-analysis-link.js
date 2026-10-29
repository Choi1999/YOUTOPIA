
/**
 * YOUTOPIA Chrome Side Panel → Web 상세 분석 링크.
 *
 * 로컬 개발 전용이며 실제 서버 URL은 연결하지 않는다.
 * 유효한 VIDEO ID만 URL로 변환한다.
 * @handle, CHANNEL, 잘못된 ID는 거부한다.
 */
(function registerWebAnalysisLink(scope) {
  "use strict";

  if (scope.YUTOPIA_WEB_ANALYSIS_LINK) return;

  const BASE_URL = "http://localhost:5173";
  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

  function buildVideoUrl(targetType, targetId) {
    if (
      targetType !== "VIDEO" ||
      typeof targetId !== "string" ||
      !VIDEO_ID_PATTERN.test(targetId)
    ) {
      return null;
    }

    return (
      BASE_URL +
      "/analysis/youtube/video/" +
      targetId
    );
  }

  scope.YUTOPIA_WEB_ANALYSIS_LINK =
    Object.freeze({ buildVideoUrl });
})(globalThis);
