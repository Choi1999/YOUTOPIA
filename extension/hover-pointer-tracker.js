/*
 * YUTOPIA Hover Pointer Tracker — PR #13 benchmark refactor
 *
 * A single, DOM-read-only resolver for pointer events and thumbnail identity.
 * Inspired by interaction-boundary separation in Floating UI / Base UI;
 * this file is an original, dependency-free implementation, not copied code.
 *
 * It does not own Hover state, timers, DOM insertion, data, or network.
 * The Hover Controller remains the only authority for active target and phases.
 */
(function registerHoverPointerTracker(scope) {
  "use strict";

  if (scope.YUTOPIA_HOVER_POINTER_TRACKER) return;

  const RENDERER_SELECTOR =
    "ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model";
  const MAX_PATH_DEPTH = 30;
  const MAX_RENDERER_LINKS = 120;

  function contains(root, target) {
    if (!root || !target) return false;
    let element = target;
    for (let i = 0; i < MAX_PATH_DEPTH && element; i += 1) {
      if (element === root) return true;
      element = element.parentElement || element.parentNode || element.host || null;
    }
    return false;
  }

  /*
   * Match the event's composed path before examining any coordinates.
   * This handles nested images, Shadow DOM retargeting and keyboard descendants
   * without inferring the video identity from the visible title or thumbnail.
   */
  function fromEventPath(event, bindings) {
    if (!event || !bindings) return null;
    const path = event.composedPath?.();
    if (Array.isArray(path)) {
      for (const item of path.slice(0, MAX_PATH_DEPTH)) {
        const binding = bindings.get(item);
        if (binding) return binding;
      }
    }
    let item = event.target;
    for (let i = 0; item && i < MAX_PATH_DEPTH; i += 1) {
      const binding = bindings.get(item);
      if (binding) return binding;
      item = item.parentElement || item.parentNode || item.host || null;
    }
    return null;
  }

  /*
   * YouTube's animated thumbnail preview can be a sibling of the original link.
   * Only associate it with an already-identified binding in the SAME renderer,
   * and only when the pointer is physically inside that link's bounding rect.
   * Limit lookup to the renderer, not the full infinite-scroll page.
   */
  function fromRendererCoordinates(event, bindings, document) {
    const x = event?.clientX;
    const y = event?.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !document) return null;

    const top = document.elementFromPoint?.(x, y) || event.target;
    const renderer = top?.closest?.(RENDERER_SELECTOR);
    if (!renderer) return null;

    const localLinks = renderer.querySelectorAll?.("a[href]");
    const candidates = localLinks
      ? Array.from(localLinks).slice(0, MAX_RENDERER_LINKS)
          .map(link => bindings.get(link)).filter(Boolean)
      : bindings.values(); // safe fallback for simplified DOM/test renderers
    let chosen = null;
    let smallestArea = Infinity;
    for (const binding of candidates) {
      const link = binding.element;
      if (!link?.isConnected ||
          typeof link.getBoundingClientRect !== "function" ||
          link.closest?.(RENDERER_SELECTOR) !== renderer) continue;
      const rect = link.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0 ||
          x < rect.left || x > rect.right ||
          y < rect.top || y > rect.bottom) continue;
      const area = rect.width * rect.height;
      if (area < smallestArea) {
        chosen = binding;
        smallestArea = area;
      }
    }
    return chosen;
  }

  function resolve(event, bindings, document) {
    if (!event || event.pointerType === "touch" || !bindings) return null;
    return fromEventPath(event, bindings) ||
      fromRendererCoordinates(event, bindings, document);
  }

  /*
   * Keep the original transient DOM binding separate from its logical identity.
   * @handle cannot be promoted into an invented channelId.
   */
  function targetKey(binding) {
    if (!binding || !binding.target) return null;
    const {targetType, targetId} = binding.target;
    if ((targetType !== "VIDEO" && targetType !== "CHANNEL") ||
        typeof targetId !== "string" || !targetId.length) return null;
    return targetType + ":" + targetId;
  }

  /*
   * Safe travel corridor between trigger and floating card.
   * This is only a geometry candidate for subsequent UX trials: the controller
   * does NOT extend visibility on corridor alone until Chrome is tested.
   * Horizontal/vertical gap uses linear interpolation of facing edges.
   */
  function safeTransitPoint(trigger, card, x, y, padding = 8) {
    if (!trigger || !card || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const pad = Math.max(0, Math.min(30, Number.isFinite(padding) ? padding : 8));
    const valid = box => ["top","bottom","left","right"].every(
      key => Number.isFinite(box[key])
    ) && box.bottom >= box.top && box.right >= box.left;
    if (!valid(trigger) || !valid(card)) return false;

    let start, end, p0, p1, q0, q1, cross;
    if (trigger.right <= card.left || card.right <= trigger.left) {
      start = trigger.right <= card.left ? trigger.right : card.right;
      end = trigger.right <= card.left ? card.left : trigger.left;
      p0 = trigger.right <= card.left ? trigger.top : card.top;
      p1 = trigger.right <= card.left ? trigger.bottom : card.bottom;
      q0 = trigger.right <= card.left ? card.top : trigger.top;
      q1 = trigger.right <= card.left ? card.bottom : trigger.bottom;
      cross = {along:x, across:y};
    } else if (trigger.bottom <= card.top || card.bottom <= trigger.top) {
      start = trigger.bottom <= card.top ? trigger.bottom : card.bottom;
      end = trigger.bottom <= card.top ? card.top : trigger.top;
      p0 = trigger.bottom <= card.top ? trigger.left : card.left;
      p1 = trigger.bottom <= card.top ? trigger.right : card.right;
      q0 = trigger.bottom <= card.top ? card.left : trigger.left;
      q1 = trigger.bottom <= card.top ? card.right : trigger.right;
      cross = {along:y, across:x};
    } else return false;

    if (cross.along < start - pad || cross.along > end + pad) return false;
    const ratio = end <= start ? 0 : Math.max(0, Math.min(1, (cross.along - start)/(end - start)));
    const low = p0 + (q0 - p0) * ratio;
    const high = p1 + (q1 - p1) * ratio;
    return cross.across >= Math.min(low,high) - pad &&
      cross.across <= Math.max(low,high) + pad;
  }

  scope.YUTOPIA_HOVER_POINTER_TRACKER = Object.freeze({
    contains, resolve, targetKey, safeTransitPoint
  });
})(globalThis);
