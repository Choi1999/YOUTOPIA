# YUTOPIA 26번 — 실제 Hover 카드 UI(합성 데이터) 검증 기록

> **2026-10-20 / CARD_UI_CODE_READY / V8_MOCK_184_OF_184_PASS / NATIVE_WINDOWS_NODE_152_PASS_PRIOR_HEAD / CHROMIUM_PREVIOUS_PASS / STRICT_THUMBNAIL_CHROME_QA_PENDING**

이 기록은 Chrome MV3 확장 개발자용 **MOCK Hover 카드 UI**를 설명한다. 실제 YouTube 데이터 분석, 운영 배포, 사용자 승인 UI 시안 완성 또는 Side Panel 대상 연동에 대한 증거가 아니다.

## 1. 기준과 구현 범위

- **기준:** 25번 PR #12이 frontend에 병합된 커밋 20edd746e25dc82296a220716bf57c8c66cc5b3.
- **신규 파일:** extension/hover-card-model.js (고정 합성 분포 모델), extension/hover-card.js (Shadow DOM UI), extension/tests/hover-card-ui.test.cjs (DOM/상태 검증), 선택적인 extension/tests/chromium-hover-card-fixture.py.
- **Manifest:** shared.js → target-resolver.js → channel-target-resolver.js → content.js → hover-pointer-tracker.js → hover-presence-reducer.js → hover-controller.js → hover-card-model.js → hover-card.js. 기존 sidePanel/storage 권한 및 www.youtube.com 호스트 범위를 확대하지 않는다.
- **진입:** 작업 25 Controller의 READY/UNRESOLVED 상태가 왔을 때만 동적 Shadow DOM 카드를 하나 만들고, IDLE/DISMISSED/HOVER_PENDING/앵커 분리 시 제거한다.
- **상태 구분:** READY는 안정적인 VIDEO ID 또는 UC 형식 CHANNEL ID가 있을 때만 표시. CHANNEL @handle만 확인된 경우 UNRESOLVED 카드에 식별 필요 문구만 제공하며 가짜 감성 비율과 상세 CTA를 만들지 않는다.
- **카드 구성:** YUTOPIA / DEMO 배지, 대상 영상·채널의 **정규 ID** (실제 제목 수집하지 않음), 합성 긍정·중립·부정 막대/범례, 2개 가상 논점, 1문장 합성 브리핑, 가상 댓글 표본·가상 분석 범위·'실제 갱신 시각 없음' 및 반복적인 STATIC FIXTURE 고지.
- **데이터 경계:** targetId를 결정적 시드로 3개의 고정 MOCK 데이터 예시 중 하나를 사용한다. 실제 YouTube 댓글·제목/메타데이터·사용자/시청기록·LLM/API 결과를 읽거나 전송하지 않는다. 숫자는 실제 채널/영상과 관계없다.
- **위치:** 활성 링크의 getBoundingClientRect를 이용해 우측 12px 우선 배치하고, 공간 부족 시 좌측 또는 가시 영역으로 제한한다(초기 최대 폭 344px). 인접 영상 썸네일 링크를 크게 가리는 경우에는 아래쪽 가용 공간을 검토한다. 좁은 브라우저/스크롤/리사이즈, 화면 밖 앵커는 안전하게 처리한다.
- **독립성:** 한 번에 하나의 YUTOPIA 카드 Host만 유지하며 Shadow DOM 내부에만 CSS를 삽입한다. YouTube 기존 DOM 내용/링크/이벤트 핸들러를 덮어쓰지 않는다.
- **현재 상호작용:** 카드 내부로 포인터를 옮기면 썸네일에서 벗어난 것이므로 **즉시 종료**한다. Shadow 카드 전체는 click-through 정적 미리보기이며, 더보기/닫기 버튼은 현 단계에서는 비활성이다. Escape는 Controller에서 처리한다. 기존 Overlay 유지 규칙은 아래 과거 기록 참조.
- **더보기:** 현재 Strict Hover의 버튼은 비활성이다. 별도 클릭 또는 27~28번 Side Panel 연결 전에는 버튼이 작동한다고 표시하지 않는다. 27번 메시지·28번 사용자 클릭 Side Panel 대상 고정은 아직 구현되지 않았다. 임의로 Side Panel을 열어 대상이 연결됐다고 오인시키지 않는다.
- **Figma:** 기존 Figma 설계 파일과 React 12화면은 변경하지 않았다. 10~19 문서의 정보 구성/배치 제안을 기반으로 한 개발 카드이며 정확한 픽셀/디자인 정합성은 Windows Chrome에서 후속 시각 검수가 필요하다.

## 2. 수행된 테스트

| 범위 | 개수 | 결과 / 한계 |
|---|---:|---|
| 21 영상 DOM 탐지 + 썸네일 우선순위 | 10 | PASS, 격리 V8 Mock URL/DOM |
| 22 SPA 변경 관측 | 16 | PASS, 격리 V8 |
| 23 VIDEO ID 검증 | 21 | PASS, 격리 V8 |
| 24 CHANNEL ID/@handle | 32 | PASS, 격리 V8 |
| 26 Strict Hover 상태 제어 · 진입/이탈/반복/SPA | 41 | PASS, 격리 V8 (새 계약으로 재작성) |
| 26 Hover 카드 모델/DOM·click-through fallback | 36 | PASS, 격리 V8 Mock DOM |
| Benchmark Pointer Tracker + Presence Reducer | 28 | PASS, 격리 V8 (독립 모듈/논리 ID/이동 경로 기하) |
| **전체** | **184** | **184/184 PASS — 격리 V8 모의 실행 (최신 브랜치, 이전 계약 테스트를 대체)** |
| JavaScript 구문 | 신규 모델/렌더러/테스트 | PASS, 격리 V8 파서 |
| Native Node.js CLI | 이전 HEAD에서 node --test 6개 파일 | **152/152 PASS × 1 (사용자 Windows 로그). 최신 184개/7파일은 미실행** |
| Chromium 오프라인 DOM | chromium-hover-card-fixture.py | **이전 HEAD에서 CHROMIUM_HOVER_CARD_FIXTURE_PASS (사용자 Windows 로그); 최신 SPA 복구 Fixture는 재실행 대기** |
| Windows Chrome | 실제 YouTube 홈/검색 카드 위치/조작, 다크/라이트/줌 | **NOT VERIFIED** |
| CI·독립 리뷰 | GitHub 상태 검사·PR 리뷰 | **NOT VERIFIED** |

**격리 V8 수행 방법:** GitHub PR 최신 브랜치 파일을 이용한 모의 어댑터 테스트 **184/184 PASS**. **별도로** Windows PowerShell 원본 로그에서 수정 이전 Native Node CLI 150/150 PASS ×2 및 이후 Node CLI 152/152 PASS ×1을 확인했다(해당 시점 검사 HEAD `84c9e5949c94fa4db6ac842f05f652b7f57d1e87`). Chromium Fixture 검증 성공이나 실제 YouTube Chrome 시각 검증 완료로는 취급하지 않는다.

## 2.1~2.5 과거 버전의 오류·수정 이력 (현재 Strict Hover 계약 아님)

아래 2.1~2.5 절의 타이머·카드 이동·204건 이전 V8 결과는 **해당 이전 커밋의 역사적 기록**이다. 현재 코드는 2.6절 및 상단 최신 테스트 표를 기준으로 평가한다.

### 2.1 Windows 실행 로그·Chromium 실패 분석 (2026-10-20)

- 사용자 로그의 HEAD: `84c9e5949c94fa4db6ac842f05f652b7f57d1e87`, `git status --short` 출력 없음. Node --test 6개 파일 **150/150 PASS를 두 번** 기록했고, hover-card-model.js / hover-card.js 구문 검사도 오류 없이 종료.
- Python 가상환경에 playwright 1.64.0 및 Chromium 다운로드 후 `chromium-hover-card-fixture.py`를 실행했으나 이전 버전의 **93행** `assert "Ab0_-123xyz" in card.inner_text()`에서 `AssertionError`가 발생.
- 원인: `<div id="yutopia-extension-hover-card">`는 **open Shadow Root 호스트**이고, 브라우저에서 호스트의 innerText에는 Shadow DOM 안의 텍스트가 포함되지 않는다. 독립 Chromium 최소 사례에서 Host.innerText는 빈 문자열, Host 안 `.card`의 innerText는 기대 문자열로 확인했다. **실제 카드 콘텐츠가 비어 있었다는 증거가 아니다.**
- 대응: `card_content = card.locator(".card")`로 Shadow DOM 내부를 직접 선택하고, 검증 전에 Shadow Root와 `.card` 존재 여부를 별도로 검사하도록 **테스트 Fixture만 수정**. Content Script UI·모델·권한·Node 테스트는 변경하지 않았다.
- 결과: **원인 분석·Fixture 소스 수정 완료 / 사용자 Windows Chromium 재실행 전**. 수정 이후의 Chromium PASS를 주장하지 않는다. 수정본을 `git pull --ff-only`로 받은 후 재검증 필요.
### 2.2 Chromium 두 번째 실패 및 수정 (2026-10-20)

- 사용자는 Shadow Root 검사 수정 HEAD `6e8c876d88e87a731226fe41e2d0eb88e65d8873`를 `git pull --ff-only`로 받아 Clean Worktree로 재실행했다.
- 이전 `card.inner_text()` Assertion은 통과했고, VIDEO A 카드·합성 데이터·더보기 안내 이후 **111행에서 VIDEO B 썸네일로 이동하려 할 때** Playwright `Locator.hover: Timeout 30000ms exceeded`가 발생했다. 로그에 `<div id="yutopia-extension-hover-card"> intercepts pointer events`가 반복됐다.
- **실제 UI 결함:** 카드가 옆 영상 썸네일을 덮어 B의 Hover/클릭 진입을 방해할 수 있다. 단순한 테스트 선택 오류가 아니므로 `force=True` 같은 우회는 금지한다.
- **원인:** 기존 배치 로직은 우측 카드가 다른 썸네일을 가려도 아래쪽 남는 높이가 카드 전체 자연 높이보다 짧으면 이동을 포기했다. 긴 카드 및 더보기 확장 상태에서 옆 썸네일을 가릴 수 있었다.
- **수정:** 카드 자체의 `maxHeight`를 남은 화면 높이로 제한해 내부 스크롤을 허용하고, 우측/좌측/하단/상단 후보 중 다른 썸네일의 **중앙 포인터 영역을 피하는 위치**를 선택한다. 안전한 후보가 없으면 카드 표시를 취소한다. Host의 빈 영역은 `pointer-events:none`, 실제 Card 내부만 `pointer-events:auto`로 유지한다. 더보기 안내로 높이가 변할 때도 위치 재검사.
- **회귀 보강:** 가상의 긴 카드가 A 옆 B 중앙을 덮는 상황과 모든 위치가 막힌 경우를 Node Fake DOM 테스트에 추가했다. Chromium Fixture는 A→B 이동 전에 `document.elementFromPoint()`로 B 중앙 가림 여부를 확인하며, 강제 Hover 없이 최대 5초 내에 실제 Hover를 시도하도록 보강했다.
- **결과 상태:** 최신 개발 브랜치 기준 기존 회귀 118 + 26번 34 = **격리 V8 모의 152/152 PASS**, **Native Windows Node 152건 및 Chromium 수정본 전체 통과는 아직 미검증**. 실제 YouTube Chrome 실사이트 검증도 대기 중.
### 2.3 실제 YouTube Chrome에서 발견된 간헐적 카드 미표시·지연 (2026-10-20)

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
### 2.4 실제 Chrome 재현 — 같은 영상 이탈 후 재진입 지연 및 누락 (2026-10-20)

- 사용자가 `마우스가 벗어나 카드는 사라지지만 같은 영상에 다시 Hover하면 카드가 열리지 않거나 한참 뒤에 발생`한다고 보고했다. GPU 콘솔의 `powerPreference option is currently ignored`는 Hover FSM 오류의 직접적인 증거가 아니다.
- **확인된 Controller 결함:** 명시적 닫기/ESC 이후 `suppressedAnchor`가 남을 때 활성 `selected`가 이미 null이면 기존 `leaveBinding()`이 조기 return하여 실제 `pointerleave`에서 suppression을 해제하지 못했다. YouTube가 재진입 시 `pointerenter`를 생략하면 문서 `pointermove` 복구도 suppression으로 막혔다.
- **이탈 이벤트 누락 위험:** 기존 document `pointermove`는 새 영상 진입 복구만 담당해 `selected.pointerInside=true`가 남아 있을 때 실제 링크 밖으로 이동해도 `LEAVE_PENDING`이 시작되지 않을 수 있었다.
- **수정:** 문서 capture `pointerover/move/out`로 경계를 재검사하고, 링크 내부 자식 간 이동은 이탈로 계산하지 않으며 실제 경계 이탈은 200ms 유예 후 IDLE로 정리한다. 닫기 이후 suppression은 실제 썸네일 위에 포인터가 남은 경우에만 적용하고, 닫기 버튼을 카드 내부에서 누른 경우에는 원본 링크 복귀를 허용한다.
- **복구 범위:** 이벤트 composedPath 및 실제 YouTube 카드의 렌더러 내부/썸네일 경계 좌표를 검사해 미리보기 Overlay 등으로 원래 anchor 이벤트가 누락돼도 복구한다. 문서 전체 모든 후보를 매 mousemove 검사하지 않고 현재 렌더러의 링크만 검사한다. 새로운 개인정보·시청기록·외부 API 처리 없음.
- **안전:** Shorts·광고·미확정 VIDEO/CHANNEL ID는 계속 거부. 닫힌 카드를 같은 위치에서 단순 움직임만으로 재열지 않음. focusin/out, 160ms 대기 및 카드 안 200ms 이탈 유예는 유지.
- **테스트 보강:** 25번 단위 테스트 46→60건(같은 A 3회 재진입, 명시 닫기 후 suppression 해제, DOM 이벤트 누락, 문서 pointerout, Overlay 보존, 영상 A→B→A, 자식·터치 경계 등). 전체 21~26번 V8 모의 **173/173 PASS**. Chromium Fixture에 동일 영상 3회 이탈/재진입과 카드 닫기 후 복귀 추가.
- **인수 결과 (이전 단계):** 위 단계별 회귀는 격리 V8 실행 결과이며, 최신 브랜치에서 **Native Windows Node CLI 및 Chromium 오프라인 Fixture·실사이트 YouTube Chrome 검증은 미실행**. 사용자 실환경 재현 원인이 이 코드 수정으로 전부 해결됐다는 최종 판정도 보류한다.

### 2.4.1 재현 시 확인할 상태

~~~js
({
  videoDiscovery: globalThis.YUTOPIA_VIDEO_DISCOVERY?.getRuntimeStatus(),
  hover: globalThis.YUTOPIA_HOVER_CONTROLLER?.getRuntimeStatus(),
  hoverSnapshot: globalThis.YUTOPIA_HOVER_CONTROLLER?.getSnapshot(),
  card: globalThis.YUTOPIA_HOVER_CARD?.getRuntimeStatus()
})
~~~

`pointerInside`, `overlayPointerInside`, `suppressedAnchorActive`, `lastReason`, `lastHoverReason` 및 `boundVideoAnchors`를 비교한다. 종료 이후 `IDLE`인데 `pointerInside=true`면 상태 누수 의심, `NO_SAFE_HOVER_PLACEMENT`면 의도적 배치 거부, `identifiedCandidates=0`이면 식별 실패를 먼저 점검한다.
### 2.5 외부 Hover 벤치마킹 승인 후 P0 구조 분리 (2026-10-20)

승인 근거: [Hover Interaction 벤치마킹/적용 설계](../../docs/product-v0.2/HOVER_INTERACTION_BENCHMARK_20261020.md).

- **Pointer Tracker 모듈 신규:** hover-pointer-tracker.js, DOM composedPath/ancestor 및 YouTube 렌더러 내부 좌표 히트 테스트, detached anchor 거부, 순수 targetKey(VIDEO/CHANNEL,id), 안전 이동 기하 safeTransitPoint 후보. 포인터·사용자 데이터는 저장·전송하지 않음.
- **Presence Reducer 신규:** hover-presence-reducer.js, 원본 썸네일 pointer/focus와 카드 pointer/focus 4개 Flag를 불변 상태/행동으로 통합. 타이머/카드/DOM은 직접 제어하지 않음.
- **Single Controller 유지:** hover-controller.js는 위 두 모듈을 사용해 활성 타깃·160ms 진입/200ms 종료·generation/requestId·상태 Publish를 중앙 관리한다.
- **논리적 대상/DOM 분리:** 같은 VIDEO/CHANNEL ID인 hovered DOM 앵커가 SPA 중 교체되면 기존 READY와 requestId를 유지하고 anchor만 갱신한다. 다른 ID거나 Hover/Focus 재연결이 확인되지 않으면 기존처럼 정리. @handle은 추정 ID로 승격 금지.
- **Manifest/Chromium 로딩 계약:** content.js 다음 tracker→reducer→controller→card-model→card UI. 새로운 Chrome 권한이나 NPM 의존성 없음.
- **P1 보류:** 순수 safeTransitPoint만 제공. 카드 유지 시간을 늘리거나 바로 A→B 전환하는 DelayGroup은 실브라우저 검증 후 별도 실험.
- **회귀:** 기존 21~24 78건 + Controller 63건 + Card UI 35건 + Tracker/Reducer 신규 28건 = **204/204 PASS**, 격리 V8 에뮬레이션. Native Node CLI 204건 및 Chromium 오프라인/실 YouTube 신규 결과는 아직 없음.
- **Windows 수용:** 동일 영상 A 10회 진입/완전 종료/재진입 누락 0회, A→B→A, 카드 이동·닫기/ESC, SPA targetKey 보존, Shorts/광고 제외, YouTube 원래 클릭/미리보기 보존. 테스트 클론의 HEAD와 GitHub 최신 SHA 일치 및 clean worktree 확인 필수.

## 2.6 현재 승인된 Strict Thumbnail Hover 계약 (2026-10-20)

- **사용자가 명시한 정본 동작:** 썸네일 진입 → 해당 영상 카드 즉시 표시, 썸네일 이탈 → 즉시 카드 제거. A→외부→A 및 A→B→A가 반복돼도 활성 영상 카드가 누락되지 않아야 한다.
- **지연/유예 제거:** 이전 400ms→160ms 지연과 200ms 이탈 유예를 **모두 제거**했다. hover-controller.js 상태는 READY/UNRESOLVED/IDLE/DISMISSED 중심이고, 모의 실행에서 타이머를 생성하지 않는다.
- **Pointer 경계:** anchor pointerenter/leave, document capture pointerover/move/out을 단일 Controller에서 해석. Tracker는 등록된 정규 VIDEO/CHANNEL 후보만 반환하고 다른 영상으로 이동하면 즉시 targetId/requestId를 교체한다.
- **DOM 재생성:** Content Discovery가 제목 링크보다 실제 a#thumbnail 또는 yt-lockup 이미지 링크를 우선 선택한다. 같은 ID의 hovered 신규 SPA anchor로 교체되면 기존 READY/requestId를 유지하며, 다른 ID 또는 무효 anchor는 거부/정리한다.
- **위치 실패와 데이터 부정확성 분리:** 카드 배치 실패만으로 컨트롤러를 DISMISSED로 만들지 않는다. 모든 배치 후보가 막혀도 click-through 카드가 표시되며, Card와 Host 모두 pointer-events:none으로 다른 썸네일 Hover/클릭을 가로채지 않는다. VIDEO ID 자체가 불명확하거나 광고/Shorts라면 여전히 표시하지 않는다.
- **거래 관계:** 현 개발 카드의 더보기/닫기 버튼은 클릭 비활성. 썸네일을 떠나 카드에 포인터를 옮겨 버튼을 누르는 이전 인터랙션은 Strict Hover 요구와 양립하지 않는다. Side Panel 클릭 진입은 27~28번 후속 설계에서 다룬다.
- **회귀 테스트:** 21 탐지 10 + 22 SPA 16 + 23 영상 ID 21 + 24 채널 32 + 26 Strict Controller 41 + Card 36 + Tracker/Reducer 28 = **격리 V8 184/184 PASS**. 이전 25 Hover 타이머 테스트 63건은 현재 계약과 달라 새 41건 테스트로 대체했다(단순 누적 204→184가 성능 회귀의 증거는 아님).
- **새 Chromium Fixture:** VIDEO A 10회 즉시 진입/이탈, A→B 10회 교차, Popup 클릭 차단 확인, ESC 후 재진입, SPA 앵커 교체, 미해결 @handle. **최신 Chromium 전체 실행 결과 미제출**.
- **인수 Gate:** Windows Native Node 184/184, Chromium Fixture 성공 출력, 실제 YouTube Chrome에서 A 반복 10회+A→B→A 10회 누락 0개, 썸네일 원래 클릭/시청 동작 유지. 통과 전 PR #13 Draft·미병합 유지.

## 3. Node.js 및 선택 Chromium 실행 명령

저장소 루트 기준:

~~~sh
node --check extension/hover-card-model.js
node --check extension/hover-card.js
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs extension/tests/hover-controller.test.cjs extension/tests/hover-card-ui.test.cjs extension/tests/hover-interaction-benchmark.test.cjs
~~~

최신 코드 기대값: 184 tests, 184 pass, 0 fail.

선택적인 오프라인 Chromium DOM 검증:

~~~sh
python extension/tests/chromium-hover-card-fixture.py
~~~

이는 실제 YouTube 사이트, Chrome 확장 격리 세계, Chrome Side Panel 전체 통합 결과는 아니다.

## 4. Windows Chrome 실제 시각 QA — 아직 미실행

1. 기존 개발 폴더를 수정하지 않고 별도 clone/worktree로 feature/yutopia-26-hover-card 브랜치 복제.
2. PowerShell에서 git rev-parse HEAD와 git status --short 확인, 수정된 Node 테스트 184건 PASS 및 구문 통과 기록.
3. Chrome chrome://extensions에서 기존 YUTOPIA 검증 확장 일시 비활성화, 이번 브랜치 extension/ 폴더 로드. YouTube 홈 새로고침.
4. YouTube 홈의 4개 이상 일반 영상 A에 마우스를 진입시키면 **기다리는 타이머 없이 즉시** 카드가 나타나야 하고, 썸네일에서 완전히 벗어나면 즉시 사라져야 한다.
5. A에서 10회 반복 진입/이탈하고, A→B→A를 10회 전환했을 때 누락 0회인지 확인한다. 카드 위치 계산이나 과거 타이머가 카드 생명주기를 종료해서는 안 된다. ID가 A 링크의 /watch?v= 값과 같아야 한다. 긍정/중립/부정 차트와 DEMO·STATIC FIXTURE 고지 및 가상 표본/기간이 함께 보여야 한다.
6. B/C로 빠르게 이동 시 이전 영상 A ID/숫자가 잔상으로 남지 않으며 동시에 카드 여러 개가 생기지 않아야 한다.
7. 오른쪽 끝/아래쪽 썸네일, 화면 스크롤·검색 결과, 좁은 브라우저 창/브라우저 줌, YouTube 다크/라이트 모드에서 화면 밖으로 잘리지 않는지 확인한다.
8. 썸네일→카드 방향으로 마우스를 움직일 때 원래 썸네일에서 벗어나면 카드가 **즉시 닫히는지** 확인한다. 현재 Card는 click-through 읽기 전용이며 더보기/닫기 버튼 비활성(27~28번 분리).
9. 채널 UC 형식 링크에는 CHANNEL 카드/정확한 ID가 보이고, @handle만 있는 채널은 ID 미확정 안내만 보이며 가상 차트·더보기 버튼이 없어야 한다.
10. Tab 포커스/Enter/Escape, 키보드 조작, YouTube 썸네일 프리뷰·기본 클릭·메뉴·스크롤이 그대로 동작하는지 확인한다.
11. HOME→SEARCH→WATCH→HOME SPA 이동, 무한 스크롤/DOM 제거 뒤 카드/리스너 정리, Service Worker/Side Panel 기존 스켈레톤 동작을 확인한다.
12. Chrome DevTools에서 Content Script 격리 컨텍스트로 아래 실행:

~~~js
globalThis.YUTOPIA_HOVER_CARD?.getRuntimeStatus();
globalThis.YUTOPIA_HOVER_CONTROLLER?.getRuntimeStatus();
~~~

13. Chrome 버전, 테스트 SHA, 184개 Node CLI 테스트 결과, UI 이상·스크린샷/재현 절차 및 미커밋 상태를 기록한다.

## 5. Gate

- 26번 코드/모의 검증: READY_FOR_REVIEW / ISOLATED_V8_TESTED.
- Native Windows Node CLI 152/152: PASS (이전 HEAD의 사용자 로그; 더 이전 150/150 × 2도 PASS). 최신 184/184 CLI 재실행은 PENDING.
- Chromium 오프라인 Fixture: A→B 포인터 차단 수정본 **PASS(이전 HEAD 사용자 로그)**. 최신 SPA 앵커 교체 회귀를 추가했으며 수정본 **RETEST_PENDING**.
- 실제 YouTube Windows Chrome 시각·접근성/이벤트 동작: PENDING.
- Figma 픽셀 패리티: 별도 사람 검수 및 승인 필요.
- 27번 메시지·28번 패널 대상 고정·29번 실제 Chrome 통합 QA: 아직 미구현.
- 실제 YouTube API/감성 파생 정책/결제/배포: NOT_AUTHORIZED.
- 본 PR은 Draft 유지. 사용자 실브라우저 검증·테스트 SHA 확인 후 별도 병합 승인 판단.
