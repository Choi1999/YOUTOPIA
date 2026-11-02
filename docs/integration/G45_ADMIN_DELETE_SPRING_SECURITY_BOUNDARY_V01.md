# YOUTOPIA G45 — Spring 관리자 삭제 엔드포인트 안전경계 시험 v0.1

> **상태:** TEST_PROFILE_ONLY / NO_DATABASE_DELETION / POLICY_HOLD
> **베이스:** `feat/backend-bootstrap@c42c9a65dd5f1d25554b69f05f77f64f0234c244` · Java 21 / Spring Boot 4.0.9
> **목표:** YOUTOPIA 분석 데이터의 **수동 삭제는 관리자만** 실행하도록 서버 권한·CSRF 경계를 독립적으로 검증한다.
> **유관:** [합성 삭제 + 자동 만료 PR #48](https://github.com/Choi1999/YOUTOPIA/pull/48) · [YouTube 정책 준비 PR #47](https://github.com/Choi1999/YOUTOPIA/pull/47)

## 1. 구현한 것 / 구현하지 않은 것

이 PR은 Spring Boot 웹/보안 구성을 **합성 테스트 전용**으로 검증한다. `@Profile("g45-synthetic-test")` 와 `@ConditionalOnProperty(...enabled=true)`를 동시에 만족하는 테스트에서만 컨트롤러가 존재한다. 운영 profile/기본 설정에서는 노출되지 않는다. 기존 `SecurityConfiguration`의 `/api/v1/admin/**.hasRole("ADMIN")`, `anyRequest().denyAll()` 및 CSRF 검사를 **수정하지 않는다**.

| 테스트 요청 | 기대 동작 |
|---|---|
| 비인증 GET capabilities | 401 |
| 회원(USER) GET capabilities | 403 |
| 모의 ADMIN GET capabilities | 200, 합성·실삭제 0/정책 보류 메타데이터 |
| ADMIN POST, CSRF 누락/불일치 | 403 |
| USER POST + 클라이언트 `X-Role: ADMIN` 위조 | 403 |
| ADMIN POST + 정상 CSRF | **503 POLICY_HOLD** (실삭제 안 함) |
| ADMIN POST preview + 정상 CSRF | **503 POLICY_HOLD** (실삭제 미리보기 아님) |
| 역할·삭제 확인/감사 | 사용자별 실서비스 ADMIN session/tenant/ticket는 아직 불연동 |

**중요:** `MockMvc.with(user().roles("ADMIN"))`은 Spring Security의 URL 권한 게이트를 시험하는 **모의 인증**이다. 실제 관리자 세션/Redis/restore journal/tenant 범위 검증을 대체할 수 없다.

## 2. 후속 운영 구현 계약 (별도 승인)

실제 운영 서버의 관리자 삭제는 이후 승인된 Spring 관리자 세션/CSRF, tenant BOLA, 삭제 대상 VIDEO 및 preview revision, `requestId` 중복 실행 방지, 명시적 확인·사유, 감사/삭제 tombstone·복구 fence, DB/캐시/검색색인/Job/Outbox/백업까지 전파 확인을 거쳐야 한다. 기존 `PrivacyPurgeCommand`는 **서비스 계정 삭제**용으로, YouTube 분석 데이터 삭제 SQL에 재사용하지 않는다.

기한 만료·법적/제공자 정책 삭제 및 검증된 이용자 삭제 요청은 **관리자 로그인과 독립적인 안전한 시스템 실행자**가 기한을 준수하도록 한다. 관리자에게는 수동 삭제/감독 권한을 부여하되 의무 삭제를 지연시키지 않는다.

## 3. 검증

GitHub Actions에 Java 21 Gradle **단위/MockMvc 테스트** 전용 스텝을 추가했다. DB/Redis/Docker·운영 서버/API 키·YouTube HTTP 호출·운영 데이터 삭제는 실행하지 않는다.

명령: `./gradlew --no-daemon test --tests 'com.youtopia.youtube.admin.G45AdminDeletionBoundarySecurityTest'`

**추가 승인 전 금지:** 삭제 실행 및 DB 권한 확장, API/DB 운영 활성화, 사용자 정보 임의 삭제, 정책 상태를 PASS로 조작, PR #46/#47/#48 자동 병합.

**현재 판정:** ADMIN_SECURITY_BOUNDARY_ONLY / DESTRUCTIVE_ENDPOINT_DISABLED / REAL_DELETE=0 / POLICY_HOLD.
