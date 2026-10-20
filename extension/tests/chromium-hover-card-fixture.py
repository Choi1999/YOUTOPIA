"""YUTOPIA 26번 — 오프라인 Chromium 실제 DOM/Shadow UI Fixture.

실행: python extension/tests/chromium-hover-card-fixture.py
선행: Python Playwright 설치 + Chromium 브라우저.
CHROMIUM_BIN 환경변수로 별도 Chromium 실행 경로 지정 가능.
실제 youtube.com 또는 Chrome MV3 확장 주입·Service Worker E2E는 아니다.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

extension = Path(__file__).resolve().parents[1]
modules = [
    "target-resolver.js", "channel-target-resolver.js", "content.js",
    "hover-pointer-tracker.js", "hover-presence-reducer.js",
    "hover-controller.js", "hover-card-model.js", "hover-card.js",
]
scripts = []
for name in modules:
    source = (extension / name).read_text(encoding="utf-8")
    marker = "})(globalThis);"
    assert source.count(marker) == 1, f"Fixture expects one module wrapper: {name}"
    scripts.append(source.replace(marker, "})(window.__fixtureScope);"))

channel_id = "UC" + "a" * 22
markup = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
  body {{ font: 14px sans-serif; margin:0; }}
  main {{ display:flex; gap:20px; padding:130px 22px 50px; }}
  ytd-video-renderer {{ display:block; width:220px; }}
  a {{ display:block; min-height:32px; margin:7px 0; }}
  a#thumbnail {{ width:190px; height:110px; background:#dbdfeb; }}
</style></head><body>
<main id="youtube-fixture">
  <ytd-video-renderer id="video-a">
    <a id="thumbnail" href="/watch?v=Ab0_-123xyz">Video A</a>
    <ytd-channel-name><a href="/channel/{channel_id}">Channel with UC</a></ytd-channel-name>
  </ytd-video-renderer>
  <ytd-video-renderer id="video-b">
    <a id="thumbnail" href="/watch?v=Ab0_-123xyZ">Video B</a>
    <ytd-channel-name><a href="/@creator">Unresolved handle</a></ytd-channel-name>
  </ytd-video-renderer>
</main></body></html>"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_BIN") or None,
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    try:
        page = browser.new_page(viewport={"width": 1000, "height": 740})
        page.set_content(markup)
        fixture_before = page.locator("#youtube-fixture").inner_html()
        page.evaluate("""() => {
            window.__fixtureScope = {
                document, location: {
                    pathname:'/', origin:'https://www.youtube.com',
                    href:'https://www.youtube.com/'
                },
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                MutationObserver,
                setTimeout: window.setTimeout.bind(window),
                clearTimeout: window.clearTimeout.bind(window),
                requestAnimationFrame: window.requestAnimationFrame.bind(window),
                cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
                addEventListener: window.addEventListener.bind(window),
                removeEventListener: window.removeEventListener.bind(window)
            };
        }""")
        for source in scripts:
            page.add_script_tag(content=source)
        assert page.locator("#youtube-fixture").inner_html() == fixture_before, "Original YouTube-like DOM changed"

        card = page.locator("#yutopia-extension-hover-card")
        # Host.inner_text() excludes Shadow DOM contents in Chromium.
        # Playwright CSS locators pierce open Shadow Roots.
        card_content = card.locator(".card")
        status = page.evaluate("window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus()")
        assert status["connected"] and not status["visible"], status

        # Strict Hover: entry shows a preview immediately, without timers.
        page.locator("#video-a a#thumbnail").hover()
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().visible",
            timeout=5000,
        )
        assert page.evaluate(
            "window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getRuntimeStatus().activationDelayMs"
        ) == 0
        page.mouse.move(950, 700)
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().hostCount === 0",
            timeout=5000,
        )

        # VIDEO A card, MOCK data, real Shadow DOM from browser engine.
        page.locator("#video-a a#thumbnail").hover()
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().visible",
            timeout=5000,
        )
        assert card.count() == 1
        assert page.evaluate("Boolean(document.querySelector('#yutopia-extension-hover-card')?.shadowRoot)"), "Shadow Root missing"
        assert card_content.count() == 1, "Shadow Card subtree missing"
        assert "Ab0_-123xyz" in card_content.inner_text()
        assert "DEMO" in card_content.inner_text()
        assert "실제 YouTube 댓글" in card_content.inner_text()
        assert card.locator(".bar").count() == 1
        geom = card.bounding_box()
        assert geom and geom["x"] >= 0 and geom["x"] + geom["width"] <= 1000

        # Cards are read-only and click-through in strict thumbnail mode.
        # The future Side Panel CTA is not yet a pointer-interactive action.
        assert card.locator(".more").is_disabled()
        assert card.locator(".close").is_disabled()
        assert page.evaluate("""() => {
            const host=document.querySelector('#yutopia-extension-hover-card');
            return host && getComputedStyle(host).pointerEvents === 'none';
        }""")
        assert page.locator("#youtube-fixture").inner_html() == fixture_before

        # Repeated true thumbnail boundary crossing must always show/hide.
        # No 160ms entrance or 200ms exit grace is expected.
        page.mouse.move(950, 700)
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().hostCount === 0",
            timeout=5000,
        )
        for cycle in range(10):
            page.locator("#video-a a#thumbnail").hover(timeout=5000)
            page.wait_for_function(
                """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().visible &&
                   window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().targetId === 'Ab0_-123xyz'""",
                timeout=5000,
            )
            page.mouse.move(950, 700)
            page.wait_for_function(
                "window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().hostCount === 0",
                timeout=5000,
            )

        # Escape closes immediately; physical exit and reentry restore the card.
        page.locator("#video-a a#thumbnail").hover(timeout=5000)
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().visible",
            timeout=5000,
        )
        page.keyboard.press("Escape")
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().hostCount === 0",
            timeout=5000,
        )
        page.mouse.move(950, 700)
        page.locator("#video-a a#thumbnail").hover(timeout=5000)
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().visible &&
               window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().targetId === 'Ab0_-123xyz'""",
            timeout=5000,
        )

        # Regression: Chromium must immediately switch between A and B,
        # and the preview must never intercept B's pointer center.
        # force=True로 Overlay를 우회하면 실제 UX 결함이 가려지므로 사용하지 않는다.
        neighbor = page.evaluate("""() => {
            const link = document.querySelector("#video-b a#thumbnail");
            const rect = link.getBoundingClientRect();
            const x = (rect.left + rect.right) / 2;
            const y = (rect.top + rect.bottom) / 2;
            const top = document.elementFromPoint(x, y);
            const popup = document.querySelector("#yutopia-extension-hover-card");
            return {
                canHover: Boolean(top && (top === link || link.contains(top))),
                topElement: top?.tagName || null,
                topId: top?.id || null,
                linkRect: {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},
                popupRect: popup ? (() => {
                    const r = popup.getBoundingClientRect();
                    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};
                })() : null
            };
        }""")
        assert neighbor["canHover"], f"Video B center is blocked by YUTOPIA card: {neighbor}"
        # Playwright가 자체적으로 click/hover 경로를 검증하도록 일반 Hover 유지.
        page.locator("#video-b a#thumbnail").hover(timeout=5000)
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().targetId === 'Ab0_-123xyZ'""",
            timeout=5000,
        )
        assert "Ab0_-123xyZ" in card_content.inner_text()
        assert "Ab0_-123xyz" not in card_content.inner_text()

        # Repeated A -> B -> A with no leave/entry delay or stale card.
        for cycle in range(10):
            page.locator("#video-a a#thumbnail").hover(timeout=5000)
            page.wait_for_function(
                """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().targetId === 'Ab0_-123xyz'""",
                timeout=5000,
            )
            page.locator("#video-b a#thumbnail").hover(timeout=5000)
            page.wait_for_function(
                """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().targetId === 'Ab0_-123xyZ'""",
                timeout=5000,
            )
            assert card.count() == 1

        # SPA가 포인터 아래 썸네일 노드를 교체해도 다음 mousemove 없이 복구해야 한다.
        # 이전 코드에는 새 anchor의 pointerenter 이벤트가 누락되어 IDLE에 머물 위험이 있었다.
        before_request = page.evaluate(
            "window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot().requestId"
        )
        page.evaluate("""() => {
            const oldLink = document.querySelector('#video-b a#thumbnail');
            oldLink.replaceWith(oldLink.cloneNode(true));
        }""")
        page.wait_for_function(
            """previous => {
                const controller = window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER;
                const state = controller.getSnapshot();
                // Reusing a logical target is allowed to retain requestId
                // when the hovered DOM anchor is replaced during SPA render.
                return state.requestId >= previous && state.phase === 'READY' &&
                    state.targetId === 'Ab0_-123xyZ' &&
                    state.anchor?.isConnected &&
                    window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().visible;
            }""",
            arg=before_request,
            timeout=5000,
        )
        assert "Ab0_-123xyZ" in card_content.inner_text()

        # Unresolved handle must not show a chart or expose a fabricated UC ID.
        page.locator("#video-b ytd-channel-name a").hover()
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().phase === 'UNRESOLVED'""",
            timeout=5000,
        )
        assert card.locator(".bar").count() == 0
        assert card.locator(".more").count() == 0
        assert "채널 ID 확인 필요" in card_content.inner_text()

        # Escape closes the card without interfering with site content.
        page.keyboard.press("Escape")
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().hostCount === 0""",
            timeout=5000,
        )
        assert card.count() == 0

        # Explicit dispose disconnects root/listeners but not YouTube's DOM.
        cleanup = page.evaluate("""() => {
            const ui=window.__fixtureScope.YUTOPIA_HOVER_CARD;
            ui.dispose();
            return ui.getRuntimeStatus();
        }""")
        assert cleanup["disposed"] and cleanup["hostCount"] == 0, cleanup
        assert page.locator("#youtube-fixture").inner_html() == fixture_before
        print("CHROMIUM_HOVER_CARD_FIXTURE_PASS", status, cleanup)
    finally:
        browser.close()
