# YOUTOPIA — 고객이 빠르게 이해하는 UI 벤치마킹 v0.1

> 2026-10-21 KST | 조사 자료: 공식 제품·도움말 페이지, Chrome 개발자 문서, 기존 승인 Figma 메타데이터
>
> **지위:** 실제 공개 서비스의 UI 동작 관찰과 YOUTOPIA 설계 제안을 구분한 계획 문서. 경쟁사 내부 알고리즘·캐시 적중률·응답시간·상용 안정성을 검증했다는 뜻이 아니다. 실제 코드와 Figma 화면을 수정하지 않았다.
>
> 적용 계획: [CUSTOMER_FIRST_UX_IMPLEMENTATION_PLAN_20261021.md](./CUSTOMER_FIRST_UX_IMPLEMENTATION_PLAN_20261021.md). 기존 데이터 전달 설계: [PR #16](https://github.com/Choi1999/YOUTOPIA/pull/16).

## 1. 사용자 의도와 제약

- 이전에 승인한 최상위 여정 **YouTube 홈/검색 썸네일 Hover → 반응 요약 카드 → 더보기 클릭 → Chrome Side Panel의 클릭 대상 고정 → 필요시 웹 워크스페이스**를 유지한다.
- 사용자 승인 변경: 정확성, 데이터 가용성, 권한 분리, 실제 데이터 승인은 시스템 내부에서 철저히 검증하되, **고객의 주 작업 화면에서는 MOCK, STATIC_FIXTURE, Cache HIT/MISS, Singleflight, POLICY_BLOCKED 같은 엔지니어링·내부 정책 용어를 노출하지 않는다**.
- 숨긴다는 뜻이 사실과 다른 수치를 제시하겠다는 의미는 아니다. 유효한 분석 결과가 없으면 고객에게 수치/증가율을 표시하지 않는다. 실제 결과일 때만 필요한 기간·표본·최근 확인 시각을 짧고 일상적인 표현으로 제공한다.
- 합성 데이터는 독립 DEV/QA 시뮬레이터에서만 테스트하며, **실제 고객 환경에 합성 수치를 실제 댓글 분석처럼 공개하지 않는다**. 고객 빌드에서 분석 불가 시 자연스러운 미확보 UI를 제공한다.
- 게임 전용 제품이 아니다. 요리/음악/게임/시사/라이프스타일 등 범용 영상에 어울리는 주제명과 예시로 설계.
- 권한/구독, 조직/고객, 플랫폼 관리자/QA UI를 분리하고 Figma 디자인 정본을 유지한다.

## 2. 공개 제품 벤치마킹 — 관찰 사실과 YOUTOPIA 도입안

| 제품 | 공식 자료에서 확인한 UX 동작 | YOUTOPIA 적용안(추론·제안) | 외부 내부 구현 |
|---|---|---|---|
| vidIQ | YouTube 영상 페이지에 SEO·성과 지표와 경쟁/키워드 분석을 오버레이. 상세 자료는 분석 UI로 진입. | Hover 카드 첫 화면에서 고객이 가장 궁금한 핵심 1개 + 작은 숫자 1~3개만 제시 | 실제 API/캐시 설계 비공개 |
| Outlier | 채널 영상 썸네일에 간단한 Outlier Score 삽입. 데이터가 부족할 때 ‘—’ 표기. 저장/아이디어 생성은 별도 액션. 첫 방문 데이터 조회 지연이 있을 수 있음을 설명. | 부족한 정보는 채우지 않고 자연스러운 빈 상태. 빠른 요약과 무거운 분석 시간을 분리 | 캐시 성능·내부 기준 비공개 |
| TubeBuddy Videolytics | 영상 페이지 오른쪽 위에서 SEO·실적 분석을 노출, 점수 위에 Hover하면 개선 정보를 보여주고 비교는 별도 동작. | 밀도를 낮춘 1차 요약 후 세부 설명을 명시적 클릭으로 제공 | 실제 분석 지연·수집 전략 비공개 |
| Brand24 | 주요 언급과 KPI를 요약하고 주제별 언급량·감성·시간 그래프를 연결. 중요한 언급과 기간 필터를 탐색할 수 있음. | Side Panel: 기본 ‘요약’, 추가 ‘주제’와 ‘추이’. 수치와 관련 근거를 필요할 때만 확인 | YouTube 홈 전체 분석 방식의 직접 선례 아님 |
| Glasp | YouTube 영상 옆에 요약·전사/Chat 등 탭형 보조 패널. 썸네일에서도 한 번 클릭해 요약 진입하는 흐름 안내. | 기존 YouTube 화면을 떠나지 않고 상세를 1번 클릭으로 열며 타깃 고정을 유지 | 감성분석이나 YOUTOPIA 실측 성능 선례 아님 |

**공식 자료 / 실사 URL**
- vidIQ 공식 확장: https://vidiq.com/extension/
- Outlier 공식 YouTube 확장 사용 설명: https://outlier.so/docs/chrome-extension/using-extension-youtube
- Outlier 공식 문제해결 문서(데이터 부족/초기 지연/캐시 차이): https://outlier.so/docs/chrome-extension/troubleshooting-extension
- TubeBuddy Videolytics 공식: https://www.tubebuddy.com/tools/videolytics/
- Brand24 AI Topic Analysis: https://help.brand24.com/en/articles/9919606-ai-topic-analysis
- Brand24 Analysis 탭: https://help.brand24.com/en/articles/5336625-analysis-tab-overview
- Brand24 Topic Analysis: https://brand24.com/topic-analysis/
- Glasp YouTube Summary: https://glasp.co/youtube-summary
- Glasp 썸네일 클릭 요약 기능 이력: https://blog.glasp.co/whats-new/
- Google Chrome Side Panel UX / 사용자 제스처 API: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- Google Chrome Web Store 품질 기준: https://developer.chrome.com/docs/webstore/best-practices

**근거 한계:** 공개 제품 자료만으로 실제 ‘유튜브 홈의 어떤 영상이든 Hover 즉시 신규 댓글 감성분석’이 구현됐다고 확인할 수 없다. 주제/감성·실시간 지표·영상 요약의 표면 UX만 검증했다. 완전 실시간을 고객에게 약속하지 않는다.

## 3. 기존 승인 Figma 정본 — 현황 비교

2026-10-21에 Figma **디자인 노드 메타데이터**에서 다음을 확인했다. 실제 Chrome에서의 픽셀 정합성·반응형 검증을 수행한 것은 아니다.

| 정본 Figma 노드 | 현재 구조/치수 | UX 개선 제안 | 보존 계약 |
|---|---|---|---|
| [98-09 Video Hover / Light](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-2) | 상위 1600×900, Video Hover Card 약 **356×470px**, 감성 바·토픽 칩·짧은 브리핑·더보기 CTA | 기본형 약 **336~356px 너비·260~320px 높이**로 단축, 결론 한 줄을 맨 위로, 감성 한 줄/토픽 두 개만 바로 노출 | 기존 카드/노드 삭제·덮어쓰기 금지. 신규 후보 변형으로 설계·승인 |
| [98-10 Side Panel / Light](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217) | Chrome Panel 약 **435×810px**, 상단 ‘요약/주제/추이’ 탭, 감성·주제·2문장 브리핑 섹션 | 탭 구조 유지, 첫 화면은 **하나의 결론 + 감성 미니바 + 상위 주제 3개**; 차트/근거/세부 분모는 해당 탭·자세히에서 | 더보기 클릭 시 대상 고정, F12 아님, 탭별 맥락 우선 |
| [98 Chrome UX / 상위](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-2) | 10개 Chrome UX 시안 | 두 후보를 기존 정본에 연결, 화면 밀도·태블릿 아닌 데스크톱 브라우저 크기/줌 회귀 | Figma 정본 유일성 유지 |
| [80~83 Role UI 인계](./FIGMA_ROLE_UI_APPROVED_HANDOFF_20261016.md) | 고객·조직·플랫폼 운영·QA 독립 UI | 고객용 단순화가 운영·QA 관리 기능을 노출하지 않도록 분리 | 이전 React YU-01~12 재사용·보존 |

현재 YU-26의 Shadow Card 런타임을 이 문서가 곧바로 바꾸지 않는다. 승인 전 Figma나 React 코드를 변경하지 않는다.

## 4. 관찰에서 얻은 UI 설계 판단

### 채택
1. **의미 우선:** ‘긍정 62%’보다 ‘조리법 반응이 긍정적이에요’처럼 해석 가능한 한 줄을 먼저 보여준다. 이 문장은 분류된 데이터와 신뢰 기준이 충족된 경우에만 생성.
2. **첫 화면의 정보량 제한:** Hover 카드 = 결론 1줄, 감성 미니바/대표 수치, 주제 1~2개, 기간·대상 규모 짧은 라벨, 단일 ‘더보기’ 액션.
3. **점진적 공개:** Side Panel 요약 탭은 바로 이해하는 콘텐츠, 주제 탭은 이유/논점, 추이 탭은 비교 가능한 시간 흐름. 웹 워크스페이스는 저장·비교·보고에 집중.
4. **타깃 안정성:** Hover로 바뀌는 카드와 클릭 후 고정되는 패널 대상은 분리. 카드는 A→카드→A 유지 및 배경 B 차단.
5. **데이터 부재를 일반 고객 문구로 전달:** ‘아직 확인된 반응이 없어요’ 등, 내부 실패/정책 상태와 무관하게 *사실에 맞는* 간결한 안내.
6. **속도:** 스켈레톤 고정 레이아웃/비차단 조회. 데이터가 늦게 도착해도 카드/패널이 크게 재배치되지 않도록 함.
7. **가치 있는 추가 정보만:** 최근 확인 시각·기간·표본은 작은 글씨로, 신뢰도·출처 및 제외 이유는 세부 펼침 영역에서 필요할 때 확인 가능하게 함.

### 피해야 할 것
- 한 Hover 카드에 3개 차트, 원문 댓글, 백그라운드 큐 로그, 내부 기술 배지, 여러 전환 버튼을 노출.
- 미확보·차단된 상태에서 그럴듯한 긍정 비율·트렌드 그래프를 만들어 고객이 실제 분석으로 오해.
- 주간 비교 가능한 데이터 없이 화살표 ↑와 ‘급상승’/‘유행’ 문구 생성.
- 모든 홈 썸네일에 큰 오버레이·분석 배지 자동 표시, 원래 YouTube 시청·스크롤·클릭 방해.
- ‘캐시 HIT’, ‘정책 게이트’, ‘분모 미확정’, ‘STATIC_FIXTURE’, 개발자용 Trace ID를 고객의 메인 UI에 노출.
- 서비스 내부에 AI를 사용한다는 이유만으로 ‘실시간’ 혹은 ‘공식 YouTube 전체 여론’을 주장.

## 5. 남은 조사/시각 검증

- Figma 승인 시안의 Light/Dark 대비·상세 콘텐츠 길이·하단 CTA 접근성 실측은 별도 Figma 검수 필요.
- YouTube 홈/검색의 추천 썸네일 배치, 영상 미리보기 오버레이와 카드 충돌, 125%/150% 줌, 좁은 뷰포트, 한국어 긴 주제명을 포함한 사용성 테스트 필요.
- 영어/한국어/태국어 문구를 자연스럽게 유지하려면 언어별 2줄 자르기/문자폭 검증 필요. 다국어 감성분류의 실제 지원은 별도 Gate.
- Figma 새 변형 이름/번호 및 확정 치수는 시안 검수 후 확정. 기존 98-09/98-10의 정본을 개별 승인 없이 대체하지 않는다.
