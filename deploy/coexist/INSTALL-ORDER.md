# 호스트 준비와 nginx 설치 순서 검수

이 문서의 운영 명령은 실행 승인 전 실행하지 않는다. 계정/키/패키지/서비스/방화벽/DB는
현재 변경하지 않았다. 스크립트의 `--approved`는 이미 검토된 운영 실행을 위한 수동 인자다.

## 기존 절차의 문제와 수정

기존 prepare-host.sh는 `java docker nginx` 설치를 요구하면서80/443의 빈 포트도 요구했다.
Ubuntu 패키지 maintainer script나 서비스 정책에 의해 nginx가 설치 중 자동 기동하면
정상 설치 직후에도 포트 충돌로 중단될 수 있었다. 특정 서버에서 자동 기동됐다는 관측은 아니다.
충돌 검사를 빼거나 nginx를 자동 중지하는 방식으로 해결하지 않는다.

수정한 prepare-host.sh는 앱 계정·새 경로·unit 파일 준비만 한다. Java/Docker/nginx는
이 단계에 필요하지 않고, 기존 youtopia-deploy도 변경하지 않는다. 파일은 스크립트 위치에서
찾으므로 실행 cwd에 의존하지 않는다. 선행 조건은 아래와 같다.

| 준비 단계 | 필요 조건 | 변경 범위 |
|---|---|---|
| SSH 계정/키 | 기존 root 연결, core 도구, 공개키 검증용 Python3/OpenSSH | 전용 계정/홈/공개키만; prepare-host와 독립 |
| prepare-host.sh | root, youtopia-main, getent/useradd/install/ss/awk/grep, 검토한 source3개, 기존 DB 경로 확인 | 새 youtopia-app·앱/Redis 경로·unit·journal namespace 설정 |
| 런타임 점검 | Java21, 기존 Docker/Compose, logrotate 등 버전/가용성 | 기존 Docker 재설치/재시작을 기본으로 하지 않음 |
| nginx staged 설치 | 정확한 nginx/nginx-common 버전과 apt transaction 검토, 기존 nginx/정책/포트 없음 | 신규 패키지·영속 mask·일시적 자동기동 차단 정책 |
| nginx 활성화 | 도메인/인증서/렌더 설정/자원 제한/logrotate/앱/control 검증 및 별도 기동 승인 | 이때만 새 nginx mask 해제·서비스 기동 |

## 서버 root 터미널 — 승인 후 수행 순서

1. 기존 DB 컨테이너의 선택 필드·데이터 경로/마운트·cron hash와 최근 수집 상태를 기록한다.
   Docker 전체 inspect/env dump는 비밀을 포함할 수 있어 사용하지 않는다.
   `bash check-ports.sh`는80/443/8080/6379 충돌을 확인한다. `ss` 자체 실패도 중단한다.
2. `bash prepare-host.sh --approved`. 기존 DB/cron/Docker 저장소는 변경하지 않는다.
   기존 SSH 계정의 존재는 충돌로 취급하지 않는다. 이미 앱 준비를 했다면 재실행 대신
   새 파일·계정·권한을 대조한다. 스크립트는 idempotent 자동수정 도구가 아니다.
3. `java -version`, `docker version`, `docker compose version`, logrotate 존재를 확인한다.
   Java21 등이 없을 때만 설치할 패키지/transaction과 서비스 부작용을 별도 검토한다.
   기존 Docker는 보존한다. 운영 서버에서 앱 빌드·전체 테스트는 실행하지 않는다.
4. nginx 신규 설치 전에 읽기 전용 후보를 확인한다.

   ```sh
   apt-cache policy nginx nginx-common
   apt-get --simulate --no-install-recommends install 'nginx=<검토한 버전>' 'nginx-common=<동일한 검토 버전>'
   ```

   실제 버전으로 치환한다. 기존 패키지 업그레이드/제거/서비스 restart가 transaction에
   포함되면 중단하고 별도 검토한다. 자동기동 차단은 패키지 부작용 전체를 없애지 않는다.
   기존 `/usr/sbin/policy-rc.d`, `/etc/nginx`, nginx package 잔여 상태나
   `/etc/systemd/system/nginx.service`가 있으면 제공 설치 도구는 **덮어쓰지 않고 중단**한다.
   기존 정책의 내용을 확인하지 않고 삭제·교체하거나 기존 nginx를 중지하지 않는다.
5. 정확한 설치 transaction을 승인한 뒤에만:

   ```sh
   bash install-nginx-staged.sh --approved '<검토한 패키지 버전>'
   ```

   스크립트는 새 `/etc/systemd/system/nginx.service -> /dev/null` mask를 남겨 재부팅 시에도
   미검토 기동을 막는다. apt 실행 중에만 새 policy-rc.d(exit101)를 만들고, 종료 시 자신이
   만든 동일 inode의 파일만 제거한다. 이미 있는 정책은 수정하지 않는다. 이는 새 nginx
   설치 단계에 한정한 임시 start/restart 차단이며 기존 서비스를 정지/재시작하지 않는다.
   기본 사이트 symlink는 패키지가 만들 수 있지만 mask와 정책 때문에 공개 리스너를 열지 않는다.
   `bash check-ports.sh` 재검사와 mask 확인이 성공 기준이다. 포트가 열려 있으면 자동 중지 없이
   중단하고 설치 로그·프로세스 소유자를 확인한다.
6. 도메인 확정·별도 기동 승인 후, 기존 사이트/기본 사이트의 처리와 신규 nginx 설정 diff를
   먼저 검토한다. 임의 기본 사이트 삭제·덮어쓰기는 하지 않는다. 승인된 렌더 설정,
   systemd drop-in과 logrotate를 설치하고 `nginx -t`/unit 검증을 수행한다.
   mask가 **이 절차가 만든 신규 nginx mask**임을 확인한 뒤에만 별도 승인한
   `systemctl unmask nginx.service`, `systemctl daemon-reload`, `systemctl start nginx.service`
   순서로 활성화한다. 부팅 자동실행 enable도 이 활성화 변경안에 명시적으로 포함한다.
   설치 단계에서 미리 unmask/start하지 않는다. 방화벽·DNS·인증서 작업도 별도 승인 범위다.

## 실패/롤백

- SSH 계정/키 준비 실패: 해당 단계에서 중단, 기존 root 연결은 유지. 계정·authorized_keys를
  지우거나 기존 키를 덮어쓰지 않는다. 앱 설치는 아직 진행하지 않는다.
- prepare-host 부분 실패: 신규 생성 항목을 대조해 수동 후속안을 검토. 기존 DB/수집 변경 없음.
- nginx apt 실패: 자신이 만든 임시 policy만 정리하고 **mask는 유지**한다. 패키지가 부분 설치됐을
  수 있으므로 재실행/자동 purge/apt repair를 하지 말고 dpkg 상태와 transaction 로그를 확인한다.
  SIGKILL/전원 중단은 trap이 실행되지 않을 수 있다. 남은 임시 policy가 이 도구가 만든 것인지
  root가 확인한 뒤에만 정리하며 기존 서버 정책으로 추정해 임의 삭제하지 않는다.
- 기존 policy/사이트 발견: 기존 상태를 보존하고 별도 계획으로 중단. 자동 설치가 거절됐다는
  이유로 정책·포트 보호를 없애지 않는다.

## 검증 범위

`verify-static.py`는 shell 문법과 포트·CONNECT 회귀, 릴리스 안전성 검사를 실행한다.
`verify-host-prep.sh`는 **일회용 Ubuntu24.04 컨테이너 안에서만** 실행한다.
실제 패키지 설치(자동기동 차단), 합성 SSH 키·계정의 실제 로그인, 기존 DB/cron fixture
지문 보존, nginx 기동 시 충돌 감지를 확인한다. 운영 서버·기존 DB 검증을 대신하지 않는다.

Codex의 격리 빌드 환경에서 재현하는 명령(운영 서버에서 실행하지 않음):

```sh
review_root=$(git rev-parse --show-toplevel)
env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
  docker --host=unix:///var/run/docker.sock run --rm --hostname youtopia-main \
  --cpus=2 --memory=2g --pids-limit=512 \
  --mount "type=bind,src=$review_root,dst=/review,readonly" \
  --mount type=bind,src=/etc/ssl/certs/ca-certificates.crt,dst=/run/review-public-ca.pem,readonly \
  -e YOUTOPIA_DISPOSABLE_HOST_REVIEW=1 \
  ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852 \
  bash /review/deploy/coexist/verify-host-prep.sh
```

현재 런타임의 Docker proxy 기본 설정·CA를 유지하며 privileged/host network/호스트 Docker
socket·운영 데이터·비밀을 컨테이너에 마운트하지 않는다. 합성 SSH 개인키는 해당 일회용
컨테이너 안에서만 생성·사용되고 컨테이너와 함께 제거된다.
