/*
 * YUTOPIA Hover Card UI — 작업 26 (개발자 로컬 DEMO)
 *
 * 목적: 25번 Hover Controller의 READY/UNRESOLVED 상태에 반응하여 YouTube에
 *       카드 한 개를 Shadow DOM으로 표시하고 사용성·위치를 시험한다.
 * 입력: 사용자 Hover 상태, 안정된 VIDEO/CHANNEL 대상, 고정 STATIC_FIXTURE.
 * 출력: 대상별 합성 미니 차트, 예시 브리핑, 가상 분모/기간, 닫기/더보기 안내.
 * 실패: 미확정 ID/앵커 제거/화면 밖/오래된 requestId면 이전 카드 즉시 제거.
 * 보안: 실제 제목·댓글·시청기록·API 수집 없음, innerHTML 없음, 사이트 이벤트 미차단.
 * 경계: 27·28번 서비스 워커 메시지·Side Panel 대상 고정은 미구현.
 */
(function initializeYutopiaHoverCard(scope) {
  "use strict";
  if (scope.YUTOPIA_HOVER_CARD) return;

  const controller = scope.YUTOPIA_HOVER_CONTROLLER;
  const modelApi = scope.YUTOPIA_HOVER_CARD_MODEL;
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
  let connected = false;
  let disposed = false;
  let moving = false;
  let frame = null;
  let lastAction = null;

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
    surface.setAttribute("data-yutopia-card-surface", "true");
    surface.addEventListener("pointerenter", () => controller?.overlayPointerEnter());
    surface.addEventListener("pointerleave", () => controller?.overlayPointerLeave());
    surface.addEventListener("focusin", () => controller?.overlayFocusIn());
    surface.addEventListener("focusout", event => {
      if (!surface.contains(event.relatedTarget)) controller?.overlayFocusOut();
    });
    shadow.appendChild(surface);
    doc.body.appendChild(host);
    return true;
  }

  function theme() {
    if (!host) return;
    const dark = Boolean(doc?.documentElement?.hasAttribute?.("dark"));
    host.dataset.theme = dark ? "dark" : "light";
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
    header.appendChild(el("span", "tag", "DEMO · 가상 데이터"));
    header.appendChild(el("span", "spacer"));
    const close = el("button", "close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "YUTOPIA 카드 닫기");
    close.addEventListener("click", () => controller?.dismiss("CARD_CLOSE"));
    header.appendChild(close);
    container.appendChild(header);

    const body = el("div", "body");
    body.appendChild(el("h2", "", unresolved ? "채널 ID 확인 필요" : mock.title));
    body.appendChild(el("div", "target",
      unresolved ? "채널 핸들만 확인됨 · 채널 ID 미확정" :
      (isVideo ? "영상 ID: " : "채널 ID: ") + mock.targetId));

    if (unresolved) {
      const text = el("p", "notice",
        "이 채널 링크는 @handle 형식입니다. 정확한 채널 ID 매핑이 없어 분석을 표시하지 않습니다.");
      body.appendChild(text);
    } else {
      const metric = el("section", "section");
      metric.appendChild(el("strong", "heading", "반응 분포 · 시연용 합성 비율"));

      const bar = el("div", "bar");
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label",
        "가상 긍정 " + mock.positive + "퍼센트, 중립 " + mock.neutral +
        "퍼센트, 부정 " + mock.negative + "퍼센트. 실제 분석값이 아닙니다.");
      for (const [kind, value] of [
        ["positive", mock.positive], ["neutral", mock.neutral], ["negative", mock.negative],
      ]) {
        const segment = el("span", kind);
        segment.style.width = String(value) + "%";
        bar.appendChild(segment);
      }
      metric.appendChild(bar);

      const legend = el("div", "legend");
      for (const [kind, label, value] of [
        ["positive", "긍정", mock.positive],
        ["neutral", "중립", mock.neutral],
        ["negative", "부정", mock.negative],
      ]) {
        const item = el("span", "legend-item");
        item.appendChild(el("span", "dot " + kind));
        item.appendChild(doc.createTextNode(label + " " + value + "%"));
        legend.appendChild(item);
      }
      metric.appendChild(legend);
      body.appendChild(metric);

      const issues = el("section", "section");
      issues.appendChild(el("strong", "heading", "주요 논점 · 가상 예시"));
      const topics = el("ul", "topics");
      for (const topic of mock.topics) topics.appendChild(el("li", "", topic));
      issues.appendChild(topics);
      body.appendChild(issues);

      const briefing = el("section", "section");
      briefing.appendChild(el("strong", "heading", "짧은 브리핑"));
      briefing.appendChild(el("p", "briefing", mock.briefing));
      body.appendChild(briefing);

      body.appendChild(el("p", "meta",
        mock.sampleLabel + " · " + mock.scopeLabel + "\n" +
        mock.periodLabel + " · " + mock.updatedLabel));
      body.appendChild(el("div", "notice",
        "STATIC FIXTURE · 실제 YouTube 댓글·통계·감성 분석 결과가 아닙니다."));
    }

    container.appendChild(body);

    const footer = el("footer", "footer");
    if (!unresolved) {
      const actions = el("div", "actions");
      const more = el("button", "more", "더보기 →");
      more.type = "button";
      more.setAttribute("aria-label", "가상 반응 미리보기 더보기 안내");
      const message = el("div", "more-status");
      message.setAttribute("role", "status");
      message.hidden = true;
      more.addEventListener("click", () => {
        if (!controller?.isCurrentRequest({
          requestId: state.requestId,
          targetType: state.targetType,
          targetId: state.targetId,
        })) return;
        message.hidden = false;
        message.textContent = "상세 Side Panel 대상 전달은 27~28번에서 연결됩니다. 현재는 DEMO 카드만 제공합니다.";
        lastAction = "MORE_INFO";
        // 클릭 안내로 카드 높이가 변하면 썸네일 겹침을 다시 검사한다.
        queuePosition();
      });
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

  function removeHost() {
    if (host) host.remove();
    host = null;
    shadow = null;
    surface = null;
    currentKey = null;
    currentAnchor = null;
    currentState = null;
  }

  /*
   * 앵커 우측 우선, 부족하면 좌측, 그마저 부족하면 화면 안쪽으로 위치를 제한한다.
   * 고정 좌표와 썸네일 순서가 아니라 실제 getBoundingClientRect를 사용한다.
   * 스크롤 등으로 앵커가 사라지면 지난 영상/채널 카드가 남지 않게 닫는다.
   */
  function position() {
    if (disposed || !host || !currentAnchor) return;
    if (!host.isConnected || !currentAnchor.isConnected ||
        typeof currentAnchor.getBoundingClientRect !== "function") {
      controller?.dismiss("ANCHOR_DETACHED");
      removeHost();
      return;
    }

    const rect = currentAnchor.getBoundingClientRect();
    const vw = scope.innerWidth || doc.documentElement?.clientWidth || 0;
    const vh = scope.innerHeight || doc.documentElement?.clientHeight || 0;
    if (
      !Number.isFinite(rect.left) || !Number.isFinite(rect.right) ||
      !Number.isFinite(rect.top) || !Number.isFinite(rect.bottom) ||
      rect.width <= 0 || rect.height <= 0 ||
      rect.bottom <= 0 || rect.top >= vh || vw < 180 || vh < 140
    ) {
      controller?.dismiss("ANCHOR_NOT_VISIBLE");
      removeHost();
      return;
    }

    /*
     * YU26 Chromium 회귀: A 카드가 B 썸네일의 중앙을 덮어 실제 Hover를
     * 차단하는 문제를 방지한다. 기존 아래 배치 조건은 카드 자연 높이가
     * 남은 뷰포트보다 크면 아무것도 하지 않았으므로, 카드 내부 스크롤
     * 높이를 제한한 뒤 우측/좌측/아래/위 후보를 재평가한다.
     *
     * 다른 링크의 텍스트/시청 데이터는 읽지 않고 화면 좌표만 확인한다.
     * 어떤 후보도 인접 썸네일 중앙을 보존하지 못하면 fail-closed로 숨긴다.
     */
    const width = Math.max(0, Math.min(MAX_WIDTH, vw - MARGIN * 2));
    host.style.width = width + "px";
    const cardRoot = surface?.childNodes?.[0] || null;
    const fullHeight = Math.max(0, vh - MARGIN * 2);
    if (cardRoot?.style) cardRoot.style.maxHeight = fullHeight + "px";
    const naturalHeight = Math.min(
      fullHeight, Math.max(0, host.getBoundingClientRect?.().height || 0)
    );
    const maxLeft = Math.max(MARGIN, vw - width - MARGIN);
    const clampedLeft = Math.min(Math.max(MARGIN, rect.left), maxLeft);
    const preferredTop = Math.min(
      Math.max(MARGIN, rect.top), Math.max(MARGIN, vh - naturalHeight - MARGIN)
    );

    let thumbnailLinks = [];
    if (typeof doc.querySelectorAll === "function") {
      try {
        thumbnailLinks = Array.from(doc.querySelectorAll(
          "a#thumbnail[href], a.yt-lockup-view-model__content-image[href]"
        )).slice(0, 180);
      } catch (_error) {
        thumbnailLinks = [];
      }
    }

    function collisionScore(candidate) {
      const {left, top, height} = candidate;
      let score = 0;
      let blocksCenter = false;
      for (const link of thumbnailLinks) {
        if (link === currentAnchor || !link?.isConnected ||
            typeof link.getBoundingClientRect !== "function") continue;
        const box = link.getBoundingClientRect();
        if (!box || box.width <= 0 || box.height <= 0 || box.bottom <= 0 ||
            box.top >= vh || box.right <= 0 || box.left >= vw) continue;
        const overlapWidth = Math.max(
          0, Math.min(left + width, box.right) - Math.max(left, box.left)
        );
        const overlapHeight = Math.max(
          0, Math.min(top + height, box.bottom) - Math.max(top, box.top)
        );
        score += (overlapWidth * overlapHeight) / (box.width * box.height);
        const middleX = (box.left + box.right) / 2;
        const middleY = (box.top + box.bottom) / 2;
        if (
          middleX > left && middleX < left + width &&
          middleY > top && middleY < top + height
        ) blocksCenter = true;
      }
      return {score, blocksCenter};
    }

    const choices = [];
    function offer(left, top, availableHeight, order) {
      if (availableHeight < 140 || left < MARGIN || left + width > vw - MARGIN) return;
      const height = Math.min(naturalHeight, availableHeight);
      if (height <= 0) return;
      const candidate = {left, top, height, maxHeight: availableHeight, order};
      const collision = collisionScore(candidate);
      if (!collision.blocksCenter) {
        choices.push({...candidate, score: collision.score + order * 0.035});
      }
    }

    const right = rect.right + ANCHOR_GAP;
    const left = rect.left - width - ANCHOR_GAP;
    offer(right, preferredTop, fullHeight, 0);
    offer(left, preferredTop, fullHeight, 1);

    const below = rect.bottom + ANCHOR_GAP;
    offer(clampedLeft, below, vh - MARGIN - below, 2);

    const aboveSpace = rect.top - ANCHOR_GAP - MARGIN;
    const aboveHeight = Math.min(naturalHeight, aboveSpace);
    offer(clampedLeft, rect.top - ANCHOR_GAP - aboveHeight, aboveSpace, 3);

    // 좁은 화면에서는 우/좌 후보가 동시에 영역 밖일 수 있다.
    if (choices.length === 0 && thumbnailLinks.length === 0) {
      offer(clampedLeft, preferredTop, fullHeight, 4);
    }
    if (choices.length === 0) {
      controller?.dismiss("NO_SAFE_HOVER_PLACEMENT");
      removeHost();
      return;
    }

    choices.sort((a, b) => a.score - b.score || a.order - b.order);
    const best = choices[0];
    if (cardRoot?.style) cardRoot.style.maxHeight = best.maxHeight + "px";
    host.style.left = Math.round(best.left) + "px";
    host.style.top = Math.round(best.top) + "px";
    host.style.visibility = "visible";
  }

  function queuePosition() {
    if (disposed || !host || moving) return;
    if (typeof scope.requestAnimationFrame !== "function") {
      position();
      return;
    }
    moving = true;
    frame = scope.requestAnimationFrame(() => {
      moving = false;
      frame = null;
      position();
    });
  }

  /*
   * LEAVE_PENDING 동안은 기존 카드를 유지해 포인터가 화면 카드로 이동할 수 있다.
   * 타깃/requestId가 달라지면 이전 카드를 절대 재사용하지 않는다.
   */
  function onHoverState(state) {
    if (disposed) return;
    if (state.phase === "LEAVE_PENDING") {
      if (host && currentState?.requestId === state.requestId &&
          currentState?.anchor === state.anchor) {
        currentState = state;
        host.dataset.phase = "LEAVE_PENDING";
        queuePosition();
      } else removeHost();
      return;
    }

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
      removeHost();
      return;
    }

    const mock = identified ? modelApi?.mockForTarget({
      targetType: state.targetType, targetId: state.targetId,
    }) : null;
    if (identified && !mock) {
      removeHost();
      return;
    }
    if (!state.anchor || typeof state.anchor.getBoundingClientRect !== "function") {
      removeHost();
      return;
    }
    if (!ensureHost()) return;

    const key = [state.requestId, state.targetType, state.targetId || "UNRESOLVED"].join(":");
    if (key !== currentKey) {
      surface.replaceChildren(buildCard(state, mock));
      currentKey = key;
      lastAction = null;
    }
    currentState = state;
    currentAnchor = state.anchor;
    host.dataset.phase = state.phase;
    host.dataset.targetType = state.targetType;
    theme();
    position();
  }

  function getRuntimeStatus() {
    return Object.freeze({
      connected, disposed,
      visible: Boolean(host?.isConnected && host?.style.visibility === "visible"),
      hostCount: host?.isConnected ? 1 : 0,
      phase: currentState?.phase ?? "IDLE",
      requestId: currentState?.requestId ?? null,
      targetType: currentState?.targetType ?? null,
      targetId: currentState?.targetId ?? null,
      isSynthetic: host?.isConnected || false,
      lastAction,
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame !== null) scope.cancelAnimationFrame?.(frame);
    frame = null;
    moving = false;
    unsubscribe?.();
    unsubscribe = null;
    scope.removeEventListener?.("scroll", queuePosition, true);
    scope.removeEventListener?.("resize", queuePosition);
    scope.removeEventListener?.("pagehide", dispose);
    removeHost();
    connected = false;
    if (scope.YUTOPIA_HOVER_CARD === api) delete scope.YUTOPIA_HOVER_CARD;
  }

  const api = Object.freeze({getRuntimeStatus, dispose});
  scope.YUTOPIA_HOVER_CARD = api;
  if (controller && modelApi && typeof controller.subscribe === "function") {
    unsubscribe = controller.subscribe(onHoverState);
    connected = true;
    scope.addEventListener?.("scroll", queuePosition, true);
    scope.addEventListener?.("resize", queuePosition);
    scope.addEventListener?.("pagehide", dispose);
  }
})(globalThis);
