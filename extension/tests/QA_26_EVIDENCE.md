# YUTOPIA 26번 — 실제 Hover 카드 UI(합성 데이터) 검증 기록

> **2026-10-20 / CARD_UI_CODE_READY / V8_MOCK_159_OF_159_PASS / NATIVE_WINDOWS_NODE_152_PASS_PRIOR_HEAD / CHROMIUM_PREVIOUS_PASS / LIVE_CHROME_INTERMITTENT_HOVER_UNDER_FIX**

이 기록은 Chrome MV3 확장 개발자용 **MOCK Hover 카드 UI**를 설명한다. 실제 YouTube 데이터 분석, 운영 배포, 사용자 승인 UI 시안 완성 또는 Side Panel 대상 연동에 대한 증거가 아니다.

## 1. 기준과 구현 범위

- **기준:** 25번 PR #12이 frontend에 병합된 커밋 20edd746e25dc82296a220716bf57c8c66cc5b3.
- **신규 파일:** extension/hover-card-model.js (고정 합성 분포 모델), extension/hover-card.js (Shadow DOM UI), extension/tests/hover-card-ui.test.cjs (DOM/상태 검증), 선택적인 extension/tests/chromium-hover-card-fixture.py.
- **Manifest:** shared.js → target-resolver.js → channel-target-resolver.js → content.js → hover-controller.js → hover-card-model.js → hover-card.js. 기존 sidePanel/storage 권한 및 www.youtube.com 호스트 범위를 확대하지 않는다.
- **진입:** 작업 25 Controller의 READY/UNRESOLVED 상태가 왔을 때만 동적 Shadow DOM 카드를 하나 만들고, IDLE/DISMISSED/HOVER_PENDING/앵커 분리 시 제거한다.
- **상태 구분:** READY는 안정적인 VIDEO ID 또는 UC 형식 CHANNEL ID가 있을 때만 표시. CHANNEL @handle만 확인된 경우 UNRESOLVED 카드에 식별 필요 문구만 제공하며 가짜 감성 비율과 상세 CTA를 만들지 않는다.
- **카드 구성:** YUTOPIA / DEMO 배지, 대상 영상·채널의 **정규 ID** (실제 제목 수집하지 않음), 합성 긍정·중립·부정 막대/범례, 2개 가상 논점, 1문장 합성 브리핑, 가상 댓글 표본·가상 분석 범위·'실제 갱신 시각 없음' 및 반복적인 STATIC FIXTURE 고지.
- **데이터 경계:** targetId를 결정적 시드로 3개의 고정 MOCK 데이터 예시 중 하나를 사용한다. 실제 YouTube 댓글·제목/메타데이터·사용자/시청기록·LLM/API 결과를 읽거나 전송하지 않는다. 숫자는 실제 채널/영상과 관계없다.
- **위치:** 활성 링크의 getBoundingClientRect를 이용해 우측 12px 우선 배치하고, 공간 부족 시 좌측 또는 가시 영역으로 제한한다(초기 최대 폭 344px). 인접 영상 썸네일 링크를 크게 가리는 경우에는 아래쪽 가용 공간을 검토한다. 좁은 브라우저/스크롤/리사이즈, 화면 밖 앵커는 안전하게 처리한다.
- **독립성:** 한 번에 하나의 YUTOPIA 카드 Host만 유지하며 Shadow DOM 내부에만 CSS를 삽입한다. YouTube 기존 DOM 내용/링크/이벤트 핸들러를 덮어쓰지 않는다.
- **상호작용:** 카드 안 pointerenter/leave와 focusin/out을 25번 Overlay 유지 API로 연결, Escape/닫기/SPA 경합은 Controller와 동기화. 닫기는 즉시 종료.
- **더보기:** 클릭하면 '27~28번에서 상세 Side Panel 연결'이라는 메시지만 표시한다. 27번 메시지·28번 사용자 클릭 Side Panel 대상 고정은 아직 구현되지 않았다. 임의로 Side Panel을 열어 대상이 연결됐다고 오인시키지 않는다.
- **Figma:** 기존 Figma 설계 파일과 React 12화면은 변경하지 않았다. 10~19 문서의 정보 구성/배치 제안을 기반으로 한 개발 카드이며 정확한 픽셀/디자인 정합성은 Windows Chrome에서 후속 시각 검수가 필요하다.

## 2. 수행된 테스트

| 범위 | 개수 | 결과 / 한계 |
|---|---:|---|
| 21 영상 DOM 탐지 | 9 | PASS, 격리 V8 Mock URL/DOM |
| 22 SPA 변경 관측 | 16 | PASS, 격리 V8 |
| 23 VIDEO ID 검증 | 21 | PASS, 격리 V8 |
| 24 CHANNEL ID/@handle | 32 | PASS, 격리 V8 |
| 25 Hover 상태 제어 + 복구·진단 회귀 | 46 | PASS, 격리 V8 (Manifest 및 SPA 포인터 복구 포함) |
| 26 Hover 카드 모델/DOM/CTA·썸네일 클릭 가림·진단 | 35 | PASS, 격리 V8 Mock DOM |
| **전체** | **159** | **159/159 PASS — 격리 V8 모의 실행 (최신 브랜치)** |
| JavaScript 구문 | 신규 모델/렌더러/테스트 | PASS, 격리 V8 파서 |
| Native Node.js CLI | 이전 HEAD에서 node --test 6개 파일 | **152/152 PASS × 1 (사용자 Windows 로그). 최신 159개 변경 테스트 재실행 대기** |
| Chromium 오프라인 DOM | chromium-hover-card-fixture.py | **이전 HEAD에서 CHROMIUM_HOVER_CARD_FIXTURE_PASS (사용자 Windows 로그); 최신 SPA 복구 Fixture는 재실행 대기** |
| Windows Chrome | 실제 YouTube 홈/검색 카드 위치/조작, 다크/라이트/줌 | **NOT VERIFIED** |
| CI·독립 리뷰 | GitHub 상태 검사·PR 리뷰 | **NOT VERIFIED** |

**격리 V8 수행 방법:** GitHub PR 최신 브랜치 파일을 이용한 모의 어댑터 테스트 **159/159 PASS**. **별도로** Windows PowerShell 원본 로그에서 수정 이전 Native Node CLI 150/150 PASS ×2 및 이후 Node CLI 152/152 PASS ×1을 확인했다(해당 시점 검사 HEAD `84c9e5949c94fa4db6ac842f05f652b7f57d1e87`). Chromium Fixture 검증 성공이나 실제 YouTube Chrome 시각 검증 완료로는 취급하지 않는다.

## 2.1 Windows 실행 로그·Chromium 실패 분석 (2026-10-20)

- 사용자 로그의 HEAD: `84c9e5949c94fa4db6ac842f05f652b7f57d1e87`, `git status --short` 출력 없음. Node --test 6개 파일 **150/150 PASS를 두 번** 기록했고, hover-card-model.js / hover-card.js 구문 검사도 오류 없이 종료.
- Python 가상환경에 playwright 1.64.0 및 Chromium 다운로드 후 `chromium-hover-card-fixture.py`를 실행했으나 이전 버전의 **93행** `assert "Ab0_-123xyz" in card.inner_text()`에서 `AssertionError`가 발생.
- 원인: `<div id="yutopia-extension-hover-card">`는 **open Shadow Root 호스트**이고, 브라우저에서 호스트의 innerText에는 Shadow DOM 안의 텍스트가 포함되지 않는다. 독립 Chromium 최소 사례에서 Host.innerText는 빈 문자열, Host 안 `.card`의 innerText는 기대 문자열로 확인했다. **실제 카드 콘텐츠가 비어 있었다는 증거가 아니다.**
- 대응: `card_content = card.locator(".card")`로 Shadow DOM 내부를 직접 선택하고, 검증 전에 Shadow Root와 `.card` 존재 여부를 별도로 검사하도록 **테스트 Fixture만 수정**. Content Script UI·모델·권한·Node 테스트는 변경하지 않았다.
- 결과: **원인 분석·Fixture 소스 수정 완료 / 사용자 Windows Chromium 재실행 전**. 수정 이후의 Chromium PASS를 주장하지 않는다. 수정본을 `git pull --ff-only`로 받은 후 재검증 필요.
## 2.2 Chromium 두 번째 실패 및 수정 (2026-10-20)

- 사용자는 Shadow Root 검사 수정 HEAD `6e8c876d88e87a731226fe41e2d0eb88e65d8873`를 `git pull --ff-only`로 받아 Clean Worktree로 재실행했다.
- 이전 `card.inner_text()` Assertion은 통과했고, VIDEO A 카드·합성 데이터·더보기 안내 이후 **111행에서 VIDEO B 썸네일로 이동하려 할 때** Playwright `Locator.hover: Timeout 30000ms exceeded`가 발생했다. 로그에 `<div id="yutopia-extension-hover-card"> intercepts pointer events`가 반복됐다.
- **실제 UI 결함:** 카드가 옆 영상 썸네일을 덮어 B의 Hover/클릭 진입을 방해할 수 있다. 단순한 테스트 선택 오류가 아니므로 `force=True` 같은 우회는 금지한다.
- **원인:** 기존 배치 로직은 우측 카드가 다른 썸네일을 가려도 아래쪽 남는 높이가 카드 전체 자연 높이보다 짧으면 이동을 포기했다. 긴 카드 및 더보기 확장 상태에서 옆 썸네일을 가릴 수 있었다.
- **수정:** 카드 자체의 `maxHeight`를 남은 화면 높이로 제한해 내부 스크롤을 허용하고, 우측/좌측/하단/상단 후보 중 다른 썸네일의 **중앙 포인터 영역을 피하는 위치**를 선택한다. 안전한 후보가 없으면 카드 표시를 취소한다. Host의 빈 영역은 `pointer-events:none`, 실제 Card 내부만 `pointer-events:auto`로 유지한다. 더보기 안내로 높이가 변할 때도 위치 재검사.
- **회귀 보강:** 가상의 긴 카드가 A 옆 B 중앙을 덮는 상황과 모든 위치가 막힌 경우를 Node Fake DOM 테스트에 추가했다. Chromium Fixture는 A→B 이동 전에 `document.elementFromPoint()`로 B 중앙 가림 여부를 확인하며, 강제 Hover 없이 최대 5초 내에 실제 Hover를 시도하도록 보강했다.
- **결과 상태:** 최신 개발 브랜치 기준 기존 회귀 118 + 26번 34 = **격리 V8 모의 152/152 PASS**, **Native Windows Node 152건 및 Chromium 수정본 전체 통과는 아직 미검증**. 실제 YouTube Chrome 실사이트 검증도 대기 중.
## 2.3 실제 YouTube Chrome에서 발견된 간헐적 카드 미표시·지연 (2026-10-20)

- 사용자는 실제 YouTube 홈에서 일부 카드가 뜨지만 **Hover 즉시 나타나지 않고, 어떤 경우에는 표시되지 않는다**고 보고했다. `YUTOPIA_HOVER_CARD.getRuntimeStatus()`의 조회 순간 값은 `connected:true`, `visible:false`, `phase:IDLE`, `hostCount:0`이었다.
- **확인된 설계 지연:** 25번에서 기본 400ms 진입 타이머를 사용했다. 사용자 UX 피드백을 반영해 26번 브랜치에서는 **160ms 시험값으로 단축**했다. 100ms 이내 스쳐 지나가는 Hover는 여전히 무작위 카드가 나타나지 않도록 차단한다.
- **코드상 가능한 간헐적 누락:** 실제 YouTube의 SPA/지연 렌더링이 포인터 아래의 앵커를 교체하면 새 앵커의 `pointerenter` 이벤트를 받지 못할 수 있다. 신규 앵커 바인딩 시 CSS `:hover`를 재확인하고, document의 포인터 이동 이벤트에서 이미 바인딩된 링크를 찾아 이벤트를 복구하도록 변경했다. 버튼 닫기/Escape 후 동일 썸네일에서 즉시 재열림 방지.
- **의도적 미표시:** 광고·Shorts·WATCH 경로·불확실한 링크/ID는 기존 정책상 표시 대상이 아니다. 또한 26번 배치 알고리즘이 모든 후보가 다른 영상의 포인터 중앙을 가리면 `NO_SAFE_HOVER_PLACEMENT`로 표시를 취소할 수 있다. 이 구분을 위해 Controller/카드 상태에 `lastReason`, `lastHoverReason`, `hoveredBoundAnchors`, `pointerRecoveries`, `activationDelayMs`를 노출했다.
- **테스트 추가:** 25번 신규 회귀 6건(160ms 경계, `pointermove`, composedPath, SPA 재바인딩, ESC 재열림 차단, 이유 기록) + 26번 진단 회귀 1건. 총 **격리 V8 159/159 PASS**. Chromium Fixture에는 포인터 아래 B 영상 링크를 교체해도 카드가 재활성화되는지를 검사하는 별도 수용 시나리오 추가.
- **검증 한계:** 현재 최신 브랜치의 실제 Windows Native Node 159건, Chromium 확장 Fixture(신규 SPA 검사), 실제 YouTube Chrome의 UX 개선 확인은 **PENDING**. 결과를 미리 PASS 처리하지 않는다.

### 2.3.1 Content Script DevTools 진단 (오류 발생 직후)

~~~js
const discovery = globalThis.YUTOPIA_VIDEO_DISCOVERY;
const hover = globalThis.YUTOPIA_HOVER_CONTROLLER;
const card = globalThis.YUTOPIA_HOVER_CARD;
console.log({
  route: discovery?.getSnapshot()?.route,
  candidates: discovery?.getRuntimeStatus()?.trackedCandidates,
  identified: discovery?.getRuntimeStatus()?.identifiedCandidates,
  controller: hover?.getRuntimeStatus(),
  snapshot: hover?.getSnapshot(),
  card: card?.getRuntimeStatus(),
});
~~~

여기서 `LEFT_BEFORE_DELAY`는 빠른 포인터 이탈, `NO_SAFE_HOVER_PLACEMENT`는 다른 썸네일 보호를 위한 숨김, `INITIAL`/바인딩 0건은 진입 이벤트 또는 탐지 대상 문제일 수 있다. 간헐적 누락의 실제 원인은 사용자 Chrome 진단 로그를 받은 후 확정한다.
## 3. Node.js 및 선택 Chromium 실행 명령

저장소 루트 기준:

~~~sh
node --check extension/hover-card-model.js
node --check extension/hover-card.js
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs extension/tests/hover-controller.test.cjs extension/tests/hover-card-ui.test.cjs
~~~

최신 코드 기대값: 159 tests, 159 pass, 0 fail.

선택적인 오프라인 Chromium DOM 검증:

~~~sh
python extension/tests/chromium-hover-card-fixture.py
~~~

이는 실제 YouTube 사이트, Chrome 확장 격리 세계, Chrome Side Panel 전체 통합 결과는 아니다.

## 4. Windows Chrome 실제 시각 QA — 아직 미실행

1. 기존 개발 폴더를 수정하지 않고 별도 clone/worktree로 feature/yutopia-26-hover-card 브랜치 복제.
2. PowerShell에서 git rev-parse HEAD와 git status --short 확인, 수정된 Node 테스트 159건 PASS 및 구문 통과 기록.
3. Chrome chrome://extensions에서 기존 YUTOPIA 검증 확장 일시 비활성화, 이번 브랜치 extension/ 폴더 로드. YouTube 홈 새로고침.
4. YouTube 홈의 4개 이상 썸네일 중 A 위에 마우스를 잠깐(100ms) 올렸다 떼면 카드가 나타나지 않아야 한다.
5. A 위 약 160ms 이상 머물 때 앵커 옆 Hover 카드가 표시되는지 확인한다(시험 설정 160ms, 브라우저 렌더링 오버헤드는 별도). ID가 A 링크의 /watch?v= 값과 같아야 한다. 긍정/중립/부정 차트와 DEMO·STATIC FIXTURE 고지 및 가상 표본/기간이 함께 보여야 한다.
6. B/C로 빠르게 이동 시 이전 영상 A ID/숫자가 잔상으로 남지 않으며 동시에 카드 여러 개가 생기지 않아야 한다.
7. 오른쪽 끝/아래쪽 썸네일, 화면 스크롤·검색 결과, 좁은 브라우저 창/브라우저 줌, YouTube 다크/라이트 모드에서 화면 밖으로 잘리지 않는지 확인한다.
8. 썸네일→카드 포인터 이동 시 닫히지 않고 더보기/닫기 버튼을 클릭할 수 있어야 한다. 더보기는 아직 Side Panel 대상 고정 없이 '27~28번 예정' 안내만 띄운다.
9. 채널 UC 형식 링크에는 CHANNEL 카드/정확한 ID가 보이고, @handle만 있는 채널은 ID 미확정 안내만 보이며 가상 차트·더보기 버튼이 없어야 한다.
10. Tab 포커스/Enter/Escape, 키보드 조작, YouTube 썸네일 프리뷰·기본 클릭·메뉴·스크롤이 그대로 동작하는지 확인한다.
11. HOME→SEARCH→WATCH→HOME SPA 이동, 무한 스크롤/DOM 제거 뒤 카드/리스너 정리, Service Worker/Side Panel 기존 스켈레톤 동작을 확인한다.
12. Chrome DevTools에서 Content Script 격리 컨텍스트로 아래 실행:

~~~js
globalThis.YUTOPIA_HOVER_CARD?.getRuntimeStatus();
globalThis.YUTOPIA_HOVER_CONTROLLER?.getRuntimeStatus();
~~~

13. Chrome 버전, 테스트 SHA, 159개 Node CLI 테스트 결과, UI 이상·스크린샷/재현 절차 및 미커밋 상태를 기록한다.

## 5. Gate

- 26번 코드/모의 검증: READY_FOR_REVIEW / ISOLATED_V8_TESTED.
- Native Windows Node CLI 152/152: PASS (이전 HEAD의 사용자 로그; 더 이전 150/150 × 2도 PASS). 최신 159/159 CLI 재실행은 PENDING.
- Chromium 오프라인 Fixture: A→B 포인터 차단 수정본 **PASS(이전 HEAD 사용자 로그)**. 최신 SPA 앵커 교체 회귀를 추가했으며 수정본 **RETEST_PENDING**.
- 실제 YouTube Windows Chrome 시각·접근성/이벤트 동작: PENDING.
- Figma 픽셀 패리티: 별도 사람 검수 및 승인 필요.
- 27번 메시지·28번 패널 대상 고정·29번 실제 Chrome 통합 QA: 아직 미구현.
- 실제 YouTube API/감성 파생 정책/결제/배포: NOT_AUTHORIZED.
- 본 PR은 Draft 유지. 사용자 실브라우저 검증·테스트 SHA 확인 후 별도 병합 승인 판단.
