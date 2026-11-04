# YU-50~52 — 합성 분석 워크스페이스 · 임시 세션 · 근거 패널 v0.1

## 구현 범위

- YU-50: 기존 VIDEO 상세/비교, CHANNEL 상세/비교, TOPIC 탐색으로 이동하는 통합 화면. 정규 식별자와 기존 계산 페이지를 재사용하고 새로운 감성 계산 엔진은 만들지 않는다.
- YU-51: 영상 A/B, 채널 A/B, 주제 ID, 명시 선택한 최근 대상 최대 6개를 브라우저 sessionStorage에 저장한다. 2시간 TTL, 스키마 버전/정확한 필드/등록 합성 ID/중복/크기를 검증한다. 새로 열면 유효할 때 복원하고 저장 불가를 명확히 표시한다. 사용자는 세션을 삭제하거나 명시적으로 다시 불러올 수 있다.
- YU-52: 영상은 AnalysisRepository에서 조회한 후 projectDemoAnalysisSnapshot을 검증한다. 채널은 readDemoChannelAggregate를 통해 원래 집계 검증을 이용한다. READY 또는 분모가 확인된 PARTIAL 영상만 표본 수치를 보여준다. STALE/차단/미등록/오류에는 임의 수치나 0을 표시하지 않는다.

## 임시 세션 계약

버전 1은 savedAt, videoIds 배열 2칸, channelIds 배열 2칸, topicId, recentTargets 최대 6개로만 구성한다.

- VIDEO 등록 합성 ID 4개, CHANNEL 등록 합성 ID 2개, 주제 RECIPE/PRICE/DELIVERY/QUALITY만 허용한다. 빈 선택은 편집 가능하지만 완료 전 비교 링크를 만들지 않는다.
- 원시 댓글/스냅샷/원문/계정/키/토큰/UTM/임의 URL은 저장하지 않는다. 등록되지 않은 필드, 미래 시각, 만료 기록, 중복 ID, 알 수 없는 ID는 저장 및 복원을 거부한다.
- browser sessionStorage는 계정이나 클라우드의 영구 보관이 아니다. 탭 복제 동작은 브라우저에 따라 초기 값이 복사될 수 있으므로 강한 탭별 보안 격리를 주장하지 않는다.
- 등록 합성 fixture를 보여주는 기본 선택과 보관된 실제 세션을 구별한다. 세션 삭제 시 저장은 지우고 화면에 데모 기본값만 표시한다.

## 보안 및 해석 경계

- STATIC_FIXTURE 및 SNAPSHOT_DERIVED_SYNTHETIC은 실제 YouTube 분석 결과가 아니다. Hover의 ILLUSTRATIVE_ONLY 수치와 동일하다고 가정하지 않는다.
- 채널의 선정 합성 영상은 실제 채널 소속을 증명하지 않는다. 주제 언급은 다중 라벨이므로 고유 댓글 수로 합산하지 않는다.
- 정책 파일의 POLICY_HOLD, verifiedCount=0, liveCallsAuthorized=false와 최초 실호출 전송의 RELEASED_FOR_FIRST_REAL_CALL=false를 변경하지 않는다.
- 이 기능에서 Chrome Manifest, 백엔드, Cloud, 외부 API, 운영 결제 또는 데이터 수명주기 변경은 없다.
- 별도 기능 브랜치의 Draft PR만 작성한다. 병합·운영 배포는 사용자의 별도 명시 승인이 필요하다.

## 신규 Chrome QA

1. 로컬 개발 서버에서 http://localhost:5173/analysis/youtube/workspace 로 진입해 영상/채널/주제 선택기, 기존 상세·비교·탐색 링크를 확인한다.
2. 영상 A를 C로 변경하고 링크의 A/B 순서 및 영상 근거가 C의 값으로 갱신되는지 확인한다. A/B 교환도 확인한다.
3. 채널 B를 비우면 채널 비교 링크는 제거되지만 주제·채널 A의 유효 부분 선택은 유지되는지 확인한다.
4. 다른 페이지로 이동하고 워크스페이스에 재진입하거나 새로고침해 세션을 복원한다. 삭제 버튼은 sessionStorage의 키를 제거해야 한다.
5. Application → Session Storage에서 youtopia-analysis-workspace-v1 키에 ID/주제/시각/최근 ID만 있는지 확인한다.
6. 모바일 폭과 키보드 탭 이동으로 선택기와 링크를 사용할 수 있는지 확인한다.

## 자동 검증/승인

세션의 복원·만료·중복·비등록·저장 실패, 근거 누락·타깃 불일치, A/B 순서·부분 선택·기존 경로 링크를 회귀 테스트로 검사한다. 최종 HEAD에서 React 테스트/빌드, 확장·공유 계약, Windows 오프라인 CI를 확인하고 사용자 Chrome QA PASS 후 별도 병합 승인을 받는다.
