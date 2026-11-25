# 라벨링과 병행하는 학습·비교 준비

2026-11-26 KST. 코드 준비와 실제 모델 성능 검증은 별개다. 실환경 작업의 보류는 유지한다.

## 준비한 실행 경로

1. `import-labels`: 실제 consolidated-v2 라벨 파일을 표준 작업 데이터로 변환하고 원본·기존 검수 이력을 보존한다. 검수 승인을 새로 만들지 않는다.
2. `audit`: 원문 해시·정확한 근거 위치·73leaf/감성·HOLD·사람 검수 원장 연결을 검사한다.
3. `import-pilot-v06`: 파일럿100건 키·수정본·원문 복사와 높은 문자 유사도 자료를 학습에서 배제할 비공개 registry 초안을 만든다.
4. `import-base`: 고정된 KcELECTRA 원본 가중치·설정·토크나이저를 해시 검사하여 안전한 로컬 모델로 변환한다.
5. `build`: 동일 본문·text-only 조건을 유지하고 게임 단위 train/validation/test를 고정한다. 긴 입력·미해결·미승인·메타 참조 감성은 전체 리뷰를 보류한다.
6. `readiness`: 현재 입력·가중치·제외 목록과 동결 데이터셋의 지문을 대조한다. 준비되지 않았으면 보고서와 종료 코드2를 남긴다.
7. `train`/`final`: 네 자체 학습 조건, validation 선택, 동결 최종 시험과 예측·오류·지표를 저장한다.
8. `benchmark-plan`/`benchmark-final`: OpenAI와 Gemini 각각 baseline/prompt를 동일 시험으로 비교한다. 실제 호출 코드와 모킹 검증을 제공하며 실호출은 별도 opt-in이다.
9. `compare`: 같은 시험·정답·라벨·입력 계약인지 대조해 자체/외부 결과표와 그림을 만든다. 누락·실패는 N/A로 표시한다.
10. `predict`/`summarize`: 리뷰 단위 예측을 게임·관측 범위별 고유 리뷰 수로 집계하고 인사이트 해석 한계를 전달한다.

## 라벨링이 끝날 때 필요한 자료

| 자료 | 확인할 사항 |
|---|---|
| MAIN 라벨 파일 | 원문/ID/근거/대상/조건/최신 leaf·감성/미해결·제외와 기존 검수 이력 |
| 실제 검수 기록 | 누가 어느 범위를 언제 확인했는지와 출처. 이미 한 검수를 다시 하지 말고 기록을 연결 |
| 기준 파일럿 원본과 전체 참조 목록 | 파일럿100건은 정답 학습 수에 포함하지 않음. v0.5 70건은100건에 포함되므로 중복 배치로 더하지 않음 |
| 기반 KcELECTRA 원본 | `assets.py` 고정 revision·해시. 이번 개발 환경에서 원본 확보·safe import·CPU forward 통과. 새 환경으로 자동 전달되지 않음 |
| 실험 설정 | 같은 본문/출력/분할, 1seed 시작, 최종 시험 전에 모델·프롬프트·선택 규칙 고정 |
| API 설정 | `OPENAI_API_KEY`, `GEMINI_API_KEY`; 모델명은 `benchmark_config.example.json`의 명시적 두 모델 값 |

고정된 학습 최소 리뷰 수를 만들어내지 않는다. 게임 단위 분할은 최소5게임을 요구하지만 이것이146개 출력의 충분한 지원을 뜻하지 않는다. 라벨·감성별 지원 수를 확인하고 미지원·미검증 항목을 별도로 보고한다. MAIN101–300의 검수 완료 여부나 별도 학습 자산 ZIP은 이 환경에서 아직 실제 파일로 검증하지 않았다.

기존 공개 긍부정 데이터나 영어8속성 자료를 한국어73leaf 정답으로 자동 변환하지 않는다. 사전학습 KcELECTRA에서 시작하므로 언어 사전학습을 처음부터 다시 하는 것이 필수는 아니다.

## 지금 할 수 있는 검사

프로젝트 루트, 문서의 CPU 격리 환경에서 실행한다. `/private`는 실제 비공개 경로로 바꾸고 매번 새로운 출력 폴더를 쓴다.

```bash
python -m ml.reviews readiness --out /private/readiness-new
python -m ml.reviews import-labels --source /private/main-labels.json --out /private/labels-import
python -m ml.reviews audit --source /private/labels-import/adapted-labels.json --approvals /private/approvals.jsonl --out /private/gold-audit
```

승인 후보가 필요하면 `approval-candidates`를 사용한다. pending은 실제 사람의 확인이 아니다. 실제 검수 이력에 연결할 수 없는 필드는 자동으로 채우지 않는다. 원본에 `learning_eligible=false`가 있다면 원장으로 우회하지 않고 제외 이유·자료 용도를 먼저 확인한다.

파일럿 registry는 `complete=false`로 생성된다. 전체 참조 자료 목록과 해시를 대조한 뒤 별도의 비공개 완성본을 사용한다. 원본과 초안을 보존하고 무조건 true로 바꾸지 않는다. 코드가 기록자의 사실 확인을 자동 보증하지는 않는다.

`build`와 `train`/`final`의 정확한 명령은 [README](README_KO.md), 외부 예산과 실호출 절차는 [API 안내](API_BENCHMARK_KO.md)에 있다. 외부 비교까지 완료한 경우:

```bash
python -m ml.reviews compare --local /private/final-v06 --external /private/api-final-v06 --out /private/comparison-v06
```

외부 결과가 아직 없으면 `--external`을 생략한다. 누락 조건을 성공한 점수0으로 만들지 않는다. 실제 키가 없으면 API runner는 호출·예산 차감·최종시험 공개 없이 BLOCKED다. 최종 시험을 보고 프롬프트를 수정해 같은 시험으로 다시 선택하지 않는다.

## 관측 범위와 인사이트 입력

추론의 기본 식별 필드에 다음과 같은 메타데이터를 함께 제공할 수 있다. 아래는 형식 예제이며 실제 수집·리뷰 데이터가 아니다.

```json
{
  "observation_scope": {
    "language": "koreana",
    "window": {"basis":"authored_at","start":"2026-11-01T00:00:00+09:00","end":"2026-11-26T00:00:00+09:00","timezone":"Asia/Seoul"},
    "as_of":"2026-11-26T00:00:00+09:00",
    "collection":{"policy_id":"EXAMPLE_ONLY","purchase_scope":"all","recommendation_scope":"all","offtopic_scope":"included","completeness":"PARTIAL"},
    "source_total_matching_reviews":null
  },
  "review_context": {
    "authored_at":null,"collected_at":null,
    "playtime_at_review_minutes":null,"playtime_at_collection_minutes":null,"conditions":[]
  }
}
```

기간은 작성 시각 기준 반개구간이다. 수집 당시 누적 플레이시간과 리뷰 작성 당시 플레이시간은 서로 다르며 숙련도를 뜻하지 않는다. mode/progression/difficulty_setting/platform/mods/other 조건은 실제 원문 span 또는 원천 메타 필드 출처가 있어야 한다. 정보가 없으면 미상으로 남긴다.

집계에는 성공·보류·거부·빈 예측과 양쪽 감성의 겹침, 분모·범위·미상 필드·난도 문구를 함께 보낸다. 원본 고유 리뷰 수나 사람의 HOLD를 예측 파일만으로 알 수 없으면 null이다. `assert_insight_claim_allowed`는 수집분 평가 수·커버리지·출처 있는 조건만 허용한다. 절대 난도 순위·시장 점유율·인과·없는 인용문은 허용하지 않는다. 실제 생성기/프론트가 이 함수를 호출하도록 연결하는 작업은 아직 남아 있다.

## 실환경 실행과 복구의 경계

마지막 사용자 확인 GPU는 NCP `gp1l4-g3`, L4 VRAM24GB / vCPU4 / 시스템RAM48GB / OS100GB+작업400GB다. 인계문에 있던 L40S48GB/RAM96GB를 채택하지 않는다. 당시 추가 디스크는 미마운트, Docker는 미설치였으며 이번에 다시 접속하거나 바꾸지 않았다. CUDA13.0 표시만으로 PyTorch CUDA 호환을 확인했다고 하지 않는다.

다음 재개 순서: 실제 정답·검수 연결 → 검증 기반 모델 전달 → GPU 디스크/환경 별도 준비 → L4 모델 로드와 작은 1회 실행 → 네 조건 학습·고정 시험 → 별도 승인한 API 예산 내 실비교 → 고정 snapshot 배치 추론 → DB/서비스/RAG 격리 연결 검증이다. 개발 환경의 CPU 인코더 실행은 통과했으며 이것이 GPU 학습 완료를 뜻하지 않는다.

중간 학습·시험·API 실패 폴더와 claim/예산 파일을 지우지 않는다. epoch 중간 optimizer 재개는 미지원이며, 전송 여부 불명 API 실패는 자동 환급·재시도하지 않는다. 모델 전환은 READY 해시와 사전/정책/입력 호환을 확인한 전체 artifact 묶음으로 한다. v0.5로 되돌려야 하면 코드·사전·모델을 같은 과거 묶음으로 복구하고146개 출력에142개 헤드를 끼워 넣지 않는다.

운영 DB 전송·DDL·권한·수집기·관리자·control·배포/재시작은 수행하지 않는다. 기존 운영판과 분리해 검증하고, 이후 배포를 재개할 때 고정 artifact와 기존 서비스 snapshot을 보존한 복구 절차를 실제 환경에 맞춰 확정해야 한다. 키 발급·등록·실제 API·GPU 학습도 이번에는 수행하지 않는다.
