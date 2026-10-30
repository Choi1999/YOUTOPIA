/*
 * YUTOPIA Hover Card UI — 작업 26 (개발자 로컬 DEMO)
 *
 * 목적: 25번 Hover Controller의 READY/UNRESOLVED 상태에 반응하여 YouTube에
 *       카드 한 개를 Shadow DOM으로 표시하고 사용성·위치를 시험한다.
 * 입력: Hover Controller의 대상 상태와 검증된 Summary Client 결과.
 * 출력: 검증된 합성 스냅샷 또는 데이터 미제공 안내.
 * 실패: 이전 Hover 응답 및 미검증 감성 수치 표시 차단.
 * 경계: 실제 YouTube 댓글·통계·외부 API 수집 없음.
 * 보안: 실제 제목·댓글·시청기록·API 수집 없음, innerHTML 없음, 사이트 이벤트 미차단.
 * 경계: G28-2는 사용자 클릭 시 선택 대상을 세션에 고정. 실제 분석·저장 기능은 미연결.
 */
(function initializeYutopiaHoverCard(scope) {
  "use strict";
  if (scope.YUTOPIA_HOVER_CARD) return;

  const controller = scope.YUTOPIA_HOVER_CONTROLLER;
  const modelApi = scope.YUTOPIA_HOVER_CARD_MODEL;
  const summaryClient = scope.YUTOPIA_HOVER_SUMMARY_CLIENT;
  const doc = scope.document;
  const HOST_ID = "yutopia-extension-hover-card";
  const MARGIN = 8;
  const ANCHOR_GAP = 12;
  const MAX_WIDTH = 344;

  const CSS = [
    ":host { all: initial; color-scheme: light; font: 13px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;",
    "  --ytp-bg: #ffffff; --ytp-ink: #182332; --ytp-muted: #536071; --ytp-line: #dce3ed;",
    "  --ytp-soft: #f5f7fb; --ytp-accent: #4456bc; --ytp-positive: #367e6e;",
    "  --ytp-neutral: #7486a1; --ytp-negative: #c16c65; }",
    ":host([data-theme='dark']) { color-scheme: dark; --ytp-bg: #202630;",
    "  --ytp-ink: #eef2f7; --ytp-muted: #b6c0cd; --ytp-line: #424c59;",
    "  --ytp-soft: #2a3441; --ytp-accent: #9aaaff; --ytp-positive: #7bc1ad;",
    "  --ytp-neutral: #96a8c3; --ytp-negative: #e39690; }",
    "*, *::before, *::after { box-sizing: border-box; }",
    ".card { pointer-events: auto; color: var(--ytp-ink); background: var(--ytp-bg); border: 1px solid var(--ytp-line);",
    "  border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,.22);",
    "  max-height: calc(100vh - 16px); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }",
    ".header { display: flex; align-items: center; gap: 7px; padding: 13px 14px 9px; }",
    ".brand { font-weight: 800; letter-spacing: .025em; font-size: 13px; }",
    ".spacer { flex: 1; min-width: 2px; }",
    ".tag { display: inline-flex; padding: 3px 7px; border: 1px solid var(--ytp-line);",
    "  border-radius: 8px; color: var(--ytp-muted); font-size: 10px; font-weight: 700; }",
    ".close { padding: 2px 8px; border-radius: 8px; font-size: 19px; line-height: 1.3; }",
    ".close, .more { border: 1px solid transparent; background: transparent;",
    "  color: var(--ytp-ink); font: inherit; cursor: pointer; }",
    ".close:hover, .close:focus-visible { background: var(--ytp-soft); }",
    ".body { padding: 0 14px 10px; }",
    "h2 { font: 750 15px/1.4 system-ui, sans-serif; margin: 1px 0 4px; }",
    ".target { color: var(--ytp-muted); font-size: 11px; overflow-wrap: anywhere; }",
    ".section { margin: 12px 0 0; }",
    ".heading { display: block; color: var(--ytp-ink); font-weight: 700; font-size: 12px; margin-bottom: 6px; }",
    ".bar { display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: var(--ytp-soft); }",
    ".positive { background: var(--ytp-positive); }",
    ".neutral { background: var(--ytp-neutral); }",
    ".negative { background: var(--ytp-negative); }",
    ".legend { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; font-size: 11px; }",
    ".legend-item { white-space: nowrap; }",
    ".dot { display: inline-block; vertical-align: middle; width: 7px; height: 7px;",
    "  border-radius: 50%; margin-right: 4px; }",
    ".topics { margin: 5px 0 0; padding: 0 0 0 17px; color: var(--ytp-ink); font-size: 12px; }",
    ".topics li { margin: 2px 0; }",
    ".briefing { font-size: 12px; line-height: 1.6; margin: 5px 0; color: var(--ytp-ink); }",
    ".meta { color: var(--ytp-muted); font-size: 11px; line-height: 1.65; margin: 10px 0 0; }",
    ".notice { color: var(--ytp-muted); font-size: 11px; line-height: 1.5; padding: 8px;",
    "  background: var(--ytp-soft); border-radius: 9px; margin-top: 10px; }",
    ".footer { border-top: 1px solid var(--ytp-line); padding: 9px 14px 12px;",
    "  display: flex; flex-direction: column; align-items: stretch; gap: 8px; }",
    ".actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }",
    ".more { padding: 7px 11px; font-size: 12px; font-weight: 750;",
    "  background: var(--ytp-accent); color: #ffffff; border-radius: 10px; }",
    ":host([data-theme='dark']) .more { color: #171d28; }",
    ".more:hover { filter: brightness(1.06); }",
    ".more:disabled, .close:disabled { opacity: .45; cursor: default; }",
    ".more:focus-visible, .close:focus-visible { outline: 3px solid var(--ytp-accent); outline-offset: 2px; }",
    ".more-status { font-size: 11px; color: var(--ytp-muted); }",
    "[hidden] { display: none !important; }",
    "@media (prefers-reduced-motion: reduce) { .card { scroll-behavior: auto; } }",
  ].join("\n");

  let host = null;
  let shadow = null;
  let surface = null;
  let currentKey = null;
  let currentAnchor = null;
  let currentState = null;
  let unsubscribe = null;
  let summaryUnsubscribe = null;
  let summaryArea = null;
  let lastSummaryKind = "UNAVAILABLE";
  let connected = false;
  let disposed = false;
  let moving = false;
  let frame = null;
  let lastAction = null;
  let lastRenderReason = "NO_ACTIVE_TARGET";
  let lastLayout = null;
  // 카드가 보이지 않을 때도 마지막 Hover 상태/닫힘 이유를 개발자에게 제공한다.
  let lastHoverPhase = "IDLE";
  let lastHoverReason = "INITIAL";

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /*
   * Content Script의 Shadow DOM 밖 CSS/JS에 영향받지 않는 시각 카드 한 개만 만든다.
   * 페이지 본문 이외 요소에 스타일을 추가하지 않고, 별도 Chrome 권한을 요청하지 않는다.
   */
  function ensureHost() {
    if (host && host.isConnected) return true;
    if (!doc?.body || typeof doc.createElement !== "function") return false;
    if (host) host.remove();
    host = el("div");
    host.id = HOST_ID;
    host.setAttribute("data-yutopia-demo", "true");
    host.style.position = "fixed";
    host.style.zIndex = "2147482500";
    // 빈 Shadow Host 영역은 YouTube 링크의 포인터 이벤트를 차단하지 않는다.
    host.style.pointerEvents = "none";
    host.style.visibility = "hidden";
    host.style.width = "344px";
    host.style.top = "0px";
    host.style.left = "0px";
    shadow = host.attachShadow({mode: "open"});
    shadow.appendChild(el("style", "", CSS));
    surface = el("div");
    surface.style.pointerEvents = "none";
    surface.setAttribute("data-yutopia-card-surface", "true");
    shadow.appendChild(surface);
    doc.body.appendChild(host);
    return true;
  }

  function theme() {
    if (!host) return;
    const dark = Boolean(doc?.documentElement?.hasAttribute?.("dark"));
    host.dataset.theme = dark ? "dark" : "light";
  }

  /**
   * 검증된 합성 스냅샷만 카드에 표현한다.
   *
   * 기존 mockForTarget의 임의 감성 비율은 사용하지 않는다.
   * 카드 전체를 교체하지 않고 요약 영역만 갱신한다.
   */
  function renderSummaryArea(area, state) {
    const view = summaryClient?.getView?.(state);
    const kind = view?.kind || "UNAVAILABLE";
    lastSummaryKind = kind;

    const summary = kind === "SNAPSHOT"
      ? view.summary
      : null;

    const metrics = summary?.sentimentPercent;

    const percentages = metrics
      ? [
          metrics.positivePercent,
          metrics.neutralPercent,
          metrics.negativePercent,
        ]
      : [];

    const verified =
      summary &&
      (summary.status === "READY" ||
       summary.status === "PARTIAL") &&
      summary.valueSemantics ===
        "SNAPSHOT_DERIVED_SYNTHETIC" &&
      summary.provenance?.sourceType === "STATIC_FIXTURE" &&
      summary.provenance?.isSynthetic === true &&
      summary.target?.source === "YOUTUBE" &&
      summary.target?.targetType === state.targetType &&
      summary.target?.targetId === state.targetId &&
      Number.isSafeInteger(metrics?.denominator) &&
      metrics.denominator > 0 &&
      percentages.length === 3 &&
      percentages.every(value =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100
      ) &&
      Math.abs(
        percentages.reduce((sum, value) => sum + value, 0) -
        100
      ) < 0.000001;

    if (!verified) {
      const notices = {
        LOADING:
          "검증된 합성 스냅샷을 확인 중입니다. 결과가 도착하기 전에는 감성 비율을 표시하지 않습니다.",

        NOT_FOUND:
          "이 대상에는 제공된 합성 스냅샷이 없습니다. 실제 YouTube 댓글 분석을 수행하지 않았습니다.",

        REJECTED:
          "스냅샷 검증에 실패하여 감성 비율과 주요 논점을 표시하지 않습니다.",

        TRANSPORT_ERROR:
          "요약 메시지 처리에 실패했습니다. 확인되지 않은 분석 수치는 표시하지 않습니다.",

        UNAVAILABLE:
          "검증된 요약을 사용할 수 없습니다. 현재 분석 비율은 제공하지 않습니다.",
      };

      const notice = notices[kind] ||
        (kind === "SNAPSHOT"
          ? "분석 상태: " +
            (summary?.status || "UNKNOWN") +
            " · 표시할 수 있는 감성 비율이 없습니다."
          : "검증된 분석 데이터를 사용할 수 없습니다.");

      area.replaceChildren(
        el("p", "notice", notice)
      );
      return;
    }

    const metric = el("section", "section");

    metric.appendChild(
      el("strong", "heading",
        "감성 분포 · 검증된 합성 스냅샷")
    );

    const bar = el("div", "bar");
    bar.setAttribute("role", "img");
    bar.setAttribute(
      "aria-label",
      "합성 스냅샷 긍정 " + metrics.positivePercent +
      "퍼센트, 중립 " + metrics.neutralPercent +
      "퍼센트, 부정 " + metrics.negativePercent +
      "퍼센트. 실제 YouTube 분석값이 아닙니다."
    );

    const entries = [
      ["positive", "긍정", metrics.positivePercent],
      ["neutral", "중립", metrics.neutralPercent],
      ["negative", "부정", metrics.negativePercent],
    ];

    for (const [kindName, , value] of entries) {
      const segment = el("span", kindName);
      segment.style.width = String(value) + "%";
      bar.appendChild(segment);
    }

    metric.appendChild(bar);

    const legend = el("div", "legend");

    for (const [kindName, label, value] of entries) {
      const item = el("span", "legend-item");
      item.appendChild(el("span", "dot " + kindName));
      item.appendChild(
        doc.createTextNode(label + " " + value + "%")
      );
      legend.appendChild(item);
    }

    metric.appendChild(legend);

    const sections = [metric];

    if (summary.topTopics.length > 0) {
      const issues = el("section", "section");
      issues.appendChild(
        el("strong", "heading",
          "주요 논점 · 합성 스냅샷")
      );

      const topics = el("ul", "topics");

      for (const topic of summary.topTopics) {
        topics.appendChild(
          el("li", "",
            topic.topicId +
            " · 언급 " +
            topic.mentionCount +
            "건")
        );
      }

      issues.appendChild(topics);
      sections.push(issues);
    }

    const scopeData = summary.observationScope;

    sections.push(
      el(
        "p",
        "meta",
        "분류된 합성 댓글 분모: " +
        metrics.denominator +
        "건 · 분석 상태: " + summary.status +
        " · 범위: " + scopeData.mode +
        " · 관측 기간: " + scopeData.windowStart +
        " ~ " + scopeData.windowEnd +
        " · 분석 시각: " + summary.analyzedAt
      )
    );

    sections.push(
      el(
        "div",
        "notice",
        "STATIC_FIXTURE · SNAPSHOT_DERIVED_SYNTHETIC · " +
        "검증된 합성 예시입니다. 실제 YouTube 댓글 분석 결과가 아닙니다."
      )
    );

    area.replaceChildren(...sections);
  }

  /*
   * 실제 영상 ID는 직접 앵커에서 추측하지 않고 23/24/25번의 정규 식별 계약만 소비.
   * DOM 구성에는 textContent만 사용해 YouTube 링크나 제목에 HTML이 섞여도 실행되지 않는다.
   */
  function buildCard(state, mock) {
    const unresolved = state.phase === "UNRESOLVED";
    const isVideo = state.targetType === "VIDEO";
    const container = el("section", "card");
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "YUTOPIA 화면 시연용 " + (isVideo ? "영상" : "채널") + " 반응 카드");

    const header = el("header", "header");
    header.appendChild(el("strong", "brand", "YUTOPIA"));
    header.appendChild(el("span", "tag", "DEMO · 합성 데이터 전용"));
    header.appendChild(el("span", "spacer"));
    const close = el("button", "close", "×");
    // The card itself is interactive for pointer containment. Stage 27-28
    // Side Panel/CTA actions remain disabled pending their own authorization.
    close.type = "button";
    close.disabled = true;
    close.setAttribute("aria-disabled", "true");
    close.setAttribute("aria-label", "YUTOPIA 카드 닫기");
    header.appendChild(close);
    container.appendChild(header);

    const body = el("div", "body");
    body.appendChild(el("h2", "", unresolved ? "채널 ID 확인 필요" : mock.title));
    body.appendChild(el("div", "target",
      unresolved ? "채널 핸들만 확인됨 · 채널 ID 미확정" :
      (isVideo ? "영상 ID: " : "채널 ID: ") + mock.targetId));

    if (unresolved) {
      body.appendChild(el(
        "p",
        "notice",
        "이 채널 링크는 @handle 형식입니다. " +
        "정확한 채널 ID 매핑이 없어 분석을 표시하지 않습니다."
      ));
    } else {
      summaryArea = el("div", "summary-area");
      summaryArea.setAttribute("aria-live", "polite");

      renderSummaryArea(summaryArea, state);

      body.appendChild(summaryArea);
    }

    container.appendChild(body);

    const footer = el("footer", "footer");
    if (!unresolved) {
      const actions = el("div", "actions");
      const more = el("button", "more", "더보기 →");
      more.type = "button";
      const canSendGesture = typeof scope.chrome?.runtime?.sendMessage === "function";
      more.disabled = !canSendGesture;
      more.setAttribute("aria-disabled", String(!canSendGesture));
      more.setAttribute("aria-label", canSendGesture ?
        "클릭한 영상·채널을 Chrome Side Panel에 고정하기 · 합성 데이터" :
        "Chrome 확장 메시징을 사용할 수 없어 상세 보기를 열 수 없음");
      const message = el("div", "more-status");
      message.setAttribute("role", "status");
      message.setAttribute("aria-live", "polite");
      message.hidden = true;
      if (canSendGesture) {
        const request = Object.freeze({
          type: "YUTOPIA_YU28_PIN_AND_OPEN_V1",
          version: 1, requestId: state.requestId,
          targetType: state.targetType, targetId: state.targetId,
        });
        more.addEventListener("click", event => {
          // Browser-created mouse/keyboard clicks only; synthetic .click() is ignored.
          if (event?.isTrusted !== true || disposed ||
              !controller?.isCurrentRequest(request) ||
              !modelApi?.mockForTarget(request)) return;
          // Do not open on Hover READY; send ONLY in this synchronous handler.
          message.hidden = false;
          message.textContent = "선택 대상 고정 중 · 합성 데이터";
          lastAction = "YU28_G28_2_REQUESTED";
          const settle = response => {
            if (disposed || !controller?.isCurrentRequest(request)) return;
            const matched = response?.type === "YUTOPIA_YU28_PIN_RESULT_V1" &&
              response.version === 1 && response.requestId === request.requestId &&
              response.targetType === request.targetType &&
              response.targetId === request.targetId &&
              response.targetKey === request.targetType + ":" + request.targetId &&
              typeof response.ok === "boolean" &&
              (response.tabId === null || (Number.isSafeInteger(response.tabId) && response.tabId >= 0));
            if (!matched) {
              lastAction = "YU28_G28_2_RESPONSE_MISMATCH";
              message.textContent = "패널 열기 확인 실패 · 응답 불일치";
              return;
            }
            if (response.ok === true && response.status === "PINNED" &&
                response.pinned === true && response.pin?.isSynthetic === true &&
                response.pin?.source === "STATIC_FIXTURE" &&
                response.pin?.targetId === request.targetId &&
                response.pin?.targetType === request.targetType) {
              lastAction = "YU28_G28_2_PINNED";
              message.textContent = "선택 대상 고정 확인 · 시연용 합성 데이터";
            } else {
              lastAction = "YU28_G28_2_" + (response.status || "PIN_FAILED");
              message.textContent = "패널 선택 실패: " +
                (response.status || "OPEN_FAILED");
            }
          };
          try {
            // Never await anything before the runtime message. Worker must
            // call sidePanel.open synchronously in its message listener.
            Promise.resolve(scope.chrome.runtime.sendMessage(request))
              .then(settle, () => settle(null));
          } catch (_error) { settle(null); }
        });
      }
      actions.appendChild(more);
      footer.appendChild(actions);
      footer.appendChild(message);
    } else {
      footer.appendChild(el("div", "more-status",
        "채널 ID를 확인한 뒤에만 상세 분석 대상을 지정할 수 있습니다."));
    }
    container.appendChild(footer);
    return container;
  }

  function removeHost(reason = "NO_ACTIVE_TARGET", preserveState = false) {
    controller?.setCardRegion?.(null, null);
    if (host) host.remove();
    host = null;
    shadow = null;
    surface = null;
    currentKey = null;
    summaryArea = null;
    if (!preserveState) {
      currentAnchor = null;
      currentState = null;
    }
    lastRenderReason = reason;
    lastLayout = null;
  }

  /*
   * Placement never changes Hover state. Only the actual card receives pointer
   * events; the host/surface outside the card are click-through. A layout
   * fallback does not terminate a valid target. Anchor/viewport failures
   * are renderer-only reasons.
   */
  function position() {
    if (disposed || !host || !currentAnchor) return;
    if (!host.isConnected || !currentAnchor.isConnected ||
        typeof currentAnchor.getBoundingClientRect !== "function") {
      removeHost("ANCHOR_DETACHED", true);
      return;
    }

    const rect = currentAnchor.getBoundingClientRect();
    const vw = scope.innerWidth || doc.documentElement?.clientWidth || 0;
    const vh = scope.innerHeight || doc.documentElement?.clientHeight || 0;
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.right) ||
        !Number.isFinite(rect.top) || !Number.isFinite(rect.bottom) ||
        rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 ||
        rect.top >= vh || rect.right <= 0 || rect.left >= vw ||
        vw < 180 || vh < 140) {
      removeHost("ANCHOR_NOT_VISIBLE", true);
      return;
    }

    const width = Math.max(0, Math.min(MAX_WIDTH, vw - MARGIN * 2));
    const fullHeight = Math.max(0, vh - MARGIN * 2);
    host.style.width = width + "px";
    const cardRoot = surface?.childNodes?.[0] || null;
    if (cardRoot?.style) cardRoot.style.maxHeight = fullHeight + "px";
    const naturalHeight = Math.min(
      fullHeight, Math.max(1, host.getBoundingClientRect?.().height || fullHeight)
    );
    const maxLeft = Math.max(MARGIN, vw - width - MARGIN);
    const maxTop = Math.max(MARGIN, vh - naturalHeight - MARGIN);
    const alignedTop = Math.min(Math.max(MARGIN, rect.top), maxTop);
    const alignedLeft = Math.min(Math.max(MARGIN, rect.left), maxLeft);

    let left = alignedLeft;
    let top = alignedTop;
    let layout = "viewport-fallback";
    if (rect.right + ANCHOR_GAP + width <= vw - MARGIN) {
      left = rect.right + ANCHOR_GAP;
      layout = "right";
    } else if (rect.left - ANCHOR_GAP - width >= MARGIN) {
      left = rect.left - ANCHOR_GAP - width;
      layout = "left";
    } else if (rect.bottom + ANCHOR_GAP + Math.min(naturalHeight, 140) <= vh - MARGIN) {
      top = rect.bottom + ANCHOR_GAP;
      if (cardRoot?.style) cardRoot.style.maxHeight =
        Math.max(140, vh - MARGIN - top) + "px";
      layout = "below";
    } else if (rect.top - ANCHOR_GAP - Math.min(naturalHeight, 140) >= MARGIN) {
      const available = rect.top - ANCHOR_GAP - MARGIN;
      if (cardRoot?.style) cardRoot.style.maxHeight = available + "px";
      top = Math.max(MARGIN, rect.top - ANCHOR_GAP - Math.min(naturalHeight, available));
      layout = "above";
    }

    host.dataset.layout = layout;
    host.style.left = Math.round(left) + "px";
    host.style.top = Math.round(top) + "px";
    host.style.visibility = "visible";
    lastLayout = layout;
    lastRenderReason = "VISIBLE";
  }

  function queuePosition() {
    if (disposed || !currentState || moving) return;
    if (typeof scope.requestAnimationFrame !== "function") {
      if (host) position();
      else renderState(currentState);
      return;
    }
    moving = true;
    frame = scope.requestAnimationFrame(() => {
      moving = false;
      frame = null;
      if (host) position();
      else renderState(currentState);
    });
  }

  function renderState(state) {
    const unresolved = state.phase === "UNRESOLVED" &&
      state.targetType === "CHANNEL" && state.targetId === null &&
      state.identityStatus === "HANDLE_UNRESOLVED";
    const identified = state.phase === "READY" &&
      (state.targetType === "VIDEO" || state.targetType === "CHANNEL") &&
      controller?.isCurrentRequest({
        requestId: state.requestId,
        targetType: state.targetType,
        targetId: state.targetId,
      });

    if (!unresolved && !identified) {
      removeHost("NO_ACTIVE_TARGET");
      return;
    }

    currentState = state;
    currentAnchor = state.anchor;

    const mock = identified ? modelApi?.mockForTarget({
      targetType: state.targetType, targetId: state.targetId,
    }) : null;
    if (identified && !mock) {
      removeHost("MODEL_REJECTED", true);
      return;
    }
    if (!state.anchor || typeof state.anchor.getBoundingClientRect !== "function") {
      removeHost("ANCHOR_UNAVAILABLE", true);
      return;
    }
    if (!ensureHost()) {
      lastRenderReason = "DOCUMENT_BODY_UNAVAILABLE";
      return;
    }

    const key = [state.requestId, state.targetType, state.targetId || "UNRESOLVED"].join(":");
    if (key !== currentKey) {
      summaryArea = null;
      surface.replaceChildren(buildCard(state, mock));
      currentKey = key;
      lastAction = null;
    }
    host.dataset.phase = state.phase;
    host.dataset.targetType = state.targetType;
    theme();
    // Register before showing the card so capture-phase document pointer
    // handlers can recognize the host/Shadow card on its first pointerover.
    controller?.setCardRegion?.(host, surface.childNodes[0] || null);
    position();
  }

  function onSummaryUpdate() {
    if (
      disposed ||
      currentState?.phase !== "READY" ||
      !controller?.isCurrentRequest(currentState) ||
      !summaryArea?.isConnected
    ) {
      return;
    }

    // 현재 카드의 요약 부분만 변경한다.
    // 카드 Root와 더보기 버튼은 재생성하지 않는다.
    renderSummaryArea(summaryArea, currentState);

    // 내용 높이가 변경될 수 있으므로 위치만 재계산한다.
    position();
  }

  function onHoverState(state) {
    if (disposed) return;
    lastHoverPhase = state.phase || "IDLE";
    lastHoverReason = state.reason || "UNKNOWN";
    renderState(state);
  }

  function getRuntimeStatus() {
    return Object.freeze({
      connected, disposed,
      visible: Boolean(host?.isConnected && host?.style.visibility === "visible"),
      hostCount: host?.isConnected ? 1 : 0,
      phase: currentState?.phase ?? "IDLE",
      lastHoverPhase,
      lastHoverReason,
      requestId: currentState?.requestId ?? null,
      targetType: currentState?.targetType ?? null,
      targetId: currentState?.targetId ?? null,
      isSynthetic: host?.isConnected || false,
      lastRenderReason,
      layout: lastLayout,
      lastAction,
      summaryKind: lastSummaryKind,
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame !== null) scope.cancelAnimationFrame?.(frame);
    frame = null;
    moving = false;
    unsubscribe?.();
    summaryUnsubscribe?.();
    summaryUnsubscribe = null;
    unsubscribe = null;
    scope.removeEventListener?.("scroll", queuePosition, true);
    scope.removeEventListener?.("resize", queuePosition);
    scope.removeEventListener?.("pagehide", dispose);
    removeHost("DISPOSED");
    connected = false;
    if (scope.YUTOPIA_HOVER_CARD === api) delete scope.YUTOPIA_HOVER_CARD;
  }

  const api = Object.freeze({getRuntimeStatus, dispose});
  scope.YUTOPIA_HOVER_CARD = api;
  if (controller && modelApi && typeof controller.subscribe === "function") {
    unsubscribe = controller.subscribe(onHoverState);

  if (typeof summaryClient?.subscribe === "function") {
    summaryUnsubscribe =
      summaryClient.subscribe(onSummaryUpdate);
  }
    connected = true;
    scope.addEventListener?.("scroll", queuePosition, true);
    scope.addEventListener?.("resize", queuePosition);
    scope.addEventListener?.("pagehide", dispose);
  }
})(globalThis);
