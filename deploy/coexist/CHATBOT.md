# 고정 질문 LLM 시연: 기존 운영판에서 재개

현재 제공자는 OpenAI이다. Spring 서버가 `POST https://api.openai.com/v1/responses`를 실제 구현한다. 프론트/예산 예약/응답 파싱에 TODO·빈 호출·가짜 성공 경로가 없다. 키가 없거나 기능이 꺼져 있으면 앱은 기동하고 챗봇만 점검 상태가 된다. 실제 키 등록·제공자 호출·운영 적용은 이 구현 검증에 포함하지 않았다.

사용자용 일반 지표 설명 기능의 **임시 관리자 시연 정책**은 `ChatAccessPolicy`와 Spring Security `/api/v1/chat/**` 경계에 분리되어 있다. 관리자 업무나 특정 게임의 실측 분석 기능이 아니다. 공개 게임 화면에서도 기존 관리자 세션을 재사용한다. 비회원/회원 직접 호출은 거부하고 기존 CSRF·계정 세대·로그아웃·만료 검사를 유지한다.

## 공식 API 계약

2026-11-03 KST 기준 확인한 공식 문서:

- [Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Text generation](https://developers.openai.com/api/docs/guides/text)
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [API errors](https://developers.openai.com/api/docs/guides/error-codes)

검토한 모델 설정 예는 `gpt-6-luna`이며 `reasoning.effort=none`을 지원한다. 모델은 서버 변수로만 지정하며 기본값은 비어 있다. 다른 모델을 선택할 때도 Responses·effort none 지원과 계정의 사용 가능 여부를 확인한다. 실제 키·모델 접근 권한은 아직 실연동 미검증이다.

요청은 서버 고정 instructions/input, model, max_output_tokens=300(추론 토큰 포함 상한), reasoning.effort=none, store=false, stream=false만 사용한다. 도구·RAG·게임 DB 조회·previous_response_id·메시지 이력·파일은 보내지 않는다. 요청당 `.send` 한 번, 리다이렉트/애플리케이션·SDK 재시도 없음. JDK 연결 재시도도 비활성화한다. 연결5초/전체 제공자 요청8초, 응답 본문64KiB·표시 텍스트8000자 상한. 텍스트는 output 배열의 assistant message/output_text에서 읽고 completed가 아니거나 비어 있으면 실패한다.

앱 API:

- `GET /api/v1/chat/status`: 관리자에게만 가용 상태/고정 질문/임시 정책을 반환. 외부 호출·예약 없음.
- `POST /api/v1/chat/answers`: JSON은 `questionId`, `requestId` 두 필드만. questionId는 CCU_BASICS / VIDEO_VOLUME / JOINT_SIGNALS, requestId는 UUID. 추가·중복 필드, 임의 prompt/messages/model/url/key 등은400. CSRF와 기존 계정 문맥 헤더를 사용한다.
- POST 정상 답변만200. 구성/저장소/제공자 실패503, 앱 한도·동시 처리429, 잘못된 입력400, 인증401/권한403/요청 충돌409는 별도. 외부429는 앱429와 구분하여503 점검으로 반환한다. 내부 종류는 제한된 코드로만 기록하며 원본 제공자 본문/예외/키/질문 로그를 남기지 않는다.

## 정확한 서버 변수와 비밀 입력

| 변수 | 키 없는 기본 | 활성 설정 |
|---|---|---|
| YOUTOPIA_CHAT_ENABLED | false | true |
| YOUTOPIA_CHAT_OPENAI_API_KEY | 빈 값 | 기존 OpenAI API 키를 root0600 비밀 설정에 직접 입력 |
| YOUTOPIA_CHAT_MODEL | 빈 값 | 검토 예: gpt-6-luna |
| YOUTOPIA_CHAT_BUDGET_EPOCH | 빈 값 | 최초 시연 예산의 고정 UUID. 재시작·로그아웃 때 변경 금지 |
| YOUTOPIA_CHAT_BUDGET_FILE | 빈 값 | /var/lib/youtopia-app-chat/해당UUID.json |

다른 DB/Redis/control/인증서/계정 설정은 재사용한다. 기존 root0600 런타임 입력 JSON의 **새 복사본**을 만든 뒤 안전한 편집기로 이 다섯 필드만 보완한다. 키는 채팅/Git/ZIP/명령 인자/셸 history에 넣지 않는다. env를 source/eval하거나 전체 설정을 출력하지 않는다. 기존 설정이 JSON으로 보존되지 않았다면 현재 설정을 안전하게 복원·대조해야 하며 공개 예제의 기본값으로 운영 설정 전체를 덮지 않는다.

`prepare-runtime-config.py ROOT_ONLY_INPUT.json NEW_OUTPUT.env`는 새 키 이름, flag/model/epoch/영속 경로를 검사하고 새0600 EnvironmentFile만 쓴다. 실제 키가 유효하다는 증명은 아니다. 비활성 키 없는 입력도 허용한다. 활성화에는 다섯 설정이 모두 필요하다. `app.env.example`/`app-input.example.json`에는 실제 키가 없다.

## 예산·중복·상태 유실

운영 Redis ACL의 기존 `~youtopia:*` 및 GET/SET/EVAL/EVALSHA/SCRIPT LOAD 범위만 사용한다. ACL 확장·DB 테이블·추가 Redis/VM은 필요 없다. 예산 키는 `youtopia:sessions:chat-budget:<epoch>`, TTL 없음. 세션 키와 분리되어 로그아웃·서버/앱 재시작으로 초기화하지 않는다.

Redis CAS와 동일 상태의 root0600 영속 디스크 영수증을 함께 검증한다. 기존 앱 사용자 소유 파일/lock, 프로세스 간 비차단 파일 잠금, Redis의 active 예약으로 전역 최대1호출을 지킨다. 입력·인증·CSRF·설정 검사 후 CAS 예약→파일 fsync/atomic rename/디렉터리 fsync가 성공해야 외부 호출한다. 저장소가 불일치하거나 없거나 접근 불가하면503; 웹 시작/요청이 이를 자동 생성·복구하지 않는다. Redis AOF가 이전으로 돌아가도 로컬 영수증과 다르면 차단한다.

관리자 UUID별 rolling60초 최대3회, 전체 epoch 누적30회. 예약한 requestId/소유자/고정 질문과 제한된 답변·실패 상태를 최대30개만 보존한다. 이는 중복 과금 방지 캐시이며 대화 이력으로 외부 전송하지 않는다. 같은 requestId/소유자/질문은 성공 캐시 재사용 또는 기존 실패 반환, 다른 질문·다른 관리자 재사용은409. 실패도 예약 횟수를 환급하지 않는다. 중단/타임아웃/전송 불명확은 AMBIGUOUS로 저장하고 이후 외부 호출을 차단한다. 자동 재시도·예약 만료·잠금 TTL로 새 호출을 허용하지 않는다.

영수증 디렉터리는 릴리스·서비스 DB 백업/복원 대상에서 제외한다. Redis와 영수증을 함께 같은 과거 스냅샷으로 돌리는 전체 상태 복원은 자동 감지한다고 주장하지 않는다. 이런 복원·분실·불일치 또는 AMBIGUOUS 상태에서는 기능을 끈 채 운영자가 이전 호출·비용·진행 중 제공자 요청을 확인해야 한다. 파일/Redis를 맞추려고 삭제·복사하거나 이전 receipt를 덮어쓰지 않는다.

## 키 없이 배포할 수 있는 범위

기본 `YOUTOPIA_CHAT_ENABLED=false`와 나머지 빈 값으로 새 JAR/정적 파일을 기존 전달·stage·activate 절차에서 검토할 수 있다. 챗봇 외 기능은 그대로 정상 동작한다. 기존 사용자/관리자 생성, DDL/GRANT/RLS/control OPEN, Java/nginx/Redis/인증서 설치·재설정은 반복하지 않는다. 운영 배포/재시작은 이번 작업에서 수행하지 않았다.

처음 활성화할 때만 영속 상태 경로를 준비한다. 기존 unit 전체를 덮지 않고 동봉 `chat-state.conf`의 StateDirectory/Mode만 신규 drop-in으로 검토한다. `ProtectSystem=strict` 아래에서 systemd가 이 경로만 앱 사용자에게 쓰기 가능하게 한다. 실제 unit/폴더 변경은 별도 운영 승인 후 실행한다.

```sh
# 기존 unit 유지, 승인 후 신규 drop-in만. 기존 경로가 있으면 덮지 말고 대조한다.
test ! -e /etc/systemd/system/youtopia-app.service.d/chat-state.conf
install -d -m 0755 /etc/systemd/system/youtopia-app.service.d
install -m 0644 REVIEWED_TOOLS/chat-state.conf /etc/systemd/system/youtopia-app.service.d/chat-state.conf
systemctl daemon-reload
```

StateDirectory는 unit 시작 때 만들어진다. 키 없는 앱의 승인된 배포/재시작으로 경로를 만든 뒤, **첫 예산 등록/회전은 앱을 정상 정지한 유지보수 구간**에서 수행한다. 현재 작업에서는 정지하지 않았다. 디렉터리/소유자가 예상과 다르면 자동 chown/재생성하지 않는다.

root0600 입력의 chat flag는 false, epoch는 새 UUID, file은 그 UUID의 새 경로로 준비한다. API 키는 이 단계에 필요 없다. 다음 도구는 JAR 독립 해시·root 소유 입력·기존 unit inactive/MainPID0·앱 소유0700 디렉터리를 확인하고 기존 앱 UID로 Redis/영수증 초기 예산만 만든다. OpenAI 클라이언트·Spring 웹·DB 풀을 시작하지 않는다.

```sh
# SOURCE/JAR_SHA/TOOLS/INPUT은 전달물과 실제 기존 경로에서 검증한 값으로 대체한다.
python3 REVIEWED_TOOLS/chat-budget-operator.py \
  --jar /opt/youtopia-app/releases/SOURCE/app.jar --sha256 INDEPENDENT_JAR_SHA256 \
  --runtime-input ROOT_ONLY_INPUT.json --reviewed-new-budget
```

동일 epoch/file/key가 있으면 거부한다. 어떤 기존 예산도 삭제/초기화하지 않는다. 정상 등록 후 키/모델과 enabled=true를 root0600 새 설정에 넣고 기존 env/승인 이력을 보존하여 적용한다. 다음 승인된 앱 재시작 후에는 추가 코드 수정 없이 실제 OpenAI 요청이 가능하다. 다른 서비스/수집기/DB/Redis를 재시작하지 않는다.

## 키 등록 후 최소 실연동 확인 — 아직 미실행

실제 비용이 발생할 수 있으므로 운영자의 명시적인 실연동 승인 후에만 한다. OpenAI 계정에 해당 모델 접근 권한·사용 가능한 잔액/쿼터를 확인한다. 키 발급·잔액 충전·자원 구매를 자동 실행하지 않는다.

1. 기존 관리자 로그인으로 공개 게임 화면 패널을 연다. disclaimer와 고정 질문3개를 확인. status GET의 예상 제공자 호출 수0.
2. 'CCU는 무엇인가요?'를 한 번 누른다. 예상 제공자 요청 **최대1회**, 출력 상한300. 버튼 연타/자동 반복/자유 입력 없음.
3. 일반 설명이 표시되고 실제 게임 수치/RAG 연결을 주장하지 않는지 확인. 요청의 requestId를 비밀이 아닌 작업 식별자로 기록할 수 있으나 쿠키/CSRF/키를 공유하지 않는다.
4. 같은 requestId의 재전송은 제공자 추가0회. 상태 조회·패널 재개폐도0회. 단, 새로운 질문/새 requestId는 새로운 유료 호출이므로 최소 확인에 포함하지 않는다.
5. 503·429·인증/세션 오류를 성공으로 수용하지 않는다. 타임아웃/전송 불명확이면 새 질문으로 반복하지 말고 기능을 끈 채 확인한다.

## 비활성화·롤백·안전한 수동 한도 회전

기능 중지는 서버 설정 `YOUTOPIA_CHAT_ENABLED=false`와 승인된 앱 재시작으로 적용한다. 키 제거/회전은 별도 안전한 비밀 설정 변경이다. env만 바꾸고 실행 중인 앱에 적용됐다고 가정하지 않는다. 이미 예약된 호출은 취소됐다고 단정하거나 환급하지 않는다. 기존 예산/영수증은 보존한다.

코드 rollback은 기존 검증 릴리스로 current를 복구하고 앱만 재시작하는 절차다. 신규 비밀 env/영수증/Redis 예산을 삭제하거나 과거로 돌리지 않는다. 이전 앱은 새 선택 변수들을 사용하지 않아도 되며 저장된 예산은 다음 재활성화 때 그대로 남는다. DB·control·관리자·수집기·인증서·Redis ACL rollback은 없다.

30회 이후의 새 시연 예산은 root의 명시적인 비용 검토/승인 사항이다. 자동 reset API나 앱 시작 reset은 없다. 기능 비활성화→앱 정지/MainPID0→불명확한 제공자 요청의 종료·비용 확인→이전 receipt/Redis 기록을 비공개 보존→새 epoch UUID와 새 file 경로로 입력 작성→위 operator의 `--reviewed-new-budget`으로 새 예산 생성→설정 적용/승인된 앱 재시작 순서다. 이전 epoch/key/file은 삭제하지 않는다. 새 epoch는 과거 비용을 취소하지 않으며 운영자가 승인한 추가 최대30회라는 점을 기록한다. 상태가 유실되어 이전 비용을 확인하지 못하면 새 예산을 자동 발급하지 않는다.

## 이번 검증의 의미

제공자 HTTP는 로컬 모킹 서버/모킹 transport로만 요청 형식·파싱·오류/타임아웃·단일 시도를 검증한다. 관리자 API는 실제 격리 DB·Redis·세션과 모킹 제공자로 검증한다. 예산은 두 인스턴스와 별도 JVM 종료/재시작, 동시성/같은ID, 관리자별3/전체30, TTL 없음, Redis 유실/되돌림/영수증 유실·손상·저장소 장애 및 기존 ACL을 시험한다. 브라우저는 실제 세션/CSRF·키 없는 서버 기동과 별도 명시한 chat API 응답 fixture로 질문 선택/안전한 렌더링/키보드/모바일을 검증한다. 실제 키 등록·실제 OpenAI API 연동은 미검증이다.
