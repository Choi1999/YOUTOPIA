# UI-R04-AQ — 고정 Spring HTTP CI의 Gradle 배포 의존성 복구

## 문제 및 증거
- PR #117 `frontend` 병합 커밋 `ffa5115c37cf719946aae8d764aa0cd1f630a248` 이후 `Frontend and extension validation`의 `UI-R04-AA Vite-to-Spring state HTTP` 작업에서 Gradle 8.14.3 배포 ZIP 다운로드가 세 차례 HTTP 504를 반환하여 **테스트 실행 전** 중단했다.
- 실패 및 재실행: GitHub Actions [#42584246963](https://github.com/Choi1999/YOUTOPIA/actions/runs/42584246963). 같은 커밋의 React 테스트·빌드, 확장 프로그램·공유 계약, UI-R04-AG 테스트는 통과.
- 동일한 시기의 별도 합성 E2E 검증 [#42583214487](https://github.com/Choi1999/YOUTOPIA/actions/runs/42583214487)은 공식 Gradle 8.14.3-jdk21 Docker 이미지를 사용해 전체 Spring `check bootJar`와 실제 Chromium 검증에 성공했다. 이 로그의 Docker 이미지 manifest digest는 `sha256:21bd311ed01360c189b8870c6b6e988199ff10f72d445d02fb39d3cff9da91d7`.

## 최소 수정 범위
- `tools/ci/prepare-r04-pinned-gradle.sh`: 오직 두 개의 과거 고정 합성 Spring 테스트 체크아웃 (`_r04x_backend`, `_r04ag_backend`)만 허용한다. 사전 고정 커밋 SHA, Linux amd64, 기존 Gradle Wrapper 8.14.3 배포 URL 및 원본 `distributionSha256Sum`을 검사한다.
- Gradle CLI를 `docker.io/library/gradle:8.14.3-jdk21@sha256:21bd311...` **불변 digest** 이미지에서 임시 GitHub runner 폴더로 복사한다. 호스트 Temurin Java 21과 `Gradle 8.14.3` 버전을 재검증한다. Docker에서 반환된 일회용 컨테이너 ID만 제거하며 광범위한 `prune`을 하지 않는다.
- `.github/workflows/frontend-validation.yml`: R04-AA와 R04-AG 두 Spring HTTP CI 작업이 검증된 동일 Gradle CLI를 사용한다. 실행하는 테스트 클래스, 합성 fixture, HTTP 응답 계약, 제한된 `127.0.0.1` 서버, 프런트엔드 실행 방식 및 fail-closed 검사는 그대로 유지한다. 기존 고정 소스의 Gradle Wrapper 파일은 덮어쓰지 않는다.
- Docker 이미지 digest는 **컨테이너 이미지의 콘텐츠 무결성 식별자**이고, 원본 `distributionSha256Sum=bd711...`은 Wrapper ZIP의 SHA-256 값이다. 서로 다른 형식의 해시이며 동일하다고 주장하지 않는다.

## 경계 및 검수 게이트
- 코드의 수정을 GitHub Actions와 별도 CI helper, 이 기록에 한정한다. 프런트엔드 화면, Spring 제품 코드, 보안·계정·CSRF·쿠키, 실 YouTube API, `POLICY_HOLD`를 수정하지 않는다.
- 런타임에 운영 계정 또는 API 키를 요구하지 않고, 실패 시 기존 테스트 작업을 건너뛰지 않는다.
- 병합 전 `Frontend and extension validation`의 **4개 job 모두 SUCCESS**, 별도 `G45-L8 Windows Cloud evidence` SUCCESS, React 타입/빌드와 테스트 성공, R04-AA의 실제 Vite ↔ Spring 합성 HTTP 검사, R04-AG의 401/403/503 거부 검사 유지 확인.
- 이 수정은 Gradle 배포 파일의 **공급 경로**만 분리한다. Docker Hub 자체의 가용성/보안 문제는 별도로 존재하며, 해당 경우에도 CI는 중단해야 한다.
- CI가 성공하더라도 실 YouTube API 사용 권한, 운영 DB 접근, 배포 허가를 의미하지 않는다.
