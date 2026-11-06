# YOUTOPIA G2-F — 블라인드 독립 검수·브랜치 종료 준비 계약 v0.1

> 기준일: 2026-11-06 KST
> 실험 브랜치: `experiment/yu-video-understanding-poc-v01`
> 판정: **BLIND_REVIEW_PROTOCOL_IMPLEMENTED / HUMAN_REVIEW_NOT_RUN / NO_AUTO_GOLD_APPROVAL / G3_BLOCKED / NO_MERGE**
> 경계: 이번 승인은 **G2-F 준비·정리**이며, 실제 PR 병합·원격 브랜치 삭제·G3 외부 API 호출 승인은 아니다.

## 1. 목적과 확정 범위

G0 영상 이해 평가 계약은 **총 6편 × 6문항 = 36문항**과 **두 명 이상의 독립 인간 검수**를 요구한다. 기존 Blender 실험에서 완성된 것은 Sintel 6문항과 Tears of Steel 6문항, **총 12개의 운영자·AI 보조 작성 정답 초안**이다. 사용자의 로컬 `G2-E Assess` 출력 기준 두 영화 모두 `OPERATOR_DRAFT_QUESTIONS_ALL_AUTHORED_NOT_VERIFIED`이며, 독립 검수자는 **0명**이다.

G2-F에서는 이 12문항에 대해 **정답을 보지 않은 검수자 A와 B가 각자 영화를 확인하고 독립적으로 답변/근거를 작성**하도록 지원한다. 두 검수자의 내용과 운영자 초안은 **양쪽 제출 완료 뒤에만** 비교한다. 단순 동일 문자열·같은 검수자 코드·사용자 체크박스는 독립 검증을 입증하지 않는다.

**이번 작업은 범위를 더 확장하지 않는다:** 실영상 프레임 추출/YouTube 다운로드/모델 API 분석/미디어 업로드/운영 DB·UI 변경/제품 병합/원격 브랜치 삭제 없음.

## 2. G2-F 데이터·신뢰 경계

| 정보 | 위치 | 블라인드 검수자에게 표시 |
|---|---|---|
| 최종 질문 문장, 질문 ID, 로컬 시점, 영화 버전 | 리뷰어별 비공개 패킷 | **예** |
| 기존 운영자 정답·관찰 기록·근거 증거·정답 가능 여부 | 기존 G2-E 비공개 JSON | **아니오** |
| 실제 공식 원본 영상 및 영어 SRT | 사용자 Windows AppData 밖 또는 공식 배포 위치 | 권리 범위가 허용할 경우 직접 열람 |
| 검수자 A/B 독립 답변·관찰 시각·사유 | 각자 별도 비공개 JSON | 서로 제출 완료 전에는 **아니오** |
| 블라인드·전체 영상 확인·작업자 정답 미열람 선언 | 각 리뷰어의 자기 신고 | 비교 시 출처로만 기록 |
| 공개 GitHub 문서 | 실험 브랜치 | 총수·표본 결과·개선 사항 등 **비민감 요약만** |

패킷은 기존 `G2-E` JSON의 바이트 SHA-256와 영화·문항 질문 세트·영상/자막 SHA-256에 연결된다. **원본 정답 원문은 패킷에 복사되지 않는다.** 해당 G2-E 파일이 패킷 생성 이후 변경되면 쌍 비교를 차단하고 변경 이유를 먼저 조사한다. 이미 작성한 리뷰 패킷은 자동 덮어쓰지 않는다.

영화 시각은 **로컬 Blender 배포본의 밀리초**를 사용한다. Tears의 `G2-D` YouTube 표본 오프셋 최대 5초 차이(`NOT_ESTABLISHED`)는 유지하며, 이를 YouTube 기준 골드 시각이라고 기록하지 않는다.

## 3. Windows 사용자 준비 — 최신 코드 확인

**G2-D/G2-E 웹 서버가 실행 중이라면 서버를 연 터미널에서 `Ctrl+C`로 종료하고** 다음 명령을 새로운 PowerShell 터미널에서 실행한다. 로컬 비공개 G2-E 파일은 Git 작업 트리에 있지 않으므로 전환해도 보존된다.

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'Git fetch 실패' }

cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw '로컬 Worktree에 변경 사항이 있습니다. 먼저 확인하세요.' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw '실험 브랜치 갱신 실패' }

$g2f = '.\shared\experiments\yu-video-understanding-poc-v0\g2f-windows-independent-review.ps1'
node --version
```

G2-F 도구는 **Node 24** 기반이고, `Plan/Check/Assess`는 FFmpeg·YouTube 임베드·인터넷·모델 API를 실행하지 않는다.

## 4. 실제 사람 두 명용 질문 전용 패킷 만들기

**운영자 PC에서 다음 명령을 실행한다.** 검수자 코드는 서로 다른 비식별 값이다. 아래의 기본 두 코드는 *두 명의 실제 검수자가 있다는 증거가 아니다*.

```powershell
& $g2f -Mode Plan -Film Sintel -ReviewerCode REVIEWER_A
& $g2f -Mode Plan -Film Sintel -ReviewerCode REVIEWER_B

& $g2f -Mode Plan -Film TearsOfSteel -ReviewerCode REVIEWER_A
& $g2f -Mode Plan -Film TearsOfSteel -ReviewerCode REVIEWER_B
```

출력된 패킷은 각각:

- `%LOCALAPPDATA%\YOUTOPIA\G2F-IndependentReviews\Sintel-REVIEWER_A-blind-review.json`
- `%LOCALAPPDATA%\YOUTOPIA\G2F-IndependentReviews\Sintel-REVIEWER_B-blind-review.json`
- `%LOCALAPPDATA%\YOUTOPIA\G2F-IndependentReviews\TearsOfSteel-REVIEWER_A-blind-review.json`
- `%LOCALAPPDATA%\YOUTOPIA\G2F-IndependentReviews\TearsOfSteel-REVIEWER_B-blind-review.json`

각 파일은 **질문 6개와 미작성 답변 칸만** 가진다. 이미 파일이 존재하면 도구가 거절하므로 원본을 백업 없이 덮어쓰지 않는다. 검수자에게 각자의 파일만 전달하고, **기존 G2-E 정답 파일·화면·ChatGPT 답변·다른 검수자의 답변은 보이지 않게 한다.** 기존 G2-D 웹 화면에는 작성자 정답이 노출되는 G2-E 패널이 있으므로, 블라인드 검수자가 그 화면을 그대로 사용하면 안 된다. 원본 영화는 허가된 경로에서 별도 플레이어로 확인한다.

## 5. 검수자 각자의 JSON 작성 방법

패킷의 `questions[].response`만 편집한다. 다른 식별/해시/질문 시각/리뷰어 코드/승인 필드는 손대지 않는다.

**작업 전 체크는 거짓으로 채우지 않는다.** 실제 독립적으로 영상을 봤다면 아래 신고 필드를 설정한다.

```json
{
  "blindReviewDeclaration": true,
  "sawOperatorAnswersBeforeSubmission": false,
  "watchedLocalPublisherFilm": true
}
```

이 세 필드는 파일 루트에 있으며, 검수자 독립성의 **자기 진술**일 뿐 외부 검증된 ID는 아니다.

각 문항의 실제 `response` 구조는 다음과 같다. 아래 문장은 **형식 예시일 뿐 영화 속 사실을 뜻하지 않는다.**

```json
{
  "verdict": "SUPPORTED",
  "answerText": "직접 관찰한 화면 또는 음성에서 확인한 사실을 작성",
  "evidence": [
    {
      "modality": "FRAME",
      "localStartMs": 73000,
      "localEndMs": 76000,
      "observationNote": "실제 원본 01:13 전후에서 무엇이 보이는지를 직접 관찰한 기록"
    }
  ],
  "absenceRationale": null,
  "fullMovieReviewed": false,
  "observationNote": null
}
```

주의: `73000~76000`은 **입력 형식 예시**이며 실제 근거 시간으로 복사해서 쓰면 안 된다. 실제 사용자가 관찰한 로컬 시각을 밀리초 정수로 기입한다.

판정값은 `SUPPORTED`, `UNSUPPORTED`, `AMBIGUOUS`, `NOT_REVIEWED` 중 하나다.

- **SUPPORTED:** 실제 관찰 답변·모달리티(AUDIO/TRANSCRIPT/FRAME/OCR)와 확인 구간·관찰 기록 필수. 두 사건 비교라면 **서로 다른 두 시간 근거** 필요.
- **UNSUPPORTED:** 원본 **전체**에서 해당 질문의 근거가 없다고 직접 확인한 경우에만 선택. `evidence=[]`, `absenceRationale` 20자 이상, `fullMovieReviewed=true` 필수. 기존 문항 분류가 UNSUPPORTED여도 독립 검수자는 스스로 SUPPORTED라고 결론 내릴 수 있다.
- **AMBIGUOUS:** 근거가 부족하거나 질문 문장에 오류가 있다고 판단했을 때. `answerText=null`, `evidence=[]`, `observationNote`에 불확실성 이유 20자 이상을 기록한다.
- **NOT_REVIEWED:** 미검토인 경우 그대로 유지. 자동으로 SUPPORTED로 채워 넣지 않는다.

출처와 편집판이 다른 영상의 시간값을 복사하지 말고 로컬 원본 기준으로 작성한다. 긴 자막·대사 전문은 저장하지 않고, 사실 요약과 근거 구간만 기록한다.

## 6. 독립 검수 결과를 확인하는 명령

리뷰어 A/B는 **서로의 답변을 열지 않은 상태**로 개별 파일의 구조를 확인한다.

```powershell
& $g2f -Mode Check -Film Sintel -ReviewerCode REVIEWER_A
& $g2f -Mode Check -Film Sintel -ReviewerCode REVIEWER_B
& $g2f -Mode Check -Film TearsOfSteel -ReviewerCode REVIEWER_A
& $g2f -Mode Check -Film TearsOfSteel -ReviewerCode REVIEWER_B
```

두 검수자가 모두 제출한 후, **운영자만** 작성자 G2-E 초안과 결합해 비교한다.

```powershell
& $g2f -Mode Assess -Film Sintel
& $g2f -Mode Assess -Film TearsOfSteel
```

요약 JSON은 실제 정답 원문을 출력하지 않는다. 해석 기준:

| 결과 상태 | 의미 |
|---|---|
| `INDEPENDENT_REVIEW_IN_PROGRESS` | 해당 검수자의 질문 일부 미작성 |
| `SELF_REPORTED_BLIND_REVIEW_SUBMITTED_NOT_VERIFIED` | 검수자의 자기 신고와 구조적 내용 작성 완료 |
| `REVIEWER_SOURCE_EXPOSURE_REQUIRES_REWORK` | 이전 작업자의 답변을 봤다고 신고했거나 독립 검수 선언 부정 |
| `TWO_BLIND_REVIEWER_REPORTS_SUBMITTED_PENDING_HUMAN_ADJUDICATION` | 서로 다른 리뷰어 코드 2개가 제출됨. **여전히 독립·정답·인적 승인 확인 전** |
| `BLIND_REVIEW_IN_PROGRESS_OR_SOURCE_EXPOSURE` | 두 사람 완료 전 또는 블라인드 조건 미충족 |

검증기의 자동 플래그에는 **검수자 간 SUPPORTED/UNSUPPORTED/AMBIGUOUS 불일치**, 작성자와 검수자 판정 불일치, 근거 시간 차이, 답변·증거 JSON이 완전히 같아 복제 의심인 경우가 포함된다. 그러나 문장 표현의 의미적 일치, 실제 행동 여부, 인간의 독립성과 권리 적합성은 코드만으로 판정할 수 없다.

**G2-F의 최종 사람 검토:** 두 검수의 결과가 완성되면 우선 `flags`가 있는 문항, 그다음 모든 문항의 질문 유도성·실제 영상 장면·근거 품질을 대조한다. 12개 문항에 대한 `ACCEPT_CANDIDATE / REWRITE / EXCLUDE / UNRESOLVED` 분류와 사유를 오프라인 검수 기록에 남긴다. **정답 승인은 자동 승격되지 않으며, 승인 책임자·권리·보존/전송 정책은 별도 Gate에서 결정한다.**

## 7. G2-F → 실험 브랜치 병합·삭제 Gate

이 실험 브랜치는 **G2-F가 완료된 뒤 종료 여부를 결정**하는 것을 원칙으로 한다. 이때 *오프라인 연구 도구 병합*과 *운영 영상 분석 기능의 승인*을 분리한다.

1. **실험 마감 기록:** Sintel/Tears 12문항의 G2-F 블라인드 평가 결과, 조정/제외 사유, 정답 미승인 사유를 요약한다. 실제 2명 리뷰어가 없다면 `G2F_HUMAN_REVIEW_PENDING`으로 기록한다. 같은 작성자가 A/B 코드로 작업해 독립 2명으로 위장하지 않는다.
2. **실험 브랜치 CI·Windows QA:** Node 오프라인, Windows PowerShell 파서 PASS, 민감 자료/이용권 미확인 원본 파일 추적 0개를 확인한다.
3. **병합 범위 확정:** 공개 문서·오프라인 도구·테스트만 대상 PR에 포함한다. 제품 런타임/YouTube 자동 다운로드/G3 API 호출·권한 상승은 별도 신규 브랜치로 분리한다. 대상 브랜치는 그 시점의 YOUTOPIA 브랜치 정책과 충돌 가능성을 확인한 뒤 정한다.
4. **명시적 PR 병합 승인:** PR 리뷰, CI, 본 사용자 최종 승인이 있을 때만 병합한다. 본 G2-F 착수 승인은 미래 PR 병합 승인으로 재사용하지 않는다.
5. **삭제:** PR `MERGED`, 대상 브랜치의 커밋 반영, 공개 연구 산출물 보존, 사용자 로컬 비공개 G2-D/G2-E/G2-F 자료 보존 위치를 확인한 뒤 별도 승인받아 원격 브랜치와 고립 Worktree를 정리한다. **사용자 로컬 AppData를 자동 삭제하지 않는다.**
6. **G3:** 새로운 브랜치·새 승인 계약에서 별도로 논의한다. 실험 브랜치의 오프라인 CI 통과나 블라인드 리뷰 자기신고는 유료 사용·서비스 권리의 승인이 아니다.

## 8. 현재 구현 및 자동 검증의 한계

- 신규 공개 코드: `shared/experiments/yu-video-understanding-poc-v0/g2f-blind-review.cjs` 및 `g2f-windows-independent-review.ps1`.
- 신규 합성 테스트: `tests/g2f-blind-review.test.cjs` — 사전 답변 누출 방지, 리뷰 파일 변조 및 G2-E 원본 변경 탐지, 검수자 중복/작성자 겸임 차단, 미검토/불확실 처리, 전체 영화 근거 부재 규칙, G3/비용/골드 승인 플래그 위조 차단.
- 모든 자동 테스트는 합성 패킷을 사용하며 진짜 영화나 실제 인간 2명의 독립성은 검증하지 않는다.
- 현재 생성된 사용자 **실제 G2-F 리뷰 0/12, 독립 승인 골드 0/12**, 병합 PR 없음, 브랜치 삭제 없음.
- **출력의 `verifiedIndependentHumanReviewers=0`, `independentGoldApproved=0`, `g3Authorized=false`는 사람 검토 및 별도 승인 전까지 계속 유지한다.**

**현재 판정: `G2F_OFFLINE_REVIEW_TOOLS_READY / ACTUAL_BLIND_REVIEW_NOT_STARTED / G3_NOT_APPROVED / NO_MERGE`.**


## 9. 운영자 승인: G2-F 독립 검수 우선 (2026-11-06 KST)

**결정:** 운영자는 G2-F 질문 패킷 4개 생성 완료 보고에 이어, **추가 기능 개발을 중단하고 실제 독립 검수 결과 확보에 집중하는 방향**을 승인하였다. 이는 G2-F 실험 운영 우선순위에 대한 승인으로 기록하며, PR 생성·병합·원격 브랜치 삭제·G3 유료 호출·골드 정답 승인으로 확대 해석하지 않는다.

### 사용자 제출 근거

- Git Worktree: `C:\Projects\YOUTOPIA-VIDEO-G2C`, 기준 `db8e771b3a547caa9ac218b749600435446a5b88` (사용자가 제출한 checkout 로그).
- 실제 Windows 실행 결과(운영자 제출): `Sintel` × `REVIEWER_A/B`, `TearsOfSteel` × `REVIEWER_A/B`의 **블라인드 질문 패킷 4/4 생성**, 각각 질문 6개, `containsOperatorAnswers=false`, `storedOutsideGit=true`.
- 패킷 생성은 **실제 독립 검수자 존재나 본문 검토 시작의 증거가 아니다**. 두 사람의 신원·접근권·검토 독립성 미확인. `ACTUAL_BLIND_REVIEWS_SUBMITTED=0`, `INDEPENDENT_GOLD_APPROVED=0` 유지.
- 원본 질문·답변·영상 및 SRT 전문은 로컬 비공개 저장. 공개 GitHub에는 민감 원문을 업로드하지 않는다.

### 진행 제한과 다음 작업

1. **기능 동결:** 현재 실험 브랜치에는 추가 기능 개발을 진행하지 않는다. 실제 G2-F 수행 중 확인된 결함에 대해서만 별도 합의 후 최소 수정한다.
2. **사람 검수:** 작성자 답안을 보지 않은 실제 검수자 두 명을 확보한다. 각자 자신의 질문 전용 JSON과 이용이 허가된 공식 원본을 독립 검토한다. 검수자에게 작성자의 G2-E 답안 패널·ChatGPT 모범답안·다른 검수자 파일을 보여주지 않는다.
3. **검수 결과:** 각 검수자가 먼저 `-Mode Check`로 본인 파일의 구조를 확인하고, 두 검수자가 끝난 뒤 운영자가 영화별 `-Mode Assess`로 차이·불확실성·근거 시각 불일치를 집계한다. 출력이 통과해도 실제 골드 정답 자동 승격은 금지.
4. **검수자 미확보 시:** 두 검수자의 결과를 임의 생성하거나 운영자 1인의 이중 검토를 독립 검수라고 표시하지 않는다. `INDEPENDENT_REVIEW_PENDING`으로 유지하고, **오프라인 도구만 병합할지** 별도의 사용자 결정을 받는다.
5. **종료 Gate:** G2-F 판정과 미해결 사항을 기록하고 코드·출처 범위를 확인한 뒤 오프라인 연구 도구의 PR·대상 브랜치를 정한다. PR 병합과 실험 브랜치 삭제에는 각각 최종 명시 승인이 필요하다. G3는 별도 신규 브랜치에서 따로 승인한다.

**승인된 진행 상태:** `G2F_REVIEW_PRIORITY_APPROVED / BLIND_PACKETS_4_OF_4_CREATED / INDEPENDENT_REVIEW_PENDING / FEATURE_FREEZE / G3_NOT_APPROVED / NO_MERGE / NO_DELETE`.
