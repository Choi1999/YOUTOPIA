# UI-R04-B — URL Ingestion + Obsidian-inspired Adaptive Workspace v0.1

## 사용자 요구 및 참조

- 첫 화면의 브랜드 히어로 안에 URL 입력 및 드래그 앤 드롭을 제공한다. 링크를 추가하면 대상이 즉시 나타난다.
- 등록 대상 수에 따라 패널이 생기고 화면 너비·패널 밀도·선택 상태에 따라 공간 배분이 자동 조정된다.
- Obsidian의 Three D Graph View 및 New 3D Graph 플러그인에서 전체 캔버스 탐색, 줌·패닝, 노드 선택과 하이라이트를 참고한다.
- 이번 구현은 2.5D 브라우저 그래프이며 실제 3D 회전, Three.js/WebGL/force physics는 포함하지 않는다. 원본 플러그인 자산·코드를 복제하지 않는다.

## 구현 구조

- WorkspaceHero: 최초 히어로에 공식 YouTube URL 텍스트 입력과 링크 드롭(text/uri-list, text/plain) 지원. 파일은 읽거나 업로드하지 않는다.
- workspaceUrlTargets.ts: 오프라인 URL 구문 확인, VIDEO / CHANNEL / CHANNEL_HANDLE 구분, 공유 링크 중복 제거, 공식 YouTube 도메인과 식별자만 허용.
- WorkspaceUrlCanvas: 하나 이상 등록하면 히어로 내부를 전체 화면 탐색 영역으로 확대한다. 노드 초점·배경 드래그 이동·확대/축소·화면 맞춤과 24개 단위 페이지 탐색. 새 대상 간 연결선은 그리지 않는다.
- WorkspaceUrlTargetBoard: 한 개는 전체 폭, 두 개는 2열, 다수는 auto-fit 가변 그리드와 container query로 자동 배치. 선택 카드는 화면이 넓으면 두 칸을 점유한다. 초기 12개, 추가 버튼으로 점진 표시.
- AnalysisWorkspacePage: 기존 YU-51 검증 합성 A/B 슬롯과 새 URL 등록 컬렉션을 분리하여 보관한다. 새 URL은 검증 합성 Repository에 등록하지 않는다.

## 데이터·보안 불변식

1. URL 파싱은 실제 YouTube 영상·채널 존재, 제목·썸네일·소속, 댓글 또는 분석 결과를 의미하지 않는다. 모두 미확인 상태로 표시한다.
2. 별도 브라우저 탭 세션 키 youtopia-workspace-url-targets-v1에 정규화 ID·공식 canonical URL·등록 시점만 저장한다. 입력 URL 원문과 추적 파라미터는 저장하지 않는다.
3. 최대 128개 임시 URL, 한 번에 32개 토큰, 입력 최대 8192자, 단일 URL 2048자, 저장 payload 최대 48KB, TTL 2시간. 이는 성능·저장 안전 한도이지 A/B 비교 상한이 아니다.
4. URL 호스트·프로토콜·포트·자격정보·ID·handle을 확인하고, 의심 주소는 거부한다. 사용자가 YouTube에서 열기 버튼을 누른 경우에만 외부 URL로 이동한다.
5. 미확인 노드 간 채널 소속·감성·주제 관계를 추정하지 않는다. 기존 합성 선정 그래프는 별도 유지한다.
6. POLICY_HOLD, 실호출 하드락, Chrome Manifest, 실댓글 수집, 외부 API, Cloud 및 기존 PR #56/#63~#66은 변경하지 않는다.

## 검증 계획

- 첫 화면 영상 URL 입력, Shorts와 youtu.be 링크 정규화, 채널 ID·handle 등록과 미해결 상태, 동일 영상 중복 제거, 비정상 host·잘못된 URL 거부.
- 링크 텍스트 드롭 및 파일 드롭 거부, 등록 직후 그래프/패널 생성, 1·2·3개 이상 추가 시 가변 비율과 패널 확장.
- 노드 선택과 화면 맞춤, 확대·축소, 배경 이동, 24개 이상 등록 시 페이지 전환, 최대 수량 안전 제한.
- 새로고침 복원, URL 삭제·목록 비우기, 기존 합성 A/B 및 근거 수치·세션과의 독립성, 모바일·키보드·reduced motion.
- 1440px/900px/390px/320px 및 light/dark 실제 Chrome QA. 추후 실사용성 실험과 완전 3D/물리 엔진/드래그 패널 도킹 검토.

## 승인·병합

PR #66 HEAD에서 별도 브랜치로 개발한다. 정확한 HEAD CI를 위해 임시 base frontend 사용 후 PR #66로 복원하고 Draft를 유지한다. 사용자 Chrome QA와 병합 승인은 별도 단계이다.