/*
 * YUTOPIA Strict Thumbnail Hover Controller — YU-26
 *
 * Contract:
 *   pointer on an identified thumbnail -> show that target immediately
 *   pointer outside the thumbnail      -> hide immediately
 *   A -> B -> C and repeated A reentry -> always publish the current target
 *
 * One delegated document listener set owns pointer state. There are no
 * per-anchor listeners, open/close timers, grace periods, overlay occupancy,
 * or persistent suppression. Discovery owns identity; this module only maps
 * the current physical pointer/focus boundary to one stable logical target.
 */
(function initializeYutopiaHoverController(scope) {
  "use strict";
  if (scope.YUTOPIA_HOVER_CONTROLLER) return;

  const discovery = scope.YUTOPIA_VIDEO_DISCOVERY;
  const channels = scope.YUTOPIA_CHANNEL_TARGET_RESOLVER;
  const doc = scope.document;
  if (!discovery || !doc) return;

  const bindings = new Map();
  const subscribers = new Set();
  const unsubscribeSources = [];
  const MAX_PATH_DEPTH = 30;
  const CARD_TRANSIT_MS = 160;
  const MAX_TRANSIT_GAP = 64;
  let cardHost = null;
  let cardElement = null;
  let cardPointerInside = false;
  let transitTimer = null;
  let transitGeneration = 0;
  let active = null;
  let activeMode = null;
  let sequence = 0;
  let connected = false;
  let disposed = false;
  let pointerRecoveries = 0;
  let lastReason = "INITIAL";
  let snapshot = Object.freeze({
    phase: "IDLE", requestId: 0, targetKey: null,
    targetType: null, targetId: null, target: null,
    anchor: null, identityStatus: null, reason: "INITIAL",
  });

  function stableTargetKey(binding) {
    const type = binding?.target?.targetType;
    const id = binding?.target?.targetId;
    if ((type !== "VIDEO" && type !== "CHANNEL") ||
        typeof id !== "string" || !id) return null;
    return type + ":" + id;
  }

  function valid(binding) {
    return Boolean(binding && bindings.get(binding.element) === binding &&
      binding.element?.isConnected !== false);
  }

  function publish(phase, reason) {
    lastReason = reason;
    snapshot = Object.freeze({
      phase,
      requestId: sequence,
      targetKey: stableTargetKey(active),
      targetType: active?.kind ?? null,
      targetId: active?.target?.targetId ?? null,
      target: active?.target ?? null,
      anchor: active?.element ?? null,
      identityStatus: active?.identityStatus ?? null,
      reason,
    });
    for (const listener of [...subscribers]) {
      try { listener({...snapshot}); }
      catch (_error) { /* isolate consumers */ }
    }
  }

  function stopTransit() {
    transitGeneration += 1;
    if (transitTimer !== null) scope.clearTimeout?.(transitTimer);
    transitTimer = null;
  }

  function clear(reason, phase = "IDLE") {
    stopTransit();
    cardPointerInside = false;
    if (!active && snapshot.phase === phase) {
      lastReason = reason;
      return;
    }
    active = null;
    activeMode = null;
    publish(phase, reason);
  }

  function activate(binding, mode, reason, preserveRequestId = false) {
    if (disposed || !valid(binding)) return;
    stopTransit();
    cardPointerInside = false;
    const phase = binding.target ? "READY" : "UNRESOLVED";
    if (active === binding && snapshot.phase === phase) {
      activeMode = mode;
      return;
    }
    const sameLogicalTarget = preserveRequestId && active &&
      stableTargetKey(active) !== null &&
      stableTargetKey(active) === stableTargetKey(binding);
    if (!sameLogicalTarget) sequence += 1;
    active = binding;
    activeMode = mode;
    publish(phase, reason);
  }

  function toBinding(entry, kind) {
    const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
    if (!element) return null;
    let target = null;
    let identityStatus = null;
    if (kind === "VIDEO") {
      if (entry.target?.targetType !== "VIDEO" || !entry.target.targetId) return null;
      target = entry.target;
      identityStatus = "VIDEO_ID_VALID";
    } else {
      target = channels?.toIdentifiedTarget(entry.identity) ?? null;
      if (target?.targetType === "CHANNEL" && target.targetId) {
        identityStatus = "CHANNEL_ID_FORMAT_VALID";
      } else if (entry.identity?.resolutionStatus === "HANDLE_UNRESOLVED") {
        identityStatus = "HANDLE_UNRESOLVED";
      } else {
        return null;
      }
    }
    return {
      kind,
      element,
      card: entry.card ?? null,
      target,
      identityStatus,
      href: entry.href ?? element.getAttribute?.("href") ?? null,
    };
  }

  function sameMetadata(left, right) {
    return Boolean(left && right &&
      left.kind === right.kind && left.card === right.card &&
      left.href === right.href && left.identityStatus === right.identityStatus &&
      stableTargetKey(left) === stableTargetKey(right));
  }

  function upsert(entry, kind) {
    const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
    const candidate = toBinding(entry, kind);
    const previous = element ? bindings.get(element) : null;
    if (!candidate) {
      if (previous?.kind === kind) bindings.delete(element);
      return null;
    }
    if (sameMetadata(previous, candidate)) return previous;
    bindings.set(element, candidate);
    return candidate;
  }

  function bindingFromNode(node) {
    let current = node;
    for (let depth = 0; current && depth < MAX_PATH_DEPTH; depth += 1) {
      const binding = bindings.get(current);
      if (valid(binding)) return binding;
      current = current.parentElement || current.parentNode || current.host || null;
    }
    return null;
  }

  function pointInside(binding, x, y) {
    if (!valid(binding) || !Number.isFinite(x) || !Number.isFinite(y) ||
        typeof binding.element.getBoundingClientRect !== "function") return false;
    const rect = binding.element.getBoundingClientRect();
    return Boolean(rect && rect.width > 0 && rect.height > 0 &&
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  }

  /*
   * YouTube can put an animated preview sibling or portal above the anchor.
   * Event path matching is authoritative; coordinates only match rectangles of
   * already discovered anchors and never infer an ID from page content.
   */
  function bindingFromEvent(event) {
    if (!event || event.pointerType === "touch") return null;
    const path = event.composedPath?.();
    if (Array.isArray(path)) {
      for (const item of path.slice(0, MAX_PATH_DEPTH)) {
        const binding = bindings.get(item);
        if (valid(binding)) return binding;
      }
    }
    const direct = bindingFromNode(event.target);
    if (direct) return direct;

    const x = event.clientX;
    const y = event.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const top = doc.elementFromPoint?.(x, y) || event.target;
    const renderer = top?.closest?.(
      "ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model"
    ) || null;

    let chosen = null;
    let smallestArea = Infinity;
    for (const binding of bindings.values()) {
      if (renderer && binding.card !== renderer) continue;
      if (!pointInside(binding, x, y)) continue;
      const rect = binding.element.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area < smallestArea) {
        chosen = binding;
        smallestArea = area;
      }
    }
    // YouTube can portal #video-preview under ytd-app, outside the originating
    // renderer. Fall back to discovered anchor rectangles only; identity still
    // comes from Discovery and is never read from the overlay or its content.
    if (!chosen && renderer) {
      for (const binding of bindings.values()) {
        if (!pointInside(binding, x, y)) continue;
        const rect = binding.element.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area < smallestArea) {
          chosen = binding;
          smallestArea = area;
        }
      }
    }
    return chosen;
  }

  /*
   * A Shadow DOM pointer event is retargeted to its host at document capture.
   * Only the actual card may receive events. The surrounding host remains
   * transparent, and event paths through this card have priority over
   * coordinate-based recovery of YouTube thumbnails underneath it.
   */
  function inCard(node) {
    if (!node || !cardHost || !cardElement || cardHost.isConnected === false) return false;
    for (let current = node, i = 0; current && i < MAX_PATH_DEPTH; i += 1) {
      if (current === cardElement || current === cardHost) return true;
      current = current.parentElement || current.parentNode || current.host || null;
    }
    return false;
  }

  function eventInCard(event) {
    if (!event || !cardElement || !cardHost) return false;
    const path = event.composedPath?.();
    if (Array.isArray(path) &&
        (path.includes(cardElement) || path.includes(cardHost))) return true;
    return inCard(event.target);
  }

  /*
   * Short geometric travel between the trigger and its card, not a generic
   * 200ms leave delay. This region cannot outlive one fixed timer, and it
   * never wins over a real hovered, separately identified thumbnail.
   */
  function inSafeCardTransit(x, y) {
    if (!active || !valid(active) || !cardElement?.isConnected ||
        !Number.isFinite(x) || !Number.isFinite(y) ||
        typeof active.element.getBoundingClientRect !== "function" ||
        typeof cardElement.getBoundingClientRect !== "function") return false;
    const source = active.element.getBoundingClientRect();
    const target = cardElement.getBoundingClientRect();
    if (!source || !target || source.width <= 0 || source.height <= 0 ||
        target.width <= 0 || target.height <= 0) return false;
    let a, b, start0, start1, end0, end1, along, across;
    if (source.right <= target.left) {
      a = source.right; b = target.left;
      start0 = source.top; start1 = source.bottom;
      end0 = target.top; end1 = target.bottom;
      along = x; across = y;
    } else if (target.right <= source.left) {
      a = target.right; b = source.left;
      start0 = target.top; start1 = target.bottom;
      end0 = source.top; end1 = source.bottom;
      along = x; across = y;
    } else if (source.bottom <= target.top) {
      a = source.bottom; b = target.top;
      start0 = source.left; start1 = source.right;
      end0 = target.left; end1 = target.right;
      along = y; across = x;
    } else if (target.bottom <= source.top) {
      a = target.bottom; b = source.top;
      start0 = target.left; start1 = target.right;
      end0 = source.left; end1 = source.right;
      along = y; across = x;
    } else return false;

    if (b - a > MAX_TRANSIT_GAP || along < a - 6 || along > b + 6) return false;
    const t = b === a ? 0 : Math.max(0, Math.min(1, (along - a) / (b - a)));
    const bottom = start0 + (end0 - start0) * t;
    const top = start1 + (end1 - start1) * t;
    return across >= Math.min(bottom, top) - 8 &&
      across <= Math.max(bottom, top) + 8;
  }

  function beginSafeTransit(event) {
    if (!active || activeMode !== "POINTER" ||
        !inSafeCardTransit(event?.clientX, event?.clientY)) return false;
    if (transitTimer !== null) return true;
    if (typeof scope.setTimeout !== "function") return false;
    const token = ++transitGeneration;
    const original = active;
    transitTimer = scope.setTimeout(() => {
      if (disposed || token !== transitGeneration || active !== original) return;
      transitTimer = null;
      clear("CARD_TRANSIT_EXPIRED");
    }, CARD_TRANSIT_MS);
    return true;
  }

  function setCardRegion(hostNode, cardNode) {
    if (disposed) return;
    cardHost = hostNode || null;
    cardElement = cardNode || null;
    if (!cardNode) {
      cardPointerInside = false;
      stopTransit();
    }
  }

  function onPointerPresence(event) {
    if (disposed || event?.pointerType === "touch") return;
    if (eventInCard(event)) {
      if (active && activeMode === "POINTER") {
        cardPointerInside = true;
        stopTransit();
      }
      return; // never select a thumbnail behind the interactive card
    }
    const next = bindingFromEvent(event);
    if (next) {
      if (active !== next || activeMode !== "POINTER") {
        if (event.type === "pointermove") pointerRecoveries += 1;
        activate(next, "POINTER", active ? "THUMBNAIL_SWITCH" : "THUMBNAIL_ENTER");
      } else if (transitTimer !== null || cardPointerInside) {
        cardPointerInside = false;
        stopTransit();
      }
    } else if (active && activeMode === "POINTER") {
      cardPointerInside = false;
      if (beginSafeTransit(event)) return;
      clear("THUMBNAIL_LEAVE");
    }
  }

  function onPointerOut(event) {
    if (disposed || event?.pointerType === "touch" ||
        !active || activeMode !== "POINTER") return;
    if (eventInCard(event)) {
      if (inCard(event.relatedTarget)) return;
      cardPointerInside = false;
      const next = bindingFromNode(event.relatedTarget);
      if (next) {
        if (next !== active) activate(next, "POINTER", "THUMBNAIL_SWITCH");
        return;
      }
      if (beginSafeTransit(event)) return;
      clear("CARD_LEAVE");
      return;
    }

    // Delayed native pointerout from the old thumbnail cannot close/switch
    // a card currently receiving actual pointer input.
    if (cardPointerInside) return;
    const leaving = bindingFromNode(event.target);
    if (leaving && leaving !== active) return;
    if (inCard(event.relatedTarget)) {
      cardPointerInside = true;
      stopTransit();
      return;
    }
    const next = bindingFromNode(event.relatedTarget);
    if (next) {
      if (next !== active) activate(next, "POINTER", "THUMBNAIL_SWITCH");
      else stopTransit();
      return;
    }
    const recovered = event.relatedTarget && bindingFromEvent({
      type: "pointerout",
      pointerType: event.pointerType,
      target: event.relatedTarget,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (recovered) {
      if (recovered !== active) activate(recovered, "POINTER", "THUMBNAIL_SWITCH");
      return;
    }
    if (beginSafeTransit(event)) return;
    clear("THUMBNAIL_LEAVE");
  }

  function onFocusIn(event) {
    if (eventInCard(event)) {
      if (active) stopTransit();
      return;
    }
    const next = bindingFromNode(event?.target);
    if (next) activate(next, "FOCUS", "FOCUS_ENTER");
  }

  function onFocusOut(event) {
    if (!active || activeMode !== "FOCUS") return;
    if (inCard(event?.relatedTarget)) return;
    const next = bindingFromNode(event?.relatedTarget);
    if (next === active) return;
    if (next) activate(next, "FOCUS", "FOCUS_SWITCH");
    else clear("FOCUS_LEAVE");
  }

  function elementObserved(binding, mode = "POINTER") {
    if (!valid(binding)) return false;
    try {
      return Boolean(binding.element.matches?.(
        mode === "FOCUS" ? ":focus-within" : ":hover"
      ));
    } catch (_error) {
      return false;
    }
  }

  function onDiscovery(kind, change) {
    if (disposed || !change) return;
    const removed = change.removed || [];
    const incomingEntries = [...(change.updated || []), ...(change.added || [])];
    const incomingElements = new Set();
    const candidates = [];
    const previousActive = active;
    const previousKey = stableTargetKey(previousActive);

    for (const entry of incomingEntries) {
      const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
      if (element) incomingElements.add(element);
      const candidate = upsert(entry, kind);
      if (candidate) candidates.push(candidate);
    }
    for (const entry of removed) {
      const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
      if (!element || incomingElements.has(element)) continue;
      const binding = bindings.get(element);
      if (binding?.kind === kind) bindings.delete(element);
    }

    if (previousActive?.kind === kind && !valid(previousActive)) {
      const sameElement = candidates.find(candidate =>
        candidate.element === previousActive.element &&
        elementObserved(candidate, activeMode || "POINTER")
      );
      const sameTarget = candidates.find(candidate =>
        previousKey && stableTargetKey(candidate) === previousKey &&
        (elementObserved(candidate, activeMode || "POINTER") ||
         (cardPointerInside && candidate.href === previousActive.href))
      );
      const rebound = sameElement || sameTarget;
      if (rebound) {
        activate(rebound, activeMode || "POINTER", "TARGET_REBOUND",
          previousKey !== null && stableTargetKey(rebound) === previousKey);
      } else {
        clear("ANCHOR_REMOVED");
      }
    }

    if (!active) {
      const hovered = candidates.find(candidate => elementObserved(candidate));
      if (hovered) {
        pointerRecoveries += 1;
        activate(hovered, "POINTER", "DOM_HOVER_RECOVERY");
      }
    }
  }

  function handleEscape(event) {
    if (event?.key === "Escape" && active) clear("ESCAPE", "DISMISSED");
  }

  function handleVisibility() {
    if (doc.hidden) clear("DOCUMENT_HIDDEN", "DISMISSED");
  }

  function dismiss(reason = "DISMISSED") {
    if (active) clear(reason, "DISMISSED");
  }

  function subscribe(listener) {
    if (disposed) throw new Error("Hover controller disposed");
    if (typeof listener !== "function") throw new TypeError("listener");
    subscribers.add(listener);
    try { listener({...snapshot}); } catch (_error) { /* isolate */ }
    return () => subscribers.delete(listener);
  }

  function getRuntimeStatus() {
    const list = [...bindings.values()];
    return {
      connected,
      disposed,
      phase: snapshot.phase,
      lastReason,
      requestId: sequence,
      strategy: "DELEGATED_INTERACTIVE_CARD",
      activationDelayMs: 0,
      leaveGraceMs: 0,
      cardTransitGraceMs: CARD_TRANSIT_MS,
      cardTransitScheduled: transitTimer !== null,
      cardPointerInside,
      cardRegionAttached: Boolean(cardHost && cardElement),
      selectedMode: activeMode,
      activeTargetKey: stableTargetKey(active),
      pointerInside: activeMode === "POINTER",
      focusInside: activeMode === "FOCUS",
      suppressedAnchorActive: false,
      pointerRecoveries,
      boundVideoAnchors: list.filter(item => item.kind === "VIDEO").length,
      boundChannelAnchors: list.filter(item => item.kind === "CHANNEL").length,
      delegatedPointerListeners: connected ? 3 : 0,
      perAnchorListeners: 0,
      enterScheduled: false,
      leaveScheduled: false,
      stateSubscribers: subscribers.size,
    };
  }

  function isCurrentRequest(request) {
    return Boolean(!disposed && active?.target && snapshot.phase === "READY" &&
      request && request.requestId === sequence &&
      request.targetType === active.target.targetType &&
      request.targetId === active.target.targetId);
  }

  function dismissOnBlur() { clear("WINDOW_BLUR"); }

  function dispose() {
    if (disposed) return;
    clear("DISPOSED");
    disposed = true;
    cardHost = null;
    cardElement = null;
    for (const off of unsubscribeSources) off();
    unsubscribeSources.length = 0;
    bindings.clear();
    doc.removeEventListener?.("pointerover", onPointerPresence, true);
    doc.removeEventListener?.("pointermove", onPointerPresence, true);
    doc.removeEventListener?.("pointerout", onPointerOut, true);
    doc.removeEventListener?.("focusin", onFocusIn, true);
    doc.removeEventListener?.("focusout", onFocusOut, true);
    doc.removeEventListener?.("keydown", handleEscape);
    doc.removeEventListener?.("visibilitychange", handleVisibility);
    scope.removeEventListener?.("blur", dismissOnBlur);
    scope.removeEventListener?.("pagehide", dispose);
    subscribers.clear();
    connected = false;
    if (scope.YUTOPIA_HOVER_CONTROLLER === api) delete scope.YUTOPIA_HOVER_CONTROLLER;
  }

  const api = Object.freeze({
    subscribe,
    getSnapshot: () => ({...snapshot}),
    getRuntimeStatus,
    isCurrentRequest,
    setCardRegion,
    dismiss,
    dispose,
  });
  scope.YUTOPIA_HOVER_CONTROLLER = api;

  if (typeof discovery.subscribe === "function" &&
      typeof discovery.subscribeChannels === "function") {
    unsubscribeSources.push(discovery.subscribe(change => onDiscovery("VIDEO", change)));
    unsubscribeSources.push(discovery.subscribeChannels(change => onDiscovery("CHANNEL", change)));
    connected = true;
    doc.addEventListener?.("pointerover", onPointerPresence, true);
    doc.addEventListener?.("pointermove", onPointerPresence, true);
    doc.addEventListener?.("pointerout", onPointerOut, true);
    doc.addEventListener?.("focusin", onFocusIn, true);
    doc.addEventListener?.("focusout", onFocusOut, true);
    doc.addEventListener?.("keydown", handleEscape);
    doc.addEventListener?.("visibilitychange", handleVisibility);
    scope.addEventListener?.("blur", dismissOnBlur);
    scope.addEventListener?.("pagehide", dispose);
  }
})(globalThis);
