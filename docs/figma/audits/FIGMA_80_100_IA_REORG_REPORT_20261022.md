# YOUTOPIA — Figma 80~100 제품 IA 개편·보존 검증 보고 (2026-10-22)

> 상태: **FIGMA_REORGANIZATION_DONE / STATIC_QA_PASS / PRODUCTION_UX_NOT_FINAL / PRESENT_NOT_RUN / PRODUCT_CODE_UNCHANGED**
>
> 기준 파일: [YOUTOPIA Figma](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/).
> 신규 현행 [00 Page Registry: 80~100](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1583-2).
> 원래 [00–99 Page Registry (2026-10-21)](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1367-2)는 역사적 증거로 보존.
> 기계판독 근거: [FIGMA_80_100_IA_REORG_EVIDENCE_20261022.json](./FIGMA_80_100_IA_REORG_EVIDENCE_20261022.json).

## 1. 사용자 요청과 적용한 원칙

**요청:** 80~100 페이지에서 불필요한 구성요소·중복된 역할/기능을 구분하고, 합치거나 분리하며 실제 편집 가능한 Figma 구조로 개편.

**사용자 승인 제품 방향(변경하지 않음):**
- Chrome Guest-first: 허용된 기본 Hover/Side Panel은 로그인 강제 없이. 최신 98의 **요약·주제·추이 3탭** + 맥락형 분석 기준 상세, 선택 영상 고정.
- 무료 고객 로그인: 대상 영상·채널 **북마크 / 개인 메모 / 폴더**, 분석 Snapshot과 원시 댓글 자동·영구 저장 없음.
- 개인 구독: 허용된 복수 대상 비교·긴 기간·관측/추적·보고 후보. 조직 구독: 실제 조직 역할에 따른 공유·협업.
- 구독·기능 이용권과 고객 개인/조직/플랫폼 운영/DEV·QA 인가 **서로 다른 축**. 관리자·QA 진입점은 고객 확장에 없음.
- 82 플랫폼 관리자 웹은 **운영 현황·정책/감사 2뷰**, 83 전용 QA 웹은 필수 구현이 아닌 테스트 실행기·Trace/SHA 증거 우선.
- API 허용·YouTube 파생 지표 사용권·결제·가격·한도·저장 기간은 이번 Figma 개편으로 승인/구현되지 않음.

**원본 보존:** 이 작업에서 이전 승인 프레임을 삭제하거나 번호를 재할당하지 않았다. 구형 자료는 페이지명/시각 밴드/검토 링크를 통해 **ARCHIVE/REFERENCE**로 표시했다.

## 2. 페이지 분할·통합·보관 결과

| 번호 | 결론 | 현재 역할 및 변경 |
|---|---|---|
| [80](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1582-20) | 유지/정리 | Guest/무료/개인 구독 **고객 역할 상태**. 84~87 실제 고객 업무 페이지로 연결하는 IA 목차 추가 |
| [81](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1582-83) | 유지/격리 | 고객 조직 구성원/자기 조직 관리자. 플랫폼 82의 운영권한과 섞지 않음 |
| [82](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1582-146) | **통합/승격** | 신규 승인한 운영 현황·정책/감사 **2뷰 × Light/Dark**를 최상단. 기존 7메뉴·Theme QA는 아래 역사적 존으로 이동 |
| [83](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1582-209) | **축소/분리** | 실제 테스트 증거·Runner 우선. 기존 QA Simulator/Regression 웹은 아래 참조 존으로 이동 |
| [84](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1576-2) | **신설/분리** | 무료 고객 보관함: 빈 상태와 **합성 북마크·메모·폴더 목록** |
| [85](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1576-92) | **신설/분리** | 유료 복수 영상·채널 비교: 대상 선택과 **비교 불가능** 상태 |
| [86](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1576-182) | **신설/분리** | 구독 추적: 관측 설정 후보와 데이터 이력 부족 상태; 실제 예약·알림은 없음 |
| [87](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1576-272) | **신설/분리** | 무료/구독 기능 범위 및 명시적 업셀; 가격·구독 한도·Checkout 미구현 표시 |
| 88~89 | **미생성** | 업무적 필요가 확인되지 않아 임의로 번호를 채우지 않음 |
| 90~92 | **레거시 아카이브** | 구형 **게임 Pilot**과 주간 관측/운영 시안. 기존 반응·교차 페이지 프로토타입 유지, 신규 고객 제품 정본은 아님 |
| 93 | React Demo Reference | 기존 YU-01~12 Dark/Light 시안은 테스트/기술적 재사용 근거. 최종 Chrome 중심 고객 웹의 유일한 IA가 아님 |
| 94 | Public/rights reference | 공개·출처 설명용 참조, 실제 법적·정책 승인과 분리 |
| 95~97 | Presentation archive | 발표 시스템/본편/근거 자산 기존 유지. 제품 실제 구현 흐름과 분리 |
| [98](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1582-255) | **핵심 유지·재배치 + 신규 3탭 시나리오** | 최신 영상 Hover/요약·주제·추이/근거는 보존하고 **채널 Dark·자료 없음 Light 3탭 후보 10개** 추가. 구형 채널/No Data/4탭은 별도 보존 |
| [99](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1582-308) | 아카이브 통합 목차 | 게임 Pilot 90~92, React Demo 93, 공개 94, 발표 95~97, 옛 Chrome 98에 대한 접근 인덱스. 실제 프레임들은 기존 위치에 보존 |
| [100](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1581-24) | 인증 책임 분리 | 기존 F01~F08 화면 보존. **F01~F06 고객 Chrome·고객 웹 로그인/복귀**, **F07 플랫폼 관리자 웹 전용**, **F08 내부 QA 웹 후보**로 8개 클릭 가능한 검토 링크 작성 |

**페이지명 기준 통합:** 80~100 페이지가 **기존 15개 → 현재 19개**가 되었다. 기존 페이지 번호와 Node ID는 임의 교체·삭제하지 않았음. 84~87을 90 앞에 정확히 배치했고 88~89는 결번이다.

## 3. 84~87 새 고객 화면·데이터 설계

| 페이지 | 신규 화면 상태(각 Light/Dark) | 실제 보여야 하는 데이터 | 절대로 위장하지 않을 것 |
|---|---|---|---|
| 84 무료 보관함 | EMPTY / SYNTHETIC_LIST | 명시적으로 저장한 안정된 Video/Channel ID, 고객 작성 메모/폴더/저장시각 | 북마크만으로 분석 스냅샷·원문이 영구 보관된다는 표현 |
| 85 유료 비교 | SELECTION / UNCOMPARABLE | 동일 관측 기간/대상 집합/분모/모델 버전·비교 가능성 | 댓글 차이를 인과·인기 증가나 임의 0%로 표현 |
| 86 유료 추적 | SETUP / EMPTY_HISTORY | 고객이 선택한 대상·관측 기준과 실제 확보된 상태만 | Job 실행/알림 예약/전송 성공의 가짜 표시 |
| 87 이용권 | FREE_GATE / PAID_SCOPE | 무료 북마크와 구독 비교/추적/보고의 권장 기능 분리 | 정해지지 않은 가격·조회 한도, 자동 청구, 역할 승격 |

- 각 페이지 **Light 2 + Dark 2 = 4개 화면**, 합계 **16개**.
- 신규 고객 UX에서 저장·비교·추적의 **실제 데이터 API/백엔드가 없음**을 명확히 고지. 실제 YouTube API 댓글·감성 결과를 생성하지 않음.
- 상태 변경용 Figma Prototype은 **실제 저장/결제 버튼이 아니라 QA용 시나리오 스위치**이며, 합성 Fixture 상태라고 표시.
- 기존 분석 공통 계약 [Analysis v1 후보](../../../shared/contracts/analysis-v1/README.md)와, 최근 병합된 [Admin v1 후보](../../../shared/contracts/admin-v1/README.md)는 각각 범위가 다름. 고객 SavedTarget/Compare/Monitor/Entitlement 영속 API는 이 개편으로 새로 생성되지 않았다.

### 3.1 추가 개편: 98 Channel / No Data 최신 3탭 시나리오 (2026-10-22)

채널과 자료 없음에 사용되던 과거 **4탭(요약/주요 주제/기간 흐름/근거)** 상세 UI는 현재 영상의 **3탭(요약·주제·추이) + 맥락형 분석 기준**과 달랐다. 구형을 덮어쓰지 않고 기존 브라우저·YouTube 레이어를 편집 가능한 상태로 복제한 뒤 과거 패널을 제거하고 **의미 토큰으로 연결된 새 패널을 재작성**했다. 복제된 Chrome 배경은 시연용이며 **Panel·Hover 자체는 허위 통계가 없는 데이터 상태**를 표시한다.

| 역할 | 신규 Hover 진입 | 최신 요약·주제·추이 | 분석 기준 및 뒤로가기 |
|---|---|---|---|
| **채널 Dark** | [98-25](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1608-2) | [98-19](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1606-2) → [98-20](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1606-263) → [98-21](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1606-524) | [98-22 근거](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1606-785) · BACK |
| **자료 없음 Light** | [98-26](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1608-224) | [98-23](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1606-1046) → [98-27](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1621-2) → [98-28](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1621-214) | [98-24 근거](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1606-1307) · BACK |

- **목적:** 채널은 선정 영상과 관측 기간/분모가 확인되기 전까지 채널 전체 여론·감성 비율을 표시하지 않음. 자료 없음은 `NO_DATA` / `COMMENTS_DISABLED` / `POLICY_BLOCKED`를 구분하며 미확보를 수치 0으로 둔갑시키지 않음.
- **현재 98 목차:** Channel·No Data 링크 [IA Review Index](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1582-255)를 새 Hover Flow에 연결. 과거 98-04/05/07/08의 노드 ID 및 기존 클릭 흐름은 보존.
- **Figma 구조 QA:** 신규 10화면(상세 패널 8·Hover 2), 텍스트 **154/154** 스타일, 단색 채우기·선 **284/284** 의미 변수, **NODE 34/BACK 2, 내부 목적지 불량 0**, 가짜 감성 퍼센트 **0건**.
- **주의:** 화면 연결은 정적 Figma 데이터 검증. **Figma Present 실제 마우스/키보드/BACK, 설치된 Chrome 확장의 Side Panel, 실제 YouTube/서버 연동 시험은 모두 NOT_RUN**. 전체 Chrome 복제 배경에 대한 토큰 정합성이나 WCAG 전체 준수는 이 검증의 범위 밖이다.

## 4. Figma 구조·탐색 검증

| 확인 | 결과 | 한계 |
|---|---:|---|
| 80~100 실제 페이지 | **19/19 기대 목록 일치** | 88/89 의도적 결번 |
| 새 고객 UX 화면 | **16/16** | 화면은 디자인·합성 Fixture, FE 앱 아님 |
| 84~87 텍스트 스타일 | **480/480 바인딩** | 실제 글꼴 크기·가독성 사용자 시험 아님 |
| 84~87 단색 Fill·Stroke | **816/816 의미 변수 바인딩**, raw 0 | 전체 WCAG 대비 검사가 아님 |
| 84~87 QA 상태 전환 | **16/16 NODE 유효** | 실제 Present 클릭은 NOT_RUN |
| 84~87 Light/Dark Prototype 시작점 | **8개, 페이지마다 2개** | 사용성 시험은 NOT_RUN |
| 새 Figma 검토 링크 | **80개**, 서로 다른 대상 50개 | **80개 URL 목적지 존재**, 브라우저 실제 클릭 NOT_RUN |
| 원본 보존 ID | **42/42 존재** | Node ID 보존, 프레임 내용 승인·제품 코드 구현 검증과 구분 |
| 98 원본 18개 프레임 | **18/18 유지** | 채널·자료 없음 신규 후보는 원본을 변경하지 않은 별도 시안 |
| 98 기존 NODE/BACK | **NODE 29 / BACK 1**, 내부 불량 0 | 원래 영상 3탭 유지, Dark 4개는 정적 시각 검수 화면 |
| **98 신규 채널·자료 없음 3탭** | **10개 화면 · NODE 34 / BACK 2**, 불량 0 | 채널 Dark 4개 패널+Hover, 자료 없음 Light 4개 패널+Hover. 원본 별도 보관 |
| 98 신규 편집 가능 패널/카드 | **텍스트 스타일 154/154, 의미 색상 284/284** | 감성 비율·확인하지 않은 댓글 수의 허위 표시 0; 복제한 YouTube 배경은 시연용 |
| 92 구형 교차 페이지 NODE | **11/11 대상 존재** | 과거 Pilot/02·03 페이지 참조 보존, 현재 구현 정본 아님 |
| 시각 검수 | Registry·Auth·Chrome IA, 무료·비교 Light/Dark, 관리자 화면 등 실제 Figma 렌더 육안 확인 | 확대·스크린리더·키보드 실제 테스트 아님 |

**변경 화면 내부 구조:** 82 최신 운영 시안 4개는 y=0/1120, 이전 원본은 y=3390 이하. 83 현재 도구 결정은 y=0, 과거 QA 화면은 y=1130 이하. 98 최신 Home→Hover→Summary/Topics/Trends/Evidence는 y=0~1040, Dark·구형 시나리오는 y=2080~3120, 구형 참조는 y=4420~5460. **신규 채널 Dark/자료 없음 Light 3탭·Hover는 y=6800~9925의 별도 리베이스 존**에 추가.

**검토 허브:** 80 고객 · 81 조직 · 82 플랫폼 · 83 QA · 98 Chrome · 99 Archive · 100 Auth 및 새 00 Registry. 이들은 **Figma Review Index**이며 사용자 제품 UI의 메뉴·인가 기능을 제공하지 않는다.

## 5. 아직 실제로 검증·구현해야 하는 것

| Test ID | 단계 | PASS로 승격할 조건 | 현재 |
|---|---|---|---|
| IA-01 | 00 Registry 이동 | 브라우저에서 80개 검토 링크가 실제 목적지를 올바르게 열어줌 | **STATIC URL ONLY / NOT_RUN** |
| IA-02 | 84 보관함 | 실제 고객 로그인 후 지정 영상/채널 ID와 메모만 저장, 취소/계정 전환·삭제 일관성 | **NOT_IMPLEMENTED** |
| IA-03 | 85 비교 | 구독·데이터 권리/기간/분모/버전이 맞지 않으면 비교 차이를 출력하지 않음 | **NOT_IMPLEMENTED** |
| IA-04 | 86 추적 | 허용된 데이터만 관측·갱신, Job/알림 중복·삭제·보존/비용 검증 | **NOT_IMPLEMENTED** |
| IA-05 | 87 업셀 | 필요한 기능에서만 안내, 가격/한도 미정 시 결제 실행 없음, 역할은 독립 | **NOT_IMPLEMENTED** |
| IA-06 | 82 관리자 | Light/Dark 각 운영↔정책 2뷰 실제 Present 클릭, 서버 역할/감사 E2E | **PRESENT_NOT_RUN / BE_NOT_IMPLEMENTED** |
| IA-07 | 83 QA | 테스트 실행 SHA/환경·로그·Trace 원본이 증거이고 합성 권한이 운영에 노출되지 않음 | **NOT_RUN** |
| IA-08 | 98 Chrome | 영상/채널/자료 없음 각각 Hover→3탭→분석 근거 BACK, 닫기·대상 고정 확인 | **VIDEO STATIC / CHANNEL_NODATA_REBASE_STATIC_PASS / PRESENT_NOT_RUN** |
| IA-09 | 100 Auth | Guest→고객 로그인→같은 Video A 고정 복귀·저장 확인 / F07·F08 경계 | **NOT_RUN / AUTH_BE_NOT_IMPLEMENTED** |
| IA-10 | 접근성/성능 | 100/125/150% Zoom, Tab/Escape, 한국어/영어/태국어 긴 명칭, 스크린리더, Chrome native UI 충돌 | **NOT_RUN** |
| IA-11 | 구형 참조 정리 | 90~92·93·95~97·옛 98의 실제 사용 참조가 0이고 새로운 경로 회귀 PASS | **DELETION_BLOCKED / HISTORICAL RETAINED** |

### 우선순위 후속 개선

1. **98 구독 안내·업셀의 구형 경로를 최신 87 이용권 UX와 정합.** 채널/No Data는 신규 3탭 시안이 작성됐으므로 실제 Present·Chrome 적용을 검증하고, 기존 old frame은 삭제하지 않음.
2. **84~87 제품 상태에서 실제 고객 행동(저장/비교/관측 범위/구독 안내)이 일어나는 흐름**을 서버 계약/권한 정의 후 UX 검증. 이번에는 상태만 보여주는 Figma 검토 화면.
3. **100 Auth의 8개 후보와 Chrome↔고객 웹 왕복의 실제 동작 검증**. 기존 후보의 수치는 합성 시안이며 실제 서비스 로그인과 다름.
4. **93 React YU-01~12 데모와 최신 신규 고객 UI간 Gap 추적**, 기존 프론트엔드 DEMO와 미구현 FE/BE를 혼동하지 않음.
5. 기존 아카이브를 삭제하려면 **참조 수 0 / 승인된 신규 정본 / Visual·Prototype·데이터 회귀 PASS / 사용자 승인** Gate 선행.

## 6. 변경과 출처

- 실제 사용한 원본: YOUTOPIA Figma 파일의 내부 YUTOPIA 의미 색상 토큰, 기존 Inter 텍스트 스타일, 기존 Figma 화면 80/81/82/83/90~100, GitHub의 Guest-first/구독/Chrome/Admin 승인 문서.
- 외부 제품 UI/이미지·소스코드를 이번 작업에 복사·설치하지 않음.
- **Figma 페이지명/화면 위치/신규 편집 가능 프레임/검토 연결만 실제 수정**. GitHub FE·BE·extension/manifest·shared 실행 코드는 변경하지 않음.
- 페이지 00의 구형 Registry는 역사적 기준선으로 이름만 변경, 원본 내용과 기존 00 Dark/Light 첫 화면 존치.
- 신규 Figma 화면은 모두 디자인 검토 후보이며 **제품 출시·실제 저장/결제/수집·프리미엄 이용권이 구현된 증거가 아님**.

**최종 상태:** FIGMA_80_100_REORG_STATIC_PASS / USER_FINAL_VISUAL_APPROVAL_PENDING / FIGMA_PRESENT_NOT_RUN / BACKEND_STORAGE_AUTH_POLICY_PENDING.
