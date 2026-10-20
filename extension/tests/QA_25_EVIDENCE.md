# YUTOPIA 25번 — Hover 상태·경합·이탈 유예 검증 기록

> **2026-10-20 / HOVER_CONTROLLER_CODE_READY / ISOLATED_V8_118_OF_118_PASS / NATIVE_NODE_AND_CHROME_NOT_VERIFIED**

이 검증은 **Content Script 상태 제어**에 관한 것이다. 실제 Hover 카드 렌더링(26), 더보기 패널 메시지(27~28), 실제 YouTube 데이터 수집 또는 공개 배포 증거가 아니다.

## 1. 구현 경계

- **기반:** 24번 PR #11이 frontend에 병합된 커밋 97611f144c8ae074d2e7f5b5f75031ef03d840c6.
- **신규:** extension/hover-controller.js; Content Script 로드 순서에서 content.js 뒤에 위치한다.
- **연결:** 22번 VIDEO subscribe, 24번 CHANNEL subscribeChannels 구독. discovery의 added/removed/updated가 제공하는 기존 anchor를 재사용한다.
- **상태:** IDLE → HOVER_PENDING(400ms) → READY(정규 targetId 있음) 또는 UNRESOLVED(@handle만 있음). READY는 실제 카드 VISIBLE을 뜻하지 않는다.
- **이탈:** pointerleave/focusout 후 타겟이 확인된 경우 LEAVE_PENDING(200ms) → IDLE. 표시 전 이탈 시 즉시 취소한다.
- **Overlay 이동:** 미래 26번 UI가 overlayPointerEnter/Leave, overlayFocusIn/Out 호출 시 유예를 취소하고 READY를 유지하도록 API만 제공한다. 아직 카드 DOM 없음.
- **단일 활성 대상:** VIDEO·CHANNEL 링크를 함께 관리하며 마지막으로 진입한 대상만 상태를 소유한다.
- **늦은 응답:** 요청마다 증가하는 requestId와 isCurrentRequest({requestId,targetType,targetId})를 제공하고, 현재 READY에서 정확히 일치할 때만 후속 응답 적용을 허용한다. 실제 네트워크 요청은 하지 않는다.
- **미해결 핸들:** HANDLE_UNRESOLVED는 targetId:null이며 상세 패널 대상으로 사용하지 않는다.
- **키보드:** 기존 YouTube 키 입력을 가로채지 않으며 focusin/out, Escape 취소, document.hidden, pagehide 해제를 처리한다.
- **정리:** DOM anchor 교체/삭제, SPA 라우트 이동, 재주입, dispose에서 타이머·구독·리스너 참조를 정리한다.
- **안전:** 실제 YouTube DOM 내용 변경/덮는 오버레이/이벤트 차단, 댓글·시청 이력 수집, 외부 API/LLM 호출, Chrome Side Panel 자동 열기는 없다.

## 2. 수행한 검증 — 범위를 엄격히 구분

| 범위 | 시험 수 | 결과 | 제한 |
|---|---:|---|---|
| 21 DOM 후보 탐지 | 9 | PASS | 격리 V8 Mock URL/DOM/Node VM |
| 22 SPA·무한 스크롤 | 16 | PASS | 동일 V8 모의 환경 |
| 23 VIDEO ID | 21 | PASS | 동일 V8 모의 환경 |
| 24 CHANNEL ID·@handle | 32 | PASS | 동일 V8 모의 환경 |
| 25 Hover 제어 | 40 | PASS | 가상 시계/요소 이벤트로 경합·취소·접근성 테스트 |
| **총합** | **118** | **118/118 PASS** | **Native Node CLI 또는 Chrome 확장 실행 아님** |
| JS 구문 검사 | hover-controller.js / 테스트 파일 | PASS | 격리 V8 파서 |
| Node.js CLI | node --test | **NOT RUN** | 재검증 필요 |
| Chrome 실제 확장/YouTube | Content Script 격리 세계와 실브라우저 포인터/포커스 | **NOT VERIFIED** | Windows QA 필요 |
| Chromium 오프라인 DOM | Playwright Fixture | **NOT RUN** | 선택 시험 필요 |
| GitHub CI·독립 리뷰 | PR 연결 | **NOT VERIFIED** | 병합 판단 전 확인 |

기존 테스트 78건의 통과는 변경되지 않은 Resolver/Discovery 코드를 포함해 새 브랜치의 전체 파일을 읽어 모의 실행한 결과이다. 신규 40건은 Hover 입장·400ms/200ms 타이밍, 짧은 Hover 취소, A→B→C·VIDEO→CHANNEL 경합, 포커스/overlay 이동, Escape·탭 숨김, 앵커 갱신/삭제, @handle 유보, stale 타이머, 상태 구독 예외, 재주입/해제를 검사한다.

## 3. Native Node 재실행 지침 (저장소 루트)

~~~sh
node --check extension/hover-controller.js
node --check extension/content.js
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs extension/tests/hover-controller.test.cjs
~~~

정상 기대 결과: 118건 PASS / FAIL 0. 현재 기록은 기대 결과와 격리 V8 실행만 의미하며, 실제 Node CLI에서 118건을 실행했다고 주장하지 않는다.

## 4. Windows Chrome 수동 QA (현재 미실행)

1. 기존 로컬 frontend와 다른 별도 작업 폴더에서 feature/yutopia-25-hover-controller 브랜치를 clone하고 git rev-parse HEAD 및 git status --short 기록.
2. Chrome chrome://extensions에서 이전 QA 빌드를 잠시 비활성화한 후 이 브랜치의 extension/을 로드한다. 브라우저 새로고침.
3. Manifest Content Script 목록 마지막이 hover-controller.js이고 그 앞이 content.js인지 확인.
4. YouTube 홈의 DevTools Content Script 격리 컨텍스트에서 다음을 실행.

~~~js
globalThis.YUTOPIA_HOVER_CONTROLLER?.getRuntimeStatus();
globalThis.YUTOPIA_HOVER_CONTROLLER?.subscribe(s => {
  console.log("YU25", s.phase, s.targetType, s.targetId, s.requestId);
});
~~~

5. VIDEO 썸네일 위에서 약 100ms만 Hover 후 떠나면 READY가 발생하지 않는지 확인.
6. 동일 영상 위 약 400ms 유지하면 READY로 전이하는지 확인. 실제 카드 UI는 아직 표시되지 않는 것이 정상.
7. 홈의 영상 A→B→C 사이를 빠르게 이동했을 때 마지막 C만 READY가 되는지 확인.
8. 채널 ID 링크를 Hover하면 CHANNEL 대상으로 전환하고, @handle만 있으면 UNRESOLVED/targetId:null인지 확인한다.
9. 포인터 이탈 후 200ms 안에 재진입하면 READY가 유지되고, 유예를 넘기면 IDLE로 바뀌는지 확인. overlay 이동은 현재 카드가 없어 API 시뮬레이션으로만 확인 가능.
10. 키보드로 링크 포커스 → READY, Escape → DISMISSED, 무한 스크롤·검색/영상 재생 SPA 전환 시 오래된 대상 해제 확인.
11. 기존 YouTube 썸네일 프리뷰·클릭·검색·메뉴·스크롤, Service Worker와 Side Panel을 방해하지 않는지 확인.
12. 테스트 SHA·Node 출력·Chrome 버전·콘솔 출력·에러 정보를 첨부. 실제 화면에서 Hover 카드가 보이지 않는다고 이 25번 상태 제어가 실패한 것은 아니다.

## 5. 판정 / 후속 Gate

- 25 상태 제어 코드: READY_FOR_REVIEW / ISOLATED_V8_TESTED.
- 25 Native Node / Windows Chrome: PENDING / NOT_VERIFIED.
- 26 Hover 카드 UI: NOT_IMPLEMENTED.
- 27 메시지 및 28 더보기 Side Panel 대상 고정: NOT_IMPLEMENTED.
- 제품 출시·YouTube API/파생 감성/결제: NOT_AUTHORIZED.
- frontend 병합은 실제 테스트 커밋 및 리뷰·사용자 승인 후 별도 판단.
