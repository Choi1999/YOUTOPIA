# UI-R04-V — Windows 네이티브 Java 백엔드: 운영용 키 등록·교체·삭제 경계 설계와 합성 QA

작성·검수 기준: 2026-11-05 KST  
부모: Draft PR #85 @ 8bb9fd67a0517daecade79dbc72538d01de5adb8

## 1. 목표와 엄격한 승인 경계

- 개발 환경: Windows PC에서 Java 21/Spring Boot를 직접 실행.
- 사용자 보고 기준: PC 공인 외부 IP와 기존 Google Cloud API 키의 IP 제한 일치·재연결 후 안정적. **실제 Java 프로세스의 출구 IP와 Cloud 현재 Quota를 독립 검증했다는 뜻은 아님.**
- 이번 승인: 운영 후보 저장 경로, 실행 계정 및 NTFS ACL 설계/읽기 전용 검수와 **합성 키** 등록·교체·삭제·같은 사용자 재오픈 테스트.
- 미포함: **실제 YouTube API 키 입력/저장/읽기, 실제 운영 보관소 생성·변경, Google Cloud CLI/YouTube API 요청, 프로덕션 서비스 연결, 정책 해제, 병합, 배포.**

## 2. 새 코드와 검증 대상

| 위치 | 정확한 동작 |
|---|---|
| src/main/java/com/youtopia/youtube/metadata/WindowsMetadataCredentialPathPreflight.java | Windows LOCALAPPDATA의 운영 후보 폴더를 읽기 전용 검사, 소유자·ACL·링크/재분석 지점을 점검하고 **실제 경로·계정 출력 금지** |
| src/main/java/com/youtopia/youtube/metadata/WindowsSyntheticEnrollmentSession.java | 기존 PR #85 합성 DPAPI 저장소에서만 임시 티켓을 사용해 등록·교체·삭제 모의 실행 |
| src/test/java/com/youtopia/youtube/metadata/WindowsMetadataCredentialPathPreflightTest.java | 운영 폴더 미생성, 비밀·경로 비노출 및 정책 승인 차단 |
| src/test/java/com/youtopia/youtube/metadata/WindowsSyntheticEnrollmentSessionTest.java | 합성 키 등록·회전·삭제·다시 열기·티켓 재사용/다른 세션 사용·실제 키 형태 입력 차단 |
| .github/workflows/ui-r04t-windows-dpapi-offline.yml 및 ui-r04q-offline-metadata-bridge.yml | 기존 Windows native DPAPI 및 Linux Java 21 오프라인 워크플로에 신규 테스트 포함 |

## 3. 향후 운영 보관소의 위치·실행 계정 설계

운영 후보 경로(설계용, **현재 파일 생성 0건**):
- Windows 사용자의 LocalAppData 폴더 아래 YOUTOPIA/security/youtube-metadata
- 암호문 파일 이름: youtube-data-v3.dpapi

운영 구현 전 보완사항:

1. **신뢰 가능한 Known Folder 경로**를 Windows OS API로 확인해야 한다. 이번 Preview는 환경변수 LOCALAPPDATA를 사용하므로 권한 있는 사용자가 조작할 수 있는 **후보 관찰값**일 뿐 정본 저장 경로의 권한 검증/설치 승인 증거가 아니다.
2. 같은 Windows 로그인 주체가 실행하는 Java 프로세스·키 등록 도구에서 동일 CurrentUser DPAPI 계정으로 암호화/복호화해야 한다. Windows 서비스 계정 전환 시 SID·프로필·백업 및 키 재등록 계획 재검수.
3. 실제 첫 생성 시 디렉터리 선점, 경로 symlink/junction/reparse point, NTFS ACL 상속·TOCTOU 경쟁을 막는 **원자적 초기 ACL 생성**이 필요. 기존 PR #85의 합성 전용 임시 폴더와 이 Preview만으로 운영 보안 승인 불가.
4. 소유자와 암호문 파일의 ACL은 접근 권한 없는 계정의 ALLOW를 거부한다. 같은 사용자 계정이 이미 침해됐거나 OS 관리자에게 보호된다고 주장하지 않는다.
5. 파일/DPAPI 지원 불가, ACL 불명확, 비정상적인 네트워크/프로필 경로, 동적 IP/실행 계정 불일치는 즉시 실패. 평문 파일·환경변수 키·LocalMachine DPAPI로 자동 폴백 금지.
6. 운영 보관소가 아직 없는 경우 VAULT_LOCATION_NOT_PROVISIONED는 **정상적인 보류 상태**이다. 검사기가 비밀을 자동 등록하거나 폴더를 생성하지 않는다.

## 4. 로컬 운영자 자격증명 등록 인터페이스 계약 (이번 PR은 설계만)

예상 절차:

- PRECHECK: 운영자/실제 Java 실행 계정·Known Folder 위치·ACL·파일 생성 경계·Cloud 프로젝트/키 제한/출구 IP/Quota 독립 확인.
- OPERATOR CONSENT: 로컬 사용자 신원·작업 대상·메타데이터 전용 권한·변경 목적을 인증된 운영 경로에서 승인. 명령줄 인수, 웹 요청 헤더, 자체 승인 Boolean은 근거가 아님.
- SECURE INPUT: 앞으로 별도 승인받을 Windows 보안 UI를 통한 입력. 셸 기록, 클립보드, 명령줄, 표준 출력, 로그, GitHub, 브라우저, .env에 실제 키 원문 입력 금지.
- PROTECT: 현재 사용자 DPAPI 암호화, 확정 ACL, 백업·회전·유출 대응, 복호화 바이트의 짧은 생명주기.
- ROTATE: 신규 키를 먼저 안전한 별도 슬롯에 봉인하고 확인 후 원자적 전환. 중간 실패 시 기존 키 무조건 사용이나 미승인 외부 호출을 하지 않는다. Google Cloud에서 이전 키 폐기는 별도 운영 절차.
- DELETE: 지정 키의 암호문 파일 제거, 메모리/캐시 경계·비밀 복제본 검토. 파일 삭제가 SSD/백업의 물리적 보안 삭제 또는 DPAPI 마스터키 폐기는 아니다.
- RECOVER: **동일 Windows 사용자/컴퓨터**의 암호문 재오픈은 일부 검증 가능. 프로필 상실·관리자 암호 재설정·다른 PC의 운영 복구는 새 키 재발급/재등록 검수 필요. LocalMachine·평문 폴백 금지.
- AUDIT: 비밀이 아닌 실행자·시각·행위·정책 개정·결과 코드만 영속 기록. 비밀 원문, 전체 URL, 토큰, 프로젝트 민감 값, 계정 이름, 현재 IP, 원시 오류 메시지를 일반 로그에 쓰지 않는다.

**운영 UI/실제 키 등록 코드, 영속적 정책 원장·다중 프로세스 락은 아직 구현하지 않았다.**

## 5. 이번 합성 등록·교체·삭제 코드

- WindowsSyntheticEnrollmentSession의 티켓은 Java 인스턴스에만 속하며 단 한 번만 사용된다. 등록은 빈 보관소에만, 교체·삭제는 기존 합성값이 있을 때만 허용된다.
- 다른 세션에서 생성한 티켓, 이미 소비한 티켓, 변경 이후의 오래된 revision은 거부한다. 실패한 티켓도 재사용할 수 없다.
- 쓰기·복호화는 PR #85의 **R04U_SYNTHETIC_UUID 합성 마커만 허용**하는 DPAPI 저장소를 통해 실행한다. 일반/실제 API 키와 운영용 경로는 들어올 수 없다.
- 삭제 후 재열기는 실패하며, 같은 계정 재열기 성공은 실제 운영 복구·다른 사용자·다중 프로세스 경쟁·완전한 키 폐기를 증명하지 않는다.
- 모든 스냅샷에 POLICY_HOLD, realCredentialAdmitted=false, firstLiveMetadataCallAuthorized=false, externalRequestsMade=false를 유지한다.
- 운영 폴더의 Preview는 readonly이다. 경로·사용자명·프로젝트나 키 문자열을 결과에 포함하지 않는다.

## 6. QA 수용조건과 다음 단계

Windows CI 및 사용자 PC 로컬에서: Java 21 컴파일, 신뢰되지 않은 LocalAppData 경로의 안전한 읽기 전용 판정, 합성 키 등록/교체/삭제/재오픈, 잘못된 티켓·실제키 형태 거부, 기존 PR #84/#85 및 Spring 보안/격리 DB 회귀 없음.

수동 QA 명령(새 PR 기준 별도 worktree 생성 후):
~~~powershell
cd C:\Projects\YOUTOPIA-R04V-QA
.\gradlew.bat --no-daemon test --tests "com.youtopia.youtube.metadata.WindowsMetadataCredentialPathPreflightTest" --tests "com.youtopia.youtube.metadata.WindowsSyntheticEnrollmentSessionTest"
~~~

**현재 사용자 PC 수동 QA는 별도 사용자 로그를 받기 전까지 PASS로 기록하지 않는다.** API 키·IP·Windows 계정·암호문을 채팅/PR에 공유할 필요 없다.

추후 별도 승인으로 실제 Windows 보안 입력 UI·운영용 저장소 생성과 ACL·계정 변경/키 회전·복구·사용자/관리자 인가·JNA 공급망, Google Cloud 키/현재 quota/정책 M01~M10 독립 검수, 서버별 외부 IP 및 최초 공식 videos.list 1회 실행 계약을 검토한다. 첫 실 API 호출, 정책 Gate 해제, 병합·배포는 별도 승인.

공식 참조:
- https://learn.microsoft.com/en-us/windows/desktop/api/Dpapi/nf-dpapi-cryptprotectdata
- https://learn.microsoft.com/en-us/windows/win32/secbp/handling-passwords
- https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/attribute/AclFileAttributeView.html

**상태 (CI 검수 전): OPERATIONAL_LOCATION_PREVIEW_ONLY / SYNTHETIC_ENROLLMENT_ONLY / REAL_KEY_OFF / YOUTUBE_LIVE_0.**
