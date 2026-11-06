# UI-R04-X — Spring Boot 테스트 전용 합성 HTTP 서버

작성일 2026-11-05 KST

## 1. 기준, 실행 및 범위

백엔드 부모: Draft PR #86 @ 85951d0d2964b5f4bc05fe233343701598a22c45.
프런트 UI 계약: Draft PR #87 @ d338e63a166fe677a69ac73f87ea10b0beb058f8.
실행자: Windows 개발용 Java 21/Spring Boot, 테스트 전용 localhost.

- MetadataSyntheticHttpController.java 및 MetadataSyntheticLoopbackApplication.java는 src/test/java/com/youtopia/youtube/metadata/synthetic 안에만 존재한다. 운영 bootJar/메인 Spring 스캔과 무관.
- 별도 Gradle 태스크 runR04XSyntheticMetadataLoopback을 사용자가 수동 실행하면 loopback 127.0.0.1:8765의 Spring 컨테이너를 실행한다. 다른 작업이나 앱의 기본 실행과는 별도.
- 해당 격리 Spring 컨텍스트는 테스트 프로필 metadata-offline-test 및 명시 속성 youtopia.metadata.synthetic-http.enabled=true를 모두 요구한다.
- 이 격리 서버는 실제 Google/YouTube API, API 키, 인증 토큰, 데이터베이스, Redis, 댓글, 감성 분석 또는 외부 메타데이터를 사용하지 않는다.
- 기존 운영 SecurityConfiguration, 테스트 전용 503 MetadataOfflineBoundaryController, POLICY_HOLD, 정본 liveCallsAuthorized=false, 비밀 보관소 코드는 변경하지 않는다.

## 2. Synthetic HTTP API의 정확한 계약

GET /api/v1/youtube/metadata/synthetic/videos/{11자 VIDEO_ID}
GET /api/v1/youtube/metadata/synthetic/channels/{UC + 22자 CHANNEL_ID}
GET /api/v1/youtube/metadata/synthetic/handles/{@handle}

성공 시 application/json, Cache-Control: no-store, X-YOUTOPIA-Synthetic: test-only.
응답의 필드는 schema=YOUTOPIA_R04W_SYNTHETIC_METADATA_INTEGRATION_V01, status=SYNTHETIC_NOT_PROVIDER_DATA, record.source=LOCAL_SYNTHETIC_ONLY, kind, requestedId, title, channelName, artwork, sourceAuthenticated=false, providerRequestsMade=0, consumerPublicationAuthorized=false.

Title은 영상이면 합성 영상 제목 · ID, 채널이면 합성 채널 이름 · ID이다. 영상의 channelName은 '합성 채널 안내 · 실제 소속 미확인', 채널/핸들은 null. Artwork는 VIDEO_PLACEHOLDER 또는 CHANNEL_PLACEHOLDER이다. 어떤 실제 사진 URL이나 채널 멤버십, 분석 수치도 제공하지 않는다.

다른 대상 종류·ID·미등록 경로·변경 요청·부정한 프로필 상태는 실패한다. 테스트 전용 서버의 인증 없이 허용된 GET은 단지 동일 PC의 루프백 fixture 검증에만 유효하며 운영 인증을 대체하지 않는다.

## 3. 사용자 Windows PC 로컬 수동 QA

별도의 backend worktree를 이번 PR HEAD로 체크아웃한 후 첫 번째 PowerShell에서:

~~~powershell
cd C:\Projects\YOUTOPIA-R04X-BE-QA
.\gradlew.bat --no-daemon test --tests "com.youtopia.youtube.metadata.synthetic.MetadataSyntheticHttpLoopbackTest"
.\gradlew.bat --no-daemon runR04XSyntheticMetadataLoopback
~~~

127.0.0.1:8765 루프백 Spring 서버가 기동된다. Ctrl+C로 종료한다. 두 번째 PowerShell은 **별도 frontend PR worktree**를 checkout해서 다음과 같이 실행한다.

~~~powershell
cd C:\Projects\YOUTOPIA-R04Y-FE-QA\frontend
$env:VITE_R04Y_SYNTHETIC_HTTP = "enabled"
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
~~~

브라우저에서는 Vite 개발 서버의 /analysis/youtube/workspace로 이동해 VIDEO URL 추가 후 Spring 합성 연결을 명시적으로 선택한다. 브라우저는 same-origin Vite의 상대 경로만 호출하고 Vite가 127.0.0.1:8765 테스트 Spring으로 프록시한다. 첫 3개까지만 합성 GET을 보내며, 정확한 ID·응답 상태가 일치하면 그래프·목록·상세에 '합성' 제목과 DEMO CSS 미리보기만 반영한다.

실 서버가 없거나 실패하면 미확인 상태를 유지하고 로컬 모의 제목으로 폴백해 실제 성공처럼 취급하지 않는다. 실제 브라우저↔Spring 통합 PASS는 사용자 로컬 수동 QA를 받기 전까지 주장하지 않는다.

## 4. CI와 운영 경계

- MetadataSyntheticHttpLoopbackTest는 실제 RANDOM_PORT Spring HTTP를 사용해 200 JSON·no-store·대상 구분·실 provider 0·잘못된 입력 400·다른 경로 및 POST 거부를 시험한다.
- 별도 프런트엔드는 strict decoder, 테스트 전용 응답 헤더, dev feature-flag 및 zero-credential HTTP 요청을 검증해야 한다.
- 실 API 키, Google 프로젝트/할당량, 실제 YouTube videos.list/channels.list, 실제 사용자와 채널 소유관계, 댓글 수집, 데이터 삭제, 정책 해제, 운영 배포/병합 승인에는 전혀 영향을 주지 않는다.

판정: SPRING_TEST_ONLY_LOOPBACK_SYNTHETIC_HTTP / REAL_GOOGLE_REQUESTS_0 / PRODUCTION_ROUTING_UNCHANGED / NOT_MERGED.
