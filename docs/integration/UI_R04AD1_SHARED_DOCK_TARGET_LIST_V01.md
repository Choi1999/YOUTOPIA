# UI-R04-AD-1/2 — 공통 도킹 상태관리 및 대상 목록 통합

작성 기준: 2026-11-05 KST
부모: Draft PR #92 @ afa531ce0d6f8090cffbb47a9a52abb5671a100d
정책: POLICY_HOLD / 실 YouTube 조회 미승인 / 키 미등록 / 병합·배포 미승인

## 1. 승인 작업 범위와 관찰

이번 승인은 UI-R04-AD 1차 구현, 즉 **공통 도킹 상태와 대상 목록 통합**만 포함한다. 전체 패널 재설계, 운영 메타데이터 승인, 분석 기능 확장은 포함하지 않는다.

기존에는 FocusMode의 선택 대상·목록 열림·상세 열림·너비 설정과 WorkspaceUrlTargetBoard의 선택 카드가 독립적이었다. FocusMode가 열린 상태에서도 페이지 하단의 별도 보드가 존재했다. FocusMode가 닫히면 Hero의 별도 Canvas가 자체 선택을 가질 수 있었다. 이 중복을 한 번에 정리한다.

## 2. 공통 상태 모델

frontend/src/features/analysis-workspace/workspaceDockState.ts:

| 상태 | 역할 |
|---|---|
| selectedKey | 실제 등록된 VIDEO/CHANNEL/CHANNEL_HANDLE 키 또는 null |
| listOpen | 왼쪽 도킹 목록 열림 |
| detailOpen | 오른쪽 선택 상세 열림 |
| widths | 기존 FocusDockLayout의 목록·상세 너비 선호 또는 null |

- createWorkspaceDockState는 기존 youtopia-focus-dock-layout-v1 sessionStorage 너비 설정으로 초기화할 수 있다.
- chooseWorkspaceDockTarget은 현재 등록된 ID만 선택하고, 선택 시 상세 패널을 연다. 좁은 화면에서는 목록 패널을 닫는다.
- toggleWorkspaceDockSide는 좁은 화면에서 목록·상세 오버레이 동시 열림을 막는다.
- reconcileWorkspaceDockState는 삭제한 대상의 참조와 상세 패널만 정리한다. 남은 목록 및 너비 선호는 유지한다.
- withWorkspaceDockWidths는 기존 검증된 크기 설정만 갱신한다.

워크스페이스 페이지가 모델을 소유하고 FocusMode는 controlled 상태를 받는다. 단독 FocusMode/Hero 컴포넌트는 기존 로컬 상태 fallback을 지원해 테스트 API 호환을 유지한다.

## 3. 중복 목록 통합

- 페이지 첫 진입은 예전과 같이 FocusMode. 그 내부의 왼쪽 도킹 목록만 사용하고, 하단 등록 대상 Board는 **렌더링하지 않는다**.
- 그래프/왼쪽 목록/인라인 그래프/URL 신규 등록은 같은 selectedKey를 사용하며 선택 시 상세를 연다. 등록되지 않은 ID는 선택할 수 없다.
- 집중 모드 종료 시, 하단에만 간결한 fallback 등록 대상 목록이 나타난다. 거기서 '그래프에서 보기'를 선택하면 **같은 선택·상세 상태**를 통해 FocusMode에 복귀한다. 별도의 카드 확장 상세는 만들지 않는다.
- FocusMode 왼쪽 목록에 '등록 목록 비우기'를 추가해 사용자가 하단 Board를 열지 않고 목록을 관리한다. 개별 대상 삭제는 기존 선택 상세를 이용한다.
- 대상 삭제/전체 삭제는 공통 선택을 정리하되 등록된 다른 URL, A/B fixture 분석 세션, 사용자 별칭, 그룹, 북마크를 임의 변경하지 않는다.
- 목록·상세 도킹 너비와 열림은 집중 모드 종료/재진입에서도 유지한다. 단독 Board 렌더링에서는 종전 확장/제거 UX와 테스트 계약을 유지한다.
- 외부 CDN 영상/채널 이미지의 로딩은 기존 별도의 opt-in 토글이 있어야 한다.

## 4. 보안과 기능 경계

- 이번 작업은 React UI 전용이다. Java/Spring 운영 서버, Google/YouTube provider transport, Cloud quota, DPAPI 자격증명, 정책 정본 파일을 변경하지 않는다.
- UI-R04-AC 일반 화면/DEV 진단 분리 상태를 유지하며, 공통 도킹에는 비밀, 합성 metadata, 출처 인증/관리자 승인 플래그를 저장하지 않는다.
- POLICY_HOLD, liveCallsAuthorized=false, 미검증 영상–채널 관계선 미생성 정책을 유지한다.
- API 첫 호출, 코드 병합, 배포는 이번 승인 대상이 아니다.

## 5. 자동 QA와 Windows 수동 QA

자동 QA:
1. 도킹 전이 단위 테스트 — 무효 선택 차단, 같은 선택·열림, 좁은 화면의 패널 상호배타, URL 삭제 후 정리, 너비 유지.
2. React 통합 — FocusMode 열림 시 별도 Board 없음, 목록/그래프 동기화, 종료 후 compact Board, 그래프로 재진입, URL 삭제/전체 비우기.
3. 기존 URL 등록/드롭, 탭 저장소와 A/B fixture 분리, 포커스 트랩, 도킹 키보드/포인터 너비 조절 유지.
4. React/Vitest, TypeScript/Vite, extension/shared contracts, test-only Vite↔Spring HTTP 회귀, Windows offline CI.

Windows Chrome 수동 QA (별도 Worktree, 사용자 실행):
- 처음에는 집중 모드만 표시하고 별도 Board 없음
- 영상 추가 → 목록/그래프/상세가 같은 항목을 선택
- 집중 모드 닫기 → fallback Board만 표시, '그래프에서 보기'로 동일 대상 상세 복귀
- 선택 대상 삭제·목록 비우기 → phantom 상세 없음
- 패널 너비·열림·키보드·모바일 오버레이 동작 유지
- 진단 기능은 기존 DEV 진단 경로에만 표시, 실제 Google 호출 없음

수동 QA는 사용자 Windows 브라우저 결과를 받기 전까지 PASS로 기록하지 않는다.

## 6. 다음 단계

UI-R04-AD-3/4는 중복 상세 정보/반응형 패널 크기 보강을 위한 후속 작업이다. PR이 성공하더라도 사용자 별도 승인 전까지 실 API 호출·키 등록·병합·배포는 중단한다.

상태 (CI 이전): SHARED_UI_DOCK_MODEL / SINGLE_VISIBLE_REGISTERED_TARGET_LIST / REAL_YOUTUBE_0 / UNMERGED.
