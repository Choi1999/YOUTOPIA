# YOUTOPIA — YU-32 G4-3 서버 영속화·인가·장애 복구 상세 설계 v0.1

> **문서 유형:** 제안 설계 / 독립 검수 대상 / 코드 배포 아님
> **현재 상태:** `DESIGN_DRAFT / OFFLINE_ONLY / API_NOT_IMPLEMENTED / POLICY_HOLD`
> **Git 기준:** `frontend` @ `082942b48d0a23c81c3388ebdc320d73e5e12734`; 보존 중인 `feat/backend-bootstrap` @ `4e2714ef5107acab44fa79075840e463e5df8f39`
> **G4-2 상위 계약:** [G4-2 API·인가 계약](./YU32_G4_2_API_AUTHORIZATION_CONTRACT_V01.md)
> **명시적 제외:** 서버 구현, DDL/마이그레이션 실행, 외부 API/YouTube 데이터 접근, OAuth/결제/LLM 활성화, Spring Boot 브랜치 병합, 실제 운영 승인

## 1. 결정 근거와 기존 자산의 경계

| 소스에서 확인한 사실 | 설계상 함의 | 코드 재사용 판단 |
|---|---|---|
| `feat/backend-bootstrap/src/main/resources/application.yml`의 기본 `spring.datasource.hikari.read-only: true`와 `default_transaction_read_only=on` | 기본 `ytp_app_data_ro` 풀에 분석 Job 쓰기를 추가하면 안전/권한 가정 위반 | 쓰기 전용 최소권한 풀 후보 별도 설계 |
| `AccountConfiguration`의 계정·관리·감사별 JDBC 풀 | 일부 분리 패턴 존재; 분석 데이터 쓰기 허용과는 별개 | 패턴 참고, 기존 계정/감사 풀에 분석 쓰기 혼용 금지 |
| `RuntimeDataSourceGuard`의 운영 로그인·역할·스키마 소유권 검사 | 신규 풀을 도입하려면 운영 role 매핑·기동 검증·금지 권한 검사 확대 필요 | 기존 가드를 우회하지 않음 |
| `SecurityConfiguration`의 Spring Security·기본 deny-all, `AccountSessionFilter`와 `RestoreFenceFilter` | 세션/CSRF/복구 펜스 기반은 있지만 YU-32 전용 RBAC·구독 인가는 없음 | 보안 구성 참고, 로그인만으로 Job 권한 부여 금지 |
| `CcuRequestBudget` 및 `AccountBudget`의 Redis 창 제한 | 남용/스로틀 사례이며 PostgreSQL과 원자적 비용 예약은 아님 | 운영 분석 Job/공급자 비용의 정산 원장으로 재사용 금지 |
| `PrivacyPurgeService`, `RestoreCoordinator` 및 독립 삭제 저널 | 분석 Snapshot과 Job도 삭제·백업 복구의 수명 주기 검토 대상 | 승인 전 개인정보 및 보존 상태와 무관하게 생성 금지 |
| `GET /api/v1/youtube/videos/{videoId}/observations` | 조회수`view_count` 관측용, 댓글 분석이 아님 | 분석 Summary의 출처로 치환 금지 |

**설계 판단:** 운영 Write Model을 기존 읽기 전용/관리자/삭제 통제 계정으로 우회하지 않는다. `youtopia.analysis.enabled` 등 구체적인 설정 키와 DB 역할은 **미확정 후보**이며 기본값은 항상 비활성이다. 분석용 DB 계정·스키마·GRANT·마이그레이션 도구를 별도 심사한다.

## 2. 불변식 및 분석 Scope

서버의 정규화 Scope는 상위 G4-2에서 승인된 정확히 9개 필드를 유지한다.

```text
source, targetType, targetId, analysisSpecVersion, observationWindowId,
samplingPolicyVersion, locale, visibility, tenantId
```

- `source=YOUTUBE`, `targetType=VIDEO`, 11자리 `targetId`만 현재 G4-2 후보 범위. 채널 요청 별도.
- `PUBLIC_REUSABLE → tenantId=null`, `TENANT_PRIVATE → authenticated allowed tenantId`. 클라이언트의 visibility/tenant/role/policy 플래그 수신 금지.
- 정규화된 9개 필드로 안정적인 Scope ID를 결정한다. 유일성은 **전체 필드 값**과 제약으로 보장한다. SHA 해시만을 절대 진실로 간주하지 않고 충돌·정규화 버전 오류를 검사한다.
- 조회·Job·Snapshot은 동일 Scope와 정책/권한 경계를 따라야 한다. Scope ID나 Job ID만으로 접근 권한이 생기지 않는다.
- `MISS`, `NO_DATA`, `STALE` 및 `POLICY_BLOCKED`를 합치지 않는다. `NO_DATA`는 확인된 없음이고 0%가 아니다.
- **Hover GET은 순수 조회**다. Job 생성·외부 API·quota reservation·outbox 쓰기를 트리거하지 않는다.
- `SUCCEEDED` Job은 Snapshot 공개 승인이 아니다. 실제 Snapshot provenance·관측 정의·분모·시간·사용권 및 현재 권한의 검증을 다시 통과해야 한다.

## 3. 데이터 모델 후보 및 제약

모든 이름은 **제안 설계**이며 실제 DDL이나 기존 DB 테이블이 아니다. 저장 목적, 최소권한, 삭제 시점은 별도 결정이 필요하다.

| 후보 엔터티 | 필수 필드/키 | 데이터 정확성·보안 제약 |
|---|---|---|
| `AnalysisScope` | scope_id, canonical 9-field tuple, normalization_version, created_at | unique canonical tuple; visibility/tenant CHECK; 변경 불가 |
| `AnalysisJob` | job_id, scope_id, execution_partition, request_actor_tag, attempt, retry_of_job_id, state, version, lease_epoch, lease_owner, lease_expires_at, current_policy_epoch, snapshot_id, created_at, updated_at | FK scope; terminal state immutable; active-job partial UNIQUE (`scope_id,execution_partition`); 단조 version·epoch |
| `IdempotencyRecord` | principal_tag, idempotency_key_hash, canonical_request_digest, decision, job_id, created_at, expiry_policy_ref | UNIQUE (`principal_tag,idempotency_key_hash`); 같은 키 다른 본문 409; 결정 재조회에도 재인가 |
| `BudgetReservation` | reservation_id, actor_tag, scope_id, job_id, cost_class, window_id, amount, state, created_at | 동일 Job·비용 종류 중복 예약 방지; HELD/COMMITTED/RELEASED 등 회계 기록 (정책값 미확정) |
| `AnalysisSnapshot` | snapshot_id, scope_id, job_id, immutable payload_ref, schema_version, status, provenance_ref, policy_epoch, observed_at, analyzed_at, created_at | 출처·범위·분모 확인 전 공개 불가; Job↔Snapshot 일치; immutable |
| `ScopeLatest` | scope_id, snapshot_id, revision, published_at, policy_epoch | 현재 유효한 결과 참조만 CAS 발행; 과거 Worker가 새 Snapshot을 덮지 못함 |
| `JobOutbox` | event_id, job_id, event_type, version, emitted_at, dispatch_state | Job/예산 예약과 같은 DB 트랜잭션에서 기록; 중복 전송은 허용하되 Worker는 중복 claim 차단 |
| `PolicyDecisionAudit` | actor_tag, action, scope_id, decision, policy_version, entitlement_version, evaluated_at | 비밀·원문·민감 검색어 기록 금지; 수집 권리·철회 이벤트는 별도 증빙 연결 |
| `PrivacyRevocation` (개념) | subject_tag, policy_epoch, revoked_at, purge_state | 삭제·철회·백업 복구 시 읽기/처리/발행 금지; 독립 삭제 저널과 조정 필요 |

**추가 분리:** `PUBLIC_REUSABLE` Snapshot의 공유 가능성과 **다른 고객의 실행 중 Job을 공유/노출할 권한**은 동일하지 않다. 초기 제안은 동일 actor 또는 승인된 tenant에 한정한 `execution_partition`으로 활성 Job을 중복 제거하고, cross-principal 실행 합류는 **DEC-G43-03** 정책 결정 전 금지한다. 이는 G4-2의 “동일 Scope 활성 Job 합류”를 보안 범위 내에서 구체화하려는 **변경 후보**이므로 제품/계약 리뷰에서 명시적으로 승인해야 한다. 다른 actor에게 원 Job ID/요청 활동을 공개하지 않는다.

### 3.1 PostgreSQL 16 제약·쿼리 패턴 (예시만, 적용 금지)

부분 UNIQUE 인덱스는 활동 중 Job 하나를 DB 차원에서 보장하는 후보이며, 단순 애플리케이션 `SELECT→INSERT`만으로 중복 실행을 방지하지 않는다.

~~~sql
-- PSEUDOCODE ONLY: 실행·마이그레이션 불가. 테이블 정의 및 운영 ROLE 승인 전.
CREATE UNIQUE INDEX candidate_one_active_analysis_job
  ON analysis_job (scope_id, execution_partition)
  WHERE state IN ('QUEUED', 'RUNNING');

-- In the same DB transaction: claim one queued or expired eligible job.
SELECT job_id, version, lease_epoch
  FROM analysis_job
 WHERE state = 'QUEUED'
    OR (state = 'RUNNING' AND lease_expires_at < CURRENT_TIMESTAMP)
 ORDER BY created_at, job_id
 FOR UPDATE SKIP LOCKED
 LIMIT 1;

-- Example optimistic CAS fence; parameter binding and policy checks omitted.
UPDATE analysis_job
   SET lease_epoch = lease_epoch + 1,
       version = version + 1
 WHERE job_id = :job_id
   AND version = :expected_version
   AND lease_epoch = :expected_lease_epoch;
~~~

실제 구현은 인덱스 predicate와 `ON CONFLICT` arbiter inference, serializable/`READ COMMITTED` 경합, `SKIP LOCKED` fairness, DB 시간, 잠금 순서, 정책 재검증, SQL 권한을 함께 시험해야 한다. **위 CAS 예시는 핵심 WHERE 조건 전체가 빠진 설명용 조각**이며 단독으로 사용하면 안 된다.

참고: [PostgreSQL 16 Partial Indexes](https://www.postgresql.org/docs/16/indexes-partial.html), [INSERT / ON CONFLICT](https://www.postgresql.org/docs/16/sql-insert.html), [SELECT / SKIP LOCKED](https://www.postgresql.org/docs/16/sql-select.html).

## 4. POST 분석 요청 — 멱등성·할당량·원자성

### 4.1 승인 가능한 경로 (설계 의사코드)

~~~text
1. Authenticate session + CSRF + current account/restore fence.
2. Parse exact G4-2 CreateJobRequest; reject client tenant/visibility/role fields.
3. Resolve canonical scope + execution partition on server.
4. Check live source permission, customer role, tenant, entitlement, feature gate and cost policy.
5. Open single authoritative PostgreSQL transaction.
6. Revalidate database-managed policy/entitlement epoch where available.
7. Lock principal+Idempotency-Key slot (unique constraint).
   - same digest: reauthorize, replay existing decision; do not charge again
   - different digest: 409, no Job/charge
8. Check verified existing FRESH Snapshot and matching policy.
9. Insert-or-join active Job via partial UNIQUE constraint within allowed execution partition.
10. For CREATED only, reserve budget once and write JobOutbox event in same transaction.
11. Persist idempotency result; COMMIT.
12. Return CREATED/JOINED/ALREADY_CACHED only after authoritative COMMIT.
~~~

- 요청 데이터는 **사용자가 명시적으로 실행**해야 POST할 수 있다. Hover는 GET-only.
- 상위 G4-2 `Idempotency-Key` UUIDv4 후보를 그대로 사용하되, 실제 키 생성/보존 수명·rate limits은 미확정.
- Spring Session Redis 및 외부 Policy service는 PostgreSQL Job 트랜잭션과 **원자적이지 않다**. DB에 저장 가능한 `policy_epoch` 및 `entitlement_version`을 기록하고 외부 상태 장애 시 차단한다. 계정·정책을 **Step 4에서 확인했다는 사실만으로 COMMIT/발행 시점의 안전성을 보증하지 않는다**.
- Redis의 `CcuRequestBudget`/`AccountBudget`은 남용 제어 사례일 뿐 분석 과금 원장이 아니다. 예약·사용·환불의 권위 있는 원장은 재시도와 같은 DB에서 관리하도록 제안한다.
- 외부 제공자 호출과 DB 커밋을 함께 롤백할 수 없다. **내부 Job 발행의 exactly-once 효과**와 **외부 호출의 exactly-once 보장**을 구분한다. 외부 호출 중복 비용·정책 위험은 승인된 공급자 멱등 API 또는 내역 대조/재처리 계약이 필요하다.
- 데이터가 임의·정책 차단/자격 상실이면 이전의 `ALREADY_CACHED` 응답도 재인가해야 하며 이전 성공을 무조건 replay하지 않는다.

### 4.2 순서와 실패 처리

| 경합/실패 | 필수 결과 |
|---|---|
| 동일 actor·key·digest 2 POST | 같은 결정/Job; 생성 1·예약 1 |
| 동일 key, 다른 digest | `409 IDEMPOTENCY_CONFLICT` |
| 다른 key, 동일 scope/partition의 활성 Job | 하나만 생성, 다른 요청은 `JOINED`; 다른 actor 활동 비공개 |
| 다른 tenant/partition | Job 공유·수치·사용량 노출 금지 |
| DB COMMIT 직후 응답 유실 | 재요청 시 멱등 기록으로 동일 결론; 중복 예약 없음 |
| Redis/정책 검증 불가 | fail-closed; 승인 상태 추측하지 않음 |
| Budget 예약 뒤 트랜잭션 ROLLBACK | Job·예약·Outbox 모두 생성 0 |
| 비용 차감/외부 호출 실패 | 실패 원인·실제 과금/환불 구분, 허위 성공 금지 |

## 5. Worker claim·리스·펜싱·복구

### 5.1 상태 축

`QUEUED → RUNNING → SUCCEEDED | FAILED`, 시작 전 검증 실패는 `QUEUED → FAILED`도 가능하다. **사용자 재시도는 새 Job/attempt**, Worker crash 자동 회복은 **같은 Job의 새로운 lease_epoch**이다. 둘을 혼동하지 않는다.

~~~mermaid
flowchart TD
    A[QUEUED: durable Job + Outbox] --> B{Policy and budget still valid?}
    B -->|No| F[FAILED or blocked; no external call]
    B -->|Yes| C[RUNNING: claim + lease_epoch]
    C --> D{Worker result and lease still current?}
    D -->|Valid snapshot and policy| E[Atomic snapshot + SUCCEEDED + latest pointer]
    D -->|Invalid, terminal| F
    D -->|Lease expired| G[Reclaim with higher fencing epoch]
    G --> C
    D -->|Stale worker token| H[Reject old result; no publication]
~~~

### 5.2 Worker 최소 조건

1. Claim은 DB row lock/`SKIP LOCKED` 후 **단조 fencing token(epoch)**, 고유 lease owner, DB 서버 시각 기반 만료를 원자적으로 기록한다.
2. Claim 직전/외부 호출 직전/커밋 및 결과 공개 직전까지 **현재 정책·삭제 펜스·자격·소스 사용권**을 재확인한다.
3. Heartbeat·완료·실패·Snapshot 발행은 `job_id + lease_owner + lease_epoch + expected_version + state + nonexpired_lease`의 CAS 조건을 만족해야 한다. 0 rows updated이면 오래된 Worker를 차단한다.
4. 수치 Snapshot은 메모리 생성만으로 공개되지 않는다. 결과 검증과 Job 완료 및 `ScopeLatest` 발행은 한 DB 트랜잭션에서 묶되, 이전 상태/정책 epoch를 다시 검증한다.
5. `RUNNING`이 만료되면 watchdog이 같은 Job을 새 lease_epoch로 재할당하거나 복구 한도 초과 시 `FAILED` 처리한다. 영구 RUNNING 방치는 금지한다.
6. **경합 보증 범위:** 중복 Worker가 실행될 수는 있지만, **구버전 Worker는 결과를 덮어쓰지 못한다**. 검증에는 lease epoch뿐 아니라 Job의 **예상 version**도 포함하며, heartbeat가 새 version을 반환하면 구 version은 무효가 된다. 외부 API의 exactly-once 실행은 이 설계만으로 보장하지 않는다.
7. Lease/heartbeat/retry 수치와 Worker 동시성은 미정. 임의 운영 TTL/재시도 횟수를 이번 단계에 상수로 정하지 않는다.

### 5.3 재시작·장애별 안전 결과

| 상황 | 재시작/복구 |
|---|---|
| DB 저장 전 프로세스 종료 | Job·Outbox 미생성 또는 트랜잭션 전체 롤백 |
| Job/Outbox COMMIT 후 프로세스 종료 | Outbox 재전송 및 재claim 가능, 중복 생성 없음 |
| Worker 응답 유실·리스 만료 | 새 lease_epoch로 재claim, 구 epoch 결과 폐기 |
| 오래된 Worker가 늦게 성공 통지 | CAS 실패, Snapshot/Latest 미발행 |
| 동일 Source 비용 중복 우려 | 외부 exactly-once 미보장으로 표시, 별도 정산/멱등 계약 |
| 서버 시간 오차 | DB clock 기준 리스 연산으로 범위 축소; 실측/동기화 검증 필요 |
| 정책 철회 또는 사용자 계정 삭제 | 모든 수치 조회/재시도/발행 차단; 삭제 저널과 정합성 검사 |
| 장애 중 증거 없는 성공·부분 성공 | `UNAVAILABLE` 또는 검증된 `FAILED`, 임의 수치 0/READY 금지 |

## 6. 보안 경계·권한 표

| Operation | Guest | Customer 자기 범위 | 타 Tenant | Platform Admin/QA |
|---|---|---|---|---|
| `GET summary` | 승인된 PUBLIC Snapshot만 | 공개 + 허용된 private | `404 RESOURCE_UNAVAILABLE` | 고객 데이터 조회 권한 별도, 기본 허용 아님 |
| `POST job` | `401` | 인증·정책·구독·quota 모두 충족할 때만 | `404` 또는 `403`(정보 비누설) | 관리자 역할/QA 모드로 우회 금지 |
| `GET job` | 승인 없는 Job 정보 비공개 | 자기 Job 또는 별도 명시 허용 | `404` | 운영 조회는 별도 감사 권한 |
| `GET snapshot` | 승인된 PUBLIC만 | 현재 인가된 scope만 | `404` | 삭제/사용권 철회된 데이터는 거부 |
| `Worker claim/complete` | 불가 | 불가 | 불가 | 고객 세션과 별도의 최소권한 내부 서비스 주체만 |

- G4-2에서 정의한 `FEATURE_DISABLED`, `POLICY_BLOCKED`, `ENTITLEMENT_LIMITED`, `QUOTA_DEFERRED`를 서비스 오류로 유지. 플랫폼 사용권 미확정은 **모든 실제 Job 생성/수집/분석에 우선하는 `POLICY_BLOCKED`**.
- 고객 브라우저의 `role`, `tenantId`, `visibility`, `requestAllowed`, `isTrusted`, 구독 상태를 신뢰하지 않는다. 서버는 현재 세션과 서버 저장된 정책·권한을 검증한다.
- `AccountContext.require`는 로그인 계정 교체 감지용이고 조직별/분석 자원별 인가를 완성하지 않는다.
- 기존 `SecurityConfiguration.anyRequest().denyAll()`을 유지하며 새 경로는 독립 인가 시험 전까지 열지 않는다. `POST`는 CSRF와 세션, 상세 scope/entitlement 검사를 모두 요구한다.
- `RuntimeDataSourceGuard`에서 새 분석 DB pool 등록 시 예상 role과 실제 계정/DB/schema 권한을 검증한다. `ytp_app_data_ro`에 쓰기를 허용하거나 관리/삭제 계정을 분석 쓰기 풀로 재사용하지 않는다.

## 7. Policy·Retention·Privacy·Restore

실데이터/파생지표의 보존 및 삭제 기준은 승인 전 미확정이다. `analysis.` 스키마와 DDL은 생성하지 않는다.

- Snapshot 공개 전 source/provenance/usage-rights/license/version, 관측 윈도, denominator, 가용성, policy epoch 및 expiry를 확인한다. `STALE`은 최신 수치를 제공하지 않는다.
- 철회·삭제 시 `PrivacyRevocation` 또는 삭제 펜스의 현재 상태가 구분 가능한 참조를 즉시 차단해야 한다. DB 스냅샷이 남아 있어도 **응답에서 노출하지 않음**.
- 분석 Snapshot에 개인정보/댓글 원문을 기본 저장하지 않는다. 삭제 범위에는 Job·Snapshot 참조·Outbox·Audit·백업·캐시가 포함될 수 있으므로 담당자 승인 후 구체화한다.
- 계정 삭제/복구는 기존 독립 삭제 저널 및 복구 펜스를 우회하지 않는다. 백업에 있던 과거 Snapshot과 권한·세션이 부활하지 못하도록 revocation epoch/restore generation 교차 확인이 필요하다.
- 로깅: 허용된 비식별 Job ID, reason code, 정책 버전, 실행 단계 등 최소 정보만. OAuth/access tokens, 비밀번호, 원문 댓글, 개인 활동 추적값은 추가하지 않는다.
- 데이터 보존 주기·법적 예외·저장 지역·암호화·서비스 제공자 조건/계약·감사 주체 모두 **DECISION_REQUIRED**. 제품 출시/실측 수집 허가로 해석 금지.

## 8. G4-3 검증과 수용 기준

검증 정본: [G4-3 검증 매트릭스](./YU32_G4_3_VERIFICATION_MATRIX_V01.md). 머신 판독 설계: `shared/contracts/yu32-g4-3-design-v0/invariants.json`. 이 파일은 **JSON Schema가 아닌 설계 데이터**다. 오프라인 불변식·반례 시험 **33건**은 개념 모델 검증일 뿐 실제 데이터베이스·인가·분산 Worker 증거가 아니다.

| 수준 | 가능/필수 검증 | 판정 기준 |
|---|---|---|
| `DESIGN_STATIC` | 문서와 Scope·role·invariant·상태 전이 일관성 | CI 통과만으로 **설계 초안** 단계 인정 |
| `SIMULATION_OFFLINE` | duplicate/revoke/fence 실패 시나리오의 순수 모델 | 런타임·PostgreSQL/Redis 실행 주장 금지 |
| `DB_INTEGRATION` | PostgreSQL16 2~N 동시 POST, partial UNIQUE, read/write pool 제한, 리스 획득/실패 주입 | 실제 트랜잭션 검증 전까지 **NOT_RUN** |
| `SECURITY_INTEGRATION` | Redis 세션·CSRF·BOLA·tenant/role/entitlement·restore fence | 실제 인증·인가 구현 전 **NOT_RUN** |
| `WORKER_RECOVERY` | 두 Worker·crash/restart·double completion·outbox 재전송·policy revocation | 실제 Worker/DB 전 **NOT_RUN** |
| `PROVIDER_COMPLIANCE` | YouTube 데이터 이용·파생·보관/삭제·승인·제공자 비용/정산 | 정책 증빙 및 계약 체결 전 **POLICY_HOLD** |

**검수 통과와 배포 승격을 분리한다.** 이 문서의 승인으로 신규 `@RestController`, DB role/DDL, 이벤트 Worker, 외부 데이터 소스, 실사용자 Job 요청을 열지 않는다.

## 9. 미결정 사항 및 권장 다음 단계

| ID | 미결정 사항 | 안전한 기본값 / 필요한 근거 |
|---|---|---|
| DEC-G43-01 | 분석용 쓰기 DB·역할·운영 Guard | 기존 읽기 전용 풀/관리/삭제 계정 재사용 금지; 역할/DB 승인 |
| DEC-G43-02 | Scope/업무 정책 원장의 정본과 교차 자원 일관성 | 정책 조회 불가 시 BLOCK; epoch/신원 검증 |
| DEC-G43-03 | PUBLIC_REUSABLE의 cross-principal 활성 Job 합류 | 초기에 actor/tenant execution_partition 경계; 명시 승인 전 타 고객 공유 금지 |
| DEC-G43-04 | 소스별 API·분석 비용 예산/정산·중복 외부 호출 | 정본 원장/공급자 멱등성 결정; Redis throttle는 대체물 아님 |
| DEC-G43-05 | Lease/heartbeat/복구 한도·운영 TTL/보존 | 임의 수치 고정 금지, 장애 시험/정책 검토 |
| DEC-G43-06 | 개인정보·파생 지표 정책/보존/삭제/복구 승인 | `POLICY_HOLD` 유지, 책임자·유효 범위·근거 필요 |
| DEC-G43-07 | Job/Snapshot 조회 권한 및 공개 캐시 범위 | 사용자/조직 분리, 존재 여부 은닉, read-time 재인가 |
| DEC-G43-08 | G4-2 `analysis-v1` 실제 Snapshot payload/Adapter 계약 | 서버 Consumer·Provider test 전 승격 금지 |

권장 후속 작업은 **독립 설계 검수 → 별도 승인으로 Draft PR 병합 → G4-4 격리 DB/Worker 프로토타입 시험 계획 수립**이다. 실제 PostgreSQL·Redis·Spring Boot 조합에서 검증하기 전에 “영속화 완료” 또는 “복구 가능” 판정을 해서는 안 된다.

**최종 상태: G4-3 상세 설계 초안. 운영 구현·정책·권한은 모두 비활성.**
