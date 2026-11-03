# YOUTOPIA — G45-L4 프로젝트 증거·삭제 수명주기 준비 검수 v0.1

> **기준:** 2026-11-03 KST · `frontend@326dade64d255a126359a034b770455e2f8498fd`
> **판정:** `PREIMPLEMENTATION_POLICY_HOLD / VERIFIED_0_OF_12 / LIVE_API_0 / PRODUCTION_DELETE_0`
> **안전 경계:** API 키·OAuth·Google Cloud 설정/실제 공인 IP 확인·실댓글 수집·운영 DB/Redis/캐시/백업 삭제·운영 배포 없음. GitHub에 프로젝트 비밀/원본 스크린샷/댓글 원문 업로드 금지.

## 1. G45-L4 변경 범위와 선행 근거

G45-L3의 Windows 수동 Node 24 백엔드 후보와 비실행 HTTP 계약을 보존하면서, **A. 프로젝트 외부 증거 수령의 검증 절차**와 **B. E07/E08 삭제 전파·복구 실패의 수용 조건**을 각각 명확하게 만든다. 기존 관리자 삭제 합성 테스트(`admin-purge.cjs`)가 이미 제공하는 ADMIN 범위·자동 만료·사용자 삭제·멱등성·tombstone은 중복 구현하지 않는다.

신규 파일:
- `shared/contracts/yu32-youtube-readiness-v0/g45-l4-evidence-erasure-readiness.v01.json` — 12개 Gate 메타데이터 수용 체크리스트·데이터 계보·기한.
- `shared/contracts/yu32-youtube-readiness-v0/synthetic-erasure-propagation.cjs` — **고정 합성 Fixture 2개만** 허용하는 메모리 상태 모형. 실제 삭제 권한, 네트워크, DB, 파일, 비밀, 토큰 접근이 없다.
- `shared/contracts/yu32-youtube-readiness-v0/tests/g45-l4-evidence-erasure.test.cjs` — Gate 교차 검증과 추가 삭제 전파 실패/복구·테넌트·Tombstone 부정 테스트.

해당 계약은 운영 정책 엔진이나 승인 원장이 아니다. 정본 `policy-gates.json`의 모든 Gate는 기존 상태를 유지한다. GitHub CI 성공은 **테스트 설계 합격**일 뿐, 실제 Google Cloud/삭제 엔드투엔드 증거가 아니다.

## 2. 실제 프로젝트 독립 검증 절차 (E01~E06, E11)

| 증거 | 확인 주체·자료 | 승인 전 검증 방법 |
|---|---|---|
| E01 — 소유 | Google Cloud 프로젝트의 접근권한 있는 실제 소유자 | 동일 프로젝트의 식별자·계정 권한·책임자 일치 확인. Git에는 공개 불필요한 프로젝트 ID·계정정보 기록하지 않음 |
| E02 — API/인증 | 프로젝트 설정 화면 + YouTube Data API 공식 명세 | 활성화된 서비스가 바로 그 프로젝트의 `YouTube Data API v3`인지 확인. 공식 REST의 `key` 쿼리 또는 OAuth Bearer와 실제 인증 후보 구분. `x-goog-api-key` 일반 헤더를 YouTube 지원으로 추정하지 않음 |
| E03 — 비밀/IP | 프로젝트 자격증명/제한 설정의 비밀 제외 메타데이터 및 보안 검수 | 서버용 키의 YouTube API 제한·IP 제한·Windows OS 보호 저장소·현재 출구 IP와 허용 IP 일치·주소 변경 시 중단·유출/회전 계획을 각각 독립 확인. 실제 키나 실제 공인 IP를 이 대화/저장소에 제출할 필요 없음 |
| E04 — Quota | 프로젝트의 YouTube Data API Quota/사용량 화면 | 동일 프로젝트의 현행 잔여량과 계획 상한(공개 VIDEO 1~3개, 첫 페이지/영상 1회, 자동 재시도 0, 명세상 1 unit/요청)을 구분 확인. 오류/실패 요청도 quota 소모 가능 |
| E05 — 목적/약관 | 정책·개인정보 책임자 + YouTube 정책 원문 | 공개 댓글 조회 목적, 사용자 동의/표시, 데이터 최소화, 외부 캐시/복제·고지/삭제 요구 및 필요 제공자 심사 독립 검토 |
| E06 — 파생 지표 | 프로젝트 책임자 + YouTube 정책 추가 개정 수락·신청/감사 내역 | `Viewer Sentiment Analysis`는 **허용 예시**다. 실제 YOUTOPIA 프로젝트에 적용된 조건·사용 사례 수락 근거가 없으면 실댓글 NLP 금지 |
| E11 — 첫 실호출 | 실제 승인권자 | 정확한 VIDEO ID, 실행자, 호출/실패 예산·시점, 수집 정보 처리/폐기, 중단 기준을 특정한 **별도 명시 승인** 필요. G45-L4 승인만으로 실호출 불가 |

**증거 메타데이터 양식(실제 내용은 인가된 별도 보관소):** `evidenceId`, `projectReferenceRedacted`, `scope`, `reviewer`, `reviewedAt`, `expiresAt`, `policyRevision`, `sourceReference`, `restrictedEvidenceLocationOrHash`, `revocationStatus`. 증거가 진짜인지, 권한·기한·프로젝트 범위가 일치하는지 **독립 검토자**가 확인해야 하며, 입력된 `approved: true`를 승인으로 사용해서는 안 된다.

**현재 E01~E12 전체 verified=0.** E09/E10/E12 운영용 서버·출처/표본·최종 배포 Gate는 해당 운영 트랙에서 별도 검증한다. Google Cloud 직접 접근 권한을 확인하거나 API 키 생성·읽기를 진행하지 않았다.

## 3. 수명주기 E07/E08: 보존·삭제 기한 구별

| 사건·데이터 | 정책상 기준 | 준비할 시스템 동작 |
|---|---|---|
| Non-Authorized API Data(공개 댓글 원문 등) | 필요한 기간만 사용, 최대 **30 calendar days** 이후 갱신 또는 삭제 | 첫 PoC 영속 원문 저장 0 후보. 저장할 경우 원문/작성자/메타·캐시·로그 인벤토리와 수명 추적 필수 |
| 사용자 관련 저장 데이터 삭제 요청 | 가능한 한 빨리, **7 calendar days 이내** | 검증된 요청 접수·접근 차단·삭제 전파·감사; 관리자가 로그인하지 않아도 필수 실행 |
| 앱 내부 OAuth 동의 철회(향후 OAuth 도입 시) | 즉시 토큰 철회, 관련 Authorized Data **7 calendar days 이내** 삭제 | 별도 철회 프로세스·토큰 폐기·연결된 데이터 계보 삭제 |
| Google 보안 설정에서의 OAuth 외부 철회(향후) | 가능한 한 빨리, 관련 API Data **30 calendar days 이내** 삭제 | 토큰 유효성 재검증/접근 차단 및 해당 보존 기한 내 계보 정리 |
| 2026 추가 파생 지표·연장 보존 | 승인된 분석 use case에 적용되는 조건부 예외 | **YOUTOPIA 승인 미확인, 사용 금지.** 댓글 원문은 이 예외로 36개월 보존되지 않음 |

기한은 **최대치이지 기다렸다 삭제하라는 뜻이 아님**. 접근 차단·유효한 요청 처리 및 가능한 삭제는 즉시 수행하는 설계다. 별도 법정 의무·현행 약관이 더 엄격하면 이를 우선 검토한다.

## 4. 삭제 대상 계보·전파 및 운영 전 E2E 수용 기준

기본 저장소 후보를 `raw-and-identity`, `snapshot-and-derived`, `report`, `search-index`, `server-cache`, `client-and-cdn-cache`, `job-and-outbox`, `temporary-export`, `backup-and-restore-fence`로 고정한다. 실제 시스템이 추가 저장소를 만들면 전체 목록을 다시 갱신해야 하며, 임의로 건너뛸 수 없다.

1. **서버 승인/트리거:** 수동 삭제는 서버 인증 ADMIN만, 정확한 tenant+VIDEO 및 미리보기/확인·UUID/revision·사유를 필수. 보존 만료와 검증된 사용자 요청은 독립 SYSTEM 실행자로 관리자 부재에도 처리.
2. **동시 실행 차단:** 요청 접수 즉시 사용 중지/tombstone/`policyEpoch` 펜스를 먼저 기록하여 구 Worker/Outbox, 백업 복원, 캐시 재동기화가 지워야 할 데이터를 재생성하지 못하게 해야 함.
3. **전파:** 각 저장소의 삭제 또는 유효한 무효화 결과를 요청 ID/스코프/정책 revision별로 확인하고, 실패한 저장소별 재시도를 유지. 캐시 TTL 소진이나 1개 SQL 성공만으로 전체 삭제 완료 판정 금지.
4. **상태:** `PENDING → EXECUTING → PROPAGATING → PURGED`, 실패 시 `PURGE_FAILED`. 최종 `PURGED`는 실제 모든 계층에서 확인된 뒤에만 가능. **신규 합성 모형**은 오해를 막기 위해 `PURGED_SYNTHETIC_ONLY`라는 별도 상태만 반환.
5. **감사/복구:** 원문/작성자/비밀을 제외한 요청 메타데이터·일시·전파 대상·실패/SLA 코드만. 복구 시 tombstone과 `policyEpoch` 우선 복원, 캐시/백업/인덱스 잔존·재게시 여부 확인.
6. **오프라인 한계:** 신규 테스트는 **모의 Acknowledgement**와 실패/재시도만 다룬다. 운영 SQL 삭제, Redis·CDN·브라우저 캐시 제거, 백업 암호화/복구 실제 증거를 만들지 않는다.

## 5. 신규 합성 테스트 범위

- E01~E12 상태·범위가 정본 `policy-gates.json`과 정확히 일치해야 하고, 개별 증거를 검사했다고 주장하지 않음.
- 키·Cloud 프로젝트·Quota·공인 IP·OAuth 동의는 실제로 조회/검증하지 않았음을 검증.
- 30일/7일/7일/30일 기한을 서로 혼동하지 않으며 관리자 수동 삭제와 SYSTEM 의무 삭제를 분리.
- 고정 합성 VIDEO+tenant만 수락; 임의 실데이터, `approved`/`role`/`apiKey` 입력 거부.
- `PENDING`/`EXECUTING`에서 완료로 바꿀 수 없음; **백업/복구 펜스 ACK가 없으면 전체 PURGED 불가**.
- 부분 실패는 `PURGE_FAILED`, 재시도 전 추가 ACK 차단; 중복 ACK/동일 요청 멱등성 및 다른 스코프와의 충돌.
- 삭제 수립 전부터 tombstone을 적용, 구 정책 epoch 작업 재생성 거부, 더 최신 epoch라 해도 실데이터 수집권 자동 부여 금지.
- 테스트 코드/계약이 외부 HTTP, 자격증명, 파일/DB/Redis 삭제, 운영 코드 실행 경로를 추가하지 않음.

기존 `frontend-validation.yml`의 Node 24 `shared/contracts/yu32-youtube-readiness-v0/tests/*.test.cjs`에 자동 포함된다. CI 통과는 신규 **합성 경계**의 정합성만 의미한다.

## 6. 다음 실행 Gate

- **문서/오프라인 검증:** 이번 변경으로 진행, 해당 커밋 CI로 검증.
- **E01~E05/E11 실증:** 실제 Google Cloud 계정에 접근 가능한 사람이 프로젝트 소유·API·키/IP·Quota·사용 목적 증거를 비밀 제외 방식으로 제공하고 독립 검토자가 확인해야 함. 이 단계에서 E01~E12는 계속 0/12.
- **E07/E08 실제 구현:** 운영 백엔드 Spring 권한·테넌트, 여러 저장 계층, 복구/Outbox 및 개인정보 요청 입력을 포함하므로 **별도 고위험 브랜치/PR·독립 검수**가 필요. 이번 작업에는 포함되지 않음.
- **실제 첫 API 호출:** 별도 E11 명시 승인과 모든 선행 Gate 충족 전 외부 전송 0 유지.
- **실댓글 파생 지표/배포/비용:** E06 및 운영 E09/E10/E12 충족 전 금지.

**최종 판정: G45-L4_OFFLINE_EVIDENCE_AND_PROPAGATION_READINESS / POLICY_HOLD / VERIFIED_0_OF_12 / REAL_DATA_0 / ACTUAL_DELETION_0.**

### 공식 출처 (2026-11-03 확인)

- https://developers.google.com/youtube/data/reference/rest
- https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
- https://developers.google.com/youtube/data/determine_quota_cost
- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://docs.cloud.google.com/docs/authentication/api-keys
- https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys
