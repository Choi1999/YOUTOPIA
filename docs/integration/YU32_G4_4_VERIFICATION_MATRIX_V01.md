# YOUTOPIA — YU-32 G4-4 격리 검증 매트릭스 v0.1

> **현재 상태:** PLAN_DRAFT / NOT_RUN / OFFLINE_ONLY / POLICY_HOLD
> **기준선:** frontend@ce03f2ced337be12a8337a6fb78d46f29d68b00c
> **실행 계획:** [G4-4 격리 PostgreSQL·Worker 검증 계획](./YU32_G4_4_ISOLATED_DB_WORKER_VERIFICATION_PLAN_V01.md)
> **상위 매트릭스:** [G4-3 검증 매트릭스](./YU32_G4_3_VERIFICATION_MATRIX_V01.md)
> **주의:** 이번 PR에서는 표의 테스트를 한 건도 실행하지 않는다. G43-O01~O28은 설계 수용 후보로 보존한다.

## 1. 검증 상태

- **NOT_RUN:** 실제 Lab/DB/Worker 증거가 없는 실행 계획.
- **POLICY_HOLD:** 실제 제공자/파생 지표·수집·보관·비용 승인을 확보하지 못한 금지 영역. 외부 YouTube 호출 불가.
- **LAB_DB / LAB_WORKER:** 별도 구현·실행 승인 뒤 일회성 PostgreSQL 16과 합성 Worker로만 시험.
- **LAB_READ / LAB_SAFETY:** 합성 조회·격리 및 안전한 종료 확인 후보.
- **LAB_DB+AUTH / LAB_WORKER+AUTH:** Lab에서 부분 검증은 가능하지만 실제 Spring Security/CSRF/권한은 별도.
- **LAB_AUTH_FUTURE:** 실제 세션·복구 펜스·DB role guard의 Spring 통합 검증이 필요하며 이번 계획/기본 Lab의 완료 기준이 아님.

## 2. 전체 시나리오: 40건 (G4-3 추적 28 + 추가 회귀 12)

| ID | 계층 | 상위 대응 | 입력·고장 주입 | 기대 결과 | 필수 증거 | 현재 |
|---|---|---|---|---|---|---|
| G44-T01 | LAB_READ | G43-O01 | 합성 Hover GET 100회 반복 | Job·Outbox·예산·외부 요청 증가 0 | read 이전/이후 row counts | NOT_RUN |
| G44-T02 | LAB_DB | G43-O02 | version/window/sampling/locale 변경 | Scope 9필드 정규화·격리; 달라진 tuple은 별개 | canonical tuple/unique 결과 | NOT_RUN |
| G44-T03 | LAB_DB | G43-O03 | PUBLIC_REUSABLE에서 tenantId 문자열 | CHECK 거부, 임의 null 치환 금지 | constraint SQLSTATE/row count | NOT_RUN |
| G44-T04 | LAB_AUTH_FUTURE | G43-O04 | Guest·타 조직의 TENANT_PRIVATE 접근 | 존재 여부 은닉 및 요청 거부 | Spring session/tenant E2E 필요 | NOT_RUN |
| G44-T05 | LAB_DB | G43-O05 | 같은 actor·key·body 동시 POST | 원 결정/Job 동일, 예약 1회 | 서로 다른 DB connections와 ledger | NOT_RUN |
| G44-T06 | LAB_DB | G43-O06 | 동일 actor·key, 다른 body | 409 충돌, Job/charge 증가 0 | idempotency unique와 원장 | NOT_RUN |
| G44-T07 | LAB_DB | G43-O07 | 다른 key·같은 scope/partition 경쟁 | 활성 Job 1개, 비용 예약 1, 나머지 JOINED | partial UNIQUE와 동시 tx 로그 | NOT_RUN |
| G44-T08 | LAB_DB+AUTH | G43-O08 | PUBLIC Scope의 서로 다른 actor 동시 POST | 실행 파티션 독립, 타 Job ID 유출 없음 | DB 분리 확인; 서버 비노출은 별도 Gate | NOT_RUN |
| G44-T09 | LAB_DB | G43-O09 | commit 뒤 HTTP reply loss 주입 | 멱등 replay, 신규 Job·예약 0 | DB commit/reconnect trace | NOT_RUN |
| G44-T10 | LAB_DB | G43-O10 | Job 생성·예산 예약 뒤 rollback | Job·idem·budget·outbox 4종 전부 0 | fault barrier 후 row counts | NOT_RUN |
| G44-T11 | LAB_DB | G43-O11 | Redis throttling만 성공·DB 비용 실패 | Redis 성공으로 비용 정산 성공 판단 금지 | 별도 DB ledger와 mock throttle | NOT_RUN |
| G44-T12 | LAB_WORKER | G43-O12 | 기능 OFF 또는 정책 epoch 미확정 | claim/공급자 호출 0, fail-closed | DB guard와 externalCalls=0 | NOT_RUN |
| G44-T13 | LAB_AUTH_FUTURE | G43-O13 | Guest가 분석 Job POST | 401 및 신규 Job 0 | Spring Security/CSRF E2E 필요 | NOT_RUN |
| G44-T14 | LAB_WORKER | G43-O14 | A/B Worker가 동시에 같은 Job claim | 유효 리스 owner 최대 1 | SKIP LOCKED·UPDATE 영향 행 | NOT_RUN |
| G44-T15 | LAB_WORKER | G43-O15 | A crash·lease 만료 후 B 재claim | 같은 Job, epoch·version 증가 | DB 시각/lease token | NOT_RUN |
| G44-T16 | LAB_WORKER | G43-O16 | B 재claim 뒤 A의 늦은 complete | A CAS 0, 최신 Snapshot 변경 0 | worker tokens/row count | NOT_RUN |
| G44-T17 | LAB_WORKER | G43-O17 | 만료 heartbeat 및 complete 제출 | 둘 다 거부, expired lease 불변 | expiry/version DB 비교 | NOT_RUN |
| G44-T18 | LAB_WORKER+AUTH | G43-O18 | 실행 중 정책 철회·완료 경합 | policy epoch 검증, 신규 외부 호출/발행 차단 | DB epoch/Worker trace, 서버 인가 별도 | NOT_RUN |
| G44-T19 | LAB_DB | G43-O19 | Snapshot scope 불일치·늦은 과거 Job | ScopeLatest CAS 역행 0, invalid publish 0 | scope_ref/history/revision | NOT_RUN |
| G44-T20 | LAB_READ | G43-O20 | NO_DATA·STALE·STATIC_FIXTURE 조회 | FRESH/READY/실데이터로 승격 금지 | 상태별 응답/수치 비노출 | NOT_RUN |
| G44-T21 | LAB_AUTH_FUTURE | G43-O21 | 삭제된 합성 계정 복구와 구 참조 재생 | 세션·권한·Snapshot 부활 차단 | RestoreFence/저널 통합 필요 | NOT_RUN |
| G44-T22 | LAB_AUTH_FUTURE | G43-O22 | 다른 actor의 Job/Snapshot ID 조회 | 404 RESOURCE_UNAVAILABLE; 존재 비노출 | 서버 BOLA E2E 필요 | NOT_RUN |
| G44-T23 | LAB_AUTH_FUTURE | G43-O23 | 공개 직전 정책 재확인 실패 | POLICY_BLOCKED 및 수치 비노출 | Spring policy/read integration 필요 | NOT_RUN |
| G44-T24 | POLICY_HOLD | G43-O24 | 실제 provider 중복 호출 가능성 | 외부 호출 금지, exactly-once 근거 없음 | 위험 기록만; 외부 실험 금지 | POLICY_HOLD |
| G44-T25 | LAB_DB | G43-O25 | Lab 전용 read-only principal로 INSERT | 권한 거부; 운영 ytp_app_data_ro 접근 없음 | 실험 DB SQLSTATE 42501 등 | NOT_RUN |
| G44-T26 | LAB_AUTH_FUTURE | G43-O26 | 미허용 관리자/마이그레이션 pool 시도 | RuntimeDataSourceGuard 시작 차단 | 별도 Spring integration 필요 | NOT_RUN |
| G44-T27 | LAB_WORKER | G43-O27 | 동일 Outbox event 2회 deliver | 중복 예약/새 Job·유효 claim 0 | delivery ids/Job-state 로그 | NOT_RUN |
| G44-T28 | LAB_SAFETY | G43-O28 | APPROVED_TEST_ONLY fixture 임의 주입 | 운영 기능 여전히 off, 실제 외부 요청 0 | feature/manifest diff, egress trace | NOT_RUN |
| G44-T29 | LAB_DB | 추가 | PUBLIC Scope tenantId NULL인 동일 tuple 2회 INSERT | UNIQUE NULLS NOT DISTINCT 또는 동등 인덱스로 두 번째 거부 | 중복 거부 constraint trace | NOT_RUN |
| G44-T30 | LAB_DB | 추가 | Scope 필드 null·object·잘못된 locale·version | G4-2 request parser와 일치하게 fail-closed | invalid fixture vector 결과 | NOT_RUN |
| G44-T31 | LAB_DB | 추가 | 2개 actor가 동일 가상 예산 창에서 경쟁 예약 | 허용량 초과·마이너스 잔액·중복 차감 0 | budget counters/locked rows | NOT_RUN |
| G44-T32 | LAB_DB | 추가 | HELD→COMMITTED와 RELEASED·환불 경쟁 | 중복 확정·환불 없음, 합계 보존 | ledger transition trace | NOT_RUN |
| G44-T33 | LAB_DB | 추가 | 40001·40P01·23505 재시도 경합 | 정상 합류와 실제 충돌 구별, 전체 tx만 재시도 | SQLSTATE/tx attempts | NOT_RUN |
| G44-T34 | LAB_WORKER | 추가 | heartbeat가 version 변경 후 구 token 완료 | expected_version 구값 CAS 0 | epoch/version 로그 | NOT_RUN |
| G44-T35 | LAB_DB | 추가 | PUBLIC 두 actor Job 역순 완료·latest 경쟁 | 낮은 generation 덮어쓰기 금지, 최신성 결정은 HOLD | generation CAS, policy evidence | NOT_RUN |
| G44-T36 | LAB_WORKER | 추가 | worker wall-clock 왜곡과 DB clock 비교 | 리스 판단 DB 시각 기준, 잘못된 만료/재claim 0 | clock source + expiry trace | NOT_RUN |
| G44-T37 | LAB_DB | 추가 | Lab writer가 DDL·GRANT·타 schema 쓰기 시도 | 권한 거부, 운영 pool에 접근 없음 | privilege introspection/SQLSTATE | NOT_RUN |
| G44-T38 | LAB_DB | 추가 | SUCCEEDED/FAILED 재전이 및 명시 재시도 | 종단 상태 immutable, retry는 새 Job | CAS/state/retry_of rows | NOT_RUN |
| G44-T39 | LAB_DB | 추가 | 원 key 재생 시 새 quota 0·policy 철회 각각 주입 | 현재 권한 유효 시 원 결정 재생, 철회 때는 거부 | replay output/ledger unchanged | NOT_RUN |
| G44-T40 | LAB_SAFETY | 추가 | 고유 Lab Compose project 종료와 잔존 조사 | 전용 컨테이너·볼륨·네트워크·비밀 잔존 0 | tear-down inventory/정제 해시 | NOT_RUN |

## 3. 독립 검수·실행 절차

1. G44-T01~T28은 G43-O01~O28에 **각각 일대일 대응**한다. G44-T29~T40은 PG16 NULL uniqueness, 트랜잭션 경합, 예산, 버전 fencing, 공개 최신 포인터, 최소권한 및 종료의 추가 반례다. **현재 실제 수용 PASS는 0/40**이다.
2. 각 DB 경합 시나리오는 반드시 서로 다른 DB connection에서 동시 실행한다. fake in-memory Map 또는 순차 Node 단위 테스트를 DB concurrency 증거로 간주하지 않는다.
3. 레이스 주입에는 명시적 동기화 barrier를 사용하고 commit/rollback 전후 Job·Idempotency·Budget·Outbox의 행수와 상태, SQLSTATE, CAS 영향 행수, token epoch/version을 정제해서 기록한다.
4. 실제 DB·Worker/컨테이너는 사용자 별도 승인 후에만 실행한다. **127.0.0.1 바인딩만으로 네트워크 egress 안전을 입증했다고 판단하지 않는다.** 외부 요청의 실제 차단/관측이 별도 필수다.
5. 실제 계정·댓글·API 키·로그인 token·운영 DB/Redis·운영 권한 계정은 사용하지 않는다. Lab 전용 synthetic 계정만으로 실험한다. 운영 ytp_app_data_ro의 권한 검사로 Lab mock 계정을 사칭하지 않는다.
6. 공개 Scope의 scope_publication_generation 시험은 DB 역행 여부만 다룬다. **generation = 신선도/사용권**이 아니며 DEC-G43-03/08 미결정 상태에서 운영 최신 포인터 발행 근거로 사용할 수 없다.
7. 오류·미확정·증거 부족은 FAIL / INCONCLUSIVE / NOT_RUN / POLICY_HOLD로 기록한다. 실제 성공 근거가 없는 항목을 자동 PASS로 변경하지 않는다.

## 4. 증거 및 수용 Gate

| Gate | 실제 실행 후 필요할 자료 | 지금 상태 |
|---|---|---|
| G44-PLAN | 두 문서의 범위·40건 추적·안전 경계·PR CI | PLAN_DRAFT |
| G44-DB | PostgreSQL 16 병렬 SQL 결과, 인덱스/롤백/GRANT | NOT_RUN |
| G44-WORKER | 2 Worker crash/reclaim·Outbox 재전달·lease CAS | NOT_RUN |
| G44-SECURITY | Spring tenant BOLA, CSRF, RestoreFence, DB guard | NOT_APPROVED |
| G44-COMPLIANCE | YouTube 권리·원문/파생·보존·삭제·비용 | POLICY_HOLD |
| G44-RELEASE | 위 승인, 별도 사용자 병합·배포 Gate | NOT_APPROVED |

**최종 판정: 계획 40건 정리. 실제 PostgreSQL/Worker 실행 0/40, 운영 기능 미구현, POLICY_HOLD 유지.**
