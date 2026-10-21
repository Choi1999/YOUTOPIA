# YOUTOPIA — 관리자·DEV/QA 웹 외부 프로젝트 비교 및 채택 증거 대장

> **2026-10-21 KST · EXTERNAL_RESEARCH_COMPLETED · DESIGN_ADAPTATION_PROPOSED · NO_EXTERNAL_CODE_INTEGRATION · USER_DECISION_PENDING**
>
> 질문: Figma 82(플랫폼 운영/정책 관리자), 83(DEV/QA 검증 화면)의 현재 메뉴·그래프·CTA·상태 테스트용 웹 구성이 실무에서 모두 필요한가? 대체할 수 있는 검증된 외부 프로젝트의 실질적인 사례는 무엇인가?
>
> **내부 기준:** [Figma 82](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-4), [Figma 83](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1283-5), [관리자/QA 필요성 감사](../figma/audits/INTERNAL_WEB_COMPONENT_NECESSITY_AUDIT_20261021.md), [기능·근거 Matrix](../figma/audits/INTERNAL_WEB_COMPONENT_NECESSITY_MATRIX_20261021.json).
> 최종 마일스톤 **M9 PRODUCT_INTEGRATED**. 공개 배포·실제 유료 결제/환불·고객센터 상용 운영은 M9와 구분.
>
> 조사 원칙: 공식 문서/공개 저장소를 우선. 아래 **직접 확인된 외부 기능**과 **YOUTOPIA에서 아직 채택하지 않은 설계 권고**를 각각 별도로 기록. 원본 외부 UI·코드·이미지 복제 및 라이브러리 설치 **0건**. 각 공급자의 요금·라이선스·보안/배포 모델은 실제 사용을 결정하기 전 새로 확인해야 한다.

## 1. 외부 사례별 구체적 발견과 YOUTOPIA 연결

| 증거 ID · 확인 자료 | 문서에 실제 존재하는 해결책 | Figma 82/83에 적용할 구체적 판단 | 사용/채택 상태 |
|---|---|---|---|
| **EX-ADM-001 Grafana** · [Dashboard Best Practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) / [Dashboard Links](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/manage-dashboard-links/) | 대시보드는 질문에 답해야 하며 부하를 줄이고, 시간 범위와 변수를 보존해 데이터 링크를 통해 상세로 드릴다운 | **82-01** 첫 화면은 실제 운영 이상/실패의 2~3개 요약만, 클릭 시 Job/오류/품질 상세로 진입. ‘측정 안 됨’ 카드 3개를 따로 보여주지 않음 | **UX_PATTERN_PROPOSED / GRAFANA_NOT_INSTALLED** |
| **EX-ADM-002 Temporal Web UI** · [Workflow UI](https://docs.temporal.io/web-ui) / [Open-source UI](https://github.com/temporalio/ui) | 실행 목록의 상태·Workflow ID·기간 필터, 상세 Event History Timeline, Worker/Pending Activity/메타데이터 조회 | **82-01 수집 작업**을 독립 좌측 페이지 1개로 늘리기보다 Job 목록+상세 drawer에서 runId, state, attempt, failedAt, errorCode, worker/trace를 볼 수 있도록 설계 | **REFERENCE_ONLY / TEMPORAL_ENGINE_NOT_SELECTED** |
| **EX-ADM-003 Prefect** · [Self-hosted Server](https://docs.prefect.io/v3/concepts/server) / [OSS Repo](https://github.com/PrefectHQ/prefect) | Python Flow/Task Run 상태·이력·로그·Concurrency를 DB+UI로 추적. Prefect Cloud만의 조직용 RBAC/Audit/SSO 추가 기능에 주의 | **BE/EDA Job의 실행·상태 추적** 기준 비교. 이미 DB-backed minimal Job으로 충분한 초기 부하에서는 Prefect 서버 도입을 강제하지 않음 | **ENGINE_CANDIDATE / NOT_INSTALLED; RBAC_NOT_ASSUMED_IN_SELF_HOSTED** |
| **EX-ADM-004 Sentry** · [Issue Details](https://docs.sentry.io/product/issues/issue-details/) | 오류별 발생 횟수/영향 사용자·시각, 시간·환경 필터, 스택·Breadcrumb·Trace·연결 이슈 | **82-01 장애 정보**는 장애 목록→한 건 선택→원인 로그/처리 이력/관련 실행 버전으로 이동. 장애 상세를 독립 대메뉴 여러 개로 분리하지 않음 | **PATTERN_PROPOSED / SENTRY_NOT_INTEGRATED** |
| **EX-DATA-001 Great Expectations (GX)** · [Run Validations](https://docs.greatexpectations.io/docs/core/run_validations/) / [Validation Results (legacy version 0.18)](https://docs.greatexpectations.io/docs/0.18/reference/learn/terms/validation_result/) | 데이터 Expectations/Validation Definitions, 결과 패스·실패와 검증 규칙/배치 컨텍스트. 레거시 Data Docs는 검증 결과를 사람 읽기 좋은 형태로 표시 | **82-01 데이터 품질**은 Run/배치 상세로 합치고 sample_raw/eligible/excluded/classified, quality rule version, failed checks, runId 필드로 연결 | **QUALITY_MODEL_RESEARCHED / GX_NOT_INSTALLED** |
| **EX-DATA-002 dbt** · [Source Freshness](https://docs.getdbt.com/reference/resource-configs/freshness) | source/model 신선도 임계치 warn_after/error_after와 마지막 적재 시각을 검증 | **BE/EDA 캐시·데이터 시각**에서 '미수집 / 오래됨 / 정상'을 명확히 구분. dbt SQL 변환 아키텍처를 채택하지 않으면 기능 원칙만 참고 | **FRESHNESS_PATTERN_PROPOSED / DBT_NOT_SELECTED** |
| **EX-POL-001 OPA** · [Decision Logs](https://www.openpolicyagent.org/docs/management-decision-logs) / [OSS](https://github.com/open-policy-agent/opa) | decision_id/trace_id, bundle revision, policy path, input/result/timestamp, 로그 필드의 mask/erase 지원 | **82-02 정책·감사**: 정책 판정·승인 근거/버전, 차단 사유와 감사 이벤트를 연계. 보안 정책을 변경하는 관리자 버튼을 허가 없는 편법으로 구현하지 않음 | **LOG_SCHEMA_PATTERN / OPA_RUNTIME_NOT_INSTALLED** |
| **EX-POL-002 OWASP** · [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) / [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | deny-by-default, 매 요청 권한 확인, 보안 이벤트 로그/감사와 일반 애플리케이션 로그 목적 구분, 민감 데이터 고려 | **82 Admin** 서버 세션·운영 Role/tenant/target 검사. **83 QA**는 BOLA/다른 조직·승격/로그 마스킹 부정 테스트. 고객 조직 관리자(81-02)와 Platform Admin 권한 혼합 금지 | **SECURITY_REQUIREMENTS_REFERENCE / BE_SERVER_NOT_IMPLEMENTED** |
| **EX-POL-003 YouTube** · [Additional Derived Metrics Policy](https://developers.google.com/youtube/terms/derived-metrics-policy?hl=en) / [Policy revision history](https://developers.google.com/youtube/terms/revision-history) | 데이터 카테고리·감성 파생 지표에 해당하는 별도 추가 정책/신청/승인 조건, 사용권을 허용된 API 통계와 구분, 보관·갱신 제한 | **82-02 정책 Gate가 핵심인 직접적 이유**. 실제 사용권/수락 증거가 없으면 감성·토픽·댓글 파생의 운영 API를 차단. 요금제·관리자 승인 버튼으로 YouTube 권리 생성 불가 | **AUTHORITATIVE_POLICY_OBSERVED / PROJECT_ACCEPTANCE_NOT_CONFIRMED** |
| **EX-QA-001 Playwright** · [HTML/JSON/JUnit Reporters](https://playwright.dev/docs/test-reporters) / [Trace Viewer](https://playwright.dev/docs/trace-viewer-intro) | 실행 브라우저/테스트 PASS·FAIL·skipped·flaky, 오류 단계, 네트워크·DOM·콘솔·시각 Trace 조회 | **83-01/02**에서 별도 UI 개발 대신 Node/Playwright 설치형 Chrome/Frontend E2E, 실패 Trace/실행 SHA가 명시된 HTML·JSON 보고서 링크를 보존 | **TOOLS_ALREADY_PRESENT_IN_FE_PROJECT; NEW_QA_WEB_NOT_NEEDED; CURRENT_RUN_NOT_EXECUTED_IN_THIS_RESEARCH** |
| **EX-QA-002 GitHub Workflow Artifacts** · [Artifact docs](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts) | Workflow 실행 결과·로그·실패 스크린샷·테스트 결과 파일 영속화 | 기존 CI 한도와 비용 제약 고려. GitHub Actions Artifact 또는 동일한 구조의 로컬 테스트 산출물에 SHA/browser/log/trace를 기록. **결과 HTML을 새로운 플랫폼 QA 웹으로 중복 구현하지 않음** | **ARTIFACT_CONVENTION_PROPOSED / CI_EXECUTION_NOT_RUN** |
| **EX-OPS-001 OpenTelemetry** · [Signals](https://opentelemetry.io/docs/concepts/signals/) | Trace(요청의 경로)·Metrics(측정값)·Logs(이벤트) 신호 구분 및 연관성 | Admin Web에 새 대규모 그래프/Trace 엔진 구축하기보다 BE에서 \`runId\` / \`traceId\`를 발행하고 기존 모니터링/로그 뷰에 링크 | **INSTRUMENTATION_PATTERN / OTEL_NOT_INSTALLED** |

**출처 검사 날짜:** 2026-10-21. 공식 웹 문서의 최신 수치/메뉴/플랜·호환 버전은 변할 수 있다. 재현 가능한 코드 채택을 결정할 경우 각 원본 저장소의 특정 Git SHA, LICENSE/NOTICE 및 자체 테스트를 별도로 기록한다.

## 2. 외부 자료를 반영한 관리자 2뷰 최소 IA

### 82-01 운영 현황 (Grafana + Temporal + Prefect + Sentry + GX)

~~~text
운영 현황
  오늘의 운영 상태                 [조회 시각/출처/환경]
  ├── 관측 가능한 Job 상태         (상태가 아직 없다면 "데이터 미연동")
  ├── 실패·장애 요약                (실제 오류가 없다면 "0건", 미측정과 구분)
  └── API 제한 / 데이터 품질        (source rights·quota와 함께)
  
  Job 검색·목록 [상태] [기간] [대상] [환경]
    Run ID / 처리 단계 / 최신 상태 / 시작·갱신 시간 / 주요 실패 사유
       └── Job 상세 Drawer:
           Event timeline / Worker state / retry attempt
           Raw-Eligible-Excluded-Classified coverage / EDA checks
           Error/trace 링크 (로그/민감정보 마스킹)
~~~

초기 **BE Provider 없는 상태에서는 측정 KPI를 생성하지 않음**. 실제 Server DB 또는 관측시스템에 해당 필드가 있을 때만 렌더. Grafana/Sentry/Temporal/Prefect의 모든 기능을 직접 복제하거나 중복 구현하지 않는다.

### 82-02 데이터 정책·감사 (OPA + OWASP + YouTube 공식 정책)

~~~text
정책·감사
  현재 데이터 이용 정책          [Policy version] [reviewedAt]
  ├── 소스별 허용 범위·승인 여부  [권한 있음/미확정/차단]
  ├── 데이터 만료·삭제·보관       [Rule + event]
  └── 고객/운영 접근 기록        [서버 감사 이벤트 목록]
        이벤트 상세:
          decisionId / policyVersion / actor(role)
          resourceType / resourceRef / requested action
          allow|deny / reason / happenedAt / traceId
~~~

서버의 실제 권한 결정이 UI와 분리되어 authoritative여야 한다. 감사 로그는 위조되지 않도록 보호하고 API 토큰·비밀번호·댓글 원문 및 불필요한 개인정보는 저장/표시하지 않는다. **원천 권한이 미확정이면 '미확정'으로 표시하고 분석은 fail-closed**.

## 3. DEV/QA 웹을 새로 만들지 않고 해결하는 방법

실제 테스트 실행 → 테스트 도구의 **HTML + JSON/JUnit + Trace** → SHA/환경/실행시각/명령을 포함한 **증거 매니페스트** → (필요하면) 검토용 읽기 전용 결과 인덱스.

| 기존 83 메뉴 | 외부 자료로 해결할 실제 기능 | YOUTOPIA에서 직접 만들 것 |
|---|---|---|
| 상태 시뮬레이터 | Node unit 테스트 / 별도 Fixture runner | 입력 Fixture와 실패 기대값, fixture version |
| Hover 검증 | Playwright Trace, 설치형 MV3 Chrome 수동/자동 시험 | 기존 hover-controller/Panel 전용 테스트 |
| 권한 차단 | OWASP negative authorization / Backend 401·403·BOLA 시험 | 서버 Policy Enforcement + 부정 테스트 |
| 회귀 테스트 | Playwright HTML/JUnit/JSON reporters | 브랜치·커밋 고정 테스트 실행 명령 |
| 테스트 기록 | Playwright Trace / workflow artifact 또는 로컬 파일 | 간단한 manifest + URL/File ID. 비개발 검수자가 필요할 때만 별도 UI |

**현 상태와 구분:** React/Playwright 테스트 프로젝트는 이미 존재하지만 **이번 연구에서 시험을 새로 실행하거나 설치형 Chrome PASS를 확인한 적은 없다**. CI 한도가 없다고 별도 대시보드를 구현할 필요는 없다.

## 4. 오픈소스 엔진 채택 판단

| 후보 | 직접 사용하면 얻는 것 | 당장 채택을 미룰 이유 |
|---|---|---|
| Temporal | 장기 실행·재시도·Event History·Worker 상태에 대한 실행 엔진+UI | MVP 상태에서 별도 Workflow Service 운영 부담. 현재는 실제 Worker 아키텍처 선택 전 |
| Prefect | Python 데이터/EDA Flow 정의, task 실행상태·로그·스케줄 UI | FastAPI+DB-backed Job만으로 충분한지 부하·실패율 먼저 측정. self-hosted와 Cloud RBAC/SSO 범위 구분 |
| OPA | 정책을 서비스에서 분리하고 Decision Log를 중앙화 | 단순 RBAC/YouTube 정책 몇 개에는 별도 엔진과 Rego 도입 부담. 처음에는 BE의 테스트 가능한 Policy Evaluator와 감사 테이블을 구현하고 필요시 이관 |
| Grafana / Sentry / OpenTelemetry | 모니터링·로그 상관관계, 사고 원인 상세 | 초기에는 로그/메트릭 최소 데이터 계약부터 시작. 기존 관측 도구를 재사용할 수 있으면 어드민 차트 엔진을 직접 개발하지 않음 |
| GX/dbt | 데이터 Validation·freshness 수준 명시 | DB 스키마·데이터 규모와 파이프라인 타입을 확정한 뒤 맞는 도구 **하나**를 선택. 문서 아이디어만 채택할 수도 있음 |

## 5. 설계 결정별 증거 매핑 (도입되기 전에는 계획)

| 내부 결정 후보 | 외부 근거 ID | 기존 Figma Node | 실제 증거가 생길 때 연결할 BE/FE 자산 |
|---|---|---|---|
| ADM-IA-01 운영은 상태→목록→Run 상세 | EX-ADM-001/002/003/004 | [82-01 1286:144](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-144) | BE Job Read API / FE Ops Run list / E2E status-to-run |
| ADM-IA-02 품질·EDA는 Run 맥락 상세 | EX-DATA-001/002 | 82-01 Data quality menu | BE QualityRecord/EDA result + FE Run details |
| ADM-IA-03 정책·감사 1개 뷰 | EX-POL-001/002/003 | [82-02 1286:218](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-218) | BE PolicyDecision/AuditEvent version + authorization negative tests |
| ADM-IA-04 관리자 임의 Retry/Force Allow 금지 | EX-POL-001/002/003 | 82-01/02 State CTA | BE authenticated audited idempotent action, only after explicit approval |
| QA-IA-01 83 시험 실행은 TEST RUNNER가 정본 | EX-QA-001/002 | [83-01 1286:290](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-290) | Node/Playwright/Chromium/BE suite + evidence manifest |
| QA-IA-02 83 보고는 기존 HTML/Trace 우선 | EX-QA-001/002 | [83-02 1286:362](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-362) | Artifact links/test trace with SHA |
| OPS-01 관리자 UI가 실제 측정과 함께 갱신 | EX-OPS-001/EX-ADM-001 | 82-01 Metric cards | Metrics/logs/traces generated by BE, timestamp |
| SURFACE-01 Chrome 고객/운영/QA 인증 경계 | EX-POL-002 | 81/82/83 + 100 Auth surface map | M6 BE RBAC and FE Admin/QA route isolation |

**중요한 상태 표기:** 위 항목은 모두 \`EXTERNAL_REFERENCE_RESEARCHED\` 및 \`DESIGN_ADAPTATION_PROPOSED\`다. \`FIGMA_IMPLEMENTED\`, \`CODE_COPIED\`, \`CODE_INTEGRATED\`, \`UNIT_TEST_PASS\`, \`LIVE_OPS_CONFIRMED\`로 표기하지 않는다. 내부 Figma 82/83의 기존 정적 디자인은 연구 전부터 존재했던 자산이므로 외부 프로젝트 채택 결과로 소급 기록하지 않는다.

## 6. 채택 결정 Gate

**Figma 설계 변경 전:** ADM-IA-01~04와 QA-IA-01~02의 정보 구조 승인, 안전한 서버 인가 경계, 페이지 명명 및 테스트 결과 표시 기준 검토. 승인 전에는 82/83 기존 원본·테마 후보·Proto를 편집/삭제하지 않는다.

**실제 코드 도입 전:** 스택/라이선스/버전 보안 검토, 측정 가능한 사용 사례(동시 작업 수, 실패 건수, 검토자 역할), DB/Job Provider Contract, 감사·마스킹·관측 로그 저장 및 비용 분석. 기존 GitHub 보존 정책과 외부 도구의 무료·유료 영역은 채택일에 재확인.

**M9 인수:** FE Admin 2뷰에 실제 권한 있는 서버 상태가 표시되는지, Policy Gate/감사 로그의 무결성, QA 테스트 SHA·환경·원본 결과/실제 Chrome 설치형 사용 사례가 증거로 연결되는지 확인. 공개 출시/유료 결제는 별도 Gate.

> **현재 판정:** \`EX-ADM-001~004\`, \`EX-DATA-001~002\`, \`EX-POL-001~003\`, \`EX-QA-001~002\`, \`EX-OPS-001\` 외부 근거 조사 완료. **외부 소스/도구 직접 설치·복제·실서비스 사용 0건.** Figma 기존 디자인·제품 코드 수정 0건.
