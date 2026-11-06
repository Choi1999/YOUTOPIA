# UI-R04-A — YOUTOPIA 관계 기반 2.5D 탐색 프로토타입

## 목적 / 적용 범위

이번 기능은 이전 Immersive Analytics 평가에서 발견된 '3D 장식과 실제 분석 데이터가 연결되지 않음' 문제를 개선하는 **한정 프로토타입**이다. Chrome 확장이나 전체 분석 라우트로 전면 확장한 것이 아니다. 기존 PR #65 위에 독립 스택으로 개발한다.

## 데이터와 연결 의미

- 입력: YU-53~54의 `readWorkspaceCatalog`(기존 Repository → 검증된 분석 Projection / ChannelAggregation), YU-51의 유효한 session 선택, YU-44의 `demoChannelSelections` **명시 합성 manifest**.
- CHANNEL → VIDEO: 명시적으로 합성 예시에 포함한 영상 쌍. 점선으로 표시한다. **실제 YouTube 채널 소속을 뜻하지 않는다.** READY가 아니어도 manifest 관계 자체는 보일 수 있지만, 수치·주제 관계로 승격하지 않는다.
- VIDEO → TOPIC: 영상이 READY이고, 선택한 주제의 검증된 양수 언급 건수가 존재할 때에만 실선과 건수를 제공한다. PARTIAL/STALE/BLOCKED/NOT_FOUND에서 주제 연결을 생성하지 않는다.
- 노드의 위치·크기·색상·깊이: 가독성을 위한 토폴로지 배치일 뿐 유사도, 반응 우열, 감성의 크기, 신뢰도, 영향력을 표현하지 않는다.
- 연결 부재는 0건으로 해석할 수 없다. 실제 합성 READY channel에 등록된 주제에서 0건을 계산하려면 기존 주제 화면의 독립 검증 조건을 거쳐야 한다.
- 합성 fixture의 데이터 수치가 실제 YouTube 사용자의 감성·댓글·전체 여론을 의미하지 않는다.

## 상호작용 / 접근성

- SVG 노드에 키보드 Enter/Space와 포인터 선택을 제공하고, 모바일에서는 동일한 노드 목록을 큰 HTML 버튼으로 조작한다.
- 선택하면 우측 근거 패널에서 기존 검증된 개별 표본(분류 완료 분모, 긍정 비율, 관측 기간)을 표시한다. PARTIAL은 범위 제한 설명, BLOCKED/STALE은 수치 차단.
- VIDEO/CHANNEL 노드는 사용자 명시 버튼으로 기존 임시 세션 A/B에 넣는다. 다른 슬롯과 중복이면 버튼을 비활성화한다. TOPIC 노드는 기존 주제 탐색 화면으로 이동한다.
- 새로운 스토리지 구조, URL 파라미터, 외부 API/댓글/LLM/Cloud 호출은 도입하지 않는다.
- 기존 CSS 3D 장식의 무한 자동 재생을 중단하고, 사용자가 '3D 모션 재생'을 누를 때만 재생한다. `prefers-reduced-motion` 설정은 사용자 재생 요청보다 우선한다.

## QA

1. 데스크톱 1440px: 2개 합성 CHANNEL, 4개 등록 VIDEO, 선택 TOPIC의 그래프와 점선·실선 범례를 확인한다.
2. RECIPE 상태: 주제 노드 선택 시 READY 영상의 개별 합성 언급 수(38·25·20·12)를 확인한다. 합계를 채널 전체 반응으로 표현하지 않는다.
3. QUALITY 상태: 채널 B의 합성 VIDEO C/D에서만 언급 관계가 나타난다. A 선정 영상에서 없는 관계를 창작하지 않는다.
4. 영상 B1 노드 클릭 → 분석 근거 선택 → 영상 A에 선택: 세션의 VIDEO A와 기존 비교 링크가 바뀐다.
5. 채널 B를 비우면 해당 채널/선정 영상 노드가 사라지고, 나머지 A 관계는 유지된다.
6. 720px 이하: SVG 대신 동일한 노드의 HTML 버튼 목록을 이용해 키보드/터치로 근거를 탐색할 수 있어야 한다.
7. 장식용 3D는 초기 정지. 재생/중지 버튼이 표시되고 `prefers-reduced-motion`에서는 재생 효과가 보이지 않아야 한다.
8. 390px/320px, 다크/라이트, 메뉴, 기존 상세·비교·주제 링크를 확인한다. 화면 전체의 수평 overflow와 오래된 비동기 결과 잔류를 검사한다.

## 승인/검증 경계

- 코드 변경은 `feature/ui-r04a-synthetic-relation-explorer-v01`에 한정하고 `frontend`, PR #63~#65, 보류 PR #56을 변경하거나 병합하지 않는다.
- `POLICY_HOLD`, `verifiedCount=0`, `liveCallsAuthorized=false`, `RELEASED_FOR_FIRST_REAL_CALL=false`, Chrome Manifest, 서버·클라우드 설정은 불변.
- 정확한 HEAD의 React/Extension/Windows CI와 별도의 사용자 Chrome QA를 확인한 다음에만 병합 승인을 요청한다.
- 브라우저 사용성 실험 및 실제 WebGL 도입 여부 비교는 향후 단계다. 본 구현에서 사용성 개선이나 LCP/INP/CLS 달성을 입증했다고 주장하지 않는다.
