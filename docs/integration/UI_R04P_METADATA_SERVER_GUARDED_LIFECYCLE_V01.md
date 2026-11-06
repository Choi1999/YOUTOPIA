# UI-R04-P — 서버 영상·채널 메타데이터 보호 수명주기 (OFFLINE v0.1)

## 1. 목적과 승인 범위

- 부모: Draft PR #79, HEAD 36412d869e244e8a53112e2dbfe51f88c5a2aba3.
- 사용자 제품 목표: 영상 URL 등록 후 공식 제목·채널명·썸네일을 자동으로 표시한다. 별칭 수동 입력은 보조 기능이어야 한다.
- 이번 단계: 기존 UI-R04-O 요청 계획/응답형식 디코더 위에 **오프라인** 호출 예산, 오류 분류, 출처 격리, 캐시 수명주기를 구현하고 검증한다.
- 미포함: 실제 API 호출, 계정 할당량 예약, 비밀키 접근, 배포/실행 가능한 백엔드, 자동 제목 UI 연동, 병합.
- 기존 G45 POLICY_HOLD, liveCallsAuthorized=false, 외부 데이터 collected=false, 감성 평가 차단, 첫 실호출 transport release-lock 모두 불변.

## 2. 공식 API 후보

| 대상 | 공식 메서드 | 식별자 | 필요한 응답 필드 | 호출 비용 |
|---|---|---|---|---|
| 영상 | videos.list(part=snippet) | video ID | snippet.title, channelId, thumbnails | 요청당 1 unit |
| 채널 | channels.list(part=snippet) | UC channel ID | snippet.title, thumbnails | 요청당 1 unit |
| 채널 핸들 | channels.list(part=snippet, forHandle=@handle) | @handle | channel.id, snippet.title, thumbnails | 요청당 1 unit |

공식 문서: https://developers.google.com/youtube/data/reference/rest/v3/videos/list , https://developers.google.com/youtube/data/reference/rest/v3/channels/list , https://developers.google.com/youtube/data/determine_quota_cost

- R04-O 계획은 입력 1~3개, 같은 종류의 ID를 한 요청 후보로 묶고, 네트워크 기능을 제공하지 않는다.
- 이번 R04-P의 분당 6 계획 단위, 미해결 ticket 3개, 자동 재시도 0회는 **단일 프로세스의 오프라인 모의 예산**이다.
- 실제 Google Cloud quota 차감·원자적 예약·동시 요청 제한 또는 API 요청이 전혀 아니다.

## 3. 구현된 서버 후보 생명주기

1. createLockedMetadataLifecycle()는 canonical POLICY_HOLD를 확인한다. 외부 자격 증명이나 사용자 승인 플래그를 받는 호출 경로는 없다.
2. propose()는 videoIds/channelIds/handles의 정해진 형식만 계획하고, 비실행 ticket과 모의 quota 차감 기록을 반환한다. 알 수 없는 API key, 임의 URL, allowRead 플래그는 거부한다.
3. inspectSyntheticBodies()는 호출자가 제공하는 in-memory JSON 테스트 본문만 받는다. 모든 배치의 정규 ID/응답 종류/영상 제목/채널명/썸네일 호스트/UTF-8/본문 크기를 검증한 후에만 in-memory cache에 넣는다. 티켓은 성공·실패 여부와 무관하게 단 한 번 사용할 수 있다.
4. simulateFailure()는 허용된 숫자 statusCode 및 reason 조합만 수락한다. 403 quotaExceeded·forbidden, 404 notFound, 429 rateLimitExceeded, 500/503 serverError를 단순한 오프라인 후보 상태로만 분류한다. 임의 에러 body, provider credentials, 로그를 받아들이지 않는다.
5. readOfflineCache()는 디코더가 만들어낸 비인증 레코드만 캐시한다. 최대 64개, 15분 TTL, 읽기로 만료 연장 불가. close()는 진행 중 ticket 및 캐시 제거 후 재시작을 거절한다.
6. 모든 호출 결과에 sourceAuthenticated=false, consumerPublicationAuthorized=false, actualProviderRequests=0, actualQuotaUnitsConsumed=0이 고정된다. 응답 모양이 맞는다고 실제 Google에서 받았다는 뜻이 아니다.

## 4. 안전 검증 한계

- 이 PR은 네트워크 모듈, API key, Google Cloud 연결, 인증 토큰, 시스템 비밀 저장소, DB, 외부 HTTP endpoint, frontend integration을 추가하지 않는다.
- 캐시와 계획 예산은 **프로세스 메모리만 사용**하고, 여러 서버에서 공유되지 않는다.
- 실제 운영에서 필요한 durable quota journal / 요청자의 tenant 및 권한 증명 / server-side secret vault / 발신 IP·TLS 및 재시도 정책 / 보관·수정·삭제 SLA / provider transport 출처 검증은 **미구현**이다.
- 누락된 영상·채널 조회 모양은 미검증으로 남기며 NOT_FOUND를 확정하지 않는다. 실제 실패와 0개 결과를 구별하는 것은 미래의 승인된 서버 경계 책임이다.
- 검증한 JSON이나 user input은 사용자 화면의 공식 제목으로 직접 게시할 수 없다.

## 5. 실제 자동 조회를 만들기 위해 필요한 별도 승인 절차

1. 실제 Spring Boot 백엔드의 기준 브랜치/서비스/실행환경을 확정한다. 현재 frontend 스택의 bakcend 폴더에는 운영 구현이 없다.
2. Google Cloud 프로젝트 소유, API enablement, quota, service account/서버 권한, secret storage, IP restriction/egress 및 비밀키 회전을 독립 검수한다. API key는 프런트·GitHub·채팅에 공개하지 않는다.
3. 기존 댓글/감성 수집 차단과 분리된 **메타데이터 읽기 전용** 정책 및 첫 호출 운영 승인 경로를 별도 PR로 설계한다. 기존 POLICY_HOLD를 일반적인 승인 신호로 해제하지 않는다.
4. 실제 서버 transport가 반환한 응답만 출처 신뢰 판단 대상으로 삼고 TLS, 고정 호스트, redirect/timeout/크기, 분산 quota 예약, 캐시 만료·삭제 및 오류 코드를 검증한다.
5. 검증 완료 후 서버 API와 프런트의 제목·채널 이미지 자동 표시를 연결하고, 조회 실패 시 식별자/미확인 상태를 표시한다.
6. 첫 실 호출 및 병합/배포는 각각 명시적 승인으로 분리한다.

## 6. 오프라인 테스트 명령 (Node 24, 저장소 루트)

~~~powershell
node --check shared/experiments/yu32-g45-offline-pipeline-v0/src/metadata-guarded-lifecycle.cjs
node --test shared/experiments/yu32-g45-offline-pipeline-v0/tests/metadata-guarded-lifecycle.test.cjs
node --test shared/experiments/yu32-g45-offline-pipeline-v0/tests
~~~

기존 CI인 frontend-validation.yml에서 G4-5 synthetic offline suite 테스트 와일드카드로 자동 실행된다. 기존 React/Extension/Windows Offline CI도 HEAD 기준 PASS 확인이 필요하다.

**이번 완료 기준: 오프라인 계획·권한 차단·실패·TTL·quota 수명주기 검증. 실제 YouTube 제목/채널 이미지 자동 조회 완료가 아니다.**
