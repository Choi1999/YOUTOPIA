# YOUTOPIA — G2-C Windows 공식 Blender 원본 실측 실행계약 v0.1

> 작성: 2026-11-05 KST
> 대상 브랜치: \`experiment/yu-video-understanding-poc-v01\`
> 상태: **WINDOWS_OPERATOR_PLAN_READY / WINDOWS_MEDIA_ACQUISITION_NOT_EXECUTED / G3_BLOCKED**
> 실제 사용자 Windows 환경의 디스크·네트워크·ffprobe·Node 상태는 아직 관찰하지 못했다.

## 1. 범위와 실행 제약

현재 ChatGPT 실행 환경은 Blender의 공식 대용량 미디어 서버에 대한 DNS 연결이 불가하며 사용자 Windows 파일시스템을 직접 제어하지 못한다. 따라서 **이번 승인으로 실제 동영상을 받았다고 주장하지 않는다**. 대신 사용자 Windows PC에서 필요 조건을 확인하고, 공식 배포 서버 원본을 다운로드하여 기존 읽기 전용 오프라인 검증기를 호출하는 도구를 제작했다.

도구: \`shared/experiments/yu-video-understanding-poc-v0/g2c-windows-official-media.ps1\`

- 기본 \`Plan\`은 네트워크 0, 파일 생성 0, API/과금 0. 두 공식 영상의 정확한 다운로드 링크와 예상 파일 크기만 출력한다.
- \`AcquireAndVerify\`는 **운영자가 Windows에서 명시적으로 지정한 경우에만** Blender 공식 배포 파일을 내려받고 파일 원본을 검사한다. YouTube 스트림·자막은 가져오지 않으며 Gemini/LLM API 호출도 하지 않는다.
- 다운로드는 Git 저장소 바깥의 \`%LOCALAPPDATA%\YOUTOPIA\G2C-AuthorizedPublisherMedia\`에 저장한다. Git에 동영상·SRT·MD5·비밀 값을 커밋하지 않는다.
- \`ffprobe\`와 Node 실행 파일이 사용 가능해야 한다. Sintel은 공식 720p MKV ZIP을 풀어 검증하며, Tears of Steel은 2012 HD 최초판의 720p MOV를 선택한다.
- 원본 SRT 타임코드와 **실제 영상 재생시간 경계**만 자동 검증한다. 말소리·자막 음성 동기화, 제작자-YouTube판 시퀀스 동일성, 저작권/초상권 범위와 2인 골드 검수는 자동 승격하지 않는다.

## 2. 공식 Blender 원본 경로 고정

| Film | 공식 영상 원본 URL | 공식 서버 목록상 파일 크기 | 공식 영어 SRT |
|---|---|---:|---|
| Sintel (updated 720p) | \`https://download.blender.org/durian/movies/Sintel.2010.720p.mkv.zip\` | **681,285,470 bytes** | \`https://durian.blender.org/wp-content/content/subtitles/sintel_en.srt\` |
| Tears of Steel (first HD 720p 2012) | \`https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov\` | **372,178,639 bytes** | \`https://download.blender.org/demo/movies/ToS/subtitles/TOS-en.srt\` |

증거: [Sintel 공식 미디어 인덱스](https://download.blender.org/durian/movies/), [Tears 공식 미디어 인덱스](https://download.blender.org/demo/movies/ToS/), [Sintel 배포](https://durian.blender.org/download/), [Tears 배포](https://mango.blender.org/download/).

**주의:** 두 파일은 서로 다른 작품이며 Sintel의 Updated Render와 Tears 최초판을 같은 판본이라고 주장하지 않는다. 재인코딩된 YouTube 업로드판이 동일 타임라인인지는 별도의 독립 확인이 필요하다.

Sintel에 대한 \`Sintel.2010.720p.mkv.md5\` 공식 체크섬 URL을 선택적으로 확인한다. MD5 일치 시 무결성 보조 증거만 된다. 해당 원본 체크섬을 내려받지 못하거나 확인할 수 없으면 \`PUBLISHER_CHECKSUM_UNAVAILABLE\`로 보고하고, 원본 인증 완료로 승격하지 않는다. Tears 파일은 이번 계약상 동일한 제작자 체크섬 미확보 상태다.

별도 [Tears of Steel 공식 \`copyright.txt\`](https://download.blender.org/demo/movies/ToS/copyright.txt)는 **Original Soundtrack 개별 파일**에 CC BY-ND 3.0(변경 금지) 조건을 명시한다. 영화 본편 라이선스와 음악 파일 배포 권리를 동일시하지 않는다. 이번 PoC는 OST 단독 파일을 다운로드하거나 편집/재배포하지 않는다.

## 3. 실행할 단일 검증 경로

Windows PowerShell에서 **별도 Worktree**로 실행한다.

\`\`\`powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
$target = 'C:\Projects\YOUTOPIA-VIDEO-G2C'
if (Test-Path $target) { throw '기존 테스트 폴더가 있으므로 먼저 검사 필요' }
git worktree add --detach $target origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw 'worktree 생성 실패' }
Set-Location $target

$script = '.\shared\experiments\yu-video-understanding-poc-v0\g2c-windows-official-media.ps1'
& $script -Mode Plan -Film Sintel
& $script -Mode Plan -Film TearsOfSteel

# 충분한 저장공간과 네트워크, Node 및 ffprobe가 확보된 경우에만 실행:
& $script -Mode AcquireAndVerify -Film Sintel
& $script -Mode AcquireAndVerify -Film TearsOfSteel
\`\`\`

기본 공간 요구량은 **최소 약 2~3GB 여유**를 권장하며 ZIP 추출 임시 공간과 플랫폼별 추가 사용량을 고려한다. 다운로드 실패·중단 시 \`*.partial-<random>\` 임시 파일은 자동 정리한다. 다운로드된 파일은 사용자가 명시적으로 관리하며, 기존 폴더를 자동 삭제·덮어쓰기하지 않는다. Windows PowerShell 실행 정책 및 방화벽 제한은 사용자 정책을 우회하지 않고 관리자의 허용 범위에서 처리한다.

**원격 CI는 네트워크를 사용하는 \`AcquireAndVerify\`를 실행하지 않는다.** Windows CI에서 검증하는 것은 \`Plan\`과 Git 작업 트리 내부 미디어 저장 차단뿐이다.

## 4. 결과 취급과 승인 게이트

\`AcquireAndVerify\`의 JSON은 영상/자막 파일 SHA-256, 재생시간·화면 크기·코덱, SRT 구간과 원본 길이의 정합성, Sintel 게시 자막 추출 텍스트 시간코드 일치 여부, 검증 게이트 상태를 표시한다.

가능한 판정:
- \`LOCAL_PUBLISHER_MEDIA_INSPECTED_NOT_SERVICE_APPROVED\`: 로컬 파일의 해시/메타데이터를 관찰한 것.
- \`MATCHES_PUBLISHER_TEXT_EXTRACTED_TIMINGS_ONLY\`: Sintel 공식 페이지에서 추출된 타임코드와 숫자가 일치하는 것. 음성 동기화나 원본 SRT 해시 일치가 아니다.
- \`NOT_VERIFIED_WITH_AUDIO\`: 실제 발화 동기화는 미검증.
- \`youtubeVideoSameVersionVerified=false\`, \`realDatasetApproved=false\`, \`g3Authorized=false\`: 검증이 성공해도 유지해야 하는 제한.

실제 영상·SRT 전문, 로컬 파일 경로, 접근 키, 개인 신원정보는 GitHub에 기록하지 않는다. 검증 JSON에서 원본 파일명/로컬 경로가 노출되지 않도록 출력이 제한된다. 파일의 SHA-256은 콘텐츠 식별 정보이므로 팀의 공개 범위에 따라 게시 여부를 검토한다.

## 5. 이번 회차 완료 기준과 미완료

- 원격 브랜치에 다운로드/검증용 Windows 도구 및 \`Plan\` CI 추가.
- 공식 링크·공개 인덱스의 크기 확인.
- **사용자 Windows에서의 실제 다운로드/ffprobe/MD5/SRT 검사: NOT_RUN.**
- 실제 영상 기반 36개 평가 문항·2인 독립 검수: NOT_RUN.
- YouTube판 비교·LLM 유료 실험·운영 전환·병합: NOT_APPROVED.

**G2-C는 실영상 증거를 아직 요구하므로 G3 전환이 불가하다.**


## 6. 사용자 제공 Sintel 로컬 검증기 출력 검토 (2026-11-05)

> 증거 등급: **OPERATOR_SUBMITTED_TOOL_JSON / NOT_INDEPENDENTLY_REPLAYED**. 이 기록은 사용자가 제공한 PowerShell 출력에서 발췌한 **비민감 요약**이다. 원본 영상·SRT의 바이트는 이 대화 실행 환경에 전달되지 않았으며 해당 파일의 해시 전문과 사용자 로컬 경로는 공개 저장소에 싣지 않았다.

| 항목 | 사용자 제출 결과 | 검수 판단 |
|---|---|---|
| film / mode | `Sintel` / `LOCAL_PUBLISHER_MEDIA_INSPECTED_NOT_SERVICE_APPROVED` | 예상 출력 형식 일치 |
| 공식 배포 서버 다운로드 요청 | 3회 | 영상 ZIP + 영어 SRT + 공개 MD5 확인 요청으로 해석 가능. **YouTube 다운로드가 아님** |
| 배포 ZIP 크기 | `publisherMovieByteLengthMatchesIndex=true` | 공개 배포 인덱스 크기 검사 PASS(운영자 출력 기준) |
| 제작자 MD5 | `MATCHES_PUBLISHER_MD5` | 제공자 MD5 비교 PASS(운영자 출력 기준). MD5 단독으로 라이선스·원본 판본/YouTube판 인증하지 않음 |
| 압축 해제된 영상 SHA-256 | **64자리 값 산출, 비공개** | 해시 생성 보고, 직접 독립 재검증 아님 |
| 미디어 바이트 | `681285280` | ZIP 크기가 아닌 **압축 해제된 MKV 크기** |
| 실제 영상 런타임 | `888032ms` (14:48.032) | 공식 게시 14:48 메타데이터와 근접 |
| 영상 속성 | `1280×544`, `h264` | 해상도·코덱 실측 보고 |
| 영어 자막 SHA-256 | **64자리 값 산출, 비공개** | 로컬 SRT 파일 해시 생성 보고 |
| 자막 구간 | 26개, 첫 시작 `107250ms`, 마지막 끝 `629800ms` | SRT 구문 및 영상 경계 검사 `PASS_BOUNDS_ONLY` |
| 공식 Sintel 게시 자막 타임코드 | `MATCHES_PUBLISHER_TEXT_EXTRACTED_TIMINGS_ONLY` | 타임코드 대조 PASS. **발화/음성 동기화나 SRT 바이트 동일성은 미증명** |
| API 요청 및 과금 | YouTube/LLM API 호출 0, 과금 $0 | 사용자 도구 출력 보고 |
| `youtubeVideoSameVersionVerified` | `false` | 원본-YouTube판 독립 확인 필요 |
| `actualSpokenCaptionAlignmentVerified` | `false` | 실제 발화·SRT 타임코드 시청 검토 필요 |
| `realDatasetApproved`, `g3Authorized` | 모두 `false` | 기존 정책 게이트 유지 |

**Sintel의 파일 메타데이터·자막 시간 범위에 관한 운영자 제출 검증은 PASS로 기록**하되, **G2-C 전체 데이터셋 승인과 구별**한다.

- Sintel 로컬 파일 보고: **1/2** 작품의 운영자 제출 증거 확보
- Tears of Steel 로컬 파일 보고: **0/2**, 아직 결과 없음
- 사람에 의한 실제 음성–자막 동기화: **0/2**
- YouTube 게시본–Blender 원본 판본 확인: **0/2**
- 별도 서비스 이용권·2인 골드 검수: **0/2**
- G3 실호출 / 기능 브랜치 병합: **승인 없음**

### 다음 실행

현재 `C:\Projects\YOUTOPIA-VIDEO-G2C`의 동일 Worktree에서 아래 명령으로 Tears of Steel의 공식 **최초 HD 720p판**에 대한 로컬 검증기를 실행한다. 사전에 로컬 디스크 여유·네트워크 허용 여부를 확인한다.

```powershell
$script = '.\shared\experiments\yu-video-understanding-poc-v0\g2c-windows-official-media.ps1'
& $script -Mode AcquireAndVerify -Film TearsOfSteel
```

**판정: `SINTEL_LOCAL_MEDIA_METADATA_AND_SRT_BOUNDS_REPORTED_PASS / G2C_FULL_EVIDENCE_INCOMPLETE / G3_NOT_APPROVED`.**


## 7. 사용자 제공 Tears of Steel 로컬 검증기 결과 (2026-11-05)

> 증거 등급: **OPERATOR_SUBMITTED_TOOL_JSON / NOT_INDEPENDENTLY_REPLAYED**. 사용자가 실행한 `g2c-windows-official-media.ps1 -Mode AcquireAndVerify -Film TearsOfSteel` 출력의 비민감 요약. ChatGPT 측에서는 원본 MOV/SRT 바이트를 보유하거나 재측정하지 않았다. SHA-256 전문과 로컬 경로는 공개 저장소에 게시하지 않는다.

| 항목 | 운영자 제출 관찰 | 판정 |
|---|---|---|
| 모드·대상 | `LOCAL_PUBLISHER_MEDIA_INSPECTED_NOT_SERVICE_APPROVED` / `TearsOfSteel` | 출력 계약 일치 |
| 다운로드 | `publisherDownloadRequestsThisRun=2` | Blender 제작자 서버 영상 MOV·영어 SRT 요청의 로컬 실행 기록 |
| 파일 크기 | `publisherMovieByteLengthMatchesIndex=true`, `mediaByteSize=372178639` | [공식 서버 인덱스](https://download.blender.org/demo/movies/ToS/)의 최초 HD 720p MOV 크기와 보고값 일치 |
| 제작자 체크섬 | `publisherMd5Evidence=NOT_AVAILABLE` | 이 실험 계약의 Tears 대상에는 MD5 URL 없음. 체크섬 미검증은 **실패도 승인도 아님** |
| 영상 SHA-256 | 64자리 해시 산출 보고, 전문 비공개 | 로컬 바이트 식별용, 제작자 측 원본 해시와 독립 비교 미실시 |
| 실제 재생시간 | `734167ms` (12분 14.167초) | 공개 Studio 12:14 메타데이터와 근접 |
| 영상 속성 | `1280×534`, `h264` | ffprobe 메타데이터 관찰 보고 |
| SRT SHA-256 | 64자리 해시 산출 보고, 전문 비공개 | 로컬 SRT 식별용, 원본 게시 파일 해시와 독립 비교 미실시 |
| SRT 구간 | `76`, `23000ms`~`567000ms` | 00:23.000~09:27.000 |
| 자막 범위 | `PASS_BOUNDS_ONLY` | 자막 구간이 로컬 영상의 끝을 넘지 않음. 실제 말소리와 일치하거나 후반 발화가 없다는 증거는 아님 |
| 제작자 자막 타임코드 대조 | `NO_EXTRACTED_PUBLISHER_TIMING_REFERENCE` | Sintel과 달리 공식 게시 SRT 본문 대조 자료가 없음 |
| YouTube/LLM API 요청 | `youtubeMediaDownloadRequests=0`, `youtubeDataApiCalls=0`, `llmApiCalls=0`, `actualProviderCalls=0` | 사용자 출력 기준 보고값 |
| 과금 | `actualSpendUsd=0` | 사용자 출력 기준 보고값 |
| 후속 Gate | `youtubeVideoSameVersionVerified=false`, `actualSpokenCaptionAlignmentVerified=false`, `realDatasetApproved=false`, `g3Authorized=false` | 모두 **차단 유지** |

**Tears of Steel의 로컬 영상 메타데이터와 자막 구문·시간 범위 검사에 관한 운영자 제출 결과는 PASS로 기록한다.** 파일 크기 일치는 SHA-256에 대한 공식 제작자 확인과 동치가 아니며, CC 라이선스·초상권·YouTube판 동일성 승인도 아니다.

## 8. 두 작품 통합 상태 (2026-11-05, 최신)

이 절의 현재 상태는 위에서 작성한 초기 문서의 `NOT_RUN` 및 이전 Sintel 1/2 요약보다 **시간상 최신**이다. 검증 코드는 수정하지 않았으며 이 변경은 문서화에 한정된다.

| 증거 구분 | Sintel | Tears of Steel | 전체 |
|---|---|---|---|
| 운영자 로컬 실파일 검증 JSON 수신 | YES | YES | **2/2** |
| 로컬 SHA-256 생성 보고 | YES | YES | **2/2** |
| 로컬 영상 재생시간·코덱 검사 보고 | PASS | PASS | **2/2** |
| 로컬 SRT 구문·시간 범위 검사 보고 | PASS | PASS | **2/2** |
| 제작자 MD5와 로컬 영상 비교 | MATCH | UNAVAILABLE | **1/2** |
| 제작자 게시 SRT 추출 타임코드 비교 | MATCH_TIMING_ONLY | REFERENCE_UNAVAILABLE | **1/2** |
| 사람이 실제 영상 발화와 SRT 동기화 확인 | NO | NO | **0/2** |
| YouTube 업로드판/제작자 원본 동일성 독립 검토 | NO | NO | **0/2** |
| 서비스 사용권(제3자 권리·전송·보존 포함) 독립 검토 | NO | NO | **0/2** |
| 사람 2명의 실제 영상 질문·근거 정답 검수 | NO | NO | **0/2** |
| G3 유료 API 첫 호출 승인 | NO | NO | **0/2** |

### 후속 검증 순서

1. 실제 영상 **시작·중간·끝의 발화와 자막 타이밍**을 로컬 재생으로 검수한다. 특히 Tears는 SRT 종료(09:27) 이후 발화 누락 여부를 별도 확인한다.
2. YouTube 공식 재생 페이지에서 허용된 방식으로 각 작품의 앞·중·끝 장면·편집 순서·오디오 이벤트를 공식 원본과 비교한다. YouTube 스트림 비인가 다운로드는 하지 않는다.
3. 권리·보존·송신 검토와 인간 정답 독립 검수를 완료한 뒤 G3 호출 대상·최대 비용·개별 승인 여부를 결정한다. **현재 외부 API 호출 승인 없음.**

최종 판정: `G2C_OPERATOR_SUBMITTED_LOCAL_FILE_AND_SRT_BOUNDS_2_OF_2_PASS / MEDIA_YOUTUBE_EQUIVALENCE_NOT_VERIFIED / SPOKEN_CAPTION_ALIGNMENT_NOT_VERIFIED / RIGHTS_AND_GOLD_BLOCKED / G3_NOT_APPROVED / NO_MERGE`.
