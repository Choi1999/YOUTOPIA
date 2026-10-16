# 백엔드를 처음 구현할 때 — 작업 순서와 한국어 주석 예시

> **초급 개발자용 · DRAFT / REQUIRES_BACKEND_REVIEW · 교육용 코드 예시**
>
> 아래 코드는 읽기 쉬운 **Python 문법으로 작성한 교육 예시**입니다. YUTOPIA가 Python/FastAPI를 선택했다는 뜻이 아니며, 실제 백엔드 저장소에 만들어진 구현도 아닙니다. **그대로 복사해서 운영 서버에 배포하지 마세요.** 인증·DB·API·YouTube 사용권을 먼저 확정해야 합니다.

[← 처음 읽는 안내서](./00_START_HERE.md) · [API 쉬운 설명](./02_API_EXPLAINED.md) · [상세 상태 규칙](./04_STATE_AND_ERROR_CONTRACT.md) · [보안·정책](./05_SECURITY_POLICY_CONTRACT.md)

## 1. 가장 먼저 무엇을 해야 하나요?

**지금 바로 전체 기능을 구현하는 것이 목표는 아닙니다.** 한 번에 하나의 작은 작업을 완료하고 테스트할 수 있도록 준비하세요.

| 순서 | 해야 할 일 | 결과물/확인 방법 |
|---|---|---|
| 1 | [00 안내서](./00_START_HERE.md)와 [01 책임 범위](./01_BACKEND_HANDOFF.md) 읽기 | “프론트엔드에 있는 것 / 백엔드에서 만들어야 하는 것” 구분 |
| 2 | 관리자에게 개발 언어·DB·인증 방식·백엔드 저장소 문의 | 미결정 사항 목록과 담당자 |
| 3 | [02 API 예시](./02_API_EXPLAINED.md)에서 `POST /v1/projects` 흐름 이해 | 요청값, 오류, 성공값 설명 가능 |
| 4 | 승인된 1개 기능의 데이터 모델·검증 로직·에러 규칙 설계 | 작은 API 계약 1개 |
| 5 | **권한 거부와 잘못된 입력 테스트부터 작성** | 실패가 안전하게 처리됨 |
| 6 | 해당 기능을 실제 서버에서 구현하고 테스트 | 요청·응답과 서버 로그 |
| 7 | 코드 리뷰 후 다음 기능으로 이동 | 검증된 커밋/PR |

**주의:** 백엔드 저장소와 기술 스택이 아직 확정되지 않았다면 2번에서 결정할 때까지 실제 서버 코드를 시작하지 않습니다. 반면 문서 읽기와 계약 검토는 진행할 수 있습니다.

## 2. 모든 중요한 함수에는 무엇을 주석으로 적나요?

모든 줄마다 “변수 선언”, “반환”처럼 뻔한 말을 적을 필요는 없습니다. **나중에 코드를 보는 사람이 이유와 위험을 이해할 수 있도록** 적습니다.

함수 위에 다음 질문을 남기세요.

- **목적:** 이 함수가 무엇을 하는가?
- **입력:** 각 인자의 의미와 출처는 무엇인가?
- **반환:** 성공하면 무엇을 돌려주나? `null`은 무슨 뜻인가?
- **실패:** 무슨 조건에서 거부·오류가 발생하나?
- **중요 불변식:** 절대 바뀌면 안 되는 비즈니스 규칙은 무엇인가?
- **근거:** 어느 화면/문서/테스트가 이 기능을 요구하나?
- **미결정:** API·정책·인증 같은 승인 대기 항목은 무엇인가?

주석에는 **실제로 확인된 사실과 가정**을 나눠 적어야 합니다. 예: `# FE_ACTUAL:`(데모 코드에서 확인), `# BE_PROPOSED:`(서버 설계 제안), `# POLICY_HOLD:`(승인 전 기능 중단), `# TODO(DEC-02):`(결정 담당자 필요).

## 3. 코드 예시 A — 수집 댓글 수 검증

이 함수는 어떤 HTTP 서버나 DB와도 연결되지 않는 **단순한 숫자 검사**만 수행합니다. [프론트 fixture](../../frontend/src/features/project-demo/nexusDemoData.ts)의 수치 정의를 이해하기 위한 예시입니다.

```python
def reconcile_comment_counts(
    raw: int | None,
    eligible: int | None,
    excluded: int | None,
) -> bool | None:
    """
    목적:
        동일 수집 실행(run)의 댓글 집계 세 항목이 일치하는지 검사한다.

    인자:
        raw      - 원시 댓글 집계.
        eligible - 분석할 수 있는 댓글 수. 분류 완료를 뜻하지 않는다.
        excluded - 제외되거나 보류된 댓글 수.

    반환:
        True  : raw == eligible + excluded.
        False : 숫자가 확인됐지만 합계가 일치하지 않음.
        None  : 아직 수가 확정되지 않아 검사할 수 없음.

    근거:
        YU-05/06 데이터 정의, 03_DATA_CONTRACT.md.

    주의:
        이 코드는 숫자 일치만 확인한다.
        실제 수집률, YouTube 데이터 사용권, 원문 유효성을 검증하지 않는다.
    """
    # null(None)은 '모름'이라는 뜻이다.
    # 실제 0건으로 치환하면 고객에게 잘못된 결과를 보여줄 수 있다.
    if raw is None or eligible is None or excluded is None:
        return None

    # 음수는 댓글 수로 유효하지 않으므로 오류로 처리한다.
    if raw < 0 or eligible < 0 or excluded < 0:
        raise ValueError("NEGATIVE_COUNT")

    # 같은 run과 같은 범위에서 집계됐다는 검사는
    # 호출한 서버 서비스가 별도로 수행해야 한다.
    return raw == eligible + excluded


# 아래 숫자는 합성 DEMO fixture이며 실제 YouTube 데이터가 아니다.
assert reconcile_comment_counts(12842, 10204, 2638) is True
assert reconcile_comment_counts(None, None, None) is None
assert reconcile_comment_counts(100, 80, 15) is False
```

**왜 이런 주석이 필요한가요?** 단순히 `raw = eligible + excluded`라고 쓰면 다음 개발자가 `eligible`을 ‘감성 분류 완료’로 착각할 수 있습니다. 이 경우 보고서와 실제 분석 통계의 분모가 달라집니다.

## 4. 코드 예시 B — 검토 업무 완료와 주장 검증을 분리

아래 함수는 **명확히 위험한 상황을 거부**하는 개념 예시입니다. 운영 서비스에서는 이 외에도 인증된 검토자, 증거 권리·무결성·버전·기술 검증이 필요합니다.

```python
def may_use_claim_as_verified(
    task_status: str,
    claim_status: str,
    has_synthetic_source: bool,
    source_policy_approved: bool,
    independently_verified: bool,
) -> bool:
    """
    목적:
        단순 작업 완료를 '실제 검증된 주장'으로 잘못 승격하지 않는다.

    반환:
        True  : 아래의 예시 차단 조건을 모두 통과함.
        False : 실제 검증된 주장으로 사용할 수 없음.

    중요:
        이 함수가 True를 반환하더라도
        실제 서버의 모든 법적·기술적 승인 절차가 끝난 것은 아니다.
        서비스용 승인 함수로 그대로 사용 금지.
    """
    # Task COMPLETED는 담당자의 업무 상태일 뿐,
    # Claim VERIFIED나 보고서 공식 승인이 아니다.
    # 따라서 task_status만으로 승인을 결정하지 않는다.
    _ = task_status

    # HOLD는 근거 부족으로 결론을 내릴 수 없는 상태다.
    if claim_status in {"HOLD", "BLOCKED", "CONDITIONAL", "OBSERVED_ONLY"}:
        return False

    # 테스트용 합성 댓글은 실제 원문 증거가 될 수 없다.
    if has_synthetic_source:
        return False

    # 데이터 사용권·전송/파생 권한이 미승인이라면 중단한다.
    if not source_policy_approved:
        return False

    # 검증 절차를 독립적으로 확인하지 않았다면 중단한다.
    if not independently_verified:
        return False

    # FE에는 검증된 Claim 상태가 없으므로
    # 실제 허용 전이·권한을 관리자와 합의하기 전에는
    # 위 조건을 통과하더라도 운영 승인으로 사용하면 안 된다.
    return False  # POLICY_HOLD: 정식 검증 승인 워크플로 미구현


assert may_use_claim_as_verified(
    task_status="COMPLETED",
    claim_status="HOLD",
    has_synthetic_source=True,
    source_policy_approved=False,
    independently_verified=False,
) is False
```

**중요:** `PERF-001`, `PAY-002`는 현재 데모의 이슈 식별자입니다. 실제 백엔드의 일반 정책을 `if issue_id == "PAY-002"`처럼 **데모 ID에 하드코딩하면 안 됩니다**. 서버는 승인된 판정 상태와 정책 규칙으로 판단해야 합니다.

## 5. 코드 예시 C — API의 주석 구조(실제 미구현)

현재 백엔드 인증·DB가 없으므로 아래 코드는 **안전하게 미구현 오류를 내는 예시**입니다.

```python
def create_project_request(request_data: dict, authenticated_actor: object):
    """
    기능: YU-04 프로젝트 생성 API 핸들러의 책임 예시

    요청:
        projectName, game, eventDate, selectedVideoIds 등.
        필드 정의는 03_DATA_CONTRACT.md, 02_API_CONTRACT.yaml을 참조.

    정상 응답(제안):
        서버 발급 project ID와 ownerId, createdAt 등.

    실패(제안):
        401 - 인증되지 않은 요청
        403 - 조직/프로젝트 생성 권한 없음
        422 - 날짜/영상 선택/필수값 검증 실패
        409 - 중복 제출 또는 동시성 충돌

    보안:
        요청 본문에 들어온 ownerId를 신뢰하지 않는다.
        인증된 서버 세션에서 사용자/조직 ID를 얻어야 한다.

    TODO(DEC-02):
        인증 제공자와 세션 검증 방법 확정 필요.
    TODO(DEC-05):
        프로젝트 DB 및 멱등성 계약 확정 필요.

    상태:
        BE_PROPOSED / NOT IMPLEMENTED
    """
    # 서버 사용자·소유권 검증이 확정되지 않아
    # 이 함수를 호출해도 프로젝트가 생성되면 안 된다.
    raise NotImplementedError("AUTH_AND_PROJECT_CONTRACT_NOT_APPROVED")
```

실제 구현할 때는 긴 한 함수로 모든 동작을 처리하지 말고 요청 처리(API handler), 권한 검증(authorization), 입력 검증(validation), 데이터 처리(service), 저장(repository)을 필요에 따라 분리하세요. 이 구조도 **설계 제안**이며 언어/프레임워크 확정 후 정합니다.

## 6. 테스트할 때는 성공뿐 아니라 실패부터

| 기능 | 최소 부정 테스트 | 기대 결과 |
|---|---|---|
| 프로젝트 생성 | 미로그인 사용자 요청 | 저장하지 않음, 인증 오류 |
| 프로젝트 조회 | 다른 소유자의 project ID | 권한 오류, 정보 노출 없음 |
| 댓글 합계 | `raw=100, eligible=80, excluded=15` | 검증 실패 |
| 부분 수집 | `raw=null` | 0으로 바꾸지 않음 |
| 근거 검토 | `SYNTHETIC`을 실제 검증으로 승격 요청 | 거부 |
| 이슈 업무 | `VIEWER`가 상태 수정 | 거부 |
| 보고서 | 정책 미승인인데 외부 AI 호출 | 외부 요청 0건 |
| 재시도 | 같은 작업을 여러 번 연속 요청 | 중복 실행 방지(정책·구현 합의 후) |

테스트의 결과를 `SIMULATED`, `LOCAL_BROWSER_E2E`, `PROVIDER_CONTRACT`, `PRODUCTION_INTEGRATION`으로 구별하세요. 프론트엔드의 92/92 테스트 통과를 실제 백엔드 API 통과로 해석하면 안 됩니다.

## 7. PR 코드 리뷰에서 확인할 질문

- 주석이 “무엇을 한다”뿐 아니라 **왜 반드시 이렇게 해야 하는지** 설명하는가?
- 중요한 함수를 읽으면 입력·반환·실패·권한·정책 제한을 이해할 수 있는가?
- `null`과 실제 `0`을 혼동하지 않았는가?
- 사용자의 ID와 역할을 클라이언트 문자열로 믿지 않는가?
- 테스트용 NEXUS 수치·합성 댓글·데모 계정을 운영 코드에 하드코딩하지 않았는가?
- 데이터 수집 성공과 감성 분류 완료를 구분하는가?
- Kanban 업무 완료가 주장 검증이나 보고서 승인으로 자동 승격되지 않는가?
- 실제 YouTube/G01 사용권·보관/삭제 정책과 외부 모델 전송 권한이 미승인일 때 **실행을 차단**하는가?
- 예외 상황, 악의적 입력, 로그의 민감정보가 테스트됐는가?
- 관리자/백엔드/프론트가 합의하지 않은 기술 결정을 “완료”라고 쓰지 않았는가?

**개발자와 리뷰어를 위한 핵심 규칙:** 주석은 코드의 실행을 대신하지 않으며, 코드가 실제로 하지 않는 기능을 한다고 주장해서도 안 됩니다. 특히 `TODO`는 완료 증거가 아닙니다.
