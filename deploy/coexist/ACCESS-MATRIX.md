# 현재 접근 정책과 테스트 등급 경계

현재 소스·API·저장 스키마에 있는 계정 종류는 USER와 ADMIN이다.
유료/무료/상위 테스트 등급의 명칭·상품·기간·허용 기능이 확정된 명세는 이 저장소에 없다.
임의 등급 모델이나 추가 권한을 이번 작업에서 만들지 않는다.

| 주체 | 공개 게임·차트 GET | 개인 설정 | 관리자 조회 | 화면/서버 근거 |
|---|---|---|---|---|
| 비회원 | 허용 | 로그인 필요/401 | 관리자 로그인 필요/401 | PublicAccess·실제 guest API/브라우저 |
| 일반 USER | 허용 | 본인 범위 | 접근 거부/403 | Guard/AdminGuard·SecurityConfiguration |
| ADMIN | 허용 | USER 설정 거부/403 | 마스킹 회원·이용 현황 허용 | 별도 auth realm·ADMIN 역할 |
| `TEST_UPPER` 주장 | 일반 USER와 동일 | 일반 USER와 동일 | 거부 | 합성 위조 시험용 표기일 뿐 실제 회원 등급 아님 |

`TEST_UPPER`는 테스트 JSON/localStorage/header에서 위조한 입력이다. signup의
미정의 grade/role 필드는400이고, header/localStorage를 바꿔도 서버 identity는
USER다. AdminGuard의 화면 거부와 관리자 API의403을 함께 검증한다.
이 결과를 “상위 등급제가 구현됐다”로 보고하지 않는다.

등급 배정/변경/만료, 등급별 서버 기능 제한·쿼터, 관리 UI, 등급 안내 화면은 미구현이다.
현재 UI에는 등급 선택/표시가 없고 관리자라는 화면 표시는 실제 ADMIN identity에서만 나온다.
추후 확정 권한표가 있어야 서버 모델·정책·UI 안내를 함께 추가할 수 있다.
비회원 공개 관측 GET 정책과 관리자 권한 분리는 등급 기능 추가 여부와 별개로 유지한다.
