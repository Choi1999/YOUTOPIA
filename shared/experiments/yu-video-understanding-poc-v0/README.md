# YOUTOPIA — 영상 이해 PoC G1 오프라인 평가기

> 상태: G1_OFFLINE_ONLY / SYNTHETIC_FIXTURE / 실제 영상 0건 / 실 API 호출 0건 / 실제 과금 0건

이 디렉터리는 영상 이해 **모델이나 YouTube 수집기**가 아니라, 향후 직접 멀티모달 분석(A), 의미 기반 인덱스(B), 자막 전용(C)을 공정하게 비교하기 위한 **평가 계약의 실행 가능한 시험 장치**다.

Node.js 22 이상(원격 CI는 Node 24)에서 저장소 루트를 기준으로 실행한다.

```powershell
$root = 'shared/experiments/yu-video-understanding-poc-v0'
node --check "$root/g1-offline.cjs"
node --test "$root/tests/offline.test.cjs"
node "$root/g1-offline.cjs"
```

별도 패키지 설치, 키, API 또는 영상 URL이 필요하지 않다. 출력은 가상 데이터로 만든 JSON 보고서다.

## 평가 데이터

가상의 영상 6건(인터뷰 2, 화면 시연 2, 게임/실물 동작 2)과 각 영상당 질문 6개, 총 36문항으로 구성했다.

| 질문 유형 | 개수 |
|---|---:|
| 발화 사실(SPEECH) | 12 |
| 화면 사건(VISUAL) | 8 |
| OCR | 6 |
| 시간·행동 순서(TEMPORAL) | 5 |
| 근거 없는 질문(UNSUPPORTED) | 5 |

모의 응답 108건은 정답, 오답, 시간코드 오류, 잘못된 출처, 누락된 근거 및 무근거 단정의 채점 규칙을 테스트하도록 **사전에 생성된 허구의 답변**이다. 실제 영상, 자막, 음성, 댓글, 모델 API 호출의 결과가 아니다.

## 평가 지표

- `groundedAnswerRate`: 정답 일치 **및** 근거 출처·구간 일치.
- `visualGroundedRate`: 시각·OCR 질문에 대한 근거 있는 정답.
- `unsupportedCorrectRate`: 답이 없는 질문에 정확하게 응답을 보류한 비율.
- `unsupportedClaimRate`: 사실로 단정했지만 정답·근거가 부적절한 비율.
- `evidenceTraceCompleteness`: 합성 scene, contentVersion, rightsEpoch 및 처리 버전의 추적 가능성.
- `temporalEvidenceRate`: 시간 범위 중첩, 중심점 오차 ±5초 및 BEFORE/AFTER 순서 검증.

G1은 질문당 하나의 원자적 답변 식별자만 평가한다. **실제 영상 이해 정확도나 언어적 의미 판정은 아직 검증하지 않았다.**

## 가상 비용 비교

`영상당 N회 질의 총원가 = ingestion + preprocessing + indexing + storage + lifecycle + N × (inference + retrieval + recheck)`

N은 1·5·20회로 평가한다. 모든 단가는 연산 시험용 **임의 가상값**이며 공개 API 요금·실제 청구액·절감 효과가 아니다. 미확인 값은 `null`로 두고 무료(0)로 오인하지 않는다. 어떤 수치가 나와도 판정은 `INCONCLUSIVE_OFFLINE_SYNTHETIC`이다.

## 승인 경계

실 YouTube 접근, URL 수집, 대본 저장, ASR/OCR 실행, 공급자 API 연결, 비용 지출, 운영 DB 연결, Chrome 확장 연결, 기존 UI PR 병합은 모두 **이 단계의 범위 밖**이다. 기존 YOUTOPIA의 `POLICY_HOLD`와 첫 API 호출의 별도 승인 규칙은 변하지 않는다.

상위 평가 계약: `docs/research/YU_VIDEO_UNDERSTANDING_POC_EVALUATION_V01.md`. G2(영상 권리·제공자 정책·요금 검증), G3(유료 API 제한 실험)는 별도 승인 이후 착수한다.

## G2-C — Blender 원본·SRT 로컬 검증 (선택적)

2026-11-05 공식 자료 조사에서 **Sintel / Tears of Steel 모두 CC BY 3.0 공개 배포 및 영어 SRT 목록**이 확인되었다. Sintel의 공개 자료상 재생시간은 14:48, Tears of Steel Blender Studio 공개본은 12:14다. 이 수치는 **로컬 파일에서 측정된 재생시간이 아니다.** 특히 Tears of Steel의 2012 HD 최초판과 2013 4K 재렌더판은 서로 구분해야 한다.

실제 파일이 없더라도 다음 **순수 오프라인 공개 근거 점검**을 실행할 수 있다.

```powershell
$root = 'shared/experiments/yu-video-understanding-poc-v0'
node --check "$root/g2c-offline-verifier.cjs"
node --test "$root/tests/*.test.cjs"
node "$root/g2c-offline-verifier.cjs"
```

권리 검토 후 **제작자 공식 배포처 등 허가된 경로로 이미 확보한 로컬 원본 파일**과 해당 판본의 영어 SRT를 직접 제공하는 경우, ffprobe 설치 및 PATH 등록 후 아래처럼 읽기 전용 검사를 실행한다. 경로는 예시이며 실제 파일을 저장소에 추가하지 않는다.

```powershell
node "$root/g2c-offline-verifier.cjs" --slot SYNTH-VID-05 --video "D:\AuthorizedMedia\sintel.mp4" --srt "D:\AuthorizedMedia\sintel.en.srt"
node "$root/g2c-offline-verifier.cjs" --slot SYNTH-VID-06 --video "D:\AuthorizedMedia\tears_of_steel.mov" --srt "D:\AuthorizedMedia\tears.en.srt"
```

- 외부 네트워크가 없으며 자동 다운로드/YouTube 자막 추출/LLM API 전송/파일 변경을 수행하지 않는다. 도구는 사용자가 지정한 **로컬** 파일에 한정해 SHA-256, 재생시간·픽셀 규격, SRT 구간 개수/중복/원본 러닝타임 범위를 점검한다. SRT 대사 원문은 출력하지 않는다.
- `ffprobe`의 프로토콜을 `file,pipe`로 제한하고 네트워크 URL·재생목록·임의 확장자를 거부한다. `ffprobe`가 없으면 안전하게 실패한다.
- 영상·자막의 로컬 해시가 있어도 **YouTube 재인코딩판과의 장면·음성 동일성, 실제 발화와 자막의 시간 동기화, 서비스 범위 이용권, 독립 골드 정답 검수**는 승인되지 않는다.
- 사용자 공개 결과에 실영상의 내용, 첨부 파일명, 자막 텍스트를 기록하지 않는다. 원본 소유권·취득/저장/전송 권한은 별도의 제한된 증거 기록에서 검토한다.
- **본 단계는 원격 CI에서 실제 미디어를 다루지 않는다.** 원격 CI는 공개 근거 JSON/합성 SRT 테스트만 수행하고 로컬 `--video/--srt` 모드는 실행하지 않는다.

상세 근거: `docs/research/YU_VIDEO_UNDERSTANDING_POC_G2C_BLENDER_SOURCE_EVIDENCE_V01.md`.


## G2-C publisher subtitle text follow-up (2026-11-05)

Sintel 공식 제작자 SRT URL: `https://durian.blender.org/wp-content/content/subtitles/sintel_en.srt`. 공개 자막의 **추출 텍스트**에서 26개 연속 구간(첫 시작 01:47.250, 마지막 종료 10:29.800)을 확인했다. **실제 파일의 원본 바이트 SHA-256은 측정하지 않았다.** 구조화된 시간코드만 `g2c-sintel-publisher-timeline.json`에 있고 대사 전문은 저장하지 않는다. 이후 허가된 로컬 Sintel SRT 검사 결과의 `caption.publisherTimings`은 원본 게시 자막 **텍스트 타임코드 일치 여부**만 표기한다.

Tears of Steel 공식 영어 자막 URL: `https://download.blender.org/demo/movies/ToS/subtitles/TOS-en.srt`. 서버 파일 목록으로 공개 주소를 확인했으나 이번 작업 환경에서 파일 본문을 내려받지 못했다. 공식 영상 2개의 원본 다운로드도 이 환경에서는 실패하여 **실제 영상 ffprobe / 원본 자막 파일 검증은 아직 0/2**다. GitHub CI는 합성 테스트만 실행한다.

Windows PC에서 기존 개발 브랜치를 변경하지 않고 **새 Git Worktree**에 검증기를 체크아웃하려면 다음을 사용한다.

```powershell
cd C:\Projects\YOUTOPIA
if (git status --porcelain) { throw '기존 작업 트리에 변경 사항이 있으므로 먼저 검토하세요.' }
git fetch origin --prune
$testBranch = 'origin/experiment/yu-video-understanding-poc-v01'
git show-ref --verify --quiet "refs/remotes/$testBranch"
if ($LASTEXITCODE -ne 0) { throw '원격 실험 브랜치를 찾지 못했습니다.' }
git worktree add --detach C:\Projects\YOUTOPIA-VIDEO-G2C $testBranch
cd C:\Projects\YOUTOPIA-VIDEO-G2C
$root = 'shared/experiments/yu-video-understanding-poc-v0'
node --test "$root/tests/*.test.cjs"
```

이후 해당 Worktree에서 허가받은 원본 영상과 동일 판본 SRT를 `--video`, `--srt`로 지정해 검사한다. 파일들은 Git에 추가하지 않는다. Worktree 경로가 이미 존재하면 자동 덮어쓰기하지 말고 그 Worktree를 먼저 확인한다.


## G2-C Windows 공식 원본 자동 검증 (실파일 단계)

작업용 Windows PC에서 최신 실험 브랜치를 **별도 Worktree**에 체크아웃하고, 아래의 읽기 전용 계획 모드로 먼저 확인한다.

\`\`\`powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
$worktree = 'C:\Projects\YOUTOPIA-VIDEO-G2C'
if (Test-Path $worktree) { throw '기존 작업 폴더 확인 필요' }
git worktree add --detach $worktree origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw 'git worktree 실패' }
cd $worktree
$script = '.\shared\experiments\yu-video-understanding-poc-v0\g2c-windows-official-media.ps1'
& $script -Mode Plan -Film Sintel
& $script -Mode Plan -Film TearsOfSteel
\`\`\`

이후 적법하게 공식 원본을 취득해 분석할 수 있음을 확인하고, 충분한 네트워크·저장공간(권장 2~3GB 이상)·Node·ffprobe가 준비되면 명시적 실파일 검사 모드를 실행한다.

\`\`\`powershell
& $script -Mode AcquireAndVerify -Film Sintel
& $script -Mode AcquireAndVerify -Film TearsOfSteel
\`\`\`

\`AcquireAndVerify\`는 **Blender 공식 배포 서버에 대한 실제 파일 다운로드**를 수행하므로 \`Plan\`과 다르다. 실제 영상·SRT는 Git 저장소 외부의 사용자 Windows 로컬 폴더에 보관하며, YouTube 직접 다운로드/모델 API/운영 API·데이터베이스 변경은 하지 않는다. **원격 GitHub CI는 오직 \`Plan\`만 실행한다.**

자세한 파일 목록·크기·권리·다운로드 실패 대처 및 JSON 판정 해석은 \`docs/research/YU_VIDEO_G2C_WINDOWS_ACTUAL_MEDIA_OPERATOR_V01.md\`에 있다. 로컬 실파일 결과가 없으면 G2-C 실증과 G3 승인은 계속 미완료다.


## G2-D — 실제 음성/자막·YouTube판 수동 비교

G2-C에서 Blender 공식 원본과 SRT 파일에 대한 **사용자 제출 로컬 검증 2건**이 수신되었다. 이제 실제 발화와 자막의 시차, YouTube 게시 영상과의 편집판 차이를 사람이 확인한다. 자동으로 영화 전체가 같다고 판정하지 않는다.

**기존 Worktree의 코드만 최신 실험 브랜치로 갱신**(로컬 변경이 없을 때):

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw 'Worktree 변경 사항을 먼저 검토하세요.' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
```

작업용 JSON은 사용자의 **로컬 AppData 내부**, GitHub 저장소 **밖**에 생성한다. 이미 검증한 영상·SRT를 다시 다운로드하지 않는다.

```powershell
$script = '.\shared\experiments\yu-video-understanding-poc-v0\g2d-windows-manual-review.ps1'
& $script -Mode Plan -Film Sintel
& $script -Mode Plan -Film TearsOfSteel

# 출력된 비공개 검수 파일을 VS Code에서 작성 (예시)
code "$env:LOCALAPPDATA\YOUTOPIA\G2D-ManualReviews\Sintel-manual-review.json"
code "$env:LOCALAPPDATA\YOUTOPIA\G2D-ManualReviews\TearsOfSteel-manual-review.json"

# 작성 후 오프라인 집계
& $script -Mode Assess -Film Sintel
& $script -Mode Assess -Film TearsOfSteel
```

두 파일의 `checkpoints[]`에 운영자가 **직접 관찰한** `verdict`와 비식별 `observationNote`를 기입한다. AUDIO_SYNC라면 `observedSpeechStartMs`, YOUTUBE_SCENE이라면 `observedYoutubeMs`를 기록한다. YouTube 게시자 확인은 `youtubeUploaderObservation`, 화면에서 관찰한 길이는 `observedYoutubeDurationMs`에 기록한다. 전부 밀리초 단위다. 모르면 반드시 `UNCERTAIN` 또는 `NOT_REVIEWED`로 보존한다.

검수는 브라우저에서 YouTube 영상 **일반 재생만** 사용하며 스트림 추출/다운로드/서드파티 API 호출이 없다. 특히 Tears의 로컬 **2012년 최초 HD**와 기존 YouTube 참조 **4K 관련 링크**가 서로 다른 판본일 수 있으므로 제목만 같다고 동일성 PASS를 주지 않는다.

상세 운영 계약: `docs/research/YU_VIDEO_G2D_HUMAN_SYNC_YOUTUBE_REVIEW_V01.md`.

`Assess`가 모든 샘플을 일치로 표시하더라도 출력은 `OPERATOR_REPORTED_SAMPLED_MATCHES_NOT_FULL_PROOF`일 뿐이며, 실제 전체 영상·음성 동등성, 권리/제3자 송신·보존, 독립 2인 골드 검수 및 G3 호출 승인은 여전히 별개다.


## G2-D — 로컬 영상 + 오디오 파형 비교 작업공간

VLC로 밀리초 단위 시간을 찾고 VS Code JSON을 직접 수정하는 번거로움을 줄이는 **로컬 브라우저 QA 도구**를 추가했다. 기존 G2-C 공식 원본·SRT와 G2-D 비공개 `manual-review.json`이 준비되어 있어야 한다. 원본을 다시 다운로드하지 않고 FFmpeg로 **브라우저 재생용 MP4 사본과 50ms 오디오 진폭 파형 캐시**를 AppData에 생성한다.

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw '검증 Worktree에 변경 사항이 있습니다.' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01

& .\shared\experiments\yu-video-understanding-poc-v0\g2d-open-workspace.ps1 -Film Sintel
```

`G2D_LOCAL_WORKSPACE_READY http://127.0.0.1:<port>/` 출력이 나오면 사용자 PC의 브라우저에서 해당 URL을 연다. 좌측 체크포인트, 중앙 로컬 영상+SRT 및 파형(클릭 이동·±0.1초), 우측 공식 YouTube 임베드 후보 영상, 하단 검수 판정+저장으로 구성되어 있다.

YouTube iframe은 **버튼을 클릭할 때만** 브라우저에서 외부 요청을 발생시키며 스트림은 다운로드/저장하지 않는다. 게시자가 임베드를 막으면 브라우저에서 원본 YouTube 페이지를 열어 수동 비교한다. 파형은 전체 소리의 진폭이며 대사 인식·말소리 분리는 아니다. 인코딩된 브라우저용 AAC 음성은 원본과 미세한 시간 오차를 가질 수 있다.

Tears of Steel을 확인하려면 PowerShell에서 `Ctrl+C`로 기존 로컬 서버를 종료한 뒤:

```powershell
& .\shared\experiments\yu-video-understanding-poc-v0\g2d-open-workspace.ps1 -Film TearsOfSteel
```

원본 영화는 수정하지 않고, 비공개 G2-D 검수 JSON만 사용자 명시적 **저장** 버튼으로 갱신한다. JSON 판정 불변 필드와 독립 G3 차단 게이트는 유지된다.

전체 매뉴얼: `docs/research/YU_VIDEO_G2D_LOCAL_WAVEFORM_WORKSPACE_V01.md`. 실제 Windows 브라우저/대용량 영상 UI 검수는 아직 운영자가 수행하지 않았으므로 구현 완료와 현장 QA 완료를 혼동하지 않는다.
