# 이미 준비한 호스트에서 재개

운영 작업은 별도로 검토·승인한 범위에서만 실행한다. 전달 ZIP 생성/업로드/
합성 테스트는 운영 기동 승인이 아니다. 추가 유료 자원·구독·도메인을 자동 구매하지 않는다.

## 현재 상태를 먼저 읽는다

기존 신뢰 root 터미널에서 승인한 short hostname과 기존 DB 컨테이너 이름을
명시한다. 조회만 수행하며 실제 비밀/전체 env/전체 nginx 설정은 출력하지 않는다.

```sh
bash inspect-host.sh APPROVED_SHORT_HOST EXISTING_POSTGRES_CONTAINER
```

결과는 root 전용 비공개 기록에 보관한다. 거부/실패/누락은 미확인으로 남긴다.
apt 후보는 캐시 시점도 확인한다. 목록 갱신·실제 upgrade·서비스 restart는
이 조회에 포함하지 않으며 별도의 정확한 변경안으로 검토한다.

| 이미 준비된 항목 | 재개 동작 |
|---|---|
| 전용 배포 계정·키·검증 hostkey | 재사용. 재생성/재등록/권한 확장하지 않음 |
| 앱 계정·폴더·unit | 소유권·내용 대조. prepare-host를 다시 실행하지 않음 |
| Java21·nginx | 전체 패키지/백포트·기동 상태를 조회. 신규 설치 스크립트 반복 없음 |
| 릴리스 디렉터리 | 새 source SHA와 manifest/hash 대조. 기존 SHA 덮어쓰기 없음 |
| Redis 폴더·프로젝트 | 존재/내용/포트/선택 digest 확인. 비어 있다고 가정하거나 초기화하지 않음 |
| DB·수집·Tailscale | 포트/인증/마운트/자원/cron/접속 경로와 최근 수집 성공 보존 |

이미 존재하는 계정·파일·서비스를 오류 해소 목적으로 삭제하거나 재생성하지 않는다.
전용 배포 계정에는 sudo/Docker 그룹을 추가하지 않는다. 전체 Docker inspect 대신
선택 필드만 읽어 env 비밀이 노출되지 않게 한다.

## 전달물의 소스/빌드 기준

독립적으로 제공받은 ZIP SHA256부터 확인한다. `delivery.json`의 `source_sha`가
이번 배포 코드 기준이고 `artifact_build_source_sha`는 실제 앱 JAR·정적 파일의
빌드 기준이다. 다를 때는 manifest의 build input fingerprint·파일 해시와 재검증
근거를 확인한다. 예전 JAR와 byte 동일하다는 이유로 새 커밋 빌드라고 쓰지 않는다.

업로드된 파일은 root 소유의 **새** 검토 경로에 보관하고 독립 해시를 다시 확인한다.
도구 archive는 예상 `operator-tools-<source SHA>` 아래의 일반 파일/디렉터리만
안전하게 해제한다. 링크/경로탈출/중복 멤버를 허용하지 않는다. 기존 검토 폴더는 덮지 않는다.

`stage-release.py`와 같은 폴더의 `release_provenance.py`가 모두 필요하다.
새 릴리스 디렉터리가 없고 staging을 승인한 경우에만:

```sh
python3 stage-release.py APPROVED_ARCHIVE INDEPENDENT_SHA256 SOURCE_SHA
```

staging은 root 소유 불변 파일만 준비하며 current 전환·서비스·DB를 바꾸지 않는다.
동일 source SHA가 이미 있으면 재실행하지 말고 기존 manifest와 파일 hash를 읽어 대조한다.
새 stager는 릴리스 디렉터리 본체까지 root 소유로 만든다. 기존 릴리스의 소유권도 조회하되
자동 chown/재staging하지 않는다. 기대 소유권이 다르면 별도 수정안을 검토하고 기동을 보류한다.

## 비밀과 기동 게이트

실제 비밀은 Git/ZIP/명령 인자/history/채팅에 넣지 않는다. root0600 입력 JSON을
안전한 editor/비밀 보관 경로로 작성한 뒤 오프라인 구조 검사를 사용할 수 있다.

```sh
python3 prepare-runtime-config.py ROOT_ONLY_INPUT.json NEW_OUTPUT.env
```

입력 이름은 `app-input.example.json`을 따른다. 출력은 새0600 파일이며 기존 파일을
덮지 않는다. env를 source/eval하지 않는다. 이 도구는 설정 구조만 검사하며 운영
접속·실제 자격·control 독립성·fence/최신 journal·blocklist 승인을 증명하지 않는다.
출력의 설치/변경도 별도 운영 승인 범위다. 현재 설정이 이미 있다면 먼저 값 출력 없이 대조한다.

회원 기동은 accounts/control을 함께 검토하고 독립 authoritative control·별도 앱/복원
관리자 권한·최신 journal/key 외부 복구·초기 BLOCKED 및 replay/독립 verify/open 근거를 요구한다.
같은 VM의 별도 DB/폴더, control=false, 직접OPEN 또는 필터 제거로 우회하지 않는다.
추가 비용 없이 필요한 독립성을 입증할 수 없으면 회원 기동을 보류한다.
개발/owner/manager 자격을 app.env에 복사하지 않는다. LEGAL_REVIEW 기능은 off를 유지한다.

실제 Domain/TLS chain·키/갱신, Redis 인증/ACL·영속화·유실 복구·메모리,
실제 앱 역할 loopback/control TLS, 기존 수집과 웹 동시 피크도 수용해야 한다.
`acceptance.example.json` / `ingress-acceptance.example.json`은 비밀 없는 증거 참조 틀이다.
정확한 source/hash·보안 검수와 실제 근거를 채운 후 구조만 확인할 수 있다:

```sh
python3 validate-acceptance.py ROOT_ONLY_RECEIPT.json prestart SOURCE_SHA RELEASE_SHA256
```

이 도구는 RELEASE_APPROVED를 만들거나 서비스를 변경하지 않는다. 검토 참조를 적는 것만으로
실제 검증이 되지 않는다. 모든 게이트와 별도 기동 승인 전 current 전환·서비스 시작을 하지 않는다.

## 향후 승인된 기동과 복구 범위

기존 `activate-release.sh --approved SOURCE_SHA`는 승인 marker가 있어야 동작하고,
current 변경 후 앱 restart 실패 시 자동 rollback하지 않는다. 실행 전에 이전 realpath/SHA,
설정 호환성·control 최신성·ingress 차단·복구 기준을 비공개로 기록한다.
새 전용 nginx만 쓰는지 확인하고 TLS/SPA/API/CSRF/cookie와 기존 수집 기준선을 대조한다.
기존 사이트가 있다면 nginx 전체 제한/정지 계획을 그대로 적용하지 않는다.

첫 배포 실패는 새 ingress/앱을 정지 상태로 보존한다. 이전 릴리스가 있으면 검증된 이전
SHA와 설정/control을 확인한 뒤 명시적으로 복구한다. Redis 문제가 생겨도 취약 이미지로
자동 downgrade하거나 데이터를 삭제하지 않는다. 빈 Redis로 자동 재개하지 않는다.
코드 rollback은 DB 복원이 아니다. DDL/GRANT/RLS를 역적용하거나 fence를 열지 않는다.
실제 DB 복원은 별도 승인한 [CONTROL.md](CONTROL.md)의 절차를 따른다.
prune/down -v/기존 DB 재생성/cron·Tailscale 변경/무조건 apt purge·autoremove는 하지 않는다.
