# YOUTOPIA — FE/BE/INT 실행 방법론과 제품 통합 로드맵 v3.0

> 2026-10-21 KST / **DRAFT IMPLEMENTATION METHOD · 실제 코드 구현 또는 통합 완료가 아님**
>
> **최종 마일스톤 = M9 PRODUCT_INTEGRATED.** 공개 출시, Chrome Web Store 심사, 마케팅, 상용 과금 개시는 이번 개발 종료 기준 밖이다. 다만 실제 분석 제품의 통합을 선언하려면 합법적·기술적으로 승인된 실데이터 경로와 필수 보안·품질을 증명해야 한다. 합성 자료만 연결한 것은 `MOCK_INTEGRATED`다.
>
> 참고: [외부 프로젝트 근거·채택 대장](../research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md), [EDA·NLP 실험 방법](./EDA_NLP_METHOD_AND_EXPERIMENTS_20261021.md), [M0~M9 통합 인수 매트릭스](./INTEGRATION_ACCEPTANCE_M0_M9_20261021.md).
> 과거 개발 문서: [기존 실행대장](./04_EXECUTION_00_99.md), [백엔드 인계](../backend-handoff/01_BACKEND_HANDOFF.md), [API 초안](../backend-handoff/02_API_CONTRACT.yaml), [Chrome UX](./01_HOVER_SIDE_PANEL_UX.md), [FE/BE 아키텍처 방향 PR #16](https://github.com/Choi1999/YOUTOPIA/pull/16), [고객 중심 UI PR #17](https://github.com/Choi1999/YOUTOPIA/pull/17).

## 1. 근거로 확인한 현재 기준선

- GitHub `frontend` HEAD는 `d7f271b5afa1fc6b0bf31c000da6aa73611a6dc0` (YU-26 병합). `backend`와 `dev`는 동일한 기준 커밋이며 프론트와 차이가 크다. `backend` 브랜치의 README 외 실제 서버 구현/실행 PASS 증거를 이번 조사에서 확인하지 못했다. **서버가 존재한다고 가정하지 않는다.**
- 독립 PR #14 종료문서 / #15 YU-27 메시지·캐시 / #16 분석 전달 / #17 고객 UX는 모두 Draft·미병합(2026-10-21 조사). PR #15의 Windows Node 177/177 및 오프라인 Chromium 2/2 PASS는 실제 설치형 Chrome MV3 메시지 통합 PASS가 아니다.
- 오래된 `docs/backend-handoff/*`는 YU-01~12의 게임 중심 데모로부터 작성된 **BE_PROPOSED / NOT IMPLEMENTED** 초안. 최신 범용 YouTube 영상·채널·Hover 제품에 맞춰 개정·승인한 뒤 사용. `02_API_CONTRACT.yaml`의 수천 줄 초안은 실제 Provider 인터페이스가 아님.
- 실제 코드 변경은 여기서 수행하지 않는다. 문서상 신규 경로와 기술 후보를 이미 존재하는 코드라고 주장하지 않는다.

## 2. 개발 방법론: evidence-driven vertical slices

단계마다 `문제정의 → 외부근거 조사 → 대안비교(ADR) → 공유 계약 → FE Mock Consumer·BE Mock Provider 병렬 개발 → 단위/계약/통합 검증 → 사용자 인수 → 독립 PR 병합` 순서를 적용한다.

- **연구 게이트:** EX-xxx 외부 근거(출처/저장소 파일/고정 SHA/열람일/라이선스/참고 부분) 없이는 새로운 기술 선택을 확정하지 않는다. 외부 참고와 실제 코드 재사용은 별도 상태로 기록한다.
- **ADR:** 채택/보류/기각, 대안 2개 이상, 예상 위험·비용, 수정 범위, 철회 방법을 기록한다. 소스코드를 실제 사용한다면 원본 License/NOTICE 의무 확인 후 파일/함수·커밋·테스트까지 매핑한다.
- **계약 우선:** FE와 BE가 JSON 필드를 각자 만들지 않는다. `shared/contracts` (후보 경로)에 기계 검증 가능한 OpenAPI/JSON Schema, examples, schema version, change log, negative fixtures를 놓고 Consumer/Provider Test를 양쪽에서 수행한다.
- **수직 슬라이스:** 먼저 한 영상의 `VIDEO ID → Mock Summary → Hover→Panel`을 연결하고, 다음으로 `CACHE_MISS/QUEUED/STALE/ERROR`, 이어 `DATA/EDA/NLP`, `ROLE/ENTITLEMENT`, `WORKSPACE` 순으로 증거를 쌓는다.
- **검증 증거:** PR마다 `source SHA, target SHA, changed paths, test commands, actual PASS/FAIL, screenshots/trace, excluded cases, approver`를 붙인다. Node, 오프라인 Chromium, 설치형 Chrome, Staging, Real-Data Policy를 서로 대체하지 않는다.
- **개발 분리:** `frontend`에 FE 기능, `backend`에 BE 기능, 계약은 별도 검토/양쪽 반영, `dev`는 검증된 FE+BE 통합 시험, `main`은 승인된 안정 기준. 기존 211개 규모의 프론트 단독 변경을 백엔드 브랜치에 무심코 전체 병합하지 않는다.

## 3. 아키텍처 · 구현 트랙

### 3.1 FE — Chrome + React 워크스페이스 (후보 모듈 경로 포함)

~~~text
youtube.com Home/Search
  -> Content Discovery/Resolver (extension/content.js, target/channel resolvers)
  -> Hover Controller (existing 0ms enter, A ↔ own-card pin, DOM SPA guard)
  -> Compact Shadow Card UI  [새 Figma 후보, 기존 런타임 미변경]
  -> Content preview client (PR #15) -> Chrome MV3 Service Worker
  -> (추후) Authorized Analysis Gateway
  -> Side Panel: pinned CLICK target only (YU-28, 다른 Hover로 target 불변)
  -> React Workspace: saved / compare / report / org / admin separated
~~~

**실행 순서:** 기존 Hover 회귀 고정 → Figma [98-09 Hover](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-2)와 [98-10 Panel](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217) 기반 Compact 후보 별도 제작 → UI 상태 매트릭스/접근성 확인 → 승인된 디자인의 FE feature PR → 사용자 Chrome QA.

- **Hover:** 빠른 핵심 결론 1줄, 미니 감성 바, 주제 1~2개, 관측 기간·분모 한 줄, 단일 ‘더보기’. 정보 없는 경우 수치를 만들지 않는다. Shadow host/카드 포인터 경계·근접 SPA 재결합 규칙은 변경하지 않는다.
- **Side Panel:** 요약/주제/추이 탭. 열기는 Chrome의 유효 사용자 클릭 흐름에서 수행, `tabId + targetType + targetId + selectionRevision` 기준 명시적 선택만 패널 대상 변경. `hoverRequestId`를 패널 고정 세대로 재사용하지 않고 서로 다른 생명주기로 관리. 원래 YouTube 페이지 이동 없이 상세 탐색.
- **React Web:** 실제 저장·비교·보고·역할별 관리 화면에 집중. YU-01~12 데모 자산은 재사용하되 게임 고정 fixture와 클라이언트 메모리 권한을 운영 API로 오인하지 않는다. API Client/Query boundary에서 Mock/Real Adapter를 갈라 테스트한다.
- **고객 언어:** `CACHE_HIT`, `POLICY_BLOCKED`, `STATIC_FIXTURE` 같은 내부 코드는 고객 메인 UI에 노출하지 않는다. 다만 사실에 필요한 데이터 범위·갱신 시각·사용 제한과 법적 필수 안내는 숨기지 않는다. QA MOCK 값은 운영 실분석으로 공개하지 않는다.
- **성능 가설:** Hover shell P95 ≤ 200 ms, 유효 서버 캐시 HIT의 첫 실제 요약 P95 ≤ 1 s를 제안 목표로 측정. SLA/검증 PASS가 아니며 환경에 따라 조정한다.

### 3.2 BE — 정책 우선 API/캐시/내구 작업/분석 (아직 구현 선택 미확정)

~~~text
Authenticated / authorized request
    -> Analysis Gateway / schema+version validation
    -> Policy / role / entitlement guard
    -> Analysis Snapshot Cache (audience / scope / model-version isolated)
          HIT -> signed/validated snapshot to FE
          MISS -> Singleflight idempotency + durable AnalysisJob
                -> Approved Data Provider adapter (policy Gate otherwise MOCK)
                -> Normalization + Data Quality / EDA gate
                -> Sentiment + Discussion Topic pipeline (versioned)
                -> TopicTrend aggregate + provenance + coverage
                -> Snapshot Store + invalidation / deletion controls
    -> Poll/subscription status (FE remains non-blocking)
~~~

- **개발 후보(결정 전):** Python FastAPI 또는 기존 운영팀 합의한 HTTP framework; PostgreSQL 또는 동등한 트랜잭션 DB; 작은 초기 부하는 DB-backed durable job/outbox, 측정 후 Redis/RQ/Celery 여부 결정. Kafka/GPU cluster는 기본 의존성으로 채택하지 않는다.
- **백엔드 BFF/서비스 경계:** `api`, `authz`, `snapshot`, `jobs`, `provider_adapter`, `data_quality`, `sentiment`, `topics`, `trend`, `audit` 분할을 제안하지만, 초기에는 모놀리스 모듈 구조로 시작해 실제 부하 증거가 있을 때만 분리한다.
- **캐시 키(단독 videoId 금지):** `source, targetType, targetId, analysisScope, audience/tenant, topicTaxonomyVersion, modelVersion, policyVersion, language, observationWindow`. **PUBLIC_REUSABLE/TENANT_PRIVATE**는 분리하고 조회 때마다 권한 재검증.
- **Singleflight:** 동일 조건/권한 범위의 MISS 동시 요청 N개가 하나의 Job만 생성되도록 unique job key·DB 트랜잭션·중복 재시도 테스트. Queue/Worker 재시작 후에도 durable 상태·idempotency 보장.
- **수집 경계:** YouTube API/댓글 텍스트 접근은 최신 이용 규약·파생 지표 승인·보존/삭제 요구가 충족된 범위에서만. 영상 ID만으로 자동 대량 수집하는 전략 금지. `commentThreads.list`의 페이지네이션과 답글 커버리지는 별도 기록.
- **장애 복구:** 권한 회수, 댓글 삭제, quota 소진, 데이터 소실, 지연 응답, 작업 중복, 서버·Worker 종료에 대해 fail-closed. 표본이 불명확하면 수치를 0으로 변환하지 않는다. 메트릭/작업 상태와 고객 문구는 분리.

### 3.3 INT — FE/BE 공통 계약 (후보, 현재 NOT IMPLEMENTED)

우선 아래 6개를 `shared/contracts/v1`로 검토한다.

| 계약 | 최소 필드 | 필수 검증 |
|---|---|---|
| `AnalysisTarget` | source, targetType VIDEO/CHANNEL, targetId, canonical identity | 유효 ID, 미해결 @handle 차단, 외부 도메인 거절 |
| `AnalysisSnapshot` | scope, status, sample counts, topic/sentiment, event/fetched/analyzedAt, version, provenance, visibility | null != 0, sample/기간/출처 정합성, 사용자별 권한 |
| `AnalysisJob` | jobId, idempotencyKey, requestedScope, queueState, attempts, timestamps, reason | 중복 실행/오래된 응답/worker 재시작 |
| `TopicTrend` | topicId, binWindow, mentionCount/rate, negativeWithinTopicRate, comparability, model/taxonomyVersion | 분모/기간·모델 일치; 인과·시장전체 주장 금지 |
| `ErrorEnvelope` | reasonCode, retryable, userAction, traceId (내부) | FE 고객용 문구와 서버 상태 1:1 안전 매핑 |
| `UserEntitlement` | user/organization scope, plan permission, role, revision | 클라이언트 유료 표시≠실제 서버 권한 |

후보 Endpoint (기존 2,910줄 초안과 충돌 확인 후 확정): `GET /v1/analysis/targets/{type}/{id}/summary`, `POST /v1/analysis/jobs`, `GET /v1/analysis/jobs/{jobId}`, `GET /v1/analysis/targets/{type}/{id}/trends`. 이는 구현된 실제 API 주소가 아니다.

**계약 버전 규칙:** 소비자/제공자 독립 적합성, breaking 변경 시 명시적 version+deprecation+dual-run, golden fixtures(READY/PARTIAL/STALE/NO_DATA/POLICY_BLOCKED/ENTITLEMENT_LIMITED/ERROR), 스키마 diff 검증; Consumer에서 유효하지 않은 정보는 표시하지 않는다.

## 4. 마일스톤 M0~M9: 실행 단위 / 산출물 / 종료 증거

| 단계 | FE 작업 패키지 | BE·EDA·ML 작업 패키지 | INT 인수 증거 |
|---|---|---|---|
| **M0 기준선/결정** | FE-001 설치형 YU-27 QA, FE-002 UI Figma 후보·접근성 계획 | BE-001 `backend` 실태 감사, BE-002 언어/DB/Queue 기술 결정; EDA-000 허용 데이터·연구질문 등록 | INT-001 현재 SHA·브랜치·미구현 레지스트리/ADR; API 초안과 현재 제품 차이표 |
| **M1 공통 계약 v1** | FE-010 mock API consumer, FE-011 schema-driven states | BE-010 Mock Provider, BE-011 snapshot/job/authz contract, EDA-010 최소 데이터·분모 정의 | CT-001 schema·Golden fixtures, Contract Consumer/Provider 각 PASS |
| **M2 Chrome 고객 동선** | FE-020 Compact Hover, FE-021 Click→Pinned Side Panel, FE-022 Figma light/dark | BE-020 Mock summary/job 상태 응답(실데이터 금지) | INT-020 실제 설치형 Chrome Hover→더보기→패널, 대상 혼동 0건 |
| **M3 서버 동작 기반** | FE-030 FE API client adapter, FE-031 loading/error/race cancellation | BE-030 API+DB, BE-031 cache/singleflight, BE-032 durable queue, EDA-020 quality stub | INT-030 실 서버(허용 MOCK)↔Chrome/Web↔DB/Queue, 2중 작업 0건 |
| **M4 데이터/EDA** | FE-040 수집 범위·시각·부분결과 UI | BE-040 승인 Provider adapter, BE-041 lineage+삭제·갱신, EDA-040~049 intake/coverage/duplicates/missingness/strata/leakage | INT-040 승인된 샘플 run 재현, provenance와 data quality gate PASS |
| **M5 감성/주제/트렌드** | FE-050 topic×sentiment×time charts, FE-051 summary/insight, FE-052 비교 불가 UI | BE-050 baseline/ML, BE-051 topic taxonomy, BE-052 trend aggregations, EDA-050~059 평가·drift/reliability | INT-050 golden dataset·실승인 자료의 지표/분모/모델 버전 일치, 잘못된 추론 차단 |
| **M6 계정·이용권** | FE-060 고객 로그인·세션, FE-061 free/plan UX·조직 역할 | BE-060 auth/session/org, BE-061 entitlement/usage, BE-062 BOLA/idempotency | INT-060 타 조직 접근·권한 만료/회수 부정 테스트 PASS; 결제 청구는 범위 외 |
| **M7 고객/운영 워크스페이스** | FE-070 저장/비교/보고·팀, FE-071 운영자·정책·QA 완전 분리 | BE-070 프로젝트/보고 DB, BE-071 작업·감사/운영 API | INT-070 저장→재조회→조직 범위→보고 초안 등 실제 E2E 및 RBAC |
| **M8 통합 안정화** | FE-080 실제 Chrome 100/125/150% 줌·A11y·메모리, FE-081 긴 사용 E2E | BE-080 부하/복구/보안, BE-081 데이터·모델·유지관리 QA, EDA-080 drift 조사 | INT-080 실패·복구·성능 SLO 실측, critical/high 0 미해결 또는 서면 리스크 결정 |
| **M9 PRODUCT_INTEGRATED** | FE-090 릴리스 후보 기능 동결·전체 고객 여정 | BE-090 API/DB/분석/감사 RC 동결, 권한/데이터 증거 확정 | **INT-090** 동일 통합 SHA + staging 증거 + 완전 사용자 흐름 PASS + 정책/품질 인수 서명 |

M0~M9는 **상위 제품 개발 마일스톤**이다. 기존 YU-00~99 기능 실행대장은 유지하고 소유/진행과 연결한다. 공개 출시·Web Store 제출·운영 릴리스는 M9 완료 이후 별도 프로그램이다.

## 5. 의존성 및 병렬성

~~~mermaid
flowchart LR
  M0[M0 Current baseline] --> M1[M1 Shared contract]
  M1 --> FE2[FE M2 Chrome UX]
  M1 --> BE3[BE M3 API + DB + Mock]
  FE2 --> I1[First integration]
  BE3 --> I1
  BE3 --> M4[M4 Approved data + EDA]
  M4 --> M5[M5 NLP topic / trend]
  I1 --> M6[M6 Auth + entitlement]
  I1 --> M7[M7 Workspace]
  M5 --> M8[M8 System QA]
  M6 --> M8
  M7 --> M8
  M8 --> M9[M9 PRODUCT_INTEGRATED]
~~~

- FE의 Figma Compact 후보·설계는 BE API 착수와 병렬 가능. 단 **Figma 정본 승인 후에만 실제 FE 코드를 변경**한다.
- BE API/DB/Queue와 계약 테스트는 YU-27 설치형 Chrome 검증이 끝나기 전에도 승인된 독립 범위로 설계·Mock 구현 가능.
- 실제 YouTube API/파생 감성·주제 태깅은 외부 정책 Gate가 없으면 **MOCK ONLY**. 이 Gate는 M4~M9까지 유지된다.
- 데이터 EDA와 모델 평가를 하나의 '정확도 PASS'로 합치지 않는다. 데이터 적격성·언어별 성능·감성·주제·시간 안정성은 독립 검증한다.

## 6. 보안·권한·플랫폼 정책

- YouTube [Additional policies for derived metrics and data storage](https://developers.google.com/youtube/terms/derived-metrics-policy) 및 [개발자 정책 가이드](https://developers.google.com/youtube/terms/developer-policies-guide): 파생 주제 태깅·Viewer Sentiment는 별도 승인/수락 대상. 운영 Provider/실댓글 훈련·보관을 정책 확인 없이 시작하지 않는다.
- Chrome [sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel): 사용자의 실제 제스처에 따른 패널 열기, tab-scoped context의 경합은 설치형 Chrome에서 테스트. 기존 승인 Hover Controller 코드는 불필요한 재작성 금지.
- 사용자·조직·구독 역할: 서버가 authoritative. cache public/tenant 격리, 저장·내보내기·운영 접근·모델 외부 전송을 허가 없이 켜지 않는다.
- 로그와 연구 증거에는 댓글 원문/계정 ID/OAuth 토큰 등 민감 데이터 저장하지 않는다. 사용자 집단의 보호 특성 추론·프로파일링 금지.

## 7. '참고했다'와 '사용했다'의 증거를 분리

외부 프로젝트나 라이브러리를 채택할 때 최소 EX-ID(외부 근거) → ADR-ID(설계 결정) → CT/FE/BE/EDA ID(내부 작업) → Git SHA/파일 경로 → 테스트 SHA/명령/원본 결과 → 소유자 승인 기록을 연결한다.

- `RESEARCHED`: 공식 페이지 또는 소스 확인만 완료.
- `DESIGN_SELECTED`: 참고한 아이디어가 YOUTOPIA 문서/ADR에 반영. **코드 사용 아님**.
- `PROTOTYPE_TESTED`: 특정 소스·라이브러리 실험을 자체 테스트에서 재현.
- `IN_CODE`: 실제 내부 코드 파일/라인/커밋으로 연결됨.
- `VERIFIED`: 구현 SHA에서 실행한 테스트와 리뷰 증거가 있음.
- `REJECTED/BLOCKED`: 기술 부적합·라이선스·정책/비용 사유로 제외.

자세한 원천 URL과 소스 고정 SHA는 [외부 조사 증거대장](../research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md)에 관리한다. **현재 새로 만드는 문서는 실제 코드 도입/서버 구현을 뜻하지 않는다.**

## 8. M9 완료 선언 조건

1. 실제 통합된 고객 경로: YouTube Hover → Side Panel → 허용된 분석 요약·주제·시간 추이 → 웹 저장/비교/보고 → 역할별 운영 관리.
2. FE와 BE가 동일한 versioned contract로 연결되고 서버에서 실제 데이터·권한·이용권·데이터 출처가 검증됨.
3. 승인된 실제 데이터 사용 경로가 충족되지 못한 경우 `MOCK_INTEGRATED`에 머무르며 `PRODUCT_INTEGRATED`라고 주장하지 않음.
4. FE unit + Browser E2E, BE unit/integration, Consumer/Provider, EDA quality, ML evaluation, end-to-end policy/security, regression/performance/rollback 모두 각 항목 실측 증거.
5. M9 기준 통합 SHA/환경 버전/모델·분류 버전/테스트 기록/미해결 리스크/사용자 최종 승인 명시.
6. **스토어 공개·실제 결제 집행·외부 마케팅은 이 마일스톤 완료 조건에 포함되지 않음.**

**이번 문서 작성 = 방법론 설계 준비. M0~M9 구현·실증 완료가 아니다.**
