# UI-R04-N — 사용자 UX 정정: 집중 모드, 표시 제목, 실제 그래프 필터, 채널 썸네일

## 기준 / 사용자 요구

- 부모 Draft PR #77, 검증 시작 SHA: 3bd70744fcce8c26248f37395bee963fededd414.
- 직접 지적: "집중모드일때는 북마크 추가 버튼이 보이지 않아", "영상 ID보다는 제목",
  "필터를 설정시 설정에 맞는 노드만", "집중모드를 디폴트로".
- 추가 지시: "채널 썸네일도 가져올 수 있도록해".
- 이 기능 수정 승인은 PR 개발 범위만 의미한다. 병합, 배포, 실 YouTube Data API
  호출 또는 첫 실호출 transport/policy-gates 해제 승인이 아니다.

## 사용자에게 제공되는 행동

1. 실제 워크스페이스 라우트는 첫 진입 시 전체 화면 집중 모드로 시작한다.
   처음 등록 대상 0개여도 URL 입력과 드롭이 가능하며, 빈 그래프 안내를
   표시한다. '집중 모드 종료'는 기존 비집중 화면으로 돌아간다.
   재사용 가능한 WorkspaceHero 컴포넌트의 별도 테스트에서는 opt-in 동작을 유지한다.
2. 집중 모드 헤더에 '☆ 북마크 추가' 액션이 항상 보인다.
   노드가 선택되지 않으면 비활성화하고, 선택 이후에는 선택한 canonical
   대상 ID에만 북마크를 추가/해제한다. 기존 그래프 내부 북마크 도구도 유지한다.
3. 영상 노드·목록·카드의 주요 식별은 raw ID가 아닌 읽을 수 있는 제목이다.
   현재 실제 YouTube metadata 조회가 POLICY_HOLD이므로 공식 제목을 자동으로
   만든 척하지 않는다. 사용자는 선택 상세에서 '표시 제목'을 직접 입력할 수 있고,
   해당 이름은 모든 화면에 우선 표시된다. 없으면 '영상 제목 미확인'을 표시하며
   raw ID는 보조 식별자로 남겨 중복 대상의 구분·복원을 지원한다.
   채널은 이미 승인된 캐시 title을 우선 표시할 수 있고, 사용자 지정 이름도 지원한다.
4. 영상만/채널만/그룹만/북마크만 필터는 **실제 그래프 노드, 페이지 및
   미니맵의 탐색 단위**에 적용한다. 그룹만은 그룹 허브만 표시하고,
   영상/채널만은 그룹 소속 대상도 해당 종류의 독립 노드로 보여 준다.
   북마크만은 북마크 대상 및 북마크 그룹만 표시한다.
   필터 변경으로 등록 URL, 그룹 멤버, 북마크, 원본 분석 데이터가 수정되지 않는다.
   결과 0건은 안내를 표시하며 24개 페이지 규칙은 필터 적용 후의 탐색 단위에 적용한다.
5. 채널 프로필 이미지는 별도 '채널 이미지 켜기' 동의가 있을 때에만
   로드할 수 있다. 이미 승인이 완료된 채널 프로필 캐시(현재 런타임 미제공)
   또는 사용자가 선택 상세에 직접 붙여넣은 허용된 HTTPS 이미지 출처
   (yt3.ggpht.com / yt3.googleusercontent.com)만 화면에 전달한다.
   수동 URL은 채널 소유·프로필 동일성을 검증한 데이터가 아니며 명시적으로
   '사용자 제공 이미지'로 취급한다. 거부된/실패한 출처는 로컬 플레이스홀더다.
   이미지 로드는 별도 외부 CDN 요청이므로 기본 동의 OFF 및 no-referrer를 보존한다.

## 실제 자동 메타데이터 조회의 선행 조건

- 공식 Google YouTube Data API에서 채널 썸네일은 channels.list(part=snippet)
  응답의 snippet.thumbnails 항목에 있으며, 반환된 이미지 URL을 그대로
  사용하는 것이 공식 권고다.
  https://developers.google.com/youtube/data/reference/rest/v3/channels
- 영상의 실제 제목은 videos.list(part=snippet) 응답의 snippet.title로 획득한다.
  https://developers.google.com/youtube/data/reference/rest/v3/videos/list
- 현재 저장소 shared/contracts/yu32-youtube-readiness-v0/policy-gates.json 의
  POLICY_HOLD, liveCallsAuthorized=false 상태를 변경하지 않는다.
  브라우저에서 API key 또는 비인가 YouTube HTML scraping으로 우회하지 않는다.
  인증·quota·사용정책·서버 권한·첫 운영 호출 승인이 완료되기 전에는
  자동 제목/채널 프로필 네트워크 조회가 수행되지 않는다.
  수동 이미지 URL 표시와 공식 프로필 수집은 명확히 별개다.

## 저장 및 회귀 검증

- 사용자가 붙인 표시 제목과 채널 이미지 주소는 기존 등록 URL과 별도
  sessionStorage에 엄격한 스키마, 최대 2시간 TTL로 기록한다.
  직접 입력한 ID와 이름은 공식 메타데이터로 승격하지 않는다.
- 지워진 URL의 표시 제목·이미지 참조는 삭제하고 임의 ID/도메인 및
  포맷 오류는 읽거나 저장하지 않는다.
- 테스트: default focus with zero URL, editing names, visible bookmark,
  video/channel/group/bookmark graph node filter, channel image separate opt-in,
  storage reject/TTL/orphans, existing groups, 24-node pagination,
  empty filtered graph, keyboard, responsive docks, thumbnail fallback.
- 정확한 Head에서 React/Extension/TS/Vite/Windows offline CI가 모두 PASS해야 한다.
  사용자의 Windows Chrome 수동 QA 보고는 별도 단계이며 병합 승인과 다르다.
