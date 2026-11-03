# YOUTOPIA — G45-L2 제공자 인증·증거·데이터 수명주기 사전 검수 v0.1

> **검수일:** 2026-11-03 (KST)
> **검수 기준:** `frontend@4a28fb8a29f4d40892146c25d1221181441c7c0d`, `feat/backend-bootstrap@ff69f0b0ad14f156a4a4dafb5755dbbb1ab2c5b9` (서로 별도 브랜치)
> **판정:** `OFFICIAL_SPEC_REVIEWED / DESIGN_ONLY / EVIDENCE_VERIFIED_0_OF_12 / POLICY_HOLD`
> **실행 경계:** 실제 HTTP 호출 0, 실댓글 0, 자격증명 읽기/발급 0, 운영 DB 삭제 0, NLP 0, 배포 0. 본 문서는 승인서 또는 실행 가능한 수집기가 아니다.

## 1. G45-L2 목적 및 기준

이 단계는 [G45-L1 HTTP 사전 계약](./YU32_G45_L1_HTTP_AUTH_POLICY_GATES_V01.md), [공급자 증거 매트릭스](./YU32_G4_5_PROVIDER_POLICY_EVIDENCE_MATRIX_V01.md), [관리자 삭제·보존 계약](./YU32_G4_5_ADMIN_DELETION_RETENTION_CONTRACT_V01.md)을 실제 공식 명세와 대조하고, 다음 구현을 위한 검증 가능한 수용 조건을 확정한다. 기존 합성 `READY`, 116개 테스트 PASS, GitHub CI 성공만으로 YouTube 제공자 사용권이나 운영 보안이 확보되지 않는다.

**정본 상태:** `shared/contracts/yu32-youtube-readiness-v0/policy-gates.json`의 `status=POLICY_HOLD`, `verifiedCount=0`, `liveCallsAuthorized=false`, `derivedSentimentAuthorized=false`, `externalDataCollected=false`. 본 단계에서 수정하지 않는다.

## 2. YouTube 공식 문서 재검토 결과

| 대상 | 공식 확인 사항 | 설계 결론 |
|---|---|---|
| 인증 | YouTube Data API REST는 API 키의 `key` **쿼리 파라미터**, 또는 OAuth 2.0 토큰(예: `Authorization: Bearer`)을 명시한다. | 현 `authMode=UNVERIFIED_YOUTUBE_SPECIFIC` 유지. 일반 Google Cloud의 `x-goog-api-key` 권장은 해당 YouTube 메서드의 지원 증거가 아니므로 활성화 금지. |
| API 키 보안 | Google Cloud는 키의 API 제한과 애플리케이션/IP 제한, 비밀 보호, URL 쿼리 누출 위험 경감을 요구/권고한다. | 실제 지원되는 인증 방식을 선택하더라도 키·토큰을 클라이언트, Git, 일반 로그, 요청 URL 기록에 노출하지 않는 서버/로컬 운영 방안과 제한·회전을 독립 검증. 실제 키 발급은 별도 승인. |
| 대상/요청 | `commentThreads.list`는 `GET /youtube/v3/commentThreads`, `part=snippet`, `videoId`, `maxResults` 1~100, `order=time`, `textFormat=plainText`, `nextPageToken`을 명세한다. | 최초 후보는 공개 VIDEO 1~3개, 영상당 첫 페이지 1회, 재시도 0, 대댓글 전수 수집 0. 100은 첫 페이지의 최대 상위 스레드 수이며 모집단 전체가 아니다. |
| 비용 | `commentThreads.list`의 공식 비용은 요청당 1 quota unit. 무효한 요청도 최소 1 unit, 추가 페이지도 별도 요청. 2026년에는 일부 API 메서드에 별도 quota bucket이 도입됐다. | 계획된 최대 발송 3건/명세상 3 units와 **실제 프로젝트의 잔여 Quota·실패 사용량**은 구분한다. 현재 프로젝트의 10,000 units를 독립 확인한 것이 아니다. |
| 파생 분석 | 2026-05-04 추가/2026-06-01 보완된 정책은 승인된 분석 use case에서 댓글 NLP 감성 분석을 허용 사례로 제시한다. 적용 대상은 별도 신청·감사·조건 수락을 완료한 API Client다. | YOUTOPIA에 적용되는 승인서/범위가 없으므로 감성·주제 파생 지표 실데이터 생성은 계속 `POLICY_HOLD`. 일반 예시를 개별 프로젝트 승인으로 바꾸지 않는다. |
| 보존 | 일반적인 비인증 API Data는 목적에 필요한 기간만, 최대 30일 뒤 갱신 또는 삭제. 파생 지표 최장 36개월 예외는 적용 승인 조건에 따르며 댓글 **원문**은 30일 원칙 유지. | PoC 기본값은 원문 영속 저장 0. 향후 캐시·스냅샷·작업 큐 등 모든 API 데이터 계보에 기한과 삭제/갱신 책임을 명시. `36개월`을 원문에 적용하지 않는다. |
| 삭제/철회 | 사용자 관련 저장 데이터 삭제 요청은 가능한 빨리 7일 이내 처리. 앱 내 OAuth 동의 철회의 경우 연결된 Authorized Data의 7일 삭제, Google 보안 설정의 외부 철회는 해당 조항에서 30일 기한이 구분된다. | 요청 경로별 정확한 법적/제공자 기한을 기록하되 시스템은 **지체 없는 조치 및 내부 7일 목표**를 기본으로 설계. 관리자 로그인은 필수 삭제 요청의 선행 조건이 아니다. |

**출처 문서(2026-11-03 재조회):**
- YouTube Data API REST: https://developers.google.com/youtube/data/reference/rest
- `commentThreads.list`: https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
- Quota calculator: https://developers.google.com/youtube/data/determine_quota_cost
- Quota/audit: https://developers.google.com/youtube/data/guides/quota_and_compliance_audits
- Developer Policies (III.E.4, III.E.4.g, III.E.4.h 및 철회): https://developers.google.com/youtube/terms/developer-policies
- Derived metrics: https://developers.google.com/youtube/terms/derived-metrics-policy
- Policy revision history: https://developers.google.com/youtube/terms/revision-history
- Google Cloud key best practices: https://docs.cloud.google.com/docs/authentication/api-keys-best-practices

정책 원문과 실제 프로젝트 승인 범위가 충돌하거나 변경되면 새 검토와 책임자 판정이 우선한다. 이 문서는 법률 자문 또는 제공자 승인이 아니다.

## 3. E01~E12 증거 수용 조건

| Gate | 현재 | PASS에 필요한 독립 검증(비밀 제외) | 차단 범위 |
|---|---|---|---|
| E01 | UNVERIFIED | 실 프로젝트 소유자·책임자 및 프로젝트 식별을 검토자가 확인하고 적용 범위 기록 | 실제 읽기 |
| E02 | UNVERIFIED | 해당 프로젝트에서 YouTube Data API v3 활성화, 사용하려는 **YouTube 전용 인증 모드**의 공식 적합성 기록 | 실제 읽기 |
| E03 | UNVERIFIED | 제한된 자격증명, 실제 출구 IP/애플리케이션 제한, OS 비밀 저장·비밀 로그 차단·회전/유출 대응 증거 | 실제 읽기 |
| E04 | UNVERIFIED | 프로젝트 실제 quota/사용량 및 1~3건 수동 예산, 실패/중단·재시도 0 보장 증거 | 실제 읽기 |
| E05 | POLICY_HOLD | 사용자 사례가 YouTube API ToS·Developer Policies·표시/동의·개인정보 조건에 적합한지 책임자 검토 | 실제 읽기 |
| E06 | POLICY_HOLD | 2026 파생 지표 추가 약관 적용·신청/감사·해당 프로젝트의 분석 use case 수락 범위 증거 | 실데이터 파생 지표 |
| E07 | NOT_IMPLEMENTED | API Data 목록·수명·원문 최소화·기한 내 갱신/삭제, 복구 후 재생성 금지의 구현·시험 | 실제 읽기/저장 |
| E08 | NOT_IMPLEMENTED | 본인 데이터 삭제 요청/소스 철회, 캐시·Outbox·인덱스·백업까지 전파하는 실행·검증·감사 경로 | 실제 읽기/저장 |
| E09 | NOT_IMPLEMENTED | 운영 Spring AuthN/ADMIN·CSRF·tenant BOLA·레이트 제한·인가된 Job 권한 테스트 | 운영 API/Job |
| E10 | NOT_IMPLEMENTED | 소스 진위·수집범위·분모·부분수집·`NO_DATA/STALE/POLICY_BLOCKED` 상태와 고객 공개 차단 테스트 | 운영 결과 공개 |
| E11 | NOT_APPROVED | 정확한 VIDEO, 운영자, 시각, 최대 발송/실패 예산, 메모리 처리·폐기 방안을 포함한 **별도 최초 실호출 명시 승인** | 실제 읽기 |
| E12 | POLICY_HOLD | 보안·개인정보·정책·비용·배포 최종 승인의 별도 기록 | 운영 배포 |

**증거 원장 최소 필드:** `evidenceId`, `projectRef`, `useCaseScope`, `policyRevision`, `reviewedAt`, `expiresAt`, `reviewer`, `evidenceLocationOrHash`, `revocationStatus`, `policyEpoch`. 단순 `approved=true`, 클라이언트 역할 또는 합성 fixture는 독립 검증의 대체물이 아니다. 키·토큰·실제 댓글·개인식별자·제공자 비밀 증거 원문을 GitHub에 저장하지 않는다.

## 4. 수명주기·삭제 전파의 운영 계약(아직 미구현)

### 4.1 데이터 목록과 책임

- **소스 원문/작성자·메타데이터:** 최초 PoC는 비영속 메모리 처리 후보. 어떤 경로로든 기록하면 데이터 보존·삭제 책임을 발생시킨다. 디버그 로그/추적/오류 리포트·프록시 URL도 검사 대상이다.
- **AnalysisSnapshot/파생 결과:** 실데이터 생성은 E06 충족 전 불가. 추후 허용된 지표라도 출처·사용 승인·철회·기간을 개별 추적한다.
- **캐시/브라우저 Hover Card/CDN/검색 색인/리포트/Outbox/Job:** 삭제/철회가 전달되어야 하는 독립 복제본으로 간주한다. TTL 경과만으로 전파 성공을 단정하지 않는다.
- **백업/복구:** 기한 내 영구 삭제가 곤란한 계층은 인가된 보존/복구 정책과 무효화 펜스를 따로 검증해야 하며, 복구 이후 tombstone 재적용/재생성 차단 필수.
- **감사:** 요청 ID·범위·사유코드·상태·시각·정책 revision 등 최소 메타데이터만. 원문·작성자 개인정보·비밀은 기록하지 않는다.

### 4.2 삭제 트리거·권한·상태

| 트리거 | 실행 책임 | 상태/수용 기준 |
|---|---|---|
| 관리자 수동 삭제 | 서버에서 검증한 ADMIN만 | 정확한 tenant+VIDEO 미리보기 → 명시 확인/revision/UUID → 삭제 → 전파 확인 |
| 보존기한 만료·소스 수정/삭제 | 시스템 실행자 | 관리자 로그인 없이 정책상 기한 내 갱신·삭제 및 파생/캐시 무효화 |
| 검증된 이용자 삭제 요청 | 시스템 요청 처리자 | 신원·권리 검증, 접수시각/요청 ID, 지체 없는 전파, 기한 위반도 삭제 중단 금지 |
| OAuth 동의·접근권 철회 | 시스템 철회 처리자 | 해당 토큰 즉시 취소(적용 시), 데이터 접근 차단 및 관련 자료 삭제/전파 |
| 백업 복원·재시도/워커 재기동 | 복구 실행자 | tombstone·policyEpoch 선적용; 삭제된 VIDEO/tenant 재생성 금지 |

삭제 상태 후보: `PENDING → EXECUTING → PROPAGATING → PURGED`, 실패 시 `PURGE_FAILED`. 전체 관련 저장소가 확인되기 전에는 `PURGED`로 보고하지 않는다. 관리자 수동 삭제는 관리 계정 전용이지만 **시스템 의무 삭제를 ADMIN 인증에 종속시키면 안 된다**. YOUTOPIA 삭제는 YouTube 원본 댓글 삭제가 아니다.

## 5. 향후 수집 Transport 분리 설계 (코드 미구현)

1. **현재 유지:** `local-source-adapter.cjs`는 credential이 없는 읽기 전용 요청 Descriptor. `first-call-http-boundary.cjs`는 저장소에 포함된 합성 Fixture 3종의 모의 HTTP Envelope만 통과시키며 `executeLiveFirstCall()`은 항상 차단한다. 이를 라이브 호출 도구로 재해석하지 않는다.
2. **고위험 변경 분리:** 실제 HTTPS dispatcher, API 키·Vault, OAuth, 라이브 응답 파서, 삭제/권한·외부 전송은 독립 기능 브랜치/PR·위협모델·검수 대상으로 둔다. 그 전에는 코드를 추가하지 않는다.
3. **비밀/네트워크:** allowlist 호스트·경로, TLS 검증, 리디렉션 0, 자동 재시도 0, 1~3개의 정확한 VIDEO, 페이지당 1회, 보수적 timeout/응답 크기 제한, URL과 오류 로그의 비밀 노출 방지. 실제 인증 모드는 공식 지원·보안 증거 없이는 결정하지 않는다.
4. **실데이터 출처 분리:** `STATIC_FIXTURE`를 표시한다고 진짜 제공자 응답을 합성 데이터로 바꿀 수 없다. 별도 검증된 provider response/경로/출처와 격리된 스키마가 필요하다.
5. **안전한 중단:** 인증/Quota/403/404/댓글 비활성/누락/잘못된 Content-Type/본문 초과·타임아웃 발생 시 분석 결과를 꾸며내지 않고 정지·분류. `nextPageToken`은 `PARTIAL` 표시 용도이며 추가 호출을 자동으로 시작하지 않는다.
6. **실행 승인:** E01~E05, E07, E08, E11이 실제로 충족되고 수집기 독립 검수가 끝난 뒤에도 **구체적 최초 호출에 대한 새 사용자 승인** 전에는 외부 전송 0을 유지한다. E06 전에는 실댓글 NLP 0, E09/E10/E12 전에는 운영 공개 0.

## 6. 후속 구현 PR에 요구할 부정·통합 테스트

- 승인 Boolean 9개 모두 `true`, 합성 `READY`, 위조 `isSynthetic`, 임의 외부 payload, 잘못된 tenant/role/VIDEO, 누락·만료·철회된 policyEpoch → **전부 실제 호출 허용 불가**.
- 라이브 호출기 미연결 상태에서 네트워크 함수·Credential Manager·실제 제공자 키를 사용하지 않는 정적/런타임 테스트 유지.
- 단일 요청 계획·3회 초과·중복 ID·`pageToken`/자동 재시도/리디렉션·허용되지 않은 호스트·비밀 URL 로깅·응답 크기 초과 → fail closed.
- 403 댓글 비활성/권한/Quota/429·404 삭제/미존재·빈 페이지·부분 페이지·에러 시 지표 생성 금지·상태 분리.
- 원문 보존 만료, 7일 이용자 요청, 철회, 관리자 외 수동 삭제 거부, tenant 경계, 전파 일부 실패, 재시도 idempotency, 백업 복구·tombstone 복원·재수집 차단.
- 실댓글/실제 키 없는 오프라인 CI 성공만으로 E01~E12의 상태를 변경하는 코드·스크립트 금지.

기존 G45 합성 테스트 및 CI가 검증한 범위를 중복해 PASS로 보고하지 않는다. 상기 항목은 **후속 고위험 구현의 수용 기준**이며 현재 구현·실행 완료가 아니다.

## 7. 검수 판정과 다음 착수 조건

- **이번 단계 완료:** 공식 API 인증·쿼터·정책 대조, 정확한 E01~E12 증거 요구, 데이터 계보/보존·삭제 전파 계약 및 안전 테스트 기준 문서화.
- **계속 차단:** 프로젝트별 인증/Quota 실증, 2026 파생 지표 프로젝트 사용 승인, 실제 데이터 보존·삭제 구현, 실제 YouTube 수집기, 최초 실호출, 운영 배포.
- **다음 적정 작업:** (a) E01~E05·E07/E08의 비밀 제외 근거 확보 계획, (b) 백엔드 현재 Spring 권한/삭제 Job의 독립 설계 검수, (c) 사용자 별도 승인 후 고위험 Transport PR — 단 E11까지 충족되기 전 실제 HTTP 호출은 하지 않는다.

**최종 상태: `G45-L2_DOCUMENTED / POLICY_HOLD / VERIFIED_0_OF_12 / LIVE_API_0 / REAL_NLP_0 / PRODUCTION_DELETE_0`.**
