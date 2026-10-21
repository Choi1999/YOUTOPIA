# YOUTOPIA — 플랫폼 관리자·DEV/QA 웹 구성요소 필요성 감사 v1

> 기준일 2026-10-21 KST · **READ-ONLY REVIEW · RECOMMENDATION, NOT IMPLEMENTATION**
>
> 최종 개발 마일스톤은 **M9 PRODUCT_INTEGRATED**이다. 공개 출시·실제 결제·고객센터 상용 운영은 별도 프로그램이며, 모든 Figma 메뉴를 제품 기능으로 구현할 의무는 없다.
>
> 근거: [82 플랫폼 운영·정책](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-4), [83 개발·QA](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-5), [81-02 고객 조직 관리자](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-72), [제품 역할·인가](../../product-v0.2/07_SURFACE_ACCESS_MATRIX.md), [실행대장 YU-70~79](../../product-v0.2/04_EXECUTION_00_99.md), [FE·BE M0~M9](../../product-v0.2/FE_BE_PRODUCT_INTEGRATION_METHOD_V3_20261021.md), [증거 JSON](./INTERNAL_WEB_COMPONENT_NECESSITY_MATRIX_20261021.json).
>
> 판단 방식: 실제 사용자/운영자 업무가 있는가? M9 통합 인수에 필요한가? 서버 데이터·계약이 실존하는가? 기성 도구로 해결 가능한가? UI 기능 오인/민감정보 위험이 있는가? **Figma에 그려졌다는 이유로 필요하다고 판정하지 않는다.**

## 1. 결론

1. **플랫폼 관리자 웹은 필요하나 축소해야 한다.** Figma 82에 있는 유니크 메뉴 7개를 그대로 일곱 화면으로 만들지 않고, M9까지 **운영 현황·작업 진단 + 정책·감사** 두 화면으로 시작하는 것이 적절하다.
2. **DEV/QA의 시험은 필수지만 별도의 QA 웹 앱은 조건부다.** Node/Playwright/설치형 Chrome·BE 부정 테스트와 버전이 고정된 결과물을 먼저 구축해야 한다. 비개발자가 자주 이용해야 할 때만 QA 실행 결과 **읽기 전용 인덱스** 한 화면을 검토한다.
3. **고객 조직 관리자(81-02)는 완전히 별개다.** 고객 워크스페이스 내 조직 설정으로 두고, 플랫폼 운영자나 QA 계정을 고객 확장에 넣지 않는다.
4. 화면 개선보다 **BE 계약 및 측정·감사·실제 테스트 근거 확보가 선행**되어야 한다. 현행 정적 그림의 상태 카드·CTA를 제품 기능의 증거로 간주하지 않는다.
5. 이 문서는 **원본 82/83 Figma와 코드에 어떠한 수정도 하지 않은 감사**다. 화면 삭제/통합은 사용자 별도 승인 후 후보 시안으로 수행한다.

## 2. Figma 82/83 실제 관측값

| 원본 화면 | 사이드바 메뉴 수 | 실제 Figma 반응이 있는 메뉴 | 지표 카드 | 설명형 작업 행 | 실행 없는 강조 CTA |
|---|---:|---|---:|---:|---:|
| [82-01 운영 현황](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-144) | 6 | 정책·감사 1건 | 3 | 4 | 1 |
| [82-02 정책·감사](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-218) | 5 | 운영 현황 1건 | 3 | 4 | 1 |
| [83-01 상태 시뮬레이터](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-290) | 5 | 회귀 테스트 1건 | 3 | 4 | 1 |
| [83-02 회귀 기록](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-362) | 5 | 상태 시뮬레이터 1건 | 3 | 4 | 1 |
| **총계** | **21** | **4** | **12** | **16** | **4** |

지표 값은 미연동·미측정·검토 대기·SYNTHETIC·NOT RUN·DEMO 등 **실 운영/테스트 측정값이 아닌 안내값**이다. 작업 행 16개와 State CTA 4개에는 Figma Reaction이 없다. 82 메뉴는 두 화면에서 동일하지 않다. 82-01에는 구독 운영·지원 요청이 있고 82-02에는 접근 이력이 있다.

**중복·가림:** 네 화면 모두 동일한 권한 안내가 (a) 재사용 컴포넌트와 (b) 별도 프레임으로 두 번 존재한다. 두 번째 프레임 위치는 y=877~958, 화면은 900px 및 clipsContent=true이므로 아래쪽이 잘린다. 새 UI에서는 안내 컴포넌트 하나만 쓰는 편이 적합하다.

**시점 오류:** 83-02 하단의 'Chrome 확장 코드는 초기 뼈대만'은 이미 합병된 YU-26 Hover 구현의 현재 기준과 다르다. 유동적인 진척 문구는 서버·테스트 최신 버전과 함께 표시하거나 제거한다.

**코드 진실성:** GitHub [AppRoutes.tsx](https://github.com/Choi1999/YOUTOPIA/blob/frontend/frontend/src/app/AppRoutes.tsx) 및 [routeDefinitions.ts](https://github.com/Choi1999/YOUTOPIA/blob/frontend/frontend/src/app/routeDefinitions.ts)는 데모 YU-01~12 경로 중심이며 플랫폼 Admin/DEV QA 웹 라우트는 없다. 원격 backend 브랜치와 dev는 초기 README 커밋 99e7b3857ae6e31460b2c8e2af48592d5bfbb90a로 동일하며 실제 API/DB는 확인되지 않았다. Admin 페이지를 이미 동작하는 운영 콘솔이라고 부르면 안 된다.

## 3. 플랫폼 관리자 메뉴 7개 — 보존·통합·연기

| 현재 메뉴 | 감사 판정 | 이유 · M9 제안 위치 |
|---|---|---|
| **운영 현황** | **유지** | 실제 Job/처리 장애/쿼터/서버 상태가 필요. **1번 메인 화면** |
| 수집 작업 | 운영 현황에 통합 | Job ID, QUEUED·PARTIAL·FAILED, 오류 사유/시각·재시도 정책 등은 상세 또는 탭 |
| 데이터 품질 | 운영 현황에 통합 | EDA 커버리지·중복·누락·출처·데이터 적격성은 분석 Run 상세와 품질 결과 링크 |
| **정책·감사** | **유지** | YouTube 이용권·파생 지표·보존/삭제 Gate와 감사 이벤트 근거. **2번 메인 화면** |
| 접근 이력 | 정책·감사에 통합 | Audit Event의 조회 필터. 별도 글로벌 메뉴보다 간결 |
| 구독 운영 | **상용 운영까지 연기** | 구독 권한 검증은 M6 필수, 하지만 실제 청구·환불/정산 UI는 M9 범위가 아님 |
| 지원 요청 | **조건부** | 실제 지원 업무·담당·SLA가 생기면 외부 기존 도구/전용 지원 체계를 비교. 자체 화면 선개발 불필요 |

**권장 최소 운영 웹 IA**

    Platform Admin (서버에서 신원/운영 권한 검증)
    ├── 운영 현황
    │   ├── 실측 상태: 상태/갱신시각/데이터 출처
    │   ├── Job 목록·실패·지연·quota 필터
    │   └── Job 상세: run ID, 범위, 에러, 데이터 품질/출처 링크
    └── 정책·감사
        ├── 데이터 사용권·파생 지표 승인·유효기간
        ├── 삭제·비공개·보존·접근 거부/정책 차단
        └── 감사 이벤트: actor/target/action/time/reason

최초 구현은 read-only 조회를 우선한다. Job 재시도/삭제·운영 정책 변경은 실제 BE의 권한/멱등성/감사/승인 계약이 완성되기 전까지 **실행 버튼을 만들지 않는다**. 외부 데이터 사용 허가를 플랫폼 관리자 버튼으로 자동 승인할 수 없음.

**UI 구성 축소**
- 탑바/히어로/사이드바에 반복되는 역할 식별을 한 곳으로 통합.
- 데이터가 없는 Metric 카드 3장을 각각 렌더링하지 말고 한 개의 의미 있는 미연결/미측정 상태 제공.
- 작업 설명 행 4개는 실제 API/작업 목록이 생기기 전까지 읽기용 안내로만, 버튼처럼 꾸미지 않음.
- 실제 동작 없는 State CTA는 비활성 CTA 형태가 아닌 상태 텍스트로 변환.
- 중복/클리핑된 권한 안내 제거 후보, 안정적인 동일 메뉴 구성 적용.

## 4. DEV/QA 웹 메뉴 5개 — 도구와 UI를 분리

| 현재 메뉴 | 검증 행위 자체 | 독립 웹 구현 필요성 |
|---|---|---|
| 상태 시뮬레이터 | **필수**: 정상/실패/부분/STALE/삭제/권한거부 Fixture | 기본 불필요. 로컬 또는 격리된 테스트 Harness/컴포넌트 스토리로 |
| Hover 검증 | **필수**: A→B→A, SPA, 카드 포인터/패널 대상 고정 | 불필요. 실제 Chrome MV3 설치형 E2E·Playwright |
| 권한 차단 | **필수**: 401/403, 다른 조직, 역할 재검증 | 불필요. BE 권한·BOLA 부정 테스트 |
| 회귀 테스트 | **필수**: FE·BE·extension 버전별 자동 회귀 | 불필요. Node/Playwright, CI 또는 재현 가능한 로컬 테스트 |
| 테스트 기록 | **필수**: SHA, 테스트 커맨드, 결과·스크린샷·Trace | 읽기 전용 결과 **인덱스**는 검수 인원/빈도가 확인된 후 조건부 |

M9에서 중요한 것은 회귀 테스트의 PASS/FAIL을 만들고 증거를 재현할 수 있는지이지, 그 데이터를 자체 구축한 'QA 웹'에서 볼 수 있는지가 아니다. Figma 83은 **작업 요구를 정리한 참고 화면**으로 보존할 수 있다. 성능·QA 인력이 비개발자이고 빈번히 결과를 열람해야 하는 경우 **QA Run 목록 1화면**, 결과·원본 Log/Trace로 드릴다운하는 구조를 검토한다. 운영 서버의 실제 댓글/토큰/조직 데이터를 강제 변경하는 고객용/운영용 시뮬레이터는 금지.

## 5. 고객 조직 관리자 81번은 유지, 플랫폼 운영과 합치지 않음

[81-02 조직 관리자](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-72)의 팀원 초대·조직별 역할·보고서 검토/승인·조직 이용권은 **고객 워크스페이스의 조직 설정**에서 처리한다. 고객 조직 관리자가 플랫폼 관리자 권한을 갖는 것이 아니다. M7의 협업 업무가 실제 필요한 범위라면 이 설정 페이지는 유효하되, 관리 메뉴 전체가 독립 웹 앱이어야 하는 것은 아니다.

## 6. FE·BE 개발 구현 순서와 Gate

| 단계 | 우선할 작업 | 화면 개발 조건 |
|---|---|---|
| **M3 Backend** | API/DB/Job/오류/권한·캐시 작업 기반 | 시각 Mock만으로 '측정 성공' 출력 금지 |
| **M4~M5 Data/EDA** | 허용된 수집 출처·정제·품질·파생 감성 승인 및 정책 차단 | 승인 상태와 데이터 계보는 서버에서 일관되게 보관 |
| **M6 Auth** | 고객 조직/플랫폼 운영/QA 분리 인증·서버 RBAC·감사 | 운영 웹 전용 접근 통제, 일반 고객 확장에서 관리자 메뉴 없음 |
| **M7 FE+BE** | 운영 조회 계약 및 실제 Consumer/Provider | 82번을 **두 메인 뷰**로 재구성 후 구현 |
| **M8 QA** | Node/Chromium/Chrome 설치형/BE 보안·EDA 검증의 실행·재현 | QA Web은 조건부. 로그/Trace/결과 파일이 먼저 |
| **M9 Integration** | 같은 FE/BE/Shared SHA에서 운영 데이터·정책/인가·QA 결과 검증 | 운영 2뷰가 필요한 데이터/동작을 표시하면 완료. 독립 QA Web 존재 자체는 종료 조건 아님 |

예시 Admin API 명칭 (아직 구현되지 않은 **후보**):

    GET /internal/ops/status
    GET /internal/jobs
    GET /internal/policies
    GET /internal/audit-events
    POST /internal/jobs/{id}/retry  (향후 승인된 작업만)

권한 있는 세션에서만 호출하도록 서버가 강제하며, 시스템 토큰·민감 데이터·타 조직 리소스를 무단 표시하지 않는다. 이 경계는 UI의 숨김 여부와 별개로 검증한다.

## 7. 외부 자료 조사 — 기술 채택과 단순 참고를 구분

| 공식 프로젝트 / 자료 | 실제 문서에 있는 기능 | 도입 권고(아직 사용 아님) |
|---|---|---|
| [Playwright Reporter](https://playwright.dev/docs/test-reporters) | 실제 테스트 HTML/JSON 결과 | QA 결과 웹 중복 개발 전에 기존 보고서 활용 |
| [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer-intro) | 테스트 동작 타임라인·DOM/오류/Console | 설치형 Chrome/브라우저 동작 검증 결과 참조 |
| [GitHub Workflow Artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts) | 로그·스크린샷·테스트 결과 보존 | CI가 가능한 경우 기존 아티팩트 사용. 로컬 실행도 같은 매니페스트 요구 |
| [OpenTelemetry Signals](https://opentelemetry.io/docs/concepts/signals/) | metrics/logs/traces 체계 | BE 관측 수집의 기반 후보. 운영 그래프 앱 별도 구현 방지 |
| [Grafana Dashboard](https://grafana.com/docs/grafana/latest/fundamentals/dashboards-overview/) | 실제 데이터 소스 기반 대시보드 | 운영 정보 시각화에 기성 도구가 적합한지 비교 |

모두 **RESEARCHED / DESIGN_ALTERNATIVE** 수준이다. 이번 감사를 이유로 특정 외부 라이브러리, 모델, 서비스 또는 UI 소스코드를 YOUTOPIA에 복사/설치하지 않았다.

## 8. Figma 변경 승인 전에 필요할 QA 기준

| 시험 ID | PASS 조건 | 현재 |
|---|---|---|
| ADMIN-01 | 운영 2뷰에 실제 백엔드 측정 결과와 시각·출처·미확보 구분 | NOT_RUN |
| ADMIN-02 | 정책 승인·보존·삭제·차단과 감사 기록이 실제 서버 근거에 일치 | NOT_RUN |
| ADMIN-03 | 고객/조직/플랫폼/QA 계정 접근 경계·인가 상승 차단 | NOT_RUN |
| ADMIN-04 | 허위 클릭 요소·죽은 메뉴·중복 안내·클리핑 제거 및 사용자 Present 검증 | NOT_RUN |
| QA-01 | 각 테스트의 실행 SHA, 환경, 실행 명령, PASS/FAIL·원본 로그 연결 | NOT_RUN |
| QA-02 | 강제 상태 변경은 독립 QA Fixture에만 영향, 운영 데이터 무변경 | NOT_RUN |
| QA-03 | 실제 Chrome MV3 + Backend 부정/정책 시험을 개별 실행 | NOT_RUN |

**지금 승인받아야 하는 것은 UI를 먼저 축소·삭제하는 작업이 아니라, 운영 업무의 우선순위와 82/83의 기능 소유권을 확정하는 설계 결정이다.** 이후 현행 Figma 복제 후보에서 메뉴 축소·설명 텍스트/CTA 정리, 프로토타입 검수, API 데이터 계약, 실제 FE/BE 구현 순서로 진행한다.

**현재 최종 판정: Figma 82/83 read-only audited; Admin 최소 2뷰 설계 후보; DEV/QA 독립 웹 보류 권고; 실제 운영 API/QA Web 미구현; 제품 Figma·코드 미변경; 사용자 승인 대기.**
