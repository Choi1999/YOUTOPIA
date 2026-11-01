# 기존 호스트에서의 검토·전달·기동 준비

이 문서는 실행 승인 자체가 아니다. 운영 적용 전 아래 변경 대상·영향·복구와
실제 수용 증거를 검토한다. Codex는 운영 명령을 실행하지 않는다.
완료한 계정·키·폴더·unit·Java·nginx 설치, DDL/GRANT/RLS는 다시 실행하지 않는다.

## Windows PowerShell5.1/7: 새 전달 ZIP

`MANUAL-TRANSFER.md`의 독립 ZIP SHA256 검증 후 새 폴더에 해제한다.
기존 해제/검토 폴더는 덮지 않는다. 새 `upload-release.ps1`을 사용한다.
원격 shell source는 native command 인자가 아니라 stdin으로 보낸다.
원격 명령 인자는 고정된 `sh -se`뿐이므로 WinPS5.1의 따옴표 재해석을 피한다.
LF/ASCII와 명시적 `exit 0` 뒤의 pipeline CRLF 처리도 검증한다.
native Windows5.1 실제 SSH 성공은 별도 운영자 확인 전 미검증이다.

```powershell
& (Join-Path $Dest 'upload-release.ps1') `
  -Server (Read-Host '승인한 기존 서버 주소') `
  -ExpectedHost (Read-Host '검증한 서버 short hostname') `
  -KeyFile (Read-Host '기존 개인키 파일 경로') `
  -KnownHostsFile (Read-Host '독립 검증한 기존 known_hosts 경로') `
  -BundleRoot $Dest
```

배포 계정은 sudo/Docker 없이 기존 incoming 아래의 새 `release-SOURCE_SHA`에
archive2개와 checksum만 업로드한다. 동일 이름/부분 전송 폴더도 재사용하지 않는다.
중단된 전송은 보존하고 원인을 확인한 뒤 별도 검토한 새 전송 이름/방법을 사용한다.

## 기존 root 터미널: 상태 조회부터

```sh
umask 077
bash inspect-host.sh APPROVED_SHORT_HOST EXISTING_POSTGRES_CONTAINER
stat /opt/youtopia-app/releases/PREVIOUS_SOURCE_SHA  # 미존재도 그대로 기록
readlink /opt/youtopia-app/current || true
systemctl is-enabled nginx.service || true
systemctl is-active nginx.service || true
systemctl is-active youtopia-app.service || true
```

현재 알려진 준비 상태와 실제 조회를 분리한다. 예전 전달본 업로드 성공이 앱 staging
완료를 뜻하지 않는다. Redis/앱은 아직 시작하지 않았다는 상태를 실제 조회 전 유지한다.
full nginx config·환경·DB 암호·개인키를 출력하지 않는다. 호스트/기존 DB를 잘못 지정하면 중단한다.

## archive와 서버 내부 검증: 승인한 새 검토 경로만

아래 SHA·해시는 새 전달 metadata 및 별도 신뢰 경로에서 가져온다. 운영 비밀은 없다.
`set -C`는 기존 검토 파일 덮어쓰기를 막는다. archive를 root 경로로 복사한 뒤 해시를
대조하므로 배포 계정이 나중에 incoming 파일을 바꿔도 검토 사본이 바뀌지 않는다.

```sh
set -eu
set -C
source_sha=SOURCE_SHA
release_hash=INDEPENDENT_RELEASE_ARCHIVE_SHA256
tools_hash=INDEPENDENT_TOOLS_ARCHIVE_SHA256
incoming=/home/youtopia-deploy/incoming/release-$source_sha
review=/root/youtopia-review-$source_sha
test ! -e "$review" && test ! -L "$review"
mkdir -m 700 "$review"
install -m 600 "$incoming/release-$source_sha.tar.gz" "$review/release.tar.gz"
install -m 600 "$incoming/operator-tools-$source_sha.tar.gz" "$review/tools.tar.gz"
printf '%s  %s\n' "$release_hash" "$review/release.tar.gz" "$tools_hash" "$review/tools.tar.gz" | sha256sum --check --strict
# 전체 archive 해시를 먼저 확인한 후 알려진 단일 공개 도구만 읽는다.
tar -xOf "$review/tools.tar.gz" "operator-tools-$source_sha/unpack-tools.py" > "$review/unpack-tools.py"
python3 "$review/unpack-tools.py" "$review/tools.tar.gz" "$tools_hash" "$source_sha" "$review/tools"
```

`unpack-tools.py`는 링크/경로탈출/중복·초과 멤버를 거부하고 tools manifest를 대조한다.
새 디렉터리만 만들며 기존 도구/서비스/계정을 변경하지 않는다.

staging이 승인되고 새 SHA가 없는 경우에만 다음으로 앱 파일을 준비한다:

```sh
python3 "$review/tools/stage-release.py" "$review/release.tar.gz" "$release_hash" "$source_sha"
```

이 단계는 current 전환·서비스·DB를 바꾸지 않는다. 이미 있으면 manifest/hash/소유권을
읽어 대조하며 덮어쓰지 않는다. 소유권 이상은 별도 수정안 없이 자동 chown하지 않는다.

## Java/nginx 보안 갱신: 목록 갱신·모의·실제 변경 분리

과거 캐시나 명령 안내만으로 update/upgrade가 실행됐다고 쓰지 않는다.
먼저 전체 설치 버전/source 버전·apt cache 시각·설치 changelog와 공식 USN을 읽는다.
목록 갱신은 패키지 설치와 다른 쓰기 동작이다. 실행 결과가 없으면 아직 미확인이다.

```sh
# 조회/모의만. 이 도구는 apt-get update를 실행하지 않는다.
python3 "$review/tools/plan-host-updates.py" > "$review/packages-before-refresh.json"
# 이후 별도 승인한 목록 갱신 단계(서비스 패키지 업그레이드 아님):
apt-get update
# 일부 저장소 실패도 로그와 날짜를 보고 후보가 최신인지 검토한다.
python3 "$review/tools/plan-host-updates.py" > "$review/packages-after-refresh.json"
```

계획은 openjdk-21-jre-headless/nginx/nginx-common의 실제 installed/candidate 전체
버전을 고정하고 `apt-get --simulate --no-remove --only-upgrade install name=version...`을
실행한다. 제거 또는 Docker/containerd/runc/PostgreSQL/libpq/Tailscale/수집기 변경이
있으면 거부한다. 다른 의존 패키지 변화·maintainer script·needrestart 영향도 사람이 검토한다.
실제 실행 명령은 JSON에 **미승인 변경안**으로만 남긴다. full-upgrade/무조건 autoremove는 없다.
후보 실행안의 `NEEDRESTART_MODE=l`은 needrestart를 목록 출력 모드로 한정해
기존 Docker/DB/수집기의 자동 재시작을 피한다. 이 값은 해당 명령에만 적용한다.
패키지 자체 maintainer script의 start/restart까지 차단하는 옵션은 아니므로 그 동작과
현재 nginx mask/inactive 상태도 별도로 대조한 뒤 정확한 transaction을 승인한다.

검토 전 `apt-get -s` 결과만 편집해 실행하지 않는다. 기존 nginx mask/inactive,
Java 실제 binary/다른 Java 프로세스, 수집 기준선·디스크 여유를 기록한다.
후보가 확정되기 전 정확한 업그레이드 버전·rollback 가능성을 만들지 않는다.
이전 버전의 검증한 패키지/의존성을 확보하지 못하면 apt downgrade 복구를 보장할 수 없다.
문제 시 새 앱/ingress를 보류하고 검토한 forward fix를 준비한다. 기존 DB/수집기는 건드리지 않는다.

## 공인 IP TLS 변경안: 별도 승인 후 실행할 root 단계

`IP-HTTPS.md`의 조건·기존 listener/default vhost를 먼저 검토한다.
다음은 새 경로인 경우의 준비안이다. 존재하는 경로/설정은 삭제·재초기화하지 않고 대조한다.

```sh
python3 "$review/tools/render-ip-https.py" APPROVED_PUBLIC_IPV4 "$review/tls-proposal"
```

대상은 `/etc/nginx/sites-available/youtopia-ip.conf`와 선택한 단일 enable symlink,
`/var/lib/youtopia-acme`, `/etc/youtopia-acme`, `/etc/letsencrypt`,
`/var/lib/youtopia-acme-client`, `/var/log/youtopia-acme`, 신규 갱신 service/timer다.
공인80 challenge용 nginx start/unmask는 서비스 상태 변경이며 별도 승인한다.
기존 site가 있으면 기본 site 제거/전체 nginx 중단 계획을 그대로 실행하지 않는다.

```sh
# 아래 mkdir/install/start/issue는 실행 승인이 끝난 후에만 해당 단계별로 수행한다.
# 모든 새 대상의 미존재/소유권/기존 사이트 대조 후, 필요한 새 ACME 경로만 생성한다.
python3 - <<'PY'
import os
paths=['/etc/youtopia-acme','/etc/letsencrypt','/var/lib/youtopia-acme-client',
       '/var/log/youtopia-acme','/var/lib/youtopia-acme',
       '/etc/nginx/sites-available/youtopia-ip.conf','/etc/nginx/sites-enabled/youtopia-ip.conf',
       '/etc/systemd/system/youtopia-acme-renew.service','/etc/systemd/system/youtopia-acme-renew.timer']
if any(os.path.lexists(path) for path in paths):
    raise SystemExit('Existing ACME/config paths: preserve them and review a specific diff; no initialization')
PY
install -d -m 700 /etc/youtopia-acme /etc/letsencrypt /var/lib/youtopia-acme-client /var/log/youtopia-acme
install -d -m 700 /etc/youtopia-acme/staging /etc/youtopia-acme/staging/config /etc/youtopia-acme/staging/work /etc/youtopia-acme/staging/logs
install -d -m 755 /var/lib/youtopia-acme
install -m 600 "$review/tls-proposal/public-ip" /etc/youtopia-acme/public-ip
install -m 600 "$review/tools/certbot-image.txt" /etc/youtopia-acme/certbot-image.txt
install -m 600 "$review/tools/certbot-ip.sh" /etc/youtopia-acme/certbot-ip.sh
# nginx vhost는 기존 파일이 없거나 사본/원복안이 검토된 경우에만 설치한다.
install -m 644 "$review/tls-proposal/01-challenge-only.conf" /etc/nginx/sites-available/youtopia-ip.conf
ln -s /etc/nginx/sites-available/youtopia-ip.conf /etc/nginx/sites-enabled/youtopia-ip.conf
nginx -t
# 신규 challenge 전용 사이트만 검토된 경우:
systemctl unmask nginx.service
systemctl start nginx.service
docker --host=unix:///var/run/docker.sock pull "$(cat /etc/youtopia-acme/certbot-image.txt)"
bash /etc/youtopia-acme/certbot-ip.sh staging
# staging 성공·실제 외부80 접근·연락처/약관 검토 후:
bash /etc/youtopia-acme/certbot-ip.sh issue
install -m 644 "$review/tools/youtopia-acme-renew.service" /etc/systemd/system/youtopia-acme-renew.service
install -m 644 "$review/tools/youtopia-acme-renew.timer" /etc/systemd/system/youtopia-acme-renew.timer
systemctl daemon-reload
systemctl enable --now youtopia-acme-renew.timer
systemctl list-timers youtopia-acme-renew.timer
bash /etc/youtopia-acme/certbot-ip.sh check
```

staging 재시도/동일 lineage 재발급도 자동 덮어쓰지 않는다. 기존 설정과 실패 원인을 먼저 확인한다.
전체 기동 수용 후에만 challenge vhost의 사본을 남기고 최종 HTTPS 제안과 대조·교체한다.
기동 전에는 최종 HTTPS가 가리키는 current/실제앱 검증을 완료한다.

## Redis·앱 기동 조건과 복구

Redis 폴더·ACL·conf·mount·포트·digest가 현재 승인안과 같은지 먼저 확인한다.
실제 Redis 암호는 `make-redis-acl.py`의 숨긴 stdin/보호 파일 입력 경로로 공급하고
로그/CLI arg/history에 쓰지 않는다. 현재 Redis가 없음을 확인한 후 별도 승인한 경우만:

```sh
docker --host=unix:///var/run/docker.sock compose -f "$review/tools/compose.yaml" config --quiet
docker --host=unix:///var/run/docker.sock compose -f "$review/tools/compose.yaml" up -d redis
```

이 명령도 운영 변경이며 아직 실행하지 않는다. 인증/negative ACL·AOF·메모리·실제 역할
연결·공존 부하를 확인해야 한다. 전용 배포 계정에 Docker 권한을 주지 않는다.
비어 있지 않은 Redis 데이터를 삭제/다운그레이드해 문제를 해결하지 않는다.

회원/관리자 기동은 독립 authoritative control/최신 journal·key와 초기 BLOCKED→
replay→독립 verify→open 근거가 없으면 보류한다. control=false/직접 OPEN은 대안이 아니다.
현재 무료 기존 자원으로 확보한 범위와 미충족 조건을 CONTROL.md에서 확인한다.
초기 관리자 생성도 ADMIN.md의 구체적 절차 확인 후 별도 실행한다.

모든 수용 근거와 실제 기동 승인이 끝나야 기존 approval marker와 activate-release를
검토할 수 있다. 이 문서/receipt 구조 검사로 marker를 자동 만들지 않는다.
current 전환 후 앱 오류 시 새 ingress를 차단하고 이전 SHA/config/control 호환성부터
확인한다. 첫 배포라면 앱을 정지 상태로 보존한다. 구 비밀번호/auth_version을 복구하거나
DB/DDL/GRANT/RLS를 역적용하지 않는다. VM 복원에는 별도 최신 control이 필요하다.

| 변경 | 영향 | 검토한 복구 범위 |
|---|---|---|
| 새 upload/검토/staging | 새 immutable 파일만 | 기존 릴리스 보존, current 미전환 |
| Java/nginx exact upgrade | 바이너리·의존 패키지·maintainer script | 검증한 이전 deb가 있을 때만 검토, 없으면 forward fix/기동 보류 |
| challenge/TLS·갱신 timer | 신규80/443 vhost·키·nginx start/reload | 새 timer 정지, 이전 config/유효 cert·mask 상태를 검토해 복구 |
| Redis | 새 loopback 세션 저장소 | ingress/앱 보류, AOF 보존·유실 범위 검토, down -v/prune 금지 |
| 관리자 생성/복구 | 승인한 단일 계정·감사·세션 폐기 | 구 hash/버전 복원 금지, 실패는 같은 request UUID로 재처리 |
| 앱 current 전환 | 신규 웹앱만 | 이전 검증 release/config/control을 대조 후 명시적으로 복구 |
