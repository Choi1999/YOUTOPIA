# YOUTOPIA — G2-C Blender 원본·자막·YouTube 판본 증거 검증 v0.1

> 작성/공개 자료 검증: **2026-11-05 KST**  
> 기준 브랜치: `experiment/yu-video-understanding-poc-v01`  
> 착수 HEAD: `b6830242ad081c42339b5fe235d934f38e017f87`  
> **최종 범위: 공개 공식 근거 검수 + 오프라인 로컬 파일 검증기 구현. 영상과 자막 실제 바이트 확보·발화 동기화 및 YouTube 판본 일치 검증은 수행하지 않음.**
>
> 상태: **G2C_PUBLISHER_DOCUMENTARY_EVIDENCE_CONFIRMED / LOCAL_MEDIA_INSPECTION_NOT_RUN / YOUTUBE_EQUIVALENCE_UNVERIFIED / G3_POLICY_HOLD / LIVE_API_ZERO / NO_MERGE**

## 1. 권리·미디어 출처에 대한 독립 확인 결과

| 증거 | Sintel — SYNTH-VID-05 | Tears of Steel — SYNTH-VID-06 |
|---|---|---|
| 프로젝트 공식 배포 | [Durian Download](https://durian.blender.org/download/) | [Mango Download](https://mango.blender.org/download/) |
| 공개 라이선스 | [Durian Sharing: CC BY 3.0](https://durian.blender.org/sharing/) | [Mango About: CC BY 3.0](https://mango.blender.org/about/) |
| 공식 영문 SRT 목록 | **확인** (영어 및 다국어) | **확인** (영어 및 다국어) |
| 공개 재생시간 참고 | [Blender Studio: 14:48](https://studio.blender.org/projects/sintel/) | [Blender Studio: 12:14](https://studio.blender.org/projects/tears-of-steel/?asset=42) |
| 배포판 주의 | 파일 코덱·해상도·버전 선택 필요 | **2012 최초 HD판 / 2013 4K 재렌더판 구별 필수** |
| YouTube URL 참고 | [eRsGyueVLvQ](https://www.youtube.com/watch?v=eRsGyueVLvQ) — 감독 글의 교차 링크; 재생 영상 직접 비교 없음 | [OHOpb2fS-cM](https://www.youtube.com/watch?v=OHOpb2fS-cM) — [Commons의 출처 기록](https://commons.wikimedia.org/wiki/File:Tears_of_Steel_in_4k_-_Official_Blender_Foundation_release.webm), 제작자의 [4K YouTube 공개 공지](https://mango.blender.org/); 영상 ID-원본 직접 실측 일치 증거는 없음 |
| 별도 법률·권리 | CC 외 Blender/프로젝트 로고 및 상표 제외, 적절한 출처·크레딧 표시 필요 | [배우 초상권·사생활권](https://mango.blender.org/production/4-tb-original-4k-footage-available-as-cc-by/)은 CC 저작권과 별도로 잔존, 배우의 상업 광고 활용에 제약 |
| 실제 원본 SHA-256 | **미검증** | **미검증** |
| 실제 SRT 구간 및 발화 동기화 | **미검증** | **미검증** |
| YouTube판과 원본 장면·편집 비교 | **미검증** | **미검증** |
| YOUTOPIA의 모델 전송·보존·상업 범위 검토 | **미승인** | **미승인** |

공식 배포 페이지가 영상/자막을 열거한 사실은 확인할 수 있지만, 다운로드가 현재 정상 동작하는지 또는 영상·자막 바이트가 정확한지 확인한 것은 아니다. 본 회차의 탐색 환경에서는 제작자 페이지의 실제 원본/자막 파일을 가져올 수 없었고, 저장소 CI에는 영상이나 SRT 전문을 올리지 않았다.

### CC BY 조건과 서비스 적격성 구분

- **Sintel:** Blender 공식 설명은 상업적 재사용을 포함한 CC BY 3.0 사용권을 명시하고, 영화 자체 재배포/상영에는 **전체 크레딧 스크롤**을 요구한다. 그 외 사용 시 Blender Foundation·Durian 출처를 표시해야 한다. 로고·상표 등은 CC 범위에 포함하지 않는다.
- **Tears of Steel:** 영화 공개 라이선스는 CC BY 3.0이며 영화 자체 상영·배포에는 크레딧 유지가 요구된다. 배우가 등장하는 영화·원촬영 데이터는 **초상권과 사생활권**을 별도로 검토해야 한다. 원본 영상의 LLM 서비스 입력/정답 데이터 저장은 사용 목적·제3자 전송·권리 보호를 독립적으로 판단한다.
- **YouTube 플랫폼:** 공식 공개 영화의 별도 배포본이 있더라도, YouTube 사이트/YouTube Data API로부터 재생 시청각 스트림을 승인 없이 다운로드·캐시하는 행위와는 별개의 문제다. 이번 G2-C는 YouTube 영상·자막을 추출하지 않는다. [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies).

## 2. 핵심 개선: G2-B 사실 오류 수정

기존 G2-B 원장에는 Sintel의 `officialTimedCaptionsListed=false`라고 기재되어 있었다. 공식 [Sintel Download](https://durian.blender.org/download/)에서 영어 SRT 배포 목록이 확인되어 **`true`로 정정**했다. 따라서 전체 6개 후보의 공식 시간형 자막 **목록 보유 후보** 집계는 **3→4개**다.

이 숫자는 **실제 내려받은 SRT 개수 0, 원본 발화 타임라인 정렬 통과 0개**와 구분한다. G2-B의 승인/비교 결과가 상향되지 않는다.

## 3. 구현한 G2-C 검사기

| 파일 | 역할 |
|---|---|
| `shared/experiments/yu-video-understanding-poc-v0/g2c-blender-evidence.json` | 제작자 공식 라이선스·배포·재생시간·두 판본·자막 목록·별도 권리·증거 URL을 저장한 **메타데이터 원장** |
| `shared/experiments/yu-video-understanding-poc-v0/g2c-offline-verifier.cjs` | 허위 승인 거절, 공개 근거 정합성 검사 및 **사용자 선택 실행형 로컬 파일 검증기** |
| `shared/experiments/yu-video-understanding-poc-v0/tests/g2c-local-verifier.test.cjs` | SRT 파서·리버스 타임라인·자막 범위 초과·미디어 메타데이터·출처·권리 상태 위조 등 부정 테스트 |
| `.github/workflows/yu-video-g1-offline.yml` | G1/G2/G2-B 범위와 함께 G2-C의 **실제 미디어 없는 정적 테스트**만 실행 |

파일 없이 실행: `node shared/experiments/yu-video-understanding-poc-v0/g2c-offline-verifier.cjs`

권리 확보된 **로컬** 원본/자막의 선택적 검사:

```powershell
$root = 'shared/experiments/yu-video-understanding-poc-v0'
node "$root/g2c-offline-verifier.cjs" --slot SYNTH-VID-05 --video "D:\AuthorizedMedia\sintel.mp4" --srt "D:\AuthorizedMedia\sintel.en.srt"
node "$root/g2c-offline-verifier.cjs" --slot SYNTH-VID-06 --video "D:\AuthorizedMedia\tears_of_steel.mov" --srt "D:\AuthorizedMedia\tears.en.srt"
```

Windows에서 `ffprobe`가 PATH에 등록되어 있어야 한다. 실행 전에 해당 파일의 취득/사용 허가가 적합한지 확인하고 **공식 제작자 원본인지와 파일 판본**을 비공개 증거로 기록한다. CLI는 파일을 바꾸지 않고, 영상 SHA-256·로컬 스트림/재생시간·SRT SHA-256·자막 구조·영상 길이 초과 여부만 반환한다. 내용(자막 원문·영상 장면)은 출력하지 않는다. ffprobe 네트워크 프로토콜은 허용하지 않으며, 외부 URL/플레이리스트 및 비정상 경로를 거절한다.

**검사 성공 시에도 다음은 증명되지 않는다:** 제작자 원본과 동일 파일인지, CC 라이선스의 YOUTOPIA 서비스 범위 승인 여부, YouTube판과 동일한 편집/장면/음성인지, SRT가 실제 발화와 밀리초 단위로 일치하는지, 독립 2인 정답 검수가 이루어졌는지. **SRT가 러닝타임 안에 있다는 것과 실제 발화가 SRT와 동기화되어 있다는 것은 별개의 주장**이다.

## 4. 후속 실영상 실증(현재 미실행)

1. Sintel의 허가된 공식 원본판 1종과 같은 제작자 SRT를 로컬에 확보. Tears of Steel은 **2013 4K 리렌더/HD 다운스케일**과 **2012 최초 HD** 중 어떤 판본을 테스트할지 명시적으로 선정하고 해당 판본용 자막을 확보한다.
2. 로컬 `ffprobe`로 실제 초 단위 길이·해상도·비디오/오디오 스트림을 판별하고, SHA-256/출처·파일명·다운로드 시각·크레딧/저작자 표기 의무는 **제한된 증거 원장**에 기록한다. 영상을 GitHub에 넣지 않는다.
3. `SRT`의 문법·구간 경계·빈 구간·중복/겹침을 검사한다. 이 값은 **형식 검증**으로만 사용한다.
4. 두 명의 인간 검수자가 실제 **음성 발화와 자막 시작·종료의 일치성**을 중요한 장면 여러 곳(시작·중간·종료)에서 검수하고 편차를 기록한다. OCR·시각적 사건은 별도 장면 라벨을 만든다.
5. 공식 YouTube 페이지의 **허용된 재생/메타데이터 확인**으로 앞·중·끝의 장면·서사 순서·음성 이벤트를 원본과 대조한다. 재인코딩으로 파일 해시가 달라질 수 있으므로 YouTube 파일 바이트 해시 일치를 강제하지 않는다. YouTube 스트림 불법 추출 금지.
6. 별도 독립 검토자가 실제 권리(라이선스·초상·음악·송신/보존)와 두 명의 정답 검수 기록을 승인한 경우에만 후속 단계의 후보로 검토한다. G3의 외부 API 실행은 **최초 실호출 범위·계정·요금·한도·폐기 계획의 별도 승인** 필요.

## 5. 정확한 현재 증거 등급

| 항목 | G2-C 결과 |
|---|---|
| 제작자 영화 라이선스·배포·영문 SRT 목록 문서화 | **2/2 CONFIRMED** |
| 제작자 Studio 페이지의 게시물 재생시간 확인 | **2/2 PUBLISHED_METADATA_ONLY** |
| 판본 선택 및 원본 바이트·해시 실측 | **0/2** |
| 원본 SRT 실제 파일 문법·구간 검사 | **0/2** |
| YouTube 게시본과 원본 동일성 실증 | **0/2** |
| 실제 발화·자막 동기화 | **0/2** |
| 개별 서비스 이용권·초상/음악 검토 | **0/2** |
| 2인 독립 인간 정답 및 증거 검수 | **0/2** |
| API 호출·운영 데이터 변경·과금·병합 | **0** |

## 6. 테스트 및 병합 상태

원격 [GitHub Actions #41980227424](https://github.com/Choi1999/YOUTOPIA/actions/runs/41980227424), 코드 SHA `2e7cbd42d7c409389305698e8eb91d825630a879`: Node 24 기준 **104개 PASS / 0 FAIL**, 구문 검사 및 G1·G2·G2-B·G2-C 하드 게이트 모두 PASS. 앞선 SRT 빈 블록 테스트 실패는 파서에서 빈 자막과 잘못된 인덱스 예외를 분리해 수정했으며, 수정 이후 재검증 성공을 확인했다. 이 통과는 **합성 SRT + 공개 메타데이터 검사**이며 실영상 파일/자막 원문이 입력된 테스트는 아니다. 

G2-C 게이트는 **실영상 준비가 없어도 조사 단계의 테스트를 PASS**할 수 있지만, 이때 `approvedRealDatasetCount=0`, `g3Authorized=false`, `liveCallsAuthorized=false`를 유지해야 한다.

**판정:** `G2C_PUBLISHER_EVIDENCE_PASS / G2C_REAL_MEDIA_EQUIVALENCE_NOT_RUN / G3_NOT_APPROVED / EXISTING_POLICY_HOLD_UNCHANGED / NO_MERGE`.


## 7. 2026-11-05 승인 후 실파일 확보 시도 및 진행 증거

**시도 결과: 일부 공개 자막 텍스트만 접근 성공. 실제 미디어 파일 검증은 차단 상태.**

- 제작자 원본 페이지 `https://durian.blender.org/download/` 및 `https://mango.blender.org/download/`의 공식 미디어/SRT 다운로드 링크를 확인했다.
- 실제 영상 파일(수백 MB)은 현재 작업 환경의 네트워크·다운로드 경로에서 획득하지 못했으므로, **원본 바이트/SHA-256·코덱·실제 러닝타임·파일과 YouTube판의 장면/음성 동일성을 검사한 바 없다**. 사용자 Windows PC의 로컬 파일에는 접근하지 않았다.
- Sintel의 제작자 호스트 `https://durian.blender.org/wp-content/content/subtitles/sintel_en.srt`에서 **게시 자막의 추출 텍스트를 읽는 데 성공**. 텍스트 뷰에서 1~26번 연속 타임코드가 확인되며, 첫 시작 **00:01:47,250**, 마지막 종료 **00:10:29,800**. 아래 파일에 **대사 없이 시간코드만** 기록:
  - `shared/experiments/yu-video-understanding-poc-v0/g2c-sintel-publisher-timeline.json`
  - 출처 등급: `PUBLISHER_SUBTITLE_TEXT_EXTRACTION_NOT_RAW_FILE` — 텍스트 추출기는 원본의 공백/줄바꿈을 바꿀 수 있으며, **원본 SRT 파일 바이트/SHA-256 확인이나 음성 동기화 증거가 아니다**.
- Tears of Steel의 제작자 영어 자막 링크는 `https://download.blender.org/demo/movies/ToS/subtitles/TOS-en.srt`이고 서버 인덱스상 **4,764바이트로 목록 표시**되지만, 이번 실행 환경에서 해당 파일 본문은 봇 차단 및 네트워크 오류로 확보하지 못했다. **다운로드 성공이나 내용 검증을 주장하지 않는다.**
- 자막 파서는 공백 줄이 없는 텍스트 프로젝션도 번호+타임코드 구분으로 인식하도록 보강했다. Sintel 26개 공개 타임코드를 사용해 **대사 없는 합성 SRT**를 구성하여 파서와 게시 타임라인 비교 로직을 시험한다. 이 검증은 실제 자막 파일을 판독했다는 의미가 아니다.
- `g2c-offline-verifier.cjs`에서 사용자가 적법하게 제공한 **로컬** Sintel SRT를 검사할 때 위의 제작자 게시 텍스트 시간코드와 비교한다. `MATCHES_PUBLISHER_TEXT_EXTRACTED_TIMINGS_ONLY`는 **타임코드만 일치**함을 의미하며, 원본 바이트나 YouTube 영상·실제 음성 확인을 의미하지 않는다.

### 7.1 로컬 실파일 검수 실행 전제

본 단계에서 사용자 PC의 실제 영상·자막이 제공되지 않았으므로, **도구는 코드로 구현되어 있고 실제 파일 검수 결과는 아직 없음**. 사용자가 권리 허용 범위에서 공식 제작자 원본과 같은 판본의 SRT를 확보한 후 Windows PC에서 다음을 실행한다.

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
# 실험 브랜치의 최신 파일을 격리된 작업 폴더에 가져온 후 실행.
# 현재 작업 중인 frontend 및 미병합 PR 브랜치는 변경하지 않는다.
$root = 'shared/experiments/yu-video-understanding-poc-v0'
node --test "$root/tests/*.test.cjs"
# 실제 파일의 경로로 예시를 교체
node "$root/g2c-offline-verifier.cjs" --slot SYNTH-VID-05 --video "D:\AuthorizedMedia\sintel.mp4" --srt "D:\AuthorizedMedia\sintel_en.srt"
node "$root/g2c-offline-verifier.cjs" --slot SYNTH-VID-06 --video "D:\AuthorizedMedia\tears_of_steel.mov" --srt "D:\AuthorizedMedia\TOS-en.srt"
```

`ffprobe`가 PATH에 필요하다. 단순 `git fetch`는 체크아웃 파일을 변경하지 않으므로 **명령 실행 전에 실험 브랜치 파일이 해당 작업 폴더에 존재하는지 확인**해야 한다. 출력 JSON의 해시·길이·SRT 범위·타임라인 비교 판정만 검수하고, 개인 파일 경로·영상 내용·계정정보·키·자막 전문은 GitHub에 게시하지 않는다.

### 7.2 재평가 게이트

| 증거 | 이 회차의 측정 상태 |
|---|---|
| 제작자 공개 SRT 원문 **텍스트 프로젝션** 분석 | Sintel 1/2, Tears 0/2 |
| 원본 실제 SRT **파일 바이트 해시** | 0/2 |
| 허가된 공식 영상 **파일 해시/ffprobe** | 0/2 |
| 로컬 파일 SRT 구간과 영상 실제 길이 비교 | 0/2 |
| 실제 음성/자막 싱크에 대한 인적 검토 | 0/2 |
| 게시된 YouTube판과 원본의 동일성 | 0/2 |
| 모델 API 호출/과금, G3 승인 또는 운영 병합 | 0 |

**판정: `G2C_OFFICIAL_SINTEL_SUBTITLE_TEXT_PARTIAL_EVIDENCE / SOURCE_VIDEO_AND_RAW_SRT_BYTES_NOT_VERIFIED / G3_POLICY_HOLD / NO_MERGE`.**
