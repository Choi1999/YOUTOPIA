"""Live YouTube DOM boundary check for YU-26 (opt-in, no content analysis).

Run only with explicit network opt-in:
  RUN_LIVE_YOUTUBE=1 python extension/tests/chromium-live-youtube-hover.py

The check reads no title/body/comment text and prints no href, URL-derived ID,
or account data. It only counts eligible visible thumbnail elements and checks
the synthetic card host plus numeric request sequence on Home and Search DOM.
"""
import os
from pathlib import Path
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright

if os.environ.get("RUN_LIVE_YOUTUBE") != "1":
    raise SystemExit("SKIP: set RUN_LIVE_YOUTUBE=1 for the live DOM check")

extension = Path(__file__).resolve().parents[1]
modules = [
    "target-resolver.js", "channel-target-resolver.js", "content.js",
    "hover-controller.js", "hover-card-model.js", "hover-card.js",
]
scripts = []
for name in modules:
    source = (extension / name).read_text(encoding="utf-8")
    marker = "})(globalThis);"
    assert source.count(marker) == 1, f"Unexpected module wrapper: {name}"
    scripts.append(source.replace(marker, "})(window.__yutopiaLiveScope);"))


def inject(page):
    page.evaluate("""() => {
        window.__yutopiaLiveScope = {
            document,
            location,
            get innerWidth() { return window.innerWidth; },
            get innerHeight() { return window.innerHeight; },
            MutationObserver,
            setTimeout: window.setTimeout.bind(window),
            clearTimeout: window.clearTimeout.bind(window),
            requestAnimationFrame: window.requestAnimationFrame.bind(window),
            cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
            addEventListener: window.addEventListener.bind(window),
            removeEventListener: window.removeEventListener.bind(window),
        };
    }""")
    for source in scripts:
        # DevTools protocol evaluation avoids the site's Trusted Types policy;
        # no script element or page-owned DOM node is created for injection.
        page.evaluate(source)


def visible_thumbnails(page, minimum=3, timeout=30000):
    selector = (
        "ytd-rich-item-renderer a#thumbnail[href*='/watch?'], "
        "ytd-video-renderer a#thumbnail[href*='/watch?'], "
        "yt-lockup-view-model a.yt-lockup-view-model__content-image[href*='/watch?']"
    )
    page.wait_for_selector(selector, timeout=timeout)
    candidates = page.locator(selector)
    visible = []
    for index in range(min(candidates.count(), 40)):
        item = candidates.nth(index)
        if item.is_visible():
            visible.append(item)
        if len(visible) >= minimum:
            break
    assert len(visible) >= minimum, f"Expected {minimum} visible thumbnail boundaries"
    return visible


def card_visible(page):
    return page.locator("#yutopia-extension-hover-card").count() == 1 and page.locator(
        "#yutopia-extension-hover-card"
    ).is_visible()


def move_pointer(page, target):
    target.scroll_into_view_if_needed(timeout=10000)
    box = target.bounding_box()
    assert box and box["width"] > 0 and box["height"] > 0
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)


def exercise(page, label, thumbnail_timeout=30000):
    inject(page)
    controller = "window.__yutopiaLiveScope.YUTOPIA_HOVER_CONTROLLER"
    candidates = visible_thumbnails(page, minimum=6, timeout=thumbnail_timeout)
    page.wait_for_function(f"Boolean({controller}?.getRuntimeStatus().boundVideoAnchors >= 3)")

    # Keep only elements that Discovery actually approved. This compares DOM
    # object identity and never reads or prints an href/derived target ID.
    targets = []
    for candidate in candidates:
        handle = candidate.element_handle()
        move_pointer(page, handle)
        try:
            page.wait_for_function(
                "element => window.__yutopiaLiveScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot().anchor === element",
                arg=handle,
                timeout=2000,
            )
        except Exception:
            continue
        targets.append(handle)
        if len(targets) == 3:
            break
    assert len(targets) == 3, "Expected three distinct Discovery-approved thumbnail boundaries"
    page.mouse.move(1, 1)
    page.wait_for_function("!document.querySelector('#yutopia-extension-hover-card')")

    # Same A: full exit and reentry 10 times.
    previous = page.evaluate(f"{controller}.getSnapshot().requestId")
    for _ in range(10):
        move_pointer(page, targets[0])
        page.wait_for_function(
            "element => window.__yutopiaLiveScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot().anchor === element",
            arg=targets[0],
        )
        page.wait_for_function(
            "document.querySelector('#yutopia-extension-hover-card')?.style.visibility === 'visible'"
        )
        current = page.evaluate(f"{controller}.getSnapshot().requestId")
        assert current > previous
        previous = current
        page.mouse.move(1, 1)
        page.wait_for_function("!document.querySelector('#yutopia-extension-hover-card')")

    # A -> B -> C -> A across loop boundaries 10 times. Only numeric sequence
    # and one visible host are read.
    for _ in range(10):
        for target in (targets[0], targets[1], targets[2]):
            move_pointer(page, target)
            page.wait_for_function(
                "element => window.__yutopiaLiveScope.YUTOPIA_HOVER_CONTROLLER.getSnapshot().anchor === element",
                arg=target,
            )
            page.wait_for_function(
                "document.querySelector('#yutopia-extension-hover-card')?.style.visibility === 'visible'"
            )
            current = page.evaluate(f"{controller}.getSnapshot().requestId")
            assert current > previous
            previous = current
            assert card_visible(page)

    status = page.evaluate(f"{controller}.getRuntimeStatus()")
    assert status["strategy"] == "DELEGATED_INTERACTIVE_CARD"
    assert status["cardTransitGraceMs"] == 160
    assert status["perAnchorListeners"] == 0
    assert not status["enterScheduled"] and not status["leaveScheduled"]
    page.evaluate("""() => {
        const scope = window.__yutopiaLiveScope;
        scope.YUTOPIA_HOVER_CARD?.dispose();
        scope.YUTOPIA_HOVER_CONTROLLER?.dispose();
        scope.YUTOPIA_VIDEO_DISCOVERY?.dispose();
    }""")
    print("LIVE_YOUTUBE_BOUNDARY_PASS", label, "visibleTargets>=3", "sameA=10", "ABC=10")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get("CHROMIUM_BIN") or None,
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--lang=en-US"],
    )
    try:
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        # Opt out of the consent interstitial in this isolated test profile.
        # No user profile, account cookie, history, or persisted storage is used.
        context.add_cookies([{
            "name": "SOCS", "value": "CAI", "domain": ".youtube.com", "path": "/"
        }])
        page = context.new_page()
        page.goto(
            "https://www.youtube.com/results?search_query=playwright%20hover%20fixture",
            wait_until="domcontentloaded",
            timeout=45000,
        )
        exercise(page, "SEARCH")
        page.goto("https://www.youtube.com/", wait_until="domcontentloaded", timeout=45000)
        try:
            exercise(page, "HOME", thumbnail_timeout=10000)
        except PlaywrightTimeoutError:
            # Signed-out/incognito YouTube can intentionally return an empty
            # Home feed. Do not sign into or reuse a user's personal profile.
            print("LIVE_YOUTUBE_BOUNDARY_SKIP", "HOME", "anonymous-feed-unavailable")
    finally:
        browser.close()
