# YUTOPIA Security & Policy Contract v0.1

> **DRAFT / REQUIRES_BACKEND_REVIEW / SECURITY_HOLD FOR LIVE DATA & EXPORT** · 프론트 기준 SHA `344c1e2794c4f6144fa7506f65a17c392487c540`.
>
> 이 문서는 법률 검토·YouTube API 사용권 승인·개인정보보호 준수·보안 감사 완료를 뜻하지 않는다. 코드로 확인된 브라우저 시뮬레이션과 운영환경에 필요한 서버 통제를 구분한다.

## 처음 읽는 분께 — 보안은 왜 필요한가요?

처음 읽는다면 [00 입문 안내서](./00_START_HERE.md)와 [02 API 쉬운 해설](./02_API_EXPLAINED.md)를 먼저 확인하세요.

**화면에서 보이는 버튼과 글자를 믿는 것만으로는 보안이 되지 않습니다.** 사용자는 브라우저의 요청 내용을 바꿀 수 있습니다. 그래서 **서버가 매 요청마다 “이 사람이 누구이고, 이 데이터에 접근할 권한이 있는가?”를 다시 확인**해야 합니다.

**아주 쉬운 사례:** A가 로그인한 상태에서 주소창의 프로젝트 ID를 B의 프로젝트 ID로 바꿨다고 가정합니다.

1. 프론트엔드가 ID를 서버로 보내더라도, 서버는 **세션에서 확인한 A의 신원**을 사용합니다.
2. 서버는 해당 프로젝트의 소유자/조직/역할을 직접 조회합니다.
3. A에게 권한이 없으면 **프로젝트 내용은 반환하지 않고 요청을 거부**합니다.
4. 로그에 비밀번호·OAuth 토큰·실제 댓글 원문을 남기지 않습니다.

| 어려운 용어 | 쉬운 뜻 |
|---|---|
| 인증(Authentication) | “이 사람은 누구인가?” 확인 |
| 인가(Authorization) | “이 사람에게 이 작업 권한이 있는가?” 확인 |
| RBAC | 관리자/검토자/보기 전용처럼 **역할**에 따라 권한 구분 |
| IDOR/BOLA | 다른 사람의 ID를 주소나 요청에 넣어 데이터를 보는 취약점 |
| OAuth Scope | 외부 서비스가 허락한 **권한의 범위** |
| POLICY_HOLD | 보관·수집·외부 공유의 정책이 정해질 때까지 **실행 금지** |

**보안 코드에서 반드시 지킬 주석 규칙:** 중요한 권한 검사 함수에는 “요청자가 누구인지 어디서 확인하는가”, “어떤 조건에서 거부하는가”, “무엇을 로그에 남기지 않는가”를 한국어로 설명하세요. [07 주석 예시](./07_BEGINNER_IMPLEMENTATION_GUIDE.md)를 참고하세요.

운영 인증·YouTube 데이터 수집·외부 AI 전송은 아직 승인되지 않았습니다. 문서의 `BE_PROPOSED` 항목을 **이미 실행 중인 보안 코드로 오해하지 마세요**. 기본 동작은 허용이 아니라 **차단**입니다.


## 1. 책임 및 신뢰 경계

- **브라우저는 신뢰할 수 없는 실행환경**
  - `ProjectDemoProvider`, `YoutubeConsentProvider`, `ReviewWorkflowProvider`는 로컬 데모 상태.
  - 사용자가 선택한 `EDITOR` / DEMO_REVIEWER 문자열도 실제 인증 정보가 아님.
  - **서버 필수 동작:** 모든 변경 요청에서 조직·프로젝트·작업 권한과 현재 정책을 다시 검사.

- **운영 비밀은 서버에서만 취급**
  - **예시:** Google access/refresh token, API key, 세션 비밀, LLM/MCP 자격, 서비스 계정 키.
  - **금지 위치:** 브라우저 번들, localStorage, console, Git, 오류 payload, 분석 로그, 보고서.

- **데모 계정과 운영 계정을 분리**
  - **데모 계정:** `demo@youtopia.app / Youtopia123!`은 공개 회귀 테스트용 예시.
  - **금지:** 이 계정으로 운영 로그인 허용.
  - **저장 키:** `youtopia-login-email`은 이메일 기억용이며 실제 세션·인증 증거가 아님.

- **이 보안 계약의 적용 대상**
  - 인증 및 프로젝트 소유권.
  - 데이터 수집권, 원문·근거 보관, 파생 분석.
  - 사람 승인과 감사.
  - LLM/MCP, 보고서 다운로드·공유, 출처·브랜딩.

- **실제 코드에서 참고할 부분**
  - `frontend/src/pages/auth/LoginPage.tsx`
  - `frontend/src/features/youtube-consent/YoutubeConsentProvider.tsx`
  - `frontend/src/features/project-demo/issueBoardModel.ts`, `reportDemoModel.ts`
  - **주의:** 위 코드는 서버 보안을 구현하지 않음.
## 2. 운영 인증·세션·조직 RBAC (BE_PROPOSED)

1. 인증 제공자, OAuth 2.0/OIDC 여부, 세션 cookie와 CSRF 전략 또는 토큰 선택을 **DEC-02**에서 합의한다. OpenAPI 초안은 특정 인증 수단을 채택한 것처럼 표시하지 않는다.
2. 사용자의 신원·조직·프로젝트 소유권은 서버 데이터에만 의존한다. `GET`/검색/개별 업데이트/첨부/보고서 전송 모두 범위 권한 검사. IDOR/BOLA 방지를 위해 URL `projectId`를 인증 없이 신뢰하지 않는다.
3. 최소권한 원칙: viewer는 조회(허용된 데이터만), reviewer/editor는 허용 전이, admin은 제한된 운영 감사. 승인·보고서 공유는 추가 별도 권한으로 설계. 현재 FE `EDITOR|VIEWER|DENIED`를 운영 역할 표준으로 자동 확정하지 않는다.
4. 세션 만료·재인증·로그아웃·조직 변경·탈퇴 시 권한 재평가, 캐시 제거, 토큰 회수·로그 무효화 계약 필요.
5. 로그인/사용자 보유 정보의 재설정은 실제 이메일 소유 확인과 보안 통제가 없는 현행 인메모리 흐름을 복제하지 않는다. 비밀번호 저장·MFA·재설정은 보안 담당자 설계 필요.

## 3. YouTube 권한과 플랫폼 사용권

- **공개 데이터 조회와 채널 소유자 권한은 별개**
  - 공개 영상 관측만으로 충분한지 먼저 확인.
  - 확인 전에는 사용자에게 Google OAuth를 필수로 요구하지 않음.
  - 소유자 전용 데이터에 접근할 경우 최소 API scope·동의 목적·토큰 수명·회수를 정책 담당자와 결정.

- **현재 프론트엔드의 권한 상태는 시뮬레이션**
  - 상태: `not-connected`, `review`, `approved`, `denied`, `cancelled`, `expired`.
  - 실제 OAuth Callback의 `state`, nonce/CSRF, scope/issuer/audience, 토큰 만료를 검증한 증거가 아님.
  - **남은 테스트:** Scope mismatch는 T04의 부분 공백.

- **YouTube 플랫폼 정책은 아직 승인되지 않음**
  - **검토 대상:** YouTube API Terms/Developer Policies, Branding Guidelines.
  - **데이터 관리:** 보관, 갱신·삭제, 이용자의 삭제 요청 반영.
  - **현재 증거:** 현행 정책 검토 완료 증거 없음.
  - **현재 처리:** G01-E에 따라 `POLICY_HOLD` 유지.
  - **활성화 전 기록:** 담당자, 정책 버전, 승인 범위, 재검토 기한.

- **출처별 지표를 섞지 않음**
  - Steam과 YouTube 수치를 승인 없이 합산하거나 통합 점수·순위를 만들지 않음.
  - API가 직접 제공한 값과 YUTOPIA의 파생 계산을 분리해 표기.

- **보관·인용·브랜딩 제한**
  - 원문 수정·삭제·비공개 및 인용·브랜딩 사용권을 주기적으로 확인.
  - 조회 가능하다는 사실만으로 보존·재전송이 허용된 것은 아님.

**정책 참조**

- [G01-E YouTube Audit Gap](https://app.notion.com/p/3e379b3cd8e6816095c1d89599a3e0e7)
- [YUTOPIA 기준선](https://app.notion.com/p/3f979b3cd8e6813cb5ddef402778c7c6)
- **주의:** 이 문서는 법적 검토를 대행하거나 승인하지 않음.
## 4. 수집·원본·Lineage·데이터 최소화

- 동결 Scope → collection run → 외부 request → raw response reference → normalization → normalized observation의 계보를, 실제 저장이 허용되는 범위에서만 재현 가능하게 보존한다. 비밀값은 Raw/감사 로그에 포함하지 않는다.
- `source`, `source_id`, `observed_at`, `retrieved_at`, `coverage`, `availability`, `raw_or_derived`, `policy_state`, `lineage`를 각 결과와 연결. 데이터가 없거나 차단된 경우 수치 0을 만들지 않는다.
- Raw 원문과 정규화/파생 결과를 별도 데이터 계층으로 처리하고 소스 변경/삭제/차단 이벤트를 전파한다. 단, Raw 보관 자체가 약관 위반인 경우 저장/파생보다 정책 게이트가 우선한다.
- 보관 기간, 저장 지역, 암호화 키, 백업/복제, 삭제 요청 처리, 개인식별정보 취급, 재수집 주기는 미결정이다. 정책 보유자 서명 전 **임의 TTL 또는 무기한 저장 설정 금지**.
- 외부 데이터 소스의 멸실/비공개/재수집 제한 상태에서는 오래된 내용을 무조건 재제공하지 않는다. 정보 접근/처리 가능성과 사용권을 별도의 조건으로 관리한다.

정본 참조: [공통 데이터 관측·수집·Lineage 계약](https://app.notion.com/p/3be79b3cd8e6815cb8ebfb9f1bf95408).

## 5. 댓글 감성·근거·사람 검토

- 댓글 분류·이슈 집계는 파생 데이터이며 원시 댓글/분류 완료/제외·보류/미분류 분모를 보존해야 한다. **합성 `SYN-*` 댓글**은 어디에도 실제 수집·검증된 자료로 승격될 수 없다.
- `PERF-001`: 댓글 속 프레임 저하 *호소 표현*의 관측 후보. 실제 게임 결함은 기술 재현·환경 정보·검토 승인 없이는 미확정. `PAY-002`: 동질 표본 비교가 없어 “과금 불만 증가” 주장은 `HOLD`, 확정 결론/공유에서 제외.
- 근거 `MISSING|DELETED|EXPIRED|STALE|ACCESS_DENIED|SYNTHETIC|BLOCKED`는 실증 검증 대상으로 인정되지 않는다. `AVAILABLE` 역시 정확한 권리·출처·무결성과 검토 권한 통과가 필요하다.
- 클라이언트 리뷰 메모·감사 actor `DEMO_REVIEWER_UNAUTHENTICATED`는 공식 사람 승인으로 인정되지 않는다. 서버는 신원 인증·역할·판정·이전 상태·근거 스냅샷·조작 저항성 있는 기록을 별도로 보유해야 한다.
- 완료된 Kanban Task, `realWorldVerified` claim, `formallyApproved` report는 서로 다른 상태 축으로 격리한다. 정책 금지 판정은 Task 진행 상태와 무관하게 우선한다.

## 6. LLM/MCP·외부 도구 및 보고서 공유

**현재 상태:** ChatGPT/Claude = `UNAVAILABLE`, MCP = `POLICY_BLOCKED`, 내부 AI = 결정적 **브라우저 시뮬레이션**. `AllowedEvidenceBundle`에는 `realWorldVerified:false`인 합성 근거만 있으며 마스킹 후 프롬프트에서 합성 원문을 제외한다. `ReportDraft`는 항상 `formallyApproved:false/shareable:false/exportable:false`다.

**BE_PROPOSED activation gate:**
1. 자료의 소스별 이용 권한·전송 목적·고객 동의·보관 정책·외부 제공업체 데이터 처리 조건과 범위 확인.
2. 서버에서 원문 사용권/실제 근거 가용성/승인 판정/마스킹을 다시 평가; 브라우저가 보낸 `includedInPrompt`나 `allowedObservationIds`를 단독 승인 근거로 신뢰 금지.
3. 외부 업체·tool별 최소권한, 허용 필드 allowlist, 지역·보관 정책, redaction 검사, 개인식별정보 필터링, 최소한의 실패 안전 동작.
4. 승인된 보고서 ID/버전·근거 스냅샷·승인자·소유 조직 검증 후에만 내보내기·링크 공유 API를 별도로 허용.
5. 미승인·HOLD·가용성 상실·삭제·접근 제한 상태가 되면 보고/AI 기능에 **Fail Closed** 적용; 원문이나 생성 결과를 로그에 남기지 않는다.

## 7. 데이터·보안 로그/운영 통제 (BE_PROPOSED)

- 요청 추적 ID, 서버 actor ID, 프로젝트 ID, resource 버전, action/status/reason, UTC 시각, 정책 버전, 허용/거절의 근거 해시/참조를 구조화 로그로 남긴다. 실제 원문·자격 증명·전문 프롬프트는 제외.
- 조직 외 접근·BOLA, 권한 상승, 토큰 회수/만료, 재시도 폭주, quota, 만료 데이터 인용, 외부 모델 데이터 유출, 회수된 공유 링크/보고서 노출을 위협 모델에 포함한다.
- CI/CD, 비밀 회전, 데이터 백업/복원, 감사 로그 변경 방지, 사고 대응, 법무/보안 책임자, 개발/스테이징/운영의 분리 여부는 공동 검토로 확정한다.
- HTTP API가 배포된 적이 없으므로 TLS/헤더/CORS/CSP/Rate limit/감사 기능이 실제 적용됐다는 주장은 금지.

## 8. 활성화 차단 게이트

| Gate | 조건 | 현재 |
|---|---|---|
| SG-01 | 운영 신원·조직 소유권·세션 설계와 검증 | **BLOCKED** |
| SG-02 | OAuth 필요성·scope·동의·토큰 회수 | **DECISION_REQUIRED** |
| SG-03 | YouTube/G01 이용 권리·보관·삭제·파생 승인 | **BLOCKED** |
| SG-04 | 수집 Job·Raw/Lineage·quota·재시도 보안 | **NOT_IMPLEMENTED** |
| SG-05 | 인증 reviewer·감사/검증 승인·claim provenance | **NOT_IMPLEMENTED** |
| SG-06 | LLM/MCP 제3자 전송·보고 내보내기 정책 | **BLOCKED** |
| SG-07 | 운영 배포·침투/접근성/계약/통합 테스트 | **NOT_TESTED** |

모든 Gate의 승인 주체·근거 URL·결정 날짜·버전·유효 범위를 함께 남겨야 한다. **UI에서 버튼이 동작한다는 이유만으로 Gate를 해제하지 않는다.**
