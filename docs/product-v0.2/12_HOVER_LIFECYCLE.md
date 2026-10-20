# 12 — Thumbnail + Interactive Hover Card 상태 계약

> **INTERACTIVE_CARD_PINNING / OPEN_0MS / GENERIC_LEAVE_0MS / SAFE_TRANSIT_160MS / PR13_DRAFT**

[10 기준 화면](./10_YOUTUBE_HOME_HOVER_LAYOUT.md) · [11 카드 정보](./11_HOVER_CARD_INFORMATION.md) · [26번 QA](../../extension/tests/QA_26_EVIDENCE.md)

## 사용자 계약

- 확인된 영상 썸네일 안에 마우스 포인터가 있으면 카드를 즉시 표시한다.
- 원본 썸네일 또는 현재 카드 내부에 포인터가 있으면 카드를 유지한다. 둘 다 벗어나고 카드 쪽 짧은 안전 이동 간격도 아니면 즉시 제거한다.
- 같은 A를 완전히 나갔다 다시 들어오거나 A→B→C로 옮길 때마다 현재 썸네일의 카드만 표시한다.
- 일반적인 진입 지연과 이탈 유예는 모두 0ms다. **썸네일↔해당 카드 사이 64px 이내의 유효한 기하학적 간격만 최대 160ms 보호**한다. pointermove 반복으로 기한을 늘리지 않는다.
- 터치 포인터, 광고, Shorts, 지원하지 않는 페이지, 검증되지 않은 영상 ID는 카드 대상이 아니다.
- 카드 값은 항상 `DEMO · STATIC FIXTURE`이며 실제 본문·제목·댓글·통계·감성 값을 읽거나 분석하지 않는다.

## 상태와 전이

```text
IDLE
  ├─ 확인된 썸네일 A pointerover/move ──> READY(A) ──> 카드 A 표시
  │                                          ├─ 썸네일 B ──> READY(B)
  │                                          ├─ 원본 카드 안 ──> READY(A) 유지
  │                                          ├─ 카드 이동 안전 간격 ──> 160ms 한정 보호
  │                                          └─ 썸네일·카드·안전 간격 밖 ──> IDLE
  ├─ @handle 채널 링크 ─────────────────> UNRESOLVED
  └─ 키보드 focusin ────────────────────> READY / UNRESOLVED

READY / UNRESOLVED
  ├─ Escape·문서 숨김 ──────────────────> DISMISSED
  ├─ anchor 제거, 새 anchor가 hover 아님 ─> IDLE
  └─ 같은 stable target의 hovered anchor 교체 ─> 현재 requestId 유지
```

현재 공개 상태는 IDLE, READY, UNRESOLVED, DISMISSED다. 별도 HOVER_PENDING/LEAVE_PENDING 상태, 전역 160ms 진입·200ms 이탈 유예, suppressedAnchor, 별도 Pointer Tracker/Presence Reducer는 사용하지 않는다. 다만 현재 Controller에는 카드 이동 경로를 위한 bounded transit 타이머와 cardPointerInside 인지가 있다.

## 단일 포인터 대상과 이벤트 위임

- `document`의 capture `pointerover`, `pointermove`, `pointerout` 한 세트만 사용한다. 썸네일마다 리스너를 추가하지 않는다.
- Discovery가 제공한 anchor→식별 대상 Map에서 현재 이벤트 경로와 일치하는 binding 하나만 활성 상태로 둔다.
- YouTube 애니메이션 미리보기가 anchor 위의 형제 노드가 되는 경우에는 동일 renderer 안에서 이미 식별된 anchor의 사각형만 좌표 복구에 사용한다. 좌표로 영상 ID를 추측하지 않는다.
- `pointermove`는 YouTube DOM 교체로 `pointerover`가 빠진 경우와 `pointerout`이 누락된 경우를 복구한다.
- `targetKey`는 확인된 대상에 한해 `VIDEO:<videoId>` 또는 `CHANNEL:<channelId>`다. 같은 논리 대상의 hovered anchor 교체는 key와 requestId를 보존하고, 다른 ID로 교체되면 새 requestId를 발행한다.
- 일반 열기·닫기 타이머는 없다. 카드 이동 경로에서만 하나의 160ms 타이머를 사용하고, 카드 진입·다른 영상 선택·종료/Dispose에서 취소한다. 오래된 콜백은 세대 번호와 현재 선택을 비교해 무시한다.

## 카드로 포인터를 옮기는 경우 — 신규 승인 UX

- 썸네일 A → A Hover Card 이동은 **명시적 예외**다. 카드에 진입하면 현재 A를 고정하며 requestId/targetKey를 변경하지 않는다.
- 카드 아래 다른 영상 B가 있더라도 이벤트 판정에서는 Shadow Card를 먼저 확인한다. 카드 표면에만 pointer-events:auto, Host와 빈 Surface는 pointer-events:none으로 적용하여 카드 범위 밖의 사이트 조작을 차단하지 않는다.
- 썸네일과 카드 사이 짧은 경로에서만 bounded 160ms 타이머가 유지되며, 마우스가 카드/원래 썸네일에 들어오면 즉시 취소한다. 안전 경로에서 이탈하거나 기한 만료 시 카드 종료.
- 카드 → 빈 영역은 즉시 IDLE. 카드 → 실제 노출된 영상 C는 즉시 C로 전환. 카드 → A로 돌아오면 같은 대상 유지. 카드가 가린 B는 카드 내부에 있는 동안 선택할 수 없다.
- 더보기·닫기 버튼은 27~28번 작업 전까지 disabled 상태다. 포인터 이동 중 카드 유지와 CTA 클릭 구현은 별개이며, Side Panel을 연다고 가장하지 않는다.
- Escape는 사이트 기본 키 처리를 막지 않고 현재 카드만 닫는다. Focus 관련 계약은 별도 접근성 검수에 포함한다.

## DOM churn과 배치

- Content Discovery는 같은 DOM anchor의 href/ID 갱신과 anchor 제거·추가를 알린다.
- 활성 anchor 교체 시 같은 targetKey의 새 anchor가 Hover/Focus 상태이면 card/requestId를 유지한다. **포인터가 카드에 고정된 경우는 추가로 기존 앵커의 마지막 유효 화면 사각형과 위치가 가까운 새 앵커에 한해서만** 재결합한다. 동일 videoId·href라 해도 화면 멀리 있는 중복 영상은 채택하지 않는다.
- 새 anchor가 hover가 아니거나 대상 ID가 바뀌면 이전 대상은 유지하지 않는다.
- 카드 배치는 우측→좌측→아래→위→viewport fallback 순서다. 카드는 겹친 썸네일의 포인터 입력을 **의도적으로 차단**하지만, 겹침 자체가 Hover 종료 원인은 아니다. Host 전체가 클릭 차단막이 되어서는 안 된다.
- Controller 종료 이유(`THUMBNAIL_LEAVE`, `ANCHOR_REMOVED` 등)와 renderer 결과(`VISIBLE`, `ANCHOR_NOT_VISIBLE`, `ANCHOR_DETACHED`)를 별도 상태로 기록한다. 배치 실패가 Controller를 `DISMISSED`로 바꾸지 않는다.

## 수용 기준

- [ ] 같은 A 완전 이탈·재진입 10~30회에서 표시/제거 누락 0회.
- [ ] A→B→C→A 10~30회에서 현재 target 불일치와 stale 카드 0회.
- [ ] DOM이 같은 target의 anchor를 교체해도 포인터 아래라면 카드 유지.
- [ ] 다른 target 또는 포인터 밖 anchor 교체 시 이전 카드 즉시 제거.
- [ ] 카드가 다른 썸네일 B 위에 그려지면 **카드가 포인터를 받아 B를 차단**, 카드 바깥의 노출된 영상 C로 이동하면 C 활성. Host 빈 영역은 사이트 조작을 차단하지 않음.
- [ ] A↔카드↔A 20회 누락 없음, 160ms 간격 기한이 반복 pointermove로 늘어나지 않음, 카드→빈 공간에서 즉시 종료.
- [ ] 카드 placement 종료 이유와 Hover Controller 종료 이유가 섞이지 않음.
- [ ] 실제 YouTube 홈/검색 DOM 검증은 요소 경계와 상태만 검사하고 본문·제목·URL·댓글 값을 수집·출력하지 않음.

과거 160ms 진입·200ms 이탈 유예 및 Pointer Tracker/Presence Reducer 모듈은 역사적 기록이며 현재 런타임에는 없다. 현재 160ms는 오직 **카드 이동 간격 유예**에 적용된다. 상세 [벤치마킹 기록](./HOVER_INTERACTION_BENCHMARK_20261020.md).
