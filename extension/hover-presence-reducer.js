/*
 * YUTOPIA Hover Presence Reducer — PR #13 benchmark refactor
 *
 * Pure, deterministic presence state used by the controller's timer coordinator.
 * Native pointer/focus events only describe observations; they never own timers.
 * No DOM, browser storage, telemetry, network or external UI dependency.
 */
(function registerHoverPresenceReducer(scope) {
  "use strict";
  if (scope.YUTOPIA_HOVER_PRESENCE_REDUCER) return;

  const EMPTY = Object.freeze({
    pointerInside: false,
    focusInside: false,
    overlayPointerInside: false,
    overlayFocusInside: false,
  });
  const ACTION_FIELDS = Object.freeze({
    POINTER_ENTER: ["pointerInside", true],
    POINTER_LEAVE: ["pointerInside", false],
    FOCUS_ENTER: ["focusInside", true],
    FOCUS_LEAVE: ["focusInside", false],
    OVERLAY_POINTER_ENTER: ["overlayPointerInside", true],
    OVERLAY_POINTER_LEAVE: ["overlayPointerInside", false],
    OVERLAY_FOCUS_ENTER: ["overlayFocusInside", true],
    OVERLAY_FOCUS_LEAVE: ["overlayFocusInside", false],
  });

  function reduce(state, action) {
    if (action === "RESET") return EMPTY;
    const rule = ACTION_FIELDS[action];
    if (!rule) return state || EMPTY;
    const previous = state || EMPTY;
    const [field, enabled] = rule;
    if (previous[field] === enabled) return previous;
    return Object.freeze({...previous, [field]: enabled});
  }

  function occupied(state) {
    const current = state || EMPTY;
    return current.pointerInside || current.focusInside ||
      current.overlayPointerInside || current.overlayFocusInside;
  }

  function initial() { return EMPTY; }

  scope.YUTOPIA_HOVER_PRESENCE_REDUCER =
    Object.freeze({initial, reduce, occupied});
})(globalThis);
