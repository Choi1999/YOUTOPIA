# YOUTOPIA Figma 00~99 — 페이지 정합성·UX 프로토타입 실구현 감사 v1

> 감사 시각: **2026-10-21 KST** · Figma 정본: [00Q6HNjuv02u7Ex4yUzZer](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/) · **READ-ONLY INSPECTION / NO FIGMA EDIT**
>
> **판정:** 디자인 시스템 기초는 대체로 유지되어 있으나 **현행 범용 YouTube 제품 UX/역할별 화면/프로토타입 연결은 미완성**. 페이지를 삭제·이동·재명명하지 않고 증거를 기록했다.
>
> 기계 판독 가능 원본 인덱스: [FIGMA_00_99_PAGE_INVENTORY_20261021.json](./FIGMA_00_99_PAGE_INVENTORY_20261021.json).
> 이 문서는 Figma Node/Reaction/Flow의 정적 감사와 대표 시안 스크린샷을 바탕으로 작성한다. 실제 Figma Present 모드 마우스 클릭·Hover·키보드·Chrome MV3·웹 서버 동작을 **실행했다는 뜻이 아니다**.

## 1. 감사 범위·방법·지표

- **실제 존재하는 페이지:** 00~14(15개), 80~83(4개), 90~99(10개) = **총 29개 페이지**. 번호 15~79 및 84~89는 현재 페이지가 존재하지 않음. 모든 번호를 실제 페이지로 채워야 한다는 뜻은 아님.
- **별도 페이지 100:** [Guest 인증 후보 v0.1](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1320-2)은 사용자 요청 00~99 범위 밖이지만 현행 Auth 의사결정과 연관돼 **보충 검사**함. 8개 편집 가능 시안, Figma Flow/Reactions 0건. 번호 이전/삭제는 승인 전 금지.
- **API로 29개 각 페이지를 읽음:** Figma Plugin API의 Page.current, findAll, \`node.reactions\` 및 \`actions\`, \`page.flowStartingPoints\`, \`prototypeStartNode\`, 내부 NODE 목적지 ID, TEXT 폰트·textStyle/boundVariables, fills 색상 변수·명시적 Light/Dark 모드, 루트 화면 수·이름·크기.
- **대표 스크린샷 육안 검사:** 98-09 Hover, 98-10 Panel, 80-01 Guest, 93 YU-01 Dark 로그인 및 보충 100번 Auth 후보.
- **Figma 노드 총량:** **42,254개**, Reaction **484개**, NODE 이동 **381개**, URL 외부 이동 **103개**, Flow 시작점 **25개**. Reaction 존재 페이지 8/29, 내부 NODE 이동 존재 페이지 6/29. **이 수치들은 UI 완성도/성능 점수 아님**.
- **미확인/한계:** Figma Present 모드 사용자 직접 시연, 외부 URL 열림 상태, WCAG 대비 자동 검사, 각 브레이크포인트의 픽셀 전수 QA, 진짜 로그인·DB·YouTube API/Chrome 통합. NODE 목적지는 같은 페이지 내부 소속과 타 페이지 존재를 확인한 범위에서만 판단한다.

## 2. 페이지별 조사 원표

\`NODE/URL\` = Figma Reaction의 NODE 이동 액션 수 / URL 이동 액션 수; \`Start\` = 명시된 Figma Flow 시작점 수. 정적 가이드/보존용 페이지에 Reaction 0건이라는 이유만으로 결함을 부여하지 않는다.

| 페이지 | 목적 분류 | 레이어 노드 | NODE/URL | Start | 판정 및 정리 포인트 |
|---|---|---:|---:|---:|---|
| [00](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1690) | guide/onboarding | 20 | 0/0 | 0 | 가이드 정합(정적 정상) |
| [01](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1691) | guide/principles | 38 | 0/0 | 0 | 가이드 정합(정적 정상) |
| [02](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1692) | guide/tokens | 1,432 | 0/0 | 0 | 토큰 정본(정적 정상) |
| [03](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1693) | guide/components | 1,528 | 0/0 | 0 | 컴포넌트 예시(정적 정상) |
| [04](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1694) | guide/dataviz | 642 | 0/0 | 0 | Steam/게임 예시 현행성 재검토 |
| [05](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1695) | guide/status | 144 | 0/0 | 0 | 가이드 정합(정적 정상) |
| [06](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1696) | guide/a11y | 308 | 0/0 | 0 | 가이드 정합(정적 정상) |
| [07](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1697) | guide/content | 66 | 0/0 | 0 | 가이드 정합(정적 정상) |
| [08](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=362-2) | guide/development | 78 | 0/0 | 0 | 개발 가이드(정적 정상) |
| [09](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=418-19) | guide/layout | 576 | 0/0 | 0 | 반응형 기준(정적 정상) |
| [10](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=424-2) | guide/responsive-legacy | 4,848 | 0/0 | 0 | 1440 게임 예시 현행성 |
| [11](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=476-2) | guide/responsive-legacy | 4,690 | 0/0 | 0 | 1280 게임 예시 현행성 |
| [12](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=487-2) | guide/responsive-legacy | 4,458 | 0/0 | 0 | 1024 게임 예시 현행성 |
| [13](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1177-10) | component/master | 1,830 | 0/10 | 0 | 활성 공통 컴포넌트; URL 10건 |
| [14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1177-11) | guide/themeQA | 130 | 0/0 | 0 | Light/Dark 테마 검수 자료 |
| [80](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-2) | product/role-customer | 222 | 0/0 | 0 | Guest/개인 3화면 정적; Guest 문구 구버전 |
| [81](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-3) | product/role-organization | 148 | 0/0 | 0 | 조직 2화면 정적; 토큰 부족 |
| [82](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-4) | product/role-platform-admin | 152 | 0/0 | 0 | 플랫폼 2화면 정적; 토큰 부족 |
| [83](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-5) | product/role-qa | 150 | 0/0 | 0 | QA 2화면 정적; 토큰 부족 |
| [90](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=0-1) | legacy/pilot-prototype | 9,837 | 80/18 | 10 | 게임 Pilot 인터랙티브 참고 |
| [91](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=858-10) | legacy/weekly-prototype | 948 | 16/18 | 1 | 경쟁게임 주간 분석 참고 |
| [92](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1136-3886) | legacy/operations-prototype | 2,804 | 11/18 | 1 | 90번 외부 참조 11건 검증 필요 |
| [93](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1159-10) | demo/react-ui-prototype | 2,588 | 228/18 | 0 | 클릭 228건, 명시적 Start 0 |
| [94](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1177-12) | product/public-entry | 277 | 0/21 | 0 | URL 링크 21건, 내부 NODE 0 |
| [95](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1044-10) | archive/presentation-style | 49 | 0/0 | 0 | 발표용 보존 |
| [96](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1044-11) | archive/presentation-prototype | 1,759 | 34/0 | 8 | 발표용 전환 34건, 제품 UX 아님 |
| [97](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1044-12) | archive/presentation-evidence | 61 | 0/0 | 0 | 발표 근거 자산 보존 |
| [98](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-2) | product/chrome-ux | 2,203 | 12/0 | 5 | 핵심 Chrome UX 연결 일부 불일치 |
| [99](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=343-1698) | archive/deprecated | 268 | 0/0 | 0 | Deprecated 보존 |

## 3. 명확한 현행 제품 문제 및 권고

### AUD-P0-01 · [98] 최신 시안 경로가 끊겨 있음

- Figma [98-09 Latest Hover](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-2)에서 '더보기' 반응 노드 \`1276:215\`는 [구형 98-03 Panel](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-5) (\`1253:5\`)을 목적지로 지정함.
- 최신 [98-10 Reviewed Panel](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217) (\`1276:217\`)에는 페이지 내부 **들어오는 NODE 전환이 0건**. 98-10 자신에게 '닫기'·'구독' outbound 2개가 있어도 고객이 공식 경로로 도달할 수 없음.
- 첫 Flow 98-01(\`1253:3\`)에서 실제 NODE로 도달 가능한 상위 프레임은 **98-01/98-02/98-03/98-06 네 개**. 98-04/05는 별도 시작점, 98-09도 별도 시작점이 있고 98-10은 시작점도 없음.
- **보완:** Figma 정본 승인을 거쳐 98-09 더보기를 98-10에 연결하고, 공식 최신 고객 Flow가 98-01 → 최신 Hover → 최신 Panel → 닫기/기본 데이터 없음·채널 시나리오로 자연스럽게 이어지는지 Present 모드 인수. **이번 감사에서 Figma Reaction 수정은 하지 않음.**

### AUD-P0-02 · [80~83] 역할별 화면 9개가 전부 정적

- [80](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-2): Guest/개인 기본/개인 구독 3프레임.
- [81](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-3): 팀 구성원/조직 관리자 2프레임.
- [82](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-4): 플랫폼 운영·정책 관리자 2프레임.
- [83](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-5): DEV/QA 2프레임.
- **4개 페이지 모두 Flow 0건, Reaction 0건**. 화면 자체는 편집 가능한 Figma 정적 디자인이며 UI 시각적 존재는 확인했지만, 역할별 클릭 여정은 아직 검증할 수 없음.
- **보완:** 고객 웹 Guest→일반 고객→조직 접근과 운영 Admin·DEV/QA를 별도 역할별 Flow로 시연. Admin/QA 로그인을 Chrome Extension에 추가하지 않음. 서버 권한 작동과 Figma 화면 전환 증거를 분리.

### AUD-P1-03 · [93] 클릭 연결은 많지만 Prototype 시작점이 없음

- [93 핵심 서비스 UX](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1159-10): YU-01~12 Dark/Light **24개 화면 프레임** + Dark/Light Product Journey 2개.
- 실제 \`ON_CLICK\` Reaction 246건 중 **NODE 이동 228건**, URL 18건. 24개 기능 화면에는 in/out NODE 링크가 존재하지만 **\`flowStartingPoints=[]\`, \`prototypeStartNode=null\`**.
- **보완:** 대표 시작 화면·Dark/Light 전환·성공/실패/취소 경로를 합의한 뒤 Flow Start를 지정하고 Figma Present 모드로 실행 검증.
- YU-01 로그인 실제 글자 \`게임 운영을 위한 분석·검증·의사결정 지원\`, \`게임의 목소리를 더 나은 의사결정으로\`, \`서비스를 이용하려면 로그인하세요\`가 남아 있어 최신 범용 YouTube 및 **Guest-first** 정책과 불일치. 기존 React YU-01~12 데모와 최신 고객 Chrome UX의 역할을 분리·마이그레이션해야 한다.

### AUD-P1-04 · [92] 11개 외부 페이지 NODE 전환, 목적지는 90에 있음

- [92 운영·권한·품질 설계](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1136-3886)에서 NODE 액션 11건 모두 페이지 92 내부에 목적지 없음.
- 추적 결과 목적지 ID 5개 (\`18:18442\`, \`18:19078\`, \`18:19297\`, \`18:18707\`, \`622:1940\`)가 **[90 레거시 Pilot](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=0-1)에 실제 존재**. 원본 자체가 삭제된 링크라고 판정하지 않음.
- 이 연결이 Figma Present에서 정상적으로 페이지를 넘어가는지는 미검증. 제품 관리자 Flow가 옛 게임 Pilot로 향하는 구조는 고객/관리자 시안의 정본 역할과 충돌하므로 **의도된 연구용 외부 참조인지 우선 판별**. 실서비스 운영 프로토타입이라면 대상 페이지 내 새 관리 Flow로 연결하거나 별도 승인된 URL 외부 참고로 분리.

### AUD-P1-05 · 최신 디자인에서 토큰·타이포그래피가 일관되지 않음

| 범위 | 조사된 실제 텍스트/토큰 상태 | 검수 관점 |
|---|---|---|
| 00~12·14 | Dark/Light 안내 프레임과 의미 변수 바인딩 중심. 10번 텍스트 1,686개 중 1,656개가 어떤 Figma 변수에 바인딩됨 | 공통 가이드·브레이크포인트 기준 비교적 체계적 |
| 80~83 | **텍스트 총 393개 중 텍스트 스타일 적용 0개, 텍스트 변수 바인딩 0개.** Solid fill의 고정 RGB 항목 619개, 색상 변수 바인딩 48개 | 디자인 토큰 자동 갱신·Dark/Light parity에 위험 |
| 93 | 텍스트 962개 중 변수 바인딩 918개, 텍스트 스타일 적용 330개 | 기존 기준을 상당 부분 사용 |
| 98 | 텍스트 996개 중 변수 바인딩 **154개**, 텍스트 스타일 적용 0개. Solid fill 고정 RGB 1,679개/색상 변수 바인딩 259개, 컴포넌트 INSTANCE 0개 | 활성 Chrome UX 최신 카드·Panel의 재사용/테마 유지보수 위험 |
| 보충 100 | 텍스트 120개 중 변수 바인딩 120개, 텍스트 스타일 적용 101개, 컴포넌트 INSTANCE 9개 | 신규 로그인 후보도 현행 제품 토큰과 연결 가능함을 보여주는 비교 기준 |

수치는 변수·스타일 속성 사용 통계다. **바인딩이 적다는 이유만으로 대비/폰트 색상이 현재 틀렸다는 판정은 아님**. UI 후보를 재사용 가능한 컴포넌트/의미 변수/텍스트 스타일로 점진적으로 치환하고 변경 전후 스크린샷을 비교해야 한다.

### AUD-P1-06 · 테마, 정보 구조, 고객 메시지의 단절

- 80/81 고객·조직 총 5화면은 **Light 모드**, 82/83 관리자·QA 4화면은 **Dark 모드**만 존재한다. 동일 역할 화면의 Dark/Light 대응본이 없어 모드 동등성 검증 불가.
- 93은 YU-01~12에 Dark/Light 쌍이 있고 98은 Light/Dark 구성이 시나리오별로 섞여 있다. 특히 98-07/08 상위 프레임은 이름에 Dark/Light가 있으나 상위 노드의 \`explicitVariableModes\`는 직접 확인되지 않아 상속 및 실제 렌더 색상 재검토 필요.
- Figma [98-10](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217) 실제 탭 **4개: 요약 / 주요 주제 / 기간 흐름 / 근거**. 보충 [100 인증 후보 Side Panel](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1321-21)은 **3개: 요약 / 주제 / 추이**. 최근 계획의 3탭 방향과 정확히 어떤 설계를 정본으로 삼을지 정보 구조 의사결정 필요.
- Figma 98-09의 고객 카드 텍스트에 **'MOCK · 실제 댓글 조회·분석 없음'**, 98-10에 **'MOCK'** 배지가 표시된다. 현재는 시연·연구용 안내로 유효하나, 최종 고객 UI에서는 내부 기술 용어를 과도하게 보여주지 않는 승인 방향과 분리하여 처리해야 한다. 실제 승인된 데이터가 없으면 가상의 감성 숫자를 실데이터로 위장해서도 안 됨.
- 80-01 Guest 화면에는 **'결정 대기', '로그인 없는 조회 가능 여부는 미확정'**이 남아 있다. 현재 [Guest-first 승인 정책](../../product-v0.2/GUEST_AUTH_CONTEXT_RESTORE_UX_20261021.md)과 문구 정렬 필요.
- 04·10~12/13/90~93에서 게임·Steam·NEXUS 등의 이전 목적 특화 용어가 확인된다. 90~92와 95~97은 **레거시·연구/발표 보존**으로 표기해 그대로 유지할 수 있으나, **93 현재 제품 화면/00~12 활성 가이드**에 섞인 게임 전용 용어는 범용 YouTube로 정리해야 한다.

## 4. 페이지 분류·정리 방안 (제안, 실행하지 않음)

| 그룹 | 페이지 | 유지할 역할 | 작업 |
|---|---|---|---|
| Foundation | 00~09 | 소개·원칙·토큰·컴포넌트·상태·접근성·가이드 | 대체로 보존. 최신 범용 YouTube 데이터 정의로 예시 점검 |
| Responsive/Library | 10~14 | 1440/1280/1024 반응형·컴포넌트 정본·테마 QA | 10~12 게임 화면 예시는 레거시 레이블 or 신 UI 기준 교체; 디자인 변수/테마 Gate |
| Customer/Role | 80~83 | Guest, 개인, 조직, 플랫폼 관리자, QA 고객·운영 웹 | 역할별 Prototype 신규 연결, 고객과 운영·QA 경계 확정, 양 테마 대응 |
| Legacy Research | 90~92 | 게임 Pilot·반복 관측·구 운영 탐색 참고 | 데이터·스타일 참조는 유지하되 최신 고객 기본 Prototype의 시작점에서 제외, 92의 90 외부 의존 재검토 |
| Current UI Demo | 93 | React YU-01~12 시각 자산 | Flow Start 지정, 게임/강제 로그인 복사 정리, 현재 Chrome 중심 제품에서 Web Workspace 데모로 역할 확정 |
| Public Info | 94 | 공개 소개/출처 안내 | URL 액션 21건만 존재 → 페이지 안의 독립 UX Prototype인 것처럼 주장하지 않음 |
| Preserved Presentation | 95~97 | 발표·데모 스크립트·근거 자산 | 삭제·덮어쓰기 없이 ARCHIVED/REFERENCE 유지; 96의 발표 Prototype 34건은 제품 기능과 별도 판정 |
| Chrome Mainline | 98 | 현행 제품 핵심 Hover→Side Panel | 최신 98-09↔98-10 연결 재검증/입력·대상 고정·Guest 인증 복귀 포함한 시연 가능 Flow 확정 |
| Deprecated | 99 | 사용 중단 컴포넌트/호환 근거 | 삭제 금지, 신규 사용 차단 유지 |
| Outside scope | 100 | 2026-10-21 Guest 인증 UX 후보 8화면 | 별도 디자인 후보로 유지. 00~99 범위에 편입/번호 이동은 별도 승인 후 결정 |

**현재 존재하지 않는 15~79, 84~89 페이지를 숫자만 맞추기 위해 임의 생성하지 않는다.** 정리 시에도 기존 링크·노드 참조/Code Connect·제품 역할을 보존한다.

## 5. UX Prototype 구현 현황: 무엇이 실제 있고 무엇이 없는가

| 범위 | 정적 Figma Reaction 증거 | 판정 |
|---|---|---|
| 98 Chrome Hover/Panel | ON_HOVER 1 + ON_CLICK 11, NODE 12, Flow 시작점 5 | **PARTIAL_PROTO_WIRED**: 기본 시나리오와 보조 시나리오 일부 연결. 최신 98-10 진입은 미연결 |
| 93 React YU-01~12 UI | ON_CLICK 246(내부 NODE 228, URL 18), Flow 시작점 0 | **CLICK_WIRED / START_NOT_DEFINED** |
| 80~83 고객/조직/운영/QA | React/운영 역할 시안 9개, NODE/URL 0, Flow 시작점 0 | **STATIC_ONLY / PROTOTYPE_NOT_CONFIGURED** |
| 90,91 과거 연구 Pilot | 90: NODE 80 / URL 18 / Start 10. 91: NODE 16 / URL 18 / Start 1 | **LEGACY_PROTO_WIRED**, 현재 제품 정본 아님 |
| 92 과거 운영·권한 | NODE 11(모두 90번 외부 목적지), URL 18, Start 1 | **LEGACY_CROSS_PAGE_LINKS_REVIEW_REQUIRED** |
| 94 공개 진입 | URL 21, NODE 0, Start 0 | **EXTERNAL_LINKS_ONLY**, 독립적인 화면 전환 Flow는 없음 |
| 96 과거 발표 데모 | NODE 34, Start 8 | **PRESENTATION_PROTO_WIRED**, 고객 앱·확장 기능이 아님 |
| 00~14 가이드·99 보존 | 대부분 Reaction 0. 단 13번 공통 내 URL 10개 | **STATIC_DOCUMENTATION**, Prototype 필수 아님 |
| 100 Auth UX 후보(범위 밖) | 후보 8화면, Reaction 0, Flow 시작점 0 | **EDITABLE_DESIGN_ONLY**, 로그인 시연/실제 인증 아님 |

**현행 코드와 Figma도 분리해서 검증**했다.
- [React routeDefinitions.ts](https://github.com/Choi1999/YOUTOPIA/blob/frontend/frontend/src/app/routeDefinitions.ts): YU-01~12 라우트 목록이 실제 존재하나 로그인·OAuth·데이터 분석은 로컬 시뮬레이션. 93번의 클릭 Prototype은 React 앱/서버 동작의 실행 증거가 아님.
- [extension/manifest.json](https://github.com/Choi1999/YOUTOPIA/blob/frontend/extension/manifest.json): MV3 Side Panel 선언과 Hover Content Script 존재.
- [extension/sidepanel.js](https://github.com/Choi1999/YOUTOPIA/blob/frontend/extension/sidepanel.js): Side Panel은 로컬 DEMO 스켈레톤으로, 선택 대상 동기화·상세 차트 **미구현을 소스 주석이 직접 명시**.
- [PR #15 YU-27 Worker](https://github.com/Choi1999/YOUTOPIA/pull/15)은 Draft·미병합. 이전 사용자 Windows Native Node 177/177 및 오프라인 Chromium 2/2 PASS 기록이 있으나 설치형 Chrome MV3의 현행 버전 완전 통합 QA와 YU-28 Side Panel 대상 고정의 구현·PASS는 확인되지 않았다.

## 6. 정리 순서 / 이행 전 Gate

1. **FPA-01 페이지 목적/정본 Registry 승인:** Foundation 00~14, 80~83 역할 UI, 90~92 Legacy, 93 React 자산, 94 공개, 95~97 보존, 98 Chrome, 99 Deprecated, 100 별도 후보 구분. 모든 페이지/최상위 프레임에 KEEP / REFERENCE / CANDIDATE / DEPRECATED 라벨 후보.
2. **FPA-02 현행 UX 화면 연결 정리:** 98-09 더보기→98-10 지정, 직접 들어갈 수 없는 최신 Panel 0건, Home/영상/채널/미확보/로그인 복귀 등 정상·실패 Flow 설계. **원본 반응 변경은 사전 승인 이후**.
3. **FPA-03 각 역할별 UX Flow 구성:** 80~83에서 고객/조직/플랫폼 Admin/QA 시작점을 각각 별도 제공하고, P-13 고객 Chrome/관리자 웹/QA 웹 보안 경계 UI를 명확화.
4. **FPA-04 서비스 웹 시작점 확정:** 93에서 대표 시작점을 지정하고 YU-01 로그인 문구를 Guest-first와 범용 YouTube 제품 동선에 맞게 정렬. 레거시 Demo는 삭제하지 않고 역할 변경.
5. **FPA-05 토큰·모드 정책 검수:** 80~83/98의 임의 RGB/미바인딩 텍스트 스타일을 단계적으로 공통 변수에 연결. Light/Dark 스크린 동등성 테스트, 색/문구/상태 parity 기록.
6. **FPA-06 Mock/QA와 운영 고객 콘텐츠 분리:** 합성 숫자·MOCK 표현이 고객 실데이터처럼 제공되지 않도록 QA 별도 시안과 운영 customer view 상태 문구 분리.
7. **FPA-07 레거시 링크 정리:** 92→90 목적지 5개/액션 11개를 Present 모드에서 직접 열어 보고 의도된 참조면 표시, 실제품 흐름이면 새 목표/명시 URL로 교체.
8. **FPA-08 프로토타입 실사용성 테스트:** Figma Present 모드에서 마우스 Hover/더보기/닫기, 탭 전환·Light/Dark·Guest/로그인·관리자 분리, 키보드·좁은 폭을 실제 사용자 동선으로 실행.
9. **FPA-09 소스/테스트 증거 연결:** 각 개선 Figma Node → 변경 기록 → 연결 ID/Flow 이름 → Figma 스크린샷/Present 실측 로그 → FE/BE 코드 실제 SHA·테스트 결과를 분리 연결.
10. **FPA-10 파괴적 변경 금지:** 기존 승인 프레임 삭제·이동·덮어쓰기, 99 Deprecated 제거, 발표 95~97 삭제, 현재 100 번호 변경은 별도 명시적 승인/참조 영향 분석 뒤 수행.

**합격 정의:** 실제 제품에 필요한 화면마다 일관된 문구/토큰/모드/역할, Figma 시작점, 성공·실패·취소 경로의 기대했던 NODE 연결이 있고, 직접 Figma Present 모드에서 테스트한 근거가 있다. **그 뒤에도 React/Chrome/서버의 동작은 별도 실제 통합 테스트가 필요**하다.

## 7. 작업/증거의 현재 판정

| 단계 | 현재 판정 |
|---|---|
| Figma 00~99 페이지 인벤토리 | **29/29 읽기 완료** |
| 노드 Reaction·Flow 구조 검사 | **29/29 정적 검증 완료** |
| 스타일·변수·테마 대표 샘플 | **80~83/93/98 및 일부 Foundation 검사**, 전체 노드별 시각 대비 PASS 아님 |
| 대표 스크린샷 육안 검토 | **98-09/98-10/80-01/93 YU-01 및 100 후보** |
| 92 NODE의 외부 목적지 실존 여부 | **5/5의 ID가 90 레거시에 존재** (동작 실제 시연은 NOT_RUN) |
| 실제 Figma Prototype Present 모드 전환 시연 | **NOT_RUN** |
| 실제 Chrome MV3·React·BE 서버 통합 테스트 | **NOT_RUN in this audit** |
| Figma 페이지 삭제·재명명·이동·연결 수정 | **NONE — 사용자 검수 승인 전 보존** |

> **최종 판정:** \`FIGMA_00_99_STRUCTURE_AUDITED\`, \`FIGMA_INTERACTION_WIRING_PARTIAL\`, \`PRODUCT_UX_CONSISTENCY_FIX_REQUIRED\`, \`PRESENT_MODE_NOT_RUN\`, \`NO_FIGMA_MUTATION\`.
