# UI-R04-O — YouTube 영상·채널 메타데이터 자동 조회 준비 (오프라인 v0.1)

## 1. 목적·정책 경계

YOUTOPIA에서 영상 URL을 등록하면 유저는 YouTube 공식 영상 제목과 썸네일, 채널 이름과 프로필 사진을 자동으로 보는 UX를 기대한다. PR #78의 임시 '직접 입력한 제목'은 공식 메타데이터 조회 기능이 아니다. 이 단계는 서버에서 수행될 읽기 전용 조회의 입력·응답·캐시 계약을 실 API를 호출하지 않고 검증한다.

- 부모: Draft PR #78, HEAD 77342ff5fc2174f1ea2886718ec42491e1ede66c.
- 구현: shared/experiments/yu32-g45-offline-pipeline-v0/src/metadata-readiness.cjs.
- 테스트: shared/experiments/yu32-g45-offline-pipeline-v0/tests/metadata-readiness.test.cjs.
- 현재 저장소의 기본 bakcend/ 경로는 .gitkeep만 있다. 실제 Spring Boot 서비스는 별도의 feat/backend-bootstrap 계열이므로 이 PR은 배포 가능한 서비스, API 라우트, 컨트롤러, worker, HTTP transport를 생성하지 않는다.
- 의도된 서버 흐름: 등록 URL의 canonical VIDEO/CHANNEL/CHANNEL_HANDLE ID → 운영 게이트 → 승인된 백엔드 읽기 계획 → 공식 YouTube Data API → 검증/매핑/캐시 → 출처 상태가 확인된 소비자 UI. 이 단계에서는 요청 계획과 비신뢰 응답 모양만 제공한다.
- 보호 계약: shared/contracts/yu32-youtube-readiness-v0/policy-gates.json 및 shared/experiments/yu32-g45-offline-pipeline-v0/src/first-page-provider-transport.cjs 변경 금지. POLICY_HOLD, liveCallsAuthorized=false, externalDataCollected=false, verifiedCount=0, derivedSentimentAuthorized=false 그대로 유지.
- 사용자 기능 승인 != 운영 API 첫 호출·Credential 배포·비용·병합 승인.

## 2. 공식 API 계약 (네트워크 미실행)

| 입력 대상 | 후보 메서드 | 단일 조회 식별자 | 응답의 최소 필드 | API 호출당 현재 문서상 비용 |
|---|---|---|---|---|
| VIDEO | videos.list | id(11자 video ID) | snippet.title, snippet.channelId, snippet.thumbnails | 1 quota unit |
| CHANNEL | channels.list | id(UC로 시작하는 24자 ID) | snippet.title, snippet.thumbnails | 1 quota unit |
| CHANNEL_HANDLE | channels.list | forHandle(@handle) | channel.id, snippet.title, snippet.thumbnails | 1 quota unit |

출처: Google Developers [Videos: list](https://developers.google.com/youtube/data/reference/rest/v3/videos/list), [Channels: list](https://developers.google.com/youtube/data/reference/rest/v3/channels/list), [Thumbnails](https://developers.google.com/youtube/data/reference/rest/v3/thumbnails), [Quota Calculator](https://developers.google.com/youtube/data/determine_quota_cost).

- 이 v0.1은 총 1~3개만 계획하고, VIDEO ID와 CHANNEL ID는 종류별로 하나의 조회 후보로 묶는다. 핸들당 forHandle 후보 1개를 추가한다.
- 후보는 GET·호스트·경로·정해진 part=snippet 및 최소 필드·요청 식별자만 포함한다. 네트워크 함수·키·세션·API 자격을 제공하지 않는다.
- maxTargets=3, 요청 후보당 quota 비용 1단위, 최대 계획 3단위, **실제 사용 0**. 이 수치는 비용 예측이며 실계정 잔여할당량 증거가 아니다. 서버 운영에서는 rate/quotas, batching, 인증·권한, 캐시/삭제, per-tenant 제한을 별도로 검토해야 한다.
- channels.list(forHandle=...)의 JSON 응답만 형태 검증해도 채널 핸들 소유권이 검증된 것으로 승격하지 않는다. 운영 backend가 신뢰할 수 있는 Google 응답을 받았을 때에만 조회 결과의 출처 상태를 승인된 별도 계약으로 변경한다.
- 영상 소속 채널 ID는 API 모양 검증에만 사용한다. 이를 근거로 user-facing 그래프에 채널 링크/edge/댓글 감성 관계를 자동 생성하지 않는다.

## 3. 응답 검증·보호

- body는 UTF-8 JSON string/Buffer 최대 256 KiB, 유효한 API 종류·item.kind·조회 ID 범위·중복 없는 row·페이지 카운트·빈 값이 아닌 제목·채널 ID를 요구한다.
- 앱에 필요 없는 description, tags, statistics, comments, raw provider body, error body, etag, OAuth/access token, API key 또는 user/account 정보는 정규화 결과에 포함되지 않는다.
- 썸네일 URL은 문자열 그대로 보존하며 HTTPS 및 명시적 host allowlist만 허용한다: VIDEO i.ytimg.com, CHANNEL yt3.ggpht.com/yt3.googleusercontent.com. 부적합 URL은 null 처리해 이미지 placeholder를 유지한다. 응답 JSON의 URL은 서버에서 fetch하거나 프록시하지 않는다.
- 반환 상태는 반드시 sourceAuthenticated=false, consumerPublicationAuthorized=false, providerRequestsMade=0. JSON 모양이 올바르다는 사실은 실제 YouTube가 제공했다는 증거가 아니다.
- 조회 대상이 비어 있는 모양도 EMPTY_UNAUTHENTICATED다. 실제 영상 삭제·비공개·권한 거부·존재 없음으로 확정하지 않는다.
- 캐시는 프로세스 메모리 전용, 용량 최대 64, TTL 15분, 조회로 TTL 연장 불가. 디코더가 반환한 객체만 저장하고, caller가 조작한 approved 레코드를 주입할 수 없다.
- 손상/범위 외 입력·게터, 알 수 없는 권한 플래그, credentials/query 삽입, wrong-scope/duplicate 응답, oversized JSON은 실패 닫힘(fail-closed). 예외 메시지는 고정 코드이고 원문 body/secret을 포함하지 않는다.

## 4. 현재 사용자 화면과의 관계

현재 PR #78은 직접 입력한 제목/채널 이미지 URL을 임시 별칭·사용자 이미지로 표시한다. 본 PR은 그 UI를 수정하지 않으며, 자동 메타데이터 조회·표시를 활성화한 것으로 주장하지 않는다.

서버 API 사용 승인 이후 별도 PR이 수행할 일:

1. 서버 전용 Credential vault/egress/quotas/retention/role 승인 상태를 독립 증거로 검증한다. 클라이언트에 API key를 노출하거나 브라우저에서 직접 API를 호출하지 않는다.
2. 서버에서 URL의 canonical ID를 허용된 읽기 전용 메서드로 조회한다. 요청 단위로 호출 예산과 재시도·timeout·circuit breaker를 통제하고, 빈 응답/403/404/429/5xx를 구분한다. 웹 스크래핑으로 우회하지 않는다.
3. 신뢰할 수 있는 서버 측 응답의 provenance를 확립하고, 감성/댓글 API 승인과 별개의 메타데이터 정책으로 모델을 갱신한다. 현재 offline decoder의 sourceAuthenticated=false를 caller boolean으로 덮어쓰지 않는다.
4. 서버 캐시 만료·YouTube 정책에 따른 갱신/삭제와 요청 실패 UI를 설계한다. title/thumbnailUrl은 유효한 출처 상태에서만 전달한다.
5. 프런트는 승인된 read-only 결과를 우선 표시하고, 실패 시 제목/프로필 확인 중 또는 조회 실패와 안전한 placeholder를 보여준다. 사용자 지정 제목은 선택적 별칭으로 유지하고, 확인된 공식 제목과 구분한다.
6. 사용자 QA, 라이브/API 허용 정책 검증 및 운영 승인까지 따로 완료해야 실제 작동했다고 판정한다.

## 5. 오프라인 검증 명령

Node 24, 저장소 루트 기준:

~~~powershell
node --check shared/experiments/yu32-g45-offline-pipeline-v0/src/metadata-readiness.cjs
node --test shared/experiments/yu32-g45-offline-pipeline-v0/tests/metadata-readiness.test.cjs
node --test shared/experiments/yu32-g45-offline-pipeline-v0/tests
~~~

위 테스트는 기존 .github/workflows/frontend-validation.yml에 있는 G4-5 synthetic collection and analysis pipeline 작업의 node --test shared/experiments/yu32-g45-offline-pipeline-v0/tests/*.test.cjs 명령으로 자동 포함된다. HEAD 일치 및 GitHub CI PASS가 확인되어야 한다. 실제 API 호출·Cloud 프로젝트 사용·시크릿 접근·배포·병합은 수행하지 않는다.

## 6. 별도 운영 승인 게이트

- provider metadata read-only policy/ToS 검토 결과
- 프로젝트 소유 및 API enablement·quota의 객관적 증거
- 백엔드 runtime/권한/secret storage/IP restriction/rotation/egress와 보안 검수
- 승인된 라이브 read endpoint, 비용/시도 횟수·로그·rate limiting·TTL 및 데이터 갱신/삭제
- 실패 코드와 user-facing provenance, 외부 이미지 CDN·CSP·동의 범위
- 실 호출 선행 독립 검수와 운영자 명시 승인, 이후 별도 QA 및 병합 승인

이 문서는 위 게이트가 충족되었다고 주장하지 않는다.
