# 같은 PostgreSQL의 별도 control DB와 서비스 DB 단독 복원

## 확정한 배치와 보호 범위

기존 PostgreSQL 인스턴스에 서비스 DB `youtopia`와 별도 DB `youtopia_control`을 쓴다.
서비스 DB 안의 다른 schema나 staging DB는 대안이 아니다. 새 서버·유료 자원은 만들지 않는다.
보호 범위는 **youtopia의 논리 백업으로 youtopia DB만 과거 상태로 복원**하는 경우다.
control DB·최신 journal/fence·관리자 복원 입력·HMAC 키는 그 백업/복원 대상에서 제외한다.

`pg_dump --dbname=youtopia`처럼 정확한 한 DB를 대상으로 한다. pg_dumpall, 물리 base backup,
인스턴스 PITR, VM/디스크 snapshot 전체 복원·유실은 이 절차의 지원 범위 밖이다.
동일 인스턴스의 WAL/디스크를 함께 되돌리면서 control만 최신이라고 가정하지 않는다.

## 코드·역할·연결 계약

| 구분 | DB/로그인 | 권한·상한 |
|---|---|---|
| 기존 서비스 | youtopia / 기존7개 앱 역할 | 기존 owner/DDL/GRANT/RLS·수집 데이터 보존 |
| control owner | youtopia_control / ytp_control_owner | 새 DB/객체 소유 전용 NOLOGIN; 앱/manager에 membership 없음 |
| control 앱 | youtopia_control / ytp_control_app | fence/journal/policy SELECT, journal INSERT·sequence 사용; fence 변경·journal 수정/삭제·policy 승인 불가 |
| 복원 관리자 | youtopia_control / ytp_restore_manager | fence/restore_run SELECT·INSERT·UPDATE, journal SELECT만; journal 삭제·policy 승인 불가 |
| 서비스 복원 연결 | youtopia / 기존 승인한 복원 DB login | 별도 일회성 CLI에만 공급; 새 control manager에 서비스 권한을 부여하지 않음 |

프로덕션 app pool은 **정확한 youtopia_control/ytp_control_app 실제 LOGIN**을 확인한다.
SET ROLE, 서비스/staging/system/template DB, owner/강한 역할을 앱으로 쓰면 거부한다.
control=false나 인증/복원 filter 제거로 기동을 우회하지 않는다.

필수 선언은 `YOUTOPIA_CONTROL_RESTORE_SCOPE=SERVICE_DATABASE_ONLY`다. 미선언 또는
WHOLE_INSTANCE/VM 보호 선언은 프로덕션 설정에서 거부한다. 이것은 운영자가 선언한
범위 검사이며 실제로 무슨 snapshot을 복원했는지 감지하는 장치가 아니다.

연결은 기존 host loopback `127.0.0.1:5432`의 별도 DB다. `YOUTOPIA_CONTROL_CONNECTION_POLICY`에 따라:

- `HOST_LOOPBACK`: `jdbc:postgresql://127.0.0.1:5432/youtopia_control?sslmode=disable`
- `VERIFY_FULL`: 같은 DB/주소에 `?sslmode=verify-full&sslrootcert=/etc/youtopia-app/control-ca.crt`

HOST_LOOPBACK은 기존 서비스 DB와 같은 host-local 경로의 명시적 정책이다.
다른 호스트·포트·별칭/추가 query/내장 자격증명·TLS 자동 fallback은 허용하지 않는다.
비밀번호 인증은 SCRAM으로 별도 검증하며 평문 신뢰 인증으로 바꾸지 않는다.
VERIFY_FULL을 고르면 실제 PostgreSQL TLS·CA·127.0.0.1 IP SAN이 검증돼야 한다.
운영 PostgreSQL의 현재 SSL/HBA 설정은 조회 전 미확인이다. 이 준비안은 SSL/HBA를
수정하거나 인스턴스를 재시작하지 않는다. 원격 TLS 정책을 임의로 끄는 변경이 아니다.

## 현재 연결 수와 새 역할 제한안

프로덕션 웹앱1개에서 data5 + member/admin/audit 각3 + directory/event/report 각3 =
서비스 DB 최대23연결, control 최대3연결로 같은 인스턴스 합계26이다.
비활성 모듈은 pool이 생성되지 않는다. control pool의3 초과 설정은 기동 검사에서 거부한다.
복원 CLI는 서비스1 + control1로 총2개다. 앱과 같이 실행하면 최대28개이며,
관리자 복구 CLI는 별도 앱 context를 쓰므로 기존 앱 정지 후 실행한다.

비공개 신규 생성안은 앱 role6, manager role2, control DB10의 연결 상한을 제안한다.
이는 단일 앱3 + 검토한 임시 프로세스 여유를 포함하며 현재 운영 적용값이 아니다.
실제 max_connections/reserved·수집기·다른 세션의 피크/여유는 조회 후 대조한다.
새 control이 같은 인스턴스의 연결·WAL·저장 공간을 사용한다는 점을 부하 검토에 포함한다.

PostgreSQL role은 인스턴스 전역이다. 기존 youtopia에 PUBLIC CONNECT/TEMP가 있으면
새 role도 그 권한을 상속할 수 있다. 기존 서비스 DB의 PUBLIC ACL을 이 작업에서 바꾸지 않는다.
연결 자체의 허용과 서비스 schema/테이블의 접근 거부를 구분해 검증한다.
CONNECT 단계의 추가 격리가 필요하면 HBA/ACL 영향안을 별도 검토한다.

## 비공개 준비와 운영자 입력

DB/role/owner 충돌을 먼저 읽고, 기존 이름이 있으면 재생성·덮어쓰기·권한 확대를 하지 않는다.
운영 전용 생성/GRANT/검증 SQL은 Git/공개 전달 ZIP 밖의 별도 비공개 자료로 제공한다.
기존 서비스 DB·수집기·기존 역할/권한은 생성안의 변경 대상이 아니다.
새 control 로그인을 NOLOGIN으로 만들고 schema/ACL 검토·숨긴 SCRAM 암호 입력 뒤에만 활성화한다.
policy8개는 REVIEW로 유지한다. LEGAL_REVIEW 신규 탈퇴/파기/reconciliation은 계속 off다.

`restore-operator.py --input NEW_ROOT_0600.json prepare-input`은 root TTY에서
기존 서비스 복원 login·검토한 연결 정책, 두 DB 암호·앱과 동일한 control HMAC 키를
직접 입력받아 **새**0600 파일을 만든다. 암호/키는 getpass로 숨긴다.
실제 값을 Git/채팅/명령 인자/history/로그에 쓰지 않고 env 파일을 source/eval하지 않는다.
키는 base64 최소32바이트이며 account HMAC과 다르게 유지한다. 값/길이/hash를 출력하지 않는다.
복원 manager/owner 비밀을 앱의 app.env에 넣지 않는다.

일회성 operator 환경은 YOUTOPIA_RESTORE_* / YOUTOPIA_CONTROL_MANAGER_*와
CONTROL_RESTORE_SCOPE/CONNECTION_POLICY/SERVICE_KEY/HMAC_KEY를 사용한다.
검증한 root 소유 JAR의 실제 hash와 새 입력 파일로만 실행한다. 예시는 SERVER-REVIEW.md를 따른다.

## 서비스 DB 복원과 기동 게이트

1. 승인한 운영자: 외부 ingress·신규 앱을 차단한다. youtopia에 raw/collector가 같이 있으면
   전체 DB 복원의 수집 영향도 별도로 검토한다. 현재 준비 도구가 cron/수집기를 바꾸지 않는다.
2. 실제 제한 역할로 SELECT 허용/거부·SCRAM·DB/경로를 확인한다. `inspect`는 DB 상태를 바꾸지 않는다.
3. 최초 `enroll`은 BLOCKED만 만든다. OPEN seed나 직접 SQL UPDATE로 열지 않는다.
4. `begin`은 control을 RESTORING으로 바꾸고 새 generation/run을 남긴다.
   그 뒤 승인한 youtopia 논리 복원만 수행한다. control DB/글로벌 role/인스턴스는 복원하지 않는다.
5. `replay`는 최신 control journal로 삭제/파기를 재적용하고, 서비스 auth_version/generation,
   관리자 active session·구 복구코드를 폐기한다. 정확한 deadline과 watermark를 확인한다.
6. 독립 검토자가 현재 credential 상태까지 확인한 뒤에만 `verify --credential-state-reviewed`를 쓴다.
   이 옵션은 증거를 대신하지 않는다. VERIFIED도 아직 외부 서비스 허용 상태가 아니다.
7. `open`은 generation/marker·최신 committed sequence·pending 없음·검증 상태가 모두 맞아야 한다.
   기동 후 실제 API/로그인/세션·수집 공존 수용을 확인한 뒤 ingress를 연다.

최초 baseline의 begin/replay도 기존 사용자·관리자 버전/세션/복구코드를 바꿀 수 있다.
따라서 신규 control DB 준비/등록과 별도 실행 단계로 검토한다. 기존 DDL/GRANT/RLS를 재실행하지 않는다.
오류·잘못된 키·미완료 intent·미확인 복원 계정 상태는 BLOCKED/FAILED로 남기고 원인을 검토한다.
journal/데이터 삭제·구 hash/버전 복원·새 fence OPEN으로 문제를 숨기지 않는다.

## 전체 인스턴스/VM/디스크 복원의 수동 보류

같은 snapshot으로 서비스 marker와 control이 함께 돌아가면 서로 맞아 보일 수 있다.
현재 코드는 이 사건을 자동 탐지하거나 최신성을 외부와 대조하지 못한다.
그 복원/유실 사고에서는 **이 절차로 서비스를 재개하지 않는다**.
복원 작업자가 boot/서비스 시작 전에 기존 외부 접근제어/관리 경로에서 ingress·자동 기동을
차단하는 별도 사고 계획을 먼저 검토해야 한다. snapshot 안의 approval 파일만 믿지 않는다.
전체 복원 후 내부 값이 일치하거나 검사에 PASS가 나와도 기동 승인이 아니다.
이력/키/자격 최신성·수집 영향의 별도 검토 없이 begin/replay/verify/open을 재개 절차로 쓰지 않는다.
외부 차단/자동 기동 통제를 보장할 수 없으면 전체 복원 방식의 서비스 재개를 지원하지 않는다.
