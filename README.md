# YOUTOPIA

YOUTOPIA 프로젝트의 공통 개발 저장소입니다.

프론트엔드와 백엔드가 하나의 저장소에서 협업하되, 각 영역의 책임을 명확하게 분리하고 공통 계약은 `shared` 영역에서 관리합니다.

## Repository Structure

```text
YOUTOPIA/
├─ frontend/        # 프론트엔드 애플리케이션
├─ backend/         # 백엔드 애플리케이션
├─ shared/          # Frontend / Backend 공통 계약 및 공유 리소스
├─ .gitignore
└─ README.md
```

### frontend

사용자 인터페이스 및 클라이언트 애플리케이션을 관리합니다.

주요 책임:

- Figma 기반 UI 구현
- 페이지 및 화면 구성
- 공통 UI 컴포넌트
- 차트 및 데이터 시각화
- 사용자 상호작용
- API Client
- Frontend 상태 관리
- Frontend 테스트

프론트엔드 세부 구조 및 실행 방법은 `frontend/README.md`에서 관리합니다.

### backend

서버 애플리케이션과 데이터 처리를 관리합니다.

주요 책임:

- API 구현
- 비즈니스 로직
- 외부 데이터 수집
- 데이터 가공
- 데이터베이스 연동
- 서버 환경 설정
- Backend 테스트

백엔드 세부 구조 및 실행 방법은 `backend/README.md`에서 관리합니다.

### shared

Frontend와 Backend 사이에서 공유해야 하는 계약을 관리합니다.

예:

- API Contract
- Request / Response Schema
- 공통 데이터 구조
- 공유 Fixture
- 공통 상수 및 명세

`shared`는 특정 영역의 내부 구현을 저장하는 장소가 아닙니다.

Frontend와 Backend 사이에서 명시적으로 공유되어야 하는 항목만 배치합니다.

---

## Development Principles

### 1. Frontend / Backend 책임 분리

Frontend와 Backend의 내부 구현은 각각의 디렉터리에서 독립적으로 관리합니다.

```text
frontend/
backend/
```

한쪽의 내부 구현을 다른 영역에 직접 의존시키지 않습니다.

### 2. 공통 계약 우선

Frontend와 Backend 사이의 데이터 구조가 필요한 경우 각자 별도의 형태를 임의로 정의하기보다 공통 계약을 먼저 합의합니다.

공통 계약은 가능한 경우 `shared/`에서 관리합니다.

### 3. 환경별 비밀정보는 Git에 저장하지 않음

다음과 같은 정보는 저장소에 커밋하지 않습니다.

- API Key
- Access Token
- Password
- Database Credential
- 개인 환경의 `.env`
- 개인 인증서 및 Secret

필요한 환경 변수의 형식만 `.env.example`을 통해 공유합니다.

### 4. 생성 파일은 Git에 저장하지 않음

다음과 같은 파일은 원칙적으로 Git에서 제외합니다.

- Python virtual environment
- `node_modules`
- Build output
- Cache
- IDE 임시 파일
- Log
- 개인 환경 설정 파일

---

## Branch Strategy

기본 브랜치 구조:

```text
main
├─ dev
├─ frontend
└─ backend
```

역할:

- `main`: 안정된 통합 기준
- `dev`: 통합 개발 기준
- `frontend`: 프론트엔드 작업 기준
- `backend`: 백엔드 작업 기준

실제 기능 구현은 기준 브랜치에 직접 작성하기보다 별도의 작업 브랜치를 생성하는 것을 권장합니다.

예:

```text
feat/frontend-app-shell
feat/frontend-game-list
feat/backend-game-api
fix/frontend-chart-tooltip
chore/frontend-bootstrap
```

---

## Git Workflow

### 원격 저장소 받기

```bash
git clone https://github.com/Choi1999/YOUTOPIA.git
cd YOUTOPIA
```

### 원격 브랜치 확인

```bash
git branch -a
```

### Frontend 기준 브랜치 이동

```bash
git switch frontend
git pull origin frontend
```

### 작업 브랜치 생성

```bash
git switch -c feat/frontend-example
```

### 변경사항 확인

```bash
git status
```

### 커밋

```bash
git add .
git commit -m "feat: implement frontend example"
```

### 원격에 작업 브랜치 업로드

```bash
git push -u origin feat/frontend-example
```

이후 GitHub에서 작업 브랜치에서 기준 브랜치로 Pull Request를 생성합니다.

예:

```text
feat/frontend-example
        ↓
     frontend
```

---

## Commit Convention

기본적으로 Conventional Commit 형식을 사용합니다.

```text
<type>: <description>
```

주요 type:

| Type | 용도 |
|---|---|
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 기능 변경 없는 구조 개선 |
| `chore` | 환경, 설정, 저장소 관리 |
| `docs` | 문서 수정 |
| `test` | 테스트 추가 및 수정 |
| `style` | 코드 의미에 영향을 주지 않는 스타일 수정 |

예:

```text
chore: initialize frontend structure
feat: implement game activity page
fix: correct chart tooltip position
docs: update frontend setup guide
```

---

## Local Environment

### Python

Python 가상환경은 로컬에서 생성하고 Git에는 포함하지 않습니다.

Windows:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

가상환경 종료:

```powershell
deactivate
```

### Environment Variables

실제 환경 설정:

```text
.env
```

공유 가능한 환경 변수 형식:

```text
.env.example
```

`.env` 파일은 Git에 커밋하지 않습니다.

### Frontend

Frontend의 Node.js 버전과 패키지 관리자, 설치 및 실행 방법은 `frontend/README.md`에 별도로 정의합니다.

---

## Pull Request

Pull Request에는 최소한 다음 내용을 포함하는 것을 권장합니다.

### Summary

이번 PR의 목적.

### Changes

주요 변경사항.

### Scope

이번 PR에 포함되는 범위와 포함되지 않는 범위.

### Review Points

리뷰어가 중점적으로 확인해야 할 항목.

가능하면 하나의 PR에는 하나의 명확한 목적만 포함합니다.

---

## Current Status

현재 저장소는 Frontend / Backend 협업을 위한 초기 구조를 구성하는 단계입니다.

세부 프레임워크, API 계약 및 기능 구조는 각 영역의 구현이 진행됨에 따라 추가합니다.