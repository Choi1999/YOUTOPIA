# YU-27 Worker Messaging & Synthetic Session Cache — QA 증거

> CODE_READY / LOCAL_NODE_17_OF_17_PASS / ORIGINAL_160_NOT_RERUN / CHROMIUM_MV3_NOT_CONFIRMED / LIVE_YOUTUBE_NOT_RUN / PR_REVIEW_REQUIRED

## 범위 및 보호 계약

- frontend merge HEAD d7f271b5afa1fc6b0bf31c000da6aa73611a6dc0 기반 독립 feature/yutopia-27-worker-messaging 브랜치.
- YU-26 Hover Controller/Card 코드·기존 160건 테스트 무변경. 기존 Hover 카드와 disabled 더보기/닫기 유지.
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

- 기존 Node 160건 + 신규 17건 전체 회귀: NOT RUN. GitHub 전체 저장소를 이 로컬 환경으로 직접 가져올 수 없었음.
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
