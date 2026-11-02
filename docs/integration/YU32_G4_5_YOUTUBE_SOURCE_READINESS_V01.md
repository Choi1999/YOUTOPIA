# YOUTOPIA — YU-32 G4-5 실제 YouTube 소스 준비·최초 조회 Gate v0.1

> **상태:** READINESS_DRAFT / OFFLINE_ONLY / LIVE_CALLS=0 / REAL_COMMENTS=0 / POLICY_HOLD
> **기준:** frontend@6cce815ef6bb6f32f5733bd0a11fe46815e8d4ee, 정책 검토 2026-11-02 KST
> **상위 설계:** [G4-2 API·인가](./YU32_G4_2_API_AUTHORIZATION_CONTRACT_V01.md) · [G4-3 영속/인가/복구](./YU32_G4_3_PERSISTENCE_AUTH_RECOVERY_DESIGN_V01.md) · [G4-4 Lab](./YU32_G4_4_ISOLATED_DB_WORKER_VERIFICATION_PLAN_V01.md)
> **증거 매트릭스:** [G4-5 Provider Policy Evidence](./YU32_G4_5_PROVIDER_POLICY_EVIDENCE_MATRIX_V01.md)
> **오프라인 계약:** [G4-5 Source Readiness Contract](../../shared/contracts/yu32-youtube-readiness-v0/README.md)

## 1. 이번 승인 범위

일반 YouTube 영상 댓글 반응 분석을 위한 **정책·프로젝트·API 계약 준비**다. 실제 Google Cloud 프로젝트 설정 변경, API 키/OAuth 취급, YouTube API 실호출, 댓글 원문 수집·저장, NLP 감성 분석, 실데이터 Snapshot 발행, 운영 API/DB·배포·결제, 기존 PR #46 병합은 **포함하지 않는다**.

Chrome Hover GET은 읽기 전용이며 외부 호출이나 분석 Job POST를 트리거하지 않는다. `STATIC_FIXTURE` 또는 `APPROVED_TEST_ONLY` 합성 데이터는 YouTube의 실제 이용 승인이나 실데이터 `READY`로 승격할 수 없다. 운영 데이터의 권한은 사용자 요청의 Boolean 값이나 클라이언트 role로 대체할 수 없다.

## 2. YouTube 공식 정책 검토 (2026-11-02 확인)

| 공식 확인 내용 | YOUTOPIA 설계 판단 | 검증 상태 |
|---|---|---|
| `commentThreads.list` / `comments.list`는 요청당 quota 비용 **1 unit**, `maxResults`는 **1~100**. 추가 페이지는 추가 요청 | 영상당 1페이지·최대 100개 상위 스레드부터 후보화 | 명세 확인, 프로젝트 미확인 |
| `commentThreads.list`는 `videoId`, `part`, `order=time`, `textFormat=plainText` 사용 가능. 대댓글 전체 수집은 별도 `comments.list(parentId)` 필요할 수 있음 | 첫 PoC에 대댓글 전수 수집 포함하지 않음. 100개는 **상한**이며 전체 댓글 대표 표본 아님 | 계약 후보 |
| 2026 추가 파생 규정은 댓글 NLP 감성 분석을 허용 가능한 사용 사례로 예시. 실제 적용은 개정 약관 수락 및 해당 감사·신청/사용 사례 승인 조건에 따름 | **기본 공개 댓글 조회와 추가 감성·파생지표 권한 분리** | DEC-G43-06 POLICY_HOLD |
| 승인된 추가 통계/파생 지표에는 조건부로 최대 36개월 보관 예외가 가능. 댓글 **원문·작성자명·제목**에는 기존 **30일 갱신/삭제** 규칙 유지 | 원문 36개월 보관 불가. 최초 PoC 영속 원문 저장 0을 기본 후보로 함 | 수명주기 미구현 |
| 저장된 사용자 관련 데이터 삭제 요청은 가능한 신속히, 적용 시 **7일 이내** 처리해야 함 | 삭제·철회·수정·캐시/백업 전파 및 기록 필요 | 미구현 |
| API 접근 쿼터는 프로젝트 단위이며 추가 쿼터는 별도 감사 절차 | 프로젝트 실제 한도·보안·사용량 확인. 임의 프로젝트로 쿼터 분산 금지 | 미확인 |

추가 파생 규정은 단순한 **허용 사례**와 **해당 API Client에 유효한 승인**을 구분해야 한다. 공식 문서는 일반적으로 지표 재계산을 제한하며, 2026년 개정의 예외는 감사/신청·승인된 분석 사용 사례에 적용된다. YOUTOPIA의 개별 프로젝트 승인 내역은 확인되지 않았다. 일반 공개 댓글 조회가 조건부로 가능한 경우에도 파생 감성 지표 생성은 별도 Gate가 필요하다.

공식 출처:
- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/developer-policies-guide
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://developers.google.com/youtube/terms/revision-history (2026-05-04 추가, 2026-06-01 보관 예외 설명)
- https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
- https://developers.google.com/youtube/data/reference/rest/v3/comments/list
- https://developers.google.com/youtube/data/guides/quota_and_compliance_audits
- https://developers.google.com/youtube/data/determine_quota_cost

## 3. 최초 실제 조회 PoC 후보 — 아직 호출 불가

| 항목 | 제한된 후보 |
|---|---|
| 대상 | `source=YOUTUBE`, `targetType=VIDEO`, 정규 11자리 `videoId` 1~3개 |
| 조회 | `commentThreads.list(part=snippet,videoId,maxResults=100,order=time,textFormat=plainText)` |
| 대댓글 | OFF. 필요 시 `comments.list(parentId)` 별도 계약과 quota 승인 |
| 페이지·Quota | 영상당 1페이지 / 1 API 요청, 최대 3요청·**3 units 예정치**. 실패·재시도·프로젝트 실제 한도는 별도 승인 |
| 트리거 | 인가된 운영자의 명시적 수동 실행만. Hover GET·방문·Worker 재시작으로 호출 금지 |
| 원문·개인정보 | 최소화, 저장·로그 비활성 기본. 데이터 수명주기 승인 전 실제 조회도 금지 |
| 결과 표시 | API 구조·상태·부분성 검증 후보. `NO_DATA/STALE/POLICY_BLOCKED` 구분, 합성 `READY` 금지 |
| 권한 | 서버만 현재 프로젝트/정책/tenant/role 결정. 운영 Job·결제·공개 없음 |

댓글 비활성, 비공개, 삭제, 403, 404, 쿼터 실패 또는 불완전한 페이지를 "전체 댓글 0"으로 임의 해석하지 않는다. 별도 samplingPolicyVersion, observationWindowId, locale 및 9필드 Scope 계약을 보존한다.

## 4. 단계별 착수 Gate

| 단계 | 작업 | 통과 증거 | 현재 |
|---|---|---|---|
| G45-A0 | 정책/수집 후보/오프라인 계약 문서 및 CI | 이번 Draft PR | DESIGN_DRAFT |
| G45-A1 | Google Cloud 프로젝트 소유, YouTube Data API 활성화, 키 제한·quota/사용량 확인 | 민감값 제외 검수 기록 | NOT_VERIFIED |
| G45-A2 | 기본 YouTube API TOS, 수집·표시·개인정보·삭제 정책 적합성 검토 | 책임자, 근거, 범위/기한, 필요시 제공자 확인 | POLICY_HOLD |
| G45-A3 | 2026 추가 파생 지표 규정 수락 및 신청/감사·해당 사용 사례 승인 여부 | 프로젝트·사용 사례에 유효한 증거 | POLICY_HOLD |
| G45-A4 | 원문 30일 갱신/삭제, 사용자 요청 7일, 철회·캐시·로그·백업 전파 | 독립 기능/테스트 검증 | NOT_IMPLEMENTED |
| G45-A5 | 영상 1~3개/호출·quota·실행자·폐기 계획 및 최초 **실호출 별도 승인** | 구체적 사용자 승인 + 최신 프로젝트/정책 증거 | NOT_APPROVED |
| G45-A6 | A1/A2/A4/A5 통과 시에만 제한된 실데이터 조회 PoC | 실제 API 결과·quota·접근/삭제 로그 | NOT_RUN |
| G45-A7 | A3 포함 모든 파생지표 Gate 통과 후 별도 감성 분석 실험 | 출처·지표 정의·분모·삭제·모델 검증 | POLICY_HOLD |

**G45-A3의 파생 지표 승인이 없더라도**, 기본 API 읽기 자체가 별도로 허용되는지는 A1/A2/A4/A5에서 판단한다. 다만 승인 전에는 조회조차 실행하지 않는다. 정책 해제는 이 문서나 코드의 `approved: true` 값으로 자동 이루어지지 않는다.

### 서버 수집기 실행 환경 결정 (2026-11-02, 설계 승인만)

사용자는 **최초 실제 공개 댓글 조회 PoC의 실행 위치를 Chrome/프런트엔드가 아닌 백엔드 서버로 제한**하는 방향을 승인했다. 후보는 **비공개 수동 Cloud Run Job**이며, 서버 API 키에 YouTube Data API v3 API 제한과 **고정 공인 출구 IP 제한**, Secret Manager·전용 Service Account를 적용하도록 설계했다. Cloud Run/Cloud NAT/예약 IP/Secret Manager의 실제 리소스 생성 및 비용 승인은 아직 이루어지지 않았다. [G4-5 서버 전용 수집기 설계](./YU32_G4_5_SERVER_COLLECTOR_HOSTING_SECURITY_V01.md)를 참조한다. API 키·Cloud API·실데이터·배포·댓글 원문·NLP 모두 변경 없음.

## 5. Track B — 병렬 서버 안정성 경계

G44-P3 PR #46은 별도 Draft이며 현재 Lab 프로세스·Outbox 합성 검증과 실제 API 권한은 무관하다. 후속 Track B의 우선 작업은 `G44-T31~T33` 예산 정산/SQLSTATE 경합 및 Spring 세션/CSRF/tenant BOLA/RestoreFence E2E다. 기존 읽기 전용 `ytp_app_data_ro`를 분석 쓰기 계정으로 전환하지 않고 `SecurityConfiguration.anyRequest().denyAll()`도 유지한다. 운영 Job 생성·Snapshot 공개는 여전히 승인 금지다.

## 6. 남은 결정

- `DEC-G43-06` — YouTube 이용권/파생 지표/원문 보존·삭제: **POLICY_HOLD**.
- `DEC-G45-01` — Google Cloud 프로젝트 소유/약관 수락/감사 신청·승인 증거 책임자.
- `DEC-G45-02` — 첫 공개 영상 PoC 대상·접근방식(API 키/소유자 OAuth)의 정확한 범위. 기본값은 비공개·소유자 OAuth 미포함.
- `DEC-G45-03` — 원문 지속 저장 0 기본값, 삭제·철회·백업/관측 조정 및 책임자.
- `DEC-G45-04` — 구체 영상·최대 quota·인증·기록·비용 등 첫 API 호출 별도 승인.

**최종 판정: 계약·준수 준비 작업만 진행. LIVE_API=0 / RAW_COMMENTS=0 / NLP=0 / PROD=NOT_APPROVED / POLICY_HOLD 유지.**
