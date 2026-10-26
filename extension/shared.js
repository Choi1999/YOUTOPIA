/*
 * YUTOPIA Extension Shared Utilities — local MOCK contract
 * No network request, YouTube comment, or user data is used.
 */
(function registerYutopiaShared(scope) {
  "use strict";
  if (scope.YUTOPIA_SHARED) return;
  const VERSION = "0.0.1-local-demo";
  const MESSAGE_VERSION = 1;
  const REQUEST_TYPE = "YUTOPIA_MOCK_PREVIEW_GET_V1";
  const RESPONSE_TYPE = "YUTOPIA_MOCK_PREVIEW_RESULT_V1";
  const VIDEO_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const CHANNEL_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
  const REQUEST_FIELDS = new Set(["type", "version", "requestId", "targetType", "targetId"]);

  function normalizedText(value, limit = 200) {
    if (typeof value !== "string") return null;
    const text = value.trim().slice(0, limit);
    return text.length ? text : null;
  }

  function validTarget(targetType, targetId) {
    if (typeof targetId !== "string") return false;
    if (targetType === "VIDEO") return VIDEO_PATTERN.test(targetId);
    if (targetType === "CHANNEL") return CHANNEL_PATTERN.test(targetId);
    return false;
  }

  function parsePreviewRequest(request) {
    if (!request || typeof request !== "object" || Array.isArray(request) ||
        Object.keys(request).some(key => !REQUEST_FIELDS.has(key))) return null;
    if (request.type !== REQUEST_TYPE || request.version !== MESSAGE_VERSION ||
        !Number.isSafeInteger(request.requestId) || request.requestId < 1 ||
        !validTarget(request.targetType, request.targetId)) return null;
    return Object.freeze({
      type: REQUEST_TYPE, version: MESSAGE_VERSION,
      requestId: request.requestId, targetType: request.targetType,
      targetId: request.targetId, targetKey: request.targetType + ":" + request.targetId,
    });
  }

  function makePreviewRequest(state) {
    const raw = {
      type: REQUEST_TYPE, version: MESSAGE_VERSION,
      requestId: state?.requestId, targetType: state?.targetType,
      targetId: state?.targetId,
    };
    const parsed = parsePreviewRequest(raw);
    return parsed ? Object.freeze(raw) : null;
  }

  function matchesPreviewResponse(response, request) {
    return Boolean(response && typeof response === "object" &&
      response.type === RESPONSE_TYPE && response.version === MESSAGE_VERSION &&
      response.requestId === request?.requestId &&
      response.targetType === request?.targetType &&
      response.targetId === request?.targetId &&
      response.targetKey === request?.targetType + ":" + request?.targetId &&
      typeof response.ok === "boolean" &&
      (response.ok === false || (
        response.status === "READY" && response.isSynthetic === true &&
        response.source === "STATIC_FIXTURE" &&
        (response.cache === "HIT" || response.cache === "MISS") &&
        response.preview?.isSynthetic === true &&
        response.preview?.source === "STATIC_FIXTURE" &&
        response.preview?.targetType === request?.targetType &&
        response.preview?.targetId === request?.targetId
      )));
  }

  scope.YUTOPIA_SHARED = Object.freeze({
    VERSION, MESSAGE_VERSION, REQUEST_TYPE, RESPONSE_TYPE,
    normalizedText, validTarget, parsePreviewRequest, makePreviewRequest,
    matchesPreviewResponse,
  });
})(globalThis);
