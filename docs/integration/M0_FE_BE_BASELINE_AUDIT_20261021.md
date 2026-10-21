# YOUTOPIA — M0 FE/BE/Shared 기준선 감사 및 M1 인계

> 2026-10-21 KST · 실제 GitHub branch·commit·file readback에 근거한 Baseline Audit
>
> **판정: M0_SOURCE_BASELINE_VERIFIED / M0_GATE_OPEN**. 저장소 기준선은 검증했으나 BE 구현·스택·담당 승인과 YU-27 실 Chrome 검증은 완료되지 않았다. 이 문서를 전체 M0 완료로 표시하지 않는다.

## 1. 직접 확인한 GitHub 기준선

| 범위 | 근거 및 검사 방식 | 직접 확인된 상태 |
|---|---|---|
| `frontend` | `GET PR #18` merged=true 및 `compare frontend...11e8a8ef` identical | **HEAD `11e8a8ef04e3b868fb3f3fd504b6965158253724`**, 문서 PR #18 병합. 기존 YU-26 Chrome Hover 기능 포함 |
| `backend` | `compare dev...backend` identical; backend SHA `99e7b3857ae6e31460b2c8e2af48592d5bfbb90a`; `fetch_commit` | `backend`는 **2026-08-05 Initial commit**. 실제 diff에 `README.md` 1개 추가만 존재; README 내용 `# YOUTOPIA`. 서버 실행 코드 확인되지 않음 |
| `dev` | `compare dev...backend` identical | `backend`와 동일 SHA `99e7b3857ae6e31460b2c8e2af48592d5bfbb90a`. **통합 개발이 실행되고 있다는 증거 없음** |
| `main` | `compare main...backend` status behind(5 commits) | main이 backend보다 커밋 5개 앞서지만 실제 운영·통합 성공이나 BE 구현을 의미하지 않음 |
| `frontend/shared` | `fetch_file shared/.gitkeep @ frontend` blob `e69de29...` | 빈 marker만 존재. M1 공통 분석 스키마는 아직 구현되어 있지 않았음 |
| 기존 BE 인계 | `docs/backend-handoff/00_START_HERE.md`, `01_BACKEND_HANDOFF.md`, `02_API_CONTRACT.yaml` @ frontend | **DRAFT / REQUIRES_BACKEND_REVIEW / NOT IMPLEMENTED**. YU-01~12 게임 고정 데모 전제이며 범용 YouTube Chrome 제품과 재검토 필요 |
| PR #14 | [YU-26 QA 문서](https://github.com/Choi1999/YOUTOPIA/pull/14) | Draft, 미병합 |
| PR #15 | [YU-27 메시지·캐시](https://github.com/Choi1999/YOUTOPIA/pull/15) | Draft, 미병합; Windows Native Node 177/177·오프라인 Chromium Fixture 2/2 PASS 사용자 로그. **설치형 Chrome MV3 Content↔Worker QA 미완료** |
| PR #16 | [Analysis delivery design](https://github.com/Choi1999/YOUTOPIA/pull/16) | Draft, 미병합 |
| PR #17 | [Customer-first UX](https://github.com/Choi1999/YOUTOPIA/pull/17) | Draft, 미병합 |
| PR #18 | [FE/BE/EDA 방법론](https://github.com/Choi1999/YOUTOPIA/pull/18) | 사용자가 승인한 방향에 따라 2026-10-21 **squash 병합 완료**, SHA `11e8a8ef04e3b868fb3f3fd504b6965158253724` |

**중요:** 원격 `backend` HEAD에서 서버 코드를 확인하지 못했으므로 실제 백엔드의 스택·DB·인증·YouTube adapter·테스트 suite 존재를 추측하지 않는다. 인계 문서가 있다고 실제 서버가 구현된 것은 아니다.

## 2. 제품 방향과 과거 백엔드 계약의 차이

| 검토 항목 | 과거 백엔드 초안/데모 | 현재 승인 제품 요구 | 행동 |
|---|---|---|---|
| 중심 대상 | 게임 이벤트·프로젝트·고정 영상 3개 | 범용 YouTube VIDEO/CHANNEL, 홈/검색 Hover | 정본은 범용 AnalysisTarget으로 확장, 게임 fixture는 호환 Demo로 격리 |
| 인터랙션 | React 고객 화면·프로젝트 대시보드 | Chrome Hover → ‘더보기’ → tab-scoped Side Panel → 선택 웹 작업 | Chrome 대상 고정 생명주기와 API 요청 생명주기 분리 |
| 분석 시점 | 고정 시나리오 상태 | 캐시 HIT/MISS·비동기 분석·오래됨/미확보 | API snapshot/job 계약 별도로 정의 |
| 지표 | 39일 관측·패치 전후 비교 | video/channel·topic×sentiment×time, 적격/분류/제외 분모 | 집계 정의·다중 라벨·관측 범위 재정의 |
| 권한 | DEMO_REVIEWER·로컬 인메모리 | 서버 신원/조직·계정·구독별 분석 범위 | FE 권한 토글은 API 인가 증거 아님 |
| 출처/정책 | 합성 원문·REAL_WORLD_VERIFIED=false | 승인된 댓글만 실제 분석/표시 | MOCK과 승인 Provider/원문 보존 분리 |
| 성능 | 로컬 fixture 즉시 렌더 | 실제 Chrome Hover 사용성 + 서버 캐시 P95 실험 | 캐시/큐/재시도/지연 분리 측정 |

과거 [02_API_CONTRACT.yaml](../backend-handoff/02_API_CONTRACT.yaml)은 여전히 자체 DRAFT. 신규 계약은 `shared/contracts/analysis-v1/` 후보로 **별도 제안**하여 기존 초안을 무단 덮어쓰지 않는다.

## 3. 팀별 실제 착수 경계

### FE (독립 착수 가능)
- YU-27 설치형 Chrome MV3 메시지·세션 캐시 검증. Node/오프라인 Chromium 결과를 대체하지 않음.
- Figma 98-09/98-10 기존 정본을 보존한 Compact 후보·고객 문구·Side Panel 요약/주제/추이 계획.
- 향후 `AnalysisSnapshot`의 mock adapter 및 고객 친화적 unavailable/partial/stale 처리 검토. 실제 Chrome/React 코드 변경은 별도 기능 PR.

### BE (현재 M0 블로커)
- `backend` 기준 초기 commit만 검증됨. 실제 서버 구현을 시작하려면 담당 범위·기술 스택(Python FastAPI 후보 등), 데이터 저장·DB, 큐, 개발/테스트 환경, auth scheme, Secret 관리, 브랜치/계약 동기화 방식을 결정해야 한다.
- **정책 승인 없이** YouTube 댓글을 수집하거나 감성/콘텐츠 태깅·실데이터 보관/배포 경로를 활성화하지 않는다.
- 독립 합성 Mock Provider의 순수 인터페이스 설계 및 로컬 데이터 검증은 가능; 서버 코드는 BE 담당 검토 뒤 독립 작업/PR.

### INT / shared (이번 후보 산출물)
- `shared/contracts/analysis-v1/analysis.schema.json`과 합성 fixture, Node semantic smoke 테스트를 신규 브랜치에서 제안.
- 데이터 계약: AnalysisTarget, Snapshot, Job, TopicTrend, ErrorEnvelope, UserEntitlement.
- 목표 Gate: FE + BE 두 팀의 스키마 검토/버전·Auth·권한·nullable semantics 확정, Consumer/Provider 별도 테스트.
- 현재 상태 `M1_CANDIDATE_READY_FOR_REVIEW`; **계약 합의 및 실제 BE Provider는 미완료**.

## 4. 바로 실행할 공동 작업표

| ID | 소유 영역 | 실제 다음 행동 | PASS 증거 | 현재 |
|---|---|---|---|---|
| M0-FE-01 | FE | YU-27 설치형 Chrome 메시지/cache/탭 scope 확인 | SHA/Chrome 버전/Worker 콘솔과 스크린샷 | PENDING |
| M0-BE-01 | BE | framework/DB/queue/test/owner/branch 확인 및 ADR | 책임자·선택지·실행 가능한 최소 서비스 | BLOCKED_DECISION |
| M0-CT-01 | INT | M1 schema·합성 fixtures 배포 초안 | 고정 source SHA + 계약 후보 Readback | PROPOSED |
| M1-CT-02 | FE·BE 공동 | target/snapshot/job/trend/error/entitlement 의미·필수성/nullable/권한 합의 | 두 팀 서면 계약 리뷰 | PENDING |
| M1-FE-01 | FE | Mock consumer의 정상/미확보/오래됨/권한 경계 | 테스트 SHA·원본 로그 | NOT_STARTED |
| M1-BE-01 | BE | 독립 mock provider 및 schema 검사 | BE SHA·서비스 테스트 로그 | NOT_STARTED |
| M1-INT-01 | INT | Consumer/Provider 계약 대조와 실제 양방향 상태·오류 검증 | 양쪽 SHAs 및 전체 테스트 | NOT_STARTED |

## 5. M0/M1 승인 보류 의사결정

- DEC-01: `shared`의 정본 브랜치·버전 배포 방식, FE/BE dual-branch 동기화 절차.
- DEC-02: 서버 구현 framework/DB/queue, 개발 소유자, Windows 실행·CI 방식.
- DEC-03: 인증/OAuth/세션 방식, 조직·구독 서버 권한 검증.
- DEC-04: YouTube 데이터·파생 지표·저장·삭제 승인 및 실제 API quota.
- DEC-05: API path/HTTP errors/idempotency/polling/한도/거래 갱신 정책.
- DEC-06: 실제 모델 평가 언어·검증·비용과 안정된 주제 ID.
- DEC-07: 실제 M9 제품 통합 인수 품질 기준과 동일 SHAs/환경.

외부 소스 채택 증거는 [PR #18의 EX-ID 근거대장](../research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md)에만 연구 상태로 기록. 이 감사는 소스 복제/외부 라이브러리 사용 증거를 만들지 않는다.

## 6. 현 단계 판정

- **PASS:** FE/BE/dev GitHub 브랜치 기준 SHA 확인, 초기 BE HEAD와 실제 서버 구현 증거 부재 구분, 구 백엔드 인계 초안의 범위 확인, PR #18 병합 근거 확인.
- **PARTIAL:** 공유 스키마를 후보로 작성. BE/FE 공동 서명 및 API 설계 검토 전.
- **BLOCKED:** BE framework/DB/auth/owner 결정과 `shared` 동기화 운영 방식.
- **PENDING:** YU-27 설치형 Chrome MV3 통합 QA, 실제 Consumer/Provider·서버 테스트, 외부 실데이터 권한 검증.

**M0/M1 전체 게이트를 PASS로 기록하지 않는다.**
