# YOUTOPIA G2-E — 실제 영상 질문 후보·비공개 정답 작성 계약 v0.1

> 작성일: 2026-11-05 KST
> 브랜치: `experiment/yu-video-understanding-poc-v01`
> 현재 상태: **12 QUESTION DRAFTS / 0 HUMAN GOLD ANSWERS / 0 INDEPENDENT REVIEWERS / NO API / G3 NOT APPROVED**
> 범위: 공인 라이선스 검토 및 영상-YouTube판 동등성 전체 검증은 별도 Gate이며, 이 문서는 그 Gate를 해제하지 않는다.

## 1. 기존 G0 기준과 이번 파일럿의 경계

G0 계약은 이용권이 검증된 **영상 6개 × 질문 6개 = 36문항**으로 A(직접 멀티모달)·B(의미 인덱스)·C(자막 전용) 입력을 공정하게 비교하도록 설계되었다. 전체 질문 종류는 **SPEECH 12 / VISUAL 8 / OCR 6 / TEMPORAL 5 / UNSUPPORTED 5**다.

현재 실파일 확보와 운영자 G2-D 표본 검수 기록이 있는 자료는 **Sintel**과 **Tears of Steel** 두 편뿐이다. 따라서 이번 G2-E에서는 **2편×6문항=12개 질문 후보**만 준비한다. 이 두 영화는 시각적으로 풍부한 서사영화이므로 기존 G0의 시각·동작 영상 카테고리를 위한 **잠정적인 대리 표본**으로 분류한다. 이 사실이 인터뷰 2편·화면 시연 2편·다양한 실물 동작 영상을 모두 대표한다는 뜻은 아니다.

| 범위 | SPEECH | VISUAL | OCR | TEMPORAL | UNSUPPORTED | 합계 |
|---|---:|---:|---:|---:|---:|---:|
| 이번 G2-E Blender 파일럿 | 4 | 4 | 0 | 2 | 2 | **12** |
| 후속 4개 영상에서 추가 필요 | 8 | 4 | 6 | 3 | 3 | **24** |
| 기존 G0 최종 평가 계약 | **12** | **8** | **6** | **5** | **5** | **36** |

**OCR 6문항을 영화 장면에서 억지로 만들지 않는다.** 이후 실제 소프트웨어 시연·화면 텍스트 자료에서 확보한다.

G2-D 결과에는 사용자 제출 기반으로 Sintel 6/6, Tears 8/8의 표본 일치 보고가 있다. Tears는 YouTube 장면 오프셋 최대 편차 **5초**로 시간축 경고가 남아 있다. 이 표본 검사 결과는 *새로 만들 질문의 정답 증명*으로 자동 이전하지 않는다.

## 2. 실제 공개 질문 후보 목록 — 아직 정답 아님

원장: `shared/experiments/yu-video-understanding-poc-v0/g2e-question-candidates.json`

질문 텍스트는 **영상 사실을 보지 않고도 특정 구간에서 무엇을 확인해야 할지 제시하는 검수 질문 초안**이다. 정답 내용, 직접 관찰 근거, 화면 밖 사건의 부재는 **사람이 실제 영화를 시청·청취하기 전에는 확정하지 않는다**.

| 질문 ID | 영화 | 유형 | 검토에 사용할 실제 G2-D 기준점 |
|---|---|---|---|
| G2E-SIN-01 | Sintel | SPEECH | AUDIO_FIRST / SRT #1 |
| G2E-SIN-02 | Sintel | SPEECH | AUDIO_MIDDLE / SRT #13 |
| G2E-SIN-03 | Sintel | VISUAL | YOUTUBE_OPENING / 로컬 01:28.803 |
| G2E-SIN-04 | Sintel | VISUAL | YOUTUBE_MIDPOINT / 로컬 07:24.016 |
| G2E-SIN-05 | Sintel | TEMPORAL | 로컬 OPENING + MIDPOINT |
| G2E-SIN-06 | Sintel | UNSUPPORTED | 특정 타임코드로 부재를 증명할 수 없음 — 전체 영상 확인 필요 |
| G2E-TOS-01 | Tears | SPEECH | AUDIO_FIRST / SRT #1 |
| G2E-TOS-02 | Tears | SPEECH | AUDIO_MIDDLE / SRT #38 |
| G2E-TOS-03 | Tears | VISUAL | YOUTUBE_OPENING / 로컬 01:13.417 |
| G2E-TOS-04 | Tears | VISUAL | YOUTUBE_MIDPOINT / 로컬 06:07.084 |
| G2E-TOS-05 | Tears | TEMPORAL | 로컬 OPENING + MIDPOINT |
| G2E-TOS-06 | Tears | UNSUPPORTED | 특정 타임코드로 부재를 증명할 수 없음 — 전체 영상 확인 필요 |

이것은 **12개의 검증 가능한 질문을 완성했다**는 주장이 아니다. 사람은 실제 장면에 내용이 없거나 질문이 모호하다면 `AMBIGUOUS`로 기록하고 최종 질문을 다시 작성해야 한다. 영화에 없는 OCR·장면·대사·확정되지 않은 제작 사실을 만들어 넣지 않는다.

## 3. Windows 로컬 사용자 실행

사용자가 이전 단계에서 확보한 원본 영상·SRT와 G2-D 검수 JSON을 그대로 사용하며 **다운로드나 유료 공급자 API 호출을 하지 않는다.** 기존 실험 Worktree가 깨끗할 때만 최신 커밋을 전환한다.

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'Fetch 실패' }

cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw '기존 Worktree 변경 내용 검토 필요' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw '실험 Worktree 업데이트 실패' }

$g2e = '.\shared\experiments\yu-video-understanding-poc-v0\g2e-windows-gold-pilot.ps1'

# 1회 생성. 출력 JSON은 이미 기록된 G2-D 원본 검수 식별자에 연결됨.
& $g2e -Mode Plan -Film Sintel
& $g2e -Mode Plan -Film TearsOfSteel

# 실행 결과가 생성된 다음, VS Code에서 비공개 문항 파일을 확인
code "$env:LOCALAPPDATA\YOUTOPIA\G2E-PrivateGoldDrafts\Sintel-gold-candidates.json"
code "$env:LOCALAPPDATA\YOUTOPIA\G2E-PrivateGoldDrafts\TearsOfSteel-gold-candidates.json"
```

저장 장소: `%LOCALAPPDATA%\YOUTOPIA\G2E-PrivateGoldDrafts\{Film}-gold-candidates.json`.

이미 파일이 있으면 자동으로 다시 생성하거나 덮어쓰지 않는다. 파일은 **Git 저장소 외부**에 있고, 로컬 G2-D 원장과 연결되는 해시·영상 식별정보를 포함하므로 그대로 GitHub에 올리지 않는다.

## 4. 사람이 작성할 필드·검증 규칙

문항은 `questions[0..5]`에 담겨 있다. **불변 필드**(`id`, `kind`, `anchorCheckpointIds`, `anchorLocalMs`, `questionDraft`, `requiredModalities`, `planDigest`, `sourceReviewDigest`, `localSource`, `g3Authorized`)는 수정하지 않는다.

한 질문마다 다음 필드를 영상에 근거하여 작성한다.

| 필드 | 직접 입력 의미 |
|---|---|
| `finalQuestionText` | 실제 장면에 적용할 수 있도록 최종 수정한 질문. 처음 초안과 같을 수도 있으나 반드시 시청 후 확정 |
| `authorCode` | 개인 실명·이메일이 아닌 비식별 영문 코드. 예: `LOCAL_AUTHOR_1` |
| `gold.answerability` | `SUPPORTED` / `UNSUPPORTED` / `AMBIGUOUS` |
| `gold.answerText` | 영상 근거에 대한 **사람의 정답 초안** 또는 모호성 이유. 영상 대사의 긴 전문 복사 금지 |
| `gold.evidence` | `modality`, `localStartMs`, `localEndMs`, `youtubeObservedMs`, `observationNote`로 구성된 1~2개 이상의 근거 구간 |
| `gold.absenceRationale` | UNSUPPORTED에서 영화 전체에 근거가 없음을 확인한 이유. 그 외 null |
| `gold.fullMovieReviewed` | UNSUPPORTED일 때 실제 전체 영화를 확인했다면 true. 그 외에는 기본 false |

실제 정답 작성 시 다음 원칙을 적용한다.

- **SPEECH**: SRT 번호와 실제 음성 발화가 대응하는지 직접 듣고 의미를 기록. 모달리티 `AUDIO` 또는 `TRANSCRIPT`, 근거 ≥1.
- **VISUAL**: 자막이 아닌 실제 화면에서 확인한 동작을 기록. 모달리티 `FRAME`, 근거 ≥1.
- **TEMPORAL**: 서로 다른 두 구간의 사건 순서를 확인. `FRAME` 근거 ≥2, 두 G2-D 체크포인트에 근접해야 함.
- **UNSUPPORTED**: 특정 구간에 없다는 것만으로 근거 부재를 단정하지 않는다. 전체 영화를 확인하고 `answerability=UNSUPPORTED`, `fullMovieReviewed=true`, `absenceRationale`를 작성한다. 불분명하다면 `AMBIGUOUS`로 남긴다.

**타임코드 원칙:** 모든 정답 근거는 실제 Blender 원본의 `localStartMs/localEndMs`이다. 별도의 판본 시간축 검증 없이 `youtubeObservedMs`는 **null 유지**한다. 특히 Tears의 5초 오프셋 편차를 임의로 하나의 보정값으로 대체하지 않는다. 근거 구간은 로컬 영상 전체 길이를 벗어나면 안 되고, 해당 G2-D 검수 기준점의 주변 장면을 실제로 확인해야 한다. 관찰하지 않은 정답이나 시간을 추측해 작성하지 않는다.

### 4.1 예시 구조 (가상 내용 — 복사하여 정답으로 사용 금지)

```json
{
  "finalQuestionText": "실제 해당 장면을 확인한 뒤 수정한 최종 질문",
  "authorCode": "LOCAL_AUTHOR_1",
  "gold": {
    "answerability": "SUPPORTED",
    "answerText": "해당 장면을 직접 확인하고 작성한, 근거가 있는 답변",
    "evidence": [
      {
        "modality": "AUDIO",
        "localStartMs": 107200,
        "localEndMs": 110500,
        "youtubeObservedMs": null,
        "observationNote": "실제로 해당 구간을 듣고 영상의 발화와 자막 내용이 대응함을 확인했다는 기록"
      }
    ],
    "absenceRationale": null,
    "fullMovieReviewed": false
  }
}
```

이 구조는 포맷 설명이다. **가상의 답과 근거를 진짜 검증 결과로 제출하면 안 된다.**

## 5. 오프라인 정답 초안 품질검사

각 영화의 골드 후보를 작성한 다음 다음 명령을 실행한다.

```powershell
cd C:\Projects\YOUTOPIA-VIDEO-G2C
$g2e = '.\shared\experiments\yu-video-understanding-poc-v0\g2e-windows-gold-pilot.ps1'
& $g2e -Mode Assess -Film Sintel
& $g2e -Mode Assess -Film TearsOfSteel
```

검증기는 사람의 정답이 **사실인지 판단하지 못한다**. 대신 다음 구조적 문제를 막는다.

- 비어 있는 정답·증거, 맞지 않는 영상·질문 유형·SRT 검수 지점, 조작된 질문 원본·SHA.
- SPEECH에 FRAME만 제출하거나 VISUAL에 TRANSCRIPT만 제출하는 근거 유형 혼동.
- TEMPORAL의 두 사건을 같은 시각으로 제출하거나 한 구간의 근거가 빠지는 경우.
- UNSUPPORTED를 전체 영화 확인 없이 확정하는 경우.
- YouTube의 비검증 타임코드를 골드 증거라고 제출하는 경우.
- G3 승인·독립 골드 검수·권리 사용 승인을 수동 Boolean으로 위조하는 경우.

`OPERATOR_DRAFT_QUESTIONS_ALL_AUTHORED_NOT_VERIFIED`가 나와도 **검수자 확인 전**이다. `goldIndependentReviewVerified=false`, `humanGoldApproved=false`, `g3Authorized=false`는 유지된다.

## 6. 독립 2인 검수 및 승인 경계

G0 계약에 따라 각 문항의 정답 초안과 영상 근거는 **독립된 두 사람**이 검토해야 한다. 단순히 운영자 1명이 모든 질문을 기입한 뒤 같은 기록을 두 번 PASS로 체크하는 방식은 독립 검수가 아니다.

실무 절차는 다음과 같다.

1. 질문 작성자 1인이 영상 근거 및 정답 초안을 작성한 후 **질문 텍스트와 근거 검토용 로컬 시점만** 두 검수자에게 전달한다.
2. 검수자 A와 B는 **서로의 답변이나 작성자 정답을 먼저 보지 않고**, 각각 로컬 원본 영화의 장면을 직접 보고 정답·근거·답변 가능 여부를 독립 작성한다.
3. 서로 다른 답변·모달리티·근거 시간이 기록되면, 차이를 조정하고 이유를 별도 판정 기록에 남긴다. 사실관계가 해소되지 않으면 `AMBIGUOUS` 또는 보류한다.
4. 공개 저장소에는 비민감 집계·승인여부만 기록한다. 로컬 원본 영상·실제 SRT 전문·인물 개인 데이터·모델 API 키·검수자 신원을 전송하지 않는다.
5. 서로 다른 비식별 검수자 코드나 JSON 2개가 있다고 해서 **실제 두 사람이 독립 검수했다는 사실을 자동 증명하지 않는다**. 결과에 대한 독립적 확인과 승인 절차가 필요하다.

이번 G2-E 커밋의 범위는 **질문 후보 12개, 사용자 로컬 정답 초안 작성 경로, 시간·모달리티·검수 상태를 보호하는 오프라인 검증**까지다. 사람의 실제 정답 작성/독립 검수는 아직 수행되지 않았다.

## 7. 승격 금지 상태

- 공개 원장: **12 question drafts / verified answers 0**.
- 사용자 Windows 비공개 질문/정답 파일: 도구 실행 전 **생성 여부 미확인**.
- 독립 2인 정답 검수: **0/12**.
- 실제 모델 성능·비용, 공정한 A/B/C 6편/36문항 비교: **미실행/불가**.
- Blender 사용권·YouTube 동등성 전체 판정·제3자 송신·보존 승인: **별도 Gate**.
- API 호출·실험 과금·운영 데이터 수정·브랜치 병합: **0**.

**판정: `G2E_PUBLIC_QUESTION_DESIGN_READY / ACTUAL_HUMAN_GOLD_NOT_AUTHORED / G3_NOT_APPROVED / NO_MERGE`.**
