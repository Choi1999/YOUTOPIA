# YUTOPIA — Figma 역할별 UI 승인·구현 인계 v0.1

> **FIGMA_VISUAL_APPROVED / COMPONENT_LINKED / IMPLEMENTATION_NOT_VERIFIED**
>
> **승인:** 2026-10-16, 사용자 대화의 “승인”. 승인 대상은 역할별 Figma 정적 시각 디자인과 후속 설계 연계 작업이다. 실제 브라우저 동작, 서버 인증·인가, 구독 가격·결제, YouTube API/파생 지표 사용권, 배포·병합 승인은 포함하지 않는다.
>
> **정본:** Figma https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/ / GitHub frontend 브랜치 기준 시작 SHA 0a255f224e4213c577651fcc34b2b68c6532a069.

## 1. 제품·화면 정렬

YUTOPIA는 **범용 YouTube 영상·채널 댓글 반응 관측 서비스**다. 게임은 고객 활용 분야의 하나일 뿐이다.

1. 데스크톱 Chrome에서 YouTube 홈의 영상 또는 채널을 탐색한다.
2. YUTOPIA 확장이 정확한 대상의 Hover 요약 카드(차트·쟁점·짧은 브리핑·분석 범위·시각·더보기)를 보여준다.
3. 사용자가 **더보기**를 클릭하면 Chrome Side Panel에서 상세 분석을 확인한다.
4. 한 영상의 상세 패널은 다른 영상을 단순 Hover했다고 변경되지 않는다. 다른 대상의 **더보기**를 명시적으로 클릭할 때만 대상이 변경된다.
5. 구독은 비교·기간·대상 수 등 **분석 범위**만 확장하며 운영·조직 관리 권한 또는 YouTube 데이터 사용권을 부여하지 않는다.

Chrome 핵심 화면은 [98번 페이지](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-2)의 10개 프레임이다. 주요 개선 초안: [98-09 Hover](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-2), [98-10 Side Panel](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217). 98번을 다시 생성하거나 기존 React 12화면을 삭제하지 않는다.

## 2. 역할별 Figma 화면 인덱스(기존 9개)

| 화면 | 역할·목적 | Figma |
|---|---|---|
| 80-01 | Guest · 비로그인 접근 범위는 미결정 | [1285:2](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1285-2) |
| 80-02 | 개인 기본 이용자 · 단일 영상 요약 | [1285:72](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1285-72) |
| 80-03 | 개인 구독 이용자 · 다중 영상/채널 비교 후보 | [1285:145](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1285-145) |
| 81-01 | 조직 구성원 · 배정된 업무·허용된 자료·공유 보고서 | [1286:2](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-2) |
| 81-02 | 조직 관리자 · 자기 조직의 초대·권한·보고서·구독 설정 후보 | [1286:72](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-72) |
| 82-01 | 플랫폼 관리자 · 수집/장애/데이터 품질/지원·감사 | [1286:144](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-144) |
| 82-02 | 정책·감사 관리자 · 데이터 권리·삭제·보관·정책 Gate | [1286:218](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-218) |
| 83-01 | DEV/QA · 합성 데이터 상태·오류·권한 시뮬레이터 | [1286:290](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-290) |
| 83-02 | DEV/QA · 실행하지 않은 검증은 NOT RUN으로 기록 | [1286:362](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-362) |

**화면 지위:** 1600×900 편집 가능한 디자인이며 실제 작동하는 운영 화면이 아니다. UI 내 계정·댓글·수치·작업 상태·조직은 합성 예시다.

## 3. 공통 컴포넌트 연결(실제 Figma 반영)

- **정본 컴포넌트:** [YUTOPIA / Access Boundary Notice](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1303-604) (13번 공통 컴포넌트 페이지).
- **변형 3개:** Surface=Light(고객 개인·조직), Surface=Platform(플랫폼 운영), Surface=QA(개발·검증 강조 색상).
- **텍스트 속성:** Title, Body를 각 화면의 고유 안내 문구로 오버라이드한다.
- **연결된 인스턴스 9개:** 80-01=1304:2, 80-02=1304:5, 80-03=1304:8, 81-01=1304:11, 81-02=1304:14, 82-01=1304:17, 82-02=1304:20, 83-01=1304:23, 83-02=1304:26.
- **보존:** 교체 전 원본 고지 레이어를 삭제하지 않고 숨김 처리했다. 각 인스턴스는 원본 위치와 동일한 1309×81 크기다.
- **시각 확인:** 생성한 컴포넌트 3개 변형과 연결 후 80-02·82-02·83-02 캡처에서 위치·색상·문구를 확인했다. 실제 Chrome 화면 접근성이나 모든 브레이크포인트 테스트 완료를 의미하지 않는다.
- **후속:** 나머지 9개 화면의 탐색·KPI·콘텐츠 영역은 13번의 기존 게임 전용 컴포넌트와 무조건 치환하지 않는다. 신규 역할별 디자인에 맞는 호환성 비교 후 점진적으로 공통화한다.

## 4. 정보구조 및 사용자 여정

**고객 공통**
- Chrome YouTube 홈/영상 또는 채널 Hover → 요약 카드 → 더보기 → 대상 고정 Side Panel.
- 개인 기본 이용 → 단건 요약·채널 범위·내 계정. 비교/장기 분석을 선택했을 때에만 구독 안내.
- 개인 구독 이용 → 심층 분석·복수 영상/채널 비교 → 저장·보고서 후보의 고객 웹 워크스페이스.
- 비로그인 Hover 제공 여부는 ENT-01 결정 전 **미확정**. 화면상의 Guest 시안은 제공 약속이 아니다.

**고객 조직**
- 팀 구성원 → 내 작업 → 본인에게 허가된 분석·이슈 → 허가된 공유 보고서.
- 팀 관리자 → 자기 조직 설정 → 구성원 초대/역할/자료 접근 → 조직 보고서 검토·구독 설정 후보.
- 동일 고객 조직의 여러 구성원도 개별 자원 권한을 확인하며, 조직 A와 B 사이의 교차 열람은 금지한다.

**별도 내부 화면**
- 플랫폼 관리자 → 독립 내부 인증 → 운영·수집·데이터 품질 → 정책·감사/지원. 고객 브라우저 확장에 내부 조작 UI를 노출하지 않는다.
- 개발·QA → 격리된 비운영 환경 → MOCK 실패·권한·대상 고정 재현 → 실제 실행 증거가 있는 테스트만 PASS.

**라우트 정보구조 제안(코드에 아직 없음)**

| 경계 | 경로·화면 후보 | 서버 통제 원칙 |
|---|---|---|
| Chrome 고객 확장 | YouTube content script + Side Panel | 정확한 target ID·요청 시퀀스·데이터/기능 이용권 |
| 고객 개인 | /app/analysis, /app/saved, /app/account | 본인 자료 + 구독 이용권 + 플랫폼 정책 |
| 고객 조직 | /org/workspace, /org/members, /org/reports | 인증된 organizationId·멤버십·자원별 역할 |
| 플랫폼 운영 | /internal/operations, /internal/policy | 별도 인증·운영 최소권한·감사 기록 |
| DEV/QA | /qa/simulator, /qa/regression | 운영 빌드 제외 + 합성 fixture만 사용 |

위 라우트는 **구현 계약 후보**이며 현재 저장소에 해당 경로가 실제 구현됐다는 뜻이 아니다.

## 5. 인가·데이터·구독 계약 경계

각 실제 API 요청의 서버측 검사: **인증 사용자 → 소유·조직 범위 → 역할 권한 → 구독 기능 이용권 → YouTube/원천 데이터 정책 → 데이터 가용성 → 감사**.

- 구독 여부, 클라이언트 메뉴 비활성화, UI의 역할 배지만으로 인가 처리하지 않는다.
- VIDEO는 확인된 videoId로, CHANNEL은 확인된 channelId로 식별한다. @handle을 임의로 channelId로 치환하지 않는다.
- Side Panel에서 영상 B를 고정한 뒤 영상 C를 Hover해도 B 유지; C의 더보기를 명시적으로 선택했을 때만 전환.
- 표본 수·분모·분류 완료 수·선정 영상군·관측 기간·갱신 시각과 미수집/삭제/접근 거부를 구분한다.
- 댓글 참여자의 반응은 전체 시청자·사회 전체 여론이 아니며, 관측된 불만은 사실 확정이 아니다.
- 데이터 권리·감성 파생 지표 사용, 실제 결제·환불·Chrome Web Store 공개는 별도 외부 Gate가 필요하다.

## 6. 현재 검증 상태와 다음 실행 순서

| 항목 | 현재 보고 가능 상태 |
|---|---|
| 80~83 UI 화면 9개 | Figma 화면 존재, 사용자 정적 디자인 승인 |
| 13 공통 권한 안내 컴포넌트 | 3개 변형 제작, 9개 화면 인스턴스 연결, 주요 화면 캡처 확인 |
| 98 고객 Chrome UX 화면 10개 | Figma 시안 존재, 시각 및 브라우저 동작은 구분 |
| Chrome MV3 extension/ | PR #6에서 frontend 브랜치로 초기 코드 병합; 실제 Chrome E2E는 미검증 |
| React 12화면 데모 | 이전 로컬 실험 자산으로 보존 |
| 실제 로그인·조직·구독 서버 | 미구현/미검증 |
| YouTube API·실제 댓글 분석 | 미연결, 정책 검토 필요 |
| 실제 결제·운영 배포·출시 | 미승인·미실행 |

**이어갈 개발 순서**
1. 00~19 설계/접근성/상태별 UX 인수 항목을 문서·Figma로 추적한다. 현재 디자인 승인과 실제 브라우저 검증을 혼동하지 않는다.
2. 단계 20 확장 skeleton은 코드 존재를 대장에 반영하되 VERIFIED로 표시하지 않는다.
3. 21~29는 순서대로 콘텐츠 스크립트/SPA/영상·채널 ID/연속 Hover/요약 카드/메시지·캐시/Side Panel/Chrome smoke를 독립 브랜치·PR로 개발한다.
4. 30~59의 백엔드/데이터/구독 계약은 정책·요금·인가 결정을 기다리는 변경만 차단한다.
5. 60~79의 고객/조직/플랫폼/QA 코드 분리는 정적 디자인을 참고하며 반드시 서버 인가 테스트를 동반한다.
6. 80~99 통합·배포·출시의 PASS는 실제 실행 증거가 확보되기 전에는 표시하지 않는다.

관련 문서: [00~99 실행대장](./04_EXECUTION_00_99.md), [역할·구독](./02_ROLES_AND_SUBSCRIPTION.md), [표면 권한표](./07_SURFACE_ACCESS_MATRIX.md), [제품 게이트](./09_PRODUCT_GATE_CHECKLIST.md).

**문서 작성은 실제 소스/브라우저 테스트를 대체하지 않는다. 본 인계 PR에는 Chrome 확장 동작 코드 변경이 없다.**
