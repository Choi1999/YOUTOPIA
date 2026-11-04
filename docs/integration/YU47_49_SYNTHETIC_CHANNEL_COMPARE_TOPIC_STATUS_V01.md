# YU-47~49 — 채널 비교·주제 탐색·데이터 가용성 정합성 (합성 데모)

> 대상: Draft PR #62 (YU-47~49), 상위 Draft PR #61 위에 스택.
> 범위: 사용자 승인 기능 개발만. 실제 YouTube API 수집, AI 분석, 운영 배포, 영구 저장 또는 PR 병합 승인 아님.

## 1. 명시 등록 대상 및 허용 출처

- 합성 채널 A: \`UC\` + \`A\` 22개, 선정 영상 \`Ab0_-123xyz\`, \`Qb0_-123xyz\`.
- 합성 채널 B: \`UC\` + \`B\` 22개, 선정 영상 \`Cb0_-123xyz\`, \`Db0_-123xyz\`.
- 모두 \`STATIC_FIXTURE\`, \`isSynthetic=true\`인 UI/데이터 계약 검증용 fixture다. YouTube가 해당 영상들을 실제 채널에 소속시킨 사실이나 실제 댓글을 보증하지 않는다.
- 미등록 유효 CHANNEL/VIDEO ID는 \`NOT_FOUND\` 또는 집계 불가로 처리한다. \`@handle\`은 공식 ID로 매핑했다고 추정하지 않는다.

## 2. YU-47 채널 A/B 비교

- \`/analysis/youtube/channels/compare\`: 각 채널 선정 영상 집합을 \`AnalysisRepository\` → \`projectDemoAnalysisSnapshot\` → \`aggregateSyntheticChannelSelection\` 경유하여 독립 검증한다.
- 각 채널 선정 VIDEO들의 관측 범위·시각·분류 버전 및 합성 출처를 검증한다. 두 채널 비교 전에도 관측 기간·로케일·시각 및 분석/분류 버전의 일치를 요구한다.
- 채널 A 분류 완료 분모 160건, 채널 B 분모 140건. 비율은 **각 채널의 분류 완료 표본**을 분모로 각각 산출한다. 차이는 비율의 퍼센트포인트(%p)이며 모집단/상대 성장률이 아니다.
- 주제는 다중 라벨 언급 건수(B−A). 두 채널 전체 시청자의 성향이나 인과관계를 추정하지 않는다.
- 한 채널이라도 등록되지 않았거나 READY/근거 불일치면 전체 차이 수치 미표시.

## 3. YU-48 주제별 심층 탐색

- \`/analysis/youtube/topics\`: 주제 1개와 채널 1~2개를 명시하고 검증된 집계로만 탐색한다.
- 주제→선정 영상별 mentionCount를 연결하고 원 영상 상세 분석 및 등록 채널로 이동할 수 있다.
- 두 채널을 지정했다면 YU-47의 비교 가능 조건을 재검증하고 주제 언급 수 차이를 표시한다.
- 등록되지 않은 주제/채널 또는 미검증 자료를 0건으로 바꾸지 않는다. 두 검증된 집합 중 한 채널에만 나타나는 주제의 반대편 0건은 **해당 완전한 합성 fixture에서 주제 미등록**이라는 의미다.
- 댓글 원문, 특정 주제 내 감성 분포, 시간 추이 및 인과관계는 별도의 근거가 없으므로 생성하지 않는다.

## 4. YU-49 Hover ↔ Side Panel ↔ 웹 표시 의미

- Hover의 실제 차트는 검증된 \`SNAPSHOT_DERIVED_SYNTHETIC\` 요약이 있을 때만 표시하며 미등록/거절에서는 가짜 비율을 만들지 않는다.
- Side Panel의 전통적인 가상 비율은 **\`ILLUSTRATIVE_ONLY\`**로 표시된다. 합성 UI 시연이며 웹 등록 fixture의 실제 검증 집계와 숫자가 일치한다는 뜻이 아니다.
- 채널/영상 ID는 등록된 합성 Web fixture인지, \`WEB_DATA_NOT_FOUND\`인지 명확히 구분하고 선택 변경·탭 전환·만료 때 이전 문구를 삭제한다.
- 확장의 등록 fixture allowlist는 오프라인 Node 계약 테스트로 Web의 명시 등록 데이터 파일과 대조한다. 실제 네트워크 호출/새 Chrome 권한은 없음.
- 웹은 동일하게 등록된 VIDEO/CHANNEL만 분석값을 표시하고 미등록 대상은 자료 미제공으로 처리한다.

## 5. 수용 검증 및 병합 조건

- 순수 모델 테스트: 채널 별도 분모·차이·근거/버전·부정 케이스, 주제 집계·없는 데이터 차단.
- UI 테스트: 웹 채널 비교/주제 탐색/테마/좁은 화면, 확장 가용성 문구 및 선택 변경으로 인한 이전 값 제거.
- 정확한 기능 HEAD의 Node24 React/Extension 및 Windows 오프라인 CI PASS를 요구하며, 이후 사용자 Chrome 통합 QA를 별도로 기록한다.
- **병합 순서: PR #59 → #60 → #61 → #62**, 사용자 명시 병합 승인 전까지 전부 Draft/미병합.
- 정본 \`policy-gates.json\`의 \`POLICY_HOLD\`, \`verifiedCount=0\`, \`liveCallsAuthorized=false\`, \`derivedSentimentAuthorized=false\`, \`externalDataCollected=false\`와 하드락 \`RELEASED_FOR_FIRST_REAL_CALL=false\` 유지. DPAPI PR #56 별도 보류.
