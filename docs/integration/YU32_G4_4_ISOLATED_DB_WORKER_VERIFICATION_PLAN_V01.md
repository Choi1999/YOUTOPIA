# YOUTOPIA — YU-32 G4-4 격리 PostgreSQL·Worker 검증 계획 v0.1

> **현재 상태:** PLAN_DRAFT / OFFLINE_ONLY / NOT_RUN / POLICY_HOLD
> **문서 성격:** 계획 전용. 격리 DB·Worker를 구현하거나 실행한 문서가 아님.
> **기준선:** frontend@ce03f2ced337be12a8337a6fb78d46f29d68b00c (PR #43 병합 완료)
> **백엔드 참조:** feat/backend-bootstrap@b72d47e9565818cc9e248def1c6fd305f870a149 (읽기 전용 참조; 변경·병합하지 않음)
> **근거:** [G4-2 분석 API 계약](./YU32_G4_2_API_AUTHORIZATION_CONTRACT_V01.md) · [G4-3 영속·인가·복구 설계](./YU32_G4_3_PERSISTENCE_AUTH_RECOVERY_DESIGN_V01.md) · [G4-3 수용 매트릭스](./YU32_G4_3_VERIFICATION_MATRIX_V01.md)
> **동반 문서:** [G4-4 실행 전 검증 매트릭스](./YU32_G4_4_VERIFICATION_MATRIX_V01.md)
> **승인 범위:** 사용자는 G4-4 **검증 계획 수립**을 승인했다. 실제 Lab 구축·실행, PR 병합, 운영 DDL/API, 소스 데이터 수집, 배포·비용은 별도 승인 대상이다.

## 1. 목적과 불변식

G4-3의 **오프라인 불변식 39건**과 실제 서버·DB 수용 시나리오 **G43-O01~O28(28건, 미실행)**을 바탕으로, PostgreSQL 16과 독립 Worker를 격리 실험할 때 필요한 구조·경합·정책·복구 증거를 구체화한다. 이번 단계의 성공은 **계획의 검수**일 뿐 DB/Worker 동시성 검증의 성공이 아니다.

변경 불가 안전 경계:

1. 실제 YouTube API, 댓글 원문, 감성 분석, LLM, 결제/구독, 운영 Job·Worker 실행은 모두 비활성. **POLICY_HOLD** 유지.
2. 현재 Spring Boot의 기본 DataSource는 read-only 설정과 DB 역할 **ytp_app_data_ro**를 유지한다. member/admin/audit/control/privacy 풀을 분석 쓰기 권한으로 승격하지 않는다.
3. G4-2의 정규화 Scope 9필드(source, targetType, targetId, analysisSpecVersion, observationWindowId, samplingPolicyVersion, locale, visibility, tenantId)를 유지한다. VIDEO만 후보; CHANNEL은 별도 계약이다.
4. 서버 확인 세션·tenant·role·entitlement·정책·복구 펜스를 브라우저의 입력/클릭 여부로 대체하지 않는다. 신규 API 경로는 기존 **anyRequest().denyAll()**에 의해 닫혀 있어야 한다.
5. Hover GET은 read-only이고 자동 POST/외부 호출이 없다. MISS, NO_DATA, STALE, FRESH, POLICY_BLOCKED는 혼합하지 않으며 합성 Snapshot을 실데이터 READY로 승격하지 않는다.
6. Snapshot 공유와 타 고객의 활성 Job 합류는 다른 문제다. **DEC-G43-03**이 확정되지 않았으므로 execution_partition을 신뢰된 actor/tenant 기준으로 분리한다.
7. Job/Idempotency/BudgetReservation/Outbox의 원자성 후보는 단일 권위 PostgreSQL 트랜잭션까지만이다. Redis, 세션, 외부 공급자 호출은 원자적이지 않으며 외부 exactly-once 보장은 없다.

## 2. 격리 실험 환경 — 미래 구현 후보

| 요소 | 실험 계획 | 금지·주의 |
|---|---|---|
| PostgreSQL | PostgreSQL **16**, 일회성 DB/schema/volumes, 독립 DB 연결 2개 이상 | 운영 DB host·dump·비밀정보·기존 DB 연결 금지 |
| 네트워크 | Docker Compose 전용 project/network 후보, 필요 시 127.0.0.1 loopback 포트 | 포트 바인딩만으로 egress 차단을 주장 금지. Worker 외부 egress 거부 시험 필요 |
| Worker | 독립 프로세스 A/B, 합성 정책 epoch·fault barrier, DB CAS | YouTube/API/LLM/실제 분석 실행 금지 |
| 계정 | Lab 관리자(일회성 DDL) / 최소권한 Lab Writer / 별도 Lab ReadOnly | ytp_app_data_ro 실계정·관리자·마이그레이션 credential 재사용 금지 |
| 데이터 | Ab0_-123xyz 등 합성 영상·tenant·principal·Snapshot/가상 비용 | 개인정보·실제 OAuth·실제 댓글·운영 캐시 유입 금지 |
| 도구 | Node 24, node:test와 DB 드라이버 또는 격리 Java JDBC 후보 | 구체 버전·driver·Compose 선택은 DEC-G44-01 미결정 |
| 결과물 | 익명화된 실행 로그, SQLSTATE, CAS 영향 행수, SHA-256 증거 요약 | raw DB, token, 개인 자료, 실제 서버 secret 커밋 금지 |

현재 Docker 설치·실행 가능성, 네트워크 격리 및 Lab 이미지/드라이버 버전은 **확인되지 않았다**. 실행 전 별도 승인과 Preflight가 필수다. 실제 Spring Security·CSRF·세션·삭제 저널·RestoreFenceFilter의 통합 검증은 이 Lab 결과로 대체할 수 없다.

미래 후보 파일 배치 (아직 생성하지 않음):

~~~text
shared/experiments/yu32-g4-4-lab-v0/
  README.md
  compose.lab.yaml
  sql/schema.lab.sql
  sql/roles.lab.sql
  src/lab-job-store.*
  src/lab-worker.*
  tests/
  .gitignore
~~~

Lab 구축을 승인받은 경우에만 만들고, frontend·backend·dev·main·feat/backend-bootstrap 및 실서비스 환경 설정은 건드리지 않는다. CI에 PostgreSQL 서비스나 네트워크 권한을 자동 추가하지 않는다.

## 3. PostgreSQL 제약·멱등성·예산 설계의 시험

- **Scope 유일성:** PUBLIC_REUSABLE은 tenantId=NULL, TENANT_PRIVATE는 현재 허용된 tenantId. 기본 UNIQUE 제약은 NULL을 서로 다르게 보므로 공개 Scope의 중복 insert를 막기 위해 **UNIQUE NULLS NOT DISTINCT** 또는 검증된 동등한 partial index/표현식 전략을 시험한다. 정규화 9필드 전체를 기준으로 하고 해시만 신뢰하지 않는다.
- **활성 Job 중복 제거:** scope_id + execution_partition에 QUEUED/RUNNING만 걸리는 partial UNIQUE. 동일 파티션/Scope의 다른 key 동시 POST에서 생성 1, JOINED 1, 예산 예약 1이 되도록 두 DB 연결에서 증명한다. ON CONFLICT와 predicate inference 및 충돌 재조회 경로도 점검한다.
- **멱등 결정:** principal+Idempotency-Key 해시와 서버 계산 canonical request digest로 슬롯 구분. 같은 키/본문은 생성 시 기록된 결정을 재생하고 추가 비용을 예약하지 않으며, 같은 키의 다른 본문은 409. 재생 시 최신 권한·정책은 재확인하되 이미 예약된 Job에 대해 **신규 Job 비용 잔액 부족**만으로 원 결정을 바꾸지 않는다.
- **원자성:** Job, IdempotencyRecord, BudgetReservation, JobOutbox가 같은 authoritative PostgreSQL 트랜잭션에서 COMMIT 또는 전부 ROLLBACK되어야 한다. 트랜잭션 내 예외, COMMIT 후 HTTP 응답 유실, 병렬 quota 소진, HELD→COMMITTED/RELEASED 경합 및 중복 환불을 주입한다.
- **SQL 재시도:** READ COMMITTED의 경합과 SERIALIZABLE 경합을 구분한다. SQLSTATE 40001(serialization failure), 40P01(deadlock), 23505(unique collision)의 처리를 구분하며 무조건 오류 무시하지 않는다. 필요한 경우 **결정 논리를 포함한 전체 트랜잭션**만 제한적으로 재시도한다. 운영 retry 횟수나 TTL/쿼터 수치는 이번 계획에서 확정하지 않는다.
- **권한:** Lab Writer는 별도 schema의 허용 테이블 SELECT/INSERT/UPDATE에 한정하며 ALTER/CREATE/GRANT, SUPERUSER, BYPASSRLS, 다른 schema 쓰기를 차단한다. 실험용 read-only 모의 계정의 쓰기 실패는 운영 ytp_app_data_ro의 실제 GRANT 검사 증거라고 주장하지 않는다.

## 4. Worker claim·lease fencing·장애 복구 시험

| 실험 | 조건/장애 주입 | 필수 판정 |
|---|---|---|
| 동시 claim | 서로 다른 connection의 Worker A/B가 같은 Job 획득 경쟁 | 현재 owner 정확히 한 개, 다른 Worker는 claim 실패 |
| 만료 후 재claim | A가 RUNNING 중 종료, DB 시각 기준 만료, B가 claim | **같은 Job**, 더 큰 lease_epoch와 version |
| 늦은 A 완료 | B의 재claim 후 A가 과거 토큰으로 COMPLETE | A의 CAS 0 rows, Snapshot/ScopeLatest 미변경 |
| heartbeat version | B heartbeat로 version 증가, 구 version으로 complete | 구 token 거부, 새 token만 유효 |
| 재전달 | Job/Outbox COMMIT 직후 프로세스 종료·재시작 | at-least-once 재전달 허용, 새 Job/예약 중복 없음 |
| 만료 리스 | DB 시각이 lease_expires_at 이상 | heartbeat/완료/연장 불가; watchdog 재claim 또는 FAILED 후보 |
| 정책 철회 | dispatch/complete/publish 사이 policy_epoch·복구 generation 변경 | 외부 호출·공개/읽기 차단, 구 정책 결과 부활 금지 |
| 공개 Scope 경합 | 서로 다른 actor의 Job B가 먼저 완료, 오래된 Job A가 나중에 완료 | 오래된 Job의 공유 ScopeLatest 덮어쓰기 금지 |
| clock drift | Worker의 프로세스 clock 오프셋 주입 | lease 판단은 신뢰된 **DB 시각** 기준 |
| 종료 | Lab 중단 후 잔존 리소스·네트워크·credential 조사 | G4-4 전용 자원만 폐기하고 외부 시스템 흔적 0 |

**주의:** G4-3의 후보 scope_publication_generation은 DB 내부 역행 방지의 시험 대상일 뿐 영상의 실제 관측 시각·표본 품질·권리 기준을 대체하지 않는다. 공개 결과의 최종 최신성/사용권 판정은 DEC-G43-03 및 DEC-G43-08이 미결정인 동안 **fail-closed**로 유지한다.

## 5. 보안·데이터 수명주기 검증 범위

**Lab만으로 확인 가능한 것:** 가짜 actor→execution_partition 매핑, 정규화 Scope·private tenant 격리, 최소 DB 권한, 정책 epoch에 대한 DB CAS/fencing, Outbox/Worker 복구. 이 결과가 실제 세션 인가를 인증하지는 않는다.

**후속 별도 Gate:** Spring Security의 deny-all, 실제 로그인·세션·CSRF, tenant BOLA 404, Role/Entitlement/Quota, RuntimeDataSourceGuard, AccountSessionFilter, RestoreFenceFilter, 계정 탈퇴·복구와 백업/삭제 저널. 실서비스 회원 데이터를 사용하지 않고 별도 테스트 fixture와 서버 통합 허가가 있어야 한다. 관리/삭제용 DB 풀에 분석 쓰기를 추가하는 것은 금지.

실제 YouTube 데이터 이용·파생 감성 지표·보관/삭제·비용·제공자 API quota의 정책 및 승인 상태는 이 연구로 해결되지 않는다. 운영 분석 Job 생성과 Snapshot 공개는 **POLICY_HOLD**를 유지한다.

## 6. 단계, 산출물 및 승인 Gate

| 단계 | 수행 | 합격에 필요한 증거 | 현재 |
|---|---|---|---|
| G44-P0 | 이 계획 및 검증 매트릭스 Draft PR 제출·독립 검수 | G43-O01~O28 전체 추적, 안전 경계, CI 성공 | **PLAN_DRAFT** |
| G44-P1 | disposable DB/roles/fixture 구축 | 버전·localhost/egress·role 제한/cleanup 기록 | NOT_RUN |
| G44-P2 | PostgreSQL 실제 2~N 연결 트랜잭션 경합 | unique/rollback/replay/budget row counts + SQLSTATE | NOT_RUN |
| G44-P3 | 두 Worker claim/lease/재시작/중복 Outbox | owner/epoch/version, CAS 0/1 rows, 장애 로그 | NOT_RUN |
| G44-P4 | 합성 revoke·공개 latest·삭제 펜스 | 철회 후 조회 0, ScopeLatest 역행 0 | NOT_RUN |
| G44-P5 | 격리 리소스 종료·증거 정제 | 잔존 자원 0, 정제된 증거 SHA-256 | NOT_RUN |
| G44-SEC | 실제 Spring 인증/인가·CSRF·restore 통합 | 별도 서버 구현 승인·독립 E2E | NOT_APPROVED |
| G44-PROD | 실데이터/운영 API/결제/배포 | 별도 정책·권리·보안·비용 승인 | POLICY_HOLD |

다음 별도 승인 후 구현할 실험은 **G44-P1~P5 전용 Lab 구현 및 실행**만을 대상으로 한다. 이번 승인에서는 파일 2개만 새 브랜치에 추가하고 Draft PR로 제출한다. **병합, 브랜치 삭제, 강제 push, 실제 DB 컨테이너 실행을 진행하지 않는다.**

## 7. 증거 기록·STOP 규칙

모든 미래 테스트에는 run-id, 고정 Git SHA, PostgreSQL/driver/container image digest, 합성 fixture 식별자, 연결 2개 이상의 barrier 순서, SQLSTATE, lock/DB 시간, CAS 영향 행수, Job·멱등·예산·Outbox 행수 전후, 출처/정책 epoch, egress·볼륨/컨테이너 종료 증명, 정제 로그 해시를 기록한다. GitHub에는 **토큰/연결 비밀/원본 데이터/DB 덤프를 업로드하지 않는다.**

**즉시 STOP:** 예상하지 않은 DB host/스키마 또는 배포 주체, 운영 key/credential 감지, 허용되지 않은 외부 요청, 실제 댓글·개인정보 유입, RO 풀에 대한 쓰기 시도, 기존 브랜치의 로컬 미보존 변경, 에러를 PASS로 처리한 경우. 실행 실패 또는 증거 불충분은 **FAIL / INCONCLUSIVE / NOT_RUN**으로만 기록한다.

## 8. 미확정 결정

| ID | 미결정 | 결정 전 기본 |
|---|---|---|
| DEC-G44-01 | Lab driver/실행기/PG image/버전 고정 | 환경 구성 금지 |
| DEC-G44-02 | 정책 epoch·계정 restore generation의 DB 원자성 설계 | 외부 현재 상태 확인 실패 시 거부 |
| DEC-G44-03 | 공개 Scope 최신 발행 순서와 Job 공유 | execution_partition 격리, 미검증 latest 발행 차단 |
| DEC-G44-04 | lease timeout·retries·watchdog, Lab vs 운영 수치 | 실험 값은 운영 상수 아님 |
| DEC-G44-05 | 예산 HELD/COMMITTED/RELEASED 정산·보상 | 합성 원장만 |
| DEC-G44-06 | 실험 자료 폐기/증거 보존·권한 담당 | raw 로그/credential 커밋 금지 |

상위 **DEC-G43-01~08**은 계속 유효하며 특히 **DEC-G43-06은 POLICY_HOLD**다.

## 9. PostgreSQL 16 기술 근거

- [UNIQUE와 NULLS NOT DISTINCT](https://www.postgresql.org/docs/16/ddl-constraints.html)
- [CREATE INDEX / partial unique index](https://www.postgresql.org/docs/16/sql-createindex.html)
- [SELECT ... FOR UPDATE SKIP LOCKED](https://www.postgresql.org/docs/16/sql-select.html)
- [Serialization Failure Handling](https://www.postgresql.org/docs/16/mvcc-serialization-failure-handling.html)

**최종 판정: G4-4 검증 계획 후보. 실제 검증 0건 / 운영 구현 NOT_IMPLEMENTED / POLICY_HOLD 유지.**
