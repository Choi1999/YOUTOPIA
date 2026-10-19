# YUTOPIA 22번 — SPA 자동 재탐지 검증 기록

> **기준일: 2026-10-20 / CODE_READY / ISOLATED_V8_FIXTURE_25_OF_25_PASS / WINDOWS_CHROME_NOT_VERIFIED**
>
> 이 파일은 **22번 구현과 모의 테스트의 근거**이며 실제 Windows Chrome·YouTube 라이브 페이지 검증 또는 출시 승인이 아닙니다.

## 1. 변경 내용과 수용 범위

- Content Script: Chrome/YouTube 홈(/)·검색(/results)의 일반 영상 후보를 지속 탐지한다.
- MutationObserver: 자식 노드 삽입/제거와 href, hidden, aria-hidden, is-promoted, data-ad-slot 변경을 관측한다.
- yt-navigate-finish, yt-page-data-updated(document 및 window), popstate(window) 수신 후 120ms debounce로 한 번 재탐지한다.
- 탐지 결과 added / removed / updated 구독 이벤트를 제공한다. 링크가 바뀌면 updated, 카드가 삭제되면 removed로 구분한다.
- 탐지할 수 없는 /watch, /shorts, 플레이리스트 등에서는 후보 0개로 정리한다.
- dispose()는 observer, 예약 타이머, 이벤트 리스너, 후보 DOM 참조, 구독자를 정리한다.
- 외부 네트워크/API, 댓글 수집/저장, DOM 표시 변경, 영상 ID의 엄격한 검증, Hover·Side Panel 동작은 이 범위에 포함되지 않는다.

## 2. 수행한 테스트(실행 수단을 명확히 구분)

| 검증 | 결과 | 근거와 한계 |
|---|---|---|
| content.js, 기존 21번 테스트, 신규 22번 테스트 JS 구문 파싱 | PASS | 격리된 V8 JavaScript 실행 환경의 Function 파서 |
| 기존 21번 테스트 9개 | 9/9 PASS | GitHub에서 원문을 읽은 후 격리 V8에서 모의 node:vm / URL 객체로 실행 |
| 22번 SPA/MutationObserver 모의 테스트 16개 | 16/16 PASS | 동일 격리 V8의 가상 Document·Observer·타이머·URL |
| 합계 | **25/25 PASS** | **Node.js CLI에서 실행한 결과는 아님** |
| 실제 node --test를 통한 저장소 환경 재실행 | NOT RUN | 재현 가능한 소스/명령은 포함 |
| 신규 Playwright Chromium SPA Fixture | NOT RUN | chromium-spa-fixture.py에 브라우저 DOM 시나리오 추가 |
| 사용자 Windows Chrome 확장 실제 로드·Service Worker | NOT VERIFIED | 연결된 브라우저 컨텍스트에 접근하지 못해 증거 없음 |
| 실제 YouTube 홈/검색 SPA·무한 스크롤 | NOT VERIFIED | 현재 YouTube DOM 구조와 컨텍스트 확인 필요 |

**모의 테스트에서 수행한 22번 검증:** 단일 MutationObserver, 신규 카드 감지, 60회 변화 단일 검사, 관련 없는 DOM 무시, 삭제 시 참조 해제, 동일 앵커 주소 변경, Home→Watch→Search, 빈 href→정상, 광고/Shorts 제외, DOMContentLoaded 재주입 방지, dispose 이후 재시작, 구독자 예외 격리, Observer 부재 fallback, 중첩 컨테이너 추가, window 내비게이션 이벤트, 광고 속성 변화.

## 3. 재실행 명령 (검증 전에는 PASS 주장 금지)

저장소 루트에서 Node.js 22+ 사용:

~~~sh
node --check extension/content.js
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs
~~~

오프라인 Chromium Fixture(선택):

~~~sh
python -m pip install playwright
python -m playwright install chromium
python extension/tests/chromium-spa-fixture.py
~~~

Python Fixture는 실제 Chromium DOM에서 SPA 이벤트/추가·삭제·href 변경을 관찰하는 테스트지만 Chrome 확장 Content Script의 **격리 실행 세계나 Service Worker를 설치하여 시험하지 않습니다**.

## 4. Windows Chrome 실브라우저 수동 QA (미실행)

- [ ] Codex 로컬 frontend와 충돌하지 않는 별도 worktree에서 이 브랜치의 extension/을 사용.
- [ ] Chrome chrome://extensions → 개발자 모드 → 압축해제된 확장 프로그램 로드. Manifest/Service Worker 오류 부재 확인.
- [ ] YouTube 홈 일반 영상 썸네일 여러 개에서 탐지 결과 확인.
- [ ] Chrome DevTools 콘솔에서 콘텐츠 스크립트의 격리 컨텍스트 선택 후 아래를 실행:

~~~js
globalThis.YUTOPIA_VIDEO_DISCOVERY?.getSnapshot()
globalThis.YUTOPIA_VIDEO_DISCOVERY?.getRuntimeStatus()
~~~

- [ ] route: HOME, observing: true 및 적절한 영상 후보 수. 광고/Shorts 제외.
- [ ] 무한 스크롤에서 일반 영상이 추가된 뒤 후보 수가 증가하고 검사 횟수가 계속 비정상적으로 폭증하지 않음.
- [ ] 검색 페이지 이동 시 route: SEARCH, 비지원 영상 재생 화면에서는 UNSUPPORTED, 후보 0건 확인.
- [ ] 썸네일 제거·이전/다음 페이지 복귀 시 오래된 데이터·DOM 참조가 보존되지 않음.
- [ ] 기존 YouTube 검색·재생·썸네일 Hover·메뉴·광고 조작이 바뀌지 않음.
- [ ] Chrome 버전·Windows 버전·검증자·검증 시각·실패 스크린샷/콘솔을 기록.

**주의:** Chrome DevTools의 일반 YouTube 페이지 컨텍스트에서는 격리된 콘텐츠 스크립트의 전역 객체가 노출되지 않을 수 있습니다. 검사 컨텍스트를 바꾸지 않은 채 undefined를 본 경우 곧바로 주입 실패로 판정하지 않습니다.

## 5. 판정 및 PR 경계

- 22 구현: **READY_FOR_REVIEW / ISOLATED_FIXTURE_TESTED**.
- 전체 22 단계 승인: **PENDING**, 실제 Chrome/YouTube 검증 전 VERIFIED 금지.
- PR #8(21번)는 frontend 대상 Draft 그대로 유지.
- 22번은 PR #8의 헤드 브랜치를 기준으로 **별도 stacked Draft PR**에 제출. PR #8 검증·병합이 선행되어야 frontend 병합을 판단할 수 있다.
- 23번 ID 검증, 24번 채널, 25번 Hover, 26번 카드, 27번 메시지, 28번 Side Panel, 29번 실제 Chrome PoC는 별도 후속 작업.
