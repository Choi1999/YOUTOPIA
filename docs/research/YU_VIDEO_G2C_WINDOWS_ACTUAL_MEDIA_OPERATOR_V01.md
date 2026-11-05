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
