# YOUTOPIA — G45-L6 격리 PostgreSQL·Redis 수명주기 통합 검증 v0.1

> 기준일: 2026-11-03 KST
> 작업 브랜치: `feature/yu32-g45-l6-isolated-pg-redis-lifecycle-v01`
> PR 대상: `feat/backend-bootstrap@6883da656d4a839daf3534ea7e896200a3ff6df3`
> 상태: **DISPOSABLE_TEST_ONLY / POLICY_HOLD / VERIFIED_0_OF_12 / LIVE_YOUTUBE_0 / PRODUCTION_DELETE_0**

## 1. 기존 기반 및 승인 경계

PR #52의 G45-L5 JUnit 상태 전이 모형은 메모리 테스트다. G45-L6는 기존 `tools/test_services.py`, `IsolatedTestServices` 및 Gradle `integrationTest`를 사용하여 소유권 검증된 **일회성 PostgreSQL 16과 Redis**에서 실제 SQL 임시 테이블/시험 Redis 키의 동작을 확인한다.

이번 브랜치의 변경은 Java 테스트 소스, 격리 CI 워크플로, 설명 문서뿐이다. 운영 `src/main/java`, 운영 DB 스키마·설정, Spring 삭제 Controller, Google Cloud/API, 자격증명, 실제 댓글 데이터 및 운영 데이터 삭제는 변경·실행하지 않는다.

## 2. 시험 안전 경계

- PostgreSQL: `IsolatedTestServices.url("youtopia_test")`가 반환한 `127.0.0.1` 동적 포트, 소유 Docker 컨테이너 이름 및 실제 `youtopia_test` 데이터베이스/PostgreSQL 16 확인 후 실행. **모든 신규 SQL 객체는 세션 TEMP 테이블**이며 `pg_temp`로 명시한다. 연결 종료 시 제거된다.
- 기존 `tools/test_services.py status`는 Docker 리소스 소유 라벨, 이미지, 루프백 바인딩, fixture fingerprint를 검증한다. 사전 검사 불통과 시 Gradle 통합 테스트는 실행되지 않는다.
- Redis: 동일한 소유 검증 도구의 루프백 포트에만 연결하고 `youtopia:g45-l6:synthetic:<UUID>:` 네임스페이스 및 2분 TTL만 사용한다. 해당 시험 키만 삭제하고 `FLUSHDB`/`FLUSHALL`/일반 세션 키를 건드리지 않는다.
- CI: GitHub Actions는 `feat/backend-bootstrap` 대상 PR 및 해당 브랜치 push에서 실행한다. `if: always()` 단계에서 소유권 검증 도구의 `stop`만 실행한다. 컨테이너 소유 정보가 불일치하면 다른 컨테이너를 강제로 삭제하지 않는다.

## 3. 격리 SQL·Redis 수용 테스트

| 시험 | 검증 내용 | 성공 조건 |
|---|---|---|
| L6-01 | 세션 임시 테이블 | 다른 PostgreSQL 접속에서 합성 TEMP 테이블 읽기 불가(SQLSTATE 42P01) |
| L6-02 | Tombstone·tenant 격리·실패 롤백 | 삭제 전에 Tombstone 커밋; 실패 재시도에도 보존; tenant-alpha 데이터만 삭제하고 tenant-beta는 유지 |
| L6-03 | 전파 대상 9개 ACK | 합성 backup/restore fence 확인 누락 시 완료 판정 거부; 중복 ACK로 9개를 속이지 못함 |
| L6-06 | ACK 허용 대상·요청 참조 무결성 | 9개 고정 target에 대한 CHECK, operation UUID 외래키로 임의 target·존재하지 않는 요청 ACK를 거부(SQLSTATE 23514·23503) |
| L6-04 | Redis 캐시·삭제 펜스 | 시험 UUID의 alpha 캐시만 삭제, beta 캐시·Tombstone 유지, 중복 삭제 멱등성 |
| L6-05 | DB 최소 권한 | 기존 시험 전용 `ytp_test_data_ro`가 collector 데이터에 DELETE 권한을 갖지 않음 |

**완료 상태는 항상 `PURGED_SYNTHETIC_ONLY`이다.** 단순 ACK 개수만 비교하면 임의 문자열 9개로 완료 상태를 위조할 수 있어 독립 검수에서 시험용 `target` CHECK와 요청 ID 외래키를 추가했다. SQL ACK는 해당 시험용 요청·고정 대상에 대한 모의 레코드일 뿐 실제 CDN·브라우저·Outbox·백업의 삭제 증거가 아니다. TEMP 테이블은 서버 프로세스 재시작 또는 백업 복구를 넘는 내구성/펜스를 검증하지 못하며, 시험용 `postgres` 슈퍼유저는 운영 최소 권한 설계가 아니다.

## 4. CI 실행

`.github/workflows/g45-l6-isolated-lifecycle-validation.yml`에서 아래 단계로 수행한다.

1. 소유권 검증된 일회성 PostgreSQL·Redis 실행: `python3 tools/test_services.py start --quiet`
2. Java 21 합성 통합 테스트: `./gradlew --no-daemon integrationTest --tests 'com.youtopia.youtube.lifecycle.G45L6IsolatedLifecycleIntegrationTest'`
3. 언제나 소유 시험 컨테이너만 정리: `python3 tools/test_services.py stop`

CI 실행에 테스트 이미지 다운로드가 필요할 수 있으나 YouTube 데이터·Cloud 사용자 프로젝트는 접근하지 않는다. 기존 G45 관리자/CSRF 단위 CI와 독립 검증한다.

## 5. 실제 E07/E08 운영 구현 이전 미충족 조건

- 운영 저장소·캐시·Job/Outbox·백업 전체 인벤토리 및 영속 `tenant+VIDEO` Tombstone/정책 Epoch, 실패 재개/복구 E2E
- 서버에서 검증한 ADMIN과 시스템 의무 삭제 주체의 AuthN·tenant BOLA·CSRF, 승인 요청/기한 및 감사
- 데이터별 보존/갱신·삭제, Redis/CDN/브라우저 캐시 및 백업의 신뢰 가능한 외부 ACK
- 실제 Google Cloud 프로젝트/키·Quota·IP 제한 검증(E01~E04), 제공자 기본 정책(E05), 감성 지표 허용(E06), 최초 YouTube 실호출 별도 승인(E11)
- 정본 정책 Gate는 `POLICY_HOLD`, `verifiedCount=0`, `liveCallsAuthorized=false`를 유지. 브랜치/PR 병합도 별도 승인 대상.

**독립 검수 보강 (2026-11-03):** P2 삭제 완료 상태 검증 결함 수정 — 허용되지 않은 ACK 라벨 및 존재하지 않는 요청 UUID의 삽입을 SQL 레벨에서 거부하고 완료 조건으로 오인하지 않도록 음성 테스트를 추가했다. 기존 운영 Java·인프라·정책·브랜치는 수정하지 않았다.

**판정:** G45-L6 일회성 PostgreSQL/Redis 검증용 PR. 실제 운영 데이터 수명주기 기능 구현 완료를 의미하지 않는다.

공식 참고: https://www.postgresql.org/docs/16/sql-createtable.html · https://docs.spring.io/spring-data-redis/reference/redis/connection-modes.html
