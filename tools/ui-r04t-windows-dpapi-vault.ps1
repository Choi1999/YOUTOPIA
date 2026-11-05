# UI-R04-T: Windows DPAPI CurrentUser OFFLINE vault storage rehearsal.
#
# -Check: no files, secrets, DPAPI operations, network or Cloud/YouTube API.
# -SelfTest: generates one SYNTHETIC marker and tests DPAPI protection
#   through a temporary ciphertext-only file under the current user TEMP.
# Neither mode accepts a real API key, secret, arbitrary path or credentials.
# This script DOES NOT provision the production YOUTOPIA credential vault.
# Use native Windows PowerShell 7+; do not run this file on WSL/Linux.
[CmdletBinding(DefaultParameterSetName = "Check")]
param(
    [Parameter(ParameterSetName = "Check")]
    [switch]$Check,

    [Parameter(ParameterSetName = "SelfTest", Mandatory = $true)]
    [switch]$SelfTest
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-SafeReport(
    [string]$Status,
    [string]$Mode,
    [bool]$SupportedWindows,
    [bool]$RoundTrip,
    [bool]$TestCipherFileUsed,
    [bool]$TempCipherFileRemoved
) {
    return [ordered]@{
        schema = "YOUTOPIA_R04T_WINDOWS_DPAPI_OFFLINE_V01"
        status = $Status
        mode = $Mode
        policy = "POLICY_HOLD"
        dpapiScope = "CURRENT_USER"
        supportedWindows = $SupportedWindows
        syntheticRoundTripSucceeded = $RoundTrip
        syntheticCipherFileUsed = $TestCipherFileUsed
        temporaryCipherFileRemoved = $TempCipherFileRemoved
        realApiKeyRead = $false
        actualCredentialsProvisioned = $false
        credentialReaderEnabled = $false
        productionSecretStoreModified = $false
        cloudCliInvoked = $false
        externalRequestsMade = 0
        firstLiveMetadataReadAuthorized = $false
        firstLiveCommentReadAuthorized = $false
    }
}

function Write-Report([ordered]$Value) {
    Write-Output (ConvertTo-Json -InputObject $Value -Compress -Depth 4)
}

# PowerShell 7+ on Windows is required; the user/process profile matters.
# Do not accidentally fall back to machine scope or plaintext AES keys.
$windows = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
$hasPwsh7 = $PSVersionTable.PSVersion.Major -ge 7
if (-not $windows -or -not $hasPwsh7) {
    Write-Report (New-SafeReport "UNSUPPORTED_PLATFORM" $PSCmdlet.ParameterSetName $false $false $false $false)
    exit 3
}

if ($PSCmdlet.ParameterSetName -eq "Check") {
    # No attempt to decrypt or verify the user's actual credential state.
    Write-Report (New-SafeReport "OFFLINE_PLATFORM_READY_NOT_AUTHORIZED" "Check" $true $false $false $false)
    return
}

# Random synthetic test marker. Not a real key and never printed or logged.
$marker = "R04T_SYNTHETIC_ONLY_" + [Guid]::NewGuid().ToString("N")
$secure = $null
$restored = $null
$temporary = $null
$readFromDisk = $false
$cleaned = $false
$pass = $false
$pointer = [IntPtr]::Zero

try {
    $secure = ConvertTo-SecureString -String $marker -AsPlainText -Force
    # Without -Key/-SecureKey, ConvertFrom-SecureString uses Windows DPAPI
    # tied to the current Windows user (not the entire machine).
    $sealed = ConvertFrom-SecureString -SecureString $secure
    if ([string]::IsNullOrWhiteSpace($sealed) -or
        $sealed.Contains($marker) -or $sealed.Length -gt 8192) {
        throw "UNSAFE_SYNTHETIC_CIPHERTEXT"
    }

    $temporary = Join-Path ([IO.Path]::GetTempPath()) ("youtopia-r04t-dpapi-" + [Guid]::NewGuid().ToString("N") + ".blob")
    # CreateNew is deliberately non-overwriting; only ciphertext is written.
    $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $data = [Text.Encoding]::ASCII.GetBytes($sealed)
        try {
            $stream.Write($data, 0, $data.Length)
            $stream.Flush($true)
        } finally {
            [Array]::Clear($data, 0, $data.Length)
        }
    } finally {
        $stream.Dispose()
    }
    $readFromDisk = $true
    $ciphertext = [IO.File]::ReadAllText($temporary, [Text.Encoding]::ASCII)
    if ([string]::IsNullOrWhiteSpace($ciphertext) -or $ciphertext.Contains($marker)) {
        throw "CIPHERTEXT_FILE_CORRUPT"
    }
    $restored = ConvertTo-SecureString -String $ciphertext

    # Only the SYNTHETIC marker is temporarily compared as plaintext.
    # Never use this path for a real credential until a separate reviewed
    # backend secret-transfer design is explicitly approved.
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($restored)
    $syntheticRecovered = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $pass = ($syntheticRecovered -ceq $marker)
    $syntheticRecovered = $null
} catch {
    # No raw exception, file path, ciphertext, SID, username or marker logged.
    $pass = $false
} finally {
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    if ($null -ne $secure) { $secure.Dispose() }
    if ($null -ne $restored) { $restored.Dispose() }
    if ($null -ne $temporary -and [IO.File]::Exists($temporary)) {
        try {
            [IO.File]::Delete($temporary)
        } catch { $pass = $false }
    }
    $cleaned = $null -eq $temporary -or -not [IO.File]::Exists($temporary)
    $marker = $null
    $sealed = $null
    $ciphertext = $null
}

if (-not $pass -or -not $readFromDisk -or -not $cleaned) {
    Write-Report (New-SafeReport "SYNTHETIC_DPAPI_SELFTEST_FAILED" "SelfTest" $true $false $readFromDisk $cleaned)
    exit 3
}
Write-Report (New-SafeReport "SYNTHETIC_DPAPI_ROUNDTRIP_PASS" "SelfTest" $true $true $true $true)
