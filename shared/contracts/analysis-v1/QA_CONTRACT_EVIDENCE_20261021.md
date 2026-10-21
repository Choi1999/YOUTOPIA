# YOUTOPIA Analysis Contract v1 Candidate — 검증·증거 기록

> 2026-10-21 KST · 문서/코드 상태: DRAFT · Provider 미구현 · FE/BE 양측 리뷰 미수행
>
> 여기에서 주장하는 PASS는 **GitHub에서 실제 읽어 온 JSON/Fixture의 구조·교차 계수 정적 검사**이며, Windows Node 또는 JSON Schema 표준 엔진 실행을 의미하지 않는다.

## 1. 기준

- 신규 기능 브랜치: `feature/m0-m1-analysis-contract-candidate-20261021`
- Base `frontend` 기준: `11e8a8ef04e3b868fb3f3fd504b6965158253724` (PR #18 merged)
- `shared/contracts/analysis-v1/analysis.schema.json` Git blob: `b6517b45b7d50dd69c1d7b2aa312206958e7678a`
- 준비된 Fixture blobs:
  - `ready.snapshot.json`: `24f2ff2734296b493ee28a41fad819663071fd4c`
  - `partial.snapshot.json`: `57cd92349471a2a527a3a75aa111f734cd9af571`
  - `no-data.snapshot.json`: `84b9a6cf33748727bf34207018f959a452ac270d`
  - `policy-blocked.snapshot.json`: `21c4246cb9471403d3980c0dbab69ea15bcab9a4`
  - `topic-trend.json`: `4fc5e8240017db548452e22a665c4235a2603618`

## 2. 실제 수행한 정적 검사

| ID | 방법 | 실제 결과 |
|---|---|---|
| CT-STATIC-01 | Github `fetch_file`로 스키마와 5개 Fixture **직접 원문 읽기**, JSON.parse | **6/6 파싱** |
| CT-STATIC-02 | READY/PARTIAL raw·eligible·excluded·classified·unclassified 및 감성 합계, null ≠0 | **조건 PASS** |
| CT-STATIC-03 | 5개 유효 Fixture에 대해 `$ref`, type, enum, const, pattern, properties, additionalProperties, required, anyOf, allOf, if/then, format 등 **가벼운 2020-12 부분 validator** 검사 | **5/5 PASS** |
| CT-STATIC-04 | 잘못된 영상 ID, 잘못된 대상 종류, 알 수 없는 상태, 허용되지 않은 추가 필드 변형 데이터 거부 | **4/4 예상대로 거부** |
| CT-STATIC-05 | 총 9개 유효·무효 Fixture의 제한 범위 검사 | **9/9 PASS, 0 실패** |

**주의:** CT-STATIC-03/04는 완전한 JSON Schema Draft 2020-12 인증 구현이 아닌 독립된 소규모 규칙 부분 검증이다. 전체 JSON Schema compliant checker(Ajv/BE 동등 Validator)의 엔진 검증은 **NOT_RUN**.

## 3. 새로 작성했지만 아직 실행하지 않은 코드 테스트

- 파일: `shared/contracts/analysis-v1/tests/semantic-smoke.test.cjs`.
- Node.js 내장 `node:test`만 사용. 새 NPM 패키지 또는 외부 데이터 요청을 필요로 하지 않음.
- 주요 설계 경계: canonical VIDEO/CHANNEL ID, raw+eligible+excluded, 감성 합계/분모 구별, tenant-private 무권한, STATIC_FIXTURE 표시, POLICY_BLOCKED의 무수치 처리, trend bin 2개 미만 또는 비교 불가능 차단.
- **현재 실행 상태:** **NODE_TEST_NOT_RUN**. 이 브랜치의 테스트는 현재 사용자의 Windows Chrome·Node 환경에서 실행된 것으로 간주하지 않는다.
- 운영 서버의 FE Consumer / BE Provider schema 적합성, 인증·인가, DB/Job, 실제 YouTube API는 **NOT_IMPLEMENTED / NOT_RUN**.

### 실제 Windows 재현 명령 (이 후보 브랜치 checkout 후)

~~~powershell
git rev-parse HEAD
node --test shared/contracts/analysis-v1/tests/*.test.cjs
~~~

한 번 실행한 결과를 TESTED_SHA·Node 버전·명령·PASS/FAIL·원본 로그와 함께 PR에 첨부해야 `NODE_PASS`로 승격한다. Python `jsonschema` 또는 Node Ajv 같은 완전한 JSON Schema 엔진으로 valid/invalid fixture도 추가 검사해야 `SCHEMA_COMPLIANCE_PASS`로 표시한다.

## 4. 다른 단계와의 분리

기존 [YU-27 PR #15](https://github.com/Choi1999/YOUTOPIA/pull/15) Windows Node 177/177과 오프라인 Chromium 2/2 기록은 이 계약 후보의 신규 Node 테스트 증거가 아니다. 실제 설치형 Chrome MV3 Content↔Worker 검증이 필요한 상태는 변함없다.

[외부 근거 대장](../../../docs/research/EXTERNAL_REFERENCE_ADOPTION_LEDGER_20261021.md)의 EX-ID 자료는 설계 참고 문헌으로 사용했으며 외부 코드/훈련 데이터/모델 가중치 **직접 복사·설치 0건**이다.

**최종 판정:** `M0_BASELINE_AUDITED`, `M1_CONTRACT_CANDIDATE`, `CT_STATIC_9_OF_9_PASS`, `NODE_TEST_NOT_RUN`, `BE_PROVIDER_NOT_IMPLEMENTED`, `FE_BE_SIGNOFF_PENDING`.
