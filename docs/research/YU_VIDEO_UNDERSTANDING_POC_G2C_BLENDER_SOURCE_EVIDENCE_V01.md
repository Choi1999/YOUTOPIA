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
