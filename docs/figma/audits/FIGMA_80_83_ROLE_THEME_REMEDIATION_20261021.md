# YOUTOPIA — 80~83 역할별 UI Light/Dark·디자인 토큰 개선 실행 보고

> **2026-10-21 KST · FIGMA_80_83_THEME_CANDIDATES_CREATED · STATIC_QA_PASS · PRESENT_NOT_RUN · PRODUCT_CODE_UNCHANGED**
>
> 사용자 승인에 따른 [PR #25](https://github.com/Choi1999/YOUTOPIA/pull/25) (98번 Side Panel 3탭/Light·Dark 정리)의 후속 작업. **기존 80~83번 승인 화면 9개를 덮어쓰거나 삭제하지 않고**, 같은 정보 구조의 Light/Dark **테마 QA 후보 18개**를 별도로 제작했다. 관리자와 DEV/QA 화면은 여전히 고객 Chrome 확장이 아닌 **웹 전용**이다.
>
> 기계 판독 근거: [FIGMA_80_83_THEME_CANDIDATE_EVIDENCE_20261021.json](./FIGMA_80_83_THEME_CANDIDATE_EVIDENCE_20261021.json) · [기존 페이지 감사](./FIGMA_00_99_CONSISTENCY_PROTOTYPE_AUDIT_20261021.md)

## 1. 역할별 Light/Dark 결과

| 페이지·표면 | 원본 화면 | 원본 보호 | Light/Dark QA 진입 | 상태 |
|---|---:|---|---|---|
| [80 고객 웹](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-2) Guest·개인 기본·구독 | 3 | 유지 | [Theme QA 80 / 1408:20](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-20) | 후보 **6개** |
| [81 고객 조직 웹](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-3) 구성원·조직 관리자 | 2 | 유지 | [Theme QA 81 / 1408:73](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-73) | 후보 **4개** |
| [82 플랫폼 운영 웹](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-4) 운영 현황·정책 감사 | 2 | 유지 | [Theme QA 82 / 1408:114](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-114) | 후보 **4개** |
| [83 DEV/QA 내부 웹](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-5) 상태 시뮬레이터·회귀 대장 | 2 | 유지 | [Theme QA 83 / 1408:155](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-155) | 후보 **4개** |

원본 9개는 페이지 맨 위에 보존. 후보는 아래의 별도 행에 위치하며 원본과 동일한 화면 의미를 제공한다. 각 Theme QA 인덱스에는 해당 화면의 Light/Dark 후보로 향하는 **Figma ON_CLICK NODE 링크**를 만든다. **실제 로그인, 조직 권한, 결제, 플랫폼 관리자·QA 업무 동작을 재현하는 링크가 아니다.**

각 페이지에는 두 시작점을 유지:
- 기존 Customer/Org/Admin/QA 역할 검토 Flow
- 신규 Theme QA Review Index Flow

83/82번 원본에서 새 테마 화면을 복제하며 일시적으로 상속된 시작점 4건은 **읽기 검토 후 정리**해 역할별 2개 시작점만 남겼다. Theme QA 복제 화면에는 기존 역할 네비게이션 반응이 복사되지 않도록 제거하여 **원본 업무 Prototype과 QA 시안을 격리**했다.

## 2. Figma 화면별 근거 링크

| 원본 역할 | Light 후보 | Dark 후보 |
|---|---|---|
| 80-01 Guest | [1404:10](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1404-10) | [1401:8](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1401-8) |
| 80-02 개인 기본 | [1404:83](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1404-83) | [1404:159](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1404-159) |
| 80-03 개인 구독 | [1404:235](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1404-235) | [1404:308](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1404-308) |
| 81-01 조직 구성원 | [1405:6](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1405-6) | [1405:79](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1405-79) |
| 81-02 조직 관리자 | [1405:152](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1405-152) | [1405:227](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1405-227) |
| 82-01 플랫폼 운영 | [1406:83](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1406-83) | [1406:6](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1406-6) |
| 82-02 정책 감사 | [1406:235](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1406-235) | [1406:160](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1406-160) |
| 83-01 QA 상태 | [1407:81](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1407-81) | [1407:6](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1407-6) |
| 83-02 회귀 기록 | [1407:231](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1407-231) | [1407:156](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1407-156) |

## 3. Figma 토큰 및 타입 시스템 실제 변환

- 기준 디자인 시스템: \`YUTOPIA/의미 토큰\`, Light 모드 \`1157:0\`, Dark 모드 \`18:1\`. 각 원본의 Light 또는 Dark 컬러 팔레트를 \`bg/app\`, \`bg/surface\`, \`bg/subtle\`, \`border/default\`, \`text/primary\`, \`text/secondary\`, \`text/muted\`, \`accent/primary\`, \`status/normal/error/warning\` 등에 역할별 의미로 매핑.
- **원본 9개 화면의 raw RGB 직접 수정을 하지 않음.** 원본을 복제한 화면의 palette만 기존 의미 변수 및 해당 모드의 실제 RGB로 업데이트. 새로운 컴포넌트나 외부 라이브러리 설치 없음.
- 신규 후보 **18개 총 단색 Fill·Stroke 1,442개 모두 변수 연결**(미바인딩 단색 0건). Figma에서 후보 18개 원본 구조·프레임 별 색상 바인딩 재조회.
- 기존 텍스트 스타일을 글꼴·weight·size가 **정확히 일치하는 경우에만** 참조: 436/786 텍스트 노드 연결. 나머지 **350개는 스타일 미연결 상태**, 간격·레이아웃이 바뀌지 않도록 별도 스타일 설계 검토 전 강제 적용 금지. 글꼴은 기존 Inter 사용.
- \`YUTOPIA / Access Boundary Notice\` 내부 공통 컴포넌트는 기존 Light/Platform/QA variant를 유지. 테마에 따라 Notice 제목·본문에 서로 다른 의미 토큰을 **인스턴스 로컬 오버라이드 36건**으로 연결. **13번 Master 컴포넌트와 기존 원본 인스턴스는 변경하지 않음**.
- 정확히 맞지 않는 색상 2개(80-02 부정 표시색 \`#d36477\`)를 후속 검사에서 확인하여 \`status/error\`로 변경. Guest Dark 파일럿의 선택 메뉴 accent 불투명도가 100%로 보이는 결함을 고쳐 **17% 강조면**으로 수정.
- 기존 운영자/QA 정체성 유지: 플랫폼은 기본 accent, 내부 QA는 warning accent 및 QA-only 데이터 구분. 플랫폼 관리자와 QA 로그인/권한은 고객용 Chrome 확장과 섞지 않음.

## 4. 데이터·시각·WCAG 검사 결과

| 수행한 검사 | 범위와 실제 결과 |
|---|---|
| 후보 프레임 전수 확인 | **18/18 존재**, Light 9 · Dark 9, 각각 원래 9개 대상과 매칭 |
| 기존 승인 원본 프레임 및 역할 Flow | **9/9 보존**, 기존 네비게이션·역할 분리 유지 |
| 후보 내 잘못된 Figma 내부 목적지 | **0개** (Theme Review Index 연결 18개) |
| Theme QA 후보에서 실행용 Figma Reaction | **0개** — 복제한 Prototype 동작은 QA 시각 견본에서 제거 |
| 공통 단색 Fill/Stroke 바인딩 | **1,442/1,442**, 미바인딩 0 |
| 기존 텍스트 스타일 적용 | **436/786**, 나머지 350개 보류 |
| 대표 화면 Figma Screenshot | **80 Guest Dark, 80 개인 Basic Dark, 81 조직 Admin Dark, 82 플랫폼 운영 Light, 83 QA Light 및 80/83 Review Index** 육안 검토 |
| 의미 색상 WCAG 텍스트 대비 | **Light/Dark × 8개 토큰 조합 = 16/16 계산상 4.5:1 이상** |

정적 대비는 Figma 변수 RGB 값을 WCAG 공식에 넣은 결과이며 **모든 실제 텍스트/알파합성/상태/포커스/키보드 및 WCAG 전체 합격이 아니다**. Figma 화면의 1600×900 시안을 900px 폭 스크린샷으로 축소해 본 것만으로 실제 사용자의 장시간 가독성을 평가할 수 없다.

## 5. Page Registry 반영

[00 시작하기 Page Registry / 1367:2](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1367-2)의 80·81·82·83 항목에 **역할 Prototype 연결과 각각 6/4/4/4개의 Light/Dark 후보 존재**를 반영. 기존 00의 Dark/Light 시작 화면을 그대로 보존하고 인덱스 내 문구만 수정.

## 6. 실제 Prototype Present 조작 검증 (아직 수행되지 않음)

새 Theme QA 시나리오에 대한 **실제 사람의 Figma Present Mode 클릭 결과**는 이번 작업에 없다. GitHub에 이 시험을 PASS로 기록하지 않는다.

| Test | 사용자 또는 브라우저 QA가 실제 수행할 흐름 | PASS 판정 |
|---|---|---|
| FPA-ROLE-01 | 80 Page에서 \`THEME QA 80\` Flow 시작 → Guest Light → 뒤로가기 → Guest Dark | 대상 ID가 각각 1404:10·1401:8로 변경, 원래 인덱스로 안전 복귀 |
| FPA-ROLE-02 | 80 기본/구독 Light/Dark 후보 순차 확인 | 각 화면 1600×900 레이아웃 및 구독 상태 정보 일관성, 자동 권한승격 없음 |
| FPA-ROLE-03 | 81 조직 구성원/조직 관리자 각 Light/Dark 후보 비교 | 조직 관리 경계가 시각적으로 유지되고 구성원에서 Admin으로 실제 승격되지 않음 |
| FPA-ROLE-04 | 82 플랫폼 운영/감사 Light/Dark | 운영/정책 UI가 고객 Chrome 확장에 혼입되지 않음 |
| FPA-ROLE-05 | 83 내부 QA 시뮬레이터/회귀 Dark/Light | QA 전용·합성 데이터 식별문구 보존, 고객 실분석으로 오인되지 않음 |
| FPA-ROLE-06 | 기존 고객/조직/Admin/QA 본 기능 Prototype Flow | 각 페이지 2개 Flow 중 원래 역할 탐색 경로 그대로 동작 |
| FPA-ROLE-07 | 키보드 Tab/Enter/Escape, 브라우저 줌 100/125/150%, 작은 뷰포트 | 텍스트/컨트롤/대비·Focus·원래 보드 스크롤·탭 전환 안전 |
| FPA-ROLE-08 | Figma 00 Registry와 80~83 인덱스에서 모든 화면 링크 | 실제 Node destination과 18개 후보의 Link 동작 일치 |

**상태:** FPA-ROLE-01~08 전부 \`NOT_RUN\`. Figma Plugin API와 GitHub 읽기만으로는 Present에서 사람처럼 클릭한 실행 증거가 아니다. 실제 테스트 시 Figma 시작 Flow/브라우저 버전/테스트된 Figma revision/클릭 순서/영상·스크린샷/실제 결과를 별도 QA 자료에 남긴다.

## 7. 외부 조사와 적용 이력

- **내부 직접 사용:** 기존 [YUTOPIA Figma 디자인 시스템](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1177-10)의 의미 토큰·Inter 텍스트 스타일·역할별 Notice Master의 Instance override. **실제 Figma Node에 바인딩된 증거**를 포함.
- **제품 UX 방향 참고:** [vidIQ](https://vidiq.com/extension/), [Outlier](https://outlier.so/docs/chrome-extension/using-extension-youtube), [Brand24](https://help.brand24.com/en/articles/9919606-ai-topic-analysis) → 기존 PR #17/25의 고객 정보 계층 제안. 이번 80~83 작업은 **외부 코드를 복제하거나 라이브러리를 설치하지 않음**.
- 정확한 원본 및 적용 여부는 [EX 외부 근거대장](../../research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md)의 \`DESIGN_SELECTED\` / \`CODE_INTEGRATED\` 구분을 따른다. Figma 프레임 클론은 YUTOPIA **내부 시안 재사용**이며 타사 소스 사용이 아니다.

## 8. 다음 Gate

1. **P0:** 98번 3탭 및 80~83 실제 Figma Present 모드 클릭·호버·뒤로가기 검증(이번 차례 미실행).
2. **P1:** 350개 미적용 텍스트에 대한 세부 디자인 스타일 규칙 승인 및 80~83 오리지널 원본과 신규 후보의 시각 비교·승인.
3. **P1:** Light/Dark 반응형·키보드·고대비/포커스 확인, 고객·관리·QA 역할 간 접근 오류 사례 검토.
4. **FE/BE:** 실제 Chrome YU-27/28 및 로그인·세션·조직 역할·유료 범위 서버 검증. 정적 디자인으로 실제 구현 완료를 주장하지 않음.
5. **보존:** PR #21 Figma Auth Candidate Draft / 구형 90~99 / 기존 FE 코드/Manifest 변경하지 않음.

**완료 구분:** \`FIGMA_80_83_LIGHT_DARK_18_CREATED\`, \`THEME_LINKS_18_VALID\`, \`ALL_ROLE_COLOR_TOKENS_BOUND\`, \`VISUAL_SPOTCHECK_DONE\`, \`USER_VISUAL_APPROVAL_PENDING\`, \`FIGMA_PRESENT_NOT_RUN\`, \`FULL_WCAG_NOT_RUN\`, \`CODE_NOT_CHANGED\`.
