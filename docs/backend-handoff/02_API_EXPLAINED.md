# API를 쉽게 읽는 법 — YUTOPIA 백엔드 예시 해설

> **초급 개발자용 · DRAFT / REQUIRES_BACKEND_REVIEW · 실제 API 없음**
>
> 이 문서는 [02_API_CONTRACT.yaml](./02_API_CONTRACT.yaml)에 있는 **API 초안**을 사람이 이해하도록 설명합니다. 주소와 JSON 예시는 **설명용**입니다. 지금 복사해 요청해도 실제 YUTOPIA 서버가 응답하지 않습니다.

[← 처음 읽는 안내서](./00_START_HERE.md) · [데이터 필드 설명](./03_DATA_CONTRACT.md) · [주석이 있는 구현 예시](./07_BEGINNER_IMPLEMENTATION_GUIDE.md)

## 1. API는 무엇인가요?

프론트엔드는 식당 손님처럼 “프로젝트를 만들어 주세요”라고 주문을 보냅니다. 백엔드는 주방처럼 입력값과 권한을 검사하고 작업 결과 또는 실패 이유를 돌려줍니다.

```text
브라우저 → [HTTP 요청] → 서버
브라우저 ← [HTTP 응답] ← 서버
```

예를 들어 `POST /v1/projects`의 각 부분은 다음 의미입니다.

| 부분 | 의미 |
|---|---|
| `POST` | 데이터를 생성하겠다는 **요청 메서드** |
| `/v1` | 제안된 API 버전(1판) |
| `/projects` | 프로젝트라는 자원 |
| Request Body | 요청과 함께 전달하는 JSON 데이터 |
| Response Body | 서버가 답으로 보내는 JSON 데이터 |
| HTTP 201 | 일반적으로 “새로 생성됨”을 나타내는 성공 코드 |

자주 쓰는 HTTP 메서드: `GET`(조회), `POST`(생성/작업 요청), `PATCH`(일부 수정). 실제 운영 API의 메서드와 경로는 관리자·백엔드·프론트엔드 공동 검토로 확정해야 합니다.

## 2. 예시 A — 프로젝트 만들기 (YU-04)

**제안 API**: `POST /v1/projects`. 현재 프론트엔드 [ProjectDraft](../../frontend/src/features/project-demo/ProjectDemoProvider.tsx)의 필드명을 참고했습니다.

**요청 JSON (예시 데이터):**

```json
{
  "projectName": "예시 업데이트 관측",
  "game": "가상의 게임",
  "eventName": "테스트 업데이트",
  "eventDate": "2025-03-25",
  "observationStart": "2025-03-01",
  "observationEnd": "2025-04-08",
  "selectedVideoIds": ["demo-video-1", "demo-video-2", "demo-video-3"],
  "analysisPurpose": "업데이트 전후 반응 관측"
}
```

**서버에서 해야 할 일 (구현 제안):**

1. 로그인한 사용자가 누구인지 서버가 확인합니다. **요청 JSON에 있는 사용자 ID만 믿지 않습니다.**
2. 필수 입력값·날짜·중복 영상·프로젝트 생성 권한을 검사합니다.
3. 사용 가능한 저장소에 프로젝트를 기록합니다(실제 DB 종류는 미결정).
4. 서버가 **새 프로젝트 ID**를 발급하고 성공 응답을 반환합니다.

**성공 응답 예시 — 201 Created:**

```json
{
  "id": "project-example-001",
  "ownerId": "user-example-001",
  "data": {
    "projectName": "예시 업데이트 관측",
    "game": "가상의 게임",
    "eventName": "테스트 업데이트",
    "eventDate": "2025-03-25",
    "observationStart": "2025-03-01",
    "observationEnd": "2025-04-08",
    "selectedVideoIds": ["demo-video-1", "demo-video-2", "demo-video-3"],
    "analysisPurpose": "업데이트 전후 반응 관측"
  },
  "version": 1,
  "createdAt": "2026-10-16T05:00:00Z",
  "updatedAt": "2026-10-16T05:00:00Z"
}
```

위의 `project-example-001` 및 `user-example-001`은 **작성자가 설명을 위해 만든 값**이고, 백엔드가 반드시 사용해야 할 ID 형식이 아닙니다. `ownerId`는 서버의 인증 세션에서 결정해야 합니다. 운영 API가 정말 이 JSON 형태를 사용하는지도 **아직 합의 전**입니다.

## 3. 예시 B — 수집 상태 확인 (YU-05)

오래 걸리는 작업은 버튼을 누를 때 즉시 모든 결과를 반환하기 어렵습니다. 따라서 다음 방식이 **제안**돼 있습니다.

```text
프로젝트가 저장됨
  ↓
POST /v1/projects/{projectId}/collections  (수집 실행 요청)
  ↓
202 Accepted + run ID                   (접수했다는 뜻, 수집 완료 아님)
  ↓
GET /v1/projects/{projectId}/collections/{runId}
  ↓
QUEUED → RUNNING → PARTIAL/FAILED/SUCCEEDED
```

여기서 `{projectId}`, `{runId}`는 실제 값으로 교체하는 **자리표시자**입니다. 예를 들어 `{projectId}`는 `project-example-001` 같은 값입니다.

**아직 집계가 없는 상태 — 예시 응답 (형태는 OpenAPI 후보와 일치):**

```json
{
  "id": "run-example-001",
  "projectId": "project-example-001",
  "status": "QUEUED",
  "attempt": 1,
  "counts": {
    "raw": null,
    "eligible": null,
    "excluded": null
  },
  "createdAt": "2026-10-16T05:01:00Z",
  "retryable": false,
  "version": 1
}
```

**가장 중요한 차이**: `"raw": null`은 **아직 모른다**는 뜻이고, `"raw": 0`은 **정말 0건이라고 확인했다**는 뜻입니다. 데이터가 없다고 해서 `null`을 자동으로 `0`으로 바꾸면 안 됩니다.

`PARTIAL`은 일부 데이터를 받았고 일부는 받지 못했다는 의미입니다. `SUCCEEDED`는 수집 작업의 완료 상태일 뿐, 감성 분류·인간 검토·보고서 승인 완료가 아닙니다.

## 4. 예시 C — 서버 오류 표시하기

요청이 항상 성공하는 것은 아닙니다. 실패했을 때는 **무슨 이유인지** 알려줘야 프론트엔드가 적절한 안내를 표시할 수 있습니다.

**오류 응답 형태 — 서버 미구현 예시:**

```json
{
  "error": {
    "code": "PROJECT_NOT_OWNED",
    "message": "이 프로젝트를 볼 권한이 없습니다.",
    "retryable": false
  },
  "requestId": "req-example-001"
}
```

`PROJECT_NOT_OWNED`는 [04 상태·오류 계약](./04_STATE_AND_ERROR_CONTRACT.md)의 **제안 코드**입니다. 실제 서버에 이미 구현된 오류가 아닙니다.

| HTTP 코드 | 쉬운 뜻 | 화면에서 안내할 행동 |
|---|---|---|
| 200 | 정상 조회 | 데이터를 표시 |
| 201 | 생성 성공 | 생성한 프로젝트로 이동 |
| 202 | 실행 요청 접수 | 진행 상태를 계속 조회 |
| 204 | 처리 성공, 본문 없음 | 로그아웃 등 완료 안내 |
| 401 | 로그인이 안 됐거나 만료됨 | 다시 로그인 |
| 403 | 로그인은 했지만 권한 없음 | 권한 확인/작업 중단 |
| 404 | 요청한 대상 없음 | 경로 또는 대상 확인 |
| 409 | 다른 상태와 충돌 | 최신 상태 확인, 필요하면 재시도 |
| 422 | 입력값이 잘못됨 | 문제 필드 수정 |
| 429 | 너무 많은 요청/할당량 제한 | 안내된 재시도 정책 준수 |
| 503 | 서버/연동 일시 불가 | 중복되지 않게 다시 요청 |

**주의:** 401·403은 서로 다릅니다. `401`은 “누구인지 확인할 수 없음”, `403`은 “누구인지 알지만 이 작업을 허용할 수 없음”입니다. URL에서 다른 사용자의 `projectId`를 입력하는 공격도 서버에서 반드시 막아야 합니다.

## 5. OpenAPI YAML 파일을 읽는 요령

[02_API_CONTRACT.yaml](./02_API_CONTRACT.yaml)은 YAML 1.2에서 허용되는 **JSON 형태**로 작성되어 있어 중괄호와 따옴표가 많습니다. 내용이 많더라도 다음 네 곳만 처음 보면 됩니다.

| 키 | 뜻 | 어디서 확인할까? |
|---|---|---|
| `paths` | API 주소 및 GET/POST 등의 작업 | `"/v1/projects"` 검색 |
| `requestBody` | 요청에 필요한 JSON 형태 | 생성/수정 작업 |
| `responses` | 성공/실패 시 돌려줄 데이터 | `"201"`, `"422"` |
| `components.schemas` | 여러 API가 재사용하는 데이터 정의 | `"ProjectInput"`, `"CollectionRun"` |

각 작업에는 `x-yutopia-status: PROPOSED_NOT_IMPLEMENTED`에 해당하는 상태 표시가 있습니다. **모든 경로가 후보**이며, 실제 서버 주소·인증 방식·배포된 OpenAPI가 없습니다. 문서만 보고 “API 연결 완료”로 보고하면 안 됩니다.

## 6. 어디부터 시작할까요?

**처음 할 일은 API를 한꺼번에 22개 만드는 것이 아닙니다.** 백엔드 담당자와 관리자가 기술 스택·인증·DB·API 계약을 합의한 후, **프로젝트 생성/조회처럼 범위가 작은 한 가지 기능**부터 구현하고 테스트를 통과시키는 방식이 안전합니다.

예를 들어 P0-2 첫 단계의 수용 조건:

- 로그인하지 않은 요청은 **명시적인 접근 거부**.
- 실제로 인증된 사용자의 프로젝트만 생성/조회.
- 잘못된 날짜·영상 중복 입력에는 **구체적인 오류**.
- 동일 프로젝트를 다른 사용자 ID로 조회하면 **차단**.
- 프로젝트 ID는 서버가 발급하며 NEXUS fixture ID를 고정 사용하지 않음.
- 성공과 실패의 JSON이 **승인된 OpenAPI 스키마**와 일치.

도움이 되는 다음 문서: [07 처음 구현하는 방법과 주석 예시](./07_BEGINNER_IMPLEMENTATION_GUIDE.md). 코드를 만들기 전에 API·DB·인증 제공자 결정이 필요한 부분은 **미결정**으로 기록하세요.
