# 리뷰 분류 외부 API 비교

비교군은 OpenAI 기본·프롬프트 적용, Gemini 기본·프롬프트 적용의 4개다. 사용자가 Gemini 두 번째 조건도 프롬프트 적용으로 확정했다. Gemini 가중치 튜닝이나 개인화 기능으로 표시하지 않는다. 각 제공자의 두 조건은 같은 명시적 모델 ID·출력 상한·시험 입력을 사용한다. 기본 조건도 라벨 사전·JSON 형식·최소 과제 지시를 받으며, 프롬프트 조건은 원문 근거·평가 대상·양면 평가·주관적 난도 등 판독 규칙을 추가한다. 프롬프트에 학습·시험 리뷰나 정답 예시를 넣지 않는다.

`providers.py`에는 실제 REST 전송과 응답 해석이 있다. OpenAI Responses API `/v1/responses`의 `text.format=json_schema`, Gemini GenerateContent `/v1beta/models/{model}:generateContent`의 `generationConfig.responseMimeType/responseJsonSchema`를 사용한다. 제공자별 실제 모델 ID는 자동 추정하지 않는다. 선택한 모델이 해당 API와 구조화 출력을 지원하는지 실연동 때 확인해야 한다.

공식 문서 확인일: 2026-11-26 KST.

- [OpenAI Responses 생성 API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [OpenAI 구조화 출력](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Gemini GenerateContent REST API](https://aistudio.google.com/api-reference/generate-content/generate-content)
- [Gemini 구조화 출력](https://aistudio.google.com/docs/structured-output)

## 사전 설정과 실행

API 키 없이 코드 검사·로컬 모델 학습·계획 생성·모킹 테스트를 할 수 있다. 예시 설정 `benchmark_config.example.json`의 `models.openai`, `models.gemini` 빈 문자열은 검증에서 차단된다. 지원 모델 ID를 확인한 뒤 저장소 밖 비공개 설정 사본에 명시한다. 키나 URL을 이 JSON에 추가하면 거부된다. 출력 상한은 리뷰 비교 전용 2,048토큰 기본값이며 고정 질문 챗봇의 300토큰 설정과 별개다. 설정 허용 범위는 128–8,192토큰, 타임아웃 1–120초다.

환경변수는 `OPENAI_API_KEY`, `GEMINI_API_KEY`다. 서버의 비밀 설정에서만 주입한다. `.env` 파일을 자동으로 읽거나 키를 생성·출력하지 않는다. 유료 전송은 추가로 `YOUTOPIA_REVIEW_API_ALLOW_LIVE=1`과 CLI `--allow-live`가 모두 있어야 한다. 모델 ID는 위 JSON 필드에서만 읽는다. 키가 없거나 실행 허용이 꺼져 있으면 외부 요청 0회, 예산 예약 0회, 최종 시험 개봉 없음으로 반환한다. 이는 분류 답변 성공이 아니다.

현재 작업에서는 아래 명령을 실 API로 실행하지 않았다. `PRIVATE`는 저장소 밖 실제 비공개 절대 경로로 바꾼다. 비밀값을 명령행에 넣지 않는다.

```bash
python -m ml.reviews benchmark-plan --dataset PRIVATE/dataset --config PRIVATE/benchmark_config.json --out PRIVATE/api-plan
python -m ml.reviews benchmark-budget --path PRIVATE/api-budget.sqlite --max-calls 40
python -m ml.reviews benchmark-final --plan PRIVATE/api-plan --dataset PRIVATE/dataset --budget PRIVATE/api-budget.sqlite --out PRIVATE/api-final --allow-live
```

`--max-calls 40`은 운영 기본값이 아닌 예시다. 고정 시험 리뷰가 N건이면 4개 조건의 정상 최초 실행은 최대 **4N회** 외부 전송이다. 실패도 예약을 소비한다. 계획 생성 결과의 `maximum_ready_http_attempts`로 필요한 횟수를 확인한 뒤 실제 예산을 명시한다. 최소 실연동 확인은 최종 시험 자료를 사용하지 않는 별도 검증 리뷰와 별도 계획으로 수행한다. 두 제공자 기본 조건만 선택하면 1리뷰×2조건=2회다. 네 조건을 모두 확인하면 4회다. 검증 리뷰를 최종 시험에 다시 포함하지 않는다.

## 데이터·시험 봉인

계획은 검증 분할만 의미적으로 읽어 모델·사전·정책·프롬프트·입력 범위를 고정한다. 최종 시험 행은 `benchmark-final`에서 별도 배타 예약 후 연다. 자체 모델과 같은 봉인 데이터셋을 사용하고 원문 문자열만 제공한다. 리뷰 키·게임 ID·정답·근거·Steam 추천값·대화 이력은 전송하지 않는다. 메타 참조 감성 자료는 텍스트 단독 시험에서 차단한다. 파일럿 100건은 데이터셋 구축에서 제외한다.

프롬프트나 모델 설정을 바꾼 뒤 같은 최종 시험을 보고 반복 개선하면 독립 시험이라고 주장할 수 없다. 최종 예약 파일은 실패해도 자동 삭제하지 않는다. 재실행이 필요하면 먼저 실패 시점·이미 전송한 요청·예산 상태와 시험 노출 범위를 검토해야 한다. 임의로 예약 파일을 지우는 절차는 제공하지 않는다.

## 호출과 실패 처리

- 요청당 전송 시도 1회, 자동 재시도·리다이렉트·도구 호출 없음. TLS 인증서 검증을 사용하고 외부 주소는 제공자 호스트로 고정한다.
- SQLite 예산은 명시적으로 한 번 초기화한다. 모든 실행 프로세스가 **같은 영속 파일·receipt**를 공유해야 한다. 같은 저장소에서 활성 외부 요청 최대 1개다. 여러 서버의 서로 다른 예산 파일을 묶는 분산 제한 기능은 없다.
- 요청 ID는 계획·조건·리뷰 키·본문 해시로 결정한다. 완료 결과 재요청은 저장된 결과를 읽고, 미완료 예약은 전송 여부 미상으로 차단한다. 재시작으로 누적 횟수가 초기화되지 않는다.
- DB나 receipt가 없거나 서로 다르거나 읽을 수 없으면 차단한다. 예산 파일·receipt·저널·최종 예약을 동일한 영속 저장소와 백업 범위로 보존한다. 수동 삭제·복제로 예산을 초기화하거나 여러 호스트로 복제해 중복 과금 방지를 우회해서는 안 된다.
- 401/403, 429(쿼터 또는 속도 제한), 5xx, 네트워크·타임아웃·거절·잘림·빈 응답·JSON/라벨 오류를 구분한다. 제공자 오류 본문·프롬프트·키는 오류 메시지에 포함하지 않는다. 전송 여부가 불명확한 실패를 자동 환급하지 않는다.
- 빈 정상 라벨 배열은 `NO_TARGET_PREDICTED`다. 사람의 `구체 평가 없음` 정답과 다르다. 실패의 `labels`는 `null`이며 정상 빈 분류로 바꾸지 않는다.

## 결과 해석

`comparison.json`에는 조건별 성공률·실패 종류·모델 반환 버전·프롬프트 해시·토큰 사용량·분류 지표와 공통 데이터/정책 해시를 남긴다. 조건 디렉터리에는 비공개 리뷰 키와 예측이 들어가므로 공개 저장소에 올리지 않는다. 원문 응답 본문은 저장하지 않는다. 제공자가 반환한 모델 버전이 조건 사이에 바뀌면 `provider_version_consistent=false`로 표시하며 프롬프트만의 차이라고 해석하면 안 된다.

전체 시험 지표는 커버리지 100%일 때만 제공한다. 실패가 있으면 성공한 부분집합의 지표는 별도 필드로 남기고 전체 시험 지표는 `null`이다. 완전한 모델과 부분집합 F1을 같은 순위로 정렬하면 안 된다. 표본 0 라벨·양극성·분모 규칙은 자체 모델과 같다. 사용 토큰은 실제 청구 금액이 아니므로 비용은 검증 전 `null`이다. 실패한 전송에도 사용료가 발생할 수 있다.

이번 검증은 모킹이다. **실제 키·모델 접근 권한·제공자 청구·실 API 통신은 미검증**이며 자동 서비스 배포나 모델 선정 승인은 하지 않는다.
