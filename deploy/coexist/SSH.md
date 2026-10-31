# SSH 경로 진단과 Codex 설정

운영 계정·공개키 등록부터 읽기 전용 접속까지는 별도 [SSH-BOOTSTRAP.md](SSH-BOOTSTRAP.md)의
A(Windows PowerShell) → B(기존 서버 root 터미널) → A(전용 계정 확인) → C/D(Codex) 순서다.
이 절차는 Java/Docker/nginx 설치 및 prepare-host.sh와 독립이다. 운영 작업은 아직 실행하지 않는다.

## 정책 스냅샷과 실제 연결을 구분한다

`/etc/codex/network-policy.json`의 빈 `domains`/`ip_ranges` 배열만으로 접속 불가,
허용 목록 추가 필요, 재게시·환경 교체 필요를 판정하지 않는다. `automatic_tailscale_access`
같은 런타임 설정과 실제 실행 경로도 확인한다. `vpn_configured=true`나 환경 상태의
connected 역시 목적지 TCP22 연결 성공을 보장하지 않는다.

먼저 환경 상태와 현재 정책을 기록하고 승인된 목적지에 제한 시간 있는 CONNECT를 측정한다.
`probe-ssh-connect.py`는 proxy:8088에 HTTP CONNECT만 전송하며 SSH 인증·원격 명령을
실행하지 않는다. 목적지 값과 raw 응답 본문·비밀은 출력하지 않는다.

```sh
python3 deploy/coexist/probe-ssh-connect.py
```

`YOUTOPIA_SSH_HOST`는 비공개 운영 인계의 승인된 Tailscale IPv4다.
일반 실행이 로컬 socket PermissionError 등으로 막히면 동일 프록시 경로의 승인 실행으로
구분한다. 목적지 정책에 의해 명시적으로 거부된 경우 우회하지 않는다.
현재 스냅샷만 보고 환경을 재게시하거나 기존 디스크를 변경하지 않는다.

| 관측 | 판정 가능한 범위와 다음 확인 |
|---|---|
| proxy 연결 전 PermissionError/접속 거절/DNS 오류 | 실행 제한·proxy 도달성 단계. 원격 SSH 인증/호스트키 오류로 해석하지 않음 |
| CONNECT HTTP200 | TCP 터널 성립. SSH 호스트 신뢰·계정 인증·명령 성공은 별도 검증 |
| CONNECT HTTP403 | 프록시가 요청을 거부함. 요청 형식·목적지·실제 거부 사유를 확인. 빈 배열 때문이라고 단정하지 않음 |
| CONNECT HTTP503 | 프록시가503을 응답한 사실만 확인됨. VPN readiness·정책 상태·원격 경로/리스너 등 어느 원인인지 실측 없이 단정하지 않음 |
| CONNECT timeout/응답 불완전 | 실행 경로·proxy·목적지 도달성을 분리해 조사. 방화벽/ACL/sshd 중 하나로 단정하지 않음 |
| SSH host key verification failed/changed | SSH 서버 식별 검증 단계. 기존 신뢰 root 연결과 지문 대조 전 중단 |
| SSH Permission denied(publickey) | SSH 인증 단계. 전용 계정·공개키·키파일 권한·sshd Match/PAM 정책 확인 |
| SSH 인증 후 원격 명령 nonzero | 원격 검사 권한·명령 실패를 확인. CONNECT/인증 실패와 구별 |

503은 상태코드만으로 원인을 확정할 수 없다. 프록시의 구체적 error code와 같은 시각의
운영자 관측이 추가되면 그 근거 범위에서 진단한다. 원시 오류를 공유할 때에도 비밀·내부
식별자를 가린다. 명시적 정책 거부가 확인된 경우에만 지원 설정 절차로 필요한 변경과
적용 조건을 검토하며, 새 환경이나 재게시를 미리 요구하지 않는다.

## Codex 비밀 설정과 실행 위치

| 설정 항목 | 등록 내용 |
|---|---|
| YOUTOPIA_SSH_KEY_FILE | Windows에서 만든 전용 개인키의 **비밀파일 바인딩 절대경로** |
| YOUTOPIA_SSH_KNOWN_HOSTS_FILE | 기존 신뢰 root 연결에서 검증한 공개 호스트키 한 줄의 파일 경로 |
| YOUTOPIA_SSH_HOST | 비공개 인계의 서버 Tailscale IPv4. 공개 Git에 실제 주소를 넣지 않음 |
| YOUTOPIA_SOCAT | 런타임 스킬 installer/기존 maintained socat의 실행파일 절대경로 |

개인키는 비밀파일 업로드 UI로만 전달하고 채팅/셸 출력/Git에 붙이지 않는다. 파일 바인딩이
없으면 비밀 설정 항목 `YOUTOPIA_SSH_PRIVATE_KEY`로 공급하고, 값 출력 없이 저장소 밖0700
디렉터리/0600 파일에 기록한 후 KEY_FILE에 경로를 지정한다. 이것은 앱 app.env와 별개다.
기존 앱 DB7개 바인딩을 SSH 설정 때문에 변경하거나 재등록하지 않는다.
암호화 키를 쓰면 비대화형 SSH에 안전한 agent 공급이 별도로 필요하다.

Codex 작업에서 환경 상태·정책·파일 존재/권한만 확인한 뒤 런타임 스킬의 maintained socat를
준비한다. 기존 /workspace/.youtopia-env 경로는 변경하지 않는다. CONNECT200 뒤에만:

```sh
bash deploy/coexist/ssh-readonly.sh
```

이 도구는 `ProxyCommand=socat - PROXY:proxy:$YOUTOPIA_SSH_HOST:22,proxyport=8088,resolve=0`
경로를 사용한다. 직접 VPN IP 접속/프록시 우회/호스트키 검증 해제는 하지 않는다.
정상: 검증된 호스트키, youtopia-deploy 계정과 youtopia-main 호스트 확인, 읽기 전용 관측.
cron/DB 경로를 전용 계정이 읽지 못하는 경우 별도 NOT_READABLE 표식으로 남긴다.
관측 권한을 늘리기 위해 sudo/docker 그룹을 주지 않는다. Docker 그룹은 root 수준 영향을 갖는다.
