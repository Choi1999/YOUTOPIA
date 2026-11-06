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


## 8. 기존 G2-D 웹 작업공간의 G2-E 화면 (권장 사용자 흐름)

이전 G2-D 검수에서 JSON 직접 수정이 번거로웠던 문제를 줄이기 위해, **기존 로컬 영상·오디오 파형·SRT 작업공간 아래에 G2-E 정답 작성 패널을 추가**했다. 문항 6개를 비공개 파일에 생성한 뒤, G2-D에서 사용한 로컬 원본을 재생해 답변·근거를 입력할 수 있다. 원본 영상이나 G2-D 검수 기록은 변경하지 않는다.

### 8.1 실행

Windows VS Code PowerShell에서 **현재 실행 중인 기존 G2-D 로컬 서버**를 먼저 `Ctrl+C`로 종료하고, 다음 명령을 실행한다. 기존 Worktree를 다시 만들거나 원본 영화를 다시 다운로드하지 않는다.

```powershell
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'Git fetch 실패' }

cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw '기존 Worktree 변경 사항을 먼저 검토' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw '실험 Worktree 갱신 실패' }

& .\shared\experiments\yu-video-understanding-poc-v0\g2d-open-workspace.ps1 -Film Sintel
```

`G2D_LOCAL_WORKSPACE_READY http://127.0.0.1:<port>/` 주소를 브라우저에서 연다.

### 8.2 화면에서 정답 초안 작성

1. 화면 하단의 **G2-E · 실제 영상 평가 질문 / 정답 초안**으로 이동.
2. 처음에는 **G2-E 질문 6개 생성 (비공개)**를 클릭한다. 기존 비공개 JSON이 이미 있으면 덮어쓰지 않고 읽어 온다.
3. `G2E-SIN-01` 등 질문을 선택한다. 로컬 원본이 해당 G2-D 검수 시점보다 4초 앞부터 재생하도록 이동한다.
4. 실제 영상·SRT를 확인한 후 최종 질문 문장과 비식별 작성자 코드를 입력한다.
5. **정답 가능 여부**를 선택한다. `SUPPORTED`는 근거가 확인된 경우, `UNSUPPORTED`는 정답 근거 부족을 **전체 영화를 검토한 뒤** 확정한 경우, `AMBIGUOUS`는 추가 검수가 필요할 때 사용한다.
6. 사람이 확인한 정답 초안 또는 왜 모호한지 설명하는 이유를 작성한다.
7. `SUPPORTED`인 경우 화면 아래에 나오는 **로컬 원본 근거** 1~2개를 작성한다. `이 기준점으로 이동`, `현재 시점 → 시작`, `현재 시점 → 종료` 버튼으로 실제로 관찰한 구간을 기록하고, 모달리티와 관찰 내용을 작성한다. **파형 모양이나 SRT 번호만으로 정답 사실을 확정하지 않는다.**
8. `UNSUPPORTED`인 경우 후반 몇 장면만 보지 말고 원본 영상 **전체**의 확인 가능성을 판단한 뒤 근거 부족 이유와 전체 영화 확인 체크를 작성한다.
9. **이 질문의 정답 초안 저장**을 누른다. 브라우저는 서버의 구조·출처·근거 유효성 검증 결과를 받아서 저장되거나 오류를 표시한다.
10. 나머지 5문항도 반복한 후, 영화 두 번째 편의 서버를 시작한다.

**모호하거나 영상에서 근거를 찾을 수 없는 질문은 억지로 확정하지 않는다.** 검증기가 불충분한 근거를 거절하면 문항을 `AMBIGUOUS`로 기록하고 재설계한다. 모든 정답이 입력되어도 데이터셋은 `OPERATOR_DRAFT_QUESTIONS_ALL_AUTHORED_NOT_VERIFIED`이며 **독립 검수자 승인 전**이다.

### 8.3 사용자 Windows 비공개 파일·검증

- Sintel: `%LOCALAPPDATA%\YOUTOPIA\G2E-PrivateGoldDrafts\Sintel-gold-candidates.json`
- Tears: `%LOCALAPPDATA%\YOUTOPIA\G2E-PrivateGoldDrafts\TearsOfSteel-gold-candidates.json`

두 번째 영화 작업 시 기존 서버를 `Ctrl+C`로 종료하고 다음 명령을 실행한다.

```powershell
& .\shared\experiments\yu-video-understanding-poc-v0\g2d-open-workspace.ps1 -Film TearsOfSteel
```

입력 완료 후 `g2e-windows-gold-pilot.ps1 -Mode Assess`를 실행해 **정답 전문을 콘솔로 유출하지 않는 구조화 검증 결과**만 확인한다.

### 8.4 실제 QA 및 제약

새 G2-E 화면의 **로컬 Node 자동 테스트와 모의 브라우저 호출만 수행**한 상태이며 사용자 Windows에서의 G2-E 패널 실제 표시·저장·영상 구간 캡처 수동 QA는 아직 없다. 기존 G2-D 웹 플레이어는 사용자 보고로 주요 기능 PASS를 받았다. 이 결과를 G2-E 화면까지 자동 승격하지 않는다.

G2-E 패널의 모든 저장은 사용자 명시 클릭이 필요하고, 저장은 기존 G2-D JSON과 독립된 **로컬 비공개 파일**에만 수행된다. Q/A가 들어간 비공개 파일은 GitHub에 올리거나 외부 공급자에게 전송하지 않는다.

현재 상태: `G2E_GOLD_UI_OFFLINE_CODE_TESTED / REAL_GOLD_HUMAN_AUTHORING_PENDING / INDEPENDENT_REVIEW_0 / G3_NOT_APPROVED`.


## 9. 구현 및 CI 확인 (2026-11-05)

공개 소스는 G2-E 질문 12개 초안·오프라인 검증기·Windows 스크립트·기존 G2-D 파형 작업공간 내 G2-E 입력 패널 및 로컬 저장 API로 구성된다.

- `shared/experiments/yu-video-understanding-poc-v0/g2e-question-candidates.json`: 12문항 **질문 초안만** 기록. 답변·영상 자막 원문 없음.
- `g2e-gold-pilot.cjs`, `g2e-windows-gold-pilot.ps1`: 소스 G2-D 기록과 연결되는 비공개 정답 파일 생성 및 의미/시간·출처의 **구조 검증**.
- `g2d-workspace-server.cjs` 및 기존 HTML/CSS/Client: 같은 로컬 작업공간에 G2-E 화면 제공, 기존 골드 파일이 있으면 재사용하며 덮어쓰지 않음, 관찰한 근거의 시작/종료 시간 기록, 사용자 저장 클릭 시에만 비공개 파일에 기록.
- 부정 테스트: 정답/시간 증거 누락, 틀린 모달리티, 근거 지점 불일치, 비검증 YouTube 시점 사용, G3/권리/독립 검수 승인 조작, 외부 사이트의 저장 요청, 동시 수정 충돌 등.
- [Node 24 GitHub Actions #42022955940](https://github.com/Choi1999/YOUTOPIA/actions/runs/42022955940): **194 테스트 중 193 PASS, 0 FAIL, 1 SKIP**. 건너뛴 테스트는 해당 CI의 FFmpeg 실행 파일 부재로 인한 합성 영상 변환 검증이며, G2-E 문항 검증/모의 UI 저장 API 테스트는 수행됨.
- [Windows CI #42022707609](https://github.com/Choi1999/YOUTOPIA/actions/runs/42022707609): G2-E PowerShell 구문 검사 PASS. 실제 사용자 로컬 비공개 정답 JSON 작성, 브라우저 화면 수동 QA 및 독립 인적 검수는 **아직 수행하지 않음**.

**최종 개발 상태:** `G2E_QUESTION_CANDIDATES_AND_BROWSER_AUTHORING_READY / ACTUAL_PRIVATE_GOLD_DATA_NOT_CREATED_BY_ASSISTANT / HUMAN_GOLD_0_OF_12_VERIFIED / G3_NOT_APPROVED / NO_MERGE`.


## 10. 운영자 보고 G2-E 실영화 정답 초안 12/12 작성 완료 (2026-11-06 KST)

**증거 등급: USER_SUBMITTED_LOCAL_ASSESS_JSON + USER_PROVIDED_BROWSER_SCREENSHOTS.** 이 집계는 사용자가 Windows 로컬 `g2e-windows-gold-pilot.ps1 -Mode Assess`로 평가하고 대화에서 제출한 Sintel·Tears of Steel **요약 출력**에 기반한다. GitHub에는 개인정보가 있을 수 있는 실제 정답·SRT 원문·영상·비공개 골드 초안 JSON을 업로드하지 않았다. 로컬 파일의 실제 내용을 연결 도구에서 독립적으로 열람하거나 재판독하지 않았다.

| 필드 | Sintel | Tears of Steel | 합계 |
|---|---:|---:|---:|
| 검수기 `questionCount` | 6 | 6 | 12 |
| 운영자 작성 `operatorAuthored` | 6 | 6 | **12** |
| 미작성 `notAuthored` | 0 | 0 | **0** |
| 검수기 `needsRewrite` | 0 | 0 | **0** |
| `SPEECH` 작성 | 2 | 2 | 4 |
| `VISUAL` 작성 | 2 | 2 | 4 |
| `TEMPORAL` 작성 | 1 | 1 | 2 |
| `UNSUPPORTED` 작성 | 1 | 1 | 2 |
| `OCR` 작성 | 0 | 0 | 0 |
| `fullFilmAbsenceClaimsReported` | 1 | 1 | 2건 **운영자 자기 보고** |
| 검증기 `status` | `OPERATOR_DRAFT_QUESTIONS_ALL_AUTHORED_NOT_VERIFIED` | `OPERATOR_DRAFT_QUESTIONS_ALL_AUTHORED_NOT_VERIFIED` | 두 편 동일 |
| 독립 검증 `independentGoldReviewVerified` | false | false | **0/12 검증** |
| 실제 골드 승인 `realGoldApproved` | false | false | 없음 |
| G3 승인 `g3Authorized` | false | false | 없음 |
| 공급자 호출/실험비용 | 0 / $0 | 0 / $0 | 0 / $0 |

### 구분해야 할 판정과 품질 위험

1. **입력 완결성 통과 ≠ 실제 영상 정답의 사실적 정확성 확인.** `needsRewrite=0`은 검증기가 포착한 구조·시간·모달리티의 오류가 없다는 뜻이며, 답변의 의미적 타당성과 독립된 인적 검토를 증명하지 않는다.
2. **두 건의 전체 영화 부재 주장**은 작업자가 체크한 `fullMovieReviewed` 플래그와 서술 내용에 근거한다. 영상 전문을 별도 검토자가 직접 확인한 증거로 승격하지 않는다.
3. **정답 작성 독립성 위험:** 이번 작성 과정에서 AI가 예시 답안을 제안했으며 사용자가 이를 참고해 로컬 초안을 작성했다. 따라서 이 자료는 현재 **AI-assisted operator draft**이고, 이를 다시 AI에 평가시키는 경우 정답 유출·평가 편향이 생길 수 있다. 독립된 사람의 블라인드 검수 또는 별도 답변/근거 대조가 필요하다.
4. **UNSUPPORTED 두 문항의 판별력:** 질문에 답이 없다는 사실이 질문 문구에 드러나면 영상을 보지 않은 모델도 정답을 유추할 수 있다. 현재 두 작품의 질문은 구체화된 장면 사실로 바꾸려 했지만, 독립 검수에서는 실제 영화 전체의 부재 여부와 질문 자체가 추측으로 풀리지 않는지 별도 확인한다.
5. **Tears YouTube 시간축:** 앞선 G2-D의 장면 오프셋 편차 5초 `NOT_ESTABLISHED`는 그대로 유지한다. 정답 초안은 `localTimelineEvidenceOnly=true`이며 미검증 YouTube 시간을 골드 근거로 승격하지 않았다.

### 다음 권장 업무: G2-F 독립 정답 검수 준비

문항을 더 많이 작성하거나 G3로 승격하는 대신, 두 작품 **12문항에 대한 한 번의 블라인드 독립 검수**를 우선 진행한다.

- 영상 접근권이 있고 작업자 초안을 보지 않은 다른 검수자에게 **질문만 먼저** 제시해 각자의 답·가능 여부·로컬 원본 근거 구간을 작성하도록 한다.
- 그 뒤 작업자 초안과 일치/불일치·시각 근거·SRT 의존·영상 근거 부재를 비교하고, 불일치만 집중 재검수한다.
- 합의된 질문만 `humanGoldApproved` 후보로 분리한다. 검토 완료 전 12문항의 골드 승인을 자동으로 기록하거나, JSON에서 `g3Authorized` 플래그를 변경하지 않는다.
- 리뷰어의 독립성과 실제 검토 근거가 확보되지 않으면 작업 완료는 **작성 단계**에 한정하고 후속 테스트의 실제 모델 정확도·요금이나 외부 API 호출을 주장하지 않는다.

**최종 상태:** `G2E_OPERATOR_DRAFTS_12_OF_12_COMPLETE / G2F_INDEPENDENT_REVIEW_PENDING / HUMAN_GOLD_0_OF_12_VERIFIED / TEARS_TIMELINE_REVIEW_OPEN / G3_NOT_APPROVED / NO_MERGE`.
