# YOUTOPIA — 영상 이해 PoC G1 오프라인 평가기

> 상태: G1_OFFLINE_ONLY / SYNTHETIC_FIXTURE / 실제 영상 0건 / 실 API 호출 0건 / 실제 과금 0건

이 디렉터리는 영상 이해 **모델이나 YouTube 수집기**가 아니라, 향후 직접 멀티모달 분석(A), 의미 기반 인덱스(B), 자막 전용(C)을 공정하게 비교하기 위한 **평가 계약의 실행 가능한 시험 장치**다.

Node.js 22 이상(원격 CI는 Node 24)에서 저장소 루트를 기준으로 실행한다.

```powershell
$root = 'shared/experiments/yu-video-understanding-poc-v0'
node --check "$root/g1-offline.cjs"
node --test "$root/tests/offline.test.cjs"
node "$root/g1-offline.cjs"
```

별도 패키지 설치, 키, API 또는 영상 URL이 필요하지 않다. 출력은 가상 데이터로 만든 JSON 보고서다.

## 평가 데이터

가상의 영상 6건(인터뷰 2, 화면 시연 2, 게임/실물 동작 2)과 각 영상당 질문 6개, 총 36문항으로 구성했다.

| 질문 유형 | 개수 |
|---|---:|
| 발화 사실(SPEECH) | 12 |
| 화면 사건(VISUAL) | 8 |
| OCR | 6 |
| 시간·행동 순서(TEMPORAL) | 5 |
| 근거 없는 질문(UNSUPPORTED) | 5 |

모의 응답 108건은 정답, 오답, 시간코드 오류, 잘못된 출처, 누락된 근거 및 무근거 단정의 채점 규칙을 테스트하도록 **사전에 생성된 허구의 답변**이다. 실제 영상, 자막, 음성, 댓글, 모델 API 호출의 결과가 아니다.

## 평가 지표

- `groundedAnswerRate`: 정답 일치 **및** 근거 출처·구간 일치.
- `visualGroundedRate`: 시각·OCR 질문에 대한 근거 있는 정답.
- `unsupportedCorrectRate`: 답이 없는 질문에 정확하게 응답을 보류한 비율.
- `unsupportedClaimRate`: 사실로 단정했지만 정답·근거가 부적절한 비율.
- `evidenceTraceCompleteness`: 합성 scene, contentVersion, rightsEpoch 및 처리 버전의 추적 가능성.
- `temporalEvidenceRate`: 시간 범위 중첩, 중심점 오차 ±5초 및 BEFORE/AFTER 순서 검증.

G1은 질문당 하나의 원자적 답변 식별자만 평가한다. **실제 영상 이해 정확도나 언어적 의미 판정은 아직 검증하지 않았다.**

## 가상 비용 비교

`영상당 N회 질의 총원가 = ingestion + preprocessing + indexing + storage + lifecycle + N × (inference + retrieval + recheck)`

N은 1·5·20회로 평가한다. 모든 단가는 연산 시험용 **임의 가상값**이며 공개 API 요금·실제 청구액·절감 효과가 아니다. 미확인 값은 `null`로 두고 무료(0)로 오인하지 않는다. 어떤 수치가 나와도 판정은 `INCONCLUSIVE_OFFLINE_SYNTHETIC`이다.

## 승인 경계

실 YouTube 접근, URL 수집, 대본 저장, ASR/OCR 실행, 공급자 API 연결, 비용 지출, 운영 DB 연결, Chrome 확장 연결, 기존 UI PR 병합은 모두 **이 단계의 범위 밖**이다. 기존 YOUTOPIA의 `POLICY_HOLD`와 첫 API 호출의 별도 승인 규칙은 변하지 않는다.

상위 평가 계약: `docs/research/YU_VIDEO_UNDERSTANDING_POC_EVALUATION_V01.md`. G2(영상 권리·제공자 정책·요금 검증), G3(유료 API 제한 실험)는 별도 승인 이후 착수한다.
