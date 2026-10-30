# YUTOPIA Chrome 확장 — 로컬 DEMO / 개발자 전용

> **EXPERIMENTAL · 실제 YouTube 댓글/API/AI/결제/로그인 없음 · Chrome MV3**

이 폴더는 YUTOPIA **YouTube 홈에서 썸네일 Hover → 간략 반응 카드 → 더보기 → Chrome Side Panel**을 구현하기 위한 독립 PoC 영역입니다.

## 현재 구현 기준 — 18단계 완료 / 19단계 안정화

기준 브랜치: `frontend`
18단계 확정 커밋: `ddff69adbbd1e8eaa19f7ca1d9c40f09fa664880`

### 현재 동작

- Chrome MV3에서 YouTube 영상·채널 Hover 대상을 식별한다.
- Summary Client가 Worker에 `YUTOPIA_HOVER_SUMMARY_GET_V1`을 전송한다.
- Worker는 개발용 합성 공급자만 호출한다.
- 검증된 `SNAPSHOT`과 분모가 있는 READY/PARTIAL에서만 합성 감성 비율을 표시한다.
- STALE/NO_DATA/COMMENTS_DISABLED/ENTITLEMENT_LIMITED/
  POLICY_BLOCKED/ERROR에서는 검증되지 않은 수치를 표시하지 않는다.
- NOT_FOUND와 REJECTED는 구분한다.
- 기존 `더보기 → Side Panel → Web 상세` 선택 기능을 보존한다.

### 데이터 공급자 교체 경계

현재 공급자는 `demo-hover-summary-provider.js`이며
정적 합성 fixture만 제공한다.

운영 공급자로 전환하려면 별도의 승인과 검증이 필요하다.

1. 실제 데이터의 합법적 수집·사용 범위 및 정책 검토
2. 인증·권한·테넌트 격리 계약 확정
3. 서버 측 분석 스냅샷 구조와 provenance 확정
4. 운영 API와 오류·지연·갱신 정책 검증
5. 새로운 응답 계약 및 버전 호환성 테스트
6. 실제 Chrome 설치형 E2E와 개인정보 보호 검증

`analysis-v1-candidate`는 아직 운영 승인 계약이 아니다.
현재의 `STATIC_FIXTURE / PUBLIC_REUSABLE / isSynthetic=true`
조건을 실데이터에 임의로 재사용해서는 안 된다.

운영 데이터 연결을 위해 Chrome 권한, 외부 API,
사용자 정보 저장을 임의로 추가하지 않는다.

### Worker 요청 순서

Summary Worker는 탭 ID와 documentId를 기준으로
Worker 메모리에 최신 requestId를 추적한다.

- 같은 문서의 오래된 requestId는 거부한다.
- 다른 documentId는 독립적으로 취급한다.
- Worker 재시작 후에는 메모리 요청 순서가 초기화될 수 있다.
- 실제 Chrome의 재시작·동시 요청·연결 해제는 별도 E2E가 필요하다.
- 개발자 도구에서 임의의 큰 requestId로 직접 전송하면
  같은 문서의 정상 Hover 요청이 오래된 요청으로 거부될 수 있다.
- 수동 진단은 새 테스트 탭에서 수행하고 실제 Hover 확인에는
  별도의 새 YouTube 탭을 사용한다.

### 검증 근거

18단계 기준:
- 확장 프로그램 Node 테스트: 262/262 PASS
- 공유 분석 계약: 19/19 PASS
- 프론트엔드: 171/171 PASS
- Chrome 핵심 기능: 사용자 수동 검수 PASS

19단계의 추가 테스트 결과와 커밋 SHA는 검증 후 기록한다.

아래 20~26번 설명은 초기 구현 및 과거 QA 이력을 포함한다.
현재 실행 사양은 이 섹션과 최신 코드·테스트를 우선한다.

## 기술 경계

- 기존 `frontend/` React 데모와 별개로 작동합니다.
- **모의 분석값만 표시**하고 사용자의 실제 댓글이나 브라우징 이력을 수집하지 않습니다.
- **HTTP API/YouTube API/LLM 호출을 하지 않습니다.** 데이터 사용권/파생지표 승인이 있기 전에는 운영 연결을 추가하지 마세요.
- Chrome 116 이상 MV3 + `sidePanel` API를 기준으로 시연합니다.
- 브라우저에서 로컬로 테스트하기 전에는 **기능 PASS라고 보고하지 않습니다**.

## 설치 — 코드를 별도 디렉터리로 받은 후

1. 현재 유지되는 **`frontend` 브랜치의 `extension/`** 디렉터리를 가져오거나 별도 Git worktree에 체크아웃하세요. 병합 후 삭제된 임시 기능 브랜치를 사용하지 마세요. 다른 Codex가 작업하는 로컬 브랜치는 변경하지 마세요.
2. Chrome 주소창에 `chrome://extensions` 입력.
3. 오른쪽 상단 **개발자 모드** 활성화.
4. **압축해제된 확장 프로그램을 로드(Load unpacked)** 선택 후 이 `extension/` 폴더 선택.
5. `https://www.youtube.com/`에 들어가 실제 홈 썸네일 여러 개로 시험.
6. 소스를 수정했다면 확장 관리 화면에서 **새로고침** 후 YouTube 탭도 새로고침.

**보안:** 확장 권한은 `youtube.com`만 지정했습니다. 사용자 개인정보·토큰·원문 댓글은 저장하지 않습니다.

## 테스트/디버깅

- 이 폴더는 별도 `pnpm`/빌드 의존성을 요구하지 않는 **plain JavaScript** 실험입니다.
- 로컬 Chrome에서 실제 Hover·패널 열림 동작, 브라우저 권한·스타일 충돌을 검증해야 합니다.
- `content.js` 등 확장 코드의 함수를 수정하는 경우 목적·입력·출력·실패·기존 기능과의 관계를 **한국어 블록 주석**으로 설명하세요.
- `javascript:` URL·`eval`·페이지 컨텍스트로 고객 정보를 주입하는 코드는 금지합니다.
- 테스트 결과는 [00~99 실행대장](../docs/product-v0.2/04_EXECUTION_00_99.md)에서 해당 단계별 증거로 연결하세요(기능 브랜치에는 제품 문서가 포함되지 않을 수 있음).

## 21·22번 영상 후보 탐지 (실제 카드 표시 전)

- YouTube 홈(/)·검색(/results)의 일반 영상 썸네일 렌더러를 DOM에서 읽기 전용으로 탐지합니다.
- 광고·Shorts·외부 도메인·빈 영상 링크를 제외하고, 중복 콘텐츠 스크립트 주입을 방지합니다.
- 화면에 카드를 추가하거나 실제 YouTube 댓글·메타데이터를 수집하지 않습니다. **21~25번 영상·채널 식별과 Hover 상태 제어는 frontend에 병합**됐습니다. 26번은 **Shadow DOM 합성 미리보기 카드 개발 브랜치**이며 Windows Chrome 시각 검증 전입니다.
- **기본 테스트:** 저장소 루트에서 `node --test extension/tests/content-discovery.test.cjs` 실행(별도 npm 의존성 없음).
- **선택 Chromium DOM Fixture:** `python extension/tests/chromium-dom-fixture.py` (Python Playwright와 Chromium 필요, 실제 확장 E2E 아님).
- **검증·미완료 Gate:** [20·21 테스트 기록](tests/QA_20_21_EVIDENCE.md).

## 22번 SPA·무한 스크롤 자동 갱신

- MutationObserver가 새 영상 카드·카드 제거·href/숨김/광고 속성 변화를 관측하고, YouTube SPA 이동 이벤트와 popstate를 처리합니다.
- 짧은 시간에 발생한 DOM 변화를 120ms로 묶고, added/removed/updated 구독 알림을 제공합니다. dispose()는 observer·타이머·이벤트·이전 DOM 참조를 해제합니다.
- **Node 재실행:** `node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs` (기존 9건+신규 16건).
- **선택 Chromium SPA Fixture:** `python extension/tests/chromium-spa-fixture.py` (Playwright 필요; 제출 시 미실행).
- **검증 사실(2026-10-20 독립 재실행):** Node.js 22의 공식 테스트 러너 **25/25 PASS**, 저장소의 Chromium 오프라인 SPA Fixture **PASS**. [22번 QA 기록](tests/QA_22_EVIDENCE.md)에 Blob SHA 및 실행 범위를 기록했습니다. **Windows Chrome 기본 동작은 2026-10-20 사용자 수동 검증 7/7 PASS로 보고됐습니다. 단, 실행 로그·로컬 검증 SHA는 아직 첨부되지 않았습니다.**
- [PR #8](https://github.com/Choi1999/YOUTOPIA/pull/8)(21번), [PR #9](https://github.com/Choi1999/YOUTOPIA/pull/9)(22번), [PR #10](https://github.com/Choi1999/YOUTOPIA/pull/10)(23번)은 frontend에 순차 병합됐습니다. 24번은 별도 브랜치에서 검수합니다.

## 23번 VIDEO ID 정확성 검증 (코드 병합 완료)

- 대상이 분명한 YouTube /watch?v= 링크만 VIDEO target으로 승인하며, 11자 영숫자·하이픈·밑줄 형식만 허용합니다(보수적 MVP 가정).
- 중복 v 매개변수·잘못된 문자/길이·비YouTube·비HTTPS·유사 도메인·썸네일/제목 영상 ID 불일치를 거부합니다.
- Manifest는 shared.js → target-resolver.js → channel-target-resolver.js → content.js 순서로 탐지 계약을 로드합니다(채널 Resolver는 24번 작업 브랜치에 한정).
- 기존 21·22번 후보 탐지의 candidate 수치는 보존하면서, VIDEO ID가 검증된 후보만 target을 제공하고 getRuntimeStatus().identifiedCandidates로 수를 구분합니다.
- 재실행: `node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs`.
- 격리 V8 46/46 PASS. Windows Chrome·Node.js 46/46 PASS와 테스트 Git SHA 일치는 **사용자가 제출한 검증 결과**입니다(원본 로그·로컬 미커밋 변경 여부 미확인). [23번 QA 기록](tests/QA_23_EVIDENCE.md)을 참고하세요.

## 24번 CHANNEL ID와 @handle 구분 (코드 검수 중)

- /channel/UC + 22자 URL은 **채널 ID 형식이 일치하는 후보**로 반환하지만 실제 채널 존재·소유권은 검증하지 않습니다.
- /@handle 링크는 HANDLE_UNRESOLVED, channelId:null, targetId:null로 유지하며 실제 channelId를 임의로 만들지 않습니다. 비라틴 문자·별칭 경로는 안전한 기본값으로 유보합니다.
- 영상 썸네일과 채널명/아바타를 다른 Map·구독 이벤트로 추적하며, 기존 22번 단일 MutationObserver를 재사용합니다.
- 신규 테스트: `node --test extension/tests/channel-target-resolver.test.cjs`, 전체 회귀: `node --test extension/tests/*.test.cjs`.
- 선택 Chromium DOM: `python extension/tests/chromium-channel-fixture.py` (신규 실행 미확인).
- 현재 **격리 V8 모의 테스트 78/78 PASS**이며, Windows 검증은 사용자가 통과했다고 보고하고 테스트 SHA가 PR #11과 일치함을 확인했습니다. 원본 콘솔 출력·미커밋 작업 트리 상태는 제출되지 않았습니다. [24번 QA 기록](tests/QA_24_EVIDENCE.md)을 참고하세요.

## 25번 Hover 상태 제어 (frontend 병합 완료)

- Manifest에 hover-controller.js를 content.js **다음**에 로드하도록 추가했습니다.
- 기존 VIDEO/CHANNEL 탐지 스트림을 사용합니다. 단일 활성 Hover를 보장합니다. 기존 25번의 400ms 진입·200ms 이탈 유예는 병합된 과거 기준입니다. 26번 최신 브랜치는 사용자의 Strict Thumbnail 요구에 따라 **진입/종료 타이머를 모두 제거**했습니다. 아래 26번 섹션이 현재 개발 사양입니다.
- A→B→C 빠른 이동과 DOM 요소 교체 시 이전 타이머 및 requestId를 무효화합니다. READY는 실제 카드가 화면에 표시된 것이 아니라 26번 UI가 표시할 수 있는 준비 상태입니다.
- 영상/채널 ID가 검증되지 않으면 상세 대상을 제공하지 않습니다. @handle만 확인된 경우 UNRESOLVED/targetId:null로 유지합니다.
- 26번 개발 브랜치에서는 document 위임 pointerover/move/out 한 세트와 단일 활성 binding으로 교체했습니다. anchor별 리스너·overlay 점유·suppressedAnchor·열림/종료 타이머는 사용하지 않습니다.
- 키보드 focusin/out, Escape·탭 숨김, 링크 삭제·SPA 이동, dispose(), 중복 주입을 처리하며 YouTube 클릭·재생을 차단하지 않습니다.
- 신규 테스트: node --test extension/tests/hover-controller.test.cjs (40건). 전체 회귀: [25번 QA 기록](tests/QA_25_EVIDENCE.md)에 명시된 다섯 테스트 파일을 Node.js --test에 명시적으로 전달(118건).
- 선택 오프라인 Chromium Fixture: python extension/tests/chromium-hover-fixture.py (작성만 완료, 실행 미확인). [25번 QA 기록](tests/QA_25_EVIDENCE.md).
- **25번 격리 V8 모의 118/118 PASS**, Windows 수동 QA 통과 및 테스트 SHA·Clean Worktree는 사용자 보고로 확인했습니다(원본 Node/Chrome 실행 로그는 별도 미제출). [PR #12](https://github.com/Choi1999/YOUTOPIA/pull/12)는 frontend에 병합됐습니다.

## 26번 실제 Hover 카드 UI (합성 데이터 전용 · Chrome 검수 전)

- 25번 Hover의 READY 상태에서만 정규 VIDEO/CHANNEL ID를 사용해 **단일 Shadow DOM 카드**를 실제로 화면에 표시합니다. `@handle`만 있는 경우 채널 ID 미확정 안내만 제공하며 감성 차트·더보기는 표시하지 않습니다.
- 가상 감성 막대(긍정/중립/부정), 가상 표본과 기간, 2개 가상 논점, 짧은 브리핑과 명확한 **DEMO · STATIC FIXTURE · 실제 분석 아님** 안내를 제공합니다. 실제 YouTube 제목, 댓글, 사용자 데이터나 API는 읽지 않습니다.
- 앵커 기준 우측/좌측/아래/위/fallback 배치, 좁은 창 클램프, 다크 테마, Escape, SPA·스크롤 이후 대상 정리를 지원합니다. 배치 결과는 Controller 종료 이유와 별도로 기록합니다.
- **최신 26번 Interactive Card는 카드 안으로 포인터를 이동해도 활성 타깃을 유지합니다.** 카드 자체는 pointer-events:auto이며 Host와 빈 Surface는 pointer-events:none입니다. 더보기·닫기 버튼은 여전히 비활성이고 Side Panel 연결은 27·28번 별도입니다.
- Manifest 스크립트 순서: shared.js → target-resolver.js → channel-target-resolver.js → content.js → hover-controller.js → hover-card-model.js → hover-card.js.
- 카드 UI 테스트 39건, Hover Controller 42건을 포함해 **전체 6개 Node 테스트 파일 160건(격리 V8 모의 PASS, Native Node 최신 재실행 필요)**입니다. [26번 QA 기록](tests/QA_26_EVIDENCE.md)의 명령을 사용하세요.
- 오프라인 Chromium은 같은 A 20회 및 A→B→C→A 20회, SPA anchor 교체를 통과했습니다. 실 YouTube 검색 DOM은 같은 A 10회 및 A→B→C 10회를 통과했고, 익명·무기록 Home은 영상 feed를 제공하지 않아 SKIP으로 남겼습니다. 실제 콘텐츠 값은 읽거나 출력하지 않았습니다.

### 간헐적으로 카드가 나타나지 않을 때

- 실제 Youtube에서 광고·Shorts·WATCH 페이지는 식별 대상에서 제외되며, 영상 ID가 불명확하면 카드를 표시하지 않습니다.
- Chrome DevTools **YUTOPIA Content Script** 컨텍스트에서 두 상태를 함께 확인합니다.

~~~js
globalThis.YUTOPIA_HOVER_CONTROLLER?.getRuntimeStatus()
globalThis.YUTOPIA_HOVER_CARD?.getRuntimeStatus()
~~~

- Controller의 strategy, lastReason, selectedMode, activeTargetKey, pointerInside, pointerRecoveries, perAnchorListeners와 카드의 lastHoverReason, lastRenderReason, layout을 확인합니다. strategy=DELEGATED_INTERACTIVE_CARD, perAnchorListeners=0, activationDelayMs=0, leaveGraceMs=0, cardTransitGraceMs=160이 정상입니다. 카드 배치 실패만으로 Hover를 닫지 않습니다.
- 위 도구는 현재 탭 메모리만 읽으며 결과를 전송하지 않습니다. 자세한 기록·실브라우저 검증 방법은 [26번 QA 지침](tests/QA_26_EVIDENCE.md)을 참고하세요.

## 26번 Strict Thumbnail Hover 수정 (944b 당시 기준 · 이력)

- **진입:** 영상 썸네일에 포인터가 진입하면 즉시 해당 영상 READY 및 합성 카드를 표시한다. 문서 pointerover/pointermove와 발견된 anchor 사각형으로 YouTube portal `video-preview` 및 DOM 교체의 누락 이벤트를 복구한다. 0ms는 의도된 타이머가 없다는 뜻이며 브라우저 렌더링 시간 0ms 보증이 아니다.
- **이탈:** 썸네일에서 포인터가 벗어나면 즉시 IDLE/카드 제거. 카드로 포인터를 옮겨도 유지하지 않는다. 같은 A를 50회, A→B→A를 반복해도 과거 타이머·억제 상태가 막지 않는다.
- **카드:** 현재 mouse click-through 읽기 전용. 더보기/닫기는 disabled이며, 별도 클릭 상세 진입(27~28)은 후속 기능이다. 이전 카드 버튼 클릭 인터랙션은 의도적으로 중단했다.
- **배치(현재 개정):** viewport-fallback 표시를 유지한다. Host와 빈 Surface는 pointer-events:none, 실제 Shadow Card만 pointer-events:auto이므로 카드 뒤 영상은 의도적으로 선택을 차단하고 카드 밖 영역은 클릭을 허용한다.
- **탐지:** Youtube DOM에서 제목 링크보다 실제 시각적 Thumbnail 링크를 우선한다. 광고·Shorts·유효하지 않은 대상 ID는 기존대로 제외한다.
- **검증:** 26번 QA 문서 참조. Node 144/144, 오프라인 Chromium PASS, 실 YouTube 검색 DOM PASS. 익명 Home feed와 수동 Windows 확장 로드는 남은 검증이므로 PR #13은 Draft·미병합 유지.

## 이전 Hover 벤치마크 구조의 처리

- 별도 Pointer Tracker/Presence Reducer와 기존 160ms open·200ms 일반 leave grace는 런타임에서 제외된 상태다. 새 Interactive Card는 **Trigger→Card 사이의 기하학적 짧은 간격에만 고정 160ms 이동 유예**를 사용하며 반복 pointermove는 해당 기한을 연장하지 않는다.
- 필요한 경계 판정과 stable target key는 작은 위임형 Controller 안에 포함했습니다. 같은 VIDEO/CHANNEL ID의 hovered 새 SPA anchor로 교체되면 requestId를 유지하고, 다른 ID나 포인터 밖 교체는 종료합니다.
- 새로운 NPM 런타임 패키지나 Chrome 권한을 추가하지 않았습니다. 과거 비교 자료는 [2026-10-20 Hover 벤치마킹 기록](../docs/product-v0.2/HOVER_INTERACTION_BENCHMARK_20261020.md)에 역사적 근거로만 남깁니다.

## 26번 추가 승인 — Interactive Shadow Hover Card (최신 계약)

- 썸네일 A에 Hover하면 기존처럼 즉시 A 카드가 표시됩니다. A→카드 내부로 이동하는 경우는 일반 이탈이 아니며, A 카드가 그대로 유지됩니다.
- 카드의 포인터 이벤트가 먼저 처리되므로 카드 아래에 겹친 영상 B는 선택되지 않습니다. 카드에서 실제로 보이는 영상 C로 이동하면 C 카드로 즉시 전환됩니다.
- 카드 바깥의 빈 화면으로 이동하면 즉시 종료합니다. 썸네일과 카드 사이의 짧은 안전 경로에서만 최대 160ms 이동 유예를 주며, 이는 일반 Hover를 늦추는 타이머가 아닙니다.
- 동일 ID의 SPA 앵커 교체 시 requestId와 Card 유지. 늦게 도착한 원래 썸네일 pointerout은 카드 고정 상태를 종료할 수 없습니다.
- 카드의 더보기·닫기 버튼은 27~28번 후속 기능으로 현재 disabled. 실제 Side Panel/계정/댓글/API/수집 기능은 추가되지 않았습니다.
- 코드 리뷰 후 GitHub 소스의 격리 V8 모의 160/160 PASS (동일 ID의 멀리 떨어진 중복 썸네일로 잘못 SPA 재연결되는 현상 수정). 기존 Windows Node 144/144 및 Chromium PASS는 이전 944b 커밋에서의 증거이므로 **최신 160건/오프라인 Chromium/설치형 MV3 Chrome QA 재검증이 필요합니다.**
- [새 UX 수용 기준·테스트](tests/QA_26_EVIDENCE.md)


### PR #13 코드 리뷰 — SPA 동일 영상 중복 앵커 방지

- 사용자 수동 Chrome Home/Search/A→Card→A/배경 영상 차단 PASS가 확인된 SHA `4193f369...`에서는 카드 고정 중 SPA가 원본 썸네일 DOM을 제거하면, 화면 다른 위치에 있던 같은 videoId·href 후보로 잘못 재결합할 수 있는 예외를 격리 V8에서 재현했다.
- 컨트롤러가 처음 활성화한 썸네일의 마지막 유효 화면 위치를 보존하고, 카드에 포인터가 고정된 상황에서 새 앵커가 **그 근처에 있는 경우에만** 재결합한다. 멀리 떨어진 복제 영상은 fail-closed 처리한다.
- 신규 Controller 테스트 2건 포함 **격리 V8 모의 160/160 PASS**; 실제 Windows Native Node/오프라인 Chromium/Chrome 설치형 MV3는 최신 SHA에서 재검증 필요. 과거 Windows Native 144/144, Chromium 및 사용자 Chrome 수동 검증 결과를 현재 HEAD로 소급하지 않는다.
- PR은 **Ready for review / OPEN / 미병합**이며 Side Panel과 더보기 클릭 연결은 아직 27~28번 별도 범위이다.

## 현재 단계

- **20:** Chrome MV3 기본 뼈대 및 문서.
- **21:** 영상 후보 탐지 코드 병합. Node 9/9, 오프라인 Chromium PASS 및 Windows 수동 PASS 사용자 보고.
- **22:** SPA/무한 스크롤 변경 감지 코드 병합. Node CLI 25/25, Chromium 오프라인 PASS, Windows 수동 PASS 사용자 보고(원본 로그·SHA 미제출).
- **23:** 엄격 VIDEO target Resolver frontend 병합, 사용자 보고 기준 Node 46/46·Windows 검증 통과 및 동일 테스트 SHA 확인.
- **24:** 채널 ID와 @handle 분리 코드 frontend 병합. 사용자 검증 PASS·테스트 SHA 일치 보고(독립 로그 미제출).
- **25:** Hover 상태 제어 frontend 병합; V8 118/118 PASS 및 사용자 Windows 검증 PASS·테스트 SHA/Clean Worktree 보고.
- **26:** 기존 Strict Thumbnail Hover는 Windows Node 144/144·Chromium·실 Search DOM·사용자 Chrome Home/Search PASS. 추가 승인된 Interactive Card(카드 위 고정·배경 영상 차단·160ms 짧은 간격 보호)는 **격리 V8 160/160 PASS**, 최신 Native Node/Chromium/실사이트 수동 재검증 PENDING. PR #13 Ready for review·미병합.
- **27~29:** 확장 메시지·Side Panel 분석 대상 고정·실사이트 최종 통합 E2E 미구현.
- **실제 YouTube API/외부 AI/구독 결제:** 구현하지 않음.
