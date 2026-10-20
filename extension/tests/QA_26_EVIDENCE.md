# YU-26 Strict Thumbnail Hover 검증 기록

## 현재 범위

- PR: `#13 feature/yutopia-26-hover-card` → `frontend`, Draft·미병합 유지.
- 변경 금지: `frontend/main/dev/backend/Figma` 브랜치와 실제 서비스 데이터 계약.
- 데이터: 카드 값은 `MOCK/DEMO/STATIC FIXTURE`만 사용한다. 실제 YouTube 본문·제목·URL·댓글·통계 값을 수집·출력·분석하지 않는다.
- 권한: 기존 `sidePanel`, `storage`, `https://www.youtube.com/*` 외 추가 없음.

## 확정 UX 계약

1. 확인된 썸네일에 포인터가 들어오면 즉시 카드 표시.
2. 썸네일 밖으로 나가면 즉시 카드 제거.
3. 같은 A 재진입과 A→B→C 이동은 매번 현재 대상만 표시.
4. open timer 0ms, leave grace 0ms, `suppressedAnchor` 없음.
5. 카드로 이동하는 순간 썸네일 밖이므로 카드가 닫힌다. 카드/Host는 `pointer-events:none`, 더보기/닫기는 현재 disabled다.
6. 카드 배치 결과는 Hover Controller 상태를 닫지 않는다.

## 구현 결정

- `document` capture `pointerover/move/out`과 `focusin/out`만 사용한다. anchor별 이벤트 리스너는 0개다.
- 별도 Pointer Tracker/Presence Reducer와 overlay 점유 API를 Manifest에서 제거했다.
- 단일 `active binding`이 `targetKey`, `requestId`, anchor, POINTER/FOCUS mode를 소유한다.
- stable target key는 식별된 대상에 한해 `VIDEO:<id>` 또는 `CHANNEL:<id>`다.
- 같은 stable key의 hovered SPA 교체 anchor는 requestId를 유지한다. 다른 ID·hover 밖 교체는 이전 상태를 유지하지 않는다.
- event path가 우선이며, YouTube portal `#video-preview`가 renderer 밖에서 원본 링크를 덮는 경우에는 Discovery가 이미 승인한 anchor 사각형만 좌표 hit-test한다. overlay 내용이나 URL로 ID를 추측하지 않는다.
- View는 `lastHoverReason`과 `lastRenderReason`을 따로 보존한다. `ANCHOR_NOT_VISIBLE`/`ANCHOR_DETACHED`는 renderer 이유이며 Controller를 `DISMISSED`로 만들지 않는다.

## 자동 검증

### Node

```powershell
Set-Location "$env:USERPROFILE\YUTOPIA-Chrome-QA-26"
node --test extension/tests/*.test.cjs
```

- 결과: **144/144 PASS**.
- 핵심 반복: 같은 A 30회, A→B→C 20회, 늦은 과거 pointerout, pointermove 복구, portal preview 좌표 복구, 같은 ID SPA anchor 교체, 다른 ID 교체, 리스너/dispose 정리.

### 오프라인 Chromium 실제 DOM/Shadow DOM

```powershell
$env:PYTHONPATH = "<playwright-python-package-directory>"
$env:CHROMIUM_BIN = "C:\Program Files\Google\Chrome\Application\chrome.exe"
python extension/tests/chromium-hover-fixture.py
python extension/tests/chromium-hover-card-fixture.py
```

- 결과: 두 fixture **PASS**.
- 카드 fixture: 같은 A 완전 이탈·재진입 20회, A→B→C→A 20회, SPA anchor 교체, Shadow DOM 단일 Host, click-through, @handle UNRESOLVED, Escape/dispose.

### 실 YouTube DOM Playwright

```powershell
$env:RUN_LIVE_YOUTUBE = "1"
$env:PYTHONPATH = "<playwright-python-package-directory>"
$env:CHROMIUM_BIN = "C:\Program Files\Google\Chrome\Application\chrome.exe"
python extension/tests/chromium-live-youtube-hover.py
```

- Search 실제 DOM: `LIVE_YOUTUBE_BOUNDARY_PASS SEARCH visibleTargets>=3 sameA=10 ABC=10`.
- 첫 실행에서 실제 YouTube portal `video-preview`가 원본 썸네일을 덮어 일반 Playwright `locator.hover()`를 차단하는 현상을 재현했다. 이후 실제 마우스 좌표 이동 + 발견된 anchor 사각형 복구로 통과했다.
- 익명·새 컨텍스트 Home: 영상 feed 자체가 제공되지 않아 `LIVE_YOUTUBE_BOUNDARY_SKIP HOME anonymous-feed-unavailable`. 사용자 프로필·시청 기록을 재사용하거나 로그인하지 않았다.
- 테스트는 DOM 요소 경계, Host 표시 여부, numeric request sequence만 확인했다. 본문 텍스트·제목·href·targetId·댓글 값은 읽거나 출력하지 않았다.

## 수동 Windows Chrome 재검증

1. `chrome://extensions`에서 압축해제된 `extension/`을 새로고침한다.
2. YouTube 탭도 새로고침한다.
3. 홈에서 같은 A를 완전히 벗어나고 재진입 20회. 매번 즉시 표시/제거되는지 확인한다.
4. A→B→C→A를 20회. 카드 target과 현재 썸네일이 어긋나지 않는지 확인한다.
5. 검색 결과에서도 3~4를 반복한다.
6. YouTube 자체 animated preview가 시작된 뒤에도 같은 A 재진입과 A→B가 유지되는지 확인한다.
7. 카드 방향으로 이동하면 썸네일 경계 이탈 즉시 카드가 제거되는지 확인한다. 더보기/닫기는 비활성이다.
8. 광고·Shorts·불확실한 ID에서 카드가 표시되지 않는지 확인한다.
9. DevTools의 YUTOPIA Content Script 컨텍스트에서 아래 값만 확인한다.

```js
globalThis.YUTOPIA_HOVER_CONTROLLER?.getRuntimeStatus()
globalThis.YUTOPIA_HOVER_CARD?.getRuntimeStatus()
```

정상 기준: `strategy:"DELEGATED_STRICT_THUMBNAIL"`, `perAnchorListeners:0`, `activationDelayMs:0`, `leaveGraceMs:0`, `enterScheduled:false`, `leaveScheduled:false`.

## 남은 위험

- 익명 자동화 세션의 YouTube Home feed가 비어 있어 실제 Home renderer 반복은 자동 검증하지 못했다.
- Playwright는 페이지 컨텍스트에 동일 모듈을 주입한 검증이며, Chrome MV3 isolated world·확장 새로고침·실사용 프로필을 포함한 완전한 설치 E2E는 아니다.
- YouTube는 DOM renderer와 portal preview 구조를 바꿀 수 있다. Discovery가 새 구조를 후보로 식별하지 못하면 Controller는 안전하게 카드를 표시하지 않는다.
- click-through 카드가 시각적으로 다른 썸네일을 덮을 수는 있지만 포인터/클릭 입력은 차단하지 않는다. 카드 내부 클릭 기능은 별도 진입 UX 전까지 제공하지 않는다.
