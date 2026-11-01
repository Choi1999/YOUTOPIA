# Windows 수동 전달

배포 ZIP은 패키징 환경이 제공한 파일 링크로 다운로드한다. 앱 파일 링크에 임의 HTTPS
주소를 붙이지 않는다. 승인된 보관소의 실제 HTTPS URL이 따로 있다면 Invoke-WebRequest를
사용할 수 있지만 외부 호스팅/구독을 자동 만들지 않는다.

채팅 또는 별도 신뢰 경로의 ZIP SHA256을 먼저 대조한다. 내부 체크섬만 믿지 않는다.

```powershell
$Zip = Read-Host '다운로드한 전달 ZIP의 실제 경로'
$Expected = (Read-Host '별도 제공된 ZIP SHA256').Trim().ToLowerInvariant()
if ($Expected -notmatch '^[0-9a-f]{64}$') { throw 'Invalid SHA256' }
if ((Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Expected) { throw 'ZIP hash mismatch' }
$Dest = Read-Host '존재하지 않는 새 해제 경로'
if (Test-Path -LiteralPath $Dest) { throw 'Preserve existing directory' }
Expand-Archive -LiteralPath $Zip -DestinationPath $Dest
& (Join-Path $Dest 'upload-release.ps1') `
  -Server (Read-Host '승인된 기존 서버 주소') `
  -ExpectedHost (Read-Host '신뢰 root 연결로 확인한 short hostname') `
  -KeyFile (Read-Host '기존 전용 개인키 파일 경로; 키 값은 입력하지 않음') `
  -KnownHostsFile (Read-Host '기존 독립 검증 known_hosts 파일 경로') `
  -BundleRoot $Dest
```

업로드 도구는 delivery.json의 커밋·파일명·SHA256과 실제 archive 바이트를 확인한다.
기존 검증 ed25519 known_hosts, StrictHostKeyChecking=yes, 전용 공개키 인증을 사용한다.
키 생성/keyscan 신뢰/비밀번호 fallback/환경 재게시를 수행하지 않는다.
계정과 short hostname, sudo/Docker 그룹 부재를 확인하고 기존 incoming 아래의 새
`release-<source SHA>` 폴더로만 전송한다. 이미 있는 batch는 덮지 않는다.
SCP 후 서버의 sha256sum을 다시 확인하며 root·설치·서비스·DB 명령은 실행하지 않는다.

PowerShell의 기존 실행 정책을 전역 완화하는 명령은 제공하지 않는다. 조직에서 허용한
방식으로 먼저 스크립트를 검토한다. Windows OpenSSH/파일 권한·기존 키 경로는 실제 PC에서 확인한다.
이 저장소의 파서/mock 검증을 실제 Windows 전송 성공으로 표시하지 않는다.

서버 root는 별도 신뢰한 SHA256과 도구 manifest를 대조하고 [RESUME.md](RESUME.md)부터
진행한다. 완료한 계정·폴더·Java·nginx 설치를 처음부터 반복하지 않는다.
