/*
 * YOUTOPIA Side Panel — YU-28 G28-2.
 * Renders ONLY the explicitly clicked tab-scoped synthetic selection.
 * Hover previews cannot update the panel. No server API, browser history,
 * account/bookmark persistence or actual YouTube comments.
 */
(function startYoutopiaPanel(scope) {
  "use strict";
  if (scope.YUTOPIA_SIDE_PANEL) return;
  const contract = scope.YUTOPIA_PANEL_SELECTION;
  const doc = scope.document;
  const statusElement = doc?.getElementById?.("selection-status");
  const details = doc?.getElementById?.("selection-details");
  const kind = doc?.getElementById?.("selection-kind");
  const identifier = doc?.getElementById?.("selection-id");
  const chromeApi = scope.chrome;
  let disposed = false;
  let activeTabId = null;
  let selectedKey = null;
  let lastStatus = "INITIAL";
  let generation = 0;

  function display(status, text, pin = null) {
    lastStatus = status;
    selectedKey = pin?.targetKey ?? null;
    if (statusElement) statusElement.textContent = text;
    if (details) details.hidden = !pin;
    if (kind) kind.textContent = pin ?
      (pin.targetType === "VIDEO" ? "선택 영상" : "선택 채널") : "";
    if (identifier) identifier.textContent = pin ?
      (pin.targetType + ": " + pin.targetId) : "";
  }

  async function refresh() {
    if (disposed) return;
    const current = ++generation;
    activeTabId = null;
    display("LOADING", "활성 탭의 선택 대상을 확인하고 있습니다.");
    if (!contract || !chromeApi?.tabs?.query ||
        !chromeApi?.runtime?.sendMessage) {
      if (current === generation) display("API_UNAVAILABLE", "확장 API를 사용할 수 없습니다.");
      return;
    }
    try {
      const tabs = await chromeApi.tabs.query({active: true, lastFocusedWindow: true});
      if (disposed || current !== generation) return;
      const tabId = Array.isArray(tabs) ? tabs[0]?.id : null;
      if (!contract.keyForTab(tabId)) {
        display("NO_ACTIVE_TAB", "활성 탭을 확인할 수 없습니다.");
        return;
      }
      activeTabId = tabId;
      const reply = await chromeApi.runtime.sendMessage({
        type: contract.READ_TYPE, version: contract.VERSION, tabId,
      });
      if (disposed || current !== generation || activeTabId !== tabId) return;
      if (reply?.type !== contract.READ_RESULT_TYPE ||
          reply.version !== contract.VERSION || reply.tabId !== tabId ||
          typeof reply.ok !== "boolean") {
        display("RESPONSE_MISMATCH", "선택 대상 응답을 확인할 수 없습니다.");
        return;
      }
      if (reply.ok && reply.status === "EMPTY") {
        display("EMPTY", "이 탭에서 「더보기」를 클릭하여 영상 또는 채널을 선택하세요.");
        return;
      }
      const pin = reply.ok && reply.status === "READY" ?
        contract.readPin(reply.pin, tabId) : null;
      if (!pin) {
        display(reply.status || "INVALID_PIN", "이 탭의 선택 대상이 없거나 확인할 수 없습니다.");
        return;
      }
      display("READY", "이 탭에서 직접 클릭한 대상이 고정돼 있습니다.", pin);
    } catch (_error) {
      if (!disposed && current === generation)
        display("READ_ERROR", "대상 선택 상태를 읽을 수 없습니다.");
    }
  }

  function onChanged(changes, areaName) {
    if (disposed || areaName !== "session" || !contract) return;
    if (contract.keyForTab(activeTabId) &&
        changes?.[contract.keyForTab(activeTabId)]) refresh();
  }

  function onActivated(_info) {
    // An extension Side Panel can persist while the active tab changes.
    // Never keep another tab's selected identity visible during async reads.
    refresh();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation += 1;
    chromeApi?.storage?.onChanged?.removeListener?.(onChanged);
    chromeApi?.tabs?.onActivated?.removeListener?.(onActivated);
    scope.removeEventListener?.("focus", refresh);
    scope.removeEventListener?.("pagehide", dispose);
  }

  const api = Object.freeze({
    refresh, dispose,
    getRuntimeStatus: () => Object.freeze({
      activeTabId, selectedKey, lastStatus, disposed, generation,
    }),
  });
  scope.YUTOPIA_SIDE_PANEL = api;
  if (doc?.documentElement) doc.documentElement.dataset.yutopiaDemo = "true";
  chromeApi?.storage?.onChanged?.addListener?.(onChanged);
  chromeApi?.tabs?.onActivated?.addListener?.(onActivated);
  scope.addEventListener?.("focus", refresh);
  scope.addEventListener?.("pagehide", dispose);
  refresh();
})(globalThis);
