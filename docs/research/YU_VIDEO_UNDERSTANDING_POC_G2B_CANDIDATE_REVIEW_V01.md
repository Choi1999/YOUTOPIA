# YOUTOPIA — G2-B 실제 영상 연구 후보·권리·동일성 검증 기록 v0.1

> 조사일: **2026-11-05 KST** · 브랜치: `experiment/yu-video-understanding-poc-v01`  
> 기준 커밋(착수 전): `77e411a56f16d59a9552dc42403de70ef4675047`  
> 상태: **6_CANDIDATES_RESEARCHED / 0_RIGHTS_APPROVED / 0_MEDIA_MATCHED / 0_CAPTIONS_ALIGNED / 0_HUMAN_GOLD_VERIFIED / NO_LIVE_CALLS / NO_MERGE**  
> 코드 원장: `shared/experiments/yu-video-understanding-poc-v0/g2b-public-candidates.json`

## 1. 작업 범위와 정직한 판정

공개된 **권리자/제작자 공식 페이지의 텍스트·메타데이터**를 토대로 6개 연구 후보를 찾았다. 이 단계에서는 원본 동영상·자막·댓글·음성을 **다운로드, 복사, 추출, 저장하거나 API에 전송하지 않는다**. 일부 페이지에 YouTube 임베드와 MP4 다운로드 링크가 동시에 표시되더라도 둘의 영상 픽셀·오디오·편집 길이·자막 타임라인이 같다는 증거는 아니다.

**선정 결과는 실제 비교 데이터셋 승인과 다르다.** 사용권·제3자 음악·인물·보존·모델 전송 조건, 실제 소스 해시, YouTube판 동일성, 독립된 사람이 검증한 정답은 전부 미완료다. G2/G1의 무실호출 하드 게이트는 불변이다.

## 2. 연구 후보 6건

| 슬롯 / 시험 분야 | 공개 후보 및 제작/권리 출처 | 공식 배포 정보 | YouTube 매핑 근거 | 남은 주요 장애 |
|---|---|---|---|---|
| 01 인터뷰 | [NASA — Transients from Space 인터뷰](https://science.nasa.gov/asset/webb/transients-from-space-science-workshop-interviews/) | 공식 MP4 + SRT/VTT + TXT 대본 목록 확인 | 공식 페이지에서 YouTube player 보이나 **영상 ID 확인 불가** | 동일판 여부, 인물·재사용 권한, 실제 캡션 정렬 |
| 02 인터뷰 | [NASA — Tommaso Treu 인터뷰](https://science.nasa.gov/asset/webb/webb-draws-back-the-curtains-on-an-undiscovered-universe-interview-with-tommaso-treu/) | 공식 MP4 + SRT/VTT + TXT 대본 | 공식 YouTube ID **미확인** | **Soundstripe 음악** 및 인물, 타임라인·매핑 |
| 03 화면 조작 | [NASA — Eyes on the Earth 튜토리얼](https://science.nasa.gov/resource/tutorial-nasas-eyes-on-the-earth/) | 공식 1080p MP4 목록 | 공식 페이지에 [YouTube ID p-6DusnZ1pQ](https://www.youtube.com/watch?v=p-6DusnZ1pQ) 임베드 | 자막·대본/인덱싱 허가 및 버전 일치 확인 |
| 04 화면 조작 | [NASA — Eyes on Exoplanets 튜토리얼](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/) | 공식 동영상과 **텍스트 대본** 존재, 원본 MP4 직접 배포 미확인 | YouTube ID **미확인** | 원본 파일 확보 가능성, SRT와 원본/YouTube 매핑 |
| 05 시각 동작 | [Blender — Sintel](https://durian.blender.org/download/) | 영화 원본 여러 포맷, [CC BY 3.0](https://durian.blender.org/sharing/) | 감독이 [공식 YouTube 영상](https://www.youtube.com/watch?v=eRsGyueVLvQ)을 [자기 소개글](https://vimeo.com/59785024)에 명시 | 각 재렌더 버전 일치, 자막·대본 시간 정렬, 저작자 표시 |
| 06 시각 동작 | [Blender — Tears of Steel](https://mango.blender.org/download/) | 원본/4K 리렌더 여러 판, **영어 SRT 제공**, [CC BY 3.0](https://mango.blender.org/about/) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Tears_of_Steel_in_4k_-_Official_Blender_Foundation_release.webm) 출처에서 [YouTube 4K판](https://www.youtube.com/watch?v=OHOpb2fS-cM) 간접 확인 | 버전 혼동(최초판/4K), 인물 초상권·상업광고 금지 주의, 검수 |

**장르 적합성:** 현 단계에서는 인터뷰 2 / 소프트웨어·화면 시연 2 / 액션·시각적 동작 2로 후보를 분류했지만, 영상의 실제 길이·발화량·OCR 유효 장면 수·시간순서 질문 존재 여부는 영상 자체를 검토하지 않았으므로 **미검증**이다. G1의 6×6/36문항 분포를 이 자료로 충족했다고 주장하지 않는다.

### 2.1 자료 정책의 중요한 차이

- **NASA:** [공식 미디어 이용 가이드](https://www.nasa.gov/nasa-brand-center/images-and-media/)는 NASA 자체 자료가 일반적으로 미국 저작권 대상이 아니라고 설명하지만, NASA 로고/표장, 개인의 초상·퍼블리시티, 제3자 저작물(예: 음악) 및 상업적 이용에 제약을 둔다. NASA 페이지에 MP4/SRT 제공이 표시되어도 YOUTOPIA의 **모델 전송·원문 보관·상업 서비스 사용권**이 자동 입증되지는 않는다.
- **Blender Sintel:** [프로젝트 측 라이선스](https://durian.blender.org/sharing/)는 CC BY 3.0 및 적절한 저작자 표기를 명시. 원본과 다른 재렌더/편집본이 존재하므로 YouTube 영상과 정확한 판본을 먼저 대조해야 한다.
- **Blender Tears of Steel:** [프로젝트 라이선스](https://mango.blender.org/about/)와 [원본/SRT 목록](https://mango.blender.org/download/)이 있다. [제작자 공식 글](https://mango.blender.org/production/4-tb-original-4k-footage-available-as-cc-by/)은 촬영 배우의 초상·사생활권이 별개이며 기술 데모용 사용과 배우를 상업 광고에 활용하는 것이 다르다고 경고한다.
- **YouTube 자체:** [API 개발자 정책](https://developers.google.com/youtube/terms/developer-policies)은 별도 승인 없는 시청각 다운로드·저장/캐시를 제한한다. 다른 배포처에서 적법하게 취득한 원본을 쓰는 권한과 YouTube에서 직접 추출하는 권한은 **다르게 검토**한다.
- **공식 캡션 API:** [captions.download](https://developers.google.com/youtube/data/reference/rest/v3/captions/download)에는 영상 수정 권한 요구사항이 있다. YouTube에서 일반 공개 영상 캡션을 무단 확보하는 절차를 만들지 않는다.

## 3. 각 후보별 증거 등급 정의

| 등급 | 의미 | 2026-11-05 |
|---|---|---|
| RESEARCH_CANDIDATE | 공식/권위 있는 웹페이지에서 후보와 자료 목록을 발견 | **6/6** |
| SOURCE_RIGHTS_CLEARED | 개별 콘텐츠와 작업 범위에 적용 가능한 법적 사용권·제3자 권리 및 보존·전송 검토를 독립 증빙 | **0/6** |
| MEDIA_EQUIVALENCE_VERIFIED | 허가된 원본과 YouTube 게재판의 정체성·판본·편집 길이 등을 검사하고 실증 | **0/6** |
| TIMED_CAPTIONS_VERIFIED | 해당 판본의 자막·음성 정합성, 타임코드 오차 기준, 발화와 OCR 분리 검수 | **0/6** |
| ANNOTATION_VERIFIED | 최소 2명 독립 라벨러의 정답·부재·타임코드 및 불일치 조정 완료 | **0/6** |
| G3_READY | 위 조건 + 계정 모델/요금·민감정보·폐기·통제 예산 및 **별도 사용자 실호출 승인** | **0/6** |

**공식 다운로드 링크가 존재함**은 곧 *다운로드 수행* 또는 *영상 일치성 검증*이 아니다. GitHub 저장소에는 미디어 파일·캡션 전문·개인자료·키·API 호출 내역을 올리지 않는다.

## 4. 원본–YouTube–자막 동일성에 필요한 실제 절차 (아직 미실행)

1. **원본 확인:** 실제 보유 및 사용 권한이 검증된 공식 원본 중 정확한 판본·해상도·오디오 트랙·fps·길이를 선택한다. 수집 경로/라이선스/동의/검수자/보존기간을 비공개 증거 원장에 기록한다.
2. **제작자 YouTube 링크 확인:** 제작자 소유 채널·공식 임베드·게시일·콘텐츠 변경 여부를 권한 내에서 확인한다. 제3자 재업로드 URL은 자동 동일성 승인하지 않는다.
3. **영상 판본 대조:** 원본 SHA-256을 확인하되 **YouTube 스트리밍 파일과 비트단위 같은 해시를 요구하면 재인코딩 때문에 오판**할 수 있다. 승인된 방법으로 길이·인트로/엔딩·키프레임 지각적 특성·샷 순서·음성 이벤트를 비교하고 독립 평가자가 기록한다. 확인 불가 시 `UNVERIFIED`.
4. **자막 정합성:** 원본 제작자가 공개한 자막이 *해당 원본 판본*에 맞는지 시작/끝, 무음, 컷 편집, 발화 시점, 자막 누락을 검사한다. 실영상 없이 URL만 보고 타임코드를 작성하지 않는다.
5. **평가 질문 생성:** 각 영상 발화·시각·OCR·시간순서에 대해 G1 분포 12/8/6/5/5를 만족할 수 있는지 먼저 확인한다. 답변 불가 질문은 **실제 원본 범위에서 부재**가 입증되도록 한다.
6. **독립 골드 검수:** 사람 2명의 원문/영상 시점 라벨, 충돌 조정, 골드판 버전 고정, 모델 입력과 정답지 분리. 개인정보·권한 있는 별도 보관소에서 관리한다.

재인코딩된 YouTube 파일을 권한 없이 추출·다운로드하라는 지침이 아니다. 공급자의 공식 YouTube URL 영상 입력(A경로)은 **적법성 확인 후 별도 승인**받을 수 있지만, A/B/C에 같은 영상이 제공되었다는 보증 없이 공정한 성능 비교를 주장하지 않는다.

## 5. 이번 코드 구현 — 네트워크 없는 후보 원장 검증

- `g2b-public-candidates.json`: **공개 페이지의 출처·메타데이터 링크**만 기록. 원본·자막 전문·실제 영상 해시·권리자 승인 자료·개인정보 없음.
- `g2b-research-audit.cjs`: 정확한 후보 6건/장르별 2건, 공식 출처 및 YouTube 매핑 근거 구분, 허위 승인·영상 해시·타임코드 정합성·라벨러 검수·실호출 활성화 입력 거부.
- `tests/g2b-candidate-research.test.cjs`: 누락/중복·출처 변경·공개 라이선스의 무단 승인 격상·불명 영상판/자막판·원본 해시 위조·모델 실호출 등의 부정 테스트.
- CI: 기존 G1·G2 테스트를 포함한 **Node 24 오프라인 단일 작업**, API 키·YouTube API·영상 다운로드 없음.

```powershell
cd C:\Projects\YOUTOPIA
$dir = 'shared/experiments/yu-video-understanding-poc-v0'
node --check "$dir/g2b-research-audit.cjs"
node --test "$dir/tests/*.test.cjs"
node "$dir/g2b-research-audit.cjs"
```

실행 결과는 `SIX_PUBLIC_RESEARCH_CANDIDATES_NOT_APPROVED_DATASET`, `sourceRightsVerified=0`, `youtubeToSourceVersionMatchesVerified=0`, `captionTimelineAlignmentsVerified=0`, `approvedRealDatasetCount=0`이어야 한다. 나중에 적법한 실영상이 확보되면 별도의 **비공개 근거 원장과 독립 승인 계약**으로 처리하며, 이 연구 원장의 하드코딩된 false 플래그만 true로 바꿔 G3를 해제하지 않는다.

## 6. 남은 차단점과 다음 단계

- ① NASA 네 후보의 개별 이용 목적·모델 전송·제3자 음악·인물 관련 권리 검토.
- ② Blender 두 후보의 정확한 CC BY 표기·YouTube 개별 업로드·리렌더·SRT 판본 검증.
- ③ 정확한 YouTube ID가 확인되지 않은 3개 후보의 공식 채널 동영상 매핑.
- ④ 공식 다운로드가 목록에 없거나 시간 맞춘 자막이 없는 경우, 제작자 제공 승인 자료 확보 또는 후보 교체.
- ⑤ 원본/YouTube/자막 판본 정합성·실제 러닝타임·장르 적합성 검수 및 두 명의 독립 정답 검수.
- ⑥ 실제 입력 준비 후 별도 사용자 승인 하에 모델 계정·과금·프라이버시·무재시도/예산 차단 점검.

### 원격 CI 실증 (2026-11-05)

- [GitHub Actions #41978129657](https://github.com/Choi1999/YOUTOPIA/actions/runs/41978129657), 검증 커밋 `4f80182ef5b3866179733f771c877700b8b408c4`: Node 24 G1·G2·G2-B **80개 테스트 PASS / 0 FAIL**, 구문 점검 및 G1/G2/G2-B 차단 검증 단계 성공.
- 코드/원장/공개 문서만 테스트했다. 실제 동영상 처리 정확도·권리 범위·다운로드 가능 여부·타임코드 정합성·상업 서비스 허가 증거는 여전히 0건.

**최종 판정: `G2B_CANDIDATE_RESEARCH_COMPLETE / G2B_DATASET_VALIDATION_BLOCKED / G3_NOT_APPROVED / LIVE_CALLS=0 / NO_MERGE`.**
