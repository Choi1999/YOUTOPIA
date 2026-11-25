# 한국어 리뷰 NLP — taxonomy v0.5

이 패키지는 원문과 사람 검수 이력을 연결해 **리뷰별 leaf_id × 긍정/부정 존재 여부**를 학습·비교·추론한다. 현재 사전은 71개 leaf와 두 독립 감성 출력, 총 142개다. 모델은 의견별 대상·근거 구간을 추출하는 모델이 아니다. DB 전송·웹·RAG는 별도 연결 과제다.

기준은 [SOURCE.json](labeling/SOURCE.json)에 고정한 `feat/review-labeling-v05-20261125`의 commit `f2eca056d9a4375c9c717b70aa34ea3efb19461a`다. [지침 v1.2.0](labeling/GUIDELINES_v1.2.0_KO.md)과 taxonomy 파일 해시를 대조했다. 앞선 v0.4 미리보기 초안은 현재 기준이 아니다. 원본 상태 `PILOT_TAXONOMY_NOT_TRAINING_READY`를 유지한다. 사전 통합·파일럿 검증은 실제 모델 학습 완료를 뜻하지 않는다.

## 보존하는 기준

- 기본 단위는 `leaf_id`다. `SOUND.MUSIC_BGM::긍정`과 `SOUND.VOICE_DUBBING::부정`을 각각 보존한다. 효과음은 `SOUND.SFX`이며 일반 사운드 평가에서 추정하지 않는다.
- **같은 leaf의 긍정과 부정도 둘 다 보존한다.** 혼합은 집계의 파생 값이다. 혼합/중립 출력 헤드를 만들거나 두 감성 중 하나만 argmax로 선택하지 않는다. 상위 사운드 요약은 leaf 결과를 모두 보여준다.
- `UNSPECIFIED`는 세부 미상의 실제 대상 평가다. 내용 없음·HOLD·부재와 다르다. 구체적 대상 없는 ‘갓겜’과도 구별한다.
- 번역은 `OPERATIONS.TRANSLATION`, 더빙은 `SOUND.VOICE_DUBBING`, 타격감은 `GAMEPLAY.HIT_FEEL`이다. 지원 언어·타격음·타 플랫폼의 평가를 추측해 옮기지 않는다.
- 원문, Unicode 코드포인트의 근거 위치, `target`, `scope`, `polarity_strength`, `source_opinion_id`, 제외 구간과 HOLD를 보존한다. ‘weak’는 별도 근거 메타데이터이며 모델의 보정된 확률이 아니다. 현재 분류기는 강도까지 학습하지 않는다.
- `voted_up`은 전체 추천 의향, `votes_up`은 도움됨 수다. 보조 정보로 보존하며 항목 감성을 자동 생성·반전하거나 의견 인원 수로 사용하지 않는다. 학습 입력은 동일한 원문 본문이다.

## 실제 70건과 학습 정답의 구분

원본 검증기를 격리 실행하고 manifest·원문 해시·근거·이관·집계를 확인했다. 기록상 기존 리뷰 검수 수락은 70건, 활성 의견은 118개, HOLD는 7개다. 새 AI 세분류의 사용자 검증은 0건이며, 70건 전부 `learning_eligible=false`다. 71개 중 65개가 이 파일럿에서 관측됐다는 것은 학습된 클래스나 모델 정확도가 아니다.

원본·검수 원장은 비공개 경로에서 보존한다. 이 브랜치에는 실제 파일럿 원문·ID를 복사하지 않는다. `import-pilot-v05`는 실제 consolidated v2 스키마를 읽고 다음을 만든다.

- 정확한 원본 사본, 원문·조건·근거·원래 주장 연결을 유지한 감사용 데이터
- 이전 리뷰 수락과 새 분류 검증을 구별한 감사 요약
- 실제 파일럿 키를 담은 비공개 registry 초안(`complete=false`)

이 자료는 기준 수립용이므로 **학습·검증·최종 시험에서 제외**한다. 동일 리뷰의 다른 수정본도 제외한다. 실데이터 registry에는 고정된 v0.5 파일럿 원본 해시·70개 키 집합이 일치해야 하며, 추가 기준 자료가 있다면 그 배치도 전체 목록에 추가해야 한다. registry의 완료 표시는 작성자의 사실 확인을 대신하지 않는다.

## 독립 정답과 검수 원장

새 학습 데이터에는 `key/appid/review_id/clean_text/text_sha256/taxonomy_version/taxonomy_sha256/review_status/annotations/active_opinion_ids/held_opinion_ids`를 사용한다. 각 활성 의견은 `id/aspect_code/leaf_id/polarity/detail/evidence_spans`를 가진다. 원래 대상·조건·강도·원래 의견 ID도 유지한다. 다른 엑셀/JSON 구조를 임의 추정해 읽지 않는다.

기존 파일의 `human_reviewed=false`만으로 실제 사용자 검수를 부정하지 않는다. 비공개 승인 원장에 실제 검수자·시각·출처·본문과 검수 범위의 해시를 연결한다. 후보는 pending이며 빈 검수 정보를 자동으로 채우지 않는다. 해시는 변경 검사용으로, 검수자 신원을 인증하는 서명은 아니다.

```json
{"key":"synthetic-game:synthetic-review","scope":"opinion:o1","text_sha256":"<본문 SHA256>","scope_sha256":"<후보 지문>","decision":"confirmed","reviewer":"<실제 검수자>","reviewed_at":"<실제 시각과 시간대>","source_ref":"<실제 검수 기록>"}
```

리뷰 전체 범위(`scope: review`)와 각 활성 의견의 확인이 필요하다. 미해결·미적용 수정은 감사 자료로 남기고 전체 리뷰 학습에서 보류한다. 원본이 명시적으로 학습 제외인 기록/의견은 원장만으로 승격되지 않는다. 과거 상위 분류의 승인은 새 leaf까지 확인했다는 뜻이 아니다.

## 개발 PC의 격리 실행

Python 3.12의 별도 환경에서 실행한다. API 키·Steam 키·운영 DB 연결은 필요 없다. 아래는 보류한 GPU 서버에서 실행하라는 지시가 아니다.

```bash
python3 -m venv .venv-reviews
.venv-reviews/bin/python -m pip install torch==2.15.0 --index-url https://download.pytorch.org/whl/cpu
.venv-reviews/bin/python -m pip install -r ml/reviews/requirements.txt
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv-reviews/bin/python -m unittest discover -s ml/reviews/tests -v
```

전체 검증 환경 버전은 `requirements-cpu.lock`에 있다. CPU 휠로 L4를 사용할 수 없다. CUDA 휠·드라이버·GPU 메모리·처리량·디스크 준비는 미검증이며 서버 설정 변경은 별도 재개 후 확인해야 한다.

모델 원본은 고정된 `beomi/KcELECTRA-base` revision `4cf9eb1dfeec0a672afe73059882fc998a299ceb`다. 고정 원본 가중치·설정·토크나이저 해시를 검사해 safetensors로 변환한다. 학습·추론은 로컬 파일만 사용하고 원격 Python 코드를 신뢰하지 않는다. 임의 pickle/joblib/오래된 model.pt를 로드하지 않는다. 실제 KcELECTRA import와 한국어 정답 학습은 아직 실행하지 않았다.

모든 원문·원장·모델·산출물은 저장소 밖의 비공개 경로를 사용한다. 아래 경로는 자리표시자이고 출력 폴더는 새로 만들어야 한다.

```bash
python -m ml.reviews import-pilot-v05 --source /private/pilot70.json --out /private/pilot-audit
# 추가 기준 자료까지 대조한 registry를 /private/pilot-registry.json에 별도로 준비
python -m ml.reviews approval-candidates --source /private/independent-gold.json --out /private/approval-candidates
python -m ml.reviews audit --source /private/independent-gold.json --approvals /private/approvals.jsonl --out /private/gold-audit
python -m ml.reviews import-base --source /private/pinned-original-base --out /private/safe-base
python -m ml.reviews build --source /private/independent-gold.json --approvals /private/approvals.jsonl --registry /private/pilot-registry.json --base /private/safe-base --max-tokens 256 --out /private/dataset-v05
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python -m ml.reviews train --dataset /private/dataset-v05 --base /private/safe-base --seeds 13 42 73 --epochs 5 --device cpu --out /private/experiment-v05
python -m ml.reviews final --dataset /private/dataset-v05 --experiment /private/experiment-v05 --out /private/final-v05
python -m ml.reviews predict --source /private/batch.jsonl --model /private/experiment-v05/<selected_path> --out /private/predictions-v05
python -m ml.reviews summarize --source /private/predictions-v05 --out /private/summary-v05
```

사전 변경 실험은 build/audit에 `--taxonomy`로 지정한다. 사전 파일·canonical 내용·label 사전·입력·정책 해시가 데이터와 모델에 고정된다. 출력 크기를 바꾼 예전 체크포인트를 새 모델로 읽지 않는다. 구형 자료의 보존용 `migrate`는 새 leaf를 비운 대기 작업만 만들며 자동 재분류·승인하지 않는다. 이미 재분류된 v0.5 파일럿에는 `import-pilot-v05`를 사용한다.

## 학습·평가와 실패 처리

1. 정답의 근거·검수·명시적 제외와 고정 파일럿 목록을 검사한다. 보류를 부정/부재로 채우지 않는다.
2. 원문이 상한을 넘으면 전체 리뷰를 보류하고 원문은 유지한다. 잘린 입력이나 각 조각에 전체 리뷰 정답을 붙이지 않는다. 기본 256토큰, 합성 시험만 64다.
3. 게임 단위 분할을 고정한다. 최소 5게임이며 리뷰별 분할로 대체하지 않는다. 동일 본문과 분할 간 높은 문자 TF-IDF 유사도를 차단한다. 의미상 중복·작성자·시점의 모든 누수를 보증하지는 않는다.
4. 같은 사전·입력·분할에서 TF-IDF, TextCNN, KcELECTRA 본체 고정+학습 헤드, 전체 미세조정을 비교한다. 기본 3개 seed의 평균·표준편차를 제공한다. 모델·epoch·임계값은 검증으로 선택하며 시험으로 다시 고르지 않는다.
5. 원래의 긍정·부정 출력은 독립적이다. 한 leaf에서 모두 예측할 수 있다. 미지원 출력은 상수와 `unlearnable_labels`로 보고한다. 시험 지지 0은 항목별 F1을 N/A로 남기며, 전체 라벨 0처리 Macro-F1과 지지가 있는 라벨 Macro-F1의 평균 정책을 따로 명시한다. 점수는 보정 확률이 아니다.
6. 최종 시험은 데이터·선택·모델을 봉인한 뒤 배타 예약한다. 실패해도 자동 예약 삭제·재시도를 하지 않는다. 중앙 서버가 모든 복제 실험의 반복 시험을 막는 기능은 없다.
7. epoch 중간 optimizer/RNG 복원은 없다. 실패 폴더를 보존하고 원인 확인 후 새 실험 ID로 시작한다. READY가 없는 미완성 폴더를 모델로 로드하지 않는다.

출력은 모델 비교 그림, 학습 이력, leaf/감성별 support·TP/FP/FN·정밀도·재현율·F1, 오류 목록과 시험 점수다. 합성 시험 통과는 실제 한국어 정확도·L4 성능·배포 승인이 아니다. 실제 데이터 산출물은 비공개 자료다.

## 집계·서비스·RAG의 경계

추론 입력은 `appid/review_id/key/text/text_sha256/source_revision/snapshot_id`가 필요하다. 누락·본문 불일치는 REJECTED_INPUT, 긴 입력은 HELD_LONG_INPUT이다. 정상 빈 예측 NO_TARGET_PREDICTED는 사람이 확인한 구체 평가 없음과 다르다. 모델 오류·비정상 점수는 성공 산출물 없이 중단한다.

집계는 같은 모델·분류표·정책·스냅샷의 고유 리뷰를 게임별로 계산한다. leaf의 긍정·부정 둘 다 유지하고 같은 leaf의 양극성 리뷰 수만 별도로 파생한다. 하위 리뷰 수를 더해 상위의 고유 리뷰 수로 사용하지 않는다. 수정본 중복·버전 혼합·점수/임계값/라벨 불일치는 차단하고 HOLD/실패를 정상 0건으로 채우지 않는다.

현재 웹의 YouTube 분석 후보는 별도 계약이며 Steam leaf 결과와 아직 연결되지 않았다. 분류기는 근거 추출기가 아니므로 `evidence_spans: null`을 근거가 있다고 표현하지 않는다. DB 자동 전송·최소 권한·API·프론트·RAG는 [이관 문서](TARGET_MIGRATION_KO.md)의 후속 계약으로 연결해야 한다. 고정 질문 챗봇이나 GPT/Gemini 실제 비교를 이번 변경으로 완성했다고 표시하지 않는다.

다음 실제 단계는 파일럿과 분리된 사람 검수 정답 확보 → 세부 분포/오류 비용 점검 → 실제 KcELECTRA/L4 검증 → 네 조건 비교/고정 시험이다. GPU·운영 작업의 기존 보류는 유지한다.
