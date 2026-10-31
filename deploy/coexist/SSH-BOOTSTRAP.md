# 전용 SSH 계정·공개키 등록 → 읽기 전용 확인

현재는 문서·도구 검토 단계다. **아래 운영 계정/키 등록은 실행 승인을 받은 뒤에만 수행한다.**
기존 root@youtopia-main 터미널은 유지한다. SSH 설정을 위해 Java/nginx/Docker를 설치하거나
prepare-host.sh를 먼저 실행할 필요가 없다. 기존 DB·수집·sshd·방화벽은 변경하지 않는다.
키 파일/known_hosts는 Git 밖에서 관리한다. 개인키·root/DB 비밀번호를 채팅에 넣지 않는다.

## A1. Windows PowerShell — 새 전용 키와 호스트키 확인 파일 준비

```powershell
$sshDir = Join-Path $env:USERPROFILE '.ssh'
$keyPath = Join-Path $sshDir 'youtopia_codex_deploy'
$knownHostsPath = Join-Path $sshDir 'youtopia_codex_known_hosts'
New-Item -ItemType Directory -Force -Path $sshDir | Out-Null
if ((Test-Path $keyPath) -or (Test-Path "$keyPath.pub")) { throw '키가 이미 있음: 덮어쓰지 말고 중단' }
ssh-keygen -t ed25519 -f $keyPath -C 'youtopia-codex-deploy'
if ($LASTEXITCODE -ne 0) { throw '키 생성 실패' }
Get-Content "$keyPath.pub"
```

마지막 출력은 공개키뿐이다. B2에는 이 `.pub` 한 줄만 전달한다. 개인키는 출력하지 않는다.
자동화용 무암호 키를 선택한다면 전용 비밀 보관·폐기 정책을 적용한다. 암호화 키의 경우
Windows에서는 agent를 사용할 수 있지만 Codex의 BatchMode 인증에도 안전한 agent 공급이
필요하다. 암호를 채팅에 요구하거나 비밀번호 인증으로 대신하지 않는다.

정상: 새 개인키와 .pub 생성. 충돌/생성 실패 시 A1에서 중단한다.

## B1. 운영 서버의 **기존 root 터미널** — 대상과 호스트키를 먼저 확인

```sh
hostname -s
id -un
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

정상: 호스트 youtopia-main, 사용자 root. 다르면 중단한다.
`<승인된 서버 Tailscale IPv4>`는 비공개 인계의 실제 값으로 바꾼다.

```sh
awk -v host='<승인된 서버 Tailscale IPv4>' '{print host " " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

공개 호스트키 한 줄과 지문을 이 신뢰된 연결로 확보한다. A의 `$knownHostsPath`에 그 한 줄을
저장하고 지문을 대조한다. 기존 파일이 있다면 덮어쓰지 말고 먼저 내용/지문을 확인한다.
`ssh-keyscan` 결과만 신뢰하거나 StrictHostKeyChecking을 끄지 않는다.

## B2. 운영 서버 root 터미널 — 승인 후 전용 계정 및 공개키만 등록

검토한 스크립트를 root 소유 준비 폴더에 전달하고 파일 hash를 대조한다. 위치를 예컨대
`/root/youtopia-coexist-review`로 정했다면, 해당 폴더에서 다음을 실행한다.

```sh
bash prepare-ssh-account.sh --approved
```

새 youtopia-deploy 계정·잠긴 비밀번호·홈0750·.ssh/incoming0700만 생성한다.
기존 계정/그룹/홈이 있으면 덮어쓰지 않고 중단한다. sudo/docker 그룹은 부여하지 않는다.
부분 실패 후 무작정 재실행하지 말고 생성된 항목부터 대조한다.

A1의 **공개키 한 줄만** root 임시파일에 넣는다. 아래 placeholder를 실제 .pub로 바꾼다.

```sh
umask 077
# 새 파일 경로를 사용한다. 기존 파일이 있으면 먼저 중단한다.
if test -e /root/youtopia-deploy-public.pub || test -L /root/youtopia-deploy-public.pub; then
  printf 'STOP: 공개키 준비 파일이 이미 있음. 덮어쓰지 말고 확인하세요.\n'
else
  (set -C; cat > /root/youtopia-deploy-public.pub <<'PUBLIC_KEY'
<ssh-ed25519로 시작하는 .pub 한 줄>
PUBLIC_KEY
  ) && bash register-deploy-key.sh --approved /root/youtopia-deploy-public.pub
fi
id youtopia-deploy
stat -c '%U:%G %a %n' /home/youtopia-deploy /home/youtopia-deploy/.ssh /home/youtopia-deploy/.ssh/authorized_keys
```

등록 도구는 ed25519 공개키 한 줄만 수용하고 개인키·잘못된 입력·기존 authorized_keys는
거부한다. 저장은 `restrict ssh-ed25519 ...`, 소유자 youtopia-deploy, mode0600이다.
`restrict`는 forwarding/PTY 등을 막지만 검토한 비특권 읽기 명령은 허용한다.
등록은 sshd 재시작이 필요 없다. 기존 설정/서비스를 변경하지 않는다.

유효한 접근 정책은 root가 다음 읽기 명령으로 확인한다.

```sh
ss -ltn '( sport = :22 )'
/usr/sbin/sshd -T -C 'user=youtopia-deploy,host=youtopia-main,addr=<실제 접속 원본 tailnet IPv4>'
```

`pubkeyauthentication`, `authorizedkeysfile`, AllowUsers/Groups·Match·PAM/계정 제한을 확인한다.
PC와 Codex의 접속 원본은 다를 수 있다. 정책이 막으면 중단하고 별도 변경안을 검토한다.
잠긴 비밀번호/UsePAM 조합으로 키 접속이 거부되어도 비밀번호를 설정·공유해 우회하지 않는다.

## A2. Windows PowerShell — 전용 계정으로 읽기 전용 로그인 확인

A1 변수와 검증한 `$knownHostsPath`를 사용한다.

```powershell
$serverIp = '<승인된 서버 Tailscale IPv4>'
ssh -T -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHostsPath" -i $keyPath "youtopia-deploy@$serverIp" 'id -un; hostname -s'
if ($LASTEXITCODE -ne 0) { throw '전용 계정 SSH 확인 실패: 여기서 중단' }
```

정상: youtopia-deploy / youtopia-main. 기존 root 연결을 닫거나 다시 연결할 필요가 없다.
호스트키 오류와 publickey 인증 오류는 [SSH.md](SSH.md)의 표대로 구분한다.
인증 실패 시 root 터미널에서 해당 시각 sshd 관측과 파일 권한을 확인하며, 비밀은 출력하지 않는다.

## C. Codex 환경 설정 — 서버 계정/앱 변수와 분리

A1 개인키는 전용 **비밀파일 설정**에 업로드해 `YOUTOPIA_SSH_KEY_FILE`로 경로를 바인딩한다.
B1에서 검증한 known_hosts 파일은 `YOUTOPIA_SSH_KNOWN_HOSTS_FILE`, 실제 주소는
`YOUTOPIA_SSH_HOST`, maintained socat 경로는 `YOUTOPIA_SOCAT`로 지정한다.
필요하면 개인키를0600 로컬 파일로 복사해 사용하되 Git 밖0700 디렉터리에만 둔다.
앱 app.env나 기존 DB7개 비밀을 이 SSH 설정과 섞지 않는다. 상세 설정 계약은 SSH.md 참조.

## D. Codex 작업 — CONNECT와 SSH 인증을 차례로 확인

```sh
python3 deploy/coexist/probe-ssh-connect.py
# 위 결과가 HTTP200인 경우에만 다음 단계
bash deploy/coexist/ssh-readonly.sh
```

빈 TCP 목록이나 HTTP503만으로 환경 재게시를 요구하지 않는다. CONNECT 실패 원인을 먼저
구분한다. HTTP200이어도 hostkey/계정 인증은 아직 별도다. SSH 성공 뒤 기본 계정·호스트와
읽기 전용 자원 관측을 확인하며, cron/DB 경로 권한 부족은 추가 권한 부여 없이 별도 기록한다.
운영 설치·서비스 시작·배포·방화벽·DB 변경은 이 절차에 포함하지 않는다.
