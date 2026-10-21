# YOUTOPIA — 플랫폼 관리자 최소 2뷰와 QA 도구 우선 Figma 인계

> 2026-10-21 KST · APPROVED_DIRECTION / FIGMA_CANDIDATE_CREATED / STATIC_QA_PASS / PRESENT_NOT_RUN / NO_RUNTIME_CODE_CHANGE
>
> 사용자 승인에 따라 [PR #28의 필요성 감사](https://github.com/Choi1999/YOUTOPIA/pull/28)와 [외부 기술 근거](../../research/ADMIN_QA_EXTERNAL_REFERENCE_ADOPTION_STUDY_20261021.md)를 적용했다.
> 기존 Figma 82/83의 원본·역할별 Prototype·Light/Dark QA 화면은 삭제하거나 덮어쓰지 않았다.
>
> 상세 기계 판독 증거: [ADMIN_MINIMAL_TWO_VIEWS_FIGMA_EVIDENCE_20261021.json](./ADMIN_MINIMAL_TWO_VIEWS_FIGMA_EVIDENCE_20261021.json).

## 1. 실제 Figma 제작

| 기능/성격 | Light | Dark | 관리자·QA 검토자가 확인할 정보 |
|---|---|---|---|
| 플랫폼 운영 현황 | [82-03 / 1485:14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-14) | [82-05 / 1486:14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1486-14) | 실제 Job 목록, 상태·갱신 시각, 실패 사유, Run별 품질·Trace 상세 |
| 플랫폼 정책·감사 | [82-04 / 1485:49](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-49) | [82-06 / 1486:49](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1486-49) | 승인된 사용권·파생 분석 범위·보존·삭제, 실제 정책/접근 감사 기록 |
| DEV/QA 도구 결정 | [83-03 / 1488:14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1488-14) | 문서성 시트라 별도 Theme 불필요 | 테스트 실행→Trace·로그→Git SHA가 포함된 결과 증거→필요할 때만 읽기 전용 인덱스 |

82번은 두 업무 화면만 유지하되 Light/Dark 후보가 각각 있다. 83번에 만든 것은 **신규 독립 QA 웹 애플리케이션이 아니라 설계 결정 시트**다.

기존 [82-01](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-144), [82-02](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-218), [83-01](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-290), [83-02](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1286-362) 및 81번 고객 조직 관리자 원본은 보존했다. [00번 Page Registry](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1367-2)의 82·83 상태만 승인된 방향과 맞췄다.

## 2. 기존 Figma 구성요소 → 채택 판단

| 기존 구성요소 | 새 UI 처리 | 근거 |
|---|---|---|
| 운영 현황 · 수집 작업 · 데이터 품질 3개 전역 메뉴 | **운영 현황** 하나로 통합, 실행 목록→선택 Run 상세에 오류/품질 포함 | Grafana·Temporal·Prefect·Sentry |
| 정책·감사 · 접근 이력 두 전역 메뉴 | **정책·감사** 한 화면에 감사 이벤트 포함 | OPA Decision Logs, OWASP |
| 구독 운영·지원 요청 | M9 최소 Admin 메뉴에서 제외, 실제 청구/지원 수요 확인 후 별도 결정 | 현재 상용 결제/환불·지원 업무 M9 밖 |
| 미측정 상태 KPI 세 장 | 실제 서버 미연동을 **하나의 명확한 상태**로 표시 | 미측정 ≠ 0, 상태·측정 시각 정합성 |
| 실행 반응 없는 State CTA · Job 강제 성공 | **생성하지 않음**. 향후 실제 보안·감사·멱등성 계약 후 승인 | 안전하지 않은 운영 동작 금지 |
| 중복 권한 안내 · 클립 아래로 잘린 프레임 | 각 후보 화면에 **한 곳의 운영 경계 설명만** | 중복·오인·클리핑 해소 |
| QA 시뮬레이터·회귀 기록 전용 페이지 | 기존 83 자산은 보존, 신규 83-03에는 실제 도구·증거 흐름을 명시 | Playwright Reporter·Trace, GitHub Artifacts |

신규 후보에는 **실측되지 않은 성공률, 작업 건수, 승인 상태, 실제 댓글 수치**를 만들지 않았다. BE 서버가 데이터와 정책 근거를 제공하기 전에는 미연동 상태로 보이게 했다.

## 3. 검증 결과

| 검증 | 실제 결과 |
|---|---|
| 신규 관리자 후보 | **4/4 프레임**(운영·정책 × Light/Dark) |
| 후보 텍스트 스타일 | **104/104 바인딩** |
| 후보 단색 Fill·Stroke | **182/182 공통 의미 토큰 바인딩, 미바인딩 0** |
| 실행 가능한 Figma 메뉴 | 각 후보 1개 이동, **4/4 NODE 목적지 유효** |
| Light/Dark Flow 시작점 | 82 원래 운영/Theme QA를 유지 + 최소형 2개 Flow |
| 새 후보가 1600×900 화면 밖으로 잘리는 구역 | **0건(최상위 섹션 기준)** |
| 기존 원본·역할 권한 Flow | 82-01·82-02, 83-01·83-02, Theme QA 보존 |
| QA 도구 결정 시트 | **17/17 텍스트 스타일, 28/28 단색 토큰, 반응 0건** |
| Figma 화면 렌더링 | Ops·Policy Light/Dark 네 장 + QA 시트 한 장 스크린샷 확인 |

**실제 Figma Present 모드 마우스 클릭·키보드·뒤로가기·반응형 줌을 실행하지 않았다.** Static NODE 검사 PASS가 실제 사용자 UX나 서버 인증 PASS를 의미하지 않는다.

## 4. 외부 근거 Source → 실제 Figma Node

| 출처 ID | 실제 Node와 링크 | 참고한 부분 |
|---|---|---|
| EX-ADM-001 Grafana / EX-OPS-001 OpenTelemetry | [운영 미연동 배너 1485:31](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-31) | 실제 시각·출처·측정 없이는 KPI를 0으로 표시하지 않음 |
| EX-ADM-002 Temporal / EX-ADM-003 Prefect | [Job 목록 1485:34](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-34) / [상세 1485:35](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-35) | Run ID·상태·실패 원인·Trace 드릴다운. 엔진 도입 결정 아님 |
| EX-ADM-004 Sentry / EX-DATA-001 GX | [Run 상세 1485:35](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-35) | 장애·데이터 품질을 특정 Run에 연결 |
| EX-POL-001 OPA / EX-POL-002 OWASP | [정책 감사 이벤트 1485:70](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-70) | Decision ID·역할·작업·시각, 민감값 보호 |
| EX-POL-003 YouTube 파생 지표 정책 | [사용권/파생 분석 1485:75/78](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1485-78) | 실제 승인 근거 없으면 허용 표시/우회 불가 |
| EX-QA-001/002 Playwright·GitHub 아티팩트 | [QA 도구 결정 1488:14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1488-14) | 결과·원본 로그·Trace·실행 SHA 우선, 별도 QA 웹은 조건부 |

외부 UI/소스·이미지/가중치 복제 **0건**. Figma에서 사용한 자산은 **기존 YUTOPIA 내부의 토큰·텍스트 스타일**이다. 외부 참고는 Research→Design-in-Figma 단계이고, FE/BE Code Integrated 단계가 아니다.

## 5. M9 제품 통합까지의 후속 Gate

- **FE:** Admin 2개 웹 전용 route, 단일 안정된 sidebar, Ops/Policy 실제 읽기 Provider, 오류/미측정·권한 차단·Dark/Light 대응.
- **BE:** OpsStatus/JobList/RunDetail/PolicyDecision/AuditEvent 데이터 계약, 관리자 서버 세션/권한·삭제/사용권 Gate·감사 스키마, 실제 메트릭 원천과 갱신 시각.
- **INT:** 같은 FE/BE/shared 커밋에서 고객·조직→플랫폼 권한 상승 부정, raw/eligible/분모·부분·삭제·정책 차단, Job 상세/감사 이벤트 일치 여부 확인.
- **QA:** Node/Playwright/실제 Chrome MV3/BE authorization 시험 실행, tested SHA/OS/브라우저/command/PASS/FAIL/원본 로그·Trace 보존. QA 웹을 M9 필수 Gate로 만들지 않음.
- **사용자 검수:** Figma 후보 4개/QA 시트의 최종 시각 승인, 실제 Present 양방향 메뉴 동작, 화면폭·100/125/150% 줌·키보드/스크린리더 별도 확인.

**최종 판정:** ADMIN_TWO_VIEWS_4_CANDIDATE_SCREENS_CREATED, FIGMA_STATIC_4_OF_4_NAV_PASS, INTERNAL_TOKENS_182_OF_182, ADMIN_API_NOT_IMPLEMENTED, QA_TOOLCHAIN_FIRST_DIRECTION_APPROVED, FIGMA_PRESENT_NOT_RUN, USER_VISUAL_SIGNOFF_PENDING.
