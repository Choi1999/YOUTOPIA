# UI-R05-A — Graph-First + Chrome Extension + G2-O 통합 계약 v0.1

- 기준일: 2026-11-09 (KST)
- 문서 상태: 설계 계약 / 검토 대상. **런타임 기능 구현·배포·병합을 승인하는 문서가 아님**
- 그래프/확장 프로그램 기준: frontend @ ffa5115c37cf719946aae8d764aa0cd1f630a248
- 실제 댓글 분석 기준: feature/yu-video-g2o-observed-expression-candidates-v01 @ 72a28f638c32fadff71acf35e4fdba5062c4d6b5
- 다음 승인 게이트: R05-B 구현 범위·브랜치/정책 합의 → 각각 Draft PR → 독립 CI → Windows 수동 QA → 별도 병합 승인
- 저장소: https://github.com/Choi1999/YOUTOPIA

## 1. 제품 결정 — One YOUTOPIA, Two Interfaces, One Evidence Layer

**Graph Workspace는 핵심 제품 화면이고 Chrome 확장 프로그램은 YouTube 탐색 중 발견·선택·빠른 확인을 담당한다.** 둘 다 같은 개체 식별자와 검증된 분석 출처를 사용하지만, Hover 선택·Side Panel 고정·그래프 프로젝트 저장은 서로 다른 상태다.

| 표면 | 주 기능 | 하지 말아야 할 것 |
| --- | --- | --- |
| YouTube Content Script / Hover Card | 사용자 시야의 영상·채널 후보 식별, 가벼운 미리보기 | Hover만으로 워크스페이스 추가, 새 유료 API 호출, 미확인 감성 생성 |
| Chrome Side Panel | **사용자가 클릭**한 영상·채널 고정, 허용된 상세 요약, 그래프에서 열기/추가의 명시적 행동 | 다른 영상 Hover로 고정 대상 덮어쓰기, 복잡한 전체 노드 그래프 복제 |
| Graph Workspace | 기본 전체 화면 그래프, 키워드·영상·채널·표현·근거 노드 탐색, 선택 상세 도킹, 비교·그룹화 | 미검증 관계선 생성, 저장과 임시 선택 혼합, 분석 상태를 0으로 위장 |
| 분석·근거 계층 | 검색·표본·관측 기간·출처·검증 상태의 단일 의미 모델 | 확장과 웹에서 다른 분모로 동일 지표 표시, 합성값의 실데이터 승격 |

현재 운영 API와 실제 댓글 백엔드의 공유 세션은 **설계 대상**이다. 기존 확장 프로그램은 기본적으로 STATIC_FIXTURE 합성 공급자이고, G2-L/M 실험은 별도의 로컬 127.0.0.1:8787 프록시다. 이를 이미 통합된 공통 서버라고 서술하지 않는다.

## 2. Graph-First UX 불변식

1. 로그인/허용된 진입 흐름 이후 워크스페이스는 **집중 그래프**를 기본으로 한다. R04의 FocusMode·UrlCanvas·검색·노드 선택·미니맵·그룹·북마크·도킹 상태를 먼저 보존한다.
2. URL 또는 자유 키워드 추가는 사용자의 명시적 행동에서만 발생한다. 검색어 입력만으로 YouTube API를 호출하지 않는다.
3. 그래프를 기본으로 사용하며 **대상 목록/선택 상세/표본 근거**는 필요할 때 도킹한다. 도킹을 열고 닫으면 그래프 공간이 재분배된다. 좁은 화면에서는 오버레이·바텀 시트 우선.
4. 영상 노드의 대표 레이블은 확인된 제목, 채널 노드는 확인된 채널명/승인된 이미지이고 식별자는 보조 표시한다. 메타데이터 미확인은 사용자 정의 레이블 또는 명확한 미확인 표시로 처리한다.
5. 필터가 켜진 경우 일치 노드·관계만 표시한다. **원본 노드/분석·저장 데이터는 삭제하지 않는다.** 노드가 안 보이는 것과 실제 데이터 없음은 별개다.
6. 연결 거리·깊이·색이 유사도·인기도·감성·신뢰도를 뜻하는 듯 표현하지 않는다. 출처 근거와 관계 유형이 없는 선은 만들지 않는다.
7. 기존 2.5D/SVG 그래프를 1차 통합에서 재사용한다. 새 그래프 라이브러리·WebGL 3D 도입은 별도 성능·UX 평가 후 결정한다.

## 3. R05 그래프 데이터 계약 — 기존 URL 대상 모델을 오염시키지 않는다

기존 frontend/workspaceUrlTargets.ts의 WorkspaceUrlKind는 VIDEO / CHANNEL / CHANNEL_HANDLE이다. 등록 URL에는 최대 128개, 한 번에 32개, 2시간 TTL, 유효한 정규 YouTube URL 제한이 있다. G2-O의 KEYWORD·EXPRESSION·EVIDENCE는 해당 기존 URL 목록에 직접 집어넣을 수 없다.

R05-B에서 **독립 GraphProjection**을 만들어 다음 구분을 지킨다.

| node.kind | 식별자 안정성 | 대표 정보 | 근거 출처 |
| --- | --- | --- | --- |
| VIDEO | 검증된 11자 YouTube videoId | 확인된 제목/썸네일; 없으면 미확인 | 공식 search/list 후보, 명시 URL 등록 |
| CHANNEL | 확인된 UC+22자 channelId | 확인된 명칭/이미지; 없으면 미확인 | 공식 동작에서 확인된 channelId만 |
| CHANNEL_HANDLE_CANDIDATE | 사용자 입력 핸들·형식상 후보 | 핸들/미확정 | 채널 ID 확인 전 별도 노드, CHANNEL로 가정 금지 |
| KEYWORD | 이용자 입력+검색 세션별 키 | 이용자 원문구 | 이용자 입력. 제공자 검증값 아님 |
| EXPRESSION | 정규화 문구+표본/주 키워드 범위별 키 | 관측된 동반 표현 | G2-O 문자적 동반 출현. 동의어 추론 금지 |
| EVIDENCE_SET | 출처+videoId+표본 snapshot 식별자 | 표본 건수, 기준 시각, 출처 | G2-M 첫 페이지 최상위 댓글 표본. 댓글마다 노드 남발하지 않음 |
| GROUP | 사용자 지정 로컬 그룹 키 | 사용자 작성 이름 | 사용자 그룹 저장 |

**canonicalId와 presentationLabel 분리**: 표시 제목 변경은 대상 식별자나 원문 댓글 증거를 변경하지 않는다. 동일 videoId의 중복 노드는 같은 대상 키로 정규화한다. KEYWORD/EXPRESSION은 videoId와 충돌하지 않는 타입 접두사와 데이터 범위 구분자를 사용한다.

### 3.1 Relationship 계약 (근거 없는 유추 차단)

| edge.type | source → target | 필요한 증거 | 금지하는 표현 |
| --- | --- | --- | --- |
| RETURNED_BY_SEARCH | KEYWORD → VIDEO | 특정 검색어로 공식 검색 결과에 반환된 videoId, 검색 시각 | 실제 인기·관련성 인과/추천 품질 주장 |
| CHANNEL_PUBLISHES_VIDEO | CHANNEL → VIDEO | 공식 메타데이터에 포함된 확인 가능한 channelId/videoId 쌍 | 핸들 문자열/영상 제목 추측으로 소속 확정 |
| VIDEO_HAS_SAMPLE | VIDEO → EVIDENCE_SET | 명시적으로 수집한 videoId·표본 범위/시각 | 영상 전체 댓글을 대표한다고 표시 |
| LEXICAL_COOCCURRENCE | KEYWORD → EXPRESSION | 선택 표본 내 주 키워드를 포함한 댓글에서 후보 단어 동시 출현, 근거 commentId | 동의어·감성·영향력·확산 주장 |
| USER_GROUP_MEMBERSHIP | GROUP → VIDEO/CHANNEL | 사용자 등록 작업 | 자연발생 관계라고 표시 |

그래프 시각 표시에는 관계 유형마다 선 종류를 구분하고, 선택 시 관계의 **관측 수/분모/기간/기록 출처/갱신 시각/불확실성**을 볼 수 있어야 한다.

관측되지 않은 날짜, API 실패, COMMENTS_DISABLED, NO_DATA, POLICY_BLOCKED, STALE, PARTIAL은 **값 0과 다른 상태**다. 자격/메타데이터 확인 실패 시 미확인 노드를 유지하되 허위 수치를 노출하지 않는다.

## 4. 분석 표본 계약 — G2-L/M/N/O에서 이관

아래는 현재 코드가 실제로 보장하는 범위이며, 전체 YouTube 시계열이나 심층 NLP를 뜻하지 않는다.

- G2-K: 자유 키워드 1~100자; 관측 창 7/30/90일(최근 표본 댓글의 UTC 게시일 기준), 로컬 CSV 최대 2 MiB/5000행.
- G2-L: **사용자 클릭 한 번에** 로컬 검색 서버를 통해 공개 영상 첫 페이지 최대 10개 검색. 검색 후보는 인기 추세 증거가 아니다.
- G2-M: **사용자 선택한 검색 결과 영상** 최대 3개, 각각 commentThreads.list 첫 페이지 최상위 댓글 최대 100개. 댓글 작성자/답글 전체를 포함하지 않는다. 중복·표본 제한·API 실패는 구분한다.
- G2-N: 원래 키워드 정확한 부분 문자열 일치 유지. 사용자가 직접 선택한 관련 표현 최대 5개만 별도 확장, 중복 댓글 제거.
- G2-O: 원래 키워드를 포함한 표본 댓글에서 단순 단어 동반 출현 최대 8개 후보 추출, 후보별 최대 2개의 실제 근거 발췌. AI 의미 판정, 동의어 검증, 긍정/부정 감성 분석 아님.

현재 G2-O의 Observation 모델은 id/videoId/channelId/videoTitle/channelName/publishedAt/text 구조이고, PublicSearchVideo와 CollectedCommentSample은 서로 다른 메타데이터 계약을 가진다. 그래프 도킹은 이 데이터를 **읽기 전용 Snapshot Projection**으로 받아야 하며, CSV와 YouTube 표본은 명시적 출처 선택 없이 합산하지 않는다.

### 4.1 Snapshot Provenance (새 설계 필드 — 아직 구현하지 않음)

~~~json
{
  "schema": "R05_GRAPH_EVIDENCE_SNAPSHOT_V1",
  "sourceKind": "YOUTUBE_API_FIRST_PAGE_PUBLIC",
  "target": {"type": "VIDEO", "id": "AbCdefghI12"},
  "sampleScope": "TOP_LEVEL_FIRST_PAGE_MAX_100",
  "observedAt": "<UTC timestamp supplied by validated reader>",
  "window": {"startDay": "<UTC day>", "endDay": "<UTC day>"},
  "sampledCount": "<validated integer, not a video-wide count>",
  "status": "READY",
  "provenanceId": "<locally computed/session-scoped identifier>"
}
~~~

위 필드는 **계약 예시**이며 실제 API payload/현재 G2-M 스키마가 아니다. 구현 시에는 sourceKind를 CSV_UNVERIFIED / SYNTHETIC_FIXTURE / YOUTUBE_API_FIRST_PAGE_PUBLIC / OPERATOR_EVIDENCE 등으로 분리하고 상태·TTL·버전·출처 인증 근거를 검증한다. Example placeholders는 실제 값으로 오인하지 않는다.

## 5. Chrome 확장 → 그래프 Hand-off 계약

### 5.1 구현된 재사용 경계

- extension/panel-selection-contract.js: 클릭으로 고정한 VIDEO/CHANNEL, tabId, requestId, documentId, TTL 2시간, synthetic provenance. Hover가 이미 열린 패널을 자동 변경하면 안 된다.
- extension/web-analysis-link.js: localhost:5173의 개별 영상 상세/채널 상세/비교 URL 빌더. **그래프 전용 Open/Add 액션은 아직 없다.**
- extension/manifest.json: MV3 sidePanel/storage 및 youtube.com 허용 범위. 통합 계약 문서화만으로 권한·호스트를 추가할 필요 없음.
- extension/sidepanel.js: 확인된 고정 대상으로 웹 상세 링크를 노출. 합성 미리보기 값을 실데이터로 승격하지 않는다.

### 5.2 제안하는 최소 Hand-off V1 (미구현)

사용자가 Side Panel에서 **그래프에서 열기**를 누르면 localhost의 사용자 그래프 경로로 대상 ID만 전달한다. R05-C에서 웹과 확장 양쪽에 동일한 **엄격한 파서**를 추가해야 한다. 제안 경로 예시:

~~~text
/analysis/youtube/workspace?handoffVersion=1&targetType=VIDEO&targetId=AbCdefghI12&intent=FOCUS
~~~

- targetType은 VIDEO 또는 CHANNEL로 한정; VIDEO 11자, CHANNEL UC+22자만 허용한다. @handle 단독은 CHANNEL ID로 강제 변환하지 않는다.
- FOCUS는 **일시적 노드 선택·중심 이동** 요청이다. URL을 열었다는 사실만으로 작업공간 저장/댓글 수집/실제 존재/권한 승인을 확정하지 않는다.
- ADD는 Side Panel에서 사용자가 선택할 수 있는 별도 액션이지만, URL만으로 **자동 저장 금지**. 웹에서 추가 대상/목적지 확인 후 사용자의 클릭으로만 등록·저장한다.
- URL의 origin=EXTENSION 등 출처 힌트는 위조 가능하다. 인증, 확장 설치 여부 또는 권한의 증거로 취급하지 않는다. URL에는 댓글·API 키·토큰·프로젝트 비밀·감성 지표·저장된 인증을 싣지 않는다.
- 유효하지 않거나 중복/만료된 대상, 대상 한도 초과, 미등록 핸들, 비허용 호스트, URL 주입 등은 부작용 없이 차단하고 이유를 표시한다.
- 확장 프로그램을 설치하지 않은 이용자도 같은 링크를 열 수 있다. 사용자 입력·확장 입력의 검증은 동일하다.
- **Hover 이동만으로는 어떤 hand-off도 일어나지 않는다.** 고정 Side Panel 대상에 대해 사용자가 별도 버튼을 눌러야 한다.

### 5.3 상태 소유권 분리

| 데이터 상태 | 소유/생명주기 | 다른 상태에 미치는 영향 |
| --- | --- | --- |
| Hover 현재 대상 | content script의 임시 상태 | Side Panel 및 저장 노드 변경 금지 |
| Side Panel 고정 | 탭별 click-pin, 합성 계약은 TTL 2시간 | 사용자 재선택 시만 변경, 만료 시 고정만 지움 |
| 그래프 임시 포커스 | 워크스페이스 UI 메모리/선택 도킹 | 새 노드 저장과 별개 |
| 등록 URL 목록 | R04 그래프 sessionStorage, TTL 2시간, 최대 128개 | 확장 탭 만료로 삭제 금지 |
| 사용자 프로젝트 저장 | **향후 별도 승인과 백엔드 권한/테넌트 계약 필요** | 임시 상태와 자동 동기화 금지 |
| 분석 표본 | 선택된 출처의 현 세션 스냅샷 | provenance 검증 없이 다른 탭·서버에 공유 금지 |

## 6. 안전한 순서: R05-B → C → D → E

- R05-B: frontend의 기존 그래프·집중 모드·도킹을 **그대로 보존**한 채 그래프 투영 계층/테스트에서 KEYWORD/EXPRESSION/EVIDENCE_SET 타입을 수용. 최초에는 CSV 전용/합성 근거만 사용하고 **새 API 활성화 없음**.
- R05-C: 기존 Side Panel의 클릭 고정 대상으로 FOCUS 링크 생성. ADD는 웹에서 명시 확인할 때만 저장. 단방향 링크까지만, 실시간 동기화·확장 권한 추가 없음.
- R05-D: G2-O의 분석 모듈과 표시용 어댑터를 frontend에 **선택적 이관**. 원래 키워드/사용자 승인 표현/출처 분리/날짜 기준/근거를 그래프 도킹과 연결.
- R05-E: 로컬 검색/댓글 API를 기존 Vite 개발 프록시 및 정책과 **충돌 없이 선택적으로** 연결하는 별도 설계·보안 검수. 기존 backend/Cloud policy gate를 묵시적으로 해제하지 않음.
- R05-F: 그래프·확장·API·보안·데이터 경계를 Windows Chrome에서 통합 QA. 기능 커버리지와 제품 동작은 구분해 기록한다.

## 7. Gate / QA 계약

| Gate | 검증 | 실패 시 조치 |
| --- | --- | --- |
| R05-A | 브랜치 기준/차이·위험·전달 계약 문서 승인 | 구현 착수 전 보완 |
| R05-B | React 전체 테스트·그래프 검색/필터/북마크/그룹/집중 모드/접근성 | 해당 세부 PR 수정, 기존 그래프 손상 금지 |
| R05-C | Extension Node 전체 테스트 + 실제 Chrome Hover/Pin/FOCUS/ADD 확인 | 확장 선택/저장 계약 rollback |
| R05-D | G2-K~O 분석 테스트; 원래 문구 불변; 확장 중복 제거; 근거/날짜/출처 | 그래프 분석 뷰 비활성, 원래 코드 보존 |
| R05-E | 사용자 클릭 필수·포트/호스트/Origin·예산·API key 비노출·auth 프록시 불변 | 실제 조회 NO-GO |
| R05-F | 1440/900/390px, 키보드, 다크/라이트, 네트워크 오류/자료없음, 다중 영상 비교 | 통합 승인 보류 |

G2-N Windows QA 5/5 PASS는 **사용자 보고**, G2-O는 사용자 'QA상 이상 없음'으로 기록됐다. G2-M의 3번째/4번째 영상 한도 및 표본 초기화 Windows 검수는 미완료다. G2-O CI 434/434 PASS, Node 12/12 PASS는 **실험 브랜치에 대한 검증**이며 본 통합 브랜치의 검증으로 승격하지 않는다.

## 8. 금지 사항 / 의도적인 미구현

- R05-A에서는 런타임·Vite·라우팅·manifest·API·보안 설정 파일을 변경하지 않는다.
- G2-L/M 로컬 사용자 실호출 성공을 전체 제품의 YouTube 연동 정책 승인으로 일반화하지 않는다.
- shared/contracts/yu32-youtube-readiness-v0/policy-gates.json의 status=POLICY_HOLD, liveCallsAuthorized=false를 변경하지 않는다.
- 오프라인 합성 / 사용자 CSV / YouTube API 표본의 분모·상태·근거를 서로 섞지 않는다.
- 외부 AI 유료 분석, 영상 다운로드/업로드, 자동 수집, 브라우저 계정 정보·댓글 원문 영구 저장, Cloud 배포, PR 병합/브랜치 삭제를 수행하지 않는다.
- R05-A 통합 설계는 기존 PR #111/#113/#114/#116/#118/#119를 병합 승인한 것으로 해석하지 않는다.

## 9. 승인 요청 지점

최소 변경을 우선한다. R05-A 문서만을 기준으로 R05-B 구현 계약/브랜치 범위를 별도 승인받은 뒤, frontend 기반 새 기능 브랜치를 만들고 작은 Draft PR 순서로 검증한다. 큰 브랜치 병합·Git 리베이스·운영 API 개방은 별도 명시 승인 없이 진행하지 않는다.
