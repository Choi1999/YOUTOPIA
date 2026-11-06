# YOUTOPIA UI-R04-G — Read-only Channel Metadata Offline Preflight v0.1

## 1. 승인 범위와 정책

사용자는 `UI-R04-G — Read-only Channel Metadata Preflight` 중 **오프라인 사전 검증**을 승인했다. 실제 YouTube Data API 호출, 채널 메타데이터 조회, 정책 해제, 운영 API 키 사용, 외부 요청, 배포 또는 병합은 승인 범위가 아니다.

현재 shared/contracts/yu32-youtube-readiness-v0/policy-gates.json에서 `status=POLICY_HOLD`, `liveCallsAuthorized=false`, `verifiedCount=0`; 기존 최초 실제 호출 hardlock도 false. 본 구현은 두 정책 파일을 변경하지 않는다.

## 2. 공식 API 사실 (2026-11-04 확인)

- `channels.list`는 공식 GET `https://www.googleapis.com/youtube/v3/channels`의 자원 조회 메서드. `part=snippet`에 채널 이름과 썸네일 등 공개 메타데이터가 포함된다.
- filter `id`와 `forHandle`은 요청당 둘 중 정확히 하나만 선택한다. `forHandle`은 @handle를 지원하며, `id`는 여러 ID를 쉼표로 전달할 수 있다.
- `maxResults` 문서상 허용 범위는 0~50, 호출 비용은 1 quota unit. **프로젝트의 실제 일일 잔여 할당량은 읽지 않았으며**, 오프라인에서 10단위라는 가상의 내부 검토 예산만 적용한다.
- Google의 API 오류 문서에 quotaExceeded, dailyLimitExceeded, rateLimitExceeded, forbidden, 401/403, channelNotFound, 5xx 등이 기재되어 있다. 이 버전은 이를 분류할 뿐 실제 재시도하지 않는다.
- 출처: https://developers.google.com/youtube/data/reference/rest/v3/channels/list ; https://developers.google.com/youtube/data/determine_quota_cost ; https://developers.google.com/youtube/data/reference/rest/v3/errors

## 3. 구현 계약

- `workspaceChannelPreflight.ts`는 실행 가능한 URL이나 Fetch 함수를 갖지 않는다. 등록된 canonical YouTube 채널 ID/handle을 확인하고 descriptor 배열만 만든다: `method=GET`, `resource=channels.list`, `part=snippet`, `filter=id | forHandle`, `values`, `maxResults`, `estimatedUnits=1`.
- 채널 ID는 최대 50개씩 묶어 한 계획 항목으로 만들고, handle은 하나씩 다른 계획 항목으로 표현한다. 두 필터를 하나의 항목에 혼합하지 않는다.
- 등록된 VIDEO는 계산에서 제외하며, 중복된 채널 등록은 dedupe한다. 사용자 등록 목록의 상한(128개)을 넘거나 정규화 URL/ID/kind가 맞지 않으면 사전 계획 자체를 거부한다.
- 모든 정상 결과는 `mode=OFFLINE_PLAN_ONLY`, `policyGate=POLICY_HOLD`, `networkExecuted=false`, `liveRequestAuthorized=false`를 반환한다. 10단위 예산을 초과한 경우 `BUDGET_EXCEEDED`를 표시하지만 여전히 실제 호출은 금지한다.
- `simulateChannelListResponse`는 외부에서 **이미 전달된 테스트용 객체**만 해석한다. JSON에서 찾은 channel ID가 요청 ID와 맞지 않거나 중복되면 거부하며, forHandle은 단일 응답만 허용한다.
- 허용되지 않은 프로필 이미지 호스트는 제거하고 이미지 없이 metadata identity만 허용하는 선택을 한다. `channelProfile`의 검증기를 재사용하며 임의 URL 생성, 댓글 다운로드, 감성 추론은 하지 않는다.
- `classifyChannelApiFailure`는 400/401/403/404/429/5xx 및 reason을 일관되게 분류한다. `QUOTA_EXCEEDED`와 `AUTH_DENIED` 상태에서 자동 재시도·gate 해제 없음.

## 4. 사용자 화면

- 채널 URL을 등록하면 `공개 채널 메타데이터 사전 검증` 패널이 나타난다. 등록 채널 수, 예상 요청 건수, 예상 quota 단위, 실제 API 호출 0건을 표시한다.
- `오프라인 요청 계획 보기`를 누르면 처음 8개의 요청 descriptor를 확인할 수 있다. 이는 실제 조회 버튼이 아니며 클릭해도 API 요청/비용은 발생하지 않는다.
- 사용자는 현재 화면에서 metadata 정책 gate를 바꾸거나 유튜브 API 키를 제출·저장할 수 없다. 기존 영상 미리보기(선택적 이미지 CDN) 및 합성 A/B 비교 기능은 독립적으로 유지한다.

## 5. 실제 조회를 허용하려면 필요한 증빙

| Gate | 현재 상태 | 이후 필요 조건 |
|---|---|---|
| 소유권 및 API 사용 설정 | UNVERIFIED | Google Cloud 프로젝트·YouTube API 사용 권한 확인 |
| API 키 및 인증 | UNVERIFIED | 서버 측 저장소·스코프/제한·회전·로깅 마스킹 |
| 할당량 | UNVERIFIED | 실제 잔여 quota, 분당 제한, 상한 및 백오프 조건 |
| YouTube 정책·이용약관 | POLICY_HOLD | 공개 metadata 읽기만 허용 가능한 범위 검토 및 기록 |
| 첫 실제 호출 | NOT_APPROVED | 대상·operator·호출 단위·승인 시각 특정 후 별도 승인 |
| 재시도/오류·보존 | 미구현 | 403/quota/404/429/5xx 처리, 캐시 수명·삭제·개인정보 검토 |

실제 서버에 연결할 때 브라우저에 API 키나 신뢰할 수 없는 임의 URL을 노출하지 않는다. 요금·쿼터·이용약관 및 로그 안전성을 확정할 때까지 `POLICY_HOLD`를 해제하지 않는다.

## 6. 자동/수동 검수

- 51개 ID가 50+1로 분리되는지, `@handle`이 독립 filter인지, 영상 무시·중복 제거·잘못된 URL 거부 및 가상 검토 예산 초과 여부 검사.
- 테스트용 공식 API 응답 모양에서 ID 일치, 0건/미존재, 잘못된 프로필 이미지 출처, 모의 오류 분류 검사.
- UI에서 채널 등록 즉시 예산 정보가 나타나고 실제 요청이 0건인지, 펼치기/접기와 키보드 탐색이 안전한지 확인.
- 실제 브라우저 1440px/900px/390px/320px, 다크/라이트, 기존 영상 썸네일 및 채널 도킹 관련 QA 유지.
- 정확한 기능 HEAD React/Extension/Windows offline CI를 확인한다. 수동 Chrome QA와 병합 승인 전까지 후속 PR은 Draft/미병합이다.

## 7. 미구현 기능

- 실제 `channels.list` 발송, metadata 응답의 운영 캐시, 채널 이미지의 실제 조회 및 활성화, @handle 실존 여부 확인, 신규 서버 배포.
- UI-R04-F의 RAM 승인 캐시는 현재 비어 있으며, 이 오프라인 계획 결과로 실제 READY 데이터를 생성하지 않는다.
- 실제 Google Cloud 할당량·API 키 상태를 조회한 것으로 주장하지 않는다.
