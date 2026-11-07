# YOUTOPIA G45-L9: user-scope Windows DPAPI vault for a DEV-ONLY YouTube API key.
# No cloud/YouTube calls; never print the key, plaintext or encrypted blob.
# Only the operator can -Enroll a REAL key using an interactive secure prompt.
[CmdletBinding(DefaultParameterSetName = 'Status')]
param(
    [Parameter(ParameterSetName = 'Status')]
    [switch]$Status,

    [Parameter(ParameterSetName = 'Enroll', Mandatory = $true)]
    [switch]$Enroll,

    [Parameter(ParameterSetName = 'Verify', Mandatory = $true)]
    [switch]$Verify,

    [Parameter(ParameterSetName = 'Remove', Mandatory = $true)]
    [switch]$Remove,

    [Parameter(ParameterSetName = 'SelfTest', Mandatory = $true)]
    [switch]$SelfTest
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-Unsafe([string]$Code) {
    throw ('G45_L9_' + $Code)
}

function Assert-Windows {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        Stop-Unsafe 'WINDOWS_ONLY'
    }
}
function Assert-NotReparse([string]$Path) {
    if (Test-Path -LiteralPath $Path) {
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            Stop-Unsafe 'REPARSE_PATH'
        }
    }
}
function Get-VaultLocation {
    $local = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    if ([string]::IsNullOrWhiteSpace($local) -or -not [IO.Path]::IsPathRooted($local)) {
        Stop-Unsafe 'LOCAL_APPDATA_INVALID'
    }
    $root = Join-Path $local 'YOUTOPIA'
    $dir = Join-Path $root 'Secrets'
    Assert-NotReparse $root
    Assert-NotReparse $dir
    Assert-NotReparse (Join-Path $dir 'youtube-dev.dpapi')
    return [pscustomobject]@{
        Parent = $root
        Directory = $dir
        File = (Join-Path $dir 'youtube-dev.dpapi')
    }
}
function Get-AllowedSids {
    $current = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if ([string]::IsNullOrWhiteSpace($current)) {
        Stop-Unsafe 'USER_IDENTITY_UNAVAILABLE'
    }
    return @($current, 'S-1-5-18', 'S-1-5-32-544')
}
function Assert-PrivateAcl([string]$Path) {
    Assert-NotReparse $Path
    $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
    if (-not $acl.AreAccessRulesProtected) {
        Stop-Unsafe 'INHERITED_ACL'
    }
    $allowed = @(Get-AllowedSids)
    $current = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $userAllowed = $false
    foreach ($rule in @($acl.Access)) {
        $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        if ($allowed -cnotcontains $sid -or
            $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) {
            Stop-Unsafe 'EXCESSIVE_ACL'
        }
        if ($sid -ceq $current -and
            ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::ReadData) -ne 0) {
            $userAllowed = $true
        }
    }
    if (-not $userAllowed) {
        Stop-Unsafe 'CURRENT_USER_CANNOT_READ'
    }
}
function Set-PrivateAcl([string]$Path, [bool]$Directory) {
    Assert-NotReparse $Path
    $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) {
        $acl.RemoveAccessRuleAll($rule)
    }
    $inherit = [Security.AccessControl.InheritanceFlags]::None
    if ($Directory) {
        $inherit = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
                   [Security.AccessControl.InheritanceFlags]::ObjectInherit
    }
    $propagation = [Security.AccessControl.PropagationFlags]::None
    $rights = [Security.AccessControl.FileSystemRights]::FullControl
    $allow = [Security.AccessControl.AccessControlType]::Allow
    foreach ($sid in @(Get-AllowedSids)) {
        $principal = [Security.Principal.SecurityIdentifier]::new($sid)
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $principal, $rights, $inherit, $propagation, $allow)
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl -ErrorAction Stop
    Assert-PrivateAcl $Path
}
function Initialize-VaultDirectory([string]$Parent, [string]$Directory) {
    Assert-NotReparse $Parent
    if (-not (Test-Path -LiteralPath $Parent -PathType Container)) {
        $null = New-Item -ItemType Directory -Path $Parent -ErrorAction Stop
    }
    Assert-NotReparse $Parent
    Assert-NotReparse $Directory
    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
        $null = New-Item -ItemType Directory -Path $Directory -ErrorAction Stop
    }
    Set-PrivateAcl $Directory $true
}
function Save-DpapiSecret([string]$File, [Security.SecureString]$Secret) {
    if ($Secret.Length -lt 30 -or $Secret.Length -gt 160) {
        Stop-Unsafe 'INVALID_KEY_LENGTH'
    }
    if (Test-Path -LiteralPath $File) {
        Stop-Unsafe 'ALREADY_ENROLLED'
    }
    $dir = Split-Path -Parent $File
    Assert-PrivateAcl $dir
    $cipher = $null
    $temporary = Join-Path $dir ([IO.Path]::GetRandomFileName() + '.tmp')
    try {
        # Without -Key or -SecureKey, Windows DPAPI encrypts for this user.
        $cipher = ConvertFrom-SecureString -SecureString $Secret -ErrorAction Stop
        if ($cipher -notmatch '^[0-9A-Fa-f]{100,}$' -or $cipher.Length -gt 8192) {
            Stop-Unsafe 'DPAPI_OUTPUT_INVALID'
        }
        if (Test-Path -LiteralPath $temporary) { Stop-Unsafe 'TEMP_NAME_COLLISION' }
        [IO.File]::WriteAllText($temporary, $cipher, [Text.UTF8Encoding]::new($false))
        Set-PrivateAcl $temporary $false
        [IO.File]::Move($temporary, $File) # fails closed if destination already exists
        Assert-PrivateAcl $File
    } finally {
        if (Test-Path -LiteralPath $temporary) {
            [IO.File]::Delete($temporary)
        }
        $cipher = $null
    }
}
function Test-DpapiSecret([string]$File) {
    Assert-NotReparse $File
    $dir = Split-Path -Parent $File
    Assert-PrivateAcl $dir
    if (-not (Test-Path -LiteralPath $File -PathType Leaf)) {
        Stop-Unsafe 'NO_ENROLLED_KEY'
    }
    Assert-PrivateAcl $File
    if ((Get-Item -LiteralPath $File).Length -gt 16384) {
        Stop-Unsafe 'ENCRYPTED_FILE_TOO_LARGE'
    }
    $encrypted = [IO.File]::ReadAllText($File, [Text.Encoding]::UTF8)
    $secret = $null
    try {
        $secret = ConvertTo-SecureString -String $encrypted -ErrorAction Stop
        if ($secret.Length -lt 30 -or $secret.Length -gt 160) {
            Stop-Unsafe 'DECRYPTED_KEY_LENGTH_INVALID'
        }
        # No plaintext conversion, echo, token validation request or API call.
        return $true
    } finally {
        if ($null -ne $secret) { $secret.Dispose() }
        $encrypted = $null
    }
}
function New-SafeStatus([string]$Status, [bool]$Exists, [bool]$AclRestricted,
                        [bool]$Decrypted, [bool]$Synthetic) {
    return [ordered]@{
        schema = 'YU32_G45_L9_DEV_DPAPI_V01'
        status = $Status
        environment = 'WINDOWS_DEV_ONLY'
        vaultPresent = $Exists
        aclRestrictedObserved = $AclRestricted
        dpapiDecryptionPerformed = $Decrypted
        syntheticFixtureOnly = $Synthetic
        secretPrinted = $false
        cloudApiRequests = 0
        youtubeApiRequests = 0
        providerPolicy = 'POLICY_HOLD'
        verifiedGateCount = 0
        liveCallsAuthorized = $false
        collectorCredentialReaderIntegrated = $false
    }
}
function Write-SafeStatus([object]$Result) {
    Write-Output (ConvertTo-Json -InputObject $Result -Compress)
}

try {
    Assert-Windows
    if ($PSCmdlet.ParameterSetName -eq 'SelfTest') {
        # Synthetic known-non-credential only; unique OS-local temp location,
        # never the operator's actual dev vault and never a real Google key.
        $local = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
        $root = Join-Path $local ('YOUTOPIA-DPAPI-SYNTHETIC-' + [Guid]::NewGuid().ToString('N'))
        $dir = Join-Path $root 'Secrets'
        $testFile = Join-Path $dir 'synthetic.dpapi'
        $fake = ConvertTo-SecureString -String 'G45_L9_SYNTHETIC_KEY_NOT_REAL_0123456789' -AsPlainText -Force
        try {
            Initialize-VaultDirectory $root $dir
            Save-DpapiSecret $testFile $fake
            if (-not (Test-DpapiSecret $testFile)) {
                Stop-Unsafe 'SYNTHETIC_ROUNDTRIP_FAILED'
            }
            Write-SafeStatus (New-SafeStatus 'SYNTHETIC_DPAPI_ROUNDTRIP_PASS' $false $true $true $true)
        } finally {
            $fake.Dispose()
            if (Test-Path -LiteralPath $root) {
                Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
        return
    }

    $loc = Get-VaultLocation
    if ($PSCmdlet.ParameterSetName -eq 'Status') {
        $exists = Test-Path -LiteralPath $loc.File -PathType Leaf
        if ($exists) {
            Assert-PrivateAcl $loc.Directory
            Assert-PrivateAcl $loc.File
        }
        $label = if ($exists) { 'VAULT_PRESENT_NO_DECRYPT' } else { 'VAULT_NOT_ENROLLED' }
        Write-SafeStatus (New-SafeStatus $label $exists $exists $false $false)
        return
    }
    if ($PSCmdlet.ParameterSetName -eq 'Enroll') {
        if (Test-Path -LiteralPath $loc.File) { Stop-Unsafe 'ALREADY_ENROLLED' }
        $secure = $null
        try {
            $secure = Read-Host 'Enter DEV YouTube API key locally (not in chat)' -AsSecureString
            Initialize-VaultDirectory $loc.Parent $loc.Directory
            Save-DpapiSecret $loc.File $secure
            Write-SafeStatus (New-SafeStatus 'DEV_KEY_ENROLLED_DPAPI' $true $true $false $false)
        } finally {
            if ($null -ne $secure) { $secure.Dispose() }
        }
        return
    }
    if ($PSCmdlet.ParameterSetName -eq 'Verify') {
        if (-not (Test-DpapiSecret $loc.File)) { Stop-Unsafe 'VERIFY_FAILED' }
        Write-SafeStatus (New-SafeStatus 'DEV_KEY_DECRYPTED_LOCALLY_NO_OUTPUT' $true $true $true $false)
        return
    }
    if ($PSCmdlet.ParameterSetName -eq 'Remove') {
        if (-not (Test-Path -LiteralPath $loc.File -PathType Leaf)) {
            Stop-Unsafe 'NOT_ENROLLED'
        }
        Assert-PrivateAcl $loc.Directory
        Assert-PrivateAcl $loc.File
        $confirm = Read-Host 'Type REMOVE to delete ONLY the local encrypted copy (does not revoke Google key)'
        if ($confirm -cne 'REMOVE') { Stop-Unsafe 'DELETE_NOT_CONFIRMED' }
        [IO.File]::Delete($loc.File)
        Write-SafeStatus (New-SafeStatus 'LOCAL_ENCRYPTED_COPY_REMOVED_NOT_REVOKED' $false $true $false $false)
        return
    }
    Stop-Unsafe 'UNSUPPORTED_OPERATION'
} catch {
    # Never emit the exception (it might contain paths, values or transcripts).
    Write-SafeStatus (New-SafeStatus 'VAULT_OPERATION_FAILED' $false $false $false $false)
    exit 3
}
