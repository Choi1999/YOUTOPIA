# UI-R04-AF — Spring 메타데이터 소비자 경계: 오프라인 계약·인증/인가·실호출 차단

기준: 2026-11-06 KST
저장소: Choi1999/YOUTOPIA
백엔드 부모: Draft PR #90 HEAD 5069a81979fd8ef10123e32d00fa35900b450944
프런트 대응: Draft PR #95 HEAD 08bdc53816a16f74476c9b4a6fe104eead28d4f1 (별도 스택)

## 1. 목적 및 승인 범위

AE 프런트가 요구하는 메타데이터 요청 형식과 Spring 백엔드의 인증·인가 및 오프라인 실패 처리 경계를 맞춘다. 실제 YouTube/Google Data API 호출, 실 키 접근, 운영 메타데이터 제공, 댓글/감성 수집, Cloud 변경, 배포, 누적 PR 병합은 승인되지 않았다.

백엔드 Spring 프로젝트는 프런트와 독립 루트이다. 코드를 한 브랜치에 단순 복사하거나 부모 스택을 합치지 않는다.

## 2. 구현

### AF-1 요청 계약 및 배치 제한 — production class, 실행 불가

경로: src/main/java/com/youtopia/youtube/metadata/MetadataConsumerContract.java

- Java 21 순수 정적 계약. Spring Bean, Controller, 스케줄러, HTTP 클라이언트, API 키 접근이 없다.
- AE 요청 스키마 YOUTOPIA_UI_R04_AE_METADATA_REQUEST_V01의 schema/kind/requestedId 세 값을 명시적으로 맞춘다. 향후 응답 스키마는 YOUTOPIA_UI_R04_AE_METADATA_RESPONSE_V01로 고정한다.
- VIDEO(11자 ID), CHANNEL(UC ID), CHANNEL_HANDLE(소문자 정규화된 핸들) 검증. 전체 URL, 외부 쿼리, 위조 스키마, 중복·초과 배치 거부.
- 한 배치 최대 8개. 실제 provider Quota 승인·Rate-limit 구현을 대신하지 않는다.
- 정책 거부 레코드 POLICY_HOLD·sourceAuthenticated=false·consumerPublicationAuthorized=false·providerRequestsMade=0 고정.
- 임의 approved=true 입력으로 READY 응답을 만들 수 있는 공개 생성기나 운영 provider 호출 기능이 없다.

### AF-2 HTTP 경계 — TEST SOURCE SET ONLY

경로: src/test/java/com/youtopia/youtube/metadata/MetadataConsumerOfflineController.java

- 테스트 전용 경로: /api/v1/youtube/metadata/consumer-offline/{videos|channels|handles}/{id}.
- metadata-offline-test 프로필과 youtopia.metadata.consumer-offline-test.enabled=true 속성이 모두 필요하다. 기본 애플리케이션·운영 bootJar에는 이 경로가 포함되지 않는다.
- 기존 SecurityConfiguration의 /api/v1/youtube/** ROLE_USER 경계와 CSRF를 재사용. 인증 없는 요청 401, USER 없는 ADMIN 403, 테스트용 USER도 503 METADATA_POLICY_HOLD를 받는다.
- 유효하지 않은 ID는 400의 고정 문제 응답. 응답 Cache-Control: no-store, 원본 대상 식별자·키·헤더·제공자 본문이 노출되지 않는 고정 ProblemDetail instance.
- X-Metadata-Approved, X-Role, apiKey, allowRead 등의 클라이언트 자의적 승격 불가능. POST는 CSRF 없으면 403, CSRF 통과해도 405.
- 이 503 오류는 프런트 AE의 성공 응답 디코더 대상이 아니다. AE는 기본적으로 운영 reader가 없으므로 사용자 화면에 계속 메타데이터 미조회가 표시되는 것이 정상이다.

### AF-3 계약·보안 자동 테스트

- MetadataConsumerContractTest: AE 스키마·canonical ID·중복·배치 상한·정책 차단.
- MetadataConsumerOfflineSecurityTest: MockMvc 인증·인가, 고정 503/400·캐시 금지, 위조 키/헤더 미노출, CSRF/쓰기 차단, 명시적 TEST-only route gating.
- .github/workflows/ui-r04q-offline-metadata-bridge.yml에서 기존 Java 21 Spring 오프라인 테스트와 함께 신규 두 테스트·네트워크/비밀 접근 금지 정적 검증 실행.

## 3. 독립 PR의 결합 전략

- 프런트: PR #63~80 → #87 → #89 → #91 → #92 → #93 → #94 → #95, 루트 frontend.
- 백엔드: PR #81~86 → #88 → #90 → AF, 루트 feat/backend-bootstrap.
- 현재 PR #63~95 총 33개는 GitHub 조회 시점 모두 OPEN/Draft/미병합. AF는 #90을 직접 부모로 하고 #95는 #94 부모로 유지한다.
- 향후 통합 시 frontend #95와 backend AF의 요청 스키마·타깃 신원·에러 경계를 독립 SHA 기준으로 교차 검증한다.
- 실제 첫 호출 전에 서버 인증된 사용자 identity, 계정/테넌트 분리, 서버 권한/세션/CSRF, 실제 키 보관과 egress/IP 제한, Quota·비용·약관, provider-origin 증빙, 오류/TTL/삭제, 관찰·중단·로그 비밀 미노출의 별도 승인이 필요하다.
- 응답 JSON의 sourceAuthenticated=true 필드만으로 제공자 출처는 증명되지 않는다. 서버가 실제 출처를 독립적으로 검증하기 전에는 READY 발행 금지.
- 부모부터의 병합은 별도 명시 승인 없이는 하지 않는다.

## 4. 검증 경계

AF는 새로운 소비자 UI를 추가하지 않는 백엔드 오프라인 계약·403/503 거부 테스트다. Spring MockMvc 자동 검증을 핵심으로 수행하고, 기존 #95 수동 QA를 불필요하게 재요청하지 않는다. GitHub CI 결과가 완료되기 전까지 PASS로 간주하지 않는다. 최초 실 HTTP 성공이나 Google API 사용을 이번 PASS의 의미로 확대하지 않는다.

## 5. 다음 미승인 단계

실제 Spring 운영 reader의 인증·인가/Quota/키 보관 설계 → 서버 provider provenance 검증 → 프런트 same-origin reader 연결 → 최초 실 YouTube Data API 호출 별도 승인/관찰 → 배포·병합 별도 승인.

AF 완료 정의: 오프라인 요청 계약 일치 + TEST 전용 deny HTTP 경계 + Java CI PASS + Draft/미병합 유지.
