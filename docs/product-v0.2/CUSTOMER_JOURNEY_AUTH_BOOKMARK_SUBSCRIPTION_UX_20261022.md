# YOUTOPIA — Guest → 로그인 → 무료 북마크 → 구독 비교·추적 연속 UX v0.4

> **2026-10-22 · USER_APPROVED_PRODUCT_DIRECTION / FIGMA_INTERACTIVE_REVIEW_CANDIDATE / SERVER_NOT_IMPLEMENTED / PRESENT_NOT_RUN**
>
> 이전 [80~100 Figma 개편(PR #32)](https://github.com/Choi1999/YOUTOPIA/pull/32)은 정보구조·채널/NoData 3탭 정리까지 완료했다. 이번 개편은 분리된 화면을 **사용자 의도와 저장 결과가 유지되는 여정**으로 연결한다. 실제 기능이나 로그인 공급자·구독 가격을 확정하지 않는다.
>
> [Figma 88 Light 시작](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-2) · [Dark 시작](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-2) · [영상 저장 이후 무료→유료 구분](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-265) · [98 구독 안내](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1655-2).
>
> 수치·노드·색상·클릭 경로 근거: [FIGMA_88_CUSTOMER_JOURNEY_EVIDENCE_20261022.json](../figma/audits/FIGMA_88_CUSTOMER_JOURNEY_EVIDENCE_20261022.json).

## 1. 승인된 상품 경험과 아직 가설인 부분

**승인 제품 방향:**
- **Guest:** 정책상 제공이 허용된 기본 YouTube 영상·채널 Hover 및 Side Panel 요약/주제/추이 탐색. 첫 이용에서 강제 로그인 금지.
- **무료 로그인:** 영상·채널 식별자에 대한 본인 북마크, 본인 메모·폴더, 다시 찾기. **원시 댓글·분석 Snapshot 자동 영구 저장 금지**.
- **개인 구독:** 허용된 분석 대상·기간 확대, 여러 영상/채널 비교, 추적, 보고 도구 후보. 유료 구독은 댓글 없음·정책 차단을 해결하지 못한다.
- **조직 구독:** 허용된 조직 공간과 자원/역할을 함께 확인한 협업. 조직 관리자 권한은 구독만으로 부여되지 않는다.
- **플랫폼 운영/DEV·QA:** 고객 Chrome 확장과 별도 인증·테스트 영역. 고객 로그인으로 관리자 권한을 얻지 못한다.

**아직 제안/미승인:** 구독 상품명·가격·무료/유료 조회·저장·비교의 정량 한도, 결제/Checkout/환불 제공자, 실제 인증 공급자·세션/쿠키, 분석 원천 권리·YouTube 추가 파생 지표 이용 승인, 구독 지속/취소 처리, SavedTarget·ComparisonSet·MonitoringRule의 API·DB 계약, 알림 채널/빈도.

사용자에게 보여줄 한 줄 가치는 **무료: 발견하고 기억하기 / 구독: 비교하고 추적하며 기획에 활용하기**. 주 고객 가설은 1인 크리에이터/소규모 유튜브 운영팀이지만 실제 유료 수요 검증은 이루어지지 않았다.

## 2. 실제 Figma에 만든 연속 상태 (Light/Dark 각각)

| 단계 | Figma Light / Dark | 사용자에게 표현할 내용 | 테스트해야 할 부작용 부재 |
|---|---|---|---|
| 01 Guest 발견 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-2) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-2) | 영상 **A** 기본 Hover·상세, 선택 대상 고정 | 로그인 팝업·저장·유료 결제 0 |
| 02 저장 의도 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-53) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-53) | 저장에 로그인 필요, 계속/취소 선택 | 저장 실행 0 |
| 03 고객 웹 로그인 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-106) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-106) | F04 고객 공통 로그인 **시연** | 실제 세션·비밀번호 수집·OAuth 없음 |
| 04 로그인 취소 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-159) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-159) | 아무것도 저장하지 않고 영상 A의 기본 분석으로 | 저장 성공 UI·유료 승격 0 |
| 05 로그인 성공 후 복귀 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-212) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-212) | 영상 **A**와 SAVE_TARGET 의도 복원 → **저장 재확인** | 로그인만으로 북마크 생성 금지 |
| 06 무료 보관함 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-265) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-265) | 명시적 확인 이후 합성 영상 A 저장 목록 | 원본 댓글·파생 Snapshot 자동 복사 금지 |
| 07 유료 비교 요청 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-318) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-318) | 무료 북마크 유지 + 복수 비교는 구독 범위 안내 | 가격 미확정 상태에서 자동 청구·권한 변경 금지 |
| 08 플랜 설명 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-371) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-371) | 비교·긴 기간·추적·보고의 실제 필요를 설명 | Checkout 작동·유료 상태 가장 금지 |
| 09 비교 UX 시연 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-424) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-424) | A/B 관측 기간·분모·버전·정책 Gate | 무료 이용자에게 비교 권한 부여하거나 가짜 수치 0 |
| 10 추적 UX 시연 | [L](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1647-477) / [D](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1649-477) | 영상 A 관측/알림 후보와 이력 없음 | Job·알림 예약/발송 성공 가장 금지 |

10개 상태를 모드별 동일 구조로 복제하여 **20개 편집 가능한 Figma 화면**으로 구성했다. Light/Dark에서 각각 Guest→Login/Cancel/Confirm→Save→Plan→Compare→Monitor **작업 버튼**을 같은 페이지의 Figma `ON_CLICK → NODE`로 연결했다. 여정 전체/무료→유료 구간 각각 Light/Dark **총 4개 Flow 시작점**.

### 분석 데이터와 시나리오용 영상 ID 일치

- **88 및 100 Auth-F01~F06:** 독립 합성 시나리오 **영상 A · 조리법 따라하기**. 88 Guest의 canonical 참조를 [100 AUTH-F01](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1321-3)로 수정해 같은 합성 영상 A를 가리키도록 했다.
- **98 Video Hover·3탭·구독 안내:** 별도 합성 시나리오 **영상 B · 서울 골목의 숨은 맛집 5곳**. 서로 다른 Figma 시안 영상 A/B를 한 사용자 세션으로 가정할 수 없다.
- 각 88 화면의 `Figma 원본 참조`는 별도 페이지를 **URL로 열어 보는 QA 링크**이며 사용자 인증 직후 탭/선택 영상이 실제 자동 복귀하는 런타임 계약이 아니다. 실제 제품에서는 검증된 `targetType+targetId+selectionRevision`과 일회용 `AuthReturnIntent`를 서버에서 검증해야 한다.

## 3. 98 Side Panel의 구독 안내를 87과 통합

최신 영상 Side Panel의 [요약 98-11](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1375-2), [주제 98-12](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1376-2), [추이 98-13](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1379-2), [맥락형 근거 98-14](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1380-2)의 **기존 구독 티저 4건**은 구형 [98-06](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-8)이 아닌 신규 [98-29 구독 기능 범위](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1655-2)로 향하도록 변경했다.

**98-29 한 화면에서:**
- 무료 로그인 북마크·메모·폴더 / 구독 비교·긴 기간·추적·보고를 분리.
- 데이터 없음·정책 차단은 결제로 해결되지 않는다는 안내와 미정 가격·이용 한도 표시.
- `BACK`은 직전 탭으로 복귀. **87 상품 기능 범위** 및 **88 별도 영상 A 여정**은 URL 검토 링크. 상품·계정 상태는 바꾸지 않음.
- 구형 [98-06](https://www.figma.com/design/00Q6HNjuv02u7Ex4yUzZer/?node-id=1253-8)은 삭제 없이 기존 보관 위치에 남김.

## 4. 앞으로 정의할 고객 데이터 계약 후보 (실제 API 아님)

| 계약/데이터 | 최소 필드 후보 | 저장·갱신과 보안 원칙 |
|---|---|---|
| `SavedTarget` | `ownerRef`, `targetType`, `verifiedTargetId`, `folderRef?`, `ownNote?`, `savedAt`, `revision` | 무료 로그인에서 **사용자 선택 후** 생성. 소유자/자원/중복·멱등성 확인, 계정 전환·삭제/내보내기 요구와 정책 Gate 반영 |
| `AuthReturnIntent` | `intentId`, `requestedAction=SAVE_TARGET`, `targetType`, `targetId`, `tabContext`, `selectionRevision`, `expiresAt` | 임시·1회 사용·위조/재생 방지. OAuth/세션/토큰이 아님. 성공해도 사용자에게 **다시 저장 확인** |
| `ComparisonSet` | `ownerRef`, `targetRefs[]`, `scope`, `analysisVersions[]`, `comparability` | 구독·권리·분모·기간/영상 집합 검증 후 생성/조회. 분석 데이터를 임의로 영구 복제하지 않음 |
| `MonitoringRule` | `ownerRef`, `targetRef`, `requestedWindow`, `condition`, `enabled`, `policyRevision` | **실제 이용권·분석권리·쿼터/비용·Worker 운영 승인 후**에만 활성화. 상태 시안에서 Worker 예약·알림 발송하지 않음 |
| `EntitlementDecision` | `subjectRef`, `organizationRef?`, `feature`, `scope`, `allow`, `revision`, `reasonCode` | Server authoritative. **구독과 역할 분리**, 정책 차단·원천 삭제는 유료 권한으로 우회 불가 |

특히 `SavedTarget`은 YouTube 댓글과 분석 스냅샷을 사용자 계정의 영구 자산으로 만드는 계약이 **아니다**. 유효한 원천 ID·제목/썸네일·파생 지표 등 API 제공 데이터의 저장·갱신·삭제 요건은 각 데이터 유형별 별도 검토가 필요하다. 무료 북마크의 개인 메모는 사용자가 직접 작성한 컨텐츠로 별도 소유·삭제 규칙 후보를 설계한다.

## 5. QA 인수 시험 — 시안과 실제 구현을 구별

| Test ID | 사용자 행동 | PASS 조건 | 현재 |
|---|---|---|---|
| CJ-UX-01 | Guest가 영상 A를 본다 | 기본 허용 분석만 표시. 로그인 강요/가짜 분석 없음 | **Figma 구조, Present NOT_RUN** |
| CJ-UX-02 | A 저장 클릭 | 로그인 필요와 대상 A를 명시. 저장 아직 없음 | **Figma 구조, Present NOT_RUN** |
| CJ-UX-03 | 로그인 취소 | A/Guest 기본 상태로 복귀, `SavedTarget` 생성 0 | **Figma 구조, Backend NOT_IMPLEMENTED** |
| CJ-UX-04 | 웹 로그인 성공 시연 | 선택 A 고정, 원래 `SAVE_TARGET` 맥락 복귀 | **Figma 구조, 실제 인증 NOT_RUN** |
| CJ-UX-05 | 복귀 후 저장 확인 | 저장한 동작만 실행, 취소 시 저장 없음, 멱등성·소유권 검증 | **Figma 구조, API NOT_IMPLEMENTED** |
| CJ-UX-06 | 계정 교체/탭 전환/만료·재생 intent | 이전 사용자/다른 영상/다른 탭으로 저장하지 않음 | **NOT_RUN** |
| CJ-UX-07 | 무료 고객이 복수 비교 요청 | 무료 북마크는 유지, 비교 기능 Gate를 설명 | **Figma 구조, 서버 이용권 NOT_IMPLEMENTED** |
| CJ-UX-08 | 상품 안내 선택 | 가격·쿼터 미확정 고지, **자동 결제·플랜 변경 없음** | **Figma 구조, Checkout NOT_IMPLEMENTED** |
| CJ-UX-09 | 구독 미구매자가 비교·추적 시연 | 그 화면은 UX Preview이고 유료 기능이 활성화되지 않음 | **Figma 구조, 실행 없음** |
| CJ-UX-10 | 비교 불가능 / 댓글 없음 / 정책 차단 | 가짜 감성/차트/알림·결제 해결 문구 없음 | **Figma 구조 / E2E NOT_RUN** |
| CJ-UX-11 | Figma 98 현재 탭에서 구독 안내 | 98-29 Contextual Gate로, 이후 BACK은 이전 탭·옛 98-06으로 가지 않음 | **NODE 구조 PASS, Present NOT_RUN** |
| CJ-UX-12 | 고객 Chrome/웹과 Admin/QA 인증 분리 | 플랫폼 Admin·QA 기능이 고객 로그인으로 노출되지 않음 | **AUTH-SURFACE 설계, 보안 서버 NOT_RUN** |
| CJ-A11Y-01 | 100·125·150% 확대, 키보드/스크린리더, 긴 언어 | 화면 잘림/포커스/읽기 순서와 CTA 가용성 검증 | **NOT_RUN** |

### 정적 QA 수치 (실제 데이터·사용성 시험 아님)

- 신규 **88** Light/Dark **20/20** 화면; **638/638 텍스트 스타일**, **1,214/1,214 의미 Fill/Stroke**.
- 실제 Figma `NODE` 반응 **38/38**, 기존 정본 참조용 `URL` 반응 **20/20**, 내부/외부 목적지 불량 **0**. 시작점 **4개**.
- 새 **98-29** 구독 Context Gate, 기존 98 최신 3탭 티저 경로 **4건**을 새 Gate로 전환. Gate에는 **BACK 1 / URL 2**.
- 현행 Figma 00·80·81·82·83·98·99·100 검토 목차의 **URL 링크 총 84건**, 끊어진 목적지 **0**. 현재 80~100 실존 페이지 **20개**, 89번 결번 유지.
- 실제 Figma screenshot QA는 Light Guest/Auth/Save/Plan, Dark Auth, Registry/Auth/Chrome 목차 확인. **Figma Present 브라우저 실제 클릭·드롭다운/키보드·Chrome 설치형 MV3 테스트는 실행하지 않았다.**

## 6. 남겨둘 다음 결정 Gate

1. **무료 북마크의 실제 허용 한도와 `SavedTarget` 소유권/삭제·동기화 정책**, 사용자 계정/보관 기간·데이터 출처와 YouTube 이용 정책.
2. **고객 AuthReturnIntent 운영 방식**(원래 선택 대상 유지, 임의 returnUrl 차단, 원탭 복귀, state/nonce/PKCE, 만료·취소·재생 차단).
3. **비교/추적 플랜의 단위·한도·가격/원가/쿼터**, 조직 공유 계약, 실제 분석 권리 승인 범위.
4. **98/88/100의 실제 Figma Present 검증**과 설치형 Chrome Side Panel → 로그인 → 계정 저장/비교 인수 테스트.
5. 상품 지불 의사가 입증되는 1차 고객군/마케팅 가설 검증. 현재 기준은 **콘텐츠 기획자/소규모 채널 운영팀 우선 연구**, 확정 타깃·가격은 아님.

**최종 판정:** 승인 제품 방향 반영 / `FIGMA_88_LIGHT_DARK_STATIC_PASS` / `FIGMA_98_PLAN_SCOPE_STATIC_PASS` / `AUTH_SAVE_SUBSCRIPTION_RUNTIME_NOT_IMPLEMENTED` / `USER_VISUAL_SIGNOFF_PENDING` / `PRESENT_NOT_RUN`.
