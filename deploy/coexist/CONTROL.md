# control 복구 게이트와 독립성

현재 AccountConfiguration은 accounts=true인데 control=false면 기동을 거부한다.
ControlConfiguration은 별도 최대3연결의 Hikari pool을 만들며 운영 역할은
RuntimeDataSourceGuard에 의해 ytp_control_app/서비스 DB와 다른 DB로 제한된다.
이는 endpoint의 물리적 독립성·최신성까지 증명하지 않는다.
RestoreFenceFilter는 journal 장애/불일치/미검증 시503을 반환한다. 이 필터나
accounts/control 조건을 제거해 서비스 개시를 우회하지 않는다.

## 복원 종류별 허용 조건

| 경우 | 같은 VM의 별도 control로 가능한 범위 | 부족한 조건 |
|---|---|---|
| 서비스 DB만 복원 | control DB/볼륨/백업이 서비스 복원 대상에서 완전히 제외되고 최신 journal이 살아 있으면 대조 가능 | DB명만 다른 것은 증거 아님. 실제 복원 명령·마운트·백업 범위를 검증해야 함 |
| VM/디스크 전체 복원·유실 | 같은 VM 안에서는 최신 journal 보존 독립성 없음 | 외부의 최신 journal/fence·키 식별 근거가 필요. 같은 시점의 marker+journal이 함께 과거로 돌아가면 현재 코드만으로 감지 보장 불가 |

따라서 같은 서버 control 후보는 서비스 DB 단독 복원 범위에서만 검토 가능하다.
VM 전체 복원도 다루려면 최소 외부 독립 PostgreSQL endpoint와 동기 내구성이 필요하다.
기존 별도 신뢰 호스트가 있으면 그곳에 전용 DB/최소권한 역할을 쓰는 안을 먼저 비교한다.
추가 유료 VM/구독/관리형 DB는 이번 범위에서 생성하지 않는다. 별도 기존 PC/서버도
상시 가동·독립 복원·동기 영속화·접근제어·TLS·journal/key 복구가 확인돼야 자원으로
셈한다. 확정되지 않은 개인 PC, 절전/일시중지/삭제될 수 있는 무료 DB를 확보된
authoritative control로 쓰지 않는다. 추가 비용 없이 충족할 자원이 없으면 회원 기동을 보류한다.

비동기 dump/일일 외부 백업만으로는 최신 journal 무손실을 보장할 수 없다.
현재 코드는 동기 외부 archive 확인이나 외부 watermark 대조를 구현하지 않았으므로,
단순 백업 업로드를 추가해 VM 전체 복원이 해결됐다고 표시하지 않는다.
직접 외부 control을 authoritative endpoint로 사용하는 최소안을 우선 검토한다.
운영망 밖 장애 시503을 허용하는 대신 journal 없이 계정 변경을 성공시키지 않는다.

## 계정과 비밀 분리

웹: ytp_control_app(조회/필요 append만), 서비스 DB7역할은 기존 완료 설정 유지.
복원: 별도 ytp_restore_manager(control fence/restore_run 관리)와 서비스 복원 대상용
관리 계정. 관리자 DDL/GRANT·초기화 스크립트는 기존 비공개 자료에서 별도 검토한다.
앱 app.env에 manager/owner/개발계정 비밀을 넣지 않는다. 초기 fence는 BLOCKED로
enroll하고 즉시 OPEN으로 직접 UPDATE하지 않는다. 기존 정책을 임의 승인하지 않는다.

운영자 전용 환경파일(root0600, 앱이 읽지 못하는 /root/또는 별도 운영 저장소):

| 변수 | 의미 |
|---|---|
| YOUTOPIA_RESTORE_JDBC_URL / _DB_USER / _DB_PASSWORD / _EXPECTED_DB | 정확한 서비스 복원 대상, expected=youtopia |
| YOUTOPIA_CONTROL_MANAGER_JDBC_URL / _DB_USER / _DB_PASSWORD / _EXPECTED_DB | 독립 control 관리용 실제 DB명·별도 역할 |
| YOUTOPIA_CONTROL_HMAC_KEY / YOUTOPIA_CONTROL_SERVICE_KEY | 보존한 journal key와 youtopia 서비스 식별자 |

HMAC 키는 base64 최소32bytes이며 계정 키와 분리한다. journal 최신 데이터와 함께
키의 안전한 외부 복구 수단도 필요하다. 값/길이/hash를 채팅·로그로 출력하지 않는다.

## 복원 순서 (현재 운영 실행 금지)

1. root/운영자: 외부 ingress 차단, 신규 Spring 정지. 수집/DB 단독 복원의 영향 범위를
   점검하고 기존 수집의 변경 필요 여부를 별도로 승인받는다. 이 스크립트는 cron을 바꾸지 않는다.
2. 복원 관리자: 최신 authoritative control에 `begin <opaque-backup-ref>` 실행.
   반환 run UUID·최신 journal sequence·fence generation·키 일치를 비공개 원장에 보존.
   최초 enroll도 BLOCKED일 뿐 서비스 허용이 아니다.
3. 대상 백업 hash·복원 범위 대조 후 서비스 DB만 승인된 DBA 절차로 복원.
   control이나 최신 journal을 함께 되돌리지 않는다. VM 전체 복원이라면 먼저
   외부 최신 control·키를 확보한다. 확보 불가/최신성 불명은 중단한다.
4. `replay <run UUID>`: 삭제 요청 deadline/auth_version을 재적용하고 PURGED 대상 삭제,
   세션 버전 증가·관리자 세션 제거·구 복구코드 폐기를 수행한다. 미완료 intent가 있거나
   ACCOUNT_RECOVERED의 최신 자격증명 상태를 입증할 수 없으면 BLOCKED/FAILED 유지.
5. 독립 검토자가 사용자 상태·삭제 재적용·정확한 deadline·journal watermark·현재
   credential 상태를 대조한 뒤 `verify <run UUID> --credential-state-reviewed`.
   이 옵션은 검증을 실제 수행했다는 운영자 확인이며 단순 성공용 플래그가 아니다.
6. `open <run UUID>`는 VERIFIED/generation/sequence 일치와 pending 없음일 때만 가능.
   이후 제한된 서비스 검증 후 ingress를 연다. 재시작/롤백만으로 fence를 열지 않는다.

실행 가능한 별도 CLI는 이미 JAR에 있다. 승인 후 격리된 운영자 환경에서:

```sh
java -Dloader.main=com.youtopia.restore.RestoreCommand -cp /opt/youtopia-app/current/app.jar \
  org.springframework.boot.loader.launch.PropertiesLauncher begin APPROVED_BACKUP_REF
```

같은 명령 끝을 replay/verify/open으로 바꾼다. RestoreCommand는 expected DB 이름과
실제 연결 DB를 비교하고 별도 manager 권한을 확인한다. 비밀파일을 셸 source하거나
앱 env와 합치지 말고 운영자 전용 프로세스 환경으로 공급한다.
실제 복원 SQL·journal dump는 Git에 포함하지 않는다.

control 서버의 자원·journal 증가량·백업/가용성과 복원 CLI 예산은 실제 호스트에서 별도 검토한다.
LEGAL_REVIEW 신규 탈퇴·최종 파기는 계속 비활성이다. 정책이 미정인 보관기간/산식/
외부 journal 폐기시점은 임의 결정하지 않는다.

## 회원 기동의 최소 조건과 현재 코드의 한계

accounts=true에는 control=true가 필요하다. 별도 제한 역할/비서비스 DB와
운영 TLS verify-full·CA, 서버가 보존한 journal HMAC 키가 필요하다.
매 요청마다 fence=OPEN, pending intent 없음, 키 fingerprint·generation 일치,
서비스 marker sequence가 최신 committed journal 이상인지 검사한다.
최초 등록은 BLOCKED이며 검토한 begin/replay/독립 verify/open을 거쳐야 한다.
신규 탈퇴/파기 기능이 off라고 이 조건이 사라지지 않는다. 반대로 회원 로그인만을 위해
미정인8개 보관 정책을 임의 APPROVED로 바꾸는 절차도 요구하지 않는다.

방지하려는 것은 오래된 서비스 DB/세션 복원으로 삭제·파기한 계정/구 자격/복구코드가
되살아나거나, 검증 전 복원된 앱이 서비스를 재개하는 위험이다. 독립 최신 journal로
변경을 재적용하고 세션/복구코드를 폐기한 뒤에만 연다. 일상적인 password change 전체의
최신 credential hash를 외부 journal에 보관하는 기능은 없으며 복원 후 credential 확인도 필요하다.

단일 VM 안의 별도 control DB/볼륨은 **서비스 DB만** 복원할 때 복원 범위에서 빠져 있으면
보호할 수 있다. VM/디스크 전체 snapshot에서 marker/control/키까지 함께 과거로 되돌면
서로 일치해 보일 수 있어 현재 코드의 비교만으로 탐지할 수 없다. URL을 Tailscale/public IP로
바꾸는 것으로 독립성이 생기지 않는다. 외부 최신성 watermark/archive 확인은 현재 미구현이다.

추가 구매 없는 선택지는 검증할 기존 상시 호스트를 확정하거나 회원 기동을 보류하는 것이다.
공개 관측만의 별도 단계가 필요하면 그 범위·설정·수용을 별도 결정한다. 현재 승인 범위에서
control 검사를 삭제하거나 accounts=true/control=false로 기동하는 변경은 하지 않는다.
