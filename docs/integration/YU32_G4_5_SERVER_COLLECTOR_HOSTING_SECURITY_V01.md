# YOUTOPIA — G4-5 서버 전용 YouTube Collector 실행·키 제한 설계 v0.1

> **상태:** ARCHITECTURE_DRAFT / BACKEND_ONLY_APPROVED_AS_DIRECTION / NO_CLOUD_RESOURCES_CREATED / LIVE_API=0 / POLICY_HOLD
> **작성:** 2026-11-02 KST · **기준:** `frontend@6cce815ef6bb6f32f5733bd0a11fe46815e8d4ee`
> **인계:** [G4-5 소스 준비 Gate](./YU32_G4_5_YOUTUBE_SOURCE_READINESS_V01.md) · [G4-5 증거 매트릭스](./YU32_G4_5_PROVIDER_POLICY_EVIDENCE_MATRIX_V01.md) · [오프라인 서버 경계 계약](../../shared/contracts/yu32-youtube-readiness-v0/server-boundary.v01.json)
> **승인된 결정:** 첫 실제 공개 댓글 조회 PoC는 **Chrome 확장 프로그램/브라우저가 아니라 백엔드 서버에서** 실행한다. 구체적인 Cloud 자원 생성·비용·실호출은 **별도 승인** 대상이다.

## 0. 2026-11-02 우선순위 수정: 최초 PoC는 Windows 로컬 실행

사용자 승인에 따라 **첫 소량 댓글 수집 PoC의 실행 위치는 기존 Windows PC의 수동 백엔드 프로세스**로 변경됐다. Cloud Run Job·Cloud NAT·예약 공인 IP는 L3 후속 운영 대안일 뿐 L0/L1 필수 비용이 아니다. 현재는 [Windows 로컬 PoC](./YU32_G4_5_WINDOWS_LOCAL_BACKEND_POC_V01.md)에 따른 **오프라인 준비만** 구현하며, API 키 생성·실데이터 호출·NLP·프로덕션 연동은 계속 POLICY_HOLD다.

## 1. 권장 실행 환경과 근거

**초기 PoC 후보: Google Cloud Run Job (수동 실행·비공개 배치 작업).** Chrome Hover→Side Panel은 수집자·API 키·원문 데이터 저장소가 아니다. 초기 PoC에는 공개 HTTP 수집기 엔드포인트도 불필요하다.

- **브라우저:** 사용자 Hover는 기존 GET-only 결과 조회. API 키·실데이터 다운로드·운영 Job 생성 없음.
- **제어 평면(후속):** 기존 Spring Boot 백엔드에서 서버 인증·CSRF·tenant/role/entitlement·policy gate 및 명시적 작업 의도를 검증하는 별도 API 후보. 현재 미구현이며 신규 분석 경로 `anyRequest().denyAll()` 유지.
- **첫 PoC 실행자:** 승인된 Cloud 운영자가 Google Cloud Console에서 **Cloud Run Job을 수동 실행**할 후보. 일정·자동 재시도·Pub/Sub 소비자·공개 트리거 모두 비활성.
- **실행 평면(후속):** 컨테이너화된 전용 Collector Worker가 승인된 영상만 조회하고 최소한의 비개인정보 진단 결과만 기록. 실제 YouTube 호출 모듈은 **이번 PR에 구현하지 않음**.
- **운영 확장(후속):** 승인된 분석 Job/Outbox → 전용 Collector → Snapshot Adapter. G44-P3의 실험용 `g44_lab`을 운영 DB로 승격하지 않으며 기존 Spring 기본 읽기 전용 DataSource를 변경하지 않는다.

### 왜 기존 백엔드에 바로 API 키를 추가하지 않는가?

`feat/backend-bootstrap@7e24bb90058d717226315f4f921aa04535747775`의 참조 상태는 **Java 21 / Spring Boot 4.0.9**, 기본 `spring.datasource.hikari.read-only: true`, `default_transaction_read_only=on`, 분석 API에 대해 `SecurityConfiguration.anyRequest().denyAll()`이다. 별도 쓰기 Pool·실데이터 권한·승인 없이 기존 서버에 Collector/DB write를 끼워 넣으면 안전 경계를 위반한다. 초기 PoC는 **분리된 수동 실행 Job**이 더 좁은 영향 범위를 가진다.

## 2. 설계 데이터 흐름

`운영자(명시적 승인) → IAM으로 인증된 Cloud Run Job 수동 실행 → 전용 작업 Service Account → Secret Manager의 제한 API 키(후속) → 정해진 고정 egress 공인 IP → YouTube Data API v3 / commentThreads.list → 비식별 실행 통계만 기록 → Job 종료`

**실제 실행은 아직 불가능**하다. 현재는 Job·VPC·NAT·Secret·API 키가 생성됐다는 증거가 없다. 제공자 기본 API 이용·원문 수명주기·개별 실호출 승인이 모두 먼저 필요하다.

### 최초 승인 가능 PoC 상한 후보

| 통제 | 후보 |
|---|---|
| 대상 | 공개 `VIDEO` 1~3개, 정규 11자 videoId만 |
| HTTP | `commentThreads.list`, `part=snippet`, `maxResults≤100`, `order=time`, `textFormat=plainText` |
| 페이지 | 영상당 한 페이지만; `nextPageToken`을 사용하지 않음 |
| 대댓글 | 별도 `comments.list` 호출 0 |
| 전체 외부 요청 | 최대 3건, 초기 자동 재시도 0건 |
| 할당량 | 성공/실패와 무관한 Quota 비용까지 별도 검증. `commentThreads.list` 요청당 명세상 1 unit, 최초 3요청 예상 3 units |
| 화면·저장 | 원문/작성자/URL query/키를 로그·DB·브라우저·PR에 남기지 않음. 성공 여부·호출 횟수·반환 스레드 수·정제한 API 오류코드만 기록 후보 |
| 분석·공개 | NLP·Sentiment·댓글 원문 보관·실사용자 서비스 제공·Snapshot 발행 모두 0 |
| 시작·중단 | 수동 단일 실행만. 정책 미승인·키/egress 불일치·할당량 불확실·삭제 정책 미구현 시 실행 거부 |

**주의:** 공개 댓글 스레드 100개는 전체 댓글 100개나 대표 표본을 뜻하지 않는다. 공식 API는 `maxResults` 상한 100, 응답의 `nextPageToken`은 후속 페이지를 의미한다.

## 3. API 키 및 Google Cloud 자원 설계

| 구성 | 권장 후보 | 선행 검증·금지 |
|---|---|---|
| API 키 생성 | 프로젝트 전용의 별도 **서버용 API 키** | 현재 인증 정보 0개로 사용자 화면에서 관측됨. 생성/발급은 이번 승인에 포함하지 않음 |
| API 제한 | YouTube Data API v3만 선택 (서비스 식별자 `youtube.googleapis.com`) | Google Cloud Console에서 제한 목록 실제 확인 |
| 애플리케이션 제한 | **IP 주소**, 전용 Collector 서버의 **고정 공인 egress IP**만 허용 | localhost/사설 IP/불특정 Cloud Run 동적 IP 대역을 허용 목록으로 복사하지 않음 |
| 비밀 보관 | Google Cloud **Secret Manager**의 비밀 버전 참조 | 키를 GitHub, 프런트엔드 빌드, Chrome 확장, 워크플로 로그, 일반 설정 파일에 저장 금지 |
| 실행 ID | Cloud Run Job 전용 Google Cloud **Service Account** | 최소권한 `secretmanager.versions.access`; Secret Manager Secret Accessor를 해당 Secret 범위에만 부여. 소유자/에디터 광역 역할 금지 |
| 외부 고정 IP | Cloud Run **Direct VPC egress(all-traffic)** + VPC + **Cloud NAT(수동 static IP)** + 예약 공인 IP | Cloud Run 기본 outbound IP는 **동적**이므로 단독으로 API 키 IP 제한을 충족했다고 볼 수 없음 |
| 지역 | 하나의 Google Cloud region에서 실행/네트워크 일치 | 선택 및 비용 검수 후 확정; 현재 배포 지역 없음 |
| 네트워크 | 초기에는 오직 승인된 목적지·필요한 Cloud 서비스를 접근하는 서버 작업 후보 | ACL/egress·DNS·Secret 접근 경로 확인. YouTube API 요청 테스트는 정책 Gate 이후 |
| 실행 정책 | 수동 1회, 병렬 실행/스케줄 0, 1페이지, quota 초과 즉시 종료 | no auto-retries; idempotency/dedup 실제 서버 구현 전 반복 실행 금지 |

**중요한 비용 차단:** Cloud Run Jobs, VPC, 예약 공인 IP, Cloud NAT, Secret Manager는 사용량 또는 지속 시간에 따른 **별도 과금이 발생할 수 있다.** 예산 상한/알림·월 예상비용·불필요 자원 삭제 계획을 먼저 승인받아야 한다. **YouTube Data API 3 units 사용 예상치와 Cloud 인프라 과금은 서로 다른 항목**이다.

**대안:** 조직이 이미 관리하는 **고정 공인 출구 IP의 백엔드 서버**가 있다면 해당 서버에서 수동 Collector를 격리 실행하고 동일한 IP/API 제한을 적용할 수 있다. 현재 그런 서버가 확인되지는 않았으므로, 임의의 기존 서버/공인 IP나 비용 없는 Cloud NAT를 가정하지 않는다.

## 4. Cloud Run Job 키 보호 상세 순서 — 후속 승인 필요

1. Cloud Console에서 **프로젝트 선택 상태**와 YouTube Data API v3 활성화, 현재 일일 Quota/사용량을 비밀 제외 증거로 연결한다. 현재 사용자가 표시한 `Manage/사용중지`, `Queries per day=10,000`, 사용량 0은 **화면 근거**이고 프로젝트 ID가 그 화면에 함께 표시된 증거는 아직 없다.
2. 수집 목적 및 원문 저장/삭제 정책, 기본 YouTube API 이용 적합성 `Y45-E05/E07/E08` 검토. 감성 지표는 별도 `Y45-E06` 승인 전 실행 불가.
3. 비용이 있는 Cloud Run/Network/NAT/Secret Manager/IAM 생성 작업별 비용·삭제 방법에 대해 별도 승인한다.
4. 승인 후 고정 공인 egress IP와 Cloud NAT 경로를 구성하고, 런타임 서비스 계정에 **필요 Secret만** 읽을 권한을 부여한다.
5. 승인 후 API 제한 `youtube.googleapis.com`과 **고정 공인 출구 IP** 제한을 갖는 키를 생성하고 Secret Manager에 저장한다. 키 문자열을 화면·GitHub·ChatGPT·로그에 붙이지 않는다.
6. API 실호출 전에 **비-YouTube 경로의 소스 IP 확인** 등으로 실제 출구 IP가 제한 주소와 일치하는지 검증한다(이 진단도 실행·비용 승인 뒤). IP 제한을 맞추기 위해 잠깐 무제한 키로 만드는 우회는 금지한다.
7. 사용자에게 정확한 영상 IDs·최대 API 횟수/예상 quota·원문 처리/폐기·이상 발생 시 중단을 제시하고 **최초 실호출을 별도 명시적으로 승인**받는다.
8. 정책·비용·보안·원문 수명주기 Gate를 모두 통과한 뒤에만 수동 실행, 구체적 결과를 비식별화해 정제 검수한다.

**불허 조건:** 키/IP 제한 불가, 리소스 비용 미승인, 실제 Google 프로젝트/소유권 미확인, `POLICY_HOLD`, 원문 보존·삭제 경로 미구현, OAuth나 민감자료를 임의로 요구하는 API, 크롬/프런트엔드로 키 전달. 모두 실행 0, 추가 확인 후 재검토.

### 인프라 예상 비용 검수 (추가 승인 필요)

Google 공식 2026-11-02 Cloud Run Jobs/Cloud NAT/외부 IPv4/Secret Manager 단가로 **단발 1회 및 월 30회** 시나리오를 추정했다. 지속 NAT 연결 공인 IP 1개가 720시간 동안 **$3.60/월**, NAT 분리 후 미사용 예약 IP라면 **$7.20/월**에 달할 수 있어 Job 자체보다 IP 잔류 여부가 중요하다. 월 30회 경량 Job+단일 NAT IP는 모델의 제한된 항목만 합계 **약 $3.68~$4.69**, 인터넷 송신/빌드/세금 등 추가 요금은 제외. 모든 값은 **견적 가정**이며 지역·실제 엔드포인트 과금·무료 구간 검증 전까지 자원 생성/비용 승인이 아니다. [상세 비용 검토](./YU32_G4_5_CLOUD_RUN_COST_ESTIMATE_V01.md).

## 5. G4-5 / G44 수용 증거 분리

- **Track A (G45):** 제공자 프로젝트·정책/동의·감성 파생 지표·키·할당량·수명주기·첫 수동 실호출 권한. `Y45-E01~E12` 문서/정적 테스트 ≠ 실제 승인.
- **Track B (G44):** 현재 Draft PR #46은 Worker crash/Outbox 합성 PostgreSQL 검증. 실제 OAuth, HTTP 인가, YouTube 데이터 사용권, 영속 원문 삭제를 증명하지 못한다.
- **현재 PR:** Draft #47의 **설계·오프라인 계약 확장**만. 기존 백엔드와 `frontend`, PR #46에는 변경 없음. 실제 API 키·Secret·IAM·Cloud Run Job·VPC·Cloud NAT·리소스 생성 0.
- **후속 가장 작은 결정:** ① 클라우드 자원과 고정 IP 기반 키 제한 비용 승인, ② 기본 이용 정책/수명주기 승인, ③ 첫 실호출 정확한 경계 승인. 모두 아직 대기.

## 6. 확인한 공식 문서 (2026-11-02)

- Google Cloud API 키 제한: https://docs.cloud.google.com/docs/authentication/api-keys
- API 키 IP 제한 상세: https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys
- Cloud Run static outbound IP: https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip
- Cloud Run Jobs Direct VPC egress: https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc
- Cloud Run Jobs Secret Manager: https://docs.cloud.google.com/run/docs/configuring/jobs/secrets
- YouTube commentThreads.list: https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list
- YouTube 2026 파생지표/보관: https://developers.google.com/youtube/terms/derived-metrics-policy

**최종 판정:** `BACKEND_ONLY_DIRECTION_APPROVED / CLOUD_RUN_JOB_ARCHITECTURE_PROPOSED / API_KEY_NOT_CREATED / CLOUD_COST_NOT_APPROVED / LIVE_COLLECTION=0 / POLICY_HOLD`.
