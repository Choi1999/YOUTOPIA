/*
 * YU-41: worker-owned, tab-isolated, session-only comparison candidates.
 * No network or external provider calls. The existing user-click pinned VIDEO
 * must match the ADD request; a mere hover never creates a candidate.
 */
(function registerPanelCompareWorker(scope) {
  "use strict";
  const contract = scope.YUTOPIA_PANEL_COMPARE;
  const pinContract = scope.YUTOPIA_PANEL_SELECTION;
  const chromeApi = scope.chrome;
  if (!contract || !pinContract || !chromeApi?.runtime?.onMessage) {
    throw new Error("YU41_COMPARE_WORKER_INIT_FAILED");
  }

  const queues = new Map();

  function enqueue(tabId, operation) {
    const previous = queues.get(tabId) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    const tail = current.then(() => undefined, () => undefined);
    queues.set(tabId, tail);
    tail.then(() => { if (queues.get(tabId) === tail) queues.delete(tabId); });
    return current;
  }

  function trusted(sender) {
    return sender?.id === chromeApi.runtime.id && sender.tab == null &&
      (sender.frameId == null || sender.frameId === 0) &&
      sender.url === chromeApi.runtime.getURL("sidepanel.html");
  }

  function reply(req, ok, status, state = null) {
    return {
      type: contract.RESULT, version: contract.VERSION,
      tabId: req?.tabId ?? null,
      ok, status, state: state ? {
        items: state.items.map(item => ({videoId: item.videoId, expiresAt: item.expiresAt})),
        selected: [...state.selected],
      } : null,
    };
  }

  async function active(tabId) {
    const tabs = await chromeApi.tabs.query({active: true, lastFocusedWindow: true});
    return Array.isArray(tabs) && tabs[0]?.id === tabId;
  }

  async function work(req) {
    const session = chromeApi.storage?.session;
    const key = contract.keyForTab(req.tabId);
    if (!key || !session?.get || !session?.set || !session?.remove)
      return reply(req, false, "STORAGE_UNAVAILABLE");
    if (!(await active(req.tabId))) return reply(req, false, "NOT_ACTIVE_TAB");

    const raw = (await session.get(key))[key];
    const now = Date.now();
    let pin = null;
    if (req.action === "ADD") {
      const pinKey = pinContract.keyForTab(req.tabId);
      const stored = (await session.get(pinKey))[pinKey];
      pin = pinContract.readPin(stored, req.tabId, now);
      // Stale pin/other channel/other ID is never accepted as a candidate.
    }
    const result = contract.modify(raw, req.tabId, req.action, req.targetId, now, pin);
    if (!result.ok) {
      if (result.status === "INVALID_STATE") await session.remove(key);
      return reply(req, false, result.status);
    }

    // READ never renews TTL. When an actual expired entry was filtered,
    // remove it physically from the session store exactly once; subsequent
    // reads do not write and cannot cause a storage.onChanged refresh loop.
    if (req.action === "READ") {
      const expired = raw && Array.isArray(raw.items) &&
        (raw.items.length !== result.state.items.length ||
         raw.selected.length !== result.state.selected.length);
      if (expired) {
        if (result.state.items.length === 0) await session.remove(key);
        else await session.set({[key]: result.state});
      }
      return reply(req, true, result.status, result.state);
    }

    if (req.action === "CLEAR" || result.state.items.length === 0) {
      await session.remove(key);
    } else {
      await session.set({[key]: result.state});
    }
    // Re-read after a mutation to avoid acknowledging a result not stored.
    const saved = (await session.get(key))[key];
    const validated = contract.readState(saved, req.tabId);
    if (!validated) return reply(req, false, "STORAGE_VERIFY_FAILED");
    const expected = result.state;
    if (validated.items.length !== expected.items.length ||
        validated.selected.join(",") !== expected.selected.join(",") ||
        validated.items.some((item, index) =>
          item.videoId !== expected.items[index]?.videoId)) {
      return reply(req, false, "STORAGE_VERIFY_FAILED");
    }
    return reply(req, true, result.status, validated);
  }

  chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== contract.TYPE) return false;
    const req = contract.parseRequest(message);
    if (!req) {
      sendResponse(reply(null, false, "INVALID_REQUEST"));
      return false;
    }
    if (!trusted(sender)) {
      sendResponse(reply(req, false, "UNTRUSTED_SENDER"));
      return false;
    }
    enqueue(req.tabId, () => work(req)).then(sendResponse, () =>
      sendResponse(reply(req, false, "STORAGE_ERROR")));
    return true;
  });

  // Session candidate state survives navigation to a second YouTube video.
  // Full tab closure deletes it. TTL also enforces bounded retention.
  chromeApi.tabs?.onRemoved?.addListener(tabId => {
    const key = contract.keyForTab(tabId);
    if (!key) return;
    enqueue(tabId, async () => {
      try { await chromeApi.storage?.session?.remove?.(key); }
      catch { /* a disabled session store cannot expose candidates */ }
    });
  });
})(globalThis);
