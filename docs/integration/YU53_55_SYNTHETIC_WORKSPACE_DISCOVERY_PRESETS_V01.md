# YU-53~55 — 합성 분석 요약·대상 검색·작업 구성 프리셋 v0.1

## 제품 범위와 변경

- YU-53: 통합 워크스페이스에서 현재 선택한 VIDEO A/B, CHANNEL A/B의 출처 검증 상태 및 개별 분류 완료 표본을 요약한다. 서로 겹칠 수 있는 영상/채널의 수치를 합산하지 않는다. 주제는 검증된 채널 집합별 언급 건수만 표시한다.
- YU-54: 명시적으로 등록된 합성 VIDEO 4개, CHANNEL 2개를 검색한다. ID·이름 검색, 종류/상태/주제 필터, A/B 선택, 상세 화면 연결을 제공한다. 등록 여부만으로 READY를 표시하지 않는다.
- YU-55: 정적 등록 데모 프리셋 3종(채널 A 탐색, 채널 B 탐색, PRICE 교차 탐색)과 기존 상세·비교·주제 화면에서 워크스페이스 복귀 링크를 제공한다. 계정별 맞춤형 영구 프리셋은 아직 지원하지 않는다.

## 데이터·해석 조건

1. VIDEO는 AnalysisRepository.getSnapshot에서 얻은 결과를 projectDemoAnalysisSnapshot으로 검증한다. CHANNEL은 readDemoChannelAggregate의 선정 영상·분류·기간·버전 검증을 통과해야 READY로 표시한다.
2. PARTIAL은 검증된 분모가 있을 때에만 해당 범위를 표시한다. STALE/NO_DATA/NOT_FOUND/POLICY_BLOCKED/실패한 투영은 근거 미제공 상태이며 표본 수치를 0건으로 가장하지 않는다.
3. 주제 필터는 검증된 합성 영상·채널에서 양수의 언급이 있을 때만 검색 결과에 포함한다. 검증된 READY 선정 채널에서 주제 언급이 없으면 0건이 될 수 있으나, 미등록·차단 상태는 항상 미제공이다.
4. 채널별 선정 영상은 실제 YouTube 소속 사실을 증명하지 않는다. 서로 다른 영상/채널을 단순 합산하거나 대표성·유의성·인과관계를 주장하지 않는다.
5. 검색어/필터는 페이지 메모리에서만 사용하고 외부 요청·계정 보관·URL에 삽입하지 않는다. 프리셋은 기존 YU-51 sessionStorage v1의 등록 ID·주제·최근 ID만 변경하며 스냅샷·댓글·인증정보를 저장하지 않는다.
6. 원격 YouTube API 호출, 서버, Cloud, Chrome Manifest, 실수집 승인 게이트, 운영 데이터 수명주기 및 PR #56 DPAPI를 변경하지 않는다. POLICY_HOLD / verifiedCount=0 / RELEASED_FOR_FIRST_REAL_CALL=false 유지.

## 수동 Chrome QA

1. 분석 워크스페이스에 접속해 합성 영상 두 개, 선정 채널 두 개의 분류 완료 표본이 개별적으로 표시되고 총합·실제 채널 여론 표현이 없는지 확인한다.
2. 검색어 Cb0_ → VIDEO C만 표시 → A에 선택 → 요약과 해당 상세 링크 변경 확인.
3. 종류 CHANNEL + 주제 QUALITY → 채널 B만 표시하고 검색 조건 초기화로 전체 등록 6개 복귀.
4. READY/BLOCKED 필터에 따른 정확한 상태와 분모 차단을 확인한다.
5. 채널 B 프리셋 → 영상 C/D, 채널 B/A, QUALITY; PRICE 교차 탐색 → 영상 Qb/D, PRICE.
6. 새로고침·상세/비교/주제 이동 후 워크스페이스 복귀 및 세션 복원이 유지되는지 확인한다.
7. 임의 URL token과 잘못된 UTM은 기존 YU-50 URL 검증에서 차단되는지 확인한다.
8. 모바일 폭, 키보드 조작, 다크/라이트 테마를 확인한다.

## PR / CI / 병합 경계

- PR #63은 YU-50~52의 별도 Draft PR로 유지한다. 이 신규 기능 묶음은 PR #63 HEAD에서 분기한 후속 Draft PR이다.
- 워크플로는 frontend base에만 자동으로 반응하므로 정확한 HEAD의 CI 성공을 확인한 뒤 후속 PR의 base를 PR #63 기능 브랜치로 복원한다.
- 자동 CI PASS ≠ 사용자 Windows Chrome 수동 QA PASS ≠ PR 병합 승인. 이후 사용자의 명시적 병합 승인 전까지 모두 Draft/미병합 유지.
