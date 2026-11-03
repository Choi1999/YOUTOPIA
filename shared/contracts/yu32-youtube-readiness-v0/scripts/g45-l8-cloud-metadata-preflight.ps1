# G45-L8. Read-only operator-invoked Google Cloud metadata inspector.
# -Check is the default: no gcloud, network or credentials accessed.
[CmdletBinding(DefaultParameterSetName = 'Check')]
param(
    [Parameter(ParameterSetName = 'Check')]
    [switch]$Check,

    [Parameter(ParameterSetName = 'Inspect', Mandatory = $true)]
    [switch]$Inspect,

    [Parameter(ParameterSetName = 'Inspect', Mandatory = $true)]
    [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
    [string]$ProjectId
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-SafeReport([string]$Status, [bool]$ProjectReachable, [bool]$YoutubeApiObserved, [bool]$CloudCommandInvoked) {
    # No project ID, account, email, key ID/value, public IP or raw CLI stderr.
    return [ordered]@{
        schema = 'YU32_G45_L8_LOCAL_METADATA_V01'
        status = $Status
        scope = 'LOCAL_OPERATOR_METADATA_ONLY'
        cloudCommandInvoked = $CloudCommandInvoked
        projectReachableLocally = $ProjectReachable
        youtubeDataApiEnabledObserved = $YoutubeApiObserved
        projectOwnerVerified = $false
        apiKeyRestrictionsVerified = $false
        currentEgressIpVerified = $false
        availableQuotaVerified = $false
        sourceUsePolicyVerified = $false
        lifecycleAndErasureVerified = $false
        firstLiveCallApproved = $false
        canonicalEvidenceVerifiedCount = 0
        canonicalPolicy = 'POLICY_HOLD'
        liveYouTubeRequestsMade = 0
        # The script never inspects API key material. gcloud MAY still use
        # pre-existing OAuth credentials and maintain its own local cache/log.
        apiKeyMaterialReadByThisScript = $false
        cloudCliMayUseExistingAuthentication = $CloudCommandInvoked
    }
}

if ($PSCmdlet.ParameterSetName -eq 'Check') {
    $report = New-SafeReport 'CHECK_ONLY_NO_GCLOUD' $false $false $false
    Write-Output (ConvertTo-Json -InputObject $report -Compress)
    return
}

# The operator explicitly identifies an existing project. No default project,
# account switching, login, service enabling, key handling, quota modifications.
# The user must independently verify that PATH resolves to their genuine
# installed Google Cloud CLI; Get-Command is NOT a publisher signature check.
$cloudCommandInvoked = $false
try {
    $cloud = Get-Command -Name 'gcloud' -CommandType Application -ErrorAction Stop | Select-Object -First 1
    if ($null -eq $cloud) { throw 'CLOUD_CLI_NOT_FOUND' }

    # Only two read-only Google Cloud CLI commands. stderr is suppressed.
    # Invoking gcloud may use its existing login credentials and local cache.
    $cloudCommandInvoked = $true
    $rawProject = & $cloud.Source 'projects' 'describe' $ProjectId '--format=json(projectId,lifecycleState)' '--quiet' '--verbosity=error' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'PROJECT_READ_FAILED' }
    $project = ConvertFrom-Json -InputObject ($rawProject -join [Environment]::NewLine)
    if ($null -eq $project -or $project.projectId -cne $ProjectId -or $project.lifecycleState -cne 'ACTIVE') {
        throw 'PROJECT_IDENTITY_MISMATCH'
    }

    $rawServices = & $cloud.Source 'services' 'list' '--enabled' "--project=$ProjectId" '--format=json' '--quiet' '--verbosity=error' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'ENABLED_SERVICES_READ_FAILED' }
    # -NoEnumerate keeps [] as a valid zero-service result instead of $null,
    # and prevents one-item JSON arrays from being unwrapped to scalars.
    $services = ConvertFrom-Json -InputObject ($rawServices -join [Environment]::NewLine) -NoEnumerate
    if ($null -eq $services -or $services -isnot [System.Array]) {
        throw 'SERVICE_RESPONSE_INVALID'
    }

    $youtubeEnabled = $false
    foreach ($service in $services) {
        if ($null -eq $service -or $null -eq $service.config) {
            throw 'SERVICE_ITEM_INVALID'
        }
        # Require the explicit ENABLED state, not merely a similarly named
        # API in an unexpectedly shaped provider response.
        if ($service.state -ceq 'ENABLED' -and
            $service.config.name -ceq 'youtube.googleapis.com') {
            $youtubeEnabled = $true
        }
    }

    $report = New-SafeReport 'LOCAL_METADATA_OBSERVED_NOT_INDEPENDENTLY_VERIFIED' $true $youtubeEnabled $true
    Write-Output (ConvertTo-Json -InputObject $report -Compress)
} catch {
    # Do not propagate native exception text: it may contain identifiers.
    $report = New-SafeReport 'LOCAL_METADATA_UNAVAILABLE' $false $false $cloudCommandInvoked
    Write-Output (ConvertTo-Json -InputObject $report -Compress)
    exit 3
}
