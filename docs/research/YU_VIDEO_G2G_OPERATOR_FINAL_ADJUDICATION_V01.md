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
