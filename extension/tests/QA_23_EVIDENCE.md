# YUTOPIA 23번 — VIDEO ID 정확성 검증 기록

> **2026-10-20 / STRICT_VIDEO_TARGET_CODE_READY / ISOLATED_V8_46_OF_46_PASS / NODE_CLI_AND_WINDOWS_NOT_RUN**

## 1. 목적과 구현 경계

- **기반:** frontend 병합 SHA 85a171939bd3ed5424d2be8e349151f4be8ca09a (PR #8/#9 21·22 구현 포함).
- **신규:** extension/target-resolver.js; MV3 Content Script 목록에서 shared.js 다음, content.js 앞에 삽입.
- **VIDEO ID 정규 형식:** MVP 정책상 11자 영문 대·소문자/숫자/밑줄/하이픈만 수락. 이것은 서비스의 보수적인 식별 규칙으로 실제 YouTube 존재·소유권 또는 미래의 ID 형식까지 보증하지 않는다.
- **URL:** https://www.youtube.com/watch?v={videoId} 또는 같은 출처의 상대 주소만 지원. 단일 v 필수. 중복 v, 빈 값, 재인코딩, 잘못된 문자·길이, 외부 도메인, 사용자정보 포함 주소, HTTP, 모바일·단축 주소 등은 거부.
- **카드 일치성:** 썸네일 ID와 같은 카드 내 다른 /watch 링크의 ID가 다르면 target: null로 유보. 다른 채널 링크 등은 식별 불일치로 간주하지 않는다.
- **소비자 계약:** 대상이 명확할 때 targetType=VIDEO, targetId, source=YOUTUBE, canonicalUrl을 반환하며, 그렇지 않으면 null. 기존 탐지 단계의 candidates는 그대로 유지하고 getRuntimeStatus().identifiedCandidates가 식별된 후보 수를 별도 제공.
- **변경 전파:** 동일 썸네일 DOM이라도 카드 내 다른 영상 링크가 바뀌어 ID 유효성이 달라지면 updated 이벤트로 전달.
- **정책:** 원문 댓글·사용자 이력 수집, 네트워크 API/LLM/결제, DOM 삽입/수정 및 실제 영상 존재 확인은 수행하지 않는다.

## 2. 수행된 검증

| 항목 | 범위 | 결과 |
|---|---|---|
| JS 구문 검사 | Resolver / Content Script / 테스트 3개 | PASS (격리 V8 파서) |
| 21번 DOM 탐지 회귀 | 기존 테스트 9건 | 9/9 PASS (격리 V8) |
| 22번 SPA 회귀 | 기존 테스트 16건 | 16/16 PASS (격리 V8) |
| 23번 VIDEO 식별 | 신규 테스트 21건 | 21/21 PASS (격리 V8) |
| **합계** | **46개 테스트** | **46/46 PASS — 모의 실행** |
| Native Node.js CLI | 실제 node --test 재실행 | **NOT RUN** |
| Windows Chrome 신규 Resolver 주입 | Manifest 로딩 및 실제 YouTube 링크 형식 | **NOT VERIFIED** |
| GitHub Actions / 독립 리뷰 | 신규 PR에서 필요 | **NOT RUN** |

**검증 수단:** GitHub 원본 파일을 readback 확인한 후, 격리 JavaScript V8에서 모의 URL/VM 및 Node 모듈 어댑터로 테스트 실행. Native Node.js 테스트 러너 결과로 해석해서는 안 된다. 이전 21·22번의 Node CLI 25/25 PASS와 Windows 수동 7/7 PASS 기록은 해당 과거 커밋 범위의 증거이며 신규 23번 변경까지 검증했다는 뜻은 아니다.

## 3. 재실행 명령

~~~sh
node --check extension/content.js
node --check extension/target-resolver.js
node --test extension/tests/content-discovery.test.cjs extension/tests/content-spa-observer.test.cjs extension/tests/video-target-resolver.test.cjs
~~~

Windows Chrome 수동 절차:
1. 다른 개발자의 작업물을 건드리지 않고 PR #10(23번) 검증 전용 worktree 또는 별도 clone 사용.
2. Chrome chrome://extensions → 개발자 모드 → extension/ 폴더 로드.
3. Manifest의 스크립트 순서를 shared.js, target-resolver.js, content.js로 확인.
4. YouTube 홈·검색의 Content Script 격리 Console에서 Resolver API를 호출.
5. 아래의 샘플 videoId는 형식 테스트용이며 실제 존재하는 영상인지 확인하지 않는다.

~~~js
globalThis.YUTOPIA_VIDEO_TARGET_RESOLVER?.resolveFromHref(
  "/watch?v=Ab0_-123xyz"
);
globalThis.YUTOPIA_VIDEO_DISCOVERY?.getRuntimeStatus();
~~~

6. 정상 형식은 VIDEO target을 반환하고, 잘못된 URL은 null인지 확인.
7. 기존 HOME/SEARCH/SPA/무한 스크롤/Service Worker·Side Panel 동작을 재확인한다.
8. 테스트 Chrome 버전, 콘솔 출력, Git SHA, 오류·스크린샷을 기록한다.

## 4. 작업 완료 판정

- **23번 코드 준비:** READY_FOR_REVIEW / ISOLATED_V8_TESTED.
- **실제 Node CLI·Windows Chrome 재검증:** PENDING.
- **23번 완전 검증·병합:** NOT_VERIFIED / NOT_MERGED (별도 승인과 실제 실행 증거 필요).
- **24~29:** 채널 ID/@handle, Hover/UI/패널/Chrome 확장 MVP는 범위 밖.
