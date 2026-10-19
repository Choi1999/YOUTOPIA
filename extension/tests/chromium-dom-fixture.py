"""작업 21 선택적 Chromium DOM Fixture 테스트.

실행: python -m playwright install chromium (최초 1회)
      python extension/tests/chromium-dom-fixture.py
환경변수 CHROMIUM_BIN으로 설치된 Chromium 실행 경로를 지정할 수 있습니다.
실제 Chrome 확장 주입이나 실서비스 YouTube 시험은 아닙니다.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

source = (Path(__file__).resolve().parents[1] / "content.js").read_text(encoding="utf-8")
assert source.endswith("})(globalThis);\n"), "스크립트 진입점이 변경되어 Fixture 조정이 필요함"
fixture_script = source.replace("})(globalThis);", "})(window.__fixtureScope);")

home = """<!doctype html><html><body>
<ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=alpha">Video A</a></ytd-rich-item-renderer>
<ytd-rich-item-renderer><yt-lockup-view-model><a class="yt-lockup-view-model__content-image" href="/watch?v=beta">Video B</a></yt-lockup-view-model></ytd-rich-item-renderer>
<ytd-ad-slot-renderer><ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=advertisement">Ad</a></ytd-rich-item-renderer></ytd-ad-slot-renderer>
<ytd-rich-item-renderer><a id="thumbnail" href="/shorts/shortVid">Short</a></ytd-rich-item-renderer>
</body></html>"""
search = """<!doctype html><html><body>
<ytd-video-renderer><a id="thumbnail" href="/watch?v=searchA">Search video</a></ytd-video-renderer>
<ytd-video-renderer><a id="thumbnail" href="https://not-youtube.test/watch?v=bad">Offsite</a></ytd-video-renderer>
</body></html>"""

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_BIN") or None,
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    try:
        page = browser.new_page()
        for pathname, markup, expected in [("/", home, 2), ("/results", search, 1)]:
            page.set_content(markup)
            before = page.locator("body").inner_html()
            page.evaluate("""(pathname) => { window.__fixtureScope = {
                document, location: {
                    pathname, origin: 'https://www.youtube.com',
                    href: 'https://www.youtube.com' + pathname
                }
            }; }""", pathname)
            page.add_script_tag(content=fixture_script)
            result = page.evaluate("window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot()")
            expected_route = "HOME" if pathname == "/" else "SEARCH"
            assert result["route"] == expected_route and result["candidates"] == expected, result
            assert page.locator("body").inner_html() == before, "탐지기가 기존 HTML을 변경함"
            page.add_script_tag(content=fixture_script)
            assert page.evaluate("window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot().scanCount") == 1
            if pathname == "/":
                page.evaluate("""() => {
                    const renderer = document.createElement('ytd-rich-item-renderer');
                    const anchor = document.createElement('a');
                    anchor.id = 'thumbnail'; anchor.href = '/watch?v=added';
                    renderer.appendChild(anchor); document.body.appendChild(renderer);
                }""")
                again = page.evaluate("window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.scan()")
                assert again["candidates"] == 3 and again["newCandidates"] == 1, again
            print("CHROMIUM_DOM_FIXTURE_PASS", pathname, result)
    finally:
        browser.close()
