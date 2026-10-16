# YUTOPIA Backend Handoff v0.1 — 제품 범위·책임·인계

> **DRAFT / REQUIRES_BACKEND_REVIEW / NOT IMPLEMENTED** · 2026-10-16
>
> 이 문서는 백엔드 서비스의 구현 또는 승인 증거가 아니다. 원격 프론트엔드 체크포인트 `344c1e2794c4f6144fa7506f65a17c392487c540`의 실제 소스와 승인된 Notion 설계 기준을 대조해 작성한 **공동 검토용 계약 초안**이다. 엔드포인트·DB·OAuth·실제 데이터 수집은 미확정이다.

## 처음 읽는 분께 — 이 문서에서 알아야 하는 것

**백엔드 담당자에게 이 문서가 알려주는 것은 ‘무엇을 만들고, 어디까지가 내 책임인지’입니다.** 웹 화면은 이미 데모로 존재하지만 실제 사용자의 계정·프로젝트·댓글·보고서는 서버에서 저장하거나 검증하지 않습니다. 그래서 이 문서의 API/기술 제안은 **결정된 구현 명령이 아닙니다.**

- 처음 읽는다면 [00 입문 안내서](./00_START_HERE.md) → [02 API 쉽게 읽기](./02_API_EXPLAINED.md) 순서로 확인하세요.
- 코드를 처음 작성한다면 [07 구현 순서 및 한국어 주석 예시](./07_BEGINNER_IMPLEMENTATION_GUIDE.md)를 참고하세요.
- **한 줄로 정리:** 프론트엔드가 “프로젝트 생성”을 요청하면, 백엔드는 서버에서 사용자를 확인하고 입력·소유권을 검증한 뒤 프로젝트를 저장하고 결과를 응답해야 합니다.
- **하지 말아야 할 일:** `nexus-season-2`, 댓글 `12,842`건, `DEMO_REVIEWER`를 운영 데이터로 고정하거나 미승인 YouTube/AI 연동을 시작하는 것.


## 1. 읽기 순서 및 기준점

1. [YUTOPIA 구현 기준선 v1](https://app.notion.com/p/3f979b3cd8e6813cb5ddef402778c7c6) — 제품 범위와 정책 게이트. **2026-10-14 상태 표기는 최신 코드보다 오래됨**.
2. [YUTOPIA 12화면 추적표](https://app.notion.com/p/3f979b3cd8e681cdac18c8c77dab4ec4) — 화면/테스트 식별자. **과거 `NOT_IMPLEMENTED`는 데모 구현 현황을 나타내지 않음**.
3. [백엔드 선공유 인계 패킷](https://app.notion.com/p/3fa79b3cd8e6815599ace128c3189e58) — 서버 책임과 미결정 사항. Cycle 5 시점 내용은 이 문서로 보완.
4. [Figma YUTOPIA Page 93](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1159-10) — 12개 화면, Dark/Light.
5. [G01-E YouTube 정책 공백](https://app.notion.com/p/3e379b3cd8e6816095c1d89599a3e0e7) 및 [수집·Lineage 공통 계약](https://app.notion.com/p/3be79b3cd8e6815cb8ebfb9f1bf95408).

**검증된 소스 기준점:** [frontend P0-1 체크포인트](https://github.com/Choi1999/YOUTOPIA/commit/344c1e2794c4f6144fa7506f65a17c392487c540) · 개발 브랜치 `frontend` · 원격 선공유 브랜치 `feature/yutopia-p0-1-demo` · 제품 표시명 **YUTOPIA**(저장소명 YOUTOPIA 유지). 최신 코드의 원격 선공유와 보호 브랜치로의 병합은 별개다.

## 2. 현재의 증거 수준과 목표 아키텍처

- **실제로 있는 것**
  - **기술 기반:** Vite 8 / React 19 / TypeScript.
  - **화면:** 사용자가 조작할 수 있는 12개 화면의 **로컬 데모**.
  - **화면 전환:** React Router.
  - **테마:** Dark / Light.
  - **상태 관리:** 브라우저 메모리 기반 시나리오·권한·이슈·보고서 모델.
  - **검증:** 로컬 브라우저에서 데모 흐름과 상태 전이를 확인함.

- **코드로 확인되지 않은 것**
  - **운영 인증·승인:** 실제 사용자 인증, OAuth 토큰, 검증된 사람 승인.
  - **데이터 저장·수집:** 프로젝트 영속 저장, YouTube 원문 조회·수집, DB, Queue / Worker.
  - **분석·감사:** 실제 댓글 분류 추론, 서버 감사 기록.
  - **외부 연결·결과물:** LLM / MCP 연동, 보고서 다운로드·공유.

- **Codex가 제출한 테스트 증거**
  - **단위·컴포넌트:** Vitest **92/92**.
  - **로컬 브라우저:** Chromium Playwright **40/40**.
  - **정적 검증:** TypeScript 검사 및 빌드 **PASS**.
  - **증거 분류:** `SIMULATED`, `LOCAL_BROWSER_E2E`.
  - **없는 증거:** `PRODUCTION_INTEGRATION` 결과 없음.
  - **주의:** 이 문서를 작성하며 로컬 테스트를 다시 실행한 것은 아님.

- **제품 흐름**
  - **1단계 · 94번 디자인:** 공개 출처·정책 고지.
  - **2단계 · 93번 디자인:** 12화면 고객 관측·이슈·보고 흐름.
  - **3단계 · 91번 디자인:** 주간 검토.
  - **4단계 · 90번 디자인:** 의사결정 확장.
  - **지원 계층 · 92번 디자인:** 인증·데이터 정책·관리자 지원.
  - **범위 주의:** 90~92번과 94번의 연구·디자인 프레임은 P0-1의 실제 앱 라우트나 실서비스 기능이 아님.

- **서비스 로그인과 YouTube 연결의 구분**
  - **서비스 로그인:** YUTOPIA 사용자 인증에 관한 기능.
  - **YouTube 채널 연결:** 필요한 경우에만 요청할 별도의 권한.
  - **정책 주의:** 공개 영상 분석에 Google OAuth를 임의로 필수화하지 않음.
## 3. 화면 ↔ 프론트 소스 ↔ 제안 백엔드 책임

아래 서버 책임은 **요구사항 제안**이지 승인된 HTTP 계약이 아니다. 세부 요청·응답은 `02_API_CONTRACT.yaml`, 필드는 `03_DATA_CONTRACT.md`, 전이는 `04_STATE_AND_ERROR_CONTRACT.md`를 참조한다.

| 화면 | 현재 프론트엔드 | 백엔드 제안 책임 | 검증/게이트 |
|---|---|---|---|
| YU-01 | `pages/auth/LoginPage.tsx` — 로컬 계정·재설정 | `UserSession`, 인증·세션 종료·조직 역할 | T01~03; 데모 계정은 운영 자격 아님 |
| YU-02 | `pages/youtube/YoutubeConnectionPage.tsx` | 공개조회와 채널 소유자 OAuth 분리, 동의 범위 | T04~05; OAuth 필요성 미결정 |
| YU-03 | `YoutubeConnectionCompletePage.tsx` | 승인 영수증·만료·회수·재연결 | T06; 실제 승인/토큰 없음 |
| YU-04 | `ProjectCreationPage.tsx` | 프로젝트 생성·검증·소유권·영상 선택 | T07; 고정 fixture ID 생산 규칙 아님 |
| YU-05 | `CollectionStatusPage.tsx` | 비동기 수집 실행, 부분/실패/쿼터/재시도 | T08; 실제 Worker 없음 |
| YU-06 | `ProjectDashboardPage.tsx` | KPI, 날짜별 관측, 제외·품질·출처 계보 | T09; 미확정값을 0으로 바꾸지 않음 |
| YU-07 | `CommentAnalysisPage.tsx` | 분류 결과, 다중 이슈 라벨, 원문 식별·수정 | T10~11; 합성 댓글은 실제 원문 아님 |
| YU-08 | `ProjectTrendPage.tsx` | 14일 전후·39일 관측·비교 적합성 평가 | T12; 인과/시장 전체 결론 금지 |
| YU-09 | `EvidenceQualityPage.tsx` | 주장 후보·근거 가용성·사유/보류 | T13~14; HOLD 승격 금지 |
| YU-10 | `EvidenceDetailPage.tsx` | 원문/증거 버전·접근제어·삭제/만료/철회 | T15; 실제 버그 미확정 |
| YU-11 | `IssueManagementPage.tsx` | 서버 소유 검토/담당자/감사 기록 | T16; 작업 완료 ≠ 주장 검증 |
| YU-12 | `AIWorkspaceReportPage.tsx` | 허용 근거 번들, 보고서 초안, 별도 승인·공유 | T17~18; LLM/MCP/다운로드 미승인 |

**코드 위치(확인용)**

- **화면 컴포넌트:** `frontend/src/pages/`
- **경로 정의:** `frontend/src/app/routeDefinitions.ts`
- **실제 라우터:** `frontend/src/app/AppRoutes.tsx`
- **데이터·상태 계약:** `frontend/src/features/project-demo/`
  - `ProjectDemoProvider.tsx`, `ReviewWorkflowProvider.tsx`
  - `nexusDemoData.ts`, `trendEvidenceModel.ts`
  - `issueBoardModel.ts`, `reportDemoModel.ts`

## 4. 실제 데이터 소유권 및 서버 경계 (제안)

1. **프론트엔드**
   - UI, 테마, 클라이언트 입력값 검증.
   - 비동기 상태 표시, 안전한 실패, DEMO/실환경 구분.

2. **서비스 백엔드**
   - 인증 세션, 프로젝트·조직 소유권, API 인증·인가.
   - 프로젝트 영속 저장, 수집 작업 요청과 일관된 상태 제공.
   - 데이터 출처 계보(provenance), 서버 감사 기록의 권위.

3. **수집 Worker / Adapter**
   - 플랫폼 접근 권한 확인과 Scope 버전 관리.
   - Quota, 부분 결과, 실패·재시도 처리.
   - Raw·정규화 계보, 삭제·갱신 이벤트 반영.
   - **미결정:** Worker, Queue 등 실제 기술 방식.

4. **분석·근거 서비스**
   - 댓글 분류 파이프라인 버전과 실제 분석 완료 상태.
   - 출처·표본·검증 상태, 조건부 비교 판단.
   - 사람 검토와 이슈 업무 상태의 구분.

5. **보고·외부 모델 연결**
   - **허용된 근거만 서버에서 필터링**.
   - 승인된 정책·권한·감사 경로를 통과해야 실행.
   - **현재 상태:** 외부 모델 연결과 보고 공유는 HOLD.

6. **공동 결정이 필요한 기반 사항**
   - `shared/` 소유자와 계약 생성·배포 방식.
   - DB·호스팅·민감정보 관리, 백엔드 저장소·브랜치.
   - 별도 GameObservatory 코드의 자동 병합 금지.
## 5. 착수 순서 제안

- **Gate A — 공동 계약 검토**
  - API 후보·필드·분모·상태·세션·오류·권한/고지 검토.
  - 미결정 항목의 책임자 지정.

- **Gate B — 백엔드 기반**
  - 운영 세션·사용자·프로젝트 소유권, 프로젝트 CRUD 및 계약 테스트.
  - 비밀정보·개발/운영 환경 분리.
  - 프론트 데모 로그인과 운영 세션 구분.

- **Gate C — 수집 구현**
  - **계보:** Source Scope → Collection Run → External Request → Raw Response → Normalization → Observation.
  - 부분 실패, 재수집, 삭제 상태 처리.
  - **차단 기준:** 사용권 검토를 통과한 범위만 활성화.

- **Gate D — 분석·검증**
  - 실제 분석 완료 상태와 분류 분모 관리.
  - 비교 적합성, 근거 가용성, 사람 판정·감사 기록.

- **Gate E — 보고서**
  - 보고 초안 → 사람 승인 → 조건 충족 시 공유·내보내기.
  - **차단 기준:** 제3자 모델 전달은 별도 정책 Gate 통과 필요.
## 6. 미결정 레지스터

| ID | 공동 결정 | 확정 전 조건 |
|---|---|---|
| DEC-01 | 소유 저장소/브랜치, `shared/` 계약 배포 방식 | 백엔드 책임자·기준 SHA |
| DEC-02 | 인증 공급자, 조직/역할, 세션 쿠키 vs 토큰 | 위협모델·로그아웃/갱신 규칙 |
| DEC-03 | 공개 YouTube 조회와 채널 소유자 OAuth 구분 | 최소 Scope, 민감정보·동의 |
| DEC-04 | 플랫폼 권리·quota·보존/삭제·파생지표 | G01/E 및 최신 플랫폼 정책 승인 |
| DEC-05 | REST 버전, 비동기 polling/event, idempotency | API 스키마 및 병렬 요청 처리 |
| DEC-06 | 실제 분류 기준, 모델/실측 판정 기준, 검증자 권한 | 분모·정합성·원문 계보 |
| DEC-07 | 보고서의 인용·외부 모델 전송·내보내기/공유 | 정책·사용자 동의·권한·감사 |
| DEC-08 | 서비스 호스팅·DB·CI·observability·SLA | 배포 환경/보안 담당자 |
| DEC-09 | Figma 원본 ZIP과 실 UI 비교 기준 | ZIP 미확보; 픽셀 패리티 보류 |
| DEC-10 | 상위 Game Observatory 출시/업데이트 Intelligence v1과의 제품 소유권 | 임의 통합 금지 |

## 7. 인계/PR 절차

- **프론트 기준점**
  - 커밋 `344c1e…`를 참조.
  - 이 문서만으로 프론트 코드를 수정하지 않음.

- **문서 변경**
  - 별도 문서 브랜치에서 계약을 `DRAFT`로 관리.
  - 프론트 PR이 `frontend`에 통합된 뒤 **문서 전용 PR**을 생성.
  - 승인 전 `main`, `dev`, `frontend` 직접 변경 금지.

- **백엔드 계약 검수**
  - `02_API_CONTRACT.yaml`의 경로를 배포된 API로 해석하지 않음.
  - 양측 공동 검수, 스키마 검사, consumer/provider 계약 테스트 및 정책 승인 필요.
  - 모든 조건을 충족한 뒤에만 `APPROVED`로 변경.

- **병합 이후**
  - PR 병합을 확인한 뒤 임시 문서 브랜치 삭제 가능.
  - PR 병합이 운영 배포나 공개 서비스 활성화를 의미하지는 않음.
## 8. 상세 문서

- [02 — API 후보](./02_API_CONTRACT.yaml)
- [03 — 데이터·계보](./03_DATA_CONTRACT.md)
- [04 — 상태·오류](./04_STATE_AND_ERROR_CONTRACT.md)
- [05 — 보안·정책](./05_SECURITY_POLICY_CONTRACT.md)
- [06 — 수용·계약 테스트](./06_ACCEPTANCE_TEST_CONTRACT.md)


### 처음 읽는 분을 위한 추가 문서

- [00 입문 안내서 — 무엇을 개발하나요?](./00_START_HERE.md)
- [02 API 쉽게 읽기 — 요청·응답 예시](./02_API_EXPLAINED.md)
- [07 처음 구현하는 방법 — 한국어 코드 주석과 테스트](./07_BEGINNER_IMPLEMENTATION_GUIDE.md)
