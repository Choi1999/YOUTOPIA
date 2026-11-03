/*
 * YU-41: Side Panel comparison UI, isolated from the existing YU-28 pin view.
 * Only user-clicked, currently pinned synthetic VIDEO enters the collection.
 * All mutations are serialized/validated by extension service worker.
 */
(function startComparePanel(scope) {
  "use strict";
  if (scope.YUTOPIA_COMPARE_PANEL) return;
  const api = scope.YUTOPIA_PANEL_COMPARE;
  const pin = scope.YUTOPIA_PANEL_SELECTION;
  const link = scope.YUTOPIA_WEB_ANALYSIS_LINK;
  const chromeApi = scope.chrome;
  const doc = scope.document;
  if (!api || !pin || !chromeApi || !doc) return;

  const add = doc.getElementById("compare-add-current");
  const status = doc.getElementById("compare-status");
  const list = doc.getElementById("compare-list");
  const swap = doc.getElementById("compare-swap");
  const clear = doc.getElementById("compare-clear");
  const compareLink = doc.getElementById("compare-open-pair");
  if (!add || !status || !list || !swap || !clear || !compareLink) return;

  let disposed = false;
  let generation = 0;
  let activeTabId = null;
  let pinnedVideo = null;
  let state = null;
  let expiryTimer = null;
  const subscriptions = [];

  function listen(element, name, callback) {
    element.addEventListener(name, callback);
    subscriptions.push(() => element.removeEventListener(name, callback));
  }

  function clearTimer() {
    if (expiryTimer !== null) scope.clearTimeout?.(expiryTimer);
    expiryTimer = null;
  }

  function clearView(message = "현재 탭의 비교 후보를 확인 중입니다.") {
    clearTimer();
    pinnedVideo = null;
    state = null;
    add.hidden = true;
    list.replaceChildren();
    swap.disabled = true;
    clear.disabled = true;
    compareLink.hidden = true;
    compareLink.removeAttribute("href");
    status.textContent = message;
  }

  function validReply(message, tabId) {
    return message?.type === api.RESULT &&
      message.version === api.VERSION &&
      message.tabId === tabId &&
      typeof message.ok === "boolean" &&
      message.state && Array.isArray(message.state.items) &&
      Array.isArray(message.state.selected);
  }

  function render(stateView, notice = null) {
    const now = Date.now();
    // Worker sends a read-only minimal state; defensively validate it again.
    const checked = api.readState({
      version: api.VERSION, tabId: activeTabId,
      items: stateView.items, selected: stateView.selected,
      updatedAt: now,
    }, activeTabId, now);
    if (!checked) {
      clearView("비교 후보의 저장 상태를 검증할 수 없습니다.");
      return;
    }

    state = checked;
    status.textContent = notice || (
      checked.items.length
        ? "선택된 영상 " + checked.selected.length + "/2개 · 등록된 영상 " +
          checked.items.length + "/" + api.MAX_ITEMS + "개"
        : "비교 후보가 비어 있습니다. 고정된 영상에서 직접 추가하세요."
    );

    const children = checked.items.map((entry, index) => {
      const row = doc.createElement("li");
      const label = doc.createElement("code");
      label.textContent =
        (checked.selected.indexOf(entry.videoId) === 0 ? "A · " :
         checked.selected.indexOf(entry.videoId) === 1 ? "B · " : "") +
        entry.videoId;
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.className = "compare-action";
      remove.textContent = "제거";
      remove.setAttribute("aria-label", "비교 후보 제거 " + entry.videoId);
      remove.addEventListener("click", () => { void action("REMOVE", entry.videoId); });
      row.append(label, remove);
      return row;
    });
    list.replaceChildren(...children);

    const hasTwo = checked.selected.length === 2;
    swap.disabled = !hasTwo;
    clear.disabled = checked.items.length === 0;
    const url = hasTwo ? link?.buildComparePairUrl?.(checked.selected) : null;
    if (url) {
      compareLink.href = url;
      compareLink.hidden = false;
    } else {
      compareLink.hidden = true;
      compareLink.removeAttribute("href");
    }

    // Enforce TTL while the panel stays visible, even without user events.
    clearTimer();
    const firstExpiry = checked.items.reduce(
      (min, item) => Math.min(min, item.expiresAt), Number.POSITIVE_INFINITY,
    );
    if (Number.isFinite(firstExpiry) && typeof scope.setTimeout === "function") {
      expiryTimer = scope.setTimeout(() => {
        expiryTimer = null;
        if (!disposed) void refresh();
      }, Math.max(1, Math.min(2147483647, firstExpiry - now + 1)));
    }
  }

  async function send(request) {
    if (!request || typeof chromeApi.runtime?.sendMessage !== "function")
      return null;
    return chromeApi.runtime.sendMessage(request);
  }

  async function refresh() {
    if (disposed) return;
    const ticket = ++generation;
    activeTabId = null;
    clearView();

    try {
      const tabs = await chromeApi.tabs?.query?.({
        active: true, lastFocusedWindow: true,
      });
      if (disposed || ticket !== generation) return;
      const tabId = Array.isArray(tabs) ? tabs[0]?.id : null;
      if (!api.keyForTab(tabId)) {
        clearView("활성 탭을 확인할 수 없습니다.");
        return;
      }
      activeTabId = tabId;

      const [selection, collection] = await Promise.all([
        send({type: pin.READ_TYPE, version: pin.VERSION, tabId}),
        send(api.request("READ", tabId)),
      ]);
      if (disposed || ticket !== generation || activeTabId !== tabId) return;

      const selected = selection?.type === pin.READ_RESULT_TYPE &&
        selection.version === pin.VERSION &&
        selection.ok === true && selection.tabId === tabId &&
        selection.status === "READY"
          ? pin.readPin(selection.pin, tabId)
          : null;
      pinnedVideo = selected?.targetType === "VIDEO" &&
        selected?.isSynthetic === true &&
        selected.source === "STATIC_FIXTURE" ? selected.targetId : null;
      add.hidden = !pinnedVideo;
      add.disabled = !pinnedVideo;
      if (validReply(collection, tabId) && collection.ok) {
        render(collection.state);
      } else {
        clearView("비교 후보를 확인할 수 없습니다. 저장 기능을 사용할 수 없습니다.");
      }
    } catch {
      if (!disposed && ticket === generation)
        clearView("비교 후보 조회 오류가 발생했습니다.");
    }
  }

  async function action(kind, videoId = null) {
    if (disposed || activeTabId === null) return;
    const tabId = activeTabId;
    const ticket = generation;
    const expected = kind === "ADD" ? pinnedVideo : videoId;
    const request = api.request(kind, tabId, expected);
    if (!request) return;
    if (kind === "ADD" && !pinnedVideo) return;
    try {
      const result = await send(request);
      if (disposed || ticket !== generation || activeTabId !== tabId) return;
      if (!validReply(result, tabId) || !result.ok) {
        status.textContent = {
          DUPLICATE: "이미 비교 후보에 등록된 영상입니다.",
          FULL: "비교 후보 두 개가 가득 찼습니다. 먼저 하나를 제거하세요.",
          PIN_REQUIRED: "현재 클릭으로 고정된 영상만 추가할 수 있습니다.",
          NOT_ACTIVE_TAB: "현재 탭이 바뀌었습니다. 다시 선택하세요.",
        }[result?.status] || "비교 후보를 수정할 수 없습니다.";
        return;
      }
      const message = {
        ADDED: "비교 후보를 추가했습니다.",
        REMOVED: "비교 후보를 제거했습니다.",
        SWAPPED: "영상 A/B 순서를 바꿨습니다.",
        CLEARED: "비교 후보를 모두 지웠습니다.",
      }[result.status] || "비교 후보를 갱신했습니다.";
      render(result.state, message);
    } catch {
      if (!disposed && ticket === generation)
        status.textContent = "비교 후보 변경 중 오류가 발생했습니다.";
    }
  }

  function onChanged(changes, areaName) {
    if (disposed || areaName !== "session" || activeTabId === null) return;
    if (changes?.[api.keyForTab(activeTabId)] ||
        changes?.[pin.keyForTab(activeTabId)]) void refresh();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    generation++;
    clearTimer();
    clearView("비교 후보 화면을 종료했습니다.");
    for (const unsubscribe of subscriptions) unsubscribe();
    chromeApi.storage?.onChanged?.removeListener?.(onChanged);
    chromeApi.tabs?.onActivated?.removeListener?.(refresh);
    scope.removeEventListener?.("focus", refresh);
    scope.removeEventListener?.("pagehide", dispose);
  }

  listen(add, "click", () => { void action("ADD"); });
  listen(swap, "click", () => { void action("SWAP"); });
  listen(clear, "click", () => { void action("CLEAR"); });

  chromeApi.storage?.onChanged?.addListener?.(onChanged);
  chromeApi.tabs?.onActivated?.addListener?.(refresh);
  scope.addEventListener?.("focus", refresh);
  scope.addEventListener?.("pagehide", dispose);

  scope.YUTOPIA_COMPARE_PANEL = Object.freeze({
    refresh, dispose, getState: () => state ? ({
      tabId: activeTabId,
      items: state.items.map(x => x.videoId),
      selected: [...state.selected],
      pinnedVideo,
    }) : null,
  });
  void refresh();
})(globalThis);
