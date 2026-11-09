# UI-R04-AO — Spring USER 회원 세션과 데모 로그인 분리

## 목적

이 작업은 현재 브라우저 데모 로그인이 Spring 서버의 USER 인증으로 인정되지 않는 차이를 해소할 독립 경로를 마련한다. 데모 로그인은 계속 브라우저 내부에서만 작동하며 실제 계정 서버와 교환하지 않는다. 새 사용자 페이지 경로는 /account/server 이다.

## 기존 Spring 인증 API

| 기능 | HTTP | API |
|---|---|---|
| CSRF 발급 | GET | /api/v1/auth/csrf |
| USER 로그인 | POST | /api/v1/auth/login |
| USER 세션 확인 | GET | /api/v1/auth/me |
| USER 로그아웃 | POST | /api/v1/auth/logout |

로그인 요청은 서버에서 받은 CSRF 토큰을 포함하며 본문은 login/password 구조이다. 로그인 성공 메시지는 서버 세션 확인 GET에서 동일 USER ID가 확인된 경우에만 나타난다. 로그아웃 역시 별도의 서버 재확인 후 결과를 표시한다.

## 안전 경계

- 사용자가 명시적으로 클릭하기 전에는 회원 서버 요청이 없다.
- 상대 경로만 사용하고 same-origin 쿠키, no-store, no-referrer, redirect-error를 적용한다.
- 브라우저 관리 세션 쿠키, 비밀번호 및 CSRF 토큰을 React의 로컬/세션 저장소에 보관하지 않는다.
- USER와 ADMIN 세션은 다른 의미이며, 관리자 세션을 MEMBER로 처리하지 않는다.
- 로그인 실패 시 데모 계정 성공으로 대체하거나 200 응답만으로 서버 USER 세션을 인정하지 않는다.
- 이 PR은 인증 보호를 기존 데모 화면 전체로 확대하지 않는다.
- YouTube/Google API 호출, 메타데이터 읽기, 댓글 저장, 실제 분석과 모델 호출은 추가하지 않는다.

## Windows 개발

개발 Vite의 인증 프록시는 기본 비활성이다. 로컬에서 이미 안전하게 준비된 Spring 인증 서버가 있을 때만 다음과 같이 실행할 수 있다.

    $env:VITE_R04AO_LOCAL_AUTH_PROXY = "enabled"
    $env:YOUTOPIA_LOCAL_AUTH_PORT = "8080"
    corepack pnpm dev --host 127.0.0.1 --port 5173 --strictPort

포트 번호는 실제 Spring 로컬 포트로 교체해야 한다. 이 설정은 개발 실행에서 네 개 인증 API 경로만 127.0.0.1로 전달하고 프로덕션 빌드에서는 작동하지 않는다. 설정이 잘못되면 Vite는 기동을 거부한다.

Spring 쿠키의 Secure 속성은 기본 활성이다. HTTPS가 아닌 루프백 프록시에서 브라우저 쿠키 동작이 제한될 수 있다. 실제 회원 계정 비밀번호를 사용한 검수는 승인된 HTTPS same-origin 구성에서 수행해야 하며, 이를 위해 쿠키 보안을 임의로 해제하지 않는다. 로컬 DB/Redis/계정 서비스 준비는 이 PR의 범위 밖이다.

## 검증과 추가 단계

- 단위 테스트: 401 guest, USER 응답만 인증, ADMIN/형식 오류 거부, CSRF 누락 시 POST 차단, 로그인 후 GET /me 확인, 로그아웃 후 GET /me 확인, 전송 오류 시 fail-closed.
- React 테스트: 클릭 전 요청 없음, 실제 서버 인증 결과만 표시, 비밀번호 입력창 비우기, 로그아웃, 미확인 세션의 데모 로그인 대체 금지.
- 실제 Spring HTTPS + DB/Redis 통합 로그인은 별도 환경과 권한이 있어야 검증 가능하다.
- 백엔드 PR #109의 메타데이터 기능 상태 API는 미병합이며 이 프런트 PR에서 호출하지 않는다.
- POLICY_HOLD 유지; 승인된 실 YouTube API 호출 및 운영 배포는 추가 게이트가 필요하다.
