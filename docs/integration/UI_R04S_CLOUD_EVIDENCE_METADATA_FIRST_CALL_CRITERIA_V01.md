# UI-R04-S — YouTube 메타데이터 전용 Cloud 증거 검수 및 첫 실조회 승인 기준 v0.1

기준: 2026-11-05 KST | 백엔드 부모: Draft PR #82 @ 136734c199e949a280a707a40563b4b56d7a8980

## 1. 제품 목적과 이번 승인 경계

YOUTOPIA에서 VIDEO URL을 추가하면 실제 YouTube 영상 제목과 썸네일, 채널 이름과 프로필 사진이 자동으로 나오는 것이 최종 목표다. 수동 제목은 보조 별칭으로만 유지한다.

**이 PR에서는 API 호출을 실행하지 않는다.** 기존 Spring Boot 4.0.9 / Java 21 백엔드의 테스트 전용 deny 경계(PR #82)와 오프라인 형식검사(PR #81), Node 오프라인 메타데이터 수명주기(PR #79·80)를 그대로 유지한다.

신규:
- tools/ui-r04s-metadata-cloud-evidence.ps1 — 명시적인 운영자 명령으로만 Cloud 프로젝트 ACTIVE 및 YouTube Data API 활성화를 읽는 **비밀 제외 로컬 관찰기**.
- MetadataApprovalPreflight.java — 증거 문서 참조의 **완비 여부**만 검사. 모든 응답에서 firstLiveMetadataReadAuthorized=false, commentOrSentimentReadAuthorized=false.
- MetadataApprovalPreflightTest.java + Java 21/PowerShell Check-only CI.
- 다음 단계의 명시적 승인 조건과 운영자 증거 수집 절차.

**미포함:** Google Cloud IAM/키/Quota의 실제 독립 실사, Google Cloud CLI 로그인/설정 변경, 실제 YouTube Metadata API 요청, 외부 이미지 CDN 변경, 운영용 Secret Manager/Windows DPAPI 접근, 서버 운영 조회 엔드포인트, 병합, 배포.

## 2. 독립 실사에 필요한 메타데이터 전용 증거 10개

아래 문서는 **메타데이터 전용** 검수 계획이다. 기존 댓글 수집·분석 G45 E01~E12의 정본 상태를 자동으로 바꾸지 않는다.

| 항목 | 독립 검수해야 하는 증거 | 이번 저장소 기준 |
|---|---|---|
| M01 | 동일 Google Cloud 프로젝트의 소유 책임, IAM 운영자/서버 실행자 | UNVERIFIED |
| M02 | 정확히 그 프로젝트에서 YouTube Data API v3 ENABLED 상태 | UNVERIFIED |
| M03 | 서버 전용 API 키가 YouTube API 서비스만 사용하도록 제한됨 | UNVERIFIED |
| M04 | 서버의 실제 **외부 공인 출구 IP**와 키의 앱 제한이 일치함 | UNVERIFIED |
| M05 | 해당 프로젝트의 **현재** 일일 한도, 사용량, 잔여량 및 최초 호출 최대 비용 | UNVERIFIED |
| M06 | 영상·채널 제목/이미지 저장·표시 목적과 Developer Policies 검토 | POLICY_HOLD |
| M07 | 서버의 안전한 키 저장·권한 분리, 회전/유출·로그 마스킹 | UNVERIFIED |
| M08 | 실제 서버의 원자적 호출/쿼터 원장, 테넌트 권한, 반복·경합 제어 | NOT_IMPLEMENTED |
| M09 | 실제 HTTPS 제공자 출처 신뢰·캐시 갱신/삭제·에러 경계 | NOT_IMPLEMENTED |
| M10 | 실제 **최초 메타데이터 조회 1회**의 운영자·정확한 대상·요청/쿼터 상한·중단·폐기 기준과 별도 사용자 승인 | NOT_APPROVED |

- 공식 Google 자료: https://developers.google.com/youtube/data/reference/rest/v3/videos/list , https://developers.google.com/youtube/data/reference/rest/v3/channels/list , https://developers.google.com/youtube/data/determine_quota_cost , https://docs.cloud.google.com/docs/authentication/api-keys
- videos.list, channels.list는 문서상 각 호출 1 quota unit이다. 이것은 실제 Cloud 프로젝트에 남아 있는 잔여량이나 이미 승인된 비용 예산이 아니다.
- API key는 API 서비스 제한과 애플리케이션 제한(서버의 외부 공인 IP)을 각각 확인해야 한다. localhost/사설 IP는 키의 서버 외부 IP 제한 증거가 아니다.

## 3. 안전한 Windows 운영자 관찰 절차 (실행은 사용자가 결정)

운영자가 **이미 설치된 정식 Google Cloud CLI의 출처와 PATH 경로를 별도로 확인**하고, 기존 권한 있는 계정을 사용하는 경우에만 실행한다. PowerShell 7 권장.

프로젝트 ID와 인증/Cloud 정보는 채팅이나 PR에 복사하지 말아야 한다. 비밀 키/토큰/계정 이메일/현재 공인 IP/Cloud 오류 원문도 공유하지 않는다. 프로젝트를 생성하거나 서비스·키·IAM·쿼터 설정을 변경하지 않는다.

### 3.1 Cloud에 접속하지 않는 오프라인 점검

~~~powershell
cd C:\Projects\YOUTOPIA-R04S-QA
pwsh -NoProfile -File .\tools\ui-r04s-metadata-cloud-evidence.ps1 -Check
~~~

예상 결과(변동 가능한 필드 생략): status=CHECK_ONLY_NO_CLOUD_ACCESS, gcloudInvoked=false, metadataReadAuthorized=false, actualYouTubeApiRequestsMade=0. CI에서 실행하는 것은 이것뿐이다.

### 3.2 운영자의 명시적 로컬 Cloud 조회

~~~powershell
# 프로젝트 ID와 명령줄이 로컬 프로세스 기록/Cloud CLI 로그에 남을 수 있다.
# 실제 Cloud Inspect 실행은 별도 운영자 의사결정이다.
$projectId = Read-Host '기존 Google Cloud 프로젝트 ID (대화·PR에 공유하지 않음)'
pwsh -NoProfile -File .\tools\ui-r04s-metadata-cloud-evidence.ps1 -Inspect -ProjectId $projectId
Remove-Variable projectId -ErrorAction SilentlyContinue
~~~

- 실제로 실행되는 Google Cloud CLI 읽기 명령은 projects describe 및 services list --enabled **두 개만** 허용. YouTube Data API videos.list/channels.list/댓글 조회는 호출하지 않는다.
- 출력은 프로젝트 ID/계정/키 ID 또는 값/토큰/IP/원시 에러 내용을 포함하지 않는다. 프로젝트 접근 가능성과 youtube.googleapis.com 서비스 ENABLED 여부만 확인한다.
- -Inspect 자체는 기존 gcloud OAuth 인증 자료 및 로컬 인증 캐시/로그를 사용할 수 있다. **이 스크립트가 API 키를 직접 읽지는 않는다**는 사실과 **CLI의 기존 인증 사용 가능성**을 반드시 구분한다.
- 접근 가능함은 소유권 M01의 독립 검증이 아니다. ENABLED 관찰도 별도 검토 없이 M02 VERIFIED가 아니다.
- 오류/CLI 미설치/형식 불일치 시 status=LOCAL_CLOUD_EVIDENCE_UNAVAILABLE, 종료 코드 3. 원시 stderr는 표출하지 않는다.
- 실제 실행 결과를 나중에 공유하더라도 비밀 제외 JSON의 status, projectAccessibleToLocalIdentity, youtubeDataApiEnabledLocallyObserved 정도만 공유하고, 식별정보는 전달하지 않는다.

### 3.3 별도 Cloud Console 독립 검수

1. 동일 프로젝트의 IAM 책임자·현재 프로젝트 상태 확인(인증된 관리자와 별도 검토자 대조).
2. APIs & Services의 Enabled Services에서 YouTube Data API v3 활성화 확인.
3. Credentials에서 **키 원문을 노출하지 않은 상태로** 키의 YouTube 서비스 API 제한 및 외부 서버 IP의 앱 제한 검수.
4. Quotas & System Limits에서 같은 프로젝트의 현재 사용량/할당량/잔여량 검수. 기본 10,000 quota unit을 현재 잔여량으로 쓰지 않는다.
5. 서버 Secret Manager/Windows Vault 경로, 실제 외부 IP 발신 주체·키 회전, 유출 사고 대응, 사용 정책/캐시·삭제 요구를 검수.
6. 증거 파일과 정확한 프로젝트 범위, 검토자, 관찰 시각·유효기한을 **접근 제한된 내부 증거 보관소**에 저장하고, PR에는 비밀 제외 체크 결과만 기록한다.

## 4. Java 증거 참조 패키지 검사기의 역할

MetadataApprovalPreflight.assess는 M01~M10 항목별 SHA-256 레퍼런스의 형식, 중복, 발급·만료 시각, 최대 30일 유효기간을 검사한다. 패키지가 완비되더라도 상태는 **REFERENCE_SET_COMPLETE_INDEPENDENT_REVIEW_REQUIRED**로 끝난다.

**이 검사는 증거를 실제로 읽지 않고, 서명자/IAM/프로젝트 출처를 인증하지 않는다.** 임의 해시 또는 자체 보고 사실만으로 사람의 최종 검토를 대신할 수 없다. 확인되지 않은 참조를 VALIDATED / APPROVED / liveCallsAuthorized 등으로 승격하는 메서드는 없다. 현재 단계에서 모든 반환은:
- referencesIndependentlyVerified=false
- credentialRestrictionsVerified=false, quotaVerified=false, providerOriginVerified=false
- firstLiveMetadataReadAuthorized=false, commentOrSentimentReadAuthorized=false
- actualYouTubeRequests=0
- policy=POLICY_HOLD

미완성·만료·중복·허위 레퍼런스는 INVALID_REFERENCE_PACKAGE 또는 REFERENCES_MISSING_NOT_AUTHORIZED로 차단한다. 이 검사기는 운영 정책 승인 엔진도 아니며 현재 구동 중인 서비스에 Bean/Controller로 연결하지 않는다.

## 5. 다음 별도 PR과 사용자 승인 조건

M01~M10을 독립 검토한 이후에도 다음 요소가 실제 구현되어야 한다.

- **Metadata-only** 서버 권한/토큰 읽기·고정 HTTPS 호스트·timeout/크기/redirect 금지·쿼터 원자적 원장·오류/갱신/삭제·provenance 검증.
- 정확한 1개 VIDEO 또는 CHANNEL 조회 대상, 운영자, 시각, API 호출 횟수 최대치(처음에는 1), 예상 quota, 재시도 0, 롤백/삭제 계획이 포함된 **최초 실호출 실행계약**.
- 기존 댓글 수집·감성 지표 정책 게이트와 완전히 분리된 메타데이터 전용 승인 규칙. 기존 POLICY_HOLD를 일괄 해제해서는 안 된다.
- 위 계약을 독립 검수하고 사용자가 **실 YouTube 메타데이터 API 첫 읽기**를 명시적으로 승인한 뒤에만 별도 기능에서 실제 요청을 실행할 수 있다.
- 성공 후 승인된 서버 응답만 프런트의 공식 제목/채널 이미지로 연결하고, 수동 별칭·오류 안내와 명확히 분리한다.
- 배포 및 PR 병합도 각각 별도 승인 대상으로 유지한다.

**현재 판정: OFFLINE_EVIDENCE_TOOLING_READY / CLOUD_OPERATING_EVIDENCE_UNVERIFIED / METADATA_LIVE_CALL_NOT_AUTHORIZED / USER_AUTO_TITLE_NOT_YET_ENABLED.**
