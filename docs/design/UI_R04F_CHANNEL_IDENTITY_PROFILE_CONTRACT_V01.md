# YOUTOPIA UI-R04-F — Channel Identity & Profile Preview Contract v0.1

## 1. 범위와 안전 경계

채널 ID·@handle 식별, 프로필 이미지 준비 상태, RAM 캐시, 공통 그래프/카드/도킹 표시를 구축한다. 현재 `POLICY_HOLD`와 최초 실제 YouTube 요청 하드락을 그대로 유지한다. **실제 채널 ID 해석 및 채널 프로필 자동 조회는 아직 구현하지 않는다.**

## 2. 채널 식별 상태

- `CHANNEL_ID_UNVERIFIED`: UC 접두사+22자 형식만 인정, 실존 채널이라는 뜻은 아니다.
- `HANDLE_UNRESOLVED`: @handle 형식과 정규화만 인정, 실제 채널 ID 매핑은 아직 모른다.
- `HANDLE_RESOLVED` / `CHANNEL_ID_CONFIRMED`: 추후 승인된 채널 metadata의 ID/handle과 입력 대상이 정확히 일치할 때만 사용한다.
- 메타데이터 `POLICY_HOLD`, `READY`, `STALE`, `NOT_FOUND`, `FAILED` 상태를 분리한다. 현재 실제 화면에서는 `POLICY_HOLD`가 정상 상태이고 나머지는 테스트 주입으로만 검증한다.

## 3. 승인된 프로필·이미지 계약

- `ApprovedChannelProfile`에 source=`APPROVED_CHANNEL_SNIPPET`, channelId, handle, title, thumbnailUrl, retrievedAt이 모두 존재하고 검증돼야 한다. 알 수 없는 추가 필드/민감 필드, 미래 시각, 잘못된 ID, 불일치 handle은 거부한다.
- API에서 제공된 프로필 URL을 **문자 그대로 사용**하며, 현재 HTTPS `yt3.ggpht.com` 및 `yt3.googleusercontent.com` 호스트만 허용한다. 임의 URL, http, userinfo, 비표준 포트, fragment는 차단한다. 추후 Google 이미지 호스트가 바뀌면 별도 검토 후 allowlist를 수정한다.
- 이미지 사용에는 정확히 검증된 READY 프로필과 **별도의 channel image opt-in**이 동시에 필요하다. 기존 영상 CDN 미리보기 동의는 채널 프로필 동의로 간주하지 않는다.
- 현 앱에는 reader와 channel image opt-in 제어를 연결하지 않았다. 따라서 `yt3` 채널 프로필 외부 이미지 요청은 0개가 정상이며, 원형 문자 아이콘은 실제 채널 프로필을 흉내 내지 않는 로컬 식별자다.

## 4. 조회 계약 / 캐싱

- `workspaceChannelReader.ts`는 향후 읽기 전용 승인 제공자를 **주입하는 인터페이스만** 정의한다. 실제 런타임 제공자 호출을 연결하지 않고 `CHANNEL_METADATA_RUNTIME_GATE=POLICY_HOLD`를 명시한다.
- 테스트에서는 가상의 승인 응답/실패를 주입하여 인증 실패, 핸들 불일치, 누락, 예외 시 fail closed와 캐시 동작을 검증한다. 이는 실제 Google API 호출을 수행하지 않는다.
- `ApprovedChannelProfileCache`: RAM 내 최대 64개, TTL 15분, 읽을 때 TTL 갱신 금지, 만료 시 이미지 URL 숨김. 브라우저 저장소/쿠키/Cloud에 API 키·프로필·이미지 파일을 저장하지 않는다.
- 추후 권한이 승인되면 공식 `channels.list(part=snippet, id=...)` 또는 `channels.list(part=snippet, forHandle=...)`의 id/title/thumbnail URL을 검증해 제공할 수 있다. API 키 보관, quota, 서버 측 정책 게이트, 보존기간, 네트워크 오류 처리와 user consent는 별도 승인·설계 대상.

## 5. 현재 UI

- 전체 화면 그래프: VIDEO 노드는 기존 썸네일(영상 이미지 켜기일 때), CHANNEL/CHANNEL_HANDLE은 서로 구별되는 원형 로컬 문자 식별자.
- 등록 카드: 채널 ID 형식 확인 또는 @handle 미해석을 명시한다. 승인된 기록이 있으면 정확한 채널명 및 채널 ID를 표시하도록 준비돼 있다.
- 집중 모드 대상 목록·상세: 동일한 식별 상태를 표시한다. 채널 소속/댓글 수/감성 지표를 임의 생성하지 않는다.

## 6. 수동 QA 및 자동 회귀

1. 채널 ID 및 @handle URL 등록 후 목록·카드·집중 상세에서 서로 다른 상태를 확인한다.
2. 영상 이미지 미리보기 ON이어도 채널 프로필 이미지 src가 생성되지 않음을 확인한다.
3. 승인 응답 모의 주입 시 정확한 채널 ID/handle 매칭, 이미지 출처/동의, 실패 대체를 확인한다.
4. 시간 만료 및 64개 RAM 캐시 제한을 검증한다.
5. 기존 A/B 합성 비교, URL 등록, 영상 썸네일, 정책 게이트, extension 테스트를 변경하지 않는다.
6. Windows Chrome 1440/900/390/320, light/dark, 키보드·모바일 접근성 검사 후 별도 병합 승인.

## 7. 병합 경계 및 공식 자료

PR #69 기반 후속 Draft, 미병합. 명시 병합 승인과 실 API 메타데이터 접근 승인은 별도다.

- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/data/reference/rest/v3/channels