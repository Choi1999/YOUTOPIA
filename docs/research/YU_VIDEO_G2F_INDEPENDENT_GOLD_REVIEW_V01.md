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


## 10. 검수자별 전용 G2-F 웹 작업공간 (2026-11-06)

### 10.1 개발 경위·범위

사용자는 실제 독립 검수자 두 명을 확보한 후 **각자 검수 업무를 수행할 웹이 필요하다**고 요청했다. 이에 따라 G2-F 기능 동결의 예외를 **작성자 정답에 노출되지 않는 검수자 전용 로컬 웹**으로 한정한다. G2-D/G2-E의 기존 화면은 G2-E 정답 및 다른 데이터가 노출되므로, 이를 재사용하거나 검수자 접근권으로 공개하지 않는다.

새로 구현한 파일:

- `g2f-reviewer-workspace-server.cjs`: 검수자 한 명의 블라인드 질문 패킷과 검증된 로컬 공식 영화/SRT만 사용한다. 해당 패킷 외 파일 탐색 API 없음. `127.0.0.1` 바인딩, Host/Origin 검증, CSP `frame-ancestors 'none'`, CORS 미개방, 비공개 JSON 원자적 저장/동시 수정 감지.
- `g2f-reviewer-workspace.html` / `g2f-reviewer-workspace.css` / `g2f-reviewer-workspace-client.js`: 질문 6개 선택, 영화와 SRT의 해당 구간 재생, 50ms 파형, 시작/종료 시각 캡처, 답변·불확실성·부재 근거 작성, 질문별 저장, 자기 신고 독립성 기록.
- `g2f-open-reviewer-workspace.ps1`: 검수자 PC의 **한 명·한 영화** 스코프로 서버 시작.
- `g2f-export-reviewer-web.ps1`: 운영자 PC에서 한 명의 질문 패킷과 최소한의 웹 코드만 ZIP으로 제공한다. 원본 영상·SRT·G2-E 정답·다른 사람의 검수 JSON은 묶지 않는다.

**중요한 제공 형태:** 이번 웹은 *공유 도메인에 호스팅된 로그인 서비스가 아니다*. 검수자 본인 Windows PC에서 웹을 실행한 후 그 PC의 브라우저에서 `http://127.0.0.1:<출력포트>/`로 접속한다. 서로 다른 PC의 `127.0.0.1`은 서로 다른 서버이므로, 운영자 PC 주소를 다른 검수자에게 공유하는 방식은 동작하지 않는다. 인터넷 공개 사이트·원격 사용자 로그인은 별도 HTTPS/인증/권리/저장·삭제 검토 및 사용자 승인이 필요한 신규 범위다.

### 10.2 운영자: 개인별 전용 웹 패키지 생성

기존 질문 패킷 4개가 생성된 원본 Windows PC의 PowerShell에서 다음을 실행한다. 먼저 실험 브랜치를 fetch하여 최신 커밋을 checkout하되 Git Worktree의 변경 사항이 없는지 확인한다.

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'Git fetch 실패' }
cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw 'Worktree에 변경 사항이 있습니다.' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw '업데이트 실패' }

$export = '.\shared\experiments\yu-video-understanding-poc-v0\g2f-export-reviewer-web.ps1'
& $export -Film Sintel -ReviewerCode REVIEWER_A
& $export -Film TearsOfSteel -ReviewerCode REVIEWER_A
& $export -Film Sintel -ReviewerCode REVIEWER_B
& $export -Film TearsOfSteel -ReviewerCode REVIEWER_B
```

각 ZIP의 출력 위치는 `%LOCALAPPDATA%\YOUTOPIA\G2F-ReviewerExports`. ZIP은 개인별로 **오직 해당 영화의 질문 패킷 하나**만 포함한다.

- 검수자 A에게: `Sintel-REVIEWER_A-G2F-Reviewer-Web.zip`, `TearsOfSteel-REVIEWER_A-G2F-Reviewer-Web.zip`.
- 검수자 B에게: `Sintel-REVIEWER_B-G2F-Reviewer-Web.zip`, `TearsOfSteel-REVIEWER_B-G2F-Reviewer-Web.zip`.

*이미 같은 ZIP이 있으면 자동으로 덮어쓰지 않는다.* 이전 패키지와 충돌한 경우 먼저 원본 보존/회수 여부를 확인한다.

검수자 각자가 접근할 수 있는 **허가된 공식 원본 영상 + 원본 영어 SRT 파일**은 별도로 제공한다. 영화의 저작물·영상과 자막을 제3자에게 전달할 수 있는 권리가 확인되지 않았다면 이를 임의 배포하지 말고, 허가된 공식 배포 경로에서 검수자가 직접 취득하도록 안내한다. 편집판/원본 파일이 달라지면 **SHA-256 검증 실패로 서버가 시작되지 않으며**, 우회하거나 다른 영상으로 바꿔 실행하지 않는다.

### 10.3 검수자: 전용 웹에서 자기 영화 6문항 작성

검수자 개인 PC에서 해당 ZIP을 해제한 폴더(예: `C:\YOUTOPIA-G2F-A\Sintel-REVIEWER_A-G2F-Reviewer-Web`)로 이동한다. 웹 실행에 Node 24 및 FFmpeg가 필요하며 브라우저는 Chrome/Edge 권장.

ZIP 내 `media` 폴더에 **동일 SHA-256 원본 영상과 SRT**를 별도로 배치한다. 기존 `README.txt`에 실행할 명령이 담겨 있다. 예:

```powershell
# 현재 위치: ZIP을 해제한 실제 'Sintel-REVIEWER_A-G2F-Reviewer-Web' 폴더
$launcher = '.\app\shared\experiments\yu-video-understanding-poc-v0\g2f-open-reviewer-workspace.ps1'
& $launcher -Film Sintel -ReviewerCode REVIEWER_A -PacketPath '.\private\Sintel-REVIEWER_A-blind-review.json' -VideoPath '.\media\Sintel.2010.720p.mkv' -SubtitlePath '.\media\sintel_en.srt'
```

`G2F_REVIEWER_WORKSPACE_READY http://127.0.0.1:<port>/`이 나오면 **해당 검수자 PC에서** 그 주소를 연다. `Ctrl+C`는 해당 웹 서버 종료이며, 그 전에 저장한 JSON은 유지된다.

**웹 작업 순서:** 질문 선택 → 로컬 영상/자막 확인 → `SUPPORTED` / `UNSUPPORTED` / `AMBIGUOUS` 판정 → 답변 및 필요 근거 구간 작성 → **현재 질문 저장** → 다음 질문으로 이동. 실제 원본에서 근거를 확인하지 못했다면 임의로 정답을 작성하지 않고 `AMBIGUOUS`로 남긴다. `UNSUPPORTED`는 원본 영화 전체 검토 후에만 확정한다.

6문항을 검수한 뒤 세 가지 독립성 신고를 사실대로 입력하고 **독립 검수 선언 저장**을 누른다. 검수자는 원본 `private` 폴더에 있는 자기 JSON만 안전하게 운영자에게 회송한다. 다른 사람의 파일이나 기존 G2-E 정답 패널은 열람하지 않는다.

Tears의 파일도 별도 ZIP과 로컬 영화/SRT로 같은 방법으로 검수한다. **Tears YouTube-로컬 오프셋 불일치는 여전히 미검증**이므로 근거 시간은 오직 검증된 로컬 원본 기준으로 작성한다.

### 10.4 운영자 결과 회수 및 비교

운영자는 네 검수자 패킷을 회수해 자신의 `%LOCALAPPDATA%\YOUTOPIA\G2F-IndependentReviews`에 원래 파일명대로 보존한다. **기존 빈 패킷이 있다면 백업 후 원본과 같은 sourceTemplateDigest·영화·reviewerCode·sourceDraftSha256가 일치하는지 먼저 확인**하고 교체한다. 동명이인 검수 또는 수정 전후 파일을 섞지 않는다.

기존의 아래 도구로 영화별로 Check/Assess를 실행한다.

```powershell
$g2f = '.\shared\experiments\yu-video-understanding-poc-v0\g2f-windows-independent-review.ps1'
& $g2f -Mode Check -Film Sintel -ReviewerCode REVIEWER_A
& $g2f -Mode Check -Film Sintel -ReviewerCode REVIEWER_B
& $g2f -Mode Check -Film TearsOfSteel -ReviewerCode REVIEWER_A
& $g2f -Mode Check -Film TearsOfSteel -ReviewerCode REVIEWER_B

& $g2f -Mode Assess -Film Sintel
& $g2f -Mode Assess -Film TearsOfSteel
```

**문항 제출·구조 검증·검수자의 블라인드 자기신고는 독립성이 증명되거나 정답이 검증됐다는 뜻이 아니다.** 실제 인적 검토 및 정답 불일치 조정, 검수 결과 기록, 병합·브랜치 삭제 승인은 여전히 별도다.

### 10.5 실제 QA 및 보안 범위

- Node 24 오프라인 서버 격리/파일 접근/Origin 검사/정답 파일 누출/비공개 패킷 원자 저장/소스 SHA 위조 차단 테스트를 실행했다.
- Windows PowerShell 구문 및 브라우저 클라이언트 JS 구문 검사를 수행했다.
- **실제 검수자 A·B의 Windows 브라우저 수동 QA와 독립 검수 결과는 아직 0**. 공유 ZIP의 실제 운영자 생성/타 PC 이동/실제 영화와 SRT 준비가 필요하다.
- 공개 Git에는 영화·SRT·골드 정답·실제 독립 검수 답변이 없다. 이번 기능은 G2-F 독립 검수 **작성 편의 개선**에 한정하며 G3 API/제품 런타임/중앙 인증 서비스를 열지 않는다.

**상태: `G2F_REVIEWER_ONLY_LOCAL_WEB_CODE_READY / REAL_REVIEWER_PC_QA_PENDING / REVIEWER_PACKETS_4_PREPARED_BY_OPERATOR / G3_NOT_APPROVED / NO_MERGE`.**


## 11. G2-F 웹 및 분리형 ZIP의 자동 검증 증거 (2026-11-06)

**증거 등급: SYNTHETIC_OFFLINE_CI / NO_REAL_REVIEWER_WINDOWS_BROWSER_QA.**

- [Node 24 G1~G2-F CI #42169528351](https://github.com/Choi1999/YOUTOPIA/actions/runs/42169528351): **220개 테스트 / 219 PASS / 0 FAIL / 1 SKIP**. G2-F 전용 브라우저/API 단위 테스트는 검수자 스코프, 로컬 해시 불일치 차단, 웹 Origin 정책, 기존 작성자/타 검수자 파일 탐색 차단, 비공개 JSON 개별 저장 및 낙관적 동시 수정 감지를 포함한다.
- [Windows CLI·ZIP 시험 #42170254342](https://github.com/Choi1999/YOUTOPIA/actions/runs/42170254342): **PASS**. PowerShell 웹 런처와 ZIP 내보내기 스크립트의 구문 검사, 합성 G2-F 질문 패킷으로 실제 ZIP 생성 후 ZIP에는 **정확히 1개 검수자 질문 패킷**, 필수 앱 파일, 미디어/SRT/타 검수자 답안 파일 0개임을 확인했다. 실영화 다운로드/검수, 서버 배포 없음.
- 오프라인 테스트에서 건너뛴 1개는 기존 환경의 FFmpeg 합성 미디어 실전 통합 조건 부재 때문이며 **G2-F 기능 전체 QA 통과를 뜻하지 않는다**.
- 실제 검수자 A·B의 **각자 Windows PC에서 브라우저 재생/문항 선택/근거 시점 캡처/질문 저장/새로고침 후 유지**를 확인하는 현장 QA는 아직 미완료이며, 두 사람의 독립 검수 정답도 미접수다.

**결론:** `G2F_REVIEWER_WEB_CODE_AND_ZIP_CI_PASS / REVIEWER_PC_MANUAL_QA_PENDING / HUMAN_GOLD_APPROVAL_0 / G3_NOT_APPROVED / NO_MERGE / NO_DELETE`.


## 12. 운영자 승인: AI 초안 제공 후 각 검수자의 사실 확인·편집 (2026-11-06)

**신규 운영 결정:** 검수자가 처음부터 12문항의 답변·근거를 새로 작성하는 업무 부담이 확인되어, 운영자는 **AI가 내용을 선작성하고 검수자 A·B가 각자 그 초안을 영상과 대조해 수용·수정·반려·보류하는 방식**으로 변경하도록 요청했다.

**정직한 판정 라벨:** 이 작업은 **AI_ASSISTED_EDITORIAL_REVIEW / NON_BLIND**다. 두 검수자가 서로의 검수 결과를 보지 않는 운영 독립성은 유지하지만, 두 사람 모두 AI 초안을 보기 때문에 G0 계약의 **AI 답안에 노출되지 않은 블라인드 독립 라벨링**과 같다고 주장하지 않는다. G2-E의 원래 정답 자료를 검수 웹에 노출하지 않는다. 단지 이번 AI 선작성 내용을 검수한다. 기존 G2-F 블라인드 질문 패킷 4개와 이미 검수자가 기록한 답변 파일은 **보존하며 자동 덮어쓰기/승격/이관하지 않는다**.

### 12.1 AI가 선작성한 내용과 출처 한계

신규 공개 초안 파일: `shared/experiments/yu-video-understanding-poc-v0/g2f-assisted-proposals.json`.

- Sintel 6문항 + Tears of Steel 6문항에 대한 **AI가 작성한 미검증 예시 답변 12개**, 예상 분류, 예상 근거 시각, 검수 주의 사항을 포함한다.
- 초안의 근거는 이 대화에서 **사용자가 앞서 관찰했다고 보고한 행동·발화와 과거 답변의 공개 자막 요약**이다. AI는 실제 로컬 원본을 직접 시청하거나 파일 전체를 판독하지 않았다.
- 특히 **시간 구간이 일부 임시값**이고, 영상의 사건·음성·자막이 정확히 일치하는지 독립적으로 검증되지 않았다. 검수자의 재확인 없이는 정답/근거로 인정하지 않는다.
- UNSUPPORTED 두 건은 **전체 영화 정보 부재를 추정한 후보**일 뿐이다. 검수자가 원본 전체에서 반대 사실을 찾았다면 `EDIT + SUPPORTED`로 판정을 뒤집을 수 있다. 불확실하다면 `UNCERTAIN` 또는 `REJECT`.
- AI 초안이 공개 Git에 있다고 해서 영상·자막·골드 정답을 공개한 것은 아니다. 기존 실제 사용자 G2-E 답변 원문과 검수자 A/B 개인 응답은 여전히 로컬 JSON으로 분리한다.

### 12.2 신규 도구와 원본 보존 범위

- `g2f-assisted-review.cjs` — AI 초안별 **PENDING/ACCEPT/EDIT/REJECT/UNCERTAIN** 판정, 사람 관찰 시간 검증, 질문·AI 초안 변조 방지, 두 사람 결과 비교. 자동 골드/G3 승인 금지.
- `g2f-assisted-workspace-server.cjs`, `g2f-assisted-workspace.html`, `g2f-assisted-workspace.css`, `g2f-assisted-workspace-client.js` — **검수자 자신의 질문/AI 제안/실제 원본 영상·SRT·파형/편집 폼**만 제공하는 별도 127.0.0.1 로컬 웹. 기존 작성자의 G2-E 정답·타 검수자 응답 API 없음.
- `g2f-assisted-workspace.ps1` — 같은 Windows PC에서 검수자 코드를 지정해 새로운 **AI 보조 검수 전용 파일**을 최초 1회 생성하고 기존 파일은 재사용. 기존 G2-F 블라인드 파일 자동 변경 금지.
- 사용자 비공개 저장 위치: `%LOCALAPPDATA%\YOUTOPIA\G2F-AssistedReviews\{Film}-{ReviewerCode}-assisted-review.json`. G2-E 비공개 소스 파일과 생성 시의 SHA-256를 연결해, 사후 G2-E 답안 변경에 따른 근거 혼동을 차단한다.

### 12.3 사용자 Windows PC에서 순차 실행

현재 기존 G2-F 구형 블라인드 웹 서버가 실행 중이라면 **Ctrl+C로 먼저 중단**한다. Git Worktree가 깨끗한 경우에만 최신 실험 브랜치로 전환한다.

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw "Git fetch 실패" }

cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw "Worktree에 변경 사항이 있습니다" }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw "실험 코드 갱신 실패" }

$assist = '.\shared\experiments\yu-video-understanding-poc-v0\g2f-assisted-workspace.ps1'

# 검수자 A: Sintel 6문항
& $assist -Mode Serve -Film Sintel -ReviewerCode REVIEWER_A

# A가 저장 완료 후 Ctrl+C -> Tears 6문항
& $assist -Mode Serve -Film TearsOfSteel -ReviewerCode REVIEWER_A

# A의 브라우저/서버 완전 종료 뒤 B 투입
& $assist -Mode Serve -Film Sintel -ReviewerCode REVIEWER_B
& $assist -Mode Serve -Film TearsOfSteel -ReviewerCode REVIEWER_B
```

위 명령들은 **동시에 실행하는 것이 아니다.** 각각의 `G2F_ASSISTED_WORKSPACE_READY http://127.0.0.1:<port>/`를 운영자 PC의 브라우저에서 연다. 검수자 교대 시 서버를 `Ctrl+C`로 종료한 뒤 브라우저 탭을 닫는다. **동일한 Windows 로그인 계정으로는 OS 수준의 접근권 차단이 되지 않는다.** 가능하면 A/B에 각각 다른 Windows 사용자 계정 또는 실제 통제 감독을 제공한다.

### 12.4 검수자 화면 작업 계약

각 문항에는 AI가 미리 작성한 질문·후보 정답·예상 근거 구간이 표시되지만 **제안 내용은 전부 미검증**으로 표시된다.

1. 검수자는 실제 원본 영상을 직접 확인하고, AI가 제안한 정답과 시간구간을 대조한다.
2. **ACCEPT**: 초안 내용이 맞다고 확인한 경우. 근거 시작·종료·관찰 설명을 사람이 직접 확정해야 저장할 수 있다.
3. **EDIT**: 답변이 일부 틀리거나 불충분하면 정답·분류·근거를 고치고 사유를 작성한다. AI의 UNSUPPORTED 추정을 실제 증거로 SUPPORTED로 뒤집을 수도 있다.
4. **REJECT**: 초안이 사실과 다르거나 평가 질문이 잘못됐다면 반려 사유를 기록한다.
5. **UNCERTAIN**: 검수자가 실제 원본을 보고도 판단이 불가능하면 보류한다. 오류를 감추기 위한 임의 수용 금지.
6. 모든 비-PENDING 검수는 `실제 원본을 직접 확인했다` 체크가 필요하고, 해당 체크는 자기 신고이므로 독립적 검증 완료를 증명하지 않는다.
7. 두 사람의 검토 결과는 **서로 보지 않고 개별 로컬 JSON**으로 저장한다.

### 12.5 두 검수자 결과 비교

각 사람/영화 파일의 구조 검사:

```powershell
$assist = '.\shared\experiments\yu-video-understanding-poc-v0\g2f-assisted-workspace.ps1'
& $assist -Mode Check -Film Sintel -ReviewerCode REVIEWER_A
& $assist -Mode Check -Film Sintel -ReviewerCode REVIEWER_B
& $assist -Mode Check -Film TearsOfSteel -ReviewerCode REVIEWER_A
& $assist -Mode Check -Film TearsOfSteel -ReviewerCode REVIEWER_B
```

모두 제출한 뒤 **운영자만** 비교:

```powershell
& $assist -Mode Assess -Film Sintel
& $assist -Mode Assess -Film TearsOfSteel
```

차이·수정·반려·불확실 항목을 사람이 최종 대조해 평가셋을 정제한다. 이 출력은 `blindReviewCount=0`, `independentGoldApproved=0`, `g3Authorized=false`를 유지한다. **두 검수자가 AI 초안을 수용했다고 자동으로 실제 골드 정답이 승인되거나 G3 모델 성능 검증이 성립하는 것은 아니다.**

### 12.6 합의와 통합 준비 경계

이번 변경은 사용자가 승인한 **실제 검수 작업을 하기 위한 사용성 개선**으로 한정된다. 원격 PR 병합, 실험 브랜치 삭제, G3 실호출은 여전히 별도 승인 대상이다. 기존 G2-F 블라인드 도구/검수자가 기록한 결과가 남아 있다면 이를 **새 AI 보조 검수의 독립 증거라고 재해석하지 않는다.**

**현재 상태:** `G2F_ASSISTED_12_AI_DRAFTS_READY / REVIEWER_PC_UI_QA_PENDING / HUMAN_CORRECTION_PENDING / NON_BLIND / NO_GOLD_APPROVAL / G3_NOT_APPROVED / NO_MERGE / NO_DELETE`.


## 13. AI 초안 보조 검토 도구 CI 및 현장 QA 수락 기준 (2026-11-06)

### 현재 자동 검증 기록

- [Node 24 오프라인 CI #42195500559](https://github.com/Choi1999/YOUTOPIA/actions/runs/42195500559): **234개 테스트 / 233 PASS / 0 FAIL / 1 SKIP**. 1건 SKIP은 기존 CI 환경의 FFmpeg 실파일 변환 테스트 제한이다.
- [Windows PowerShell 구문/오프라인 CI #42194809232](https://github.com/Choi1999/YOUTOPIA/actions/runs/42194809232): 신규 AI 보조 모드 PowerShell `g2f-assisted-workspace.ps1` 파서 PASS, 전용 서버/클라이언트 Node 구문 PASS. 테스트는 실제 사용자 영화 다운로드/실제 브라우저 클릭을 하지 않는다.
- 이번 모드의 자동 테스트에서는 AI 초안 12개 제안·출처 미확인 플래그, 정답 자동 채움과 사람 검토 구분, `ACCEPT` 이전 사람 근거 필수, `EDIT`/부재 주장 정정, 반려·불확실 기록, 질문/AI 제안 변조 차단, A/B 비교의 `blindReviewCount=0`, 기작성 G2-E 정답과 타 검수자 답변 노출 차단, 로컬 JSON 저장을 확인했다.
- 추가 사용성 개선: 답변뿐 아니라 **AI가 제안하는 관찰 기록·UNSUPPORTED 사유도 처음부터 입력란에 표시**한다. 검수자가 사실 확인 후 수정할 수 있지만, `watchedSource=true` 자기 신고 및 근거 시간/모달리티 구조 검증 없이 저장되는 것은 금지한다.

### 실제 Windows Chrome/Edge QA — 검수자 A부터

1. 이전 G2-F 블라인드 웹을 Ctrl+C로 닫고 새 `g2f-assisted-workspace.ps1 -Film Sintel -ReviewerCode REVIEWER_A` 실행. `G2F_ASSISTED_WORKSPACE_READY` 출력 확인.
2. 브라우저 상단에 **AI 초안·비블라인드** 경고, 질문별 예상 답변, 후보 근거 시각, 관찰 기록·근거 부재 사유가 보이는지 확인.
3. `ACCEPT`를 누른 뒤 실제 영상·음성을 확인하고 `실제 원본을 확인` 체크, 필요 시 근거 시간 및 설명 수정, 저장. 재조회 시 별도 로컬 JSON에 기록되는지 확인.
4. 영상과 AI 초안이 다르면 `EDIT`로 답변·시각·근거를 변경하거나, `REJECT`/`UNCERTAIN`으로 이유를 남길 수 있는지 확인.
5. 기존 `%LOCALAPPDATA%\YOUTOPIA\G2F-IndependentReviews`의 **블라인드 파일**, 기존 `G2E-PrivateGoldDrafts` 파일 및 `G2D-ManualReviews` 파일이 수정되지 않았는지 확인.
6. A 세션을 종료하고 B 세션을 열었을 때, A의 답변 상태가 B의 UI에 표시되지 않아야 한다.
7. 이 1~6 현장 QA에 이상이 없을 때 **실제 사람 검수 12문항×2인**을 개시한다.

**주의:** 같은 Windows 사용자 계정으로 A/B를 전환하면 JSON 파일에 OS 수준 접근통제가 있는 것은 아니다. 화면에 상대편 정답이 제공되지 않는다는 사실은 물리적인 접근권 분리의 대체물이 아니다. 실제 검수자가 동일한 AI 초안을 읽는 만큼 **최종 두 결과의 일치가 골드 정답의 독립 블라인드 합의를 의미하지 않는다**.

**현 상태:** `AI_PROPOSALS_12_OF_12_AUTHORED_UNVERIFIED / AI_ASSISTED_OFFLINE_CI_PASS / USER_WINDOWS_MANUAL_QA_PENDING / NON_BLIND_EDITORIAL_REVIEW / GOLD_APPROVAL_0 / G3_BLOCKED / NO_MERGE / NO_DELETE`.
