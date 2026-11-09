# YOUTOPIA — G2-I 영상 근거 탐색 UI 첫 기능 슬라이스 v0.1

> 작업 목적: G2-H1 소스 추가 조사보다 YOUTOPIA 사용자 기능 확장을 우선한다는 사용자 승인에 근거한 오프라인 프런트엔드 구현.
> 상태: **LOCAL_FRONTEND_FEATURE_IMPLEMENTED / USER_WINDOWS_QA_PASS_10_OF_10 (2026-11-09 사용자 보고) / NO_REAL_VIDEO_INFERENCE / NO_G3_CALL / NO_MERGE**.

## 1. 승인과 작업 경계

2026-11-09 사용자는 G2-H1 NASA 후보의 상세 권리·판본 조사를 현시점의 필수 작업으로 간주하지 않고, 기존 G2-G 검수/근거 타임라인 경험을 실제 YOUTOPIA 사용자 기능으로 발전시키는 방향을 승인했다. G2-H1 자료는 삭제하지 않고 연구 보류로 유지한다.

**이번 작업은 기존 frontend 브랜치 또는 운영 서버에 병합하지 않는다.** 실험 브랜치에서 일반 사용자가 직접 선택한 로컬 자료를 브라우저 메모리 안에서 탐색하는 기능만 구현한다.

## 2. 사용자 화면

라우트: `/analysis/youtube/evidence-explorer` (YU-49). AppShell > 분석 > **영상 근거 탐색 · 로컬** 메뉴에 연결한다.

| 화면 구성 | 실제 동작 | 제한 및 출처 표시 |
|---|---|---|
| 영상 선택 영역 | 파일 선택 또는 드래그앤드롭, HTML5 플레이어, 재생/탐색 | 사용자 로컬 비디오만, YouTube URL 자동 다운로드 없음 |
| 자막 | 사용자가 선택한 SRT 파싱, 해당 시각의 자막 표시 | SRT 텍스트는 React가 일반 텍스트로 출력, HTML 실행 안 함 |
| G2-G 판정 JSON | 사용자가 명시적으로 선택한 별도 G2-G 결과에서 APPROVE된 실제 시간 근거만 탐색 카드로 변환 | 운영자 판정 비블라인드이며 Gold 아님, HOLD 문항에 가짜 근거/시간 생성 금지 |
| 근거 타임라인 | 등록된 근거의 시작 시각에 마커, 클릭 시 선택한 영상의 해당 구간으로 이동 | 원본 영상 파일과 판정 JSON의 SHA-256은 현재 브라우저에서 비교하지 않음 |
| 검색·유형 필터 | 질문·근거 관찰 내용으로 검색하고 AUDIO/FRAME/TRANSCRIPT/OCR 필터링 | 실제 조건에 일치한 카드/마커만 표시 |
| 개인 메모 | 현재 영상 시점의 관찰 텍스트와 유형을 선택하고 임시 노트 추가·삭제 | 브라우저 메모리에만 유지, 재로딩하면 사라짐 |
| 상태 초기화 | 입력 선택과 메모를 한 번에 비우기 | A/B/G2-G의 비공개 JSON 원본 변경 없음 |

영상의 자막/코덱은 브라우저 자체가 재생 가능한 형식이어야 한다. 기존 Sintel의 공식 `.mkv` 또는 Tears의 `.mov`는 코덱에 따라 직접 재생되지 않을 수 있으므로 이전에 공식 로컬 자료로부터 만든 **브라우저 호환 MP4 프록시**를 선택할 수 있다. 브라우저에서 사용자가 선택한 비디오와 가져온 G2-G 판정의 원본 SHA-256 일치 여부는 검증되지 않으므로, 판본이 다른 미디어에서 근거 시각을 신뢰할 수 있다고 주장하지 않는다.

## 3. 사용 방법 (Windows 프런트엔드 로컬 개발)

```powershell
$ErrorActionPreference = 'Stop'
cd C:\Projects\YOUTOPIA
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw 'Fetch 실패' }
cd C:\Projects\YOUTOPIA-VIDEO-G2C
if (git status --porcelain) { throw 'Worktree에 로컬 변경 사항이 있음' }
git switch --detach origin/experiment/yu-video-understanding-poc-v01
if ($LASTEXITCODE -ne 0) { throw '갱신 실패' }
cd frontend
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

Vite 개발 서버가 출력한 주소에 `/analysis/youtube/evidence-explorer`를 붙여 접속한다. 선택하지 않은 영상/자막/판정 파일을 자동 탐색하지 않으며, 로컬 파일 절대 경로를 Git 코드에 하드코딩하지 않는다.

**테스트 시나리오:** 지원되는 MP4 파일 선택 → 자막 SRT 선택 → G2-G 사용자 판정 JSON 선택 → 근거 카드/타임라인 → 클릭으로 시점 이동 → FRAME만 필터링 → 내용 검색 → 현재 시점의 개인 메모 추가 → 삭제/전체 비우기. 잘못된 JSON, Gold/G3 허위 승인 값 및 영상 길이 밖의 근거 시각은 거부 또는 이동 차단한다.

## 4. 검증 계약

- 프런트엔드 파서는 G2-G JSON의 프로토콜 버전·영화 종류·6개 질문·승인 플래그·근거 시각을 엄격히 검사한다. 기존 검수자 A/B 원본, 사람 답변, 개인 신원 정보는 자동 취득하지 않는다.
- G2-G `APPROVE`는 사람의 운영자 판정 기록으로 표시하고, 모델 성능/정답 검증 완료라고 표시하지 않는다.
- 빈 화면은 실제로 비어 있다고 표시한다. 합성 샘플 데이터를 실제 영상 분석 결과로 위장하지 않는다.
- 사용자가 선택한 파일을 `fetch`, `XMLHttpRequest`, 백엔드 업로드, 외부 모델 API에 보내는 코드는 없다. 영상 재생 URL은 브라우저 내부 `blob:` URL이고 선택 해제 시 폐기한다.
- 브라우저 UI에서 편집 가능한 데이터는 현재 세션 메모뿐이다. 현재 브라우저 페이지는 자동 Gold 승인, 외부 키 접근, 영상 전체 분석, 댓글 API 호출을 수행하지 않는다.
- React/Vitest 및 TypeScript/Vite CI는 새 실험 브랜치에 한정된 워크플로를 사용한다. 실제 Windows Chrome/Edge 수동 QA와 서비스/프로덕션 통합은 별도 후속 범위다.

## 5. 후속 기능 방향

첫 UI 슬라이스에 대한 실제 QA가 완료된 뒤, **출처 해시 확인 및 등록된 근거 데이터 연결**과 **노드 기반 다중 영상 탐색**을 분리된 단계로 확대할 수 있다. 이를 바로 기존 YOUTOPIA 운영 데이터 수집, YouTube 다운로드, AI 모델 추론 또는 G3 실호출 권한으로 승격하지 않는다.

**현재 게이트:** `G2_H1_RESEARCH_PAUSED / G2_I_LOCAL_EVIDENCE_UI_IMPLEMENTED / G2G_SOURCE_RECORDS_PRESERVED / G3_NO_GO / NO_MERGE`.

## 6. Windows 브라우저 QA 완료 기록 (2026-11-09)

사용자가 직접 Windows Chrome/Edge에서 다음 **10/10 PASS**를 보고했다: 화면 및 사이드바, 로컬 MP4 재생/시크, SRT 동기화, G2-G JSON 로드, APPROVE만 근거 표시·HOLD 제외, 카드·마커 시크, 검색·FRAME 필터, 메모 추가·삭제, 전체 비우기, 반응형 레이아웃. 재현 오류 보고 0건.

이는 **사용자 보고 기반 수동 QA**다. GitHub CI와 별개이고, 원본 해시 일치·독립 Gold·실제 모델 추론·권리·운영 서비스 통합을 검증한 것은 아니다. 다음 G2-J는 [근거 순차 탐색 확장](YU_VIDEO_G2J_EVIDENCE_NAVIGATION_V01.md)으로 분리한다.
