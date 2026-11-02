# YOUTOPIA — YU-32 G4-5 관리자 수동 삭제·필수 만료 및 삭제 요청 계약 v0.1

> **상태:** ADMIN_DELETE_DIRECTION_APPROVED / SYNTHETIC_HARNESS_IMPLEMENTED / PRODUCTION_ADMIN_DELETE_NOT_IMPLEMENTED / POLICY_HOLD
> **검토일:** 2026-11-02 KST · **관련:** [오프라인 파이프라인 PR #48](https://github.com/Choi1999/YOUTOPIA/pull/48) · [수집 정책·키 준비 PR #47](https://github.com/Choi1999/YOUTOPIA/pull/47)
> **실행 코드:** [합성 관리자 삭제 테스트](../../shared/experiments/yu32-g45-offline-pipeline-v0/tests/admin-purge.test.cjs) · [합성 삭제 시뮬레이터](../../shared/experiments/yu32-g45-offline-pipeline-v0/src/admin-purge.cjs)

## 1. 사용자 승인 및 범위

사용자는 **YOUTOPIA에 저장될 영상 댓글 수집 결과와 분석 결과를 관리자만 수동 삭제할 수 있어야 한다**고 지정했다. 수동 삭제 권한은 독립된 서버 관리자 realm의 `ROLE_ADMIN`으로 제한한다. 일반 회원·로그인하지 않은 사용자·Chrome 확장·클라이언트에서 전달한 `role:"ADMIN"`는 수동 삭제 권한이 없다.

이는 **사용자 관련 데이터의 법정/약관상 삭제 요구를 관리자 로그인 여부에 종속시키라는 의미는 아니다**. 필요한 만료 삭제 및 본인 데이터 삭제 요청은 검증된 시스템 처리로 기한 내 수행하고, 관리자는 이행 상태·실패·재시도를 감독한다. YOUTOPIA 데이터 삭제는 **YouTube 서버의 원본 댓글을 지우지 않는다**.

본 변경에서 구현되는 것은 **합성 데이터만을 다루는 완전히 메모리 내의 관리자 수동 삭제·자동 만료·검증된 사용자 삭제 요청 시뮬레이터** 및 부정 테스트이다. 데이터베이스를 대상으로 한 DELETE 권한/SQL, 운영 HTTP API, 관리자 브라우저 화면, 운영 인증, 실제 수집, 결제, 배포, 키 발급은 **구현·실행하지 않는다**.

## 2. 삭제 권한 및 경로

| 경로 | 시작 주체 | 수행 권한 | 특징 |
|---|---|---|---|
| 관리자 수동 삭제 | 관리자 | **서버 검증 ADMIN 세션 전용** | 단일 VIDEO+tenant/범위 명시 → preview → 재확인 → 실행 → 감사 |
| 데이터 보존 만료 | 시스템 | 만료 스케줄러/보존 정책 실행자 | 기본 API 데이터는 일반적으로 30일 갱신/삭제. 버튼 승인 대기 없이 의무 이행 |
| 개인정보/이용자 요청 | 권리주체의 검증된 요청 → 시스템 | 사용자 인증 및 삭제 요구 접수·수명주기 프로세스 | 관련 저장 자료를 가능한 신속하게, 정책상 **7일 이내** 삭제. 관리자는 감독 가능 |
| 소스 철회·삭제/정책 변경 | 시스템 | 제공자 정책 이행자 | 더 이상 접근/표시 불가, 캐시·복제본·분석 결과 정리 |
| 전체 서비스 영구 삭제 | 별도 운영 승인 | 별도 절차 | **초기 PoC에서는 불허**. `ALL`/wildcard/무차별 삭제 금지 |

권한 기준: 기존 `feat/backend-bootstrap@c42c9a65dd5f1d25554b69f05f77f64f0234c244`에서 `SecurityConfiguration`은 `/api/v1/admin/**`에 `hasRole("ADMIN")` 적용, CSRF와 별도 admin realm 유지. 기존 `PrivacyPurgeCommand` / `PrivacyPurgeService` / `PurgeRepository`는 **서비스 계정 삭제**를 위한 것이며 YouTube 분석 데이터 삭제 구현이 아니다. 해당 코드를 다른 목적의 파괴적 SQL 실행으로 전용하지 않는다.

## 3. 관리자 UI / 서버 API 후보 (운영 구현 전)

관리자는 향후 관리 화면 `/admin/youtube/data`에서 수집 대상 영상 ID·테넌트·저장된 결과 수·가장 최근 관측·잔여 보존 기간·삭제 상태를 확인한다.

**2단계 확인** (후속 구현 검수 필수):

1. **미리보기:** `POST /api/v1/admin/youtube-data/deletions/preview` (제안). 서버에서 인증된 admin 세션·역할·tenant 범위와 접근 권한을 확인하고, 대상 VIDEO에 연결된 스냅샷/원문/주제 색인/캐시/보고서/대기 Job/Outbox 수량과 삭제 영향 범위 및 revision을 반환한다. **실제 삭제 없음**.
2. **실행:** `POST /api/v1/admin/youtube-data/deletions` (제안). admin session/CSRF/tenant·scope, 임의 조작되지 않은 revision 또는 서버 발급 preview ticket, 구체적 사유, 정확한 확인 문구, 서버 인증된 operation UUID를 확인한다. user-supplied role, ownerHint, bypass Boolean, 일반 사용자 조작으로 권한 부여 금지.
3. **상태·감사:** `GET /api/v1/admin/youtube-data/deletions/{requestId}` 후보. `PENDING → EXECUTING → PROPAGATING → PURGED`, 에러/부분실패 시 `PURGE_FAILED`, idempotent 재시도. 단순 SQL 실행 성공을 모든 캐시·백업 정리가 끝난 것으로 보고하지 않는다.

**운영 전 강제 Gate:** 기존 Spring Boot 관리자 권한·관리자 세션 재인증·CSRF·BOLA/tenant·확인 문구·operation idempotency·경합 방지 revision·감사 무결성·삭제 전파 확인·역할 분리 테스트를 모두 통과해야 한다. 현재 이 REST 경로는 **존재하지 않으며** 공개/운영 API에 자동 등록하지 않는다.

## 4. 삭제 범위 및 무효화 순서

**처음에는 정확한 tenant+VIDEO 범위만 허용한다.** VIDEO별 수집 원문, 댓글 작성자 식별자(존재 시), Snapshot, topic/sentiment 파생 지표, 보고서, 검색 색인, 캐시, 예약 분석 Job/Outbox, 내보내기/임시 파일, 백업 내 사본/복구 통제까지 데이터 계보를 따라야 한다.

- **사전 차단:** 삭제 요청을 기록한 즉시 tombstone/deny-read 표시 → 브라우저와 API에서 사용 중단 → 새 수집 Job/Worker 재시도에서 재생성 차단.
- **삭제 실행:** 원문·개인정보·시각화/분석 결과·보조 데이터를 원자적으로 지우거나, 독립 저장소별 상태를 추적해 재시도 가능한 작업으로 처리한다. 삭제가 중간에 실패하면 **PURGED 성공으로 표시하지 않는다**.
- **전파:** Redis/브라우저 캐시, CDN, 검색 색인, 큐, Outbox, 리포트·내보내기, 백업/복구 루틴까지 삭제/무효화 계획을 수행·검증한다.
- **감사:** 관리자 식별자(운영 시), 요청 ID, tenant/VIDEO 범위, 사유코드, 적용 revision, 시작/완료시각, 삭제된 객체 수, 결과/실패 코드 등 **최소한의 메타데이터**만 감사 계층에 남긴다. 댓글 텍스트·작성자·OAuth/API 키·비밀번호는 기록하지 않는다.
- **복구:** 삭제 전 스냅샷을 백업에서 무조건 복원하거나 오래된 작업이 다시 채우면 안 된다. 복구 펜스/삭제 journal과 tombstone을 재적용해 재생성 방지.

관리자 UI에서 2단계 확인이 있어도 **서버 권한 검증은 필수**다. UI에서 버튼을 숨기는 것만으로 관리자 전용 권한을 충족하지 못한다. 글로벌/전체 tenant 삭제는 별도 감사·별도 작업으로 취급한다.

## 5. 보존 및 요청 처리 기준

공식 [YouTube 개발자 정책, Section III.E.4](https://developers.google.com/youtube/terms/developer-policies)에 따르면, 일반적인 **비인증 API 데이터(Non-Authorized Data)는 30일 넘게 유지할 수 없고 갱신 또는 삭제해야 한다**. 댓글 원문/동영상 제목/작성자명 등도 [2026 추가 파생 규정](https://developers.google.com/youtube/terms/derived-metrics-policy)에 따른 **36개월 예외에 포함되지 않는다**. 허용된 통계/파생 분석 지표의 최대 36개월 가능성은 **해당 개발자의 신청·감사·사용 사례 수락**에 의존한다.

YouTube API를 이용해 사용자 데이터를 처리하는 경우, 본인 정보 삭제 요청은 가능한 빨리 **7일 내** 완료해야 한다. 7일을 넘긴 요청이라도 거부하거나 데이터를 보유하라는 뜻이 아니므로 **즉시 삭제 + SLA 위반 별도 보고**가 원칙이다. 삭제 요청 경로는 관리자만 누를 수 있는 버튼과 별개로 존재해야 한다. <https://developers.google.com/youtube/terms/developer-policies>

**PoC 기본값:** 실제 댓글 원문 지속 저장 0, 실제 파생 감성 지표 0. 이 설계/합성 테스트가 실제 YouTube 데이터 저장·감성 분석의 권한을 부여하지 않으며, PR #47 `Y45-E05/E06/E07/E08/E11`은 계속 `POLICY_HOLD/NOT_IMPLEMENTED/NOT_APPROVED`이다.

## 6. 현재 실행 가능한 합성 전용 기능

`src/admin-purge.cjs`는 **고정된 3개의 합성 VIDEO+tenant 레코드**를 메모리에 구성한다. `syntheticActorForTests`는 **테스트 전용 위조가 가능한 인증 시뮬레이터**이며 절대 운영 인증에 사용할 수 없다. 이 점에서 실제 ROLE_ADMIN 검증이 된 것은 아니다.

- `preview({actor,tenantId,videoId})` — 동작에 영향 없는 삭제 영향 미리보기.
- `adminDelete({actor,tenantId,videoId,revision,requestId,confirmation,reasonCode,at})` — 테스트 actor ADMIN에만 허용, scope/version/UUID/사유/확인문구 확인. 합성 메모리의 해당 레코드+캐시+결과+Job/Outbox를 삭제한 뒤 tombstone 기록.
- `systemExpire({actor,at})` — 테스트 SYSTEM만 실행. 만료 합성 레코드만 삭제. 관리자 UI 승인 불필요.
- `systemVerifiedUserErasure({actor,tenantId,videoId,requestId,requestedAt,at})` — 외부에서 적법하게 검증됐음을 가정한 테스트 SYSTEM만 수행. 요청 7일 기한 초과는 `SLA_BREACH`로 기록하면서 **삭제를 계속 수행**. 실제 사용자 신원 확인은 미구현.
- `syntheticReplayAttempt` — tombstone에 걸린 과거 작업/재시도는 합성 결과 재생성을 거부.
- `auditTrail` / `inspect` — 테스트 관리자·tenant 전용 최소 결과만 반환.

~~~powershell
$root = "shared/experiments/yu32-g45-offline-pipeline-v0"
node "$root/scripts/run-admin-purge-demo.cjs" --check
node "$root/scripts/run-admin-purge-demo.cjs" --demo-admin-delete
node "$root/scripts/run-admin-purge-demo.cjs" --demo-expiry
node "$root/scripts/run-admin-purge-demo.cjs" --demo-user-erasure
node --test "$root/tests/admin-purge.test.cjs" "$root/tests/admin-purge-cli.test.cjs"
~~~

**중요한 한계:** 실제 DB/브라우저 캐시/Outbox/로그/백업 데이터가 삭제됐다는 증거가 전혀 없으며, 오프라인 메모리 삭제 자체는 Y45-E07/E08을 통과시키지 않는다. 삭제 작업을 즉시 활성화하거나 일반 API로 노출해서는 안 된다.

## 7. 수용 조건과 연계

- 관리자 수동 삭제는 ADMIN 영역에서만, 일반 사용자와 클라이언트 역할 위조는 거부.
- tenant/VIDEO의 정확한 범위, preview-before-confirm, 두 단계 UI, 사유/UUID/revision, idempotency 및 결과 감사.
- 보존 기한/철회 및 사용자 삭제 요청은 **관리자 로그인에 의존하지 않고** 정책대로 처리.
- 삭제 전파와 복원 방지/재시도 펜스, 편집/복구 경합, 백업/외부 캐시 실패 시 처리.
- Spring Boot/DB 통합·운영 계정/권한/비밀 관리·실제 로그·사용자 보존 대상 인벤토리 검증은 **추후 별도 PR 및 승인**.

**판정:** 관리자 수동 삭제 방향 + 합성 삭제 경계 검증 구현. 실제 YouTube 데이터/운영 삭제 실행 0건. 운영 권한 기능 자체는 미구현, 모든 실데이터 정책 Gate 유지.
