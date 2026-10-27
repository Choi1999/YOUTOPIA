/*
 * YUTOPIA MV3 worker — YU-27 synthetic preview message/cache boundary.
 * No external fetch, user account, YouTube API, or Side Panel target mutation.
 */
importScripts("shared.js", "hover-card-model.js");

const YU27 = globalThis.YUTOPIA_SHARED;
const MODEL27 = globalThis.YUTOPIA_HOVER_CARD_MODEL;
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "YUTOPIA_DEMO_PING") {
    sendResponse({ok: true, demo: true});
    return false;
  }
  if (message?.type === YU28_OPEN_REQUEST_TYPE)
    return yu28OpenFromGesture(message, sender, sendResponse);
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
