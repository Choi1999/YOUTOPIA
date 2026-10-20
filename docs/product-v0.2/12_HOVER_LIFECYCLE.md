# 12 — Hover 열림·유지·닫힘·경합 방지 상태 계약

> **INTERACTION_DRAFT / YU26_MOCK_CARD_IMPLEMENTED / BENCHMARK_P0_CODE_READY / LIVE_CHROME_QA_PENDING**
>
> **목적:** 사용자가 데스크톱 YouTube 홈에서 여러 영상 사이를 빠르게 움직여도 팝업이 과도하게 열리거나 깜빡이지 않도록 하고, 항상 **마지막으로 명확히 선택된 영상**의 내용만 보여주게 합니다.

[10 기준 화면](./10_YOUTUBE_HOME_HOVER_LAYOUT.md) · [11 카드 정보](./11_HOVER_CARD_INFORMATION.md) · [17 더보기 대상 고정(예정)](./04_EXECUTION_00_99.md)

## 1. 상태 이름 (구현 시 바뀔 수 있음)

| 상태 | 쉬운 뜻 | UI |
|---|---|---|
| `IDLE` | 아무 썸네일에도 마우스가 없음 | 카드 없음 |
| `HOVER_PENDING` | 포인터가 올라왔고 짧은 지연을 기다림 | 카드 없음 또는 표시 준비 |
| `TARGET_RESOLVING` | 대상 영상/채널 ID 확인 중 | 표시 여부 판단 |
| `LOADING` | 허용된 캐시 요약을 확인 중 | 로딩 카드 |
| `VISIBLE` | 대상과 요약이 정상적으로 일치 | 분석 카드 |
| `LEAVE_PENDING` | 포인터가 잠깐 벗어남 | 카드 유지 유예 |
| `DISMISSED` | 닫기/Escape 또는 새 대상으로 전환 | 이전 카드 제거 |
| `ERROR` | 데이터·카드 표시 불가능 | 필요한 경우 간단 안내 |

**구현 지침:** 위 상태는 UI 동작의 내부 상태이며 고객에게 그대로 표시하지 않음.

## 2. 전이 흐름

```text
IDLE
  ├─ 영상 A pointerenter → HOVER_PENDING
  │     ├─ 즉시 떠남 → IDLE (분석 요청 만들지 않음)
  │     └─ 지연 통과 → TARGET_RESOLVING
  │            ├─ ID 불명 → IDLE / 조용한 안내
  │            └─ ID 확인 → LOADING → VISIBLE
  │                                 │
  │                                 ├─ 카드 내 포인터 이동 → VISIBLE 유지
  │                                 ├─ 썸네일·카드에서 벗어남 → LEAVE_PENDING → IDLE
  │                                 ├─ Escape → DISMISSED
  │                                 └─ [더보기] 클릭 → Side Panel 열기
  └─ 영상 B pointerenter → A timer/request 정리 후 B 대상만 표시
```

- **초기 Hover 지연:** 25번 최초 후보는 `400ms`였으나 실제 Chrome 사용자 피드백에서 지연이 길다고 보고돼 26번 브랜치는 **`160ms` 시험값**으로 변경했다. **확정된 성능 목표가 아님**.
- **카드 이동/퇴장 유예:** 약 `150~250ms` 후보. 카드↔썸네일 사이 이동 시 깜빡임이 없는지 우선 검증.
- **다른 썸네일 진입:** A/이전 대상의 미리보기 타이머·작업을 취소하거나 응답 적용을 거부.
- **Side Panel:** Hover 닫기와 무관하게, 마지막으로 더보기를 클릭한 대상은 별도로 유지.

## 3. 대상 혼합과 늦은 응답 차단

- 각 활성 카드가 `targetType` + `targetId` + `requestId`를 가진다.
- 새로운 활성 대상이 생길 때 `requestId` 또는 증가하는 시퀀스 번호를 교체.
- 늦은 분석 응답의 `targetId`·시퀀스가 현재 값과 다르면 **그 응답을 버림**.
- 분석이 없는 영상에 이전 성공 영상의 수치를 잔상으로 유지하지 않음.
- 유튜브 화면의 무한 스크롤·SPA 이동으로 썸네일 DOM이 제거되면 카드 앵커/리스너를 정리.

## 4. YouTube 자체 UI와 공존

- 썸네일의 실제 영상 클릭·YouTube 프리뷰 재생을 막기 위해 링크를 덮는 투명 전체 오버레이를 만들지 않음.
- 카드가 YouTube 컨텍스트 메뉴/세 점 메뉴/광고/플레이어 제어를 가리는지 수동 확인.
- Card root는 한 개로 관리하고, 화면 요소가 재생성돼도 이벤트 핸들러가 중복 등록되지 않도록 함.
- `focusin`/키보드로 접근할 수 있는 명시적인 진입 경로를 설계(포인터 전용 금지).

## 4.1 25번 Controller와 26번 UI 상태의 구분

25번 브랜치에는 실제 Hover 카드 없이 단일 Hover Controller가 추가됐다.

- 포인터/포커스 진입 → HOVER_PENDING(26번 브랜치 `160ms` 후보) → READY(정규 VIDEO/CHANNEL targetId 확보), 또는 UNRESOLVED(@handle만 있어 targetId 없음).
- READY는 26번 UI가 LOADING/VISIBLE로 전환할 수 있는 **준비 상태**이지 실제 카드가 표시됐다는 뜻이 아니다.
- 정상 타깃에서 pointerleave/focusout → LEAVE_PENDING(200ms 후보) → IDLE. Overlay 이동용 API는 있으나 Overlay DOM은 26번 범위.
- targetType + targetId + 증가하는 requestId를 검사하는 isCurrentRequest()를 제공한다. 실제 비동기 응답·패널은 이번 범위에 포함하지 않는다.
- 무한 스크롤·SPA 앵커 변경, Escape·문서 숨김·pagehide 시 정리, 키보드 focusin/out 및 기존 YouTube 클릭 동작 보존을 처리한다.
- 신규 40건 + 기존 회귀 78건 = **격리 V8 118/118 PASS**. Native Node CLI 및 Windows Chrome 신규 테스트는 대기 중.
- **26번 시각 카드·27번 메시지·28번 더보기 Side Panel 대상 고정은 미구현**.

증거: [25번 QA 기록](../../extension/tests/QA_25_EVIDENCE.md).

## 4.2 실제 Chrome에서 제기된 간헐적 누락 대응 (26번)

- YouTube SPA가 이미 포인터 아래 있던 anchor를 교체하면 그 새 요소에서 `pointerenter` 이벤트가 발생하지 않을 수 있다. 신규 바인딩 시 `:hover` 상태를 재확인하고, `document.pointermove`에서 현재 바인딩된 anchor를 재확인해 복구한다.
- 사용자의 ESC·닫기 후 같은 썸네일 안에 포인터가 남은 경우 자동 재열림을 방지한다. 실제 링크의 pointerleave 또는 캡처 pointerout으로 물리적 이탈을 확인하면 억제 상태를 해제하고, 카드 내부 닫기 버튼 클릭은 원래 링크 재진입을 차단하지 않는다.
- 터치 Pointer 이벤트는 Hover 복구에서 제외한다. 마우스 좌표·브라우징 내용·시청 기록은 저장 또는 전송하지 않는다.
- `document.pointerover/move/out`을 통해 YouTube가 개별 `pointerleave`나 `pointerenter`를 누락해도 포인터가 썸네일 밖으로 나갔는지 재판정한다. 같은 영상 A가 IDLE로 종료된 뒤 돌아오면 새 160ms 대기를 시작하며, **200ms 이탈 유예 중 돌아온 경우에는 native pointerenter가 누락돼도 문서 pointerover로 종료 타이머를 취소하고 기존 READY 상태를 복원**한다. 이를 단위/Chromium 검증 항목에 추가했다.
- 인접 영상 링크를 가리지 않는 카드 위치를 못 찾으면 `NO_SAFE_HOVER_PLACEMENT`로 닫는다. 광고·Shorts·잘못된 영상 ID도 원래 카드 표시 대상이 아니다.
- 26번 진입 지연·DOM 복구 검증은 별도의 Node/Chromium/실사이트 게이트를 가진다. 기존 25번 PR #12 병합 코드와 최신 26번 브랜치 상태를 혼동하지 않는다.

검증 근거: [26번 QA 기록](../../extension/tests/QA_26_EVIDENCE.md).

## 4.3 외부 Hover 벤치마킹 승인 후 P0 분리 구조

- Pointer Tracker(hover-pointer-tracker.js): composedPath/DOM 상위요소 및 YouTube 렌더러 내부 boundingRect로 물리적 포인터 대상 판정. 카드/타이머에는 접근하지 않는다.
- Presence Reducer(hover-presence-reducer.js): 썸네일·카드의 pointer/focus occupancy 4개를 불변 상태로 변경. Hover Controller가 선택 ID·160ms 진입/200ms 종료 유예·requestId·Phase를 유일하게 소유한다.
- 동일 VIDEO/CHANNEL ID의 hovered 새 SPA 앵커 교체는 기존 READY 및 requestId를 보존하면서 anchor만 교체한다. 다른 ID 또는 Hover/Focus 미확인 새 앵커는 정리/재식별한다.
- safeTransitPoint 순수 경로 기하 함수는 구현했지만 실제 종료 타이머 연장에는 연결하지 않았다. FloatingDelayGroup 연속 Hover 가속 또한 P1 실브라우저 검수 후 판단한다.
- 현재 기존 DOM·Resolver 78건 + Controller 63건 + Card UI 35건 + Tracker/Reducer 28건 = **V8 모의 204/204 PASS**. 최신 Native Node/Chromium/실 YouTube Chrome 검증은 대기 중.
- 근거: [벤치마킹 적용 상세](./HOVER_INTERACTION_BENCHMARK_20261020.md).

## 5. 수용 테스트

- [ ] 영상 A 위에서 100ms만 머문 경우 카드가 무분별하게 나타나지 않음.
- [ ] A를 160ms 안팎으로 Hover하면 A 카드가 표시되는지 검증(실측 렌더링 지연은 별도).
- [ ] A 카드 위로 포인터를 옮기고 **더보기**를 누를 수 있음.
- [ ] A→B→C를 빠르게 움직이면 A/B 응답이 C를 덮어쓰지 않음.
- [ ] 화면의 A 요소가 무한 스크롤로 제거되면 카드/리스너 정리.
- [ ] F12처럼 열린 Chrome Side Panel 대상은 이후 Hover에 자동으로 따라가지 않음.
- [ ] Esc·Tab 등 키보드 조작으로 카드의 정보/닫기에 접근.
- [ ] 브라우저 CPU/메모리 사용이 누적되어 지속 악화되지 않음.

**테스트 상태:** 25번 상태 제어는 격리 V8 모의 테스트 통과. 실제 Chrome Hover 카드 표시·더보기/Side Panel은 **NOT TESTED / NOT IMPLEMENTED**.
