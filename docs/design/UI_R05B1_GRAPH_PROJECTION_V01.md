# UI-R05-B1 — GraphProjection 순수 데이터 계약과 오프라인 QA v0.1

작성: 2026-11-09
상태: 구현·자동 회귀 테스트 단계. R05-A 기반의 독립 Draft 기능 브랜치.
브랜치: feature/ui-r05b1-graph-projection-contract-v01
상위 설계: docs/design/UI_R05A_GRAPH_FIRST_EXTENSION_G2O_INTEGRATION_CONTRACT_V01.md
소스: frontend/src/features/analysis-workspace/workspaceGraphProjection.ts
테스트: frontend/src/features/analysis-workspace/workspaceGraphProjection.test.ts

## 1. 목적과 비범위

기존 R04 등록 URL·집중 모드·그래프 캔버스·도킹·확장 프로그램 구현을 바꾸지 않는다. 별도 GraphProjection 순수 함수로 키워드·영상·채널·표현·댓글 근거 묶음·사용자 그룹을 고유 키와 명시적인 근거 관계로 투영한다. R05-B2가 렌더러에 연결할 데이터를 만들 뿐, 현재 런타임에 연결되지 않는다.

- 외부 API 호출, fetch, storage, Date.now, 페이지/라우팅/manifest/Vite/backend/정책 Gate 변경 금지.
- 현재 등록 URL 저장소는 VIDEO/CHANNEL/CHANNEL_HANDLE 형식, 최대 128개, 2시간 TTL과 그룹 소속 규칙을 그대로 유지한다.
- 각 입력 sourceKind와 status는 출처 설명용 값이며 제공자/권한을 인증하는 증거가 아니다. 실제 운영 사용 전 공인된 경계의 결과 검증이 별도로 필요하다.

## 2. 입력과 노드

buildR05GraphProjection은 등록 URL 대상, 사용자 그룹, 선택 scope, 선택적인 YouTube 검색 결과, 선택적인 영상별 댓글 표본, 선택적인 관측 표현 후보를 받는다.

- scope: 자유 키워드(1~100자), 세션 내 공개 가능한 scopeId(최대 64자), 현재 선택 출처(CSV_UNVERIFIED / YOUTUBE_API_FIRST_PAGE_PUBLIC / SYNTHETIC_FIXTURE), 관측 상태, UTC 기간과 기간 내 댓글 분모.
- VIDEO 및 CHANNEL은 기존 등록 URL과 canonical key를 사용한다. 핸들은 CHANNEL_HANDLE_CANDIDATE로 남기고 등록된 핸들 키를 보존한다.
- KEYWORD는 사용자 입력이고 provider 검증 결과가 아니다. EXPRESSION은 현재 scope에서 실제 관측된 문자적 동반 표현이다.
- EVIDENCE_SET은 영상당 현재 기간의 댓글 묶음이며 raw 댓글이 아닌 범위·건수·상태만 노드에 기록한다. GROUP은 사용자가 지정한 등록 URL 대상만 포함한다.
- KEYWORD/EXPRESSION/EVIDENCE_SET은 scope별 고유 키를 사용해 다른 출처·탐색 세션의 상태가 섞이지 않게 한다.
- 검색 결과 최대 10개, 영상 표본 최대 3개(공식 YouTube 첫 페이지는 영상당 최대 100개), 관측 표현 최대 8개. 초과/무효 입력은 rejected 카운터에 기록하되 거짓 노드를 생성하지 않는다.

## 3. 연결선의 사실적 의미

| 관계 | 근거/의미 | 정량 |
| --- | --- | --- |
| RETURNED_BY_SEARCH | 명시된 검색 응답에서 반환된 영상 | 없음. 인기·추세 판단 금지 |
| CHANNEL_PUBLISHES_VIDEO | 공식 검색 결과로 제공된 확인 가능한 채널-영상 ID 쌍 | 없음 |
| VIDEO_HAS_SAMPLE | 기간과 출처가 확인된 영상 표본 | 기간 내 댓글 수(READY/PARTIAL만) |
| LEXICAL_COOCCURRENCE | 키워드 포함 댓글과 함께 등장한 후보 문자열 | 동반 댓글 건수 및 근거 ID 1~2개 |
| USER_GROUP_MEMBERSHIP | 사용자가 등록한 URL 그룹 | 없음. 플랫폼 소속 관계 아님 |

모든 관계는 sourceKind / scopeId / snapshotId(해당 시)를 갖는다. 문자열 인접 출현은 동의어, 인과관계, 선호도, 영향력의 증거가 아니다. 그래프 위치/거리와 관측 값도 연결하지 않는다.

## 4. 상태·출처 경계

- READY/PARTIAL 상태의 명시적 유효 표본에서만 숫자와 정량 관계를 만든다. 실제로 확인된 0건과 NO_DATA, POLICY_BLOCKED, FAILED, STALE는 구분한다.
- USER_CSV_UNVERIFIED가 READY라고 해서 CSV 진위가 확인됐다는 뜻이 아니다. 출처 tag 단독으로 YouTube 인증/정책 승인으로 승격하지 않는다.
- 선택 출처가 다른 표본 및 후보는 거부한다. 조회 시각·UTC 날짜·영상 ID·스냅샷 ID·기간 분모·후보 근거 ID의 형식과 상한을 검사한다.
- 댓글 원문, API 키, 인증정보를 투영 결과에 넣지 않는다. 표시명 변경은 canonical identity를 바꾸지 않는다.
- @handle은 CHANNEL ID로 추측 변환하지 않는다. 채널 소속 연결은 공식 검색 관계로 명시된 경우에만 만든다.
- 범위 없는 원래 URL 등록 자료는 그대로 UNVERIFIED 상태다. 관측 안 된 날짜와 실패 상태를 0건으로 채우지 않는다.

## 5. 오프라인 검증과 후속 순서

Vitest 검증: R04 URL 및 그룹 보존, VIDEO/CHANNEL/핸들 구별, URL 중복 제거, 검색/소속/표본/표현 관계 구분, 근거 ID, 0건/미관측 차이, POLICY_BLOCKED/FAILED/STALE, 출처 불일치, UTC 경계, 원래 scope 상한, 변이 없는 순수 함수, 가짜 수치/연결 금지.

CI: 전체 frontend Vitest+TypeScript/Vite와 기존 extension Node 회귀 테스트를 수행한다. 실제 Chrome 확장과 그래프 화면 QA는 R05-B2/C/F의 별도 검수다.

R05-B2: 기존 R04 2.5D FocusMode/UrlCanvas에 읽기 전용 투영 어댑터 연결.
R05-C: Side Panel 클릭 고정 대상의 엄격한 FOCUS/ADD 링크.
R05-D: G2-O 분석 순수 함수의 선택적 이관 및 출처별 분석 패널 연결.
R05-E: 기존 Spring 인증 개발 프록시와 G2-L/M 실험 API의 보안/정책 별도 검토.
R05-F: Windows Chrome 시스템 통합 QA.

정책 JSON의 POLICY_HOLD/liveCallsAuthorized=false, 기존 Draft PR #119/#121, G3 금지, 미병합 상태를 모두 유지한다.
