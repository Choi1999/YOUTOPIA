# UI-R04-AP — Spring 메타데이터 기능 상태 API와 React 회원 화면 연결

## 목표
- 백엔드 `feat/backend-bootstrap@84a0f552466335ab713360d2bd3d99f4527cbd4e`의 `GET /api/v1/youtube/metadata/capabilities`를 프런트엔드에 연결한다.
- 읽기 전용 기능 상태만 표시하며 실제 YouTube 영상·채널·댓글 데이터를 수집하거나 검색하지 않는다.
- 회원 화면 `/account/server` 내부에 작은 기능 상태 영역을 표시한다. 별도 진단 패널, 내부 정책 원문, 인증 토큰을 일반 사용자에게 노출하지 않는다.
- 기존 데모 로그인과 별개인 실제 Spring USER 세션을 사용한다.

## 안전·사용자 경험 계약
1. 페이지 로드/비인증 상태에서는 기능 상태 API 호출이 **0회**다. 인증 완료 후에도 사용자가 `조회 가능 여부 확인`을 직접 누르기 전에는 호출하지 않는다.
2. 기존 `/api/v1/auth/csrf|login|me|logout`과 정확히 일치하는 하나의 경로 `/api/v1/youtube/metadata/capabilities`만 개발 전용 루프백 프록시로 전달한다. 플래그 `VITE_R04AO_LOCAL_AUTH_PROXY=enabled`, 포트 `YOUTOPIA_LOCAL_AUTH_PORT`는 개발 실행에서만 활성이다.
3. `GET`, `same-origin`, `credentials:same-origin`, `cache:no-store`, `redirect:error`, `no-referrer`를 고정한다. 실제 자격증명·쿠키·CSRF 토큰을 브라우저 저장소나 로그로 복제하지 않는다.
4. 정확한 `YOUTOPIA_METADATA_CAPABILITIES_V01` 계약에서 `status=UNAVAILABLE`, `policy=POLICY_HOLD`, 모든 제공자/읽기/게시 권한 `false`, `providerRequestsMade=0`일 때에만 유효한 응답으로 인정한다. 이 결과도 사용자에게 **현재 조회 제공 안 됨**으로만 표시한다.
5. 200 성공이라는 이유만으로 메타데이터 `READY`, 승인, 썸네일, 댓글, 분석 데이터를 표시하지 않는다. 예기치 않은 필드/스키마, READY 위조, 권한 플래그, 잘못된 캐시/콘텐츠 타입, HTML, 리다이렉트, 오류·네트워크 실패는 모두 **조회 불가**로 처리한다.
6. 401은 기존 회원 세션 만료로 취급하고 회원 화면을 게스트 상태로 되돌린다. 로그아웃/다른 회원 재로그인 시 표시 상태를 초기화한다.
7. 이번 UI는 **기능 활성화 버튼이 아님**. 워크스페이스 기존 합성 데이터 및 `workspaceProviderMetadata` 계층과 연결하지 않는다. 실제 제공자 읽기 권한은 다른 승인·증거 경로가 필요하다.

## 검증 범위
- `serverMetadataCapabilities.test.ts`: 호출 전 네트워크 0회, 올바른 고정 경로와 GET/쿠키 옵션, 홀드 문서 인식, 401·403·5xx 오류, 위조 `READY`와 필드 조작, 리다이렉트/HTML/캐시 및 JSON 크기, 저장소 무사용.
- `ServerAccountPage.test.tsx`: 인증 전 기능 상태 숨김, 인증 후 명시 클릭, 홀드 UI, 세션 만료 및 로그아웃 초기화, 오류 시 fail closed.
- 기존 React/Vite 전체 테스트와 빌드 수행, 기존 확장 프로그램·공유 계약 보존.
- 백엔드 원본 PR #109 계약은 이미 검증·병합됨. 이번 PR은 **클라이언트** 연동이며 실 계정/HTTPS 배포·실 YouTube API 허가 및 운영 권한을 증명하지 않는다.

## 머지 기준
기존 프런트엔드의 CI, React 타입/빌드, 비인증 호출 0회 및 정상 거부 응답 UI 검증 통과 후 별도 승인한다. `frontend`, `dev`, `main` 및 실 API 보안 상태는 병합 승인 전까지 유지한다.
