# YOUTOPIA — EDA → NLP 감성/주제 → 트렌드 연구 방법 v0.1

> 2026-10-21 KST / **EXPERIMENT PLAN / NO REAL YOUTUBE DATA COLLECTED OR MODEL TRAINED IN THIS PR**
>
> 대상: FE/BE M4(데이터 적격성·수집 품질)와 M5(감성/주제/시계열). 외부 데이터 접근·파생 감성/태깅·장기 보존은 YouTube 정책 및 개인정보 Gate를 충족하기 전에는 허용되지 않는다.
>
> 근거: [CommentPulse DVC 파이프라인 고정 버전](https://github.com/D-393Patel/CommentPulse/blob/e9800554073416ab2a27db2155642ff16157c494/dvc.yaml), [BERTopic `topics_over_time`](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py), [Pandera DataFrame Schemas](https://github.com/unionai-oss/pandera/blob/dd6a26f3637547cd20471f8e4d768d0fe4caa656/docs/source/dataframe_schemas.md), [Evidently 데이터 드리프트 설명](https://www.evidentlyai.com/ml-in-production/data-drift), [YouTube commentThreads.list](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list).
>
> 별도: [FE/BE/INT 아키텍처](./FE_BE_PRODUCT_INTEGRATION_METHOD_V3_20261021.md), [외부 근거/채택 기록](../research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md), [인수 테스트](./INTEGRATION_ACCEPTANCE_M0_M9_20261021.md).

## 1. 연구 질문과 결과물

| 질문 ID | EDA/실험 질문 | 최종 지표/화면 연계 | 확인해야 할 실패 |
|---|---|---|---|
| RQ-01 | 같은 영상의 댓글 확보율과 시간별 편향은? | snapshot coverage / 기간·표본 라벨 | 최신 댓글만 수집한 채 전체 대표로 표시 |
| RQ-02 | 댓글의 긍정/중립/부정은 언어·영상 분야마다 다른가? | sentiment bar와 품질 제한 | 언어·정치/풍자/반어 오분류 |
| RQ-03 | 영상 자체 주제와 댓글에서 토론하는 논점은 다른가? | contentTopicId vs discussionTopicId | “요리 영상”을 “가격 불만”과 동일 주제로 착각 |
| RQ-04 | 같은 논점의 감성과 언급량이 시간에 따라 변하는가? | Side Panel 추이/이슈 후보 | 분모·모델·표본 변화로 가짜 상승 |
| RQ-05 | 신규 영상에 분석 정보가 없을 때 응답 신뢰를 유지하는가? | Hover LOADING/NO_DATA/PARTIAL | cache MISS 시 fake 0 또는 synthetic percentage |
| RQ-06 | 재분석·삭제·권한 회수 뒤 정보가 무효화되는가? | evidence availability/state | 오래된 삭제 댓글/차단 결과 재사용 |

## 2. 데이터 접근 Gate: 시험 단계 구분

- **D0: SYNTHETIC:** 의도적으로 설계한 가상 댓글, 시간대, 언어, 주제/감성 라벨. 데이터 변환/분모 계산/시각화/API 테스트는 가능. **모델의 실제 분석 정확도나 실제 트렌드 대표성을 입증하지 못한다.**
- **D1: EXPLICITLY_LICENSED/OFFLINE:** 권리·이용목적·보존/삭제 기준이 문서로 확인된 독립 데이터셋으로 오프라인 분석; 해당 데이터 권리·훈련 라이선스와 대상 모델 라이선스를 각각 검토.
- **D2: YOUTUBE_API_APPROVED:** 허용된 YouTube API/파생 지표 사용을 별도 승인 증거로 확인한 뒤 그 범위에서만 실제 수집·분류·저장·통계 제공. 사용자 개인 추천 피드/시청 이력 일괄 수집은 기본 제외.
- 위 요건이 없으면 수집 Adapter는 네트워크 호출 없이 **POLICY_BLOCKED**, 분석은 Mock Provider에만 연결. 운영 고객 UI에 D0 합성 감성 수치를 실제 분석으로 제공하지 않는다.

**기록할 정책 증거:** dataSource, API project, allowedPurposes, approvalScope, acceptedPolicyVersion, obtainedAt, expiry/deletion/refreshRule, approver, source citation. 불명확하면 D2 시작 금지.

## 3. 연구 데이터 모델 (필드명은 계약 후보)

~~~text
DiscoveryRequest  -> targetType, targetId, requestAt, scope, policyContext
CollectionRun     -> runId, authorizedSource, query, pageTokens, quota, results
CommentObservation-> commentId, videoId, threadId, parentId, eventAt, fetchedAt,
                     observedAt, editedAt, language, textRef, availability, eligibility
QualityAssessment -> isDuplicate, eligibleReason, exclusionReason, policyStatus,
                     threadCoverage, replyCoverage, sampleMethod
Inference         -> sentimentLabel, topicAssignments[], confidence?,
                     modelVersion, taxonomyVersion, analyzedAt
TrendSnapshot     -> windowStart/end, cohortId, topicCounts, eligibleCounts,
                     classifiedCounts, comparability, reportAt
~~~

- `eventAt`: 댓글 게시/수정 기준 시각(정의·원천 검증). `fetchedAt`: 실제 API 수집. `observedAt`: 연구 시스템 관측. `analyzedAt`: 모델 분류. 서로 치환하지 않는다.
- `commentId + contentVersion` 또는 API가 제공한 수정시각/ETag와 수집 기준을 사용해 재수집 중복 및 수정/삭제 경합 처리. 의미적으로 같은 댓글을 별도 ID로 잡는 경우는 추가 중복 진단.
- `raw, eligible, excluded, sentimentClassified, sentimentUnclassified, topicClassified, topicUnclassified` 각각을 명시. **`null != 0`**; 근거 없이 누락을 0으로 변환하지 않는다.
- `raw = eligible + excluded`는 같은 run·동일 관측 범위의 확정치에만 검사. 다중 토픽 분류에서는 topic mentions 합계가 eligible을 초과할 수 있다.
- API `commentThreads.list`는 한 페이지 최대 100 스레드, pageToken 기반 탐색. 답글 범위/실제 확보한 스레드 수·가용성/비공개/삭제를 별도 표현한다.

## 4. EDA 순서 — 산출물·검사 기준

| EDA ID | 실제 방법 | 자동 검증/진단 | 저장할 산출물 |
|---|---|---|---|
| EDA-01 데이터 현황 | 승인 소스·목적·범위·스키마·기간/언어/라벨 통계 기록 | policy/manifest 누락 시 시작 차단 | `dataset_manifest.json`(민감값 제외), 접근 허가 증거 |
| EDA-02 스키마 품질 | Pandera 후보로 id, datetime, null, uniqueness, label enum, negative counts 검사 | 스키마 오류 행 격리·불변 조건 위반 시 FAIL | `reports/eda/schema_validation.json` |
| EDA-03 커버리지 | 스레드/답글/영상별 관측, 누락된 시간대·부분 수집 구간, quota 실패 집계 | 페이지 수/실측 coverage unknown과 0 분리 | `reports/eda/coverage.json` |
| EDA-04 중복·수정 | commentId/threadId 중복, 원문 수정/삭제·재수집 결과 비교 | 동일 run 이중 계수 0건; 삭제 시 접근 차단 | `reports/eda/dedup_audit.json` |
| EDA-05 표본 편향 | 영상 크기/게시연령/언어/업로드 분야/수집 방법·시간별 층화 | 한 층에 몰린 모집단으로 전체 시청자 추론 금지 | `reports/eda/sampling_bias.md` |
| EDA-06 텍스트 분포 | 길이, 문자·언어·이모지·URL·광고/스팸, 반복 표현, 번역 필요 비율 | 제거 사유별 비율 기록; 의미 손실 A/B 검사 | `reports/eda/text_profiles.json` |
| EDA-07 시계열 특성 | 댓글 게시일 vs 수집일/영상 업로드일; 시간 bin별 커버리지·outlier·빈 구간 | 단일 시점/관측 부족에서 TREND_UNAVAILABLE | `reports/eda/temporal_diagnostics.json` |
| EDA-08 라벨 실험 | 긍/중/부, 주제 다중 라벨 기준서, 언어별 사람 이중 주석·불일치 중재 | 평가용 Gold Set과 train/test 오염 없음 | `reports/eda/annotation_agreement.md` |
| EDA-09 재현성 | 스크립트·의존성·seed·dataset manifest/hash·split 정의 기록 | 동일 입력에서 분모·주제 ID 안정성 테스트 | `reports/eda/reproducibility.json` |
| EDA-10 승인 판정 | 데이터 적격/커버리지/대표성/라벨 품질/비용·삭제 룰 결과 검토 | FAIL/CONDITIONAL은 후속 모델·실서비스 주장 차단 | `reports/eda/eda_gate.md` |

**EDA는 노트북 시각화만 제출하면 완료가 아니다.** 차트는 어떤 표본·언어·시각·버전에서 생성됐는지 추적 가능해야 하고, 실제 raw text/PII를 Git에 추가하지 않는다. EDA 결과는 승인된 통계/마스킹된 메타데이터로 보존한다.

## 5. 데이터셋 분할·라벨링의 설계

1. 분석 대상은 **선정된 영상군의 적격 댓글**, YouTube 전체 이용자 또는 개인화 추천 전체가 아니다. 영상/채널/언어/게시기간/관측방법을 strata로 고려한다.
2. 감성·주제 라벨 가이드 작성: 풍자·반어, 혼합감성, 질문, 인용, 광고, 다국어/코드스위칭, 의견이 아닌 뉴스 문장, 주제 미분류, 다중 주제.
3. **누출 방지:** 댓글을 무작위로만 나누면 같은 영상/채널의 유사 표현이 train/test에 동시에 들어갈 수 있으므로, `videoId` 또는 `channelId` 단위 그룹 보류 테스트와 시간별 forward test를 별도 수행한다.
4. 라벨 품질: 2명의 독립 주석자와 중재 절차 제안, confusion matrix/일치도(Cohen's kappa 등) 기록. 구체 표본 크기·합격 기준은 D1/D2 데이터 접근 후 파일럿으로 결정.
5. 기준선: 비학습 lexical keyword heuristic과 TF-IDF + Logistic Regression 등의 가벼운 모델. 언어별 성능/비용 보고 후 다국어 Transformer·BERTopic 등을 후보로 시험.
6. Topic discovery는 BERTopic의 embeddings + c-TF-IDF 방식과 `topics_over_time()`를 연구하되, 발견된 클러스터 번호를 영구 `discussionTopicId`로 사용하지 않는다. 안정된 topic taxonomy(버전/근거/수동 검토)로 매핑해 비교.
7. 훈련·튜닝 데이터의 유효성·권리와 모델/라이브러리 라이선스를 독립 검토. 타 프로젝트 학습 가중치나 주석 데이터는 허가 없이 복제·재사용하지 않는다.

## 6. NLP 평가·오류 분석 및 모델 승격

| 평가 | 측정 방법 | 결함 유형 |
|---|---|---|
| 감성 | Macro F1, per-class Precision/Recall, 혼동행렬, 언어별/주제별 분리 | 부정 소수 클래스 무시, 중립 과대 예측 |
| 불확실성 | confidence calibration, abstention/unclassified rate; 임계값별 정확성-가용성 tradeoff | 낮은 신뢰 예측을 확정으로 승격 |
| 논점 분류 | 다중 라벨 Precision/Recall/F1, topic consistency, human interpretability | 논점 누락·언어 간 잘못된 매핑 |
| 토픽 안정성 | seed·시기·영상 재표본화 시 cluster/topic 매핑 안정성 | 다른 주차 주제를 같은 ID로 오인 |
| 추이 신호 | matched windows, 절대건수/언급률·분모/영상 업로드 연령·언어/수집률 비교 | 댓글 표본 이동을 ‘급상승’으로 오해 |
| 운영 비용 | batch latency, tokens/CPU/GPU 시간, quota, 메모리, cost per 1k comments | GPU/Queue가 예상보다 비싸거나 지연 |
| Drift | reference/current 언어·카테고리·문자 길이·감성 클래스·토픽 분포 비교 | 입력 분포 변화를 모형 고장으로 오인 |

- **모델 승격 조건 후보:** Gold Set + 독립 비디오/시간 홀드아웃에서 기존 baseline 대비 우위, 중요한 클래스의 하락 없음, 불확실 시 보류 안전성, 언어별 품질 기록, 추론 비용/성능 적합. 초기 macro-F1 등의 절대 숫자는 실제 데이터 기반 파일럿 이후 별도 ADR에서 확정한다. Synthetic 100% PASS는 모델 정확도 PASS가 아니다.
- **Drift:** Evidently 같은 라이브러리는 평가/모니터링 후보일 뿐 자동 운영 도입 확정이 아니다. drift 탐지 = 원인·대응 판정이 아니며 임계값 경보 후 샘플링 진단·재라벨링을 요구한다.
- **인과 주장 금지:** 주제 부정률과 언급률 동시 증가만으로 사건 원인이나 제품 결함을 확정하지 않는다.

## 7. 주제 × 감성 × 시간: 계산 정본 후보

같은 `cohort` 및 `observationWindow`에서:

`topicMentionRate = topicMentionCount / eligibleCommentCount`

`negativeWithinTopicRate = classifiedNegativeTopicComments / sentimentClassifiedTopicComments`

`negativeTopicShareOfEligible = classifiedNegativeTopicComments / eligibleCommentCount`

- 세 지표의 분모는 서로 다르다. 고객 Hover에 혼합 표시하지 않고, Side Panel 상세에서 기간·표본·분모를 설명한다.
- `eligibleCommentCount=0` 또는 분모 미확정 시 해당 비율 **계산/표시 안 함**. 다중 라벨 토픽의 합계를 억지로 100%로 만들지 않는다.
- 일/주 변화는 단순 두 스냅샷이 아니라 **비교 가능성**과 관측 범위 보정을 확인. `TREND_UNAVAILABLE`·`COMPARABILITY_CONDITIONAL`·`UNCOMPARABLE` 상태를 별도로 관리한다.
- `topicTaxonomyVersion`, `modelVersion`, `dataPolicyVersion` 변경 뒤에는 이전 시계열을 묵시적으로 연결하지 않는다.
- 채널/산업 전체 결과는 실제 수집·선정 영상군 밖으로 일반화하지 않는다.

## 8. 권장 실험·재현 파이프라인 (아직 구현 전)

~~~text
(dataset authorization manifest)
  -> 01 Ingest (licensed/static fixture)
  -> 02 Validate + Quality/EDA
  -> 03 Deduplicate + Normalize + Language detect
  -> 04 Human Annotation + Group/Time Split
  -> 05 Baseline sentiment and topic
  -> 06 Compare transformer/BERTopic candidates
  -> 07 Evaluate per language and drift
  -> 08 Approve taxonomy/model & analysis contract
  -> 09 Build snapshots (sample/provenance/time)
  -> 10 FE displays authorized result only
~~~

**재현성 도구 후보:** CommentPulse의 `dvc.yaml`처럼 `data_ingestion → data_preprocessing → model_building → model_evaluation → model_registration` 단계에 출력을 고정하되, DVC를 바로 운영 필수 도구로 채택하지 않는다. 데이터 재현성 필요와 인력·저장소 비용을 파일럿으로 확인. Pandera는 스키마 검사, Evidently는 드리프트 품질 보고서 후보.

## 9. EDA 승인 체크 (모두 계획; 아직 결과 없음)

- [ ] EX-005, EX-008, EX-009, EX-010 출처 파일/commit/license 검증
- [ ] D1/D2 합법적 데이터셋/보존·모델 훈련 허가 승인 또는 MOCK-only 명시
- [ ] schema/null/eligible/excluded/coverage/duplicate/edited/deleted 검증
- [ ] language/category/video-age stratum별 표본 편향과 품질 보고
- [ ] Gold labels + group/time split + independent human adjudication
- [ ] Baseline/후보 모델 실측 비교·오류 분석·언어별 품질
- [ ] Topic taxonomy stability + versioned trend comparability
- [ ] 재현 가능한 코드/설정/seed/data manifest, 검증 SHA/명령/원본 결과
- [ ] FE 요약 수치와 BE 분모·시각·출처의 end-to-end 단위 일치
- [ ] 정책·보안/삭제 변경시 stale 데이터 무효화 테스트

이 문서는 EDA/NLP 개발 **방법 제안**이고 실제 데이터 수집·모델 훈련을 시작한 것이 아니다.
