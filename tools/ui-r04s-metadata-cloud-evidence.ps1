# UI-R04-S: metadata-only Cloud operating evidence OBSERVATION, never authorization.
# Default -Check: no gcloud, credentials, Cloud traffic, or user secrets.
# -Inspect: only explicit operator-initiated READS using existing gcloud auth;
#           may use local credential cache/log. No YouTube Data API requests.
# Requires PowerShell 7 for deterministic JSON array parsing.
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

function New-SanitizedReport(
    [string]$Status,
    [bool]$ProjectAccessible,
    [bool]$YoutubeEnabled,
    [bool]$GcloudCalled,
    [string]$ObservedAtUtc
) {
    # Never output project ID, account/email, API key or ID, public egress IP,
    # quota numbers, raw Cloud CLI stderr or provider response.
    return [ordered]@{
        schema = 'YOUTOPIA_R04S_METADATA_CLOUD_OBSERVATION_V01'
        status = $Status
        observedAtUtc = $ObservedAtUtc
        purpose = 'READ_ONLY_METADATA_READINESS_OBSERVATION'
        gcloudInvoked = $GcloudCalled
        existingGcloudAuthMayBeUsed = $GcloudCalled
        projectAccessibleToLocalIdentity = $ProjectAccessible
        youtubeDataApiEnabledLocallyObserved = $YoutubeEnabled
        projectOwnershipIndependentlyVerified = $false
        apiKeyApiRestrictionVerified = $false
        serverExternalEgressIpRestrictionVerified = $false
        serverSecretVaultAndRotationVerified = $false
        currentQuotaAvailableIndependentlyVerified = $false
        youtubeTermsAndMetadataPurposeApproved = $false
        durableServerQuotaAndTenantIsolationVerified = $false
        providerResponseProvenanceVerified = $false
        retentionAndErasureVerified = $false
        firstLiveMetadataCallApproved = $false
        metadataReadAuthorized = $false
        commentOrSentimentReadAuthorized = $false
        policyHoldUnchanged = $true
        actualYouTubeApiRequestsMade = 0
        apiKeysReadByThisScript = $false
    }
}

if ($PSCmdlet.ParameterSetName -eq 'Check') {
    $safe = New-SanitizedReport 'CHECK_ONLY_NO_CLOUD_ACCESS' $false $false $false $null
    Write-Output (ConvertTo-Json -InputObject $safe -Compress -Depth 5)
    return
}

# The operator explicitly selected an existing project. Never change gcloud
# default project, account, billing, IAM, quotas, API keys, or enabled services.
# Get-Command is NOT executable provenance validation: operator must verify
# official Google Cloud CLI installation and trusted PATH beforehand.
$gcloudCalled = $false
try {
    if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PS7_REQUIRED' }
    $cloud = Get-Command 'gcloud' -CommandType Application -ErrorAction Stop |
        Select-Object -First 1
    if ($null -eq $cloud) { throw 'CLI_UNAVAILABLE' }

    $gcloudCalled = $true
    $rawProject = & $cloud.Source 'projects' 'describe' $ProjectId '--format=json(projectId,lifecycleState)' '--quiet' '--verbosity=error' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'PROJECT_READ_FAILED' }
    $project = ConvertFrom-Json -InputObject ($rawProject -join [Environment]::NewLine)
    if ($null -eq $project -or
        $project.projectId -cne $ProjectId -or
        $project.lifecycleState -cne 'ACTIVE') {
        throw 'PROJECT_NOT_ACTIVE_OR_ID_MISMATCH'
    }

    $rawServices = & $cloud.Source 'services' 'list' '--enabled' "--project=$ProjectId" '--format=json' '--quiet' '--verbosity=error' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'SERVICE_READ_FAILED' }
    $services = ConvertFrom-Json -InputObject ($rawServices -join [Environment]::NewLine) -NoEnumerate
    if ($null -eq $services -or $services -isnot [System.Array]) {
        throw 'SERVICE_RESPONSE_INVALID'
    }

    $enabled = $false
    foreach ($service in $services) {
        if ($null -eq $service -or $null -eq $service.config) {
            throw 'SERVICE_ITEM_INVALID'
        }
        if ($service.state -ceq 'ENABLED' -and
            $service.config.name -ceq 'youtube.googleapis.com') {
            $enabled = $true
        }
    }

    $stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $safe = New-SanitizedReport 'LOCAL_CLOUD_OBSERVATION_REQUIRES_INDEPENDENT_REVIEW' $true $enabled $true $stamp
    Write-Output (ConvertTo-Json -InputObject $safe -Compress -Depth 5)
} catch {
    # Do not print native CLI exceptions, project ID, raw output or credentials.
    $safe = New-SanitizedReport 'LOCAL_CLOUD_EVIDENCE_UNAVAILABLE' $false $false $gcloudCalled $null
    Write-Output (ConvertTo-Json -InputObject $safe -Compress -Depth 5)
    exit 3
}
