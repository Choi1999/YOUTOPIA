# YOUTOPIA — G4-5 제공자 승인·보관/삭제 증거 매트릭스 v0.1

> **현재 상태:** EVIDENCE_REQUIRED / VERIFIED=0_OF_12 / LIVE_ACCESS_NOT_APPROVED / POLICY_HOLD
> **작성 기준:** 2026-11-02 / frontend@6cce815ef6bb6f32f5733bd0a11fe46815e8d4ee
> **정본 설계:** [G4-5 준비 Gate](./YU32_G4_5_YOUTUBE_SOURCE_READINESS_V01.md)
> **보안:** GitHub 문서에 실제 API 키, access/refresh token, 댓글/작성자 원문, 비밀 파일 또는 민감한 승인 스크린샷을 넣지 않는다.

## 1. 검증해야 할 증거 12건

| ID | 분류 | 실제 확인·보존할 비밀 제외 근거 | 현재 | 차단 범위 |
|---|---|---|---|---|
| Y45-E01 | 프로젝트 소유 | Google Cloud 프로젝트 소유/책임자, 프로젝트 식별자 | UNVERIFIED | 실호출 |
| Y45-E02 | API | 해당 프로젝트 YouTube Data API v3 활성화·허용 인증 방식 | UNVERIFIED | 실호출 |
| Y45-E03 | 자격증명 | API 키 제한, 저장/회전/유출 대응, 로그 마스킹 | UNVERIFIED | 실호출 |
| Y45-E04 | Quota | 실제 일일 쿼터/사용량, 최초 호출 상한, 실패·재시도 예산 | UNVERIFIED | 실호출 |
| Y45-E05 | 기본 준수 | TOS·개발자 정책, 수집 목적/공개·개인정보, 제공자 심사 필요 여부 | POLICY_HOLD | 실호출 |
| Y45-E06 | 파생 지표 | 2026 추가 조항 수락, 감사·신청·사용 사례 승인(해당 프로젝트/범위) | POLICY_HOLD | NLP/파생 지표 |
| Y45-E07 | 원문 수명주기 | 30일 갱신/삭제, 보관 최소화, 수정/삭제/철회 반영·로그 증거 | NOT_IMPLEMENTED | 실호출·영속 저장 |
| Y45-E08 | 사용자 삭제 | 적용 시 7일 이내 요청 처리, 캐시/백업 전파·감사 기록 | NOT_IMPLEMENTED | 실호출·영속 저장 |
| Y45-E09 | 서버 보안 | AuthN, CSRF, tenant BOLA, role/entitlement, rate-limit | NOT_IMPLEMENTED | 운영 Job/API |
| Y45-E10 | 결과 안전 | provenance·분모·샘플 품질·관측 시각·NO_DATA/STALE 분리 | NOT_IMPLEMENTED | 분석/결과 공개 |
| Y45-E11 | 최초 수동 PoC | 허용 영상·횟수/쿼터·작업자·보존/폐기·사용자 명시 승인 | NOT_APPROVED | 실호출 |
| Y45-E12 | 운영 출시 | 보안·비용·약관·개인정보·삭제 검수/배포 승인 | POLICY_HOLD | 서비스 출시 |

## 2. 서로 다른 승인 분기

- **R0 문서/오프라인 준비:** 이 Draft PR 제출·검수. 외부 호출 0.
- **R1 프로젝트 적격성:** E01~E04 실제 증거 검토. 아직 외부 호출 금지.
- **R2 공개 댓글 소량 읽기:** E01~E05/E07/E08/E11 준수·구현·별도 최초 API 호출 승인 후 제한적 PoC 검토. 공개 댓글이라고 무조건 수집 가능한 것은 아니다.
- **R3 파생 감성 분석:** R2 및 E06 별도 적용 승인·지표 정의/원본 이용권 확보 시에만 검토.
- **R4 운영 분석/공개:** E09/E10/E12, 백엔드 통합 및 비용·보안 통과 후 별도 승인.

**부정 사례:** Cloud 프로젝트 존재, 키 보유, 일반 정책 문서의 "Viewer Sentiment Analysis" 허용 예시 또는 내부 `APPROVED_TEST_ONLY`는 E05/E06 승인 증거가 아니다. 저장기간 36개월 예외를 댓글 원문에 적용하지 않는다. 미확인 상태에서 외부 API·NLP 실행은 모두 거부한다.

## 3. 향후 증거 원장 후보

| 필드 | 설명 |
|---|---|
| evidenceId | Y45-E01~E12 고유 ID |
| reviewedAt / expiresAt | 유효성 검수/기한(없는 경우 영구승인으로 오인 금지) |
| reviewer / owner | 책임자/승인 근거 |
| projectRef / useCaseScope | 비밀 제외 프로젝트 식별자/허용된 작업 범위 |
| status | UNVERIFIED / IN_REVIEW / APPROVED_FOR_SCOPE / REVOKED |
| evidenceLocation | 권한 보호된 별도 증거 보관 위치 또는 해시만 |
| policyEpoch | 철회 시 단조 증가, 기존 Job/Snapshot 부활 금지 |

본 문서는 운영 데이터베이스 구현이 아니다. 인증정보·실제 댓글·개인식별자·승인서 원문을 Git에 넣지 않는다. 팀 내 증거 검토는 별도 인가된 저장소에서 수행한다.

## 4. 정책 확인 출처

- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/developer-policies-guide
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://developers.google.com/youtube/terms/revision-history
- https://developers.google.com/youtube/data/guides/quota_and_compliance_audits

**최종 판정: 0/12 verified, 최초 실호출·파생 감성 지표·운영 API 모두 POLICY_HOLD 또는 NOT_APPROVED.**
