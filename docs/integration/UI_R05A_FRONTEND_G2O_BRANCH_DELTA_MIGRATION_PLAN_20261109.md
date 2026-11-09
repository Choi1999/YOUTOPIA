# UI-R05-A — frontend ↔ G2-O 브랜치 차이 및 선택적 이관 계획 (2026-11-09)

- 상태: 분석 기준선 동결 / 문서만 작성 / 구현 및 병합 미실행
- 목적: 기존 노드 그래프와 Chrome 확장을 살리면서 실제 키워드·댓글 분석 기능을 연결할 수 있는 **충돌 없는 이관 순서** 제시
- Target base: frontend, HEAD ffa5115c37cf719946aae8d764aa0cd1f630a248
- Source: feature/yu-video-g2o-observed-expression-candidates-v01, HEAD 72a28f638c32fadff71acf35e4fdba5062c4d6b5
- Git merge base: 372486707eb04350faa28af0d86e3b2eb2f50f82
- GitHub Compare: https://github.com/Choi1999/YOUTOPIA/compare/frontend...feature/yu-video-g2o-observed-expression-candidates-v01

## 1. 저장소 비교 (스냅샷, 검증 범위)

GitHub compare 결과: status=diverged, **source가 frontend에 대해 ahead 242 / behind 310**, 변경 파일 통계 125개 반환. 이는 두 HEAD를 비교한 **해당 시점의 브랜치 비대칭성**이지 242개 커밋을 통째로 병합하라는 제안이 아니다. 기준 커밋이 바뀌면 비교를 재실행한다.

- G2-O 브랜치에는 순수 분석 모델·검색/댓글 클라이언트·웹형 관측 페이지·실험용 로컬 Node 서버 및 영상 판정 실험 자산이 있다.
- frontend 브랜치에는 R04의 전체 화면 집중 그래프·도킹·Node 그룹·미니맵·북마크·메타데이터/세션·선택적 Spring 로컬 프록시가 있다.
- G2-O의 frontend/src/features/analysis-workspace/WorkspaceFocusMode.tsx 및 WorkspaceUrlCanvas.tsx 등 **기존 그래프 엔진 파일은 없다**. 따라서 G2-O 브랜치를 제품 브랜치의 새 HEAD로 단순 덮어쓰면 Graph-First UX가 사라진다.
- 두 브랜치의 extension/manifest.json, extension/panel-selection-contract.js, extension/web-analysis-link.js는 확인한 Blob SHA가 같았다. G2-O의 새 웹형 UI에는 그래프 오픈/추가 handoff가 구현되지 않았다.
- G2-O의 AppRoutes.tsx는 /analysis/youtube/trend-keywords 및 /analysis/youtube/evidence-explorer를 추가했지만 기존 frontend의 /analysis/youtube/workspace 및 diagnostics 전용 라우팅, /account/server를 포함하지 않는다.
- G2-O의 vite.config.ts는 localhost 8787로 discover/comments를 프록시한다. frontend의 vite.config.ts는 opt-in localhost 8765 synthetic/metadata 및 선택적 localhost Spring auth 프록시, 환경변수 Gate를 다룬다.

## 2. 파일별 작업 지침 — Keep / Port / Compose / Defer

| 파일/모듈 | frontend | G2-O | 전략 / 이유 |
| --- | --- | --- | --- |
| frontend/src/features/analysis-workspace/WorkspaceFocusMode.tsx | 보유 | 없음 | **KEEP**. 기본 집중 모드·포커스/키보드·도킹 계약 |
| frontend/src/features/analysis-workspace/WorkspaceUrlCanvas.tsx | 보유 | 없음 | **KEEP+ADAPT**. URL 등록 노드 유지, 신규 virtual projection은 별도 계층 |
| frontend/src/features/analysis-workspace/workspaceUrlTargets.ts | 보유 | 없음 | **KEEP**. VIDEO/CHANNEL/HANDLE과 URL 정규화, 128개·32개/입력·2시간 TTL 보호 |
| frontend/src/features/analysis-workspace/workspaceDockState.ts | 보유 | 없음 | **KEEP**. 도킹/선택 상태를 신규 분석 panel과 연결 |
| frontend/src/features/analysis-workspace/workspaceGraphNavigation.ts | 보유 | 없음 | **KEEP**. 그래프 이동/기록/미니맵 탐색 행위 |
| frontend/src/features/analysis-workspace/workspaceRelationGraph.ts | 보유 | 없음 | **KEEP**. 합성 등록 관계 모델은 실제 검색·동반출현 관계와 분리 |
| frontend/src/app/AppRoutes.tsx | workspace, auth, diagnostics 보유 | keyword/evidence 추가, 기존 workspace·auth·diagnostics 없음 | **COMPOSE**. 기존 경로 전부 보존, G2-O 새 경로만 필요한 경우 별도 추가 |
| frontend/src/app/routeDefinitions.ts | YU-50 workspace | YU-49/YU-51 local pages | **COMPOSE**. YU-50을 제거하거나 YU-51과 충돌시키지 않음 |
| frontend/src/layouts/AppShell.tsx | 그래프·R04 메뉴 포함 | 새 로컬 관측 메뉴 추가 | **COMPOSE**. 기본 Graph-First 진입; 필요 시 관측 패널 메뉴를 보조로 배치 |
| frontend/vite.config.ts | opt-in auth/metadata local proxy | default localhost 8787 API proxy | **REVIEWED COMPOSE ONLY**. 절대 통째로 복사하지 않음 |
| frontend/src/features/trend/userKeywordTrend.ts | 없음 | G2-K | **PORT PURE**. CSV/정확 일치/UTC 창 보존 |
| frontend/src/features/trend/relatedKeywordAnalysis.ts | 없음 | G2-N | **PORT PURE**. 사용자가 승인한 관련 표현 및 중복 제외 계산 |
| frontend/src/features/trend/observedExpressionCandidates.ts | 없음 | G2-O | **PORT PURE**. 근거 기반 단순 동반 단어, 동의어로 승격 금지 |
| frontend/src/features/trend/videoCommentComparison.ts | 없음 | G2-M | **PORT PURE**. 표본 분모·비율·기간 유지 |
| frontend/src/features/trend/youtubeSearchClient.ts | 없음 | G2-L | **DEFER GATED I/O**. API 경계 승인 전 의존성만 분석 |
| frontend/src/features/trend/youtubeCommentClient.ts | 없음 | G2-M | **DEFER GATED I/O**. 3개 영상/100댓글/첫 페이지/명시 클릭 계약 확인 |
| frontend/src/pages/analysis/KeywordTrendExplorerPage.tsx | 없음 | G2-O | **DO NOT WHOLESALE PORT**. 웹형 레이아웃을 그래프 메인으로 복제하지 않음; 하위 상세 컴포넌트만 추출 |
| extension/manifest.json / sidepanel.js / background-entry.js | 기존 사용자 선택과 STATIC_FIXTURE 공급자 | 실질 동일 | **KEEP**. manifest 권한·합성 데이터 provenance 변경 없음 |
| extension/web-analysis-link.js | 영상·채널 상세/비교 localhost 링크 | 동일 | **TARGETED EXTEND**. R05-C에서 FOCUS/ADD handoff URL 빌더 추가 |
| shared/experiments/yu-video-understanding-poc-v0/g2l-youtube-search-proxy.cjs | 없음 | G2-L/M 개발 프록시 | **ISOLATE**. 정책 승인을 받기 전 제품 프록시·백엔드로 자동 흡수하지 않음 |
| shared/contracts/yu32-youtube-readiness-v0/policy-gates.json | POLICY_HOLD/liveCallsAuthorized=false | 동일 공통 계층 | **UNCHANGED**. 독립 로컬 실험 실호출과 제품 정책 승인은 별개 |

## 3. 발견된 충돌 — 해결 규칙

### C01. 라우팅·페이지 정체성

- frontend의 전체 화면 그래프 경로 /analysis/youtube/workspace 유지.
- G2-O의 /analysis/youtube/trend-keywords는 **보조 화면 또는 단계적 이관 대상으로** 보존 가능. 메인 홈으로 승격하거나 기존 workspace를 삭제하지 않는다.
- dev diagnostics는 제품에서 숨긴 기존 opt-in Gate를 유지한다.
- /account/server 및 연결된 provider/session 기능은 손실 금지.

### C02. 두 개발 프록시의 설정 충돌

- frontend: VITE_R04Y_SYNTHETIC_HTTP opt-in 포트 8765, R04AO_LOCAL_AUTH_PROXY opt-in과 명시 포트, auth/metadata 정확한 경로만.
- G2-O: /api/youtube/discover 및 /api/youtube/comments 기본 localhost 8787.
- 금지: vite.config.ts 덮어쓰기, 넓은 /api/* passthrough, auth/metadata/YouTube 경로 혼용, API key 브라우저 노출.
- R05-E는 **명시적 개발 플래그·정확한 경로 두 개·loopback target**만 추가하도록 별도 설계/보안 검수한다. origin/host/click-header/예산 차단의 실제 동작을 각각 시험한다.
- 기존 Spring 개발 프록시는 R05-E 작업으로 수정하지 않는다.

### C03. 노드 의미와 로컬 저장

- 기존 등록 URL 노드는 VIDEO/CHANNEL/CHANNEL_HANDLE이므로 KEYWORD/EXPRESSION/EVIDENCE_SET은 신규 virtual graph projection으로 표시한다.
- R04 sessionStorage의 TTL·제한·타입 검증·고정 상태를 변경하지 않는다.
- 가상 키워드/표현은 해당 관측 세션과 출처에 종속, CSV와 YouTube 표본 사이 암묵적 합산 금지.
- 개발 단계에서 ADD가 일어나더라도 사용자 확인 없이는 R04 URL 저장소나 이후 서버 프로젝트를 변경하지 않는다.

### C04. 확장 선택 고정과 Graph FOCUS/ADD

- 확장 Hover는 임시 선택. Side Panel 핀은 사용자가 클릭했을 때만 고정된다.
- existing extension/web-analysis-link.js는 VIDEO 11자, CHANNEL UC+22자만 허용한다. 이것을 기준으로 R05-C handoff를 구현한다.
- 워크스페이스에 전달하는 데이터는 targetType/targetId/version/FOCUS(또는 ADD intent)처럼 최소화한다. URL이 전달자의 신원을 증명하지 않는다.
- FOCUS는 임시 선택, ADD는 그래프 내 명시 확인 이후에만 저장. Side Panel TTL 만료는 저장 노드 삭제가 아니다.

### C05. 두 분석 계열의 '근거' 차이

- 합성 fixture/등록 관계와 실제 공식 API 첫 페이지 표본은 **sourceKind 별개의 provenance**를 가진다.
- G2-O 단어 동반 출현은 동의어가 아니며, G2-M 댓글 최신 첫 페이지는 전체 영상 댓글 분포나 상승 추세를 말하지 않는다.
- 메타데이터 미확인, 오류, 차단 상태는 0건으로 변환하지 않는다. 그래프의 선·차트·제목·썸네일을 허위 생성하지 않는다.

### C06. 번들·테스트·버전 불일치

- 전체 merge 대신 **작은 테스트 포함 PR로 단계적 이관**한다. G2-O의 434 React 테스트와 G2-L/M 12 Node 테스트는 실험 브랜치 성공을 뜻한다.
- 새로운 frontend baseline의 그래프·확장·인증·도킹 테스트를 기존대로 추가 검증해야 한다.
- 첫 이관은 외부 요청이 없는 순수 함수를 복사하고, Vite/Node/Chrome 권한 변경은 뒤로 미룬다.

## 4. 이관 커밋·Draft PR 제안

**R05-A (본 문서)** — frontend를 부모로 별도 설계 브랜치, 문서 2개만 생성. 안전한 마이그레이션 범위와 검수/취소 경계 확정. 실제 운영 동작 없음.

**R05-B1: graph-projection-contract** — frontend 기반 별도 브랜치. 기존 그래프를 깨지 않고 Node/Edge Projection 순수 함수 및 타입·테스트 구현. CPU-only, CSV 오프라인 예시. G2-O 데이터가 비어 있으면 empty state 유지.

**R05-B2: graph-first-UX-integration** — R04 FocusMode 기본·도킹·가상 노드·분석 상세를 통합. 모바일·키보드·북마크·필터 회귀 시험. 기존 2.5D 구현 사용.

**R05-C: extension-hand-off** — 기존 확장 Link 빌더에 Open in Graph/별도 Add intent. strict parser, target ID 검증, no auto-save. Extension Node + Windows Chrome 실기기 검수.

**R05-D: analysis-projection-bridge** — G2-K/N/O 및 M 비교 순수 분석 모듈을 graph detail과 연결. 실제 API 없이 CSV/evidence로 시작. 증거 노드 lazy expansion.

**R05-E: opt-in-live-transport** — 개발용 localhost 8787 프록시·기존 Spring auth proxy의 최소 병합 전략 검수. 별도 제품 정책/권한 승인과 G2-M 남은 3·4번째 영상 QA 이후.

**R05-F: system-level-Windows-QA** — 그래프+확장+선택+표본+계약 보안. 통합 수동 PASS를 독립 기록, 별도 병합 의사결정. 기존 Draft PR #111/#113/#114/#116/#118/#119 자동 병합 금지.

## 5. 최소 QA 매트릭스 및 실패 기준

| 케이스 | 기대 결과 | 검증 surface |
| --- | --- | --- |
| 잘못된 VIDEO/CHANNEL ID 또는 @handle | 불명확 대상은 READY로 승격 금지, ADD 없음 | extension + graph |
| Hover만 이동, Side Panel 열림 | 고정 대상·그래프 저장 상태 불변 | Chrome |
| FOCUS 링크 열기 | 대상 포커스만 전환, 자동 API 호출/저장 없음 | Chrome → Web |
| ADD 링크 열기 | 그래프 확인 UI를 통해 별도 클릭 후에만 추가 | Chrome → Web |
| 동일 영상 중복 ADD | 하나의 canonical node만 생성 | Graph |
| CSV ↔ YouTube 출처 변경 | 다른 출처의 댓글과 분모 혼합 없음 | Graph analysis |
| 선택 표현 추가 | G2-N 원래 문구 수 보존, 중복 제외 합계 | Graph analysis |
| 관측 후보 열기 | G2-O 실제 근거 발췌, 빈 자료에는 가짜 후보 없음 | Graph analysis |
| 표본 API 불가·정책 차단 | 0% 위조 금지, 미확인/차단 상태 표시 | Graph + proxy |
| 그래프 필터/북마크/패널 토글 | 전체 데이터 보존, 노드/포커스/도킹 일관 | React + Windows |
| 좁은 화면·키보드·포커스 복원 | 그래프 접근성 및 창 크기별 동작 유지 | Windows Chrome |
| API 키/댓글 원문 유출 | URL/메시지/storage/로그에 비밀 포함 안 됨 | security |
| G2-M 3번째/4번째 영상·초기화 | 누락 수동 QA 별도 수행; PASS 위조 금지 | Windows live opt-in |

## 6. 기존 증거 출처 (각 SHA 기준)

- frontend / 그래프 기본 라우팅: https://github.com/Choi1999/YOUTOPIA/blob/ffa5115c37cf719946aae8d764aa0cd1f630a248/frontend/src/app/AppRoutes.tsx
- frontend / FocusMode: https://github.com/Choi1999/YOUTOPIA/blob/ffa5115c37cf719946aae8d764aa0cd1f630a248/frontend/src/features/analysis-workspace/WorkspaceFocusMode.tsx
- frontend / URL 대상 계약: https://github.com/Choi1999/YOUTOPIA/blob/ffa5115c37cf719946aae8d764aa0cd1f630a248/frontend/src/features/analysis-workspace/workspaceUrlTargets.ts
- frontend / 확장 웹 Link: https://github.com/Choi1999/YOUTOPIA/blob/ffa5115c37cf719946aae8d764aa0cd1f630a248/extension/web-analysis-link.js
- frontend / 선택 고정 계약: https://github.com/Choi1999/YOUTOPIA/blob/ffa5115c37cf719946aae8d764aa0cd1f630a248/extension/panel-selection-contract.js
- frontend / Vite auth+synthetic 프록시: https://github.com/Choi1999/YOUTOPIA/blob/ffa5115c37cf719946aae8d764aa0cd1f630a248/frontend/vite.config.ts
- G2-O / keyword results page: https://github.com/Choi1999/YOUTOPIA/blob/72a28f638c32fadff71acf35e4fdba5062c4d6b5/frontend/src/pages/analysis/KeywordTrendExplorerPage.tsx
- G2-O / observed expressions: https://github.com/Choi1999/YOUTOPIA/blob/72a28f638c32fadff71acf35e4fdba5062c4d6b5/frontend/src/features/trend/observedExpressionCandidates.ts
- G2-O / limited local API proxy: https://github.com/Choi1999/YOUTOPIA/blob/72a28f638c32fadff71acf35e4fdba5062c4d6b5/shared/experiments/yu-video-understanding-poc-v0/g2l-youtube-search-proxy.cjs
- policy gate: https://github.com/Choi1999/YOUTOPIA/blob/ffa5115c37cf719946aae8d764aa0cd1f630a248/shared/contracts/yu32-youtube-readiness-v0/policy-gates.json

## 7. 완료/미완료의 엄격한 구분

R05-A의 완료 조건은 **두 HEAD·경로·상태 소유권·UI 의미·보안 경계·단계별 작업 순서·QA 매트릭스를 문서화하는 것**이다. 본 문서만으로 Graph-First 실제 화면이 통합되거나 Chrome handoff가 동작하지 않는다.

다음 단계에서 필요한 승인: R05-B1의 순수 GraphProjection 스키마·테스트 도입 및 이어지는 R05-B2의 UI 동작 변경 범위. R05-E의 실제 네트워크 경계 변경과 운영 배포는 각각 더 늦은 독립 게이트다.
