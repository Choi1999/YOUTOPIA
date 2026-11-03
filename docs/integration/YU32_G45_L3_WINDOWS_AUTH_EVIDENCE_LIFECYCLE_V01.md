# YOUTOPIA — G45-L3 Windows 인증·출구 IP·수명주기 실행 전 계약 v0.1

> 검수일: **2026-11-03 KST** / 기준: `frontend@754863020b56c53905d2a644f6b15e528e6b56d1`
> 상태: **OFFLINE_DESIGN_ONLY / POLICY_HOLD / VERIFIED_0_OF_12 / NO_LIVE_REQUEST / NO_CREDENTIAL_READ**
> 범위: Windows Node 24 수동 수집기 **구현 전** 설계 증거·보안 경계·삭제 책임·합성 정적 테스트. 실제 인증정보·IP 조회, 외부 HTTP, 댓글 원문·감성 분석, 운영 DB/Cloud/비용 변경, PR 병합은 수행하지 않음.
> 주의: 이 문서의 **G45-L3**는 프로젝트 후속 검수 작업명이며, 과거 Windows PoC 문서의 별도 `L3=선택적 Cloud Run` 운영 트랙과 다르다.

## 1. 기준 상태와 추적 문서

- 기준 원격: `frontend@7548630`, `feat/backend-bootstrap@ff69f0b0`. 두 브랜치를 섞지 않으며 현재 백엔드의 운영 관리자 삭제 권한을 구현 완료로 보지 않는다.
- 정본 정책: `shared/contracts/yu32-youtube-readiness-v0/policy-gates.json` — `POLICY_HOLD`, `verifiedCount=0`, `liveCallsAuthorized=false`, `derivedSentimentAuthorized=false`, `externalDataCollected=false`.
- 신규 오프라인 계약: `shared/contracts/yu32-youtube-readiness-v0/g45-l3-windows-security-lifecycle.v01.json`. **승인 저장소/실행 정책 엔진이 아니며**, 프로젝트·Cloud·실제 키 상태를 원격에서 확인한 증거가 아니다.
- 선행 사전 검사: `scripts/windows-local-preflight.cjs`는 `--check`/`--plan`만 제공, 영상 ID/키를 출력하지 않고 `--run`/`--live`/`--execute`를 거부한다.
- 기존 L1 `first-call-http-boundary.cjs`의 `executeLiveFirstCall()`은 차단 상태이며, 저장소 고정 Fixture 외의 실제 응답을 승인하지 않는다.
- 상위 문서: [G45-L2 증거·수명주기 검토](./YU32_G45_L2_PROVIDER_EVIDENCE_AND_LIFECYCLE_REVIEW_V01.md), [G4-5 증거 매트릭스](./YU32_G4_5_PROVIDER_POLICY_EVIDENCE_MATRIX_V01.md), [관리자 삭제 계약](./YU32_G4_5_ADMIN_DELETION_RETENTION_CONTRACT_V01.md).

## 2. 제공자 인증 결정 기록 — 선택 보류

| 옵션 | 공식 확인/범위 | G45-L3 결정 |
|---|---|---|
| API 키 | YouTube Data API v3의 일반 REST 명세는 `key` 쿼리 매개변수를 명시. **API 키는 사용자를 인증하는 OAuth 토큰이 아니다.** | `DOCUMENTED_CANDIDATE_ONLY`. URL·프록시·추적 로그에 키가 노출될 위험이 있어 Windows 비밀 저장·제한·로깅 보안 검수 및 별도 실행 승인 전에는 미구현. |
| OAuth 2.0 | API REST 명세는 `Authorization: Bearer`를 지원. 비공개 데이터/사용자 권한이 필요하다면 적절한 범위·동의가 필요. | 최초 공개 VIDEO 1~3개 PoC의 기본 선택이 아님. OAuth 애플리케이션/토큰 발급·권한·철회는 별도 결정과 승인 대상. |
| 일반 Google Cloud 헤더 | Google Cloud API 키 가이드는 일반적으로 `x-goog-api-key` 헤더 사용을 권장. | **YouTube `commentThreads.list`가 이 헤더를 지원한다는 별도 공식 근거는 확보하지 못했다.** 적용 금지; 추측으로 Credential Header를 연결하지 않음. |

**선택 상태: `NONE_PENDING_YOUTUBE_AND_PROJECT_VERIFICATION`.** 공식 문서의 `key` 쿼리 지원 사실과, YOUTOPIA가 이를 안전하게 사용하도록 승인받았는지는 별개의 문제다. 비밀·Cloud 변경, 실제 인증 방식 선택에 별도 검수 없이 설계만으로 활성화하지 않는다.

## 3. Windows 로컬 키·IP·실행 전 경계

1. **실행 위치:** Chrome Hover Card·Side Panel·React가 아닌 Windows Node 24 서버 측 **수동 CLI**. 공개 HTTP 리스너·스케줄·자동 재시도·백그라운드 호출 없음. Spring 운영 API와는 미연결.
2. **키 저장 후보:** 사용자별 Windows Credential Manager/DPAPI 계열 OS 보호 저장소. 코드·`.env`·명령행 인수/PowerShell history·GitHub·브라우저/확장·표준 로그에 평문 비밀 금지. OS 저장소 구현·실제 Key 생성은 **미승인/미구현**.
3. **Google Cloud API 제한:** 수집 전용 키(발급 승인 후)는 YouTube Data API v3에만 제한하는 방안. Google Cloud의 API 키 서비스 제한과 애플리케이션 제한은 **각각 별도 검증**해야 하며, 키가 존재한다는 사실이 제한 적용 증거는 아님.
4. **외부 IP 제한:** 서버용 API 키는 실제 공인 Egress IP 제한을 후보로 유지. `localhost`·사설 IP는 키 서버 IP 제한 증거가 아님. 동적 회선에서는 매 실호출 전 출구 IP와 적용된 키 허용 목록을 권한 있게 대조해야 함. 불일치/미확인은 **중단**, 제한 없는 키로 폴백 금지.
5. **개별 호출 기록:** 인증 모드, Google Cloud 프로젝트, 키 제한/IP 일치, 사용 가능 Quota 및 영상 ID/횟수는 **비밀을 제외한** 독립 검수 증거에 연결. 승인자의 `true` 플래그/스크린샷 한 장으로 모든 항목을 PASS 처리하지 않음.
6. **로그/관측:** URL 전체, query key, `Authorization` 헤더, 원문/작성자, 에러 response body·proxy trace 로그 금지. 허용되는 것은 오류 종류·요청 ID·호출 수·Quota 추정·정책 revision 등 최소 메타데이터뿐. 별도 로깅/회전/유출 대응 테스트 필요.
7. **차단 경계:** 미구현된 호출기를 `--run` 플래그, `approved=true`, 테스트 fixture, 임의 소스 provenance, 클라이언트 권한 문자열로 열 수 없음. 라이브 호출기는 **독립 기능 브랜치/PR 검수 후**에도 새로운 최초 호출 승인 전에는 외부 전송을 허용하지 않아야 함.

## 4. 첫 페이지 읽기 후보와 오류·예산

| 설계 필드 | 미승인 후보 |
|---|---|
| 대상 | 운영자가 정확히 명시한 공개 `VIDEO` ID 1~3개 |
| 메서드 | `GET https://www.googleapis.com/youtube/v3/commentThreads` |
| 쿼리 | `part=snippet`, `videoId`, `maxResults≤100`, `order=time`, `textFormat=plainText` |
| 범위 | 영상당 첫 페이지만, 대댓글 전체 조회 0, 자동 `pageToken` 추적 0 |
| 예산 | 정상 명세상 1 unit/요청, 계획상 최대 3요청·3 units. 실제 프로젝트 할당량 및 실패/무효 요청 소비는 독립 증거 필요 |
| 네트워크 | TLS/호스트·경로 allowlist, redirect 0, retry 0, 응답 크기·시간 제한, 비밀값이 있는 URL 로깅 금지 — **미구현 검증 요구** |

`nextPageToken` 존재 시 완전한 댓글 모집단이 아님을 `PARTIAL`로 표기하고 추가 요청을 자동으로 하지 않는다. 비활성 `403 commentsDisabled`, 인증/정책 오류, Quota/429, 찾을 수 없는 `404 videoNotFound`, 성공한 빈 페이지, 부분 페이지는 서로 구별한다. 실패를 `NO_DATA` 또는 0% 감성 지표로 바꾸지 않는다. 실제 Google 응답의 오류 구조는 미검증이므로 기존 합성 오류 분류기를 운영용으로 재사용하지 않는다.

## 5. 데이터 보존·삭제·철회 설계 계약

**공식 정책 기준:** 일반적인 `Non-Authorized Data`는 필요한 최소 기간만 보관하고 30일 이내 갱신 또는 삭제(III.E.4.d). API Client가 저장한 관련 사용자 데이터의 삭제 요청은 가능한 빨리, 7일 이내(III.E.4.g). 별도 OAuth 철회·승인된 지표 예외의 상세 기한은 각 조항으로 구별한다.

| 데이터 계보/트리거 | 책임 주체 | 운영 전 필수 수용 조건 |
|---|---|---|
| 댓글 원문·작성자 | 수집 서비스 | 최초 PoC는 영속 저장 0 후보. 메모리도 사용권 준수, 디버그·추적/크래시 로그 저장 방지 |
| Snapshot·감성/주제 지표 | 분석 서비스 | `E06` 승인 전 생성 0. 2026 파생지표 정책의 승인된 사용 사례에서만 별도 가능 |
| 보존 기간 만료·소스 변경·삭제 | 시스템 수명주기 실행자 | 관리자 로그인 없이 기한 내 갱신/삭제·표시 중지·캐시 무효화 |
| 인증/적법성 검증된 사용자 삭제 요청 | 시스템 삭제 요청 처리자 | 권리 확인 후 조속히, 적용 시 7일 내. 기한 위반 시에도 삭제 계속·SLA 위반 별도 기록 |
| 수동 단일 VIDEO 삭제 | **서버 인증 ADMIN** | tenant+VIDEO 정확 범위, preview → 확인 → revision/UUID → purge → 감사. 일반 회원/클라이언트 role 위조 불가 |
| 캐시·검색·리포트·Outbox·Job·임시 내보내기 | 각 계층 책임자 | Tombstone/`policyEpoch`를 먼저 반영, 부분 실패 재시도·완료 확인 |
| 백업·복원 | 복구 책임자 | 삭제 journal/restore fence 적용. 복원된 구버전이 삭제 데이터를 다시 게시하지 못하도록 검증 |

삭제 상태: `PENDING → EXECUTING → PROPAGATING → PURGED`, 부분 실패 `PURGE_FAILED`. **하위 계층 모두의 무효화·처리가 확인되기 전 `PURGED` 금지.** YOUTOPIA 저장 데이터 삭제는 YouTube 원본 댓글 삭제와 다르다. 기존 `admin-purge.cjs`는 합성 메모리 하네스일 뿐 운영 DB·백업 삭제 구현이 아니다.

## 6. E01~E12 증거 순서

| 증거 Gate | 현재 | 가장 작은 독립 확인 증거 (비밀 원문 공유 금지) |
|---|---|---|
| E01–E02 | UNVERIFIED | 동일한 Google Cloud 프로젝트 소유·YouTube Data API v3 활성화 및 지원 인증 방식, 검토자/프로젝트 범위 |
| E03 | UNVERIFIED | OS 보호 저장소 보관·서비스/API 제한·실제 외부 IP 제한·회전/유출 대응 테스트 |
| E04 | UNVERIFIED | 대상 프로젝트의 Quota·사용량·최대 발송 횟수 및 실패 예산, 재시도 0 계약 |
| E05 | POLICY_HOLD | 기본 API 약관·개인정보/사용자 동의·표시/수집 목적 검수 |
| E06 | POLICY_HOLD | 2026 추가 파생 지표 약관/신청/감사·YOUTOPIA 해당 Use Case의 명시적 적용 범위 (실제 감성 분석 별도) |
| E07–E08 | NOT_IMPLEMENTED | 원문 비저장·30일 갱신/삭제·7일 사용자 요청·소스 철회·캐시/복구/백업·감사 E2E 검증 |
| E09–E10 | NOT_IMPLEMENTED | 운영 Spring 서버 인증·테넌트 BOLA·CSRF 및 실데이터 source/provenance/상태/표본 검증 |
| E11 | NOT_APPROVED | 승인된 정확한 VIDEO 목록·운영자·일시·최대 비용/Quota·폐기 계획을 포함한 **별도 최초 실호출 명시 승인** |
| E12 | POLICY_HOLD | 보안·약관·개인정보·비용·배포 별도 최종 승인 |

증거 기록 후보: `evidenceId`, `projectRef`, `useCaseScope`, `reviewedAt`, `expiresAt`, `reviewer`, `evidenceHashOrSecureLocation`, `policyRevision`, `revocationStatus`, `policyEpoch`. 현재 **E01~E12 중 승인 증거 0건**, 임의 Boolean/수집기 내부 상수를 독립 제공자 승인으로 사용하지 않는다.

## 7. 검증과 미완료 사항

- 이번 변경은 JSON 정적 계약과 `tests/g45-l3-windows-contract.test.cjs`를 기존 GitHub Actions 오프라인 glob에 추가한다. 테스트는 계약 일관성/인증 후보·IP/키 미검증/정확한 한도/데이터 삭제 책임 및 무호출 상태를 검사한다. 실제 Windows OS Vault, Google Cloud, 공인 IP, 운영 DB는 **검사할 수 없다**.
- 합성 테스트 PASS는 정책 허가가 아니며, 정책 파일 `policy-gates.json`과 기존 수집/분석·관리자 삭제 실행 코드를 변경하지 않는다.
- 다음 고위험 단계: 실 데이터 처리 계획·생명주기 구현 및 독립 안전 검수, 제한된 HTTPS Transport 설계/테스트를 **별도 브랜치/PR**에서 검토. 원문·실댓글 NLP·Cloud 과금/배포/삭제·최초 실호출은 각각 별도 승인.

**판정: G45-L3_OFFLINE_CONTRACT_READY / POLICY_HOLD / 0_OF_12_VERIFIED / LIVE_API_0.**

### 공식 참고

- [YouTube REST API 인증](https://developers.google.com/youtube/data/reference/rest)
- [CommentThreads.list](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list)
- [Quota Calculator](https://developers.google.com/youtube/data/determine_quota_cost)
- [YouTube Developer Policies (III.E.4)](https://developers.google.com/youtube/terms/developer-policies)
- [추가 파생 지표·보존 규정](https://developers.google.com/youtube/terms/derived-metrics-policy)
- [YouTube 추가 규정 적용 지침](https://developers.google.com/youtube/terms/developer-policies-guide)
- [Google Cloud API 키 제한](https://docs.cloud.google.com/docs/authentication/api-keys)
- [Google Cloud API 키 관리 권장사항](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
