# 12 — Strict Thumbnail Hover 상태 계약

> **STRICT_THUMBNAIL / YU26_MOCK_CARD_READ_ONLY / PR13_DRAFT**

[10 기준 화면](./10_YOUTUBE_HOME_HOVER_LAYOUT.md) · [11 카드 정보](./11_HOVER_CARD_INFORMATION.md) · [26번 QA](../../extension/tests/QA_26_EVIDENCE.md)

## 사용자 계약

- 확인된 영상 썸네일 안에 마우스 포인터가 있으면 카드를 즉시 표시한다.
- 포인터가 썸네일 밖으로 나가면 카드를 즉시 제거한다.
- 같은 A를 완전히 나갔다 다시 들어오거나 A→B→C로 옮길 때마다 현재 썸네일의 카드만 표시한다.
- 의도적인 진입 지연과 이탈 유예는 모두 0ms다. 브라우저의 한 프레임 렌더 시간까지 0ms라는 뜻은 아니다.
- 터치 포인터, 광고, Shorts, 지원하지 않는 페이지, 검증되지 않은 영상 ID는 카드 대상이 아니다.
- 카드 값은 항상 `DEMO · STATIC FIXTURE`이며 실제 본문·제목·댓글·통계·감성 값을 읽거나 분석하지 않는다.

## 상태와 전이

```text
IDLE
  ├─ 확인된 썸네일 A pointerover/move ──> READY(A) ──> 카드 A 표시
  │                                          ├─ 썸네일 B ──> READY(B)
  │                                          └─ 썸네일 밖 ──> IDLE
  ├─ @handle 채널 링크 ─────────────────> UNRESOLVED
  └─ 키보드 focusin ────────────────────> READY / UNRESOLVED

READY / UNRESOLVED
  ├─ Escape·문서 숨김 ──────────────────> DISMISSED
  ├─ anchor 제거, 새 anchor가 hover 아님 ─> IDLE
  └─ 같은 stable target의 hovered anchor 교체 ─> 현재 requestId 유지
```

현재 런타임 상태는 `IDLE`, `READY`, `UNRESOLVED`, `DISMISSED`만 사용한다. 과거 프로토타입의 `HOVER_PENDING`, `LEAVE_PENDING`, overlay occupancy, `suppressedAnchor`, safe corridor는 사용하지 않는다.

## 단일 포인터 대상과 이벤트 위임

- `document`의 capture `pointerover`, `pointermove`, `pointerout` 한 세트만 사용한다. 썸네일마다 리스너를 추가하지 않는다.
- Discovery가 제공한 anchor→식별 대상 Map에서 현재 이벤트 경로와 일치하는 binding 하나만 활성 상태로 둔다.
- YouTube 애니메이션 미리보기가 anchor 위의 형제 노드가 되는 경우에는 동일 renderer 안에서 이미 식별된 anchor의 사각형만 좌표 복구에 사용한다. 좌표로 영상 ID를 추측하지 않는다.
- `pointermove`는 YouTube DOM 교체로 `pointerover`가 빠진 경우와 `pointerout`이 누락된 경우를 복구한다.
- `targetKey`는 확인된 대상에 한해 `VIDEO:<videoId>` 또는 `CHANNEL:<channelId>`다. 같은 논리 대상의 hovered anchor 교체는 key와 requestId를 보존하고, 다른 ID로 교체되면 새 requestId를 발행한다.
- 열기/닫기 타이머가 없으므로 취소 순서, 오래된 타이머 callback, leave grace 경합이 없다.

## 카드로 포인터를 옮기는 경우

사용자의 최우선 계약은 “썸네일에서 벗어나면 카드가 사라짐”이다. 따라서 썸네일→카드 이동을 예외로 두지 않는다.

- 카드와 Shadow Host는 `pointer-events:none`인 읽기 전용 미리보기다.
- 더보기와 닫기 마크업은 후속 UI 자리 확인용이며 현재 `disabled`다.
- 카드로 포인터를 옮기는 순간 썸네일을 벗어나므로 카드가 제거된다.
- 더보기/닫기를 실제 클릭 가능하게 만들려면 Hover 카드와 별개의 고정 진입점 또는 명시 클릭 상태가 필요하다. 이는 27~28번 Side Panel 작업에서 다룬다.
- Escape는 사이트 기본 키 처리를 막지 않고 현재 미리보기만 닫는다. 포인터가 계속 썸네일 위에서 움직이면 계약에 따라 다시 표시된다.

## DOM churn과 배치

- Content Discovery는 같은 DOM anchor의 href/ID 갱신과 anchor 제거·추가를 알린다.
- 활성 anchor가 교체될 때 새 anchor가 `:hover`이고 stable target key가 같으면 카드와 requestId를 유지한다.
- 새 anchor가 hover가 아니거나 대상 ID가 바뀌면 이전 대상은 유지하지 않는다.
- 카드 배치는 우측→좌측→아래→위→viewport fallback 순서다. 카드가 입력을 가로채지 않으므로 다른 썸네일과의 시각적 겹침은 Hover 종료 원인이 아니다.
- Controller 종료 이유(`THUMBNAIL_LEAVE`, `ANCHOR_REMOVED` 등)와 renderer 결과(`VISIBLE`, `ANCHOR_NOT_VISIBLE`, `ANCHOR_DETACHED`)를 별도 상태로 기록한다. 배치 실패가 Controller를 `DISMISSED`로 바꾸지 않는다.

## 수용 기준

- [ ] 같은 A 완전 이탈·재진입 10~30회에서 표시/제거 누락 0회.
- [ ] A→B→C→A 10~30회에서 현재 target 불일치와 stale 카드 0회.
- [ ] DOM이 같은 target의 anchor를 교체해도 포인터 아래라면 카드 유지.
- [ ] 다른 target 또는 포인터 밖 anchor 교체 시 이전 카드 즉시 제거.
- [ ] 카드가 다른 썸네일 위에 그려져도 해당 썸네일 Hover·클릭을 가로채지 않음.
- [ ] 카드 placement 종료 이유와 Hover Controller 종료 이유가 섞이지 않음.
- [ ] 실제 YouTube 홈/검색 DOM 검증은 요소 경계와 상태만 검사하고 본문·제목·URL·댓글 값을 수집·출력하지 않음.

과거 160ms/200ms 설계와 Pointer Tracker/Presence Reducer 벤치마크는 [HOVER_INTERACTION_BENCHMARK_20261020.md](./HOVER_INTERACTION_BENCHMARK_20261020.md)에 역사적 기록으로만 남긴다. 현재 런타임과 Manifest에는 포함하지 않는다.
