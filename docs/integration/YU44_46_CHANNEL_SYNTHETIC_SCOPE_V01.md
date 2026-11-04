# YU-44~46 — 합성 채널 분석 MVP 범위·수용 조건

> 대상: Draft PR #61 (feature/yu44-46-channel-analysis-demo-v01)
> 상태: 코드 후보 / 통합 Chrome 수동 QA와 별도 병합 승인 전
> 기준선: Draft PR #60, HEAD 5a6cec722f75e97e7516fa2c97c2973fadf9d08a

## 1. 합성 데이터 출처와 선정 규칙

- 명시 등록된 합성 채널 식별자: UCAAAAAAAAAAAAAAAAAAAAAA.
- 등록된 합성 영상 ID: Ab0_-123xyz, Qb0_-123xyz.
- 이 대응 관계는 **제품 화면 및 집계 계약 시험용 수동 fixture 매핑**이다. 실제 YouTube 채널 소속, 댓글 수집 및 채널 전체 여론의 증거가 아니다.
- @handle, 임의의 유효한 CHANNEL ID 및 등록되지 않은 VIDEO ID를 다른 fixture로 임의 연결하거나 실제 분석 데이터로 위장하지 않는다.
- 기존 AnalysisRepository 조회 및 projectDemoAnalysisSnapshot() 검증을 통과한 **동일 범위·버전·시각**의 READY 두 개만 합산한다.
- 부분 결과, 오래된 결과, 이용 불가, 부정합·출처 오류는 수치 집계를 생성하지 않는다.

## 2. 수치의 뜻

- 채널 화면의 합계는 **선정된 두 합성 영상 스냅샷에서만** 계산한다.
- 원시(raw), 적격(eligible), 제외(excluded), 분류 완료(classified), 미분류(unclassified)는 각각 합산하되 의미와 분모를 교환하지 않는다.
- 감성 비율 분모는 선정 두 영상의 **분류 완료 댓글 수 합계**다. 영상별 비율을 단순 평균하지 않는다.
- 주제는 다중 라벨이다. 합산한 주제별 mentionCount는 독립 고유 댓글 수나 채널 전체 댓글 점유율이 아니다. 각 영상 기여 수를 별도로 표시한다.
- 선정 영상/관측 기간/분류 버전/출처/합성 라벨과 인과·대표성 부정 안내를 함께 보인다.

## 3. 화면 및 확장 프로그램 진입

- /analysis/youtube/channel/:channelId: 유효한 합성 채널에서 선정 영상 목록을 조회한다. 임의 채널은 미제공, 형식 불일치는 유효하지 않은 ID로 분기한다.
- 확장 Side Panel은 사용자의 **명시적 더보기 클릭으로 고정된 CHANNEL**에서만 웹 채널 상세 링크를 제공한다. 기존 VIDEO 웹 상세·비교 경로는 그대로 유지한다.
- 선정 영상 각각의 상세 링크는 등록 채널 컨텍스트만 channel 쿼리 매개변수로 전달한다. 다른 VIDEO/CHANNEL을 이 매핑에 임의로 연결하지 않는다.
- 집계 READY에서만 두 합성 영상의 웹 비교로 이동할 수 있다. 데이터 미제공/차단 시 비교 링크를 노출하지 않는다.

## 4. 검증·병합 경계

- 신규 단위/컴포넌트 및 기존 웹 라우팅·Side Panel 링크 회귀 테스트를 수행한다.
- 실제 Windows Chrome에서는 채널 핀 → 웹 채널 상세 → 선정 영상 상세 → 복귀 → 두 영상 비교, 미등록 채널·@handle 및 좁은 화면/테마 상태를 시험한다.
- PR #59 → PR #60 → PR #61 순서로만 병합 가능하며, **사용자의 별도 명시 승인** 이전에는 병합하지 않는다.
- 정본 YouTube 정책 게이트 POLICY_HOLD, liveCallsAuthorized=false, derivedSentimentAuthorized=false 및 코드 하드락 RELEASED_FOR_FIRST_REAL_CALL=false를 유지한다. PR #56 DPAPI도 보류 상태를 유지한다.
