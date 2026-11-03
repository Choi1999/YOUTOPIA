# 실행 중인 기존 서비스 업데이트 검토안

이 문서는 실행 계획이다. ZIP 생성·Git push·격리 검증은 운영 적용이 아니다.
이번 변경은 기존 계정·데이터·control OPEN·관리자·수집기·DB 권한을 보존한다.
설치·계정 생성·control 초기화·완료된 DDL/GRANT/RLS를 반복하지 않는다.
운영 실행 SHA와 운영 키/챗봇 예산 등록 여부는 실제 서버에서 별도 확인한다.

## 전달물과 현재 설정 대조

1. 전달 ZIP의 독립 SHA256, 내부 `SHA256SUMS.txt`, `delivery.json`과 릴리스 manifest를 대조한다.
   `source_sha`는 배포 도구/문서를 포함한 전달 소스, `artifact_build_source_sha`는 실제 JAR/프론트 빌드 소스다.
   둘이 다르면 build input fingerprint와 바이트 해시가 일치하는 근거를 확인한다.
2. 신뢰하는 root 세션에서 현재 릴리스 realpath/manifest, 앱 MainPID/기동 시각, 사용 중인
   EnvironmentFile 경로와 권한을 기록한다. 비밀값·전체 env·인증 헤더는 출력하지 않는다.
3. root0700의 새 백업 경로에 현재 env, 보호된 입력 JSON(존재할 때), unit/drop-in,
   승인 기록과 nginx 관련 설정을 권한을 보존하여 복사한다. 기존 백업은 덮지 않는다.
   백업에 비밀이 있으므로 Git/공개 ZIP에 넣지 않는다. Redis/챗봇 영수증을 과거로 복원하지 않는다.

## 변경 범위와 적용 순서 — 운영 승인 후에만

1. `RESUME.md`와 `MANUAL-TRANSFER.md`에 따라 새 릴리스와 도구를 새 경로에 검증·stage한다.
   기존 릴리스·current는 아직 바꾸지 않는다. 같은 SHA가 있으면 덮어쓰기 대신 대조한다.
2. 챗봇 비활성 배포는 `YOUTOPIA_CHAT_ENABLED=false`로 준비한다. 키 없이 앱은 기동하고
   패널은 점검 중으로 표시한다. 소개 시연 자체에는 DB SQL·새 벡터 DB·검색 파이프라인이 필요 없다.
3. 챗봇 활성화는 `CHATBOT.md`의 다섯 설정을 기존 설정의 새 보호 복사본에만 추가한다.
   앱 키 이름은 `YOUTOPIA_CHAT_OPENAI_API_KEY`다. Codex 환경의 키가 서버에 전달됐다고 가정하지 않는다.
   기존 서버의 키를 보호 편집기로 입력하며 명령 인자·history·브라우저·로그에 넣지 않는다.
   `prepare-runtime-config.py ROOT_ONLY_INPUT.json NEW_OUTPUT.env`로 새0600 파일을 검증한다.
   앱의 기존 DB/Redis/control/HMAC/LEGAL_REVIEW 설정은 유지한다.
4. 기존 budget epoch/file/Redis 키가 있으면 그대로 유지한다. 새로운 예산이 필요한 경우
   최대30회(관리자별 분당3회, 전역 동시1회, 출력300토큰) 추가 등록안을 비용 담당자가 검토한다.
   이는 정확한 달러 상한이 아니다. StateDirectory의 존재·0700·앱 소유권을 확인하고,
   필요 시 `chat-state.conf`만 기존 unit과 대조한다. 전체 unit을 덮지 않는다.
   새 예산 등록은 앱 정지/MainPID0인 승인된 유지보수 구간에 `CHATBOT.md`의 기존 operator로만
   새 epoch/file에 수행한다. 기존 epoch/영수증 삭제·복사·초기화·유실 자동 복구는 금지한다.
5. 보호된 새 설정을 적용하고 승인 marker·릴리스 SHA를 대조한 후
   `activate-release.sh --approved SOURCE_SHA`로 current 전환과 **앱만** 재시작한다.
   nginx 설정을 바꾸지 않는 업데이트에는 nginx/Redis/DB/수집기 재시작이 필요 없다.
   unit drop-in을 변경한 경우에만 daemon-reload가 필요하다.

## HTTPS 수용과 시연

실제 HTTPS 인증서 검증을 켜고 공개 게임 목록·Steam/YouTube 차트·로그인·로그아웃을 확인한다.
데이터 없음/권한 오류/조회 실패를 0으로 보이지 않는지, 데이터 보유 우선 정렬과 로그인 화면의
공개 목록 이동이 유지되는지 확인한다. 기존 수집기 설정·실행·대상은 변경하지 않는다.
현재 작업의 격리 검증 성공을 운영 데이터 연결 완료로 기록하지 않는다.

기존 관리자 로그인 → 일반 `/games` 화면 → 우측 하단 '분석 도우미' → 시연 안내와 고정 질문3개
확인 → 'Youtopia는 어떤 프로젝트인가요?' 1회 선택 → 실제 생성 한국어 응답 확인 순서다.
다른 두 질문은 Steam CCU·영상 게시량을 함께 보는 이유, 분석 모델·RAG 후속 연결 계획이다.
게임·기간은 UI 맥락만 표시한다. 실제 수치·RAG·분석 완료 주장, 전체 YouTube 업로드 수나
인과관계 단정이 없는지 확인한다. 일반 회원·비회원·로그아웃 후에는 호출이 거부되어야 한다.
외부 장애·키 누락·소진·타임아웃은 “현재 점검 중입니다. 잠시 후 다시 이용해 주세요.”로 표시한다.
실패를 성공으로 대체하거나 재시도/다른 모델 호출을 자동 실행하지 않는다.

## 복구

앱 재시작 실패 또는 인증/CSRF/HTTPS/자료 표시 회귀 시 ingress를 기존 승인된 방식으로 제한하고
기록한 검증된 이전 릴리스로 current를 원자적으로 복구한 뒤 앱만 명시적으로 재시작한다.
설정은 이전 릴리스와 호환되는 보호 백업을 대조한다. 챗봇은 필요하면 비활성화하되
키·budget epoch·영수증·Redis 상태를 삭제하거나 과거로 돌리지 않는다.
DB/control 복원·OPEN 재설정·관리자 재생성·권한 역적용은 이 코드 롤백에 포함하지 않는다.
복구 후 같은 HTTPS·로그인·차트 점검을 수행하고 실제 실행 source/build를 기록한다.
