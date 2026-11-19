# CCU 호출 기준과 전체 예산 검토

검토일: 2026-11-19. 기준은 README에 명시한 pinned base image의 코드와 공식 문서다. 운영자가 돌려준 image/wrapper/config 증거가 최신인지 따로 확인한다. 이 문서는 운영 조회 결과나 운영 SQL 배포본을 포함하지 않는다.

## 공식 API와 키

- [GetNumberOfCurrentPlayers](https://partner.steamgames.com/doc/webapi/ISteamUserStats#GetNumberOfCurrentPlayers): 필수 입력은 `appid`. Steam에 연결된 플레이어 수이며 오프라인 플레이어는 포함하지 않는다. 기존 `sources/steam/client.py::get_current_players`는 `api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/`에 `appid`를 보내며 `authenticated=False`다. 키 pool/fallback을 사용하지 않는다.
- [Steam Web API 약관](https://steamcommunity.com/dev/apiterms): 하루 100,000회. 키를 여러 개 발급해서 총량이 늘어난다는 근거가 아니다. endpoint별 안전한 분당 호출량이나 keyless CCU의 무제한 사용을 보장하지 않는다.
- [Web API overview](https://partner.steamgames.com/doc/webapi_overview): partner host는 공개 method도 publisher key가 필요하다. public host를 임의로 `partner.steam-api.com`으로 바꾸지 않는다. 잘못된 key로 인한 403이 연결 IP 제한으로 이어질 수 있다.
- `REVIEW_HISTOGRAM`은 현재 source에서 `store.steampowered.com/appreviewhistogram/…`이다. Steam Web API 100,000회와 같은 quota라고 단정하지 않는다. 내부 보호 장부는 이 요청도 보수적으로 Steam 전체에 포함한다. YouTube 호출은 별도다.

## 어떤 게임을 언제 호출하는가

| 단계 | pinned base의 기준 |
| --- | --- |
| 후보 | configured ranking source와 source별 개수. 불완전 ranking은 정상 전체 목록으로 취급하지 않는다. |
| 일반 승격 | 현재 유효한 `CONCURRENT_PLAYERS` 또는 `MANUAL` signal. 일반 source는 적격 게임이 필요하며 MANUAL은 기존 예외 정책을 따른다. 명시적 비게임은 중단한다. |
| 승격하지 않는 source | 주간 Top Sellers/일별 Most Played/카테고리 순위 기록 자체가 모두 CCU 승격 조건인 것은 아니다. 현재 `PROMOTABLE_SIGNAL_SOURCES`를 확인한다. |
| 새 기능 | 검토 후 명시적으로 admit한 `NEW_RELEASE`만 CCU 승격. 신규 source만으로 YouTube 승격하지 않는다. 기존 target 행은 비활성까지 admission에서 제외한다. |
| 매 슬롯 | `steam.ccu.enabled`이며 target의 `active=TRUE`, `next_due_at IS NULL OR next_due_at<=now`. AppID+관측 slot별 task 중복을 막는다. 실제 간격은 선택한 profile/override의 `steam.ccu.slot_minutes`다. |
| 실행량 | `steam.ccu.maximum_games_per_run` 및 실제 wrapper timeout/lock이 처리 범위를 제한할 수 있다. 과거 slot의 현재 CCU를 뒤늦게 채우지 않는다. |
| 유지/탈락 | 일반 유효 source 상실 후 기존 72시간 COOLDOWN 동안 active, 이후 INACTIVE. 명시적 INELIGIBLE은 즉시 중단. source 재등장 시 적격 재진입. 낮은 CCU 숫자 하나로 탈락시키는 기준은 이 경로에서 발견하지 않았다. |
| 성공 | RAW 관측과 현재 slot을 보존하고 다음 due를 scheduled slot+간격으로 설정한다. |
| 404 | 관측 0을 만들지 않고 UNAVAILABLE, 다음 확인은 24시간 후. 수정 전 source 갱신이 이 대기를 앞당길 수 있다. |
| 다른 실패 | retryable 실패는 1시간, 그 외 24시간 대기. 설정된 재시도·Retry-After가 실제 실행 시간에 추가된다. |

원본에는 전역 day budget/pacing guard가 없다. 새 overlay의 shared guard를 모든 Steam 실행 경로에 연결하기 전에는 기존+신규 합산 상한이 집행된다고 볼 수 없다. 키 회전은 CCU 호출량 분산 수단이 아니다.

## 계산과 확인

게임 N개, 간격 I분, 요청당 최대 A회 전송이면 단순 1일 신규 예상은 `N × ceil(1440/I)`, 재시도 가정은 그 값의 A배다. 기존 실제 시도 B, 신규 최악 M, 발견/metadata를 포함한 reserve R에 대해 초기 장부 이전·이후를 보수적으로 `2B + M + R`로 검토한다. 이 수치는 향후 기존 호출 증가·다른 실행자·긴 실행 시간을 증명하지 못한다.

확인할 것은 최신 전체 target 수/active/COOLDOWN, 실제 선택 profile과 override/간격/retry, 최근 24시간 모든 Steam 시도와 403/429, calendar minute peak, per-AppID 404 빈도, job 소요시간/timeout/lock, 다른 PC·스크립트의 호출이다. 적재된 `api_call_attempt`만으로 redirect나 commit 전 종료한 전송을 모두 셌다고 할 수 없다. 새 발견 호출의 SQLite 장부도 따로 합산한다.

1회 수집 시간을 `(기존 active+신규) × A / 분당 pacing`만으로 상한이라고 하지 않는다. 응답 지연·connect/read timeout·Retry-After·다른 job 점유까지 포함해 관측 슬롯 안에 완료되는지 확인한다. 과거 403/429가 없었다는 사실도 미래 허용량 보장은 아니다.

## 재현 및 수정 범위

격리 PG와 mock HTTP에서 원본의 404→signal refresh가 24시간 대기를 앞당기는 경로, PENDING task 생성 후 target 중단/대기 연장에도 claim하는 경로를 재현했다. overlay는 active target의 다음 due를 보존하고 CCU claim 시 active/due를 재검사한다. 최초 선정 시각, 적격 재진입, 기존 signal·YouTube 정책, RAW 형식/slot key는 보존한다. 운영 특정 AppID의 실패 원인으로 확정하려면 운영 per-AppID/실행 설정 증거가 추가로 필요하다.
