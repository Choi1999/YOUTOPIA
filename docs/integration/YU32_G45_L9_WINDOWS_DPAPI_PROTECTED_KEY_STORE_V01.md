# YOUTOPIA — G45-L9 Windows DPAPI 개발용 API 키 보호 저장소 v0.1

> 기준: 2026-11-03 KST
> 범위: Windows 개발·시험 환경에서 **사용자 본인이 이미 발급한 개발용 API 키를 안전하게 등록·확인·삭제**
> 정책: **POLICY_HOLD / VERIFIED 0/12 / LIVE YouTube API 0 / REAL SENTIMENT 0 / 원문 API 호출 0**
> 운영 서버의 키는 별도 발급·별도 보호 저장소·별도 검수. 개발 키를 운영 서버로 복사하지 않는다.

## 1. 사용자 요청 및 설계

Google Cloud Console에서 개발용 API 키 발급과 YouTube Data API v3 제한, Windows 공인 IP 제한을 설정했다고 사용자에게 확인받았다. 다만 E03의 현재 출구 IP 대조·저장·회전, E01 소유권 및 E05/E07/E08/E11은 **정본 증거상 미검증**이다.

이번 작업은 실제 키를 GitHub·채팅·소스 코드·환경 변수 파일에 보관하지 않도록 **Windows DPAPI(CurrentUser)** 저장소 도구를 구현하는 범위다. Windows PowerShell의 `ConvertFrom-SecureString`에 `-Key`/`-SecureKey`를 지정하지 않으면 Windows DPAPI를 사용하여 사용자 범위 암호화 문자열을 생성한다. `ConvertTo-SecureString`으로 동일한 사용자 컨텍스트에서만 복원한다.

**중요: DPAPI 보안 저장소 자체는 실수집·키 사용 승인이 아니다.** G45-L7 `RELEASED_FOR_FIRST_REAL_CALL=false`와 `policy-gates.json`은 변경하지 않는다.

## 2. 구현 파일과 키 저장 위치

- `shared/contracts/yu32-youtube-readiness-v0/scripts/g45-l9-windows-dpapi-vault.ps1` — 실제 Windows 사용자 로컬에서만 실행되는 키 등록·상태·무출력 검증·로컬 삭제.
- `shared/contracts/yu32-youtube-readiness-v0/tests/g45-l9-windows-dpapi-vault.test.cjs` — 보안 및 정책 정적 회귀 테스트 14개.
- `.github/workflows/g45-l9-windows-dpapi-vault-validation.yml` — Windows 러너의 **합성 가짜 키**로 DPAPI/ACL 암복호화 왕복 테스트; 실제 Google·YouTube·사용자 키 접근 없음.
- `.gitignore` — 잘못 생성된 `*.dpapi` 및 관련 파일을 Git에서 제외하도록 보완.
- Windows 로컬 저장 경로는 **`%LOCALAPPDATA%\YOUTOPIA\Secrets\youtube-dev.dpapi`**, 저장소 `C:\Projects\YOUTOPIA` **외부**.
- `Secrets` 디렉터리 및 파일에 상속 차단 ACL을 적용하고 현재 Windows 사용자, 로컬 SYSTEM, Administrators 그룹만 명시적으로 허용한다. 디렉터리와 저장 대상에서 reparse point/junction을 거부하며 기존 저장 파일은 덮어쓰지 않는다.

등록은 `Read-Host -AsSecureString` 프롬프트만 허용한다. 키 문자열을 PowerShell 명령 인자, 환경 변수, 로그 또는 이 채팅에 넣지 않는다. 암호문은 임시 파일에 기록해 ACL을 제한한 뒤 최종 파일로 이동한다. `-Status`는 복호화 없이 상태와 ACL만 검사하고, `-Verify`는 동일 사용자에서 DPAPI를 복호화하여 길이만 검사한 후 `SecureString.Dispose()`한다. **어느 기능도 평문이나 암호문을 화면/파일로 출력하지 않는다.**

## 3. 병합 및 로컬 동기화 후 사용자 작업 순서

**PR이 별도 검수·병합되고 로컬 frontend가 동기화된 다음에만** 아래 명령을 실행한다.

```powershell
cd C:\Projects\YOUTOPIA
$ErrorActionPreference = "Stop"
$vault = ".\shared\contracts\yu32-youtube-readiness-v0\scripts\g45-l9-windows-dpapi-vault.ps1"

# 1. 키가 저장되어 있는지 여부만 확인 (복호화하지 않음)
& $vault -Status

# 2. 실제 개발용 키 등록: 화면에 보이지 않는 프롬프트에 로컬 입력
& $vault -Enroll

# 3. 같은 Windows 사용자로 복호화할 수 있는지 확인 (키 미출력)
& $vault -Verify

# 4. 확인 결과만 출력, 키·공인 IP·프로젝트 ID는 업로드 금지
& $vault -Status
```

`-Enroll`을 실행하면 Windows PowerShell에서 개발용 API 키를 **한 번만** 비밀 프롬프트에 붙여넣고 Enter를 누른다. 일반 명령행에 평문으로 넣으면 안 된다. 저장된 키가 이미 있으면 덮어쓰지 않고 실패한다.

상태 예시: `VAULT_NOT_ENROLLED` → `DEV_KEY_ENROLLED_DPAPI` → `DEV_KEY_DECRYPTED_LOCALLY_NO_OUTPUT` → `VAULT_PRESENT_NO_DECRYPT`. 출력 JSON의 `secretPrinted=false`는 스크립트 출력에 키를 표시하지 않았다는 뜻이지, 악성 소프트웨어/메모리 덤프로부터 절대 안전하다는 의미가 아니다.

**로컬 저장본 삭제(필요한 경우에만):**

```powershell
& $vault -Remove
# 프롬프트에서 정확히 REMOVE 입력해야 로컬 암호화 파일만 삭제
```

이 삭제는 Google Cloud에서 키 폐기/revoke를 수행하지 않는다. 유출·폐기 시 Google Cloud Console에서 해당 키를 비활성화/삭제하고 필요한 경우 새 제한 키로 교체해야 한다.

## 4. 허용된 실행 경계

| 경계 | 현재 |
|---|---|
| 실제 Windows 개발용 키를 사용자 계정 DPAPI 파일에 저장 | **스크립트 구현**. 사용자 PC의 실제 등록은 아직 실행·검증되지 않음 |
| 상태/ACL 검증 | 구현 |
| DPAPI 복호화 성공 여부만 검증 | 구현. 키 본문 외부 출력 없음 |
| 합성 Windows DPAPI/ACL 테스트 | CI에서만 합성 값으로 실행 |
| Node 수집기에서 실제 자격증명 읽기 | **미연결**: `collectorCredentialReaderIntegrated=false` |
| 실제 YouTube API 요청 | `RELEASED_FOR_FIRST_REAL_CALL=false`로 차단 |
| 프로젝트 E03 등 공식 증거 검증 | 미완료; 정본 `verifiedCount=0` 유지 |
| 키의 서버 운영 이전 | **금지**. 서버용 키/저장소는 별도 구성 |

G45-L7은 나중에 `readServerCredential` callback을 지원하지만, 이 PR은 **평문을 stdout/파이프/명령 인자/환경 변수로 전달하는 브리지**를 만들지 않는다. 실제 자격증명 리더 연동에는 향후 별도 보안 검토된 단발 실행 프로세스와 영속 승인·Quota 원장, 비밀의 메모리 생명주기 통제, URL/프록시 로그 차단이 필요하다. 보호 저장만 했다고 수집기가 키를 이미 사용한다고 주장하지 않는다.

## 5. 안전성·위험·실패 처리

- **실제 사용자 키는 CI/PR/GitHub에 절대 올리지 않는다.** GitHub Windows runner는 `G45_L9_SYNTHETIC_KEY_NOT_REAL_0123456789`라는 가짜 문자열만 임시 OS-local 디렉터리에 저장·복호화하고 즉시 삭제한다.
- Windows DPAPI CurrentUser는 다른 사용자·운영 서버 이전을 위해 설계된 이식 가능한 암호문이 아니다. 다른 PC나 Windows 계정으로 파일만 복사해 사용하면 안 된다.
- 같은 사용자 권한의 악성 코드, 키로깅, 메모리 덤프, 관리자 권한 탈취, 로컬 백업에는 DPAPI만으로 충분하지 않다.
- `-Status`는 키를 읽거나 복호화하지 않는다. `-Verify`는 DPAPI 암호문을 읽어 메모리에서만 검증한다. `-Enroll`은 사용자 키를 일시적으로 SecureString으로 받는다.
- 오류에서 예외 본문·키·경로를 출력하지 않고 `VAULT_OPERATION_FAILED` 및 종료 코드 3만 반환한다. 오류가 발생해도 개발자가 `.env`에 키를 넣는 우회는 하지 않는다.
- 키 회전: 먼저 Google Cloud에서 신규 제한 키·회전 전략을 확정하고, 이 로컬 파일 삭제/재등록을 계획한다. 현재 스크립트는 기존 파일을 자동 덮어쓰지 않는다.
- **E03은 PARTIAL 증거 단계**다. 공인 출구 IP가 Google의 허용 목록과 일치하는지, 비밀 보관/회전·권한·로그 위협 모델이 실제 운영자 환경에서 검수되기 전까지 `VERIFIED`로 올리지 않는다.

## 6. 공식 근거

- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertfrom-securestring
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertto-securestring
- https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls
- https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list

**판정:** DPAPI 보호 저장소의 Windows 개발용 파일·도구를 구성하며, 승인/수집/실분석은 계속 보류한다.
