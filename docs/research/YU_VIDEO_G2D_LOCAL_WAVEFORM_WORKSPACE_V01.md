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
