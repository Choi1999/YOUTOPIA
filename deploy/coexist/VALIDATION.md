# 격리 회귀 검증과 증거

운영 서버/DB/Redis·실제 비밀을 사용하지 않는다. Java21, Python3 표준 라이브러리,
로컬 Docker와 프런트 도구 조건은 [docs/testing.md](../../docs/testing.md)를 따른다.
관리 환경에서는 승인된 proxy/CA를 유지하며 운영 DB/PG/YOUTOPIA 바인딩을 자식
환경에서 제거한다. fixture는 현재 Compose와 같은 pinned Redis 이미지를 사용한다.

```sh
(cd frontend && pnpm install --frozen-lockfile && pnpm build && pnpm test)
python3 deploy/coexist/verify-static.py
python3 tools/test_services.py verify --with-browser
python3 deploy/coexist/verify-redis.py --with-app
python3 deploy/coexist/verify-redis-memory.py
```

Windows 전송 도구의 파서·mock 경계는 별도 PowerShell 프로세스에서
`pwsh -NoProfile -File deploy/coexist/test_upload_release.ps1`로 확인한다.
실제 SSH/SCP·키를 사용하지 않으며 Windows native 전송 성공을 대신하지 않는다.
stdin의 LF/인용부호/치환과 Windows형 CRLF trailer는 로컬 POSIX shell에서도 확인한다.

`test_prestart_tools.py`는 새 IP 설정 생성/기존 경로 보존, 정확한 package candidate
파싱·보호 인프라 변경 거부, 도구 archive 검증, 갱신 시 인증서/활성 nginx/nginx -t
조건과 reload 실패 경계를 확인한다. 실제 ACME/운영 TLS/운영 갱신 성공은 별도다.
관리자 recovery는 integration에서 auth_version·실제 해시·이전 세션 거부·감사·부분 실패
재처리를 확인한다. root TTY 운영자 입력/계정 변경은 운영에서 자동 실행하지 않는다.

`test_services`와 `verify-redis.py --with-app`은 같은 체크아웃에서 동시에 실행하지 않는다.
새로운 소유 label·합성 DB·동적 loopback 포트로 시작하고 자신의 자원만 정리한다.
기존 state의 이미지가 현재 digest와 달라도 재사용하지 않고 명시적으로 중단한다.

| 검증 | 확인하는 경계 |
|---|---|
| Java `check` | unit/MVC, 합성 DB/Redis integration, fixture 소유권·실제 이미지 검사 |
| JAR·브라우저 | 실제 로그인·CSRF·Secure cookie, 인스턴스 간 세션 공유·재시작·로그아웃 |
| 배포 ACL | 익명/key/channel/CONFIG/ACL/FLUSH/RESTORE 거부, SORT/XREAD/Lua 범위와 EVAL 잘못된 arity |
| 배포 Redis+JAR | 실제 앱의 세션과 Redis 장애 시 인증·공개 예산 제한의 차단 |
| 4MiB OOM 프로필 | noeviction, Lua 쓰기 실패, 만료 알림과 AOF 재시작 보존 |
| 512MiB 프로필 | 실제 설정·Docker1GiB/CPU0.5/PID128, 합성96MiB와 자동 AOF rewrite·재시작 보존 |
| 공개 도구 Python | 빌드/배포 기준 분리, 입력·산출물 변경 시 재사용 거부, archive 안전성·root 소유, 설정/receipt 경계 |

메모리 프로필의 INFO 계정은 **합성 fixture에만** 추가한다. 운영 앱 ACL에는
관측용 권한을 추가하지 않는다. RSS 샘플은 fork 자식 전체의 kernel peak나 실제
수집 동시 부하 용량 보장이 아니다. AOF everysec는 무손실 백업이 아니다.

`build/reports/packaged-sessions/result-browser.json`, `result-deployment-redis.json`,
`result-sessions.json`은 프로필별로 분리된다. 호환용 `result.json`도 유지한다.
나중에 Redis 프로필을 실행했다고 이미 통과한 브라우저 기록이 덮여 없어지지 않는다.
패키징은 현재 JAR 해시와 일치하는 브라우저 기록·Java XML 무실패/무skip을 확인한다.

새 digest 검증은 이전 버전의 성공 기록을 재사용하지 않는다. 보고 시 source SHA,
실제 JAR hash/build SHA, 이미지 index/platform digest, 각 검증의 실행 여부를 구분한다.
실행하지 않은 운영 SSH/설치/HTTPS/실제 역할 loopback/control 독립성/수집 피크와
파일시스템·vendored 전체 보안 검사를 통과했다고 표시하지 않는다.
