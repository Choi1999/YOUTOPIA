# YOUTOPIA Guest-first / Context-Return 로그인 검증계획 v0.1

> 2026-10-21 KST · **TEST_PLAN_ONLY / NOT_RUN / NO_AUTH_SERVER**.
>
> 기반: [Guest-first 로그인 UX v0.1](./GUEST_AUTH_CONTEXT_RESTORE_UX_20261021.md), [역할·접근 매트릭스](./07_SURFACE_ACCESS_MATRIX.md), [M0~M9 검증](./INTEGRATION_ACCEPTANCE_M0_M9_20261021.md).
>
> 실제 미구현/미승인 사항: Chrome identity permission·공급자 선택·실제 세션/로그인 서버·사용자 DB·유료 결제·실 YouTube API 접근. 이 계획은 기존 YU-27 Node 177/177 및 오프라인 Chromium 2/2의 PASS를 신규 Auth 테스트 PASS로 변경하지 않는다.

## 1. 화면·고객 사용성 테스트 (모두 미래 실행)

| ID | 조건/사용자 작업 | PASS 판정 |
|---|---|---|
| AUTH-UX-01 | Guest 사용자가 YouTube 영상 A Hover | 허용된 기본 결과/가용 상태가 바로 나오고 **로그인 전면 팝업 0회** |
| AUTH-UX-02 | Guest가 A의 더보기를 클릭 | 같은 A가 Side Panel에 고정, 기본 요약/주제/추이 중 허용된 콘텐츠에 접근 |
| AUTH-UX-03 | Guest가 A를 저장 선택 | “이 영상을 저장하려면 로그인해 주세요” 맥락 안내 1회, 취소/로그인 선택 가능 |
| AUTH-UX-04 | AUTH-UX-03에서 로그인 취소 | A 패널 및 Guest 허용 콘텐츠 유지, 저장 성공으로 표시되지 않음 |
| AUTH-UX-05 | A 저장→로그인 성공 | **동일 선택 대상 A와 해당 작업으로 돌아옴**, “계속 저장하기” 확인 후 저장 시도 |
| AUTH-UX-06 | 로그인 진행 중 B를 더보기 클릭 | A의 오래된 인증 복귀 intent가 B를 덮거나 B를 A로 저장하지 않음 |
| AUTH-UX-07 | 탭 1=A 저장, 탭 2=B 비교를 각각 요청 | tab/selectionRevision별 intent 격리; 다른 탭으로 잘못 복귀하지 않음 |
| AUTH-UX-08 | 로그아웃/세션 만료 후 동일 영상 Hover | 기본 Guest 콘텐츠만 보이며 개인/조직 비공개 자료 노출 0 |
| AUTH-UX-09 | 계정 A→B 전환 | A 전용 조회/저장·구독 데이터 캐시 재사용 금지, B 권한을 서버에서 재판정 |
| AUTH-UX-10 | Guest가 팀 관리/조직 공유/운영 페이지 진입 | 적절한 인증/역할 Gate, 허용되지 않은 데이터 사전 로딩 금지 |
| AUTH-UX-11 | Guest Side Panel 로그인 진입점 | 작은 계정 진입점은 접근 가능하되 분석 핵심 정보 가로채기/강제 모달 없음 |
| AUTH-UX-12 | 로그인 Intent 만료·페이지 닫힘·탭 제거 | 잘못된 target/자유 redirect로 이동하지 않고 안전한 일반 로그인 완료 화면 |
| AUTH-UX-13 | 확장 재시작/Service Worker 재시작·브라우저 종료 | intent 보존 가능 범위만 지키고 민감정보 유출/허위 복귀 없음 |
| AUTH-UX-14 | 영상 ID 불명/@handle 미해결 또는 삭제된 영상 | 원래 영상 임의 추정·다른 영상에 저장 금지 |
| AUTH-UX-15 | 채널 소유자 OAuth를 사용하지 않는 일반 고객 로그인 | 공개 자료 조회만 위해 YouTube 채널 동의/연동 강요하지 않음 |
| AUTH-UX-16 | DEV/QA 합성 수치 또는 운영 전용 통제 | 고객 로그인·Hover·Side Panel에서 내부 시뮬레이터/합성 운영 지표 노출 0 |
| AUTH-UX-17 | Tab/Enter/Escape/키보드, 100/125/150% 줌, 다크·라이트 | 로그인 안내·취소·기존 위치 복귀·Focus 재설정이 명확 |
| AUTH-UX-18 | 긴 한글/영어/태국어 영상·채널명 | 선택 대상·행동 설명 이해 가능, 말줄임·키보드 접근 가능 |
| AUTH-UX-19 | 로그인 후 권한은 있으나 영상 데이터 미확보/정책 차단 | 가짜 감성·트렌드를 생성하거나 “로그인하면 해결”이라고 거짓 안내하지 않음 |
| AUTH-UX-20 | 기본 요약만 보던 Guest가 구독 전용 기간/비교 요청 | 실제 허용된 기능 범위와 인증/구독을 구분, 자동 청구/결제/권한 승격 없음 |

**UI 테스트 증거:** Figma 신규 후보 프레임·스크린샷·설계 버전, 실제 설치형 Chrome 버전, FE SHA, YouTube 표면, 각 단계의 정확한 대상 videoId/channelId·tabId·selectionRevision(민감 데이터는 마스킹), Node/Chromium/Chrome E2E PASS/FAIL/NOT_RUN. 디자인 시안 PASS가 실 Chrome PASS가 아님.

## 2. BE·인증 보안 계약 검증 (미구현; 서버 팀 설계 후 실행)

| ID | 공격/실패 또는 정상 입력 | 서버와 클라이언트의 요구 |
|---|---|---|
| AUTH-BE-01 | 비로그인 기본 분석 | 승인된 PUBLIC_REUSABLE 범위만 제공; rate limit/개인 추천 피드 저장 금지 |
| AUTH-BE-02 | 로그인된 사용자의 saved/report API | 서버 session/tenant/resource ownership 기반 접근; 미로그인 401, 권한 없음 403 |
| AUTH-BE-03 | 조직 A의 리소스 ID를 조직 B 사용자가 조작 | BOLA/IDOR 0, URL/클라이언트 Role 문자열에 의존하지 않음 |
| AUTH-BE-04 | 계정 세션이 만료·취소/회수 | 개인 분석·저장 캐시 접근 즉시 차단, Guest 상태로 안전 강등 |
| AUTH-BE-05 | OAuth Authorization Code 재사용/PKCE verifier 불일치 | state, PKCE, nonce, issuer와 callback 검증 실패 시 세션 발행 금지 |
| AUTH-BE-06 | 임의 외부 returnUrl/open redirect 시도 | 허용된 callback/route만; 외부 URL로 redirect되지 않음 |
| AUTH-BE-07 | 이미 소비된/만료된 AuthReturnIntent 재생 | intent 재사용 차단, 다른 tab·account·target에 복귀 금지 |
| AUTH-BE-08 | 복귀 시 tab/pinned selection 변경 | 실제 저장/비교 재시도 전 현재 선택과 의도 일치 확인 |
| AUTH-BE-09 | 사용자 A 로그인 후 B 로그인·공유 기기 | session rotation, 타 사용자 token/cache 재사용 금지 |
| AUTH-BE-10 | CSRF·CORS·extension-origin 위조 | 정한 세션 보안 규칙 및 출처 검증 실패 시 작업 차단 |
| AUTH-BE-11 | 공개 캐시와 tenant-private snapshot 혼합 | 서버 권한/공유 범위를 키·결과·조회마다 검증 |
| AUTH-BE-12 | Guest/Free/Subscriber/Admin 역할 문자열 조작 | 역할과 구독은 서버가 독립 판정; UI만 바꿔 데이터 확보 불가 |
| AUTH-BE-13 | 실제 OAuth/Google 계정 연결과 서비스 로그인 혼동 | 로그인만으로 YouTube 채널 권한을 얻었다고 처리하지 않음 |
| AUTH-BE-14 | 저장 단건 요청 중복/재시도 | idempotency, 감사 기록, 사용자 의도 확인 및 권한 검사 |
| AUTH-BE-15 | 실데이터 정책 Gate 미충족 | 인증·구독과 무관하게 실제 댓글 파생 분석·원문 전송·보관 차단 |
| AUTH-BE-16 | 로그인/조직 관련 로그·Trace | 토큰/비밀번호/원시 댓글/과잉 개인정보 유출 0 |

**보안 참조:** [OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html), [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity). 이는 안전한 구현 결정을 위한 근거이고 실제 YOUTOPIA 보안 검증 PASS의 증거가 아니다.

### 2.1 AUTH-SURFACE-01: 확장 고객 인증 / 웹 관리자·QA 로그인 독립 인수 (미실행)

| Test ID | 검증 | PASS 기준 |
|---|---|---|
| AUTH-SURFACE-QA-01 | 운영 고객 Chrome 확장 메뉴·Hover·Panel 전수 확인 | **고객 서비스 로그인/계정 진입만**, 플랫폼 관리자·DEV/QA 로그인 버튼/폼/라우트/토글 **0건** |
| AUTH-SURFACE-QA-02 | 확장 고객 로그인 누름 | 고객 공통 웹 로그인으로 안전 이동하고 완료 후 선택 영상으로 복귀; 확장 자체에 복제한 비밀번호 입력 폼 없음 |
| AUTH-SURFACE-QA-03 | 같은 고객 인증으로 개인 고객·조직 구성원·조직 관리자 접근 | 조직 관련 관리자 기능은 조직 관리자 웹 화면에서 **서버 RBAC 재검증** 후에만 사용 가능 |
| AUTH-SURFACE-QA-04 | 고객 확장 세션으로 플랫폼 Admin Web / 정책 관리자 라우트 직접 호출 | 고객 세션·클라이언트 role 필드만으로 관리자 API·화면 접근 **차단** |
| AUTH-SURFACE-QA-05 | 운영 고객 확장 빌드와 DEV/QA 환경 차이 검토 | 운영 확장 내 합성 분석·QA 실패 상태·관리자 기능 **없음**. 내부 QA 웹 및 승인된 테스트 환경에만 존재 |
| AUTH-SURFACE-QA-06 | 운영자 계정이 고객 분석을 일반 고객 경험으로 이용 | 운영 권한이 확장에 노출되지 않으며 고객 권한/데이터 접근은 별도 서버 검사 |
 
**상태:** 6/6 `NOT_RUN`. 해당 화면 소속 승인 및 Figma 후보의 편집 가능 구조 검증은 실제 Chrome 사용자 권한/서버 보안 실행 증거를 대체하지 않는다. 관리자와 QA가 완전히 다른 IdP를 써야 한다는 인프라 결론은 미확정이다.

## 3. FE/BE/INT 각 Gate 소유

| 단계 | 구현할 범위 | 인수 Gate |
|---|---|---|
| M1 Shared | Login/Session/Error/Entitlement/ReturnIntent 후보 계약과 Guest 경계 | **DESIGN_REVIEW_PENDING**, FE·BE 두 팀 합의 필요 |
| M2 UI | Figma Auth-F01~F08, Guest 로그인 CTA 및 복귀 Mock | UX 테스트 케이스 QA Fixture, 실제 Chrome OAuth 없음 |
| M3 Server groundwork | Guest 공개 허용·Mock Provider·최소 인증 응답 계약 | Consumer/Provider 계약, 악의적 입력 거부 |
| M6 Actual auth | BE session/identity provider + FE 실제 인증 클라이언트 | OAuth/session threat model, 권한/로그아웃/intent 회수 QA |
| M7 Workspace | 실제 저장·조직·관리자·보고서 접근과 복귀 | Guest→로그인→원본 대상→저장 E2E 및 조직 분리 |
| M8~M9 | 전체 실제 사용자 환경, 복구 및 보안 | 동일 FE/BE/Shared SHA에서 제품 통합 인수 |

**실제로 미진행:** Figma 신규 프레임 구현, FE/BE Auth/Session 코드 구현, 실제 서비스 로그인·OAuth, 신규 Chrome E2E.

## 4. 검증 증거양식

~~~yaml
feature: GUEST_AUTH_TARGET_RETURN
decision: AUTH-UX-01..05
milestone: M2
status: NOT_RUN
frontend_sha: null
backend_sha: null
shared_contract_sha: null
figma_frame_url: null
chrome_version: null
test_id: AUTH-UX-05
starting_target: VIDEO_A_TEST_ID
clicked_action: SAVE_TARGET
auth_flow: MOCK_ONLY
return_target: null
verified_server_session: false
actual_observed_behavior: null
passed: null
failed: null
test_log_url: null
test_trace_url: null
owner_approval: null
external_references: [EX-013]
~~~

**실제 완료 판정:** 검증 파일에는 테스트한 SHA/브라우저/환경, 수행한 사용자 행동, 실제 관측 결과, PASS/FAIL/NOT_RUN, 원본 로그·스크린샷을 기록해야 한다. 외부 설계 문서만으로 정상 작동·보안을 선언하지 않는다.
