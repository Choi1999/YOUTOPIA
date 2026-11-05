# UI-R04-AA — React 메타데이터 상태 관리, 캐시, 영상–채널 관계 안전성

작성일: 2026-11-05 KST
부모: Draft PR #89 @ 08dbb3ee95af39214fe644ad69a83fe8b5a6c97b
짝 백엔드: Draft PR #90, versioned TEST-ONLY Spring state response
상태: POLICY_HOLD / 실제 Google·YouTube API 요청 0 / 실제 키 미등록 / 미병합

## 1. 범위

합성 HTTP를 통한 영상·채널 메타데이터의 **소비 상태**를 완성한다. 실 제공자 데이터를 읽거나 승인하기 위한 기능이 아니다. 현재 실제 제목·썸네일 자동 조회는 여전히 미구현이며, 이번 미리보기는 DEMO CSS 아트워크와 '합성' 제목만 사용한다.

- 기존 R04-Y same-origin Spring 합성 연결은 그대로 보존한다.
- 새로운 UI-R04-AA 상태 시험은 Vite 개발 모드에서 VITE_R04Y_SYNTHETIC_HTTP=enabled 및 VITE_R04AA_METADATA_STATES=enabled가 동시에 필요하다.
- 사용자도 React의 '메타데이터 상태 QA' 버튼을 눌러야만 서버를 호출한다. 그 전에는 0 요청.
- 두 기존 합성 미리보기 모드와 동시에 실행하지 않는다. 각 모드를 바꾸면 다른 모드를 비활성화한다.

## 2. 공통 응답 계약·상태

Spring TEST 컨트롤러의 스키마는 YOUTOPIA_R04Z_METADATA_CONSUMER_STATE_V01.

| UI 상태 | 유입 | UI 처리 |
|---|---|---|
| IDLE | 미조회 | 기존 미확인 제목 표시 |
| PENDING | 응답 대기(클라이언트 전용) | '합성 조회 대기 중'; 오래된 응답은 취소 |
| READY | 200 + 정확한 타깃/타입·합성 출처·유효기간 | 합성 제목/DEMO 미리보기 + 합성 상태 고지 |
| NOT_FOUND | 404 + 정확한 상태 본문 | 미존재 '사례'로만 표시; 실제 존재 여부 단정 금지 |
| FAILED | 503 + 정확한 상태 본문/네트워크/검증 실패 | 기존 미확인 제목; 오류는 정상 데이터로 대체하지 않음 |
| STALE | 만료된 서버 데이터 또는 캐시 TTL 만료 | 오래된 합성 제목 게시 금지, 수동 새로고침 필요 |

- 엄격한 body exact-field 검증: requestedId/kind 일치, source=LOCAL_SYNTHETIC_ONLY, sourceAuthenticated=false, providerRequestsMade=0, consumerPublicationAuthorized=false.
- 관계 검증: channelId=null 및 associationVerified=false 필수. 임의 channelId나 verified=true는 거부하며, VIDEO와 CHANNEL이 같이 등록되어도 관계선을 만들지 않는다. 실제 채널 소속은 제공자 신뢰를 검수한 별도 향후 계약만 허용.
- timestamp: observedAt, expiresAt은 밀리초 Unix timestamp, READY는 앞으로 15분 이하 TTL만 허용, 서버 기한과 클라이언트 현재 시간 교차 검사. STALE은 무조건 unpublish.
- 이미지 URL, 토큰/키, 실제 댓글·분석 지표 및 사용자 별칭을 서버 상태에 섞지 않는다.

## 3. 프런트 상태·캐시

- InMemoryMetadataStateCache는 **READY만 보관**, 최대 32개, 서버 expiresAt 이전만 반환. NOT_FOUND/FAILED/STALE 캐시 금지.
- 만료된 READY 조회는 STALE로 표시하며 자동으로 '유효'라고 표시하거나 비밀/프로바이더 호출로 갱신하지 않는다. '메타데이터 새로고침' 버튼은 캐시를 비우고 새 합성 GET을 보낸다.
- React 화면 대상은 처음 3개까지만 시험, 각 대상에 GET 한 번, 자동 재시도 0. URL이 바뀌거나 모드를 끄면 AbortController로 취소하며 5초 타임아웃.
- userFacingTargetName에서 사용자가 직접 저장한 별칭이 최우선이고, 합성 데이터는 일시적인 메모리 overlay로만 나타난다.
- sessionStorage에 들어가는 것은 원래 canonical URL ID/사용자가 작성한 label만이다. 조회 상태/합성 제목/시간/관계는 탭 저장소·로컬스토리지·서버 DB에 기록하지 않는다.
- 기본 비디오 이미지 CDN/수동 채널 이미지 토글은 기존대로 별도의 opt-in이지만 상태 QA의 합성 READY는 원격 이미지 요청을 하지 않는 CSS DEMO 아트워크를 사용한다.

## 4. 네트워크·테스트

- Vite 프록시 두 경로는 독립 규칙이며, 개발 모드에서 explicit 플래그를 함께 설정해야 synthetic-state를 프록시한다. 다른 미등록 합성 API 경로도 Vite의 SPA 200 화면으로 숨기지 않고 백엔드 deny/404로 전파한다.
- HTTP: GET, same-origin, credentials omit, redirect error, no-store, no-referrer, 최대 4096바이트, UTF-8 JSON, 응답헤더 X-YOUTOPIA-Synthetic=test-only, HTTP 200/404/503과 상태 조합 일치.
- 버전 불일치/ID 스푸핑/임의 채널 소속/위조 인증 플래그/응답 503의 잘못된 성공/만료·과대 본문은 거부한다.
- 개별 TS 단위 테스트 + React 화면 통합 테스트 + Node cross-process CI에서 pinned backend 테스트 fixture를 별도 checkout하여 Spring↔Vite HTTP를 실제 로컬 호출한다.
- 이것은 동일 GitHub Runner에서의 **합성 프로세스 간 E2E**이다. 사용자의 Windows PC Chrome 수동 검증과 실제 Google 데이터 수신 검증을 대신하지 않는다.

## 5. Windows PC 수동 QA

실제 API 키/Cloud 설정은 필요 없다. PR #90과 PR #91을 **각각 독립 Worktree**에 exact SHA로 준비한다. 기존 QA 폴더와 frontend/backend 본 브랜치는 변경하지 않는다.

Spring용 PowerShell 창:

~~~powershell
cd C:\Projects\YOUTOPIA-R04Z-BE-QA
.\gradlew.bat --no-daemon runR04XSyntheticMetadataLoopback
~~~

React용 다른 PowerShell 창:

~~~powershell
cd C:\Projects\YOUTOPIA-R04AA-FE-QA\frontend
$env:VITE_R04Y_SYNTHETIC_HTTP = "enabled"
$env:VITE_R04AA_METADATA_STATES = "enabled"
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
~~~

브라우저에서 /analysis/youtube/workspace 접속 → 영상 https://youtu.be/Ab0_-123xyz 등록 → '메타데이터 상태 QA' 활성화.

확인 항목: READY 합성 제목/DEMO 표시, NOT_FOUND/FAILED/STALE 시 미확인 제목과 상태 안내, READY 복귀, 새로고침, 사용자 별칭 우선순위, 채널 핸들에 허위 인증·관계 없음, OFF 후 복구, Spring 종료 후 실패(정상 데이터 위조 없음). HTML 네트워크 요청은 같은 출처 test-only 경로로만 가야 한다.

## 6. 운영 전 별도 승인

실제 YouTube Data API 메타데이터 제공, source verification, Windows 운영용 키 보관·입력/회전, 실행 계정·quota·IP 제한 검증, cache persistence/retention/삭제 정책, 실정본 관계 검증, 최초 provider GET, 병합/배포는 추가 승인 필요.

**판정: VERSIONED_SYNTHETIC_CONSUMER_STATES / IN_MEMORY_READY_CACHE / RELATION_UNVERIFIED / LIVE_GOOGLE_0 / UNMERGED.**
