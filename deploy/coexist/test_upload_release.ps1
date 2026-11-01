# Run in a child PowerShell process: pwsh -NoProfile -File test_upload_release.ps1
# All OpenSSH calls are mocked; no real key or network is used.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$target=Join-Path $PSScriptRoot 'upload-release.ps1'
$tokens=$null;$errors=$null
[System.Management.Automation.Language.Parser]::ParseFile($target,[ref]$tokens,[ref]$errors) | Out-Null
if ($errors.Count) { throw 'Upload script syntax failure' }
$root=Join-Path ([IO.Path]::GetTempPath()) ('youtopia-upload-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root,(Join-Path $root 'artifacts') | Out-Null
$sha='a'*40
$release="release-$sha.tar.gz";$tools="operator-tools-$sha.tar.gz"
[IO.File]::WriteAllText((Join-Path $root "artifacts/$release"),'synthetic application archive')
[IO.File]::WriteAllText((Join-Path $root "artifacts/$tools"),'synthetic tools archive')
$key=Join-Path $root 'synthetic-key-file';$known=Join-Path $root 'synthetic-known-hosts'
[IO.File]::WriteAllText($key,'SYNTHETIC_NON_KEY_FILE')
[IO.File]::WriteAllText($known,'SYNTHETIC_NON_TRUST_FILE')
$metadata=@{schema_version=1;source_sha=$sha;artifacts=@{}}
foreach ($name in @($release,$tools)) {
    $metadata.artifacts[$name]=(Get-FileHash (Join-Path $root "artifacts/$name") -Algorithm SHA256).Hash.ToLowerInvariant()
}
$metaPath=Join-Path $root 'delivery.json'
$metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $metaPath
$global:UploadCalls=[Collections.Generic.List[string]]::new()
$global:UploadSshFails=$false;$global:UploadScpFails=$false;$global:UploadTrustMissing=$false
function global:ssh-keygen {
    $global:UploadCalls.Add('keygen');$global:LASTEXITCODE=0
    if ($global:UploadTrustMissing) { $global:LASTEXITCODE=1; return }
    'synthetic.example.invalid ssh-ed25519 SYNTHETIC_PUBLIC_KEY_FOR_MOCK_ONLY'
}
function global:ssh {
    $global:UploadCalls.Add('ssh');$global:LASTEXITCODE=0
    $payload=($input | Out-String)
    if ($args[-2] -cne 'sh' -or $args[-1] -cne '-se') { throw 'Shell source must not be a native command argument' }
    if ($payload -notmatch '(?s)\nexit 0\n') { throw 'LF exit must precede native pipeline terminator' }
    if ($payload -match 'id -un' -and $payload -notmatch 'test "\$\(id -un\)" = youtopia-deploy') { throw 'Remote shell quotes were lost' }
    foreach ($option in @('StrictHostKeyChecking=yes','IdentitiesOnly=yes','PasswordAuthentication=no','KbdInteractiveAuthentication=no')) {
        if (-not ($args -contains $option)) { throw 'Required SSH guard missing' }
    }
    if ($global:UploadSshFails) { $global:LASTEXITCODE=255 }
}
function global:scp {
    $global:UploadCalls.Add('scp');$global:LASTEXITCODE=0
    if (-not ($args -contains 'StrictHostKeyChecking=yes')) { throw 'SCP trust guard missing' }
    if ($global:UploadScpFails) { $global:LASTEXITCODE=1 }
}
function Invoke-Upload {
    & $target -Server 'synthetic.example.invalid' -ExpectedHost 'synthetic-host' -KeyFile $key -KnownHostsFile $known -BundleRoot $root
}
function Expect-Failure([string]$expectedCalls) {
    $failed=$false
    try { Invoke-Upload } catch { $failed=$true }
    if (-not $failed -or ($global:UploadCalls -join ',') -cne $expectedCalls) { throw 'Negative upload boundary failed' }
}
try {
    Invoke-Upload
    if (Test-Path -LiteralPath (Join-Path $root 'artifacts/UPLOAD_SHA256SUMS.txt')) { throw 'Existing artifact directory must not be modified' }
    if (($global:UploadCalls -join ',') -cne 'keygen,ssh,scp,ssh') { throw 'Unexpected successful flow' }
    $global:UploadCalls.Clear();$global:UploadSshFails=$true
    Expect-Failure 'keygen,ssh'
    $global:UploadCalls.Clear();$global:UploadSshFails=$false;$global:UploadScpFails=$true
    Expect-Failure 'keygen,ssh,scp'
    $global:UploadCalls.Clear();$global:UploadScpFails=$false;$global:UploadTrustMissing=$true
    Expect-Failure 'keygen'
    $global:UploadCalls.Clear();$global:UploadTrustMissing=$false
    [IO.File]::AppendAllText((Join-Path $root "artifacts/$tools"),'tampered')
    Expect-Failure ''
    Write-Output 'PASS: parser, verified upload, SSH failure, SCP failure, missing trust and tampered artifact boundaries'
    Write-Output 'MOCK_ONLY: Windows native upload not executed'
    if (Test-Path -LiteralPath '/bin/sh') {
        # Execute the stdin design through a real shell with a WinPS-style CRLF
        # pipeline trailer. No SSH/network is involved in this extra check.
        $nativeScript='test "$(printf synthetic)" = synthetic' + "`n" + 'test "$HOME" != ""' + "`nexit 0`n`r`n"
        $nativeScript | & /bin/sh -se
        if ($LASTEXITCODE -ne 0) { throw 'Native stdin shell quoting regression' }
        Write-Output 'PASS: real POSIX shell preserves substitutions/quotes and ignores the Windows CRLF trailer after exit'
    }
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force
    Remove-Item Function:\ssh,Function:\scp,Function:\ssh-keygen
}
