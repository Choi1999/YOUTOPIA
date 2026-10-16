# YUTOPIA Acceptance & Contract Test v0.1

> **DRAFT / REQUIRES_BACKEND_REVIEW / PRODUCTION_INTEGRATION NOT TESTED**
>
> 기준 소스 SHA `344c1e2794c4f6144fa7506f65a17c392487c540`. 아래의 기존 테스트 개수는 **2026-10-16 Codex가 제출한 실행 보고**에 의존하며, 이 문서 작성자가 로컬 Windows 테스트 환경을 다시 실행한 증거는 아니다. API는 실재하지 않으므로 provider contract와 실제 운영 E2E는 아직 **실행 불가능**하다.

## 처음 읽는 분께 — 테스트에서 무엇을 확인하나요?

테스트는 “코드가 동작하는 것처럼 보인다”가 아니라 **예상한 결과가 실제로 나오는지 확인하는 절차**입니다. 정상 흐름뿐 아니라 잘못된 입력, 권한 부족, 데이터 누락도 검사해야 합니다.

| 테스트 종류 | 쉬운 설명 | 현재 상태 |
|---|---|---|
| 단위 테스트 | 계산 함수 등 작은 기능 하나가 맞는지 확인 | 프론트 데모 92개 통과 *보고* |
| 브라우저 E2E | 사용자가 실제 화면을 순서대로 클릭하는 흐름 검증 | 로컬 Chromium 40개 통과 *보고* |
| 서버 계약 테스트 | 백엔드 API가 승인된 JSON·오류 코드를 반환하는지 확인 | **아직 서버 없음** |
| 통합 테스트 | 프론트↔서버↔DB/Worker가 함께 동작하는지 확인 | **아직 미실행** |

**예시:** 서버에 `raw=100, eligible=80, excluded=15`가 있으면 `100 ≠ 80+15`이므로 합계 검증이 실패해야 합니다. `raw=null`이면 “모름”을 0으로 바꾸면 안 됩니다. `VIEWER`가 다른 사람의 이슈를 수정하려고 하면 서버가 차단해야 합니다.

- [00 입문](./00_START_HERE.md) → [02 API 요청/응답](./02_API_EXPLAINED.md) → [07 주석·테스트 예제](./07_BEGINNER_IMPLEMENTATION_GUIDE.md).
- 아래 `LOCAL_OK`는 실제 데이터나 백엔드 통합 완료가 아니라 **로컬 화면 시뮬레이션 수준**입니다.


## 1. 증거 레벨

| 분류 | 허용 주장 | 금지되는 비약 |
|---|---|---|
| `SIMULATED` | Vitest/jsdom, 결정적 모델·렌더·상태 게이트 | 실제 OAuth·수집·분류·DB 기능 통과 |
| `LOCAL_BROWSER_E2E` | 로컬 Chromium UI 라우팅·클릭·폼·반응형·axe | 서버/실 API·실데이터 통합 완료 |
| `PROVIDER_CONTRACT` (미검증) | 승인된 OpenAPI를 구현한 서버의 schema·상태·인증 응답 | 소비자 E2E 전체 성공 |
| `STAGING_INTEGRATION` (미검증) | 테스트용 서버·DB·Worker에서 재현된 계약·데이터 | 상용 데이터 권리 승인 |
| `PRODUCTION_INTEGRATION` (미검증) | 운영 제어·정책·통합이 승인된 증거 | 회귀/UI만으로 선언 불가 |

**2026-10-16 Codex 보고:** `pnpm install --frozen-lockfile` PASS, `pnpm exec tsc --noEmit` PASS, `pnpm exec vitest run` **92/92 PASS** (8 files), `pnpm build` PASS (79 modules), `pnpm exec playwright test --project=chromium` **40/40 PASS**, `git diff --check` PASS. 12 화면×Dark/Light **24개 1600×900 캡처**, 1024·1280·1440·1600px 레이아웃, axe WCAG 2.0/2.1 A/AA 규칙 **위반 0건 보고**. 수동 스크린리더 및 원본 ZIP 픽셀 비교는 하지 않았다. 소스: `frontend/src/app/*test.tsx`, `frontend/e2e/yutopia.spec.ts`.

## 2. T01~T18 프론트 요구사항 추적

표의 `LOCAL_OK`는 **로컬 데모에서만 충족**, `PARTIAL`은 설계된 요건 일부만 충족을 뜻한다. 과거 Notion의 모든 항목을 실서비스 `NOT_IMPLEMENTED`로 표시했던 텍스트는 10월 14일 시점 기준이며 현재 구현 UI와 비교해 갱신 필요.

| ID | 현재 로컬 판정 | 확인 근거·프로덕션 잔여 |
|---|---|---|
| T01 | LOCAL_OK | `App.characterization.test.tsx` 데모 로그인 성공/실패; 운영 인증 없음 |
| T02 | LOCAL_OK | 이메일 기억·로그아웃·재마운트/리프레시; 운영 세션 없음 |
| T03 | LOCAL_OK | `App.foundation.test.tsx` + E2E: 테마/키보드/axe/화면 캡처; ZIP 정밀 비교 없음 |
| T04 | PARTIAL | `YoutubeConsent.test.tsx`: 동의 거부·취소; 별도 scope mismatch 미구현 |
| T05 | PARTIAL | 서비스 로그인/공개 경로/선택적 채널 권한 분리; OAuth 필요 정책 미결정 |
| T06 | PARTIAL | 승인·거부·만료·직접 접근 guard; 실제 token/channel 검증 없음 |
| T07 | PARTIAL | `ProjectCollection.test.tsx`: 폼·날짜·중복·메모리 전이; 서버 저장·소유권 없음 |
| T08 | PARTIAL | 부분/실패/재시도/리프레시, 미확정 설명; 실제 quota·삭제 거버넌스 없음 |
| T09 | LOCAL_OK | `DashboardAnalysis.test.tsx`: KPI·시각·상태·일별 합계 |
| T10 | LOCAL_OK | 감성 분모·제외·미분류·다중 이슈 라벨 집계 |
| T11 | PARTIAL | 소스 ID/계보 및 합성 댓글; 실제 원문 수정/삭제·재검증 없음 |
| T12 | LOCAL_OK | `TrendEvidence.test.tsx`: 39일/14+14+11·비교 가능성·인과 차단 |
| T13 | LOCAL_OK | `TrendEvidence.test.tsx`: Claim HOLD/조건부/차단 전이 |
| T14 | LOCAL_OK | HOLD 주장 보고 결론 제외 |
| T15 | LOCAL_OK | `EvidenceIssue.test.tsx`: 결함 미확정, 근거 삭제·만료·접근 거부 시뮬레이션 |
| T16 | LOCAL_OK | 이슈 역할·전이·감사/반려, YU-11→12 업무 상태 공유 |
| T17 | PARTIAL | `ReportWorkspace.test.tsx`: 원문 마스킹·허용 번들/MCP 차단; 실제 제3자 데이터 전달 승인 없음 |
| T18 | LOCAL_OK | 보고 오류/재시도/보류 격리 및 공유·다운로드 비활성 |

**계수:** LOCAL_OK 11, PARTIAL 7; `PRODUCTION_INTEGRATION` 통과 0. 모든 요구사항은 [YUTOPIA 12화면 추적표](https://app.notion.com/p/3f979b3cd8e681cdac18c8c77dab4ec4)의 정의를 기준으로 하되 기존 증거 시점과 실제 구현 수준을 구별한다.

## 3. 승인된 API를 만들 때의 Consumer/Provider 테스트

**사전 조건:** `02_API_CONTRACT.yaml`이 공동 검수로 고정된 버전이고 `03_DATA_CONTRACT.md`의 필수성/nullable 필드·인증 방식이 결정되어야 한다. 기존 `frontend`의 데모 Provider는 API Client가 아니다.

| 테스트 그룹 | 프론트엔드(Consumer) | 백엔드(Provider) |
|---|---|---|
| 스키마/호환성 | contract-generated type/build, schema version mismatch 처리 | 승인 OpenAPI validation, 모든 response/error/nullable 일치 |
| 인증/인가 | 401/403·세션 만료·다른 사용자/조직 상태 UI | 서버 신원·소유권·역할 검증, BOLA/IDOR 부정 테스트 |
| OAuth | 거부/철회/만료·scope mismatch 안내, 공개 경로 분리 | 실제 callback·scope/state 검증, token 회수/저장 정책 |
| 프로젝트 | 422 입력 오류, 409 충돌, 재시도 및 보호 화면 | 생성/조회/수정 소유권·동시성·멱등성 |
| 수집 | QUEUED/RUNNING/PARTIAL/FAILED/SUCCEEDED, 실패 reason·null count | Worker/Quota/재시도·중복 요청·out-of-order 상태·삭제 |
| 데이터 집계 | 분모·출처 고지, 누락 ≠ 0, 다중 라벨 | 동일 run 버전의 raw/eligible/excluded/classified 불변식 |
| 비교/근거 | CONDITIONAL/INCOMPARABLE·HOLD 설명 | 게시일/cohort/coverage 비교/lineage/기술 검증 |
| 사람 검토 | 업무/주장/보고 상태 분리, 안전한 disabled | 인증 reviewer, 권한/전이/감사·HOLD 차단 |
| AI/보고서 | POLICY_BLOCKED, 마스킹, 내보내기 미승인 | 서버 측 PII·정책 필터링, 승인 없는 제3자 전송 0건 |
| 장애/변경 | 빈 데이터·삭제·stale·가용성 회복 | Source update/deletion, 부분 응답·오류 이유·안정된 ID |

## 4. 운영/서버 수치 검증 조건

1. **예시 fixture:** 12,842 raw = 10,204 eligible + 2,638 excluded; 10,204 eligible = 8,421 classified + 1,783 unclassified; classified = 4,884 positive + 2,021 neutral + 1,516 negative. **실제 운영 API가 이 숫자를 하드코딩하면 실패**.
2. 전 14일 3,543 + 후 14일 7,244 + 비교 외 11일 2,055 = 39일 원시 댓글 12,842라는 것은 **시나리오 회귀**. 39/39은 일별 슬롯 존재로만 사용하고 실제 YouTube 모집단 수집률과 혼동하지 않는다.
3. 비교 기준: 게시일·영상 cohort가 다르면 CONDITIONAL 또는 INCOMPARABLE; 관측 건수 차이는 인과·시장/매출/실제 버그 확인과 연결 금지.
4. `PAY-002`의 증가 주장 HOLD, `PERF-001`은 관측 호소 후보, SYNTHETIC 근거는 `realWorldVerified:false`, 최종 보고서 `formallyApproved:false`(시뮬레이션 중) 및 공유/내보내기 차단.
5. 현재 `DEMO_DAILY_OBSERVATIONS`, `DEMO_CLAIM_REVIEWS`, `INITIAL_DEMO_ISSUES`의 고정 수치/ID/시각을 **운영 필수값으로 확정하지 않는다**.

## 5. 안전/회귀 부정 테스트 — 실제 서버 연결 전 필수

- A 사용자 세션에서 B 사용자 프로젝트·원문·검토·보고서 URL 직접 조회/수정 → 403/404 등 정보 노출 없는 오류; 조직 범위 다름 테스트.
- 로그인 후 승인 없이 채널 OAuth 완료 URL 방문; token 만료/회수·scope mismatch; 공개 관측이 허용된 경우 불필요한 권한 요청하지 않음.
- `MISSING/DELETED/EXPIRED/STALE/ACCESS_DENIED/SYNTHETIC/BLOCKED` 근거를 AVAILABLE로 조작하거나 `realWorldVerified:true` 전송 → 서버 정책 재검증·승인 거부.
- `PAY-002 HOLD`를 결론·외부 모델 번들·공유 문서에 포함시키는 클라이언트 조작 → 거부. PERF-001 기술 결함 확정/패치 인과 보고 → 거부.
- Kanban `COMPLETED`를 정식 claim verification/report approval로 강제 요청 → 거부. VIEWER/DENIED 행위·위조 actor/시각/감사 본문 → 거부.
- 중복 프로젝트 POST, 중복 수집 재시도, 두 리뷰어 경쟁 갱신, 오래된 Snapshot 덮어쓰기, quota retry 폭주, ETag/expectedVersion 충돌 → 데이터 손실/권한 상승 없음.
- 실제 수집·수정·삭제·quota failure에서 null/0/관측불가/부분 성공의 의미 차이 보존; 분석 적격과 감성 분류 완료를 구별.
- 로그/오류/원문 인용에 Google/OAuth/API 키, 사용자 개인정보, 합성 원문·민감 프롬프트가 불필요하게 노출되지 않음.
- 외부 LLM/MCP/공유 정책 Gate가 승인되지 않은 상태에서는 호출·다운로드·공개 링크 생성 0건.
- 서버 재시작/세션 만료·모바일 외 1024~1600px 전환/브라우저 히스토리/직접 접근·데이터 공백을 명시적으로 처리.

## 6. 기계 검증 게이트와 인수 기준

| Gate | 실행물·수용 조건 | 현재 |
|---|---|---|
| CT-01 Source trace | `344c1e…` + 관련 타입/상태/테스트의 파일/라인 근거 | 이 문서에 파일 수준 추적 |
| CT-02 Schema | OpenAPI 3.1 lint, 모든 `$ref`·필수성·오류 예시·문서/코드의 일치 | DRAFT; 별도 lint 필요 |
| CT-03 Consumer | FE API client가 승인 스키마만 사용하고 Mock/실서버 전환 테스트 | NOT_IMPLEMENTED |
| CT-04 Provider | 각 endpoint success/error/권한/멱등 계약 테스트 | NOT_IMPLEMENTED |
| CT-05 Integration | 실제 테스트 DB/Queue/Worker/source adapter 정책 승인된 범위의 E2E | NOT_TESTED |
| CT-06 Security & rights | 인증·권한·G01·소스/전송권 승인 기록 | BLOCKED |
| CT-07 UX & QA | 12화면 Dark/Light, WCAG 자동+수동, 1024~1600, ZIP parity 별도 | 자동 로컬 증거만 있음 |
| CT-08 Operations | 비밀/삭제/감사/복구/관측/장애 대응, CI 방식·릴리스 권한 | NOT_IMPLEMENTED |

**최종 승인 원칙:** `PRODUCTION_INTEGRATION PASS`는 승인된 API 스키마·서버 권한·데이터 사용권·실제 Job/DB·데이터 출처 및 클라이언트 E2E 증거가 동시에 있어야 한다. 프론트엔드 UI 92/92, 40/40만으로 실제 서비스를 승인할 수 없다. 상세 정책 Gate는 [05](./05_SECURITY_POLICY_CONTRACT.md), 상태는 [04](./04_STATE_AND_ERROR_CONTRACT.md).

## 7. Reviewer 확인 체크리스트

- [ ] 백엔드 소유자/대상 repo/환경·버전/세션 방식을 정함
- [ ] `API_CONTRACT.yaml`를 독립 validator로 검증하고 기계 generated client 연동 계획 승인
- [ ] 응답의 `sourceId/observedAt/retrievedAt/coverage/policyState/lineage` 필드 필수성·nullable를 승인
- [ ] 실제 0 vs 누락/차단/삭제·부분 응답의 contract tests가 존재
- [ ] Source 플랫폼 권리·OAuth scope·비밀·보존 삭제 담당자가 승인
- [ ] 등록·수정·검토·공유 권한 부정 테스트로 IDOR/승격을 차단
- [ ] YU-01~12의 데이터 근거와 통합 연결 흐름을 실제 서버에 대해 E2E 검증
- [ ] 시뮬레이션/로컬 E2E/실제 통합 증거를 분리 보고
- [ ] 관리자 PR 승인·병합은 계약 검토의 기록이지 배포·정책 승인과 같지 않음을 확인
