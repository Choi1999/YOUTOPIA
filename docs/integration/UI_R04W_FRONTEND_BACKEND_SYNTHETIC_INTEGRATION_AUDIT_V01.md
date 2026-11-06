# UI-R04-W — YOUTOPIA 기능 통합 검수 및 합성 메타데이터 UI 연결

작성일: 2026-11-05 KST. 기능통합 승인, 실 YouTube 호출·키 입력·병합·배포 미승인.

## 1. 프런트엔드/백엔드 구조

| 트랙 | 원격 HEAD | 실제 구성 |
|---|---|---|
| 프런트 스택 최상위 | Draft PR #80 @ d49898faeef5c5620acea524a3a564cb45fbf2f6 | React 그래프, URL, 별칭, 메타데이터 offline Node 계획 |
| frontend 기준 | 372486707eb04350faa28af0d86e3b2eb2f50f82 | 루트 frontend/와 shared/ |
| 백엔드 스택 최상위 | Draft PR #86 @ 85951d0d2964b5f4bc05fe233343701598a22c45 | Java 21 Spring Boot 4, 메타데이터 순수 계약, 테스트 프로필 503, Windows DPAPI 합성 |
| backend 기준 | feat/backend-bootstrap @ 01503885e24d3320f131ea17250748677e904a30 | 루트 Gradle src/main/java/ 프로젝트 |

**단순 일괄 병합 비권장.** 양 스택은 다른 루트 프로젝트를 사용하며 frontend 루트의 bakcend 폴더는 Spring Boot 코드가 아니다. 실제 merge/rebase가 어떤 파일 충돌을 일으킬지는 dry-run/통합 후보 QA 전까지 단정하지 않는다. 현재 별개 브랜치의 HEAD만 확인했고 병합하지 않았다.

## 2. 확인한 실제 병목

- 브라우저 URL 등록은 canonical VIDEO ID, UC 채널 ID, @handle만 저장하며 실존/소속·공식 제목·댓글 데이터는 조회하지 않는다.
- User presentation은 별칭과 사용자 제공 채널 URL만 저장한다. 채널 프로필 검증 캐시는 초기 비어 있다.
- Node metadata-readiness 및 metadata-guarded-lifecycle은 오프라인 JSON 계획·형식, 모의 quota/TTL만 제공한다.
- Spring OfflineMetadataBridge는 Java 형식만 검사한다. MetadataOfflineBoundaryController는 격리 테스트 프로필+명시 속성에서만 노출되며 항상 503을 반환한다. production 성공 HTTP API는 없다.
- Java CurrentUser DPAPI 테스트는 합성 키만 허용한다. 실제 서버 자격 증명 reader, 네트워크 제공자 호출, 계정·분산 quota 원장은 없다.

## 3. 이번 구현 범위: 브라우저 내부 synthetic E2E

**E2E 정의:** URL 입력 → 로컬 mock backend envelope → 타깃별 엄격 검증 → 합성 제목/채널명/썸네일을 그래프·패널·상세 화면에 반영. Spring HTTP E2E나 Google API E2E를 의미하지 않는다.

1. 기본 꺼짐. 사용자가 화면에서 '합성 정보 미리보기'를 명시적으로 켜야만 적용한다. 탭 새로고침 후 자동 활성화되지 않는다.
2. simulateOfflineMetadataBackend는 canonical 입력의 타입/ID를 확인하고 합성 제목·가상 채널 안내·로컬 thumbnail **유형**만 반환한다.
3. decodeOfflineSyntheticMetadata는 정확한 target identity, envelope schema, 허용 필드, 제목·제어문자, sourceAuthenticated=false, providerRequestsMade=0, consumerPublicationAuthorized=false를 강제한다. 다른 영상 응답·API 키·외부 썸네일 URL·가짜 승인 플래그는 거부한다.
4. React 화면에 전달하는 데이터는 transient synthetic 필드에만 존재한다. 사용자의 직접 입력 별칭이 우선한다. tab sessionStorage에 합성 이름·썸네일·가상 채널명을 기록하지 않는다.
5. Canvas/TargetBoard/FocusMode에서 영상·채널별 제목을 통일하고 local CSS 썸네일에 DEMO 표기를 한다. 합성 미리보기 동안 외부 image src/CDN 요청도 하지 않는다. 영상의 가상 채널 안내는 Focus 상세에 표시한다.
6. 합성은 제공자 신뢰·실제 영상 존재·채널 소속·댓글 분석·검증 상태·감성/지표를 만들지 않는다. @handle의 실제 channelId를 가정하지 않는다.
7. 토글 OFF, URL 제거 또는 페이지 재시작 시 해당 합성 표시가 제거된다. 사용자 별칭은 독립적으로 유지된다.

## 4. 자동검수 및 결함 방어

- Unit: envelope/response kind/id/정확한 필드·source/0 requests 검증, 교차 영상 응답·외부 이미지 URL·API key·컨트롤 문자 등 거부.
- React: URL 한 개 기본 미확인 → 명시 토글 → 그래프/상세 합성 제목·가상 채널·CSS thumbnail → 토글 취소 → 기본 미확인; 활성 상태에서 신규 URL 자동 반영; 수동 별칭·sessionStorage 독립.
- Existing React/extension/Node offline pipeline/TypeScript/Vite/Windows offline CI exact HEAD에서 통과해야 완료.
- 수동 Chrome UI QA는 사용자 보고가 오기 전 PASS로 간주하지 않는다.

## 5. 다음 통합과 승인 Gate

이번 작업은 **브라우저 내부 합성 기능**만 통합한다. Spring 성공 HTTP 응답은 아직 만들어지거나 전송되지 않는다. 다음에는 별도 승인받은 isolated Spring synthetic HTTP producer, same-origin React reader와 테스트용 서버 기동 계약을 연결해야 한다.

기존 정책 정본은 POLICY_HOLD / liveCallsAuthorized=false / derivedSentimentAuthorized=false / verifiedCount=0. 실제 키 사용, Google/YouTube 호출, 채널 신뢰 승격, 데이터 보존·삭제, quota/보안 승인, 브랜치 병합·배포는 별도 Gate다.

현재 판정: BROWSER_SYNTHETIC_METADATA_INTEGRATION / SPRING_HTTP_NOT_CONNECTED / YOUTUBE_API_REQUESTS_0 / UNMERGED.
