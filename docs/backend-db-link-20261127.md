# 기존 DB 조회와 화면 연결 변경 · 2026-11-27

게임별 YouTube 게시일 집계에서 전체 관측 분모와 선택 기간 합계를 함께 반환하고, 날짜별 목록 외에 선택 기간 전체 목록을 조회한다. 기존 source View와 read-only transaction을 사용한다. 새 테이블·뷰·권한·외부 API 호출은 추가하지 않는다.

## 게시 영상 API

`GET /api/v1/games/{gameId}/youtube-publications`

| 입력 | 계약 |
|---|---|
| `days` | 기존과 같이 7 또는 30, 기본 30. KST 오늘을 포함한 달력 날짜 범위 |
| `scope` | 새 선택값 `date` 또는 `period`. 생략하면 기존 `date` 동작 |
| `date` | `scope=date`의 날짜. 생략하면 KST 오늘. 선택 기간 밖은 400 |
| `page`, `size` | 기존 0-based 페이지, 기본 20·최대 100 |

`scope=period`는 `date`를 보내지 않는다. 두 입력을 함께 보내면 400이다. period 목록은 선택 기간의 게시일이 확인된 영상만 포함하고 `publishedAt DESC, videoId ASC`로 정렬한다. 미래 게시일·게시일 미상은 목록과 일별 차트에서 제외한다. 범위를 벗어난 페이지는 200 빈 목록이다.

기존 응답 필드를 유지하고 다음 필드를 추가한다.

```json
{
  "videoScope": "period",
  "selectedDate": null,
  "summary": {
    "population": "QUERY_ASSOCIATED_DISTINCT_VIDEOS_DISCOVERED_BY_AS_OF",
    "observedVideos": 5,
    "publishedVideos": 3,
    "periodVideos": 2,
    "missingPublishedAt": 1,
    "futurePublishedAt": 1,
    "latestFirstObservedAt": "2026-11-27T00:00:00Z"
  }
}
```

위 값은 설명용 합성 예시다. 요약의 기준 시각은 기존 최상위 `asOf`다.

- `observedVideos`: `firstObservedAt <= asOf`인 게임/영상 고유 조합의 수. 게시일 미상·미래 게시일도 이 분모에는 포함한다.
- `publishedVideos`: 게시일이 존재하고 `publishedAt <= asOf`인 수. 선택 기간 이전 영상도 포함한다.
- `periodVideos`: 선택한 KST 달력 기간에 게시된 것으로 관측된 수.
- `missingPublishedAt`, `futurePublishedAt`: 분모 중 게시일 미상과 미래 게시일 제외 건수. `observedVideos = publishedVideos + missingPublishedAt + futurePublishedAt`다.
- `latestFirstObservedAt`: 분모 영상들의 가장 늦은 최초 발견 시각. 최근 수집 성공 시각이나 신선도 판정이 아니다. 분모가 0이면 null이다.

분모와 기간 합계는 선택 날짜·현재 페이지와 무관하다. `scope=date`이면 `selectedDate`와 해당 날짜의 영상 페이지가 기존처럼 반환된다. `scope=period`이면 `selectedDate=null`이다. 기존 최상위 `missingPublishedAt`은 유지하고 summary의 동일 값과 일치한다.

원천 View가 없거나 권한이 확인되지 않으면 `summary=null`, `videos=null`, `points=[]`를 반환한다. 확인된 빈 원천은 숫자 0을 반환한다. 선택 기간 밖에만 과거 영상이 있는 경우 `dataStatus=EMPTY`와 `periodVideos=0`이면서 `observedVideos>0`일 수 있다. `dataStatus`는 기존처럼 선택 기간 차트의 가용성이다. SQL/원천 오류는 503이며 숫자 0으로 바꾸지 않는다.

`service.v_game_published_video`의 기존 distinct/as-of 선택 규칙과 10,000개 상한을 유지한다. catalog에서 확인된 native Steam game ID만 조회한다. 영상 개수는 검색어 귀속으로 관측한 범위이며 YouTube 전체 게시량이나 영상 내용의 게임 관련성을 증명하지 않는다. `coverage=UNASSESSED`를 유지한다. 기존 `JdbcGameRepository.youtubeHistoryCount`는 게시일 미상을 제외하므로 전체 관측 분모 대신 사용하지 않는다.

## 쿼리 파라미터 검증

기존 `AuthenticationController`, `AccountLifecycleController`, `ProductEventController`의 query 없는 handler에 `QueryParameters.only(request)`를 추가했다. 알 수 없거나 반복된 query는 계정·복구·탈퇴·이벤트 서비스 호출 및 handler의 활동시각 변경 전에 400으로 거절한다. 기존 Spring Security의 로그인 realm·CSRF 검사와 account/session/control 보호 경계는 유지한다. CSRF는 기존 서비스 client처럼 응답에 안내된 헤더로 보낸다.

`PATCH /api/v1/me/settings`도 첨부 명세의 `90_API_공통계약` 16행에 따라 쿼리 인자를 검사한다. 알 수 없거나 반복된 인자는 400 응답을 반환하며 설정 버전과 저장값을 보존한다.

## 게임 목록·상세와 차트의 DB 조회 일치

- 게임 목록과 상세 카드의 CCU 집계는 Steam 시계열과 같은 기준을 사용한다. 각 게임의 같은 예약 시각에 여러 수신이 있으면 조회 기준 시각까지의 마지막 수신을 선택한다. 수신 시각이 같으면 관측 ID가 큰 행을 사용한다. 교체된 수신값은 24시간 최고치와 순위에서 제외한다.
- 게임별 게시 영상 API는 `service.v_game_catalog.app_id`에서 게임의 존재를 확인한 뒤 기존 영상 조회 뷰를 읽는다. 이전에는 존재 확인 중에 Steam CCU도 집계해 Steam 조회 장애가 YouTube 게시 영상 응답까지 막을 수 있었다. 카탈로그에 없는 게임은 404이고, 영상 뷰와 권한 상태는 기존 계약에 따라 표시한다.
- 내부 근거는 인계 ZIP의 `04_페이지연결_버튼_API_작업범위.md`에 적힌 게임 목록→상세→Steam·YouTube 흐름, 서비스 Git의 `JdbcCcuRepository`와 `GameVideoRepository` 조회 계약이다. 변경에 필요한 새 DB 객체는 없다.

## 검증 범위

- `GamePublicationHttpTest`: 실제 MVC/보안/JSON 응답, synthetic repository. KST 7/30일 경계, 기간/날짜 기본값, 누락/미래 분모, 동순위 ID 정렬, 안정 pagination, 빈 데이터·원천 미지원·권한/조회 오류, 잘못된 입력의 조회 이전 거절.
- `NoQueryMutationContractTest`: standalone MVC handler binding. query 거절 시 업무 service 호출이 없고 활동시각이 유지되는지 확인. 실제 세션 인증은 기존 별도 보안/통합 테스트의 범위다.
- `AuthenticationIntegrationTest.publicationsDeduplicateQueriesUseKstPublicationDatesAndDoNotConfuseMissingAccessWithZero`: 실제 synthetic PostgreSQL의 중복 행·미래 발견 제외·게시일 경계·권한 상태와 summary/period pagination을 함께 검증하도록 확장.

현재 로컬 통합 실행은 Docker/Linux 환경 부재로 수행하지 않았다. Java unit/MVC 결과와 별도로 기록한다. 운영 DB View·실데이터·권한·배포·외부 provider·실제 모델 정확도는 이 테스트의 증명 범위가 아니다.

이번 후보에서 로컬 Java 21과 Gradle 8.14.3으로 `--offline test`를 실행했다. 33개 테스트 스위트 254건 중 252건이 통과했고, Windows에서 실행 대상이 아닌 2건이 건너뛰어졌다. 실패와 오류는 0건이었다. 게시 영상 MVC 18건과 입력 검증 MVC 15건이 이 집계에 포함된다. 동일 슬롯의 정정값, Steam CCU 권한이 없는 경우의 영상 조회, 설정 입력 오류 후 버전 보존은 격리 PostgreSQL·Redis를 사용하는 `AuthenticationIntegrationTest`에 포함했다.
