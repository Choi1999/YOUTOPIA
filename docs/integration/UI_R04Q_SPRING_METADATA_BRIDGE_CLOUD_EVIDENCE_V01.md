# UI-R04-Q — Spring Boot 메타데이터 오프라인 계약 연계 및 Google Cloud 독립 증거 검수

작성일: 2026-11-05 KST

## 1. 기준 브랜치 및 확인한 사실

| 항목 | 확인 |
|---|---|
| Spring Boot 원격 기준 | feat/backend-bootstrap @ 01503885e24d3320f131ea17250748677e904a30 |
| 프런트/공유 계약 기준 | PR #80 @ d49898faeef5c5620acea524a3a564cb45fbf2f6 |
| Node 메타데이터 기본 계약 | PR #79의 metadata-readiness.cjs, R04O_OFFLINE_METADATA_PLAN_V01/R04O_OFFLINE_METADATA_SHAPE_V01 |
| 오프라인 모의 예산 수명주기 | PR #80의 metadata-guarded-lifecycle.cjs, POLICY_HOLD |
| Java 기술 스택 | Java 21, Spring Boot 4.0.9, Jackson 2 호환 |
| 운영 API 라우트 | 이번 PR은 신규 컨트롤러/Bean/API 라우트를 등록하지 않음 |
| 백엔드 기본 보안 | 기존 SecurityConfiguration은 unknown routes denyAll, ADMIN/USER 권한 및 CSRF 구분 |
| 자동 제목/채널 사진 제공 | 이번 PR은 오프라인 호환성 검증이며 소비자 자동 표시는 미구현 |

**두 기준 브랜치는 서로 다른 개발 트랙이다.** frontend 계열의 PR #80을 feat/backend-bootstrap으로 직접 cherry-pick/merge하지 않는다. 이번 PR은 백엔드 기준 브랜치에 별도로 열며 GitHub PR 설명에서 #80과 정확한 SHA의 계약 관계를 연결한다.

## 2. 구현: 프로덕션에 노출되지 않는 Java 계약

- src/main/java/com/youtopia/youtube/metadata/OfflineMetadataBridge.java
- src/test/java/com/youtopia/youtube/metadata/OfflineMetadataBridgeContractTest.java
- .github/workflows/ui-r04q-offline-metadata-bridge.yml

Java Bridge는 공식 YouTube Data API의 메타데이터 읽기 후보만 표현한다.

| 대상 | METHOD | 입력 | 응답의 최소 필드 |
|---|---|---|---|
| VIDEO | videos.list | id | id, snippet.title, snippet.channelId, snippet.thumbnails |
| CHANNEL | channels.list | id | id, snippet.title, snippet.thumbnails |
| CHANNEL_HANDLE | channels.list | forHandle | id, snippet.title, snippet.thumbnails |

- 최대 3 canonical ID, 같은 유형 ID는 하나의 요청 계획으로 묶음, 계획상 요청당 1 quota unit, 실제 요청 0.
- 채널 URL/핸들의 텍스트만으로 실제 해당 채널 소속 또는 소유 관계를 주장하지 않음.
- 응답 JSON 최대 256KiB, UTF-8 오류 및 중복 JSON 키 거부, 범위 외/중복 영상·채널 ID·비어 있는 제목 거부.
- 썸네일 후보 호스트는 영상 i.ytimg.com, 채널 yt3.ggpht.com/yt3.googleusercontent.com 정확한 HTTPS 경계만 사용. 문자열은 검증만 하고 서버가 사진을 가져오거나 재호스팅하지 않음.
- 모든 레코드에서 sourceAuthenticated=false, consumerReady=false, consumerPublicationAuthorized=false, providerRequestsMade=0.
- class/record는 Spring stereotype annotation이 없다. 기존 보안 체인·API controller, Bean 정의, DB, Gradle 종속성, application.yml 또는 secrets를 변경하지 않음.
- 이 구현은 Google 응답을 실제로 인증하는 능력, 서버 저장·캐시, HTTP dispatch 또는 서드파티 API 실행 경로를 갖지 않음.
- 별도 JUnit 테스트 및 Java 21 CI로 비실행 계약/기존 타입 호환만 평가한다. 기존 live-call compile-time lock을 수정하지 않음.

## 3. Google Cloud 운영 조건: 독립 증거 검수 결과

이번 검수는 **GitHub 소스·설계 문서 및 공식 Google 문서만 읽었다.** Google Cloud 프로젝트 계정/IAM·Credentials·Quota 화면으로 직접 접근하는 Cloud Console 연결은 없으므로 실제 프로젝트의 활성 설정을 관찰하지 않았다. 소스 코드의 '검증됨' 플래그나 과거 사용자 보고/캡처는 독립적인 Cloud 운영 증거가 아니다.

| 게이트 | GitHub에서 확인할 수 있었던 내용 | 현재 판정 |
|---|---|---|
| E01 프로젝트 식별·소유권 | 기존 G45-L8 문서는 프로젝트 도달성이 소유권 증거가 아니라고 명시 | UNVERIFIED |
| E02 YouTube Data API 활성화 | 오프라인 스크립트의 Check 경로가 존재. 실제 Inspect 결과 없음 | UNVERIFIED |
| E03 제한된 키/서버 IP/보안 보관·회전 | 기존 문서에 후보 정책은 있으나 현재 키의 API 제한, IP, Vault 상태 접근 불가 | UNVERIFIED |
| E04 quota 일일 상한/사용량/잔여량 | 정본 문서의 이전 사용자 화면 보고값은 실계정 현재 증거가 아님 | UNVERIFIED |
| E05 목적·YouTube 정책 적합성 | 소스 게이트에서 POLICY_HOLD | POLICY_HOLD |
| E09 서버 AuthN/tenant/CSRF/BOLA | 기존 SpringSecurity 소스에서 역할별 규칙은 확인. 신규 메타데이터 API와 tenant 범위는 아직 없음 | NOT_IMPLEMENTED_FOR_METADATA |
| E10 provider provenance/캐시 갱신/실데이터 구분 | Java/Node shape-only 테스트. 실제 TLS provider-origin 검증은 아직 없음 | NOT_IMPLEMENTED_FOR_LIVE |
| E11 첫 실호출의 정확한 범위·운영자·예산·별도 허가 | 사용자에게 첫 YouTube API 호출 승인을 별도로 받지 않음 | NOT_APPROVED |
| E12 운영 보안/비용/배포 승인 | 서버 실제 호출 및 배포 미실행 | POLICY_HOLD |

**상위 정본 정책파일은 여전히 0/12 verified**, POLICY_HOLD와 liveCallsAuthorized=false. 이번 Java CI 성공은 이 표에서 VERIFIED로 바꾸는 증거가 아니다.

## 4. 공식 검증 기준 및 안전한 운영자 점검

참조:
- https://developers.google.com/youtube/data/reference/rest/v3/videos/list
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/determine_quota_cost
- https://docs.cloud.google.com/docs/authentication/api-keys

Google Cloud 키에서는 **API 제한**(YouTube Data API만 허용)과 **애플리케이션 제한**(백엔드의 실제 외부 IP)을 각각 검수해야 한다. Google 문서는 localhost·사설 IP를 서버 키 제한의 유효 외부 IP로 인정하지 않으며, 제한 없는 키를 운영 우회책으로 사용해서는 안 된다. 표준 API 키는 프로젝트·할당량 연결 수단이지 사용자 OAuth 권한 확인 수단이 아니다.

기존 frontend 계열의 읽기 전용 운영자 점검 도구:
shared/contracts/yu32-youtube-readiness-v0/scripts/g45-l8-cloud-metadata-preflight.ps1

- Check 모드는 Cloud CLI를 호출하지 않음.
- Inspect 모드는 운영자 Windows PC에서만 실행하고, 권한 있는 기존 gcloud 인증을 사용할 수 있음. API 키는 이 스크립트가 직접 읽지 않지만 CLI는 기존 인증 캐시를 사용할 수 있으므로 인증 읽기 0이라고 단정하지 않음.
- 권한 없는 로그인·프로젝트 생성·API 활성화·키 생성·Quota 변경·실 YouTube API 호출은 절대 하지 않음.
- 운영 검수에서 필요한 비밀 제외 결과: 프로젝트 현재 상태/접근 가능 여부, YouTube Data API 활성 서비스 관찰. 별도 Cloud Console의 동일 프로젝트에서 owner/IAM/API key 제한/출구 IP/Quota 대조가 추가로 필요.
- 원문 API 키·토큰·내부 IP·계정 이메일·콘솔 민감 화면·CLI raw stderr는 GitHub·PR·채팅에 게시하지 않음.

**이번 단계에서는 위 Inspect 명령을 실제 실행하지 않았다.** Cloud Console의 실 프로젝트 설정은 미확인으로 유지하고, 운영자 독립 검수 결과가 들어오기 전까지 사용 허가는 보류한다.

## 5. 안전 경계 및 수용 기준

- 백엔드 독립 Draft PR, base feat/backend-bootstrap만 대상으로 한다. frontend PR #63~80, 운영 설정, 보안 체인, 정책 게이트는 변경하지 않는다.
- Spring Boot 4 / Jackson 2 / Java 21에서 순수 계약이 빌드되고 기존 데이터소스·Redis·Docker 없이 JUnit 테스트가 PASS해야 한다.
- 새 MetaData API 라우트는 어떤 User/Admin 요청에도 노출되면 안 된다.
- 기존 Node R04-O/P 계약에서 입력 종류·아이템/상태 필드·불신 provenance 동작을 바꾸지 않아야 한다. 계약 변경은 반드시 양쪽 PR을 검수한다.
- 자동 조회 활성화는 별도 백엔드 HTTP transport/credential/quota journal 설계와 보안 검토 후, 메타데이터 전용 읽기 승인·최초 실행 승인·운영 환경/비용 승인 순으로 분리한다.
- 서버에서 실제 Google 응답을 확인한 뒤 프런트에 title/thumbnail을 전달하고, 실패 시 미확인 UI/캐시 TTL/삭제 규칙을 적용하는 것은 **후속 별도 기능**이다.
- 이 문서의 판정: BACKEND_OFFLINE_CONTRACT_BRIDGE / CLOUD_EVIDENCE_UNVERIFIED / LIVE_PROVIDER_0 / MERGE_NOT_APPROVED.
