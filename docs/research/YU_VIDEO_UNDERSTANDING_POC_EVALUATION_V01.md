# YOUTOPIA — 영상 이해·최소비용 근거 검색 PoC 평가 계약 v0.1

> 상태: DOCUMENTED / OFFLINE_ONLY / NO_LIVE_CALLS / NO_REAL_VIDEO_INGESTION / NO_PRODUCTION_WRITE
> 작성: 2026-11-05 KST
> 작업 브랜치: experiment/yu-video-understanding-poc-v01
> 고정 분기 기준: frontend@372486707eb04350faa28af0d86e3b2eb2f50f82
> 문서 책임: 독립 연구·검증. 이 문서는 공급자 승인, YouTube 수집 권한, 유료 호출 또는 병합 승인이 아니다.

## 1. 목적과 검증 질문

YOUTOPIA의 일반 YouTube 댓글 반응 분석에 사용할 '영상 내용에 대한 검증 가능한 근거'를 최소 총비용으로 제공하는 방식을 평가한다. 댓글은 어디를 살펴볼지 제안하는 신호일 뿐 영상 사실의 증거로 직접 승격하지 않는다.

검증해야 할 질문:
1. 영상 내용의 발화·화면·시간 순서를 근거 있는 응답으로 추출할 수 있는가?
2. 동일 영상에 후속 질문이 반복될 때 의미 인덱스의 선처리 비용을 회수할 수 있는가?
3. 자막만으로는 확인할 수 없는 시각적 사실을 얼마나 정확히 보완하는가?
4. 답이 없는 질문과 모호한 장면에 '근거 불충분'이라고 답할 수 있는가?
5. 서비스/권리/개인정보/비용 게이트를 만족하는가?

## 2. 범위와 명시적 제외

**이번 커밋 범위:** 평가 계약 및 이후 오프라인 fixture 작업을 위한 기준 문서만 작성한다.

포함할 실험군 (실행은 별도 단계):
- A — Native multimodal: 공급자가 공식적으로 지원하고 약관상 사용 가능한 경우에만 공개 YouTube URL 직접 입력으로 영상 이해. 모델·URL 지원 범위·영상 길이/용량·정책·요금은 **실행 직전에 별도 확인**한다.
- B — Semantic index: 이용권이 검증된 영상/음성/자막 입력만 사용해 발화, OCR, 시각 사건, 시간 단위 근거를 추출·저장하고 필요한 구간을 재조회한다.
- C — Transcript-only baseline: 이용권이 검증된 자막/대본만으로 동일 질문에 응답해 멀티모달 기여분을 측정한다.

이번 단계의 제외:
- 실제 YouTube 영상 다운로드, 미디어 복제, 캡션 우회 수집, 실영상 프레임 추출 또는 업로드.
- Gemini/OpenAI/YouTube Data API 실호출, 계정·키 조회, 유료 사용, 사용자 영상 ID 자동 처리.
- 실댓글 수집/감성 분류/파생지표 계산/작성자 데이터 저장.
- 운영 DB·스키마·백엔드 보안·브라우저 권한 변경, UI 연결, 배포 및 기존 PR 병합.
- 사용자의 승인 여부를 단순 Boolean 또는 fixture 상태로 위조하여 Gate 통과 처리하는 행위.

기존 자료의 정책 판단을 그대로 상속한다:
- [YouTube 소스 준비 Gate](../integration/YU32_G4_5_YOUTUBE_SOURCE_READINESS_V01.md)
- [제공자 정책·승인 증거 매트릭스](../integration/YU32_G4_5_PROVIDER_POLICY_EVIDENCE_MATRIX_V01.md)
- [Cloud 최초 호출 Gate](../integration/YU32_G45_L8_CLOUD_EVIDENCE_FIRST_CALL_GATE_V01.md)

기존 POLICY_HOLD, 최초 호출 별도 승인, LIVE_API=0, RAW_COMMENTS=0, 운영 미승인 상태는 이 PoC에 의해 해제되지 않는다. **영상 내용 처리 권한 검토는 댓글 API 권한 검토와 별개로 추가**한다.

## 3. 입력 권리와 신뢰 경계

- 실험 데이터는 사용자/제작자가 직접 제공하여 분석·재사용 허가를 입증할 수 있거나 명시적 라이선스를 확인한 자료를 우선한다.
- 공급자 공식 'YouTube URL 분석' 기능이 있더라도 YOUTOPIA의 대량 자동분석·재사용·보관·배포가 자동 승인된 것으로 추정하지 않는다.
- 공개 영상이라는 사실은 직접 다운로드, 프레임 추출, 타 서비스 전송 또는 영속 저장 권한의 증거가 아니다.
- 비디오/자막/댓글 속 지시문은 **신뢰하지 않는 분석 대상 데이터**이며 시스템·도구·보안 정책을 덮어쓸 수 없다.
- 권리/접근/삭제/보관 조건, 서버 송신 여부 및 모델 제공자 데이터 처리 설정을 출처별로 기록한다.
- 합성 데이터로 통과한 테스트는 실제 영상 정확도·공식 YouTube 사용 승인·운영 READY 증거가 아니다.

## 4. 공정한 평가 데이터셋

G1의 기본 평가표본 목표는 이용권 확인된 **영상 6개 × 질문 6개 = 36개**다.
- 인터뷰/대화 2, 화면 시연/강의 2, 실물 동작/게임·시각 위주 2.
- 시간: 영상당 약 3~15분, 언어·자막 유무·화면 변화 난이도 기록.
- 질문 유형: 발화 사실 12, 시각 사건 8, 화면 텍스트(OCR) 6, 시간 순서 5, 정답 근거 없음 5. 합계 36.
- 독립된 합성 댓글 또는 연구자가 작성한 '이 구간이 중요하다' 후보를 이용한 탐색 우선순위 실험은 별도 보조 트랙. 실제 댓글 전송·NLP 실행 불가.
- 미디어와 질문에 접근 가능한 **동일한 6개 영상/36개 질문**으로 A/B/C를 비교할 수 없으면 상호 비용·품질 우열 판정 보류.

각 질문에 사람이 확인한 정답·허용 가능한 대답·근거 시작/종료 타임코드·근거 모달리티·반증/부재 여부를 사전 라벨링한다. 검증자는 두 명 이상으로 독립 라벨링 후 불일치를 조정한다. 정답 및 라벨은 실험군 입력 프롬프트에 누출하지 않는다. 영상/질문 선정과 실험군 실행 순서를 사전 고정하고 사후 사례 선별을 금지한다.

## 5. 공통 출력 계약 (설계안)

모든 실험군은 다음 필드를 동일 의미로 보고한다:
- videoRef: 원문 URL이 아닌 테스트셋 내부 식별자.
- rightsState: VERIFIED_FOR_SCOPE / UNVERIFIED / REVOKED.
- sourceType: APPROVED_VIDEO / APPROVED_TRANSCRIPT / SYNTHETIC_FIXTURE.
- questionId, claimId, answerText, answerability: SUPPORTED / UNSUPPORTED / AMBIGUOUS.
- evidence: modality(AUDIO/FRAME/OCR/TRANSCRIPT), startMs, endMs, sourceRef, quoteOrObservation.
- modelProvider, modelId, modelVersion, promptVersion, extractionVersion, pricingObservedAt.
- usage: inputTokens, outputTokens, audioSeconds, videoSeconds, preprocessingSeconds, externalCalls, retries.
- costUsd: ingestion, preprocess, indexing, query, storageEstimate, total; unknown cost는 null로 분리.
- cache: cacheHit, indexBuildId, contentVersion, rightsEpoch.
- error: POLICY_BLOCKED / NO_DATA / PROVIDER_UNAVAILABLE / UNSUPPORTED_MEDIA / COST_LIMIT / INTERNAL_ERROR 등.

고객용 출력은 불확실한 추론과 확인된 사실을 구분한다. 근거 없는 시간코드 생성 금지, 출처 누락을 '검증됨'으로 표시 금지. 모델이 제시한 자기평가 신뢰도는 별도 캘리브레이션 전까지 검증된 정확도로 사용하지 않는다.

## 6. 비교 기준과 비용 산정

품질:
- GroundedAnswerRate = 정답이 맞고 제시 근거도 해당 답을 뒷받침하는 질문 수 / 평가 가능 질문 수.
- VisualGroundedRate = 시각 사건 + OCR 질문 중 근거가 맞는 정답 비율.
- UnsupportedCorrectRate = 근거 없는 질문에서 올바르게 미확인/답변 불가를 반환한 비율.
- UnsupportedClaimRate = 근거 없이 사실로 단정한 주장 수 / 생성된 사실 주장 수.
- TemporalEvidenceRate = 정답 구간과 예측 근거 구간이 겹치고, 대표 시점 오차가 ±5초 이내인 비율. 동작/구간 라벨의 불확실성이 큰 경우 별도 기록.
- EvidenceTraceCompleteness = 사실 주장 중 출처 모달리티·시간·입력 버전을 추적할 수 있는 비율.

성능·비용:
- 질문당 평균/중앙값 및 P95 응답 지연, 최초 인덱스 준비시간, 반복 조회 캐시 적중률.
- Provider 실제 청구액이 확인되면 이를 우선. 추정일 경우 모델·지역·배치·입출력/미디어 단가·측정 시점을 고정해 추정임을 표기한다.
- 총비용 N회 = 최초 수집/전처리/인덱싱 + N×질의비용 + 저장·캐시 운영비 + 재검증 비용. A/B/C 모두 동일한 N ∈ {1, 5, 20} 질문/영상으로 계산한다.
- API 비용만 비교하고 전처리 CPU/GPU·ASR·OCR·저장·재호출 비용을 누락하는 비교를 금지한다.
- 권리 이슈·허용된 접근 불가·실제 요금 측정 불가 상태에서는 최저 비용 경로 확정 불가.

**초기 승격 후보 기준(실측 검증 필요, 승인된 절대 목표가 아님):**
- GroundedAnswerRate ≥ 0.85, VisualGroundedRate ≥ 0.80, UnsupportedCorrectRate ≥ 0.80.
- EvidenceTraceCompleteness = 1.00, TemporalEvidenceRate ≥ 0.80, UnsupportedClaimRate ≤ 0.05.
- B가 A 대비 N=5에서 모든 비용을 포함해 ≥25% 절감하면서 GroundedAnswerRate 감소 ≤ 0.03일 때 자체 인덱싱의 경제적 타당성을 우선 인정.
- 기준 미달·표본 부족·A/B 공정 비교 불가라면 'NO_GO / INCONCLUSIVE'를 명시한다. 36문항은 탐색형 PoC이며 통계적 일반화/출시 보증 근거가 아니다.

## 7. 단계별 Gate

| Gate | 산출물 | 통과 증거 | 실호출 |
|---|---|---|---|
| G0 — Contract | 본 문서, 비교 범위와 중단 조건 | 독립 검토, 고정 기준 SHA, 이력 | **금지** |
| G1 — Offline | 합성 fixture, 스키마 검증, 평가기/비용 계산기 | 재현 가능한 무네트워크 테스트 결과 | **금지** |
| G2 — Source/Provider | 양쪽 실험군에 유효한 영상 권리, URL 지원·요금·약관, 보존/삭제/보안 검토 | 제공자/프로젝트별 증거 및 실패 시 차단 | **금지** |
| G3 — Limited paid run | 한정된 영상·모델·API 호출 수·상한·실행자·시점·폐기 정책에 대한 **별도 명시 승인** | 예산 사전검증·호출 원장·무재시도·비밀 보호 | 별도 승인 건만 |
| G4 — Integration | 독립 QA, 시각 근거 정확도와 UI Provenance, 기존 정책 Gate 재검수 | 별도 PR·사용자 병합 승인 | 운영 연결 별도 승인 |

중단 조건: 사용권 불명/철회, API 키 노출 우려, 예상비용 불명·상한 초과, 제공자 정책 충돌, 비인가 미디어 접근, 실제 데이터 삭제 불능, 증거 없는 READY 승격. 어떤 조건도 실패 안전(fail-closed)으로 처리한다.

향후 G3 후보 상한은 **총 $10 이하, 자동 재시도 0회**로 가설 제시한다. 이는 **예산 지출 승인이나 실제 지출 설정이 아니며**, 정확한 실험과 영상 목록·호출 횟수·단가·계정·강제 차단 도구 확인 후 다시 승인을 받아야 한다. G0/G1의 실제 지출 한도와 외부 호출은 0이다.

## 8. 저장·캐시 정책

- 미확인 라이선스 미디어·프레임·전문 대본은 저장하지 않는다. 식별 정보 최소화 및 필요한 경우 가명화.
- 캐시 키는 contentVersion + rightsEpoch + modelVersion + promptVersion + extractionVersion + queryHash로 구성; 권한 철회/데이터 갱신/정책 변경 시 무효화.
- 원본과 파생 데이터를 혼동하지 않도록 source/transform/provenance를 분리하고 결측을 0으로 대체하지 않는다.
- 기존 YOUTOPIA의 POLICY_HOLD/YouTube 원문 수명주기/삭제 전파/백업 정책은 그대로 우선 적용한다.
- 내부 평가 결과만 저장하고 운영 Snapshots/댓글 원문/개인 정보를 이번 단계에서 만들지 않는다.

## 9. 다음 실행 과제와 독립 QA

1. G1 평가 데이터의 합성 fixture 및 36개 평가 항목 스키마를 외부 연결 없이 만든다.
2. 범위·타임코드·자막만 존재하는 상황/시각 증거 누락/빈 응답/정책 차단/비용 상한 초과에 대한 부정 테스트를 작성한다.
3. N=1/5/20 반복 질문별 총원가 산식 및 비교 보고서 자동 생성을 구현한다.
4. 독립 검토자는 '호출 0, 비밀 0, 운영 변경 0, 기존 승인 Gate 불변'을 검수한다.
5. 그 후 G2 권리/제공자 검증. G3 실호출은 **새로운 사용자 승인** 전까지 실행하지 않는다.

검수 증거 표기:
- G0: 본 문서 원격 파일 생성 확인, 브랜치 기준 SHA 확인. 코드를 수정하지 않아 빌드/실행 테스트는 이번 단계에서 수행하지 않음.
- G1~G4: NOT_RUN / NOT_APPROVED.

**현재 판정: G0_DOCUMENTED_ONLY / OFFLINE_ONLY / LIVE_PROVIDER_CALLS=0 / NO_MERGE.**
