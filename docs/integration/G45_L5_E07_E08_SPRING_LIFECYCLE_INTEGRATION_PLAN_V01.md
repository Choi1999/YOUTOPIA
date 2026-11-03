# YOUTOPIA — G45-L5 E07/E08 Spring 수명주기 통합 선행 검수 v0.1

> **일자:** 2026-11-03 KST
> **작업 브랜치:** `feature/yu32-g45-l5-spring-lifecycle-v01` → **PR base `feat/backend-bootstrap`**
> **대상 HEAD(생성 전):** `ff69f0b0ad14f156a4a4dafb5755dbbb1ab2c5b9`
> **상태:** `TEST_ONLY_INTEGRATION_DESIGN / POLICY_HOLD / LIVE_API_0 / REAL_DELETE_0`
> **전제:** `frontend@f6323ca85c17c9f546fb357a454c3c93f901b74a`의 G45-L4 합성 계약·테스트는 별도 브랜치에 있으며, 이를 운영 Java 구현이라고 주장하지 않는다.

## 1. 독립 검수에서 확인된 실제 백엔드 경계

- `src/main/java/com/youtopia/youtube/admin/G45AdminDeletionBoundaryController.java`는 **`@Profile("g45-synthetic-test")`**와 추가 속성 `youtopia.g45.synthetic-admin-boundary.enabled=true`에서만 존재한다. 관리자 역할이 있어도 POST 미리보기·삭제는 **503 `G45_REAL_PURGE_POLICY_HOLD`**로 거부한다.
- `SecurityConfiguration`은 `/api/v1/admin/**`에 `hasRole("ADMIN")`, CSRF 및 알 수 없는 요청의 `denyAll()`을 적용한다. 이번 변경에서 이 파일을 수정하지 않는다.
- `PrivacyPurgeService`·`PurgeRepository`는 **YOUTOPIA 계정 삭제용**이다. `auth.service_user` 및 관련 테이블을 삭제하는 코드를 YouTube 댓글/분석 데이터에 전용하지 않는다.
- `DeletionJournal`·`RestoreFenceFilter`는 회원 계정 복구/삭제용 안전 장치다. YouTube 댓글 데이터에 실제로 연결된 `tenant+VIDEO` tombstone·복원 판정의 증거가 아니므로, 기존 기능을 자동 재사용하지 않는다.
- 기존 백엔드의 새 Chat 기능과 설정은 이번 PR에서 변경하지 않는다.

## 2. 프로젝트 증거 E01~E05/E11 — 실제 검증 현황

| 증거 | 수용 기준 | 이번 확인 |
|---|---|---|
| E01 Google Cloud 프로젝트 소유 | 권한 있는 운영자와 독립 검토자가 **같은 프로젝트** 식별자·소유/책임 범위를 대조 | **UNVERIFIED** — 실제 Cloud 계정 접근/소유 증거 없음 |
| E02 API 활성화/인증 | 그 프로젝트의 YouTube Data API v3 활성화·유효한 인증 방식(공식 `key` query 또는 OAuth) 확인 | **UNVERIFIED** — 프로젝트 설정 불조회; 일반 `x-goog-api-key` 헤더의 YouTube 전용 지원 증거 없음 |
| E03 키·비밀·IP 제한 | 비밀값 없이 API 제한, 실제 출구 IP 일치, Windows 비밀 저장소/회전·로그 비노출 검증 | **UNVERIFIED** — 키 생성·조회/자격증명 읽기/외부 IP 확인 0건 |
| E04 Quota/소모 | 프로젝트 현행 사용량·일일 한도와 최초 VIDEO 1~3개/요청 1회·재시도0 예산 별도 대조 | **UNVERIFIED** — 공식 명세상 `commentThreads.list` 1 unit 확인, 프로젝트 값은 미확인 |
| E05 허용 목적·기본 정책 | YOUTOPIA의 공개 댓글 수집 목적·이용약관·개인정보·표시·보존/삭제 및 필요 심사 독립 검토 | **POLICY_HOLD** |
| E11 최초 실호출 | VIDEO ID, 운영자, 시간, 최대 발송/Quota, 데이터 처리·폐기·오류 중단 범위와 별도 사용자 명시 승인 | **NOT_APPROVED** |

비밀이나 실댓글/작성자 정보를 GitHub·PR·채팅·로그에 넣지 않는다. 실제 프로젝트 검증은 해당 Google Cloud 계정의 권한 있는 사람이 **허용된 증거 보관소에서** 수행할 항목이며, GitHub CI·과거 화면 설명으로 상태를 변경할 수 없다. 공식 명세를 확인했다고 E01~E05의 제공자별 증거가 승인되는 것은 아니다.

## 3. E07/E08 운영 구조 — 구현 전 최소 계약

**현재 E07/E08 모두 `NOT_IMPLEMENTED`.** 고위험 운영 저장소에 접근하는 엔드포인트·직접 SQL·Redis/Cdn 삭제 코드는 추가하지 않는다.

### 3.1 권한 및 요청 구분

| 트리거 | 검증할 주체 | 처리/기한 |
|---|---|---|
| 관리자 수동 삭제 | 서버 세션에서 확인된 `ADMIN` + CSRF + 정확한 tenant+VIDEO + 미리보기 ticket·revision·UUID | 제한 범위; 확인·사유 필수 |
| Non-Authorized Data 보존 만료 | 별도 서버 SYSTEM 실행자 | 30 calendar days 이내 갱신 또는 삭제. 관리자의 수동 승인/로그인 대기 불허 |
| 검증된 정보주체 삭제 요청 | 신원·권리 입증 후 별도 서버 SYSTEM 실행자 | 가능한 신속히, 7 calendar days 내 |
| 앱 내부 OAuth 철회(향후 OAuth 사용 시) | 연결·동의 철회 검증된 SYSTEM | 토큰 즉시 철회, 해당 Authorized Data는 7일 내 |
| Google 보안 설정에서 외부 철회(향후) | 토큰 상태 재검증·철회 확인된 SYSTEM | 해당 API Data 30일 이내 삭제 |

**기한은 최대치이며 지연 대기시간이 아니다.** 취소/보존 요청에서 더 엄격한 법률·정책이 있으면 재검토한다.

### 3.2 저장소별 수명주기 설계 (아직 DB 마이그레이션 없음)

후속 스키마 설계 후보:
- `youtube_data_lifecycle_object`: immutable internal object UUID, tenant/video, provenance, observedAt, expiry, classification, source revision/epoch. 실댓글 원문 영속 저장은 최초 PoC 기본 0.
- `youtube_data_deletion_request`: operation UUID unique, tenant/video, trigger, server-verified actor reference, policyEpoch, CAS revision, state, SLA deadline, cancellation policy.
- `youtube_data_tombstone`: tenant+VIDEO+policyEpoch 와 변경 이력; 작업 재실행/복구 시 먼저 참조.
- `youtube_deletion_target_ack`: operation+target unique, authoritative store operation/reference and signed/verified receipt, failure code, retry metadata. 단순 client Boolean은 완료 증거 아님.
- `youtube_retention_inventory`: cache/index/report/worker/outbox/export/backup·외부 복제본과 그 실제 소유/삭제 책임자 목록.

필수 전파 대상은 원문/작성자, Snapshot/지표, 리포트, 검색 색인, 서버 캐시, 브라우저/CDN 캐시, Job/Outbox, 임시 내보내기, 백업/복구 펜스 **9종**이다. 실제 분산 저장소가 확정되면 누락 없는 인벤토리로 다시 검수.

### 3.3 상태·경합·완료 계약

`PENDING → EXECUTING → PROPAGATING → PURGED`, 부분 실패 시 `PURGE_FAILED`. **모든 저장소의 신뢰 가능한 결과를 확인하기 전 PURGED 금지.** Request ID·tenant+VIDEO·policyEpoch·revision으로 멱등성·정확 범위·교차 테넌트 접근·구 Worker 재생성을 차단해야 한다.

작업 시작 전에 durable tombstone/deny-read를 기록한다. Worker/Outbox 재시도, 백업 복구, 이전 Snapshot/캐시 재생성은 **서버 데이터베이스에서 단조 증가하는 정책 epoch**와 tombstone을 확인해야 한다. 백업 자체의 물리 제거가 지연된다면 복구 차단과 일정/법률 적합성을 별도로 검증하고 완료 여부를 과대 보고하지 않는다.

현 Spring 테스트에 등장하는 모의 `ADMIN` 사용자나 테스트 합성 Actor는 운영 서버의 실제 관리자·시스템 권한 증거가 아니다. 인증·CSRF·tenant BOLA/IDOR·다른 계정 접근/요청 재생 시험이 필요하다.

## 4. 이번 독립 브랜치에 구현한 것

- `src/test/java/com/youtopia/youtube/lifecycle/G45LifecycleBoundaryContractTest.java`: **Java 21/JUnit 테스트 소스 전용**, 고정된 `tenant-alpha/beta + Ab0_-123xyz` 합성 Scope만 지원하는 상태 전이 테스트 모형.
- 관리자와 시스템 필수 삭제 권한 분리, 30/7/7/30일 기한, 모든 대상 ACK·백업 fence, 실패·재시도, 중복 operation, tombstone/epoch, 테넌트 분리, 아무 실제 삭제/제공자 호출도 없는 상태를 테스트.
- `.github/workflows/g45-admin-boundary-validation.yml`: 기존 Spring `G45AdminDeletionBoundarySecurityTest`와 신규 JUnit 계약 테스트를 동일 Java 21 CI에서 실행.
- **실제 프로덕션 Java 소스·컨트롤러·DB migration/설정·정본 정책 Gate·`frontend` 코드는 변경하지 않는다.**

이 코드의 `PURGED_SYNTHETIC_ONLY`는 **테스트 메모리 상태**일 뿐, Google API·Postgres·Redis·CDN·백업 삭제를 수행했다는 뜻이 아니다.

## 5. 독립 검수/병합 전 수용 Gate

1. PR base는 **`feat/backend-bootstrap`**이고 당시 SHA는 `ff69f0b0...`이다. `frontend` PR과 혼동하지 않는다.
2. GitHub Actions에서 기존 Spring ADMIN/CSRF MockMvc 테스트 및 새 JUnit 모두 PASS. CI는 실제 Google Cloud·Windows Vault·DB/Redis/백업 통합 검증을 대신하지 않는다.
3. 신규 테스트 소스는 실제 컴포넌트 자동 등록·컨트롤러 라우트·실데이터 접근 경로가 없고 사용자 위조 Boolean으로 운영 권한을 만들지 않는다.
4. E01~E12 정책 상태는 정본 기준 **0/12 verified**, `POLICY_HOLD` 유지. 실호출, API 키 발급, 실제 댓글 분석, 운영 데이터 삭제·배포 금지.
5. 이후 실제 E07/E08 구현은 별도 운영 스키마와 테스트용 일회성 DB/Redis 환경을 마련한 뒤 **독립 리뷰·추가 승인**으로 진행. 병합 승인 역시 PR별로 구분한다.

**판정:** G45-L5 고위험 기능의 **분리된 구현 준비·오프라인 자동 테스트** 단계. 실데이터 E07/E08 이행 증거는 아직 없으며 PR 병합은 사용자 별도 검수/승인 필요.

## 6. 공식 문서

- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
- https://developers.google.com/youtube/data/reference/rest
- https://developers.google.com/youtube/data/determine_quota_cost

## 7. 독립 코드·보안 검수 보강 (2026-11-03)

- 테스트 범위 P2: 기존 테스트의 합성 ADMIN 열거형은 tenant 범위를 검사하지 않았다. `actorTenantId` 대조와 교차 테넌트/무테넌트 부정 테스트를 추가했다. 해당 값은 테스트 입력이며 운영 인가 증거가 아니다.
- 테스트 범위 P2: 기존 `mayReplay()`는 상수 `false`로만 종료되어 오래된 작업과 신규 Epoch의 실패 이유를 구분하지 못했다. `assessSyntheticReplay()`는 구 Epoch와 Tombstone 존재를 구분하되 모든 실제 작업을 계속 차단한다.
- SLA 기점: 30일 보존은 API 데이터 관측 또는 마지막 갱신 시각, 사용자 삭제 요청은 검증된 접수 시각, OAuth 철회는 해당 철회 시각을 기준으로 설계한다. 테스트 함수 인수를 `policyEventAt`로 명명했다.
- CI 추적: PR에서의 테스트 통과와 최종 병합 SHA의 통과는 구분한다. 백엔드 브랜치 push에서도 동일 Java 21 검증이 실행되게 추가했다. PR 병합 자체는 별도 승인 대상이다.
- 실제 `SecurityConfiguration`, 서비스 계정 삭제, SQL/Redis/외부 API 로직은 변경하지 않았고 E01~E12 `POLICY_HOLD`를 유지한다.
