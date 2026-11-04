
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
  const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

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

  /*
   * YU-35: 확정된 VIDEO 선택만 Web 비교 화면의 임시 목록으로 전달한다.
   * 선택 ID 하나만 URL 쿼리에 넣으며 실제 분석/수집 작업은 실행하지 않는다.
   * 다른 유형이나 불량 ID에서는 링크를 생성하지 않는다.
   */
  function buildCompareUrl(targetType, targetId) {
    if (
      targetType !== "VIDEO" ||
      typeof targetId !== "string" ||
      !VIDEO_ID_PATTERN.test(targetId)
    ) return null;

    return BASE_URL + "/analysis/youtube/compare?video=" +
      encodeURIComponent(targetId);
  }

  // The two IDs and A/B order alone enter a localhost DEMO comparison URL.
  function buildComparePairUrl(ids) {
    if (!Array.isArray(ids) || ids.length !== 2 ||
        ids[0] === ids[1] ||
        ids.some(id => typeof id !== "string" || !VIDEO_ID_PATTERN.test(id))) {
      return null;
    }
    return BASE_URL + "/analysis/youtube/compare?video=" +
      encodeURIComponent(ids[0]) + "&video=" + encodeURIComponent(ids[1]);
  }

  /*
   * YU-46: a verified clicked CHANNEL target only becomes a route link.
   * The Web endpoint itself is fail-closed for unregistered channel manifests.
   * Never claim the channel is analyzed merely because the ID has valid syntax.
   */
  function buildChannelUrl(targetType, channelId) {
    if (
      targetType !== "CHANNEL" ||
      typeof channelId !== "string" ||
      !CHANNEL_ID_PATTERN.test(channelId)
    ) return null;

    return BASE_URL + "/analysis/youtube/channel/" + channelId;
  }

  scope.YUTOPIA_WEB_ANALYSIS_LINK =
    Object.freeze({ buildVideoUrl, buildCompareUrl, buildComparePairUrl, buildChannelUrl });
})(globalThis);
