# YOUTOPIA — G2-D 로컬 오디오 파형 QA 작업공간 v0.1

> 날짜: 2026-11-05 KST
> 브랜치: `experiment/yu-video-understanding-poc-v01`
> 상태: **WORKSPACE_SOURCE_AND_SYNTHETIC_TESTS_READY / WINDOWS_REAL_MEDIA_UI_ACCEPTANCE_NOT_RUN**
> 사용자는 앞서 G2-C 공식 Blender 영화 두 편을 다운로드했고 G2-D JSON 작성 예시까지 수행했다. 이 작업공간은 그 동일한 파일을 재사용한다.

## 1. 실제 문제와 목표

기존 G2-D에서 VLC의 시각 표시가 초 단위라서 `01:28.803` 등을 찾기 어렵고, 사용자가 VLC·YouTube·VS Code JSON을 번갈아 전환해야 했다.

이 문제를 해결하기 위한 **독립 로컬 QA 작업공간**을 구현했다.

- 좌측: G2-D 오디오 첫·중간·마지막, YouTube 전·중·후 장면, Tears 09:27 이후 자막 누락 검수 체크포인트.
- 중앙 상단: 로컬 영화를 브라우저에서 재생하고 **SRT 자막을 영상 위에 표시**.
- 중앙 아래: 실제 로컬 원본 **오디오 진폭 파형**(50ms 구간별 peak) + SRT 해당 구간 + 현재 영상 위치 + 선택된 QA 지점 마커. 클릭·드래그로 시각 이동, 0.1초 단위 미세 이동, 파형 표시 범위 20/60/120초 및 전체 보기.
- 우측: 클릭으로 활성화되는 [YouTube 공식 임베드](https://support.google.com/youtube/answer/171780), 외부 페이지 열기 대안, 게시자 확인, YouTube 총 재생시간 입력.
- 하단: `OBSERVED_MATCH` / `OBSERVED_DIFFERENCE` / `UNCERTAIN` / `NOT_REVIEWED` 판정, 현재 음성 시작 타임코드 캡처, YouTube 대응 시각 입력, 관찰 노트, 로컬 JSON 저장.

**정확도 경계:** 오디오 파형은 소리 진폭이며 **사람의 말소리·배경 음악·효과음을 구분하지 못한다**. 대사 시작의 정밀한 판정에는 사용자의 시청/청취가 필요하다. 추가로 브라우저 재생을 위해 H.264 MP4를 만들 때 FFmpeg가 원본 비디오 스트림을 복사하고 오디오는 AAC로 변환하므로, 아주 작은 오디오 인코딩 지연이 생길 수 있다. 따라서 이 UI의 1ms 단위 시계 표시를 원본과의 1ms 정확도 입증으로 해석하면 안 된다. G2-D의 샘플 관찰은 ±1,500ms 이내 **운영자 보고**이며, 자동으로 영상 전체 동일성을 판정하지 않는다.

## 2. 데이터·권리 경계

- **원본 영상/SRT 사용:** `%LOCALAPPDATA%\YOUTOPIA\G2C-AuthorizedPublisherMedia`의 기존 파일만 사용. 원본 재다운로드 없음.
- **검수 기록:** `%LOCALAPPDATA%\YOUTOPIA\G2D-ManualReviews\{Film}-manual-review.json`에서 읽고 저장. 이미 입력한 데이터가 있으면 그대로 불러온다.
- **임시 브라우저용 MP4·오디오 파형:** `%LOCALAPPDATA%\YOUTOPIA\G2D-Workspace-Cache`에 생성. 원본 파일 수정 없음. MP4 캐시가 추가 저장 공간을 사용한다.
- **서버:** Windows PC의 `127.0.0.1`에만 바인딩되며, URL의 지정된 `/movie` 경로로만 로컬 캐시 동영상을 제공한다. `/api/save`는 동일 오리진·기존 검수 JSON 리비전·불변 필드 일치를 확인한 뒤 사용자 클릭으로 저장한다. 영상/자막 원문을 GitHub·클라우드·LLM API로 송신하지 않는다.
- **YouTube:** 사용자가 **외부 플레이어 열기** 버튼을 눌렀을 때만 브라우저에서 `youtube-nocookie.com`의 공식 임베드 재생기가 로드된다. 외부 서비스이므로 네트워크 요청이 일어난다. 임베딩 제한(비활성화·연령·지역)에 걸리면 YouTube 원본 페이지 열기 링크로 이동한다. YouTube 스트림 추출·다운로드, 외부 영상 프레임 캡처, YouTube Data API 사용은 없다.
- **서비스 승인:** 여전히 `filmRightsForServiceVerified=false`, `fullYoutubeEditionEquivalenceVerified=false`, `g3Authorized=false`.

## 3. 현재 Windows PC에서 실행

앞서 사용한 기존 검증 Worktree `C:\Projects\YOUTOPIA-VIDEO-G2C`를 그대로 사용한다. **새 브랜치나 새 Worktree를 만들지 않는다.**

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch 실패' }

cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw '검증 Worktree의 변경 사항을 먼저 검토' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw '실험 브랜치 갱신 실패' }

# 이미 작성한 G2-D 검수 JSON이 있는지 확인
Test-Path "$env:LOCALAPPDATA\YOUTOPIA\G2D-ManualReviews\Sintel-manual-review.json"

# 로컬 파형 QA 화면 실행 (블렌더 원본 재다운로드 없음)
& .\shared\experiments\yu-video-understanding-poc-v0\g2d-open-workspace.ps1 -Film Sintel
```

출력된 `G2D_LOCAL_WORKSPACE_READY http://127.0.0.1:<port>/` 주소를 **같은 PC의 브라우저**에서 연다. 프로그램 실행 후 처음에는 FFmpeg가 MP4 검수용 사본과 파형 데이터를 생성하므로 별도의 LocalAppData 저장 공간이 필요하다. 이 작업은 **프록시 생성과 파형 분석**이며 YouTube 다운로드가 아니다.

두 번째 영화 검수는 PowerShell에서 `Ctrl+C`로 실행 중인 서버를 종료하고 아래처럼 실행한다.

```powershell
& .\shared\experiments\yu-video-understanding-poc-v0\g2d-open-workspace.ps1 -Film TearsOfSteel
```

`ffmpeg`, `ffprobe`, `node`는 PATH에서 실행 가능해야 한다. 현재 사용자는 G2-C에서 ffprobe/Node를 이미 사용했으며 FFmpeg는 설치한 Gyan.FFmpeg 패키지에 포함된다. 만약 새 VS Code 터미널에서 찾지 못한다면 Windows 사용자 PATH 갱신 또는 VS Code 완전 재시작을 먼저 한다.

G2-D 검수 JSON이 없다면, 기존에 제공한 아래 계획 명령으로 생성한다. **이미 존재하면 덮어쓰지 않는다.**

```powershell
$reviewScript = '.\shared\experiments\yu-video-understanding-poc-v0\g2d-windows-manual-review.ps1'
& $reviewScript -Mode Plan -Film Sintel
```

## 4. 실제 검수 사용 순서

1. 좌측 `AUDIO_FIRST` 선택 → 중앙 원본이 해당 시점보다 4초 전으로 이동한다.
2. 중앙 파형에서 대사 시작 부근의 소리 진폭을 관찰하고 직접 음성을 듣는다. 소리가 큰 막대가 **반드시 대사는 아니다**. 초당 정밀 비교가 필요하면 확대(20초), 클릭·드래그, ±0.1초 버튼을 사용한다.
3. 음성이 실제 시작되는 순간에 영상을 일시정지한 뒤 **현재 로컬 시점을 기록**을 누른다. 하단에 밀리초 정수로 환산 가능한 시간이 채워진다.
4. 확인한 사실에 따라 `OBSERVED_MATCH` / `OBSERVED_DIFFERENCE` / `UNCERTAIN`을 선택하고 12~300자의 **직접 관찰 메모**를 입력한다. 그 뒤 **관찰 결과 저장**을 누르면 기존 로컬 검수 JSON이 업데이트된다. 일치 판정에는 기존 G2-D 검사기의 ±1,500ms 제약을 적용한다.
5. 좌측 `YOUTUBE_OPENING` 등을 선택하면 로컬 영상이 검사 장면 부근으로 이동한다. **YouTube 플레이어 열기**를 클릭하여 외부 YouTube에서 직접 대응 장면을 찾는다. 우측의 게시자 및 전체 길이 확인을 함께 입력하고, **YouTube 대응 장면 시각은 직접** 입력한다. 공식 게시자가 확인되지 않았다면 `OBSERVED_MATCH`로 표시하지 않는다.
6. Tears에서는 `COVERAGE_AFTER_CAPTIONS`, `COVERAGE_NEAR_END`를 살펴본다. 자막이 09:27에 종료된 이후 영상 끝까지 발화 누락 여부를 청취한다. 두 체크포인트만 확인해 후반 전체를 자동 승인하지 않는다.

저장 실패 시, 편집한 JSON을 동시에 VS Code에서 수정했는지 확인한다. 서버는 파일의 수정 충돌을 거부하므로 브라우저에서 **새로고침 후** 해당 입력을 다시 해야 한다. JSON의 검사 지점·SHA-256·판본·`g3Authorized` 필드는 변경할 수 없다.

## 5. 완료와 미완료

| 범위 | 상태 |
|---|---|
| 로컬 서버·영상 프록시·파형 생성·QA 화면 및 JSON 저장 코드 | 구현 |
| 기존 G2-D 오프라인/합성 회귀 테스트 | 자동 실행 |
| 실제 사용자 Windows의 동영상 로딩/YouTube 임베드/UI 수동 QA | **아직 미실행** |
| 실제 음성–자막 사람 검수 및 YouTube 동일성 | **아직 미실행** |
| 2인 골드 정답·권리·G3 유료 API 및 운영 병합 | **승인 보류** |

현재의 작업공간은 **실험 브랜치 내 QA 도구**이지 정식 YOUTOPIA 사용자 기능이 아니다. 사용자는 JSON을 직접 편집하는 대신 이 화면에서 검수 결과를 입력할 수 있지만, 저장된 데이터에 의해 서비스/G3 승인 상태가 자동으로 바뀌지는 않는다.


## 6. 운영자 보고: Sintel 로컬 플레이어 기능 QA (2026-11-05)

**증거 등급: USER_REPORTED_VISUAL_FUNCTIONAL_QA / NOT_INDEPENDENTLY_REPLAYED.**

사용자는 실제 Windows PC 브라우저에서 G2-D 작업공간과 오디오 파형이 표시된다고 보고한 뒤, 다음 **5개 기능이 모두 정상 작동**한다고 확인했다.

| 기능 | 운영자 보고 |
|---|---|
| 로컬 Sintel 영상과 소리 재생 | PASS |
| 파형 클릭 시 로컬 영상 재생 위치 이동 | PASS |
| 재생 시각 밀리초 단위 표시 | PASS |
| 앞뒤 0.1초 단위 이동 | PASS |
| 해당 시점의 영어 SRT 표시 | PASS |

이 확인은 화면 재생 기능의 수동 QA이며, 소리 진폭 파형이 인물 발화의 시작점을 정확히 나타낸다는 뜻이 아니다. **AUDIO_FIRST의 실제 음성 타이밍 일치, YouTube 공식 게시자 확인·임베드 동작·영상 판본 일치, JSON 저장 기능, Tears 영상 UI 수동 검증은 이 보고만으로 PASS 처리하지 않는다.** 영상 전체 동일성/권리/G3 게이트는 여전히 차단이다.

### 다음 운영자 QA: YOUTUBE_OPENING

1. Sintel에서 `YOUTUBE_OPENING`을 선택한다. 원본 기준 체크포인트 시간은 `localMs=88803` (약 **01:28.803**). 비교 전후 여러 초간을 재생한다.
2. 우측 `YouTube 플레이어 열기`를 클릭하고, 영상이 임베드에서 정상 실행되는지 확인한다. 재생이 제한되면 우측 원본 페이지 링크로 비교한다.
3. 업로더와 YouTube 총 재생시간을 직접 확인해 기록한다. 공식 제작자임을 확인할 근거가 없으면 `UNVERIFIED`를 사용하고 **`OBSERVED_MATCH`를 강제로 선택하지 않는다**.
4. YouTube에서 같은 사건/컷 순서/음성 이벤트를 실제로 찾은 뒤 해당 시각을 mm:ss.SSS 형식으로 `YouTube 대응 장면 시각`에 입력한다. 시스템은 YouTube 시간을 자동으로 읽거나 제어하지 않는다.
5. 확실한 관찰 결과만 판정하고 비식별 `observationNote`를 작성하여 저장한다. 이후 `YOUTUBE_MIDPOINT`, `YOUTUBE_ENDING` 순으로 확대한다. **일부 샘플이 일치해도 전체 편집 동일성은 미검증이다.**

현재 판정: `G2D_SINTEL_LOCAL_PLAYER_MANUAL_QA_PASS_5_OF_5_REPORTED / YOUTUBE_COMPARISON_PENDING / G3_HOLD`.


## 7. 독립 재생 / 연동 재생의 운영자 설정 (2026-11-05 추가)

**목표:** 첫 번째 비교 지점에서 로컬 영화와 YouTube 영상의 대응 장면을 각각 찾아 일시정지한 뒤, 관찰된 시간 차이를 보정하여 이후 검수 시점을 편하게 탐색한다. **동일 영화·동일 편집판 인증 기능은 아니다.**

### 7.1 UI 동작

- **독립 재생(기본값):** 영상 두 개를 서로 다른 시점으로 자유롭게 탐색·재생할 수 있다. 브라우저를 새로 열면 항상 독립 모드로 시작한다.
- **현재 두 시점으로 기준점 기록:** 공식 YouTube 임베드가 API에 연결되고 두 영상이 **모두 일시정지된 상태**에서만 허용한다. 로컬 시점과 YouTube 시점 차이를 초 단위로 계산한다.
- **연동 재생:** 기준점 기록 이후 활성화할 수 있다. 연동 켜기 시 로컬 시점과 기록된 오프셋으로 YouTube 시점을 정렬한다. 이후 로컬 영상의 재생/일시정지/탐색은 YouTube에도 전달된다. YouTube 재생/일시정지 변경은 로컬에도 적용된다. YouTube의 큰 시점 점프(수동 탐색으로 보이는 불연속)를 일정 간격으로 감지하여 로컬 시점에 반영한다.
- **로컬 → YouTube / YouTube → 로컬:** 연결 모드와 관계없이 기록된 오프셋에 따라 한쪽의 현재 시점으로 다른 쪽을 명시적으로 맞출 수 있다. YouTube 수동 탐색이 짧아 자동 감지되지 않으면 이 버튼을 사용한다.
- **독립 재생으로 복귀:** 언제든 연동을 해제할 수 있다. 영상이 다른 편집판·인트로·컷 순서를 보여 원래 보정값이 부정확해질 경우 반드시 독립 상태에서 새 기준점을 찾고 다시 기록한다.
- **보정값 저장:** 영상/개인 정보 유출을 막고 원본 증거와 혼동하지 않기 위해 `offsetSeconds`는 **브라우저 화면 메모리에서만 유지**한다. JSON 검수 기록의 시간, 공식 판본 판정, `g3Authorized` 등은 변경하지 않는다.

### 7.2 기준점을 찾고 연동하는 순서

1. 현재 Windows QA 로컬 서버가 실행 중이면 해당 터미널에서 `Ctrl+C`로 종료한다.
2. 기존 실험 Worktree를 최신 원격 SHA로 전환한다(아래 명령). 기존 검수 JSON과 Blender 미디어는 Git Worktree 바깥 AppData에 있으므로 전환 중 유지된다.
3. Sintel QA 화면을 다시 열고 우측의 **YouTube 플레이어 열기**를 누른다. 이때 브라우저가 외부 YouTube 공식 IFrame API를 불러온다. 별도의 YouTube Data API 키나 모델 API가 필요하지 않다.
4. 독립 모드에서 로컬 화면과 YouTube 화면 각각에서 **같은 사건·컷 경계**를 찾는다. 둘 다 일시정지한다. 우측 임베드에 제한이 있다면 수동 비교는 가능하나 **플레이어 API 연동은 불가능**하므로 독립 모드로 유지한다.
5. **현재 두 시점으로 기준점 기록**을 클릭한다. 예를 들어 로컬 01:28.803 / YouTube 01:31.000이라면 오프셋은 **+2.197초**가 된다. 이 값은 샘플 설명이며 실제 관찰값이 아니다.
6. **연동 재생**을 클릭한다. 로컬 파형에서 시점을 바꾸거나 ±0.1초 버튼을 눌렀을 때 YouTube도 해당 오프셋으로 이동하는지 확인한다. 재생/일시정지 연결도 점검한다.
7. YouTube를 직접 큰 폭으로 탐색했을 때 로컬도 이동하는지 확인한다. 짧거나 빠른 탐색은 자동 감지되지 않을 수 있으므로 **YouTube → 로컬** 버튼으로 명시 정렬한다.
8. 다음 QA 체크포인트(`YOUTUBE_MIDPOINT`, `YOUTUBE_ENDING`)를 확인하며 시점 차이가 늘어나거나 컷 순서가 다르면 독립 재생으로 돌아가 재비교한다. **동기화 성공 자체를 `OBSERVED_MATCH`로 사용하지 않는다.**

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed' }

cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw 'Worktree 변경 확인 필요' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw '실험 Worktree 갱신 실패' }

& .\shared\experiments\yu-video-understanding-poc-v0\g2d-open-workspace.ps1 -Film Sintel
```

### 7.3 경계·한계와 정확도

**기술적 동작과 영상이 실제로 동일한지는 별개**다. 공식 [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)는 `playVideo`, `pauseVideo`, `seekTo`, `getCurrentTime`, `getDuration` 및 `onStateChange`를 제공한다. 이 기능들은 사용자가 버튼을 눌러 임베드를 열었을 때 브라우저에서 이용하며, YouTube 파일 다운로드나 서버 API 호출을 수행하지 않는다.

- YouTube의 `seekTo`는 키프레임 근처로 이동할 수 있고, 재생 지연·네트워크 버퍼링·재생 속도 차이 때문에 정확히 같은 밀리초를 보장하지 않는다.
- YouTube API는 별도의 `seeked` 이벤트를 제공하지 않는다. 구현은 **650ms 간격으로 큰 시점 점프만 감지**한다. 1~2초 이내의 수동 점프는 자동으로 따라가지 않을 수 있다.
- 외부 임베드 정책·광고·자동재생 제한·브라우저 권한에 따라 연동 재생이나 자동 재생이 작동하지 않을 수 있다. 이 경우 로컬 독립 비교, 수동 시점 입력으로 검수해야 한다.
- 보정값은 단일 대응 장면에서 계산한 값이므로, 중간에 컷이 추가·삭제된 판본에는 전 구간에서 적용되지 않을 수 있다.
- 유료 LLM API, YouTube Data API 키, 영상 프레임 캡처/스트림 추출, 원본 업로드, 권리 승인, G3 승격, 브랜치 병합: **모두 없음**.

### 7.4 QA 통과 기준

| 기능 | 이 변경의 코드 검증 | 실제 Windows 수동 확인 |
|---|---|---|
| 기본 독립 모드/기준점 없는 연동 차단 | 합성 단위 테스트 | 미실시 |
| 서로 다른 영상 시점으로 오프셋 기록 | 합성 단위 테스트 | 미실시 |
| 독립↔연동 전환, 로컬→YouTube 탐색 | 합성 단위 테스트 | 미실시 |
| YouTube→로컬 탐색·재생·일시정지 반영 | 합성 단위 테스트 | 미실시 |
| 임베드 실패 시 독립 모드 복귀 | 합성 단위 테스트 | 미실시 |
| 시간 차이·판본 차이의 인간 QA | 자동 판정 불가 | 미실시 |

**현재 단계는 기능 코드 검증이며 실제 YouTube 임베드/두 영상 연동 현장 QA는 사용자 PC에서 확인해야 한다.**


## 8. 운영자 보고: 독립·연동 재생 기능 현장 QA (2026-11-05)

**증거 등급: USER_REPORTED_UI_QA / NOT_INDEPENDENTLY_REPLAYED.**

앞 절에서 권고한 G2-D 브라우저 현장 QA(YouTube 플레이어 열기, 각각 대응 장면 찾기, 두 영상 일시정지 후 기준점 기록, 연동 재생에서 로컬 탐색·재생·일시정지 연결, YouTube 측 탐색의 로컬 반영)에 대해 운영자가 **`QA 이상 없음`**을 보고했다.

| 확인 범위 | 기록 |
|---|---|
| YouTube 임베드 재생 및 비교 가능한 화면 | 운영자 보고 PASS |
| 독립 재생에서 대응 시점 탐색과 일시정지 | 운영자 보고 PASS |
| 두 재생 시점의 기준점 기록·오프셋 표시 | 운영자 보고 PASS |
| 연동 상태의 탐색·재생·일시정지 조작 | 운영자 보고 PASS |
| YouTube 측 탐색 시 로컬 위치 반영 또는 명시 정렬 | 운영자 보고 PASS |
| 임베드 오류·자동재생 제한 등 모든 장애 경로 | **별도 현장 시험 기록 없음** |
| 음성↔SRT 실제 시간적 일치 및 YouTube 게시판 전체 동일성 | **판정 자료 미제출** |
| 검수 JSON 두 편의 Checkpoint별 `Assess` 결과 | **아직 미수신** |

운영자 보고를 근거로 **G2-D 독립/연동 영상 비교 도구의 주요 정상 사용 경로에 대한 현장 QA를 PASS로 접수**한다. 단, 이는 관찰과 기록을 돕는 UI 자체의 검수이며, 작품 두 편의 실제 동기화·정답 데이터·사용권·YouTube판 동일성 검증을 통과시킨다는 의미가 아니다.

**다음 작업은 새 기능 추가가 아니라 실제 내용 검수와 기록**이다. G2-D 작업공간에서 각 작품의 `AUDIO_FIRST/MIDDLE/LAST`, `YOUTUBE_OPENING/MIDPOINT/ENDING` 및 Tears 후반 자막 커버리지 2항목을 실제로 확인한 뒤 저장하고 아래 명령으로 판정한다.

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
$script = '.\shared\experiments\yu-video-understanding-poc-v0\g2d-windows-manual-review.ps1'
& $script -Mode Assess -Film Sintel
& $script -Mode Assess -Film TearsOfSteel
```

실제 관찰값을 추정해 `OBSERVED_MATCH`를 채우지 않는다. 게시자·판본 또는 음성 싱크가 불확실하면 `UNCERTAIN`, 직접 관찰한 불일치는 `OBSERVED_DIFFERENCE`로 기록한다. 전 항목이 일치해도 `OPERATOR_REPORTED_SAMPLED_MATCHES_NOT_FULL_PROOF`이며 G3 유료 호출과 병합은 별도 승인 전까지 **BLOCKED**다.

현 상태: `G2D_MAIN_PLAYBACK_UI_QA_OPERATOR_PASS / G2D_CONTENT_REVIEW_PENDING / G3_NOT_APPROVED / NO_MERGE`.


## 9. 운영자 제출 Sintel G2-D 표본 6/6 결과 (2026-11-05, 최신)

**증거 등급: USER_SUBMITTED_LOCAL_ASSESS_JSON / NOT_INDEPENDENTLY_REPLAYED.**

사용자가 Windows 로컬 `g2d-windows-manual-review.ps1 -Mode Assess -Film Sintel`을 실행하고 제출한 최종 출력으로, 초기 `OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW`(오프셋 편차 2,803ms)를 재검수한 후 최신 상태를 기록한다.

| 검증 항목 | 최종 사용자 제출 결과 |
|---|---|
| 상태 | `OPERATOR_REPORTED_SAMPLED_MATCHES_NOT_FULL_PROOF` |
| 6개 체크포인트 | `match=6`, `difference=0`, `unknown=0`, `unreviewed=0` |
| AUDIO_SYNC | 3/3 일치 보고 |
| YOUTUBE_SCENE | 3/3 일치 보고 |
| YouTube 게시자 | `OFFICIAL_OWNER_CONFIRMED` (운영자 관찰·독립 검증 아님) |
| YouTube 전체 재생시간 차이 | `-32ms` (`WITHIN_TWO_SECONDS_NOT_FULL_EQUIVALENCE`) |
| 세 샘플 YouTube-로컬 오프셋 최대 편차 | **1,000ms** |
| 샘플 오프셋 일관성 | `OPERATOR_REPORTED_CONSISTENT` |
| 사용자 보고 근거의 독립 검수자 | `0` |
| 전체 음성–자막 싱크 검증 | `false` |
| 전체 YouTube 게시본–로컬 판본 동등성 | `false` |
| 서비스 사용권 / 골드 질문 정답 검수 | `false` |
| G3 외부 모델 API 실행 승인 | `false` |
| 외부 공급자 API 호출·실험 비용 | `0` / `$0` (사용자 로컬 검증 출력 기준) |

**구별할 점:** 사용자는 재생 편의상 오프셋을 +5초로 통일하겠다고 보고했으나, 실제 제출된 최종 `Assess` 값은 `youtubeSampleOffsetSpreadMs=1000`이다. 즉 **세 개의 기록된 오프셋이 정확히 모두 +5,000ms라는 증거는 아니다.** 단위 테스트의 2,000ms 허용 범위 안이므로 표본 일치 검수는 통과했다. 숫자를 인위적으로 0으로 맞추거나 기록을 변경할 필요는 없다.

**범위:** 본 PASS는 Sintel의 **운영자 제출 표본 6/6에 관한 판정**이다. 영화 전체 편집판 동일성, 법적 권리, 사람 2명의 독립 검수 또는 G3 실행 허가를 뜻하지 않는다.

**다음 검수:** Tears of Steel(2012 First HD 720p)의 `AUDIO_FIRST/MIDDLE/LAST` 3개, `YOUTUBE_OPENING/MIDPOINT/ENDING` 3개, SRT 종료 후 `CAPTION_COVERAGE` 2개를 사용자 Windows의 동일한 QA 도구에서 검토하고 로컬 JSON을 저장한다. YouTube 후보는 4K 리렌더판일 가능성이 있어 장면·편집 차이 여부를 독립적으로 주의 깊게 기록한다. 우선 실제 출력 `-Mode Assess -Film TearsOfSteel`을 받아 분리 판정한다.

최신 상태: `G2D_SINTEL_OPERATOR_SAMPLED_MATCH_PASS_6_OF_6 / TEARS_G2D_CONTENT_REVIEW_PENDING / FULL_EDITION_EQUIVALENCE_NOT_VERIFIED / G3_NOT_APPROVED / NO_MERGE`.


## 10. 두 영화 G2-D 운영자 제출 결과 통합 (2026-11-05, 최신)

> 증거 등급: **USER_SUBMITTED_LOCAL_ASSESS_JSON / NOT_INDEPENDENTLY_REPLAYED**. 아래 값은 Windows에서 운영자가 제출한 평가 결과를 기록한 것이다. 어시스턴트가 로컬 영화·SRT 파일이나 YouTube 재생본을 직접 판독하거나 영상을 다운로드한 증거가 아니다.

| 항목 | Sintel | Tears of Steel | 합계 |
|---|---|---|---|
| 운영자 검수 완료 체크포인트 | 6/6 | 8/8 | **14/14** |
| `OBSERVED_MATCH` | 6 | 8 | **14** |
| `OBSERVED_DIFFERENCE` | 0 | 0 | **0** |
| `UNCERTAIN` / `NOT_REVIEWED` | 0 / 0 | 0 / 0 | **0 / 0** |
| 오디오·SRT 발화 시작 표본 일치 보고 | 3/3 | 3/3 | **6/6** |
| 로컬·YouTube 대응 장면 일치 보고 | 3/3 | 3/3 | **6/6** |
| SRT 종료 이후 커버리지 표본 일치 보고 | 해당 없음 | 2/2 | **2/2** |
| YouTube - 로컬 전체 길이 차이 | -32ms | -167ms | 전 구간 등가성 증거 아님 |
| 세 장면 간 시간 오프셋 최대 편차 | 1,000ms | **5,000ms** | Tears 시간축 추가 검토 |
| 검증기 시간 오프셋 판정 | `OPERATOR_REPORTED_CONSISTENT` | `NOT_ESTABLISHED` | 분리 유지 |
| 검증기 상태 | `OPERATOR_REPORTED_SAMPLED_MATCHES_NOT_FULL_PROOF` | `OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW` | 내용 표본의 차이 0, 시간축 경고 1건 |

### 경고의 의미와 허용 가능한 결론

Tears의 검증기가 `OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW`를 반환한 것은 **사용자가 직접 차이를 보고한 체크포인트가 있기 때문이 아니라**, 세 장면의 오프셋 최대 차이 5,000ms가 기존 **2,000ms 기준**을 넘었기 때문이다. 따라서 `counts.difference=0`과 경고 상태는 **서로 모순되지 않는다**. 현재 출력만으로는 해당 편차가 구간별 편집·리렌더판 차이·시각 측정 차이 중 무엇 때문인지 단정할 수 없다.

로컬 Tears는 **2012 FIRST HD 720p**이고 기존 YouTube 후보는 **2013 4K 리렌더 자료와 연계되어 확인된 참조**여서 시간축의 차이를 콘텐츠 의미 불일치나 샘플 평가 실패와 동일시하지 않는다. 오프셋을 숫자상 동일하게 만들기 위한 재입력은 하지 않는다.

Sintel의 표본은 6/6 일치 보고 및 오프셋 편차 1,000ms로 현 검증기의 일관성 기준을 통과했다. 그러나 이것도 영화 전체의 동일 편집판을 입증하지 않는다.

**권고 판정 분리:**
- `G2D_OPERATOR_SAMPLE_OBSERVATIONS_COMPLETE_14_OF_14`
- `G2D_CONTENT_SAMPLES_MATCH_REPORTED_14_OF_14` — 운영자 표본 보고로 한정
- `SINTEL_SAMPLE_TIMELINE_CONSISTENT`
- `TEARS_VARIABLE_OFFSET_REVIEW_REQUIRED`
- `FULL_AUDIO_SYNC_NOT_VERIFIED` / `FULL_YOUTUBE_EDITION_EQUIVALENCE_NOT_VERIFIED`
- `INDEPENDENT_REVIEWERS_0` / `RIGHTS_NOT_VERIFIED` / `HUMAN_GOLD_LABELS_NOT_VERIFIED`
- `G3_API_NOT_APPROVED` / `NO_MERGE`

### 다음 단계 권장

현재 14개 표본의 추가 재검수를 반복하기보다 다음 작업을 **시간/의미 분리**로 진행한다.

1. Tears의 오프셋 차이 5초는 **기록된 제한 사항**으로 보존한다. 실제 YouTube 타임코드를 정답에 사용하려면 변경 지점의 시간 매핑을 별도 추가 검토하되, 콘텐츠 이해 질문의 초안 작성만을 위해 억지로 단일 오프셋을 강제하지 않는다.
2. G2-E 준비 단계에서 영상에 근거한 **실제 골드 질문·정답·근거 시점**을 작성하되, 근거 시간을 `localPublisherMs`와 `observedYoutubeMs`로 따로 표시하고 표본·판본·답변 정확도를 혼동하지 않는다. 실제 독립 검수 완료 전 `HUMAN_GOLD_APPROVED`로 승격하지 않는다.
3. 제3자/음악/초상권 및 공급자 API 송신·보존 권리·운영 범위를 따로 검토하고 첫 G3 외부 호출의 계정·요금 상한·입력 범위·삭제 계획에 대한 별도 승인을 받는다.

**최신 상태:** `G2D_OPERATOR_REVIEW_14_OF_14_SUBMITTED / TEARS_TIMELINE_REVIEW_OPEN / G3_NOT_APPROVED / NO_MERGE`.
