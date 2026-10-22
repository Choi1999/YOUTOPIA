# YOUTOPIA — Guest-first 로그인 UX 신규 Figma 후보 8화면 제작·검증 인계

> 2026-10-21 KST · **FIGMA_EDITABLE_CANDIDATES_CREATED / SURFACE_RESPONSIBILITY_RECLASSIFIED / USER_VISUAL_APPROVAL_PENDING / PRODUCTION_AUTH_NOT_IMPLEMENTED**
>
> 기반: [병합된 PR #20](https://github.com/Choi1999/YOUTOPIA/pull/20)과 [로그인 UX 정본](./GUEST_AUTH_CONTEXT_RESTORE_UX_20261021.md), [인증 UX·보안 테스트 36건](./GUEST_AUTH_ACCEPTANCE_20261021.md), [기존 Figma 승인 인계](./FIGMA_ROLE_UI_APPROVED_HANDOFF_20261016.md).
>
> 목표: 기본 Hover·Side Panel의 로그인 비강제, 저장 등 명시적 사용자 행동에서의 로그인, 성공/취소 후 선택 영상 복귀, 관리자와 DEV/QA 격리를 시각적으로 검토할 수 있는 **편집 가능한 Figma 신규 후보**를 남긴다.

## 1. 실제 Figma 제작 결과

- 기존 파일 유지: `00Q6HNjuv02u7Ex4yUzZer`
- 신규 페이지: [100 YUTOPIA · Guest 인증 동선 · 후보 v0.1](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1320-2)
- 8개 시안 전체 검토 보드: [1320:3](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1320-3)
- 별도 새 페이지 생성만 수행. 기존 [98-09 Hover](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-2), [98-10 Side Panel](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1276-217), [80-01 Guest](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1285-2), [82-01 플랫폼 Admin](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-144), [83-01 DEV/QA](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-290) 노드가 존재함을 이후 readback에서 재확인.
- 페이지는 YUTOPIA의 기존 Inter 글꼴, `YUTOPIA/의미 토큰`의 **라이트 모드(1157:0)**, 배경·표면·텍스트·경계·강조 의미 토큰을 사용.
- 공통 컴포넌트: `AUTH candidate / Primary Action` ([1320:7](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1320-7)), `AUTH candidate / Side Panel Header` ([1320:9](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1320-9))를 별도로 제작하고 시안에서 인스턴스로 재사용.
- 이 화면들은 **정적 UI 후보**다. 클릭·로그인·저장·세션·OAuth·Chrome Side Panel 실제 동작을 구현한 것은 아니다.

## 2. 각 시안의 ID · 사용 목적 · 검토 기준

| 시안 | Figma 검토 링크 | 주요 시각 내용 | 다음 검토 |
|---|---|---|---|
| AUTH-F01 Guest 기본 Hover | [1321:3](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1321-3) | YouTube 썸네일 맥락, Compact 요약 카드(356px), 감성 미니바·논점 2개·단일 더보기. 로그인 요구 없음 | 새 Compact 카드의 높이·사용성, 기존 YU-26 포인터 안정성 |
| AUTH-F02 Guest 기본 Side Panel | [1321:21](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1321-21) | 탭 요약/주제/추이, 우측 작은 로그인, 영상 A 제목 고정, 저장 진입점 | 435px 폭·탭별 정보 배분·읽기 효율 |
| AUTH-F03 저장 시 로그인 | [1321:44](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1321-44) | ‘이 영상 저장하려면 로그인’ 안내, 로그인·취소 선택, 뒤에 있는 분석 맥락 유지 | 1회 맥락형 안내와 취소·포커스 |
| AUTH-F04 고객 공통 로그인 | [1322:8](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1322-8) | 고객 인증용 페이지 시안, 선택 A/저장 의도 안내, 이메일·비밀번호 폼 | 기존 YU-01 DEMO 로그인과 범용 제품 브랜딩 재배치 |
| AUTH-F05 로그인 성공 후 복귀 | [1322:33](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1322-33) | 로그인 완료 후 동일 A 대상 유지, ‘계속 저장하기’ 명시적 버튼 | A→B 선택 경합/자동 저장 금지 |
| AUTH-F06 인증 취소·안전 복귀 | [1322:49](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1322-49) | 저장 취소 안내·기존 Guest 분석 유지·재로그인 동선 | 로그인 실패·취소·만료 |
| AUTH-F07 플랫폼 Admin 로그인 | [1323:14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1323-14) | 독립 관리자 로그인, 서버 역할·감사/추가 인증 정책 안내 | Customer 로그인에서 운영 권한 도달 차단 |
| AUTH-F08 DEV/QA 격리 로그인 | [1323:37](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1323-37) | 내부 시뮬레이션 전용 환경, 합성 Fixture/시험 계정 경계 | 고객 빌드로 QA·합성 결과 유출 금지 |

AUTH-F01~F03는 첫 번째 가로 행, AUTH-F04~F06 두 번째, AUTH-F07~F08 세 번째 행에 배치했다. F01 카드 안의 감성 퍼센트·댓글 수는 **디자인 설명용 합성 숫자**이며 실제 YouTube 데이터가 아니다.

## 2.1. 2026-10-21 추가 승인: 확장은 고객 로그인만, 관리·QA 로그인은 웹 전용

**사용자가 승인한 분리 결정:** Chrome 확장은 고객 경험 전용이다. 운영자·정책 관리자·DEV/QA의 로그인 버튼, 별도 로그인 양식, 권한 제어 및 개발 시뮬레이션 화면은 확장에 포함하지 않는다. 고객 로그인도 확장 내부에 독립 이메일/비밀번호 폼을 만들 필요 없이, 확장의 작은 진입점 또는 저장 등 계정 필요 행동에서 **고객 공통 웹 인증으로 연결**한다. 인증 완료 후 Side Panel은 이전의 고정 영상/행동으로 안전하게 복귀한다. 개인 고객·조직 구성원·조직 관리자는 공통 고객 인증으로 들어가되, 조직 관리자용 웹 기능은 서버에서 역할을 다시 검증한다.

| 구분 | 화면 ID | 실제 제품 소속 | 상태 |
|---|---|---|---|
| Chrome 확장 | AUTH-F01, F02, F03, F05, F06 | Guest Hover·기본 Panel·로그인 진입·로그인 후 복귀/취소 | **소속 결정 승인**, 시각 후보 |
| 고객 인증 웹 | AUTH-F04 | 개인·조직 고객 공통 로그인 페이지 | **소속 결정 승인**, 시각 후보 |
| 관리자 웹 | AUTH-F07 | YOUTOPIA 플랫폼 운영·정책 Admin 전용 웹 진입 | **확장에서 완전 제외**, 시각 후보 |
| 내부 웹 | AUTH-F08 | DEV/QA 격리 시험 환경 전용 진입 | **확장에서 완전 제외**, 시각 후보 |

- **Figma 실제 변경:** 기존 [100번 후보 보드](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1320-3)에 [AUTH SURFACE RESPONSIBILITY MAP](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1334-15) 추가. 세 영역 **CHROME EXTENSION / CUSTOMER WEB / INTERNAL WEB**으로 제품 책임을 시각적으로 제시.
- 8개 시안 프레임의 기존 **노드 ID 유지**. 각 프레임 이름·제목·설명에 CHROME EXTENSION / CUSTOMER WEB / ADMIN WEB ONLY / INTERNAL WEB ONLY를 표시. F04와 F05·F06이 한 줄에 있는 보드 레이아웃은 화면 연결 흐름을 표현하는 것으로, **F04가 확장 안에 있다는 뜻은 아니다**.
- **변경 후 이미지 검수:** 전체 Figma 후보 보드 스크린샷을 새로 확인. 상단 표면 분리, 8개 시안 헤더와 긴 설명의 줄바꿈 및 겹침 없음(보드 축소 렌더링 기준). 실제 Chrome 인터랙션·접근성·테마별 검증은 수행하지 않음.
- **정본 영향:** 98번 Chrome UX 및 80~83 역할별 기존 승인 페이지를 수정하지 않음. 편집 가능한 후보 page 100에만 변경 반영.
- **마일스톤:** M2에서 확장 고객 로그인 진입/복귀의 MOCK UX를 검증. M6에서 서버의 고객 로그인·조직 RBAC·플랫폼 운영/QA 웹 인증 경계 구현. M9에서 FE/BE 공통 인증·권한·선택 대상 복귀 통합 인수.

## 3. 수행된 실제 검수 증거와 제한

- Figma 디자인 페이지 `1320:2`에 대해 읽기 전용 구조 검증 수행.
- **AUTH-F01~F08 각 1개, 총 8/8 후보 프레임 확인**.
- 검토 보드 내부: **TEXT 108개, FRAME 47개, INSTANCE 9개**. 이미지 `IMAGE` Fill **0개**; 완성 화면을 이미지로 평면화하지 않고 텍스트·레이아웃·컴포넌트 인스턴스로 구성.
- 모든 텍스트는 기존 제품의 **Inter** 글꼴이며 혼합·잘못된 글꼴 0개.
- 두 줄이 필요한 시안의 텍스트 높이 고정으로 겹치는 현상을 **실제 시각 검토에서 발견해 수정**, 수정 후 보드 전체 스크린샷 재확인.
- 기존 원본 노드 5개(`1276:2`, `1276:217`, `1285:2`, `1286:144`, `1286:290`) 모두 존재함을 재확인.
- **검증되지 않은 부분:** 사용자 시각 승인, 다크 모드 후보, 100/125/150% 줌, 키보드/스크린리더, 실제 Chrome/React/서버 로그인, 다중 탭 AuthReturnIntent E2E. 디자인 screenshot은 실제 브라우저 동작을 검증한 증거가 아니다.

## 4. FE·BE 구현 단계와 연결

| 단계 | 해야 할 일 | 아직 진행되지 않은 증거 |
|---|---|---|
| M2 / FE | 후보 8화면 고객 시각 검수 후, 승인안만 기존 Figma 기준으로 Side Panel·고객 React 로그인 화면에 반영 | 실제 Figma 디자인 사용자 승인 및 FE PR |
| M2 / INT | AUTH-UX-01~20의 MOCK 입력/출력·타깃 고정 시뮬레이션 | 설치형 Chrome UI QA, YU-27/28 기능 Gate |
| M1·M6 / BE | AuthReturnIntent, Session, Entitlement, Error 계약 검토·Auth Provider 결정 | BE/FE Contract·OAuth/CSRF/PKCE 보안 테스트 |
| M7 / INT | Guest 영상 A → 로그인 → 동일 대상 A에서 저장 작업 지속 | 실제 FE↔BE 세션/DB 및 대상 경합 E2E |
| M9 / INT | 고객/운영/QA 로그인·권한 격리를 제품 전체 통합 계약으로 검증 | 동일 FE·BE·shared SHA의 통합 인수 기록 |

**변경 금지:** 새 디자인이 사용자에게 시각 승인되기 전 기존 `extension/hover-controller.js`, `hover-card.js`, `LoginPage.tsx`, `sidepanel.js`를 자동 변경하지 않음. YU-27 PR #15, 기존 시각 개선 PR #17 등은 독립적으로 검수. 실제 인증/결제/데이터 수집·배포는 별도 Gate.

## 5. 추적할 외부·내부 근거

- [EX-013](../research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md): Chrome Identity API, OWASP OAuth2 설계 근거. 이 단계에서 외부 인증 라이브러리 설치·코드 복제는 없음.
- [기존 YUTOPIA Figma 승인 핸드오프](./FIGMA_ROLE_UI_APPROVED_HANDOFF_20261016.md): 기존 화면과 역할별 9개 정적 기준선.
- [PR #20 Guest Auth UX 병합 증거](https://github.com/Choi1999/YOUTOPIA/pull/20): 사용자 승인 방향을 `frontend`에 문서 반영, merge SHA `14407fbc6a94b2c1b7500781752e8e59b8cdb8c4`.
- 실제 사용자 인터랙션/시스템 구현 증거는 후속 해당 기능 PR에서 `FIGMA_NODE → UI_SOURCE_FILE → GIT_COMMIT → TEST_LOG → APPROVAL`로 연결한다.

**현 단계 최종 판정:** `FIGMA_CANDIDATE_8_8_CREATED`, `SURFACE_RESPONSIBILITY_APPROVED`, `RECLASSIFIED_IN_FIGMA`, `EDITABLE_LAYER_STRUCTURE_CHECKED`, `LIGHT_PREVIEW_VISUALLY_REVIEWED`, `USER_VISUAL_APPROVAL_PENDING`, `RUNTIME_NOT_IMPLEMENTED`. 이 문서 자체는 Figma·GitHub 제품 코드 변경이 아니다.
