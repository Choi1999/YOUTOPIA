"""YUTOPIA 작업 22 — 오프라인 Chromium SPA/MutationObserver Fixture.

명령 (설치된 Playwright 사용):
  python extension/tests/chromium-spa-fixture.py

실제 youtube.com/Chrome 확장 설치 검증이 아니라 Chromium DOM 엔진에서
동적 DOM 갱신, 페이지 전환 이벤트, 후보 해제를 검증하는 별도 시험이다.
이 파일은 제출 시점에 실브라우저 실행 결과가 확인되지 않았다.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

source = (Path(__file__).resolve().parents[1] / "content.js").read_text(encoding="utf-8")
marker = "})(globalThis);"
if source.count(marker) != 1:
    raise RuntimeError("Content Script 진입 구조가 변경됨")
fixture_script = source.replace(marker, "})(window.__fixtureScope);")

markup = """<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>
<ytd-rich-item-renderer id="initial"><a id="thumbnail" href="/watch?v=initial">Fixture A</a></ytd-rich-item-renderer>
<ytd-ad-slot-renderer><ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=ad">Excluded Ad</a></ytd-rich-item-renderer></ytd-ad-slot-renderer>
</body></html>"""

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_BIN") or None,
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    try:
        page = browser.new_page()
        page.set_content(markup)
        before = page.locator("body").inner_html()

        # 원래 Content Script의 window/global 환경을 모방한 Fixture 전용 scope.
        page.evaluate("""() => {
            window.__fixtureScope = {
                document: window.document,
                location: {pathname: '/', href: 'https://www.youtube.com/', origin: 'https://www.youtube.com'},
                MutationObserver: window.MutationObserver,
                setTimeout: window.setTimeout.bind(window),
                clearTimeout: window.clearTimeout.bind(window),
                addEventListener: window.addEventListener.bind(window),
                removeEventListener: window.removeEventListener.bind(window)
            };
            window.__delta = [];
        }""")
        page.add_script_tag(content=fixture_script)
        assert page.locator("body").inner_html() == before, "탐지기가 사이트 DOM을 수정"
        first = page.evaluate("window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot()")
        assert first["route"] == "HOME" and first["candidates"] == 1, first
        page.evaluate("""() => window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.subscribe(
            change => window.__delta.push({
                added: change.added.length, removed: change.removed.length,
                updated: change.updated.length
            })
        )""")

        # 무한 스크롤을 흉내 내는 신규 카드 삽입.
        page.evaluate("""() => {
            const card = document.createElement('ytd-rich-item-renderer');
            card.id = 'dynamic';
            const anchor = document.createElement('a');
            anchor.id = 'thumbnail';
            anchor.href = '/watch?v=dynamic';
            card.appendChild(anchor);
            document.body.appendChild(card);
        }""")
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot().candidates === 2",
            timeout=5000,
        )

        # 같은 anchor의 href 변경은 신규 카드가 아닌 updated 이벤트.
        page.evaluate("""() => {
            document.querySelector('#dynamic a').setAttribute('href','/watch?v=replaced');
        }""")
        page.wait_for_function(
            "window.__delta.some(item => item.updated === 1)",
            timeout=5000,
        )

        # SPA /watch 전환 시 기존 후보를 비우고 해당 참조를 해제.
        page.evaluate("""() => {
            window.__fixtureScope.location.pathname = '/watch';
            document.dispatchEvent(new Event('yt-navigate-finish'));
        }""")
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot().route === 'UNSUPPORTED'",
            timeout=5000,
        )
        gone = page.evaluate("window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getRuntimeStatus()")
        assert gone["trackedCandidates"] == 0, gone

        # 다시 /results로 이동하면 기존 카드가 후보에 재진입한다.
        page.evaluate("""() => {
            window.__fixtureScope.location.pathname = '/results';
            window.dispatchEvent(new Event('popstate'));
        }""")
        page.wait_for_function(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot().route === 'SEARCH'",
            timeout=5000,
        )
        final = page.evaluate("window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot()")
        assert final["candidates"] == 2, final

        # 중복 주입에도 탐지기 인스턴스를 새로 만들지 않는다.
        before_reinject = page.evaluate(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot().scanCount"
        )
        page.add_script_tag(content=fixture_script)
        after_reinject = page.evaluate(
            "window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY.getSnapshot().scanCount"
        )
        assert before_reinject == after_reinject

        status = page.evaluate("""() => {
            const api = window.__fixtureScope.YUTOPIA_VIDEO_DISCOVERY;
            api.dispose();
            return api.getRuntimeStatus();
        }""")
        assert status["disposed"] and not status["observing"]
        assert status["trackedCandidates"] == 0
        print("CHROMIUM_SPA_FIXTURE_PASS", first, final, status)
    finally:
        browser.close()
