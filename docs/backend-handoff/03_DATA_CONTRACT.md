# YUTOPIA Data Contract v0.1 — 원본·모집단·계보·모델

> **DRAFT / REQUIRES_BACKEND_REVIEW / NOT IMPLEMENTED** · 원격 기준 커밋: `344c1e2794c4f6144fa7506f65a17c392487c540`.
>
> 아래 **FE_ACTUAL**은 실행 중인 로컬 React 데모의 타입/값, **BE_PROPOSED**는 백엔드 공동 검토가 필요한 인터페이스 개념을 뜻한다. 숫자, 특정 프로젝트/영상/댓글 ID와 시각은 모두 합성 시나리오의 예시이며 실제 YouTube 결과나 운영 규칙이 아니다.

## 처음 읽는 분께 — 데이터란 무엇인가요?

**데이터 계약은 “값의 이름과 뜻을 사람마다 다르게 이해하지 않게 만드는 규칙”입니다.** 이름이 비슷한 숫자를 같은 뜻으로 사용하면 화면·분석·보고서가 서로 다른 결과를 보여줍니다.

**예시(모두 합성 데모 데이터):**

```text
원시 댓글 12,842건
  ├─ 분석 대상으로 쓸 수 있는 댓글 10,204건
  │    ├─ 감성 분류 완료 8,421건
  │    └─ 아직 분류하지 않은 대상 1,783건
  └─ 제외하거나 보류한 댓글 2,638건
```

즉, **분석 대상 10,204건은 감성 분류 완료 10,204건이 아닙니다.** 또한 `null`은 수집하지 못해 **모르는 값**, `0`은 확인했더니 **정말 0건**을 뜻합니다. “39/39일”은 테스트의 날짜 칸이 모두 있다는 의미이지 YouTube의 모든 댓글을 수집했다는 증거가 아닙니다.

- 처음이라면 [00 입문 안내서](./00_START_HERE.md)와 [07 숫자 검증 주석 예제](./07_BEGINNER_IMPLEMENTATION_GUIDE.md)를 먼저 읽으세요.
- `FE_ACTUAL` = 현재 React 데모에 있는 타입/값, `BE_PROPOSED` = 실제 서버에 필요한 기능 제안입니다. 백엔드 DB 테이블이 이미 존재한다는 뜻이 아닙니다.


## 1. 정본 소스

| 영역 | 실제 코드 |
|---|---|
| 프로젝트 입력·검증·수집 상태 | `frontend/src/features/project-demo/ProjectDemoProvider.tsx` |
| 고정 fixture·원본/분류 수치·소스 | `frontend/src/features/project-demo/nexusDemoData.ts` |
| 39일 비교·근거·주장 검토 | `frontend/src/features/project-demo/trendEvidenceModel.ts` |
| 칸반 이슈·담당·권한·감사 | `frontend/src/features/project-demo/issueBoardModel.ts`, `ReviewWorkflowProvider.tsx` |
| 허용 근거 번들·보고서 초안·상태 | `frontend/src/features/project-demo/reportDemoModel.ts` |
| 라우팅/프로젝트 ID | `frontend/src/app/routeDefinitions.ts` |
| 브라우저 재현 테스트 | `frontend/src/app/*test.tsx`, `frontend/e2e/yutopia.spec.ts` |
| 정책 상위 근거 | [YUTOPIA 기준선](https://app.notion.com/p/3f979b3cd8e6813cb5ddef402778c7c6), [수집·Lineage](https://app.notion.com/p/3be79b3cd8e6815cb8ebfb9f1bf95408) |

## 2. FE_ACTUAL: 프로젝트·수집

**`ProjectDraft` 실제 필드:** `projectName: string`, `game: string`, `eventName: string`, `eventDate: string`, `observationStart: string`, `observationEnd: string`, `selectedVideoIds: string[]`, `analysisPurpose: string`. 현재 `validateProjectDraft()`는 필수값·ISO 날짜·시작/종료 역전·사건일 포함·비교창 포함·선택 3개·중복 ID·미지원 영상을 검사하며 **데모 사건일만 `2025-03-25`로 고정**한다.

**`ProjectDemoProvider` 메모리 상태:** `project: ProjectDraft|null`, `projectId: string|null`, `collectionStatus: CollectionStatus|null`, `attempt: number`. `createProject()`는 유효한 시나리오를 로컬 저장하고 고정 프로젝트 ID를 반환하며 수집을 `QUEUED`로 초기화한다. `retryCollection()`은 `attempt` 증가 후 다시 QUEUED, `resetDemo()`는 초기화한다. **서버 소유권·데이터 영속화·진짜 실행 ID가 없다.**

**`CollectionStatus` 실제 값:** `QUEUED | RUNNING | PARTIAL | FAILED | SUCCEEDED`. `DEMO_COLLECTION_METRICS`의 `raw`, `eligible`, `excluded`는 각각 `number | null`이다. QUEUED/FAILED의 세 값은 **null = 미확정**이지 실제 0이 아니다. RUNNING `4,280 = 3,200 + 1,080`; PARTIAL `8,420 = 6,510 + 1,910`; SUCCEEDED `12,842 = 10,204 + 2,638`.

**BE_PROPOSED:** `Project`에 서버 발급 불변 ID, `ownerId`/조직, 생성·갱신 시간, 버전/ETag, `GameEvent`, 여러 `SelectedVideo`를 연결한다. `CollectionRun`에는 run ID, 프로젝트 ID, 멱등 요청 ID, attempt, 상태, source scope 버전, 측정 정의 버전, 생성/완료 시각, 실패 reason 및 재시도 가능 여부를 갖는다. Quota·삭제·중단·부분 결과의 정확한 전이는 미승인. SQL 테이블 구조/DB 엔진도 미정.

## 3. FE_ACTUAL: 관측 출처와 분모

고정 프로젝트 `nexus-season-2`(운영 ID 포맷 아님), 데모 채널 `NEXUS 공식 YouTube 채널`(실제 채널 식별/소유 검증 없음), 동영상 ID `update-trailer-0318` / `patch-notes-0324` / `developer-live-0325`(진짜 YouTube `videoId`라는 근거 없음), 각각 게시일 `2025-03-18`, `2025-03-24`, `2025-03-25`.

| 분모·단위 | 데모 값 | 정의 |
|---|---:|---|
| `rawComments` | 12,842 | 고정 39일 관측량 합계 |
| `eligibleComments` | 10,204 | 로컬 분석 대상 |
| `excludedComments` | 2,638 | 제외/보류 |
| `classifiedComments` | 8,421 | 데모 분류 완료 |
| `unclassifiedEligibleComments` | 1,783 | 대상 중 미분류 |
| `reviewCandidates` | 28 | 사람 검토 후보·분류/카테고리 합과 별개 |
| 긍정/중립/부정 분류 | 4,884 / 2,021 / 1,516 | 합계 8,421 |
| 이슈 TOP5 다중 라벨 할당 | 3,731 | `1,284+892+621+498+436`; 고유 댓글 수가 아님 |

**산술 불변식(서버에서 실제 데이터로 보증할 것):**
- `raw = eligible + excluded`는 동일 run/정의/범위에서 값이 **확정된 경우에만** 확인.
- `eligible = classified + unclassifiedEligible`, `classified = positive + neutral + negative`는 실제 분류 체계/분모가 합의될 때에만 보증.
- 다중 라벨 `issueAssignmentCount`는 unique comment 수와 합이 같을 필요가 없다.
- 컬렉션 완료(`SUCCEEDED`)와 실제 댓글 감성 분석 완료는 **별개 프로세스**이다.
- 누락/미수집/권한 차단/삭제/미집계는 숫자 `0`과 구분해 명시적 `availability`와 nullable count를 사용한다.

## 4. FE_ACTUAL: 시간·비교·커버리지

- 전체 관측 창: `2025-03-01~2025-04-08` **양 끝 포함 39일**.
- 패치 전: `2025-03-11~2025-03-24` 14일, **3,543 rawComments**.
- 패치 후: `2025-03-25~2025-04-07` 14일, **7,244 rawComments**.
- 비교 외: `2025-03-01~03-10` 및 `2025-04-08` 11일, **2,055 rawComments**.
- `3,543 + 7,244 + 2,055 = 12,842`, `14+14+11=39`. 이 합계는 **동일 `DEMO_DAILY_OBSERVATIONS` 배열에서 파생**한다.
- `DEMO_TREND_OBSERVATION.coverage`는 `expectedDays:39`, `observedDays:39`, `missingIntervals:[]`을 가진다. 이는 **fixture 일별 슬롯 완전성**일 뿐 플랫폼 수집 모집단 전체 커버리지가 아니다.
- `ComparabilityInput`: `publicationDates`, `videoCohorts`, `coverage`, `measurementConsistency` 각 `PASS|WARN|FAIL`. 하나라도 FAIL이면 `INCOMPARABLE`, 아니고 WARN이면 `CONDITIONAL`, 전부 PASS면 `COMPARABLE`. 현재 게시일·코호트 WARN으로 `CONDITIONAL`.
- 다른 코호트의 댓글 수 변화를 패치 인과, 전체 관심도, 시장 인기, 실제 이용자 수로 해석/승격하지 않는다. Figma 설명용 2,150/4,100과 코드 파생 3,543/7,244의 차이는 현재 **의도적 데모 콘텐츠 불일치**로 기록한다.

**BE_PROPOSED:** `ObservationWindow`, `ComparisonWindow`, `ComparabilityFactor`에 비교 기준/코호트 ID/게시 시각/선정 규칙/동일 측정 단위를 포함한다. `Coverage`를 최소 `dateSlotCoverage`, `sourceResponseCoverage`, `eligiblePopulationCoverage`처럼 **계층별로 구별**할지 결정해야 한다.

## 5. FE_ACTUAL: 댓글·이슈·근거·업무

- `SentimentId`: `positive | neutral | negative | unclassified`. `DemoRepresentativeComment` = `id, issueId, sentiment, text, videoId, observedAt`; 실제 ID가 `SYN-*`이므로 **합성 원문**이다.
- `DemoIssueId`: `PERF-001 | PAY-002 | STAB-005 | BAL-003 | CONT-004`. `DemoIssue` = `id, category, count, state: OBSERVED|HOLD|CANDIDATE, summary, interpretation, evidencePath`.
- `ClaimEvidence`: `id, issueId, sourceId, observedAt, retrievedAt, availability, lineage, coverage, policyState, synthetic`. `availability`는 `AVAILABLE|MISSING|DELETED|EXPIRED|STALE|ACCESS_DENIED|SYNTHETIC|BLOCKED`; `lineage`는 `SOURCE_OBSERVATION|DERIVED_METRIC|SIMULATED_EXCERPT`; `policyState`는 **데모** `DEMO_ONLY|HOLD`뿐이다.
- `ClaimReview`: `issueId, title, statement, permittedConclusion, status, reasonCodes, uncertainty, evidence[], realWorldVerified`. 현재 `DEMO_CLAIM_REVIEWS`는 PERF-001·PAY-002·BAL-003만 별도 증거를 갖는다. **모든 칸반 이슈에 실제 증거가 완성된 것은 아니다.**
- `ClaimReviewStatus`: `OBSERVED_ONLY|HOLD|CONDITIONAL|BLOCKED`; `ClaimReasonCode`: `SYNTHETIC_SOURCE|COHORT_MISMATCH|TECHNICAL_VALIDATION_REQUIRED|CAUSALITY_NOT_ESTABLISHED|MISSING_EVIDENCE|STALE_EVIDENCE|POLICY_BLOCKED`.
- `DemoIssueRecord`: `id, title, summary, claimState, status, assignee, evidenceIds[], reviewDecision, audit[]`. `IssueStatus = WAITING|IN_PROGRESS|COMPLETED|REJECTED`; `IssuePermission = EDITOR|VIEWER|DENIED`; `reviewDecision = PENDING|SIMULATED_REVIEWED|REJECTED|HOLD`.
- `IssueAuditEvent`: `id, issueId, timestamp, actor='DEMO_REVIEWER_UNAUTHENTICATED', action, detail`. **인증된 서버 이벤트가 아님.**
- `ReviewWorkflowProvider`는 현행 프로젝트 변화 시 이슈 목록을 초기화하는 React 메모리 관리. `COMPLETED`(작업 종료)는 `realWorldVerified` 또는 정식 보고 승인과 동등하지 않다.

## 6. FE_ACTUAL: 근거 번들·보고 초안

- `AllowedEvidenceBundle`: 고정 `id`/프로젝트 ID, `permission = LOCAL_MASKED_DEMO|DENIED`, `policyState = LOCAL_DEMO_ONLY|POLICY_BLOCKED`, source IDs, observation/comparison/coverage, comparability, totals, evidence[], 허용 관측 ID, 금지 결론 ID, 마스킹·파생 지표 고지.
- `ReportEvidenceReference`: `evidenceId, issueId, sourceId, availability, lineage, synthetic, masked, includedInPrompt, realWorldVerified:false, reviewReason`.
- `ReportDraft`: 고정 ID/제목/시각/`state:DEMO_DRAFT`, `formallyApproved:false`, `shareable:false`, `exportable:false`, sections[], observationCandidateIds[], excludedConclusionIds[], disclosures[].
- `buildAllowedEvidenceBundle`은 합성 댓글 본문을 프롬프트에서 제외한다. 권한 `DENIED`면 `buildReportDraft`가 null이다. `PERF-001` 관측 후보만 표시하고 `PAY-002`는 결론에서 제외한다.
- `SIMULATED_SUCCESS`는 **로컬 미리보기 성공 상태**이지 보고서의 공식 승인이나 외부 내보내기 성공이 아니다.

**BE_PROPOSED:** 실제 `AllowedEvidenceBundle`은 서버가 원문 사용권/권한/보존/마스킹/계보를 재평가하고 버전화해야 한다. `ReportDraft`의 정식 작성·승인·내보내기·공유는 **서로 다른 권한·감사 상태**로 설계해야 한다. 현재 고정 TypeScript literal IDs/false 필드를 운영 API가 그대로 보장한다고 주장하지 않는다.

## 7. 제안 Lineage 및 실패 의미

**후속 백엔드 추적 계약 후보:** `scope_contract_version → collection_run_id → request_id → raw_response_ref → normalization_version → normalized_observation_ref`. 이는 [공통 수집·Lineage 정본](https://app.notion.com/p/3be79b3cd8e6815cb8ebfb9f1bf95408)의 원칙이며, **현재 프론트 코드의 구현 필드 전체가 아니다**.

추가 서버 응답 설계 시 `source`, `source_id`, `observed_at`, `retrieved_at`, `availability`, `coverage`, `raw_or_derived`, `policy_state`, `lineage`, `schema_version`, `run_id`의 필요성과 필수성/널 허용 조건을 각 resource별로 결정한다. 영상/댓글이 삭제·수정·비공개·권한 불일치·quota 부족 시 이력을 파기하거나 0으로 치환하지 않는다. 단, 원본 보관 가능 기간·법적 허용 범위는 먼저 정책 승인 필요.

## 8. 설계 결정 필요 사항

1. ID 생성 및 소유권, 시각 형식: 현재 `2025-04-08 09:05 KST`와 같은 **표시 문자열은 ISO 8601 API timestamp가 아님**. 서버 UTC offset 포함 타임스탬프·원문 시각·표시 TZ 규칙 결정.
2. 댓글 페이지네이션/정렬/삭제·분류 버전과 다중 라벨 counting 정의.
3. 플랫폼 실제 수집률과 fixture 일별 슬롯 커버리지의 구별.
4. 업무 완료 vs 주장 판정 vs 보고서 승인/배포의 독립 상태 및 감사 권한.
5. 실제 YouTube 사용권·파생 분석·외부 전송·보관·삭제 기준 승인.
6. DB 제약·인덱스·작업 재실행/동시성·Idempotency 구현 선택.
