# YUTOPIA Hover Interaction — 외부 벤치마킹 적용 기록 (2026-10-20)

> USER_APPROVED_DIRECTION / PR_13_DRAFT / P0_CODE_READY / MOCK_V8_204_PASS / NATIVE_CHROME_PENDING

이 문서는 외부 라이브러리에서 벤치마킹할 패턴과 YUTOPIA에서 실제 구현한 부분을 구분한다. 외부 코드나 패키지를 복사·설치하지 않았고, Figma 및 React·backend·실데이터 정책을 변경하지 않았다.

## 1. 해결하려는 문제

- 영상 A에 Hover → 카드 표시 → 완전 이탈 → 재진입 시 카드가 늦거나 간헐적으로 발생하지 않음.
- YouTube SPA/무한 스크롤이 포인터 아래 썸네일 DOM을 재생성하는 경우.
- A→B→A 전환에서 이전 요청/타이머가 최신 선택을 덮는 경우.
- 썸네일→카드의 이동 중 잠깐 포인터가 어느 쪽에도 없는 경우.
- 카드 숨김이 식별 실패인지 배치 실패인지 구분하기 어려운 경우.

최상위 인수 원칙: 정확한 대상, 예측 가능한 지연, 유한한 종료, 원래 YouTube 클릭·재생 보존.

## 2. 외부 벤치마킹 패턴

| 참조 | 참고할 설계 | 실제 적용 상태 |
|---|---|---|
| [Floating UI useHover / safePolygon](https://floating-ui.com/docs/useHover) | 카드 방향 이동 안전 경로 | 새 Pointer Tracker에 순수 safeTransitPoint 기하 함수와 테스트 작성. 실제 카드 생명주기에는 아직 연결하지 않음 |
| [Floating UI FloatingDelayGroup](https://floating-ui.com/docs/FloatingDelayGroup) | 연속 Hover에서 짧은 진입 지연 | 미적용. 첫 진입 160ms 시험값 유지 |
| [Base UI Preview Card](https://base-ui.com/react/components/preview-card) | 여러 Trigger가 하나의 카드 사용, 논리적 대상과 DOM 분리 | targetKey(type,id) 추가. 같은 VIDEO/CHANNEL ID의 hovered SPA 새 링크로 교체 시 READY와 requestId 유지 |
| [Radix UI Hover Card](https://www.radix-ui.com/primitives/docs/components/hover-card) | 열린 상태와 진입·이탈 타이머 분리 | Controller가 단일 타이머 관리. 160ms 진입, 200ms 이탈 유예 |
| [Tippy.js interactive](https://atomiks.github.io/tippyjs/v6/all-props/) | 카드로 이동 중 Pointer/Focus 점유 유지 | 순수 Presence Reducer로 4개 occupancy 필드 변경 경로 일원화 |
| [GitHub Hovercard](https://github.com/Justineo/github-hovercard) | Content Script·동적 페이지·대량 DOM 탐색 | 기존 Content Discovery와 재탐지 디바운스 유지 |
| [yt-hover](https://github.com/tophf/yt-hover) | 마우스 정지/미리보기 의도 파악 | 향후 UX 후보, 미구현 |

위 외부 시스템의 특정 수치·성능을 현행 YUTOPIA의 보증값으로 취급하지 않는다.

## 3. PR #13 적용 구조

~~~text
YouTube HOME / SEARCH
  content.js + VIDEO/CHANNEL Resolver
    → hover-pointer-tracker.js
       - composedPath / DOM ancestor / 렌더러 내부 좌표
       - 분리된 DOM anchor 거부
       - targetKey(VIDEO|CHANNEL, id)
       - safeTransitPoint() 순수 기하 계산
    → hover-presence-reducer.js
       - anchor pointer / focus
       - card pointer / focus
       - 불변 state + occupied / RESET
    → hover-controller.js
       - 유일한 활성 대상/요청·타이머 소유자
       - 160ms OPEN / 200ms CLOSE 유예
       - IDLE / HOVER_PENDING / READY / UNRESOLVED /
         LEAVE_PENDING / DISMISSED
       - 같은 논리 ID의 hovered 앵커 교체 시 requestId 유지
    → hover-card.js + hover-card-model.js
       - 탭당 단일 Shadow DOM 카드
       - STATIC_FIXTURE (실제 댓글/통계 사용 안 함)
~~~

### 핵심 계약

1. 논리 ID는 VIDEO:11자 ID 또는 CHANNEL:UC ID이며, 렌더러 DOM 요소는 교체 가능한 참조다. 불확실한 @handle은 ID로 승격하지 않는다.
2. Pointer Tracker는 유효한 물리적 히트 대상만 돌려주고, 상태/타이머/UI를 수정하지 않는다.
3. Presence Reducer는 anchor/card의 pointer/focus 네 Flag만 변경한다. Controller만 유일한 활성 대상·요청 번호·진입/종료 타이머·UI 구독 상태를 결정한다.
4. 이미 READY인 영상 A가 YouTube SPA에서 같은 ID의 hovered 새 앵커로 교체되면 Request ID와 Card Root를 유지하고 실제 anchor만 갱신한다. 다른 ID이거나 새 anchor가 Hover/Focus 상태가 아니라면 기존 타깃을 정리한다.
5. 명시적 닫기·ESC 후 같은 위치에서 마우스를 조금 움직인 것만으로 재오픈하지 않되, 물리적 이탈 후 재진입은 허용한다.
6. 광고·Shorts·WATCH 화면·미확정 ID에는 합성 지표를 표시하지 않는다. 디버그 데이터나 포인터 좌표를 저장·전송하지 않는다.
7. 앱 외부 패키지 추가, API 호출, 실제 댓글/시청기록 수집, Chrome 권한 확대 없음.

## 4. 현재 검증 수준

| 범위 | V8 모의 테스트 |
|---|---:|
| 21~24 DOM 탐지 / 식별 | 78 PASS |
| 25 Hover Controller | 63 PASS |
| 26 Hover Card UI | 35 PASS |
| 신규 Pointer Tracker / Presence Reducer | 28 PASS |
| **합계** | **204/204 PASS** |

검증 방식은 GitHub 브랜치 소스의 JS 구문 및 Node/DOM/URL 모의 V8 실행이다. Native Node CLI 또는 실제 Chromium 브라우저 테스트가 아니다. 이전 버전의 Windows Native Node 152/152와 Chromium Fixture PASS는 이전 SHA의 증거이며, 최신 204건 실행을 대체하지 않는다.

### 최신 브랜치 인수 Gate

- Windows Node CLI: 7개 .test.cjs 파일 모두 통과, 204 tests / 204 pass / 0 fail.
- Chromium 오프라인: CHROMIUM_HOVER_CARD_FIXTURE_PASS. A→B 전환, 같은 A 반복 이탈/재진입, 닫기 버튼, @handle, DOM 앵커 교체 확인.
- 실제 YouTube Chrome: 같은 A 진입·완전 이탈·재진입 10회(누락 0), A→B→A, 카드 안 포인터 이동·키보드 Focus, 다크/라이트, 좁은 화면, 스크롤, 재생과 기본 클릭 간섭 확인.
- 불확실한 결과, 인접 영상의 클릭 차단, 카드 재열림/타이머 누수, 이벤트 리스너 중복 발견 시 FAIL로 기록.
- 독립 코드 리뷰·Figma 시각 정합성·실데이터 정책·실서비스 배포는 별도 Gate.

## 5. 의도적으로 보류한 P1 개선

- safeTransitPoint 함수를 실제 종료 유예에 연결하는 것은 보류. 사용 시 상한이 있는 타이머로 카드가 무한정 남지 않게 해야 한다.
- FloatingDelayGroup 기반 연속 탐색 속도 단축(처음 160ms, 이후 0~60ms 후보)은 아직 사용자 Chrome 수용 전이므로 미적용.
- 카드가 버튼을 포함한다는 이유로 Tooltip이 아니라 비모달 Dialog 접근성 계약을 검토할 필요가 있지만 이번 코드 수정 범위에는 포함하지 않는다.
- 외부 라이브러리의 실제 번들 도입은 MV3 호환성·라이선스·권한·성능 점검이 선행되어야 한다.

**현재 상태:** PR #13 OPEN/DRAFT/미병합. frontend·main·dev·backend·Figma 미변경.
