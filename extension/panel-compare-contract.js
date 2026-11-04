/*
 * YU-41: tab-scoped, strictly synthetic comparison candidates.
 * Never persists comments/credentials, fetches data or changes the pinned target.
 * Worker owns session writes; Side Panel is the trusted user-gesture UI.
 */
(function registerCompareContract(scope) {
  "use strict";
  if (scope.YUTOPIA_PANEL_COMPARE) return;

  const VERSION = 1;
  const TYPE = "YUTOPIA_YU41_COMPARE_ACTION_V1";
  const RESULT = "YUTOPIA_YU41_COMPARE_RESULT_V1";
  const PREFIX = "YU41_COMPARE_TAB_V1_";
  const TTL_MS = 2 * 60 * 60 * 1000;
  const MAX_ITEMS = 8; // YU-42: session-only, per-tab video collection.
  const VIDEO = /^[A-Za-z0-9_-]{11}$/;
  const ACTIONS = ["READ", "ADD", "REMOVE", "SELECT", "SWAP", "CLEAR"];
  const KEYS = ["type", "version", "action", "tabId", "targetId"];
  const STATE_KEYS = ["version", "tabId", "items", "selected", "updatedAt"];
  const ITEM_KEYS = ["videoId", "expiresAt"];

  const validTab = value => Number.isSafeInteger(value) && value >= 0;
  const validVideo = value => typeof value === "string" && VIDEO.test(value);
  const exact = (value, keys) =>
    value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value, key));

  function keyForTab(tabId) {
    return validTab(tabId) ? PREFIX + tabId : null;
  }

  function request(action, tabId, targetId = null) {
    if (!ACTIONS.includes(action) || !validTab(tabId) ||
        (action === "ADD" || action === "REMOVE" || action === "SELECT"
          ? !validVideo(targetId)
          : targetId !== null)) return null;
    return Object.freeze({type: TYPE, version: VERSION, action, tabId, targetId});
  }

  function parseRequest(input) {
    return exact(input, KEYS) && input.type === TYPE &&
      input.version === VERSION
      ? request(input.action, input.tabId, input.targetId) : null;
  }

  function empty(tabId) {
    if (!validTab(tabId)) return null;
    return {version: VERSION, tabId, items: [], selected: [], updatedAt: 0};
  }

  function readState(raw, tabId, now = Date.now()) {
    if (!validTab(tabId)) return null;
    if (raw === undefined || raw === null) return empty(tabId);
    if (!exact(raw, STATE_KEYS) || raw.version !== VERSION ||
        raw.tabId !== tabId || !Array.isArray(raw.items) ||
        !Array.isArray(raw.selected) || raw.items.length > MAX_ITEMS ||
        raw.selected.length > 2 ||
        !Number.isSafeInteger(raw.updatedAt) || raw.updatedAt < 0 ||
        raw.updatedAt > now + 10000) return null;

    const seen = new Set();
    const items = [];
    for (const item of raw.items) {
      if (!exact(item, ITEM_KEYS) || !validVideo(item.videoId) ||
          !Number.isSafeInteger(item.expiresAt) ||
          item.expiresAt < raw.updatedAt ||
          item.expiresAt > raw.updatedAt + TTL_MS ||
          seen.has(item.videoId)) return null;
      seen.add(item.videoId);
      if (item.expiresAt > now) {
        items.push({videoId: item.videoId, expiresAt: item.expiresAt});
      }
    }
    if (new Set(raw.selected).size !== raw.selected.length ||
        raw.selected.some(id => !validVideo(id) || !seen.has(id))) return null;

    const alive = new Set(items.map(item => item.videoId));
    return {
      version: VERSION,
      tabId,
      items,
      selected: raw.selected.filter(id => alive.has(id)),
      updatedAt: now,
    };
  }

  function modify(raw, tabId, action, targetId, now = Date.now(), pin = null) {
    const state = readState(raw, tabId, now);
    if (!state) return {ok: false, status: "INVALID_STATE", state: empty(tabId)};
    if (action === "READ") return {ok: true, status: "READY", state};
    if (action === "CLEAR") return {ok: true, status: "CLEARED", state: empty(tabId)};
    if (action === "ADD") {
      if (!validVideo(targetId) || !pin || pin.tabId !== tabId ||
          pin.targetType !== "VIDEO" || pin.targetId !== targetId ||
          pin.isSynthetic !== true || pin.source !== "STATIC_FIXTURE" ||
          !Number.isSafeInteger(pin.expiresAt) || pin.expiresAt <= now) {
        return {ok: false, status: "PIN_REQUIRED", state};
      }
      if (state.items.some(x => x.videoId === targetId))
        return {ok: false, status: "DUPLICATE", state};
      if (state.items.length >= MAX_ITEMS)
        return {ok: false, status: "FULL", state};
      const expiresAt = Math.min(pin.expiresAt, now + TTL_MS);
      return {
        ok: true, status: "ADDED",
        state: {...state, updatedAt: now,
          items: [...state.items, {videoId: targetId, expiresAt}],
          selected: state.selected.length < 2
            ? [...state.selected, targetId] : state.selected},
      };
    }
    if (action === "REMOVE") {
      if (!validVideo(targetId) || !state.items.some(x => x.videoId === targetId))
        return {ok: false, status: "NOT_IN_COLLECTION", state};
      return {
        ok: true, status: "REMOVED",
        state: {...state, updatedAt: now,
          items: state.items.filter(x => x.videoId !== targetId),
          selected: state.selected.filter(id => id !== targetId)},
      };
    }
    if (action === "SELECT") {
      if (!validVideo(targetId) ||
          !state.items.some(item => item.videoId === targetId))
        return {ok: false, status: "NOT_IN_COLLECTION", state};
      if (state.selected.includes(targetId))
        return {ok: true, status: "UNSELECTED", state: {
          ...state, updatedAt: now,
          selected: state.selected.filter(id => id !== targetId),
        }};
      if (state.selected.length >= 2)
        return {ok: false, status: "PAIR_FULL", state};
      return {ok: true, status: "SELECTED", state: {
        ...state, updatedAt: now,
        selected: [...state.selected, targetId],
      }};
    }
    if (action === "SWAP") {
      if (state.selected.length !== 2)
        return {ok: false, status: "PAIR_REQUIRED", state};
      return {ok: true, status: "SWAPPED", state: {
        ...state, updatedAt: now, selected: [...state.selected].reverse(),
      }};
    }
    return {ok: false, status: "INVALID_ACTION", state};
  }

  scope.YUTOPIA_PANEL_COMPARE = Object.freeze({
    VERSION, TYPE, RESULT, PREFIX, TTL_MS, MAX_ITEMS,
    keyForTab, request, parseRequest, empty, readState, modify,
  });
})(globalThis);
