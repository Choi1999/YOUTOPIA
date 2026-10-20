/*
 * YUTOPIA Hover State Controller — 작업 25
 *
 * 목적:
 *   - 마지막으로 확실히 진입한 VIDEO / CHANNEL 앵커만 활성 상태로 유지한다.
 *   - 400ms 진입 지연, 200ms 이탈 유예, 빠른 A→B→C 이동 및 비동기 응답을 차단한다.
 *   - VIDEO의 정규 targetId와 CHANNEL의 명시적인 UC ID만 상세 분석 가능 대상으로 전달한다.
 *   - @handle은 HANDLE_UNRESOLVED 표시 후보일 뿐 channelId로 추측하지 않는다.
 *   - 같은 브라우저 탭에서 하나의 Hover 상태만 허용한다.
 *
 * 입력: YUTOPIA_VIDEO_DISCOVERY.subscribe/subscribeChannels의 DOM 후보 이벤트.
 * 출력: 격리 콘텐츠 스크립트의 상태 구독 API, 식별된 대상과 requestId.
 * 실패: DOM 해제·SPA 이동·Escape·탭 이탈·dispose 시 즉시 또는 유예 후 상태 취소.
 * 안전: DOM 내용/클릭/YouTube 프리뷰/Side Panel/외부 통신/시청 데이터를 수정하지 않는다.
 *
 * 의도적 미구현:
 *   - 26번 시각 카드·MOCK 데이터 렌더링, 27번 메시지, 28번 더보기 패널 열기.
 *   - READY는 표시 가능한 안정 상태이지 실제 카드가 VISIBLE이라는 뜻이 아니다.
 */
(function initializeYutopiaHoverController(scope) {
  "use strict";

  if (scope.YUTOPIA_HOVER_CONTROLLER) return;

  const ENTER_DELAY_MS = 400; // 12번 UX 문서의 후보 값, 추후 사용성 검증 필요
  const LEAVE_GRACE_MS = 200; // 카드로 이동하는 포인터 유예, UX 후보 범위 150~250ms
  const discovery = scope.YUTOPIA_VIDEO_DISCOVERY;
  const channelResolver = scope.YUTOPIA_CHANNEL_TARGET_RESOLVER;

  const bindings = new Map();
  const stateSubscribers = new Set();
  const unsubscribeSources = [];
  let selected = null;
  let pointerInside = false;
  let focusInside = false;
  let overlayPointerInside = false;
  let overlayFocusInside = false;
  let enterTimer = null;
  let exitTimer = null;
  let generation = 0;
  let requestId = 0;
  let lastReadyPhase = null;
  let disposed = false;
  let connected = false;

  let snapshot = Object.freeze({
    phase: "IDLE",
    requestId: 0,
    targetType: null,
    targetId: null,
    target: null,
    identityStatus: null,
    anchor: null,
    reason: "INITIAL",
  });

  /*
   * 구독자는 원시 댓글/제목/개인정보 대신 현재 대상과 상태만 받는다.
   * 하나의 상태 소비자 오류가 나머지 소비자를 중단하지 않도록 격리한다.
   */
  function publish(phase, reason) {
    snapshot = Object.freeze({
      phase,
      requestId,
      targetType: selected?.kind ?? null,
      targetId: selected?.target?.targetId ?? null,
      target: selected?.target ?? null,
      identityStatus: selected?.identityStatus ?? null,
      anchor: selected?.element ?? null,
      reason,
    });
    for (const subscriber of [...stateSubscribers]) {
      try {
        subscriber({ ...snapshot });
      } catch (_error) {
        // Consumer 오류를 콘텐츠 스크립트로 전파하지 않는다.
      }
    }
  }

  function clearEnterTimer() {
    if (enterTimer !== null) scope.clearTimeout?.(enterTimer);
    enterTimer = null;
  }

  function clearExitTimer() {
    if (exitTimer !== null) scope.clearTimeout?.(exitTimer);
    exitTimer = null;
  }

  /*
   * generation은 이전 타이머·비동기 상태가 새 대상을 덮어쓰지 못하게 한다.
   * requestId는 소비자에게 주는 공개 시퀀스, generation은 내부 타이머 버전이다.
   */
  function clearActive(reason, finalPhase = "IDLE") {
    clearEnterTimer();
    clearExitTimer();
    generation += 1;
    selected = null;
    pointerInside = false;
    focusInside = false;
    overlayPointerInside = false;
    overlayFocusInside = false;
    lastReadyPhase = null;
    publish(finalPhase, reason);
  }

  function queueEnter(binding, mode) {
    if (disposed || bindings.get(binding.element) !== binding) return;

    if (selected === binding) {
      if (mode === "POINTER") pointerInside = true;
      if (mode === "FOCUS") focusInside = true;
      if (exitTimer !== null) {
        clearExitTimer();
        publish(lastReadyPhase || "READY", "ANCHOR_RETURNED");
      }
      return;
    }

    clearEnterTimer();
    clearExitTimer();
    generation += 1;
    requestId += 1;
    selected = binding;
    pointerInside = mode === "POINTER";
    focusInside = mode === "FOCUS";
    overlayPointerInside = false;
    overlayFocusInside = false;
    lastReadyPhase = null;
    publish("HOVER_PENDING", mode === "POINTER" ? "POINTER_ENTER" : "FOCUS_IN");

    const token = generation;
    if (typeof scope.setTimeout !== "function") {
      // Timer가 없는 비브라우저 환경에서는 카드 가시성을 승인하지 않는다.
      clearActive("TIMERS_UNAVAILABLE");
      return;
    }
    enterTimer = scope.setTimeout(() => {
      if (disposed || token !== generation || selected !== binding) return;
      enterTimer = null;
      lastReadyPhase = binding.target ? "READY" : "UNRESOLVED";
      publish(lastReadyPhase, "HOVER_DELAY_COMPLETE");
    }, ENTER_DELAY_MS);
  }

  function beginLeave(reason) {
    if (disposed || !selected) return;
    if (pointerInside || focusInside || overlayPointerInside || overlayFocusInside) return;
    if (enterTimer !== null) {
      // 짧게 스쳐 지나간 대상에서는 분석 상태가 생성되지 않는다.
      clearActive("LEFT_BEFORE_DELAY");
      return;
    }
    if (exitTimer !== null) return;
    if (typeof scope.setTimeout !== "function") {
      clearActive(reason);
      return;
    }
    publish("LEAVE_PENDING", reason);
    const token = generation;
    const anchor = selected;
    exitTimer = scope.setTimeout(() => {
      if (disposed || token !== generation || selected !== anchor) return;
      exitTimer = null;
      if (!pointerInside && !focusInside && !overlayPointerInside && !overlayFocusInside) {
        clearActive("GRACE_EXPIRED");
      }
    }, LEAVE_GRACE_MS);
  }

  function leaveBinding(binding, mode) {
    if (disposed || selected !== binding) return;
    if (mode === "POINTER") pointerInside = false;
    if (mode === "FOCUS") focusInside = false;
    beginLeave(mode === "POINTER" ? "POINTER_LEAVE" : "FOCUS_OUT");
  }

  /*
   * 26번 Card root가 생성되면 이 핸들러를 pointerenter/leave, focusin/out에 연결한다.
   * 현재 단계는 Card DOM을 만들지 않으며 YouTube에 오버레이를 삽입하지 않는다.
   */
  function setOverlayInteraction(kind, active) {
    if (disposed || !selected) return;
    if (kind === "POINTER") overlayPointerInside = Boolean(active);
    else if (kind === "FOCUS") overlayFocusInside = Boolean(active);
    else return;

    if (active && exitTimer !== null) {
      clearExitTimer();
      publish(lastReadyPhase || "READY", "OVERLAY_ENTER");
    } else if (!active) {
      beginLeave("OVERLAY_LEAVE");
    }
  }

  /*
   * API 계약상 분석 상세 요청에 사용할 수 있는 대상은 targetId가 존재할 때뿐.
   * @handle은 HOVER 지연 후 UNRESOLVED로 구분하되 상세 전송을 허용하지 않는다.
   */
  function toBinding(entry, kind) {
    const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
    if (
      !element ||
      typeof element.addEventListener !== "function" ||
      typeof element.removeEventListener !== "function"
    ) return null;

    let target = null;
    let identityStatus = null;
    if (kind === "VIDEO") {
      if (entry.target?.targetType !== "VIDEO" || !entry.target.targetId) return null;
      target = entry.target;
      identityStatus = "VIDEO_ID_VALID";
    } else {
      target = channelResolver?.toIdentifiedTarget(entry.identity) ?? null;
      if (target?.targetType === "CHANNEL" && target.targetId) {
        identityStatus = "CHANNEL_ID_FORMAT_VALID";
      } else if (entry.identity?.resolutionStatus === "HANDLE_UNRESOLVED") {
        target = null;
        identityStatus = "HANDLE_UNRESOLVED";
      } else {
        return null;
      }
    }

    return {
      element,
      kind,
      target,
      identityStatus,
      href: entry.href ?? element.getAttribute?.("href") ?? null,
    };
  }

  function detach(binding) {
    if (!binding) return;
    binding.element.removeEventListener("pointerenter", binding.onPointerEnter);
    binding.element.removeEventListener("pointerleave", binding.onPointerLeave);
    binding.element.removeEventListener("focusin", binding.onFocusIn);
    binding.element.removeEventListener("focusout", binding.onFocusOut);
  }

  function removeBinding(entry, kind) {
    const element = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
    const existing = bindings.get(element);
    if (!existing || existing.kind !== kind) return;
    bindings.delete(element);
    detach(existing);
    if (selected === existing) clearActive("ANCHOR_REMOVED");
  }

  /*
   * SPA가 같은 anchor의 href나 채널 정체성을 교체하면 기존 선택을 무효화한다.
   * 아직 그 anchor에 포인터/포커스가 있다면 새로운 requestId로 다시 대기한다.
   */
  function upsertBinding(entry, kind) {
    const rawElement = kind === "VIDEO" ? entry?.thumbnailLink : entry?.channelLink;
    const replacement = toBinding(entry, kind);
    const existing = bindings.get(rawElement);
    const same = Boolean(existing && replacement &&
      existing.kind === replacement.kind &&
      existing.href === replacement.href &&
      existing.target?.targetId === replacement.target?.targetId &&
      existing.identityStatus === replacement.identityStatus);
    if (same) return;

    const stillHovered = existing && selected === existing;
    const keepPointer = Boolean(stillHovered && pointerInside);
    const keepFocus = Boolean(stillHovered && focusInside);
    if (existing) removeBinding(entry, existing.kind);
    if (!replacement || disposed) return;

    replacement.onPointerEnter = () => queueEnter(replacement, "POINTER");
    replacement.onPointerLeave = () => leaveBinding(replacement, "POINTER");
    replacement.onFocusIn = () => queueEnter(replacement, "FOCUS");
    replacement.onFocusOut = () => leaveBinding(replacement, "FOCUS");

    bindings.set(replacement.element, replacement);
    replacement.element.addEventListener("pointerenter", replacement.onPointerEnter);
    replacement.element.addEventListener("pointerleave", replacement.onPointerLeave);
    replacement.element.addEventListener("focusin", replacement.onFocusIn);
    replacement.element.addEventListener("focusout", replacement.onFocusOut);

    if (keepPointer || keepFocus) {
      queueEnter(replacement, keepPointer ? "POINTER" : "FOCUS");
      if (keepFocus && keepPointer) focusInside = true;
    }
  }

  /*
   * 22/24번 발견기의 구독 스트림을 사용해 anchor별 리스너를 추가/제거한다.
   * 기존 DOM 콘텐츠에 스타일을 쓰거나 YouTube의 클릭·기본 동작을 막지 않는다.
   */
  function handleDiscovery(kind, change) {
    if (disposed || !change) return;
    for (const entry of change.removed || []) removeBinding(entry, kind);
    for (const entry of change.updated || []) upsertBinding(entry, kind);
    for (const entry of change.added || []) upsertBinding(entry, kind);
  }

  function dismiss(reason = "DISMISSED") {
    if (!disposed && selected) clearActive(reason, "DISMISSED");
  }

  function handleKeyDown(event) {
    if (event?.key === "Escape") dismiss("ESCAPE");
    // 중요: preventDefault/stopPropagation 금지. YouTube 자체 Escape는 그대로 동작한다.
  }

  function handleVisibility() {
    if (scope.document?.hidden) dismiss("DOCUMENT_HIDDEN");
  }

  function subscribe(listener) {
    if (disposed) throw new Error("Hover controller disposed");
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    stateSubscribers.add(listener);
    try {
      listener({ ...snapshot });
    } catch (_error) {
      // Consumer 오류와 상태 관리 분리.
    }
    return () => stateSubscribers.delete(listener);
  }

  /*
   * 27·28번 후속 요청이 늦게 완료됐을 때, 응답의 ID/시퀀스가 현재 Hover와
   * 일치하지 않으면 무시하는 용도. 여기서는 실제 응답·패널을 처리하지 않는다.
   */
  function isCurrentRequest(request) {
    return Boolean(
      !disposed && selected?.target && request &&
      snapshot.phase === "READY" &&
      request.requestId === requestId &&
      request.targetType === selected.target.targetType &&
      request.targetId === selected.target.targetId
    );
  }

  function getRuntimeStatus() {
    const list = [...bindings.values()];
    return {
      connected,
      disposed,
      phase: snapshot.phase,
      requestId,
      boundVideoAnchors: list.filter(entry => entry.kind === "VIDEO").length,
      boundChannelAnchors: list.filter(entry => entry.kind === "CHANNEL").length,
      enterScheduled: enterTimer !== null,
      leaveScheduled: exitTimer !== null,
      stateSubscribers: stateSubscribers.size,
    };
  }

  function dispose() {
    if (disposed) return;
    clearActive("DISPOSED");
    disposed = true;
    for (const unsubscribe of unsubscribeSources) unsubscribe();
    unsubscribeSources.length = 0;
    for (const binding of bindings.values()) detach(binding);
    bindings.clear();
    scope.document?.removeEventListener?.("keydown", handleKeyDown);
    scope.document?.removeEventListener?.("visibilitychange", handleVisibility);
    scope.removeEventListener?.("pagehide", dispose);
    stateSubscribers.clear();
    connected = false;
    if (scope.YUTOPIA_HOVER_CONTROLLER === api) delete scope.YUTOPIA_HOVER_CONTROLLER;
  }

  const api = Object.freeze({
    subscribe,
    getSnapshot: () => ({ ...snapshot }),
    getRuntimeStatus,
    overlayPointerEnter: () => setOverlayInteraction("POINTER", true),
    overlayPointerLeave: () => setOverlayInteraction("POINTER", false),
    overlayFocusIn: () => setOverlayInteraction("FOCUS", true),
    overlayFocusOut: () => setOverlayInteraction("FOCUS", false),
    dismiss,
    isCurrentRequest,
    dispose,
  });
  scope.YUTOPIA_HOVER_CONTROLLER = api;

  if (
    discovery &&
    typeof discovery.subscribe === "function" &&
    typeof discovery.subscribeChannels === "function"
  ) {
    // 초기 subscribe는 현재 후보를 즉시 replay하고 재스캔을 일으키지 않는다.
    unsubscribeSources.push(discovery.subscribe(change => handleDiscovery("VIDEO", change)));
    unsubscribeSources.push(discovery.subscribeChannels(change => handleDiscovery("CHANNEL", change)));
    connected = true;
    scope.document?.addEventListener?.("keydown", handleKeyDown);
    scope.document?.addEventListener?.("visibilitychange", handleVisibility);
    scope.addEventListener?.("pagehide", dispose);
  }
})(globalThis);
