/*
 * YOUTOPIA YU-29 / AR-01 — MV3 selected-target application service.
 *
 * This module owns YU-28 tab-scoped pin/read and lifecycle behavior.
 * The Worker entrypoint owns message routing. No UI, external API, auth,
 * account storage, or actual YouTube comments are introduced here.
 *
 * SECURITY / CHROME USER ACTIVATION:
 * handlePinAndOpen MUST be called directly by the incoming onMessage handler
 * and MUST call chrome.sidePanel.open synchronously before any await.
 * Injection of the Chrome platform port is for boundary clarity; a fully
 * swappable browser adapter is a separate reviewed milestone.
 */
(function registerYoutopiaSelectionWorker(scope) {
  "use strict";
  if (scope.YOUTOPIA_SELECTION_WORKER) return;

  function create(options) {
    const chrome = options?.chrome;
    const PIN28 = options?.contract;
    const yu27SenderScope = options?.validateYouTubeSender;
    if (!chrome?.runtime || !PIN28 ||
        typeof PIN28.parseClick !== "function" ||
        typeof PIN28.parseRead !== "function" ||
        typeof yu27SenderScope !== "function") {
      throw new Error("YU29 selection worker dependencies unavailable");
    }

    /*
     * G28-2: user-click-only selected target. The G28-1 opening-only request
     * remains available for its separate test suite; Hover now uses PIN28.CLICK_TYPE.
     * Every tab has its own session storage key (no cross-tab read-modify-write).
     * In-memory generations prevent late open responses from overwriting new clicks.
     * This is a 2-hour SYNTHETIC session selection, NOT account/bookmark storage.
     */
    const yu28LatestGenerations = new Map();
    const yu28TabQueues = new Map();

    function yu28ClickReply(request, ok, status, tabId = null, pin = null) {
      return {
        type: PIN28.CLICK_RESULT_TYPE, version: PIN28.VERSION,
        requestId: request?.requestId ?? null,
        targetType: request?.targetType ?? null,
        targetId: request?.targetId ?? null,
        targetKey: request?.targetKey ?? null,
        tabId, ok, status, pinned: ok && status === "PINNED",
        pin: ok && status === "PINNED" ? pin : null,
      };
    }

    function yu28ReadReply(tabId, ok, status, pin = null) {
      return {type: PIN28.READ_RESULT_TYPE, version: PIN28.VERSION,
        tabId, ok, status, pin: ok && status === "READY" ? pin : null};
    }

    function yu28IsLatest(tabId, generation) {
      return yu28LatestGenerations.get(tabId) === generation;
    }

    function yu28QueueForTab(tabId, action) {
      const previous = yu28TabQueues.get(tabId) || Promise.resolve();
      const work = previous.catch(() => {}).then(action);
      const tail = work.then(() => undefined, () => undefined);
      yu28TabQueues.set(tabId, tail);
      tail.then(() => {
        if (yu28TabQueues.get(tabId) === tail) yu28TabQueues.delete(tabId);
      });
      return work;
    }

    function yu28PinAndOpen(message, sender, sendResponse) {
      const request = PIN28.parseClick(message);
      if (!request) {
        sendResponse(yu28ClickReply(null, false, "INVALID_REQUEST"));
        return false;
      }
      if (!yu27SenderScope(sender)) {
        sendResponse(yu28ClickReply(request, false, "UNTRUSTED_SENDER"));
        return false;
      }
      const tabId = sender.tab.id;
      const storage = chrome.storage?.session;
      if (!storage?.get || !storage?.set) {
        sendResponse(yu28ClickReply(request, false, "STORAGE_UNAVAILABLE", tabId));
        return false;
      }
      if (typeof chrome.sidePanel?.open !== "function") {
        sendResponse(yu28ClickReply(request, false, "OPEN_UNAVAILABLE", tabId));
        return false;
      }
      const generation = (yu28LatestGenerations.get(tabId) || 0) + 1;
      yu28LatestGenerations.set(tabId, generation);

      // Chrome user activation must be consumed synchronously upon receiving
      // the trusted content-script click message; do not await any work first.
      let opening;
      try {
        opening = chrome.sidePanel.open({tabId});
      } catch (error) {
        console.warn("[YUTOPIA G28-2] OPEN_FAILED",
          String(error?.message || error).slice(0, 180));
        sendResponse(yu28ClickReply(request, false, "OPEN_FAILED", tabId));
        return false;
      }
      if (!opening || typeof opening.then !== "function") {
        sendResponse(yu28ClickReply(request, false, "OPEN_UNCONFIRMED", tabId));
        return false;
      }
      const result = opening.then(() => yu28QueueForTab(tabId, async () => {
        if (!yu28IsLatest(tabId, generation))
          return yu28ClickReply(request, false, "SUPERSEDED", tabId);
        const key = PIN28.keyForTab(tabId);
        const oldRaw = (await storage.get(key))[key];
        if (!yu28IsLatest(tabId, generation))
          return yu28ClickReply(request, false, "SUPERSEDED", tabId);
        const old = PIN28.readPin(oldRaw, tabId);
        if (old?.documentId === sender.documentId &&
            request.requestId < old.requestId)
          return yu28ClickReply(request, false, "STALE_REQUEST", tabId);
        if (old?.documentId === sender.documentId &&
            request.requestId === old.requestId &&
            request.targetKey !== old.targetKey)
          return yu28ClickReply(request, false, "REQUEST_CONFLICT", tabId);
        const pin = PIN28.makePin(request, tabId, sender.documentId);
        if (!pin) return yu28ClickReply(request, false, "INVALID_TARGET", tabId);
        if (!yu28IsLatest(tabId, generation))
          return yu28ClickReply(request, false, "SUPERSEDED", tabId);
        await storage.set({[key]: pin});
        const stored = PIN28.readPin((await storage.get(key))[key], tabId);
        if (!yu28IsLatest(tabId, generation))
          return yu28ClickReply(request, false, "SUPERSEDED", tabId);
        if (!stored || stored.targetKey !== pin.targetKey ||
            stored.documentId !== pin.documentId || stored.requestId !== pin.requestId)
          return yu28ClickReply(request, false, "STORAGE_VERIFY_FAILED", tabId);
        console.info("[YUTOPIA G28-2] PINNED", {
          tabId, targetType: stored.targetType, targetId: stored.targetId,
          requestId: stored.requestId, pinned: true, source: "STATIC_FIXTURE",
        });
        return yu28ClickReply(request, true, "PINNED", tabId, stored);
      }), error => {
        console.warn("[YUTOPIA G28-2] OPEN_FAILED",
          String(error?.message || error).slice(0, 180));
        return yu28ClickReply(request, false, "OPEN_FAILED", tabId);
      });
      result.then(sendResponse, error => {
        console.warn("[YUTOPIA G28-2] PIN_FAILED",
          String(error?.message || error).slice(0, 180));
        sendResponse(yu28ClickReply(request, false, "PIN_FAILED", tabId));
      });
      return true;
    }

    function yu28PanelSenderTrusted(sender) {
      // MessageSender.frameId is optional and normally absent for extension
      // pages without sender.tab (such as our top-level Side Panel).
      // Validate the actual extension-page URL instead of requiring frameId=0.
      return sender?.id === chrome.runtime.id && sender.tab == null &&
        (sender.frameId == null || sender.frameId === 0) &&
        typeof sender.url === "string" &&
        typeof chrome.runtime.getURL === "function" &&
        sender.url === chrome.runtime.getURL("sidepanel.html");
    }

    function yu28ReadSelection(message, sender, sendResponse) {
      const request = PIN28.parseRead(message);
      if (!request) {
        sendResponse(yu28ReadReply(null, false, "INVALID_REQUEST"));
        return false;
      }
      if (!yu28PanelSenderTrusted(sender)) {
        sendResponse(yu28ReadReply(request.tabId, false, "UNTRUSTED_SENDER"));
        return false;
      }
      if (!chrome.storage?.session?.get || typeof chrome.tabs?.query !== "function") {
        sendResponse(yu28ReadReply(request.tabId, false, "READ_UNAVAILABLE"));
        return false;
      }
      (async () => {
        const active = await chrome.tabs.query({active: true, lastFocusedWindow: true});
        if (!Array.isArray(active) || active[0]?.id !== request.tabId)
          return yu28ReadReply(request.tabId, false, "NOT_ACTIVE_TAB");
        const key = PIN28.keyForTab(request.tabId);
        const raw = (await chrome.storage.session.get(key))[key];
        const selected = PIN28.readPin(raw, request.tabId);
        return selected ? yu28ReadReply(request.tabId, true, "READY", selected) :
          yu28ReadReply(request.tabId, true, "EMPTY");
      })().then(sendResponse, () =>
        sendResponse(yu28ReadReply(request.tabId, false, "READ_ERROR")));
      return true;
    }

    // Invalidate a pinned selection after full page navigation or tab closure.
    // YouTube SPA changes do not fire tabs.onUpdated(status=loading).
    function yu28DiscardTab(tabId) {
      const key = PIN28.keyForTab(tabId);
      if (!key) return;
      yu28LatestGenerations.set(tabId,
        (yu28LatestGenerations.get(tabId) || 0) + 1);
      const storage = chrome.storage?.session;
      if (typeof storage?.remove === "function") {
        yu28QueueForTab(tabId, () => storage.remove(key))
          .catch(() => {});
      }
    }
    chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
      if (changeInfo?.status === "loading") yu28DiscardTab(tabId);
    });
    chrome.tabs?.onRemoved?.addListener(tabId => yu28DiscardTab(tabId));

    return Object.freeze({
      handlePinAndOpen: yu28PinAndOpen,
      handleReadSelection: yu28ReadSelection,
    });
  }

  scope.YOUTOPIA_SELECTION_WORKER = Object.freeze({create});
})(globalThis);
