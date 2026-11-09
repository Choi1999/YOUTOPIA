# YOUTOPIA — G2-H1 NASA VID-01/VID-03 공식 소스·권리 적격성 조사

> 기준일: 2026-11-09 (KST). 사용자 승인 범위: **공식 공개 정보 조사·오프라인 검증 및 문서화만**.
> 상태: **PUBLIC_METADATA_RESEARCH_COMPLETE / SOURCE_ELIGIBILITY_BLOCKED / 0_MEDIA_BYTES / 0_RIGHTS_APPROVAL / G3_NO_GO / NO_MERGE**.
> 계획 연결: [G2-H 4편·24문항 확장 설계](./YU_VIDEO_G2H_DATASET_EXPANSION_PLAN_V01.md), [G2-H1 공개 메타데이터 원장](../../shared/experiments/yu-video-understanding-poc-v0/g2h1-nasa-source-readiness.json).

## 1. 조사 범위 및 증거 등급

기존 G2-B/G2-H 후보 가운데 **SYNTH-VID-01(인터뷰)**과 **SYNTH-VID-03(화면 시연)**만 대상으로 NASA 공식 게시처와 관련 이용 지침을 확인한다. 영상·오디오·SRT/VTT 원문·자막을 이 작업에서 다운로드하거나 실제 파일을 해싱하지 않았다. 따라서 실제 영상 길이, 장면, 대사, 자막 싱크, 저작물 사용권이 통과했다고 주장하지 않는다.

공개 페이지의 **다운로드 목록 있음**은 실제 미디어를 확보했다는 뜻이 아니며, **YouTube 임베드 있음**은 NASA가 배포한 MP4와 모든 장면이 같은 편집판이라는 뜻이 아니다.

## 2. VID-01 — Transients from Space Science Workshop Interviews

공식 원문: https://science.nasa.gov/asset/webb/transients-from-space-science-workshop-interviews/

| 검토 항목 | 공식 페이지에 나온 정보 | 상태 |
|---|---|---|
| 게시일 | 2025-03-31 | 공식 표시 확인 |
| 영상 자산 | 자막 없음 MP4 1920×1080·30fps·22.98 MB, 자막 포함 MP4 1920×1080·30fps·23.03 MB | **LISTED_ONLY** |
| 시간 자막 | 별도 SRT 1.86 KB 및 VTT 2.4 KB 목록 | **LISTED_ONLY** |
| 대본 | DOC 19.96 KB, TXT 986 B 목록 | **LISTED_ONLY** |
| YouTube | 페이지에 플레이어 표시 | **영상 ID 확인 불가 / 판본 비교 안 함** |
| 크레딧 | NASA, ESA, CSA, STScI, Danielle Kirshenblat | **다기관·인물 및 제3자 기여도 검토 필요** |
| 러닝타임 | 공식 페이지 본문에서 분/초 확인 불가 | **미확인 — G0 3~15분 충족 미증명** |

권장 원본 구성은 **공식 무자막 1080p MP4 + 같은 배포판의 분리 SRT/VTT**이지만, 실제 재생·해시·싱크 검증 및 해당 이용 범위가 허용된 뒤에만 확정한다. NASA 페이지의 '1 min read'는 **웹페이지 독서 예상 시간**이므로 영상 길이로 전용하지 않는다. '자막 포함 MP4'와 '무자막 MP4'는 별도 배포 항목이므로 서로 같은 바이트라고 처리하지 않는다.

**VID-01 현재 판정:** `PUBLIC_MEDIA_AND_CAPTION_LISTINGS_CONFIRMED / OFFICIAL_YOUTUBE_ID_UNVERIFIED / FILM_DURATION_UNVERIFIED / SCOPED_RIGHTS_UNAPPROVED`. 이번 자료는 시각 사건이 최소 1개, 시간 순서 사건이 최소 2개 존재한다는 것도 검증하지 않는다. 인터뷰 6문항 구성 가능 여부는 실제 승인된 미디어의 관찰 이후 판정한다.

## 3. VID-03 — NASA Eyes on the Earth Tutorial

공식 원문: https://science.nasa.gov/resource/tutorial-nasas-eyes-on-the-earth/

| 검토 항목 | 공식 페이지에 나온 정보 | 상태 |
|---|---|---|
| 게시일 | 2023-03-28 | 공식 표시 확인 |
| 제작 크레딧 | NASA/JPL-Caltech | 공식 표시 확인 |
| NASA 배포 영화 | 1920×1080 MP4, 182.08 MB 목록 | **LISTED_ONLY** |
| NASA 게시 페이지의 YouTube 임베드 | https://www.youtube.com/embed/p-6DusnZ1pQ | **임베드 ID 확인 / 동일 편집판 미검증** |
| 공식 시간 자막 | 해당 NASA 페이지에서 별도 SRT/VTT 목록 확인되지 않음 | **미확인 (존재하지 않는다는 결론 아님)** |
| 텍스트 대본 | 해당 페이지에서 별도 TXT/대본 목록 확인되지 않음 | **미확인** |
| 러닝타임 | NASA 페이지의 재생 시간 표기 미확인 | **미확인 — G0 3~15분 충족 미증명** |

이 후보의 질문 설계는 OCR 3문항·시각 1문항·발화 1문항·시간 순서 1문항이다. 그러나 공식 페이지에 보이는 정보만으로 **프레임의 실제 글자 판독 가능 여부, 영상 속 발화 존재/정합성, 시연 단계 2개를 구분할 수 있는지**는 확인할 수 없다.

**VID-03 현재 판정:** `OFFICIAL_MP4_LISTING_AND_YOUTUBE_ID_CONFIRMED / TIMED_CAPTIONS_UNVERIFIED / MEDIA_EQUIVALENCE_UNVERIFIED / RIGHTS_UNAPPROVED`. 공식 제공 캡션을 확인할 수 없다면 무단 YouTube 자막 추출로 보완하지 않고, 권리자로부터 허용된 타임드 스크립트를 받거나 동종 화면 시연 후보로 교체한다.

## 4. 권리와 YOUTOPIA 서비스 이용 범위

권리·정책 기본 원문:

- NASA 미디어 이용 지침: https://www.nasa.gov/nasa-brand-center/images-and-media/
- YouTube API 개발자 정책: https://developers.google.com/youtube/terms/developer-policies

NASA 지침은 NASA 자체 영상·이미지·오디오가 미국에서 일반적으로 저작권 보호를 받지 않는 범위를 설명하지만, NASA 이름·휘장·표장 및 인물의 초상·퍼블리시티권, 제3자 영상/음악 저작권, 광고·상품 보증 오인을 제외하지 않는다. NASA 자체 사용 허가는 제3자 권리자의 자료를 YOUTOPIA에 재허가하지 않는다. VID-01은 복수 기관과 제작자 크레딧이 있으므로 자료별 기여 및 실제 이용 범위 검토가 중요하다.

NASA 지침에는 AI/SI 활용 관련한 주의 문구도 있으며, NASA 원문을 사용한 모델의 생성 결과를 NASA가 직접 검증·보증한 것으로 표시하면 안 된다. YOUTOPIA의 생성 답변·요약에는 NASA의 검증·승인을 암시하지 않는다.

YouTube 정책은 API 클라이언트가 YouTube 시청각 파일을 플랫폼의 사전 서면 승인 없이 다운로드·가져오기·캐시·백업하는 것을 제한한다. **NASA 공식 배포 원본을 해당 이용조건에 따라 받는 일**과 **YouTube 스트림을 수집하는 일**은 권한·정책상 별개의 작업이다. 공식 YouTube 임베드가 보인다는 사실도 전체 영상·자막을 제3자 AI 모델에 전송할 권한을 보증하지 않는다.

**아직 승인되지 않은 이용 범위:** 상업적 서비스 분석, 외부 모델 송신, 프레임·대본·임베딩 파생자료 저장, 장기 캐시, 재배포, 개인 출연자 이용, 저작권·라이선스 귀속, 철회/삭제 대응. 별도의 담당자가 작품별로 실제 권리 증거와 허용 범위·유효기간을 판정하기 전에는 `rightsScopeState=UNVERIFIED`로 유지한다.

## 5. G2-H1 통과 조건 및 다음 단계

| 게이트 | VID-01 | VID-03 |
|---|---|---|
| 공식 원본 다운로드 항목 확인 | 확인 | 확인 |
| 별도 공식 시간 자막 목록 확인 | 확인 | 미확인 |
| 공식 YouTube ID 확인 | 미확인 | 확인 |
| 동일 편집판·길이 3~15분 | 미확인 | 미확인 |
| 공식 SRT·실음성 일치 | 미확인 | 미확인 |
| OCR/시각/시간 질문 증거 | 미확인 | 미확인 |
| YOUTOPIA 사용권·제3자 모델 전송권 | 미승인 | 미승인 |
| 2인 독립 Gold 검수 및 운영자 판정 | 미시작 | 미시작 |

우선 진행 순서는 **(H1-A) VID-01의 런타임·공식 YouTube ID·원본 배포판·크레딧별 권리 문서 확인**, 이어서 **(H1-B) VID-03 공식 캡션/대본 확보 경로·MP4↔YouTube 판본 대조 방법·OCR 가독성 평가 가능성 확인**이다. 이들은 아직 자료/권리 연구에 한정된 후속 과제이며 실제 파일 다운로드나 전송을 허가하지 않는다.

사용권이 확인되기 전에는 영상·SRT 원문을 이 연구 저장소에 넣지 않는다. 판본/해시/타임코드 정보는 정식 승인·실파일 검증이 된 뒤 **비공개 원장**에 기록하고, 이 공개 원장의 미검증 필드를 허위로 PASS 변경하지 않는다.

### 5.1 현재 H1 결과

- 공식 NASA 미디어 배포 목록: **2/2**.
- 공식 독립 시간 자막 목록: **1/2**.
- 공식 영상 ID 확인: **1/2**.
- 실제 러닝타임 검증: **0/2**.
- 공식 원본↔YouTube 동일판 증빙: **0/2**.
- YOUTOPIA 서비스 이용권 승인: **0/2**.
- 실제 미디어 수집·사람 Gold 승인·유료 API 호출: **0**.

**최종 판정: `G2H1_PUBLIC_METADATA_RESEARCH_COMPLETE / SOURCE_ELIGIBILITY_BLOCKED / RIGHTS_0 / G3_NO_GO / NO_MERGE`**.
