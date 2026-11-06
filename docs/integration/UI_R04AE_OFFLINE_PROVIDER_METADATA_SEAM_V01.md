# UI-R04-AE — 실제 메타데이터 연결 준비: 오프라인 소비자 계약 및 표시 통합

기준일: 2026-11-06 KST  
부모: Draft PR #94 \`56e7f7aefa3d6088e70c50d20067eb18748f616e\`  
이번 범위: **AE-1~AE-5의 오프라인 UI·응답 계약·자동 회귀**. 실제 YouTube/Google API 호출, 키 사용, 서버 인증 구현, Cloud 작업, 병합, 배포는 별도 승인 사항이다.

## 1. 구현한 경계

- \`workspaceProviderMetadata.ts\`: \`YOUTOPIA_UI_R04_AE_METADATA_REQUEST_V01\` 순수 요청 descriptor와 \`YOUTOPIA_UI_R04_AE_METADATA_RESPONSE_V01\` 응답 디코더. 등록 URL의 kind/ID 일치, 필드 화이트리스트, READY/NOT_FOUND/FAILED/STALE, 타임스탬프·15분 TTL, 제목 길이, 영상 ID 결합 이미지 URL 및 채널 이미지 호스트 검사.
- \`AnalysisWorkspacePage\`: 기본값이 **없는** 선택적 \`providerMetadataReader\` 주입 지점만 추가. 일반 제품·진단 라우트 어느 쪽도 이 인자를 주입하지 않으므로 출시 브라우저에서 **신규 API 요청은 0건**. 이 계약은 별도 승인된 백엔드 인증/인가/출처 검토 이후에만 연결할 수 있다.
- 등록 대상은 최대 8개까지 순차 처리하도록 오프라인 준비(더 많은 등록 대상 자체는 허용). 요청 중단 시 AbortSignal, 잘못된 응답·에러 시 무추정 FAILED. 재시도·자격증명·로컬 캐싱·외부 수집 없음.
- 검증되어 투영된 READY 상태만 \`WorkspaceTargetPresentation.providerStates\`에 **메모리 전용**으로 전달. 현재 \`sessionStorage\` 저장 규격은 변경하지 않음. 사용자 별칭은 서버 제목보다 우선.
- 그래프/목록/선택 상세의 표시 제목과 메타데이터 상태 라벨 연결. 영상의 \`channelTitle\`은 **비검증 연관 표시만 허용**하며 공식 채널 소속 edge로 승격하지 않음.
- 썸네일은 기존의 **사용자별 영상/채널 이미지 별도 opt-in**을 그대로 요구. 정규화된 영상 ID에 맞는 \`i.ytimg.com\` 이미지 또는 허용된 채널 CDN만 후보. 실패 시 기존 로컬 placeholder.
- 기존 \`LOCAL_SYNTHETIC_ONLY\` 전용 진단 흐름과 운영 정책 \`POLICY_HOLD\`, \`liveCallsAuthorized=false\` 유지. 실제 YouTube 조회를 성공한 것처럼 표시할 수 없다.

## 2. 보안 및 사실성 제약

**클라이언트 JSON만으로 응답이 실제 제공자에서 왔는지 증명할 수 없다.** \`sourceAuthenticated:true\`는 데이터 필드일 뿐 신뢰 증명이 아니다. \`decodeProviderMetadata\`의 \`allowAuthorizedBackend\` 인자 역시 서버 보안의 대체물이 아니며, 향후 실제 리더를 구성할 때 서버가 사용자 권한·토큰 노출 방지·provider provenance·Quota·TTL을 검증해야 한다. 본 PR에는 실제 네트워크 reader 구현이 없으므로 이 단계의 READY는 **테스트에서 인위적으로 주입한 계약 시뮬레이션**으로만 관찰 가능하다.

백엔드 구현을 이번 UI PR에 강제로 이식하지 않는다. Spring은 별도 브랜치 스택이며, 현재 기존 합성 HTTP는 Java \`src/test/java\` 경계에 남긴다. 이 PR로 운영 메타데이터 API의 사용 허가를 간주할 수 없다.

## 3. 자동 인수조건

1. 새로운 reader가 주입되지 않은 일반 사용자 화면에서 영상/채널 URL 등록이 외부 API를 요청하지 않으며 '정보 미확인' 상태 유지.
2. 테스트 주입된 백엔드 응답이 대상 kind/ID와 정확히 일치하고 유효 TTL이면 이름/상태/채널 레이블 표시는 정상. 사용자 별칭 우선 유지.
3. 잘못된 ID, 변조된 필드, 합성 출처, 허용 외 이미지 URL, 만료 결과는 READY로 승격하지 않음. NOT_FOUND/FAILED/STALE은 내용 공개 없음.
4. 사용자가 동의하기 전 외부 썸네일 \`img\` 미생성, 동의 후에만 제한된 호스트/대상 이미지 사용.
5. 응답/출처 내용은 기존 세션 저장소에 기록되지 않음. UI-R04-AC의 일반/DEV 진단 분리·AD-1~4 도킹·그룹·북마크·별칭·접이식 편집/관리 보존.
6. React Vitest/TS/Vite/extension/shared contracts/Spring pinned test-only HTTP/Windows offline CI 통과 확인.

## 4. Windows Chrome 수동 QA 권장

- \`pnpm install --frozen-lockfile\`, \`pnpm dev --host 127.0.0.1 --port 5173\` 후 \`/analysis/youtube/workspace\` 열기.
- 영상 2개와 채널 URL 1개 등록: 모두 실제 제공자 정보 **미확인**. URL 등록만으로 제목·채널명 추정/실 API 호출이 없어야 한다.
- 사용자 별칭/북마크/그룹/채널 이미지 URL 직접 입력, 이미지 미리보기 동의 및 해제, 선택 상세/도킹/태블릿·모바일 전환, 등록 삭제 회귀 검수.
- \`/analysis/youtube/workspace/diagnostics\`의 DEV 진단은 기존 별도 조건에서만 접근. 합성 데이터가 일반 사용자 화면으로 승격되지 않아야 한다.
- 이 버전의 일반 사용자 화면에서는 **실제 메타데이터를 볼 수 없으며**, 테스트 코드에 주입된 응답만 시뮬레이션이다. 실 provider 조회 QA라고 보고하지 않는다.

## 5. 다음 별도 승인 항목

정확한 Spring 운영 인증·인가/서버 응답 provenance 설계 → 키 보관·Quota·비용·약관 검토 → 별도 명시 승인에 따른 최초 Google/YouTube 요청 → 본 reader를 승인된 동일 출처 서버 경로에 연결 → 실데이터 소스별 비교 및 전체 브라우저 검증. 이 순서 전에는 구체적 API URL이나 키를 브라우저·README·PR 댓글에 기록하지 않는다.

Draft PR로 유지하고, 누적 부모 PR #63~94의 병합은 별도 승인 후 처리한다.
