# UI-R04-AC — YOUTOPIA 일반 사용자 UI / 개발자·QA UI 분리

작성 기준: 2026-11-05 KST
부모: Draft PR #91, HEAD fde6eee833f1a689d1dc8f59758ff117ee19b931
범위: 사용자 UI 정리 + 개발용 진단 기능의 별도 진입점 + 자동/수동 회귀 QA. 실제 YouTube Data API, 운영 키·Cloud, 병합/배포는 승인되지 않음.

## 1. 기존 UI 전수 조사 및 결정

| 기존 항목 | 결정 | 근거 |
|---|---|---|
| 영상·채널 URL 입력 / 드래그 앤 드롭 | 유지 | 사용자의 주 진입 동작 |
| 그래프, 노드 검색·필터·그룹·북마크·미니맵 | 유지 | 사용자 탐색 기능 |
| 집중 모드, 대상 목록·상세 도킹, 너비 조절 | 유지 | 실제 사용성; R04-AD에서 중복 패널 통합 검토 |
| 등록 URL 컬렉션·패널 확대·제거 | 유지 | 대상 관리 기능 |
| 제목 별칭 직접 수정·채널 이미지 URL 직접 입력 | 유지(보조 기능) | 사용자가 작성한 텍스트와 제공자 확인 정보를 구분 |
| 공개 이미지 미리보기 동의 버튼 | 유지 | 외부 CDN 이미지 요청은 별도 명시 동의 필요 |
| A/B 비교·주제 탐색, 저장된 탭 세션, 분석 링크 | 유지 | 이미 동작하는 탐색 기능; R04-AD에서 정보구조 재검토 |
| 최근 대상 및 데이터 범위 보기(기본 접힘) | 유지 | 데이터의 출처·관측 범위를 설명하는 사용자 신뢰 정보 |
| 실제 데이터·댓글 수집을 하지 않는다는 고지 | 유지 | 아직 제품은 합성 예시 상태이므로 오해 방지 필수 |
| R04-W '합성 정보 미리보기' 버튼 | 진단 도구로 이동 | 일반 사용자의 기능이 아닌 로컬 fixture 테스트 |
| R04-Y 'Spring 합성 연결' 버튼·서버 응답 상태 | 진단 도구로 이동 | 운영 계정/실 metadata API가 아닌 localhost 테스트 |
| R04-AA '메타데이터 상태 QA', READY/NOT_FOUND/FAILED/STALE 선택·새로고침 | 진단 도구로 이동 | 오류/수명주기 검수용 개발 인터페이스 |
| 그래프·카드·상세의 합성 상태 코드 | 진단 모드에서만 | 일반 UI에는 검증 코드 대신 미확인 제목/중립 설명 |
| Hero의 'REGISTERED VIDEOS (FIXTURE)', 'SYNTHETIC CHANNELS', 'OFFLINE DEMO ONLY' 숫자 표시 | 일반 화면에서 제거, 진단 화면 유지 | 일반 사용자 작업 공간에 내부 fixture 설명 불필요 |
| 그래프 툴바의 'EXPLORER / X UNVERIFIED TARGETS' | 사용자 문구로 변경 | '등록 대상 X개 · 정보 확인 전'처럼 명료한 표현 |
| 일반 화면의 QA 기능이 패널을 점유하는 문제 | 통합 진단 도크로 이동 | 일반 그래프 공간을 확보 |

## 2. 분리된 정확한 라우트/빌드 게이트

**일반 사용자 경로:** /analysis/youtube/workspace

- AppRoutes는 AnalysisWorkspacePage를 diagnosticsMode=false로 렌더링한다. 이 값은 Vite 개발 플래그와 관계없이 변경되지 않는다.
- 모든 합성 응답/상태 QA 동작이 diagnosticAccess=false로 차단되므로, 같은 개발 서버에 Spring 테스트 프록시가 있어도 사용자 URL 등록에서 Spring fixture로 자동 GET하지 않는다.
- 그래프/목록/상세에는 일반 등록 대상과 수동 별칭만 유지. 내부 시나리오·스키마 코드와 합성 응답/fixture 카운터는 표시하지 않는다.

**개발·QA 경로:** /analysis/youtube/workspace/diagnostics

- import.meta.env.DEV === true 이고 VITE_R04AC_DIAGNOSTICS=enabled인 경우에만 AppRoutes에 등록됨. 프로덕션 빌드 또는 개발자 플래그 미설정 시 React의 진단 경로는 등록되지 않아 NotFound 흐름으로 이동한다.
- 별도 경로의 AnalysisWorkspacePage만 diagnosticsMode=true를 받는다. 여기서도 user-facing URL 등록/그래프/도킹 구조는 공유하지만 QA 버튼은 집중 모드 상단의 **개발자 진단 열기** 버튼 하나에 수납한다. 처음에는 접힌 상태.
- 진단 도구에서 R04-W 로컬 합성, R04-Y Spring 합성, R04-AA 메타데이터 상태 QA/시나리오/수동 새로고침을 사용한다. 기존 기능과 각 QA 플래그는 그대로 유지.
- R04-Y Spring 합성 HTTP 모드는 기존 VITE_R04Y_SYNTHETIC_HTTP=enabled, R04-AA 상태 시나리오는 추가 VITE_R04AA_METADATA_STATES=enabled 설정이 필요하다.
- 테스트 코드는 같은 실행 환경에서도 일반 화면에 QA 컨트롤이 없는지와 네트워크 요청이 0건인지 검증한다.

**보안 해석:** 이 라우트 분리는 사용자 인터페이스/개발 빌드 표면의 격리다. 클라이언트 환경변수는 서버 인증이나 관리자 역할을 대체하지 않는다. Spring 합성 서버는 기존의 테스트 소스만 사용하고 127.0.0.1에 바인딩되며 운영 Boot JAR·SecurityConfiguration을 변경하지 않는다. 브라우저에서 보안 데이터를 읽을 권한을 새로 부여하는 작업이 아니다.

## 3. 변경 범위와 API 동작 보존

- AppRoutes/AppShell: 정확한 개발 전용 경로를 조건부 등록하고, 진단 경로에서도 그래프 집중 레이아웃 유지.
- AnalysisWorkspacePage: 기존 R04-W/Y/AA 합성 모드는 diagnosticAccess 전제에서만 활성화·렌더링. 비밀키·실 YouTube 호출 경로 없음.
- WorkspaceHero: 일반 화면에서 합성·서버·상태 QA 버튼 열 삭제, 내부 fixture 카운터 숨김. URL 등록과 사용자 동의 버튼 유지.
- WorkspaceFocusMode + 새 WorkspaceDiagnosticsDock: QA 버튼을 별도 접이식 진단 오버레이로 분리. 실험 종료·일반 사용자 화면 복귀 링크를 제공.
- WorkspaceUrlCanvas: 사용자 관점 그래프 상단 문구를 한국어로 정리.
- 기존 React R04-W/Y/AA 통합 테스트: 반드시 새로운 진단 라우트와 명시적 QA 플래그를 사용하며 도크를 먼저 연 뒤 시나리오 수행. 개발·테스트 기능은 삭제되지 않음.
- 기존 사용자 분석·일반 그래프·클라이언트 URL 파싱·별칭 우선순위·캐시·Spring 합성 응답 계약은 변경하지 않는다.

## 4. 자동 QA 및 수동 QA 인수조건

- 개발자 진단 플래그가 있어도 일반 사용자 경로에 합성/Spring/QA 컨트롤·상태 코드가 없고, URL 등록으로 Spring fixture 요청이 발생하지 않음.
- 진단 플래그 없이 /diagnostics 경로는 React에서 등록되지 않음. 프로덕션에는 진단 경로가 없음.
- 진단 환경에서 버튼 하나로 열린 별도 오버레이는 기본 접힌 상태이며, QA 스위치 3종·4가지 상태·재조회가 기존대로 작동.
- 일반 사용자 화면 전환 시 QA 컨트롤이 사라지고 진행 중인 브라우저 합성 요청은 컴포넌트 unmount로 취소됨.
- React 전체 Vitest, TypeScript 빌드, 확장/공유 계약, 기존 G45-L8 Windows 오프라인 및 별도 pinned Spring 합성 HTTP cross-process CI 모두 PASS여야 함.
- 위 자동 QA는 실제 사용자의 Windows 브라우저 QA를 대신하지 않는다.

개발용 Windows 수동 실행 (별도 frontend worktree, 실제 API 키 불필요):

~~~powershell
cd C:\Projects\YOUTOPIA-R04AC-FE-QA\frontend
$env:VITE_R04AC_DIAGNOSTICS = "enabled"
$env:VITE_R04Y_SYNTHETIC_HTTP = "enabled"
$env:VITE_R04AA_METADATA_STATES = "enabled"
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
~~~

일반 사용자 화면에서는 /analysis/youtube/workspace로 접속해 일반 URL 등록·탐색·상세 기능을 확인한다. 개발용 화면에서는 /analysis/youtube/workspace/diagnostics로 접속 후 '개발자 진단 열기'를 누르고 이전 합성 테스트 절차를 실행한다. Spring 테스트 서버는 별도 PR #90 exact SHA로 백엔드 별도 worktree에서 runR04XSyntheticMetadataLoopback 실행한다.

## 5. 남은 UI 정리 범위와 운영 게이트

이번 단계에서는 사용자 UI의 큰 그래프·도킹 레이아웃 전체나 A/B 분석 페이지를 재설계하지 않는다. 다음 R04-AD에서 대상 목록/그래프/상세의 중복 패널을 정리하고 리사이즈·작업 공간 비율·접근성·모바일 UI를 독립 검수할 수 있다.

실제 Google API 키 프로비저닝/조회, 데이터 캐시·영속 저장, YouTube 실 조회, 정책 POLICY_HOLD·liveCallsAuthorized=false 변경, PR 병합·배포는 별도 명시 승인 대상이다.

현재 판정 (CI 검증 전): USER_AND_QA_UI_SPLIT_IMPLEMENTED / DEV_DIAGNOSTIC_ROUTE_ONLY / PROVIDER_IO_0 / MERGE_NOT_APPROVED.
