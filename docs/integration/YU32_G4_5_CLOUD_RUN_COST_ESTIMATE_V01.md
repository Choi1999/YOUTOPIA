# YOUTOPIA — G4-5 Cloud Run / NAT / 정적 외부 IP 비용 검토 v0.1

> **상태:** COST_RESEARCH_COMPLETE / ESTIMATE_NOT_BILL / CLOUD_SPEND_NOT_APPROVED / CLOUD_RESOURCES_CREATED=0 / POLICY_HOLD
> **가격 확인일:** 2026-11-02 KST · **통화:** USD (부가세·환율 제외)
> **기준:** `frontend@6cce815ef6bb6f32f5733bd0a11fe46815e8d4ee` / G4-5 Draft PR #47
> **아키텍처:** [G4-5 서버 전용 Collector 설계](./YU32_G4_5_SERVER_COLLECTOR_HOSTING_SECURITY_V01.md)
> **계산 근거:** [machine-readable cost model](../../shared/contracts/yu32-youtube-readiness-v0/cloud-cost-model.v01.json) · 오프라인 테스트 `tests/cloud-cost.test.cjs`
> **승인 경계:** 기존 승인에는 조사·산정·설계·Draft PR 수정만 포함. **Google Cloud 리소스 생성, 예산 설정, 결제 활성화, API 키 발급, 실제 댓글 수집, 배포 또는 PR 병합은 불포함.**

## 0. 최초 PoC: Windows 로컬 우선 결정 (2026-11-02)

이 문서의 Cloud Run/NAT/고정 IP 추정치는 **L3 선택적 운영 확장 비용**이다. 초기 L0/L1의 공개 영상 1~3개 시험을 위해 유료 클라우드 자원을 생성할 필요는 없다. [Windows 로컬 PoC](./YU32_G4_5_WINDOWS_LOCAL_BACKEND_POC_V01.md)를 현재 우선 설계로 적용한다. 실제 데이터 수집·키 생성·정책·삭제 검증은 별도 승인 대상이다.

## 1. 공식 단가·무료 구간 (2026-11-02 검토)

| 항목 | 요금 기준 (USD) | 주요 제한과 해석 |
|---|---:|---|
| Public Cloud NAT 게이트웨이, 인스턴스 32개 이하 | **$0.0014 / NAT에 할당된 인스턴스·시간** | Cloud Run 실제 NAT 과금 엔드포인트 시간의 확인 필요 |
| Public Cloud NAT 데이터 처리 | **$0.045 / GiB** | 송·수신 처리량, 인터넷 방향 egress 요금 **별도** |
| NAT에 연결된 외부 IPv4 | **$0.005 / IP·시간** | 한 개를 30일=720h 유지하면 **$3.60** |
| 예약만 된 미사용 IPv4 | **$0.01 / IP·시간** | 720h 예약 미사용 시 **$7.20** |
| Cloud Run Jobs (Seoul Tier 2 후보, 약정 없는 모델 계산 단가) | **$0.0000216 / vCPU·초**, **$0.0000024 / GiB·초** | 지역·계정 SKU에 따라 확인 필요. `us-central1` 기본 예시 단가와 구분 |
| Cloud Run Jobs 무료 구간 | 공개 표의 `us-central1` 기준 월 CPU **240,000 vCPU·초**, 메모리 **450,000 GiB·초** | 지역별 무료 크레딧 환산·계정 전체 사용량에 종속; **보장하지 않음** |
| Secret Manager | 무료 월 **활성 버전 6개**, 접근 **10,000건** | 초과 활성 버전 약 **$0.06/월**, 추가 접근 10,000건당 **$0.03** |
| Logging 일반 로그 저장 | 월 프로젝트당 처음 **50 GiB 무료**, 초과 **$0.50/GiB** | 로그·원문/키가 절대 남지 않도록 별도 필터 필요 |

출처(공식):
- Cloud Run Jobs 가격 및 최소 청구시간: https://cloud.google.com/run/pricing
- Cloud NAT 단가: https://cloud.google.com/nat/pricing
- NAT/예약 IPv4 가격 차이: https://cloud.google.com/vpc/network-pricing
- Secret Manager: https://cloud.google.com/secret-manager/pricing
- Cloud Logging: https://cloud.google.com/logging
- Job 자동 재시도 설정: https://docs.cloud.google.com/run/docs/configuring/max-retries

**중요:** 위 Cloud Run 서울 Tier 2 수치는 견적 계산을 위한 지역별 예시 단가다. 공식 요금표가 기본 `us-central1`을 표시할 수 있으므로, **자원 생성 전** 실제 Cloud Billing SKUs/Google Cloud 가격 계산기에서 선택 지역/과금 통화/기존 사용량을 독립 확인해야 한다.

## 2. 비교 시나리오·수식

가정: Google Cloud 지역은 **후보만** `asia-northeast3`(서울), 단일 수동 Cloud Run Job, **1vCPU + 0.5GiB**, 실행당 **120초**, 최대 1회 병렬, Google Cloud 기본 Task retry=3을 명시적으로 **maxRetries=0** 후보로 제한. 실제 실행시간·호출 크기·지역은 **미측정**. 원문/작성자 저장·NLP·SnapShot 발행 없음. YouTube API 사용 3회/Job은 quota 3units **계획값**이며 Cloud 인프라 USD 비용과 혼동하지 않는다.

`Cloud Run Jobs gross = 실행횟수 × 실행초 × (1vCPU × $0.0000216 + 0.5GiB × $0.0000024)`.

`Public NAT 부분원가 = 할당 엔드포인트 시간 × $0.0014 + 처리 GiB × $0.045 + IP 연결 시간 × $0.005`.

NAT 게이트웨이의 VM 기준 과금표를 **단일 Cloud Run 인스턴스 유사 과금 가정**으로 적용한 것이므로 실제 서버리스 엔드포인트 사용량·청구 SKU는 과금 내역으로 재확인해야 한다. 아래 합계는 **표시 항목만의 부분합**이고 전체 청구서 상한이 아니다.

| 시나리오 | Cloud Run Jobs (무료 전) | NAT 처리/게이트웨이 (가정) | NAT용 IP | 부분 합계 (USD) |
|---|---:|---:|---:|---:|
| A. 단발 1회, 인프라 1시간 유지 후 자원·예약 IP 삭제, 트래픽 1MiB | $0.002736 | $0.001444 | $0.005 | **약 $0.0092** |
| B. 월 30회 × 2분, IP 720시간 유지, NAT 할당시간 총 1시간, 트래픽 10MiB | $0.08208 | $0.001839 | $3.60 | **약 $3.684/월** |
| C. 월 30회, IP 720시간 유지, **1개 NAT 과금 엔드포인트를 720시간 계속 사용한다고 가정**, 10MiB | $0.08208 | $1.00844 | $3.60 | **약 $4.691/월** |
| D. 예약 IP만 NAT 연결 없이 720시간 보관 | $0 | $0 | $7.20 | **$7.20/월** |

**예상 청구액이 아님:** A~C는 **무료 등급 차감 전 Cloud Run 컴퓨트 비용**을 포함한다. 계정의 잔여 무료 구간이 충분하면 해당 컴퓨트 비용이 줄어들 수 있다. 네트워크 인터넷 송신 비용·Cloud Build/Artifact Registry·Cloud Router 관련 가능 요금·추가 저장소/로그·세금·환율·오류 재시도/추가 요청은 **계산 합계에서 제외**했다. NAT 요금 모델을 실측하지 않았으므로 B가 항상 청구된다고 단정할 수 없다.

**운영 주의:** A처럼 예약 IP까지 완전 삭제하면 다음 실험에서 같은 IP가 다시 할당되는지 보장되지 않으며, API 키의 IP 허용 목록을 다시 검증/수정해야 한다. 지속적으로 고정 IP를 유지하면 Job이 실행되지 않는 시간에도 IP 요금은 발생한다. 'Cloud Run만 사용하면 거의 무료'라는 표현은 전체 고정 IP 기반 설계에 해당하지 않는다.

## 3. 비용·보안 대안 비교

| 선택 | 장점 | 단점 | 판단 |
|---|---|---|---|
| A. 승인받은 단발 테스트 후 네트워크·IP 완전 삭제 | 월 고정비 축소 | 다음 사용 시 IP/키 제한·네트워크 재검증 필요; 삭제/과금 종결 증거 필요 | 최초 PoC에 합리적 **후보** |
| B. 수동 Cloud Run Job + 한 개 고정 NAT IP 지속 유지 | 반복 실험 시 IP 안정성·허용목록 유지 | IP 월 약 $3.60 + NAT/기타 요금; 유휴 리소스 누적 위험 | 제한적 반복 PoC 후보 |
| C. 이미 보유한 전용 고정 IP의 승인된 백엔드 서버 사용 | 신규 NAT/IP 리소스를 줄일 여지 | 기존 서버/인증·네트워크·분리된 키 저장·권한 증거 없음 | 서버가 확인될 때에만 재평가 |
| D. Cloud Run 기본 동적 출구 IP + 제한 없는 API 키 | 네트워크 구성이 단순 | 서버 IP 허용 목록 통제가 깨짐 | **현재 권장 불가** |

**권장:** 최초에는 **추가 비용을 발생시키지 않는 정적 설계·오프라인 계약 검증만 계속**하고, 최초 실호출과 비용이 별도로 승인된다면 **단발 자동 정리형 A**를 1순위 검토한다. 다만 삭제 후 IP 재사용 불가에 따른 키 보안/운영부담을 수용할 수 있는지 확정한다.

## 4. 유료 자원 생성 전 비용 Gate

1. Cloud Console에서 프로젝트/결제 계정 연결 여부, 실제 비용 통화 및 Cloud Run Jobs **지역별 단가**와 Cloud NAT의 **Cloud Run 인스턴스 과금 동작**을 확인한다. 실제 요율을 문서에 갱신한다.
2. 월 1회 단발과 월 30회 반복 중 목표를 명시하고 **월 예산 및 단발 집행 상한**을 별도 승인한다. 예상치 `$3.684`를 자동 결제 승인으로 간주하지 않는다.
3. 과금 계정이 있다면 **월 $10의 알림 예산**을 *제안*한다(50%, 90%, 100% 경보). **등록하지 않는다.** 일반 알림 예산은 비용 상한이 아니고 경보 지연·오차가 있다.
4. 서비스별 일부 **spend cap** 지원 여부를 확인한다. Google Cloud 문서에서 Cloud Run은 대상 서비스 중 하나이나 **NAT/IP는 같은 Cloud Run 한도에 포함되지 않는다**. 따라서 별도 유료 리소스의 비용을 보장해서 막지는 못한다.
5. Cloud Run Job은 Task count=1, parallelism=1, maxRetries=0, timeout 제한, 스케줄 OFF, 공개 서비스 OFF. 실제 배포/네트워크 구성은 다음 승인이 있을 때만.
6. Cloud NAT manual static IP, egress `all-traffic`, 해당 Job의 서비스 계정/Secret 접근 범위, 별도 API 키의 `youtube.googleapis.com` API 제한과 고정 출구 IP 애플리케이션 제한을 함께 검증한다.
7. 자원 삭제 체크리스트: Cloud Run Job·Secret 버전(회수/파괴)·API 키 폐기·NAT/Cloud Router·예약 IP·테스트용 VPC/subnet·Artifact Registry 이미지는 **다른 사용자 자원과 구분하여** 범위 확인 후, 사용자 별도 승인으로 제거한다. Cloud NAT 제거 후 IP가 미사용 예약 상태로 남는지 확인한다.
8. 최초 실제 YouTube 호출은 **별도 권한/원문 수명주기 Gate(Y45-E05/E07/E08/E11) 통과 + 사용자 명시 승인** 뒤에만 시행한다. 파생 감성 지표는 `Y45-E06` 별도 승인.

공식 비용 경보/상한 출처:
- https://docs.cloud.google.com/billing/docs/how-to/budgets
- https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
- https://docs.cloud.google.com/run/docs/configuring/max-retries

## 5. 미검증·미승인 현황

- Console 화면에서 API 활성·기본 `Queries per day=10,000`·0 사용량, 자격증명 0개 관측됐으나 **같은 프로젝트 ID가 해당 화면에 직접 표시되는 증거는 없음**.
- 정확한 Google Cloud 결제 계정·예상/실제 지역·통화/세금·무료 크레딧·Cloud NAT 실제 서버리스 과금 엔드포인트·고정 출구 IP·보안 승인 **미확인**.
- `Y45-E01~E12`의 프로젝트/제공자 준수·보존/삭제 Gate는 증거가 부족하므로 **verifiedCount=0 유지**. 사용자가 아키텍처 비용 *검토*를 승인했다고 실제 발생 비용을 승인한 것은 아님.
- Google Cloud 계정에서 Cloud Run/Cloud NAT/VPC/Secret Manager/API 키/비용 예산 생성 **0건**. 실댓글/파생 감성/운영 DB 저장/배포/PR 병합 **0건**.

**최종 판정: COST_ESTIMATE_DRAFT / 월 약 $3.68~$4.69는 제한적인 가정의 부분합, 전체 비용 상한 아님 / RESOURCE_CREATE=0 / SOURCE_POLICY_HOLD / LIVE_API=0.**
