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

- **실제로 있는 것:** Vite 8/React 19/TypeScript 기반의 12화면 인터랙티브 **로컬 데모**, React Router, Light/Dark, 인메모리 시나리오/권한/이슈/보고서 모델. 브라우저에서 데모 흐름과 상태 전이가 검증되었다.
- **코드로 확인되지 않은 것:** 운영 인증·프로젝트 영속화·실제 OAuth 토큰·YouTube 원문 조회/수집·분류 추론·DB·Queue/Worker·검증된 사람 승인·서버 감사·실제 외부 LLM/MCP·보고서 다운로드/공유.
- **Codex 제출 테스트 증거:** Vitest **92/92**, Chromium Playwright **40/40**, TypeScript/빌드 PASS. `SIMULATED` 및 `LOCAL_BROWSER_E2E`로만 분류하고, `PRODUCTION_INTEGRATION`은 **없음**. 이 문서 작성 과정에서 로컬 실행을 재현했다고 주장하지 않는다.
- **제품 흐름:** 공개 출처·정책 고지(디자인 94) → 12화면 고객 관측·이슈·보고(93) → 주간 검토(91) → 의사결정 확장(90). 인증/데이터 정책과 관리자 지원(92)은 수평 지원 계층. 90~92,94의 연구 프레임을 P0-1 추가 애플리케이션 라우트나 실서비스 기능으로 간주하지 않는다.
- 서비스 로그인과 **선택적 YouTube 채널 연결**을 별개로 처리한다. 공개 영상 분석을 위해 임의의 Google OAuth를 필수화하지 않는다.

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

파일 기본 경로는 `frontend/src/pages/`. 경로 정의 `frontend/src/app/routeDefinitions.ts`와 실제 라우트 `frontend/src/app/AppRoutes.tsx`가 원본이다. `frontend/src/features/project-demo/`의 `ProjectDemoProvider.tsx`, `ReviewWorkflowProvider.tsx`, `nexusDemoData.ts`, `trendEvidenceModel.ts`, `issueBoardModel.ts`, `reportDemoModel.ts`가 현행 상태/데이터 계약의 직접 근거다.

## 4. 실제 데이터 소유권 및 서버 경계 (제안)

1. 프론트: UI, 테마, 입력 클라이언트 검증, 비동기 상태 표시, 안전한 실패 및 DEMO/실환경 구분.
2. 서비스 백엔드: 인증 세션, 프로젝트/조직 소유권, API 인증/인가, 영속 프로젝트, 수집 작업 제출과 일관된 상태, 데이터 provenance 및 감사 기록의 권위.
3. 수집 Worker/Adapter: 플랫폼별 접근 권한 확인, Scope 버전화, Quota/부분 결과/재시도, Raw/정규화 계보, 삭제·갱신 이벤트 반영. 기술 스택·Queue 방식은 미결정.
4. 분석/근거 서비스: 분류 파이프라인 버전, 실제 분류 완료 여부, 출처·표본·검증 상태, 조건부 비교 판단, 사람 검토와 이슈 상태를 분리.
5. 보고/외부 모델 연결: **허용된 근거만 서버 측 필터링**하고 명시적으로 승인된 정책·권한·감사 경로에서만 동작. 현재는 모두 HOLD.
6. `shared/`의 소유자, 계약 생성 방식, DB/호스팅, 민감정보 관리 및 제품 백엔드 저장소/브랜치는 백엔드 담당자와 협의 전 고정하지 않는다. 기존 별도 GameObservatory 코드는 자동 병합하지 않는다.

## 5. 착수 순서 제안

- **Gate A — 공동 계약 검토:** 엔드포인트 후보·필드·분모·상태·세션·오류·권한/고지 및 미결정 레지스터 확인. 책임자 지정.
- **Gate B — 백엔드 기반:** 운영 세션/사용자/프로젝트 소유권, 프로젝트 CRUD, 계약 테스트, 비밀/환경 구분. 프론트 데모 로그인과 운영 세션 분리.
- **Gate C — 수집 구현:** Source Scope → Collection Run → External Request → Raw Response → Normalization → Observation 계보, 부분/실패/재수집/삭제; 사용권 검토 Gate를 통과한 범위만 활성화.
- **Gate D — 분석·검증:** 명시적 분석 완료 모델, 분류 분모, 비교 적합성, 근거 사용 가능성, 실제 사람 판정·감사 경로.
- **Gate E — 보고서:** 보고 초안 → 사람 승인 → 조건을 만족한 공유·내보내기. 제3자 모델 전달은 별도 정책 Gate.

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

- 프론트 체크포인트 `344c1e…`를 참조 기준으로 고정하되 이 문서만으로 코드를 변경하지 않는다.
- 별도 문서 브랜치에서 본 여섯 계약을 `DRAFT`로 게시하고 프론트 PR이 `frontend`에 통합된 뒤 **문서 전용 PR**을 생성한다. 승인 전 `main/dev/frontend`를 직접 변경하지 않는다.
- 백엔드 검토자는 `02_API_CONTRACT.yaml`의 경로를 배포된 경로로 해석하지 않는다. 양측 공동 검수, schema lint, consumer/provider 계약 테스트, 정책 승인 후에만 `APPROVED`를 사용한다.
- PR 병합 확인 후 임시 문서 브랜치를 삭제할 수 있다. 원격 코드의 실제 배포/사용자 공개와 PR 병합은 별도 절차다.

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
