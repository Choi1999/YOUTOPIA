# YOUTOPIA — G45-L7 최초 실제 댓글 수집 우선 준비 v0.1

> **기준:** 2026-11-03 KST · `frontend@f6323ca85c17c9f546fb357a454c3c93f901b74a`
> **브랜치:** `feature/yu32-g45-l7-first-live-collection-readiness-v01` → PR base `frontend`
> **상태:** `LIVE_TRANSPORT_CODE_PRESENT_BUT_LOCKED / POLICY_HOLD / PROVIDER_REQUESTS_0 / REAL_COMMENTS_0 / DERIVED_METRICS_0`

## 1. 이번 전환의 목표

G45-L1~L6까지는 비실행 요청 설계, 합성 수명주기 및 격리 DB·Redis 테스트가 중심이었다. 이번 단계는 사용자가 우선순위 변경을 승인한 **첫 실제 공개 댓글 수집**을 가장 작은 범위로 구현 준비한다.

첫 실행 후보: `commentThreads.list`, VIDEO **1개**, `part=snippet`, `order=time`, `maxResults=100` 상한, `textFormat=plainText`, 첫 페이지 한 번, 자동 재시도 0, 예상 quota 1 unit. 다음 페이지 및 전체 답글 검색은 제외한다. 이는 전체 댓글 모집단을 대표하지 않는 표본이다. API 키 `key` 쿼리 파라미터 또는 OAuth Bearer가 공식 지원 방식이며, 이번 준비 코드는 **제한된 서버용 API 키 전용 후보**다.

**실제 YouTube 호출은 여전히 0건.** GitHub Actions와 테스트는 자격증명·Cloud 프로젝트·YouTube 서버를 호출하지 않는다.

## 2. 실제 코드 변경

신규 `src/first-page-provider-transport.cjs`:

- **작동하는 HTTPS 전송 구현 자체**는 작성한다. 호스트와 경로를 `www.googleapis.com:443 /youtube/v3/commentThreads`로 고정하고, GET·첫 페이지·타임아웃 5초·응답 512 KiB 제한·리다이렉트 없음·자동 재시도 0·응답 MIME 검증을 구현한다.
- 인증 키는 전송 전에 **나중에 승인된 서버측 credential reader**로부터 일회성 전달받는 구조로 작성한다. 키 또는 요청 URL·오류 응답 본문을 기록하거나 반환하지 않는다. `key` 쿼리 특성상 운영 프록시/서버/트레이싱에서 URL이 노출되지 않는지 별도 점검 필요.
- API 응답 본문에서 영상 스코프, 상한, thread/comment ID 중복, 댓글 본문 길이·일시·페이지 크기를 검증한다. **author ID/이름/프로필/etag/nextPageToken을 결과에서 제외**한다.
- 텍스트는 현재 **함수 반환값의 메모리 데이터**로만 존재하며 파일·DB·Redis·브라우저 캐시·로그에 저장되지 않는다. 이 반환값은 감성 분석기로 전달되지 않는다.
- `decodeFirstPageShape`는 임의 JSON의 **형식만** 확인하므로 결과에 `sourceAuthenticated:false`를 표기한다. 실제 TLS 출처 인증을 수행한 결과라고 단정하지 않는다.
- 향후 승인된 호출만 `sourceAuthenticated:true`로 반환할 수 있도록 성공 경로 코드를 작성하지만, **현재 `RELEASED_FOR_FIRST_REAL_CALL=false`**로 컴파일 시점부터 고정된 차단을 유지한다. 나중에 `policy-gates.json`을 바꾸거나 호출자가 `approved:true`를 주더라도 이번 브랜치만으로 실호출 불가.

**변경하지 않는 부분:** 기존 `first-call-http-boundary.cjs`의 무조건 거부 `executeLiveFirstCall()`, 합성 파이프라인의 세 가지 묶음 Fixture 전용 권한 경계, `policy-gates.json`, Spring 운영 백엔드/삭제 API/DB, 사용자 화면. 별도의 실호출 실행 스크립트·HTTP endpoint도 추가하지 않는다.

## 3. 출처·최소 보존·분석 경계

- 첫 실수집은 서버에서만 실행하고 **0건의 영속 원문 저장**을 기본으로 한다. 필요한 경우 메모리 분석/조회와 폐기 흐름의 보안 검수를 선행한다. 코드의 `rawTextPersisted:false`는 이 모듈에 파일·DB 쓰기가 없다는 뜻이며 호출자의 이후 저장까지 보증하지 않는다.
- 댓글 내용은 외부 API Data이므로 별도의 E07/E08 폐기·사용자 요청 처리 설계가 없으면 실호출을 해서는 안 된다. 일반적으로 비인증 API Data는 필요한 기간만 사용하고 30일 이내 삭제 또는 갱신; 사용자 정보 삭제 요청은 7일 이내 처리 규정을 검토한다.
- `Viewer Sentiment Analysis`는 YouTube가 조건부 허용 예시로 명시했으나 **YOUTOPIA 프로젝트에 적용되는 개정 정책 수락/신청·감사 여부를 검증하기 전까지 분석 실행을 허용하지 않는다**.
- 결과의 `sampleCount`는 **받은 첫 페이지 항목 수**이며 영상 전체 댓글 수, 모집단 비율 또는 감성 점수가 아니다. `nextPageAvailable`은 다음 페이지 존재 여부일 뿐 자동 후속 요청을 허용하지 않는다.
- 요청이 완료되지 않은 경우 임의 0/NO_DATA로 조작하지 않으며, 오류 응답 본문·키·URL을 로그로 복사하지 않는다.

## 4. 실수집을 가능하게 하는 외부 조건 — 현재 모두 미충족

| Gate | 현재 상태 | 실제 수집을 위해 필요한 실증 |
|---|---|---|
| E01 | UNVERIFIED | 프로젝트 소유/관리 책임자 및 범위 |
| E02 | UNVERIFIED | 같은 Google Cloud 프로젝트의 YouTube Data API v3 활성화 |
| E03 | UNVERIFIED | API 제한·IP 제한·비밀 저장소·로그 비노출 및 실제 출구 IP |
| E04 | UNVERIFIED | 실제 남은 quota / 첫 VIDEO 1건 / 실패 예산 |
| E05 | POLICY_HOLD | 공개 댓글 조회 목적과 YouTube 이용약관·Developer Policies 적합성 |
| E07/E08 | NOT_IMPLEMENTED | 첫 1회성 인메모리 처리·폐기, 요청/철회·복제/로그 관리를 포함한 안전한 데이터 수명주기 검수 |
| E11 | NOT_APPROVED | 정확한 VIDEO ID, 실행자, 시점, 요청/Quota 상한, 중단/폐기 및 사용자 별도 명시 승인 |
| E06 | POLICY_HOLD | 실제 감성·주제 분석에 대한 별도 파생 지표 신청/승인·개정 정책 조건 |

공개 댓글 **조회**를 위해 반드시 모든 운영 서비스(E09/E10/E12)와 감성 분석 승인(E06)을 동시에 완료해야 하는 것은 아니다. 그러나 운영 확장 프로그램/분석 서비스로 공개 출시할 때는 이들 Gate를 별도 통과해야 한다.

## 5. 다음 순서 — 실수집을 앞당기는 최소 작업

1. **이번 G45-L7 PR:** 실 API 응답 구조 디코더·고정 HTTPS 전송·민감정보 제거·엄격한 단발 예산과 테스트를 준비하되 실행 차단. 코드 독립 리뷰/CI.
2. **G45-L8 증거 수령·실수집 Gate:** E01~E05/E07/E08/E11의 **실제 비밀 제외 증거**를 독립 검수하고, 안전한 서버 credential reader와 한 번만 실행하는 수동 명령을 **별도 보안 PR**로 구현. 정본 Gate 상태는 증거 검증 후에만 변경.
3. **첫 실제 댓글 조회:** 추가로 승인된 대상 VIDEO ID 1개에 대해 실제 `commentThreads.list` 1회 실행; 실패/통신 오류 시 자동 재시도·추가 페이지 없음. 사용 후 원문 폐기. 실제 호출 사실과 사용 quota를 기록하되 키/원문은 로그에서 제외.
4. **G45-L9 화면 연동:** 출처/표본 제한을 표시하고, 사용 조건 충족 범위에서 영상 데이터 조회 UI 연결. 분석이 허용되지 않은 경우 감성 점수는 `null`.
5. **G45-L10 AI 분석:** E06 조건 충족 이후 NLP 분류기·품질 평가 및 투명한 비공식 지표 표시. YOUTOPIA의 분석 결과를 YouTube가 제공한 데이터로 오인하게 하지 않는다.

현재 코드는 **개발 착수 승인**으로만 작성했다. 이번 승인으로 실호출, 키 생성, 소셜 데이터 영속 수집, 파생 분석, 배포, 결제, PR 병합은 실행하지 않는다.

## 6. 공식 근거

- https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
- https://developers.google.com/youtube/data/reference/rest
- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/derived-metrics-policy

**판정: REAL_TRANSPORT_IMPLEMENTED_BUT_HARD_LOCKED / POLICY_HOLD / LIVE_API_0 / G45-L7 검수·병합 별도 승인.**
