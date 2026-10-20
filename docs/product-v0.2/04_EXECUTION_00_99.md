# YUTOPIA 00~99 순차 실행대장 v0.2

> **EXECUTION_LEDGER_DRAFT · 100 STEPS DEFINED / NOT ALL COMPLETED**
>
> 사용자 지시: “00~99 순서에 맞게 진행”. 작업 순서, 산출물과 검증 기준을 아래처럼 고정한다. **00~99를 한 번에 전부 구현했다는 뜻이 아니다.** 상태는 변경될 때마다 근거를 확인하고 갱신한다. 선행 단계가 정책 승인·안전성·실제 서버 접근을 필요로 하는 경우 **해당 변경만 차단**하고, 독립 가능한 문서·모의 UX 작업은 진행한다.

## 실행 원칙

- **번호:** `00`부터 `99`까지 한 번씩 등장. 새 요구는 해당 단계 하위 기록으로 넣거나 별도 변경 기록.
- **상태:** `NOT_STARTED` / `IN_PROGRESS` / `DOC_DRAFT` / `READY_FOR_REVIEW` / `VERIFIED` / `BLOCKED_EXTERNAL_GATE`. 정책 방향 승인과 코드 검증은 다른 의미.
- **증거:** 파일 경로·commit SHA·실행한 테스트 명령과 결과를 남기지 않은 작업은 `VERIFIED`로 표시하지 않음.
- **기준:** 26번 브랜치 시작 시점 frontend HEAD `20edd746e25dc82296a220716bf57c8c66cc5b3`(25번 PR #12 병합 후). 기존 `7f236feee061d1eac49a3ea4c0164951064a24a7`, `0a255f224e4213c577651fcc34b2b68c6532a069` 및 P0-1은 역사적 참조. 고객 시작점은 YouTube 홈의 여러 썸네일 Hover.
- **안전:** 이전 Codex 개발·브랜치·Figma/Notion을 임의 덮어쓰지 않음. 새 코드 작업은 독립 feature PR.
- **외부:** 결제 실행, 실제 YouTube 수집/파생 감성, Chrome Web Store 공개, 배포/병합은 별도 정책·권한/담당 승인.
- **진행:** 각 단계 완료 후 다음 번호로 진행. 이후 대화·작업 세션에서 이 대장을 기준으로 이어가기.

## 현재 시작 상태

- **00:** 사용자가 제품 방향을 승인했고 `00_PRODUCT_DIRECTION.md` 초안이 작성됨.
- **01~03:** 사용자 승인 방향과 프론트 소스를 반영한 문서 초안이 작성됨. UX 세부와 기술 스택·권한은 검토 필요.
- **04:** 00~99 순서, 산출물, 현재 상태를 정의하는 본 문서(초안 작성 완료, 외부 검토 필요).
- **05~09:** 제품 정의 세부/게이트 **문서 초안 작성**. **10~19:** YouTube 홈, Hover·Side Panel의 **UX 문서 초안 작성**, 시각·실브라우저 미검증. **20:** MV3 스켈레톤 PR #6 병합. **21:** PR #8 영상 후보 탐지 frontend 병합. **22:** PR #9 SPA/무한 스크롤 자동 재탐지 frontend 병합. Node CLI 25/25 및 Chromium 오프라인 PASS; Windows Chrome 수동 7/7 PASS는 사용자 보고(원본 로그·검증 SHA 미제출). **23:** PR #10 엄격 VIDEO ID Resolver frontend 병합, Node CLI 46/46·Windows 기능 검증은 사용자 보고(테스트 SHA 일치, 원본 로그 미제출). **24:** PR #11 채널 ID·@handle 식별 코드 frontend 병합, V8 78/78 PASS 및 Windows PASS·테스트 SHA 일치는 사용자 보고(원본 로그 미제출). **25:** PR #12 상태 제어 코드 frontend 병합, V8 118/118 PASS 및 Windows 수동 PASS/테스트 SHA·Clean Worktree는 사용자 보고(원본 로그 미제출). **26:** Shadow DOM 실제 카드 UI와 고정 합성 지표/브리핑·검증 테스트 개발, 전체 V8 173/173 PASS. 이전 Head Native Node 152/152·Chromium 오프라인 PASS, 실제 Chrome 동일 영상 재진입 누락 후 문서 포인터 경계/억제 상태 복구 보강 및 재검증 대기. **27~99:** 후속 기능 실제 구현·검증 완료 아님. 실행대장 자체의 작성은 실서비스 동작 증거가 아님.

## 00~99 상세 작업

### 00~09 · 제품 방향과 안전한 설계 정본

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **00** | Chrome 기반 YouTube 반응분석 제품 정의 | 영상·채널 Hover→패널→구독 가치·분석 한계 정리 | `DIRECTION_APPROVED / DOC_DRAFT` | `00_PRODUCT_DIRECTION.md` |
| **01** | 데스크톱 YouTube 홈 사용자 여정 | 추천 영상 여러 개, hover 카드, 더보기→측면 분석 계약 | `UX_DOC_DRAFT` | `01_HOVER_SIDE_PANEL_UX.md` |
| **02** | 고객/구독/운영 역할 분리 | 고객·고객 조직 관리자·플랫폼 운영·QA 권한 경계 | `POLICY_DOC_DRAFT` | `02_ROLES_AND_SUBSCRIPTION.md` |
| **03** | 기존 P0-1 데모 보존·재배치 | YU-01~12 유지·고객/운영/QA 재사용표 및 변경 게이트 | `MIGRATION_DOC_DRAFT` | `03_MIGRATION_AND_GATES.md` |
| **04** | 순차 실행대장 00~99 작성 | 100개 ID·의존 순서·산출물·검증 상태 표시 | `DOC_DRAFT` | `04_EXECUTION_00_99.md` |
| **05** | 분석 모집단·데이터 가용성 기준 | 진짜 0/미확정·부분·stale·차단/표본 설명 | `DOC_DRAFT` | `05_DATA_MEANING_AND_LIMITS.md` |
| **06** | 핵심 고객 시나리오/실패 여정 | 일반 영상·채널 Hover, 더보기, 미제공·오류 흐름 | `DOC_DRAFT` | `06_CUSTOMER_JOURNEY_CASES.md` |
| **07** | 표면별 고객/관리/QA 메뉴 분리 | 공개/조직/플랫폼 관리자/개발 화면 권한표 | `DOC_DRAFT` | `07_SURFACE_ACCESS_MATRIX.md` |
| **08** | 우선 결정·리스크·정책 책임자 등록 | 요금·관측 허용·브라우저 API·보안 개방 판단 기록 | `DOC_DRAFT` | `08_DECISION_AND_RISK_REGISTER.md` |
| **09** | 제품 방향 검수·다음단계 인계 | P0 UX 수용 기준과 미결정 공백 목록 잠금 | `DOC_DRAFT` | `09_PRODUCT_GATE_CHECKLIST.md` |

### 10~19 · Hover 카드·Side Panel 상세 UX

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **10** | YouTube 홈 다중 썸네일 레이아웃 | 홈 카드 사이 간격·마우스 이동·카드 위치 설계 | `DOC_DRAFT` | `시각 와이어프레임` |
| **11** | 영상 Hover 카드 콘텐츠 계층 | 제목/감성/쟁점/표본/갱신시각/더보기 정보 구조 | `DOC_DRAFT` | `정보 구조 시안` |
| **12** | 영상 Hover 감지 행동 계약 | 짧은 지연·연속 hover·취소·경계 밖 위치 | `DOC_DRAFT` | `상태도` |
| **13** | 채널 Hover 구별 계약 | 채널 ID vs @handle·대상 선정 영상 고지 | `DOC_DRAFT` | `채널 카드 상태도` |
| **14** | 감성 요약 차트 UI | 불명확한 분모·미분류·0/미확정 처리 | `DOC_DRAFT` | `차트 사양` |
| **15** | 간단한 브리핑 UI | 2문장 이내·관측 표현/원인 주장 분리 | `DOC_DRAFT` | `문구/근거 템플릿` |
| **16** | 로딩·부분·삭제·정책 차단 UI | 데이터 없는 상태에 임의 수치 금지 | `DOC_DRAFT` | `상태별 디자인` |
| **17** | 더보기 CTA·분석 대상 고정 | 사용자 클릭·영상/채널 ID 전달·빠른 hover 경합 | `DOC_DRAFT` | `인터랙션 계약` |
| **18** | Side Panel 상세 정보 구조 | 요약/의견/쟁점/근거/추세/구독별 깊이 | `DOC_DRAFT` | `패널 레이아웃` |
| **19** | 키보드·접근성·화면 경계 검수 | Tab/Enter/Escape·줌·다크/라이트·모서리 배치 | `DOC_DRAFT` | `UX 승인 체크리스트` |

### 20~29 · Chrome 확장 고객 UI 프로토타입

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **20** | Chrome MV3 확장 격리 스켈레톤 | 최소 권한·실제 API 없음·브라우저 검증 별도 | `SKELETON_MERGED / USER_REPORTED_CHROME_SMOKE_PASS` | `extension/`(manifest/background/content/sidepanel), [PR #6](https://github.com/Choi1999/YOUTOPIA/pull/6) |
| **21** | YouTube 콘텐츠 스크립트 삽입 | 홈/검색에서 요소 감지·중복 설치 방지 | `MERGED / NODE_TESTED / USER_REPORTED_WINDOWS_PASS` | `extension/content.js`, [검증 기록](../../extension/tests/QA_20_21_EVIDENCE.md), `extension/tests/` |
| **22** | 동적 화면 변경 관측 | YouTube SPA/무한 스크롤에서 안전한 해제·재바인딩 | `MERGED / NODE_CLI_TESTED / CHROMIUM_OFFLINE_TESTED / USER_REPORTED_WINDOWS_PASS` | `extension/content.js`, `extension/tests/content-spa-observer.test.cjs`, [QA 22 기록](../../extension/tests/QA_22_EVIDENCE.md) |
| **23** | 영상 대상 식별 | 확실한 videoId 추출 및 잘못된 링크 거부 | `MERGED / USER_REPORTED_NODE_AND_WINDOWS_PASS / TESTED_SHA_MATCH` | [PR #10](https://github.com/Choi1999/YOUTOPIA/pull/10), `extension/target-resolver.js`, [QA 23 기록](../../extension/tests/QA_23_EVIDENCE.md) |
| **24** | 채널 대상 식별 | channelId/@handle 구별·불확실 시 유보 | `MERGED / V8_FIXTURE_TESTED / USER_REPORTED_WINDOWS_PASS / TESTED_SHA_MATCH` | [PR #11](https://github.com/Choi1999/YOUTOPIA/pull/11), `extension/channel-target-resolver.js`, [QA 24 기록](../../extension/tests/QA_24_EVIDENCE.md) |
| **25** | Hover 상태 제어 | 타이머·마우스 카드 이동·연속/겹침 요청 취소 | `MERGED / V8_FIXTURE_TESTED / USER_REPORTED_WINDOWS_PASS / TESTED_SHA_AND_CLEAN` | [PR #12](https://github.com/Choi1999/YOUTOPIA/pull/12), `extension/hover-controller.js`, [QA 25 기록](../../extension/tests/QA_25_EVIDENCE.md) |
| **26** | 경량 Hover 카드 UI | 고정 합성 데이터·출처 배지·더보기 안내 | `IN_PROGRESS / SHADOW_DOM_IMPLEMENTED / V8_172_TESTED / LATEST_NODE_AND_CHROMIUM_AND_LIVE_CHROME_QA_PENDING` | `extension/hover-card-model.js`, `extension/hover-card.js`, `extension/tests/hover-card-ui.test.cjs`, [QA 26 기록](../../extension/tests/QA_26_EVIDENCE.md) |
| **27** | 확장 서비스 워커 메시지/캐시 | targetId·requestId 검증과 권한 최소화 | `NOT_STARTED` | `background tests` |
| **28** | Chrome Side Panel 연동 | 사용자 클릭 제스처로 열기·동일 대상 유지 | `NOT_STARTED` | `panel smoke` |
| **29** | 실제 YouTube 홈 수동·자동 PoC | 선정 브라우저에서 카드 위치·패널·충돌 체크 | `NOT_STARTED` | `Chrome local QA` |

### 30~39 · 영상·채널 대상과 데이터 계약

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **30** | AnalysisTarget 공통 모델 | VIDEO/CHANNEL/source id 안정적 스키마 | `NOT_STARTED` | `shared types` |
| **31** | 영상/채널 리소스 응답 계약 | 제목·표본·출처·사용권·갱신시각 | `NOT_STARTED` | `API DRAFT` |
| **32** | Hover 요약 캐시 계약 | 적중/미적중·기간·stale과 리프레시 기준 | `NOT_STARTED` | `cache contract` |
| **33** | Side Panel 상세 응답 계약 | 요약 vs 확장 세부·근거/권한 분리 | `NOT_STARTED` | `API DRAFT` |
| **34** | 출처 계보와 수치 계약 | raw/eligible/excluded/classified/null/0 및 버전 | `NOT_STARTED` | `data contract` |
| **35** | 기간/대상 Scope 계약 | 영상 수·채널 수·조회 기간·선정 규칙 | `NOT_STARTED` | `scope model` |
| **36** | 댓글 삭제/비공개/금지 처리 | DELETED/ACCESS_DENIED/NO_DATA 차이 | `NOT_STARTED` | `lifecycle contract` |
| **37** | API 인가·요청 중복 방지 | 조직 소유권·idempotency·rate limit 초안 | `NOT_STARTED` | `security/API` |
| **38** | 실데이터 정책 승인 검토 | YouTube API·파생 감성/보관 허용 Gate | `NOT_STARTED` | `policy decision` |
| **39** | 분석 계약 소비자·제공자 검증 | mock API ↔ 실제 provider 경계 테스트 | `NOT_STARTED` | `contract test suite` |

### 40~49 · 분석·근거·신뢰도

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **40** | 분류/쟁점 분석 도메인 모델 | 감성/주제/다중 라벨·분모 구별 | `NOT_STARTED` | `analysis contract` |
| **41** | 분석 결과의 최신성·상태 | 미수집/부분/오래됨/실패/제외 고지 | `NOT_STARTED` | `state tests` |
| **42** | 안전한 관측 브리핑 생성 | 근거 밖 단정·인과 표현 차단 | `NOT_STARTED` | `briefing policy` |
| **43** | 영상별 상세 감성 그래프 | 표본·분석 대상·미분류 한계 표시 | `NOT_STARTED` | `detail UI` |
| **44** | 채널별 선정 영상군 집계 | 채널 전체로 일반화 금지·영상 범위 제공 | `NOT_STARTED` | `channel analysis` |
| **45** | 다중 영상 비교의 동등성 | 게시일/코호트/기간 비교 기준 | `NOT_STARTED` | `comparability tests` |
| **46** | 원문 증거의 가용성/계보 | 현재 권한·실제/합성·삭제·출처 구분 | `NOT_STARTED` | `evidence schema` |
| **47** | 주장 관측/검증 분리 | 관측 불만 ≠ 실제 결함, HOLD 승격 차단 | `NOT_STARTED` | `claim gate tests` |
| **48** | 고객용 신뢰 설명·피드백 | 내부 코드는 감추고 근거/제외 이유 설명 | `NOT_STARTED` | `trust UI` |
| **49** | 품질/대표성 한계 검수 | 영상/채널 댓글 참여자 편향 고지 | `NOT_STARTED` | `QA report` |

### 50~59 · 구독·고객 신원·이용권

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **50** | 기본/구독 상품 기능 경계 | 기간·범위·저장·비교 기준 가설 | `NOT_STARTED` | `product matrix` |
| **51** | 고객 인증/비로그인 경계 | 정책 승인한 로그인/세션/guest 방식 | `NOT_STARTED` | `auth decision` |
| **52** | 구독 접근 권한 모델 | role·plan·organization 분리 | `NOT_STARTED` | `entitlement schema` |
| **53** | 유료 기능 안내 UX | 막힌 기능 설명·자동 청구 금지 | `NOT_STARTED` | `upgrade UI` |
| **54** | 사용량·조회 제한 계약 | 캐시·쿼터·중복·갱신 규칙 | `NOT_STARTED` | `usage contract` |
| **55** | 유료/무료 응답 분리 | 유료 필드 서버 재검증·정보 누출 금지 | `NOT_STARTED` | `negative tests` |
| **56** | 구독 시작·만료 UI | 결제 공급자 미선정 상태로 시뮬레이션 | `NOT_STARTED` | `subscription state UI` |
| **57** | 결제/환불/개인정보 정책 검토 | 결제 실제 활성화 전 별도 승인 | `NOT_STARTED` | `billing gate` |
| **58** | 계정·조직 권한 회귀 | BOLA·로그아웃·만료·다른 고객 접근 | `NOT_STARTED` | `authz tests` |
| **59** | 구독 제품 인수 게이트 | 한도/가격/약관/정책 증거 서명 | `NOT_STARTED` | `entitlement review` |

### 60~69 · 고객 웹 워크스페이스

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **60** | 고객 워크스페이스 역할 확정 | Chrome 확장으로부터 전달되는 저장/비교용 웹 | `NOT_STARTED` | `customer IA` |
| **61** | 고객 로그인·계정 화면 | 실제 세션 경로와 데모 격리 | `NOT_STARTED` | `customer auth` |
| **62** | 저장한 영상/채널 목록 | 안전한 대상 ID·고객 소유권 | `NOT_STARTED` | `saved items` |
| **63** | 관측 프로젝트/목록 | 게임 전용 용어 제거·범용 채널/영상 중심 | `NOT_STARTED` | `workspace list` |
| **64** | 상세 분석으로 이동 | Hover→Side Panel→웹 대상/세션 일치 | `NOT_STARTED` | `deep-link contract` |
| **65** | 기간·채널 비교 화면 | 선정 범위와 권한 고지 | `NOT_STARTED` | `comparison UI` |
| **66** | 고객용 근거·신뢰 설명 | 제한·삭제·HOLD와 요약의 연결 | `NOT_STARTED` | `evidence UI` |
| **67** | 팀 협업(구독 후보) | 조직 내부 관리자·멤버 승인/감사 | `NOT_STARTED` | `team UX` |
| **68** | 보고서 저장·검토·공유 | 정식 승인·사용권·내보내기 Gate | `NOT_STARTED` | `report workflow` |
| **69** | 고객용 UX 수용 검수 | 운영·QA 메뉴 없음, 핵심 작업 1분 내 탐색 | `NOT_STARTED` | `customer QA` |

### 70~79 · 플랫폼 Admin과 개발/QA 분리

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **70** | 플랫폼 Admin 정보구조 | 고객·정책·수집/처리·운영 탭 분리 | `NOT_STARTED` | `admin IA` |
| **71** | 고객/조직 운영 관리 | 최소 권한으로 고객 지원 | `NOT_STARTED` | `customer ops` |
| **72** | 수집 Job/Worker 진단 | 요청/실패/부분/쿼터/재시도 | `NOT_STARTED` | `job console` |
| **73** | 데이터 품질/정책 운영 | source rights·보존/삭제·감사 | `NOT_STARTED` | `policy console` |
| **74** | 구독/청구 운영 | 민감 정보·환불·운영 경로 분리 | `NOT_STARTED` | `billing console` |
| **75** | 감사·권한 관리 | 행위자·대상·전이·시각 서버 기록 | `NOT_STARTED` | `audit design` |
| **76** | 개발/QA 시뮬레이터 분리 | 강제 실패/데이터 상태/권한 토글을 고객 빌드에서 제거 | `NOT_STARTED` | `qa isolation` |
| **77** | 운영 비밀/환경 분리 | 키·토큰·로그·리포트에 민감값 노출 금지 | `NOT_STARTED` | `secret audit` |
| **78** | 관리자 부정 접근 테스트 | 고객의 /admin 접근, 조직 간 권한 상승 차단 | `NOT_STARTED` | `authorization tests` |
| **79** | 관리 UI 인수 게이트 | 권한 및 운영 증거·관리자 기능 분리 검수 | `NOT_STARTED` | `admin QA` |

### 80~89 · 통합·성능·보안·품질

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **80** | 확장+고객 UX 통합 smoke | 브라우저 홈에서 hover→더보기→패널 연결 | `NOT_STARTED` | `E2E` |
| **81** | 반응 속도·hover 경쟁 테스트 | 연속 포인터 이동·캐시 지연/만료 | `NOT_STARTED` | `performance QA` |
| **82** | YouTube 무한스크롤/SPA 회귀 | DOM 변경·포인터·링크 식별 안정성 | `NOT_STARTED` | `SPA QA` |
| **83** | 키보드·스크린리더·포커스 | 카드 내 더보기/Escape/패널 전환 | `NOT_STARTED` | `a11y QA` |
| **84** | 크기/테마/줌 시각 QA | 다양한 홈 썸네일 위치·다크/라이트·패널 폭 | `NOT_STARTED` | `visual QA` |
| **85** | 권한·구독·리소스 격리 | 유료 기능 서버 거부/내부 화면 무노출 | `NOT_STARTED` | `security tests` |
| **86** | 댓글 데이터 정책·인용 점검 | 원문 보존/삭제·파생 지표 Gate | `NOT_STARTED` | `compliance evidence` |
| **87** | 장애·재시도·복구 테스트 | 원천 quota·권한 회수·삭제·서버 중단 | `NOT_STARTED` | `failure tests` |
| **88** | 브라우저 자원·메모리 누수 | MutationObserver·이벤트 중복·장시간 사용 | `NOT_STARTED` | `resource QA` |
| **89** | 통합 릴리스 후보 검수 | 단위/확장 E2E/실API·계약 증거 레벨 분리 | `NOT_STARTED` | `release test report` |

### 90~99 · 출시 준비와 운영 검수

| ID | 수행 작업 | 해당 작업의 완료 기준 | 상태 | 주요 산출물 |
|---|---|---|---|---|
| **90** | 출시 대상·버전/범위 결정 | 지원 Chrome 버전·YouTube 화면·지역/언어 정의 | `NOT_STARTED` | `release scope` |
| **91** | 개인정보 처리/서비스 약관 | 고객·브라우징 데이터 최소화·삭제 경로 | `NOT_STARTED` | `policy approval` |
| **92** | Chrome Web Store 제출 준비 | 권한 설명·스토어 이미지·개인정보 고지 | `NOT_STARTED` | `store draft` |
| **93** | YouTube API 정책·심사 증거 | 감성 파생 지표 승인·데이터 보존 범위 | `NOT_STARTED` | `approval evidence` |
| **94** | 운영 모니터링·알림 | 수집 오류·성능·고객 유료 기능 장애 | `NOT_STARTED` | `ops runbook` |
| **95** | 지원·신고·데이터 삭제 접수 | 고객 문의/권리 행사 워크플로 | `NOT_STARTED` | `support flow` |
| **96** | 백업·복구·롤백 계획 | 브라우저 확장 업데이트·서버 복구 계획 | `NOT_STARTED` | `rollback drill` |
| **97** | 최종 법무·보안·결제 승인 | 남은 Gate·승인 책임자/날짜·증거 확보 | `NOT_STARTED` | `release decision` |
| **98** | 제한 배포·사용성 검증 | 명시 승인된 시험자에게만 배포 | `NOT_STARTED` | `beta evidence` |
| **99** | 출시 승인·보존·회고 | 승인 기록 후 공개/배포, 미승인 시 보류 | `NOT_STARTED` | `release record` |

## 단계별 Gate와 산출물 경계

| Gate | 진행 조건 | 영향 |
|---|---|---|
| G00 | 제품 방향·대상 고객·YouTube 홈 기반 UX 기록 | 10~19 디자인을 구체화할 수 있음 |
| G10 | 상세 Hover/Side Panel UX·키보드·오류 수용 기준 검수 | 20~29 Extension PoC 착수 |
| G20 | 격리된 Chrome local mock이 브라우저에서 동작하고 회귀 테스트를 통과 | 30~49 데이터 API/분석 계약과 결합 검토 |
| G30 | 데이터 이용권·파생지표 정책 심사/권한·출처 계약 승인 | 실제 YouTube API 데이터 연동 활성화 가능 |
| G50 | 요금제/청구·보호·권한을 사용자/관리자가 결정 | 실제 구독/결제 착수 |
| G80 | Chrome E2E·성능·접근성·권한·수집/분석 증거 통과 | 제한 배포 검토 |
| G90 | 법무/보안/스토어/YouTube 정책/결제/운영 책임자가 승인 | 공개 출시 여부 결정 |

**작업이 완료되는 순간:** `VERIFIED`로 표시하려면 작성물·검증 로그/스크린샷·적용 commit을 남긴다. 정책 승인 여부는 문서 편집이나 테스트를 통과했다고 자동 변경되지 않는다.

## 변경 기록

- **Figma 승인·역할별 연계 기록:** [FIGMA_ROLE_UI_APPROVED_HANDOFF_20261016.md](./FIGMA_ROLE_UI_APPROVED_HANDOFF_20261016.md). Figma 80~83번 9개 정적 화면 승인, 13번 공통 고지 컴포넌트 3변형·9인스턴스 연결. 실행/서버/정책 PASS가 아님.

| 날짜 | 변경 | 영향 |
|---|---|---|
| 2026-10-16 | Chrome 영상/채널 Hover Preview → 더보기 Side Panel, 구독 확장, 고객/운영/QA 분리 방향 승인 | 00~99 정렬 기준 |
| 2026-10-16 | 00~99 100개 번호 및 검증 기준 등록 | 향후 작업 순서 고정 |
| 2026-10-19 | 21 홈·검색 영상 DOM 탐지 및 Fixture 9/9·Chromium DOM 검증 | 기능 코드 준비, 실제 Chrome 확장 Smoke/SPA 자동 갱신/영상 ID 검증은 미완료 |
| 2026-10-20 | 22 SPA·무한 스크롤 재탐지 코드 및 V8 모의 25/25 검증, 별도 Linux Node.js CLI 25/25·오프라인 Chromium SPA Fixture PASS | 이후 Windows Chrome 7/7 수동 PASS 사용자 보고, 원본 로그·SHA 미제출 |
| 2026-10-20 | PR #8 영상 탐지 → PR #9 SPA 자동 재탐지 frontend 순차 병합 | 사용자 승인하에 개발 브랜치 통합, 출시·데이터 사용권 아님 |
| 2026-10-20 | 23 영상 ID 검증 설계·Resolver 및 테스트 작성 | V8 모의 46/46 PASS 이후 Windows/Node 46/46 PASS 사용자 보고 및 테스트 SHA 일치 확인 |
| 2026-10-20 | PR #10 영상 ID 정확성 검증 frontend 병합 | SHA 7f236feee061d1eac49a3ea4c0164951064a24a7, 라이브 API 및 출시 승인 아님 |
| 2026-10-20 | 24 채널 UC ID 형식과 @handle 미매핑 식별기 및 별도 DOM 이벤트 개발 | V8 모의 78/78 PASS 후 Windows 검증 PASS·테스트 SHA 일치 사용자 보고, 독립 로그 미제출 |
| 2026-10-20 | PR #11 채널 ID·@handle 코드 frontend 병합 | Merge SHA 97611f144c8ae074d2e7f5b5f75031ef03d840c6, 출시 승인이 아님 |
| 2026-10-20 | 25 Hover 상태 제어와 가상 타이머·중복 주입·키보드·경합 취소 테스트 작성 | 21~25 전체 격리 V8 모의 118/118 PASS. 이후 사용자 Windows PASS·테스트 SHA 및 Clean Worktree 보고 |
| 2026-10-20 | PR #12 Hover 상태 제어 frontend 병합 | SHA 20edd746e25dc82296a220716bf57c8c66cc5b3, 실제 데이터·출시 승인 아님 |
| 2026-10-20 | 26 실제 Shadow DOM Hover 카드 UI 및 합성 MOCK 모델 구현 | 기존 118 + 신규 34 = V8 모의 152/152 PASS. 이후 Windows Native Node 152/152·Chromium 오프라인 PASS 사용자 로그. 실제 Chrome 간헐적 카드 미표시·400ms 지연 보고 후 수정 패치 준비 |
| 2026-10-16 | 10~19 Chrome 고객 UX 정보구조·상태·Side Panel·검수표 초안 | 목업·실브라우저 검수 대기 |

## 연관 정본

- [00 제품 방향](./00_PRODUCT_DIRECTION.md)
- [01 Hover·Side Panel](./01_HOVER_SIDE_PANEL_UX.md)
- [02 고객 역할·구독](./02_ROLES_AND_SUBSCRIPTION.md)
- [03 기존 데모 마이그레이션](./03_MIGRATION_AND_GATES.md)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [YouTube 파생 지표 조건](https://developers.google.com/youtube/terms/derived-metrics-policy)

| 2026-10-20 | 26 실제 Chrome 간헐적 카드 미표시·400ms 지연 피드백 | 진입 지연 160ms 시험값, SPA 앵커 포인터 복구·진단, 신규 7건 회귀로 격리 V8 159/159 PASS; 최신 Native Node/Chromium/실사이트 재검증 대기 |
| 2026-10-20 | 26 같은 영상 Hover 이탈 후 재진입 시 지연·누락 실사이트 보고 | pointerover/move/out 물리적 경계 추적, suppressedAnchor 해제 및 Overlay 복구, 3회 반복 Chromium Fixture 추가. 최신 격리 V8 172/172 PASS, Windows Native·Chromium 최신 재시험과 실사이트 검증은 PENDING |
| 2026-10-20 | 동일 A 링크 LEAVE_PENDING 중 native pointerenter 누락시 pointerover가 종료 타이머를 취소하지 않는 경합 수정 | 25번 Hover 60건 + 26번 카드 35건 + 기존 21~24 78건 = V8 모의 173/173 PASS. 최신 Windows/Chromium 실환경 재검증 대기 |
