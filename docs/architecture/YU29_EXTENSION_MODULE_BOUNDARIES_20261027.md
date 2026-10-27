# YOUTOPIA YU-29 — Chrome 확장 추상화·모듈 경계 정리

> **2026-10-27 KST · AR-01 분리 구현 후보 / 프런트엔드 정본 불변 / 기능 무변경 리팩터링 / 실데이터 금지**
>
> 정본 기준: `frontend@78b7712a831ee773f7340d44671275fb93ad34f3`; `extension/` Git tree `70feb17559f61b28a4d97bdf13ffa1aa8c289468`.
>
> 개발 브랜치: `refactor/youtopia-yu29-worker-boundaries-20261027` (신규 Draft PR; 리뷰/QA 전 자동 병합 금지).

## 1. 목표와 제한

목표는 복잡한 프레임워크를 도입하는 것이 아니라 **변경 이유가 다른 코드를 독립된 경계로 이동**시키는 것이다. 기존 VIDEO/CHANNEL 식별, Hover 카드와 Side Panel, 사용자 명시 클릭, 탭별 고정, 만료 및 실패 경로의 외부 관찰 가능한 동작은 유지한다.

포함 범위: 의존도 조사, 책임 할당, 가장 효과가 큰 Worker 서비스 추출, 회귀 테스트 및 명시적인 변경 계약.

제외 범위: 실제 YouTube/Steam API·원문 댓글·사용자 기록 수집, 분석 작업 큐·DB, AI 추론, 로그인·구독·결제, 공개 배포, HTML/CSS 디자인 변경, Chrome Manifest 권한 확대. `shared/contracts/analysis-v1`은 FE/BE 승인 전까지 **DRAFT / MOCK-ONLY**이며 여기서 활성화하지 않는다.

이전에 병합한 G28-2 **post-merge Chrome 재스모크는 사용자의 명시적 선택으로 생략**하고, 기존 Windows 병합 후 Node 210/210 + Chromium 5/5 PASS 및 Git SHA/확장 트리 일치를 기준선으로 사용한다. 생략은 과거 테스트의 재실행 필요성을 낮출 뿐 **새 리팩터링의 Chrome 부팅 성공을 주장하는 것이 아니다.**

## 2. 구현 중인 계층과 책임 소유권

| 계층 | 구성 요소 | 유일한 소유 책임 | 해서는 안 되는 것 |
| --- | --- | --- | --- |
| YouTube DOM 인식 | `target-resolver.js`, `channel-target-resolver.js`, `content.js` | HOME/SEARCH/SPА에서 적격 VIDEO/CHANNEL 후보, 안정 ID, 미해결 ID 상태 | API 수집, 가짜 @handle→UC 변환 |
| 상호작용·상태 | `hover-controller.js` | Hover READY/IDLE/UNRESOLVED, requestId, 현재 대상·카드 이동 상태 | 사용자의 선택 pin을 Hover만으로 변경 |
| 합성 미리보기 | `hover-card-model.js`, `preview-client.js`, `hover-card.js` | STATIC_FIXTURE 미리보기 및 렌더링, 명시 클릭 전달 | Worker 캐시 또는 세션 저장소 직접 제어 |
| 프로토콜·불변식 | `shared.js`, `panel-selection-contract.js` | 메시지 버전, VIDEO/CHANNEL ID, request/response 형태·선택 TTL 검증 | Chrome API 호출, 실제 공급자 연결 |
| Worker 진입점 | `background.js` | MV3 부트스트랩, 메시지 라우팅, YU-27 캐시 및 G28-1 호환 진단 | G28-2 선택 수명주기와 탭별 pin 직접 관리 |
| Worker 선택 서비스 **AR-01 추출** | `panel-selection-worker.js` | G28-2 클릭→패널 오픈→탭별 session pin, READ, 세대 경쟁·문서/탭 종료 | DOM/디자인, 영구 사용자 데이터 |
| Side Panel 표시 | `sidepanel.js`, `sidepanel.html`, `sidepanel.css` | 활성 탭의 검증된 선택 상태 읽기·표시·TTL 시각 만료 | Hover 상태에서 자동 선택·가짜 분석값 생성 |
| 분석 도메인 후보 | `shared/contracts/analysis-v1/` | AnalysisSnapshot/Job/Trend/Entitlement 후보 계약, synthetic fixture | 승인 없이 현재 Worker/Side Panel의 실제 API로 승격 |

`panel-selection-worker.js`는 **Worker 서비스 경계만 분리**한다. 내부에서 `chrome.sidePanel`, `chrome.storage`, `chrome.tabs`에 접근하는 실행 어댑터 결합은 다음 마일스톤의 과제다. 이번 변경을 완성된 Clean Architecture로 과장하지 않는다.

## 3. 관측 가능한 경로 및 강제 불변식

```text
YouTube DOM (읽기 전용)
  -> TargetResolver / ContentDiscovery
  -> HoverController (READY, requestId)
  -> HoverCard (STATIC_FIXTURE / 클릭 이전에는 pin 변경 없음)
     -> [사용자 명시 클릭]
     -> background.js (동기 메시지 라우팅)
     -> panel-selection-worker.js
        -> chrome.sidePanel.open({tabId}) [비동기/await 이전]
        -> 유효성·탭 세대 검증
        -> chrome.storage.session[tabId] (2시간, STATIC_FIXTURE)
        -> 응답 PINNED 또는 구체적 실패 상태
  SidePanel -> READ_SELECTION -> background.js -> panel-selection-worker.js
            -> 활성 탭 검사 + 검증된 세션 선택 -> 상태 표시
```

변경 후에도 보존할 항목:

1. `sidePanel.open()`는 사용자의 실제 클릭을 처리하는 메시지 호출 스택에서 **어떤 await/Promise 작업보다 먼저 호출**한다.
2. 미확정 `@handle`, 잘못된 ID, 위조된 extension sender/tab/document/frame/origin은 fail-closed.
3. A 클릭 이후 B Hover만으로는 A pin 변경 금지. B 명시 클릭만 B로 전환. 늦은 A와 빠른 B의 역전 방지.
4. `storage.session`의 `YU28_SELECTED_TAB_V1_<tabId>` 키·2시간 TTL·`STATIC_FIXTURE` 의미·탭별 격리 유지.
5. Side Panel 발신자에는 `sender.tab`/`sender.frameId`가 없을 수 있으므로 정확한 extension ID 및 `chrome.runtime.getURL("sidepanel.html")`로 확인하며 탭 있는 위조 발신자 거부.
6. YU-27 합성 Preview 캐시·기존 G28-1 OPEN-only 진단 메시지 계약은 유지한다. 런타임 네트워크 호출/권한은 추가하지 않는다.
7. 기존 테스트 스위트와 Manifest를 유지하며, Worker classic `importScripts`에 새 모듈을 명시적 의존 순서로 포함한다.

## 4. 마일스톤 · 완료 정의

| 단계 | 범위 | 완료 조건 | 상태 |
| --- | --- | --- | --- |
| AR-00 | 현재 의존도·책임·공통 계약 인벤토리, 기준 커밋 고정 | 계층 표·불변식·금지 영역 기록 | 문서 작성 |
| **AR-01** | G28-2 Worker 선택 로직을 `panel-selection-worker.js`로 추출, `background.js`를 직접 라우터로 축소 | 코드 + 구조 계약 테스트 + 원본 Node/Chromium 회귀 | 코드 후보, native 검증 전 |
| AR-02 | 중복 VIDEO/CHANNEL 식별자 검증을 순수 TargetIdentity 계약으로 합의·통합 | YouTube resolver + Worker/Panel 소비자 간 계약·악성 ID 테스트, Script 로딩 순서 회귀 | 미착수 |
| AR-03 | Chrome runtime/storage/sidePanel/tabs Adapter 및 Worker 미리보기 캐시 서비스 분리 | 저장 실패·탭 격리·MV3 활성화와 호환성 회귀 | 미착수 |
| AR-04 | Hover UI View/행동 분리와 향후 `AnalysisSnapshot` 소비 계약 정렬 | 시각 의미·synthetic 배지 유지, FE/BE 승인 경계 문서화 | 미착수 |
| AR-05 | 확장 전체 아키텍처 적대적 재검수·유지보수 경계 고정 | 명세/QA/리스크 기록 및 각 단계별 사용자 병합 승인 | 미착수 |

원칙: **한 단계 한 책임 이동, 기능 동작 무변경, 격리된 Draft PR, 별도 QA와 별도 병합 승인**. 공통 클래스를 임의로 늘리거나 범용 DI 컨테이너/상태 관리 라이브러리를 도입하지 않는다.

## 5. AR-01 증거 및 Gate

- 기존 병합 정본: Node **210/210**, Chromium Fixture **5/5**와 `frontend`/확장 Git 트리 확인 기록 확보.
- AR-01 변경: `panel-selection-worker.js` 신규, `background.js` 라우팅/서비스 경계 이동, 기존 Worker test harness의 `importScripts` 명시 및 `module-boundaries.test.cjs` 추가. UI/Manifest/데이터 스키마 무변경.
- AR-01 소스 추출 검수: G28-2 기존 본문 **7,561자(들여쓰기 제외) 동일**, G28-1 Worker 진단 함수 동일; 격리 V8 모의 회귀는 **G28-2 20/20 + G28-1 10/10 + YU-27 17/17 + Hover UI 42/42 + 경계 5/5 = 94/94 PASS**. 이 결과는 실제 Node CLI/Chromium/Chrome 실행이 아닌 구조 확인 및 모의 검사로만 기록한다.
- 신규 Node 테스트 예상 **215건** (기존 210 + 구조 경계 5); 정적 구문 및 커스텀 V8 모의 회귀는 부차적 증거일 뿐 **Windows Node/Chromium/실제 Chrome/CI PASS가 아니다**.
- [ ] AR-01 후보의 전체 Git SHA/extension tree/clean checkout 검증
- [ ] Windows 공식 Node 215건 + 원본 Chromium Fixture 5종, 로그/종료 코드
- [ ] Worker bootstrap/importScripts의 설치형 Chrome 최소 로드 확인은 새 모듈의 별도 호환성 위험으로 남겨 둔다. 이전 G28-2 전체 시나리오를 무조건 반복할 필요는 없지만 이 실행 검증을 사용자 승인 없이 PASS로 만들지 않는다.
- [ ] Code review/merge 별도 승인 전 `frontend` 불변. 정책 Gate 미승인 상태 유지.

**진행 판정:** `AR00_BOUNDARIES_DEFINED / AR01_SOURCE_CANDIDATE / NATIVE_QA_PENDING / FRONTEND_UNCHANGED / LIVE_DATA_BLOCKED`.
