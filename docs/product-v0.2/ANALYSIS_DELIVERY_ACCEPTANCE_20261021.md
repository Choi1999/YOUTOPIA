# YOUTOPIA — 분석 전달·트렌드 단계별 인수 검증 계획 v0.1

> **2026-10-21 KST / DRAFT QA PLAN / 승인된 설계 방향을 실행 가능한 검증 항목으로 변환**
>
> 이 문서의 **예상 동작과 테스트 케이스는 아직 실행 결과가 아니다.** 최초 YU-27 사용자의 Node 177/177 PASS·오프라인 Chromium 2/2 PASS는 실제 실행 기록에 근거하지만, 신규 서버·계약·트렌드 시나리오는 모두 NOT RUN.
>
> 아키텍처: [ANALYSIS_DELIVERY_ARCHITECTURE_20261021.md](./ANALYSIS_DELIVERY_ARCHITECTURE_20261021.md).
> 현재 실행대장: [04_EXECUTION_00_99.md](./04_EXECUTION_00_99.md).

## 1. Gate 순서와 수용 기준

| Gate | 단계 | 선행 조건 | 합격 근거 | 현황 |
|---|---|---|---|---|
| AD-G0 | YU-27 | 기존 메시지/캐시 구현 | Windows Node 177/177, Chromium Fixture 2/2, 실제 설치형 Chrome Service Worker 통신/콘솔/세션 상태 확인 | **Node/오프라인 Chromium PASS; 설치형 Chrome 미확인** |
| AD-G1 | YU-28 | YU-27 메시지 경계 확정 | 더보기 클릭→Side Panel 오픈, 클릭한 영상·채널 대상 고정, Hover로 패널 대상 불변, 다른 더보기 클릭에서만 변경 | NOT RUN |
| AD-G2 | YU-29 | MOCK UX 상태 완성 | 캐시 HIT/MISS/STALE/NO_DATA/PROCESSING/POLICY_BLOCKED 시나리오를 실제 Chrome 콘텐츠/패널에서 일관되게 표시 | NOT RUN |
| AD-G3 | YU-30~39 | 데이터/권한 계약, 정책 검토 | 캐시·Singleflight·큐 mock consumer/provider 계약 및 권한/분모/출처/버전 테스트 | NOT RUN |
| AD-G4 | YU-40~49 | 합성 주제·감성·시간표본 | 다중 언어/주제 추출 품질, 주제별 감성, 시간·범위 정합성, 거짓 주장 차단 | NOT RUN |
| AD-G5 | YU-80~99 | 정책/실데이터/조직·출시 권한 승인 | 성능·보안·정확성·장애복구·접근성·스토어 검증 증거 | NOT RUN |

YU-27 이후 각 기능 PR의 독립 Review, Test SHA, Clean Worktree 및 원본 실행 로그는 별도로 보존한다. **서버 연결, 실제 댓글/API, 외부 모델, 청구/배포는 선행 정책 Gate 불충족 시 차단**한다.

## 2. YU-27 현재 단계 — 실제 Chrome 통신 검증

| ID | 실제 수동 테스트 | 합격 기준 | 증거 |
|---|---|---|---|
| AD-001 | Chrome 개발자 모드에서 YU-27 확장만 로드, YU-26은 비활성 | Service Worker 초기화 오류 없음, 중복 Script 없음 | 확장 ID·버전·콘솔 |
| AD-002 | YouTube Home/Search 일반 영상 Hover A→B→A | 현재 targetId와 requestId만 수락, 과거 A가 B를 덮지 않음 | Content DevTools \`YUTOPIA_PREVIEW_CLIENT.getRuntimeStatus()\` |
| AD-003 | 같은 영상 재진입/카드 A↔카드↔A, C로 전환 | 카드 고정·배경 B 선택 차단·기존 Safe Transit/SPA 동작 유지 | 영상/채널/포인터 테스트 로그·화면 |
| AD-004 | Service Worker DevTools에서 session 저장소 열람 | \`YU27_SYNTHETIC_SESSION_V1\` 캐시/스코프 존재, \`STATIC_FIXTURE\`/\`isSynthetic\` 참 | 저장소 출력(사용자 개인정보 마스킹) |
| AD-005 | 워커 유휴 종료/다시 시작 후 같은 영상 Hover | 허용된 범위에서 session 캐시 재사용, 오류 발생 시 fail closed | Worker 로그·cache HIT/MISS |
| AD-006 | 미해결 \`@handle\`, 잘못된 VIDEO ID, 광고/Shorts | 상세 대상으로 임의 승격하지 않음 | UI 상태·로그 |
| AD-007 | 두 탭, 다른 문서, 빠른 응답 경합 | 응답이 탭/현재 대상 밖으로 혼입되지 않음 | 테스트 콘솔·캡처 |

**이번까지의 실제 실행:** YU-27 Native Node 177/177 PASS와 Offline Chromium 2/2 PASS. 위 AD-001~007의 **실 Chrome 메시지 경계 검증은 미제출**. 기존 Chromium Fixture는 이 AD-001~007을 대신하지 않는다.

### 실행 지침

~~~powershell
Set-Location "$env:USERPROFILE\YUTOPIA-Chrome-QA-27"
git status --short
git pull --ff-only origin feature/yutopia-27-worker-messaging
git rev-parse HEAD

node --test extension/tests/*.test.cjs

$py = "$env:USERPROFILE\YUTOPIA-QA26-venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }
& $py extension/tests/chromium-hover-fixture.py
& $py extension/tests/chromium-hover-card-fixture.py
~~~

실제 설치형 Chrome은 \`chrome://extensions\`에서 로드한 \`extension/\` 폴더로 별도 검증. Console 검사 예시:

~~~javascript
const item = await chrome.storage.session.get("YU27_SYNTHETIC_SESSION_V1");
console.log(item.YU27_SYNTHETIC_SESSION_V1);
~~~

확장 Service Worker의 DevTools 콘솔에서만 위 \`chrome.storage.session\` API를 실행해야 한다. 사용자 DevTools 페이지 컨텍스트에는 없을 수 있다.

## 3. YU-28~29 — 합성 데이터 UX 검증 시나리오

| ID | 입력 시나리오 (모두 STATIC_FIXTURE) | 기대 결과 |
|---|---|---|
| AD-010 | 영상 A 카드에서 더보기 클릭 | Side Panel 열리고 **클릭 당시 A**가 선택됨 |
| AD-011 | A 패널 열린 상태에서 B/C Hover | 패널은 계속 A, Hover 카드만 B/C |
| AD-012 | 다른 영상 B 카드에서 더보기 클릭 | 패널 대상이 B로 명시적으로 갱신 |
| AD-013 | 채널 UC ID가 확정된 경우 | 정확한 CHANNEL 대상만 전달 |
| AD-014 | 미확정 @handle 또는 광고/Shorts | 패널 오픈 강행/대상 추정 금지 |
| AD-015 | 현재 영상에서 캐시 HIT | 가상 결과와 STATIC_FIXTURE/가상 범위 고지 |
| AD-016 | 캐시 MISS 또는 아직 미분석 | 로딩/정보 미확보; 퍼센트 가공 금지 |
| AD-017 | 이전 스냅샷만 있고 STALE | 오래됨·기준 시각 표시; 실제 최신 분석으로 표시하지 않음 |
| AD-018 | 부분 결과 PARTIAL | 관측 범위/누락수·표본 설명 없이 완전 결과로 표시하지 않음 |
| AD-019 | POLICY_BLOCKED/ENTITLEMENT_LIMITED/COMMENTS_DISABLED | 각각 서로 다른 상태·문구로 표시 |
| AD-020 | A 응답이 B로 이동한 뒤 도착 | Hover A 응답이 B 카드를 덮지 않음 |
| AD-021 | 설치형 Chrome 탭 전환·SPA·무한 스크롤 | listener 누적/오류/대상 혼동 없음 |
| AD-022 | Chrome 어두운 테마·줌·키보드 | 사용 가능, 포커스 경계·Esc 정상 |
| AD-023 | Chrome Worker 중단, 저장소 예외 | 오류·미확보 표시, 임의 성공 응답 금지 |
| AD-024 | 데모 분석 스냅샷만 존재 | 모든 수치/상태에 MOCK/DEMO 표시, 실제 댓글 조회 없음 |

**주의:** AD-010~024는 실제 기능 개발 후 수행할 Acceptance Plan이다. YU-27의 disabled 더보기 버튼을 지금 활성화했다는 뜻이 아니다.

## 4. YU-30~39 — 서버 계약·캐시·큐 테스트 (정책 승인 전 MOCK Provider)

| ID | 계약 테스트 | 합격 기준 |
|---|---|---|
| AD-030 | 정확한 \`VIDEO/CHANNEL\`의 유효 ID만 요청 | 불명/임의 ID 및 외부 출처 거부 |
| AD-031 | \`videoId\` 같아도 \`analysisScope\` 다름 | 결과/캐시 서로 오염되지 않음 |
| AD-032 | 공용 분석 vs 조직 전용 결과 | PUBLIC_REUSABLE/TENANT_PRIVATE 격리; 권한 재확인 |
| AD-033 | 같은 조건의 동시 요청 N개 | Singleflight로 한 작업만 생성, 모두 동일 범위 상태 수신 |
| AD-034 | 버전·모델·주제 taxonomy·정책 개정 | 이전 캐시를 최신 결과로 재사용하지 않음 |
| AD-035 | 캐시 생성/갱신/삭제·STALE | 출처/관측 시각·TTL/무효화 이유 명시 |
| AD-036 | 서버 작업 큐 처리 중 워커 재시작 | 작업 상태 지속·이중 실행/결과 덮어쓰기 방지 |
| AD-037 | quota 소진, 오류, 재시도, 과부하 | 무제한 API 호출 없음; 정책 우선 fail-closed |
| AD-038 | 영상 데이터 취소/삭제/비공개 | 원문/파생 결과 무효화·접근 차단 계약 |
| AD-039 | API 제공자 연결 비승인 | 외부 네트워크/실데이터 접근 없음, MOCK 경로만 동작 |

### 계약 응답의 최소 메타데이터 예시

~~~json
{
  "target": {"source": "YOUTUBE", "targetType": "VIDEO", "targetId": "Ab0_-123xyz"},
  "status": "PARTIAL",
  "isSynthetic": true,
  "sourceType": "STATIC_FIXTURE",
  "analysisScope": "ONE_VIDEO",
  "sample": {
    "rawCount": 120,
    "eligibleCount": 100,
    "excludedCount": 20,
    "sentimentClassifiedCount": 80
  },
  "observedAt": "2026-10-21T12:00:00+09:00",
  "analyzedAt": "2026-10-21T12:01:00+09:00",
  "analysisVersion": "mock-0",
  "topicTaxonomyVersion": "mock-0",
  "policyStatus": "MOCK_ONLY"
}
~~~

이는 **스키마 논의를 위한 합성 예시**이며 API 응답 구현, 실제 관측시간 또는 실제 데이터가 아니다. \`rawCount\`, \`eligibleCount\`, \`excludedCount\`, \`classifiedCount\`의 합·포함 관계를 명시하는 테스트가 필수다.

## 5. YU-40~49 — 주제 × 감성 × 시간 계약 테스트

| ID | 합성 입력과 비교 기준 | 기대 결과 |
|---|---|---|
| AD-040 | 다른 영상 두 개에서 '재료비'와 '가격' 후보 | 확인된 매핑 근거/분류 버전이 있을 때만 PRICE 동일 주제 |
| AD-041 | GAME 영상과 COOKING 영상의 동음이의 키워드 | 의미 다르면 주제 병합 금지 |
| AD-042 | 토픽 0건, 적격 댓글 0건, 분모 미확정 | 0%로 표시하지 않고 UNAVAILABLE·NO_DATA 구분 |
| AD-043 | 주제 다중 라벨 댓글 | 합계 100%를 강요하지 않고 분모/중복 라벨 고지 |
| AD-044 | 주제 언급률과 주제 내 부정 비율 동시 증가 | 두 비율과 절대 건수·관측 범위를 함께 표시 |
| AD-045 | 감성 모델 버전·주제 taxonomy 변경 | 다른 버전의 주간 시계열을 무비판적으로 연결 금지 |
| AD-046 | 영상 게시 연령/댓글 수집기간 불일치 | COMPARABILITY_CONDITIONAL 또는 UNCOMPARABLE |
| AD-047 | 한 시점만 존재 | TREND_UNAVAILABLE. ‘급상승’ 신호 생성 금지 |
| AD-048 | 주제별 부정 댓글 다수 | 곧바로 제품 결함·사실 확인·인과 관계로 승격 금지 |
| AD-049 | 소수 영상의 특정 주제 | 채널 전체·YouTube 전체 트렌드로 일반화 금지 |

트렌드 수식과 event/observed/fetched/analyzed 시각 분리는 아키텍처 문서 5절을 따른다. 다국어 분류와 주제 군집의 안정성도 별도 데이터셋 검증 항목으로 추가한다.

## 6. 품질 지표 (목표 초안, 실제 수치 없음)

- **UI responsiveness:** 유효 Hover에서 카드가 즉시 나타나는 UX 계약 유지. 실제 렌더 지연은 사용자 장치에서 측정.
- **Cache HIT latency:** 허용된 유효 캐시의 첫 요약 표시 P95 1초 이내를 **실험 후보 목표**로 두고 측정한다. 네트워크/지역/캐시 크기/데이터 소스에 따른 값 미검증.
- **Coverage:** 전체 실제 Hover 중 캐시 결과 보유/부분/미확보 비율을 구분하되 개인 추천 피드 저장 없이 집계 가능성 우선 검토.
- **Cache reuse ratio:** 동일 조건 요청의 분석 작업 절감률. 테넌트 간 공유 허용 범위를 침범하지 않음.
- **Queue latency/cost:** MISS에서 Ready까지의 처리 시간, 기각 비율, Provider quota, 처리 예산. 임의로 즉시 완료를 보증하지 않음.
- **Quality:** 표본 수/기간/댓글 커버리지/주제-감성 분류 정확도/신뢰도/추세 계산 가능한 비율.
- **Browser stability:** DOM 재주입, MutationObserver/listener 중복, Worker 재시작, 장시간 사용 자원 및 Chrome 버전별 테스트.

## 7. 보고·병합 조건

각 단계별 QA 문서에는 \`tested_sha\`, 실행 OS·Node/Python/Chromium·Chrome 버전, 실행 명령, PASS/FAIL 수, 실제 오류, 사용자 실Chrome 결과, 스크린샷/로그 근거와 아직 검사하지 않은 항목을 반드시 분리 기록한다.

- **\`CODE_READY\`**: 구현 검토 가능할 뿐 실제 Chrome 통합 검증 PASS를 의미하지 않음.
- **\`NODE_PASS\`**: 해당 commit에서 Native Node 검증 실제 통과.
- **\`CHROMIUM_OFFLINE_PASS\`**: Playwright 등 오프라인 브라우저 DOM 검증 실제 통과. 설치형 확장 PASS가 아님.
- **\`CHROME_MV3_PASS\`**: 실 Chrome 로드/서비스 워커/메시지/카드 경계의 수동·자동 검증 실제 통과.
- **\`POLICY_GATE_PASS\`**: 실데이터 사용에 필요한 외부·사용자·법적 승인 증거. 별도 기록 없으면 FAIL_CLOSED.
- **\`MERGED\`**: 별도 사용자 병합 승인과 실제 GitHub 머지 증거가 있어야만 기록.

**이 두 설계 문서는 승인된 개발 방향의 정리이며 향후 YU-28~49를 구현/병합해도 된다는 포괄적인 허가가 아니다.** YU-27 설치형 Chrome 검증을 먼저 완료하고, YU-28부터는 기능 범위·검증·PR을 독립적으로 진행한다.
