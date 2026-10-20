# YUTOPIA 26번 — 실제 Hover 카드 UI(합성 데이터) 검증 기록

> **2026-10-20 / CARD_UI_CODE_READY / NATIVE_WINDOWS_NODE_150_OF_150_PASS / CHROMIUM_FIXTURE_RETEST_PENDING / LIVE_CHROME_QA_PENDING**

이 기록은 Chrome MV3 확장 개발자용 **MOCK Hover 카드 UI**를 설명한다. 실제 YouTube 데이터 분석, 운영 배포, 사용자 승인 UI 시안 완성 또는 Side Panel 대상 연동에 대한 증거가 아니다.

## 1. 기준과 구현 범위

- **기준:** 25번 PR #12이 frontend에 병합된 커밋 20edd746e25dc82296a220716bf57c8c66cc5b3.
- **신규 파일:** extension/hover-card-model.js (고정 합성 분포 모델), extension/hover-card.js (Shadow DOM UI), extension/tests/hover-card-ui.test.cjs (DOM/상태 검증), 선택적인 extension/tests/chromium-hover-card-fixture.py.
- **Manifest:** shared.js → target-resolver.js → channel-target-resolver.js → content.js → hover-controller.js → hover-card-model.js → hover-card.js. 기존 sidePanel/storage 권한 및 www.youtube.com 호스트 범위를 확대하지 않는다.
- **진입:** 작업 25 Controller의 READY/UNRESOLVED 상태가 왔을 때만 동적 Shadow DOM 카드를 하나 만들고, IDLE/DISMISSED/HOVER_PENDING/앵커 분리 시 제거한다.
- **상태 구분:** READY는 안정적인 VIDEO ID 또는 UC 형식 CHANNEL ID가 있을 때만 표시. CHANNEL @handle만 확인된 경우 UNRESOLVED 카드에 식별 필요 문구만 제공하며 가짜 감성 비율과 상세 CTA를 만들지 않는다.
- **카드 구성:** YUTOPIA / DEMO 배지, 대상 영상·채널의 **정규 ID** (실제 제목 수집하지 않음), 합성 긍정·중립·부정 막대/범례, 2개 가상 논점, 1문장 합성 브리핑, 가상 댓글 표본·가상 분석 범위·'실제 갱신 시각 없음' 및 반복적인 STATIC FIXTURE 고지.
- **데이터 경계:** targetId를 결정적 시드로 3개의 고정 MOCK 데이터 예시 중 하나를 사용한다. 실제 YouTube 댓글·제목/메타데이터·사용자/시청기록·LLM/API 결과를 읽거나 전송하지 않는다. 숫자는 실제 채널/영상과 관계없다.
- **위치:** 활성 링크의 getBoundingClientRect를 이용해 우측 12px 우선 배치하고, 공간 부족 시 좌측 또는 가시 영역으로 제한한다(초기 최대 폭 344px). 인접 영상 썸네일 링크를 크게 가리는 경우에는 아래쪽 가용 공간을 검토한다. 좁은 브라우저/스크롤/리사이즈, 화면 밖 앵커는 안전하게 처리한다.
- **독립성:** 한 번에 하나의 YUTOPIA 카드 Host만 유지하며 Shadow DOM 내부에만 CSS를 삽입한다. YouTube 기존 DOM 내용/링크/이벤트 핸들러를 덮어쓰지 않는다.
- **상호작용:** 카드 안 pointerenter/leave와 focusin/out을 25번 Overlay 유지 API로 연결, Escape/닫기/SPA 경합은 Controller와 동기화. 닫기는 즉시 종료.
- **더보기:** 클릭하면 '27~28번에서 상세 Side Panel 연결'이라는 메시지만 표시한다. 27번 메시지·28번 사용자 클릭 Side Panel 대상 고정은 아직 구현되지 않았다. 임의로 Side Panel을 열어 대상이 연결됐다고 오인시키지 않는다.
- **Figma:** 기존 Figma 설계 파일과 React 12화면은 변경하지 않았다. 10~19 문서의 정보 구성/배치 제안을 기반으로 한 개발 카드이며 정확한 픽셀/디자인 정합성은 Windows Chrome에서 후속 시각 검수가 필요하다.

## 2. 수행된 테스트

| 범위 | 개수 | 결과 / 한계 |
|---|---:|---|
| 21 영상 DOM 탐지 | 9 | PASS, 격리 V8 Mock URL/DOM |
| 22 SPA 변경 관측 | 16 | PASS, 격리 V8 |
| 23 VIDEO ID 검증 | 21 | PASS, 격리 V8 |
| 24 CHANNEL ID/@handle | 32 | PASS, 격리 V8 |
| 25 Hover 상태 제어 | 40 | PASS, 격리 V8 (Manifest 순서 계약 신규 파일 대응) |
| 26 Hover 카드 모델/DOM/CTA·썸네일 겹침 보완 | 32 | PASS, 격리 V8 Mock DOM |
| **전체** | **150** | **150/150 PASS — 실제 Node.js CLI/Chrome 실행 아님** |
| JavaScript 구문 | 신규 모델/렌더러/테스트 | PASS, 격리 V8 파서 |
| Native Node.js CLI | node --test 6개 파일 2회 실행 | **150/150 PASS × 2 — 사용자 제출 PowerShell 원본 로그** |
| Chromium 오프라인 DOM | chromium-hover-card-fixture.py | **실행 중 Host.inner_text() 검증 실패; Shadow Root 내부 검사로 수정 커밋, 재실행 대기** |
| Windows Chrome | 실제 YouTube 홈/검색 카드 위치/조작, 다크/라이트/줌 | **NOT VERIFIED** |
| CI·독립 리뷰 | GitHub 상태 검사·PR 리뷰 | **NOT VERIFIED** |

**격리 V8 수행 방법:** GitHub PR 브랜치 파일을 이용한 모의 어댑터 테스트 150/150 PASS. **별도로** Windows PowerShell 원본 로그에서 실제 Node.js CLI 150/150 PASS를 2회 확인했다(해당 시점 검사 HEAD `84c9e5949c94fa4db6ac842f05f652b7f57d1e87`). Chromium Fixture 검증 성공이나 실제 YouTube Chrome 시각 검증 완료로는 취급하지 않는다.

## 2.1 Windows 실행 로그·Chromium 실패 분석 (2026-10-20)

- 사용자 로그의 HEAD: `84c9e5949c94fa4db6ac842f05f652b7f57d1e87`, `git status --short` 출력 없음. Node --test 6개 파일 **150/150 PASS를 두 번** 기록했고, hover-card-model.js / hover-card.js 구문 검사도 오류 없이 종료.
- Python 가상환경에 playwright 1.64.0 및 Chromium 다운로드 후 `chromium-hover-card-fixture.py`를 실행했으나 이전 버전의 **93행** `assert "Ab0_-123xyz" in card.inner_text()`에서 `AssertionError`가 발생.
- 원인: `<div id="yutopia-extension-hover-card">`는 **open Shadow Root 호스트**이고, 브라우저에서 호스트의 innerText에는 Shadow DOM 안의 텍스트가 포함되지 않는다. 독립 Chromium 최소 사례에서 Host.innerText는 빈 문자열, Host 안 `.card`의 innerText는 기대 문자열로 확인했다. **실제 카드 콘텐츠가 비어 있었다는 증거가 아니다.**
- 대응: `card_content = card.locator(".card")`로 Shadow DOM 내부를 직접 선택하고, 검증 전에 Shadow Root와 `.card` 존재 여부를 별도로 검사하도록 **테스트 Fixture만 수정**. Content Script UI·모델·권한·Node 테스트는 변경하지 않았다.
- 결과: **원인 분석·Fixture 소스 수정 완료 / 사용자 Windows Chromium 재실행 전**. 수정 이후의 Chromium PASS를 주장하지 않는다. 수정본을 `git pull --ff-only`로 받은 후 재검증 필요.
## 3. Node.js 및 선택 Chromium 실행 명령

저장소 루트 기준:

~~~sh
node --check extension/hover-card-model.js
node --check extension/hover-card.js
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs extension/tests/hover-controller.test.cjs extension/tests/hover-card-ui.test.cjs
~~~

정상 기대값: 150 tests, 150 pass, 0 fail.

선택적인 오프라인 Chromium DOM 검증:

~~~sh
python extension/tests/chromium-hover-card-fixture.py
~~~

이는 실제 YouTube 사이트, Chrome 확장 격리 세계, Chrome Side Panel 전체 통합 결과는 아니다.

## 4. Windows Chrome 실제 시각 QA — 아직 미실행

1. 기존 개발 폴더를 수정하지 않고 별도 clone/worktree로 feature/yutopia-26-hover-card 브랜치 복제.
2. PowerShell에서 git rev-parse HEAD와 git status --short 확인, 위 Node 테스트 150건 PASS 및 구문 통과 기록.
3. Chrome chrome://extensions에서 기존 YUTOPIA 검증 확장 일시 비활성화, 이번 브랜치 extension/ 폴더 로드. YouTube 홈 새로고침.
4. YouTube 홈의 4개 이상 썸네일 중 A 위에 마우스를 잠깐(100ms) 올렸다 떼면 카드가 나타나지 않아야 한다.
5. A 위 400ms가량 유지 시 앵커 옆 Hover 카드가 표시되어야 하며, ID가 A 링크의 /watch?v= 값과 같아야 한다. 긍정/중립/부정 차트와 DEMO·STATIC FIXTURE 고지 및 가상 표본/기간이 함께 보여야 한다.
6. B/C로 빠르게 이동 시 이전 영상 A ID/숫자가 잔상으로 남지 않으며 동시에 카드 여러 개가 생기지 않아야 한다.
7. 오른쪽 끝/아래쪽 썸네일, 화면 스크롤·검색 결과, 좁은 브라우저 창/브라우저 줌, YouTube 다크/라이트 모드에서 화면 밖으로 잘리지 않는지 확인한다.
8. 썸네일→카드 포인터 이동 시 닫히지 않고 더보기/닫기 버튼을 클릭할 수 있어야 한다. 더보기는 아직 Side Panel 대상 고정 없이 '27~28번 예정' 안내만 띄운다.
9. 채널 UC 형식 링크에는 CHANNEL 카드/정확한 ID가 보이고, @handle만 있는 채널은 ID 미확정 안내만 보이며 가상 차트·더보기 버튼이 없어야 한다.
10. Tab 포커스/Enter/Escape, 키보드 조작, YouTube 썸네일 프리뷰·기본 클릭·메뉴·스크롤이 그대로 동작하는지 확인한다.
11. HOME→SEARCH→WATCH→HOME SPA 이동, 무한 스크롤/DOM 제거 뒤 카드/리스너 정리, Service Worker/Side Panel 기존 스켈레톤 동작을 확인한다.
12. Chrome DevTools에서 Content Script 격리 컨텍스트로 아래 실행:

~~~js
globalThis.YUTOPIA_HOVER_CARD?.getRuntimeStatus();
globalThis.YUTOPIA_HOVER_CONTROLLER?.getRuntimeStatus();
~~~

13. Chrome 버전, 테스트 SHA, 150개 Node CLI 테스트 결과, UI 이상·스크린샷/재현 절차 및 미커밋 상태를 기록한다.

## 5. Gate

- 26번 코드/모의 검증: READY_FOR_REVIEW / ISOLATED_V8_TESTED.
- Native Windows Node CLI 150/150: PASS × 2 (수정 이전 HEAD의 사용자 로그). 수정 커밋 이후 회귀 재확인은 PENDING.
- Chromium 오프라인 Fixture: Shadow DOM 검증 대상 수정 후 **RETEST_PENDING**.
- 실제 YouTube Windows Chrome 시각·접근성/이벤트 동작: PENDING.
- Figma 픽셀 패리티: 별도 사람 검수 및 승인 필요.
- 27번 메시지·28번 패널 대상 고정·29번 실제 Chrome 통합 QA: 아직 미구현.
- 실제 YouTube API/감성 파생 정책/결제/배포: NOT_AUTHORIZED.
- 본 PR은 Draft 유지. 사용자 실브라우저 검증·테스트 SHA 확인 후 별도 병합 승인 판단.
