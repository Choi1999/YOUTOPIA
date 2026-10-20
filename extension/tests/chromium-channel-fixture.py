"""YUTOPIA 작업 24 — 오프라인 Chromium 채널 식별 Fixture.

명령: python extension/tests/chromium-channel-fixture.py
환경변수 CHROMIUM_BIN으로 설치된 Chromium 경로 지정 가능.
실제 YouTube 사이트/API 또는 Chrome 확장 등록은 시험하지 않는다.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

extension = Path(__file__).resolve().parents[1]
source_names = ["channel-target-resolver.js", "target-resolver.js", "content.js"]
sources = []
for name in source_names:
    text = (extension / name).read_text(encoding="utf-8")
    marker = "})(globalThis);"
    assert text.count(marker) == 1, f"{name}: 진입점이 변경됨"
    sources.append(text.replace(marker, "})(window.__fixtureScope);"))

channel_id = "UC" + "a" * 22
another_channel_id = "UC" + "b" * 22

html = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>
<ytd-rich-item-renderer id="home-video">
  <a id="thumbnail" href="/watch?v=Ab0_-123xyz">Fixture Video</a>
  <ytd-channel-name><a href="/@creator">Channel handle</a></ytd-channel-name>
</ytd-rich-item-renderer>
<ytd-channel-renderer id="channel-result"><a href="/channel/{channel_id}">Channel ID</a></ytd-channel-renderer>
<ytd-ad-slot-renderer><ytd-channel-renderer>
  <a href="/channel/{another_channel_id}">Advertised channel</a>
</ytd-channel-renderer></ytd-ad-slot-renderer>
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
        original = page.locator("body").inner_html()
        page.evaluate("""() => {
            window.__fixtureScope = {
                document,
                location: {
                    pathname:'/', origin:'https://www.youtube.com',
                    href:'https://www.youtube.com/'
                },
                MutationObserver,
                setTimeout: window.setTimeout.bind(window),
                clearTimeout: window.clearTimeout.bind(window),
                addEventListener: window.addEventListener.bind(window),
                removeEventListener: window.removeEventListener.bind(window)
            };
        }""")
        for source in sources:
            page.add_script_tag(content=source)
        assert page.locator("body").inner_html() == original, "탐지기가 원본 DOM을 수정함"

        first = page.evaluate("window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getRuntimeStatus()")
        assert first["channelLinksTracked"] == 2, first
        assert first["channelIdsFormatted"] == 1, first
        assert first["unresolvedHandles"] == 1, first
        assert first["identifiedCandidates"] == 1, first

        # handle은 channelId로 승격하지 않는다.
        handle = page.evaluate("""() =>
            window.__fixtureScope.YUTOPIA_CHANNEL_TARGET_RESOLVER.resolveFromHref('/@creator')
        """)
        assert handle["targetId"] is None and handle["resolutionStatus"] == "HANDLE_UNRESOLVED", handle

        # DOM에 새 채널 카드 삽입 후 기존 MutationObserver 하나로 재검색.
        page.evaluate("""() => {
            const card=document.createElement('ytd-channel-renderer');
            card.id='dynamic-channel';
            const a=document.createElement('a');
            a.setAttribute('href','/@anothercreator');
            card.appendChild(a);
            document.body.appendChild(card);
        }""")
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getRuntimeStatus().channelLinksTracked === 3",
            timeout=5000,
        )
        page.evaluate(
            """(id) => document.querySelector('ytd-channel-name a')
                .setAttribute('href','/channel/'+id)""",
            another_channel_id,
        )
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getRuntimeStatus().channelIdsFormatted === 2",
            timeout=5000,
        )
        page.locator("#channel-result").evaluate("(element) => element.remove()")
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getRuntimeStatus().channelLinksTracked === 2",
            timeout=5000,
        )

        # 채널과 영상의 이벤트는 서로 다른 구독 경계.
        page.evaluate("""() => {
            window.__fixtureScope.__channelChanges = [];
            window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.subscribeChannels(event => {
                window.__fixtureScope.__channelChanges.push({
                    added:event.added.length, removed:event.removed.length,
                    updated:event.updated.length
                });
            });
        }""")
        page.evaluate("""() => {
            window.__fixtureScope.location.pathname='/watch';
            document.dispatchEvent(new Event('yt-navigate-finish'));
        }""")
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getRuntimeStatus().channelLinksTracked === 0",
            timeout=5000,
        )
        page.evaluate("""() => {
            window.__fixtureScope.location.pathname='/results';
            window.dispatchEvent(new Event('popstate'));
        }""")
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getRuntimeStatus().channelLinksTracked === 2",
            timeout=5000,
        )
        final = page.evaluate("window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getRuntimeStatus()")
        assert final["unresolvedHandles"] == 1, final
        assert len(page.evaluate("window.__fixtureScope.__channelChanges")) >= 3

        status = page.evaluate("""() => {
            const api=window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY;
            api.dispose();
            return api.getRuntimeStatus();
        }""")
        assert status["channelLinksTracked"] == 0, status
        assert status["channelSubscriberCount"] == 0, status
        assert status["disposed"] and not status["observing"], status
        print("CHROMIUM_CHANNEL_FIXTURE_PASS", first, final, status)
    finally:
        browser.close()
