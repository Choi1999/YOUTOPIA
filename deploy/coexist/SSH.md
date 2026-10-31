# SSH 준비: 실행 위치를 분리한다

운영 계정/키 생성·등록은 아직 실행하지 않는다. 아래는 검토 후 사용자 승인 단계다.
이미 root@youtopia-main에 접속한 터미널은 그대로 사용한다.

## A. Windows PowerShell

새 전용 키를 PC의 안전한 경로에 만들고 기존 키를 덮어쓰지 않는다.

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\youtopia_codex_deploy" -C "youtopia-codex-deploy"
Get-Content "$env:USERPROFILE\.ssh\youtopia_codex_deploy.pub"
```

정상: 개인키와 .pub 파일이 새로 생긴다. 마지막 명령은 공개키만 표시한다.
기존 파일 충돌·키 생성 실패 시 여기서 중단한다. 개인키는 채팅/로그에 출력하지 않는다.
자동화용 무암호 키를 선택한다면 전용 키로 한정하고 비밀파일 저장/폐기·교체 정책을 둔다.
암호화 키를 사용하면 비대화형 SSH에 안전한 agent 공급이 별도로 필요하다.

## B. 서버 root@youtopia-main

기존 연결에서 먼저 `hostname; id; ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`를
실행한다. 지문을 PC에서 별도 기록한다. 이 기존 신뢰 연결로 아래 공개 호스트키도 확인한다.

```sh
awk -v host="<승인된 서버 Tailscale IPv4>" '{print host " " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

출력은 공개 호스트키의 known_hosts 한 줄이다. SSH scan 결과만으로 신뢰하지 않는다.
실행 승인을 받은 뒤 prepare-host.sh로 계정/경로를 만들고, A의 .pub 한 줄을
/home/youtopia-deploy/.ssh/authorized_keys에 `restrict ` 접두사와 함께 등록한다.
경로 소유자 youtopia-deploy, .ssh0700/authorized_keys0600으로 한다.
비밀번호 로그인은 잠금 상태이며 root 비밀번호를 공유하지 않는다.
`sshd -T -C user=youtopia-deploy,host=youtopia-main,addr=<승인된 tailnet source>`로
공개키 인증·계정 접근 정책을 확인한다. 기존 sshd/방화벽/Tailscale ACL 변경은 별도 검토다.

정상: 정확한 호스트/비특권 계정/키파일 권한, 검증된 호스트키, TCP22 리스너가 확인된다.
계정·경로 충돌·호스트 불일치·공개키 불일치 시 중단한다. youtopia-deploy에는 sudo와
docker 그룹을 주지 않는다. Docker 그룹은 호스트 root 수준의 영향이 있으므로 배제한다.
배포 계정은 incoming 업로드만 하며 root가 검토한 고정 명령으로 승격/서비스 조작한다.

## C. Codex 환경 설정

앱 DB7개 비밀은 현재 전달됐으며 재등록하지 않는다. 별도 SSH 비밀파일 설정에:

| 설정 항목 | 내용 |
|---|---|
| YOUTOPIA_SSH_KEY_FILE | A에서 만든 개인키를 비밀파일로 등록한 런타임 절대경로 |
| YOUTOPIA_SSH_KNOWN_HOSTS_FILE | B에서 독립 검증한 known_hosts 한 줄의 비밀/설정파일 경로 |
| YOUTOPIA_SSH_HOST | 비공개 운영 인계에 기록한 서버 Tailscale IPv4(비밀 아님, 공개 문서에는 제외) |
| YOUTOPIA_SOCAT | 런타임 스킬 ensure-socat.sh가 출력한 실행파일 절대경로(비밀 아님) |

파일 바인딩 기능이 없으면 개인키를 보안 환경변수 YOUTOPIA_SSH_PRIVATE_KEY에 등록하고,
값을 출력하지 않는 로컬 도구로 저장소 밖0700 폴더/0600 파일에 기록한 뒤 KEY_FILE에
그 경로를 지정한다. 변수를 app.env에 복사하거나 키를 Git에 넣지 않는다.
호스트키 파일은 root가 확인한 줄을 등록한다. 불일치 시 StrictHostKeyChecking을 끄지 않는다.

현재 /etc/codex/network-policy.json은 vpn_configured=true지만 TCP grants가 비어 있다.
TCP 목적지 승인된 서버 Tailscale IPv4/32를 환경 설정의 검토 절차로 허용해야 한다. 허용은 현재
런타임 규격상 모든 TCP 포트에 적용되므로 tailnet ACL에서는 배포 접근을22로 제한한다.
TCP grant 변경은 새 구성 버전의 교체 환경이 필요하다. 기존 디스크/작업은 삭제하지 말고
공개 SHA·비공개 인계 경로를 먼저 보존해 새 환경에 첨부한다. 이는 현재 환경 장애를
이유로 재생성을 요구하는 것이 아니라 TCP 정책 변경의 런타임 제한이다.
VPN 설정·grant만으로 연결 정상이라 판단하지 않는다. 이 단계에서 새 구성을 만들거나
기존 환경을 교체하지 않았다.

## D. Codex 작업에서 실행할 명령

환경 상태/정책과 비밀파일 존재·권한만 확인한다(내용 출력 금지).
런타임 스킬의 ensure-socat.sh를 읽고 저장소 밖에 저장·실행해 경로를 얻는다.
현재 환경에 이미 있는 /workspace/.youtopia-env/ensure-socat.sh는 변경하지 않는다.
확인한 maintained socat 또는 스킬의 checksum 고정 installer를 새 경로에서 사용한다.

```sh
bash deploy/coexist/ssh-readonly.sh
```

스크립트는 `ProxyCommand=socat - PROXY:proxy:$YOUTOPIA_SSH_HOST:22,proxyport=8088,resolve=0`
CONNECT 경로를 사용하며 직접 VPN IP 접속/프록시 우회/TLS·호스트키 검증 해제를 하지 않는다.
정상: 호스트 youtopia-main, uid=전용 계정, 읽기 전용 자원·리스너 결과가 나온다.
권한 때문에 Docker/cron 상세를 못 읽으면 root의 선택 필드 관측을 별도로 받아 비교한다.
read-only 확인 때문에 Docker 그룹이나 임의 sudo 권한을 부여하지 않는다.

중단: CONNECT403은 grant/목적지 정책,503은 sidecar/VPN readiness,
timeout은 tailnet ACL/서버 리스너/방화벽을 구분한다. hostkey mismatch는 신뢰 확인 전 중단,
Permission denied(publickey)는 키·계정·sshd 정책을 확인한다. 프록시 자체 접근 차단이면
동일 경로의 승인 실행으로 한 번 확인한다. 운영 설치/재시작은 이 진단에 포함하지 않는다.
