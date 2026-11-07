# G2-G operator-only local adjudication. Existing G2-E, G2-F and backed-up JSON files are READ-ONLY.
[CmdletBinding()]
param(
 [ValidateSet('Serve','Check','Report')][string]$Mode='Serve',
 [ValidateSet('Sintel','TearsOfSteel')][string]$Film='Sintel',
 [ValidatePattern('^[A-Z0-9_-]{3,32}$')][string]$OperatorCode='FINAL_OPERATOR',
 [ValidatePattern('^[A-Z0-9_-]{3,32}$')][string]$ReviewerACode='REVIEWER_A',
 [ValidatePattern('^[A-Z0-9_-]{3,32}$')][string]$ReviewerBCode='REVIEWER_B'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'G2G_FAIL_CLOSED: LOCALAPPDATA not found' }
if ($ReviewerACode -ceq $ReviewerBCode) { throw 'G2G_FAIL_CLOSED: distinct reviewers required' }
$node = Get-Command node -ErrorAction Stop
$root = Join-Path $env:LOCALAPPDATA 'YOUTOPIA'
$author = [IO.Path]::GetFullPath((Join-Path $root ("G2E-PrivateGoldDrafts\$Film-gold-candidates.json")))
$reviewA = [IO.Path]::GetFullPath((Join-Path $root ("G2F-AssistedReviews\$Film-$ReviewerACode-assisted-review.json")))
$reviewB = [IO.Path]::GetFullPath((Join-Path $root ("G2F-AssistedReviews\$Film-$ReviewerBCode-assisted-review.json")))
$private = Join-Path $root 'G2G-FinalAdjudication'
$record = [IO.Path]::GetFullPath((Join-Path $private ("$Film-$OperatorCode-adjudication.json")))
$cli = Join-Path $PSScriptRoot 'g2g-final-adjudication.cjs'
$server = Join-Path $PSScriptRoot 'g2g-final-adjudication-server.cjs'
foreach ($file in @($author,$reviewA,$reviewB)) {
 if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
  throw ('G2G_FAIL_CLOSED: source JSON missing: '+(Split-Path -Leaf $file))
 }
}
if ($Mode -eq 'Serve' -and -not (Test-Path -LiteralPath $record)) {
 # First-run immutable source snapshot. The existing 2026-11-06 backup can predate the latest SIN-05 edits.
 $stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0,8))
 $snapshot = Join-Path $root ("G2G-SourceSnapshots\$Film\$stamp")
 New-Item -ItemType Directory -Path $snapshot -ErrorAction Stop | Out-Null
 $manifest = @()
 foreach ($file in @($author,$reviewA,$reviewB)) {
  $dest = Join-Path $snapshot (Split-Path -Leaf $file)
  Copy-Item -LiteralPath $file -Destination $dest -ErrorAction Stop
  $before = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
  $after = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash
  if ($before -cne $after) { throw 'G2G_FAIL_CLOSED: snapshot SHA256 mismatch' }
  $manifest += [PSCustomObject]@{ Name = (Split-Path -Leaf $file); Sha256 = $before.ToLowerInvariant() }
 }
 $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $snapshot 'SHA256-manifest.json') -Encoding UTF8
 Write-Host ('G2G_PRIVATE_SOURCE_SNAPSHOT_COMPLETE: '+$snapshot)
 New-Item -ItemType Directory -Path $private -Force | Out-Null
 & $node.Source $cli plan --author $author --review-a $reviewA --review-b $reviewB --operator $OperatorCode --out $record
 if ($LASTEXITCODE -ne 0) { throw 'G2G_FAIL_CLOSED: cannot create operator adjudication record' }
} else {
 if (-not (Test-Path -LiteralPath $record -PathType Leaf)) {
  throw 'G2G_FAIL_CLOSED: adjudication record missing. Run -Mode Serve first.'
 }
 $command = if ($Mode -eq 'Report') {'report'} else {'check'}
 & $node.Source $cli $command --record $record --author $author --review-a $reviewA --review-b $reviewB
 if ($LASTEXITCODE -ne 0) { throw 'G2G_FAIL_CLOSED: original review files changed or operator decisions invalid' }
 if ($Mode -ne 'Serve') { exit 0 }
}
if ($Mode -ne 'Serve') { exit 0 }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
 $env:Path += ';'+[Environment]::GetEnvironmentVariable('Path','User')
}
Get-Command ffmpeg -ErrorAction Stop | Out-Null
$movieName = if ($Film -eq 'Sintel') {'Sintel.2010.720p.mkv'} else {'tears_of_steel_720p.mov'}
$srtName = if ($Film -eq 'Sintel') {'sintel_en.srt'} else {'TOS-en.srt'}
$movie = [IO.Path]::GetFullPath((Join-Path $root ("G2C-AuthorizedPublisherMedia\$Film\$movieName")))
$srt = [IO.Path]::GetFullPath((Join-Path $root ("G2C-AuthorizedPublisherMedia\$Film\$srtName")))
foreach ($file in @($movie,$srt)) {
 if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
  throw ('G2G_FAIL_CLOSED: original publisher movie/SRT missing: '+(Split-Path -Leaf $file))
 }
}
Write-Host ('G2G_OPERATOR_ADJUDICATION_RECORD: '+$record)
Write-Host ('G2G_FILM: '+$Film)
Write-Host ('G2G_OPERATOR: '+$OperatorCode)
Write-Host 'Only the G2G final adjudication JSON can be edited. Both G2F reviewers and G2E draft files are read-only.'
Write-Host 'Only the operator can approve individual question decisions. No blind gold/G3 authorization. Ctrl+C exits.'
& $node.Source $server --record $record --author $author --review-a $reviewA --review-b $reviewB --movie $movie --srt $srt --operator $OperatorCode
if ($LASTEXITCODE -ne 0) { throw 'G2G_FAIL_CLOSED: operator local web stopped with error' }
