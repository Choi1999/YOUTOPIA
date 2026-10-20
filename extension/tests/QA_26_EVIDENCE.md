# YU-26 Interactive Hover Card QA — 2026-10-20

## 사후 최신 상태 (PR #13 병합 이후 · 기존 기록 보존)

- **GitHub 실제 상태:** [PR #13](https://github.com/Choi1999/YOUTOPIA/pull/13) Merged / Closed (2026-10-20 18:38:40 KST), `frontend` merge SHA `d7f271b5afa1fc6b0bf31c000da6aa73611a6dc0`, 최종 기능 SHA `1c5ce3a296a98285460c29a63752163bc0685a29`. 원격 `feature/yutopia-26-hover-card` 삭제됨.
- **최종 SHA의 증거 수준:** 이전 대화에서 사용자 PowerShell 원본 로그를 확인했다는 인계 기록에 따라 Windows **Native Node 160/160 PASS**, **Chromium Fixture 2종 PASS**로 보고됨. 이번 문서 정리 시 테스트를 재실행하지 않았으며 GitHub CI PASS로 대체하지 않음.
- **설치형 Chrome:** 사용자 보고상 A→카드→A와 카드 뒤 B 선택 차단이 최종 기능에서 유지됨. 모든 개별 수동 시나리오·장시간 성능·접근성은 포괄적으로 증명되지 않음.
- **남은 게이트:** 최종 SHA 라이브 YouTube 자동 테스트 실행 로그 미제출; 인증/실데이터/Side Panel 목표 고정 기능은 YU-27~이후 별도 단계. YU-26은 STATIC_FIXTURE 기반 UI에 한정.
- **이력 해석:** 아래 `PR13_OPEN_READY_FOR_REVIEW`, `PENDING` 표와 삭제된 원격 브랜치의 pull 명령은 **병합 전 스냅샷**으로만 유지한다. 현재 작업시에는 `frontend` HEAD에서 독립 브랜치를 생성한다.

---


> PR13_OPEN_READY_FOR_REVIEW / CARD_PINNING_DUPLICATE_GUARD / ISOLATED_V8_160_OF_160_PASS / NATIVE_CHROMIUM_LIVE_RETEST_PENDING / FRONTEND_UNCHANGED

## 최신 승인 요구 — 카드 안으로 이동 시 현재 영상 고정

기존 944b935eea2225e1375b28cd0506aad9790a553c의 Windows Chrome Home/Search/YouTube 자동 영상 미리보기 반복 Hover는 사용자가 모두 PASS로 보고했다. 다만 마우스가 카드 위에 진입하면 카드가 닫히고, 카드 아래 다른 영상 B가 선택되는 문제가 있어 **새 카드 유지 UX가 승인되었다**. 이 절이 아래 944b Strict 계약 이력보다 우선한다.

1. 유효한 영상/채널 썸네일 진입 시 즉시 현재 대상 카드 표시. 일반 열림 지연 0ms.
2. 썸네일 A → A의 카드로 마우스를 움직이면 targetKey/requestId를 유지하면서 카드가 계속 표시된다.
3. 실제 Shadow Card만 포인터 이벤트를 받고, 카드가 가리고 있는 B 영상은 포인터/클릭 입력을 받지 않는다. Host와 빈 Surface는 pointer-events:none 유지.
4. 썸네일과 카드 사이의 **짧은 기하학적 간격**만 최대 160ms 유예. 일반적인 썸네일 이탈/다른 영상 진입은 즉시 종료/전환. 같은 간격 안에서 pointermove를 반복해도 유예 종료 기한은 연장되지 않는다.
5. 카드 → 빈 영역에서는 카드 종료. 카드 → 노출된 B 영상은 즉시 B 표시. 카드 → A 썸네일 재진입은 기존 대상 유지. 같은 영상 반복 Hover와 A→B→C도 기존처럼 정상 동작.
6. SPA에서 같은 논리적 VIDEO/CHANNEL ID의 앵커가 교체되면 현재 카드/요청 상태를 유지하며, 다른 ID이거나 잘못된 ID는 기존대로 안전하게 취소한다.
7. MOCK/DEMO/STATIC FIXTURE 외 실제 YouTube 제목·본문·댓글 수집·표시하지 않음. Shorts/광고/불확실한 ID는 계속 제외.
8. 더보기/닫기 버튼은 현재 disabled이며 Side Panel 연결은 27~28번 범위로 남긴다.

## PR 리뷰 — 재현된 SPA 중복 영상 재결합 결함 수정

- **리뷰 기준 SHA:** `4193f369110af80762f5d31348f2e3425f3f07da` (사용자가 Chrome 수동 Hover·카드 유지 PASS를 확인한 버전).
- **재현 내용:** A 카드를 포인터로 고정한 동안 SPA가 원래 A 썸네일 DOM을 제거할 때, 같은 videoId와 href를 가진 **화면 다른 위치의 별도 A 복사 썸네일**이 잘못 활성화되는 `TARGET_REBOUND` 사례를 실제 컨트롤러 소스로 격리 V8에서 재현했다.
- **수정 내용:** 기존 활성 썸네일의 마지막 유효 화면 사각형을 DOM 제거 전 저장하고, 카드 고정 도중 같은 ID·href 재연결에는 그 위치와 충분히 가까운 새 썸네일만 허용한다. 멀리 떨어진 중복 후보나 측정 불가능한 대상이면 fail-closed 종료한다. 일반 Hover 선택은 이 위치 제한을 받지 않는다.
- **추가 테스트 2건:** 멀리 떨어진 동일 ID 후보 거부, 먼 후보와 가까운 정상 교체가 함께 있을 때 정상 교체만 선택.
- **결과:** 이번 리뷰 수정 후 격리 V8 모의 6개 스위트 **160/160 PASS**. 기존 사용자 Native Node 144/144 및 Chromium PASS는 이전 SHA의 증거이며 **현재 Windows Native Node·Chromium 실행은 미확인**이다.
- **병합과 분리:** PR #13은 Ready for review / 미병합. `frontend/main/dev/backend/Figma` 변경 금지 유지.

## 코드 변경과 검증 범위

- hover-controller.js: setCardRegion(host,card), 카드 이벤트 우선 판정, cardPointerInside, card transit 160ms 타이머, 일반 열림·종료 지연은 0ms, SPA 및 오래된 이벤트 처리.
- hover-card.js: Host/Surface는 포인터 투명, Shadow .card만 pointer-events:auto. 생성/제거 시 컨트롤러 카드 영역 등록/해제.
- hover-controller.test.cjs: 기존 Interactive Card 추가 11건 + 코드 리뷰 추가 2건. A↔카드↔A 20회, B 선택 차단, 직접 노출 영상 전환, 안전 이동 간격, SPA 교체·이전 이벤트 경합과 **동일 영상 ID의 먼 중복 썸네일 재결합 차단**.
- hover-card-ui.test.cjs: 추가 3건. 카드 영역 등록·교체·해제 및 pointer-events 값.
- chromium-hover-card-fixture.py: 실제 Chromium에서 단계별 A→카드→A, B 가림/노출, Card→노출 C, 반복 영상 전환 검증하도록 수정.
- chromium-live-youtube-hover.py: 새로운 strategy 확인값을 반영. 실제 라이브 테스트 최신 재실행은 아직 없음.

| 검증 | 결과 |
|---|---|
| 이번 코드 리뷰 후 JS 구문·격리 V8 모의 Node/DOM/URL | **160/160 PASS** |
| 944b Native Windows Node (이전 코드) | **144/144 PASS — 사용자 PowerShell 로그** |
| 944b 오프라인 Chromium 2개 (이전 코드) | **둘 다 PASS — 사용자 PowerShell 로그** |
| 944b 실 YouTube 검색 DOM (이전 코드) | **PASS; Home 익명 추천 없음으로 SKIP** |
| 코드 리뷰 후 Native Windows Node 160건 | **PENDING — 최신 SHA 원본 실행 로그 미확인** |
| 최신 Interactive Card Chromium 오프라인·실 YouTube | **PENDING** |
| 코드 리뷰 전 4193f의 Chrome MV3 A→Card→A / 배경 B 차단 | **사용자 보고 PASS** |
| 중복 썸네일 재결합 방지 코드 리뷰 수정 후 Chrome MV3 | **PENDING — 새로운 SHA 확인 필요** |

### Windows 재검증

~~~powershell
Set-Location "$env:USERPROFILE\YUTOPIA-Chrome-QA-26"
git pull --ff-only origin feature/yutopia-26-hover-card
git rev-parse HEAD
git status --short
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs extension/tests/hover-controller.test.cjs extension/tests/hover-card-ui.test.cjs

$py = Join-Path $env:USERPROFILE "YUTOPIA-QA26-venv\Scripts\python.exe"
& $py extension/tests/chromium-hover-fixture.py
& $py extension/tests/chromium-hover-card-fixture.py

$env:RUN_LIVE_YOUTUBE = "1"
& $py extension/tests/chromium-live-youtube-hover.py
Remove-Item Env:\RUN_LIVE_YOUTUBE -ErrorAction SilentlyContinue
~~~

필수 게이트: Native Node 160 PASS/0 FAIL 및 Chromium Fixture 두 개 PASS, 사용자 Chrome 로그인 Home/Search A→카드→A 20회, 카드 아래 B 선택 차단, 카드→노출된 C 정상 전환, 다른 썸네일 직접 이동, 빈 공간 이탈 시 카드 종료와 재진입 반복 20회. 한 번이라도 누락·깜빡임·잘못된 대상 발생 시 FAIL. 이전 944b PASS를 현재 변경의 PASS로 소급하지 않는다.

**PR #13은 OPEN / Ready for review / 미병합 상태 유지. frontend/main/dev/backend/Figma 변경 금지.**

---


## 이전 검증 범위 (944b935e — 이력)

- PR: `#13 feature/yutopia-26-hover-card` → `frontend`, Draft·미병합 유지.
- 변경 금지: `frontend/main/dev/backend/Figma` 브랜치와 실제 서비스 데이터 계약.
- 데이터: 카드 값은 `MOCK/DEMO/STATIC FIXTURE`만 사용한다. 실제 YouTube 본문·제목·URL·댓글·통계 값을 수집·출력·분석하지 않는다.
- 권한: 기존 `sidePanel`, `storage`, `https://www.youtube.com/*` 외 추가 없음.

## 944b 당시 Strict UX 계약 (현재 개정됨)

1. 확인된 썸네일에 포인터가 들어오면 즉시 카드 표시.
2. 썸네일 밖으로 나가면 즉시 카드 제거.
3. 같은 A 재진입과 A→B→C 이동은 매번 현재 대상만 표시.
4. open timer 0ms, leave grace 0ms, `suppressedAnchor` 없음.
5. 카드로 이동하는 순간 썸네일 밖이므로 카드가 닫힌다. 카드/Host는 `pointer-events:none`, 더보기/닫기는 현재 disabled다.
6. 카드 배치 결과는 Hover Controller 상태를 닫지 않는다.

## 944b 구현 결정 (이력)

- `document` capture `pointerover/move/out`과 `focusin/out`만 사용한다. anchor별 이벤트 리스너는 0개다.
- 별도 Pointer Tracker/Presence Reducer와 overlay 점유 API를 Manifest에서 제거했다.
- 단일 `active binding`이 `targetKey`, `requestId`, anchor, POINTER/FOCUS mode를 소유한다.
- stable target key는 식별된 대상에 한해 `VIDEO:<id>` 또는 `CHANNEL:<id>`다.
- 같은 stable key의 hovered SPA 교체 anchor는 requestId를 유지한다. 다른 ID·hover 밖 교체는 이전 상태를 유지하지 않는다.
- event path가 우선이며, YouTube portal `#video-preview`가 renderer 밖에서 원본 링크를 덮는 경우에는 Discovery가 이미 승인한 anchor 사각형만 좌표 hit-test한다. overlay 내용이나 URL로 ID를 추측하지 않는다.
- View는 `lastHoverReason`과 `lastRenderReason`을 따로 보존한다. `ANCHOR_NOT_VISIBLE`/`ANCHOR_DETACHED`는 renderer 이유이며 Controller를 `DISMISSED`로 만들지 않는다.

## 944b 자동 검증 (이력)

### Node

```powershell
Set-Location "$env:USERPROFILE\YUTOPIA-Chrome-QA-26"
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs extension/tests/hover-controller.test.cjs extension/tests/hover-card-ui.test.cjs
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

## 944b 수동 Windows Chrome 재검증 (이력)

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

## 944b 당시 남은 위험 (이력)

- 익명 자동화 세션의 YouTube Home feed가 비어 있어 실제 Home renderer 반복은 자동 검증하지 못했다.
- Playwright는 페이지 컨텍스트에 동일 모듈을 주입한 검증이며, Chrome MV3 isolated world·확장 새로고침·실사용 프로필을 포함한 완전한 설치 E2E는 아니다.
- YouTube는 DOM renderer와 portal preview 구조를 바꿀 수 있다. Discovery가 새 구조를 후보로 식별하지 못하면 Controller는 안전하게 카드를 표시하지 않는다.
- click-through 카드가 시각적으로 다른 썸네일을 덮을 수는 있지만 포인터/클릭 입력은 차단하지 않는다. 카드 내부 클릭 기능은 별도 진입 UX 전까지 제공하지 않는다.
