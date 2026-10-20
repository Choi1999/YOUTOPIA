# YUTOPIA — 작업 20·21 테스트 기록

> **기준일 2026-10-19 / NODE_FIXTURE_PASS / CHROMIUM_DOM_FIXTURE_PASS / REAL_EXTENSION_SMOKE_NOT_VERIFIED**
>
> 실제 YouTube 영상·댓글/채널 자료, API/LLM/결제, 로그인 또는 관리자 UI는 이 검증에서 사용하지 않았습니다.

## 1. 실행 범위

- **20:** Chrome MV3 스켈레톤의 manifest 구문·참조 파일·최소 권한, JavaScript 정적 구문 확인.
- **21:** 영상 목록 DOM 탐지, 지원 경로(Home/Search), 광고/Shorts/외부 출처 링크 제외, 중복 초기화, DOMContentLoaded 이후 탐지, 명시적 재탐지.
- **제외:** Chrome 확장 실제 설치·Content Script 격리 세계 로딩·Service Worker 구동 PASS·실제 사이트 DOM·SPA 자동 재탐지(22번)·정확한 videoId 검증(23번)·Hover/UI(25~28번).

## 2. 로컬 실행 결과

**Node.js 22.16.0 · Chromium 144 · Python Playwright (독립 작업 환경)**

| 검증 | 실행 방법 | 결과 | 해석 |
|---|---|---|---|
| Manifest 구조/참조 파일/권한 | JSON 검사 및 로컬 파일 존재 확인 | PASS | MV3, sidePanel/storage, www.youtube.com 최소 범위 |
| JS 구문 | node --check extension/content.js 및 기존 JS 파일 | PASS | 구문만 확인 |
| Node DOM Fixture 9건 | node --test extension/tests/content-discovery.test.cjs | **9/9 PASS** | 모의 DOM·초기화·링크·재탐지 |
| Chromium DOM Fixture | python extension/tests/chromium-dom-fixture.py | **홈·검색 PASS** | Chromium DOM 엔진에서 오프라인 합성 HTML 탐지 |
| Chromium 실제 확장 기동/Worker 등록 | 독립 Playwright persistent-context 실험 | **NOT VERIFIED** | 환경에서 Worker 등록을 확인하지 못함. PASS 아님 |
| 실제 YouTube 및 사용자 Chrome | 수행하지 않음 | **NOT RUN** | 별도 실브라우저 검증 필요 |

**Chromium Fixture 기술적 제한:** Chrome 웹사이트 대신 오프라인 HTML을 띄우며, 실행 스코프의 가상 pathname/origin을 제공합니다. 프로덕션 탐지 알고리즘의 DOM 읽기 동작을 확인하는 용도일 뿐, Chrome content-script 격리 세계, 확장 설치, 브라우저 사이드 패널 기능 및 실제 YouTube 최신 DOM 호환을 검증하지는 않습니다.

## 3. 로컬 재실행 명령

저장소 루트에서 실행합니다.

~~~sh
node --check extension/content.js
node --test extension/tests/content-discovery.test.cjs
~~~

Chromium Fixture는 **선택 검증**이며 Python Playwright와 Chromium이 필요합니다. 브라우저 설치가 없는 경우 최초 1회 다음을 실행합니다.

~~~sh
python -m pip install playwright
python -m playwright install chromium
python extension/tests/chromium-dom-fixture.py
~~~

Linux의 기존 Chromium을 사용하려면 CHROMIUM_BIN 환경변수에 실행 파일 경로를 지정합니다. Windows에서도 동일 환경변수로 설치 경로를 지정할 수 있습니다.

## 4. 사용자 PC의 실제 Chrome 수동 확인 — 아직 수행 전

1. 독립 worktree/브랜치의 extension/ 폴더를 준비한다. 다른 작업자의 frontend 로컬 변경은 덮어쓰지 않는다.
2. Chrome의 chrome://extensions에서 개발자 모드 → **압축해제된 확장 프로그램 로드**로 해당 폴더를 선택한다.
3. 확장 오류 화면에서 Manifest V3·Service Worker 로드 오류가 없는지 확인한다.
4. https://www.youtube.com/ 홈을 열고 다수의 일반 영상 카드가 보이는지 확인한다.
5. 개발자 도구 Console에서 **YUTOPIA 콘텐츠 스크립트의 격리 실행 컨텍스트**를 선택할 수 있다면 아래 함수를 실행한다.

~~~js
globalThis.YUTOPIA_VIDEO_DISCOVERY?.getSnapshot()
~~~

6. HOME 및 감지된 일반 영상 개수를 확인한다. 검색 페이지에서는 SEARCH를 확인한다. Shorts/광고 카드가 포함되거나 YouTube 기본 조작이 달라져서는 안 된다.
7. 재주입·새로고침 후 중복 초기화가 없는지 확인한다.
8. 실제 Chrome 확장 Service Worker와 Side Panel은 **20번 구동 검증**으로 따로 기록한다. 탐지기에서 자동 Hover 카드는 아직 표시되지 않는다(25~26번 계획).

## 5. 판정 및 후속

- **21 단계 코드/오프라인 테스트:** READY_FOR_REVIEW / FIXTURE_TESTED.
- **20 실브라우저 스모크:** PENDING / NOT_VERIFIED.
- **21 실브라우저 호환·인수:** PENDING / NOT_VERIFIED.
- **22:** SPA/무한 스크롤 자동 재탐지와 해제/재바인딩.
- **23:** 영상 ID의 정확성·불확실한 링크 거부.
- **24:** 채널 ID/@handle 검증.
- **25~29:** Hover 상태·카드·메시지·패널·실제 브라우저 E2E.

이 문서의 PASS는 오직 명시한 로컬 테스트에만 적용됩니다. 00~99의 **완전한 실행 단계 VERIFIED**로 승격할 근거는 아닙니다.
