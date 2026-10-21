# YOUTOPIA — 외부 프로젝트 조사·채택 증거 대장 v1

> 2026-10-21 KST · DOCUMENT-ONLY · 외부 프로젝트의 실제 소스코드나 패키지를 YOUTOPIA에 복사/설치했다는 뜻이 아님.

연결: [FE/BE/INT 방법론](../product-v0.2/FE_BE_PRODUCT_INTEGRATION_METHOD_V3_20261021.md) · [EDA 실험](../product-v0.2/EDA_NLP_METHOD_AND_EXPERIMENTS_20261021.md) · [통합 검증](../product-v0.2/INTEGRATION_ACCEPTANCE_M0_M9_20261021.md).

## 1. 상태와 증거 기준

| 상태 | 증거 요구 | 허용되는 주장 |
|---|---|---|
| RESEARCHED | 공식 URL, 확인일, source SHA 및 핵심 동작 | 읽고 조사함 |
| DESIGN_SELECTED | ADR/설계 파일 및 선택 이유·대안 | 설계 패턴을 참고함 |
| EXPERIMENT_CANDIDATE | 소스/실험 계획 | 시험 대상 후보일 뿐 |
| PROTOTYPE_TESTED | 실제 commit, 실행 로그, 비교 실측 | 제한된 실험에서 시험함 |
| CODE_INTEGRATED | YOUTOPIA 파일/라인, 원본 라이선스, commit | 정확한 범위에 코드/라이브러리 사용 |
| VERIFIED | 테스트 SHA/명령/원본 결과 + 리뷰 | 검증된 범위에서 사용/정상 작동 |
| REJECTED/BLOCKED | 비용/정책/라이선스/품질 제외 사유 | 미채택·사용 불가 |

**현재 상태:** 위의 자료 가운데 실제 소스 재사용 CODE_INTEGRATED = 0건. 기존 PR #16/17의 방향 설계와 본 문서에서 확인된 것은 실제 런타임 적용이 아니다. 모든 외부 소스의 발행/수정일과 연구일이 다를 수 있으므로 GitHub 코드는 고정 commit을 사용한다.

## 2. 원본 증거별 적용 대장
### EX-001 · vidIQ

- **영역/출처:** FE/UX · https://vidiq.com/extension/
- **고정 근거:** 공식 서비스 문서, 확인일 2026-10-21
- **라이선스:** 상용 UI. 시각/코드 복제 근거 없음
- **직접 확인된 사실:** YouTube 페이지 위에서 SEO·성과 지표와 키워드 분석을 오버레이해 빠르게 훑어볼 수 있게 함
- **YOUTOPIA 적용 제안:** Hover 첫 화면에는 짧은 결론·소형 감성 정보만 제공, 상세는 Side Panel
- **추적할 내부 작업:** FE-020 / FE-021 / PR #17
- **현재 채택 상태:** **DESIGN_SELECTED**
- **적용하지 말아야 할 부분/제약:** 홈의 모든 신규 영상 감성분석을 실시간 처리한다는 근거는 없음

### EX-002 · Outlier

- **영역/출처:** FE/UX · https://outlier.so/docs/chrome-extension/using-extension-youtube
- **고정 근거:** 공식 도움말, 확인일 2026-10-21
- **라이선스:** 상용 UX 관찰에 한정
- **직접 확인된 사실:** 영상별 성과 점수 제공, 데이터가 충분하지 않으면 대시 표시
- **YOUTOPIA 적용 제안:** 빈 값/새 영상/오래된 분석은 숫자를 꾸며내지 않고 간결한 고객 문구로 처리
- **추적할 내부 작업:** FE-020 / FE-031 / UX-03·04
- **현재 채택 상태:** **DESIGN_SELECTED**
- **적용하지 말아야 할 부분/제약:** 성능 Outlier score와 댓글 감성은 다른 지표

### EX-003 · Brand24

- **영역/출처:** FE/EDA/분석 · https://help.brand24.com/en/articles/9919606-ai-topic-analysis
- **고정 근거:** 공식 도움말, 발행 2026-01-20; 확인일 2026-10-21
- **라이선스:** 상용 UX 관찰에 한정
- **직접 확인된 사실:** 주제별 언급량 시간 그래프, 핵심 문구, 관련 감성, Share of Voice를 분리 표시
- **YOUTOPIA 적용 제안:** 주제×감성×시간 구조와 분모별 별도 지표 채택; Panel 요약·주제·추이 탭
- **추적할 내부 작업:** FE-050 / BE-052 / PR #16·#17
- **현재 채택 상태:** **DESIGN_SELECTED**
- **적용하지 말아야 할 부분/제약:** 사용자 지정 프로젝트 관측이며 YouTube 개인화 홈 전체의 즉시 분석 기술 증거 아님

### EX-004 · Google Chrome Side Panel sample

- **영역/출처:** FE/확장 · https://github.com/GoogleChrome/chrome-extensions-samples/blob/1bdfa5a730396cc4615d1e32d7c7152a92a6babe/functional-samples/cookbook.sidepanel-open/service-worker.js
- **고정 근거:** commit 1bdfa5a730396cc4615d1e32d7c7152a92a6babe; blob 50fe7eda173e9bb96b9f8db2574fba71c70fee56
- **라이선스:** Apache-2.0; LICENSE blob d645695673349e3947e8e5ae42332d0ac3164cd7
- **직접 확인된 사실:** 런타임 메시지에서 사용자 동작을 통해 chrome.sidePanel.open 호출. 공개 이슈 #1477에서 open/setOptions 순서 주의점 기록
- **YOUTOPIA 적용 제안:** 클릭 제스처·탭 대상 고정·패널 경로/재클릭 경쟁조건을 YOUTOPIA E2E로 별도 검증; 예제 코드 직접 복사하지 않음
- **추적할 내부 작업:** FE-021 / INT-020
- **현재 채택 상태:** **DESIGN_SELECTED**
- **적용하지 말아야 할 부분/제약:** https://github.com/GoogleChrome/chrome-extensions-samples/issues/1477 - 공식 샘플이라도 무검증 복사 금지

### EX-005 · CommentPulse

- **영역/출처:** BE/EDA/MLOps · https://github.com/D-393Patel/CommentPulse/blob/e9800554073416ab2a27db2155642ff16157c494/dvc.yaml
- **고정 근거:** commit e9800554073416ab2a27db2155642ff16157c494; dvc blob 94c03370b9848b3bc93274286816e327edd656a8; compose blob a99475d4f38e1723ce4cd9a18a7e7d3f51e1dc8b
- **라이선스:** MIT; LICENSE blob a4da786f3a5005be872daecb1655bc27af87a2a3
- **직접 확인된 사실:** DVC 데이터 수집→전처리→학습→평가→등록 단계와 data_quality/model 보고서 outputs. docker-compose Redis+web+worker 및 dead-letter 옵션
- **YOUTOPIA 적용 제안:** EDA 산출물 분리·재현성·Job/Dead Letter Gate를 연구안에 반영. DVC/Redis는 파일럿 결과 전까지 필수 도입 아님
- **추적할 내부 작업:** EDA-01~10 / BE-032
- **현재 채택 상태:** **DESIGN_SELECTED**
- **적용하지 말아야 할 부분/제약:** 해당 확장의 페이지 표시 댓글 추출 방식을 YouTube 홈 자동 수집에 사용하지 않음

### EX-006 · VibeCheckAI

- **영역/출처:** BE/분석 · https://github.com/theresaanna/sentiment_analyzer/blob/81487a4a7c058d6a5a39a8229642df1856939657/analysis_worker.py
- **고정 근거:** commit 81487a4a7c058d6a5a39a8229642df1856939657; blob 4a0946622a8946fe2036c73d16895cbb11e25d6a; README blob c165c653d9849375749257bb9e227a26a6c7bba9
- **라이선스:** README에 MIT 명시, 그러나 root LICENSE 조회 404. 코드 복제 보류
- **직접 확인된 사실:** DB Job status→댓글 fetch→batch sentiment→집계·DB 저장을 백그라운드 프로세스에서 수행
- **YOUTOPIA 적용 제안:** API 응답과 Worker의 수명 분리·배치 처리 개념만 참고
- **추적할 내부 작업:** BE-030~032 / BE-050
- **현재 채택 상태:** **DESIGN_SELECTED / SOURCE_REUSE_BLOCKED**
- **적용하지 말아야 할 부분/제약:** 서비스 성능과 라이선스 확인 전 원본 재사용 없음; 빈 댓글을 0%로 처리하는 패턴도 그대로 사용하지 않음

### EX-007 · BERTopic

- **영역/출처:** BE/EDA/토픽 · https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py
- **고정 근거:** commit 9036123c97aaa9a6cc4bec4a6db1a7caf9209df6; blob cfafb58acbf683e7c075116d40d1f5226bf55bb2
- **라이선스:** MIT; LICENSE blob 884719a7e208791b33df78190c974a98260e7f56
- **직접 확인된 사실:** topic-over-time은 fit된 global topics를 time-bin별 c-TF-IDF 표현으로 추적
- **YOUTOPIA 적용 제안:** 감성-주제-시간 모델 실험 후보, 클러스터 번호는 고정 discussionTopicId로 무단 사용 금지
- **추적할 내부 작업:** EDA-07~09 / BE-051
- **현재 채택 상태:** **RESEARCHED / EXPERIMENT_CANDIDATE**
- **적용하지 말아야 할 부분/제약:** 다국어 정확도·메모리 비용·실데이터 사용권 확인 전 설치·훈련 없음

### EX-008 · Pandera

- **영역/출처:** EDA/데이터 품질 · https://github.com/unionai-oss/pandera/blob/dd6a26f3637547cd20471f8e4d768d0fe4caa656/docs/source/dataframe_schemas.md
- **고정 근거:** commit dd6a26f3637547cd20471f8e4d768d0fe4caa656; docs blob c7baed7d7f6ba30fd0edd0f3e493403e2aa6defa
- **라이선스:** MIT; LICENSE.txt blob 77d3743720e5d45f8867207178e8155dd562e71d
- **직접 확인된 사실:** DataFrameSchema로 필수성·null·중복·타입과 Column Checks 적용 가능
- **YOUTOPIA 적용 제안:** 입력 데이터/관측 시각/누락/계수 등의 품질 게이트를 이 도구 후보로 평가
- **추적할 내부 작업:** EDA-02 / CT-001
- **현재 채택 상태:** **RESEARCHED / EXPERIMENT_CANDIDATE**
- **적용하지 말아야 할 부분/제약:** Python 환경·버전·성능 검증 후 채택

### EX-009 · Evidently

- **영역/출처:** EDA/ML 품질 · https://www.evidentlyai.com/ml-in-production/data-drift
- **고정 근거:** 공식 설명 + source commit 34771fe41c08ca074d96a52aaf4a45cd640cbaf5
- **라이선스:** Apache-2.0; LICENSE blob f339cc7fc8fe13467e1b3f3a7afa02b29714b2bb
- **직접 확인된 사실:** 입력 데이터 특성의 변화와 모델 출력 분포 변화(prediction drift)를 구분
- **YOUTOPIA 적용 제안:** 언어/주제/댓글 길이/모델 출력 분포 변화 분석 도구 후보
- **추적할 내부 작업:** EDA-07 / BE-081
- **현재 채택 상태:** **RESEARCHED / EXPERIMENT_CANDIDATE**
- **적용하지 말아야 할 부분/제약:** drift 감지 자체가 모델 문제의 원인 진단이나 재학습 승인 아님

### EX-010 · PULSE

- **영역/출처:** BE/대안 · https://github.com/YManishKumar1801/PULSE/tree/e3c3faaa9173d88db5de01b752062a3892b4fa72
- **고정 근거:** source commit e3c3faaa9173d88db5de01b752062a3892b4fa72
- **라이선스:** 이번 조사에서 LICENSE 미확인 — 코드 재사용 금지
- **직접 확인된 사실:** 교육용 YouTube/NewsAPI→Kafka→NLP→MongoDB→Streamlit 실시간 분석 구조
- **YOUTOPIA 적용 제안:** 초기 M3에서 Kafka·GPU를 도입하지 않고 처리량 증거가 생기면 재평가
- **추적할 내부 작업:** BE-032 기술 선택 ADR
- **현재 채택 상태:** **REJECTED_FOR_INITIAL_STACK**
- **적용하지 말아야 할 부분/제약:** 교육용이라는 자기소개로 상용 성능 입증 불가

### EX-011 · YouTube API / derived metrics policy

- **영역/출처:** BE/Policy · https://developers.google.com/youtube/terms/derived-metrics-policy
- **고정 근거:** 공식 정책·2026년 개정. 연계: https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
- **라이선스:** 제품 이용 조건, 오픈소스 라이선스 아님
- **직접 확인된 사실:** 승인된 Analytics&Reporting 용도의 파생 지표/콘텐츠 태깅·감성 규칙, commentThreads.list 페이지네이션·쿼터
- **YOUTOPIA 적용 제안:** 실데이터 호출·주제/감성·저장은 승인 Gate 충족 전 BLOCKED, test는 synthetic/별도 허용 데이터로
- **추적할 내부 작업:** BE-040 / M4·M9 정책 Gate
- **현재 채택 상태:** **GATE_REQUIRED**
- **적용하지 말아야 할 부분/제약:** 정책 승인과 고객 제품에 안전하게 표시할 수 있는 UX는 구분

### EX-012 · YOUTOPIA Figma approved baseline (internal, not external)

- **영역/출처:** FE/내부 정본 · https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-2
- **고정 근거:** 98-09 Hover, 98-10 Panel node 1276:217, Figma metadata checked 2026-10-21
- **라이선스:** 내부 사용자 제공 디자인 정본
- **직접 확인된 사실:** Hover 카드 약 356×470, Side Panel 약 435 폭·요약/주제/추이 탭
- **YOUTOPIA 적용 제안:** 별도 Compact 후보 336~356×260~320 시안 검증, 원본 삭제/덮어쓰기 금지
- **추적할 내부 작업:** FE-002 / FE-020 / PR #17
- **현재 채택 상태:** **DESIGN_SELECTED**
- **적용하지 말아야 할 부분/제약:** 코드/실 Chrome 반영·새 Figma 시안은 아직 없음

### EX-013 · Chrome Identity API + OWASP OAuth2 — 고객 로그인과 안전한 Context Return

- **영역/출처:** FE 인증 UX + BE 신원·세션 보안 설계. 공식 API https://developer.chrome.com/docs/extensions/reference/api/identity , 보안 지침 https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html , Chrome 확장 품질 권고 https://developer.chrome.com/docs/webstore/best-practices
- **고정 근거:** 공식 문서 URL 및 조회일 2026-10-21 (문서 사이트는 Git commit이 아닌 URL+조회일로 기록); Chrome Identity API에서 사용자 상호작용이 시작한 launchWebAuthFlow / getRedirectURL 동작 확인, OWASP의 Authorization Code + PKCE·transaction state·OIDC nonce·redirect/issuer 검사 지침 확인.
- **라이선스:** API·보안 구현 가이드 조사(코드·이미지·상용 UI 원본 복제 없음). 기술 문서는 소프트웨어 라이선스와 구별한다.
- **실제 확인한 원칙:** 최초 확장 진입 시 대화형 Auth Flow 자동 시작 금지; 사용자 동의 의도를 설명하는 UI에서만 인증 시작. OAuth public client의 authorization-code interception/replay 및 open redirect 방지에 PKCE/state/nonce/issuer 검증.
- **YOUTOPIA 적용 결정:** Guest-first 기본 Hover/Side Panel → 저장·비교 등 필요 순간 로그인 → 일회용 AuthReturnIntent로 클릭 당시 선택 대상과 작업 복귀, 서비스 로그인과 YouTube 채널 OAuth 동의를 분리.
- **설계 근거·소유 작업:** [Guest Auth Context-Return UX](../product-v0.2/GUEST_AUTH_CONTEXT_RESTORE_UX_20261021.md) · [Auth Acceptance](../product-v0.2/GUEST_AUTH_ACCEPTANCE_20261021.md); M1 Auth 계약 후보 / M2 UX Mock / M6 실제 인증 / M9 통합 검증.
- **현재 상태:** **DESIGN_SELECTED / CODE_INTEGRATED=NO / SECURITY_QA_NOT_RUN**. OAuth 공급자, Chrome identity permission, 서버 세션, 실제 인증 API는 아직 구현되지 않음.
- **제약:** Google 로그인을 서비스 인증의 유일한 방식으로 결정한 것이 아니며, Chrome Identity API를 쓰기로 확정한 것도 아님. 실제 Auth 기술과 사용자 선택 의도 보존은 FE·BE 보안 ADR/검증 필요.

## 3. 실제 적용/사용 확인 테이블 (초기값은 NONE)

| 참조 | 계획된 내부 위치 | 실제 구현 commit/파일 | 테스트 SHA·실측 | 현재 판정 |
|---|---|---|---|---|
| EX-001~003 / EX-012 | Figma 후보, FE-020·021·050 | **NONE** | **NOT_RUN** | 설계 참고 |
| EX-004 | FE-021 Chrome Side Panel | **NONE** | 설치형 Chrome E2E 미수행 | 공식 API 참고, 샘플 복사 0건 |
| EX-005~006 | EDA-01~10, BE-032 Job | **NONE** | **NOT_RUN** | MLOps/Worker 구조 참고 |
| EX-007~009 | BE-051, EDA-02~09 | **NONE** | **NOT_RUN** | 라이브러리 실험 전 |
| EX-010 | BE-032 Kafka 대안 | **NONE** | **NOT_RUN** | 초기 미채택 |
| EX-011 | M4~M9 데이터 승인 Gate | 실제 승인 **NONE** | **POLICY_PENDING** | 실데이터 분석 차단 |
| EX-013 | M1/M2/M6 Guest-login·Context Return 설계 | **NONE** | OAuth·Session·실 Chrome E2E **NOT_RUN** | 공식 API·보안 지침 설계 참고 |

## 4. 실제 사용 시 제출해야 하는 기계/사람 증거

~~~yaml
reference_id: EX-005
research_date: 2026-10-21
source_repo_commit: e9800554073416ab2a27db2155642ff16157c494
source_file: dvc.yaml
source_blob_sha: 94c03370b9848b3bc93274286816e327edd656a8
source_license: MIT
external_observation: data_ingestion-to-model_registration outputs
adoption_status: DESIGN_SELECTED
adr_id: null
copied_code: false
youtopia_path: null
youtopia_commit: null
tested_sha: null
test_command: null
test_result: NOT_RUN
review_pr: null
user_approval: architecture-direction-only
remaining_gates: [IMPLEMENTATION, QUALITY, POLICY]
~~~

실제 코드 복제가 발생하면 copied_code=true로 승격하고 해당 파일/라인·변경 diff·라이선스 고지 및 NOTICE·PR·테스트를 함께 제출한다. 라이선스와 API 데이터 이용 정책은 서로 다른 별도 승인이다. 가능하면 결과물에는 **EX-ID → ADR-ID → FE/BE/EDA-ID → commit → tests → Gate** 연결을 포함한다.

## 5. 유지·감사 규칙

1. 출처 수정/삭제 시 과거 source revision을 보존한 채 새 조사 스냅샷 추가. 고정 ref 없이 현재 default branch만을 영구 정본으로 인용하지 않음.
2. 자료 접근이 불명확하거나 라이선스 파일이 없는 경우 무단 재사용 금지. 상용 UI CSS/아이콘/브랜드 문구는 관찰 용도 이외 복제 불가.
3. 외부 README의 성능 주장이나 상용화 명칭은 YOUTOPIA 성능·법적 승인 증거가 아님.
4. 정책이 허용하지 않는 YouTube 데이터 추출 방식을 표면만 바꿔 구현하지 않는다.
5. 설계 문서 작성은 코드 적용 증거가 아니며 실제 통합 M9의 합격 판정과 무관하다.
