
# YOUTOPIA — Preview / Web 의미 호환성

상태: DRAFT · MOCK_ONLY · FE/BE 공동 승인 전

## 목적

Chrome Hover Preview와 Web AnalysisSnapshot의 공통 식별자,
출처 정보 및 분석 수치의 의미를 구분한다.

현재 두 화면은 독립적인 합성 데이터 공급자를 사용한다.

## 공통 규칙

- source: YOUTUBE
- targetType: VIDEO 또는 CHANNEL
- VIDEO targetId: 11자 YouTube 영상 ID
- CHANNEL targetId: UC 접두사 + 22자
- 미확인 @handle은 CHANNEL ID로 변환하지 않는다.
- STATIC_FIXTURE는 반드시 isSynthetic=true이다.

## Preview 전용 의미

- contractVersion: preview-web-compat-v1-draft
- valueSemantics: ILLUSTRATIVE_ONLY
- snapshotId: null
- analysisStatus: null
- observationScope: null
- sampleCounts: null
- sentimentCounts: null
- sentimentDenominator: null
- observedAt / analyzedAt: null

Preview의 positive, neutral, negative 백분율 및 sampleLabel은
실제 집계가 아니라 화면 시연용 값이다.

해당 백분율에서 댓글 건수를 역산하지 않는다.

## Web AnalysisSnapshot 의미

- contractVersion: analysis-v1-candidate
- 상태: READY, PARTIAL, STALE 등
- 감성 비율 분모: sample.classifiedCount
- 표본 관계: raw = eligible + excluded
- 표본 관계: eligible = classified + unclassified
- 분석 범위와 시각은 검증된 값만 사용한다.

Web의 합성 READY fixture도 실제 YouTube 분석은 아니다.

## 금지되는 해석

- Preview 응답 READY를 분석 READY로 취급
- Hover의 가상 표본 수를 Web classifiedCount로 사용
- 동일 영상 ID라는 이유로 결과 수치를 동일시
- Preview 가상 비율을 실제 댓글 반응이라고 표시
- 합성 데이터를 실제 수집 결과 또는 승인된 API로 승격

## 향후 통합 조건

실제 데이터 공급자가 준비되면 하나의 검증된 스냅샷에서
Hover용 요약과 Web 상세 데이터를 각각 투영한다.

그때 동일 snapshotId, 관측 범위, 처리 버전, 표본 분모를
공유하는 경우에만 결과의 정합성을 비교한다.

이 문서는 실제 API, 데이터 이용 권한, 인증 또는
테넌트 접근 승인을 의미하지 않는다.
