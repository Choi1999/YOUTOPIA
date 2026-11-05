# UI-R04-Y — React ↔ Spring Boot 합성 HTTP 수신 통합

작성일: 2026-11-05 KST

## 1. 의존성 및 검수 대상

- 프런트엔드 부모 Draft PR #87: d338e63a166fe677a69ac73f87ea10b0beb058f8.
- 백엔드 독립 Draft PR #88: Spring 테스트 소스에만 존재하는 localhost 합성 HTTP 서버. CI 통과한 원격 HEAD를 PR 메타데이터와 함께 고정해 대조한다.
- 기존 frontend 운영 기준과 Spring 기준은 다른 개발 트리이며, 본 PR은 프런트엔드 코드만 변경한다. 병합/배포는 하지 않는다.
- 사용자 목표는 URL 추가 뒤 실제 제목·채널·썸네일 자동 표시이지만, 이번 연결은 **Spring 테스트 서버에서 생성한 합성 JSON**만 화면에 반영한다. 아직 공식 YouTube API 데이터를 얻지 않는다.

## 2. 실제 통합 경로

1. 프런트 Vite 개발 서버에서 현재 셸에 VITE_R04Y_SYNTHETIC_HTTP=enabled를 명시해야 프런트의 Spring 합성 연결 버튼과 Vite proxy가 활성화된다. 프로덕션 빌드에 해당 proxy/버튼은 없다.
2. 사용자가 별도로 실행한 Spring 테스트 서버는 127.0.0.1:8765에 바인딩되며 테스트 소스만 제공한다. 운영 bootJar, 기존 Spring SecurityConfiguration, 실제 Google/YouTube API 호출과 무관하다.
3. 사용자가 VIDEO/CHANNEL/@handle URL을 등록하고 Spring 합성 연결을 명시적으로 켜야만 React가 같은 출처의 /api/v1/youtube/metadata/synthetic/... 상대 경로로 GET 요청을 한다.
4. HTTP 클라이언트는 credentials=omit, redirect=error, cache=no-store, mode=same-origin, GET, Accept=application/json 및 최대 5초 timeout을 강제한다.
5. 응답 status 200, Content-Type application/json, X-YOUTOPIA-Synthetic: test-only, 최대 4096 bytes(스트리밍 검증), strict UTF-8/JSON과 기존 UI-R04-W 정확한 schema·kind·canonical ID·false provenance를 통과해야 등록 레코드를 갱신한다.
6. 화면에는 DOM/CSS DEMO 썸네일과 명확한 합성 정보 라벨만 표시. 서버 응답에서 이미지 URL, 댓글, 조회 수, 채널 소유 관계, Google sourceAuthenticated=true를 받아들이지 않는다.
7. 서버가 중단되거나 503/예상 외 응답, 다른 ID, 미등록 대상이 있으면 상태를 실패로 보고 **미확인** 상태를 유지한다. R04-W 로컬 시뮬레이터 결과로 자동 대체하지 않는다.
8. 첫 3개 URL 타깃까지만 제한해 테스트하며, URL 변경 또는 모드 해제 시 진행 중인 요청을 AbortController로 취소한다. 원격 상태는 탭 저장소/사용자 별칭과 분리돼 일회성 메모리에만 남는다. 최초에는 local/remote 모두 미활성.

기존 R04-W 로컬 합성 미리보기는 그대로 유지하지만 두 모드는 동시에 켤 수 없으며 명시적으로 서로 전환한다. 기존 수동 표시 제목은 합성 제목보다 우선한다.

## 3. Windows 로컬에서 두 프로세스 연결 검수

백엔드 Spring 테스트 실행(백엔드 PR #88 별도 Worktree):

~~~powershell
cd C:\Projects\YOUTOPIA-R04X-BE-QA
.\gradlew.bat --no-daemon test --tests "com.youtopia.youtube.metadata.synthetic.MetadataSyntheticHttpLoopbackTest"
.\gradlew.bat --no-daemon runR04XSyntheticMetadataLoopback
~~~

프런트엔드 Vite 개발 서버 실행(프런트 PR의 정확한 HEAD 별도 Worktree):

~~~powershell
cd C:\Projects\YOUTOPIA-R04Y-FE-QA\frontend
$env:VITE_R04Y_SYNTHETIC_HTTP = "enabled"
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
~~~

브라우저에서 /analysis/youtube/workspace를 열어 Spring 합성 연결을 선택한 다음
https://youtu.be/Ab0_-123xyz 와 https://youtube.com/@samplecreator 를 등록한다.

수용 기준:
- URL만 입력하면 외부 GET 요청이 없어야 함.
- 버튼을 켜면 **같은 출처의 합성 API**로만 요청하고 그래프·대상 목록·상세에 '합성' 제목과 DEMO 썸네일이 나타나야 함.
- 기존 영상 CDN 미리보기를 따로 승인하지 않았으면 실제 이미지도 조회하지 않음.
- 새 URL 추가 후 동일하게 표시되고, 연결 끄기 시 미확인 상태 복귀.
- Spring 서버를 정지하면 합성 조회 실패/미확인 상태를 표시하고 실제 provider 데이터처럼 승격하지 않음.
- 브라우저 수동 QA는 사용자가 보고하기 전 PASS로 간주하지 않음.

## 4. 배포/보안 경계 및 후속

- 실 키, DPAPI 등록·조회, Google Cloud 서비스, Quota, 실제 videos.list/channels.list, 댓글/감성, 개인정보 원문 등 어떤 실제 데이터도 이 경로에서 다루지 않는다.
- 원본 정책 G45 POLICY_HOLD 및 first-call transport compile-time lock 유지.
- 생산 Spring API는 여전히 승인된 메타데이터를 전달하지 않음. 테스트 전용 서버 인증 없이 루프백 합성 GET만 가능하며 운영 보안 우회 용도로 사용할 수 없다.
- 이 두 PR의 Java HTTP / TypeScript mock CI 통과만으로 양 프로세스 연결을 실제 운영 PC에서 시험했다는 뜻은 아니다. 별도 Windows 수동 이중 프로세스 E2E 검수가 필요하다.
- 이후 실제 제공자 메타데이터 연결은 운영 계정·키 제한·실제 Quota·테넌트·출처 신뢰·캐시/삭제/약관·첫 실행 별도 승인이 필수다.
- 병합과 배포 역시 별도 승인 대상으로 유지한다.

현재 판정: DEV_SAME_ORIGIN_SPRING_SYNTHETIC_CLIENT_CODE / REAL_YOUTUBE_0 / NOT_MERGED.
