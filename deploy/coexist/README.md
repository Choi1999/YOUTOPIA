# youtopia-main 공존 배치 검토안 — 2026-10-31 KST

목표 개시일은 2026-11-03 KST. 이 디렉터리는 검토·격리 검증용이다.
운영 계정/키/설치/기동/배포/DB/방화벽 변경은 아직 승인되지 않았다.
도메인 구매·인증서 발급·유료 자원 신청도 하지 않는다. GPU는 범위 밖이다.

## 보존·복구 관측

현재 환경의 pwd=/workspace, 상태 connected/running. 최초 도구 실패는 시작 중인
executor 부재였고 ready 이후 명령은 실행됐다. 일반 경로의 Git 프록시/Docker 소켓
접근은 차단됐지만 동일 런타임 프록시와 로컬 소켓의 승인 실행은 성공했다.
원격 feat/backend-bootstrap의 기준은 1ff756b1b30b8fd206936864913ec2fa0d0860ac.
기존 소스에는 덮어쓰지 않고 별도 clone에서 작업했다. 초기 실패한 Gradle 검증1회는
기존 activate.sh의 GRADLE_USER_HOME을 사용해 기존 도구 캐시/daemon 기록을 생성했다.
이후 검증은 새 checkout의 .gradle-runtime으로 분리했으며 기존 캐시는 삭제·정리하지 않았다.
첨부 4개 ZIP은 저장소 밖 비공개 경로에 풀고 파일별 비교를 기록했다.
첨부 source 비교 464항목 중 동일386/상이78이며, 과거 버전 간 중복을 포함한다.
상이한 소스를 원격 위에 복사하지 않았다. 과거 미커밋 변경은 회수되지 않았으므로
전체 보존·복원 완료를 주장하지 않는다. 기존 비공개 257건 추적표는 Git 밖에 유지한다.

누락/미검증: 장애 직전 미커밋 파일·진행 로그, SSH 키와 검증된 호스트키,
control endpoint/최신 journal 외부 보존·관리 계정, Redis/HMAC 운영 비밀,
검증된 비밀번호 차단 파일, 도메인, 수집별 역할/실행시간/최근 성공 및 동시 피크.
DB7계정 실제 로그인·110/107·104a는 사용자 제공 완료 근거로 취급하며 재실행하지 않는다.
관리자 SQL/기존 관리자 비밀은 앱 산출물에 포함하지 않는다.

## 생성·변경 범위와 자원

| 대상 | 제안 | 상한/포트/경로 |
|---|---|---|
| Spring | 전용 youtopia-app, 로그인 불가, Docker/sudo 없음 | CPU150%, MemoryMax3GiB, heap2GiB; 127.0.0.1:8080 |
| 배포 | youtopia-deploy, 키 로그인만, Docker/sudo 없음 | 업로드는 ~/incoming; root 운영자가 hash 확인 후 승격 |
| 릴리스 | root 소유 불변 파일, 앱/정적서버 읽기만 | /opt/youtopia-app/releases/<40자리 SHA>, current symlink |
| Redis | 신규 Compose 프로젝트 youtopia-app-cache, UID999 | CPU0.5, RAM1GiB/swap0, maxmemory512MiB; 127.0.0.1:6379 |
| Redis 데이터 | 기존 postgres 경로와 별도 | /srv/youtopia-data/redis; 설치 전 realpath/마운트 대조 |
| 프록시 | nginx 호스트 서비스, React 정적파일 + /api | CPU0.25, RAM256MiB 후보, 80/443; 도메인 확정 전 미활성 |
| 앱 설정 | root:youtopia-app 0640, 폴더0750 | /etc/youtopia-app/app.env, password-blocklist.sha256 |
| Redis ACL | root:999 0440 | /etc/youtopia-app/redis-users.acl; 값 대신 SHA256 verifier |
| control 후보 | 별도 PostgreSQL 프로세스/컨테이너, 초기화 SQL은 비공개 검토 | CPU0.25, RAM512MiB 후보, loopback15433, 별도 /srv/youtopia-data/control 후보 |

기존 4.25GiB 예산에 control512MiB를 더하면 4.75GiB, CPU 합계2.5개다.
이는 OS·Docker·기존 DB·수집·페이지캐시·AOF fork 순간 비용을 제외한 상한 합계다.
control 앱 연결풀3개는 Spring3GiB에 포함되며 복원 CLI 실행 시 별도256MiB를
예약한다(복원 중 웹 중지, 합성 검증으로 산정 보완 필요). 기존 DB 제한0은 유지한다.
사용자 제공 메모리·CPU 여유 관측은 수집 피크·실제 웹부하 검증을 대체하지 않는다.
Redis512MiB 여유는 AOF 버퍼/클라이언트/allocator/COW용이며 fork 때 1GiB를
넘을 수 있으므로 RSS/OOM/rewrite를 실제 부하로 확인한다. 상한은 보장이 아니다.

기존 VM/디스크만 사용하는 이 안의 신규 구독·관리형 Redis 요금은 0원 기준이다.
디스크/트래픽/백업 사용량은 기존 요금 약관 내인지 운영자가 확인한다.
VM 복원 독립성을 위한 외부 control은 별도 선택·견적이 필요하다. 자동 생성하지 않는다.

기존 youtopia-postgres의 127.0.0.1:5432, 인증·네트워크·마운트
/srv/youtopia-data/postgres, memory_limit_bytes=0, /var/lib/docker를 바꾸지 않는다.
/etc/cron.d/youtopia-collector와 Asia/Seoul 스케줄도 보존한다. Compose는 신규 Redis
프로젝트만 대상으로 한다. 기존 컨테이너 재생성/prune/볼륨 삭제/chown은 금지한다.
호스트 Spring은 호스트 127.0.0.1:5432로 접근한다. Redis 컨테이너 내부 localhost는
DB 호스트가 아니다. 운영 확인은 앱의 실제 역할로 SELECT1·current_user/current_database
읽기 전용 연결만 수행하며 test fixture/DDL/GRANT는 실행하지 않는다.

## 작업 순서·성공·중단 기준

1. 사용자: 아래 SSH 준비를 검토한다. 실행 승인 후 root가 읽기 전용 기준선
   (컨테이너 inspect의 포트/마운트/자원, cron hash, 디스크 realpath, ss, 최근 수집 성공)을
   비공개 기록한다. Docker 전체 inspect는 비밀 env를 노출하므로 필요한 필드만 선택한다.
2. Codex: 격리 check/bootJar·frontend test/build·실브라우저·Redis 배치 검증 결과와
   공개 diff를 제출한다. 공개 브랜치만 commit/push한다. 빌드·테스트는 운영에서 하지 않는다.
3. 사용자/root: 승인 이후 Ubuntu 패키지 버전/추가디스크 필요 여부를 확인하고
   Java21, Docker Compose v2, nginx, logrotate를 검토한 버전으로 설치한다.
   패키지 설치의 nginx 자동기동/기본80번 사이트 생성 효과도 먼저 확인하고 승인 범위에 넣는다.
   이 준비 스크립트는 apt 설치·자동기동 정책 변경을 실행하지 않는다.
   `prepare-host.sh --approved`는 충돌 시 중단하고 새 계정·경로·unit만 만든다.
   파일들은 deploy/coexist를 현재 디렉터리로 실행한다. 부분 실패 시 재실행하지 말고
   생성된 항목을 대조한다. 기존 항목을 자동 삭제하거나 소유권을 덮지 않는다.
4. 비밀 app.env/ACL/blocklist를 root가 설치한다. `make-redis-acl.py`는 stdin으로
   비밀을 받아 verifier만 출력한다. 비밀을 명령 인자/채팅/셸 history에 넣지 않는다.
   `umask 077; python3 make-redis-acl.py < /root/redis-password-input > /root/redis-users.acl`
   입력은 root 비밀파일로 미리 안전하게 준비한다. 출력도 사전대입 공격이 가능한 비밀자료다.
   새 ACL을 root:999/0440으로 복사하며 입력 임시파일은 운영 비밀 보관정책에 따라 처리한다.
5. root: 신규 Redis에만 `docker compose -f compose.yaml config --quiet`, 이어서 승인 후
   `up -d redis`. 기존 DB/수집은 대상으로 넣지 않는다. 사용자 인증 PING, 다른 prefix
   거부, CONFIG 거부, 만료 이벤트를 점검한다. NOAUTH health만으로 앱 정상 판정하지 않는다.
6. control 독립성·fence 검증 완료 전 계정 기능 활성화/RELEASE_APPROVED 생성 금지.
   `systemd-analyze verify youtopia-app.service`, 렌더 후 `nginx -t` 통과가 필수다.
   nginx 전체 제한은 기존 사이트가 없음을 확인한 뒤만 적용한다.
   journald-youtopia.conf는 새 namespace에만 영속64MiB/runtime16MiB/7일 상한을 둔다.
   `journalctl --namespace=youtopia -u youtopia-app`으로 조회하며 기존 journal 정책은 유지한다.
   nginx 전용 error log는 제공한 logrotate(max10MiB/3개)로 제한한다.
   Spring 요청 본문/SQL 비밀 디버깅은 금지한다.
7. Codex 빌드 환경: 승인된 커밋에서 check/build 완료 후 `python3 package-release.py`.
   업로드는 전용 계정 incoming으로 한다. root가 별도 전달한 SHA256·source SHA로
   `python3 stage-release.py ARCHIVE SHA256 SOURCE_SHA`를 실행한다.
   경로 탈출/심링크/해시 불일치는 중단한다. source snapshot과 산출물 hash도 기록한다.
8. 도메인 결정 뒤 DNS A/AAAA·도달성·인증서 경로를 확인하고 nginx 템플릿을 렌더한다.
   임의 인증서 발급은 하지 않는다. 비밀변수 검토와 control 검증 후 root가 승인 기록을
   RELEASE_APPROVED에 두고 `systemctl daemon-reload`, 승인된 전환 스크립트를 실행한다.
   외부 ingress를 열기 전 검증을 완료한다. 앱이 예외로 죽으면 보호 장치를 끄지 않는다.
9. HTTPS에서 로그인·로그아웃·새로고침·다중탭, SPA 직접경로, Secure/HttpOnly/SameSite,
   CSRF token+쿠키 전송/누락403, 미로그인401, Redis/control 중단 시 차단을 확인한다.
   프록시는 외부의 X-Forwarded-*를 신뢰하지 않고 덮어쓴다. API 캐시 금지, Vite 미공개.

서비스 개시 성공 기준: 기존 DB/cron/마운트 지문 불변, 기존 수집 최근 성공,
인증·권한·CSRF·세션·복원 게이트 통과, OOM/restart loop 없음, 응답·오류율과 자원
기준을 운영자가 부하 전 합의하고 통과해야 한다. HTTP 200 하나로 개시하지 않는다.
중단 기준: 대상 불일치/포트·계정·경로 충돌, 비밀 누락, hostkey 차이, ACL 오류,
control freshness 불명, 기존 수집 실패/DB 지연 악화, swap/OOM/디스크 부족, 테스트 실패.

## Redis 운영 조건

이미지: public.ecr.aws/docker/library/redis:7.2.13-alpine,
sha256:9907ac0c435717b4d95697cb4d0ce77d100b1d21269a01a0ce66f27335184c38.
Redis7.2 소스는 [BSD-3-Clause](https://github.com/redis/redis/blob/7.2.13/COPYING): 저작권·조건·면책 고지 보존, 이름을 보증에 사용하지 않는다.
이미지에는 Alpine 등 별도 구성요소 라이선스도 있으므로 배포 시 notices/SBOM을 보관한다.
Redis 신규 버전의 다른 라이선스로 무심코 이동하지 않는다. 유료 지원/Cloud/관리형 미신청.

default 사용자 off, 앱은 youtopia:* 키/만료 채널, Lua·세션 명령만 사용하며
CONFIG/ACL/FLUSH/외부키는 금지한다. 로컬 호스트 계정은 여전히 비밀 보호 대상이다.
maxmemory512MiB, noeviction: 기존 세션/제한 키를 임의 퇴출하지 않고 신규 쓰기는 실패한다.
AOF everysec는 장애 시 약1초 이상 상황에 따른 유실 가능성이 있으며 백업이 아니다.
Restart는 세션·제한을 보존해야 한다. 완전 Redis 유실 시 limiter 이력도 유실되므로
자동 빈 Redis로 트래픽 재개하지 않는다. ingress 차단 후 auth_version/관리자 활성세션·
레이트 제한 쿨다운을 별도 승인된 복구 절차로 검증하고 재개한다. 운영 DB에서 자동 SQL 금지.
Redis 장애/OOM 때 요청·인증 제한 예외를 삼키거나 무제한 경로로 우회하지 않는다.
Egx 만료/삭제 알림, indexed repository configure-action=none과 일치시킨다.
합성 Redis 테스트는 maxmemory만4MiB로 낮춰 OOM을 재현하고 나머지 배치 설정을 사용한다.
`verify-redis.py --with-app`은 같은 ACL로 합성 DB+실제 JAR 세션을 검증한다.
최종 운영 HTTPS 검증은 별도로 필요하다.

## rollback

먼저 신규 ingress 차단, 신규 Spring만 중지하고 기존 수집/DB는 유지한다.
이전 SHA와 current realpath를 기록해두고 이전 릴리스로 동일 activate 절차를 실행한다.
코드 rollback은 DB 복원이 아니며 schema/GRANT/RLS를 되돌리지 않는다. 첫 배포 실패면
신규 앱을 정지 상태로 유지한다. Redis 데이터/볼륨/계정은 실패 증거 보존 후 별도 승인으로
정리하며 `compose down -v`·prune·기존 DB 재생성은 하지 않는다. 장애 원인이 journal이면
이전 코드로 돌아가더라도 fence를 열지 않는다. 복원 시 아래 control 절차가 선행한다.

## 수집 피크와 최종 개시 판단

일요일 2026-11-01(매일00:10/00:15 포함), 월요일 11-02(00:45 및 월요일 매시05분),
화요일 11-03 개시 전을 KST 기준 후보 관측 창으로 둔다. 실제 cron 역할·실행시간·성공을
먼저 확인하며 예약/파일은 바꾸지 않는다. 1분 단위 CPU/RSS/MemAvailable/디스크 I/O,
Postgres 연결·lock·쿼리 지연, Redis used_memory/RSS/rewrite/evicted_keys/OOM,
웹 p50/p95/p99·5xx·로그인/제한 동작을 수집한다. 사용자 승인 후 제한된 읽기 중심
실부하를 수집 실행 전/중/후에 단계적으로 겹친다. 합성 쓰기 부하는 격리 서버에서만 한다.
현재 CPU그래프 집계 간격/MAX 여부 미확인이므로 용량 보장으로 사용하지 않는다.
피크를 관측하지 못하거나 사전 합의 SLO를 넘으면 자원 상한을 임의 제거하지 않고
개시 여부·범위를 다시 판단한다. 개시일을 맞추기 위해 control/정책 게이트를 끄지 않는다.

## 검증 재현

```sh
python3 deploy/coexist/verify-static.py
python3 deploy/coexist/verify-redis.py --with-app
python3 tools/test_services.py verify --with-browser
```

앞의 Redis+앱 검증은 bootJar가 이미 빌드되어 있어야 하며 다른 test_services 실행과
동시에 실행하지 않는다. Docker는 현재 격리 환경의 로컬 소켓만 사용한다.
Java 네트워크 작업에는 관리 런타임의 프록시·CA JVM 옵션도 공급해야 한다.
브라우저 프로젝트는 각기 고유 namespace로 앱을 재기동해 분당120 기본 제한을 그대로
유지하면서 다른 프로젝트 요청이 예산을 소진하지 않게 한다. 개별 프로젝트 JSON은
build/reports/packaged-sessions/browser-*.json에 보존한다. 이는 운영 부하 검증이 아니다.
