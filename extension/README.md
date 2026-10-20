# YUTOPIA Chrome 확장 — 로컬 DEMO / 개발자 전용

> **EXPERIMENTAL · 실제 YouTube 댓글/API/AI/결제/로그인 없음 · Chrome MV3**

이 폴더는 YUTOPIA **YouTube 홈에서 썸네일 Hover → 간략 반응 카드 → 더보기 → Chrome Side Panel**을 구현하기 위한 독립 PoC 영역입니다.

## 기술 경계

- 기존 `frontend/` React 데모와 별개로 작동합니다.
- **모의 분석값만 표시**하고 사용자의 실제 댓글이나 브라우징 이력을 수집하지 않습니다.
- **HTTP API/YouTube API/LLM 호출을 하지 않습니다.** 데이터 사용권/파생지표 승인이 있기 전에는 운영 연결을 추가하지 마세요.
- Chrome 116 이상 MV3 + `sidePanel` API를 기준으로 시연합니다.
- 브라우저에서 로컬로 테스트하기 전에는 **기능 PASS라고 보고하지 않습니다**.

## 설치 — 코드를 별도 디렉터리로 받은 후

1. 현재 유지되는 **`frontend` 브랜치의 `extension/`** 디렉터리를 가져오거나 별도 Git worktree에 체크아웃하세요. 병합 후 삭제된 임시 기능 브랜치를 사용하지 마세요. 다른 Codex가 작업하는 로컬 브랜치는 변경하지 마세요.
2. Chrome 주소창에 `chrome://extensions` 입력.
3. 오른쪽 상단 **개발자 모드** 활성화.
4. **압축해제된 확장 프로그램을 로드(Load unpacked)** 선택 후 이 `extension/` 폴더 선택.
5. `https://www.youtube.com/`에 들어가 실제 홈 썸네일 여러 개로 시험.
6. 소스를 수정했다면 확장 관리 화면에서 **새로고침** 후 YouTube 탭도 새로고침.

**보안:** 확장 권한은 `youtube.com`만 지정했습니다. 사용자 개인정보·토큰·원문 댓글은 저장하지 않습니다.

## 테스트/디버깅

- 이 폴더는 별도 `pnpm`/빌드 의존성을 요구하지 않는 **plain JavaScript** 실험입니다.
- 로컬 Chrome에서 실제 Hover·패널 열림 동작, 브라우저 권한·스타일 충돌을 검증해야 합니다.
- `content.js` 등 확장 코드의 함수를 수정하는 경우 목적·입력·출력·실패·기존 기능과의 관계를 **한국어 블록 주석**으로 설명하세요.
- `javascript:` URL·`eval`·페이지 컨텍스트로 고객 정보를 주입하는 코드는 금지합니다.
- 테스트 결과는 [00~99 실행대장](../docs/product-v0.2/04_EXECUTION_00_99.md)에서 해당 단계별 증거로 연결하세요(기능 브랜치에는 제품 문서가 포함되지 않을 수 있음).

## 21·22번 영상 후보 탐지 (실제 카드 표시 전)

- YouTube 홈(/)·검색(/results)의 일반 영상 썸네일 렌더러를 DOM에서 읽기 전용으로 탐지합니다.
- 광고·Shorts·외부 도메인·빈 영상 링크를 제외하고, 중복 콘텐츠 스크립트 주입을 방지합니다.
- 화면에 카드를 추가하거나 실제 YouTube 댓글·메타데이터를 수집하지 않습니다. **21·22번 영상 탐지와 SPA 자동 재탐지는 frontend에 병합**되어 있으며 23번 엄격한 videoId 검증은 별도 검토 브랜치에 준비됐습니다. Hover 표시(25~26)는 구현 전입니다.
- **기본 테스트:** 저장소 루트에서 `node --test extension/tests/content-discovery.test.cjs` 실행(별도 npm 의존성 없음).
- **선택 Chromium DOM Fixture:** `python extension/tests/chromium-dom-fixture.py` (Python Playwright와 Chromium 필요, 실제 확장 E2E 아님).
- **검증·미완료 Gate:** [20·21 테스트 기록](tests/QA_20_21_EVIDENCE.md).

## 22번 SPA·무한 스크롤 자동 갱신

- MutationObserver가 새 영상 카드·카드 제거·href/숨김/광고 속성 변화를 관측하고, YouTube SPA 이동 이벤트와 popstate를 처리합니다.
- 짧은 시간에 발생한 DOM 변화를 120ms로 묶고, added/removed/updated 구독 알림을 제공합니다. dispose()는 observer·타이머·이벤트·이전 DOM 참조를 해제합니다.
- **Node 재실행:** `node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs` (기존 9건+신규 16건).
- **선택 Chromium SPA Fixture:** `python extension/tests/chromium-spa-fixture.py` (Playwright 필요; 제출 시 미실행).
- **검증 사실(2026-10-20 독립 재실행):** Node.js 22의 공식 테스트 러너 **25/25 PASS**, 저장소의 Chromium 오프라인 SPA Fixture **PASS**. [22번 QA 기록](tests/QA_22_EVIDENCE.md)에 Blob SHA 및 실행 범위를 기록했습니다. **Windows Chrome 기본 동작은 2026-10-20 사용자 수동 검증 7/7 PASS로 보고됐습니다. 단, 실행 로그·로컬 검증 SHA는 아직 첨부되지 않았습니다.**
- [PR #8](https://github.com/Choi1999/YOUTOPIA/pull/8)(21번)과 [PR #9](https://github.com/Choi1999/YOUTOPIA/pull/9)(22번)는 frontend에 순차 병합됐습니다. 신규 23번 코드는 별도 브랜치에서 검수합니다.

## 23번 VIDEO ID 정확성 검증 (개발 검수 중)

- 대상이 분명한 YouTube /watch?v= 링크만 VIDEO target으로 승인하며, 11자 영숫자·하이픈·밑줄 형식만 허용합니다(보수적 MVP 가정).
- 중복 v 매개변수·잘못된 문자/길이·비YouTube·비HTTPS·유사 도메인·썸네일/제목 영상 ID 불일치를 거부합니다.
- Manifest는 shared.js → target-resolver.js → content.js 순서로 탐지 계약을 로드합니다.
- 기존 21·22번 후보 탐지의 candidate 수치는 보존하면서, VIDEO ID가 검증된 후보만 target을 제공하고 getRuntimeStatus().identifiedCandidates로 수를 구분합니다.
- 재실행: `node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs`.
- 격리 V8 기반 모의 테스트 46/46 PASS, 실제 신규 Node CLI·Windows Chrome 재검증 미완료. [23번 QA 기록](tests/QA_23_EVIDENCE.md)을 참고하세요.

## 현재 단계

- **20:** Chrome MV3 기본 뼈대 및 문서.
- **21:** 영상 후보 탐지 코드 병합. Node 9/9, 오프라인 Chromium PASS 및 Windows 수동 PASS 사용자 보고.
- **22:** SPA/무한 스크롤 변경 감지 코드 병합. Node CLI 25/25, Chromium 오프라인 PASS, Windows 수동 PASS 사용자 보고(원본 로그·SHA 미제출).
- **23:** 엄격 VIDEO target Resolver 및 테스트 작성, 격리 V8 46/46 PASS, 신규 실브라우저 검증 대기.
- **24~29:** 채널 ID 식별·Hover·카드·패널·실브라우저 통합 E2E 순차 구현 예정.
- **실제 YouTube API/외부 AI/구독 결제:** 구현하지 않음.
