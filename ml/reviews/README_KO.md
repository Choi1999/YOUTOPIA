# 한국어 리뷰 분류 학습 파이프라인

`python -m ml.reviews`는 원문 근거·사람 검수 기록을 연결하고, **리뷰 단위의 세부 평가 대상별 감성 존재 여부**를 학습·비교·추론한다. 학습 모델이 개별 의견이나 근거 구간을 추출하는 기능은 없다. RAG, 웹 챗봇, DB 전송·공개 작업과 분리된 오프라인 패키지다. 운영 DB·수집기·기존 프론트를 수정하지 않는다.

현재 기본 분류표는 **`v0.4-preview-draft` 초안**이다. 사용자가 전달한 최근 대화 미리보기의 분리안을 구조에 반영했으며, 참조 대화 전체·최신 확정 분류표·실제 재분류 원본은 회수하지 못했다. 운영·지원의 최신 세부 기준, 항목 간 경계와 강도 표현 등은 미확정이다. 기본 분류표로는 합성 시험만 가능하며 실데이터 build/학습은 차단된다. 확인되지 않은 전체 기준을 확정본으로 표시하지 않는다. [변경·이관 범위](TARGET_MIGRATION_KO.md)를 먼저 읽는다.

2026-11-25 기준 구현은 합성 데이터의 CPU 실행으로 검증했다. 실제 파일럿 전체의 정답 확정, KcELECTRA 실가중치 가져오기, 실제 한국어 정답 성능, L4 실행·메모리·처리량, 운영 연결은 미검증이다. `synthetic: true` 결과를 실제 성능이나 공개 승인으로 취급하면 안 된다. 성능 기준은 실제 정답 데이터의 분포와 오류 비용을 확인한 뒤 별도로 정한다.

## 반영한 라벨 기준과 범위

- 출력은 **고정된 세부 대상 수 × 4감성**이며 48차원으로 고정하지 않는다. 분류표는 `--taxonomy`로 지정하고 데이터·모델·추론 산출물 안에 해시와 함께 고정한다. `OTHER`는 보류, `OVERALL`은 출력하지 않는다. 캐릭터 외모는 `CHARACTER.APPEARANCE`로 표현할 수 있으나, 이 코드명 역시 현재 초안의 제안이다.
- 원본 의견의 ID·긍정·부정·근거를 보존한다. `SOUND.MUSIC::긍정`과 `SOUND.VOICE_ACTING::부정`은 독립 출력이며 `SOUND::혼합` 하나로 바꾸지 않는다. **같은 세부 대상** 안의 긍정·부정만 리뷰 단위에서 혼합으로 따로 집계한다. 명시적 혼합도 혼합, 중립과 단일 방향이 함께 있으면 방향을 사용한다. 이 규칙은 `review-target-opinion-v2`로 버전 관리한다. 서로 다른 대상의 요약은 `aspect_summary`에 대상·감성 쌍을 모두 남긴다.
- 모델은 원문만 입력한다. `voted_up`은 전체 추천 의향, `votes_up`은 도움됨 투표 수로 별도 보존한다. 추천 여부로 항목 감성을 자동 생성·반전하지 않는다. 주석 작업의 보조 검토 기록은 `steam_context_check: {basis: "body_evidence", voted_up: ...}`에 남길 수 있다. 이것은 AI 자동 라벨러 구현이 아니다.
- ‘업데이트마다 재접속’만으로 부정이나 콘텐츠 긍정을 자동 부여하지 않는다. 해당 파일럿의 최종 판단이 불분명하므로 이 코드가 대신 확정하지 않는다. 행동은 원문과 `behaviors`에 보존하고 보류 의견은 정답과 분리한다.
- 제외 문자열도 입력 원문에 유지한다. 제외 사유가 곧 부정 라벨이 되지는 않는다. JSON의 원문·Unicode 위치를 기준으로 검증한다. Excel 줄바꿈으로 변한 원문을 자동 정규화해 근거 위치를 맞추지 않는다.

## 검수 기록 연결

기존 `human_reviewed: false`는 대화 검수가 없었다는 증거가 아니다. 이 패키지는 그 표시를 일괄 수정하지 않는다. 원본을 보존하고 **별도 승인 원장**으로 실제 검수자·시각·출처·검수 범위를 연결한다. 원장은 비공개 파일이며 공개 저장소에 넣지 않는다.

승인 후보를 생성하면 `decision: pending`, 검수자·시각·출처가 빈 상태다. 후보 생성은 검수가 아니다. 과거 대화에서 확인된 판단만 실제 이력으로 연결하고, 확인하지 못한 검수 범위·시각·출처를 만들어 넣으면 안 된다. 확인할 수 없는 항목은 보류하고 새 검수로 연결할 수 있다. 본문 SHA256과 의견/리뷰 범위 SHA256이 맞아야 한다. 이 해시는 변경 검사용이며 검수자 신원을 인증하는 전자 서명은 아니다.

원장 한 줄의 형식:

```json
{"key":"synthetic-game:synthetic-review","scope":"opinion:o1","text_sha256":"<본문 SHA256>","scope_sha256":"<후보의 범위 SHA256>","decision":"confirmed","reviewer":"<실제 검수자>","reviewed_at":"<실제 검수 시각과 시간대>","source_ref":"<비공개 검수 이력 위치>"}
```

`scope: review`는 최종 의견 선택·보류·전체 검토 범위를 확인하는 별도 승인이다. 모든 활성 의견의 승인과 리뷰 전체 승인이 필요하다. 일부 의견만 확정됐거나 보류·미적용 수정이 남으면 workbench에 보존하되 전체 리뷰 학습에서는 제외한다. 빠진 항목을 모두 부정 또는 평가 없음으로 채우지 않는다. 불일치하는 승인 원장은 병합하지 않고 중단한다.

원본 파일럿은 `records` 배열, 각 기록은 `key/appid/review_id/clean_text/text_sha256/taxonomy_version/taxonomy_sha256/review_status/annotations/active_opinion_ids/held_opinion_ids`를 사용한다. 각 의견은 `id/aspect_code/target_code/polarity/detail/evidence_spans`를 가진다. `target_spans`가 있으면 본문 위치도 검증한다. `target_code`가 빠지면 재분류 필요 상태로 남긴다. `UNSPECIFIED` 대상은 광범위한 표현을 보존하기 위한 초안 제안이며 자동으로 음악·더빙 등을 추측해 넣지 않는다. 테스트의 `fixtures.py`는 합성 예시다. 전용 포맷을 임의 추정해 다른 엑셀·JSON을 바로 읽지 않는다.

## 파일럿 제외 목록

기준 작성에 사용한 파일럿은 학습·검증·시험에 재사용하지 않는다. 최근 미리보기에는 50건을 넘는 번호가 나타나므로 총수를 50+10으로 고정하지 않는다. 실제 최신 원본을 회수해 배치별 원본 해시·건수·실제 `appid:review_id`를 전체 목록과 대조한다. 회수하지 못한 자료가 있는데 `complete: true`로 작성하면 안 된다.

```json
{"schema":"pilot-reference-registry-v2","complete":false,"source_ref":"<실제 목록 확인 이력>","inventory":[{"id":"<실제 배치 ID>","expected_count":0,"source_sha256":"<실제 원본 SHA256>"}],"batches":[{"id":"<실제 배치 ID>","expected_count":0,"keys":[]}]}
```

위 예시는 미완료 양식이다. 빠진 목록·0건·잘못된 수·중복 키·구형 registry는 build를 차단한다. `synthetic: true`는 합성 시험 전용이다. 합성 base와 실데이터 registry를 혼합할 수 없고 모든 산출물에 합성 여부가 남는다. 검사만으로 원장 작성자의 사실 여부나 선언한 배치 목록이 실제 전부인지까지 보증하지는 않는다.

## 로컬 설치와 실행

Python 3.12의 별도 가상환경에서 설치한다. 아래 명령은 **개발 PC/격리 환경용**이며 보류한 GPU 서버에서 실행하라는 지시가 아니다. CPU 전체 실행과 계약 시험에 API 키·Steam 키·운영 DB 비밀번호는 필요 없다.

```bash
python3 -m venv .venv-reviews
.venv-reviews/bin/python -m pip install torch==2.15.0 --index-url https://download.pytorch.org/whl/cpu
.venv-reviews/bin/python -m pip install -r ml/reviews/requirements.txt
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv-reviews/bin/python -m unittest discover -s ml/reviews/tests -v
```

검증 환경의 전체 패키지 버전은 `requirements-cpu.lock`에 보존한다. GPU용 CUDA 휠·드라이버 조합은 아직 검증하지 않았다. CPU 휠로 L4를 사용할 수 없다. GPU 서버의 작업 디스크·컨테이너·CUDA 환경 변경은 별도 재개 후 검증해야 한다.

공식 원본 모델은 `beomi/KcELECTRA-base`, 고정 revision `4cf9eb1dfeec0a672afe73059882fc998a299ceb`다. 검증한 고정 `.bin` SHA256과 설정/토크나이저 해시에 맞는 로컬 원본만 `import-base`로 가져온다. 변환 결과와 학습 체크포인트는 safetensors, TF-IDF는 JSON/NPZ로 저장한다. 학습·추론 중에는 모델을 다운로드하지 않고 `trust_remote_code=False`를 사용한다. 임의 pickle/joblib/원격 Python 코드를 로드하지 않는다. 기존 오래된 `model.pt`는 이 패키지에서 그대로 재사용하지 않는다.

데이터·모델·산출물은 저장소 밖 비공개 경로를 사용한다. 아래 경로는 자리표시자이며 새 출력 디렉터리는 존재하지 않아야 한다.

```bash
python -m ml.reviews migrate --source /private/old-pilot.json --approvals /private/old-approvals.jsonl --taxonomy /private/latest-target-taxonomy.json --out /private/reclassification-work
# 재분류 작업·근거 대조 후 새 후보를 생성한다. migrate 결과의 후보는 변경 전 지문이므로 재사용하지 않는다.
python -m ml.reviews approval-candidates --source /private/reclassified-pilot.json --taxonomy /private/latest-target-taxonomy.json --out /private/approval-candidates
# 실제 검수 이력을 대조한 원장은 /private/approvals.jsonl로 별도 준비
python -m ml.reviews audit --source /private/reclassified-pilot.json --approvals /private/approvals.jsonl --taxonomy /private/latest-target-taxonomy.json --out /private/audit
python -m ml.reviews import-base --source /private/pinned-original-base --out /private/safe-base
python -m ml.reviews build --source /private/training-reviews.json --approvals /private/approvals.jsonl --registry /private/pilot-registry.json --taxonomy /private/latest-target-taxonomy.json --base /private/safe-base --max-tokens 256 --out /private/dataset-v2
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python -m ml.reviews train --dataset /private/dataset-v2 --base /private/safe-base --seeds 13 42 73 --epochs 5 --device cpu --out /private/experiment-v2
python -m ml.reviews final --dataset /private/dataset-v2 --experiment /private/experiment-v2 --out /private/final-v2
```

## 학습·평가 보호

1. 실제 근거·승인·보류·정책 해시·전체 파일럿 목록을 검사한다.
2. 원문 전체가 토큰 상한을 넘으면 보류한다. 원문은 workbench에 남기며 조각마다 전체 리뷰 정답을 복제하지 않는다. 문서의 상한은 기본 256, 검증 fixture만 64다. 긴 리뷰 처리는 향후 별도 실험 과제다.
3. 게임 단위로 60/20/20에 가까운 분할을 고정한다. 최소 5게임이며 부족하면 리뷰별 임의 분할로 대체하지 않는다. NFC·공백 정규화 동일 본문과 분할 간 문자 TF-IDF 유사도 0.97 이상을 차단한다. 의미상 중복·같은 작성자의 상관·시점 누수를 완전히 검출하는 기능은 아니므로 추가 검수가 필요하다.
4. 같은 입력과 분할로 TF-IDF 로지스틱 회귀, 무작위 TextCNN, KcELECTRA 본체 고정+학습 헤드, 전체 미세조정을 비교한다. 본체 고정도 헤드는 학습한다. 검증 성능으로 epoch·임계값·모델을 고른다. 기본 3개 seed의 평균·표준편차를 제공하며 표준편차를 신뢰구간이라고 부르지 않는다.
5. 학습에서 한 클래스만 있는 출력은 상수와 `unlearnable_labels`로 보고한다. 시험 지지가 없는 항목의 F1은 미측정(`null`)으로 남기고, 고정된 전체 세부 라벨 0처리 Macro-F1과 지지가 있는 라벨 Macro-F1을 따로 보고한다. 점수는 보정된 확률이 아니다. 세부 분류를 늘리면 희소 라벨도 늘어나므로 원본 분포와 정답 수를 확인해야 한다. 자동 합격 기준은 없다.
6. 최종 시험 전에 모델·데이터·선택을 해시로 봉인한다. 같은 로컬 실험 경로에서 최종 시험을 배타 예약하고 실패해도 예약을 지우거나 자동 재시도하지 않는다. 시험 후 모델을 다시 고르지 않는다. 실험 폴더 복제/수동 변경을 막는 중앙 시험 관리 서버는 없으므로 운영자의 시험 이력 관리가 필요하다.
7. epoch 중간부터의 optimizer/RNG 재개는 제공하지 않는다. 실패한 실험 폴더는 보존하고 원인 확인 후 새 실험 ID로 처음부터 실행한다. 완성되지 않은 폴더에는 READY가 없으므로 모델로 로드할 수 없다. 최종 시험 실패를 처리할 때도 먼저 예약·실패 이력을 검토한다.

출력에는 검증 모델 비교 PNG, 선택 JSON, 모델별 학습 이력, 최종 항목별 support/TP/FP/FN·정밀도·재현율·F1 CSV/JSON, 원문 해시로 연결되는 오류 목록, 시험 점수 NPZ가 있다. 실제 데이터로 실행하면 이 파일 역시 비공개 자료다. 모델 성능 보고는 실제 정답 평가 후 작성해야 한다.

## 배치 추론과 이후 RAG

```bash
python -m ml.reviews predict --source /private/batch.jsonl --model /private/experiment-v2/<selection.json의 selected_path> --out /private/predictions-v2
python -m ml.reviews summarize --source /private/predictions-v2 --out /private/summary-v2
```

각 입력은 `appid/review_id/key/text/text_sha256/source_revision/snapshot_id`가 필요하다. 원본 수집 스냅샷·리뷰 수정 버전을 임의 생성하면 안 된다. 누락·본문 불일치·중복 입력은 `REJECTED_INPUT`, 긴 입력은 `HELD_LONG_INPUT`이다. 정상 상태는 `PREDICTED_TARGETS` 또는 `NO_TARGET_PREDICTED`이며 후자는 **모델이 대상을 예측하지 않았다는 뜻**이다. 사람이 확인한 ‘평가 없음’과 같지 않다. 모델 오류·비정상 점수는 성공 산출물 없이 배치를 중단한다.

집계기는 동일 모델·분류표·정책·스냅샷을 검사하고 리뷰 수정 버전의 중복·점수/라벨 불일치를 차단한다. 게임별 세부 대상/감성 건수와 성공 리뷰 수를 제공한다. 상위 사운드 항목은 세부 음악·더빙 결과를 모두 유지한다. 한 리뷰가 두 대상을 언급해도 상위 항목 리뷰 수는 1이며 실패·보류를 정상 결과의 0건으로 채우지 않는다. 의미상 같은 작성자 중복이나 시장 전체의 대표성을 보증하는 집계는 아니다.

분류 결과에는 모델·taxonomy·정책·스냅샷·수정 버전이 남는다. `evidence_spans: null`을 근거가 있다고 포장하지 않는다. 이후 서비스 집계는 같은 스냅샷·수정 버전의 리뷰를 중복 없이 사용하고, RAG는 원문 근거와 수치 집계를 따로 검증해야 한다. 이 패키지 자체에는 운영 DB 적재·자동 전송·RAG 답변 생성·시장 전체 일반화가 없다.

## 남은 실제 입력과 검증

- 최신 전체 분류표·재분류 원본·검수 범위를 회수해 기존 자료와 대조한다. 파일럿의 현재 총수는 미확인이며, 번호나 오래된 50+10을 현재 전체 건수로 단정하지 않는다. 파일 상태만 보고 기존 검수를 취소하거나 전체를 승인하지 않는다.
- 보류 의견과 재접속 행동/‘어둡다’ 등 경계 사례를 확정한다. 검수자 간 일치도·클래스별 정답 수·게임과 기간 대표성을 확인한다.
- 확정 파일럿은 기준 자료로 보존하고, 세부 대상별 학습·검증·고정 시험용의 별도 정답 리뷰를 확보한다. 소량의 초안을 대규모 정답 데이터라고 부르지 않는다.
- GPU 작업 재개 후 디스크·환경 준비, 고정 KcELECTRA 실제 import, 작은 실제 학습, 전체 비교, 오류 분석, 봉인 시험, L4 성능·실패 복구 순서로 진행한다.
- DB 자동 전송과 서비스/RAG는 별도 구현·권한 검토·격리 검증 후 연결한다. 운영 적용 완료라고 표시하지 않는다.

참고: [ELECTRA 공식 문서](https://huggingface.co/docs/transformers/en/model_doc/electra), [원본 모델](https://huggingface.co/beomi/KcELECTRA-base/tree/4cf9eb1dfeec0a672afe73059882fc998a299ceb), [PyTorch 직렬화 보안 권고](https://github.com/pytorch/pytorch/security/advisories/GHSA-v32g-mr63-3j83).
