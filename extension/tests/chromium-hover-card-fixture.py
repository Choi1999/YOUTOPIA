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
        status = page.evaluate("window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus()")
        assert status["connected"] and not status["visible"], status

        # 100ms transit must not create card.
        page.locator("#video-a a#thumbnail").hover()
        page.wait_for_timeout(100)
        page.mouse.move(950, 700)
        page.wait_for_timeout(460)
        assert card.count() == 0

        # VIDEO A card, MOCK data, real Shadow DOM from browser engine.
        page.locator("#video-a a#thumbnail").hover()
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().visible",
            timeout=5000,
        )
        assert card.count() == 1
        assert "Ab0_-123xyz" in card.inner_text()
        assert "DEMO" in card.inner_text()
        assert "실제 YouTube 댓글" in card.inner_text()
        assert card.locator(".bar").count() == 1
        geom = card.bounding_box()
        assert geom and geom["x"] >= 0 and geom["x"] + geom["width"] <= 1000

        # Functional CTA tells the truth: no Side Panel handoff yet.
        card.locator(".more").click()
        assert "27~28번" in card.locator(".more-status").inner_text()
        assert page.locator("#youtube-fixture").inner_html() == fixture_before

        # Changing target replaces A, never leaves its numbers/id in B.
        page.locator("#video-b a#thumbnail").hover()
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().targetId === 'Ab0_-123xyZ'""",
            timeout=5000,
        )
        assert "Ab0_-123xyZ" in card.inner_text()
        assert "Ab0_-123xyz" not in card.inner_text()

        # Unresolved handle must not show a chart or expose a fabricated UC ID.
        page.locator("#video-b ytd-channel-name a").hover()
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CARD.getRuntimeStatus().phase === 'UNRESOLVED'""",
            timeout=5000,
        )
        assert card.locator(".bar").count() == 0
        assert card.locator(".more").count() == 0
        assert "채널 ID 확인 필요" in card.inner_text()

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
