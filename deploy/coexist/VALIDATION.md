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
