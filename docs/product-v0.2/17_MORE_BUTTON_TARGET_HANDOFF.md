# 17 — 더보기 버튼·Chrome Side Panel 열기·대상 고정 계약

> **INTERACTION_DRAFT / CHROME API BEHAVIOR TO VERIFY / NOT IMPLEMENTED**

[10 홈](./10_YOUTUBE_HOME_HOVER_LAYOUT.md) · [12 Hover 전이](./12_HOVER_LIFECYCLE.md) · [18 상세 패널](./18_SIDE_PANEL_LAYOUT.md)

## 1. 사용자 동작의 정본

1. **영상 B Hover:** 카드의 `targetType='VIDEO'`, 정확한 `videoId=B` 확인.
2. **더보기 클릭:** 사용자 제스처가 발생한 순간의 **B 대상 정보를 고정**.
3. **패널 열기:** Chrome 확장 `sidePanel.open()`으로 **탭/창에 맞는 Side Panel** 열기 요청.
4. **대상 전달:** 선택한 `targetType`, `targetId`, `requestId`, 원천/제목/분석시각을 전달.
5. **표시:** Side Panel이 동일 B로 렌더링되는지 확인.
6. **고정:** 이후 영상 C에 Hover해도 패널 내용은 B를 유지.
7. **명시 전환:** C 카드 더보기를 누를 때만 C로 변경.

**중요:** Chrome의 `sidePanel.open()`은 **사용자 제스처**와 연결된 요청이어야 합니다. 비동기 서버 수집을 기다린 뒤 패널을 열지 않도록 하고, 이벤트→확장 서비스 워커를 통한 열기 동작은 실제 Chrome에서 시험해야 합니다.

## 2. 전달 데이터 (mock 계약 후보)

```json
{
  "messageType": "OPEN_ANALYSIS_PANEL",
  "targetType": "VIDEO",
  "targetId": "demo-video-B",
  "requestId": "request-example-002",
  "origin": "youtube-home",
  "observedAt": null
}
```

이 값은 **교육용 가짜 ID**이며 실제 YouTube API 대상이라고 주장하지 않습니다. **실제 URL에 인증 토큰·민감정보·원문 댓글을 포함하지 않습니다.**

## 3. 경합 방지

- **카드 활성 대상 변경**은 현재 Side Panel 대상을 바꾸지 않음.
- **새 더보기** 클릭일 때만 패널 활성 대상을 업데이트.
- 패널은 응답 수신 시 `targetId`·`requestId`를 검증하고 오래된 요청 무시.
- **ID 확인 실패** 상태에서 더보기 버튼을 임의로 활성화하지 않음.
- 패널 열기 실패 시 조용히 무시하지 않고 접근 가능한 실패 안내/재시도 제시.
- 탭 이동/종료 시 세션/패널 동작은 Chrome 공식 API와 실제 테스트로 결정.

## 4. Side Panel과 DevTools의 차이

- **고객 기대:** F12처럼 브라우저 오른쪽에 나란히 정보가 나타남.
- **실제 기술:** Chrome `chrome.sidePanel` 확장 화면. 개발자 도구를 열거나 제어하지 않음.
- **제약:** 창/사용자 설정에 따라 좌우 위치·폭이 다를 수 있어 고정 픽셀/항상 우측을 보증하지 않음.

공식 API: [Chrome Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).

## 5. 시나리오 검수

- [ ] 더보기 **클릭 없이** 패널이 갑자기 열리지 않음.
- [ ] 클릭한 B 카드 ID와 Side Panel ID가 같음.
- [ ] B 패널 열린 채 C Hover해도 패널은 B 유지.
- [ ] C 더보기 클릭 시에만 C로 전환.
- [ ] 메시지가 늦게 도착해도 다른 영상 내용으로 덮이지 않음.
- [ ] Side Panel 열기 실패·브라우저 버전 불일치에 안내 표시.
- [ ] 키보드로 더보기 포커스/Enter 동작 가능.
