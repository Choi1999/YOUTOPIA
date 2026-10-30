# YOUTOPIA — YU-32 분석 가용성·캐시·작업 스케줄링 v0.1

**상태:** SYNTHETIC_EXPERIMENT / STAGES_1_TO_3_VERIFIED / AUDIT_FIXES_PENDING_CI / NOT_PRODUCTION_READY
**기준 브랜치:** frontend
**감사 기준 커밋:** 53454762b3607360b3d51746df06d257039a5216 (`frontend`)

## 1. 목적

YouTube 홈의 추천 영상이 매일 달라지더라도 분석 결과를 안정적으로 재사용하고, 새로운 영상에 대해서는 사용자의 명시적인 분석 요청을 통해 작업을 시작할 수 있는 구조를 설계한다.

기존 분석 조회와 신규 분석 실행은 별개의 동작이다.

## 2. 승인된 UX 원칙

| 조건 | 처리 |
|---|---|
| 검증된 분석 결과 존재 | Hover 즉시 표시 |
| 분석 결과 없음 | 미분석 안내 |
| 분석 요청 자격 확인됨 | 이 영상 분석 요청 버튼 |
| 분석 작업 대기·진행 | 작업 상태 안내 |
| 댓글 데이터 없음 확인 | NO_DATA 표시 |
| 정책·권한 차단 | 분석 요청 불가 |
| 데이터 갱신 기준 초과 | STALE 표시 및 조건부 갱신 요청 |

더보기 버튼은 기존 Side Panel 대상 고정 기능으로 유지한다.

## 3. 합성 실험 모델

실험 위치: `shared/experiments/coverage-scheduler-v0/`

실험 엔진은 분석 스냅샷 참조, 캐시 최신성, 작업 상태, 중복 요청, 가상 예산만 관리한다.

실제 YouTube 댓글이나 감성 분석 결과를 생성하지 않는다.

기본 SAFE 모드에서는 신규 분석 실행을 차단한다.

명시적 QA_SYNTHETIC 모드에서만 데모 분석 요청과 Job 상태 전이를 시뮬레이션한다.

## 4. 캐시 계약

논리 캐시 키는 source, targetType, targetId, analysisSpecVersion, observationWindowId, samplingPolicyVersion, locale, visibility, tenantId의 조합으로 정의한다.

공개 재사용 가능 데이터와 테넌트 비공개 데이터의 캐시 경계를 분리한다.

MISS는 분석 결과가 저장되지 않은 상태이고, NO_DATA는 지정된 분석 범위에서 자료 없음이 확인된 결과다.

STALE 상태에서는 과거 분석의 시각을 유지할 수 있지만, 현재 분석 수치를 최신 결과처럼 표시하지 않는다.

TTL 24시간은 실험 기본값이며 실제 운영 갱신 정책이 아니다.

## 5. 작업 스케줄링 계약

Hover는 Job을 생성하지 않는다.

사용자의 명시적 요청과 요청 가능 조건을 모두 충족해야 Job을 생성한다.

동일 분석 범위의 활성 Job이 있으면 신규 생성 대신 기존 Job에 합류한다.

작업 상태는 QUEUED, RUNNING, SUCCEEDED, FAILED로 구분한다.

현재 실험의 Job은 메모리 기반이며, Worker 재시작이나 서버 장애 후 영속 복구를 제공하지 않는다.

## 6. 외부 정책 및 권한

기본 Guest 조회 방향은 유지한다.

실제 분석 요청의 권한·사용량·테넌트 접근은 향후 운영 서버에서 검증한다.

데모의 requestAllowed 값은 운영 승인이나 YouTube 이용 허가가 아니다.

실제 댓글 수집, 파생 감성 분석, 외부 API, 자동 분석 작업은 별도 정책 및 기술 게이트가 통과할 때까지 비활성화한다.

## 7. 검증 범위

합성 실험은 최초 C01~C13으로 검증됐고, 감사 보완에서 C14~C15(실패·할당량)를 추가한다.

검증 대상은 캐시 재사용, MISS, 명시적 클릭, 중복 제거, 예산 제한, STALE, Job 완료, 테넌트 격리, NO_DATA, 분석 정의 구분, 출처 거부, 반복 Hover, 대상 불일치이다.

Node 테스트 통과는 운영 백엔드, 분산 작업 중복 방지, 실측 성능 또는 YouTube API 사용권의 검증을 의미하지 않는다.

## 8. 후속 작업

YU-32 1~3단계의 합성 계약, Hover 카드 QA UI 및 검증된 완료 스냅샷 연결은 Node 테스트로 검증했다. 실제 Chrome QA/운영 승격은 별도 게이트로 유지한다.

실제 고객용 분석 요청 버튼은 서버 측 요청 자격과 작업 API가 구현·검증된 이후 활성화한다.

기존 Hover Summary v1 메시지 계약과 YU-27·YU-28 기능은 별도 승인 없이 변경하지 않는다.

## 9. YU-32 2단계 — Hover 분석 요청 UI 통합

- NOT_FOUND 상태의 VIDEO Hover 카드에 요청 상태 영역을 제공한다.
- 일반 Chrome 실행에는 분석 요청 기능 준비 중 안내만 표시한다.
- QA_SYNTHETIC 브리지가 주입된 개발·테스트 환경에서만
  데모 분석 요청 버튼을 활성화한다.
- QA 요청은 신뢰된 사용자 클릭과 현재 Hover 대상 일치를 확인한다.
- Hover 자체는 합성 분석 Job을 생성하지 않는다.
- QUEUED/RUNNING 상태는 합성 작업 상태이며 실제 분석이 아니다.
- 기존 더보기, Side Panel PIN, Hover Controller 동작은 유지한다.
- QA 브리지는 extension/manifest.json에 등록하지 않는다.
- 운영 API, 실제 YouTube 댓글, 인증, 결제, 추가 Chrome 권한은
  이번 단계에서 연결하지 않는다.

QA 버튼이 실제 Chrome 사용자에게 제공되는 기능으로
승격되려면 별도의 제품·보안·백엔드·정책 게이트가 필요하다.

## 10. YU-32 3단계 — QA 완료 Snapshot 연결

- QA Job은 RUNNING 이후에만 완료될 수 있다.
- Job SUCCEEDED만으로 감성 수치를 표시하지 않는다.
- 완료된 캐시의 snapshotId와 합성 Fixture의 ID가 일치해야 한다.
- 기존 Hover Summary v1의 makeResponse 및 parseResponse 검증을 통과해야 한다.
- Worker NOT_FOUND 상태에서만 QA 완료 결과를 보조적으로 표시한다.
- Worker READY, REJECTED, 정책 차단, 전송 오류를 QA 결과로 덮어쓰지 않는다.
- 캐시 STALE 전환 시 기존 감성 수치를 숨긴다.
- 새로운 requestId로 동일 영상에 재진입하면 현재 유효한 합성 캐시를 재사용한다.
- 다른 영상의 합성 Fixture를 임의로 복제해 완료 처리하지 않는다.
- QA 브리지는 테스트에만 존재하며 Manifest에는 등록하지 않는다.
- 해당 기능은 오프라인 합성 테스트이며 실제 분석 완료를 의미하지 않는다.
- 현재 메모리 캐시는 탭·페이지 종료 및 프로세스 재시작 후 영속 복원되지 않는다.

실제 운영 데이터 연결에는 백엔드 영속 저장, 스냅샷 정합성,
권한, 출처·보존 정책 및 별도의 데이터 사용 승인이 필요하다.

## 11. 로컬 검증

```powershell
cd C:\Projects\YOUTOPIA

node --check extension/hover-card.js
node --check extension/tests/hover-card-ui.test.cjs

node --test extension/tests/hover-card-ui.test.cjs
node --test extension/tests/*.test.cjs

node --test shared/experiments/coverage-scheduler-v0/tests/engine.test.cjs
node --test shared/contracts/analysis-v1/tests/*.test.cjs

git diff --check
git status --short
```

예상 테스트 건수는 다음과 같습니다.

| 대상 | 예상 |
|---|---:|
| Hover 카드 UI | 72 |
| 확장 전체 회귀 | 296 |
| YU-32 합성 엔진 | 15 |
| 공유 분석 계약 | 19 |

**기준선 실측:** Hover UI 70/70, 확장 294/294, 엔진 13/13, 공유 계약 19/19. 위 표는 이번 감사 수정 후 **목표치**이며 PR CI/로컬 재검증이 필요하다.

### 완료 기준

이번 단계에서 Chrome 일반 실행은 기존과 동일하게 동작하고, 미분석 영상에는 준비 중 안내만 추가됩니다. QA 버튼의 활성화·클릭·작업 상태 전이는 우선 Node Fake DOM에서 검증합니다.

별도의 실제 Chrome QA 전용 빌드 활성화는 그다음 작업으로 분리합니다. 이 구분을 유지해야 테스트용 분석 요청 기능이 실사용자에게 잘못 노출되는 일을 방지할 수 있습니다.

**현재 판정:** YU-32 1~3단계의 기존 기준선 자동 테스트 완료. 감사 수정은 별도 브랜치 및 PR 검증 대상이며, 실사용자용 분석 요청은 여전히 비활성화 상태다.

## 12. 감사 보완 — STALE/FAILED 상태 및 CI

- 스케줄러가 `STALE`에 `DEMO_REQUEST/enabled=true`를 반환하면 QA Hover 카드에 **데모 갱신 요청** 버튼을 표시한다.
- `FAILED`는 활성 Job 종료 후에도 가장 최근 종료 상태에서 식별한다. 이후 새로운 Job이 성공하면 이전 실패가 현재 상태를 덮어쓰지 않는다.
- 요청 권한 또는 가상 예산이 없으면 실패·만료 안내는 남기되 실행 버튼은 제공하지 않는다.
- `STALE`·`FAILED`·`MISS`의 버튼은 각각 최신 상태와 일치해야 하며, 신뢰된 명시적 클릭만 합성 Job을 시작할 수 있다.
- 캐시가 `STALE`이면 합성 감성 수치 표시를 계속 차단한다. 테스트용 갱신 Job을 생성하더라도 실제 댓글 수집은 수행하지 않는다.
- 기존 Chrome Manifest, 실제 Worker Summary 응답, Side Panel PIN·Preview 메시지 계약을 변경하지 않는다.
- GitHub Actions는 확장/공유 계약 Node 테스트와 프런트엔드 Vitest·빌드를 별도 Job으로 검증한다. 브라우저 Playwright 및 실제 YouTube는 이 CI에 포함되지 않는다.
- 운영 배포·권한·실데이터·백엔드 영속성은 이번 감사 수정의 범위 밖이다.

### 증거 구분

- **기준선 통과:** YU-32 3단계 이전 커밋에 대한 사용자의 Windows Node 테스트 로그.
- **감사 수정 목표:** Hover UI 72/72, 확장 296/296, 스케줄러 15/15, 분석 계약 19/19.
- **미검증:** 원격 PR CI의 실제 실행 결과와 Chrome 수동 QA. 결과가 확인되기 전에는 완료 처리하지 않는다.
