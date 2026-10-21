# YOUTOPIA — M9 운영 관리자 최소 2뷰 / DEV·QA 도구 우선 아키텍처 계약 후보 v0.1

> 2026-10-21 KST · **APPROVED_PRODUCT_DIRECTION / DRAFT_API_CONTRACT / NO_RUNNING_BACKEND / NO_REAL_ADMIN_AUTH**
>
> 사용자 승인: **플랫폼 운영 웹은 ‘운영 현황’과 ‘정책·감사’ 2개 화면을 핵심으로 개발**, 수집 작업·품질은 Run 상세로, 접근 이력은 감사 이벤트로 통합. DEV/QA 테스트 실행 및 재현성은 필수이나 독립적인 전용 QA 웹 앱은 M9 인수 필수항목으로 지정하지 않음. [필요성 감사 PR #28](https://github.com/Choi1999/YOUTOPIA/pull/28)과 [공식 프로젝트 비교](../research/ADMIN_QA_EXTERNAL_REFERENCE_ADOPTION_STUDY_20261021.md) 참조.
>
> Figma 구현 후보: [82-03·04 Light](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-14) 및 [82-05·06 Dark](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1486-14). **Figma는 설계·Prototype 후보일 뿐 React 앱·Admin API·보안 권한을 실제 제공하지 않는다.**

## 1. 제품 Surface 및 책임

| Surface | 사용자와 권한 | 이번 M9 범위 |
|---|---|---|
| **Chrome Extension** | Guest·고객 개인·조직 구성원 공통 고객 계정 | Hover/Side Panel, 고객 웹 로그인 진입·돌아오기만. Admin·QA 메뉴 제외 |
| **Customer Web** | 개인·조직 고객, 조직 Admin | 개인/조직 분석·저장·비교·협업 및 해당 조직 내 설정. 81-02는 고객 소속 |
| **Platform Admin Web** | 플랫폼 운영·정책 담당자 | **운영 현황 / 정책·감사** 두 뷰, 서버 권한이 부여한 읽기·필요한 추적 |
| **DEV/QA Toolchain** | 격리된 엔지니어·테스트 담당자 | Node/Playwright/설치형 Chrome/BE 정책 테스트 실행, 결과·Trace 아티팩트 |
| **DEV/QA Web (optional)** | 반복 보고가 필요한 승인된 리뷰어 | 별도 수요가 확인될 때만 Run 목록→원본 아티팩트 링크 **읽기 전용** UI |

신원 제공자가 반드시 각 Surface마다 달라야 하는 결정은 아니다. 보안 경계는 **서버의 역할·작업 권한·세션 강도·데이터 조회 범위**이며, Chrome이나 React의 클라이언트 조건 분기만으로 관리자 권한을 만들 수 없다.

## 2. 기술 경계와 최소 아키텍처

~~~text
Admin Web (FE)                         BE platform boundary
  ├─ Operations Summary  ────────────> GET OpsStatus / JobList / JobDetail
  │   ├─ Job list/filters              backend DB / permitted queue status
  │   └─ Job details+quality links     worker timestamps + failures + provenance
  └─ Policy & Audit ─────────────────> GET PolicyOverview / AuditEventList
      ├─ rights + retention            authoritative policy evaluator/approval manifest
      └─ access / policy events        append-only audit event store (candidate)
            ↕
       OIDC/session/RBAC/step-up gate for Admin only, server validated

DEV/QA runner → Node / Playwright / Chrome MV3 / BE contract tests
            → tested SHA + command + PASS/FAIL + logs + trace/screens
            → versioned artifact manifest (review in existing tooling)
            → optional read-only QA Run index only if required
~~~

- 현재 `backend` 원격 브랜치는 `dev` Initial README와 동일한 것으로 검사됐다. **Job/DB/Admin/Auth 서버는 구현됐다는 증거가 없다.** 기술 스택(Python/FastAPI 등)은 후보이며 BE 담당·전담 ADR 승인 전 확정하지 않는다.
- 기존 `shared/contracts/analysis-v1/analysis.schema.json`의 `AnalysisJob`, `ErrorEnvelope`, `UserEntitlement`는 **공통 계약 후보**다. 운영 전용 읽기 타입·API 경로는 별도 BE/FE 리뷰 후 정해야 하며, 기존 스키마를 자동 대체·승격하지 않는다.
- 실제 YouTube 댓글/분석 파생 지표는 승인 정책 Gate가 없으면 수집·저장·제공을 시작하지 않는다. D0 합성 자료만으로 HTTP·UI 상태·산술/권한 회귀를 준비할 수 있다.

## 3. 제안하는 BE→FE 계약 (아직 구현 전)

### 3.1 Operations view

| 계약 후보 | 최소 데이터 | 미확보/권한/오류 규칙 |
|---|---|---|
| `OpsStatus` | `environment`, `source`, `capturedAt`, `health`, `runningJobs?`, `failedJobs?`, `quotaRemaining?`, `connectionStatus` | 카운트 미측정은 **null/UNKNOWN**. 가짜 0·성공률·실시간 그래프 금지 |
| `OpsJobListItem` | `runId`, `targetRef`, `scope`, `state`, `requestedAt`, `updatedAt`, `attempt`, `reasonCode?` | 1행은 진짜 Job 1개. 불명확한 데이터에는 Mock badge가 아닌 비가용 UI |
| `OpsJobDetail` | list item + `eventHistory`, `failureSummary?`, `dataCoverage?`, `qualityReportRef?`, `traceRef?` | 권한·사용 목적이 확인된 메타데이터만, raw comment/token 숨김 |
| `DataCoverage` | raw/eligible/excluded/classified/unclassified, window, sourceVersion, validationResults | 분모가 다른 지표들을 혼합하지 않음. unknown과 0 분리 |

읽기 경로(예시이며 실제 API가 아님): `GET /internal/v1/ops/status`, `GET /internal/v1/jobs`, `GET /internal/v1/jobs/{runId}`. Job 조회는 상태/기간/환경 필터 및 서버측 페이지네이션이 필요하다. **Job Retry 쓰기 작업은 최초 구현에서 제외**하고, 추후 멱등성·권한·감사/재시도 부하가 검증됐을 때 독립 설계로 추가한다.

### 3.2 Policy & Audit view

| 계약 후보 | 최소 데이터 | 중요한 정책 의미 |
|---|---|---|
| `PolicyOverview` | `policyId`, `revision`, `approvalStatus`, `scope`, `sourceRef`, `obtainedAt`, `expiresAt?`, `retentionRule?` | 외부 승인 근거가 없으면 `UNKNOWN` 또는 `BLOCKED`, 허가된 것으로 간주 금지 |
| `PolicyDecisionRecord` | `decisionId`, `occurredAt`, `actorRole`, `resourceRef`, `action`, `allow`, `reasonCode`, `policyRevision`, `traceId?` | 실제 서버의 정책 평가 기록과 1:1 연결, 클라이언트 조작 불가 |
| `AuditEvent` | `eventId`, `occurredAt`, `actorRef`, `action`, `targetRef`, `outcome`, `reasonCode?`, `policyRevision?` | Append-only 또는 동등한 변조 방지, 개인정보/Secrets 최소화·보존 |
| `RetentionEvent` | `eventId`, `resourceRef`, `retentionRule`, `deletedAt?`, `reason`, `evidenceRef` | 삭제/비공개/동의 회수 시 stale 캐시·접근 무효화 검증 |

읽기 경로 후보: `GET /internal/v1/policies`, `GET /internal/v1/audit-events`. `ALLOW`/승인 상태는 **정당한 출처의 승인 범위에 맞아야 하며 관리자 UI에서 임의로 켤 수 없다**. YouTube 파생 지표 정책과 운영 사용권/저장 정책은 별개 법적·기술적 Gate다.

### 3.3 공통 보안/상태 계약

- Admin API의 매 요청마다 유효한 세션·role·scoped resource entitlement를 **BE에서 판정**. 401 인증 실패, 403 인가 실패(자원 존재 정보 노출 여부는 보안 정책으로 결정); 역할 문자열·브라우저 탭 ID는 권한 증명 아님.
- 운영 정책/감사 로그/개인정보의 최소 접근을 기본값으로 한다. Trace는 접근통제/마스킹, 실제 YouTube 원문·이메일·토큰·재수집 규칙 우회 경로를 기본 제공하지 않는다.
- 권한 제거·사용자 전환·세션 만료·삭제 이벤트 시 FE의 이전 리소스 캐시와 메모리 표시를 무효화한다.
- 응답에는 서버가 확정한 `observedAt`/소스/분모/상태를 제공. `data missing`은 측정치 0이 아니다.
- QA 강제 상태는 운영 DB·고객/플랫폼 관리자 UI에서 허용하지 않고 격리된 test fixture에서 재현한다.

## 4. 화면 최소화 원칙과 외부 사례 연결

| YOUTOPIA 실제 Figma 노드 | 설계 참고 외부 근거 | 적용한 내용 / 적용하지 않은 것 |
|---|---|---|
| [운영 미연동 안내 1485:31](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-31) | EX-ADM-001 Grafana / EX-OPS-001 OpenTelemetry | 실제 측정 지표와 갱신 시각 없이 KPI 카드 남발하지 않음. Grafana/OTel **코드 도입하지 않음** |
| [작업 실행 목록 1485:34](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-34) / [상세 1485:35](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-35) | EX-ADM-002 Temporal / EX-ADM-003 Prefect / EX-ADM-004 Sentry | Run/상태/오류/품질을 리스트→상세로 연결. Temporal/Prefect/Sentry **설치·복제 안 함** |
| [정책·감사 1485:69](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-69) / [감사 1485:70](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-70) | EX-POL-001 OPA, EX-POL-002 OWASP, EX-POL-003 YouTube | 결정 ID·권한/삭제 근거를 서버에서 판정. OPA runtime 미도입·외부 데이터 이용 승인 미확정 |
| [QA 도구 우선 시트 1488:14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1488-14) | EX-QA-001 Playwright / EX-QA-002 GitHub Artifacts | 실행 결과/Trace/환경 SHA를 기존 도구와 연결, 전용 QA 웹은 선택 사항 |

외부 조사 정본: [ADMIN_QA_EXTERNAL_REFERENCE_ADOPTION_STUDY_20261021.md](../research/ADMIN_QA_EXTERNAL_REFERENCE_ADOPTION_STUDY_20261021.md). **외부 소스코드 복사·패키지 설치 0건**. 실제 내부 Figma 디자인 시스템의 의미 토큰·텍스트 스타일은 후보 4뷰·QA 메모에 바인딩했다.

## 5. M3~M9 구현·QA 계획

| 단계 | FE | BE·Data | INT 승인 Gate |
|---|---|---|---|
| M3 | Empty/Unknown/Failed 상태 Mock 렌더, Job list/Detail 분리 | durable Job, read-only OpsStatus/Run 상세 검토 | Contract/schema 매칭, null/0·runId 조회 |
| M4 | 권한/자료 허용 상태·품질 실패 표시 | 정책 Gate와 EDA 품질/삭제 이벤트 | 허용 소스/저장·삭제 거부와 stale 결과 불노출 |
| M5 | 실제 분석 결과의 샘플·모델/토픽 버전 표시 | 승인 데이터만 분석, 분모/출처/추이 비교 Gate | DataCoverage raw/eligible/classified·version 1:1 |
| M6 | 운영 관리자 웹 전용 인증 진입, 세션 만료/차단 UI | Admin/Org/QA 서버 RBAC·Audit 이벤트 | 고객/조직→플랫폼 권한 상승 불가, BOLA/CSRF 검사 |
| M7 | **2개 Admin 화면** 및 드릴다운, 필요 데이터만 UI | 승인된 BE Operations/Policy/Audit Provider | FE↔실 HTTP Mock→승인 Provider 계약, dead menu 0 |
| M8 | Dark/Light·A11y·브라우저 응답/성능·오류 상태 | QA 실행기·Trace/로그/정책 부정 시험 | Tested SHA/명령/환경/PASS·FAIL 기록, 장애 복구 |
| **M9** | 최종 Admin 최소 2뷰 및 Chrome/Customer Web 통합 | policy, auth, data, job 운영 계약 동결 | **동일 FE/BE/Shared SHA의 PRODUCT_INTEGRATED 증거** |

## 6. 인수 시험 IDs (모두 계획, 실제 미실행)

| ID | 수행할 시나리오 | PASS 판정 |
|---|---|---|
| ADM-UX-01 | Figma 82-03 ↔ 82-04 Light, 82-05 ↔ 82-06 Dark 실제 Present 클릭 | 두 메뉴 정상 이동, 원래 Admin 82-01/02와 혼동 없음 |
| ADM-UX-02 | 서버 Job 미연결·미측정·오류 | 0건/정상/실시간 등의 허위 메트릭 없음 |
| ADM-UX-03 | 유효 Job 목록 조회→Run 선택→실패/품질/Trace | 목록·상세의 `runId`, `observedAt`, 오류 사유 1:1 일치 |
| ADM-UX-04 | Admin Policy/Deny/Delete/Audit 조회 | 실제 정책 버전·승인 근거·삭제 이벤트와 UI 일치 |
| ADM-UX-05 | 고객/조직/QA 세션으로 Admin API 요청 | 401/403 등 안전하게 차단, 민감정보 누출 0 |
| ADM-UX-06 | 원본 대비 메뉴와 Notice/CTA 검사 | 핵심 2메뉴, 중복 Notice 0, 실행 없는 명령 버튼 0 |
| ADM-UX-07 | Zoom 100/125/150%, Dark/Light, Tab/Focus/스크린리더 | 중요한 정보·컨트롤 접근 가능; 실제 전체 WCAG 별도 검증 |
| QA-OPS-01 | Node/Playwright/Chrome MV3/BE test runner | 실제 Tested SHA, 환경, 명령, 원본 결과/Trace 재현 |
| QA-OPS-02 | 합성 실패·권한 차단 재현 | 운영 데이터 영향 없음, 서버에서 권한 부정이 성공 |
| QA-OPS-03 | 비개발 검수자의 결과 탐색 수요 | 기존 HTML/Trace/manifest로 충족 여부 측정 후 QA 웹 별도 승인 |

**현재 상태:** 실제 Figma 노드·Prototype 반응 정적 검사만 PASS, Figma Present 실제 조작·FE/BE 서버 인증/실데이터/QA 러너 E2E는 **NOT_RUN**. 이 문서 자체는 구현 완료를 뜻하지 않는다.

## 7. 명시적 미결정 사항

1. Admin API의 정확한 path/버전·페이지네이션·데이터 보존·감사 파일 형식·정책과 인증 공급자.
2. Job 저장소/큐/Worker 구성 및 실제 부하·오류율이 Temporal/Prefect 등 별도 엔진을 정당화하는지.
3. 운영 메트릭 수집·Trace 백엔드(OpenTelemetry/Grafana/Sentry 중 필요 기능/가격에 따른 선택).
4. YouTube 파생 콘텐츠 태깅/감성의 실제 승인·데이터 보존 가능 범위.
5. QA 웹을 만들 정도로 내부 비개발 검토 수요가 있는지.
6. Figma UI 색/텍스트/시각 레이아웃의 최종 사용자 승인.

**현재 판정:** `ADMIN_2_VIEW_DESIGN_DIRECTION_APPROVED`, `FIGMA_4_THEME_SCREENS_CREATED`, `QA_TOOLCHAIN_FIRST_APPROVED`, `BE_API_CONTRACT_CANDIDATE`, `PRESENT_NOT_RUN`, `RUNTIME_NOT_IMPLEMENTED`.
