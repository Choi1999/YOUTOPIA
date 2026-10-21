# YOUTOPIA — 발견형 영상 분석 전달 아키텍처 v0.1

> **2026-10-21 KST / 사용자 승인: 벤치마킹 기반 제품·기술 방향 채택 / DOCUMENT-ONLY PROPOSAL**
>
> **구현 상태:** 설계·단계별 검증 계약. 이 문서로 실제 YouTube 댓글 수집, 감성·콘텐츠 주제 파생 지표, 사용자 데이터 보관, 외부 LLM 호출, 로그인/결제, Chrome Web Store 배포가 승인되거나 구현됐다고 해석하지 않는다.
>
> 선행 정본: [00_PRODUCT_DIRECTION.md](./00_PRODUCT_DIRECTION.md), [01_HOVER_SIDE_PANEL_UX.md](./01_HOVER_SIDE_PANEL_UX.md), [04_EXECUTION_00_99.md](./04_EXECUTION_00_99.md), [05_DATA_MEANING_AND_LIMITS.md](./05_DATA_MEANING_AND_LIMITS.md), [08_DECISION_AND_RISK_REGISTER.md](./08_DECISION_AND_RISK_REGISTER.md), [09_PRODUCT_GATE_CHECKLIST.md](./09_PRODUCT_GATE_CHECKLIST.md).
>
> 검증 계획: [ANALYSIS_DELIVERY_ACCEPTANCE_20261021.md](./ANALYSIS_DELIVERY_ACCEPTANCE_20261021.md).

## 1. 의사결정

**채택할 방향:** \`On-Demand Discovery + Authorized Shared Cache + Asynchronous Analysis + Progressive Results + Topic/Sentiment Time Series\`.

1. 고객마다 바뀌는 YouTube 홈 추천 피드를 수집·저장하거나 모든 추천 영상을 선분석하지 않는다. 사용자의 명시적 Hover/더보기 흐름에서 정확히 식별한 \`VIDEO:<videoId>\` 또는 \`CHANNEL:<channelId>\`만 처리한다.
2. 즉시 카드 표시와 분석 완료 시점을 분리한다. 검증된 기존 분석이 있으면 근거·분모·관측시각과 함께 표시하고, 없으면 \`LOADING_CACHE\`, \`NO_DATA\`, \`POLICY_BLOCKED\` 등 실제 상태만 표시한다.
3. 긴 댓글 분석은 Chrome MV3 Service Worker에서 실행하지 않는다. **추후 별도 승인된 서버 측 작업 큐/분석 Worker**에서 비동기 실행하도록 설계한다.
4. 동일한 공개·재사용 가능한 분석 조건의 요청은 서버 측 **Singleflight**로 중복 작업을 막는다. 조직·이용권·개인정보가 다른 결과는 동일 캐시 영역을 공유하지 않는다.
5. 주제의 **콘텐츠 분류(contentTopicId)**와 댓글의 **논점 분류(discussionTopicId)**를 분리한다. 감성, 논점, 시간의 교차 분석은 비교 가능한 관측 코호트에서만 제공한다.
6. 실제 외부 데이터 접근, 콘텐츠 태깅/감성분석의 파생 지표, 보존·재배포 규칙은 별도 법적·플랫폼 정책 검증과 승인 후에만 활성화한다. 승인 전 단계는 합성 \`STATIC_FIXTURE\`만 사용한다.

**하지 않을 일:** 모든 홈 썸네일의 자동 대량 사전 수집, Hover 때마다 원시 댓글 전체 수집, 캐시 부재 시 가짜 긍정/부정 비율 생성, 사용자 추천 피드 저장을 통한 개인 프로파일링, Node/Chromium 모의 PASS를 실제 Chrome MV3 PASS로 표현, 초기부터 Redis/Kafka/GPU 도입 강제.

## 2. 확인된 현재 단계와 경계

- YU-20~26: \`frontend\`에 합성 데이터 기반 Chrome Hover 카드까지 병합. 제품 정본의 실제 시작점은 YouTube 썸네일 Hover이며 카드에서 다른 영상으로 이동하거나 SPA 교체되더라도 기존 안전성 계약을 유지한다.
- YU-27: PR #15 (\`feature/yutopia-27-worker-messaging\`), Windows Native Node 177/177 및 오프라인 Chromium Fixture 2/2 PASS; **실제 설치형 Chrome MV3 Content↔Background 통신 검증은 남음**. 현재 \`chrome.storage.session\`의 60초 TTL은 STATIC_FIXTURE 로컬 개발용 테스트 캐시 정책일 뿐 서버/운영 정책이 아니다.
- PR #14: YU-26 종료 기록 정리 Draft, PR #15: YU-27 기능 Draft. 모두 이 설계 PR과 독립적이며 \`frontend\` 병합은 별도 승인받는다.
- YU-28: 사용자 더보기 클릭 시 Side Panel 열기/클릭 대상 고정. YU-29: 로컬 MOCK Chrome 통합 PoC. YU-30~49: 데이터 계약과 분석 체계 후속 작업.
- 서비스 모델은 VIDEO/CHANNEL 구분, 구독(조회 범위)과 역할(보안 권한) 분리, 고객/운영/DEV-QA UI 격리를 유지한다.

## 3. 권장 전달 흐름

~~~text
YouTube 홈/검색의 Hover된 썸네일 (고객 개인화 목록 전체 수집 금지)
     |
     v
Content Discovery + Video/Channel Resolver
     | 유효한 VIDEO/CHANNEL ID가 없으면 Fail Closed
     v
Hover Controller (targetKey + requestId; UI 즉시 렌더)
     |  현재 MOCK 상태: shared.js / preview-client.js / MV3 Worker
     |  단계 YU-28~29: STATIC_FIXTURE 상태 머신만 검증
     v
[향후 승인 전 서버 호출 차단]
     |
     v (YU-30 이후 설계 및 별도 정책 승인 후)
Analysis Gateway: 권한 확인 -> Request identity -> 결과 Cache Lookup
     |                                 |
  HIT / STALE                         MISS
     |                                 |
유효한 요약/시각 반환                 정책·예산·중복 작업 검사
     |                                 |
     |                         Singleflight + Durable Queue
     |                                 |
     |                         Authorized Data Provider
     |                                 |
     |                         Topic/Sentiment Worker
     |                                 |
     |                         Evidence + Result Store
     |                                 |
     +---------------> 다시 조회 / 구독된 상태 갱신
                                       |
                              Hover 카드에는 해당 시점
                              실제 확보한 상태만 표시
~~~

### 3.1 실패 및 UI 상태 대응

| 내부 원인/작업 상태(제안) | 고객용 상태(기존 UX 정본 준수) | 표시 내용 |
|---|---|---|
| 대상 ID 불명/유효하지 않음 | \`TARGET_UNKNOWN\` | 수치를 만들지 않고 대상 확인 안내 |
| 캐시 조회 중 | \`LOADING_CACHE\` | 카드는 즉시 뜨지만 분석은 조회 중 |
| 정책·권한에 따라 유효한 결과 확보 | \`READY\` | 관측 기간, 표본 수, 분석/수집 시각, 출처 포함 |
| 일부 댓글·기간만 확보 | \`PARTIAL\` | 확보된 범위와 제외된 범위를 명시 |
| 유효 기간 지난 캐시가 있으나 노출 허용됨 | \`STALE\` | 마지막 갱신시각, 업데이트 필요 고지 |
| 데이터가 없거나 아직 분석 전 | \`NO_DATA\` 또는 \`LOADING_CACHE\` | 분석 결과와 0건을 혼동하지 않음 |
| 댓글 비활성화 등 가용성 제한 | \`COMMENTS_DISABLED\` | 사실로 확인된 경우에만 사용 |
| 분석 권한/데이터 이용 조건 없음 | \`POLICY_BLOCKED\` | 요청 실행·파생 지표 생성 차단 |
| 이용권 범위를 넘음 | \`ENTITLEMENT_LIMITED\` | 업그레이드 정보는 결제 승인 전 MOCK |
| 조회/처리 오류 또는 큐 장애 | \`ERROR\` | 필요 시 재시도 안내, 과거 결과를 최신으로 위장 금지 |

내부 \`QUEUED\`/\`RUNNING\`은 UI의 비동기 \`LOADING_CACHE\` 하위 상태로 표시할 수 있으나 기존 UX의 정식 상태 명세를 무단 변경하지 않는다.

### 3.2 단계적 결과 원칙

- **UI:** Hover 카드의 표시 시간은 기존 0ms 일반 진입 지연 계약을 유지하되 실제 렌더링 시간이 0ms임을 보증하지 않는다.
- **캐시 조회:** 처음 발견된 영상에서 결과가 없으면 즉시 로딩·미확보 표시. 이미 검증된 결과만 READY로 승격.
- **비동기 작업:** 이후 서버 구현 단계에서 작업 ID와 상태로 관리. 탭 전환/Worker 종료 시에도 서버 작업 수명은 별도로 관리. 브라우저가 임의로 작업을 영구 실행하지 않게 한다.
- **응답 경합:** 늦게 돌아온 영상 A 응답이 현재 Hover 중인 B 카드에 그려지면 FAIL. Side Panel 대상은 Hover 대상과 독립적이며 오직 유효한 더보기 클릭에서만 변경한다.
- **성능 목표(초안/미검증):** 기존 HIT의 첫 유의미한 분석 표시 P95 1초 이내를 초기 실험 목표로 삼되 네트워크·정책·시스템 측정 전에는 제품 SLA로 발표하지 않는다. 신규 MISS 분석 시간은 SLA 미확정.

## 4. 콘텐츠·댓글 주제 분류

- \`contentTopicId\`: 영상이 속하는 광범위한 분야(예: FOOD/GAME/MUSIC). 가능한 공식 소스 메타데이터와 별도 YOUTOPIA 분류를 필드/출처로 분리. **공식 카테고리 값과 자체 추론 값을 같은 것으로 취급하지 않는다.**
- \`discussionTopicId\`: 댓글에서 실제로 관측한 논점(예: PRICE/RECIPE/PERFORMANCE). 추론된 군집을 안정된 공통 주제에 매핑할 수 있을 때만 장기 비교 허용.
- \`topicTaxonomyVersion\`, \`classificationModelVersion\`, \`language\`, \`confidence\` 및 매핑 근거 기록. 다른 영상에서 동일한 단어가 다른 뜻이면 강제 병합 금지.
- 감성분석은 댓글 단위와 **논점별 감성**을 구분. 한 댓글에 여러 논점이 있을 수 있어 \`topic assignment\`의 단일/다중 라벨 규칙과 분모를 계약에서 명시.
- \`TOPIC_UNRESOLVED\`와 \`UNCLASSIFIED\`를 0건, 중립, 또는 부정으로 암묵 변환하지 않는다.
- 최초 출시의 다국어 범위는 별도 테스트로 확정한다. 공개 선행 사례의 영어 중심 TF-IDF/KMeans 모델을 한국어/태국어에 그대로 사용하는 것을 승인하지 않는다.

## 5. 트렌드의 관측 단위와 지표 계약 초안

**홈 화면 등장 = 유튜브 전체 유행이라는 결론 금지.** 개인화 추천은 트렌드 모집단이 아니다. 선택된 채널/영상군과 댓글 작성기간을 명시해 관측 가능한 반응의 시계열만 제공한다.

- \`eligibleCommentCount\`: 정책·중복·가용성을 통과해 분석 대상이 된 댓글 수.
- \`topicMentionCount\`: 해당 주제로 분류된 적격 댓글 수(다중 주제 할당인 경우 중복 집계 가능성을 고지).
- \`topicMentionRate = topicMentionCount / eligibleCommentCount\`: 영상군 내 주제 언급률. 분모가 0/미확정이면 계산하지 않는다.
- \`negativeWithinTopicRate = classifiedNegativeTopicComments / sentimentClassifiedTopicComments\`: 해당 주제로 분류되고 감성까지 확정된 댓글 중 부정 비율. 다중 라벨과 감성 미분류를 별도 기록.
- \`negativeTopicShareOfEligible = classifiedNegativeTopicComments / eligibleCommentCount\`: 전체 적격 댓글 중 부정·주제 교집합 점유율. 위 감성비율과 서로 다른 의미.
- 시계열 기준은 댓글 작성 시각(\`eventAt\`)을 우선하되 데이터 발견(\`observedAt\`), 수집(\`fetchedAt\`), 분석(\`analyzedAt\`)을 분리 기록한다.
- 영상 게시 후 경과 시간, 관측 기간, 수집된 댓글 비율, 댓글 페이지네이션/답글 범위, 언어 및 모델 버전이 다른 영상은 직접 비교 결과를 \`COMPARABILITY_CONDITIONAL\` 또는 \`UNCOMPARABLE\`로 표시한다.
- 중요한 변화 신호는 언급률, 관련 절대 건수, 주제별 감성 비율의 동시 변화와 표본 품질을 함께 검토해 생성한다. 상관/동시 증가는 이슈의 원인, 제품 결함 또는 실제 사건 증거가 아니다.
- 관측이 한 시점뿐이거나 표본 부족이면 \`TREND_UNAVAILABLE\`; 특정 채널 전체에 대한 추정은 선정 영상군 밖으로 일반화 금지.

## 6. 향후 서버 캐시·작업 계약 (YU-30~39 연구안)

**운영 캐시 TTL, 큐 구현, 데이터 저장기간은 아직 확정하지 않는다.**

### 6.1 Cache Key와 보안 경계

캐시 조회 시 적어도 다음을 고려해 잘못된 결과 재사용을 방지한다.

\`source / targetType / targetId / analysisScope / allowedAudience / analysisVersion / topicTaxonomyVersion / dataPolicyVersion / language / observationWindow\`

- \`PUBLIC_REUSABLE\`과 \`TENANT_PRIVATE\`는 물리 또는 논리적으로 격리. 공통 공개 결과라 하더라도 실제 열람 권한과 이용권을 서버에서 다시 검사한다.
- \`videoId\` 단독 키로 조직 전용 분석, 다른 표본·기간·모델의 분석을 공유하지 않는다.
- 작업 큐의 Singleflight key에는 대상 ID뿐 아니라 정책상 동일한 분석 조건/권한 범위를 포함한다. Cache MISS 30건이 같은 작업을 중복 실행하지 않게 한다.
- 캐시 저장은 분석 스냅샷 메타데이터(수집범위, 표본, 기준시각, 버전, 출처·권리, 상태)를 포함해야 한다. 삭제·비공개·정책 변경의 무효화 가능성을 계약에 반영한다.
- 사용자별 추천 피드와 시청 이력 자체를 보관하는 것은 기본안에서 제외.

### 6.2 우선순위와 자원 관리

- 기본: 명시적 더보기 요청 > 사용자가 실제 Hover한 대상 > 중복 조회/추가 분석 요청. **홈 화면에 화면 표시된 모든 영상을 자동 사전 수집하지 않는다.**
- 정책 Gate, API quota·rate limit, 서버 예산, 큐 동시성 및 idempotency를 우선 검사한다.
- 캐시 \`HIT\`, \`MISS\`, \`STALE\`, \`POLICY_BLOCKED\`, \`PROCESSING\`, \`FAILED\` 원인별 별도 관측. 장시간 처리·중단·재시도는 서버의 내구성 있는 큐에 위임한다.
- 인프라 선택은 처리량 측정 후 결정. 첫 연구 구현에 Redis/Kafka/GPU를 필수 요구하지 않는다.

## 7. 벤치마킹 반영과 근거 수준

| 참고 사례 | 확인해 참고한 외부 접근 | YOUTOPIA 반영 내용 | 내부 구현 공개 여부 |
|---|---|---|---|
| [vidIQ](https://vidiq.com/extension/) | YouTube 화면에 빠른 지표 삽입 | Hover에는 가벼운 결과/상태 먼저 | 실서비스 캐시·큐 내부 미확인 |
| [Outlier](https://outlier.so/docs/chrome-extension/using-extension-youtube) | 정보 부족 시 표시 보류, 무거운 AI 작업 분리 | UNKNOWN/NO_DATA/STALE를 정식 UI 상태로 | 내부 분석 캐시 미확인 |
| [CommentPulse](https://github.com/D-393Patel/CommentPulse) | 분석 API/작업 ID/비동기 큐·토픽별 감성 | 승인 후 서버 작업 상태·동적 논점 분석 | 공개 저장소 참고, 운영 규모 미검증 |
| [VibeCheckAI](https://github.com/theresaanna/sentiment_analyzer) | Redis, Worker, 저장소 기반 분석 이력 | 로컬 vs 서버 캐시 분리, 내구 큐 후보 | 공개 코드 참고, SLA 미검증 |
| [Brand24](https://help.brand24.com/en/articles/9919606-ai-topic-analysis) | 프로젝트·주제 중심 언급/감성 시계열 | 주제 × 감성 × 시간·관측 모집단 정의 | 내부 처리·수집 구현 미공개 |
| [PULSE](https://github.com/YManishKumar1801/PULSE) | Kafka 기반 분석 파이프라인 예시 | 대규모 스트림 후보 참고, 초기 도입 보류 | 공개 교육용 코드로 상용 성능 미검증 |

벤치마킹은 사용자 승인된 **방향 선정 근거**이지 외부 서비스의 비공개 캐시 전략을 검증했다는 주장이 아니다.

## 8. 단계별 적용·승인 범위

| 실행대장 | 구현/문서 범위 | Gate |
|---|---|---|
| YU-27 | 실제 설치형 MV3 메시지/세션 MOCK 캐시 검증 | Windows Node 177/177·오프라인 Chromium 2/2 이후 **설치형 Chrome 통합 미확인** |
| YU-28 | MOCK Side Panel 열기 및 사용자의 클릭 대상 고정, Hover의 후속 응답이 패널을 바꾸지 않음 | 사용자 제스처/탭별 대상/뒤늦은 요청 회귀 |
| YU-29 | 캐시 HIT/MISS·조회중·권한차단·오래됨을 **합성 데이터 시나리오**로 통합 E2E | 실제 Chrome 환경/YouTube DOM/접근성/성능 |
| YU-30~39 | AnalysisTarget·Gateway·스냅샷·권한·큐·캐시 계약과 독립 MOCK Provider | 실제 Provider 연결은 YU-38 외부 정책 Gate 이후 |
| YU-40~49 | 주제·감성 분류 모델·관측 기준·신뢰도와 시계열 계약 검증 | 우선 합성 데이터, 실댓글은 사용권·분석 승인 증거 확보 후 |
| YU-80~99 | 실환경 SLO·메모리·격리·데이터 정책·보안·스토어 인수 | 독립 QA/배포 승인 |

**YUTOPIA 기 개발 \`hover-controller.js\`와 \`hover-card.js\`의 안정된 YU-26 동작을 불필요하게 다시 작성하지 않는다.** YU-27 PR #15의 메시지 계약을 무단 변경하거나 병합하지 않는다. 본 문서는 YU-28/29 기능 구현 또는 YU-30 이후 서버 구축의 개별 작업 승인까지 자동 부여하지 않는다.

## 9. 아직 해결되지 않은 결정

1. YU-27 실제 Chrome MV3 Service Worker/Content 메시지·캐시 점검 증거.
2. YouTube 데이터 이용권·파생 지표 및 제공범위, 보존/삭제 허용의 문서화된 정책 승인(Y-01~Y-03).
3. 서버의 분석 권한·고객/조직 범위 및 개인정보 처리 기준(S-01/S-02).
4. 국가·언어·분석 대상·댓글 취급 범위와 수집/분류 동의 요건.
5. 운영 캐시 TTL·stale 허용·재조회 간격·quota/예산·P95 목표의 실측 근거.
6. 채널 \`@handle\`을 임의 \`UC...\` ID로 추정하지 않고 정확한 식별자만 사용하는 정책.
7. 유료 구독 범위와 제품 기능 경계는 설계할 수 있으나 실제 과금은 별도 Gate.

실행·검증 항목은 [ANALYSIS_DELIVERY_ACCEPTANCE_20261021.md](./ANALYSIS_DELIVERY_ACCEPTANCE_20261021.md)로 인계한다.
