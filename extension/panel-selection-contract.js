/*
 * YOUTOPIA YU-28 G28-2 — synthetic, tab-scoped Side Panel selection contract.
 * Data here is only a VIDEO/CHANNEL target identifier. Never comments/identity.
 */
(function registerYutopiaPanelSelection(scope) {
  "use strict";
  if (scope.YUTOPIA_PANEL_SELECTION) return;
  const VERSION = 1;
  const CLICK_TYPE = "YUTOPIA_YU28_PIN_AND_OPEN_V1";
  const CLICK_RESULT_TYPE = "YUTOPIA_YU28_PIN_RESULT_V1";
  const READ_TYPE = "YUTOPIA_YU28_READ_SELECTION_V1";
  const READ_RESULT_TYPE = "YUTOPIA_YU28_SELECTION_RESULT_V1";
  const PIN_PREFIX = "YU28_SELECTED_TAB_V1_";
  const TTL_MS = 2 * 60 * 60 * 1000; // Synthetic per-tab session, not a saved bookmark.
  const CLICK_FIELDS = new Set(["type", "version", "requestId", "targetType", "targetId"]);
  const READ_FIELDS = new Set(["type", "version", "tabId"]);
  const VALID_DOCUMENT = /^[A-Za-z0-9_-]{8,128}$/;
  const validTarget = (type, id) => (
    (type === "VIDEO" && typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id)) ||
    (type === "CHANNEL" && typeof id === "string" && /^UC[A-Za-z0-9_-]{22}$/.test(id))
  );
  const validTabId = value => Number.isSafeInteger(value) && value >= 0;
  const ownFields = (data, fields) => Boolean(data && typeof data === "object" &&
    !Array.isArray(data) && Object.keys(data).length === fields.size &&
    Object.keys(data).every(key => fields.has(key)));
  const keyForTab = tabId => validTabId(tabId) ? PIN_PREFIX + tabId : null;

  function parseClick(message) {
    if (!ownFields(message, CLICK_FIELDS) ||
        message.type !== CLICK_TYPE || message.version !== VERSION ||
        !Number.isSafeInteger(message.requestId) || message.requestId < 1 ||
        !validTarget(message.targetType, message.targetId)) return null;
    return Object.freeze({
      requestId: message.requestId, targetType: message.targetType,
      targetId: message.targetId, targetKey: message.targetType + ":" + message.targetId,
    });
  }

  function parseRead(message) {
    if (!ownFields(message, READ_FIELDS) || message.type !== READ_TYPE ||
        message.version !== VERSION || !validTabId(message.tabId)) return null;
    return Object.freeze({tabId: message.tabId});
  }

  // Strip foreign properties before forwarding storage data to the panel.
  function readPin(raw, expectedTabId, now = Date.now()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        raw.version !== VERSION || !validTabId(raw.tabId) ||
        raw.tabId !== expectedTabId || !validTarget(raw.targetType, raw.targetId) ||
        raw.targetKey !== raw.targetType + ":" + raw.targetId ||
        !Number.isSafeInteger(raw.requestId) || raw.requestId < 1 ||
        typeof raw.documentId !== "string" || !VALID_DOCUMENT.test(raw.documentId) ||
        raw.isSynthetic !== true || raw.source !== "STATIC_FIXTURE" ||
        !Number.isFinite(raw.selectedAt) || !Number.isFinite(raw.expiresAt) ||
        raw.selectedAt > now + 10000 || raw.selectedAt < 0 ||
        raw.expiresAt <= now || raw.expiresAt > raw.selectedAt + TTL_MS ||
        raw.expiresAt <= raw.selectedAt) return null;
    return Object.freeze({
      version: VERSION, tabId: raw.tabId,
      targetType: raw.targetType, targetId: raw.targetId, targetKey: raw.targetKey,
      requestId: raw.requestId, documentId: raw.documentId,
      selectedAt: raw.selectedAt, expiresAt: raw.expiresAt,
      isSynthetic: true, source: "STATIC_FIXTURE",
    });
  }

  function makePin(request, tabId, documentId, now = Date.now()) {
    if (!request || !validTabId(tabId) ||
        typeof documentId !== "string" || !VALID_DOCUMENT.test(documentId) ||
        !validTarget(request.targetType, request.targetId) ||
        !Number.isSafeInteger(request.requestId) || request.requestId < 1) return null;
    return readPin({
      version: VERSION, tabId, targetType: request.targetType,
      targetId: request.targetId, targetKey: request.targetType + ":" + request.targetId,
      requestId: request.requestId, documentId,
      selectedAt: now, expiresAt: now + TTL_MS,
      isSynthetic: true, source: "STATIC_FIXTURE",
    }, tabId, now);
  }

  scope.YUTOPIA_PANEL_SELECTION = Object.freeze({
    VERSION, CLICK_TYPE, CLICK_RESULT_TYPE, READ_TYPE, READ_RESULT_TYPE,
    PIN_PREFIX, TTL_MS, keyForTab, parseClick, parseRead, readPin, makePin,
  });
})(globalThis);
