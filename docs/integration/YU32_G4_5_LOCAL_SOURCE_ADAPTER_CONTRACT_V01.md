# YOUTOPIA — G4-5 Windows 로컬 YouTube 소스 Adapter 준비 v0.1

> **상태:** DESCRIPTOR_IMPLEMENTED / REAL_HTTP_TRANSPORT_NOT_IMPLEMENTED / LIVE_API=0 / POLICY_HOLD
> **기준:** `frontend@6cce815ef6bb6f32f5733bd0a11fe46815e8d4ee` + G45 합성 파이프라인 [PR #48](https://github.com/Choi1999/YOUTOPIA/pull/48)
> **공식 명세:** [commentThreads.list](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list) · [API 키 보안](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices) · [개발자 정책](https://developers.google.com/youtube/terms/developer-policies)

## 1. 실제 수집기 준비의 가장 작은 단계

기존 [PR #48](https://github.com/Choi1999/YOUTOPIA/pull/48)의 합성 데이터 파이프라인을 보존하고, 그 앞단의 **향후 YouTube 요청 구조·에러 매핑·자격증명 경계만** 추가한다. 현재 수집 HTTP 클라이언트, API 키, 외부 IP 탐지, OAuth, 실제 댓글·작성자 데이터, 수집 원문 영속 저장, NLP 감성 모델, 인프라 배포를 만들지 않는다.

| 단계 | 현재 구현 | 실제 수집 직전 미충족 사항 |
|---|---|---|
| 요청 Descriptor | 정규 VIDEO ID 1~3, 페이지당 최대 100, `GET /youtube/v3/commentThreads` + 고정 Query | 서버 전용 HTTP 클라이언트 구현·실제 URL 고정/HTTPS 인증 |
| Quota 범위 | 계획당 최대 3요청·3 quota units, 자동 재시도 0 | 실제 프로젝트 Quota/사용량·호출 총수·중단·과금 확인 |
| API 키 | `x-goog-api-key` 헤더 **이름만** 명시. 실제 값·.env·GitHub 코드 없음 | Windows Credential Manager 등 OS 보호 저장소, YouTube API 제한, 호출 PC 외부 공인 IP 제한과 회전 절차 |
| 외부 IP | 사전 검사 항목만 존재; 값을 읽거나 외부로 전송하지 않음 | 키 제한 목록과 실제 출구 IP 일치/변동 정책 검증 |
| 오류 분류 | 진단성 403 `commentsDisabled`, `quotaExceeded`, `forbidden`, 404 `videoNotFound` 등의 상태/코드 정의 | 실제 Google 오류 JSON 구조/상세 코드·로깅 마스킹 검증 |
| 개인정보 | 소스에서 어떤 데이터를 수집할지 계획만; 입력 데이터 0 | 메모리/로그/캐시/DB/백업의 댓글 원문·작성자 수명주기 및 삭제 전파 |
| 감성·주제 분석 | 합성 QA 규칙만 기존 파이프라인에서 동작 | 실제 사용 사례 약관·파생 지표 승인 및 별도 평가된 모델 |
| 서비스 | 공개 API/Chrome 호출 경로 없음 | Spring ADMIN/tenant/CSRF/Job/Outbox 및 운영 접근권한 실증 |

공식 \`commentThreads.list\` 명세에는 요청당 1 quota unit, `maxResults 1~100`, 기본값이 `20`, `part=snippet`, `videoId`, `order=time`, `textFormat=plainText`, `nextPageToken`이 기재돼 있다. **요청 Descriptor가 1~3건을 계획한다는 것과 실제 API에 접근할 권리가 있다는 것은 서로 다르다.** 100개는 최대 스레드 결과 수이며 전체 댓글이나 전수 대댓글을 뜻하지 않는다.

## 2. 테스트 경계와 분리 검증

`descriptors` — 오프라인 요청 형태만 생성하고 `actualExternalRequests=0`, `quotaUnitsConsumed=0`, `liveCollectionAuthorized=false`, `networkTransportEnabled=false` 강제.

`assessOperatorEvidence` — 프로젝트/키·IP/보존/정책/첫 실호출 승인 여부를 **부울형 보고값으로 접수할 수는 있으나** 그 값이 모두 참이어도 독립 증거 검증 상태와 수집 허용값은 항상 거부. 승인 정책은 클라이언트 파라미터로 격상하지 못함.

`classifyOfflineProviderError` — **합성 진단 코드만** 다룸. API Error 내용/댓글/키/사용자 식별자는 받지 않으며 오류를 빈 수집·가짜 0%로 변환하지 않는다. YouTube의 서버 응답을 실제로 받거나 분류한 증거가 아님.

`tests/local-source-adapter.test.cjs` — 22개 검증: 호출 수/Quota, 중복 ID, 과도한 페이지, 모르는 옵션 및 승인 위조, API 키·IP 값 입력 거부, 첫 페이지만, 오류별 NO_DATA 구별, 정적 no-network/no-secret 경계, 기존 합성 Snapshot과 호환.

## 3. Windows 실행

~~~powershell
cd C:\Projects\YOUTOPIA
$root = "shared/experiments/yu32-g45-offline-pipeline-v0"
node --check "$root/src/local-source-adapter.cjs"
node --test "$root/tests/local-source-adapter.test.cjs"
node --test "$root/tests"
~~~

**주의:** 로컬 측 키/프로젝트/공인 IP 실제 값을 이 도구에 넘기지 않는다. 이 모듈은 CLI를 제공하지 않고 기능을 활성화하지 않는다. PR #48 70개 합성 시험 + 신규 22개가 동일 CI 단계에서 실행될 수 있어야 한다.

## 4. 외부 승인 전 필수 게이트

- [G4-5 준비 PR #47](https://github.com/Choi1999/YOUTOPIA/pull/47)의 `Y45-E01~E12`에서 실제 수집에 필수 항목의 사용자 보고/독립 증거를 프로젝트별로 분리 확인.
- YouTube 댓글·영상 메타데이터의 기한 내 갱신/삭제, 사용자 데이터 요청 처리(가능한 빠르게, 정책상 7일 이내), 제공자 삭제/철회 및 캐시 무효화.
- 관리자 삭제 Spring 보안 테스트는 별도 [PR #49](https://github.com/Choi1999/YOUTOPIA/pull/49), 원문 관리·삭제·복구 fence는 운영 저장소 적용 전 별도 검증.
- 첫 실제 대상 VIDEO ID, 호출 시간, 상한/오류 시 중단, 비용 및 데이터 보존 정책을 사용자에게 명시하고 **최초 YouTube API 실호출을 새로 승인**받은 뒤에만 네트워크 코드를 추가/실행.
- 실제 댓글 감성·주제 지표는 YouTube 파생 지표 정책의 별도 사용 사례 승인/검증이 끝난 뒤만 수행.

**판정:** API 요청 계약/보안·에러 경계 정적 검증 단계, 실제 수집·분석 0건. 기존 PR #46~#49 자동 병합·운영 데이터 삭제·Google API 키 발급·Cloud 변경 없음.
