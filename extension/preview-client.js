/*
 * YUTOPIA YU-27 content client: observes READY only, never modifies Hover UI.
 * Side Panel click and target pinning are YU-28, intentionally not wired here.
 */
(function registerYutopiaPreviewClient(scope) {
  "use strict";
  if (scope.YUTOPIA_PREVIEW_CLIENT) return;
  const shared = scope.YUTOPIA_SHARED;
  const controller = scope.YUTOPIA_HOVER_CONTROLLER;
  let disposed = false;
  let lastSentKey = null;
  let lastAccepted = null;
  let lastError = null;
  let ignoredResponses = 0;
  let unsubscribe = null;

  function onHoverState(state) {
    if (disposed) return;
    if (state?.phase !== "READY") {
      lastSentKey = null;
      lastAccepted = null;
      return;
    }
    const request = shared?.makePreviewRequest(state);
    if (!request) return;
    const key = request.requestId + ":" + request.targetType + ":" + request.targetId;
    if (key === lastSentKey) return;
    lastSentKey = key;
    function fail(status) {
      if (!disposed && controller.isCurrentRequest(request)) lastError = status;
    }
    try {
      Promise.resolve(scope.chrome.runtime.sendMessage(request)).then(response => {
        if (disposed || !controller.isCurrentRequest(request)) {
          ignoredResponses += 1;
          return;
        }
        if (!shared.matchesPreviewResponse(response, request)) {
          fail("RESPONSE_MISMATCH");
          return;
        }
        if (!response.ok) {
          fail(response.status);
          return;
        }
        lastAccepted = Object.freeze({requestId: request.requestId,
          targetType: request.targetType, targetId: request.targetId,
          cache: response.cache, source: "STATIC_FIXTURE"});
        lastError = null;
      }, () => fail("WORKER_UNAVAILABLE"));
    } catch (_error) { fail("WORKER_UNAVAILABLE"); }
  }

  function getRuntimeStatus() {
    return {connected: Boolean(unsubscribe), disposed, lastAccepted,
      lastError, ignoredResponses, lastSentKey};
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    unsubscribe = null;
  }

  scope.YUTOPIA_PREVIEW_CLIENT = Object.freeze({getRuntimeStatus, dispose});
  if (shared?.makePreviewRequest && controller?.subscribe &&
      typeof scope.chrome?.runtime?.sendMessage === "function")
    unsubscribe = controller.subscribe(onHoverState);
})(globalThis);
