# YOUTOPIA — Figma Present 실조작 인수 프로토콜 v0.1

> 2026-10-21 · TEST_PLAN_ONLY · **전 항목 NOT_RUN** · 이 문서는 Figma 실제 시연을 완료했다는 증거가 아니다.
>
> 기준 파일: [YOUTOPIA Figma 정본](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/).
> 98번 및 80~83번의 Node/Reaction 정적 검사와 Light/Dark 스크린샷 검수는 별도로 완료. 이번 파일은 **실제 사람 또는 별도 승인된 브라우저 자동화가 Present 모드를 클릭하는 경우**의 실행 절차와 증거 항목을 정의한다.

## 1. 실행 환경 고정

시험 전 아래 값을 기록한다.

| 환경 필드 | 입력 값 |
|---|---|
| Test executor | 미입력 |
| Figma file key | 00Q6HNjuv02u7Ex4yUzZer |
| Figma version/revision (실행 당시) | 미입력 |
| Test date (KST) | 미입력 |
| Browser/OS/version | 미입력 |
| Display resolution & zoom | 미입력 |
| Screen recording/screenshot evidence | 미입력 |
| Result per case (PASS/FAIL/BLOCKED/NOT_RUN) | 모두 NOT_RUN |

테스트 전후 Figma 시안이 바뀌면 이전 PASS를 자동 승계하지 않는다. 실제 화면 녹화에는 개인 YouTube 추천정보·계정 토큰·댓글 원문이 포함되지 않도록 보호한다.

## 2. Chrome UX Figma Prototype: 98번

[98 Chrome UX 페이지](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-2)에서 **MAIN · Home → Hover → 3-tab Summary → Topics/Trends/Evidence** Flow를 선택한 다음, 아래 조작을 실제 Present UI로 실행한다.

| 시험 | 직접 사용자 조작 | 기대되는 Figma 결과 | 상태 |
|---|---|---|---|
| PRES-98-01 | [98-01 Home](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-3)에서 지정된 영상 썸네일에 포인터 Hover | 최신 98-09 Hover 카드로 전환 | NOT_RUN |
| PRES-98-02 | 98-09에서 더보기 클릭 | [98-11 요약](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1375-2) | NOT_RUN |
| PRES-98-03 | 요약→주제→추이→요약을 클릭 | 3탭 상태가 올바르게 변하고 같은 영상 대상 유지 | NOT_RUN |
| PRES-98-04 | 각각의 탭에서 분석 기준 링크 클릭 | [98-14 근거 상세](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1380-2) | NOT_RUN |
| PRES-98-05 | 근거 상세의 돌아가기 버튼 클릭 | 직전에 열었던 탭으로 복귀 (Figma BACK) | NOT_RUN |
| PRES-98-06 | Side Panel × 클릭 | YouTube 홈 98-01로 복귀 | NOT_RUN |
| PRES-98-07 | 98의 ARCHIVE Flow 시작 | 구형 98-10 4탭 원본 보존, 메인 UX에 혼입되지 않음 | NOT_RUN |
| PRES-98-08 | Theme QA Flow에서 Light와 Dark 4상태 비교 | 색상 대비·콘텐츠 동일성, Dark는 시각 견본으로만 사용 | NOT_RUN |

**필수 주의:** Figma의 화면 전환은 실제 Chrome MV3 Side Panel API 호출이 아니다. 영상 A 클릭 후 B Hover에서도 패널 A가 고정되는 실제 브라우저 테스트는 YU-28 이후 별도로 실행해야 한다.

## 3. 고객·조직·운영·QA Role UI: 80~83번

각 링크에서 Prototype 보기(Present)로 진입한 후 페이지별 **THEME QA** 시작점을 선택한다. 원래 역할 시연용 Prototype Flow는 별도로 유지한다.

| 시험 | 시작 Figma 링크와 조작 | 기대 결과 | 상태 |
|---|---|---|---|
| PRES-ROLE-01 | [80 Theme QA](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-20) → 80-01 Guest Light → 뒤로가기 → Guest Dark | 올바른 노드 1404:10, 1401:8로 이동 | NOT_RUN |
| PRES-ROLE-02 | 80 Theme QA → 80-02/03 개인 기본·구독 각각 Light/Dark | 사용자 역할·구독 정보가 의도대로 구별되며 UI 클릭만으로 이용권 획득하지 않음 | NOT_RUN |
| PRES-ROLE-03 | [81 Theme QA](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-73) → 구성원·조직 관리자 Light/Dark | 두 역할 시안 분리; 조직 구성원에서 관리자로의 서버 권한 승격은 구현된 것으로 오인하지 않음 | NOT_RUN |
| PRES-ROLE-04 | [82 Theme QA](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-114) → 운영·정책 Light/Dark | 플랫폼 관리자 웹 전용 고지 및 QA 분리 유지 | NOT_RUN |
| PRES-ROLE-05 | [83 Theme QA](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-155) → 시뮬레이터·회귀 Dark/Light | MOCK·SYNTHETIC·NOT RUN 표시 등 시험 전용 문구 유지 | NOT_RUN |
| PRES-ROLE-06 | 80/81/82/83 각각의 원래 Role Prototype Flow 시작 | 원래 역할별 화면 전환이 이전처럼 연결되고 Theme QA 전용 화면은 운영 고객 흐름에 끼어들지 않음 | NOT_RUN |

### 실사용성·접근성

| 시험 | 방법 | 기대 결과 | 상태 |
|---|---|---|---|
| PRES-A11Y-01 | PC 브라우저 줌 **100%/125%/150%**에서 80~83 역할 화면 비교 | 글자 잘림, 요소 겹침, 주요 CTA 소실 없음 | NOT_RUN |
| PRES-A11Y-02 | Tab/Shift+Tab/Enter/Escape 및 화면 낭독기 탐색 | 의도한 모든 실제 컨트롤의 초점 순서·설명이 명확. Figma 시연의 키보드 지원 한계를 실제 UI 완료로 오인 금지 | NOT_RUN |
| PRES-A11Y-03 | **11px 텍스트 36개, 12px 332개**의 실기기 읽기 과제 | 짧은 시간에 업무 의미 이해 가능 여부. 실패 시 최소 글자 크기 및 레이아웃 조정 ADR | NOT_RUN |
| PRES-A11Y-04 | 역할 고지와 고객 로그인·관리자·QA 화면 비교 | 고객 Chrome 확장에 관리자/QA 로그인과 데이터 통제 UI 없음 | NOT_RUN |

Figma Present에서 지원하지 않는 키보드 기능은 **BLOCKED_BY_PROTOTYPE_TOOL** 등으로 따로 표시한다. Figma에서 통과했다고 실제 확장/React 앱 접근성이 통과한 것으로 기록해서는 안 된다.

## 4. 실행 결과 증거 양식

각 시험 결과에는 다음 필드를 작성한다.

| 필드 | 필요 내용 |
|---|---|
| Test ID | 예: PRES-98-05 |
| Starting Flow & node ID | 예: 1253:3, Main Chrome Flow |
| Step sequence | 실제 클릭·Hover·뒤로가기·줌·키보드 이벤트 순서 |
| Expected/observed | 예상값과 화면에서 확인한 결과를 각각 작성 |
| Test environment | OS·브라우저 버전·Figma revision·줌 |
| Outcome | PASS / FAIL / BLOCKED / NOT_RUN |
| Evidence | 스크린샷 또는 녹화, 담당자·실행 일시 |
| Issue link / re-test | 결함 ID·수정 Frame/Reaction ID·재검증 일시 |

실패는 기록에서 삭제하지 않고 수정 전후의 Figma Node ID 및 시험 로그를 연결한다. 중요한 UX 오류는 실제 제품 코드 반영 전 수정·재검증을 요구한다.

## 5. 최종 검증 경계

- **이미 완료된 증거:** Figma Plugin API의 정적 Flow/NODE 목적지 존재, 80~83 후보 텍스트 스타일 786/786, Solid Fill/Stroke 의미 변수 1442/1442, 선택 메뉴·CTA 대비 36/36.
- **이 문서가 요구하는 실제 시험:** 98 Chrome Present 8건, 80~83 역할 6건, 접근성·가독성 4건 = **총 18건; 전부 NOT_RUN**.
- **별개 시스템 시험:** YU-27 실제 Chrome MV3 설치형 통신, YU-28 실제 Side Panel 대상 고정, FE/BE 세션·데이터 API·분석 모델·권한 검증.

**결론:** 실제 Figma 조작 TEST PASSED 증거가 제출되기 전까지는 FIGMA_PRESENT_PENDING이다.
