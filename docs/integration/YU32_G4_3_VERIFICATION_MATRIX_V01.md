# YOUTOPIA — YU-32 G4-3 설계·통합 검증 매트릭스 v0.1

> **단계:** `G4-3 / DESIGN_DRAFT / NOT_PRODUCTION_READY`
> **설계 정본:** [G4-3 상세 설계](./YU32_G4_3_PERSISTENCE_AUTH_RECOVERY_DESIGN_V01.md)
> **계약 정본:** [G4-2 API·인가](./YU32_G4_2_API_AUTHORIZATION_CONTRACT_V01.md)
> **검증 용어:** `DESIGN_ONLY`=정적 설계/오프라인 모델, `DB_NOT_RUN`=실제 PostgreSQL 미검증, `SECURITY_NOT_RUN`=실제 서버 인가 미검증, `POLICY_HOLD`=소스 이용 승인 미확정

## 1. 증거 수준과 완료 정의

| Gate | 반드시 필요한 증거 | 이번 단계 |
|---|---|---|
| GD-1 문서 구조 | 기본 읽기 전용 풀 분리, Job/Scope/Snapshot 영속 모델, 정책·삭제/복구 경계 | 설계 초안 검토 대상 |
| GD-2 오프라인 계약 | JSON 불변식과 유한 상태 모델 부정 테스트가 CI에서 통과 | 코드를 실행해도 `DESIGN_ONLY` |
| GD-3 DB 현실성 | PostgreSQL16에서 동시 트랜잭션, partial UNIQUE, lease CAS, outbox/예산 원자성 | `DB_NOT_RUN` |
| GD-4 서버 인가 | Spring Security/Redis 세션·CSRF·tenant/BOLA·구독·역할·계정 변경/restore fence | `SECURITY_NOT_RUN` |
| GD-5 출처 정책 | 실제 YouTube/파생 지표·보관·철회·삭제·제공자 비용/쿼터 허가 증거 | `POLICY_HOLD` |

**판정 원칙:** GD-1/2 PASS는 설계 제출만 의미한다. GD-3~5가 PASS이기 전에는 G4-3 운영 구현 PASS, 데이터 수집 PASS, 안전 출시 PASS를 선언할 수 없다.

**오프라인 시험 식별자:** `G43-D01~G43-D33` 총 33건. 이들은 설계 JSON/유한 모델을 검사한다. 아래 `G43-O01~O28`은 향후 실제 서버·DB·보안 구현 수용 시나리오로, 일부 조건만 오프라인 예시에서 다루고 **실행 완료로 승격하지 않는다**.

## 2. 설계 시뮬레이션 및 부정 시험

| ID | 시나리오 | 반드시 성립하는 불변식 | 검증 방법 / 상태 |
|---|---|---|---|
| G43-O01 | 단순 Hover 여러 번 반복 | POST·Job·quota·outbox 생성 없음 | 읽기 전용 의도 `DESIGN_ONLY` |
| G43-O02 | 같은 VIDEO, 분석 버전/기간/언어 변경 | Scope 9필드 중 하나라도 다르면 별개 Scope | JSON 계약 정적 검사 |
| G43-O03 | PUBLIC에 비어 있지 않은 tenantId 제공 | 거부, 임의 NULL 치환 금지 | JSON 제약 |
| G43-O04 | TENANT_PRIVATE, Guest/타 조직 | 존재 여부 포함 비공개, 요청 거부 | 권한 표/부정 모델 |
| G43-O05 | 같은 principal+Idempotency-Key+body 재요청 | 같은 결정, 중복 비용 예약 없음 | 모델 논리 / 실제 DB 미검증 |
| G43-O06 | 같은 key, 다른 canonical body | 409, Job/차감 없음 | 모델 논리 / 실제 DB 미검증 |
| G43-O07 | 다른 key, 같은 Scope·partition 동시 POST | 활동 중 Job 최대 1개, 비용 예약 1회 | 모델 설명 / `DB_NOT_RUN` |
| G43-O08 | 다른 tenant/partition의 public scope | 타 고객 활동/Job ID 유출 금지 | 설계 조건 / `SECURITY_NOT_RUN` |
| G43-O09 | COMMIT 성공, HTTP 응답 유실 | 다음 POST가 같은 결과 확인, 중복 생성 없음 | `DB_NOT_RUN` |
| G43-O10 | COMMIT 전 예외 | Job+budget+outbox 모두 롤백 | `DB_NOT_RUN` |
| G43-O11 | Redis throttling 카운터만 성공 | 분석 비용 예약/과금 성공으로 오인 금지 | 설계 경계 |
| G43-O12 | 정책 상태 미확정·feature disabled | fail-closed, Job/공급자 호출 0 | JSON Gate 및 부정 모델 |
| G43-O13 | Guest Job POST | 401, 신규 Job 없음 | 설계 부정/서버 미검증 |
| G43-O14 | Worker 2개 같은 Job claim | 동시 유효 lease owner 하나 | `DB_NOT_RUN` |
| G43-O15 | Worker crash 후 lease 만료 | 새 epoch로 같은 Job 재claim | 모델 논리 / `DB_NOT_RUN` |
| G43-O16 | 구 epoch Worker의 늦은 완료 | CAS 거부, Snapshot/Latest 변경 0 | 모델 논리 / `DB_NOT_RUN` |
| G43-O17 | Lease 만료 후 heartbeat | 무효, Job 상태 허위 연장 불가 | `DB_NOT_RUN` |
| G43-O18 | 정책 철회가 Job 실행·발행과 경합 | dispatch/publish/read 모두 정책 재검증; 철회 후 수치 없음 | `DB_NOT_RUN` + `SECURITY_NOT_RUN` |
| G43-O19 | Job SUCCEEDED, Snapshot 대상/버전 불일치 | `ScopeLatest` 발행 금지, 감성 수치 없음 | G4-2 계약 + 서버 미검증 |
| G43-O20 | NO_DATA/STALE/SYNTHETIC | 확인된 없음/오래됨/합성 출처를 실제 0/READY로 승격 금지 | G4-2 검증 기준 |
| G43-O21 | 계정 탈퇴/삭제/복구한 DB 스냅샷 | 기존 정책·계정 권한 부활 금지 | `SECURITY_NOT_RUN` + 복구 통합 |
| G43-O22 | 타 사용자 ID로 GET Job/Snapshot | `404` 비노출, tenant 경계 일치 | `SECURITY_NOT_RUN` |
| G43-O23 | Snapshot 공개 직전 정책 재검증 실패 | `POLICY_BLOCKED`/안전 차단, 본문 수치 0 | `SECURITY_NOT_RUN` |
| G43-O24 | 외부 제공자 호출 중 Worker 교체 | DB publish은 fencing, 외부 exactly-once는 **보장하지 않음** | 공급자/비용 정산 `POLICY_HOLD` |
| G43-O25 | 기존 기본 `ytp_app_data_ro` 풀로 INSERT 시도 | 쓰기 실패, role 권한 에스컬레이션 불가 | `DB_NOT_RUN` |
| G43-O26 | 새 분석 pool에 관리자/마이그레이션 계정 사용 | `RuntimeDataSourceGuard`에서 기동 차단 | `SECURITY_NOT_RUN` |
| G43-O27 | Outbox 중복 재전송 | Job claim·중복 예약 없이 처리 | `DB_NOT_RUN` |
| G43-O28 | 테스트 합성 임의 승인 | 실제 데이터·운영 API 열림 없음 | manifest/source/feature gate 정적 확인 |

## 3. 격리 실험에서 필요한 증거

### 3.1 PostgreSQL 16 / DB 전용

- 폐기 가능한 loopback PostgreSQL 16에서만 테스트. 실제 운영 DB의 구조/세션/secret 불러오지 않음.
- 두 세션/두 Worker의 동시 POST 및 충돌, CAS 갱신 결과 행 수, 부분 유일 인덱스 재현 로그, commit/reconnect/replay를 남김.
- 신규 권한 최소화: 읽기 전용 `ytp_app_data_ro`의 write 금지, 전용 pool의 SELECT/INSERT/UPDATE 대상 테이블 allowlist, DDL/owner/superuser/BYPASSRLS 금지 증빙.
- `FOR UPDATE SKIP LOCKED`은 큐 소비용 후보이며 공정성/잠금/중복 비용·경합을 별도 시험.
- 외부 API 호출 없이 고정 합성 Snapshot만 저장·검증. 테스트 데이터/DB는 작업 종료 시 폐기.

### 3.2 Spring Boot / 보안·세션

- `AccountSessionFilter`·`RestoreFenceFilter`의 fail-closed 동작 유지, CSRF/cookie, 인증 취소·역할 전환·테넌트 변경·계정 삭제를 재현.
- `SecurityConfiguration.anyRequest().denyAll()`에서 새로운 분석 route를 임의 permitAll하지 않음. 서버 권한 결정을 호출마다 재검증.
- 익명 공개 Snapshot은 source license·scope·expiry가 승인된 경우만 GET 허용; 로그인 없이 분석 Job POST 불가.
- 같은 ID라도 타 테넌트/별개 actor Job 활동 정보를 노출하지 않아야 함.

### 3.3 Worker / 장애·복구

- Worker A claim → lease 만료 → B reclaim → A 완료 시도 → B 완료: A는 0 rows updated, B만 1회 Snapshot latest 발행.
- 서비스/Redis/DB 장애를 각각 분리해 시험. Redis limit만으로 DB 비용 정산 완료를 판단하지 않음.
- 수집/추론 실제 수행 없음. 영속 재기동·outbox at-least-once·worker fencing만 실험 대상으로 고정.

## 4. 필수 설계 리뷰·의사결정

| 결정 | 질문 | 결정 전 기본값 |
|---|---|---|
| DEC-G43-01 | 분석 쓰기용 DB 역할/스키마/별도 서비스 | NOT_APPROVED |
| DEC-G43-02 | 권한·구독·정책 최신 버전을 DB와 어떻게 재검증하나 | FAIL_CLOSED |
| DEC-G43-03 | 공개 결과의 고객 간 활성 Job 합류가 허용되는가 | ISOLATE_EXECUTION_PARTITIONS |
| DEC-G43-04 | 외부 호출 중복·비용/환불 처리 | NO_EXTERNAL_CALL |
| DEC-G43-05 | lease·backoff·운영 TTL/보존 정책 | NO_PRODUCTION_CONSTANTS |
| DEC-G43-06 | YouTube 사용권·파생지표·삭제/복구 승인 | POLICY_HOLD |
| DEC-G43-07 | customer/admin/QA 역할별 인가와 오류 | DENY_UNVERIFIED |
| DEC-G43-08 | analysis-v1 실제 Snapshot payload 검증/adapter | NO_REAL_SNAPSHOT_PUBLISH |

## 5. PR 검수 및 인계 기준

설계 PR에는 문서 2개·설계 불변식 JSON·오프라인 검증만 포함한다. `feat/backend-bootstrap`, `backend`, `dev`, `main` 및 운영 DB/Chrome/서버 실행 설정은 변경 금지.

- CI의 새 검증 결과는 **`DESIGN_STATIC / SIMULATION_OFFLINE`만 PASS**로 기록한다.
- 실제 DB/보안/원본 데이터/Worker 관련 행은 미실행으로 남긴다.
- PR 병합은 사용자 별도 승인; G4-4 격리 프로토타입 착수와 운영 API/정책 승인 역시 별도 단계다.

**현재 판정: 검증 계획 정리 완료(초안), 실제 DB·Worker·권한의 검증은 NOT_RUN.**
