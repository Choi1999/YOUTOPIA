# UI-R04-Z — Spring 메타데이터 소비 상태 계약: 합성 HTTP

기준: 2026-11-05 KST
부모: Draft PR #88 @ 1c2a5edb13097f48c685447e6310f5c0f8e2b341
기술: Java 21/Spring Boot 4, TEST source set, 루프백 fixture 127.0.0.1:8765

## 1. 이번 개발의 범위

사용자가 요청한 소비 상태 구분(조회 대기/성공/미존재/실패/만료), 신선도, 영상-채널 관계 검증과 캐시 갱신을 대비한 **서버 응답 계약만** 정의한다. 공개 Google/YouTube 자료, 운영 API 키, 댓글/감성·분석 데이터는 수집하지 않는다. Spring 운영 Boot JAR과 기존 SecurityConfiguration, 503 정책 경계, POLICY_HOLD는 수정하지 않는다.

새 컨트롤러 MetadataSyntheticStateController는 src/test/java에만 존재하고, metadata-offline-test 프로필과 youtopia.metadata.synthetic-http.enabled=true 두 조건이 모두 충족될 때만 생성된다.

## 2. 응답 계약

기본 경로: /api/v1/youtube/metadata/synthetic-state
- GET /videos/{정확한 11문자 VIDEO ID}
- GET /channels/{UC + 22문자 CHANNEL ID}
- GET /handles/{@handle}
- 선택적 시나리오 쿼리: scenario=READY|NOT_FOUND|FAILED|STALE. 별도 지정이 없으면 READY. 개발용 오류 시뮬레이션만 가능하며 실제 provider 요청은 항상 0.

모든 응답은 Cache-Control: no-store, X-YOUTOPIA-Synthetic: test-only로 구분된다. 정상 JSON은 다음 고정 필드만 반환한다.

- schema: YOUTOPIA_R04Z_METADATA_CONSUMER_STATE_V01
- status, source=LOCAL_SYNTHETIC_ONLY, kind, requestedId
- title, channelName, artwork, channelId
- associationVerified=false
- observedAt, expiresAt (밀리초 Unix timestamp)
- failureCode
- sourceAuthenticated=false, providerRequestsMade=0, consumerPublicationAuthorized=false

| 상태 | HTTP | 제목·이미지 | 시각·오류 |
|---|---:|---|---|
| READY | 200 | 합성 제목 및 VIDEO_PLACEHOLDER 또는 CHANNEL_PLACEHOLDER | observedAt 현재, expiresAt 60초 뒤, failureCode=null |
| NOT_FOUND | 404 | 모두 null | observedAt=expiresAt=0, FIXTURE_NOT_FOUND |
| FAILED | 503 | 모두 null | observedAt=expiresAt=0, FIXTURE_UNAVAILABLE |
| STALE | 200 | 합성 제목/아트워크 포함하되 소비 UI의 신선한 READY로 게시 금지 | 과거 timestamp 및 FIXTURE_EXPIRED |

조회 중(PENDING)·미조회(IDLE)는 HTTP 응답이 아닌 React 클라이언트 상태로만 나타낸다.

**영상–채널 관계:** 제공자 인증이 없으므로 channelId=null, associationVerified=false로 고정한다. VIDEO와 CHANNEL ID가 그래프에 함께 있거나 임의로 유사하다는 이유만으로 연관을 추론하면 안 된다. 실제 영상 채널 소속 검증은 향후 출처 신뢰·정확한 정본 ID/타임스탬프·권한 검수 이후 별도 승인 필요.

## 3. 검증·보안 경계

- 기존 UI-R04-X Spring 테스트 애플리케이션 SecurityFilterChain에서 이 합성 3종 GET 경로만 추가 permitAll; 루프백 외부 리스닝 금지, 다른 경로/POST 등은 계속 denyAll.
- TEST 클래스패스 빌드와 운영 Java JAR는 별도. 실제 Provider Client, Windows 키 보관소, Cloud API, 계정/DB/Redis를 호출하지 않는다.
- 잘못된 ID/시나리오에 대한 고정 application/problem+json 400; 요청 ID·비밀정보·원시 URI를 오류 본문에 내보내지 않는다.
- 실제 RANDOM_PORT Spring HTTP JUnit MetadataSyntheticStateHttpTest에서 네 가지 상태, 올바른 HTTP 코드, 0 요청·인증/연관/게시 false, 존재하지 않는 경로/변경 요청 거부 확인.
- 브라우저 통합은 별도 React Draft PR #91의 실제 Vite proxy CI가 이 정확한 backend SHA를 checkout한 뒤 검증해야 한다.

## 4. Windows 개발기 QA

별도 backend worktree를 이 PR 정확한 HEAD로 checkout한 후, JDK 21이 준비된 PowerShell에서:

~~~powershell
cd C:\Projects\YOUTOPIA-R04Z-BE-QA
.\gradlew.bat --no-daemon test --tests "com.youtopia.youtube.metadata.synthetic.MetadataSyntheticStateHttpTest"
.\gradlew.bat --no-daemon runR04XSyntheticMetadataLoopback
~~~

테스트 서버는 실행 중인 첫 번째 창에 둔다. 두 번째 창에서는 프런트 PR #91의 Vite와 명시적인 두 가지 개발 플래그만 활성화한다. 실제 API 키/계정 정보는 입력하지 않는다.

## 5. 운영 분리

이 테스트의 PASS는 실제 Google API 성공/404/할당량 실패나 사용자 영상·채널의 존재 증명이 아니다. 실제 metadata provider transport, Key 제한, Cloud IAM/Quota, E01~E12/M01~M10 독립 검토, cache/privacy/snapshot 삭제 정책, 승인된 첫 API 호출, production 병합/배포는 모두 별도 게이트에 남는다.

판정: VERSIONED_SYNTHETIC_HTTP_STATE / NO_PROVIDER_IO / TEST_CLASSPATH_ONLY / POLICY_HOLD.
