# UI-R04-AG — PR #95 React ↔ PR #96 Spring 고정 SHA 오프라인 통합

기준일: 2026-11-06 KST
프런트 부모 PR #95: 08bdc53816a16f74476c9b4a6fe104eead28d4f1
백엔드 PR #96: 2a7836472efe154e78e5ac597f8c7a9dd67aaf9e
정책: POLICY_HOLD / liveCallsAuthorized=false / 실 YouTube 호출 0

## 1. 목적과 증거 경계

프런트 AE는 메타데이터 소비자 인터페이스만 갖고 운영 reader를 등록하지 않는다. 백엔드 AF의 MetadataConsumerOfflineController는 Spring 테스트 소스에만 있고 MockMvc에서 인증·인가를 검증한다. 기존 테스트 전용 MetadataSyntheticLoopbackApplication에는 이 AF Controller가 등록되어 있지 않다.

따라서 두 가지 독립된 자동 증거를 **혼합하지 않는다**.

1. 실제 AF Controller 401(익명), 403(USER 권한 없는 ADMIN), 503(POLICY_HOLD, 인증된 USER), 400(잘못된 ID), CSRF/POST 403/405는 **PR #96 pinned MockMvc/JUnit**으로 검증.
2. Vite→localhost Spring 실제 네트워크 왕복은 **PR #96 pinned TEST-only synthetic loopback**으로 검증. AF consumer 경로가 이 서버에 공개되지 않아 2xx 성공을 반환하지 않는 것을 직접 확인. 동시에 synthetic-state?scenario=FAILED의 503이 Vite를 통과하며 LOCAL_SYNTHETIC_ONLY, sourceAuthenticated=false라는 점 확인.

**인증된 USER가 Vite를 통해 AF의 503을 받는 실제 브라우저 세션 E2E는 아직 수행하지 않았다.** 운영 앱 인증·허용된 provider 통신·첫 실 호출은 별도 승인 과제다.

## 2. 코드 변경

- workspaceOfflineConsumerDenial.ts: DEV 및 3개 명시 플래그(VITE_R04AC_DIAGNOSTICS, VITE_R04Y_SYNTHETIC_HTTP, VITE_R04AG_CONSUMER_DENIAL) 동시 활성화일 때만 local same-origin GET. 무쿠키, 무인증 헤더, redirect error, no-store, 5초 타임아웃, 4KB JSON 상한, 401/403/503 및 코드 whitelist.
- 어떠한 HTTP 응답도 provider READY로 승격하지 않는 별도 offlineConsumerDenialReader. 200·위조 JSON은 거부.
- 일반 사용자 경로는 이 reader/토글 미탑재. 기존 /analysis/youtube/workspace/diagnostics의 단일 DEV 도크에서 'AF 정책 차단 QA'를 직접 눌러서만 실행.
- 오류 시 메타데이터 FAILED를 표시하되 제목·이미지·영상-채널 관계를 추정하지 않으며, QA 끄면 기존 사용자 화면 상태로 복귀.
- 새로운 실제 YouTube API endpoint, 자격증명 저장, 운영 Spring Controller, 서버 정책 변경 없음.

## 3. 자동 검증

- workspaceOfflineConsumerDenial.test.ts: 상태·입력·출처·credential 제한, 비정상 응답 거부.
- WorkspaceOfflineDenialIntegration.test.tsx: 일반 경로에서 0건 요청, 진단 명시 opt-in에서 FAILED 표시 및 READY 부재.
- CI에서 frontend AG HEAD와 backend #96 exact SHA를 서로 별도 checkout, MockMvc 계약 테스트 실행.
- TEST-only Spring loopback 127.0.0.1:8765 + Vite DEV 127.0.0.1:5173로 네트워크 failure smoke. 독립 frontend/extension/build/Windows offline workflow.
- 모든 CI는 HEAD가 정확히 일치할 때 PASS 판정. 사용자 수동 QA와 운영 호출 성공으로 혼동하지 않는다.

## 4. 승인 및 병합 경계

PR #63~96은 각각 Draft/미병합 상태를 유지한다. 이번 AG는 frontend #95의 자식 PR이며 백엔드 #96은 고정 SHA 읽기/테스트만 수행한다. 병합/배포, 실 YouTube Data API 첫 호출, 실제 비밀키 및 Cloud 설정, Quota 비용, 댓글·감성 분석, POLICY_HOLD 해제는 각각 별도 명시 승인 전에 실행하지 않는다.

다음 권장 작업은 누적 PR 통합 가능성과 병합 순서 점검이며, 기능이 없는 보안 시뮬레이션 확장을 무한 반복하지 않는다.
