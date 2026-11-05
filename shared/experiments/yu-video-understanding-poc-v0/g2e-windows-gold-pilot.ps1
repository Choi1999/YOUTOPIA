# G2-E private human gold authoring from approved LOCAL G2-D review packets.
# Default Plan: no video downloads, no APIs, no providers, no operating repository changes.
[CmdletBinding()]
param(
 [ValidateSet('Plan','Assess')][string]$Mode='Plan',
 [ValidateSet('Sintel','TearsOfSteel')][string]$Film='Sintel'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$node=Get-Command node -ErrorAction Stop
$script=Join-Path $PSScriptRoot 'g2e-gold-pilot.cjs'
if(-not (Test-Path -LiteralPath $script -PathType Leaf)){throw 'G2E_FAIL_CLOSED: gold pilot inspector missing'}
if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'G2E_FAIL_CLOSED: Windows LOCALAPPDATA missing'}
$g2d=Join-Path $env:LOCALAPPDATA ('YOUTOPIA\G2D-ManualReviews\'+$Film+'-manual-review.json')
$privateDir=Join-Path $env:LOCALAPPDATA 'YOUTOPIA\G2E-PrivateGoldDrafts'
$gold=Join-Path $privateDir ($Film+'-gold-candidates.json')
if($Mode -eq 'Plan'){
 if(-not (Test-Path -LiteralPath $g2d -PathType Leaf)){throw 'G2E_FAIL_CLOSED: G2-D local human review JSON not found'}
 if(Test-Path -LiteralPath $gold){throw 'G2E_FAIL_CLOSED: existing gold draft will not be overwritten'}
 New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
 & $node.Source $script plan --film $Film --g2d $g2d --out $gold
 if($LASTEXITCODE -ne 0){throw 'G2E_FAIL_CLOSED: private question plan generation failed'}
 Write-Host ('G2E_PRIVATE_AUTHORING_PATH: '+$gold)
 Write-Host 'Gold answer fields are EMPTY. Open this private local file in VS Code and verify each answer directly against the film.'
 Write-Host 'Do not add real answers or video to Git; do not upload to a provider.'
} else {
 if(-not (Test-Path -LiteralPath $gold -PathType Leaf)){throw 'G2E_FAIL_CLOSED: gold draft not found; run Plan first'}
 & $node.Source $script assess --file $gold
 if($LASTEXITCODE -ne 0){throw 'G2E_FAIL_CLOSED: gold draft validation failed'}
}
