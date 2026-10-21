# YOUTOPIA — 98 Side Panel 3탭 Prototype·Light/Dark 실행 보고

> 2026-10-21 KST · Figma 실제 수정·스크린샷 확인 · PRESENT_MODE_NOT_RUN · PRODUCT_CODE_UNCHANGED

이번 작업은 사용자 승인에 따라 98번의 최신 Hover 이후 고객용 분석을 **요약 / 주제 / 추이** 3개 탭으로 단순화하고, 근거는 별도의 상단 탭 대신 상황에 맞는 링크에서 여는 구조로 구현한 Figma 후보입니다. 기존 98-10의 4탭 원본은 보존합니다.

[Figma 98 페이지](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-2) · [정량 증거 JSON](./FIGMA_98_THREE_TAB_THEME_EVIDENCE_20261021.json) · [기준선 감사 PR #24](https://github.com/Choi1999/YOUTOPIA/pull/24)

## 1. 고객 정보 구조 확정 방향

| 구성 | 목적 | 증거 |
|---|---|---|
| 요약 | 첫 화면에서 감성·주요 주제·짧은 결론을 빠르게 읽기 | [98-11](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1375-2) |
| 주제 | 반응 논점별 설명과 상대 언급량 확인 | [98-12](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1376-2) |
| 추이 | 기간 비교가 가능한 경우만 추이를 제공. 현재처럼 기록 부족 시 사실에 맞는 빈 상태 표시 | [98-13](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1379-2) |
| 분석 기준 | 각 탭에서 '이 결과의 기준 확인하기'를 눌러 출처·기간·표본·한계 보기. 네 번째 최상단 탭은 만들지 않음 | [98-14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1380-2) |

디자인은 고객에게 내부 Cache/Job/Policy 코드 대신 결과를 이해하는 데 필요한 정보만 제공합니다. **가상 데이터로 실제 댓글 여론을 주장하지 않으며**, 추이 비교 자료가 없다면 증가·감소를 꾸며내지 않습니다.

최종 고객용 디자인 시각 승인과 실제 제품 코드 구현은 별도 Gate입니다.

## 2. Figma 실제 변경·Prototype 증거

- 새 Light 후보 4개 98-11 ~ 98-14: 기존 [98-10 원본](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217)을 복제하되 편집 가능한 TEXT/FRAME로 유지.
- Hover 더보기 (노드 1276:215): 이전 목적지 98-10 (1276:217)에서 **98-11 Summary (1375:2)** 로 변경.
- 요약→주제 1375:237→1376:2, 요약→추이 1375:239→1379:2, 주제↔추이/요약 4건의 NODE 반응을 추가.
- 맥락형 근거 진입 3건: 1375:241 / 1376:241 / 1379:241 → 98-14 (1380:2).
- 근거에서 돌아가기: 1380:244에 Figma **BACK** 동작 설정. 이전 탭으로 복귀하도록 설계.
- 98-10 기존 4탭은 삭제하지 않고 ARCHIVE/REFERENCE 시작점으로 유지.
- 98 페이지의 QA 포함 상위 프레임 **18개**, Flow 시작점 **10개**, Reaction **30개**, NODE 이동 **29개**, BACK **1개**. Figma API로 조사한 결과 **미존재 내부 목적지 0개**.
- 기존 메인 Flow는 98-01 홈→98-09 최신 Hover→98-11 Summary→주제·추이→근거 상세. 별도 채널/No Data/구형 경로는 보존.

**중요:** 이 내용은 Figma Proto Reaction과 Node ID를 조회·설정한 정적 구조 검증입니다. Figma Present 모드에서 실제 마우스로 클릭·Hover·BACK을 수행한 E2E PASS를 의미하지 않습니다.

## 3. Light/Dark 시각 대응 및 공통 토큰

| 시나리오 | Light 후보 | Dark 대응 패널 QA |
|---|---|---|
| 요약 | [98-11](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1375-2) | [98-15](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1386-2) |
| 주제 | [98-12](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1376-2) | [98-16](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1389-2) |
| 추이 | [98-13](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1379-2) | [98-17](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1389-78) |
| 근거 | [98-14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1380-2) | [98-18](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1389-147) |

Light는 YouTube 전체 1600×900 구도를 포함한 프로토타입입니다. Dark는 패널 단독 435×810 시각 QA 견본이며, Dark→Light로 잘못 이동하지 않도록 Proto Reaction을 제거했습니다. **Dark 견본에 클릭 동작이 없다는 것은 의도된 설계**입니다.

- Light 신규 패널 4개에 있던 고정 단색 Fill 총 **52개**를 YUTOPIA 의미 색상 변수에 연결. Light/Dark 후보 **8개 패널 모두 미바인딩 단색 Fill 0건**.
- 기존 텍스트 스타일과 글꼴·크기·weight가 정확히 맞는 텍스트 77/141개에 스타일 연결. 나머지 64개는 무리한 재매핑으로 UI가 틀어지지 않도록 보류.
- Figma 스크린샷 육안 검사: 요약·주제 Light, 추이·근거 Light, Dark 4개 화면. 주제 시안의 상단에 잘못 생긴 바 3개 및 검은 탭 배경을 발견해 수정한 뒤 재검수.
- 토큰 RGB로 계산한 WCAG AA 일반 텍스트 대비 10개 쌍(테마별 5개) 모두 4.5 이상. 세부 실측은 [JSON 근거](./FIGMA_98_THREE_TAB_THEME_EVIDENCE_20261021.json) 참조. **화면 전체 WCAG/키보드/스크린리더 완전 PASS는 아님**.

## 4. 외부 프로젝트 벤치마킹 적용 증거

| 참고 출처 | 이번 설계에서 참고한 부분 | 실제 사용 범위 |
|---|---|---|
| [vidIQ 공식 Extension](https://vidiq.com/extension/) · EX-001 | YouTube 주변에서 필요한 정보 먼저 읽기 | 98-11 간략 요약 레이아웃에 UX 아이디어 채택. 외부 코드/이미지 복제 없음 |
| [Outlier Extension](https://outlier.so/docs/chrome-extension/using-extension-youtube) · EX-002 | 충분한 데이터가 없을 때 수치를 만들지 않음 | 98-13 '비교 기록 없음' 처리. 외부 알고리즘/코드 복사 없음 |
| [Brand24 Topic Analysis](https://help.brand24.com/en/articles/9919606-ai-topic-analysis) · EX-003 | 주제·감성·기간 별 변화 단계적 탐색 | 3탭 요약/주제/추이와 근거 심화. 소스 코드 사용 없음 |
| [기존 YUTOPIA 공통 컴포넌트 원본](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1177-10) · 내부 정본 | Light/Dark 의미 토큰과 텍스트 스타일 | 실제 Figma 변수·스타일에 바인딩한 증거 존재 |

외부 사례는 설계 **참고**이고, YUTOPIA 자체 **실행 소스코드**에 실제 채택했다는 뜻이 아닙니다.

## 5. 남은 실제 검증 — 미실행을 완료로 처리 금지

| 시험 ID | Figma Present에서 수행할 실제 작업 | 현 상태 |
|---|---|---|
| PRES-98-01 | [98-01 홈](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-3)에서 Hover→98-09 | NOT_RUN |
| PRES-98-02 | 최신 Hover의 더보기 클릭→98-11 요약 | NOT_RUN |
| PRES-98-03 | 요약↔주제↔추이 탭 반복 클릭·같은 영상 타깃 확인 | NOT_RUN |
| PRES-98-04 | 각 탭의 결과 기준 링크→98-14 | NOT_RUN |
| PRES-98-05 | 근거 상세에서 BACK→원래 탭 복귀 | NOT_RUN |
| PRES-98-06 | × 닫기→YouTube 홈 복귀 | NOT_RUN |
| PRES-98-07 | 기존 98-10은 구형 참고 Flow에서만 확인 | NOT_RUN |
| PRES-98-08 | Dark QA 4개는 시각만 비교, 고객 클릭이 없는지 확인 | NOT_RUN |

검증에는 테스트 수행자, Chrome/Figma 환경, 시작 Flow, 실제 클릭·Hover 순서, 관측 결과 및 영상/스크린샷을 남겨야 합니다. Figma가 제공하는 Prototype 설정값을 읽은 것은 **실제 Present 모드 조작이 아닙니다**.

## 6. 추후 개발 Gate 및 잔여 기술 부채

- P0: 실제 Figma Present 모드 조작, 3탭·BACK·닫기·Hover 경로 통과 여부. 오류 시 Figma 목적지와 탭 선택 상태 재검토.
- P0: 고객 Guest→웹 로그인→원래 고정 영상으로 복귀 UX는 별도 100번 Auth 후보 및 실제 인증 계약 연결 후 검증.
- P1: 80~83 전체 Role UI의 Light/Dark 동등성, 98 구형 프레임과 전체 YouTube Mock의 색상 변수/텍스트 스타일 통일. **이번에 완성했다고 주장하지 않음.**
- P1: 뷰포트 크기·줌·키보드·스크린리더·비율 변동과 실데이터 없음/부분/갱신 시나리오.
- INT: Chrome YU-27 설치형 MV3 QA 및 YU-28 실제 Side Panel 클릭 대상 고정, FE/BE 실제 분석·권한 테스트.
- 보호: 구형 98-10, 90~92 레거시, 99 Deprecated, 100 Auth 후보와 기존 코드/Manifest는 삭제·변경하지 않음.

**완료 상태:** FIGMA_98_3TAB_DESIGN_CANDIDATE_CREATED, STATIC_PROTOTYPE_GRAPH_PASS, CONTEXT_EVIDENCE_LINKED, LIGHT_DARK_8_VISUALS_CHECKED, SEMANTIC_TOKEN_IN_NEW_PANELS, FIGMA_PRESENT_NOT_RUN, RUNTIME_NOT_IMPLEMENTED, USER_VISUAL_APPROVAL_PENDING.
