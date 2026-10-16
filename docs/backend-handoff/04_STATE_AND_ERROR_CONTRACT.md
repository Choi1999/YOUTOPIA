# YUTOPIA State & Error Contract v0.1

> **DRAFT / REQUIRES_BACKEND_REVIEW / NOT IMPLEMENTED** · 프론트 소스 SHA `344c1e2794c4f6144fa7506f65a17c392487c540`.
>
> `FE_ACTUAL`은 React 메모리 시뮬레이터의 상태/전이, `BE_PROPOSED`는 서버 계약 제안이다. UI 시뮬레이션의 성공을 인증된 실행·감사·승인으로 해석하면 안 된다.

## 처음 읽는 분께 — 상태(State)는 무엇인가요?

**상태는 “지금 작업이 어디까지 진행됐는지” 나타내는 표시입니다.** 예를 들어 수집 작업은 다음 단계로 보여줄 수 있습니다.

```text
QUEUED   : 작업을 접수했지만 아직 시작하지 않음
RUNNING  : 작업이 진행 중
PARTIAL  : 일부 데이터만 얻음
FAILED   : 작업 실패 (이유/재시도 가능 여부 필요)
SUCCEEDED: 수집 작업 완료 (감성 분류/보고 승인 완료는 아님)
```

**오류(Error)는 “왜 성공하지 못했는지”에 관한 정보입니다.** 예를 들어 `401`은 로그인 여부를 확인할 수 없다는 뜻이고, `403`은 로그인했더라도 **그 작업을 할 권한이 없다**는 뜻입니다. `HOLD`는 오류와 달리 **판단을 보류한다는 정책 상태**입니다.

가장 중요한 구분: **칸반 업무 `COMPLETED` ≠ 실제 주장 `VERIFIED` ≠ 보고서 공식 `APPROVED`**. 현재 데모에는 실제 서버 기반 승인 단계가 없습니다.

- [00 입문 설명](./00_START_HERE.md) · [02 HTTP 오류 응답 예시](./02_API_EXPLAINED.md#4-예시-c--서버-오류-표시하기) · [07 주석 예시](./07_BEGINNER_IMPLEMENTATION_GUIDE.md)


## 1. 상태 축을 하나로 합치지 않는다

| 축 | FE_ACTUAL | 구분해야 할 사실 |
|---|---|---|
| 서비스 로그인 | `LoginPage.tsx`의 현재 페이지 세션 | 서버 `UserSession` 없음 |
| 채널 연결 | `not-connected/review/approved/denied/cancelled/expired` | Google OAuth 실제 동작 아님 |
| 프로젝트 | `ProjectDraft|null` 및 고정 ID | 서버 저장/소유권 없음 |
| 수집 실행 | `QUEUED/RUNNING/PARTIAL/FAILED/SUCCEEDED` | 수집 완료 ≠ 분석 완료 |
| 데이터 렌더 | `loading/empty/partial/failed/stale/unavailable/success` | UI 표시 축, 서버 Job 상태와 1:1 대응 아님 |
| 비교 가능성 | `COMPARABLE/CONDITIONAL/INCOMPARABLE` | 댓글 수 변화 자체가 인과적 증가 증거는 아님 |
| 근거 가용성 | `AVAILABLE/MISSING/DELETED/EXPIRED/STALE/ACCESS_DENIED/SYNTHETIC/BLOCKED` | 접근 가능 ≠ 권리 허용 ≠ 주장 검증 |
| 주장 판정 | `OBSERVED_ONLY/HOLD/CONDITIONAL/BLOCKED` | 실제 `VERIFIED` 상태는 현재 데모에 없음 |
| 이슈 업무 | `WAITING/IN_PROGRESS/COMPLETED/REJECTED` | 담당 업무 완료 ≠ 주장 판정 완료 |
| 보고 UI | `IDLE/SIMULATED_RUNNING/AWAITING_REVIEW/SIMULATED_SUCCESS/FAILED/RETRY/UNAVAILABLE/POLICY_BLOCKED` | 보고 미리보기 성공 ≠ 공식 보고 승인 |
| 정식 보고 승인 | `ReportDraft.formallyApproved = false` | 실서비스 승인 프로세스 자체 미구현 |

## 2. FE_ACTUAL: YouTube Consent

근거: `frontend/src/features/youtube-consent/YoutubeConsentProvider.tsx`. `beginReview`→`review`, `approve`→`approved`, `deny`→`denied`, `cancel`→`cancelled`, `expire`→`expired`, `disconnect`→`not-connected`. 현재 Provider 함수는 서버식 전이 검증 없이 상태를 로컬 변경한다. 라우트 `/connect/youtube/complete`는 직접 접근/새로고침으로 유효 승인 상태를 만들어내지 않는다.

**BE_PROPOSED:** 실제 승인 영수증은 서버 측 provider callback 검증, scope 비교, 유효기간/철회/CSRF state, 세션/소유자 결속을 거쳐야 한다. `SCOPE_MISMATCH`, `CONSENT_DENIED`, `CONSENT_CANCELLED`, `CONSENT_EXPIRED`, `CONSENT_REVOKED` 같은 오류는 **후보 reason code**이며 현재 소스에 동일 문자열이 존재한다는 뜻이 아니다. 공개 영상 관측은 별도의 정책 결정이 있기 전 임의로 OAuth 필수 경로에 묶지 않는다.

## 3. FE_ACTUAL: Project & Collection

근거: `ProjectDemoProvider.tsx`, `nexusDemoData.ts`.
- `createProject(validDraft)` 후 `projectId = nexus-season-2`, `collectionStatus = QUEUED`, `attempt = 1`.
- UI 조작에 따라 `RUNNING`, `PARTIAL`, `FAILED`, `SUCCEEDED` 상태를 나타내지만 `setCollectionStatus()` 자체에 서버 수준의 상태 전이 허용 목록은 없다. `retryCollection()`은 시도를 늘리고 QUEUED로 돌아간다.
- QUEUED와 FAILED의 원시/분석대상/제외 수치는 `null`, **0이 아님**. RUNNING/PARTIAL의 확정 집계는 서로 더해지는 동일 정의를 유지한다.
- 새로고침·직접 URL·새 세션에서 React 데이터가 유실된다. 강제 복원/성공 생성 금지.

**BE_PROPOSED (전이 초안, 합의 필요):**

```text
CREATED/QUEUED → RUNNING → SUCCEEDED
                  │  ├→ PARTIAL (근거·누락·재시도 기록)
                  │  └→ FAILED (사유·재시도 가능 여부)
PARTIAL / FAILED → 새 attempt(QUEUED) [명시적 재시도, 멱등성 검증]
CANCELLED/DELETED/EXPIRED/QUOTA_LIMITED → 제품 정책과 별도 설계 필요
```

- 실제 Job의 부분 결과·실패 후 사용 가능 데이터, 강제 취소·재시도 중복 처리, out-of-order 이벤트/버전, 수집 결과 공개 권한은 결정 전.
- 서버의 `SUCCEEDED`는 원본 수집 단계를 끝냈다는 의미로 한정하며 **classificationStatus**는 별도 모델을 정의해야 한다.

## 4. FE_ACTUAL: Comparability & Claim Evidence

근거: `trendEvidenceModel.ts`.

`evaluateComparability()`는 요인 4개(`publicationDates`, `videoCohorts`, `coverage`, `measurementConsistency`) 중 `FAIL`이 하나라도 있으면 `INCOMPARABLE`, 없고 `WARN`이 있으면 `CONDITIONAL`, 전부 `PASS`면 `COMPARABLE`. 현재 fixture에는 게시일/영상 집합 경고가 있어 CONDITIONAL이며 `verifiedIncreaseBlocked = true`.

`transitionClaimReview(claim, action)`의 실제 행동:

| 조건/행동 | FE_ACTUAL 결과 |
|---|---|
| `ATTEMPT_VERIFY`, 일반 주장 | `BLOCKED` 및 `POLICY_BLOCKED` reason, `realWorldVerified:false` |
| `ATTEMPT_VERIFY`, PAY-002 | `HOLD` 유지, `realWorldVerified:false` |
| `KEEP_OBSERVATION`, 비 PAY | `OBSERVED_ONLY`, 실제 검증 아님 |
| `PLACE_HOLD`, 비 PAY | `HOLD`, 실제 검증 아님 |
| `REQUEST_REVIEW`, 비 PAY | `CONDITIONAL`, 실제 검증 아님 |
| 기타 PAY-002 검토 행동 | 항상 `HOLD` |

`canVerifyRealWorldClaim()`는 모든 근거가 `AVAILABLE`이고 `synthetic:false`, reason code가 0개이며 `realWorldVerified:true`일 때만 true이다. **현재 fixture와 승인/정책 상황에서 이 조건을 실증할 수 없다.** `simulateEvidenceAvailability()`은 표시 가용성을 바꾸더라도 `synthetic:true`를 유지한다.

**BE_PROPOSED:** 원본 검증 권한, 출처/버전/허용권, 기술 장애 재현, 비교 설계와 사람 서명을 별도로 검증해야 실제 검증 전이를 설계할 수 있다. `PERF-001`은 관측 불만 후보, `PAY-002` 증가 주장은 `HOLD`로 고정. `HOLD` 제거·승격은 새로운 권위 있는 검토/근거 절차를 사전 합의하기 전에는 API로 허용하지 않는다.

## 5. FE_ACTUAL: Issue Task & Audit

근거: `issueBoardModel.ts`, `ReviewWorkflowProvider.tsx`.

| From | 허용 To |
|---|---|
| `WAITING` | `IN_PROGRESS`, `REJECTED` |
| `IN_PROGRESS` | `WAITING`, `COMPLETED`, `REJECTED` |
| `COMPLETED` | `IN_PROGRESS` |
| `REJECTED` | `WAITING` |

- **권한과 오류**
  - **권한:** `EDITOR`, `VIEWER`, `DENIED`.
  - **수정 허용:** 상태 변경과 담당자 변경은 `EDITOR`만 가능.
  - **오류 코드:** `PERMISSION_DENIED`, `HOLD_PROMOTION_BLOCKED`, `INVALID_TRANSITION`.

- **PAY-002의 현재 차단 규칙**
  - `PAY-002 → COMPLETED` 요청은 `HOLD_PROMOTION_BLOCKED`.
  - **이유:** 현재 데모의 보수적인 HOLD 보호 정책.
  - **후속 설계 문제:** 업무 완료와 주장 검증이 혼동될 수 있음.
  - **서버에서 검토할 것:** 업무 해결(task resolution)과 주장 검증(claim verification)의 상태를 별도 필드로 분리.
  - **주의:** 분리 작업을 하더라도 기존 HOLD 차단을 임의로 해제하면 안 됨.

- **감사 기록과 공유**
  - **현재 actor:** `DEMO_REVIEWER_UNAUTHENTICATED` (실제 인증된 사람 아님).
  - **기록 시각:** 고정 데모 시간이며 서버 감사 로그가 아님.
  - **Cycle 9 공유 상태:** `ReviewWorkflowProvider`가 YU-11 상태를 YU-12에 전달.
  - **초기화:** 프로젝트 리셋/새로고침·재진입에서는 상태가 초기화됨.

**BE_PROPOSED — 앞으로 서버에서 해야 할 것**

- 클라이언트의 역할(`EDITOR` 등) 문자열을 인증 증거로 믿지 않음.
- 요청마다 세션·조직·프로젝트·담당 권한을 서버에서 확인.
- 상태 버전·행위자·UTC 시각·이전/다음 값·근거 스냅샷을 **원자적 감사 트랜잭션**으로 기록.
## 6. FE_ACTUAL: Report Preview

근거: `reportDemoModel.ts`.

| From + Action | To |
|---|---|
| IDLE + START | SIMULATED_RUNNING |
| SIMULATED_RUNNING + COMPLETE_DRAFT | AWAITING_REVIEW |
| AWAITING_REVIEW + COMPLETE_PREVIEW | SIMULATED_SUCCESS |
| SIMULATED_RUNNING + FAIL | FAILED |
| FAILED + PREPARE_RETRY | RETRY |
| RETRY + START | SIMULATED_RUNNING |
| any + RESET | IDLE |
| any + MARK_UNAVAILABLE | UNAVAILABLE |
| any + BLOCK_POLICY | POLICY_BLOCKED |

그 외 조합은 현재 상태를 유지한다. `DENIED` 번들은 `POLICY_BLOCKED`로 프롬프트/보고서 생성이 차단된다. 합성 원문은 마스킹되고 프롬프트에 포함되지 않는다. 생성되는 `ReportDraft`는 항상 `formallyApproved:false`, `shareable:false`, `exportable:false`이다. `SIMULATED_SUCCESS`는 UI 프리뷰 성공일 뿐 보고서 확정이 아니다.

**BE_PROPOSED:** `ReportGenerationJob`, `ReportDraftVersion`, `ReportApproval`, `ExportPermission`을 분리. 보고서 승인/발행은 독립 권한·유효 근거·적법한 데이터 전달·감사 기록을 모두 요구한다. 현재 내보내기·공유/외부 호출은 **미승인 HOLD**.

## 7. 오류 envelope / HTTP 후보 — 서버 미구현

`02_API_CONTRACT.yaml`의 `ApiError` 제안: `error.code`(기계적 식별자), `error.message`(안전한 사용자 설명), `error.retryable`, `error.details`(민감정보 제외), `requestId`(추적). 상태 코드는 현재 서버의 실제 구현을 뜻하지 않는다.

| 후보 HTTP | 이유/사용자 다음 행동 |
|---|---|
| 400/422 | 파라미터·날짜·영상 선택 잘못됨 → 입력 수정 |
| 401 | 세션 없음/만료 → 재로그인; 데모 계정을 운영 계정으로 취급 금지 |
| 403 | 소유권/역할/정책 거부 → 권한 요청 또는 작업 중단 |
| 404/410 | 대상/원문 없음 또는 삭제 → 가용성·출처 상태 보존 |
| 409/412 | 상태 전이 불가·버전 충돌·멱등 요청 충돌 → 새 상태 조회 |
| 429 | 공급자 quota 또는 서비스 요청 제한 → 안전한 재시도 정책 |
| 500/502/503 | 내부/외부 API 실패 → 중복되지 않는 재시도·부분 결과 안내 |

**후보 reason code:** `PROJECT_NOT_OWNED`, `COLLECTION_NOT_READY`, `DATA_UNAVAILABLE`, `SOURCE_DELETED`, `SOURCE_ACCESS_DENIED`, `SOURCE_QUOTA_EXCEEDED`, `SCOPE_MISMATCH`, `POLICY_BLOCKED`, `CONCURRENT_UPDATE`, `RETRY_NOT_ALLOWED`. 이는 **프론트 실제 리터럴이 아닌 BE_PROPOSED**이다. 기존 `IssueTransitionError`와 `ClaimReasonCode`는 출처가 있는 별도 도메인 상태로 보존한다.

## 8. 계약 테스트 및 미결정

- 모든 실패·부분 수집·삭제·만료·결측 응답에서 `null`과 실제 0이 구분돼야 한다.
- 서버 지연/중복 이벤트와 재시도에 임의로 결과가 덮어써지지 않는지 확인한다.
- 재연결/동의철회 시 적법한 접근을 즉시 재평가하고 권한 차단을 우회하지 않는다.
- 동일 사용자가 아닌 사람의 프로젝트/근거/보고서 접근·수정 403, 삭제와 갱신 경계.
- 동시성·idempotency key·retry-after·사용권 갱신·실제 감사·실제 검증승격 절차는 **승인 전 공백**.
- 각 테스트는 `SIMULATED` / `LOCAL_BROWSER_E2E` / `PRODUCTION_INTEGRATION`으로 증거를 분리한다. 상세 테스트 표는 [06](./06_ACCEPTANCE_TEST_CONTRACT.md).
