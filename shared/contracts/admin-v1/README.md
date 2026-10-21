# YOUTOPIA Admin Read Contract v1 — Candidate

**2026-10-21 / DRAFT_REQUIRES_FE_BE_REVIEW / BACKEND_NOT_IMPLEMENTED / NODE_TEST_NOT_RUN**

제품 방향은 승인됨: Platform Admin Web은 운영 현황과 정책·감사, 두 화면을 갖는다. DEV/QA는 실측 테스트 실행기와 버전 고정 증거를 우선한다. **이 스키마는 실제 Admin 인증·사용권·서버 구현 승인이나 제품 통합 PASS가 아니다.**

관련 설계: [관리자 M9 FE/BE 계약](../../../docs/product-v0.2/ADMIN_M9_TWO_VIEW_FE_BE_METHOD_20261021.md), [Figma 82-03](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-14), [82-04](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-49), [기존 Analysis Contract v1](../analysis-v1/README.md).

## 1. 포함한 파일과 데이터 소유권

| 파일 | 정의/목적 | 상태 |
|---|---|---|
| admin.schema.json | 독립된 Draft 2020-12 JSON Schema, 11개 정의와 6개 응답 종류 | 후보 |
| fixtures/ops-unconnected.json | 운영 서버가 없을 때 미측정 카운트는 null | 합성 |
| fixtures/policy-unknown.json | 파생 지표 이용 허가를 확인하지 못한 상태 | 합성 |
| fixtures/job-failed.synthetic.json | 실패 Run, 상태 이력, 조직 스코프, 데이터 품질 분모 | 합성 |
| fixtures/policy-denied.synthetic.json | 사용권 승인 전 정책 판정 거부 | 합성 |
| fixtures/audit-denied.synthetic.json | 일반 고객 역할의 관리자 자원 접근 거부 | 합성 |
| fixtures/error-forbidden.synthetic.json | HTTP 403의 보수적인 오류 형태 | 합성 |
| tests/semantic-smoke.test.cjs | Node 내장 test 기반 의미 불변식 7건과 부정 변형 | 작성, 미실행 |

외부 댓글·실제 회원 식별자·운영 액세스 토큰·실제 Job·YouTube API 호출은 없다.

## 2. Figma 표시와 계약의 대응

| 정의 | 화면에서 필요할 때 보이는 정보 | 정합성 |
|---|---|---|
| OpsStatus | 서버 연결/미측정, 업데이트 시각, 작업/실패/쿼터 | UNCONNECTED이면 카운트와 관측 시각 모두 null. 미측정 ≠ 0 |
| OpsJobListItem | Run ID/상태/시각/시도 횟수/오류 사유 | 실제 Run만 한 행. tenant/target 소유권은 서버 검사 |
| OpsJobDetail | 실행 Event History, 원인, 품질·Trace | 상태 이력의 시각 및 runId와 일치해야 함 |
| DataCoverage | raw/eligible/excluded/classified/unclassified 분모 | raw=eligible+excluded, eligible=classified+unclassified (모두 알려진 경우) |
| PolicyOverview | 승인 범위, 정책 버전, 승인 근거, 보존·만료 | APPROVED는 실제 근거·버전·검토 시각 필수 |
| PolicyDecisionRecord | allow/deny, 대상, 정책 버전, 결정 시각, 사유 | allow=true에 실승인 근거 필수. 합성 결정으로 라이브 권한 불가 |
| AuditEvent | actor/target/action/time/outcome | 개인 이메일·비밀값·원시 댓글을 로그에 담지 않음 |
| ErrorEnvelope | HTTP 401/403 등 에러 상태 | 클라이언트 에러를 자동 승인/권한 상승으로 해석하지 않음 |

**중요:** JSON Schema만으로 카운트 교차 등식, 시간·상태의 모든 일관성, 이용 권한/서버 인가, 실제 비밀정보 마스킹을 보장할 수 없다. Node smoke도 완전한 JSON Schema 엔진이 아니므로 FE/BE Provider와 Consumer 양쪽 테스트가 필요하다.

## 3. 보안 경계

- Chrome 확장은 고객만, Customer Org Admin은 해당 조직 관리만, Platform Admin은 서버가 허용한 운영 조회만. DEV/QA는 격리된 Fixture·테스트 실행 권한만.
- 고객/조직/관리/QA 자원의 경계는 API 호출마다 BE 세션·리소스 범위·Role로 검사한다. 단순 UI에서 메뉴를 숨기는 것은 인가 구현이 아니다.
- GLOBAL_METADATA는 tenantId=null, TENANT_PRIVATE는 서버에서 검증된 tenantId 필수. 타 테넌트 리소스 유추/접근 차단.
- sourceType=STATIC_FIXTURE와 isSynthetic=true는 동치여야 한다. **PolicyOverview APPROVED와 PolicyDecisionRecord allow=true는 합성 Fixture에서 스키마 자체가 거부**하며, 근거 참조·버전·검토 시각을 가짜로 채워 넣어도 예외가 없다. APPROVED_PROVIDER는 인증·법적 권리·출처와 실제 정책이 준비될 때만 구현할 수 있으며 Fixture 문자열을 바꾸는 것으로 승인할 수 없다.
- 라이브 YouTube 댓글 수집·감성/주제 파생 분석·보관은 별도의 공식 정책 검토와 실제 이용 허가 전까지 활성화 금지.
- 운영 Job 강제 성공/무제한 Retry/권리 허용/사용자 정보 추출 쓰기 API는 이 계약에 포함하지 않는다.

## 4. 테스트 실행과 미결정

Windows/Node 24 환경의 레포지토리 루트에서 실행:

~~~powershell
git rev-parse HEAD
node --version
node --test shared/contracts/admin-v1/tests/*.test.cjs
~~~

테스트를 실제로 수행한 SHA·Node 버전·OS·명령·원본 stdout/stderr·통과/실패 결과를 기록해야 한다. 지금은 **NODE_TEST_NOT_RUN / FULL_SCHEMA_ENGINE_NOT_RUN / BE_PROVIDER_NOT_IMPLEMENTED / AUTH_SERVER_NOT_IMPLEMENTED**다.

FE/BE 공동 Gate: 스키마 필드·버전 합의, 표준 Draft 2020-12 validator 사용, 테스트 Fixture 상호 수락, 서버 401/403/BOLA 차단, 민감정보 마스킹, 실제 Job/Policy/Audit 기록·원천 이용권, UI null/0 구별, Figma Present/키보드/줌 시험.

**지금 결정되지 않은 사항:** BE 프레임워크/DB·작업 큐, 운영 관리자 로그인 공급자, 쿠키/토큰·CSRF·MFA, Job DB와 보존/삭제 정책, API 최종 path/응답 패턴, Test Runner와 QA 아티팩트 영속 저장. FE/BE 리뷰 없이 관련 결정을 암묵적으로 확정하지 않는다.
