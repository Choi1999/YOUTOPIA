# YOUTOPIA — G45-L1 Windows 최초 YouTube API 읽기 실행 전 검증

> 상태: **FIRST_CALL_NOT_AUTHORIZED / POLICY_HOLD / NO_NETWORK_OR_CREDENTIALS**
> 기준: `frontend@36873f3546acde05259485c579cd5f2f6ccab1e3` (2026-11-03 KST)
> 목적: 첫 실댓글 수집 전 **인증 형식·쿼터·보존/삭제·이용정책** 문제를 별도 검토한다.

## 1. 수집 목적·요청 계획

- 대상: 운영자가 명시한 공개 YouTube `VIDEO` ID만 1~3개, 중복 금지.
- 메서드: `commentThreads.list`, `part=snippet`, `videoId`, `order=time`, `textFormat=plainText`, `maxResults` 1~100, 영상당 첫 페이지 1회, 전체 최대 3회.
- 자동 재시도/페이지 확장/답글 전수 조회 없음. `nextPageToken`은 미수집 상태 표시일 뿐 자동 follow 금지.
- API 문서상 요청당 1 quota unit. **최대 3 unit은 정상적으로 실제 요청이 발송되는 경우의 계획 상한**이며, 실패한 요청의 집계·쿼터 소모는 별도 확인.
- 수집 과정에서 원문/작성자/키/토큰을 콘솔·Git·영속 DB·HTTP 로그에 저장하지 않는다. 모든 처리/표시 허용 범위는 별도 승인 필요.

## 2. 인증 방식의 해결되지 않은 문서 간 차이

1. YouTube Data API [API Reference](https://developers.google.com/youtube/data/reference/rest)는 각 요청에서 `key` **쿼리 매개변수** 또는 OAuth 2.0 토큰을 명시한다.
2. [Google Cloud API 키 보안](https://docs.cloud.google.com/docs/authentication/api-keys)은 API별 지원 상황에 따라 키 제한·사용 방법을 안내하며 `x-goog-api-key` HTTP 헤더 방식이 일반 Google API에서 사용된다.
3. 기존 G45 소스 계획은 `x-goog-api-key`를 사용한다는 가정이지만, **해당 헤더가 YouTube Data API v3 `commentThreads.list`에서 지원된다는 공식 근거/실증은 미확인**이다.

**판정:** `AUTH_MODE_UNVERIFIED`. 불확실한 헤더 방식을 실요청에 연결하지 않는다. OAuth Bearer 방식은 문서화돼 있으나 OAuth 애플리케이션 생성 및 사용자 인증 권한은 미승인. API 키 쿼리 방식은 URL/프록시/로그에 키가 노출될 위험이 있으므로 URL 로깅 금지, 접근제어 및 비밀관리와 함께 별도 보안 검토가 필요하다. 공식 문서 확인 없이 단순히 헤더 사용을 전제한 코드를 활성화하지 않는다.

## 3. 정책 및 개인정보 Gate

YouTube [Developer Policies](https://developers.google.com/youtube/terms/developer-policies)는 비인증 API 데이터의 통상적 30일 갱신·삭제, 사용자 관련 정보 삭제 요청 처리(가능한 빨리, 7일 이내)를 요구한다. 관리자에게는 **수동 삭제 권한**이 있고, 기한 만료·정당한 삭제 요청은 관리자가 로그인하지 않아도 시스템이 처리해야 한다.

2026-06-01 이후 적용되는 [추가 파생 지표·보관 정책](https://developers.google.com/youtube/terms/derived-metrics-policy)에는 댓글 NLP 감성 분석의 허용 예시가 있으나, **승인된 감사 대상 분석 use case / amendment 동의 등 적용 조건**을 확인해야 한다. 일반적인 예시만으로 YOUTOPIA의 감성 분석 사용이 승인됐다고 보지 않는다. 댓글 원문은 확장 보존 예외 대상이 아니다.

현재 `shared/contracts/yu32-youtube-readiness-v0/policy-gates.json`의 `verifiedCount=0`, `liveCallsAuthorized=false`, `derivedSentimentAuthorized=false`, `POLICY_HOLD`를 변경하지 않는다.

## 4. 개발·실행 단계 구분

| 단계 | 실시 가능한 일 | 금지/미확인 |
|---|---|---|
| L1-A | HTTP 요청 형식·최대 크기·상태 코드·오류 매핑을 **합성 데이터로만** 확인 | 실제 네트워크, 비밀키 입력 |
| L1-B | YouTube 전용 인증 방식·Cloud 프로젝트/키/IP 제한·보안 저장소의 증거 검토 | 단순 Boolean으로 승인 위조 |
| L1-C | 댓글 원문 비저장 및 관리자 수동삭제/자동만료·삭제 요청 전파 설계·검수 | 운영 데이터 저장 |
| L1-D | 1~3회 실제 첫 호출에 대한 **새로운 명시적 승인** 이후 제한적 수집 실행 | 암묵적 승인·자동 실행 |
| L1-E | 파생 감성/주제 모델 별도 승인·정확도/출처 검증 이후 운영 평가 | 실댓글 NLP 선행 실행 |

**완료 기준:** 실패 시 안전 차단, 실제 소스·인증/쿼터·라이프사이클 증거 확보, 운영 API/데이터와 분리, 독립 CI 검증. 코드 병합은 실행 허가가 아니다.
