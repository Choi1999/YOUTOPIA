# YOUTOPIA — YU-32 G4-2 분석 API·인가 계약 v0.1

> **상태:** DRAFT_CONTRACT / OFFLINE_ONLY / NOT_IMPLEMENTED / POLICY_HOLD
> **기준:** `frontend` @ `88df749f0585750788f383ce225fe3e7db2d9381`, `feat/backend-bootstrap` @ `4e2714ef5107acab44fa79075840e463e5df8f39`
> **승인 범위:** 계약 설계 및 합성 검증. 새 운영 API·댓글 수집·감성 분석·결제·서버 저장·브랜치 병합·정책 승인은 포함하지 않는다.
> **관련:** [YU-32 합성 실험](./YU32_COVERAGE_SCHEDULER_V01.md) · [분석 계약](../../shared/contracts/analysis-v1/README.md) · [기존 백엔드 API 초안](../backend-handoff/02_API_CONTRACT.yaml) · [기존 보안 Gate](../backend-handoff/05_SECURITY_POLICY_CONTRACT.md)

## 1. G4-1 근거 대조 및 제품 경계

| 원격 구현 | 관측 결과 | 후속 기준 |
|---|---|---|
| `extension/hover-summary-contract.js` | QA 합성 `SNAPSHOT/NOT_FOUND/REJECTED` 검증 | 기존 MV3 wire 그대로 보존 |
| `shared/experiments/coverage-scheduler-v0/engine.cjs` | 메모리 Job·캐시·가상 예산 | 운영 DB·인가가 아닌 합성 모델 |
| `GET /api/v1/youtube/videos/{videoId}/observations` | `collector.v_youtube_stats_canonical`의 `view_count` 조회 | 댓글 분석/감성이 아님 |
| Spring Security·세션·CSRF | `feat/backend-bootstrap`에 기반 코드 존재 | 테넌트·이용권·분석 정책은 별도 |
| `docs/backend-handoff/02_API_CONTRACT.yaml` | 과거 프로젝트 중심 후보 경로 | 새 제품 API를 자동 승인하지 않음 |

**변경하지 않을 원칙:** Hover 조회는 Job 생성/외부 API 호출을 하지 않는다. `SUCCEEDED` Job만으로 수치를 표시하지 않는다. `MISS`·`NO_DATA`·`STALE`·`POLICY_BLOCKED`를 구분한다. 정책 미승인은 fail-closed이다.

## 2. 공통 Identity 및 Scope 불변식

서버 정규화 Scope는 `source`, `targetType`, `targetId`, `analysisSpecVersion`, `observationWindowId`, `samplingPolicyVersion`, `locale`, `visibility`, `tenantId`의 **9개 고정 필드**다. 전체 필드가 같아야 캐시를 재사용하고 활성 Job에 합류할 수 있다.

- G4-2 실행 후보는 `source=YOUTUBE`·`targetType=VIDEO`·11자리 canonical `videoId`만. 채널은 별도 버전에서 정의한다.
- 서버가 `visibility`와 `tenantId`를 현재 세션·인가·보유 데이터 정책으로 결정한다. 브라우저 요청에 이 필드를 받거나 임의 역할/정책 값을 신뢰하지 않는다.
- `PUBLIC_REUSABLE`이면 `tenantId=null`. `TENANT_PRIVATE`는 세션의 테넌트 접근 권한을 매 요청마다 검증. 다른 테넌트의 존재 여부도 누설하지 않는다.
- `analysisSpecVersion`·관측 윈도·표본 정책·locale이 달라지면 같은 영상이라도 **다른 Scope**다.
- 인증 역할(Role), 이용권(Entitlement), 정책 사용권(Policy), 사용량(Budget)은 각각 다른 축이다. 유료 구독은 YouTube 권리나 운영자 역할을 부여하지 않는다.
- 운영 TTL·보존 기간은 현재 결정되지 않았다. 합성 실험의 24시간을 서버 기본값으로 복사하지 않는다.

## 3. G4-2A — 읽기 전용 Summary 조회

**후보:** `GET /api/v1/analysis/videos/{videoId}/summary` (미구현)

질의 후보: `analysisSpecVersion`, `observationWindowId`, `samplingPolicyVersion`, `locale`. 서버는 허용된 공개/비공개 Scope를 스스로 계산하고 영속 Snapshot **참조**만 읽는다. Hover로 인해 POST·Job·수집·외부 API가 호출되어서는 안 된다.

| 200 상태 | 응답 의미 | 수치 노출 |
|---|---|---|
| `FRESH` | 검증 가능한 `snapshotId`, `status=READY/PARTIAL`, `analyzedAt` | Snapshot API 재인가·검증 후에만 |
| `MISS` | 저장된 분석 없음 | 없음; 생성 자격을 암시하지 않음 |
| `NO_DATA` | 해당 분석 범위에서 자료 없음이 확인됨 | 없음; 0%를 만들지 않음 |
| `STALE` | 보유 참조가 유효기간/정책 기준을 넘음 | 최신 수치 없음; 시각만 참고 가능 |

읽기 요청에도 현재 정책·데이터 보존·권한을 확인한다. 권한 경계가 검증되기 전 모든 응답은 `Cache-Control: no-store`. 공개 HTTP/CDN 캐시는 별도 승인 대상이다. `POLICY_BLOCKED`·`ENTITLEMENT_LIMITED`는 명시적 오류, 비공개 존재 여부 누설 위험은 공통 `404 RESOURCE_UNAVAILABLE`로 처리한다.

## 4. G4-2B — 명시적 분석 Job 생성

**후보:** `POST /api/v1/analysis/jobs` (미구현)

```json
{
  "target": {"source": "YOUTUBE", "targetType": "VIDEO", "targetId": "Ab0_-123xyz"},
  "analysisSpecVersion": "mock-0",
  "observationWindowId": "20261001-20261008",
  "samplingPolicyVersion": "mock-0",
  "locale": "ko-KR"
}
```

- 서버가 직접 인증·인가·정책 승인·구독 범위·요청량/동시성·원본 이용권을 확인하기 전에는 Job을 생성하지 않는다. `requestAllowed`, `isTrusted`, `role`, `tenantId`, `policyApproved` 등 클라이언트 판정은 **요청 본문에서 금지**한다.
- 무작위 `Idempotency-Key` 헤더와 서버 세션 CSRF가 필요하다(구체 발급·TTL 후보). 같은 principal+key+정규화 요청 본문이면 동일 결과를 반환한다. 같은 키+다른 본문은 `409 IDEMPOTENCY_CONFLICT`.
- 동일 **정규화 Scope**의 활성 `QUEUED/RUNNING` Job은 원자적으로 하나로 합류(`202 JOINED`). 신규 Job은 `202 CREATED`. 검증된 최신 캐시가 있으면 `200 ALREADY_CACHED`를 후보로 한다.
- 클라이언트 Hover 이벤트·페이지 재방문·Worker 재시작만으로 POST 금지. 사용자 명시적 의도는 UI 필수 조건이지 서버 인증 증명이 아니다.
- `401 AUTHENTICATION_REQUIRED`, `403 POLICY_BLOCKED/ENTITLEMENT_LIMITED`, `409 IDEMPOTENCY_CONFLICT`, `429 QUOTA_DEFERRED`, `503 UNAVAILABLE`의 후보 오류 계약을 둔다. 남용 방지·실제 과금은 추후 확정한다.
- 경쟁 POST에서 Job/Idempotency/예산 예약은 **한 DB 트랜잭션으로 원자화**. 서로 다른 tenant/visibility/scope 버전은 합류/공유 금지.

## 5. G4-2C — Job 상태 조회

**후보:** `GET /api/v1/analysis/jobs/{jobId}` (미구현)

Job 상태: `QUEUED → RUNNING → SUCCEEDED|FAILED`; 시작 전 확인된 오류에서 `QUEUED → FAILED` 가능. 종단 상태를 같은 Job에서 되돌리지 않는다. 명시적 재시도는 **새 attempt/Job**이다.

최소 상태: `jobId`, `state`, 단조 증가 `version`, `updatedAt`, `snapshotId|null`, `retryable`. `SUCCEEDED`만 유효 Snapshot 참조를 요구한다. 클라이언트는 낮은 version의 지연 응답을 무시한다. 서버는 DB CAS/리스·heartbeat·재시작 후 회복 및 중복 실행 차단을 별도로 구현해야 한다.

Job ID는 불투명하며 ID 소유만으로 조회 권한이 생기지 않는다. 테넌트 변경·권한 회수·구독 만료·정책 철회 뒤에도 매 GET에서 재인가한다. `SUCCEEDED`는 감성 수치·출처·원본 사용권의 자동 승인 상태가 아니다.

## 6. G4-2D — Snapshot·영속 저장 후보

**후보:** `GET /api/v1/analysis/snapshots/{snapshotId}` (미구현)

서버는 Snapshot ID → **서버 저장 Scope** → 현재 viewer 인가 → 출처/정책/보존/철회 상태 → 분석 계약/무결성을 검증한다. 기존 `analysis-v1` 후보 계약과 충돌 없이 별도 Adapter로 전달하되 합성 `STATIC_FIXTURE`를 무단으로 운영 `APPROVED_PROVIDER`로 승격하지 않는다.

| 개념 객체 | 필수 제약 | 필수 테스트 |
|---|---|---|
| `AnalysisScope` | Scope 9필드, 정규화/지문/테넌트 | 버전·visibility 격리 |
| `AnalysisJob` | ID, scope, attempt, state, version, clock | CAS, lease, Worker crash |
| `IdempotencyRecord` | principal, key, body digest, 결정 | 경쟁 POST와 충돌 409 |
| `AnalysisSnapshot` | 불변 ID, scope, provenance, 상태, 관측/분석 시각 | Job↔Snapshot 일치, NO_DATA |
| `UsageBudget` | actor, tenant, source, period, reservation | 원자적 차감/중복 방지 |
| `PolicyAudit` | 출처, 결정, 버전, 승인자, 철회, 시각 | 삭제·비노출·민감정보 마스킹 |

DDL, 인덱스, Redis 여부, 복제/암호화/보존/삭제 정책 및 배포 환경은 여기서 확정하지 않는다. 원문 댓글·작성자 정보는 Summary/Job API와 분리하고 사용권·최소화 Gate 완료 전 저장하지 않는다.

## 7. 서버 오류/권한 결정 후보

| 시나리오 | 예상 처리 |
|---|---|
| Guest 공개 조회 (정책·범위 허용) | `200 FRESH/MISS/NO_DATA/STALE` |
| Guest Job POST | `401 AUTHENTICATION_REQUIRED`, 생성 0 |
| 다른 테넌트의 Job/Snapshot | `404 RESOURCE_UNAVAILABLE`, 존재 여부 은닉 |
| 데이터 수집·파생 정책 미승인 | `403 POLICY_BLOCKED`, 생성/수치 0 |
| 이용권 범위 밖 | `403 ENTITLEMENT_LIMITED` |
| 요청/소스 할당량 소진 | `429 QUOTA_DEFERRED` |
| 멱등 키 재사용 + 본문 불일치 | `409 IDEMPOTENCY_CONFLICT` |
| 같은 Scope 활성 Job | `202 JOINED`, 중복 생성/차감 0 |
| STALE | 과거 분석 시각만 허용; 최신 수치 금지 |
| NO_DATA | 확인된 없음; 0%와 구별 |
| Worker·데이터 소스 장애 | `503 UNAVAILABLE` 또는 확인된 `FAILED`, 허위 성공 금지 |

기존 Spring Boot의 `application/problem+json` 구조를 고려해 `code`·`traceId`·`fieldErrors` 후보를 사용한다. 원문 댓글·token·요청 query·내부 DB 정보는 오류/로그에 노출하지 않는다.

## 8. G4-2E — 계약·부정 테스트

코드: `shared/contracts/yu32-operations-v0/contract.cjs`, `yu32-operations.schema.json`, `tests/contract.test.cjs`. 모두 **합성 오프라인 계약 검사**이며 운영 Authorization 로직이 아니다. 머신 판독·출처·상태 부정 검증은 현재 **T01~T26(26건)**으로 구성한다. 아래 A01~A12는 별도의 장기 서버 수용 시나리오이며 T번호와 일대일 대응하지 않는다.

| 수용 시나리오 | 검증 사항 | 범위 |
|---|---|---|
| A01–02 | 입력 canonical VIDEO, 임의 tenant/role/policy 필드 거부 | 오프라인 |
| A03–04 | Guest 공개 읽기/쓰기 차단, 테넌트 교차 접근 차단 | 가상 권한 Gate |
| A05–06 | 정책 HOLD·기능 OFF·구독/할당량 불가 차단 | 가상 권한 Gate |
| A07 | 같은/다른 멱등 키 동시 처리·중복 예약 | **실제 DB 테스트 필요** |
| A08 | 상태 전이 단조성·종단 상태·새 attempt | 오프라인 표 + **실제 DB 필요** |
| A09 | MISS/NO_DATA/STALE·위조·출처 불일치 | 합성 경계 + 서버 미검증 |
| A10 | Worker 장애·리스 재할당·재시작 복구 | **실제 DB/Worker 필요** |
| A11 | Chrome Hover GET-only, Side Panel 정상 | 기존 수동 QA, 운영 API E2E 별도 |
| A12 | 새 API Adapter·기존 Summary v1 wire 검증 | Consumer/Provider 미구현 |

오프라인 테스트에서는 `APPROVED_TEST_ONLY`를 사용하지만 이는 실제 승인 값이나 서버 기능 플래그가 아니다.

## 9. YouTube 외부 정책 확인 (2026-10-30)

[YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies) · [파생 지표 및 데이터 보관 추가 정책](https://developers.google.com/youtube/terms/derived-metrics-policy) · [정책 개정 이력](https://developers.google.com/youtube/terms/revision-history) · [Quota/감사](https://developers.google.com/youtube/data/guides/quota_and_compliance_audits)

2026년 추가 파생 지표 정책은 감성 분석 등 특정 분석 사용 사례를 조건부로 다루며, 개정 정책 수락/정해진 승인 절차가 필요하다. 그것이 **YOUTOPIA의 승인 완료를 뜻하지 않는다**. 실제 원문/파생 데이터 수집·이용·보관·삭제·고객 제공은 담당자 검증 기록 전까지 `POLICY_HOLD`로 유지한다. 합성 24시간 TTL과 가상 예산은 운영값이 아니다.

## 10. 단계 판정과 후속 Gate

- **G4-2 산출물:** 후보 문서, 엄격한 머신 판독 입력·응답 계약, 합성/부정 테스트, CI 결과. GitHub PR 병합은 별도 승인.
- **G4-3 전제:** 운영 인증/tenant/entitlement 결정, YouTube 승인/보관/삭제 근거, 서버 Job/DB 설계 검수, API 구체 버전 동결.
- **G4-3 개발:** 동시성·DB uniqueness·멱등성·리스 복구·API 권한 테스트·Consumer/Provider 실제 통합. 운영 데이터 소스는 승인 전 금지.
- 고객용 `extension/manifest.json`·현재 Worker·Side Panel·프런트엔드 합성 UX는 이 단계에서 변경하지 않는다.

**현재 판정: 문서/테스트 후보. 운영 API 없음, 고객 분석 요청 비활성, 외부 정책 Gate 유지.**
