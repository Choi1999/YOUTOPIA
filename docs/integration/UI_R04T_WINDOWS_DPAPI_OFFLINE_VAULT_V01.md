# UI-R04-T — Windows 직접 실행 DPAPI 합성 보호 저장소 준비·QA (2026-11-05)

## 1. 범위와 사실

- 실행 환경: Windows PC 직접 Java 21 / Spring Boot 4.0.9 실행 (사용자 선택).
- 사용자 보고: Google Cloud API 키 허용 IP와 PC 외부 IP가 일치하며 재연결 후에도 동일. 이는 독립 검증/Java 프로세스 출구 IP 검증과 다르며, 실제 IP·API 키는 저장하거나 요구하지 않는다.
- 백엔드 부모: Draft PR #83, HEAD 6de7e54fb0e3b78cd19a23591d8bf800af35596f. frontend/Node 메타데이터 계약 PR #79~80은 별도 미병합 스택.
- 목표: CurrentUser 범위 Windows DPAPI의 합성 데이터 보호·복호화 시험 및 안전한 Java 상태검사 연계.
- **이번 PR에는 운영 API 키 보관/읽기/호출, Google Cloud 접근, 서비스 배포, HTTPS transport, Spring Bean 등록, API 엔드포인트, 병합 또는 기존 POLICY_HOLD 변경이 없다.**

## 2. 산출물

| 경로 | 기능 |
|---|---|
| tools/ui-r04t-windows-dpapi-vault.ps1 | -Check: 읽기 전용 플랫폼 검사. -SelfTest: 합성 마커 CurrentUser DPAPI 왕복 검증 |
| src/main/java/com/youtopia/youtube/metadata/WindowsDpapiVaultReadiness.java | 비밀 제외 JSON 보고서 정규화·검증만 수행 |
| src/test/java/com/youtopia/youtube/metadata/WindowsDpapiVaultReadinessTest.java | 위조/추가 정보/승인 플래그/잘못된 입력/일관성 검증 |
| .github/workflows/ui-r04t-windows-dpapi-offline.yml | Windows runner에서 DPAPI 합성 시험, 임시 암호문 삭제 확인, Java 21 테스트 |
| .github/workflows/ui-r04q-offline-metadata-bridge.yml | 기존 Java 21 오프라인 계약에 새 JUnit 검사 포함 |

## 3. 실제 DPAPI 테스트의 범위

- Windows PowerShell 7 이상 필요. Windows의 ConvertFrom-SecureString은 별도 키를 지정하지 않을 때 현재 사용자 범위 DPAPI를 사용한다.
- -Check는 Windows/PS7 조건만 검사하고 파일·DPAPI·Cloud·YouTube API·키를 전혀 건드리지 않는다.
- -SelfTest는 임의의 **합성 문자열**만 만들고, CurrentUser DPAPI 암호문만 무작위 이름의 사용자 TEMP 파일로 CreateNew 저장 후 읽어 복호화하여 비교한다. 임시 파일은 종료 시 삭제한다. 실제 API 키·운영 비밀·사용자 입력은 받지 않는다.
- 민감 정보는 stdout/stderr로 출력하지 않는다. 결과 JSON만 표시한다. 합성 BSTR 버퍼는 ZeroFreeBSTR로 해제한다. 임시 암호문 파일 삭제는 디스크 보안 삭제 증거가 아니므로 **운영 키를 이 경로로 저장해서는 안 된다.**
- Windows 사용자 프로필 계정이 달라지면 CurrentUser DPAPI 암호를 자동으로 복원할 수 없다. 실제 Java 백엔드 실행 계정/서비스 권한과 파일 ACL을 후속 별도 검수해야 한다.
- 현재 Windows 테스트가 성공하더라도 비밀 보관소 프로비저닝이나 운영 Credential 접근을 구현한 것이 아니다.

참조: https://learn.microsoft.com/powershell/module/microsoft.powershell.security/convertfrom-securestring , https://learn.microsoft.com/dotnet/api/system.security.cryptography.protecteddata , https://learn.microsoft.com/windows/win32/secbp/handling-passwords

## 4. Java 상태검사 제한

- WindowsDpapiVaultReadiness.inspect(byte[])는 최대 4KiB JSON, 고정 schema·CURRENT_USER·POLICY_HOLD·키 제한/실호출 false 및 추가 필드 금지.
- 동일한 JSON은 임의 사용자가 위조할 수 있으므로 Java 검증 성공만으로 Windows OS/DPAPI/실제 API 키 보관 상태를 **독립 인증한 것이 아니다**. Java 결과에는 observedReportAuthenticated=false, actualCredentialsRead=false, liveMetadataAuthorized=false가 고정된다.
- Java는 PowerShell을 호출하지 않고 비밀 파일·credential을 열지 않으며, 유저 API 메타데이터를 조회하거나 승인하지 않는다. Windows CI가 진짜 합성 DPAPI 왕복을 수행하는 별도 증거다.
- 기존 Source/Metadata POLICY_HOLD, liveCallsAuthorized=false, first-call RELEASED_LOCK은 불변이다.

## 5. 사용자가 실행할 오프라인 QA (비밀·API 키 불필요)

Java 21 / PowerShell 7 설치된 Windows PC에서, PR의 정확한 HEAD에 생성한 별도 worktree 루트 기준:

~~~powershell
pwsh -NoProfile -File .\tools\ui-r04t-windows-dpapi-vault.ps1 -Check
pwsh -NoProfile -File .\tools\ui-r04t-windows-dpapi-vault.ps1 -SelfTest
.\gradlew.bat --no-daemon test --tests 'com.youtopia.youtube.metadata.WindowsDpapiVaultReadinessTest'
~~~

기대 결과:
- Check = OFFLINE_PLATFORM_READY_NOT_AUTHORIZED, actualCredentialsProvisioned=false
- SelfTest = SYNTHETIC_DPAPI_ROUNDTRIP_PASS, temporaryCipherFileRemoved=true
- 양쪽 모두 firstLiveMetadataReadAuthorized=false, cloudCliInvoked=false, externalRequestsMade=0
- JUnit PASS. 수동 QA PASS는 사용자가 실제 보고한 뒤 별도로 기록한다.

**API 키 문자열, IP, 토큰, PowerShell 실행 계정과 암호문 원문은 채팅/PR/로그에 공유하지 않는다.**

## 6. 다음 승인 대상

현재 Java 백엔드에는 운영 DPAPI 키 읽기 또는 secret→YouTube 전송 경로가 없다. 향후 별도 보안 PR에서 보호 저장소 프로비저닝(사용자·서비스 계정 동일성, ACL, 로테이션·유출 대응), 안전한 Java memory path, 실제 서버 외부 IP·키 제한 대조, durable quota, 제한된 HTTPS, 서버 측 source trust, 캐시/삭제, metadata-only 이용 승인과 최초 1회 조회 실행 계약을 구현해야 한다.

이때 첫 실제 videos.list(part=snippet) 요청 1회·예상 1 quota unit·재시도 0회·정확한 대상·운영자·실패 중단 정책을 따로 승인받아야 한다. 기존 댓글/감성 게이트와 반드시 분리한다.

**현재 상태: WINDOWS_DPAPI_SYNTHETIC_ONLY / ACTUAL_CREDENTIAL_READ_OFF / YOUTUBE_LIVE_0 / UNMERGED.**
