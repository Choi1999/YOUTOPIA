# YUTOPIA 24번 — CHANNEL ID / @handle 식별 검증 기록

> **2026-10-20 / CODE_READY / ISOLATED_V8_78_OF_78_PASS / NODE_CLI_NOT_RUN / WINDOWS_CHROME_NOT_VERIFIED**

이 문서는 식별 기능과 테스트 증거의 범위만 기록한다. 실제 채널 존재·구독 권한·YouTube API 분석·공개 배포 승인이 아니다.

## 1. 구현 범위

- **기준 커밋:** frontend의 23번 병합 SHA 7f236feee061d1eac49a3ea4c0164951064a24a7.
- **분리 원칙:** 기존 VIDEO는 /watch?v=... 유지. 채널은 별도 YUTOPIA_CHANNEL_TARGET_RESOLVER 및 subscribeChannels() 이벤트에서 식별.
- **채널 ID 후보:** /channel/UC 와 이어지는 22자 [A-Za-z0-9_-] (총 24자). identityType=CHANNEL_ID, resolutionStatus=ID_FORMAT_VALID. **형식 검사일 뿐 온라인 채널 존재/소유권 확인이 아니다.**
- **핸들:** /@handle에서 보수적 ASCII 3~30자 패턴. identityType=HANDLE, resolutionStatus=HANDLE_UNRESOLVED, targetId=null, channelId=null. 비라틴/불확실한 핸들은 현재 유보한다.
- **상세 전송 경계:** toIdentifiedTarget(identity)는 유효 UC 형식의 채널 ID에만 targetId를 제공하며 핸들에서 임의 ID를 생성하지 않는다.
- **거부 정책:** /c/custom, /user/legacy, /watch, 유사 도메인, HTTP, 인코딩/dot-segment 경로, 서로 다른 채널 링크가 한 카드에 포함되는 경우 추측하지 않는다.
- **DOM:** 홈/검색에서 영상 카드에 포함된 채널명/아바타와 채널 검색결과만 탐지. HTML 텍스트·댓글 수집 없음.
- **SPA:** 기존 단일 MutationObserver를 재사용. VIDEO와 CHANNEL 후보는 다른 Map·구독 이벤트를 사용하며 기존 영상 후보 수치는 보존한다.
- **범위 밖:** 채널 Hover UI, Side Panel 대상 고정, handle→channelId 네트워크 매핑, 라이브 댓글/파생 감성, 구독·인가·결제.

## 2. 수행한 검증

| 항목 | 범위 | 판정 |
|---|---|---|
| JavaScript 구문 | 신규 Resolver·Content Script 및 테스트 파일 | PASS — 격리 V8 파서 |
| 기존 회귀 테스트 | 21·22·23번 9+16+21건 | **46/46 PASS — 격리 V8 모의** |
| 24번 신규 Fixture | channelId·handle·DOM/SPA 32건 | **32/32 PASS — 격리 V8 모의** |
| 합계 | 78개 | **78/78 PASS — 격리 V8 모의** |
| Native Node.js | node --test 실제 CLI | **NOT RUN** |
| 오프라인 Chromium DOM | chromium-channel-fixture.py | **NOT RUN**, 재현용 소스만 추가 |
| Windows Chrome 실사이트 | 신규 코드 실제 설치/주입 | **NOT VERIFIED** |
| GitHub Actions/독립 리뷰 | 신규 PR 실행/승인 증거 | **NOT VERIFIED** |

**정직한 검증 범위:** 격리 V8에서 Mock URL/Node VM/DOM 어댑터로 실행한 테스트이지, Native Node CLI나 Chrome E2E가 아니다. 사용자 보고의 이전 23번 Chrome PASS는 신규 24번 코드를 검증한 증거가 아니다.

## 3. 재실행 명령 (저장소 루트)

~~~sh
node --check extension/channel-target-resolver.js
node --check extension/content.js
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs extension/tests/channel-target-resolver.test.cjs
~~~

선택적인 Chromium 오프라인 Fixture:

~~~sh
python -m pip install playwright
python -m playwright install chromium
python extension/tests/chromium-channel-fixture.py
~~~

이 Chromium 검증은 실제 YouTube 사이트, Chrome 확장 격리 세계, Service Worker 정상 동작을 검증하지 않는다.

## 4. Windows Chrome 수동 QA (미실행)

1. 기존 frontend를 건드리지 않고 별도 clone/worktree에서 검증 브랜치를 가져온다. git rev-parse HEAD, git status --short 기록.
2. Manifest의 Content Script 순서 확인: shared.js → target-resolver.js → channel-target-resolver.js → content.js.
3. Chrome chrome://extensions에서 기존 검증 확장은 비활성화하고 새 extension/ 폴더를 임시 로드한다.
4. YouTube 홈 DevTools의 YUTOPIA Content Script 격리 콘솔에서 아래 실행.

~~~js
const r = globalThis.YUTOPIA_CHANNEL_TARGET_RESOLVER;
const id = r?.resolveFromHref("/channel/UCaaaaaaaaaaaaaaaaaaaaaa");
const handle = r?.resolveFromHref("/@creator");
console.log({id, handle, rejectedHandle: r?.toIdentifiedTarget(handle)});
globalThis.YUTOPIA_VIDEO_DISCOVERY?.getRuntimeStatus();
globalThis.YUTOPIA_VIDEO_DISCOVERY?.findChannelCandidates().slice(0, 5);
~~~

5. UC 문자열은 ID_FORMAT_VALID / CHANNEL_ID 형태, 핸들은 HANDLE_UNRESOLVED / targetId:null. rejectedHandle은 null.
6. 실제 홈·검색의 채널명/아바타, 채널 검색 결과 및 무한 스크롤에서 channelLinksTracked가 갱신되는지 확인한다.
7. HOME→SEARCH→WATCH 전환에서 CHANNEL 후보 해제·복귀 및 VIDEO 후보 미혼합 확인.
8. 광고 배제, Service Worker·Side Panel, 기존 YouTube 조작 유지 검증.
9. Chrome 버전, 출력, Git SHA, 오류·스크린샷 기록.

실제 YouTube 페이지에 /@handle만 있는 것은 정상이다. 핸들이 ID로 확정됐다고 표시하지 않는다.

## 5. Gate / 후속

- 24번 코드·모의 테스트: READY_FOR_REVIEW / ISOLATED_V8_TESTED.
- 신규 Native Node/Chromium/Windows Chrome: PENDING.
- 핸들에서 실제 channelId 확인: 외부 API·정책 Gate 미확정.
- 25번은 Hover 상태 제어로, 오직 확인된 안정된 분석 대상만 상세 패널에 전달하도록 구현할 것.
- frontend 병합/공개 출시는 별도 검증과 승인 필요.
