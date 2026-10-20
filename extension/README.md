# YUTOPIA Chrome 확장 — 로컬 DEMO / 개발자 전용

> **EXPERIMENTAL · 실제 YouTube 댓글/API/AI/결제/로그인 없음 · Chrome MV3**

이 폴더는 YUTOPIA **YouTube 홈에서 썸네일 Hover → 간략 반응 카드 → 더보기 → Chrome Side Panel**을 구현하기 위한 독립 PoC 영역입니다.

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
- 기존 VIDEO/CHANNEL 탐지 스트림을 사용합니다. 단일 활성 Hover를 보장합니다. 기존 25번의 400ms 진입 지연은 사용자 26번 실환경 피드백에 따라 **26번 브랜치에서 160ms로 단축**했으며, 이탈 유예 200ms는 유지합니다. 확정된 UX 목표가 아닌 시험값입니다.
- A→B→C 빠른 이동과 DOM 요소 교체 시 이전 타이머 및 requestId를 무효화합니다. READY는 실제 카드가 화면에 표시된 것이 아니라 26번 UI가 표시할 수 있는 준비 상태입니다.
- 영상/채널 ID가 검증되지 않으면 상세 대상을 제공하지 않습니다. @handle만 확인된 경우 UNRESOLVED/targetId:null로 유지합니다.
- overlayPointerEnter/Leave 및 overlayFocusIn/Out을 제공하며, 26번 개발 브랜치의 Shadow DOM 카드가 이 API를 이용해 포인터/키보드 이동 중 상태를 유지합니다.
- 키보드 focusin/out, Escape·탭 숨김, 링크 삭제·SPA 이동, dispose(), 중복 주입을 처리하며 YouTube 클릭·재생을 차단하지 않습니다.
- 신규 테스트: node --test extension/tests/hover-controller.test.cjs (40건). 전체 회귀: [25번 QA 기록](tests/QA_25_EVIDENCE.md)에 명시된 다섯 테스트 파일을 Node.js --test에 명시적으로 전달(118건).
- 선택 오프라인 Chromium Fixture: python extension/tests/chromium-hover-fixture.py (작성만 완료, 실행 미확인). [25번 QA 기록](tests/QA_25_EVIDENCE.md).
- **25번 격리 V8 모의 118/118 PASS**, Windows 수동 QA 통과 및 테스트 SHA·Clean Worktree는 사용자 보고로 확인했습니다(원본 Node/Chrome 실행 로그는 별도 미제출). [PR #12](https://github.com/Choi1999/YOUTOPIA/pull/12)는 frontend에 병합됐습니다.

## 26번 실제 Hover 카드 UI (합성 데이터 전용 · Chrome 검수 전)

- 25번 Hover의 READY 상태에서만 정규 VIDEO/CHANNEL ID를 사용해 **단일 Shadow DOM 카드**를 실제로 화면에 표시합니다. `@handle`만 있는 경우 채널 ID 미확정 안내만 제공하며 감성 차트·더보기는 표시하지 않습니다.
- 가상 감성 막대(긍정/중립/부정), 가상 표본과 기간, 2개 가상 논점, 짧은 브리핑과 명확한 **DEMO · STATIC FIXTURE · 실제 분석 아님** 안내를 제공합니다. 실제 YouTube 제목, 댓글, 사용자 데이터나 API는 읽지 않습니다.
- 앵커 기준 우측/좌측 자동 배치, 좁은 창·세로 화면 클램프, 다크 테마, 카드로 마우스·키보드 이동, 닫기/Escape, SPA·스크롤 이후 대상 정리를 지원합니다.
- **더보기 버튼은 현재 연결 예정 안내만 표시합니다.** Side Panel 대상 전달, 캐시/서비스 워커 메시지, 실제 감성 데이터는 27·28번 이후 별도 작업입니다.
- Manifest 스크립트 순서: shared.js → target-resolver.js → channel-target-resolver.js → content.js → hover-controller.js → hover-card-model.js → hover-card.js.
- 신규 카드 UI 테스트: `node --test extension/tests/hover-card-ui.test.cjs` (35건). 25번 Hover 컨트롤러 회귀는 60건으로 확대했습니다. 전체 6개 테스트 파일은 [26번 QA 기록](tests/QA_26_EVIDENCE.md)의 명시 명령을 사용하세요(173건).
- 선택 오프라인 Chromium: `python extension/tests/chromium-hover-card-fixture.py` (실행 미확인). **현재 격리 V8 173/173 PASS**입니다. 이전 HEAD에서 Windows Native Node CLI 152/152 PASS와 Chromium 오프라인 Fixture PASS를 사용자 로그로 확인했습니다. 실제 YouTube Chrome에서 동일 영상 이탈→재진입 시 누락·지연이 재보고되어 문서 pointerover/pointerout 경계·suppression 해제·Overlay 좌표 복구를 보강했습니다. 최신 173건 Node CLI·수정된 Chromium Fixture·실제 Chrome 재검증은 대기 중입니다.

### 간헐적으로 카드가 나타나지 않을 때

- 실제 Youtube에서 광고·Shorts·WATCH 페이지는 식별 대상에서 제외되며, 영상 ID가 불명확하면 카드를 표시하지 않습니다.
- Chrome DevTools **YUTOPIA Content Script** 컨텍스트에서 두 상태를 함께 확인합니다.

~~~js
globalThis.YUTOPIA_HOVER_CONTROLLER?.getRuntimeStatus()
globalThis.YUTOPIA_HOVER_CARD?.getRuntimeStatus()
~~~

- Controller의 `lastReason`, `pointerInside`, `overlayPointerInside`, `suppressedAnchorActive`, `hoveredBoundAnchors`, `pointerRecoveries`, `activationDelayMs`와 Card의 `lastHoverReason`을 확인합니다. 같은 영상 복귀가 늦는다면 이탈 후 suppressed 상태가 해제되는지 검증합니다. `NO_SAFE_HOVER_PLACEMENT`는 인접 썸네일 차단을 방지하기 위한 숨김입니다.
- 위 도구는 현재 탭 메모리만 읽으며 결과를 전송하지 않습니다. 자세한 기록·실브라우저 검증 방법은 [26번 QA 지침](tests/QA_26_EVIDENCE.md)을 참고하세요.

## 현재 단계

- **20:** Chrome MV3 기본 뼈대 및 문서.
- **21:** 영상 후보 탐지 코드 병합. Node 9/9, 오프라인 Chromium PASS 및 Windows 수동 PASS 사용자 보고.
- **22:** SPA/무한 스크롤 변경 감지 코드 병합. Node CLI 25/25, Chromium 오프라인 PASS, Windows 수동 PASS 사용자 보고(원본 로그·SHA 미제출).
- **23:** 엄격 VIDEO target Resolver frontend 병합, 사용자 보고 기준 Node 46/46·Windows 검증 통과 및 동일 테스트 SHA 확인.
- **24:** 채널 ID와 @handle 분리 코드 frontend 병합. 사용자 검증 PASS·테스트 SHA 일치 보고(독립 로그 미제출).
- **25:** Hover 상태 제어 frontend 병합; V8 118/118 PASS 및 사용자 Windows 검증 PASS·테스트 SHA/Clean Worktree 보고.
- **26:** Shadow DOM 합성 카드 UI 구현 및 실제 Chrome 간헐적 Hover 누락 대응. V8 모의 전체 173/173 PASS, 이전 HEAD에서 Windows Node 152/152·Chromium 오프라인 PASS. 최신 173건·실사이트 Chrome 재검증 대기.
- **27~29:** 확장 메시지·Side Panel 분석 대상 고정·실사이트 최종 통합 E2E 미구현.
- **실제 YouTube API/외부 AI/구독 결제:** 구현하지 않음.
