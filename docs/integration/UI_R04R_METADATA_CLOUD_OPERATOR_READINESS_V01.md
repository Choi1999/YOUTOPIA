# UI-R04-R — YOUTOPIA Spring Boot 메타데이터 조회 경계 및 Google Cloud 운영 증거 검수

작성일: 2026-11-05 KST

## 1. 기준점·현재 판정

- 백엔드 부모: Draft PR #81 (feature/ui-r04q-spring-metadata-offline-bridge-v01), HEAD 5ab25b68e8ae3368479be98552ee03fd2f8c3ba4.
- 공유 Node 메타데이터 보호 계약: frontend 스택 Draft PR #80, HEAD d49898faeef5c5620acea524a3a564cb45fbf2f6.
- 운영 기준: feat/backend-bootstrap, Java 21 + Spring Boot 4.0.9, 기존 SecurityConfiguration의 /api/v1/youtube/** ROLE_USER/그 외 denyAll.
- 정본 API 정책: frontend 스택의 shared/contracts/yu32-youtube-readiness-v0/policy-gates.json = POLICY_HOLD / liveCallsAuthorized=false / verifiedCount=0. 변경하지 않음.
- **판정: SERVER_ROUTE_TEST_GUARDED / CLOUD_EVIDENCE_UNVERIFIED / LIVE_PROVIDER_0 / NOT_MERGED.**
- 이 검수에서는 GitHub 저장소·오프라인 CI와 Google 공식 문서에만 접근했다. Google Cloud 프로젝트의 IAM/키/Quota/출구 IP에 직접 연결할 수 없으므로 현재 실제 설정을 확인했다고 주장하지 않는다.

## 2. 새 서버 조회 경계 구현과 보안 계약

src/main/java/com/youtopia/youtube/metadata/MetadataOfflineBoundaryController.java

- 미래 URL 형태: GET /api/v1/youtube/metadata/videos/{videoId}, /channels/{channelId}, /handles/{handle}.
- **현재 프로덕션에서 등록되지 않음.** Spring @Profile("metadata-offline-test")와 youtopia.metadata.synthetic-boundary.enabled=true 두 조건이 동시에 충족된 격리 테스트 환경에서만 컨트롤러가 등록된다.
- 테스트에서 활성화하더라도 요청은 즉시 HTTP 503, code=METADATA_UNAVAILABLE, Cache-Control: no-store를 돌려주며 YouTube/Google API 요청·토큰 읽기·자격 증명 노출·데이터 갱신·쿼터 소비를 하지 않는다.
- 기존 /api/v1/youtube/** 경로에는 Spring Security 역할 USER가 적용된다. 익명 401, USER 503, USER 역할 없는 ADMIN 403. 헤더의 X-Role, allowRead, X-API-Key나 API 키 쿼리 값은 인증·실호출 허가로 사용하지 않는다.
- POST 경로는 구현되지 않는다. CSRF 없이 POST 시 403, CSRF가 있어도 GET만 등록되어 있으므로 405. 신규 업로드, credential 설정, 운영 상태 전환은 없음.
- 오류 본문은 대상 ID, 원본 URL, API key, 조회 상태, 내부 quota/Cloud 증거를 포함하지 않으며 사용자가 이해할 수 있는 일반적인 미가용 상태만 표시한다.
- 임의 서비스 설정만으로 운영 메타데이터 조회가 살아나지 않도록 테스트 전용 프로필이 별도로 필요하다. 추후 **실운영 모듈은 별도 PR/별도 자격 증명·정책·단단한 운영 게이트 검수** 없이는 생성하지 않는다.
- 기존 OfflineMetadataBridge.java는 변경하지 않으며 속성 승인만으로 메타데이터를 실제 Google에서 받은 것으로 인증하지 않는다.

## 3. Google Cloud 증거 체크리스트: 판정과 추가 필요 증거

| 증거 ID | 확인 필요 항목 | 이 검수에서 확인 가능한 내용 | 현재 판정 |
|---|---|---|---|
| E01 | 동일 프로젝트 소유·IAM 운영자·실행 주체 | 저장소에는 운영 후보·검증 절차만 있음, 실제 Console 접근 없음 | UNVERIFIED |
| E02 | YouTube Data API v3 사용 설정 | 기존 읽기 전용 gcloud Inspect 계획 존재, 실제 결과 미열람 | UNVERIFIED |
| E03 | 기존 API 키의 YouTube API 제한, 서버 외부 IP 제한 및 실제 IP 일치, 비밀 저장·회전·로그 마스킹 | 비밀·제한 설정·출구 IP 미열람. 오프라인 코드는 키를 받지 않음 | UNVERIFIED |
| E04 | **같은 프로젝트**의 현재 quota 상한/사용량/잔여량·실호출 예산 | 공식 videos.list 및 channels.list는 요청당 1 quota unit; 사용자의 실제 잔여량은 미확인 | UNVERIFIED |
| E05 | YouTube Developer Policies/허용 목적·개인정보/표시 정책 | 정책 문서 검토가 남음 | POLICY_HOLD |
| E09 | 메타데이터 읽기 AuthN/테넌트 BOLA·CSRF | 테스트 전용 DENY 경로 보안만 확인. 운영 GET/테넌트 인가 미구현 | NOT_IMPLEMENTED_FOR_LIVE |
| E10 | 실제 응답의 출처·캐시/삭제·NO_DATA/STALE | 오프라인 형식검사만, sourceAuthenticated=false | NOT_IMPLEMENTED_FOR_LIVE |
| E11 | 최초 운영자 지정/정확한 호출 대상·총 요청 수·쿼터/중단/폐기 및 명시 승인 | 미승인 | NOT_APPROVED |
| E12 | 보안·개인정보·비용·배포 최종 검수 | 미승인 | POLICY_HOLD |

**중요:** 위 E01~E12는 기존 *댓글 수집* 프로젝트 정본의 항목이다. 영상·채널 제목만 읽는 별도 **메타데이터 전용 정책 게이트**는 추후 분리 설계가 필요하다. 메타데이터 게이트를 만들었다고 기존 댓글/감성 정책의 상태를 일반적으로 해제해서는 안 된다.

## 4. 운영자가 준비할 읽기 전용 증거 (이번 PR은 실행하지 않음)

기존 읽기 전용 도구(별도 frontend 스택에 존재):
shared/contracts/yu32-youtube-readiness-v0/scripts/g45-l8-cloud-metadata-preflight.ps1

운영자 Windows PC에 정식 Google Cloud CLI가 설치되고, 사전에 승인된 계정이 인증된 경우에만 운영자가 **직접** 그 도구의 -Inspect를 실행해 프로젝트 접근 가능 여부와 YouTube Data API 활성 상태를 관찰할 수 있다. -Check는 로그인·Cloud API 조회 없이 로컬 점검만 한다. -Inspect는 Google Cloud 인증 캐시를 사용할 수 있으므로 시스템 전체 인증 데이터 읽기가 0건이라고 주장하지 않는다.

검수에 필요한 최소 비밀 제외 체크:
1. 같은 프로젝트에 대한 소유권/IAM 담당자와 서버 실행 주체의 권한을 독립 검토한다.
2. YouTube Data API v3 서비스 활성화가 실제 그 프로젝트에서 관찰되는지 확인한다.
3. 기존 API 키가 해당 API로 제한되고, 외부 **공인 서버 IP/egress**가 앱 제한과 일치하는지 확인한다. Google Cloud는 API 제한과 애플리케이션 제한을 별개로 취급한다. localhost/사설 IP는 서버 키의 외부 IP 제한 증거가 아니다.
4. Quotas & System Limits에서 일일 상한·현재 사용량·잔여량을 확인한다. 기본 quota 값은 프로젝트의 실제 사용 가능 잔여량이 아니다.
5. Secret Manager/Windows DPAPI 후보 보관소, API 키 회전·실패·노출 대응·출구 IP 변경 대응을 검토하되, 키 문자열·개인정보·토큰·계정 이메일을 GitHub/채팅/PR에 게시하지 않는다.
6. 메타데이터의 정당한 이용, YouTube 이용약관/표시·캐시 갱신/삭제·실수집과의 목적 분리를 승인 담당자와 독립 검토한다.

본 PR에서는 Google Cloud 프로젝트, 기존 인증/키, 서비스, IP 제한, Quota, 비용, IAM, API 활성화 여부를 변경하지 않으며 **실제로 확인하지도 않았다**. 따라서 어느 항목도 VERIFIED로 바꾸지 않는다.

공식 참고:
- https://developers.google.com/youtube/data/reference/rest/v3/videos/list
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/determine_quota_cost
- https://docs.cloud.google.com/docs/authentication/api-keys

## 5. CI 검증 범위와 후속 게이트

- New MockMvc test: MetadataOfflineBoundarySecurityTest — profile/property/USER/ADMIN/anonymous, unauthenticated role spoofing, fixed 503, no-store, POST CSRF, no leaked provider data.
- Existing Java bridge test: OfflineMetadataBridgeContractTest — shape/canonical IDs, HTTPS image host allowlist, no authenticating fixture data.
- New CI checks no metadata outbound transport/credential read and runs both targeted JUnit suites. Existing backend admin-security CI and isolated disposable PostgreSQL+Redis CI must remain green.
- Java CI/MockMvc tests prove only synthetically enabled boundary behavior. They do NOT verify real Cloud access, production credentials/IP, runtime egress, quota reservation, real API responses or retention.
- Future separate PR: choose production backend baseline & strict server-only secrets path, durable quota journal, fixed-host HTTPS, measured egress, provider provenance, cache/erasure and tenant isolation; only after official approval enable live metadata reads and consumer UI enrichment.
- PR remains Draft/unmerged. No backend deploy, live YouTube calls, Cloud changes, or existing policy gate release authorized.
