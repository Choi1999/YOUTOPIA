# YOUTOPIA — Figma 00~99 승인 후 Prototype 연결·페이지 Registry 정리 실행 보고

> **2026-10-21 KST / APPROVED SCOPE EXECUTED / FIGMA STRUCTURE VERIFIED / PRESENT_MODE_NOT_RUN**
>
> 사용자 승인: [00~99 전체 일관성·프로토타입 감사 PR #23](https://github.com/Choi1999/YOUTOPIA/pull/23)에서 확인한 우선순위에 따라 (1) 98 Chrome 최신 경로 정렬, (2) 80~83 역할별 Prototype 구축, (3) 93 웹 데모 시작점·Guest 문구 정렬, (4) 00 페이지 Registry 기록. **기존 Figma 페이지/프레임 삭제·재번호·정본 덮어쓰기는 수행하지 않는다.**
>
> 정량 증거 JSON: [FIGMA_00_99_POST_APPROVAL_RECONCILIATION_20261021.json](./FIGMA_00_99_POST_APPROVAL_RECONCILIATION_20261021.json)
>
> 기준선: [검수 인벤토리](./FIGMA_00_99_PAGE_INVENTORY_20261021.json) / [감사 결과](./FIGMA_00_99_CONSISTENCY_PROTOTYPE_AUDIT_20261021.md).

## 1. 실행 결과 요약

| 검사 | 변경 전 | 실제 변경 후 | 의미 |
|---|---:|---:|---|
| 00~99 존재 페이지 | 29 | **29** | 페이지 추가·삭제·재번호 0 |
| Figma 레이어 노드 수 | 42,254 | **42,410** | 00 Registry 프레임과 80/81 전용 검토 인덱스 등 편집 가능한 신규 노드 +156 |
| Prototype Reaction | 484 | **494** | 검토용 새 연결 +10 |
| NODE 화면 이동 액션 | 381 | **391** | 검토용 새 연결 +10, 기존 98 두 이동의 목적지만 바꿈 |
| URL 액션 | 103 | **103** | 외부 URL 링크 미변경 |
| 명시 Flow 시작점 | 25 | **31** | 80~83 각 1개와 93 Dark/Light 2개 신규; 98 기존 5개 명칭 정리 |
| 80/81/82/83 목적지 유효성 | 각 화면 Reaction 0 | **10/10 연결 목적지 유효** | 서버 인증/구독/조직 권한 PASS와는 무관 |
| 최신 Chrome 이동 | Home→구형 Hover→구형 Panel | **Home→최신 98-09 Hover→최신 98-10 Panel** | Figma 정적 클릭·Hover 이동 ID 검증; Chrome MV3 런타임 미실행 |

숫자는 **Figma Plugin API의 페이지별 실제 재조회**로, 변경하지 않은 22개 페이지는 감사 전 인덱스와 동일한 구조를 유지한 것으로 합산했다. Runtime 소스/웹 서버 자체의 테스트 통과 수가 아니다.

## 2. 98번 — 최신 Chrome 사용자 동선 연결 수정 (FPA-02)

| 단계 | 클릭/입력 노드 | 이전 목적지 | 변경 목적지 | 읽기 검증 |
|---|---|---|---|---|
| YouTube 홈 Hover | \`1255:73\` | 구형 98-02 \`1253:4\` | **[98-09 최신 Hover \`1276:2\`](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-2)** | ON_HOVER NODE 목적지 변경·확인 |
| 최신 카드의 더보기 | \`1276:215\` | 구형 98-03 \`1253:5\` | **[98-10 최신 Side Panel \`1276:217\`](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217)** | ON_CLICK NODE 목적지 변경·확인 |

- **주 Flow 시작:** \`98-01 / 1253:3\`; 이름: \`MAIN · YouTube Home → 최신 Video Hover → 최신 Side Panel\`. 닫기 \`1276:406 → 1253:3\` 기존 동작 보존.
- **검증:** 98 내 총 10개 상위 화면이 5개의 지정된 시작점에서 모두 NODE로 도달 가능(10/10), 유효하지 않은 내부 목적지 0건. 메인 98-01 시작만을 기준으로는 현행 흐름 및 구독 시안 등 일부 4개 화면이 도달 대상이며, 채널/No Data/구형 시안은 별도 시작점.
- **보존:** 구형 98-02·98-03은 삭제/대체하지 않고 \`ARCHIVE REVIEW\` Flow에 남김. 채널 Hover와 데이터 미확보 Flow도 유지.
- **아직 미구현:** [98-10](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217)의 요약/주요 주제/기간 흐름/근거 4개 탭 간 실제 Prototype 전환, 선택 대상 고정·실제 사이드패널 런타임, Guest Auth 복귀 Figma Flow의 최종 연결. 4탭과 [100번 Auth 후보](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1320-3)의 3탭 차이는 정보구조 승인 전 임의 수정 금지.

## 3. 80~83 — 고객/조직/운영/QA 역할별 Figma Prototype (FPA-03)

| 페이지 | 생성·변경 노드 | 연결 및 명시 Flow | 정적 도달 검사 | 금지해야 할 오해 |
|---|---|---|---|---|
| [80 고객 Web](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-2) | 신규 [고객 Role 시연 인덱스 \`1359:8\`](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1359-8), 3개 검토 버튼 \`1359:13/17/21\`, 기본 고객 '구독 기능 살펴보기(시연)' \`1285:140\` | 인덱스→Guest \`1285:2\` / Basic \`1285:72\` / Subscriber \`1285:145\`; Basic→구독 기능 시연 | 4/4 상위 프레임 도달 / NODE 4건 | 역할 시안 선택 ≠ 실제 로그인·구독 결제·이용권 획득 |
| [81 조직 Web](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-3) | 신규 [조직 Role 시연 인덱스 \`1359:30\`](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1359-30), 검토 버튼 \`1359:35/39\` | 인덱스→구성원 \`1286:2\` / 조직 관리자 \`1286:72\` | 3/3 상위 프레임 도달 / NODE 2건 | 구성원 UI에서 조직 관리자 권한으로 승격하는 고객용 링크는 **추가하지 않음** |
| [82 운영 Admin Web](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-4) | 기존 Nav \`1286:156\`, \`1286:224\`에 Figma 클릭 이동 추가 | 운영 \`1286:144\` ↔ 정책 감사 \`1286:218\` | 2/2 프레임 / NODE 2건, 운영 화면 Flow start 1 | 관리자 로그인/인가/실행 Job는 실제로 동작하지 않음 |
| [83 Internal QA Web](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-5) | 기존 Nav \`1286:302\`, \`1286:368\`에 클릭 이동 추가 | 상태 시뮬레이터 \`1286:290\` ↔ 회귀 기록 \`1286:362\` | 2/2 프레임 / NODE 2건, QA 화면 Flow start 1 | 시뮬레이션/권한 시험을 실행했다는 의미 아님 |

- 80/81 인덱스는 기존 1600×900 화면 **밖** 왼편(\`x=-1750\`)에 별도 1600×900 프레임으로 배치. 기존 구성원/고객/관리자 원본 화면의 컴포넌트·레이아웃을 덮어쓰지 않음.
- 인덱스에는 **PROTOTYPE ONLY / DEMO-ONLY / NOT PRODUCT UI** 및 역할/구독 자동 승격 부정 문구 표시. 토큰·Inter·Light Mode 연결, 화면 캡처 육안 확인.
- Figma Plugin API로 명시적 시작점을 생성하고 이름을 부여해 80·81·82·83의 개별 페이지 Presentation 시작 대상이 확인됨.
- 실제 로그인·구독·권한에 따라 상태가 바뀌는 전체 업무 UX 시나리오와 비주얼의 세부 인트라탭 전환은 **아직 완료된 것으로 판정하지 않음**.

## 4. 93 React Demo — 진입점과 범용 제품 언어 정리 (FPA-04)

- [93 YU-01~12 React Web Demo](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1159-10): 24개 Light/Dark 제품 화면에 NODE 이동 228건은 기존 그대로.
- **신규 대표 Flow 2개:** [Dark 로그인 \`1159:11\`](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1159-11), [Light 로그인 \`1159:50\`](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1159-50). 두 시작점에서 YU-01~12 제품 화면 24/24 도달, 별도 Product Journey 설명용 프레임 2개는 설계 자료로 남음.
- **시안 실제 텍스트 변경(Dark/Light 동형, 6노드):**
  - 제품 문구 \`게임 운영을 위한 분석...\` → \`YouTube 영상·채널 반응 분석\`
  - 제목 \`게임의 목소리를...\` → \`영상 속 반응을 쉽게 이해하는 방법.\`
  - 로그인 안내 \`서비스를 이용하려면 로그인하세요.\` → \`저장·비교·협업을 시작하려면 로그인해 주세요.\`
- **스크린샷 확인:** Dark 로그인 화면에 제목·설명·입력폼의 겹침 없음. **React 앱 실제 화면 소스 수정/실행은 하지 않음**, 게임 NEXUS 고정 데모의 나머지 문구·지표와 진짜 OAuth 미구현은 독립 후속 작업.

## 5. 80 Guest 정책 문구 업데이트 (FPA-06)

[80-01 Guest 정본](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1285-2)에서 \`1285:28\`, \`1285:32\`, \`1285:51\`, \`1285:60\`, \`1285:62\`의 '로그인 없이 조회 미확정/결정 대기' 문구를 승인된 **기본 분석 Guest-first 방향**으로 변경.

실제 Guest 데이터 조회량·지역·무료요금·서버 권한·YouTube API 사용 범위는 여전히 미결정이므로 화면에서 이를 확정된 운영 제공 범위처럼 제시하지 않음. 수정 후 80-01 화면 screenshot으로 긴 텍스트/카드 배치 검사.

## 6. 00 시작하기 — 전체 Page Registry 제작 (FPA-01)

- 신규 [페이지 Registry 시트 \`1367:2\`](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1367-2)를 [00 시작하기](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1690) 기존 두 화면 오른쪽 \`x=3090\`에 독립 AutoLayout 프레임으로 제작. 기존 Dark \`343:1699\`/Light \`1201:2\` 보존.
- 29개 실제 존재 페이지를 번호·이름·역할·현재 Prototype/보존 상태와 함께 **00~14/80~83/90~94/95~99 네 그룹**으로 구분.
- **번호 공백 15~79 / 84~89을 강제로 생성하지 않음.** 100 Guest Auth 후보는 별도 시안(범위 밖).
- Light semantic token, Inter, 기존 textStyle을 활용한 편집 가능한 Registry. 완성된 화면을 이미지로 평면화한 것이 아니라 실제 Figma 텍스트/프레임으로 작성했으며, 스크린샷 육안 확인.
- **용도:** 현재 디자인/연구/발표/보존 자료의 역할과 Prototype 상태를 찾는 인덱스. Registry 시트 자체가 인증·UX 기능의 실제 실행 증거는 아님.

## 7. 검증 Gate 및 미해결 사항

| 테스트 | 수행 결과 |
|---|---|
| 각 수정 페이지 Node/Reaction/FlowStartingPoints Figma Plugin API readback | **7개 페이지 완료** |
| 80/81/82/83/93/98의 내부 NODE 목적지 존재·명시적 Flow에서 화면 도달성 | **0개 잘못된 내부 목적지**, 역할별 4/4·3/3·2/2·2/2, React 제품 24/24, Chrome 전체 10/10 |
| 98 메인 최신 경로 & 기존 참고 Flow 보존 | **구조 PASS** |
| 00 Registry/80·81 Review Hub/80 Guest/93 로그인 스크린샷 | **대상 화면 육안 검사 수행**, 겹침 없음 |
| 원본 00/80~83/93/98 페이지 번호·기존 제품 상위 프레임 보존 | **PASS** (새 프레임만 추가) |
| Figma Present 모드 실제 마우스 클릭·Hover 재생 시험 | **NOT_RUN** |
| 98-10 Summary/Topics/Timeline/Evidence 탭별 유효한 상태 프레임 및 상호작용 | **NOT_IMPLEMENTED** (4탭 vs 3탭 정본 확정 필요) |
| 실제 Chrome 확장/React 앱/인증/BE 운영 기능 통합 테스트 | **NOT_RUN** |
| 전체 80~83/98 문자·색상 토큰 바인딩·동일한 Light/Dark 구현 | **NOT_DONE** (QA 후속 작업) |
| 90~92 과거 게임 Pilot의 크로스 페이지 11개 참조 정리 | **NOT_DONE** (보존함) |

**선행 결정·연구 증거:** [P-13 Customer-only Chrome / Admin web](../../product-v0.2/GUEST_AUTH_CONTEXT_RESTORE_UX_20261021.md), [FE/BE M0~M9](../../product-v0.2/FE_BE_PRODUCT_INTEGRATION_METHOD_V3_20261021.md), [외부 UX 조사](../../product-v0.2/CUSTOMER_FIRST_UX_BENCHMARK_20261021.md) (후자는 별도 PR #17 Draft, 아직 제품 정본 확정 전).

## 8. 다음 구현 순서 (작업 진행 중이 아니라 계획)

1. **P0 · Figma Present 실사용 검증:** 98 주 Flow Home→Hover→Reviewed Panel→닫기, 80/81 검토 인덱스, 82/83 양방향 버튼, 93 Dark/Light 로그인 시작점을 실제 Present에서 시험하고 실패/스크린 레코딩 보존.
2. **P0 · 실제 고객 정보구조 결정:** 98 Panel의 4탭(요약/주제/기간 흐름/근거)과 후보 100의 3탭(요약/주제/추이) 비교/승인 → 이후 각 탭별 진짜 Figma 선택 상태/내비게이션 및 AuthReturnIntent 경로 구성.
3. **P1 · 토큰/테마 일관성:** 80~83/98의 고정 RGB·미공통 텍스트 스타일부터 우선순위 표 작성, 중복 컴포넌트/Light-Dark 시각·WCAG 검수, 특정 프레임만 승인 후 적용; 현행 디자인을 무단 전면 교체하지 않음.
4. **P1 · 92 레거시 링크:** 90 Pilot로 가는 11개 NODE 연결을 참고 목적/운영 목적별로 구분, 고객/운영의 현재 제품 Prototype에서 필요하면 별도 새 목적지로 교체.
5. **INT · FE 실제 구현 연결:** YU-27 실제 설치형 Chrome 검증 → YU-28 Side Panel 본 동작 → 동일 Figma Node에 해당하는 frontend 파일/테스트 SHA 연결. Figma 링크 자체는 코드 구현이 아님.

**문서·Figma 수정의 범위:** Figma의 원본 00~99에서 특정 Reaction·Flow 이름·Guest/로그인 문구 수정과 신규 Registry/역할 검토 프레임만 생성. 이 GitHub PR 자체는 증거 기록 Markdown/JSON만 추가하며 FE/BE 실행 코드와 Chrome Manifest·정본 재번호·99 보존 자산을 건드리지 않음.

> 판정: \`FPA_01_REGISTRY_CREATED\`, \`FPA_02_MAIN_CHROME_ROUTE_FIXED\`, \`FPA_03_ROLE_PROTO_WIRED\`, \`FPA_04_WEB_DEMO_STARTS_ADDED\`, \`STRUCTURAL_GRAPH_PASS\`, \`PRESENT_MODE_NOT_RUN\`, \`FULL_UX_PROTO_PENDING\`, \`DESIGN_TOKEN_PARITY_PENDING\`.
