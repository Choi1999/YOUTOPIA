# 관리자 계정과 인증

주소는 승인한 공개 HTTPS origin의 `/admin/login`이다. 로그인 후 `/admin`,
회원 조회는 `/admin/users`이며 관리자 API는 `/api/v1/admin/**`다.
일반 회원과 별도 `auth.admin_account` realm을 쓰고, 등급/클라이언트 표시로
관리자 권한을 부여하지 않는다. 기본 ID/비밀번호를 앱 시작 시 만들지 않는다.

## 현재 구현과 비밀번호

ID는 운영자가 직접 선택하는 소문자 ASCII 영문·숫자·점·밑줄·하이픈3~80자이며
첫 글자는 영문/숫자다. 기존 bootstrap과 동일하게 정규화한다.
비밀번호는15~128 Unicode code point, 승인된 비어 있지 않은 SHA256 유출 비밀번호
차단 목록을 통과해야 한다. 저장은 `{pbkdf2-sha256-v1}` PBKDF2-HMAC-SHA256,
600,000회·16바이트 salt·256bit다. 기존 암호/해시를 출력·복호화하지 않는다.

관리자 세션은 유휴15분·절대8시간, 새 성공 로그인이 이전 관리자 세션을 폐기한다.
비밀번호 변경/복구는 auth_version/row_version 증가, 이전 세션 삭제, 감사 완료를
요구한다. 감사/Redis 실패는 성공으로 숨기지 않고 NEEDS_RETRY를 남긴다.

## 승인 전 준비와 조회

먼저 `SERVER-REVIEW.md`에 따라 새 archive/hash/staging 여부를 확인한다.
다음 명령의 JAR 경로는 symlink인 current가 아닌 **검증한 root 소유 새 릴리스**다.
`JAR_SHA256`은 전달 metadata의 값을 독립적으로 확인한다.

```sh
python3 admin-operator.py --jar /opt/youtopia-app/releases/SOURCE_SHA/app.jar \
  --sha256 JAR_SHA256 status
```

이 조회는 기존 DB login과 암호를 신뢰 root TTY에서 묻고, read-only 트랜잭션으로
지정 ID 존재/상태/auth_version와 전체 관리자 수만 읽는다. password_hash를
SELECT하지 않는다. 비밀번호는 `Console.readPassword`로 숨겨 입력한다.
DB login의 기존 SELECT 권한이 없으면 중단하며 GRANT/RLS를 다시 적용하지 않는다.

## 초기 생성: 별도 실행 검토 후만

관리자가0명인 경우에만 기존 `AdminBootstrapCommand.initialize`를 호출한다.
이미 관리자가 있으면 다른 ID로도 추가/덮어쓰지 않는다. 앱 DB역할에는 INSERT를
추가하지 않고, 운영자가 이미 승인한 초기 생성용 DB login을 일회성 프로세스에만 쓴다.
이 login은 app.env에 넣지 않는다. 기존 bootstrap에는 생성 전용 DB 감사 event가 없으므로
새 enum/DDL을 만들지 않고 생성 여부·운영자·검토 참조를 root 전용 인계 기록에 남긴다.

```sh
# 향후 대상·운영자·기존 계정 조회·생성 승인이 끝난 경우에만:
python3 admin-operator.py --jar /opt/youtopia-app/releases/SOURCE_SHA/app.jar \
  --sha256 JAR_SHA256 create --reviewed
```

선택한 ID·새 비밀번호·확인을 직접 입력한다. 실제 비밀번호는 채팅/Git/인자/
셸 history/환경파일/로그에 쓰지 않는다. CLI가 DB 연결을 위해 숨겨 입력한 암호도
명령 인자에 없다. 신뢰 TTY·root 전용 프로세스를 사용하고 터미널 녹화를 끈다.

## 기존 비밀번호 변경과 분실 복구

현재 비밀번호를 아는 경우 기존 HTTPS API `/api/v1/admin/auth/password`의
`requestKey`, `currentPassword`, `newPassword`와 세션/CSRF를 사용한다.
현재 관리 화면에 전용 비밀번호 변경 폼은 없다. 브라우저 콘솔/URL/curl 인자에
비밀번호를 넣는 대체 절차는 사용하지 않는다. 아래 root 복구 도구가 안전한 TTY 입력을 제공한다.

분실 시 회원 recovery-code API는 관리자에 적용되지 않는다. 운영자는 먼저 관리자
ID/ACTIVE 상태를 조회하고 ingress와 기존 앱을 승인한 유지보수 범위에서 격리한다.
`admin-operator.py reset`은 승인된 root0600 runtime 입력 JSON을 자식 프로세스에만
전달한다. systemd env를 source/eval하지 않는다. 상태/생성과 달리 실제 Redis,
기존 제한 역할, 감사, 정상 control 검증이 모두 필요하다. 임시 loopback random 포트의
앱 context를 띄워 기존 lifecycle을 사용하고 종료한다. 운영 unit/DDL/GRANT는 바꾸지 않는다.

```sh
# 실제 변경은 별도 승인 후. 요청 UUID와 운영자·참조를 비공개로 먼저 기록한다.
python3 admin-operator.py --jar /opt/youtopia-app/releases/SOURCE_SHA/app.jar \
  --sha256 JAR_SHA256 --runtime-input /root/APPROVED_RUNTIME_INPUT.json \
  reset --request-key REQUEST_UUID --reviewed
```

새 비밀번호와 확인은 TTY에서 숨겨 입력한다. DB 트랜잭션은 기존 관리자 행을 잠그고
동일 해시 정책·버전 증가·관리자 active guard 제거·PASSWORD_RESET 작업을 기록한다.
기존 lifecycle이 이전 Redis 세션을 지우고 PASSWORD_RESET 감사를 마친 뒤 완료한다.
부분 실패 시 이전 암호/세션은 계속 폐기된 상태다. 같은 UUID·같은 새 비밀번호로만
재시도한다. UUID를 바꿔 성공 여부를 숨기거나 구 hash/버전으로 되돌리지 않는다.
실패 후 DB를 복원하거나 일반 회원을 관리자로 승격하지 않는다.

## 회귀와 한계

합성 계정으로 실제 JAR API와 Chromium에서 로그인→조회→새로고침→로그아웃→
이전 cookie 거부를 검증한다. 비밀번호 변경·운영자 복구는 실제 제한 DB 역할,
auth_version·감사·세션 폐기·부분 실패 재처리 integration을 수행한다.
이는 운영 관리자 존재/실제 암호/운영 control·HTTPS 성공의 증거는 아니다.
