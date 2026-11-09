# YOUTOPIA — 영상 이해 PoC G2-H 6편·36문항 데이터셋 확장 설계 v0.1

> 기준일: 2026-11-09 KST · 소유: YOUTOPIA 실험 연구/데이터셋 운영
> 상태: **DESIGN_ONLY / 4_RESEARCH_CANDIDATES / 24_QUESTION_TEMPLATES / RIGHTS_UNVERIFIED / GOLD_NOT_APPROVED / G3_NO_GO / NO_MERGE**
> 상위 계약: [G0 평가 계약](./YU_VIDEO_UNDERSTANDING_POC_EVALUATION_V01.md). 기존 G0의 6편/36문항 목표는 변경하지 않는다.
> 데이터 원장: `shared/experiments/yu-video-understanding-poc-v0/g2h-expansion-blueprint.json`
> 오프라인 검사: `node shared/experiments/yu-video-understanding-poc-v0/g2h-expansion-plan.cjs`

## 1. 사용자 승인과 목적

2026-11-09 사용자 승인: **기존 파일럿 2편·12문항에 더해 인터뷰 2편, 화면 시연 2편에 대한 데이터셋 확장 설계**를 진행한다. 현재 승인에는 실제 영상 수집, 자막 다운로드, YouTube API 접근, 유료 모델 호출, G3 진입, PR 병합·브랜치 삭제를 포함하지 않는다.

이 설계는 [G2 파일럿 종료 보고](./YU_VIDEO_G2_PILOT_CLOSEOUT_G3_READINESS_20261109.md)를 입력으로 삼는다. 현재 Sintel 및 Tears of Steel 각 6문항의 운영자 판정은 **APPROVE 5/HOLD 1**, 총 APPROVE 10/HOLD 2다. 비블라인드 AI 보조 검수 결과일 뿐 독립 Gold 승인은 0이다. HOLD 두 문항은 정답이 확정된 것으로 계산하지 않는다.

## 2. 평가 목표 대비 질문 유형 배분

| 영상 슬롯 | 분야 | SPEECH | VISUAL | OCR | TEMPORAL | UNSUPPORTED | 합계 |
|---|---|---:|---:|---:|---:|---:|---:|
| SYNTH-VID-01 | 인터뷰 | 3 | 1 | 0 | 1 | 1 | 6 |
| SYNTH-VID-02 | 인터뷰 | 3 | 1 | 0 | 1 | 1 | 6 |
| SYNTH-VID-03 | 화면 시연 | 1 | 1 | 3 | 1 | 0 | 6 |
| SYNTH-VID-04 | 화면 시연 | 1 | 1 | 3 | 0 | 1 | 6 |
| **새 4편 합계** | | **8** | **4** | **6** | **3** | **3** | **24** |
| 기존 액션 영화 2편 설계량 | | 4 | 4 | 0 | 2 | 2 | 12 |
| **G0 전체 설계 목표** | **6편** | **12** | **8** | **6** | **5** | **5** | **36** |

위 24개는 질문의 **작성 방향만 정한 템플릿**이다. 실제 미디어를 관찰하여 특정 대사·행동·화면 문자열을 확인하기 전에는 최종 질문, 정답, 참인 근거 시간으로 간주하지 않는다. 지정 후보에 해당 종류의 근거가 없거나 OCR 가독성이 부족하면 억지로 채우지 말고 동종 후보를 교체하거나 배분안 개정을 별도 승인받는다. G0의 전체 분포는 유지한다.

## 3. 추가 후보 영상 4개와 선결 위험

4개 후보는 G2-B 공개 연구 원장에 있었던 NASA 공개 공식 페이지를 **연구 후보로 재사용**한 것이다. 실제 파일 적법성, 서비스·모델 전송·유료 이용범위, 동일 판본, 캡션 시간 동기화 등은 검증되지 않았다.

| 슬롯 | 기존 연구 후보 | 확인 가능한 공식 공개 자산 | 주요 차단 요소 |
|---|---|---|---|
| 01 인터뷰 | [Transients from Space 인터뷰](https://science.nasa.gov/asset/webb/transients-from-space-science-workshop-interviews/) | 공식 페이지에 MP4, SRT/VTT, TXT 대본 목록 | 독립 이용 범위·인물/파트너 크레딧, 공식 YouTube ID 미확정 |
| 02 인터뷰 | [Interview with Tommaso Treu](https://science.nasa.gov/asset/webb/webb-draws-back-the-curtains-on-an-undiscovered-universe-interview-with-tommaso-treu/) | MP4, SRT/VTT, TXT 대본 목록 | **Soundstripe 제3자 음악**·인물 권리·공식 YouTube ID 미확정 |
| 03 화면 시연 | [NASA Eyes on the Earth 튜토리얼](https://science.nasa.gov/resource/tutorial-nasas-eyes-on-the-earth/) | 공식 MP4·공식 페이지의 YouTube 임베드 (기존 G2-B 연구: p-6DusnZ1pQ) | 시간 자막 목록 미확인·두 영상판/오디오 정합성·OCR 가독성 |
| 04 화면 시연 | [Eyes on Exoplanets 튜토리얼](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/) | 웹에 텍스트 대본 존재 | 공식 다운로드 MP4·시간 자막·YouTube ID 미확인, 버전 정합성 |

### 3.1 2026-11-09 공식 공개 페이지 확인 범위

- NASA의 Transients from Space 페이지는 **MP4·SRT/VTT·TXT 공개 다운로드 목록**을 제시한다. 목록의 존재와 YOUTOPIA 목적의 권리 범위·로컬 파일 검수는 별개다.
- NASA Tommaso Treu 인터뷰 페이지는 **Soundstripe Productions 음악 크레딧**과 MP4/SRT/VTT/TXT를 명시한다. 별도 음악·화자·배포권 확인 없이 제3자 모델에 영상 원문을 보내지 않는다.
- NASA Eyes on the Earth 페이지는 1080p MP4 목록 및 공식 YouTube 임베드를 게시하지만, **동일 편집판·정확한 자막 타임라인이 입증된 것은 아니다**.
- Eyes on Exoplanets 페이지에는 설명 대본이 보이지만, 공인된 다운로드 원본/타임드 캡션/YouTube 매핑을 이 단계에서 확정하지 않는다.
- NASA [Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)의 인물·제3자 저작물·보증 및 최근 모델 출력 출처표시 관련 부분은 실제 사용 직전에 다시 확인한다. NASA 공개 페이지에 자료가 있다고 모든 사용 방식이 자동 승인된 것이 아니다. 특히 생성된 AI 답변을 NASA가 검토하거나 승인한 것으로 표시하면 안 된다.

### 3.2 후보 교체 규칙

- 01, 03은 **메타데이터/판본·자막 확인 작업의 첫 대상 후보**로 둘 수 있다. 순서 추천은 사용권 승인과 무관하다.
- 02는 Soundstripe 등 제3자 음악 권리를 증빙하지 못하면 **후보 교체 우선**. 무단 음악 제거·영상 재편집으로 우회하지 않는다. 권리자 허가를 받은 별도 음원 없는 판본이 있다면 그 판본의 적법한 접근과 동일성부터 다시 평가한다.
- 04는 공식 다운로드 원본과 정렬된 캡션이 확보되지 않으면 다른 권리 명확한 화면 시연 영상 후보로 교체한다.
- 어느 슬롯도 연구 후보가 검증 실패하면 원래 장르와 질문유형 배분을 충족하는 **대체 후보**를 검색·등록하고, 구형 후보의 실패 이유를 기록한다.

## 4. 24개 질문 작성 규격

코드 원장은 `G2H-01-01`부터 `G2H-04-06`까지 **고유 ID 24개**, 질문 유형, 문항 작성 방향, 필요한 증거 모달리티와 최소 구간 수를 담고 있다. 정답/시간/미디어 데이터는 모두 null 또는 빈 배열이다.

| 유형 | 문항 초안 작성 원칙 | 최소 근거 | 금지 사례 |
|---|---|---|---|
| SPEECH | 영상 원본 음성에서 실제 발화를 듣고 문맥을 제한한 한 질문을 작성 | AUDIO/TRANSCRIPT, 구간 1개 이상 | 자막에 없는 발화 추정 |
| VISUAL | 영상에 실제 보이는 행동·객체·UI 변화의 구체적 시각 증거 | FRAME, 구간 1개 이상 | 언급된 행동을 실제로 보지 않고 단정 |
| OCR | 실제 영상 프레임의 선명한 라벨·버튼·숫자·메뉴 문자열을 원문 그대로 질문 | FRAME + OCR, 구간 1개 이상 | 프레임에 없는 라벨, 타 웹페이지 글자를 영상 근거로 사용 |
| TEMPORAL | 서로 구별되는 두 사건의 순서가 실제 영상에서 추적 가능한 질문 | 두 개 이상의 사건별 구간 | 독립된 증거 없이 시간 순서 추정 |
| UNSUPPORTED | 답이 없다는 주장을 원본 전체 확인 범위와 함께 검토한 뒤 질문 확정 | 부재 사유 + 현 계약상 전체 영화 범위 확인 | 미시청 구간에서 정보 부재를 단정하거나 무조건 부재를 유도 |

특히 기존 SIN-06/TOS-06처럼 **화면 밖 사건의 발생 시각**을 부정하려면 영상 전체에 실제로 그 정보가 없음을 검토할 수 있어야 한다. 소스에 반증 가능성이 없거나 판단 범위가 과도하면 REVISE/HOLD로 기록한다. 범위를 특정 장면으로 좁힌 새 부재 유형을 도입하려면 평가 계약과 검증 규칙을 먼저 개정해야 한다.

**OCR 권장 운영:** 각 화면 시연 영상에 OCR 3개씩 배정하되, 화면 변동·블러·수치 갱신을 고려해 원본 화면의 고정 기준시각/대표 프레임과 텍스트 판독 검수자의 일치 여부를 기록한다. 영상에 정확히 같은 텍스트가 없으면 질문을 포기하거나 후보를 바꾼다.

## 5. 역할과 순서 — 게이트별 증빙 계약

| 단계 | 책임 역할 | 수행 작업 및 산출물 | 통과 조건 |
|---|---|---|---|
| H0 설계 고정 | 연구 책임자 / 데이터셋 리드 | 4편·24문항 배분 및 질문 블루프린트 | CI 24/24 개수·유형 검증. 데이터셋 승인 아님 |
| H1 후보 적격성 | 소스 리서처 + 권리 담당 | 공식 페이지·원본/자막 경로·권리/제3자 위험 개별 점검 | 후보별 소스 식별과 범위별 권리 검토 결과 문서화 |
| H2 정본 미디어 | 권한 있는 미디어 담당 + 독립 QA | 합법적으로 확보한 정확한 판본, FFprobe 길이, 원본/SRT SHA, 시점 대응·음성/SRT 정합성 | 권리 범위와 판본·자막 검사 통과. 실패 시 차단 |
| H3 질문 작성 | 질문 작성자(Author) | 실제 원본 관찰 후 6문항/편, 시각·증거·근거 없음 논리 작성 | 종류 분포·타임코드·반증 가능성 확인 |
| H4 독립 라벨링 | 블라인드 평가자 A/B | **서로 및 작성자의 정답/AI 초안에 노출되지 않은** 독립 답변과 증거 | 2인 독립 입력, 시간/모달리티 검증 |
| H5 판정 조정 | 독립 판정자(Adjudicator) | 원본 근거 재검토, 불일치 조정, HOLD/REVISE 사유 | 미해결·편향 항목 별도 기록, 버전/해시 동결 |
| H6 전체 데이터셋 검수 | QA/보안/권리 책임자 | 6편·36문항과 실제 라벨·출처·권리·저장/삭제 검증 | 모든 평가 입력의 G0/G2 조건 통과 시에만 G2 적격성 검토 |
| H7 G3 심의 | 실험 책임자 + 사용자 | 동일 A/B/C 입력·모델·쿼터·예산·재시도·기록/폐기 검토 | **별도 명시 사용자 승인 전에는 실호출 금지** |

질문 작성자가 AI 초안으로 문항 구성을 보조받는 것은 허용하되, **독립 Gold 평가자에게 그 초안·답변·기존 A/B 판정을 보여주지 않는다**. 동일 인물 또는 같은 PC를 쓰는 경우 접근권과 브라우저 세션을 분리하고, 실제 독립성을 무조건 주장하지 않는다.

## 6. 비공개 증빙 필드 제안

Git 밖 별도 보호 저장소에서 작품별로 다음 증거를 기록한다. **이 필드들은 지금까지 수집·승인됐다는 뜻이 아니다.**

- sourceId, candidateSlot, owner/rightsHolder, rightsReference, scope(analysis/retention/derivatives/modelTransmission/commercial), thirdPartyMusic/face/trademark, decisionAt/reviewerCode, expiry/revocation
- publisherEdition, originalAcquisitionMethod, videoSha256, captionSha256, videoDurationMs, fps, audioTrack, subtitleLanguage, captionLastEndMs, captionOffsetRange
- youtubeOfficialMappingEvidence, editDifferenceLog, sourceLocalToYoutubeTimeMap, comparisonMethod, uncertaintyMs, sourceRightsEpoch
- questionId, authorBlindScope, answerability, supportedAnswers, evidenceStartMs/endMs, modality, sourceAssetHash, quoteOrObservedAction, counterEvidenceOrAbsenceReason
- blindedLabelerAResultHash, blindedLabelerBResultHash, conflicts, independentAdjudicatorDecision, versionLockedAt, splitLabelingStatus
- noProviderCallsUntilApproved, costGuardConfig, apiKeyLocationPrivate, deletionOwner, retentionExpiry, explicitG3ApprovalId

**비공개 영상·자막·검수 답안과 해시 전문은 공개 Git 원장에 넣지 않는다.** 승인 완료 판정은 실제 증거를 검토한 책임자가 별도의 승인 원장에 기록해야 하며, 단순한 JSON Boolean true 변경만으로 원 게이트를 해제하지 않는다.

## 7. 현재 완료 및 다음 의존성

- 완료: 4편의 기존 NASA 후보를 연구 대상으로 연결, 24개 질문 유형/작성 블루프린트 생성, 6편 36문항 분포 검증, 별도 G2-H 오프라인 차단 검증기 구성.
- 미완료: 4편의 영상 길이·적격 판본·접근/전송 권리, 자막/시각/OCR 실증, 24개 실제 질문·정답, 2인 독립 Gold 라벨링, 36문항 완결, G3 별도 승인.
- **다음 독립 작업:** VID-01과 VID-03의 공식 원본·캡션·판본 식별 및 서비스 이용권 조사부터 별도 근거 목록을 작성한다. 본 설계 승인만으로 실제 영상 파일을 다운로드·가공·전송해서는 안 된다.

**최종 판정: G2H_BLUEPRINT_COMPLETE_DESIGN_ONLY / FOUR_CANDIDATES_RESEARCH_ONLY / 24_QUESTION_TEMPLATES_NOT_REAL_LABELS / G2_SOURCE_RIGHTS_NOT_VERIFIED / INDEPENDENT_GOLD_0 / G3_NO_GO / NO_MERGE.**
