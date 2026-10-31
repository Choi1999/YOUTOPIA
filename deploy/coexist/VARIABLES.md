# 실행 변수 계약

Codex의 DB7비밀 전달은 서버 실행 설정 완료가 아니다. 운영 서버의 /etc/youtopia-app/app.env는 별도 안전한 전달로 구성한다. 기존 DB_USER/DB_PASSWORD는 개발용이며 앱으로 복사하지 않는다. URL 안에 비밀을 넣지 않는다. 아래 각 행은 실제 application.yml의 변수명이다.

| 변수 | 처리 |
|---|---|
| YOUTOPIA_DATA_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_DATA_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_DATA_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_SESSION_REDIS_HOST | 호스트 Spring에서 127.0.0.1 |
| YOUTOPIA_SESSION_REDIS_PORT | 6379 |
| YOUTOPIA_SESSION_REDIS_USERNAME | youtopia (default off) |
| YOUTOPIA_SESSION_REDIS_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_SESSION_REDIS_TLS | 같은 호스트 loopback만 false 후보. 외부 경로는 TLS/서버 검증 필수 |
| YOUTOPIA_ACCOUNTS_ENABLED | 검증 전 false. PRIVACY는 LEGAL_REVIEW로 계속 false; control 미해결 상태 accounts 활성화 금지 |
| YOUTOPIA_ACCOUNT_HMAC_KEY | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_PASSWORD_BLOCKLIST | SHA256 한 줄당64hex, 비어 있지 않은 승인 파일. 최대256MiB; 앱 읽기 전용. 테스트용 소량 목록을 운영용으로 쓰지 않음 |
| YOUTOPIA_MEMBER_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_MEMBER_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_MEMBER_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_ADMIN_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_ADMIN_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_ADMIN_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_AUDIT_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_AUDIT_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_AUDIT_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_DIRECTORY_ENABLED | 검증 전 false. PRIVACY는 LEGAL_REVIEW로 계속 false; control 미해결 상태 accounts 활성화 금지 |
| YOUTOPIA_DIRECTORY_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_DIRECTORY_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_DIRECTORY_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_EVENTS_ENABLED | 검증 전 false. PRIVACY는 LEGAL_REVIEW로 계속 false; control 미해결 상태 accounts 활성화 금지 |
| YOUTOPIA_EVENT_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_EVENT_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_EVENT_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_ACTIVE_SESSION_WINDOW_SECONDS | 기존 코드 기본값 유지; app.env.example 참조 |
| YOUTOPIA_REPORTING_ENABLED | 검증 전 false. PRIVACY는 LEGAL_REVIEW로 계속 false; control 미해결 상태 accounts 활성화 금지 |
| YOUTOPIA_REPORT_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_REPORT_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_REPORT_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_PRIVACY_ENABLED | 검증 전 false. PRIVACY는 LEGAL_REVIEW로 계속 false; control 미해결 상태 accounts 활성화 금지 |
| YOUTOPIA_RETENTION_APPROVAL_REF | 정책 미정: 비워두고 탈퇴/파기 기능 비활성 유지 |
| YOUTOPIA_RETENTION_PLAN | 정책 미정: 비워두고 탈퇴/파기 기능 비활성 유지 |
| YOUTOPIA_PRIVACY_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_PRIVACY_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_PRIVACY_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_CONTROL_ENABLED | 검증 전 false. PRIVACY는 LEGAL_REVIEW로 계속 false; control 미해결 상태 accounts 활성화 금지 |
| YOUTOPIA_CONTROL_SERVICE_KEY | youtopia; journal에 등록된 식별자와 일치 |
| YOUTOPIA_CONTROL_HMAC_KEY | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_CONTROL_JDBC_URL | 역할별 JDBC URL. 서비스7개는 호스트 loopback5432/youtopia; control은 독립 endpoint/별도 DB. 원격은 verify-full+신뢰CA |
| YOUTOPIA_CONTROL_DB_USER | 전용 역할명: app.env.example 참조. 관리자·owner·ytp_codex 금지 |
| YOUTOPIA_CONTROL_DB_PASSWORD | 비밀. 값은 공개하지 않음; 해당 기능 활성화 시 필수 |
| YOUTOPIA_GAMES_ENABLED | 검증 전 false. PRIVACY는 LEGAL_REVIEW로 계속 false; control 미해결 상태 accounts 활성화 금지 |
| YOUTOPIA_QUERY_ASSOCIATIONS_ENABLED | 검증 전 false. PRIVACY는 LEGAL_REVIEW로 계속 false; control 미해결 상태 accounts 활성화 금지 |

추가 Spring relaxed-binding 변수: YOUTOPIA_ENVIRONMENT=PRODUCTION, YOUTOPIA_ACCOUNTS_DELETION_ENABLED=false, YOUTOPIA_ACCOUNTS_RECONCILIATION_ENABLED=false(별도 운영 승인 전), YOUTOPIA_ACCOUNTS_RECONCILIATION_DELAY_MS=60000. 서버 unit의 SERVER_ADDRESS=127.0.0.1, SERVER_PORT=8080, SERVER_FORWARD_HEADERS_STRATEGY=framework. API max-request-bytes32768/CCU requests-per-minute120 및 기존 로그인 제한 기본값을 유지한다.

DB 역할 매핑: DATA=ytp_app_data_ro, MEMBER=ytp_app_member, ADMIN=ytp_app_admin_auth, AUDIT=ytp_app_audit, EVENT=ytp_app_event, DIRECTORY=ytp_app_directory, REPORT=ytp_app_report. CONTROL=ytp_control_app은 기존7개와 별도다. PRIVACY 자격증명은 이번에 공급하지 않는다.

브라우저 빌드 VITE_*는 모두 공개 가능 값이다. 비밀 주입 금지. VITE_PRODUCT_EVENTS_ENABLED는 기존 동의/기능 정책에 맞춰 결정하고 synthetic 테스트용 true를 그대로 운영에 복사하지 않는다. React API는 같은 origin의 /api를 사용한다.

Codex SSH 비밀파일 변수는 SSH.md, 복원 관리자 변수는 CONTROL.md에 분리했다. 앱에는 root SSH/복원 manager/관리자 DDL용 비밀파일을 전달하지 않는다. 서버의 키/비밀번호는 채팅에 요구하지 않는다.
