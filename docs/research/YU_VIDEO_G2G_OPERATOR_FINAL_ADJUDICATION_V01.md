# YOUTOPIA — G2-G 운영자 최종 판정 (Human Adjudication) v0.1

## 1. 승인 범위와 선행 결과

2026-11-07 사용자 승인에 따라 G2-F 검수 완료 이후 운영자 최종 판정으로 진행한다. 대상은 Sintel 6문항과 Tears of Steel 6문항이다.
두 검수자 A/B는 각 작품 6문항을 모두 제출했고, 두 작품 12문항 전부 같은 판정/답변으로 AI 초안을 수용했다. Sintel의 SIN-05 근거 #2 문장은 교정됐고, SIN-06의 근거 부재 사유는 A의 조건부 문장과 B의 확정형 문장이 다르다. A/B의 전체 영화 확인 신고는 true이나 자기 보고에 해당한다.

**제한:** A와 B는 동일한 AI 초안을 본 비블라인드 검수자다. 사람 운영자가 답변을 채택해도 독립 블라인드 Gold 승인이나 G3 자동 승인은 이루어지지 않는다.

## 2. 데이터 보존 계약

- G2-E 작성자 JSON, G2-F 리뷰어 A/B JSON 및 기존 백업은 읽기 전용이다.
- 최초 실행 시 각 영화의 입력 원본 3개를 `%LOCALAPPDATA%\YOUTOPIA\G2G-SourceSnapshots`에 SHA-256 확인과 함께 스냅샷한다. 이전 2026-11-06 백업은 최신 SIN-05 수정 전 상태일 수 있다.
- G2-G 전용 판정 파일만 `%LOCALAPPDATA%\YOUTOPIA\G2G-FinalAdjudication`에 생성한다.
- 이 파일에는 생성 당시의 G2-E/A/B SHA-256 해시와 질문 ID를 고정한다. 이후 원본 중 하나가 달라지면 판정 읽기와 저장을 차단한다. 자동 재기준화는 없다.
- 웹 서버는 사용자 PC의 127.0.0.1에만 열리고, 원본 비디오와 SRT 해시를 확인한다. 외부 API 및 영상 업로드는 없다.
- Gold 승인 0, G3 허가 false, 외부 유료 모델 호출 0 상태를 유지한다. 원격 병합·삭제 없음.

## 3. Windows 실행

현재 G2-F 서버가 있으면 Ctrl+C로 종료하고, 기존 Worktree 로컬 변경사항 없는지 확인한 뒤 최신 실험 브랜치를 가져온다.

```powershell
$ErrorActionPreference = 'Stop'
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'Fetch 실패' }
cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw 'Worktree의 로컬 변경 사항이 있음' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw '실험 코드 갱신 실패' }
$adjudicate = '.\shared\experiments\yu-video-understanding-poc-v0\g2g-windows-final-adjudication.ps1'
& $adjudicate -Mode Serve -Film Sintel -OperatorCode FINAL_OPERATOR
```

출력된 G2G_FINAL_ADJUDICATION_READY 로컬 URL을 열어 문항별 A/B 기록과 영화·SRT를 확인한다. 최초 실행 시 두 검수자 답변의 자동 승인 없이 6개 질문 모두 PENDING으로 생성된다. 각 문항에 대해 APPROVE, REVISE 또는 HOLD를 지정하고 이유를 남긴다.

APPROVE는 운영자가 실제 원본을 확인했다는 명시적 체크, 최소 20자 판정 근거, 원본 시간의 근거 관찰 기록을 요구한다. UNSUPPORTED 승인에는 원본 영화 전체 확인과 구체적인 부재 사유가 필수다. 형식적 자기확인은 실제 정확성을 자동으로 증명하지 않는다.

Sintel 종료 후 서버를 Ctrl+C로 닫고 다음을 실행한다.

```powershell
& $adjudicate -Mode Serve -Film TearsOfSteel -OperatorCode FINAL_OPERATOR
```

Tears of Steel 로컬 2012 HD판과 YouTube 버전 간 과거 시점 차이 보고를 고려해 로컬 원본의 실제 시각만 사용한다. 두 리뷰어의 문장이 일치하더라도 자동 승인하지 않는다.

## 4. 결과 확인

```powershell
& $adjudicate -Mode Check -Film Sintel
& $adjudicate -Mode Report -Film Sintel
& $adjudicate -Mode Check -Film TearsOfSteel
& $adjudicate -Mode Report -Film TearsOfSteel
```

- APPROVE: 운영자에 의한 특정 문항 후보 채택. Gold 독립 승인 아님.
- REVISE: 보완이 필요한 문항. 자동 승인 아님.
- HOLD: 현재 판정 보류. 자동 승인 아님.
- PENDING: 작업 미완료.
- operatorApproved + requiresRevision + held + pending = 작품당 6.
- 독립 블라인드 Gold 승인 0, G3 허가 false 상태는 모든 결과에서 유지한다.

## 5. QA 범위

Node 24 합성 CI는 원본 JSON의 변경 차단, 운영자 승인명시성, 근거의 최소 범위, 자기 확인 체크, 실영상 해시 일치 준비, 로컬 API 기록, Gold/G3 차단을 검증한다. Windows의 PowerShell 구문검사는 실제 사용자 로컬 영화가 없는 환경에서 수행한다. 실제 Chrome/Edge 화면 QA와 영상 사실 확인은 운영자 PC에서 진행해야 한다.


## 6. G2-G AI 모범답변 및 판정 사유 초안 자동 입력

운영자 요청: G2-F에서처럼 운영자 G2-G 최종 판정 웹에서도 AI가 답변·근거·관찰 기록·판정 이유의 초안을 제공하도록 변경했다. 운영자는 AI 초안을 채택·수정·보류할 수 있고, 판정만 직접 확정한다.

- 초안 원장: `shared/experiments/yu-video-understanding-poc-v0/g2g-adjudication-proposals.json` (12문항 제안 판정·판정 이유).
- 초안 합성: `g2g-adjudication-proposals.cjs`. 기존 `g2f-assisted-proposals.json`과 `g2f-assisted-observation-drafts.json`에서 AI 모범답변·후보 증거 시간·장면 서술·UNSUPPORTED 사유를 참조한다.
- 추천 상태: SPEECH/VISUAL/TEMPORAL 총 10개는 `APPROVE` **후보**; SIN-06과 TOS-06의 UNSUPPORTED 두 문항은 `HOLD` **후보**. 실제 영상 검수 전에는 모두 미확정이다.
- AI 초안 패널에는 사용자 요구에 따라 **모범답변 문장만** 표시한다. 판정 제안과 사유는 별도의 조작 가능한 입력란에 표시한다. AI 시점의 업무 지시·검수 메타 설명을 모범답변 문장에 섞지 않는다.
- 화면에서 판정이 `PENDING`인 문항은 답변·근거·관찰 기록·사유가 미저장 입력 상태로 미리 채워지지만, 결정 상태 자체는 **PENDING으로 유지**된다.
- 사용자가 `AI 초안 입력란에 적용`을 누르면 추천 결정까지 입력란에 반영된다. 그래도 **영상을 봤다는 체크는 자동으로 켜지지 않고 저장도 자동으로 수행되지 않는다**. 저장하려면 실제로 운영자가 원본을 확인해 유효 근거를 남겨야 한다.
- 이미 저장된 `APPROVE/REVISE/HOLD` 문항은 그 내용을 우선 표시한다. 다시 초안을 불러올 때 확인을 요구하고, **저장된 G2-G JSON을 자동 덮어쓰지 않는다**.
- 원래 G2-E/G2-F 원본 및 과거 스냅샷은 절대로 변경하지 않는다. 기존 G2-G 로컬 파일의 불변 출처 해시·승인 스키마도 변경하지 않는다.
- 제안은 모두 **실제 영상을 AI가 직접 확인한 것이 아닌 미검증 후보**이다. 운영자 판정 완료가 독립 블라인드 Gold 승인이나 G3 실행 권한이 되지는 않는다.

### Windows 실행

기존 서버 Ctrl+C 종료 → Git Worktree 최신화 → `g2g-windows-final-adjudication.ps1 -Mode Serve -Film Sintel` 로 재실행한다. 기존 G2-G 판정 파일이 있다면 재사용하며, 없는 경우에만 최초 원본 스냅샷과 PENDING 6문항 파일을 만든다.

### 자동 검증

- GitHub Actions Node 24 오프라인 테스트: 12문항 후보의 상태·답변·근거·사유 완전성, 화면 AI 초안 제공, 운영자 미확정 기본값, 이미 저장된 운영자 결정 보호, 원본 확인 없는 APPROVE 저장 차단, Gold/G3 기본 거부 확인.
- Windows Chrome/Edge 현장 UI QA는 별도로 수행한다. 실제 원본 사실 판정은 자동화하지 않는다.
