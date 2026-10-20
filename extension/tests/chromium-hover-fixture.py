"""YUTOPIA 작업 25 — 실제 Chromium DOM 기반 Hover 상태 Fixture (오프라인).

명령: python extension/tests/chromium-hover-fixture.py
선행: Python Playwright + Chromium. 선택 환경변수 CHROMIUM_BIN 사용.
YouTube 라이브/Chrome 확장 Content Script 격리 세계/Side Panel은 시험하지 않는다.
PR 최초 제출 시점에는 이 Python Fixture의 실제 실행 결과가 검증되지 않았다.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

extension = Path(__file__).resolve().parents[1]
sources = []
for name in ["target-resolver.js", "channel-target-resolver.js", "content.js", "hover-controller.js"]:
    source = (extension / name).read_text(encoding="utf-8")
    marker = "})(globalThis);"
    if source.count(marker) != 1:
        raise RuntimeError(f"Unexpected module wrapper for {name}")
    sources.append(source.replace(marker, "})(window.__fixtureScope);"))

channel_id = "UC" + "a" * 22
html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>
<main id="fixture">
 <ytd-video-renderer id="video1">
  <a id="thumbnail" href="/watch?v=Ab0_-123xyz">Video A</a>
  <ytd-channel-name><a href="/channel/{channel_id}">Channel A</a></ytd-channel-name>
 </ytd-video-renderer>
 <ytd-video-renderer id="video2">
  <a id="thumbnail" href="/watch?v=Ab0_-123xyZ">Video B</a>
  <ytd-channel-name><a href="/@creator">Channel Handle</a></ytd-channel-name>
 </ytd-video-renderer>
</main>
</body></html>"""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_BIN") or None,
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    try:
        page = browser.new_page()
        page.set_content(html)
        old_html = page.locator("#fixture").inner_html()
        page.evaluate("""() => {
            window.__fixtureScope = {
                document,
                location: {
                    origin:'https://www.youtube.com',
                    pathname:'/',
                    href:'https://www.youtube.com/'
                },
                MutationObserver,
                setTimeout:window.setTimeout.bind(window),
                clearTimeout:window.clearTimeout.bind(window),
                addEventListener:window.addEventListener.bind(window),
                removeEventListener:window.removeEventListener.bind(window)
            };
        }""")
        for source in sources:
            page.add_script_tag(content=source)

        assert page.locator("#fixture").inner_html() == old_html, "YUTOPIA module wrote to the YouTube-like DOM"
        runtime = page.evaluate("window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getRuntimeStatus()")
        assert runtime["boundVideoAnchors"] == 2, runtime
        assert runtime["boundChannelAnchors"] == 2, runtime

        def hover_state():
            return page.evaluate("window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot()")

        # 100ms quick hover never reaches READY.
        page.locator("#video1 a#thumbnail").dispatch_event("pointerenter")
        page.wait_for_timeout(100)
        page.locator("#video1 a#thumbnail").dispatch_event("pointerleave")
        page.wait_for_timeout(450)
        assert hover_state()["phase"] == "IDLE", hover_state()

        # VIDEO thumbnail hover reaches READY and keeps its own target id.
        page.locator("#video1 a#thumbnail").dispatch_event("pointerenter")
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot().phase === 'READY'""",
            timeout=4000,
        )
        selected = hover_state()
        assert selected["targetType"] == "VIDEO", selected
        assert selected["targetId"] == "Ab0_-123xyz", selected

        # Moving from the anchor into a future overlay cancels leave grace.
        page.locator("#video1 a#thumbnail").dispatch_event("pointerleave")
        page.evaluate("window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.overlayPointerEnter()")
        page.wait_for_timeout(260)
        assert hover_state()["phase"] == "READY", hover_state()
        page.evaluate("window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.overlayPointerLeave()")
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot().phase === 'IDLE'""",
            timeout=4000,
        )

        # Channel handle only: unresolved, no stable targetId.
        page.locator("#video2 ytd-channel-name a").dispatch_event("pointerenter")
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot().phase === 'UNRESOLVED'""",
            timeout=4000,
        )
        handle = hover_state()
        assert handle["targetId"] is None and handle["identityStatus"] == "HANDLE_UNRESOLVED", handle

        # Keyboard focus and Escape work without blocking native YouTube key handlers.
        page.locator("#video1 a#thumbnail").dispatch_event("focusin")
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot().phase === 'READY'""",
            timeout=4000,
        )
        page.evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
        assert hover_state()["phase"] == "DISMISSED", hover_state()

        # SPA removal clears bindings / selection without modifying page on behalf of controller.
        page.locator("#video1").evaluate("(element) => element.remove()")
        page.wait_for_function(
            """window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER.getRuntimeStatus().boundVideoAnchors === 1""",
            timeout=4000,
        )
        result = page.evaluate("""() => {
            const hover = window.__fixtureScope.YUTOPIA_HOVER_CONTROLLER;
            hover.dispose();
            return hover.getRuntimeStatus();
        }""")
        assert result["disposed"] and result["boundVideoAnchors"] == 0, result
        assert not result["enterScheduled"] and not result["leaveScheduled"], result
        print("CHROMIUM_HOVER_FIXTURE_PASS", runtime, selected["targetId"], result)
    finally:
        browser.close()
