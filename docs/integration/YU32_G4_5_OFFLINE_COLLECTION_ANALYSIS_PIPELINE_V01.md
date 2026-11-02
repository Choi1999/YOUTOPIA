# YOUTOPIA — YU-32 G4-5 오프라인 수집·분석 수직 슬라이스 구현 v0.1

> **상태:** SYNTHETIC_PIPELINE_IMPLEMENTED / REAL_SOURCE_NOT_IMPLEMENTED / REAL_ANALYSIS_NOT_APPROVED / POLICY_HOLD
> **작성일:** 2026-11-02 KST · 기준 `frontend@6cce815ef6bb6f32f5733bd0a11fe46815e8d4ee`
> **관련:** [G4-5 Windows 로컬 수집 준비 PR #47](https://github.com/Choi1999/YOUTOPIA/pull/47) · [G44 Worker 수용 PR #46](https://github.com/Choi1999/YOUTOPIA/pull/46)
> **코드:** [오프라인 파이프라인 README](../../shared/experiments/yu32-g45-offline-pipeline-v0/README.md)

## 1. 목표와 범위

최초 실데이터 분석까지의 개발 시간을 줄이기 위해, **제공자 승인을 기다리는 동안 오프라인으로 검증 가능한 최소 수직 슬라이스를 먼저 구현**한다. 코드는 YouTube Data API의 공식 `commentThreads.list(part=snippet)` JSON 외형과 합성 데이터를 사용하지만 **네트워크 코드·실데이터·실제 감성 모델·자격증명은 구현하지 않는다**. 이 결과는 정책 승인이나 운영 서비스 준비완료를 증명하지 않는다.

## 2. 지금 실행할 수 있는 흐름

`번들 합성 응답 JSON → 스키마/Scope/시간/중복/공개 상태 검증 → 메모리 상의 대상 윈도 샘플 → 테스트 전용 텍스트 신호 분류(불확실 시 abstain) → Count 기반 topic/sentiment 집계 → analysis-v1 후보 Snapshot 및 출처/부분성 증거 → stdout의 정제된 JSON`

| Stage | 불변식 | 독립 증거 |
|---|---|---|
| Input | 정규 VIDEO ID 11자, 성공 응답 종류 확인, 페이지당 ≤100, 출처 STATIC_FIXTURE | 무효 ID·pageInfo·개별 스레드 불일치 거부 |
| Privacy | author/프로필/원문/페이지 토큰을 최종 출력에 복사하지 않음 | CLI stdout 부정 검사 |
| Time/scope | 날짜·관측 시각/창 검증, 범위 밖 결과 제외 | 분모 raw/eligible/excluded 일치 |
| Sentiment | 합성 사전 기반 **toy** 분류, 충돌/모호함 = unclassified | positive+neutral+negative = classified |
| Topics | 여러 topic을 언급할 수 있으므로 합계 100% 강제 안 함 | topic classified/negative 분모 일치 |
| Quality | nextPageToken 있어도 후속 페이지 자동 요청 X, 답글 전수 수집 X | PARTIAL / samplesOnly / topLevelOnly |
| No data / errors | 성공한 빈 페이지와 commentsDisabled / quota / permission 오류를 분리 | NO_DATA는 sentiment=null, ERROR에서도 가짜 0% 금지 |
| Provenance | `sourceType=STATIC_FIXTURE`, `isSynthetic=true`, providerRequestsMade=0 | APPROVED_PROVIDER 위조 입력 차단 |
| Distribution | QA용 JSON만; API/브라우저 Snapshot·운영 DB 저장 0 | 기존 Spring Security / G44 변경 없음 |

### 관리자 전용 수동 삭제 + 필수 자동 만료 (2026-11-02 승인 방향)

사용자는 YOUTOPIA의 **영상별 수집·분석 데이터 수동 삭제를 인증된 관리자만 할 수 있도록** 요청했다. 사용자 관련 삭제 요구 및 보존 기한 만료/원본 소스 철회에 따른 자동 처리는 **관리자 로그인 없이도** 정책상 기한 내 수행해야 한다. [관리자 삭제·보존/요청 계약](./YU32_G4_5_ADMIN_DELETION_RETENTION_CONTRACT_V01.md)에 따라 tenant+VIDEO, preview/확인/revision/UUID/감사, 원문·Snapshot·캐시·색인·Job/Outbox·복구펜스 삭제를 추적한다. 이번 PR에는 **합성 메모리 시뮬레이터와 회귀 테스트만** 추가. 실제 관리자 API/UI/DB 삭제는 미구현이며 Y45-E07/E08은 계속 미통과다.

## 3. 다음 개발 단계 — 실제 수집 전까지 병렬화

1. **기능 게이트와 API 계약 (Track A):** PR #47의 Google 프로젝트/소유/키 제한·quota·공개 댓글 기본 이용 조건/원문 삭제·철회·추가 파생지표 승인 증거를 검증한다. `Y45-E05/E06/E07/E08/E11`은 미통과, 정책 미승인은 실제 데이터 사용 금지.
2. **수집 Adapter 구현 준비 (Track B):** 현재 parser의 최종 실데이터 계약 적합성을 평가하고, 이후 별도 승인된 브랜치에서 로컬 수동 단일 HTTP GET, 비밀정보 저장소·공인 IP 제한, 1~3 VIDEO/페이지 1/최대 3 요청/자동 retry 0·raw log 0를 구현한다. **본 PR은 네트워크 요청을 포함하지 않는다.**
3. **실제 분석 모델 (Track C):** 감성·주제 모델 선정/평가와 데이터셋 라벨 정의를 **합성·사용권 승인된 오프라인 자료**로 설계한다. 감성 분석 사용 사례 승인 전 YouTube 실댓글로 지표를 계산하거나 발표하지 않는다. 현재 toy 사전은 성능 벤치마크의 대안이 아니다.
4. **출처/보관/공개 (Track D):** 실제 원문 최소화·30일 갱신/삭제, 별도 파생 지표 보관 조건, provenance+denominator 검증, 매 요청 재인가, `NO_DATA/STALE/POLICY_BLOCKED` 분리 및 캐시 철회가 완료된 뒤에만 서비스 Adapter 검토.
5. **안정성 (Track E):** G44 #46 Worker·Outbox PASS는 합성 DB 실험이다. 운영 서버 인증/CSRF/BOLA/정산/SQLSTATE 재시도·복구 펜스를 독립 수용하고, 실제 API 사용권의 자동 승인으로 간주하지 않는다.

**최소 수용 기준:** 새 기능 PR 정적 CI PASS, Windows Node 24 CLI에서 --check / --demo partial|ready|empty PASS, 부정 테스트 PASS, 비밀·원문 출력 0, 실제 provider call 0. 최초 실제 수집 실행은 새 사용자 명시 승인 필요.

## 4. 외부 명세 및 정책 근거

- [commentThreads.list (1 quota unit, first-page semantics)](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list)
- [commentThread resource (topLevelComment, replyCount, reply subsets)](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads)
- [2026 추가 파생 지표·보관 규정](https://developers.google.com/youtube/terms/derived-metrics-policy)

**최종 판정:** 합성 데이터로 파이프라인 개발 선행 완료 목표. 실제 댓글 수집·실데이터 감성 분석·NLP 승인·API 키·서버 운영·원문 영속 저장·PR 병합 모두 미실행 / POLICY_HOLD.
