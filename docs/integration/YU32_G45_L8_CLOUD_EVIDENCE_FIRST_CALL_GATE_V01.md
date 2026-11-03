# YOUTOPIA — G45-L8 Google Cloud 실수집 증거 사전검증 v0.1

> 기준: 2026-11-03 KST
> 베이스: `frontend@0284b446cb2554baacb8f365f5aab3bf939f76b8`
> 기능: `g45-l8-cloud-metadata-preflight.ps1` — Windows에서 명시적으로 호출하는 **읽기 전용 Cloud 메타데이터 관찰**
> 상태: `LOCAL_EVIDENCE_OBSERVATION_ONLY / POLICY_HOLD / VERIFIED_0_OF_12 / LIVE_YOUTUBE_0`

## 1. 이번 단계의 실질적 목적

G45-L7에서 실제 YouTube `commentThreads.list` 전송 코드는 만들었지만 `RELEASED_FOR_FIRST_REAL_CALL=false`로 차단했다. 이번 G45-L8은 이 실행 잠금을 제거하는 작업이 **아니다**. 먼저 프로젝트/서비스 상태를 확인하는 실증 절차를 운영자가 Windows 로컬에서 실행할 수 있도록 제공한다.

첫 실수집 후보는 **공개 VIDEO ID 1개, 첫 페이지, `maxResults` 최대 100, 자동 재시도 0, 추가 페이지/답글 수집 없음**으로 유지한다. Google 문서상 `commentThreads.list`는 요청당 1 quota unit이다. 실패·잘못된 요청도 quota를 소모할 수 있으며, 실제 프로젝트별 잔여량은 아직 확인되지 않았다.

## 2. Windows 로컬 읽기 전용 검사

새 파일: `shared/contracts/yu32-youtube-readiness-v0/scripts/g45-l8-cloud-metadata-preflight.ps1`.

- 기본 `-Check` 모드는 **gcloud를 실행하지 않고** 준비 상태 JSON만 출력한다. CI에서도 이 모드만 실행한다. `cloudCommandInvoked=false`는 이 스크립트가 Cloud CLI를 실행하지 않았음을 뜻하며, `-Inspect`에서 실행 전에 CLI 검색이 실패해도 동일하게 정확한 값을 출력한다.
- 명시적 `-Inspect -ProjectId <기존 프로젝트 ID>` 모드는 **소유자가 지정한 기존 프로젝트**에서 두 개의 읽기 전용 명령만 사용한다.
  - `gcloud projects describe`: 지정 프로젝트와 ACTIVE 여부의 로컬 조회
  - `gcloud services list --enabled`: 동일 프로젝트에서 `youtube.googleapis.com` 서비스가 활성화된 것으로 관찰되는지 확인
- 결과 JSON은 프로젝트 ID, 계정 이메일, 액세스 토큰, API 키/키 식별자, 공인 IP, 원시 CLI stderr, API 응답 본문을 포함하지 않는다. 대신 `apiKeyMaterialReadByThisScript=false`(스크립트 자체는 키를 조회하지 않음), `cloudCliMayUseExistingAuthentication`(기존 gcloud OAuth 인증 사용 가능성)을 별도로 명시한다.
- 스크립트 자체는 프로젝트/계정 변경, 신규 로그인, API 키 생성·조회, 서비스 활성화, Quota 수정, YouTube 댓글 요청, 별도 파일/DB 기록을 **수행하지 않는다**. 그러나 **gcloud CLI 자체는 기존 OAuth 인증을 사용하며 로컬 로그·인증 캐시 파일을 생성하거나 갱신할 수 있다.** 따라서 '시스템 전체에서 자격증명 읽기 0건 또는 파일 기록 0건'으로 주장하지 않는다.
- `projectReachableLocally=true`는 **로컬에 설정된 계정의 접근**만 뜻하며, 소유권 E01의 독립 증거가 아니다. `youtubeDataApiEnabledObserved=true`도 E02를 자동으로 VERIFIED로 만들지 않는다. 활성 서비스 응답은 배열로 검증하고 각 서비스에 `state=ENABLED`가 명시된 경우만 인정한다. 빈 배열은 정상적으로 '활성화 관찰 없음'으로 처리한다.
- 명령 인자의 프로젝트 ID는 로컬 프로세스 목록이나 gcloud 내부 로그에 나타날 수 있다. 출력 결과를 복사할 때 원본 명령줄·계정정보·보안 화면은 제외한다. `Get-Command gcloud`는 PATH의 실행 파일을 찾을 뿐 정품·서명을 인증하지 않으므로, **운영자가 공식 Google Cloud CLI의 설치 경로와 출처를 자체 확인해야 한다**.

## 3. 소유자 작업 순서 — 데이터/비밀값을 대화에 붙여넣지 말 것

공식 Google Cloud CLI가 설치되고 **기존 권한 있는 계정**이 사용 가능해야 한다. 이 도구는 인증/프로젝트 설정을 변경하지 않는다. `frontend` 최신 동기화 뒤 PowerShell에서 다음처럼 실행한다.

```powershell
$projectId = Read-Host '기존 Google Cloud 프로젝트 ID (대화에 게시하지 않음)'
$script = '.\shared\contracts\yu32-youtube-readiness-v0\scripts\g45-l8-cloud-metadata-preflight.ps1'
& $script -Check
& $script -Inspect -ProjectId $projectId
Remove-Variable projectId -ErrorAction SilentlyContinue
```

반환되는 **비밀 제외 JSON**의 `status`, `projectReachableLocally` 및 `youtubeDataApiEnabledObserved`만 검토한다. `LOCAL_METADATA_UNAVAILABLE`/종료 코드 3은 실제 계정/프로젝트/CLI 문제일 수 있으나, 원본 오류·프로젝트 ID·토큰을 PR이나 채팅에 올리지 않는다.

그다음 해당 Google Cloud Console의 **동일 프로젝트**에서 IAM 책임자와 API 활성화 상태를 확인하고, `APIs & Services → Credentials`의 기존 키 API 제한·외부 IP 허용 및 `Quotas & System Limits`의 **실제 현재 잔여량**을 확인한다. 사용 가능한 키가 없더라도 이번 승인으로 새 키를 발급하지 않는다. 소유자가 제한된 증거 보관소에서 메타데이터를 관리하고 독립 검토자가 대조해야 한다.

## 4. 실수집 전 필수 Gate

| ID | 검증할 실제 사실 | 이번 도구의 한계 |
|---|---|---|
| E01 | 프로젝트 식별/소유 책임자·실행 권한 및 동일 프로젝트 여부 | 프로젝트 조회 가능 여부만 관찰 |
| E02 | YouTube Data API v3 활성화·공식 지원 인증 방식 | 서비스 활성화 여부를 로컬 관찰 |
| E03 | 기존 키의 YouTube API 제한, 서버 출구 IP 제한 및 실제 IP 일치, OS 보호 저장/회전/URL 로깅 방지 | 자동 검증하지 않음 |
| E04 | 프로젝트 Quota 일일 한도/현재 잔여량·최초 1회 호출 예산 | 자동 검증하지 않음 |
| E05 | YouTube Developer Policies·고지/수집 목적·동의/표시 적합성 | 독립 정책 검토 필요 |
| E07/E08 | 첫 1회 수집의 메모리/로그/오류/캐시/백업 잔존과 삭제·철회 요청 처리 | 기존 합성 시험은 운영 E2E 증거가 아님 |
| E11 | 정확한 VIDEO ID 1개, 실행자, 시점, 요청·Quota 상한, 원문 폐기와 **별도 명시 승인** | 이번 PR에서 절대 승인하지 않음 |
| E06 | 실제 댓글 감성·주제 분석/파생 지표의 허용·승인 범위 | 별도 사용 승인 확인 전 실행 불가 |

**사용자의 이번 G45-L8 착수 승인은 API 키 발급, Google Cloud 프로젝트 설정 변경, 실제 YouTube 요청, 운영 데이터 삭제·배포·과금의 승인이 아니다.** 현재 정본 `policy-gates.json`의 `POLICY_HOLD / verifiedCount=0 / liveCallsAuthorized=false`는 유지한다.

## 5. 실제 실수집 직전의 남은 최소 작업

1. 첫 댓글 수집에 사용할 프로젝트 증거 E01~E05와 폐기/요청 경계 E07/E08을 독립 검토한다. **실행을 위한 E11은 별도 1회 승인**을 받는다.
2. 비밀을 출력하지 않는 Windows 서버 전용 credential reader, 실제 출구 IP 대조, 프로젝트 키 제한, 서비스/키/실행자 연결을 검증한다.
3. 프로세스 재시작·병렬 실행에서도 한 번만 사용할 수 있는 **지속형 원자적 호출 원장**, 1회 예산 및 실패 시 자동 재시도 금지를 설계·검수한다. G45-L7의 프로세스 내부 플래그만으로는 충분하지 않다.
4. 원문 영속 저장 0, 오류·프록시 URL의 키 노출 방지, 요청 후 메모리 폐기, 저널/로그 최소화에 대한 보안 시험을 마친다.
5. 이후 별도 PR에서만 `RELEASED_FOR_FIRST_REAL_CALL=false`와 정본 정책의 실제 실행 상태 변경을 검토한다. 증거·명시 승인을 만족하기 전에는 잠금을 해제하지 않는다.

CI는 새 Windows Job에서 **`-Check`만 실행**한다. Cloud 계정에 로그인하지 않고 Google API·YouTube API 호출은 발생하지 않는다. 사용자 로컬의 `-Inspect`는 별도의 명시적 실행이 필요한 Cloud 메타데이터 읽기이며, YouTube 댓글 API 호출은 아니다.

## 6. 공식 근거

- https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
- https://developers.google.com/youtube/data/determine_quota_cost
- https://docs.cloud.google.com/sdk/gcloud/reference/services/list
- https://docs.cloud.google.com/docs/authentication/api-keys
- https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys
- https://developers.google.com/youtube/terms/developer-policies

**판정: G45_L8_LOCAL_CLOUD_METADATA_PRECHECK_ONLY / FIRST_LIVE_CALL_NOT_AUTHORIZED.**

## 7. PR #55 독립 코드·보안 검수 보완 (2026-11-03)

- **P1 인증 사용 표기:** 기존 `credentialsReadByThisScript=0`은 `gcloud`가 내부적으로 기존 OAuth 토큰을 읽는 사실과 혼동될 수 있다. 새 필드는 직접 API 키 데이터 조회 여부와 CLI의 기존 인증 사용 가능성을 분리하며, Cloud CLI 로그·캐시 가능성을 안내한다.
- **P2 실행 관측 정확성:** 실제 `gcloud` 명령 호출 직전까지 `cloudCommandInvoked=false`를 유지한다. 실행 파일을 찾지 못한 실패도 '명령 실행됨'이라고 보고하지 않는다.
- **P2 JSON 배열 처리:** `ConvertFrom-Json -NoEnumerate` 및 배열 타입 검증, `state=ENABLED` 조건을 추가했다. 빈 목록은 'YouTube API 활성화 관찰 없음'으로 처리하고 이상한 형식은 실패 처리한다.
- **잔여 미검증:** CI는 `-Check`만 실제 실행한다. `-Inspect`의 운영 gcloud 실제 출력 및 키·Quota·소유/개인정보 정책은 로컬 운영자/독립 검증 전까지 미확인으로 유지한다. 어떤 테스트도 실제 Google Cloud·YouTube 데이터를 조회하지 않는다.
