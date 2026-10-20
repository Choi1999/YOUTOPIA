/*
 * YUTOPIA Strict Thumbnail Hover Controller — YU-26 interaction correction
 *
 * User interaction contract:
 *   mouse physically enters identified thumbnail -> immediately show its card
 *   mouse leaves thumbnail -> immediately remove card
 *   repeated A->outside->A / A->B->A -> always activate current target
 *
 * The controller is the single authority for the selected target and requestId.
 * It has NO hover delay, leave grace, persistent suppression or card-focus latch.
 * The pointer tracker determines physical link hits; the presence reducer keeps
 * observations separate from the published card state.
 * No YouTube source DOM mutation, network call or behavioral interception.
 */
(function initializeYutopiaHoverController(scope) {
  "use strict";
  if (scope.YUTOPIA_HOVER_CONTROLLER) return;

  const discovery = scope.YUTOPIA_VIDEO_DISCOVERY;
  const channels = scope.YUTOPIA_CHANNEL_TARGET_RESOLVER;
  const tracker = scope.YUTOPIA_HOVER_POINTER_TRACKER;
  const reducer = scope.YUTOPIA_HOVER_PRESENCE_REDUCER;
  if (!discovery || !tracker || !reducer) return;

  const bindings = new Map();
  const subscribers = new Set();
  const unsubscribeSources = [];
  const doc = scope.document;
  let selected = null;
  let selectedMode = null;
  let presence = reducer.initial();
  let sequence = 0;
  let connected = false;
  let disposed = false;
  let pointerRecoveries = 0;
  let lastReason = "INITIAL";
  let snapshot = Object.freeze({
    phase: "IDLE", requestId: 0, targetType: null, targetId: null,
    target: null, anchor: null, identityStatus: null, reason: "INITIAL",
  });

  function publish(phase, reason) {
    lastReason = reason;
    snapshot = Object.freeze({
      phase, requestId: sequence,
      targetType: selected?.kind ?? null,
      targetId: selected?.target?.targetId ?? null,
      target: selected?.target ?? null,
      anchor: selected?.element ?? null,
      identityStatus: selected?.identityStatus ?? null,
      reason,
    });
    for (const listener of [...subscribers]) {
      try { listener({...snapshot}); }
      catch (_error) { /* isolate consumers */ }
    }
  }

  function valid(binding) {
    return Boolean(binding && bindings.get(binding.element) === binding &&
      binding.element?.isConnected !== false);
  }

  function reset(reason, phase = "IDLE") {
    if (!selected && snapshot.phase === phase) {
      lastReason = reason;
      return;
    }
    selected = null;
    selectedMode = null;
    presence = reducer.initial();
    publish(phase, reason);
  }

  function activate(binding, mode, reason, preserveId = false) {
    if (disposed || !valid(binding)) return;
    if (selected === binding && snapshot.phase ===
        (binding.target ? "READY" : "UNRESOLVED")) {
      selectedMode = mode;
      presence = reducer.reduce(reducer.initial(),
        mode === "FOCUS" ? "FOCUS_ENTER" : "POINTER_ENTER");
      return;
    }
    const old = selected;
    const sameLogical = preserveId && old &&
      tracker.targetKey(old) !== null &&
      tracker.targetKey(old) === tracker.targetKey(binding);
    if (!sameLogical) sequence += 1;
    selected = binding;
    selectedMode = mode;
    presence = reducer.reduce(reducer.initial(),
      mode === "FOCUS" ? "FOCUS_ENTER" : "POINTER_ENTER");
    publish(binding.target ? "READY" : "UNRESOLVED", reason);
  }

  function toBinding(entry, kind) {
    const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
    if (!element || typeof element.addEventListener !== "function" ||
        typeof element.removeEventListener !== "function") return null;
    let target = null, identityStatus = null;
    if (kind === "VIDEO") {
      if (entry.target?.targetType !== "VIDEO" || !entry.target.targetId) return null;
      target = entry.target;
      identityStatus = "VIDEO_ID_VALID";
    } else {
      target = channels?.toIdentifiedTarget(entry.identity) ?? null;
      if (target?.targetType === "CHANNEL" && target.targetId) {
        identityStatus = "CHANNEL_ID_FORMAT_VALID";
      } else if (entry.identity?.resolutionStatus === "HANDLE_UNRESOLVED") {
        target = null;
        identityStatus = "HANDLE_UNRESOLVED";
      } else return null;
    }
    return {
      kind, element, target, identityStatus,
      href: entry.href ?? element.getAttribute?.("href") ?? null
    };
  }

  function detach(binding) {
    if (!binding) return;
    binding.element.removeEventListener("pointerenter", binding.enter);
    binding.element.removeEventListener("pointerleave", binding.leave);
    binding.element.removeEventListener("focusin", binding.focus);
    binding.element.removeEventListener("focusout", binding.blur);
  }

  function assign(binding) {
    binding.enter = event => {
      if (event?.pointerType === "touch") return;
      activate(binding, "POINTER", "THUMBNAIL_ENTER");
    };
    binding.leave = event => {
      if (selected !== binding || selectedMode !== "POINTER") return;
      const next = hitAfterLeave(event);
      if (next === binding) return;
      if (next) activate(next, "POINTER", "THUMBNAIL_SWITCH");
      else reset("THUMBNAIL_LEAVE");
    };
    binding.focus = () => activate(binding, "FOCUS", "FOCUS_ENTER");
    binding.blur = event => {
      if (selected !== binding || selectedMode !== "FOCUS") return;
      if (tracker.contains(binding.element, event?.relatedTarget)) return;
      reset("FOCUS_LEAVE");
    };
    bindings.set(binding.element, binding);
    binding.element.addEventListener("pointerenter", binding.enter);
    binding.element.addEventListener("pointerleave", binding.leave);
    binding.element.addEventListener("focusin", binding.focus);
    binding.element.addEventListener("focusout", binding.blur);
  }

  function hitAfterLeave(event) {
    if (!event || event.pointerType === "touch") return null;
    const related = event.relatedTarget;
    if (!related) return null;
    const next = {
      pointerType: event.pointerType,
      target: related,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    return tracker.resolve(next, bindings, doc);
  }

  function onPointerPresence(event) {
    if (disposed || event?.pointerType === "touch") return;
    const binding = tracker.resolve(event, bindings, doc);
    if (binding && valid(binding)) {
      if (selected !== binding || selectedMode !== "POINTER") {
        pointerRecoveries += 1;
        activate(binding, "POINTER",
          selected ? "THUMBNAIL_SWITCH" : "THUMBNAIL_HIT");
      }
      return;
    }
    if (selected && selectedMode === "POINTER") reset("POINTER_OUTSIDE");
  }

  function onPointerOut(event) {
    if (disposed || event?.pointerType === "touch" ||
        !selected || selectedMode !== "POINTER") return;
    if (!tracker.contains(selected.element, event?.target)) return;
    const next = hitAfterLeave(event);
    if (next === selected) return;
    if (next && valid(next)) activate(next, "POINTER", "THUMBNAIL_SWITCH");
    else reset("THUMBNAIL_LEAVE");
  }

  function onDiscovery(kind, change) {
    if (disposed || !change) return;
    const removed = change.removed || [];
    const incoming = [...(change.updated || []), ...(change.added || [])];
    const old = selected;

    // Resolve the new bindings before deleting any old reference, so replacing
    // a hovered DOM link with the SAME identified target never clears the card.
    for (const entry of incoming) {
      const candidate = toBinding(entry, kind);
      if (!candidate) continue;
      const oldBinding = bindings.get(candidate.element);
      if (oldBinding && oldBinding.kind === candidate.kind &&
          oldBinding.href === candidate.href &&
          oldBinding.target?.targetId === candidate.target?.targetId &&
          oldBinding.identityStatus === candidate.identityStatus) continue;
      if (oldBinding) {
        bindings.delete(oldBinding.element);
        detach(oldBinding);
      }
      assign(candidate);
    }

    let rebound = false;
    if (old && old.kind === kind && selected === old) {
      const missing = removed.some(entry =>
        (kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink) === old.element
      ) || bindings.get(old.element) !== old;
      if (missing) {
        for (const entry of incoming) {
          const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
          const candidate = bindings.get(element);
          if (!valid(candidate)) continue;
          const oldKey = tracker.targetKey(old);
          if (!oldKey || oldKey !== tracker.targetKey(candidate)) continue;
          let hovered = false;
          try {
            hovered = Boolean(candidate.element.matches?.(":hover") ||
              (selectedMode === "FOCUS" && candidate.element.matches?.(":focus-within")));
          } catch (_error) { hovered = false; }
          if (!hovered) continue;
          activate(candidate, selectedMode || "POINTER",
            "TARGET_REBOUND_SAME_ID", true);
          rebound = true;
          break;
        }
      }
    }

    for (const entry of removed) {
      const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
      const binding = bindings.get(element);
      if (!binding || binding.kind !== kind) continue;
      bindings.delete(element);
      detach(binding);
    }

    if (old && old.kind === kind && selected === old &&
        !valid(old) && !rebound) reset("ANCHOR_REMOVED");

    // A YouTube SPA may insert a target underneath an already-stationary
    // pointer; CSS :hover is an observation, not a trusted video ID.
    if (!selected || snapshot.phase === "IDLE") {
      for (const entry of incoming) {
        const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
        const candidate = bindings.get(element);
        if (!valid(candidate)) continue;
        try {
          if (candidate.element.matches?.(":hover")) {
            pointerRecoveries += 1;
            activate(candidate, "POINTER", "DOM_HOVER_RECOVERY");
            break;
          }
        } catch (_error) { /* stale anchor */ }
      }
    }
  }

  function handleEscape(event) {
    if (event?.key === "Escape" && selected) reset("ESCAPE", "DISMISSED");
    // Do not alter YouTube's own keyboard handling.
  }

  function handleVisibility() {
    if (doc?.hidden) reset("DOCUMENT_HIDDEN", "DISMISSED");
  }

  function dismiss(reason = "DISMISSED") {
    if (selected) reset(reason, "DISMISSED");
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
      connected, disposed,
      phase: snapshot.phase, lastReason, requestId: sequence,
      strategy: "STRICT_THUMBNAIL", activationDelayMs: 0, leaveGraceMs: 0,
      selectedMode, activeTargetKey: tracker.targetKey(selected),
      pointerInside: presence.pointerInside,
      focusInside: presence.focusInside,
      overlayPointerInside: false, overlayFocusInside: false,
      suppressedAnchorActive: false, pointerRecoveries,
      boundVideoAnchors: list.filter(x => x.kind === "VIDEO").length,
      boundChannelAnchors: list.filter(x => x.kind === "CHANNEL").length,
      hoveredBoundAnchors: list.filter(x => {
        try { return Boolean(x.element.matches?.(":hover")); }
        catch (_error) { return false; }
      }).length,
      enterScheduled: false, leaveScheduled: false,
      stateSubscribers: subscribers.size,
    };
  }

  function isCurrentRequest(request) {
    return Boolean(!disposed && selected?.target &&
      snapshot.phase === "READY" && request &&
      request.requestId === sequence &&
      request.targetType === selected.target.targetType &&
      request.targetId === selected.target.targetId);
  }

  function dispose() {
    if (disposed) return;
    reset("DISPOSED");
    disposed = true;
    for (const off of unsubscribeSources) off();
    unsubscribeSources.length = 0;
    for (const binding of bindings.values()) detach(binding);
    bindings.clear();
    doc?.removeEventListener?.("pointermove", onPointerPresence, true);
    doc?.removeEventListener?.("pointerover", onPointerPresence, true);
    doc?.removeEventListener?.("pointerout", onPointerOut, true);
    doc?.removeEventListener?.("keydown", handleEscape);
    doc?.removeEventListener?.("visibilitychange", handleVisibility);
    scope.removeEventListener?.("blur", dismissOnBlur);
    scope.removeEventListener?.("pagehide", dispose);
    subscribers.clear();
    connected = false;
    if (scope.YUTOPIA_HOVER_CONTROLLER === api) delete scope.YUTOPIA_HOVER_CONTROLLER;
  }

  function dismissOnBlur() { reset("WINDOW_BLUR"); }

  const api = Object.freeze({
    subscribe, getSnapshot: () => ({...snapshot}),
    getRuntimeStatus, isCurrentRequest, dismiss, dispose,
    // Preserved for compatibility; under strict thumbnail mode floating-card
    // pointer/focus must NOT prolong its visibility beyond the thumbnail.
    overlayPointerEnter() {}, overlayPointerLeave() {},
    overlayFocusIn() {}, overlayFocusOut() {},
  });
  scope.YUTOPIA_HOVER_CONTROLLER = api;

  if (typeof discovery.subscribe === "function" &&
      typeof discovery.subscribeChannels === "function") {
    unsubscribeSources.push(discovery.subscribe(c => onDiscovery("VIDEO", c)));
    unsubscribeSources.push(discovery.subscribeChannels(c => onDiscovery("CHANNEL", c)));
    connected = true;
    doc?.addEventListener?.("pointermove", onPointerPresence, true);
    doc?.addEventListener?.("pointerover", onPointerPresence, true);
    doc?.addEventListener?.("pointerout", onPointerOut, true);
    doc?.addEventListener?.("keydown", handleEscape);
    doc?.addEventListener?.("visibilitychange", handleVisibility);
    scope.addEventListener?.("blur", dismissOnBlur);
    scope.addEventListener?.("pagehide", dispose);
  }
})(globalThis);
