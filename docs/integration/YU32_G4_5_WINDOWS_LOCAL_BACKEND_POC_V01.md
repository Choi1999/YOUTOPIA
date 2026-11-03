# YOUTOPIA — G4-5 Windows 로컬 백엔드 우선 PoC v0.1

> **상태:** LOCAL_FIRST_DIRECTION_APPROVED / OFFLINE_ONLY / LIVE_API=0 / POLICY_HOLD
> **작성 기준:** 2026-11-02 KST · frontend@6cce815ef6bb6f32f5733bd0a11fe46815e8d4ee
> **상위 설계:** [G4-5 실제 소스 준비](./YU32_G4_5_YOUTUBE_SOURCE_READINESS_V01.md) · [G4-5 증거 매트릭스](./YU32_G4_5_PROVIDER_POLICY_EVIDENCE_MATRIX_V01.md)

## 1. 승인 결정

**첫 공개 영상 댓글 PoC의 실행 위치는 기존 Windows PC의 서버 측 수동 프로그램으로 변경한다.** 앞서 제안한 Cloud Run Job/Cloud NAT/예약 공인 IP는 **첫 PoC의 필수 인프라가 아니라 장기 운영 후보**다. 사용자가 승인한 것은 이 실행 방식과 오프라인 준비이며, **실제 YouTube 댓글 API 호출·API 키 발급·원문 저장·감성 지표 생성·유료 인프라 생성·기존 PR 병합은 승인되지 않았다.**

현재 서버 실행 후보는 Node 24 CLI 기반 독립 백엔드 작업 프로세스다. Chrome 확장/React UI는 수집기가 아니며 키를 보유해서는 안 된다. 이는 운영 중인 Spring Boot 서버를 구현하거나 동작시킨 것이 아니다. 후속 통합은 Spring Security의 현재 unknown route `anyRequest().denyAll()`과 읽기 전용 기본 DataSource를 유지하면서 별도로 승인·구현한다.

## 2. 단계별 계획

| 단계 | 범위 | 현재 |
|---|---|---|
| L0 | 기존 Windows PC에서 로컬 **오프라인** 프리플라이트·명시적 VIDEO ID 1~3개 계획 검사 | 이번 PR 구현 |
| L1 | 정책/보관/키 제한/별도 실호출 승인 확보 후 **수동 로컬 백엔드**에서 첫 댓글 스레드 조회 | POLICY_HOLD · NOT_IMPLEMENTED |
| L2 | 서버 인증·tenant/CSRF/삭제/복구 및 영속 Snapshot 검증 후 Spring Boot/확장 통합 | NOT_APPROVED |
| L3 | 반복 운영 필요·비용 승인 시 Cloud Run Job·NAT·예약 IP 재검토 | OPTIONAL · 비용 승인 없음 |

최초 L1 **후보 한도:** 공개 VIDEO 1~3개, `commentThreads.list(part=snippet, maxResults≤100, order=time, textFormat=plainText)`, 영상당 1페이지만, 최대 3건의 API 요청·자동 재시도 0건, 대댓글 별도 수집 없음, 원문/작성자 저장·감성 분석·사용자 공개 없음. 100개는 상위 스레드 상한이며 모집단 전체가 아니다. 현재 실제 수집 코드는 존재하지 않는다.

## 3. 서버용 API 키 제한 — 아직 생성하지 않음

- **API 제한:** 후속 생성할 수집 전용 키는 `YouTube Data API v3 (youtube.googleapis.com)`에만 제한한다.
- **애플리케이션 제한:** 서버용 키는 수집기를 실행하는 Windows PC의 **현재 공인 출구 IP**만 허용하는 구성을 권장한다. 공유기 내부 사설 IP나 `127.0.0.1`을 Google API 키의 공인 IP 제한 값으로 사용하지 않는다.
- **변동 IP:** 가정/모바일 인터넷의 공인 IP는 바뀔 수 있다. 매 실호출 전 새 출구 IP와 키 허용 목록이 일치하는지 확인하고, 일치하지 않으면 API 호출을 거부한다. **IP 제한이 안 된 키로 임시 우회하지 않는다.** 고정 IP 제공이 필요하면 그때 기존 승인 서버/Cloud 대안을 검토한다.
- **비밀 보관:** Windows 사용자별 Credential Manager/DPAPI 보호 저장소 후보. 로컬 `.env`/PowerShell 기록/코드·GitHub·Chrome 확장·브라우저/로그에 평문 키를 저장하지 않는다. 향후 키 보관·접근·회전 구현과 별도 검수가 필요하다.
- **인증 명세 정정 (G45-L3):** YouTube Data API v3 공식 REST 명세에는 `key` 쿼리 매개변수 또는 OAuth 2.0 토큰(`Authorization: Bearer`)이 기재되어 있다. 일반 Google Cloud의 `x-goog-api-key` 헤더가 해당 YouTube `commentThreads.list`에서 지원된다는 **전용 공식 근거는 미확인**이므로 이를 전제한 Adapter를 구현하거나 활성화하지 않는다. 쿼리 키는 URL 유출 위험이 있으므로 지원 여부와 별개로 OS 비밀 보관·로그 마스킹·IP/API 제한 검수 및 별도 실행 승인 후에만 검토한다. 현재 HTTP Adapter·자격증명 읽기·실호출은 미구현이다.
- **비용:** 초기 L0/L1에 Cloud Run/NAT/IP 추가 비용은 필수 아니다. 실제 호출·키·계정 보유 비용/정책 승인은 별도. 기존 PC·인터넷 전력 비용은 일반 개발 환경의 별도 문제다.

출처: [YouTube commentThreads.list](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list) · [Google API 키 제한](https://docs.cloud.google.com/docs/authentication/api-keys) · [Google 키 보안](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices) · [YouTube 개발자 정책](https://developers.google.com/youtube/terms/developer-policies).

## 4. 이번 PR의 로컬 오프라인 실행

Git 작업 트리가 깨끗한지 확인한 뒤 해당 G4-5 기능 브랜치에서 다음을 수행한다. 실제 API 키를 명령줄에 넣지 않는다.

~~~powershell
cd C:\Projects\YOUTOPIA
git status --short
git branch --show-current
node --version

node shared/contracts/yu32-youtube-readiness-v0/scripts/windows-local-preflight.cjs --check
node shared/contracts/yu32-youtube-readiness-v0/scripts/windows-local-preflight.cjs --plan --video-id=Ab0_-123xyz
node --test shared/contracts/yu32-youtube-readiness-v0/tests/*.test.cjs
~~~

예시 VIDEO ID는 형식 테스트용이다. `--check`는 운영체제·Node 메이저 버전·정책 보류 상태만 보고, `--plan`은 **영상 ID를 stdout에 출력하지 않은 채** 대상 수·예상 quota만 표시한다. `--run`은 의도적으로 항상 거부되며 API 키 환경 변수가 발견되면 프리플라이트도 거부된다. 이 오프라인 도구는 실제 IP/Google Cloud/인증 정보를 검증했다고 주장하지 않는다.

## 5. 최초 실제 호출 전에 충족할 게이트

| Gate | 필수 증거 | 상태 |
|---|---|---|
| LOCAL-01 | Windows Node 24 / Git HEAD·clean tree / localhost 외부 노출 0 | 실제 사용자 측 확인 필요 |
| LOCAL-02 | 같은 Google Cloud 프로젝트 소유권·API/쿼터 및 기본 댓글 이용 정책 확인 | 사용자 화면 일부 근거, 정책 미확정 |
| LOCAL-03 | 서버 키 생성·YouTube API 제한·공인 출구 IP 제한·OS 비밀 보관·키 회전 | 미구현 |
| LOCAL-04 | 원문/작성자 최소화, 30일 갱신/삭제·요청 시 삭제, 로그 비노출, 정책 철회 반영 | 미구현 |
| LOCAL-05 | 공개 영상 1~3개·페이지 1·요청≤3·재시도 0·조회 오류·quota 정제 기록 | 오프라인 계약만 |
| LOCAL-06 | Viewer Sentiment Analysis 등 추가 파생 지표 사용 사례·약관/승인 증거 | POLICY_HOLD, 해당 처리 금지 |
| LOCAL-07 | 정확한 최초 실호출 대상·실행자·키/정리·중단 절차에 대한 **별도 사용자 승인** | NOT_APPROVED |

## 6. 기존 Cloud 문서의 지위

[Cloud Run 보안 설계](./YU32_G4_5_SERVER_COLLECTOR_HOSTING_SECURITY_V01.md)와 [비용 검토](./YU32_G4_5_CLOUD_RUN_COST_ESTIMATE_V01.md)는 폐기하지 않고 **선택적 후속 L3 운영 검토 자료**로 보존한다. 초기 단계에서 월 비용 지불·Cloud NAT 도입을 필수 조건으로 삼지 않는다. G44-P3 Draft PR #46과 운영 백엔드·frontend는 변경하지 않는다.

**최종 판정:** WINDOWS_LOCAL_BACKEND_FIRST / OFFLINE_PRECHECK_ONLY / REAL_COMMENTS=0 / BILLABLE_CLOUD_RESOURCES=0 / POLICY_HOLD.
