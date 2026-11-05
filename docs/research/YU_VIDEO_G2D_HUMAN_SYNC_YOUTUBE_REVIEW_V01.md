# YOUTOPIA — G2-D 음성/SRT 동기화·YouTube판 시각 비교 운영자 검수 v0.1

> 작성: 2026-11-05 KST
> 브랜치: `experiment/yu-video-understanding-poc-v01`
> 선행 증거: G2-C에서 Sintel과 Tears of Steel의 로컬 영상 메타데이터·SRT 시간 경계 검사에 대한 **운영자 제출 JSON 2/2 수신**
> 상태: **G2D_REVIEW_TOOL_IMPLEMENTED / HUMAN_OBSERVATIONS_NOT_COLLECTED / G3_POLICY_HOLD / NO_MERGE**

## 1. 이번 검증의 진짜 목적

G2-C의 `captionBounds=PASS_BOUNDS_ONLY`는 SRT가 영상 길이를 넘지 않는다는 뜻일 뿐, 실제 음성과 자막 표시가 동기화되어 있다는 의미가 아니다. YouTube 원본과 로컬 제작자 파일이 같은 영화 제목이라는 사실도 **동일한 편집 판본**임을 보증하지 않는다.

G2-D에서는 아래 두 검증을 구분한다.

- **AUDIO_SYNC (로컬 SRT ↔ 로컬 원본 음성):** 첫/중간/마지막 실제 SRT 발화 구간에서 영상 음성을 듣고 실제 발화 시작 시간을 기록. 샘플 일치 표시는 ±1,500ms **운영자 보고 기준**이며 정확한 ASR·기계 캘리브레이션이 아니다.
- **YOUTUBE_SCENE (로컬 원본 ↔ 공식 YouTube 재생 페이지):** 원본 러닝타임의 10%/50%/90% 위치에서 프레임·컷 순서·음성 이벤트 및 대응 YouTube 타임코드를 사람이 비교. 두 타임코드의 편차가 구간마다 크게 변하거나 공식 게시자 신원이 확인되지 않으면 차단.
- **CAPTION_COVERAGE (Tears만):** 로컬 SRT가 `09:27`에서 끝나므로 그 이후 2곳을 포함해 **영상 끝까지** 자막이 필요한 발화가 추가로 있는지 검토. 자막이 끝났다는 이유만으로 나머지 구간을 무음이라고 간주하지 않는다.

각 작품은 **3개 발화 + 3개 YouTube 장면**으로 6개 체크포인트, Tears는 자막 종료 이후 2개 추가하여 8개 체크포인트다. 표본 6~8개가 같아도 전체 영화의 모든 컷·자막·음성이 같다는 증거는 아니며, 추후 완전한 등가성 입증과 독립 검토를 요구한다.

## 2. 기존 소스의 판본 차이 경고

| 영화 | 실제 G2-C 로컬 원본 | G2-B 공개 YouTube 참조 | 주의 |
|---|---|---|---|
| Sintel | Blender **updated 720p** `Sintel.2010.720p.mkv` | [eRsGyueVLvQ](https://www.youtube.com/watch?v=eRsGyueVLvQ) | 게시자·영상 버전·컷/인트로·자막 싱크 직접 확인 전 동일판이라고 단정 금지 |
| Tears of Steel | **2012 First HD 720p** `tears_of_steel_720p.mov` | [OHOpb2fS-cM](https://www.youtube.com/watch?v=OHOpb2fS-cM) | 기존 링크는 **4K판 제3자 아카이브를 통해 확인된 후보 링크**임. 2013 4K 재렌더/재그레이딩판과 2012 최초 HD판은 다를 수 있음 |

YOUTOPIA 제품은 YouTube 재생 스트림·자막을 다운로드·추출하지 않는다. 비교 영상은 브라우저에서 일반 YouTube 페이지로 재생한다. 공식 YouTube IFrame Player API도 사용자 재생시간과 탐색 기능을 제공하지만, 이 실험에서는 자동 캡처나 API 계정 연결 없이 **수동 재생**만 요구한다. [공식 참고 문서](https://developers.google.com/youtube/iframe_api_reference).

## 3. 실제 사용: 별도 Worktree의 최신 파일 동기화

운영자는 이미 `C:\Projects\YOUTOPIA-VIDEO-G2C`에 분리된 Worktree와 Blender 원본 파일을 가지고 있다. 새로운 Worktree를 만들거나 원본을 다시 내려받지 않는다. **작업 트리에 변경 파일이 있으면 명령을 중단**한다.

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed' }

cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw 'Worktree has changes; review before switching' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw 'Cannot update experiment worktree' }

$script = '.\shared\experiments\yu-video-understanding-poc-v0\g2d-windows-manual-review.ps1'

# LOCAL 원본 두 편의 이미 확보한 파일을 열어 해시/재생시간/SRT를 점검하고
# 검수용 JSON만 사용자 로컬 AppData에 생성한다. 네트워크 호출 없음.
& $script -Mode Plan -Film Sintel
& $script -Mode Plan -Film TearsOfSteel
```

파일 생성 경로(공개 저장소 **외부**):

- `%LOCALAPPDATA%\YOUTOPIA\G2D-ManualReviews\Sintel-manual-review.json`
- `%LOCALAPPDATA%\YOUTOPIA\G2D-ManualReviews\TearsOfSteel-manual-review.json`

G2-C의 실제 로컬 영상은 `%LOCALAPPDATA%\YOUTOPIA\G2C-AuthorizedPublisherMedia\Sintel` 및 `...\TearsOfSteel`에 유지한다. 계획 도구는 로컬 파일에 대한 `ffprobe`/해시 판독 및 SRT 구간 선정만 수행한다. **영상 또는 SRT를 다른 서버에 업로드하지 않으며, 원본 파일도 수정하지 않는다.**

검수 JSON이 이미 존재하면 실수로 사람의 관찰 기록을 덮어쓰지 않도록 **오류로 중단**한다. 재생검수는 Windows 동영상 플레이어 중 외부 SRT 추가/표시가 가능한 플레이어를 사용한다. 창 2개로 로컬 영상과 공식 YouTube 페이지를 비교하면 된다.

## 4. 사람이 작성해야 하는 JSON 필드

생성된 JSON은 검토할 실제 타임코드와 영상명을 포함한다. **불변 필드**(`film`, `sourceType`, `local`, `youtubeUrl`, `packetDigest`, `checkpoints[].id/kind/localMs/cueIndex/prompt`, `realDatasetApproved`, `g3Authorized`)를 고치지 않는다.

변경이 허용되는 필드:

| 위치 | 뜻 | 입력 예시 |
|---|---|---|
| `youtubeUploaderObservation` | 공식 제작자/정당한 게시자 여부를 실제 YouTube 페이지에서 확인 | `OFFICIAL_OWNER_CONFIRMED` / `UNVERIFIED` / `THIRD_PARTY` |
| `observedYoutubeDurationMs` | 플레이어에 표시된 전체 길이를 **밀리초**로 기재 | 예: 12:14 → `734000` |
| `reviewerCode` | 공개에 적합한 비식별 임의 식별 코드(기본 `LOCAL_OPERATOR_1`) | `LOCAL_OPERATOR_1` |
| `checkpoints[].verdict` | 직접 검사한 결과 | `OBSERVED_MATCH`, `OBSERVED_DIFFERENCE`, `UNCERTAIN`, `NOT_REVIEWED` |
| `checkpoints[].observationNote` | 의도적으로 **대사 인용/인물정보 없이** 장면·사건·판본 차이를 12자 이상 300자 이하로 설명 | `Scene order matches and no audible omission at this sample` |
| `checkpoints[].observedSpeechStartMs` | AUDIO_SYNC 구간에서 실제 음성 시작 지점을 밀리초로 기록 | `107500` |
| `checkpoints[].observedYoutubeMs` | YOUTUBE_SCENE 구간에 대응하는 YouTube 재생 타임코드를 밀리초로 기록 | `310000` |

**검토 전 기본값은 `NOT_REVIEWED`/null**이다. 임의로 `OBSERVED_MATCH`를 채우지 않는다. `OBSERVED_MATCH`로 발화를 표시하려면 실제 관찰한 음성 시작 밀리초 값을 제시해야 하며, 게시 SRT 시작점과의 오차가 **1.5초 이내**여야 한다. YouTube 장면 `OBSERVED_MATCH`는 게시자 확인 및 대응 YouTube 시간 기록이 있어야 한다.

미확인 상태를 `OBSERVED_DIFFERENCE`나 `OBSERVED_MATCH`로 위조하지 말고 `UNCERTAIN`으로 표시한다. 장면별 시간 편차가 ±2초 범위를 넘어 크게 달라지거나 전체 재생시간 차이가 2초를 초과하면 **판본 차이 검토 필요**로 보고한다. 이는 자동 기계판정이 아니라 운영자 입력 검증이다.

Tears of Steel의 `CAPTION_COVERAGE`에서 `OBSERVED_MATCH`는 샘플 구간에서 자막이 필요한 미수록 발화가 없었다고 직접 확인한 경우에만 사용한다. 09:27 이후의 모든 발화를 **직접 살펴보지 않았다면 전체 커버리지 완료라고 주장하지 않는다**.

## 5. 작성한 리뷰의 오프라인 판정

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
$script = '.\shared\experiments\yu-video-understanding-poc-v0\g2d-windows-manual-review.ps1'
& $script -Mode Assess -Film Sintel
& $script -Mode Assess -Film TearsOfSteel
```

`Assess`는 로컬 JSON만 읽으며 YouTube/LLM API를 호출하지 않는다.

- `PENDING_HUMAN_REVIEW`: 미검토·불확실 항목이 남음.
- `OPERATOR_REPORTED_DIFFERENCES_REQUIRE_REVIEW`: 상이한 장면·타임코드·재생시간 관찰이 있거나 3구간의 시간 편차가 불일치.
- `OPERATOR_REPORTED_SAMPLED_MATCHES_NOT_FULL_PROOF`: **하나의 운영자가 입력한 몇 개 구간의 일치 보고**. 영상 전체 검증·법적 권리·2인 정답 검수·G3 승격은 아님.

검토 JSON에는 파일 SHA-256, 저작권 있는 자막/영상의 관찰 정보를 적을 수 있으므로 **비공개 로컬에만 보존**한다. 공유가 필요한 경우 **Assess의 요약 JSON만** 제공한다. 운영자 ID는 개인식별정보가 아닌 비식별 코드로 제한한다.

## 6. 차단 게이트

현재 단계에서는 여전히 **실제 사람이 검토한 파일이 없고**, 독립 2인 검수·전체 영상 판본 동등성·라이선스·LLM 모델 송신/보존 권한을 확보하지 못했다.

- `independentReviewerCount=0`, `fullAudioCaptionAlignmentVerified=false`
- `fullYoutubeEditionEquivalenceVerified=false`, `filmRightsForServiceVerified=false`
- `humanGoldLabelsVerified=false`, `g3Authorized=false`
- 모델 API 호출 0, 과금 0, 운영 DB/UI/Chrome 변경 0
- 현재 G1의 **6편 × 36문항은 합성 평가기**. Blender 실제 영상 2편의 전개를 기반으로 한 사람 골드 질문은 아직 없음.

**G2-D의 개발 작업은 이 검수 도구/독립 테스트/실행 계약까지. 실제 미디어·YouTube 수동 비교는 운영자 실행 후 판정한다.**
