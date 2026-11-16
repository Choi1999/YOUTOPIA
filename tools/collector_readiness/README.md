# Steam 신작 CCU 수집 준비 도구

기존 수집기의 데이터 형식·AppID/관측 슬롯 중복 방지·RAW 백업·일반 Top 수집을 유지하면서 신작을 소규모로 추가하는 opt-in 도구다. **코드 준비와 운영 적용은 별개다. 기본값은 꺼짐이며 운영 확인이 빠지면 실행을 차단한다.** 앱 JAR·Redis·웹 화면을 배포하는 도구가 아니다.

## 근거와 지원 범위

기준은 `qwe1asd/youtopia-collector`의 공개 이미지 index digest `sha256:d43c2d8e749841c1b746d5841fbde7d4d9c4bde8204ba6d35c2a1ddfc622d594`다. Linux amd64 manifest는 `sha256:19b7faefa77fd00805f88cf5f06386d377266f4bda857fd2c5a7020bf721fc4a`, image config digest는 `sha256:f5b8ed5bc49ffec9b07fb67ef8ea43f0c25832b95ef19a431ffa118d64d02ea4`다. 원본 collector Git commit과 원본 테스트 전체는 확보되지 않았다. 원본의 `collector_version` 문자열은 그대로이므로 실제 코드는 이미지 ID와 overlay revision label로 구별해야 한다.

빌드 시 HTTP 전송·target reconcile·CCU job 세 파일의 원본 SHA256와 삽입 위치를 모두 확인한다. 원본이 다르면 빌드가 중단된다. 이미지의 기존 entrypoint·기본 명령·UID/GID 10001은 보존한다. 호스트의 코드 bind mount가 패키지를 가리거나 사용자 지정 `PYTHONPATH`가 import 경로를 바꾸면 이미지 교체만으로 적용됐다고 볼 수 없다.

기존 schema v7의 `steam_tracking_signal`은 임의의 비어 있지 않은 source를 지원하므로 `NEW_RELEASE`를 추가하기 위한 **운영 DDL·새 PostgreSQL 테이블·GRANT는 필요 없다**. 실제 운영 schema/preflight가 일치하는지는 따로 확인한다. 이 문서의 새 SQLite staging은 후보·출처·선정 이력용이며 서비스 DB나 control DB를 대체하지 않는다.

## 선정과 관측 출처

1. 공식 [IStoreService/GetAppList](https://partner.steamgames.com/doc/webapi/IStoreService)로 후보를 분할 발견한다. `last_modified`는 출시일이 아니다. 최초에는 전체 scan, 이후에는 완료된 scan의 시작 시각에서 5분 겹친 watermark를 사용한다. 중간 실패 시 같은 필터/커서에서 재개한다. 모든 페이지를 받기 전에는 완료 watermark를 올리지 않는다.
2. 기존 수집기가 쓰는 `IStoreBrowseService/GetItems/v1`로 AppID별 실제 메타데이터를 받는다. 요청 형식은 기존 코드와 격리 mock으로 확인했으며 실제 계정/API 응답은 운영 전 별도 확인 대상이다. HTTP 원문·해시·request/run reference를 staging에 보존한다.
3. 정확한 UTC 출시 시각, 최근 메타데이터, `game` 제품 종류, 동일 AppID, 검토한 장르 매핑이 확인된 게임만 제안한다. 미출시·DLC·demo·출시일/신원 미확인은 격리한다. EA 상태는 현재 `UNKNOWN`이며 EA→정식 출시 전환을 자동 판별하지 않는다. 게임이 많으면 장르별 round-robin으로 나누고 나머지는 대기 목록에 남긴다.
4. `genre-mapping.example.json`은 영어 Steam **태그를 분석용 장르로 묶는 검토 초안**이다. 이름을 반환하지 않는 응답은 `tag:19` 같은 명시적 ID 매핑도 지원한다. 운영 tag catalog와 대조해 ID→장르를 검토하며, 미매핑 ID의 뜻을 추측하지 않는다. 실제 Valve 장르 또는 장르별 CCU 순위로 표시하지 않는다. 다중 장르여도 AppID 하나는 한 번만 수집한다. Top Sellers·태그 인기·주목받는 무료 게임 목록의 추가 수집은 이 기능에 포함하지 않았다.
5. 이미 CCU/YouTube target 행이 있는 게임은 비활성 행까지 제외한다. 기존 중단 게임을 일괄 재활성화하지 않는다. 최대 게임 수는 매번 신규로 허용하는 수가 아니라 **새 기능 출신 active/COOLDOWN target의 전체 상한**이다. 나중에 일반 Top에 진입해도 earliest selection reason은 바뀌지 않아 이 상한에 보수적으로 계속 포함될 수 있다.
6. 명시적인 `admit --execute`에서 검증한 정확한 metadata만 기존 RAW 계약으로 import하고 `NEW_RELEASE:<decision ID>` signal을 등록한다. 이 도구는 CCU 과거 관측을 replay하거나 만들어내지 않는다. 새 source만으로는 **CCU만** 승격한다. 일반 `CONCURRENT_PLAYERS`/`MANUAL` source의 기존 CCU+YouTube 정책은 유지된다. 기존 source가 나중에 생기면 YouTube도 원래 정책대로 활성화될 수 있다.
7. 예시 초기 보호 기간은 14일이다. 재실행으로 연장하지 않는다. 만료 후 기존 72시간 COOLDOWN 정책을 적용하며, CCU job 시작 시에도 새 기능 출신 target을 reconcile한다. 확정 비게임은 기존 즉시 중단 정책을 따른다. 출시 직후 CCU가 낮다는 이유로 이 보호 기간을 줄이지 않는다.

`run_reference` 자체의 의미를 변경하지 않는다. staging의 immutable metadata/admission/event와 기존 signal scope가 선정 출처를 연결한다. 새 기능을 켠 동안 성공/404/미해석 CCU RAW sidecar의 `tracking_context`에 요청 직전 source·scope·시각을 추가한다. RAW 관측 테이블/CCU 응답/slot key는 그대로다. 한 관측에 NEW_RELEASE와 일반 Top이 함께 있을 수 있으므로 배타적 한 가지 원인으로 단정하지 않는다. 과거 관측에 이 정보를 소급해서 만들어 넣지 않는다. SQL 조회용 run↔cohort 테이블은 향후 별도 검토 대상이며 이번에는 만들지 않는다.

새 AppID의 RAW 수집과 서비스 카탈로그/화면 등록은 별개다. 이 도구는 서비스 게임 등록·ID 매핑·조회 뷰를 변경하지 않으며, 신규 관측이 웹에 자동 노출된다고 보장하지 않는다.

## 호출 보호와 기존 수집 보존

개별 CCU는 기존 코드에서 인증하지 않는 공개 API다. 신작 발견/메타데이터는 기존 `STEAM_WEB_API_KEY_1`, `_2`, … 중 첫 키 또는 legacy `STEAM_WEB_API_KEY`를 서버 환경에서 재사용한다. 키를 늘려 총 한도를 늘리거나 게임별 키를 고정 배정하지 않는다. 키 값은 인자·URL·출력에 넣지 않는다.

`YOUTOPIA_STEAM_GUARD_ENABLED=1`이면 기존 Steam HTTP 실제 전송/재시도/401 fallback과 새 발견/metadata 요청이 **같은 영속 SQLite 장부 하나**를 사용한다. 다른 서비스·다른 PC·별도 스크립트의 호출은 이 장부만으로 알 수 없으므로 확인 없이는 gate를 통과시키지 않는다. YouTube 전송/키·DB 수집 데이터는 이 guard의 변경 대상이 아니다.

- 전체 단일 in-flight, 분당/rolling 24h 한도, 최소 간격, 새 발견/metadata 별도 rolling 한도를 원자적으로 예약한다. 새 작업 subcap을 실패·기타 작업 reserve 안에 포함한다. 기존 CCU 간격을 변경하거나 한 run의 제한 때문에 기존/신규 게임이 굶는 설정은 gate에서 거부한다.
- `init-state`는 fresh read-only inventory의 기존 Steam 24h 실제 시도 수를 첫날 debit으로 넣는다. 전송한 척 기록하지 않고 `BASELINE_DAY_DEBIT`로 구별한다. gate는 과거 debit + 미래 기존 1일 예상 + 신규 최악 재시도 + reserve를 보수적으로 계산한다. 외부 제공자의 한도 보장이나 무중단 보장은 아니다. timeout·other endpoint/auth quota는 추가 검토해야 한다.
- 429는 최소 60초/Retry-After 동안 전역 차단한다. 403·5xx·redirect·불명확한 네트워크 실패도 cooldown을 둔다. 403 뒤 다른 키로 우회하지 않는다. 기존 401의 제한된 fallback은 같은 장부 아래 유지한다. 새 발견/metadata는 요청당 외부 전송 1회이며 자동 재시도하지 않는다.
- 재시작·실패로 비용을 환급하거나 장부를 초기화하지 않는다. 파일 유실·손상·ID 불일치·row 삭제·시계 역행·해결되지 않은 예약은 호출을 막는다. 유효한 예전 장부를 VM 전체와 같이 되돌린 경우까지 자동 검출한다고 주장하지 않는다. state/staging/policy 디렉터리를 별도로 보호하고 원본과 최신 장부를 보존한다.
- guard에 의한 CCU 차단은 게임의 availability/failure_count를 변경하지 않는다. 해당 task를 재개 가능한 PENDING으로 남기고 현재 run을 실패/부분 실패로 중단한다. 남은 모든 게임을 개별 실패로 소진하거나 정상 수집으로 보고하지 않는다. 전역 보호가 작동하는 동안 관측 간격이 생길 수 있으므로 무중단을 보장하지 않는다.
- SQLite와 PostgreSQL은 분산 원자 transaction이 아니다. 중간 실패 시 metadata만 적재되거나 일부 게임만 적용될 수 있다. immutable decision/event와 RAW를 확인하고 **같은 plan/장부**로 재개한다. 다른 plan 생성·장부 재생성으로 우회하지 않는다. metadata 요청의 HTTP 장부는 staging/budget에 있으며 기존 PostgreSQL `api_call_attempt` 집계만 보면 새 발견 호출이 빠진다는 점에 유의한다.

## 운영 전 확인과 설정

`inventory.py`는 운영자가 실행하는 stdlib 도구다. 원문 shell/config/env/log를 내보내지 않으며 source/exec로 수집기를 실행하지 않는다. DB는 명시한 계정으로 `BEGIN READ ONLY`, statement 3초/lock 500ms timeout, `ROLLBACK`만 실행한다. 거부/timeout은 미확인이고 0건이 아니다. wrapper SHA만으로 전체 shell 분기·mount·lock을 검증한 것으로 보지 않는다.

호스트에서 `/app/config`를 찾을 수 없을 때 이를 설정 없음으로 단정하지 않는다. `--inspect-image-configs`를 명시하면 이미 존재하는 image ID로 잠깐 실행하는 **진단용 Python container**에서 `/app/config`의 허용된 설정 필드만 읽는다. 기존 collector entrypoint를 실행하지 않고, pull·network·host volume·env-file을 전달하지 않으며 20초 timeout과 메모리/CPU 제한을 사용한다. 자신의 이름/label을 확인한 진단 container만 정리한다. 기존 운영 container에는 exec/stop/restart를 하지 않는다. 원문 설정/키/환경변수/설정 파일 hash는 내보내지 않는다.

이 결과의 `PINNED_IMAGE_DEFAULT`는 이미지 기본값이다. 실제 wrapper가 어느 profile을 고르고 어떤 mount로 덮는지 검토한 뒤에만 `image_config_wiring_reviewed=true`를 설정한다. 그렇지 않으면 gate가 차단한다. `wrapper.structure`와 cron structure는 안전한 static token/변수 참조이며 미분류 literal은 생략한다. 이를 실행 가능한 원문이나 전체 shell 의미 검증 결과로 취급하지 않는다. 기존 pinned collector가 DB에 쓰는 job code는 `STEAM_CCU`이며 CLI의 `steam-ccu`와 구별한다. 성공 확인용 policy도 실제 DB job code를 사용한다.

필수 신규 변수(값 자체는 비밀이 아닌 feature wiring):

| 이름 | 용도 |
| --- | --- |
| `YOUTOPIA_STEAM_GUARD_ENABLED` | 기본 `0`; 검토한 모든 Steam job에서 함께 `1` |
| `YOUTOPIA_STEAM_GUARD_POLICY` | 컨테이너 내부의 검토 완료 JSON 절대경로 |
| `YOUTOPIA_NEW_RELEASES_ENABLED` | 기본 `0`; admission과 source promotion/provenance를 켤 때 `1` |

기존 `APP_ENV`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_COLLECTOR_SCHEMA`, `DB_RAW_SCHEMA` 및 Steam 키 변수는 기존 보호된 env-file에서만 전달한다. 앱 계정·Redis·Java·nginx·서비스 unit·control 설정을 다시 만들지 않는다. DB 비밀번호/키를 새 policy·ZIP·Git·채팅에 복사하지 않는다.

`policy.example.json`의 null/false는 미확인 항목이다. 그대로는 실행되지 않는다. 호스트명·DB명·실행 wrapper SHA·실제 CCU config/간격·이미지 ID·최근 CCU 성공 job 이름·실제 사용량/다른 호출자·한도를 검토하고 채운다. `state_id`는 한 번 만든 UUID 식별자로, 비밀키가 아니며 재시작 때 바꾸지 않는다. JSON policy는 readonly mount, state/staging은 동일한 persistent mount로 모든 job에 전달한다. 파일은 0600, 부모는 0700 권장, 다른 사용자 쓰기를 금지하고 UID/GID 10001이 읽고 쓸 수 있어야 한다. 장부를 container layer나 임시 `/tmp`에 두지 않는다.

## 명령 순서와 복구

다음은 **컨테이너 안의 CLI 순서**다. 호스트 docker 옵션·기존 lock·config path·network·env-file은 실제 wrapper와 대조한 운영별 실행안에서 채운다. 임의의 예시 경로를 운영 경로로 간주하지 않는다. 운영자의 구체적 검토 전에는 `--execute`나 cron 변경을 수행하지 않는다.

```text
python -B -m collector_readiness assess --inventory INVENTORY --policy POLICY --output UNIQUE_GATE_JSON
python -B -m collector_readiness init-state --inventory INVENTORY --policy POLICY --staging STAGING
python -B -m collector_readiness status --policy POLICY
python -B -m collector_readiness discover --inventory INVENTORY --policy POLICY --staging STAGING --limit REVIEWED_PAGE_CAP
python -B -m collector_readiness hydrate --inventory INVENTORY --policy POLICY --staging STAGING --genre-mapping REVIEWED_MAPPING --limit REVIEWED_METADATA_CAP
python -B -m collector_readiness plan --staging STAGING --as-of UTC_TIME --release-days 30 --maximum-games REVIEWED_CAP --interval-minutes EXISTING_INTERVAL --existing-app-ids VERIFIED_JSON_ARRAY --output UNIQUE_PLAN_JSON
python -B -m collector_readiness admit --inventory INVENTORY --policy POLICY --staging STAGING --plan PLAN --project-root ROOT --config CONFIG --overrides OVERRIDES
```

최초 `init-state`은 shared wiring 직전 실행할 수 있으나 나머지 evidence/budget gate를 모두 통과해야 한다. 일부 파일만 초기화됐다면 자동 재초기화하지 말고 원인을 확인한다. 이후는 `status`를 사용한다. `discover`의 `--limit`은 페이지 수, `hydrate`는 AppID 수다. scan 미완료·메타데이터를 받지 못한 후보는 남겨 두고 완료나 전체 표본 확보로 보고하지 않는다. 최초 발견 전체 scan을 마쳐도 metadata 상한이 작으면 신작 전체를 확인한 것은 아니다. plan의 제외/대기 목록을 검토한다.

`registered_app_ids` inventory 조회가 OK이면 그 `data` 배열을 기존 ID 파일로 사용할 수 있다. 100001개에 도달하면 절단 가능성이 있으므로 사용하지 말고 별도 읽기 전용 export를 검토한다. admission은 실제 target 행을 다시 조회한다. inventory/plan은 6시간이 지나면 새로 검증한다.

실제 admission은 기존 wrapper의 lock을 획득하고 진행 중 작업이 끝난 뒤 위 명령에 **명시적으로** `--execute`를 추가할 때만 DB metadata/signal/CCU target을 변경한다. 내부 cohort lock도 별도로 적용한다. 후보 수/호출 여유가 충분하다고 검토한 소규모 cohort부터 시작하고, 첫 정상 슬롯의 기존+신규 game 성공·관측 수/마지막 시각·403/429/timeout·지연·장부 사용량을 확인한 뒤 유지 여부를 결정한다.

복구는 같은 원본 plan과 staging으로 다음을 먼저 preview한다. 이것은 readiness gate가 실패하거나 key가 없어도 외부 호출 없이 가능하다.

```text
python -B -m collector_readiness rollback --staging STAGING --plan ORIGINAL_PLAN --project-root ROOT --config CONFIG --overrides OVERRIDES
```

진행 중 job 종료와 기존 lock 확보 후 `--execute`를 명시하면 해당 admission signal만 deactivated로 표시한다. 다른 현재 유효 source가 없는 새 기능 출신 target만 즉시 중단하고 해당 게임의 PENDING CCU task만 CANCELLED+감사 outcome으로 남긴다. CLAIMED/RUNNING task가 있으면 차단한다. 기존 Top/다른 유효 source, YouTube, RAW/과거 관측, 예산 장부는 보존한다. 그 뒤 새 기능을 끄고 wrapper를 보관본으로 돌리는 구체적 파일 복구안을 검토한다. 기능 flag만 끄면 기존 72h 유예 동안 호출이 계속될 수 있으므로 즉시 중단 절차를 생략하지 않는다. 403/429나 장부 유실 상태에서 무계량 구버전으로 우회 재개하지 않는다. DB 전체 restore·replay·이미지 prune는 복구 절차에 없다.

process crash의 RESERVED 한 건은 `status`의 unresolved ID로 확인한다. collector lock 확보·진행 중 worker 없음·외부 전송 여부 불명확함을 확인한 뒤 `resolve-unknown --policy POLICY --request-id ID --confirm-no-running-worker`로 NETWORK_UNKNOWN 처리할 수 있다. 예약 수는 유지하고 5분 cooldown을 둔다. 한도 리셋 수단으로 쓰지 않는다.

## 격리 검증

```bash
python3 -B -m unittest discover -s tools/tests/collector_readiness -p 'test_*.py' -v
docker build -t collector-readiness:review -f tools/collector_readiness/Dockerfile .
```

`tools/tests/collector_overlay`는 해당 이미지 안의 실제 parser/transport/repository/CCU job과 PostgreSQL 16에 대해 실행한다. 전용 internal Docker network, 외부 포트 없는 임시 PG, 환경변수 `YOUTOPIA_ISOLATED_TEST_PG=ytp-collector-prep-test-pg`가 필요하다. 테스트는 명시한 disposable fixture DB만 초기화한다. 운영 network/host/credential을 전달하지 않는다. 실제 Steam 요청은 모두 mock이며 운영 적용 성공·제공자 실연동 검증·전체 collector 회귀 전체 통과를 뜻하지 않는다.
