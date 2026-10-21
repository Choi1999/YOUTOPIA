# YOUTOPIA — FE/BE/EDA/INT 마일스톤·증거 인수 매트릭스 v0.1

> 2026-10-21 KST · **TEST PLAN / NOT EXECUTED**. 이전 사용자 Windows YU-27 Node 177/177 및 오프라인 Chromium 2/2만 기 확보 증거이며, 아래 신규 시험 IDs는 전부 예정 작업.
>
> 최종 종료 Gate는 **M9 PRODUCT_INTEGRATED**. Chrome Web Store 공개/실제 결제 청구/공식 출시가 아니다.
>
> 관련: [실행 방법론](./FE_BE_PRODUCT_INTEGRATION_METHOD_V3_20261021.md) · [EDA/NLP](./EDA_NLP_METHOD_AND_EXPERIMENTS_20261021.md) · [외부 조사 증거대장](../research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md) · [기존 백엔드 계약 초안](../backend-handoff/06_ACCEPTANCE_TEST_CONTRACT.md).

## 1. 단계별 Gate

| 마일스톤 | FE 완료 항목 | BE/EDA 완료 항목 | 통합 인수(추가 증거 필요) |
|---|---|---|---|
| M0 기준선 | FE-001 YU-27 설치형 Chrome QA, FE-002 Figma 후보 검토 | BE-001 backend HEAD/실코드·기술 선택, EDA-000 데이터 권리 현황 | INT-001 SHA/경로/스택/역할 표, 미확정 의사결정·블로커 |
| M1 Contract | FE-010 Schema Consumer/Mock Mapper | BE-010 Mock Provider, AnalysisSnapshot·Job·Error·Role Schemas | CT-001 성공/NULL/0/404/403/timeout 등 Golden fixtures, 공급자·소비자 독립 PASS |
| M2 Chrome PoC | FE-020 Compact Card, FE-021 더보기→Side Panel 대상 고정 | BE-020 합성 응답·부분·중단 Mock | INT-020 실제 설치형 Chrome에서 사용자의 핵심 1-click 흐름 PASS |
| M3 서버 기반 | FE-030 API Adapter·Stale UI | BE-030 API+DB, BE-031 cache, BE-032 durable worker | INT-030 FE↔실 Mock Provider↔저장소·큐 연결, 중복·재시작 부정 테스트 PASS |
| M4 데이터·EDA | FE-040 출처/표본/부분 결과 UI | BE-040~41 합법 Adapter/lineage·삭제, EDA-01~10 품질/편향 | INT-040 승인된 데이터 출처/권리·누락·삭제·이력 검사 PASS |
| M5 분석 | FE-050~052 감성·논점·시계열/비교 | BE-050~052 주제·감성·트렌드, EDA 모델 품질 | INT-050 고정 분석 스냅샷/분모/시간·모델 버전 1:1 일치 |
| M6 권한·이용권 | FE-060~061 가입·로그인·범위 UX | BE-060~062 auth/session/org/plan/abuse | INT-060 다른 테넌트/BOLA·구독 만료/회수·역할 승격 차단 |
| M7 고객·운영 | FE-070~071 저장/비교/보고/운영 QA 분리 | BE-070~071 영속 업무·감사/정책 운영 | INT-070 저장→재조회→상세 분석→보고 초안 및 고객/운영 권한 E2E |
| M8 시스템 QA | FE-080~081 브라우저 사용성·장시간 | BE-080~081 부하·재시도·복구, EDA drift/quality | INT-080 안정·A11y·보안·리그레션/성능, critical/high 이슈 종료 |
| M9 제품 통합 완료 | FE-090 승인 UI·기능 동결 | BE-090 승인 실데이터 파이프라인·정책·계약 동결 | INT-090 동일 통합 SHA+환경+실 E2E+최종 인수 기록에서 PRODUCT_INTEGRATED 판정 |

**순서가 곧 모든 작업의 직렬 진행을 뜻하지는 않는다.** M1 공유 계약 이후 FE Side Panel UI와 BE Mock Provider/DB기반 서비스는 병렬 개발할 수 있다. 단 실제 YouTube API/파생 감성 지표는 외부 권리/정책 Gate 통과가 선행한다.

## 2. FE Chrome UI 필수 시나리오

| ID | 입력/절차 | PASS 판정 |
|---|---|---|
| FE-QA-01 | 실 Chrome YouTube Home/Search 썸네일 A→B→A 20회 | 올바른 카드/targetKey, 다른 ID 미표시 |
| FE-QA-02 | 썸네일 A→자기 카드→A, 카드가 가린 B 이동 | 카드 A 고정, B behind-card 클릭 차단 |
| FE-QA-03 | SPA DOM 교체·동영상 preview·같은 videoId 원거리 복제 | 근접 유효 교체만 rebound, 미확정 Fail Closed |
| FE-QA-04 | 새로운 영상 캐시 MISS | 카드 shell 표시, 실제 비율/가짜 트렌드 표시 0건 |
| FE-QA-05 | A의 더보기 클릭 후 B/C Hover | Side Panel 대상 A 유지; B 클릭 때만 B로 전환 |
| FE-QA-06 | 다른 탭·Worker 재시작·이전 requestId 지연 응답 | 탭별 대상·패널 고정 revision 누출/혼동 0건 |
| FE-QA-07 | 데이터 없음/STALE/PARTIAL/POLICY_BLOCKED/ERROR | 고객용 간결 문구, 누락/0/오래됨 구분, 내부 코드 UI 미노출 |
| FE-QA-08 | 한국어/태국어/영어 긴 제목, 다크/라이트·좁은 화면·100/125/150% 줌 | 텍스트/CTA 접근 가능·레이아웃 붕괴 없음 |
| FE-QA-09 | 키보드 Tab/Enter/Escape, 스크린리더 탐색 | Hover 대등 접근, 적절한 라벨·포커스, 색상만으로 차이 설명하지 않음 |
| FE-QA-10 | 실제 Youtube native 기능/무한스크롤 반복 | 비관련 클릭/미리보기/스크롤 방해 0건 |

각 경우 출력 로그만 아닌 **테스트된 HEAD SHA/Chrome 버전/영상 및 표면/입력/결과/스크린샷·스크린캐스트 또는 trace**를 기록한다. 개인 피드, 댓글 원문 및 민감 데이터가 캡처되면 저장 전 마스킹.

## 3. BE/데이터/ML 계약 테스트

| ID | 테스트 | 합격 기준 |
|---|---|---|
| BE-QA-01 | VIDEO/CHANNEL 유효/무효 ID와 외부 URL | 유효 ID만 처리, handle 미확정 보수적 거부 |
| BE-QA-02 | 동일 videoId 다른 tenant/scope/modelVersion | 타 고객/다른 기간 결과 교차 노출 0 |
| BE-QA-03 | 동일 조건 N개 동시 요청 | One idempotent Job per allowed scope; 결과 복수 수신 시 동일 참조 |
| BE-QA-04 | Redis/DB/Worker 종료·재시작 | Job은 durable, 중복 실행/잘못된 최종 전이 금지 |
| BE-QA-05 | API quota 소진·Provider 인증 실패·권한 회수 | 제한 초과 반복 호출 금지, 사용자에게 fail-closed |
| BE-QA-06 | 댓글 수정·삭제/비공개·TTL/모델 버전 변경 | 오래된 스냅샷 무효화, 민감 원문 재노출 없음 |
| BE-QA-07 | raw/eligible/excluded/classified/unclassified | 같은 run의 확정 분모 등식, null != 0 보존 |
| BE-QA-08 | top-level/답글 부분 확보 및 댓글 작성 시각 분리 | coverage와 fetch/event/analysis 시각 각각 기록 |
| EDA-QA-01 | schema/type/null/중복/language stratification | 품질 실패 row 격리, EDA 보고/적격성 판정 |
| EDA-QA-02 | train/test 비디오·시간 분리 및 annotator adjudication | 같은 비디오/시간 누출 차단, gold label 출처 |
| EDA-QA-03 | 주제 다중 라벨과 분모 변경 | 다중 topic 합이 100%라고 주장하지 않음 |
| EDA-QA-04 | 모형/주제 분류 버전 바꾸고 추이 비교 | 버전이 다르면 별도 재평가/비교불가 처리 |
| EDA-QA-05 | 희소/편향 코호트 및 한 시점만 존재 | TREND_UNAVAILABLE 또는 CONDITIONAL |
| EDA-QA-06 | 언어별 감성/토픽 품질·비용·drift | 분리 성능·오류 분석 보고 없으면 MODEL_GATE 보류 |

**우선 D0 합성 Fixture를 사용해 산술·API·시계열·안전 상태를 테스트한다.** 실제 댓글 NLP 성능/제공은 승인된 D1/D2 자료에 대한 권리·평가 Gate 없이는 PASS 선언 불가.

## 4. 계약·통합 버전 관리

CT-QA-01: OpenAPI/JSON Schema 파싱과 generated FE types, BE Provider schema validation을 동일 revision에서 통과.
CT-QA-02: 모든 golden status READY/PARTIAL/STALE/NO_DATA/COMMENTS_DISABLED/ENTITLEMENT_LIMITED/POLICY_BLOCKED/ERROR를 양쪽에서 해석 가능.
CT-QA-03: invalid schemaVersion과 unknown required field에 대해 안전한 fallback 또는 호환성 실패.
CT-QA-04: 서버에서 권한 거부를 return했는데 FE가 이전 캐시를 READY로 보여주는 회귀 금지.
CT-QA-05: 이전 요청의 지연 응답은 최신 Hover target/Panel pinned selectionRevision을 덮지 않음.
CT-QA-06: FE와 BE의 독립 브랜치 소스를 통합 sandbox에서 실행; 정확한 FE/BE/shared SHA와 데이터 fixture hash를 매칭.

**버전 변경 방식:** breaking change는 새 스키마/ABI revision과 두 팀 Consumer/Provider upgrade plan 없이 병합하지 않는다. frontend/backend 간 임의 직접 파일 참조 금지. 정책·타 조직 데이터를 cacheKey 하나로 공유하는 결함은 Blocker다.

## 5. UX/SLO 연구 계획 (숫자는 가설이며 현재 합격 실측 아님)

- 카드 shell 첫 표시 목표 후보: Chrome 사용자 장치 P95 ≤ 200 ms. 최종 SLA가 아닌 연구용 수치.
- valid cache HIT 첫 요약 후보: 정상 네트워크 P95 ≤ 1초. HIT/MISS/STALE/POLICY_BLOCKED별로 따로 분해한다.
- A↔B/C 대상 혼동·전환 오류: 정해진 반복 시나리오에서 0건. 시간 초과·취소·Worker 재시작도 포함.
- Data quality: raw/eligible/excluded 불변식 위반 0건; null/0 혼동 0건; 실데이터 소스/분석버전 미기재 결과 노출 0건.
- ML 연구: Macro-F1, per-language/class recall, topic label stability, calibrated abstention, 비교 가능성/대표성 조건 별도. 절대 정확도 목표는 독립 승인된 Gold Set 파일럿 이후 수립.
- 모델·데이터·UI 지표는 **서로 다른 Gate**이며, 단일 PASS 수치를 합산해 성능이 보장된 것처럼 표시하지 않는다.

## 6. M9 최종 제품 인수 시험 (진짜 통합 완료)

| ID | 제품 시나리오 | 필수 증거 |
|---|---|---|
| INT-090A | 설치형 Chrome 실 YouTube Hover·Panel 정확 대상 고정 | Chrome trace + tested FE SHA |
| INT-090B | FE→BE API→DB/Job→승인 Provider→EDA/ML→snapshot→FE | 재현 가능한 request/run lineage + accepted policy scope |
| INT-090C | 동일 영상 재방문시 허용 cache/analysis 결과 재사용 | 공개/조직별 격리·TTL/무효화·권한 테스트 |
| INT-090D | 하나의 댓글 집합에서 감성/논점/주간 추이·표본 일치 | source/model/schema/observation window 버전과 분모 |
| INT-090E | 계정/조직 권한·구독 범위·저장·비교·보고·운영자 | 사용자 역할별 인가/BOLA·영속 저장/감사 |
| INT-090F | 서비스 중단·quota·삭제·권한 회수·복구 | fail-closed/rollback/retry/deletion 검증 |
| INT-090G | 다크/라이트·A11y·메모리·시간·실 부하 | 측정 조건과 원본 테스트 로그, 남은 위험 |
| INT-090H | 경계 통합·릴리스 후보 동결·인수 서명 | source FE SHA, BE SHA, shared SHA, integration SHA, contract/model/dataset version, 승인자 |

M9는 **사용 가능한 제품 전체 연결을 실제로 증명**하는 단계다. YouTube 실데이터 파생지표/보존 권한이 승인되지 않았다면 해당 경로는 MOCK 단계로만 표시하고 제품 통합 완료(실데이터 계약 포함)를 선언하지 않는다. 공개 배포나 실제 결제 청구를 인수 요구사항에 자동 추가하지 않는다.

## 7. 반드시 남길 evidence manifest

~~~yaml
milestone: M3
work_item: INT-030
owner: integration_qa
stage: MOCK_PROVIDER
frontend_sha: null
backend_sha: null
shared_contract_sha: null
integration_sha: null
tested_sha: null
test_environment: null
test_commands: []
passed: null
failed: null
skipped: null
expected_behaviors: []
observed_behavior: null
artifacts:
  - test_log: null
  - screenshots_or_trace: null
external_refs: [EX-005]
source_usage:
  EX-005:
    design_only: true
    source_code_copied: false
    target_file_and_lines: null
    license_notice: null
policy_approval_reference: null
defects: []
review_pr: null
approver: null
gate_status: NOT_RUN
~~~

- **작성 시점:** 각 작업 PR에서 증거 append. 현재 위 값은 단지 템플릿이며 실제 테스트 실행의 증거가 아니다.
- **외부 참고 추적:** EX-ID가 실제 사용될 때 ADR/내부 파일/commit/라이선스/실험을 연결한다. 벤치마킹이 설계에만 반영되었다면 design_only로 남겨 실제 코드 채택을 주장하지 않는다.
- **원본 보존:** FAIL도 삭제하지 않고 수정/retest와 각각의 SHA를 따로 기록한다. Synthetic data, Redacted logs, no credentials.
- **권한:** PR/브랜치 변경은 담당 작업 소유자의 승인에 따르고, frontend/backend/shared/dev/main 간 명시적 통합 Gate 없이 병합하지 않는다.

**현재 확인된 YU-27 검증:** Windows Node 177/177, 오프라인 Chromium Hover 2/2 PASS(이전 사용자 제공 PowerShell 기록). 설치형 Chrome MV3 통신 검증 및 위 신규 M0~M9 인수 테스트는 **NOT RUN**.
