# UI-R04-H — Read-only Channel Metadata Readiness & Evidence Gate v0.1

**기준:** 2026-11-04, PR #71 `d6e22e809f324902fa665093bc340ed08c6fc758`에서 분기. 현재 HEAD는 Draft·미병합. **실 API 호출·정책 해제·병합 허용 아님.**

## 1. 목적과 경계

UI-R04-G의 오프라인 `channels.list` 계획 이후, 실제 공개 채널 조회를 시작하기 전에 필요한 프로젝트 소유권·API 활성화·서버 키 보호·실제 할당량·YouTube 정책·첫 호출 승인·운영 보안을 검토하는 정적 준비도 게이트를 제공한다.

이번 단계에서는 **계정/Google Cloud 콘솔/Secret Manager 실제 상태를 조회하거나 확인하지 않는다**. 소스는 저장소의 `shared/contracts/yu32-youtube-readiness-v0/policy-gates.json`이며 `reviewedOn=2026-11-02`는 문서 검토일이지 오늘의 계정 검증 시각이 아니다.

저장소 정책: `status=POLICY_HOLD`, `liveCallsAuthorized=false`, `derivedSentimentAuthorized=false`, `externalDataCollected=false`, `verifiedCount=0`. 외부 API 요청은 0건. 기존 첫 요청 전송 hardlock, Chrome Manifest, 기존 합성 데이터, 프로젝트 인증정보 및 PR #63~#71은 수정하지 않는다.

## 2. 확인된 증빙과 미확인 증빙

| Evidence | 현재 저장소 상태 | 실제 조회 이전에 필요한 증빙 |
|---|---|---|
| Y45-E01 · 소유권 | UNVERIFIED | Google Cloud 프로젝트 ID, 책임자·조직 소유권 확인 증거(키 문자열 제외) |
| Y45-E02 · API 활성화 | UNVERIFIED | 같은 프로젝트에서 YouTube Data API v3 Enabled 상태 및 적합한 인증 선택 |
| Y45-E03 · 인증정보 | UNVERIFIED | API 제한=YouTube Data API v3, 호출 주체별 애플리케이션/IP 제한, 서버 비밀 저장/회전/로그 마스킹 |
| Y45-E04 · 할당량 | UNVERIFIED | 콘솔의 실제 일일 잔여 quota, 분당 제한, 안전 상한, 재시도/백오프/비용 관리 |
| Y45-E05 · ToS/정책 | POLICY_HOLD | 공개 채널 메타데이터 표시·이미지·보존·삭제에 대한 공식 개발자 정책 리뷰 |
| Y45-E09 · 서버 경계 | NOT_IMPLEMENTED | AuthN, tenant, CSRF/BOLA, server-only egress와 최소권한, 원격 호출 하드락 보존 |
| Y45-E11 · 첫 조회 승인 | NOT_APPROVED | 대상 채널 1개, `channels.list(part=snippet)`, 호출 주체, 정확한 시각, 예상 최대 1단위 및 별도 서명 승인 |
| Y45-E12 · 운영 최종 승인 | POLICY_HOLD | 보안·개인정보·비용·출시 책임자 검토 및 승인 |

따라서 현재 **승인 증빙 0/8, 최종 판정 BLOCKED**. 이는 비활성 API가 실제로 존재한다는 뜻도, 키가 없는 상태라는 뜻도 아니다. 저장소에서 확인 가능한 증빙이 부족하다는 의미다.

## 3. 검증 모델

- `workspaceChannelReadiness.ts`가 저장소 정책 JSON을 직접 읽어 8가지 필수 증빙 ID를 확인한다. 계약 버전, 스냅샷 상태, flags, reviewedOn, evidence uniqueness, 허용 상태를 검증한다.
- 예상치 못한 정책 파일 변경·중복/미존재 증빙·권한 true/인증 가능성 주장·형식 불량은 `SOURCE_INVALID` 처리하며 **승인으로 승격하지 않는다**.
- 결과는 항상 `decision=BLOCKED`, `policyGate=POLICY_HOLD`, `liveCallsAuthorized=false`, `networkExecuted=false`. 이 UI는 실제 권한을 부여할 수 없다.
- 이미 입력된 채널 URL에서 `UI-R04-G`의 정규화된 요청 설명자 하나를 골라 **최대 한 번/1단위의 비실행 first-call 후보**로 표시한다. 운영자 `UNASSIGNED`, 승인 `NOT_APPROVED`, `executable=false`.
- 후보는 사용자가 제출한 문자열에 기초한 계획일 뿐 실존 채널 또는 승인된 실행 대상이 아니다. 영상만 등록했다면 후보 없음.
- API 키·token·서비스 계정 JSON·실제 비밀문자열을 입력/저장/출력하는 UI를 제공하지 않는다.

## 4. 실제 Cloud 증빙 점검 절차 (사람 검토용, 자동 수행 아님)

1. Cloud Console에서 올바른 프로젝트와 책임자를 선택한다. **프로젝트 이름만 알고 있다는 것**은 API 소유권·권한 증명이 아니다.
2. API & Services → Enabled APIs & services에서 YouTube Data API v3가 같은 프로젝트에 활성화됐는지 확인한다.
3. Credentials에서 서버용 API key가 정확히 YouTube Data API v3로 **API restriction** 되어 있는지 확인한다. 서버 안정적 공인 발신 IP가 있다면 **Application restriction: IP addresses**가 적합하다. 유동 egress 서버라면 정적 IP/프록시/서비스 아키텍처에 대한 별도 설계와 보호 통제가 필요하다.
4. 키 원문을 GitHub/PR/스크린샷/브라우저 폼/챗 로그에 남기지 않는다. 상태 증빙은 키 문자열·ID 세부를 마스킹하고, 승인된 보호된 경로로 제한한다.
5. Quotas 탭에서 실제 남은 단위와 설정된 limit를 확인한다. 공식 문서상 특정 메서드의 quota 단위와 프로젝트 실제 잔여 한도는 서로 다르다. UI-R04-G에서 가정한 '10단위'는 실제 Cloud 할당량이 아니다.
6. 공식 YouTube API Terms, Developer Policies, policy guide를 확인해 메타데이터의 허용된 용도·표시·보존/갱신/삭제를 검토한다. 공개 데이터라는 이유만으로 전면적 사용 권한을 추론하지 않는다.
7. 읽기 전용 서버 전달 경계, API 키 주입, AuthN/CSRF/BOLA, 감사 로그 마스킹, 호출 상한, quota 403·rate limit 429·5xx backoff를 검증하고 첫 실제 호출의 operator/target/scope/예상 비용을 서면으로 승인한다.

## 5. 정식 첫 호출을 승인할 때 필요한 최소 계약 (향후)

- Gate를 별도로 수동 승인하기 전에는 어떤 모의 계획도 실행 가능해지지 않는다.
- 호출 대상은 검증 가능한 공개 채널 ID **또는** 핸들 하나이며, operation은 `channels.list(part=snippet, id=<one>)` 또는 `channels.list(part=snippet, forHandle=<one>)` 중 하나여야 한다.
- 첫 시도 최대 `1 call / 1 quota unit`, 자동 재시도 없음, 댓글 수집/감성 분석/사용자 OAuth 범위 없음.
- 서버 credential 절대 브라우저 노출 금지, 서버 측 정책 체크와 로그/취소/할당량 상한을 별도 구현한 뒤 회수 가능한 승인으로 관리한다.
- 첫 호출이 통과하더라도 모든 URL 대상 자동 수집, 채널 이미지 자동 동의 또는 댓글 조회가 허용된 것은 아니다.

## 6. 현재 UI / 검증

- `WorkspaceChannelReadinessReview`를 채널 URL 존재 시 기존 채널 사전 검증 패널 하단에 표시한다. 상태 BLOCKED, 0/8, POLICY_HOLD, 저장소 증빙 기준일을 확인한다.
- '실조회 전 필수 증빙 8항목 보기'는 읽기 전용 설명을 확장한다. 실행 버튼, 비밀키 입력, 승인 체크박스 없음.
- 정책 JSON 계약 상실·미확인 증빙·비정상 대상 URL·영상만 등록 시·첫 호출 후보 생성을 모의 검증하고, React 통합 테스트는 `fetch` 호출 0건을 확인한다.
- Windows Chrome 1440/900/390/320px, 다크/라이트, 키보드로 목록 펼치기/접기·메인 그래프·기존 영상 미리보기·A/B 비교를 검수한다.
- React/Extension/Windows offline CI와 사용자 수동 QA는 별도 게이트. 자동 PASS가 실제 Cloud 설정 검증을 뜻하지 않는다.

## 7. 공식 참고 문서

- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/getting-started
- https://developers.google.com/youtube/registering_an_application
- https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys
- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/developer-policies-guide

## 8. 이후 단계 및 승인 경계

현재 Google Cloud 소유권, 실제 API 활성화, 키 제한, quota 사용량을 확인할 별도 연결 권한/증빙이 없어 **실제 상태는 UNVERIFIED**다. 정식 서버 API metadata 조회와 운영 수집은 별도 승인 및 검증 뒤에만 고려한다.

이 PR은 PR #71 위의 독립 Draft. 정확한 HEAD CI 뒤 PR 기준 브랜치를 PR #71로 복원하고, **명시적인 별도 병합 승인 전까지** 모든 선행 PR/메인 브랜치 불변.
