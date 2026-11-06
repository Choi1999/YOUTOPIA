# YOUTOPIA G2-F AI-assisted editorial review. Separate from BLIND G2-F; never overwrites blind packets.
# AI suggestions originate from chat-based prior observations, NOT direct full-film verification.
# Uses existing local G2-E source metadata, and local same-hash publisher video/SRT.
[CmdletBinding()]
param(
 [ValidateSet('Serve','Check','Assess')][string]$Mode='Serve',
 [ValidateSet('Sintel','TearsOfSteel')][string]$Film='Sintel',
 [ValidatePattern('^[A-Z0-9_-]{3,32}$')][string]$ReviewerCode='REVIEWER_A',
 [string]$ReviewerACode='REVIEWER_A',
 [string]$ReviewerBCode='REVIEWER_B'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'G2F_ASSISTED_FAIL_CLOSED: LOCALAPPDATA missing' }
$node=Get-Command node -ErrorAction Stop
$validator=Join-Path $PSScriptRoot 'g2f-assisted-review.cjs'
$runner=Join-Path $PSScriptRoot 'g2f-assisted-workspace-server.cjs'
$root=Join-Path $env:LOCALAPPDATA 'YOUTOPIA'
$author=Join-Path $root ('G2E-PrivateGoldDrafts\'+$Film+'-gold-candidates.json')
$private=Join-Path $root 'G2F-AssistedReviews'
function ReviewFile([string]$code) {
 if ($code -cnotmatch '^[A-Z0-9_-]{3,32}$') { throw 'G2F_ASSISTED_FAIL_CLOSED: invalid reviewer code' }
 return (Join-Path $private ($Film+'-'+$code+'-assisted-review.json'))
}
if ($Mode -eq 'Assess') {
 if ($ReviewerACode -eq $ReviewerBCode) { throw 'G2F_ASSISTED_FAIL_CLOSED: distinct human reviewers required' }
 if (-not (Test-Path -LiteralPath $author -PathType Leaf)) { throw 'G2F_ASSISTED_FAIL_CLOSED: G2-E author source missing' }
 $a=ReviewFile $ReviewerACode
 $b=ReviewFile $ReviewerBCode
 if (-not (Test-Path -LiteralPath $a -PathType Leaf) -or -not (Test-Path -LiteralPath $b -PathType Leaf)) {
  throw 'G2F_ASSISTED_FAIL_CLOSED: both assisted review JSON files required'
 }
 & $node.Source $validator assess --author $author --review-a $a --review-b $b
 if ($LASTEXITCODE -ne 0) { throw 'G2F_ASSISTED_FAIL_CLOSED: assisted review pair assessment failed' }
 exit 0
}
$packet=ReviewFile $ReviewerCode
if ($Mode -eq 'Check') {
 if (-not (Test-Path -LiteralPath $packet -PathType Leaf)) { throw 'G2F_ASSISTED_FAIL_CLOSED: assisted review JSON missing' }
 & $node.Source $validator check --file $packet
 if ($LASTEXITCODE -ne 0) { throw 'G2F_ASSISTED_FAIL_CLOSED: assisted report structure invalid' }
 exit 0
}
if (-not (Test-Path -LiteralPath $author -PathType Leaf)) {
 throw 'G2F_ASSISTED_FAIL_CLOSED: G2-E local source JSON missing; G2-E drafts must be completed first'
}
if (-not (Test-Path -LiteralPath $packet -PathType Leaf)) {
 New-Item -ItemType Directory -Path $private -Force | Out-Null
 & $node.Source $validator plan --author $author --reviewer $ReviewerCode --out $packet
 if ($LASTEXITCODE -ne 0) { throw 'G2F_ASSISTED_FAIL_CLOSED: cannot create AI-assisted reviewer packet' }
} else {
 & $node.Source $validator check --file $packet | Out-Null
 if ($LASTEXITCODE -ne 0) { throw 'G2F_ASSISTED_FAIL_CLOSED: prior assisted reviewer file invalid; do not overwrite' }
}
# Refresh only the current PowerShell PATH for an existing Windows WinGet installation.
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
 $env:Path+=';'+[Environment]::GetEnvironmentVariable('Path','User')
}
Get-Command ffmpeg -ErrorAction Stop | Out-Null
$movie=Join-Path $root ('G2C-AuthorizedPublisherMedia\'+$Film+'\'+$(if ($Film -eq 'Sintel') {'Sintel.2010.720p.mkv'} else {'tears_of_steel_720p.mov'}))
$srt=Join-Path $root ('G2C-AuthorizedPublisherMedia\'+$Film+'\'+$(if ($Film -eq 'Sintel') {'sintel_en.srt'} else {'TOS-en.srt'}))
foreach($f in @($movie,$srt)) {
 if (-not (Test-Path -LiteralPath $f -PathType Leaf)) {
  throw 'G2F_ASSISTED_FAIL_CLOSED: matching official local film or SRT file missing'
 }
}
Write-Host ('G2F_ASSISTED_FILM: '+$Film)
Write-Host ('G2F_ASSISTED_REVIEWER: '+$ReviewerCode)
Write-Host ('G2F_ASSISTED_PRIVATE_REPORT: '+$packet)
Write-Host 'This mode presents AI answers BEFORE human verification. This is NOT a blinded review.'
Write-Host 'Existing G2-F blind reviewer files and G2-E author gold are not changed. Press Ctrl+C to stop.'
& $node.Source $runner --packet $packet --movie $movie --srt $srt --reviewer $ReviewerCode
if ($LASTEXITCODE -ne 0) { throw 'G2F_ASSISTED_FAIL_CLOSED: assisted web server exited with error' }
