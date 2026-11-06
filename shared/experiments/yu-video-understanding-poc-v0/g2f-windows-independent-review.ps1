# G2-F reviewer-blind independent human evidence record. Local-only, read-only author source.
# No network/provider calls, no merge, no rights or human gold approval.
[CmdletBinding()]
param(
 [ValidateSet('Plan','Check','Assess')][string]$Mode='Plan',
 [ValidateSet('Sintel','TearsOfSteel')][string]$Film='Sintel',
 [string]$ReviewerCode='',
 [string]$ReviewerACode='REVIEWER_A',
 [string]$ReviewerBCode='REVIEWER_B'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'G2F_FAIL_CLOSED: LOCALAPPDATA missing' }
$node=Get-Command node -ErrorAction Stop
$tool=Join-Path $PSScriptRoot 'g2f-blind-review.cjs'
if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) { throw 'G2F_FAIL_CLOSED: offline reviewer tool missing' }
$author=Join-Path $env:LOCALAPPDATA ('YOUTOPIA\G2E-PrivateGoldDrafts\'+$Film+'-gold-candidates.json')
$folder=Join-Path $env:LOCALAPPDATA 'YOUTOPIA\G2F-IndependentReviews'
function Assert-ReviewerCode([string]$value) {
 if ($value -cnotmatch '^[A-Z0-9_-]{3,32}$') { throw 'G2F_FAIL_CLOSED: reviewer code must be 3-32 uppercase letters, digits, underscore or dash' }
}
function Get-ReviewPath([string]$value) {
 Assert-ReviewerCode $value
 return (Join-Path $folder ($Film+'-'+$value+'-blind-review.json'))
}
if ($Mode -eq 'Plan') {
 if (-not (Test-Path -LiteralPath $author -PathType Leaf)) { throw 'G2F_FAIL_CLOSED: local G2-E gold author draft not found' }
 Assert-ReviewerCode $ReviewerCode
 $target=Get-ReviewPath $ReviewerCode
 if (Test-Path -LiteralPath $target) { throw 'G2F_FAIL_CLOSED: existing independent reviewer report will never be overwritten' }
 New-Item -ItemType Directory -Path $folder -Force | Out-Null
 & $node.Source $tool plan --author $author --reviewer $ReviewerCode --out $target --film $Film
 if ($LASTEXITCODE -ne 0) { throw 'G2F_FAIL_CLOSED: question-only blind packet creation failed' }
 Write-Host ('G2F_PRIVATE_BLIND_PACKET: '+$target)
 Write-Host 'Reviewers must not see the G2-E author answer file or prior ChatGPT suggested answers.'
 Write-Host 'Reviewer observes the authorized original film independently and edits ONLY their own private report.'
} elseif ($Mode -eq 'Check') {
 $target=Get-ReviewPath $ReviewerCode
 if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw 'G2F_FAIL_CLOSED: reviewer JSON missing' }
 & $node.Source $tool check --file $target
 if ($LASTEXITCODE -ne 0) { throw 'G2F_FAIL_CLOSED: reviewer packet validation failed' }
} else {
 if (-not (Test-Path -LiteralPath $author -PathType Leaf)) { throw 'G2F_FAIL_CLOSED: G2-E source JSON missing' }
 if ($ReviewerACode -eq $ReviewerBCode) { throw 'G2F_FAIL_CLOSED: two different reviewer codes required' }
 $a=Get-ReviewPath $ReviewerACode
 $b=Get-ReviewPath $ReviewerBCode
 if (-not (Test-Path -LiteralPath $a -PathType Leaf) -or -not (Test-Path -LiteralPath $b -PathType Leaf)) {
  throw 'G2F_FAIL_CLOSED: need two local reviewer reports from distinct reviewers'
 }
 & $node.Source $tool assess --author $author --review-a $a --review-b $b
 if ($LASTEXITCODE -ne 0) { throw 'G2F_FAIL_CLOSED: independent pair assessment failed' }
}
