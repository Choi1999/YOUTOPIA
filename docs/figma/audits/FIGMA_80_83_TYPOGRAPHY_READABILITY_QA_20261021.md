# YOUTOPIA Figma 80~83 — 텍스트 스타일 및 선택 상태 대비 후속 QA

> 2026-10-21 KST · Figma 수정 및 정적 검사 완료 · Present 미실행 · 실행 코드 변경 없음

사용자 승인에 따라 [PR #26](https://github.com/Choi1999/YOUTOPIA/pull/26)이 frontend에 병합된 뒤, Figma 80~83번의 **기존 화면 9개를 보존**하면서 18개 Light/Dark QA 후보에서 공통 텍스트 스타일과 선택 항목 대비를 교정했습니다.

[기계판독 증거 JSON](./FIGMA_80_83_TYPOGRAPHY_READABILITY_EVIDENCE_20261021.json) · [선행 테마 QA](./FIGMA_80_83_ROLE_THEME_REMEDIATION_20261021.md)

## 1. 문제와 실제 조치

**텍스트 스타일:** 후보 18개 화면의 텍스트 786개 중 기존 공통 스타일과 연결된 436개를 제외한 350개는 미연결 상태였습니다. Figma Plugin API로 글꼴·weight·fontSize·lineHeight를 비교한 결과, 나머지 350개는 Inter 기반 **정확히 9개의 서식 조합**으로 정리됐습니다.

기존 공통 스타일을 임의 변경하지 않고 YUTOPIA/역할 UI v0.3 범주에 9개 스타일을 추가했습니다. 첫 번째 샘플과 나머지 349개에 스타일을 적용하면서 **문구·폰트·크기·픽셀 줄높이·자간·너비·높이를 변경 전후로 비교**했고 불일치는 **0건**이었습니다. 후속 전체 재조회에서는 **786/786 텍스트가 공통 스타일에 연결**됐습니다.

**대비 결함:** 선택 메뉴와 주요 CTA에서 강조색 배경과 텍스트가 동일해 글자가 보이지 않는 결함을 발견했습니다. 완전 불투명 배경 34건의 대비는 사실상 1:1이었고 Guest Dark 파일럿 2건의 반투명 강조 배경은 **4.25:1**이었습니다. 후보 프레임의 배경을 공통 **bg/subtle** 색상 변수로 교정하되, 텍스트의 **accent/primary / QA status/warning** 역할색은 유지했습니다.

Figma의 실제 선택 메뉴·CTA 배경/텍스트 RGB 값을 다시 읽어 WCAG 대비 공식을 적용한 결과 **36/36 항목 4.5:1 이상**, 최소 **4.57:1**이었습니다. 전체 화면·접근성 규격의 합격 선언은 아닙니다.

## 2. 신규 스타일 정의

| 공통 스타일 구분 | Inter 폰트 및 크기 | 줄높이 | 적용 개수 |
|---|---|---:|---:|
| 강조 라벨 | Semi Bold 12px | 17px | 96 |
| 보조 라벨 | Medium 12px | 17px | 74 |
| 데이터 핵심값 | Bold 23px | 33px | 54 |
| 카드 제목 | Semi Bold 18px | 26px | 36 |
| 역할 로고 | Bold 21px | 30px | 18 |
| 영역 설명 | Medium 11px | 16px | 18 |
| 내비게이션 경로 | Medium 14px | 20px | 18 |
| 히어로 제목 | Bold 25px | 36px | 18 |
| 고지 본문 | Regular 13px | 18px | 18 |
| **합계** | **9종** | | **350** |

원본 9개 화면 및 Figma의 공통 Master 컴포넌트에는 새 스타일을 적용하지 않았습니다. 실제 신규 Style ID 9개는 [증거 JSON](./FIGMA_80_83_TYPOGRAPHY_READABILITY_EVIDENCE_20261021.json)에 보존했습니다.

## 3. 페이지별 검증 결과

| Figma 페이지 | Light/Dark 후보 | 스타일 연결 | 선택 메뉴·CTA 대비 | Figma 참조 |
|---|---:|---:|---:|---|
| 80 고객 웹 | 6 | **258/258** | 12/12 | [Theme QA 80](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-20) |
| 81 고객 조직 웹 | 4 | **174/174** | 8/8 | [Theme QA 81](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-73) |
| 82 운영 관리자 웹 | 4 | **178/178** | 8/8 | [Theme QA 82](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-114) |
| 83 DEV/QA 내부 웹 | 4 | **176/176** | 8/8 | [Theme QA 83](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1408-155) |
| **전체** | **18** | **786/786** | **36/36** | |

변경 후 Figma 구조 재검증: 의미 토큰 연결 Solid Fill/Stroke **1,442/1,442**, 후보에 복제된 역할 전환 반응 **0건**, 테마 비교 링크 **18건의 목적지 모두 유효**, 원본 화면 **9개 보존**, 80~83 각 페이지 기존 역할 Flow + 신규 Theme QA Flow 유지.

페이지 00의 [Page Registry](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1367-2)에도 80~83 후보의 토큰/텍스트 스타일 정합성 상태를 반영했습니다.

## 4. 실제 스크린샷 확인

Figma에서 다시 렌더링하여 **Guest Light, Guest Dark, Organization Admin Dark, Platform Admin Light, QA Simulator Light**를 확인했습니다. 수정 전 보이지 않았던 선택 메뉴와 CTA의 문구가 모두 나타나는 것을 확인했습니다. 이 화면은 편집 가능한 TEXT/FRAME/컴포넌트 인스턴스이며, 정적 이미지로 덮어쓰지 않았습니다.

Figma의 스크린샷은 시각적 확인 자료이고 실제 Present 버튼을 누른 클릭·뒤로가기 테스트 또는 Chrome 실행 결과는 아닙니다. 영구 참조는 위 Figma Node ID로 남깁니다.

## 5. 남은 글자 크기·사용성 위험

후보 18개 화면의 폰트 크기 분포:

| 텍스트 크기 | 노드 수 |
|---|---:|
| 11px | 36 |
| 12px | 332 |
| 13px | 274 |
| 14px | 18 |
| 18px | 36 |
| 21px | 18 |
| 23px | 54 |
| 25px | 18 |

**11~12px 글자 368개(전체 786개 중 약 46.8%)**는 실제 화면에서 너무 작게 느껴질 수 있습니다. 실제 데스크톱 100/125/150% 줌, 키보드, 다국어 긴 텍스트, 포커스 이동, 읽기 편의성을 검토한 뒤에야 원본/후보의 폰트 확대 범위를 확정해야 합니다.

## 6. 완료/미완료의 분리

| 확인 항목 | 상태 |
|---|---|
| Figma 후보의 Inter 공통 텍스트 스타일 | **786/786 연결 PASS** |
| 새 스타일 연결에 따른 문구/레이아웃 변화 | **350/350 검사, 변형 0건** |
| 주요 선택 메뉴·CTA 텍스트 대비 | **36/36 정적 AA 비율 PASS** |
| 대표 시안 Figma 스크린샷 | **5화면 육안 검토** |
| 80~83 원본 화면과 기존 역할 프로토타입 보존 | **PASS** |
| 실제 Figma Present 모드 사용자 클릭·Hover·뒤로가기 | **NOT_RUN** |
| 실기기 확대·키보드·스크린리더·전체 WCAG | **NOT_RUN** |
| YU-27/28 Chrome 확장·BE 로그인/권한/제품 통합 | **NOT_RUN — 별도 개발 Gate** |

## 7. 적용 출처

이번 수정에서 실제 재사용한 것은 기존 [YUTOPIA 내부 Figma 디자인 시스템](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1177-10)의 Inter 글꼴, 의미 색상 토큰, 텍스트 스타일 규칙입니다. 이번에 정의한 9개 새 스타일의 실제 Figma Style ID 및 후보 Node ID는 위 JSON에 있습니다. 외부 서비스의 소스·이미지·학습 데이터 **복사/설치 0건**입니다.

**현재 판정:** TEXT_STYLE_786_OF_786, SELECTED_TEXT_CONTRAST_36_OF_36, ORIGINAL_9_PROTECTED, PRESENT_MODE_NOT_RUN, FONT_SIZE_UX_PENDING, USER_VISUAL_APPROVAL_PENDING.
