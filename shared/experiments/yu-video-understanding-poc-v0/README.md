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


## G2-D 보정된 독립/연동 재생 (운영자 QA 전용)

기존 브라우저 파형 검수 화면 위쪽에 **독립 재생 / 연동 재생** 선택과 **기준점 기록**, **로컬→YouTube / YouTube→로컬** 정렬 버튼을 추가했다.

- **기본 독립 재생:** 두 영상에서 같은 사건/컷을 개별 탐색한다.
- **YouTube 플레이어 열기:** 사용자가 클릭할 때만 공식 IFrame Player API를 불러온다. 임베드 불가/재생 차단이라면 독립 모드와 외부 링크를 사용한다.
- **기준점 기록:** 두 영상을 같은 장면에 맞춰 **각각 일시정지**한 후 누른다. 예: 로컬 01:28.803 / YouTube 01:31.000 → 오프셋 **+2.197초**. 이 예시는 실제 검수 증거가 아니다.
- **연동 재생:** 기준점 기록 후 활성화. 로컬의 탐색/재생/정지와 YouTube의 재생/정지·큰 탐색 점프를 연결한다. 작은 수동 탐색은 **YouTube→로컬** 정렬 버튼으로 정확한 기준점을 잡는다. 네트워크 지연과 키프레임 단위 YouTube seek 때문에 동일 밀리초를 보증하지 않는다.
- **편집 차이 감지:** 일치하지 않는 구간이 나오면 반드시 독립 재생으로 해제하고 새 기준점을 잡는다. 연동이 되더라도 동일 편집판/권리/독립 G3 검증 완료로 해석하면 안 된다.
- **브라우저 한정 임시 상태:** 보정값은 JSON에 저장하지 않고 탭을 닫으면 사라진다. 기존 G2-D 검수 JSON 및 G3 기본 차단 계약은 변경하지 않았다.

`docs/research/YU_VIDEO_G2D_LOCAL_WAVEFORM_WORKSPACE_V01.md`의 **7절**에 구체적 사용법과 현장 QA 절차가 있다.


## G2-E — 12문항 실제 영상 질문 후보 및 로컬 정답 작성

기존 G0 목표는 **6편×6문항=36문항**이다. 현재 검수한 실제 Blender 영화 2편에 대해 **질문 초안 12개(SPEECH 4, VISUAL 4, TEMPORAL 2, UNSUPPORTED 2)**를 생성했다. **OCR 6개 및 나머지 24문항은 후속 인터뷰/스크린캐스트 영상**에서 구성한다.

공개 원장 `g2e-question-candidates.json`에는 **정답·영상 캡처·실제 자막 대사·모델 응답이 없다**. G2-D 로컬 검수 기록에서 실제 재생시각과 미디어 SHA-256만 연결한다.

### 권장: 기존 영상·파형 웹 작업공간에서 작성

기존 G2-D Windows Worktree를 최신 실험 커밋으로 갱신한 뒤:

```powershell
& .\shared\experiments\yu-video-understanding-poc-v0\g2d-open-workspace.ps1 -Film Sintel
```

브라우저 로컬 `http://127.0.0.1:<출력된 실제 포트>/` 화면 하단의 **G2-E 평가 질문** 패널에서 **질문 6개 생성 (비공개)**을 누르고, 실제 영상을 확인하여 답변·로컬 근거 구간을 작성한다. 영상·파형·자막의 재생 시점을 근거 시작/종료에 캡처할 수 있다. 다른 영화는 서버 종료 후 `-Film TearsOfSteel`로 실행한다.

### 대안: Windows 명령으로 비공개 JSON 생성/검증

```powershell
$script = '.\shared\experiments\yu-video-understanding-poc-v0\g2e-windows-gold-pilot.ps1'
& $script -Mode Plan -Film Sintel
& $script -Mode Plan -Film TearsOfSteel

# 실제 영상 확인/정답 작성 후
& $script -Mode Assess -Film Sintel
& $script -Mode Assess -Film TearsOfSteel
```

이미 작성한 골드 파일은 Plan 재실행으로 덮어쓰지 않는다. 저장 대상은 Git 저장소 밖 `%LOCALAPPDATA%\YOUTOPIA\G2E-PrivateGoldDrafts`이고, 기존 G2-D 데이터는 변경하지 않는다.

**중요:** 질문 후보는 `gold.answerability=null`, `gold.answerText=null`로 시작한다. 사람의 실제 Q/A·근거가 없는 상태에서 영상 사실을 정답이라고 주장할 수 없다. 최종 골드 정답은 독립 2인 검수·불일치 조정·권리 검토가 끝나기 전까지 **0개**이고 `g3Authorized=false`, 외부 API 호출 0, 실제 지출 $0, 운영 병합 없음 상태를 유지한다.

운영/증거 매뉴얼: `docs/research/YU_VIDEO_G2E_GOLD_CANDIDATE_DESIGN_V01.md`.


## G2-F — 독립 2인 블라인드 검수 및 실험 브랜치 종료 준비

G2-E에서 사용자가 작성한 Sintel 6문항과 Tears of Steel 6문항 **총 12개 정답 초안**을 실제 영화에 근거해 독립 검증하는 단계다. 현재 사용자 제출 `G2-E Assess`는 두 영화 모두 **6/6 작성·0 미작성·0 재작성**이지만, 실제 독립 골드 정답 승인은 **0/12**이다.

**운영자 Windows 로컬에서 두 명의 서로 다른 사람에게 각각 전달할 질문만 포함된 블라인드 패킷을 생성한다.** 기존 G2-E 비공개 정답·증거는 패킷에 복제하지 않고, 영화/질문/출처 SHA만 연결한다.

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
$g2f = '.\shared\experiments\yu-video-understanding-poc-v0\g2f-windows-independent-review.ps1'

# 동일 파일이 이미 생성된 경우 덮어쓰지 않고 중단
& $g2f -Mode Plan -Film Sintel -ReviewerCode REVIEWER_A
& $g2f -Mode Plan -Film Sintel -ReviewerCode REVIEWER_B
& $g2f -Mode Plan -Film TearsOfSteel -ReviewerCode REVIEWER_A
& $g2f -Mode Plan -Film TearsOfSteel -ReviewerCode REVIEWER_B
```

검수자는 운영자 답을 보지 않고 **허가된 로컬 원본 영상**을 확인하면서, 각자의 `%LOCALAPPDATA%\YOUTOPIA\G2F-IndependentReviews\*-blind-review.json`에 질문별 답변/근거/확인 불가능 사유를 독립 입력한다. 기존 G2-D/G2-E 브라우저는 작성자의 정답이 노출될 수 있으므로 블라인드 검수자에게 그대로 제공하지 않는다.

```powershell
& $g2f -Mode Check -Film Sintel -ReviewerCode REVIEWER_A
& $g2f -Mode Check -Film Sintel -ReviewerCode REVIEWER_B

# 두 리뷰어가 실제로 제출한 후에만 실행
& $g2f -Mode Assess -Film Sintel
& $g2f -Mode Assess -Film TearsOfSteel
```

`Assess`의 답변 가능 여부·근거 시각 비교 결과도 **인간의 정답 검수 승인을 의미하지 않는다**. 리뷰어 코드, 체크박스, 같은 답변, 통과 테스트만으로 인간 2명의 독립성이나 사실적 정확도를 증명할 수 없다.

두 영화 G2-F가 실제 검토·기록된 이후 오프라인 연구 도구의 PR 병합 후보를 정한다. **현재 G2-F 승인 범위에는 PR 병합/브랜치 삭제/G3 API 실행 없음.**

자세한 평가·독립 검수·종료 Gate: `docs/research/YU_VIDEO_G2F_INDEPENDENT_GOLD_REVIEW_V01.md`.


## G2-F — 검수자별 전용 오프라인 웹 (검수자 A/B 별도)

기존 G2-D/G2-E 작업공간은 **작성자 정답이 노출되는 화면**이므로 독립 검수자에게 제공하지 않는다. 검수자 각자의 Windows PC에서만 실행되는 **G2-F 전용 사이트**를 새로 마련했다. 외부 네트워크로 로그인하는 중앙 웹 서비스는 아니다.

**운영자 PC에서 질문 패킷 4개가 만들어진 뒤** 다음과 같이 검수자별 웹 코드 + 질문 하나만 들어 있는 ZIP 4개를 생성한다.

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
$export = '.\shared\experiments\yu-video-understanding-poc-v0\g2f-export-reviewer-web.ps1'
foreach ($reviewer in @('REVIEWER_A','REVIEWER_B')) {
  foreach ($film in @('Sintel','TearsOfSteel')) {
    & $export -Film $film -ReviewerCode $reviewer
  }
}
```

ZIP 기본 위치는 `%LOCALAPPDATA%\YOUTOPIA\G2F-ReviewerExports`다. **이 ZIP에는 영화·자막 원본·기존 작성자 정답·다른 검수자 패킷이 포함되지 않는다.** A에게 A용 ZIP 2개만, B에게 B용 ZIP 2개만 전달한다. Blender 공식 원본과 SRT는 **해당 검수자에게 전달/이용할 권한이 확인된 경우에만** 별도 제공하거나 정당한 공식 취득을 안내한다.

검수자 PC에서 자신에게 전달된 ZIP을 해제하고, 동일 SHA-256인 원본 영화와 SRT를 해제 폴더의 `media`에 배치한다. `README.txt`에 실행 명령이 있으며, 아래는 Sintel 검수자 A의 예시다.

```powershell
# 현재 위치는 ZIP 해제 폴더 ('Sintel-REVIEWER_A-G2F-Reviewer-Web')
$launcher = '.\app\shared\experiments\yu-video-understanding-poc-v0\g2f-open-reviewer-workspace.ps1'
& $launcher -Film Sintel -ReviewerCode REVIEWER_A -PacketPath '.\private\Sintel-REVIEWER_A-blind-review.json' -VideoPath '.\media\Sintel.2010.720p.mkv' -SubtitlePath '.\media\sintel_en.srt'
```

Node 24, FFmpeg, Chrome/Edge가 필요하다. `G2F_REVIEWER_WORKSPACE_READY http://127.0.0.1:<포트>/` 주소를 **동일 검수자 PC에서** 연다. 6개 질문마다 원본 영상·SRT·파형·근거 구간을 확인해 답변하고 **현재 질문 저장**을 누른다. 마지막으로 실제 독립성 선언을 저장한다. 별도 입력 JSON을 직접 편집할 필요가 없다.

작성 완료 후에는 개인의 `private` 폴더에 있는 본인 `*-blind-review.json`만 운영자에게 안전하게 반납한다. 운영자는 기존 `g2f-windows-independent-review.ps1 -Mode Check/-Mode Assess`로 두 검수자의 결과를 대조한다. **이 과정은 자동 골드 정답 승인이나 G3 API 승인으로 이어지지 않는다.**

단순한 localhost 페이지로는 다른 PC의 브라우저에서 직접 접속할 수 없다. 공개 인터넷 사이트·원격 계정/권한 관리·서버 DB·TLS는 별도 신규 승인 범위다.

자세한 분리·전달·수동 QA 지침: `docs/research/YU_VIDEO_G2F_INDEPENDENT_GOLD_REVIEW_V01.md` 10절.


## G2-F — AI 답변 선작성 후 검수자 확인·편집 (현재 권장 방식)

작성자가 답변을 만드는 데 소요되는 작업을 줄이기 위해 **12문항의 AI 제안 초안·예상 근거 구간**을 먼저 작성한 뒤, **검수자 A/B가 각자 실제 원본을 확인하고 ACCEPT/EDIT/REJECT/UNCERTAIN으로 교정**하는 별도 G2-F 모드를 추가했다.

**기존 블라인드 평가와 다름:** 두 검수자가 AI 초안을 미리 보기 때문에 최종 자료를 `BLIND_INDEPENDENT_GOLD`로 보고해서는 안 된다. A/B는 서로의 검토 내용을 보지 않으며, 작성자의 기존 G2-E 원본 정답은 표시되지 않는다. `independentGoldApproved=0`, G3 승인 false 유지.

Windows 원래 G2-E 작성 PC에서 기존 웹 서버를 Ctrl+C로 종료하고 최신 실험 브랜치로 전환한다.

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
$assist = '.\shared\experiments\yu-video-understanding-poc-v0\g2f-assisted-workspace.ps1'

# 각 검수자의 작업 시 하나씩 실행; 다음 명령 전 Ctrl+C로 서버 종료
& $assist -Mode Serve -Film Sintel -ReviewerCode REVIEWER_A
& $assist -Mode Serve -Film TearsOfSteel -ReviewerCode REVIEWER_A
& $assist -Mode Serve -Film Sintel -ReviewerCode REVIEWER_B
& $assist -Mode Serve -Film TearsOfSteel -ReviewerCode REVIEWER_B
```

`G2F_ASSISTED_WORKSPACE_READY http://127.0.0.1:<포트>/`를 **같은 PC 브라우저에서** 열면 질문과 AI 후보 정답이 표시된다. 기존 G2-F 블라인드 패킷은 그대로 남으며 새 `%LOCALAPPDATA%\YOUTOPIA\G2F-AssistedReviews`에 역할별 JSON이 생성된다.

모든 사람이 검토한 뒤에는 다음 명령으로 구조 검증/검수 결과 비교:

```powershell
& $assist -Mode Check -Film Sintel -ReviewerCode REVIEWER_A
& $assist -Mode Check -Film Sintel -ReviewerCode REVIEWER_B
& $assist -Mode Check -Film TearsOfSteel -ReviewerCode REVIEWER_A
& $assist -Mode Check -Film TearsOfSteel -ReviewerCode REVIEWER_B

& $assist -Mode Assess -Film Sintel
& $assist -Mode Assess -Film TearsOfSteel
```

이 단계에서 작성자가 만든 AI 초안의 사실적 타당성은 **직접 영상으로 검증해야 하며**, AI 제안 시각을 그대로 믿고 저장하면 안 된다. 자세한 설명: `docs/research/YU_VIDEO_G2F_INDEPENDENT_GOLD_REVIEW_V01.md`의 12절.

## G2-G — 운영자 최종 판정 (12문항)

G2-F의 리뷰어 A·B가 비블라인드 AI 보조 검수 12문항씩을 완료한 후, 운영자가 원본 영상을 보면서 질문별 APPROVE / REVISE / HOLD를 결정하는 별도 localhost 웹이다. **리뷰어 원본 JSON은 읽기 전용**, 처음 시작할 때 세 입력 파일의 SHA256 보존 스냅샷을 만들며 G2-G 판정만 별도 로컬 JSON에 저장한다.

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
$adjudicate = '.\shared\experiments\yu-video-understanding-poc-v0\g2g-windows-final-adjudication.ps1'
& $adjudicate -Mode Serve -Film Sintel
# 작업 완료 후 Ctrl+C로 종료한 뒤
& $adjudicate -Mode Serve -Film TearsOfSteel

# 운영자 판정 파일 검사·요약
& $adjudicate -Mode Check -Film Sintel
& $adjudicate -Mode Report -Film Sintel
& $adjudicate -Mode Check -Film TearsOfSteel
& $adjudicate -Mode Report -Film TearsOfSteel
```

처음에는 6문항 모두 PENDING이고 자동 승인하지 않는다. AI 모범답변·근거·관찰 기록·판정 사유의 초안이 자동 채워지며, `AI 초안 입력란에 적용` 버튼으로 추천 판정을 명시적으로 불러올 수 있다. 기본 추천은 SUPPORTED 10문항 APPROVE 후보, UNSUPPORTED 2문항 HOLD 후보이지만, 둘 다 실제 운영자의 판정이 아니다. 운영자가 직접 근거를 확인하고 승인 사유를 남겨야만 개별 APPROVE가 가능하다. G2-G의 APPROVE는 **비블라인드 검수에 대한 운영자 채택**이며 독립 블라인드 Gold 승인이나 G3 승인으로 전이하지 않는다. 상세 절차는 `docs/research/YU_VIDEO_G2G_OPERATOR_FINAL_ADJUDICATION_V01.md` 참조.

## G2-G 파일럿 최종 결과 및 G3 진입 심사 — 2026-11-09

운영자 Windows 로그 기준 Sintel과 Tears of Steel 각 6문항씩 총 12문항 모두 판정 완료, APPROVE 10문항·HOLD 2문항·PENDING 0문항. G2-G 판정 JSON 두 파일은 사용자 PC에 SHA-256 일치 검사 후 별도 백업되었고, 비공개 원본과 해시는 Git에 올리지 않았다.

이는 **AI 보조 비블라인드 검수에 대한 운영자 채택 결과**로, 원래 G0 목표인 6편/36문항·독립 Gold·영상 이용권·YouTube/공식 원본 동등성·제공자 비용/보안 게이트를 충족시키지 않는다. 따라서 **G3_NO_GO / NO_LIVE_API / NO_MERGE**를 유지한다.

최종 보고: [G2 파일럿 종료 및 G3 진입 심사](../../../docs/research/YU_VIDEO_G2_PILOT_CLOSEOUT_G3_READINESS_20261109.md).


## G2-H — 데이터셋 확장 설계 4편·24문항

기존 G0의 **인터뷰 2편·화면 시연 2편·액션 2편 = 6편 / 36문항**을 유지한다. G2-G 파일럿 2편·12문항(운영자 APPROVE 10/HOLD 2)에 더해 남은 인터뷰 2·화면 시연 2편의 **24개 질문 작성 템플릿**만 생성했다. 현재 모든 4개 영상은 G2-B 공개 연구 후보이며 사용권·원본·캡션·정답·독립 Gold 미승인이다.

| 새 연구 후보 | SPEECH | VISUAL | OCR | TEMPORAL | UNSUPPORTED | 합계 |
|---|---:|---:|---:|---:|---:|---:|
| VID-01 NASA 인터뷰 | 3 | 1 | 0 | 1 | 1 | 6 |
| VID-02 NASA 인터뷰 | 3 | 1 | 0 | 1 | 1 | 6 |
| VID-03 NASA 화면 시연 | 1 | 1 | 3 | 1 | 0 | 6 |
| VID-04 NASA 화면 시연 | 1 | 1 | 3 | 0 | 1 | 6 |
| **합계** | **8** | **4** | **6** | **3** | **3** | **24** |

오프라인 설계 검증 명령:

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
node .\shared\experiments\yu-video-understanding-poc-v0\g2h-expansion-plan.cjs
```

예상 결과는 `DESIGN_ONLY_4_FILMS_24_QUESTION_BLUEPRINTS_NO_G3`, 권리 승인 0, 미디어 인입 승인 false, 독립 블라인드 Gold 0, G3 승인 false다. 동종 후보 교체·질문 재배분이 필요하면 G0 전체 유형 분포를 보존하고 설계 개정을 먼저 기록한다.

상세 설계와 후보별 위험·역할·게이트: [G2-H 데이터셋 확장 설계](../../../docs/research/YU_VIDEO_G2H_DATASET_EXPANSION_PLAN_V01.md). 실영상 다운로드, YouTube API, 제공자 실호출, 사업화용 권리 승인 또는 PR 병합은 **이 설계 작업의 범위에 포함되지 않는다**.


## G2-H1 — VID-01·VID-03 NASA 공식 소스 적격성 연구

사용자 승인에 따라 기존 G2-H의 NASA 연구 후보 가운데 VID-01 인터뷰와 VID-03 화면 시연을 대상으로 **공식 공개 메타데이터와 이용 정책만** 확인했다. 영상·자막 원문을 다운로드하지 않았고, 실제 파일을 재생/해싱하지 않았다.

| 기준 | VID-01 NASA 인터뷰 | VID-03 NASA 화면 시연 |
|---|---|---|
| 공식 MP4 목록 | 확인 (자막 있는/없는 1080p판) | 확인 (1080p판) |
| 별도 SRT/VTT 목록 | 확인 | 공식 페이지에서 미확인 |
| 공식 YouTube ID | 미확정 | p-6DusnZ1pQ 확인 |
| 러닝타임 3~15분 | 미검증 | 미검증 |
| 판본/음성 정합성·실서비스 이용권 | 미승인 | 미승인 |

**현재 판정은 `PUBLIC_METADATA_RESEARCH_COMPLETE_SOURCE_ELIGIBILITY_BLOCKED`**다. NASA의 공공 미디어 이용 일반 안내와 유튜브 정책을 참고하되, 저작자·출연자·제3자 요소·모델 전송 허용 여부의 상세 검토 없이는 YOUTOPIA에 자료를 인입하거나 G3를 진행하지 않는다.

오프라인 출처 메타데이터 검증:

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
node .\shared\experiments\yu-video-understanding-poc-v0\g2h1-nasa-source-readiness.cjs
```

공식 근거·차단 조건·후속 권리조사: [G2-H1 NASA 소스 적격성 조사](../../../docs/research/YU_VIDEO_G2H1_SOURCE_ELIGIBILITY_VID01_VID03_20261109.md).
