# YU-27 Worker Messaging & Synthetic Session Cache — QA 증거

## 2026-10-21 Windows 전체 Native Node 재검증 — 177/177 PASS (최신)

- **사용자 제공 실제 PowerShell 로그** (`붙여넣은 텍스트(1)(20261021-041740).txt`): `C:\Users\diser\YUTOPIA-Chrome-QA-27`에서 `git pull --ff-only origin feature/yutopia-27-worker-messaging`가 `7be47b6..73573b3` Fast-forward 성공.
- **테스트 대상 SHA:** `73573b3f01b1e0f9376a29ecfa93e2aa70abb877`; `git rev-parse HEAD` 출력과 일치. `git status --short`는 pull 전 빈 출력. Pull 후 별도 clean 확인 명령은 해당 로그에 없음.
- **명령:** `node --test extension/tests/*.test.cjs`.
- **실행 결과:** **177 tests / 177 pass / 0 fail / 0 skipped / 0 cancelled**, `duration_ms 192.7404`. 기존 YU-21~26 160건과 신규 YU-27 17건 전부 PASS.
- 과거 176/177 FAIL이었던 Manifest 로드 순서 검사 `Manifest: model/renderer는 Hover controller 이후 순서로 실행` 역시 **PASS**. 변경 커밋 `634d0160fd0868c14e907cad248330db1c2817b5`의 수정 효과를 확인.
- **게이트 판정:** `WINDOWS_NATIVE_NODE_FULL_177_OF_177_PASS` / `CHROMIUM_OFFLINE_FIXTURES_PENDING` / `INSTALLED_CHROME_MV3_PENDING` / `LIVE_YOUTUBE_FINAL_PENDING`. Node 통과를 Chrome 설치형 확장 E2E 통과로 간주하지 않는다.
- PR은 계속 **Draft / 미병합**. 이후 Chromium Fixture 2종과 Windows 설치형 Chrome Service Worker·Content Script 통합 검증 결과 필요.
- **이하 176/177 FAIL 기록과 당시 PENDING 문구는 실패 발견 시점의 이력이며 현재 Node 최종 상태가 아니다.**

---


## 2026-10-21 Windows Native Node 전체 실행 — 초기 FAIL 및 수정

- **사용자 제출 PowerShell 로그:** `C:\Users\diser\YUTOPIA-Chrome-QA-27`에서 `7be47b664e3a1765ae1e931712966e21249f9f76`를 Clone했고 `git status --short`에는 변경사항 출력이 없었다.
- **실행 명령:** `node --test extension/tests/*.test.cjs`. 총 **177 tests / 176 pass / 1 fail / 0 skipped**. YU-27 신규 메시지/캐시 테스트 17건은 모두 PASS.
- **실패:** `extension/tests/hover-card-ui.test.cjs:217`의 Manifest script load 순서 검증. 기존 테스트는 마지막 3개 스크립트를 `hover-controller.js → hover-card-model.js → hover-card.js`로 고정했고, 신규 `preview-client.js`가 model과 renderer 사이에 삽입되어 `list.at(-2)`가 `preview-client.js`가 되는 계약 회귀.
- **수정:** `extension/manifest.json` 마지막 4개를 `hover-controller.js → preview-client.js → hover-card-model.js → hover-card.js`로 조정. `extension/tests/hover-card-ui.test.cjs`는 마지막 4개를 정확히 검증하도록 강화. model → renderer 연속 배치와 controller → client 로딩 의존성을 모두 유지. 변경 커밋 `634d0160fd0868c14e907cad248330db1c2817b5`.
- **정적 Readback:** GitHub에 저장된 Manifest와 기존·신규 Node 테스트의 script order assertion이 모두 일치함을 확인. 이는 Windows Native Node의 최신 **177/177 PASS 증거가 아님**.
- **현재 Gate:** `WINDOWS_NODE_176_OF_177_INITIAL_FAIL / LOAD_ORDER_FIX_COMMITTED / WINDOWS_177_RETEST_PENDING`. 수정 후 Windows 회귀 재실행과 설치형 Chrome/Chromium 검증을 수행해야 한다.

### 이미 Clone한 QA-27 폴더에서 최신화 후 재검증

~~~powershell
Set-Location "$env:USERPROFILE\YUTOPIA-Chrome-QA-27"
git status --short
git pull --ff-only origin feature/yutopia-27-worker-messaging
git rev-parse HEAD
git status --short
node --test extension/tests/*.test.cjs
~~~

기존 `git status --short`가 빈 출력인지 먼저 확인한다. 다른 로컬 변경이 있으면 덮어쓰지 않는다. **이 PR은 Draft이며 아직 병합하지 않는다.**

---


> CODE_READY / LOCAL_NODE_17_OF_17_PASS / WINDOWS_NATIVE_NODE_177_OF_177_PASS / CHROMIUM_OFFLINE_PENDING / CHROMIUM_MV3_NOT_CONFIRMED / LIVE_YOUTUBE_NOT_RUN / PR_REVIEW_REQUIRED

## 범위 및 보호 계약

- frontend merge HEAD d7f271b5afa1fc6b0bf31c000da6aa73611a6dc0 기반 독립 feature/yutopia-27-worker-messaging 브랜치.
- YU-26 Hover Controller/Card 런타임 코드 무변경. 기존 160건 테스트 중 1건의 Manifest 순서 단언을 신규 client 도입에 맞게 확장했으며 기존 Hover 카드와 disabled 더보기/닫기는 유지.
- shared.js: 버전 1 VIDEO/CHANNEL ID·정수 requestId·정확한 메시지 필드 검증.
- preview-client.js: READY 상태만 송신, 중복 송신 회피. isCurrentRequest가 일치하는 응답만 내부 진단값으로 수용. 카드 UI/Side Panel 조작 없음.
- background.js: 발신 확장 ID, 최상위 frame, YouTube origin, tab.id/documentId 검증. stale request 및 동일 requestId 대상 충돌 차단. 메시지와 저장소 갱신 순차 처리.
- chrome.storage.session 합성 STATIC_FIXTURE 전용: VIDEO:<id>/CHANNEL:<id> 키, **기술 시연 TTL 60초**, cache 64개·scope 64개 상한. YU-32 실서비스 캐시 계약과 별개.
- 실제 YouTube API·댓글 수집·계정/구독/결제·Side Panel 대상 고정 없음. 권한 추가 없음.
- sender.documentId를 요구하므로 설치형 Chrome 116 이상에서 필수 실제 검증 남음.

## 로컬 실제 수행한 검증

Linux 컨테이너 Node v22.16.0에서 신규 파일들을 포함한 격리 Node/V8 Fixture 실행. 새 4개 소스 파일은 GitHub에 쓴 파일의 Git blob SHA와 로컬 git hash-object 값이 일치함. 기존 hover-card-model.js는 frontend에서 읽은 합성 모델 기능을 복제했고, Manifest는 동일한 권한과 script load 순서를 가진 축약 검증본이다.

~~~bash
node --check extension/shared.js
node --check extension/background.js
node --check extension/preview-client.js
node --test extension/tests/worker-message-cache.test.cjs
~~~

- JS 구문 검사 3건 PASS.
- 신규 17 tests / 17 pass / 0 fail / 0 skipped.
- 확인: VIDEO/CHANNEL 별도 캐시, HIT/MISS, 유효하지 않은 ID와 @handle 거절, 위조/iframe/다른 origin 발신자 거부, 이전 세대 응답 차단, 같은 requestId 다른 대상 거절, 탭·문서 격리, 워커 재시작 상태 지속, TTL·용량 상한, 저장소 장애 fail-closed, 기존 DEMO ping, 무관 메시지 무시, Content client 늦은 응답 거부.
- 위 PASS는 **기존 YU-21~26 Node 160건이나 실제 Chrome MV3 전체 E2E의 PASS가 아님**.

## 미실행/미확인

- Linux 격리 환경에서는 기존 Node 160건 + 신규 17건의 전체 회귀 NOT RUN. 사용자 Windows에서는 이전 SHA `7be47b664e3a`로 전체 177건을 실행해 176 PASS/1 FAIL을 확보했으며, Manifest 순서 수정 후 전체 재실행은 PENDING.
- Chromium Hover Fixture 2종, 라이브 YouTube 최종 SHA 자동 검증: NOT RUN.
- 로컬 Chromium/Playwright로 YouTube URL interception 시험을 시도했으나 브라우저가 net::ERR_BLOCKED_BY_ADMINISTRATOR 반환. 별도 임시 MV3 Worker 점검 또한 성공 증거를 확보하지 못함. 브라우저 PASS로 표기 금지.
- Windows 설치형 Chrome, 장시간 사용, 접근성: PENDING.
- GitHub 공식 CI PASS: 주장하지 않음.

## Windows 실제 재검증 (PowerShell)

이전 YU-26 원격 브랜치는 삭제됐으므로 새 기능 브랜치를 Clone.

~~~powershell
Set-Location "$env:USERPROFILE"
git clone --single-branch --branch feature/yutopia-27-worker-messaging https://github.com/Choi1999/YOUTOPIA.git YUTOPIA-Chrome-QA-27
Set-Location "$env:USERPROFILE\YUTOPIA-Chrome-QA-27"
git branch --show-current
git rev-parse HEAD
git status --short
node --test extension/tests/*.test.cjs
python extension/tests/chromium-hover-fixture.py
python extension/tests/chromium-hover-card-fixture.py
~~~

Python Fixture는 실제 Playwright/Chromium 준비 후 실행. 원격 SHA와 깨끗한 작업 트리를 함께 기록.

### Chrome 확장 수동 인수 시나리오

1. chrome://extensions에서 extension/을 압축 해제 확장으로 로드하여 Service Worker 시작 오류를 확인.
2. YouTube Home/Search A→카드→A, 카드 뒤 B 차단, 노출 C 전환, 동일 A 반복 Hover와 SPA 교체를 재검증.
3. Chrome Content Script DevTools 컨텍스트에서 YUTOPIA_PREVIEW_CLIENT.getRuntimeStatus()를 확인. 현재 대상 ID만 수용하고 오래된 응답이 반영되지 않아야 함.
4. Worker 종료·재시작 후 합성 session cache 동작 확인. 브라우저 세션 밖으로 캐시 지속을 주장하지 않음.
5. 더보기/닫기 disabled 유지, 실제 댓글 수집·패널 자동 이동·로그인/구독 동작이 없음을 확인.
6. 실Chrome 결과를 확보하기 전 YU-27 VERIFIED/MERGE_READY 판정 금지.

## 범위 분리

YU-28은 사용자 더보기 클릭의 실제 Side Panel 대상 고정. YU-29는 전체 Chrome PoC. YU-32는 실서비스 캐시 정책. 이 PR에서 구현 완료로 취급하지 않음.
