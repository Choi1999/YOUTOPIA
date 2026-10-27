/*
 * YUTOPIA MV3 worker — YU-27 synthetic preview message/cache boundary.
 * No external fetch, user account, YouTube API, or Side Panel target mutation.
 */
importScripts("shared.js", "hover-card-model.js", "panel-selection-contract.js");

const YU27 = globalThis.YUTOPIA_SHARED;
const MODEL27 = globalThis.YUTOPIA_HOVER_CARD_MODEL;
const PIN28 = globalThis.YUTOPIA_PANEL_SELECTION;
const YU27_KEY = "YU27_SYNTHETIC_SESSION_V1";
const YU27_CACHE_TTL_MS = 60 * 1000; // Local fixture only; NOT YU-32 production TTL.
const YU27_SCOPE_TTL_MS = 2 * 60 * 60 * 1000;
const YU27_CACHE_LIMIT = 64;
const YU27_SCOPE_LIMIT = 64;
let yu27Queue = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(error => {
    console.warn("[YUTOPIA DEMO] Side Panel 초기 설정 실패:", error);
  });
});

function yu27SenderScope(sender) {
  if (sender?.id !== chrome.runtime.id ||
      !Number.isSafeInteger(sender.tab?.id) || sender.tab.id < 0 ||
      sender.frameId !== 0 ||
      typeof sender.documentId !== "string" ||
      !/^[A-Za-z0-9_-]{8,128}$/.test(sender.documentId)) return null;
  try {
    if (new URL(sender.url).origin !== "https://www.youtube.com") return null;
  } catch (_error) { return null; }
  return sender.tab.id + ":" + sender.documentId;
}

function yu27Reply(request, ok, status, extra = {}) {
  return {
    type: YU27.RESPONSE_TYPE, version: YU27.MESSAGE_VERSION,
    requestId: request.requestId, targetType: request.targetType,
    targetId: request.targetId, targetKey: request.targetKey,
    ok, status, ...extra,
  };
}

function yu27Object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function yu27Limit(map, limit, getTime) {
  const ordered = Object.entries(map).sort((a, b) => getTime(b[1]) - getTime(a[1]));
  return Object.fromEntries(ordered.slice(0, limit));
}

async function yu27GetPreview(request, scopeKey) {
  const now = Date.now();
  const store = chrome.storage?.session;
  if (!store?.get || !store?.set) return yu27Reply(request, false, "STORAGE_UNAVAILABLE");
  try {
    const saved = yu27Object((await store.get(YU27_KEY))[YU27_KEY]);
    const cache = {...yu27Object(saved.cache)};
    const scopes = {...yu27Object(saved.scopes)};
    for (const [key, entry] of Object.entries(cache)) {
      if (!entry || !Number.isFinite(entry.expiresAt) || entry.expiresAt <= now)
        delete cache[key];
    }
    for (const [key, entry] of Object.entries(scopes)) {
      if (!entry || !Number.isFinite(entry.seenAt) ||
          now - entry.seenAt > YU27_SCOPE_TTL_MS) delete scopes[key];
    }
    const previous = scopes[scopeKey];
    if (previous && request.requestId < previous.requestId)
      return yu27Reply(request, false, "STALE_REQUEST");
    if (previous && request.requestId === previous.requestId &&
        previous.targetKey !== request.targetKey)
      return yu27Reply(request, false, "REQUEST_CONFLICT");
    scopes[scopeKey] = {requestId: request.requestId,
      targetKey: request.targetKey, seenAt: now};
    const hit = cache[request.targetKey];
    const preview = hit?.preview || MODEL27.mockForTarget(request);
    if (!preview) return yu27Reply(request, false, "INVALID_TARGET");
    if (!hit) cache[request.targetKey] = {
      preview, createdAt: now, expiresAt: now + YU27_CACHE_TTL_MS,
    };
    await store.set({[YU27_KEY]: {
      cache: yu27Limit(cache, YU27_CACHE_LIMIT, v => v.createdAt || 0),
      scopes: yu27Limit(scopes, YU27_SCOPE_LIMIT, v => v.seenAt || 0),
    }});
    return yu27Reply(request, true, "READY", {
      isSynthetic: true, source: "STATIC_FIXTURE", cache: hit ? "HIT" : "MISS",
      preview,
    });
  } catch (_error) {
    return yu27Reply(request, false, "STORAGE_ERROR");
  }
}


/*
 * YU-28 G28-1: Open Side Panel only for an explicit user-click message.
 * Experimental click->Worker user activation; no target pin, storage mutation,
 * or YU-27 preview-cache reuse. Chrome itself enforces the user-gesture Gate.
 */
const YU28_OPEN_REQUEST_TYPE = "YUTOPIA_YU28_GESTURE_OPEN_V1";
const YU28_OPEN_RESULT_TYPE = "YUTOPIA_YU28_GESTURE_RESULT_V1";
const YU28_REQUEST_FIELDS = new Set(["type", "version", "requestId", "targetType", "targetId"]);

function yu28ParseOpenSpike(message) {
  if (!message || typeof message !== "object" || Array.isArray(message) ||
      Object.keys(message).length !== YU28_REQUEST_FIELDS.size ||
      Object.keys(message).some(key => !YU28_REQUEST_FIELDS.has(key)) ||
      message.type !== YU28_OPEN_REQUEST_TYPE) return null;
  // Reuse YU-27 strict VIDEO/CHANNEL and monotonically positive request ID.
  return YU27.parsePreviewRequest({
    type: YU27.REQUEST_TYPE, version: message.version,
    requestId: message.requestId, targetType: message.targetType,
    targetId: message.targetId,
  });
}

function yu28OpenReply(request, ok, status) {
  return {
    type: YU28_OPEN_RESULT_TYPE, version: 1,
    requestId: request?.requestId ?? null,
    targetType: request?.targetType ?? null,
    targetId: request?.targetId ?? null,
    targetKey: request?.targetKey ?? null,
    ok, status,
  };
}

function yu28OpenFromGesture(message, sender, sendResponse) {
  const request = yu28ParseOpenSpike(message);
  if (!request) {
    sendResponse(yu28OpenReply(null, false, "INVALID_REQUEST"));
    return false;
  }
  if (!yu27SenderScope(sender)) {
    sendResponse(yu28OpenReply(request, false, "UNTRUSTED_SENDER"));
    return false;
  }
  if (typeof chrome.sidePanel?.open !== "function") {
    sendResponse(yu28OpenReply(request, false, "OPEN_UNAVAILABLE"));
    return false;
  }

  // IMPORTANT: MUST invoke open directly within this incoming click message.
  // Do NOT await storage, a Promise, tabs.query, setOptions, etc. beforehand.
  let opening;
  try {
    opening = chrome.sidePanel.open({tabId: sender.tab.id});
  } catch (error) {
    console.warn("[YUTOPIA G28-1] OPEN_FAILED", String(error?.message || error).slice(0, 180));
    sendResponse(yu28OpenReply(request, false, "OPEN_FAILED"));
    return false;
  }
  if (!opening || typeof opening.then !== "function") {
    sendResponse(yu28OpenReply(request, false, "OPEN_UNCONFIRMED"));
    return false;
  }
  opening.then(() => {
    console.info("[YUTOPIA G28-1] OPENED", {
      tabId: sender.tab.id, targetType: request.targetType, targetId: request.targetId,
      requestId: request.requestId, pinned: false,
    });
    sendResponse(yu28OpenReply(request, true, "OPENED"));
  }, error => {
    console.warn("[YUTOPIA G28-1] OPEN_FAILED", String(error?.message || error).slice(0, 180));
    sendResponse(yu28OpenReply(request, false, "OPEN_FAILED"));
  });
  return true; // Keep reply channel alive until sidePanel.open() settles.
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "YUTOPIA_DEMO_PING") {
    sendResponse({ok: true, demo: true});
    return false;
  }
  if (message?.type === YU28_OPEN_REQUEST_TYPE)
    return yu28OpenFromGesture(message, sender, sendResponse);
  if (message?.type === PIN28.CLICK_TYPE)
    return yu28PinAndOpen(message, sender, sendResponse);
  if (message?.type === PIN28.READ_TYPE)
    return yu28ReadSelection(message, sender, sendResponse);
  if (message?.type !== YU27.REQUEST_TYPE) return false;
  const request = YU27.parsePreviewRequest(message);
  if (!request) {
    sendResponse({type: YU27.RESPONSE_TYPE, version: YU27.MESSAGE_VERSION,
      ok: false, status: "INVALID_REQUEST"});
    return false;
  }
  const scopeKey = yu27SenderScope(sender);
  if (!scopeKey) {
    sendResponse(yu27Reply(request, false, "UNTRUSTED_SENDER"));
    return false;
  }
  const work = () => yu27GetPreview(request, scopeKey);
  // Serialize storage read-modify-write and request generations per worker.
  const response = yu27Queue.then(work, work);
  yu27Queue = response.then(() => undefined, () => undefined);
  response.then(sendResponse, () => sendResponse(yu27Reply(request, false, "INTERNAL_ERROR")));
  return true; // Async sendResponse survives the MV3 message listener return.
});
