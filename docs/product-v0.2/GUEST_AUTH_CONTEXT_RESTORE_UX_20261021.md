# YOUTOPIA — Guest-first 로그인·원래 분석 대상 복귀 UX v0.1

> **2026-10-21 KST · APPROVED_DIRECTION / DESIGN ONLY / AUTH NOT IMPLEMENTED**
>
> 사용자 승인: 기본 분석을 가능한 범위에서 비로그인으로 제공하고, 저장·비교·추적·조직 작업 등 계정이 필요한 순간에만 로그인하도록 하며, 로그인 성공 시 사용자가 선택했던 영상/채널과 진행 중이던 업무로 돌아온다. 고객 계정과 플랫폼 Admin/DEV·QA 인증은 분리한다.
>
> **승인 대상은 UX 방향**이며 실제 로그인 공급자, 무료 이용 정량, 실데이터 사용 권한, OAuth/세션 기술, 출시·결제에 대한 승인은 아니다.
>
> 정본: [02 역할·구독](./02_ROLES_AND_SUBSCRIPTION.md) · [07 접근 매트릭스](./07_SURFACE_ACCESS_MATRIX.md) · [08 결정·위험](./08_DECISION_AND_RISK_REGISTER.md) · [Chrome UX](./01_HOVER_SIDE_PANEL_UX.md) · [M0~M9](./FE_BE_PRODUCT_INTEGRATION_METHOD_V3_20261021.md).
> 테스트: [Guest Auth Acceptance](./GUEST_AUTH_ACCEPTANCE_20261021.md). 외부 근거: [External Reference Ledger](../research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md) — EX-013.

## 1. 승인 내용과 미결정 사항

| 결정 ID | 확정된 제품 경험 | 상태 | 구현 전에 남은 결정 |
|---|---|---|---|
| ENT-01 / P-07 | 영상·채널의 **허용된 기본 Hover와 기본 Side Panel을 Guest에게 우선 제공** | APPROVED_DIRECTION | 데이터 제공의 적법성, 남용/조회 한도, 지원 범위 |
| AUTH-UX-01 | 첫 Hover/Side Panel에서 로그인 강제 금지. 저장·비교·추적·팀 기능 사용 시 맥락형 로그인 요청 | APPROVED_DIRECTION | 무료·구독별 세부 기능 허용량 |
| AUTH-UX-02 | 인증 성공 시 원래 선택한 대상/업무 맥락으로 복귀 | APPROVED_DIRECTION | 인증 세션 제공 방식 및 임시 intent 보관 기술 |
| AUTH-UX-03 | 개인 고객·고객 조직은 공통 로그인 체계에서 역할 분리 | APPROVED_DIRECTION | 조직 SSO, 역할 초대, 가입 정책 |
| AUTH-UX-04 | 플랫폼 운영자/정책 관리자 별도 진입점·강화된 인증 경계, DEV/QA 분리 | APPROVED_DIRECTION | 운영 도메인, MFA/SSO 기술 및 보안 정책 |
| AUTH-UX-05 | 서비스 로그인과 YouTube 채널 소유자 OAuth 동의 분리 | APPROVED_DIRECTION | OAuth가 필요한 기능과 최소 Scope |

비로그인 허용은 누구나 모든 분석을 확인할 수 있다는 보증이 아니다. **서버가 허용한 공개 재사용 가능 결과만** Guest에게 제공하고, 실제 YouTube 감성·주제 파생 분석은 사용 정책 Gate를 먼저 통과해야 한다. 승인 전 개발 UI는 격리된 합성 데이터로만 테스트하며 가짜 실제 통계를 운영 사용자에게 제공하지 않는다.

## 2. 어디에 로그인 화면이 있어야 하는가?

| 표면과 기존 자료 | 첫 방문 | 로그인 진입 UI | 하지 않을 일 |
|---|---|---|---|
| YouTube 홈·검색의 Hover | 권리·한도가 허용하는 기본 분석 즉시 제공 | 없음 | Hover 순간에 로그인 팝업·전체 페이지 이동 |
| [98-10 Chrome Side Panel](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217) | 요약/주제/추이 중 허용된 기본 정보 우선 | 헤더의 작은 로그인, 또는 저장·비교 CTA 클릭 시 맥락 안내 | 첫 진입 로그인 강제, 내부 정책/캐시 코드 노출 |
| [YU-01 /login](../../frontend/src/pages/auth/LoginPage.tsx) | 고객 개인·조직 기능에 인증 필요 | 안전한 고객 로그인 웹 화면 또는 검증된 Chrome 인증 흐름 | 현재 DEMO 계정·SSO 시뮬레이션을 운영 인증으로 오인 |
| [80-01 Guest](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1285-2) | 비개인화 화면과 기본 설명 | 개인 자료·저장·내역 클릭 시 로그인 | 다른 고객/조직 자료 사전 로드 |
| [81-02 조직 Admin](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-72) | 인증 및 조직 관리자 권한 필수 | 고객 공통 계정으로 로그인 + 서버 역할 판정 | 구독만으로 관리자 권한 허용 |
| [82-01 플랫폼 Admin](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-144) | 독립 운영 진입점, 강화된 보안 Gate | 관리자 전용 인증 UI | Side Panel 내부에 운영 버튼/감사 토글 |
| [83-01 DEV/QA](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-290) | 격리된 시험 환경 | 별도 권한·환경 | 운영 고객에게 합성 결과·강제 실패 토글 노출 |

실제 FE 소스 검토: LoginPage.tsx는 React 메모리 Demo 계정 로그인, SSO 미연결이며 기존 게임 중심 브랜딩이 남아 있다. extension/sidepanel.html은 MOCK placeholder, extension/manifest.json은 identity 권한 없음. 이번에는 소스/권한을 변경하지 않는다.

## 3. 핵심 여정 — Guest → 로그인 → 선택 영상으로 복귀

~~~text
YouTube 영상 A Hover
  → 기본 반응 요약(데이터가 실제로 사용 가능한 경우)
  → [더보기] → Chrome Side Panel A 고정
  → [이 영상 저장하기] 클릭
  → Guest 확인 → 맥락형 안내: “저장하려면 로그인이 필요해요”
  → [로그인] 버튼을 고객이 명시적으로 누름
  → 안전한 인증 흐름, 서버가 사용자 세션 검증
  → 원래 tab/selectionRevision 및 A 확인
  → 기존 A Side Panel/기존 작업으로 복귀
  → [계속 저장하기] → 서버가 권한·중복·이용 범위 검증 후 저장
~~~

- **저장 동작 자동 실행 금지(초기안):** 로그인만으로 데이터 변경을 암묵 실행하지 않는다. 원래 업무와 선택 대상을 보존하고 사용자가 안전하게 행동을 이어서 하도록 한다. 추후 멱등성/사용성 결과를 바탕으로 변경 가능.
- **로그인 취소·실패:** A 패널을 유지하고 허용된 Guest 데이터는 계속 표시. 저장이 완료된 것처럼 보여주지 않고 반복 팝업을 방지.
- **대상 변경:** 사용자가 인증 중 B를 더보기로 선택했다면 A의 오래된 intent는 패널 B를 덮거나 B를 A처럼 저장할 수 없다.
- **탭 종료·브라우저 재시작/Intent 만료:** 안전한 일반 로그인 완료 경로로 가고 “영상을 다시 선택해 주세요” 안내. 잘못된 임의 복귀 주소/저장 대상 생성 금지.
- **계정 전환:** 이전 계정 전용 저장/조직/구독 캐시 제거, 서버 재인가. Guest 기본 정보가 허용되면 그 범위로 자연스럽게 강등.
- **조직 관리자 작업:** 고객 로그인 이후에도 조직 관리자 역할을 별도 확인. 플랫폼 관리자는 독립 진입점의 강화 인증 필수.

## 4. AuthReturnIntent — 설계 계약 초안

최소 사용자 선택 맥락을 보존할 임시 데이터. **인증 토큰도 서버 권한 증명도 아님.**

~~~ts
type AuthReturnIntent = {
  intentId: string;                    // 추측 불가능하고 일회용인 opaque ID
  kind: "SAVE_TARGET" | "COMPARE_TARGETS" | "TRACK_TARGET" | "OPEN_WORKSPACE";
  target: {
    source: "YOUTUBE";
    type: "VIDEO" | "CHANNEL";
    id: string;
  } | null;
  originatingTabId: number | null;   // 내부 tab 맥락, 서버 권한 증명 아님
  selectionRevision: string | null;  // 더보기로 고정된 대상의 전환 세대
  createdAt: string;
  expiresAt: string;
  originSurface: "CHROME_SIDE_PANEL" | "CUSTOMER_WEB";
};
~~~

**구현 전 Gate**
1. Intent는 지정된 행동·사용자 접속 맥락에 결합하고 한 번 소비하면 무효화. 연구용 유효기간 후보는 10분, 실제 값 미확정.
2. Chrome extension에는 Preview 전용 합성 캐시와 **다른 키/경계**를 사용. 서비스 워커 종료를 고려하되 권한·민감 정보/토큰 저장은 금지. 필요하면 서버 측 일회용 intent와 extension session 연계 검토.
3. 외부 인증 URL에 raw videoId·이메일·조직 정보·토큰·임의의 returnUrl을 노출하지 않음. 허용한 redirect URI만 사용하고 외부 왕복에는 보안 검증된 state/PKCE/nonce를 사용.
4. 복귀시 intentId·상태·탭·selectionRevision·target ID를 재검증. intent가 만료/변경된 경우 fail closed.
5. 실제 SAVE/COMPARE 등 서버 행동에서는 **사용자 신원·조직 소유권·플랜 이용권·데이터 권리**를 다시 확인. 브라우저/탭 번호만으로 권한을 부여하지 않음.

## 5. 인증 구현 방법: 후보일 뿐, 미승인

- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity): launchWebAuthFlow / getRedirectURL은 승인된 공급자와 redirect 설정 후 검토. **로그인 UI의 실제 사용자 행동에 의해 시작**하고 확장 설치·Hover·첫 실행에서 자동 팝업 금지.
- [OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html): Authorization Code + PKCE, transaction-bound state, OIDC nonce, redirect/issuer 검증, replay·open redirect 방지 등을 인증 공급자/세션 설계 ADR에서 검토.
- 안전한 서버 세션, Secure/HttpOnly/SameSite cookie 혹은 동등한 방식, CSRF/확장 출처 검증·로그아웃/회수 및 교차 계정 보안은 M6 BE에서 구현·실험 후 확정.
- 서비스 Google 로그인과 YouTube 채널 소유자 OAuth 동의는 별도 사용목적·동의로 분리. 공개 정보만 조회하는 행위에 채널 OAuth를 불필요하게 강제하지 않는다.
- 현재 extension/manifest.json에 identity permission을 추가하지 않는다. 실제 인증 설계 승인이 선행되어야 한다.

## 6. 신규 Figma 후보 프레임 (기존 정본 유지)

| 화면 ID | 연결 정본 | 반드시 보여줄 경험 |
|---|---|---|
| AUTH-F01 | [98-09 Hover](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-2) | 로그인 없는 기본 카드, 실제 결과 없으면 자연스러운 미확보 상태 |
| AUTH-F02 | [98-10 Side Panel](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217) | 요약/주제/추이, 작은 로그인 진입점, 맥락 없는 로그인 유도 없음 |
| AUTH-F03 | AUTH-F02 | 저장 동작 시 1회 맥락형 로그인 안내와 취소 |
| AUTH-F04 | 기존 YU-01 React 로그인 | 범용 YouTube 분석 브랜딩과 인증 공급자 후보 |
| AUTH-F05 | AUTH-F02 | 인증 후 이전 A 영상 및 ‘계속 저장하기’ CTA로 복귀 |
| AUTH-F06 | AUTH-F02 | 취소·만료·다른 탭·대상 변경의 안전한 처리 |
| AUTH-F07 | [82-01 Platform Admin](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-144) | 독립된 관리자 로그인 진입점 |
| AUTH-F08 | [83-01 DEV/QA](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-290) | 합성·진단 기능 격리 |

**현재 상태:** 신규 화면의 *프레임 정의만 작성*. 실제 Figma 레이어/디자인 수정·시각 승인/React 반영은 하지 않았다. 원본 98/80~83 화면은 보존한다.

## 7. FE/BE/INT 마일스톤 위치

| 단계 | FE | BE/Shared | INT Gate |
|---|---|---|---|
| M1 공통 계약 | AuthReturnIntent·401/403/게스트 상태·세션 UI 설계 | Auth/Entitlement/Error 계약·게스트 공개 데이터 경계 검토 | CT-AUTH-01 의미·null/0·권한 합의 |
| M2 Chrome UX | Guest Hover/Side Panel·맥락형 로그인 **Mock UI** | Synthetic Mock Provider | UX 시나리오와 YU-26/27/28 대상 고정 회귀 |
| M3 서버 기반 | API Consumer·Guest 기본 데이터 상태 | Mock Provider+캐시 공개/전용 분리 | 계약 검증 |
| M6 실제 인증·구독 | 로그인/로그아웃/복귀/계정 전환 | 인증 세션·RBAC·Entitlement, auth threat model | 401/403·BOLA·CSRF/PKCE·세션 보안 |
| M7 고객/관리 | 저장/비교/보고·운영자 분리 | 자원 소유권·감사 | Guest→Login→Saved Target 실제 E2E |
| M8~M9 통합 | 멀티탭·접근성·성능 | 만료/취소·복구·서버 정책 | 실제 환경 완전 통합 인수 |

현재 YU-27 설치형 Chrome MV3 검증 PENDING, YU-28 click→Panel 미구현, BE auth 서버 미구현이므로 실제 Guest→Login→Return 성공은 **NOT RUN**.

## 8. 증거 기록 및 범위

- **사용자 승인:** 2026-10-21 대화에서 Guest-first, 필요 순간 로그인, 원래 영상 복귀, 운영/QA 독립 인증 방향을 승인.
- **내부 출처:** FE LoginPage.tsx의 DEMO 메모리 로그인, extension/manifest.json의 identity 권한 부재, Side Panel placeholder, Figma 승인 정본 98/80~83.
- **외부 출처:** Chrome Identity API / Chrome Extension Best Practices / OWASP OAuth 2.0 (EX-013: 외부 연구 근거 대장).
- **미결정:** Guest 실제 데이터 범위·쿼터·남용 제한, 공급자/OAuth, intent 저장 매커니즘, 조직 SSO/MFA, 실제 무료·구독 상품 권한·가격, 개인정보 고지/보존·삭제.
- **이번에 하지 않은 일:** 인증 공급자 연결, 실제 Google OAuth, Chrome manifest 추가 권한, 브라우저/React 로그인 코드 수정, 고객 요금제 확정, 외부 댓글 파생 분석 활성화, 배포/병합.

**판정: APPROVED_DIRECTION / AUTH_DESIGN_CANDIDATE / FIGMA_NOT_UPDATED / SERVER_AUTH_NOT_IMPLEMENTED / CHROME_E2E_NOT_RUN.**
