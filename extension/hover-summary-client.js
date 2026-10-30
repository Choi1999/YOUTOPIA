
/**
 * YOUTOPIA 18단계 — 검증된 Hover Summary Content Client.
 * UI를 직접 변경하지 않으며, 실제 댓글/API를 수집하지 않는다.
 */
(function registerHoverSummaryClient(scope) {
  "use strict";

  if (scope.YUTOPIA_HOVER_SUMMARY_CLIENT) return;

  const controller = scope.YUTOPIA_HOVER_CONTROLLER;
  const contract = scope.YUTOPIA_HOVER_SUMMARY_CONTRACT;
  const transport = scope.YUTOPIA_HOVER_SUMMARY_TRANSPORT;
  const listeners = new Set();

  const IDLE = Object.freeze({
    kind: "IDLE",
    requestId: null,
    targetType: null,
    targetId: null,
    summary: null,
    reason: null,
  });

  let currentView = IDLE;
  let activeKey = null;
  let unsubscribeController = null;
  let disposed = false;
  let sentRequests = 0;
  let ignoredResponses = 0;

  const sendMessage = scope.chrome?.runtime?.sendMessage;

  const adapter =
    typeof sendMessage === "function" &&
    typeof controller?.isCurrentRequest === "function" &&
    typeof transport?.createContentAdapter === "function" &&
    typeof contract?.makeRequest === "function"
      ? transport.createContentAdapter({
          sendMessage: request =>
            scope.chrome.runtime.sendMessage(request),
          isCurrentRequest: request =>
            controller.isCurrentRequest(request),
        })
      : null;

  function requestFor(state) {
    if (state?.phase !== "READY") return null;

    return contract?.makeRequest?.(
      state.targetType,
      state.targetId,
      state.requestId
    ) || null;
  }

  function requestKey(request) {
    return [
      request.requestId,
      request.targetType,
      request.targetId,
    ].join(":");
  }

  function publish(view) {
    if (disposed) return;

    currentView = Object.freeze(view);

    for (const listener of [...listeners]) {
      try {
        listener(currentView);
      } catch {
        // 한 구독자의 예외가 다른 구독자를 막지 않는다.
      }
    }
  }

  function onHoverState(state) {
    if (disposed) return;

    const request = requestFor(state);

    if (
      !request ||
      controller?.isCurrentRequest(request) !== true
    ) {
      if (activeKey !== null || currentView.kind !== "IDLE") {
        activeKey = null;
        adapter?.invalidate();
        publish(IDLE);
      }
      return;
    }

    const key = requestKey(request);

    // 같은 Hover 요청의 반복 발행은 재전송하지 않는다.
    if (activeKey === key) return;

    activeKey = key;
    adapter?.invalidate();

    const identity = {
      requestId: request.requestId,
      targetType: request.targetType,
      targetId: request.targetId,
    };

    if (!adapter) {
      publish({
        ...identity,
        kind: "UNAVAILABLE",
        summary: null,
        reason: "TRANSPORT_UNAVAILABLE",
      });
      return;
    }

    publish({
      ...identity,
      kind: "LOADING",
      summary: null,
      reason: null,
    });

    function stillCurrent() {
      return !disposed &&
        activeKey === key &&
        controller.isCurrentRequest(request) === true;
    }

    function finish(result) {
      if (!stillCurrent()) {
        ignoredResponses += 1;
        return;
      }

      if (result?.kind === "IGNORED") {
        ignoredResponses += 1;
        return;
      }

      if (result?.kind === "TRANSPORT_ERROR") {
        publish({
          ...identity,
          kind: "TRANSPORT_ERROR",
          summary: null,
          reason: result.reason,
        });
        return;
      }

      if (
        result?.kind !== "ACCEPTED" ||
        !result.response?.result
      ) {
        publish({
          ...identity,
          kind: "TRANSPORT_ERROR",
          summary: null,
          reason: "INVALID_RESPONSE",
        });
        return;
      }

      // 이 result는 Content Adapter의 parseResponse를 통과했다.
      const accepted = result.response.result;

      publish({
        ...identity,
        kind: accepted.kind,
        summary: accepted.kind === "SNAPSHOT"
          ? accepted.summary
          : null,
        reason: accepted.kind === "REJECTED"
          ? accepted.reason
          : null,
      });
    }

    sentRequests += 1;

    adapter.getSummary(
      request.targetType,
      request.targetId,
      request.requestId
    ).then(
      finish,
      () => finish({
        kind: "TRANSPORT_ERROR",
        reason: "SEND_FAILED",
      })
    );
  }

  function getView(state) {
    const request = requestFor(state);

    if (
      disposed ||
      !request ||
      controller?.isCurrentRequest(request) !== true ||
      activeKey !== requestKey(request)
    ) {
      return null;
    }

    return currentView;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Summary listener required");
    }

    if (disposed) return () => {};

    listeners.add(listener);

    try {
      listener(currentView);
    } catch {
      // 초기 알림도 구독 실패로 전파하지 않는다.
    }

    return () => listeners.delete(listener);
  }

  function getRuntimeStatus() {
    return Object.freeze({
      connected: Boolean(unsubscribeController),
      transportAvailable: Boolean(adapter),
      disposed,
      kind: currentView.kind,
      requestId: currentView.requestId,
      targetType: currentView.targetType,
      targetId: currentView.targetId,
      sentRequests,
      ignoredResponses,
      subscribers: listeners.size,
    });
  }

  function dispose() {
    if (disposed) return;

    disposed = true;
    activeKey = null;

    adapter?.dispose();
    unsubscribeController?.();
    unsubscribeController = null;
    listeners.clear();

    scope.removeEventListener?.("pagehide", dispose);

    if (scope.YUTOPIA_HOVER_SUMMARY_CLIENT === api) {
      delete scope.YUTOPIA_HOVER_SUMMARY_CLIENT;
    }
  }

  const api = Object.freeze({
    getView,
    subscribe,
    getRuntimeStatus,
    dispose,
  });

  scope.YUTOPIA_HOVER_SUMMARY_CLIENT = api;

  if (typeof controller?.subscribe === "function") {
    unsubscribeController = controller.subscribe(onHoverState);
  }

  scope.addEventListener?.("pagehide", dispose);
})(globalThis);
