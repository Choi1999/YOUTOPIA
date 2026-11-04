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
  const webLink = doc?.getElementById?.("web-analysis-link");
  const compareLink = doc?.getElementById?.("web-compare-link");
  const webLinkApi = scope.YUTOPIA_WEB_ANALYSIS_LINK;
  const modelApi = scope.YUTOPIA_HOVER_CARD_MODEL;
  const chromeApi = scope.chrome;
  // Side Panel은 클릭으로 확정된 합성 선택만 사용한다. Hover 이벤트로 변경되지 않는다.
  const preview = doc?.getElementById?.("demo-preview");
  const previewScope = doc?.getElementById?.("demo-scope");
  const previewSample = doc?.getElementById?.("demo-sample");
  const previewBriefing = doc?.getElementById?.("demo-briefing");
  const previewBar = doc?.getElementById?.("demo-sentiment-bar");
  const previewTopics = doc?.getElementById?.("demo-topics");
  const metricNames = ["positive", "neutral", "negative"];
  const metricFields = Object.fromEntries(metricNames.map(name => [
    name, {value: doc?.getElementById?.("demo-" + name),
      bar: doc?.getElementById?.("demo-bar-" + name)}
  ]));
  const tabNames = ["overview", "topics", "trends"];
  const tabs = Object.fromEntries(tabNames.map(name => [
    name, doc?.getElementById?.("demo-tab-" + name)
  ]));
  const panels = Object.fromEntries(tabNames.map(name => [
    name, doc?.getElementById?.("demo-panel-" + name)
  ]));

  let disposed = false;
  let activeTabId = null;
  let selectedKey = null;
  let lastStatus = "INITIAL";
  let generation = 0;
  let expiryTimer = null;
  let previewModel = null;
  let previewTab = "overview";
  const tabSubscriptions = [];

  function setText(node, text) {
    if (node) node.textContent = text;
  }

  /*
   * YU-33 기능 확장 — 키보드 대응 탭(요약/주제/추이).
   * 클릭은 UI 표시만 바꾸며 외부 API·수집·분석 작업을 실행하지 않는다.
   * 탭이 바뀌거나 선택이 해제되면 다른 탭의 합성 데이터가 노출되지 않도록 한다.
   */
  function activatePreviewTab(name, focus = false) {
    if (!previewModel || !preview || preview.hidden || !tabNames.includes(name)) return;
    previewTab = name;
    for (const key of tabNames) {
      const button = tabs[key];
      const panel = panels[key];
      button?.setAttribute?.("aria-selected", String(key === name));
      if (button) button.tabIndex = key === name ? 0 : -1;
      if (panel) panel.hidden = key !== name;
    }
    if (focus) tabs[name]?.focus?.();
  }

  function clearPreview() {
    // 비동기 탭 전환·오류·기간 만료 도중 과거 내용이 남지 않도록 즉시 지운다.
    previewModel = null;
    previewTab = "overview";
    if (preview) preview.hidden = true;
    for (const field of [previewScope, previewSample, previewBriefing]) setText(field, "");
    for (const name of metricNames) {
      setText(metricFields[name].value, "");
      if (metricFields[name].bar) metricFields[name].bar.style.width = "0%";
    }
    previewBar?.setAttribute?.("aria-label", "가상 감성 분포");
    previewTopics?.replaceChildren?.();
    for (const key of tabNames) {
      tabs[key]?.setAttribute?.("aria-selected", String(key === "overview"));
      if (tabs[key]) tabs[key].tabIndex = key === "overview" ? 0 : -1;
      if (panels[key]) panels[key].hidden = key !== "overview";
    }
  }

  /*
   * 선택된 대상의 정확한 ID로 기존 Hover Card의 합성 예시 모델만 재사용한다.
   * 검증된 STATIC_FIXTURE가 없으면 어떠한 수치도 표시하지 않는다.
   * 실제 댓글·주제 분류·시계열을 생성하지 않으며 textContent로만 렌더한다.
   */
  function renderPreview(pin) {
    clearPreview();
    if (!preview || pin?.isSynthetic !== true ||
        pin.source !== "STATIC_FIXTURE" ||
        typeof modelApi?.mockForTarget !== "function") return;

    let model = null;
    try {
      model = modelApi.mockForTarget({
        targetType: pin.targetType, targetId: pin.targetId,
      });
    } catch { return; }

    if (!model || model.isSynthetic !== true ||
        model.source !== "STATIC_FIXTURE" ||
        model.previewContract?.valueSemantics !== "ILLUSTRATIVE_ONLY" ||
        model.previewContract?.target?.targetId !== pin.targetId ||
        model.previewContract?.target?.targetType !== pin.targetType ||
        !Array.isArray(model.topics)) return;

    const values = metricNames.map(name => model[name]);
    if (!values.every(value => Number.isInteger(value) && value >= 0 && value <= 100) ||
        values.reduce((sum, n) => sum + n, 0) !== 100) return;

    setText(previewScope, model.scopeLabel);
    setText(previewSample, model.sampleLabel + " · " + model.periodLabel);
    setText(previewBriefing, model.briefing);

    for (let i = 0; i < metricNames.length; i++) {
      const name = metricNames[i];
      setText(metricFields[name].value, values[i].toFixed(0) + "%");
      if (metricFields[name].bar) metricFields[name].bar.style.width = values[i] + "%";
    }
    previewBar?.setAttribute?.("aria-label",
      "가상 감성 분포 · 긍정 " + values[0] + "%, 중립 " +
      values[1] + "%, 부정 " + values[2] + "%");

    if (previewTopics && typeof doc?.createElement === "function") {
      const items = model.topics
        .filter(topic => typeof topic === "string" && topic.length <= 100)
        .slice(0, 5).map(topic => {
          const item = doc.createElement("li");
          item.textContent = topic;
          return item;
        });
      previewTopics.replaceChildren(...items);
    }

    previewModel = model;
    preview.hidden = false;
    activatePreviewTab("overview");
  }

  function registerPreviewTabs() {
    for (const name of tabNames) {
      const button = tabs[name];
      if (typeof button?.addEventListener !== "function") continue;
      const onClick = () => activatePreviewTab(name);
      const onKeyDown = event => {
        const index = tabNames.indexOf(name);
        let next = null;
        if (event?.key === "ArrowRight") next = tabNames[(index + 1) % tabNames.length];
        if (event?.key === "ArrowLeft") next = tabNames[(index + tabNames.length - 1) % tabNames.length];
        if (event?.key === "Home") next = tabNames[0];
        if (event?.key === "End") next = tabNames[tabNames.length - 1];
        if (!next || !previewModel || preview?.hidden) return;
        event.preventDefault?.();
        activatePreviewTab(next, true);
      };
      button.addEventListener("click", onClick);
      button.addEventListener("keydown", onKeyDown);
      tabSubscriptions.push({button, onClick, onKeyDown});
    }
  }

  function clearExpiryTimer() {
    if (expiryTimer !== null) scope.clearTimeout?.(expiryTimer);
    expiryTimer = null;
  }

  function display(status, text, pin = null) {
    clearExpiryTimer();
    lastStatus = status;
    selectedKey = pin?.targetKey ?? null;
    if (statusElement) statusElement.textContent = text;
    if (details) details.hidden = !pin;
    if (kind) kind.textContent = pin ?
      (pin.targetType === "VIDEO" ? "선택 영상" : "선택 채널") : "";
    if (identifier) identifier.textContent = pin ?
      (pin.targetType + ": " + pin.targetId) : "";
    /*
    * 실제로 검증된 선택 영상에 대해서만
    * 로컬 Web 상세 페이지 링크를 표시한다.
    *
    * 패널이 비거나 다른 탭으로 전환되면
    * 이전 링크를 즉시 비활성화한다.
    */
    if (webLink) {
      const url =
        pin?.isSynthetic === true &&
        pin.source === "STATIC_FIXTURE"
          ? webLinkApi?.buildVideoUrl(
              pin.targetType,
              pin.targetId
            )
          : null;

      if (url) {
        webLink.href = url;
        webLink.hidden = false;
      } else {
        webLink.hidden = true;
        webLink.removeAttribute("href");
      }
    }
    // YU-35: Side Panel 고정 선택이 유효한 VIDEO일 때만 비교 화면 링크를 제공한다.
    // 화면 전환/만료/불량 pin에서는 과거 링크를 즉시 제거한다.
    if (compareLink) {
      const url =
        pin?.isSynthetic === true &&
        pin.source === "STATIC_FIXTURE"
          ? webLinkApi?.buildCompareUrl(pin.targetType, pin.targetId)
          : null;

      if (url) {
        compareLink.href = url;
        compareLink.hidden = false;
      } else {
        compareLink.hidden = true;
        compareLink.removeAttribute("href");
      }
    }
    renderPreview(pin);

    // A two-hour session selection must disappear even if the panel stays
    // open with no storage event, user interaction or tab switch.
    if (pin && Number.isFinite(pin.expiresAt) &&
        typeof scope.setTimeout === "function") {
      const delay = Math.max(1, Math.min(2147483647,
        pin.expiresAt - Date.now() + 1));
      expiryTimer = scope.setTimeout(() => {
        expiryTimer = null;
        if (!disposed) refresh();
      }, delay);
    }
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
    clearExpiryTimer();
    clearPreview();
    for (const {button, onClick, onKeyDown} of tabSubscriptions) {
      button.removeEventListener?.("click", onClick);
      button.removeEventListener?.("keydown", onKeyDown);
    }
    tabSubscriptions.length = 0;
    chromeApi?.storage?.onChanged?.removeListener?.(onChanged);
    chromeApi?.tabs?.onActivated?.removeListener?.(onActivated);
    scope.removeEventListener?.("focus", refresh);
    scope.removeEventListener?.("pagehide", dispose);
  }

  const api = Object.freeze({
    refresh, dispose,
    getRuntimeStatus: () => Object.freeze({
      activeTabId, selectedKey, lastStatus, disposed, generation,
      previewVisible: Boolean(previewModel && preview && !preview.hidden),
      previewTab: previewModel ? previewTab : null,
    }),
  });
  scope.YUTOPIA_SIDE_PANEL = api;
  if (doc?.documentElement) doc.documentElement.dataset.yutopiaDemo = "true";
  registerPreviewTabs();
  chromeApi?.storage?.onChanged?.addListener?.(onChanged);
  chromeApi?.tabs?.onActivated?.addListener?.(onActivated);
  scope.addEventListener?.("focus", refresh);
  scope.addEventListener?.("pagehide", dispose);
  refresh();
})(globalThis);
