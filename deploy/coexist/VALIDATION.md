# 2026-10-31 격리 검증 결과

운영 서버/DB를 대상으로 실행하지 않았다. 외부 API를 호출하는 운영 검증도 아니다.

| 검증 | 결과 |
|---|---|
| Frontend Vitest | 24파일/214건 통과, SessionProvider 경합 회귀4건 포함 |
| Frontend TypeScript/Vite build | 통과, 정적 dist 생성 |
| Java unit/MVC | 87건 통과, 실패/skip0 |
| Java DB/Redis integration | 77건 통과, 실패/skip0; 합성 PostgreSQL16/Redis |
| 격리 fixture Python | 10건 통과 |
| 릴리스 보안 Python | 3건 통과: 정상/덮어쓰기 거부, archive/manifest hash, 심링크·하드링크·경로탈출 거부 |
| 실제 JAR + 배치 Redis ACL | 로그인/CSRF/Secure cookie/인스턴스2개 공유/앱 재시작/로그아웃 전파 통과 |
| 실제 Redis 중단 | 공개 예산 제한과 인증이 성공으로 우회되지 않음 |
| 배치 Redis 설정 | 인증/외부 prefix·CONFIG·FLUSH 거부, Lua 예산, 만료 이벤트, AOF 재시작, noeviction OOM 통과 |
| Chromium | 실제 합성 서비스7건 + dark/light desktop/mobile4건 =11건 통과 |
| 정적 배치 검증 | application.yml 변수명 전체 포함, LEGAL_REVIEW off, 메모리 여유/loopback/DB mount 비포함 통과 |
| systemd/Compose | systemd-analyze verify, docker compose config --quiet 통과 |
| 공개 후보 비밀 검사 | 바인딩된 DB/HMAC/개인키 비밀값 비포함 확인, 비공개 폴더 제외 |

Redis 테스트의 maxmemory만4MiB로 줄여 OOM을 재현했다(배치 설정512MiB/컨테이너1GiB).
대형 SET 거부 직후 작은 INCR가 들어갈 여유가 있을 수 있어, 남은 메모리를 채운 뒤
Lua 쓰기도 OOM으로 거부됨을 확인한다. 1GiB 실제 피크 부하를 검증했다는 뜻은 아니다.

브라우저 첫 전체 실행은 마지막 프로젝트에서 공유 분당120 예산을 소진했다.
프로젝트마다 앱을 별도 세션/limiter namespace로 재기동해 수정했으며 기본120 제한은
유지한다. 최종 프로젝트별 JSON을 별도로 보존했다. 단순 timeout 증가나 재시도로 숨기지 않았다.

백엔드 첫 다운로드 실패는 Java 프록시/CA 명시 후 해결했다. 첫 브라우저 실행의
Chromium 누락은 설치 후 해결했다. Redis 채널 ACL은 현재 Spring Session4.0.5의
실제 `youtopia:sessions:event:0:created:*`, keyevent0 del/expired를 대조해 검증했다.

미실행: 운영 SSH/설치/기동/배포, 운영 도메인·nginx -t·실제 HTTPS 종단,
호스트 DB loopback의 실제 앱 실행 연결, 기존 수집과 웹 동시 피크, 운영 control
독립성·최신 journal 전체복원, Redis 운영 유실·AOF rewrite 부하와 모니터링 수용.
이 항목을 위 합성 테스트 성공으로 대신하지 않는다. 11월3일 개시 확정 판정도 아니다.

## 배포 전 절차 검수 — 같은 날 추가 실행

기준 커밋192df9e는 보존하고 후속 변경으로 검수했다. 이번 범위는 SSH/호스트 준비 절차이며,
위 Java/프런트/브라우저 전체 테스트를 이번 문서 수정 때문에 다시 실행한 것으로 표시하지 않는다.

- `verify-static.py`: 10개 Python 테스트 통과. 기존 릴리스 보안3개 + CONNECT/포트7개.
  HTTP200은 인증 성공이 아님,403/503 원인 미확정,로컬 권한 오류 분리,응답 불완전·timeout,
  잘못된 주소 거부,예약 포트 충돌 및 ss 실패 시 중단을 검증했다. 모든 shell 문법도 통과했다.
- `verify-host-prep.sh`: 고정 Ubuntu24.04 이미지의 일회용 rootfs에서 통과했다.
  nginx/nginx-common **1.24.0-2ubuntu7.19** 실제 패키지 설치 로그에
  `invoke-rc.d: policy-rc.d denied execution of start.`가 기록됐고 영속 mask 유지·예약 포트
  비공개·임시 policy 제거를 확인했다. apt 실패를 주입한 경우에도 임시 policy만 정리하고
  mask는 유지되는 것을 추가 검증했다. 이 버전을 운영 설치 승인 버전으로 정한 것은 아니다.
- 같은 컨테이너에서 nginx를 직접 기동하자80번 충돌을 실제 검출했다. 검사 도구가 nginx를
  중지하지 않았음을 확인한 뒤 테스트가 생성한 프로세스만 정리했다.
- 합성 ed25519 키로 실제 SSH 로그인 통과(신뢰한 합성 hostkey, BatchMode, restrict 키).
  개인키 입력·중복 계정·중복 authorized_keys·기존 policy 덮어쓰기는 거부됐다.
- Java/Docker/nginx가 없고 전용 SSH 계정이 이미 있는 상태에서 prepare-host가 성공했다.
  cwd를 바꿔도 source 파일을 찾았고 기존 합성 DB/cron hash·DB 경로 권한·SSH 키는 불변이었다.
- 컨테이너는 host network/privileged/호스트 Docker socket/운영 비밀 없이 실행했다.
  소유 라벨·종료코드0·정지 상태를 확인하고 해당 컨테이너만 제거했다.

실제 목적지 CONNECT는 일반 경로에서 PermissionError, 동일 승인 경로에서 HTTP503이었다.
이는 SSH 인증·호스트키 확인 성공이나 VPN/정책/원격 리스너 원인 확정이 아니다. 빈 TCP
배열만으로 차단·재게시 필요를 판정하지 않았다. 실제 서버 SSH 명령은 실행하지 않았다.

운영 계정/키 등록·설치·기동/재시작·배포·방화벽·DB 변경은 미실행이다. Windows PowerShell
절차는 작성·검수했으며 Windows에서 실행했다고 주장하지 않는다. 컨테이너는 Ubuntu 패키지와
sshd 동작을 검증한 것으로 운영 VM의 systemd 부팅/재부팅·기존 sshd Match 정책을 대체하지 않는다.
